import { z } from "zod";
import { HttpError } from "../exceptions/http.exception.js";
import type { AuthedUser } from "../interface/auth.interface.js";
import { buildWeeklySummaryPrompt, getAiProvider, SUGGESTED_OPENROUTER_MODELS } from "../micro-services/ai-providers/index.js";
import type { AiProviderId } from "../micro-services/ai-providers/types.js";
import type { StatusFormat, WeeklyStatusInput } from "./ai.service.js";
import { generateWeeklyStatus as templateWeeklyStatus } from "./ai.service.js";
import { buildReportPrompt, type ReportWorkContext } from "./report-format.service.js";
import { prisma } from "../utils/prisma.js";
import { apiKeyLast4, decryptSecret, encryptSecret, maskApiKey } from "../utils/secret-crypto.js";

const saveDto = z.object({
  provider: z.enum(["openrouter"]).default("openrouter"),
  model: z.string().min(1).max(200).default("openrouter/free"),
  apiKey: z.string().min(8).max(500).optional(),
  enabled: z.boolean().optional(),
});

function looksMasked(apiKey: string | undefined) {
  if (!apiKey) return true;
  return apiKey.includes("•") || apiKey.includes("*");
}

function publicConfig(row: {
  provider: string;
  model: string;
  apiKeyLast4: string;
  enabled: boolean;
  lastTestedAt: Date | null;
  lastTestStatus: string | null;
  updatedAt: Date;
}) {
  return {
    configured: true,
    provider: row.provider.toLowerCase() as AiProviderId,
    model: row.model,
    apiKeyMasked: maskApiKey(row.apiKeyLast4),
    hasApiKey: true,
    enabled: row.enabled,
    lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
    lastTestStatus: row.lastTestStatus,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function listSuggestedModels() {
  return { providers: [{ id: "openrouter", label: "OpenRouter" }], models: SUGGESTED_OPENROUTER_MODELS };
}

export async function getAiConfig(user: AuthedUser) {
  const row = await prisma.userAiConfig.findUnique({ where: { userId: user.id } });
  if (!row) {
    return {
      configured: false,
      provider: "openrouter" as const,
      model: "openrouter/free",
      apiKeyMasked: null,
      hasApiKey: false,
      enabled: false,
      lastTestedAt: null,
      lastTestStatus: null,
      updatedAt: null,
    };
  }
  return publicConfig(row);
}

export async function saveAiConfig(user: AuthedUser, input: unknown) {
  const body = saveDto.safeParse(input);
  if (!body.success) throw new HttpError(400, "Invalid AI configuration");

  const existing = await prisma.userAiConfig.findUnique({ where: { userId: user.id } });
  const wantsNewKey = body.data.apiKey && !looksMasked(body.data.apiKey);

  if (!existing && !wantsNewKey) {
    throw new HttpError(400, "API key is required");
  }

  let ciphertext = existing?.apiKeyCiphertext;
  let iv = existing?.apiKeyIv;
  let tag = existing?.apiKeyTag;
  let last4 = existing?.apiKeyLast4;

  if (wantsNewKey && body.data.apiKey) {
    const sealed = encryptSecret(body.data.apiKey.trim());
    ciphertext = sealed.ciphertext;
    iv = sealed.iv;
    tag = sealed.tag;
    last4 = apiKeyLast4(body.data.apiKey);
  }

  if (!ciphertext || !iv || !tag || !last4) {
    throw new HttpError(400, "API key is required");
  }

  const row = await prisma.userAiConfig.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      scope: "PERSONAL",
      provider: "OPENROUTER",
      model: body.data.model.trim(),
      apiKeyCiphertext: ciphertext,
      apiKeyIv: iv,
      apiKeyTag: tag,
      apiKeyLast4: last4,
      enabled: body.data.enabled ?? true,
    },
    update: {
      provider: "OPENROUTER",
      model: body.data.model.trim(),
      apiKeyCiphertext: ciphertext,
      apiKeyIv: iv,
      apiKeyTag: tag,
      apiKeyLast4: last4,
      ...(body.data.enabled !== undefined ? { enabled: body.data.enabled } : {}),
    },
  });

  return publicConfig(row);
}

export async function deleteAiConfig(user: AuthedUser) {
  await prisma.userAiConfig.deleteMany({ where: { userId: user.id } });
  return { ok: true, configured: false };
}

function decryptUserKey(row: {
  apiKeyCiphertext: string;
  apiKeyIv: string;
  apiKeyTag: string;
}): string {
  return decryptSecret(row.apiKeyCiphertext, row.apiKeyIv, row.apiKeyTag);
}

export async function testAiConnection(user: AuthedUser, input?: unknown) {
  const body = z
    .object({
      apiKey: z.string().min(8).max(500).optional(),
      model: z.string().min(1).max(200).optional(),
      provider: z.enum(["openrouter"]).optional(),
    })
    .safeParse(input ?? {});

  const saved = await prisma.userAiConfig.findUnique({ where: { userId: user.id } });
  const model = body.success && body.data.model ? body.data.model : saved?.model ?? "openrouter/free";
  const providerId = (body.success && body.data.provider ? body.data.provider : "openrouter") as AiProviderId;

  let apiKey: string | undefined;
  if (body.success && body.data.apiKey && !looksMasked(body.data.apiKey)) {
    apiKey = body.data.apiKey.trim();
  } else if (saved) {
    apiKey = decryptUserKey(saved);
  }

  if (!apiKey) {
    return {
      success: false as const,
      errorCode: "not_configured" as const,
      message: "Add an API key first",
      okLabel: "✗ AI is not configured",
    };
  }

  const provider = getAiProvider(providerId);
  const result = await provider.testConnection(apiKey, model);

  if (saved) {
    await prisma.userAiConfig.update({
      where: { userId: user.id },
      data: {
        lastTestedAt: new Date(),
        lastTestStatus: result.success ? "success" : result.errorCode,
      },
    });
  }

  if (result.success) {
    return {
      success: true as const,
      message: "Connection successful",
      okLabel: "✓ Connection successful",
      provider: result.provider,
      model: result.model,
    };
  }

  const labels: Record<string, string> = {
    invalid_key: "✗ Invalid API key",
    model_unavailable: "✗ Model unavailable",
    rate_limit: "✗ Rate limit reached",
    unreachable: "✗ Unable to connect to provider",
    timeout: "✗ Unable to connect to provider",
    provider_error: "✗ Unable to connect to provider",
  };

  return {
    success: false as const,
    errorCode: result.errorCode,
    message: result.message,
    okLabel: labels[result.errorCode] ?? "✗ Unable to connect to provider",
  };
}

/** Prefer BYOK provider; fall back to deterministic template summary. */
export async function generateWeeklyStatusForUser(
  user: AuthedUser,
  input: WeeklyStatusInput & { format: StatusFormat; preferAi?: boolean },
) {
  const template = await templateWeeklyStatus(input);
  const preferAi = input.preferAi !== false;

  const config = await prisma.userAiConfig.findUnique({ where: { userId: user.id } });
  if (!preferAi || !config || !config.enabled) {
    return {
      ...template,
      source: "template" as const,
      aiConfigured: Boolean(config?.enabled && config.apiKeyLast4),
      aiMessage: config ? (config.enabled ? null : "AI is disabled in Settings → AI.") : "AI is not configured.",
    };
  }

  let apiKey: string;
  try {
    apiKey = decryptUserKey(config);
  } catch {
    return {
      ...template,
      source: "template" as const,
      aiConfigured: true,
      aiMessage: "Could not read AI credentials. Re-save your API key in Settings → AI.",
    };
  }

  const provider = getAiProvider(config.provider === "OPENROUTER" ? "openrouter" : "openrouter");
  const prompt = buildWeeklySummaryPrompt({ ...input, format: input.format });
  const result = await provider.generate(apiKey, {
    model: config.model,
    system: prompt.system,
    user: prompt.user,
  });

  if (!result.success) {
    return {
      ...template,
      source: "template" as const,
      aiConfigured: true,
      aiError: result.errorCode,
      aiMessage: result.message,
    };
  }

  return {
    ...template,
    body: result.content,
    source: "ai" as const,
    provider: result.provider,
    model: result.model,
    aiConfigured: true,
    aiMessage: null,
  };
}

export async function generateReportWithAi(
  user: AuthedUser,
  ctx: ReportWorkContext,
  template: { subject: string; body: string },
  preferAi = true,
) {
  const config = await prisma.userAiConfig.findUnique({ where: { userId: user.id } });
  const base = {
    subject: template.subject,
    body: template.body,
    source: "template" as const,
    aiConfigured: Boolean(config?.enabled && config.apiKeyLast4),
    aiMessage: config ? (config.enabled ? null : "AI is disabled in Settings → AI.") : "AI is not configured.",
    provider: undefined as string | undefined,
    model: undefined as string | undefined,
  };
  if (!preferAi || !config || !config.enabled) return base;

  let apiKey: string;
  try {
    apiKey = decryptUserKey(config);
  } catch {
    return { ...base, aiConfigured: true, aiMessage: "Could not read AI credentials. Re-save your API key in Settings → AI." };
  }

  const provider = getAiProvider("openrouter");
  const prompt = buildReportPrompt(ctx);
  const result = await provider.generate(apiKey, {
    model: config.model,
    system: prompt.system,
    user: prompt.user,
  });
  if (!result.success) {
    return { ...base, aiConfigured: true, aiMessage: result.message, aiError: result.errorCode };
  }
  return {
    subject: template.subject,
    body: result.content,
    source: "ai" as const,
    aiConfigured: true,
    aiMessage: null,
    provider: result.provider,
    model: result.model,
  };
}
