import { sendCreated, sendSuccess } from "../config/response.config.js";
import { asyncHandler } from "../decorators/async-handler.decorator.js";
import { authed } from "../middlewares/auth.middleware.js";
import * as notificationService from "../services/notification.service.js";
import * as teamUpdatesService from "../services/team-updates.service.js";

export const myUpdateStatus = asyncHandler(async (req, res) => {
  sendSuccess(res, await teamUpdatesService.myUpdateStatus(authed(req), String(req.query.date ?? "")));
});

export const listTeamUpdates = asyncHandler(async (req, res) => {
  sendSuccess(res, await teamUpdatesService.listTeamUpdates(authed(req), req.query as Record<string, unknown>));
});

export const getEmployeeUpdate = asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    await teamUpdatesService.getEmployeeUpdate(authed(req), String(req.params.employeeId), String(req.query.date ?? "")),
  );
});

export const taskAccountability = asyncHandler(async (req, res) => {
  sendSuccess(res, await teamUpdatesService.taskAccountability(authed(req)));
});

export const activityFeed = asyncHandler(async (req, res) => {
  sendSuccess(res, await teamUpdatesService.activityFeed(authed(req)));
});

export const requestUpdate = asyncHandler(async (req, res) => {
  sendCreated(res, await teamUpdatesService.requestUpdate(authed(req), req.body));
});

export const runReminders = asyncHandler(async (req, res) => {
  sendSuccess(res, await teamUpdatesService.runMissingReminders(authed(req)));
});

export const weeklyDashboard = asyncHandler(async (req, res) => {
  sendSuccess(res, await teamUpdatesService.weeklyDashboard(authed(req)));
});

export const generateTeamSummary = asyncHandler(async (req, res) => {
  sendSuccess(res, await teamUpdatesService.generateTeamSummary(authed(req)));
});

export const getPolicy = asyncHandler(async (req, res) => {
  sendSuccess(res, await teamUpdatesService.getPolicy(authed(req)));
});

export const updatePolicy = asyncHandler(async (req, res) => {
  sendSuccess(res, await teamUpdatesService.updatePolicy(authed(req), req.body));
});

export const getNotificationPrefs = asyncHandler(async (req, res) => {
  const prefs = await notificationService.getOrCreatePrefs(authed(req).id);
  sendSuccess(res, notificationService.serializePrefs(prefs));
});

export const updateNotificationPrefs = asyncHandler(async (req, res) => {
  sendSuccess(res, await notificationService.updatePrefs(authed(req), req.body));
});
