import axios from "axios";
import { env } from "../../config/env.config.js";
import type { AiGenerateRequest, AiGenerateResult, AiProvider } from "./types.js";

const TIMEOUT_MS = 45_000;

function mapHttpError(status: number | undefined, providerMessage?: string): AiGenerateResult {
  if (status === 401 || status === 403) {
    return { success: false, errorCode: "invalid_key", message: "Invalid API key", provider: "openrouter" };
  }
  if (status === 404 || status === 400) {
    const lower = (providerMessage ?? "").toLowerCase();
    if (lower.includes("model") || lower.includes("not found") || status === 404) {
      return {
        success: false,
        errorCode: "model_unavailable",
        message: "Model unavailable",
        provider: "openrouter",
      };
    }
  }
  if (status === 429) {
    return { success: false, errorCode: "rate_limit", message: "Rate limit reached", provider: "openrouter" };
  }
  return {
    success: false,
    errorCode: "provider_error",
    message: "Unable to complete AI request",
    provider: "openrouter",
  };
}

/**
 * OpenRouter chat completions (OpenAI-compatible).
 * Never log Authorization headers or API keys.
 */
export const openRouterProvider: AiProvider = {
  id: "openrouter",

  async generate(apiKey, request) {
    try {
      const res = await axios.post(
        `${env.openRouterBaseUrl}/chat/completions`,
        {
          model: request.model,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user },
          ],
          temperature: request.temperature ?? 0.3,
          max_tokens: request.maxTokens ?? 1200,
        },
        {
          timeout: TIMEOUT_MS,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": env.appUrl,
            "X-OpenRouter-Title": "Tracework",
          },
          // Prevent axios from dumping secrets into error serialization paths we control
          transitional: { clarifyTimeoutError: true },
          validateStatus: () => true,
        },
      );

      if (res.status < 200 || res.status >= 300) {
        const msg =
          typeof res.data?.error?.message === "string"
            ? res.data.error.message
            : typeof res.data?.message === "string"
              ? res.data.message
              : undefined;
        return mapHttpError(res.status, msg);
      }

      const content = res.data?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        return {
          success: false,
          errorCode: "provider_error",
          message: "Empty response from provider",
          provider: "openrouter",
          model: request.model,
        };
      }

      const usedModel =
        typeof res.data?.model === "string" && res.data.model ? res.data.model : request.model;

      return {
        success: true,
        content: content.trim(),
        provider: "openrouter",
        model: usedModel,
      };
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.code === "ECONNABORTED") {
          return { success: false, errorCode: "timeout", message: "Provider request timed out", provider: "openrouter" };
        }
        if (!err.response) {
          return {
            success: false,
            errorCode: "unreachable",
            message: "Unable to connect to provider",
            provider: "openrouter",
          };
        }
        return mapHttpError(err.response.status);
      }
      return {
        success: false,
        errorCode: "unreachable",
        message: "Unable to connect to provider",
        provider: "openrouter",
      };
    }
  },

  async testConnection(apiKey, model) {
    return this.generate(apiKey, {
      model,
      system: "Reply with exactly: OK",
      user: "Connection test",
      maxTokens: 16,
      temperature: 0,
    });
  },
};
