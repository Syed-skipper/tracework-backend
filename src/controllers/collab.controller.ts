import { sendCreated, sendSuccess } from "../config/response.config.js";
import { asyncHandler } from "../decorators/async-handler.decorator.js";
import { authed } from "../middlewares/auth.middleware.js";
import * as collabService from "../services/collab.service.js";

export const listBlockers = asyncHandler(async (req, res) => {
  sendSuccess(res, await collabService.listBlockers(authed(req)));
});
export const createBlocker = asyncHandler(async (req, res) => {
  sendCreated(res, await collabService.createBlocker(authed(req), req.body));
});
export const updateBlocker = asyncHandler(async (req, res) => {
  sendSuccess(res, await collabService.updateBlocker(authed(req), String(req.params.id), req.body));
});
export const commentBlocker = asyncHandler(async (req, res) => {
  sendCreated(res, await collabService.commentBlocker(authed(req), String(req.params.id), req.body?.body));
});

export const listLeaves = asyncHandler(async (req, res) => {
  sendSuccess(res, await collabService.listLeaves(authed(req)));
});
export const leaveBalance = asyncHandler(async (req, res) => {
  sendSuccess(res, await collabService.leaveBalance(authed(req)));
});
export const createLeave = asyncHandler(async (req, res) => {
  sendCreated(res, await collabService.createLeave(authed(req), req.body));
});
export const decideLeave = asyncHandler(async (req, res) => {
  sendSuccess(res, await collabService.decideLeave(authed(req), String(req.params.id), req.body?.status));
});

export const listNotifications = asyncHandler(async (req, res) => {
  sendSuccess(res, await collabService.listNotifications(authed(req)));
});
export const markNotification = asyncHandler(async (req, res) => {
  sendSuccess(res, await collabService.markNotification(authed(req), String(req.params.id), req.body?.read));
});
export const markAllNotifications = asyncHandler(async (req, res) => {
  sendSuccess(res, await collabService.markAllNotifications(authed(req)));
});

export const listRecognitions = asyncHandler(async (req, res) => {
  sendSuccess(res, await collabService.listRecognitions(authed(req)));
});
export const createRecognition = asyncHandler(async (req, res) => {
  sendCreated(res, await collabService.createRecognition(authed(req), req.body));
});

export const listIdeas = asyncHandler(async (req, res) => {
  sendSuccess(res, await collabService.listIdeas(authed(req)));
});
export const createIdea = asyncHandler(async (req, res) => {
  sendCreated(res, await collabService.createIdea(authed(req), req.body));
});
export const voteIdea = asyncHandler(async (req, res) => {
  sendSuccess(res, await collabService.voteIdea(authed(req), String(req.params.id)));
});
export const updateIdea = asyncHandler(async (req, res) => {
  sendSuccess(res, await collabService.updateIdea(authed(req), String(req.params.id), req.body));
});
