import { sendCreated, sendSuccess } from "../config/response.config.js";
import { asyncHandler } from "../decorators/async-handler.decorator.js";
import { authed } from "../middlewares/auth.middleware.js";
import * as reportService from "../services/report.service.js";

export const options = asyncHandler(async (req, res) => {
  sendSuccess(res, await reportService.options(authed(req)));
});

export const generate = asyncHandler(async (req, res) => {
  sendCreated(res, await reportService.generate(authed(req), req.body ?? {}));
});

export const list = asyncHandler(async (req, res) => {
  sendSuccess(res, await reportService.listReports(authed(req)));
});

export const getOne = asyncHandler(async (req, res) => {
  sendSuccess(res, await reportService.getReport(authed(req), String(req.params.id)));
});

export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, await reportService.updateReport(authed(req), String(req.params.id), req.body ?? {}));
});

export const regenerate = asyncHandler(async (req, res) => {
  sendSuccess(res, await reportService.regenerate(authed(req), String(req.params.id), req.body ?? {}));
});

export const email = asyncHandler(async (req, res) => {
  sendSuccess(res, await reportService.emailReport(authed(req), String(req.params.id), req.body ?? {}));
});

export const listPeriods = asyncHandler(async (req, res) => {
  sendSuccess(res, await reportService.listPeriods(authed(req)));
});

export const createPeriod = asyncHandler(async (req, res) => {
  sendCreated(res, await reportService.createPeriod(authed(req), req.body ?? {}));
});

export const updatePeriod = asyncHandler(async (req, res) => {
  sendSuccess(res, await reportService.updatePeriod(authed(req), String(req.params.id), req.body ?? {}));
});

export const duplicatePeriod = asyncHandler(async (req, res) => {
  sendCreated(res, await reportService.duplicatePeriod(authed(req), String(req.params.id)));
});
