import { sendCreated, sendSuccess } from "../config/response.config.js";
import { asyncHandler } from "../decorators/async-handler.decorator.js";
import { authed } from "../middlewares/auth.middleware.js";
import * as workService from "../services/work.service.js";

export const listTasks = asyncHandler(async (req, res) => {
  sendSuccess(res, await workService.listTasks(authed(req), req.query));
});
export const createTask = asyncHandler(async (req, res) => {
  sendCreated(res, await workService.createTask(authed(req), req.body));
});
export const getTask = asyncHandler(async (req, res) => {
  sendSuccess(res, await workService.getTask(authed(req), String(req.params.id)));
});
export const updateTask = asyncHandler(async (req, res) => {
  sendSuccess(res, await workService.updateTask(authed(req), String(req.params.id), req.body));
});
export const deleteTask = asyncHandler(async (req, res) => {
  sendSuccess(res, await workService.deleteTask(authed(req), String(req.params.id)));
});

export const listJournals = asyncHandler(async (req, res) => {
  sendSuccess(res, await workService.listJournals(authed(req), req.query));
});
export const getJournal = asyncHandler(async (req, res) => {
  sendSuccess(res, await workService.getJournal(authed(req), String(req.params.id)));
});
export const saveJournal = asyncHandler(async (req, res) => {
  sendCreated(res, await workService.saveJournal(authed(req), req.body));
});
export const updateJournal = asyncHandler(async (req, res) => {
  sendSuccess(res, await workService.updateJournal(authed(req), String(req.params.id), req.body));
});
export const deleteJournal = asyncHandler(async (req, res) => {
  sendSuccess(res, await workService.deleteJournal(authed(req), String(req.params.id)));
});

export const listDailyPlans = asyncHandler(async (req, res) => {
  sendSuccess(res, await workService.listDailyPlans(authed(req)));
});

export const listLearnings = asyncHandler(async (req, res) => {
  sendSuccess(res, await workService.listLearnings(authed(req), req.query));
});
export const createLearning = asyncHandler(async (req, res) => {
  sendCreated(res, await workService.createLearning(authed(req), req.body));
});

export const listGoals = asyncHandler(async (req, res) => {
  sendSuccess(res, await workService.listGoals(authed(req), req.query));
});
export const createGoal = asyncHandler(async (req, res) => {
  sendCreated(res, await workService.createGoal(authed(req), req.body));
});
export const updateGoal = asyncHandler(async (req, res) => {
  sendSuccess(res, await workService.updateGoal(authed(req), String(req.params.id), req.body));
});

export const listEvents = asyncHandler(async (req, res) => {
  sendSuccess(res, await workService.listEvents(authed(req)));
});
export const listAchievements = asyncHandler(async (req, res) => {
  sendSuccess(res, await workService.listAchievements(authed(req), req.query));
});
