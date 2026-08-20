import { sendCreated, sendSuccess } from "../config/response.config.js";
import { asyncHandler } from "../decorators/async-handler.decorator.js";
import * as authService from "../services/auth.service.js";

export const login = asyncHandler(async (req, res) => {
  sendSuccess(res, await authService.login(req.body));
});

export const register = asyncHandler(async (req, res) => {
  sendCreated(res, await authService.register(req.body));
});

export const registerPersonal = asyncHandler(async (req, res) => {
  sendCreated(res, await authService.registerPersonal(req.body));
});

export const forgotPassword = asyncHandler(async (req, res) => {
  sendSuccess(res, await authService.forgotPassword(req.body?.email));
});

export const resetPassword = asyncHandler(async (req, res) => {
  sendSuccess(res, await authService.resetPassword(req.body));
});
