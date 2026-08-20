import { Router } from "express";
import * as orgController from "../controllers/org.controller.js";

export const orgRouter = Router();

orgRouter.get("/organizations", orgController.getOrganization);
orgRouter.get("/departments", orgController.listDepartments);
orgRouter.post("/departments", orgController.createDepartment);
orgRouter.get("/projects", orgController.listProjects);
orgRouter.get("/integrations", orgController.listIntegrations);
orgRouter.patch("/integrations/:id", orgController.toggleIntegration);
orgRouter.get("/leave-types", orgController.listLeaveTypes);
orgRouter.patch("/leave-types/:id", orgController.updateLeaveType);
orgRouter.post("/workspaces/create-organization", orgController.createOrganization);
