import { sendSuccess } from "../config/response.config.js";
import { asyncHandler } from "../decorators/async-handler.decorator.js";
import { authed } from "../middlewares/auth.middleware.js";
import * as insightsService from "../services/insights.service.js";

export const listTeams = asyncHandler(async (req, res) => {
  sendSuccess(res, await insightsService.listTeams(authed(req)));
});
export const standup = asyncHandler(async (req, res) => {
  sendSuccess(res, await insightsService.standup(authed(req)));
});
export const reports = asyncHandler(async (req, res) => {
  sendSuccess(res, await insightsService.reports(authed(req)));
});
export const progress = asyncHandler(async (req, res) => {
  sendSuccess(res, await insightsService.progress(authed(req)));
});
export const knowledge = asyncHandler(async (req, res) => {
  sendSuccess(res, await insightsService.knowledge(authed(req), req.query));
});
export const search = asyncHandler(async (req, res) => {
  sendSuccess(res, await insightsService.search(authed(req), req.query));
});
export const developer = asyncHandler(async (req, res) => {
  sendSuccess(res, await insightsService.developer(authed(req)));
});
