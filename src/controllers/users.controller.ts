import { sendCreated, sendSuccess } from "../config/response.config.js";
import { asyncHandler } from "../decorators/async-handler.decorator.js";
import { authed } from "../middlewares/auth.middleware.js";
import * as usersService from "../services/users.service.js";

export const getMe = asyncHandler(async (req, res) => {
  sendSuccess(res, usersService.getMe(authed(req)));
});

export const updateMe = asyncHandler(async (req, res) => {
  sendSuccess(res, await usersService.updateMe(authed(req), req.body));
});

export const listUsers = asyncHandler(async (req, res) => {
  sendSuccess(res, await usersService.listUsers(authed(req), req.query));
});

export const getUser = asyncHandler(async (req, res) => {
  sendSuccess(res, await usersService.getUser(authed(req), String(req.params.id)));
});

export const getHrOverview = asyncHandler(async (req, res) => {
  sendSuccess(res, await usersService.getHrOverview(authed(req), String(req.params.id)));
});

export const updateUser = asyncHandler(async (req, res) => {
  sendSuccess(res, await usersService.updateUser(authed(req), String(req.params.id), req.body));
});

export const createEmployee = asyncHandler(async (req, res) => {
  sendCreated(res, await usersService.createEmployee(authed(req), req.body));
});

export const listSkills = asyncHandler(async (req, res) => {
  sendSuccess(res, await usersService.listSkills(authed(req)));
});

export const addSkill = asyncHandler(async (req, res) => {
  sendCreated(res, await usersService.addSkill(authed(req), req.body));
});
