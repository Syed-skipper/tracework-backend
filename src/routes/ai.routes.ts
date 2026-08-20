import { Router } from "express";
import * as aiController from "../controllers/ai.controller.js";

export const aiRouter = Router();

aiRouter.post("/summarize", aiController.summarize);
aiRouter.post("/chat", aiController.chat);
aiRouter.post("/review", aiController.review);
aiRouter.post("/weekly-status", aiController.weeklyStatus);

aiRouter.get("/config", aiController.getAiConfig);
aiRouter.put("/config", aiController.saveAiConfig);
aiRouter.delete("/config", aiController.deleteAiConfig);
aiRouter.post("/config/test", aiController.testAiConnection);
aiRouter.get("/models", aiController.listAiModels);
