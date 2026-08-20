import { sendCreated, sendSuccess } from "../config/response.config.js";
import { asyncHandler } from "../decorators/async-handler.decorator.js";
import { authed } from "../middlewares/auth.middleware.js";
import * as orgService from "../services/org.service.js";
import * as workspaceService from "../services/workspace.service.js";

export const getOrganization = asyncHandler(async (req, res) => {
  sendSuccess(res, await orgService.getOrganization(authed(req)));
});

export const listDepartments = asyncHandler(async (req, res) => {
  sendSuccess(res, await orgService.listDepartments(authed(req)));
});

export const createDepartment = asyncHandler(async (req, res) => {
  sendCreated(res, await orgService.createDepartment(authed(req), req.body?.name));
});

export const listProjects = asyncHandler(async (req, res) => {
  sendSuccess(res, await orgService.listProjects(authed(req)));
});

export const listIntegrations = asyncHandler(async (req, res) => {
  sendSuccess(res, await orgService.listIntegrations(authed(req)));
});

export const toggleIntegration = asyncHandler(async (req, res) => {
  sendSuccess(res, await orgService.toggleIntegration(authed(req), String(req.params.id), req.body?.connected));
});

export const listLeaveTypes = asyncHandler(async (req, res) => {
  sendSuccess(res, await orgService.listLeaveTypes(authed(req)));
});

export const updateLeaveType = asyncHandler(async (req, res) => {
  sendSuccess(res, await orgService.updateLeaveType(authed(req), String(req.params.id), req.body));
});

export const createOrganization = asyncHandler(async (req, res) => {
  sendCreated(res, await workspaceService.createOrganizationFromPersonal(authed(req), req.body));
});
