import { Router } from "express";
import * as insightsController from "../controllers/insights.controller.js";

export const insightsRouter = Router();

insightsRouter.get("/teams", insightsController.listTeams);
insightsRouter.get("/standup", insightsController.standup);
insightsRouter.get("/reports", insightsController.reports);
insightsRouter.get("/progress", insightsController.progress);
insightsRouter.get("/knowledge", insightsController.knowledge);
insightsRouter.get("/search", insightsController.search);
insightsRouter.get("/developer", insightsController.developer);
