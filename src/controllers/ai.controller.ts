import { sendSuccess } from "../config/response.config.js";
import { asyncHandler } from "../decorators/async-handler.decorator.js";
import { authed } from "../middlewares/auth.middleware.js";
import * as reportService from "../services/report.service.js";
import * as aiConfigService from "../services/ai-config.service.js";
import * as aiService from "../services/ai.service.js";

export const summarize = asyncHandler(async (req, res) => {
  sendSuccess(res, await aiService.summarizeNotes(String(req.body?.notes ?? "")));
});

export const chat = asyncHandler(async (req, res) => {
  sendSuccess(res, { reply: await aiService.chat(String(req.body?.prompt ?? "")) });
});

export const review = asyncHandler(async (req, res) => {
  const user = authed(req);
  sendSuccess(res, { review: await aiService.generateReview(String(req.body?.period ?? "This period"), user.name) });
});

/** Capture → Understand → Summarize → Share. Delegates to the shared Reports & Reviews engine. */
export const weeklyStatus = asyncHandler(async (req, res) => {
  const user = authed(req);
  const format = String(req.body?.format ?? "manager");
  const mapped = format === "bullets" || format === "detailed" || format === "email" ? format : "professional";
  const result = await reportService.generate(user, {
    reportType: "weekly",
    period: "this_week",
    subjectType: "self",
    format: mapped,
    managerName: typeof req.body?.managerName === "string" ? req.body.managerName : undefined,
    preferAi: req.body?.preferAi !== false,
  });
  sendSuccess(res, {
    format: req.body?.format ?? "manager",
    subject: result.subject,
    body: result.body,
    sections: { completed: [], inProgress: [], learned: [], blockers: [], nextWeek: [] },
    source: result.source,
    provider: result.provider,
    model: result.model,
    aiConfigured: result.aiConfigured,
    aiMessage: result.aiMessage,
  });
});

export const getAiConfig = asyncHandler(async (req, res) => {
  sendSuccess(res, await aiConfigService.getAiConfig(authed(req)));
});

export const saveAiConfig = asyncHandler(async (req, res) => {
  sendSuccess(res, await aiConfigService.saveAiConfig(authed(req), req.body));
});

export const deleteAiConfig = asyncHandler(async (req, res) => {
  sendSuccess(res, await aiConfigService.deleteAiConfig(authed(req)));
});

export const testAiConnection = asyncHandler(async (req, res) => {
  sendSuccess(res, await aiConfigService.testAiConnection(authed(req), req.body));
});

export const listAiModels = asyncHandler(async (_req, res) => {
  sendSuccess(res, aiConfigService.listSuggestedModels());
});
