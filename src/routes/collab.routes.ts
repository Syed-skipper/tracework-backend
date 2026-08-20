import { Router } from "express";
import * as collabController from "../controllers/collab.controller.js";

export const collabRouter = Router();

collabRouter.get("/blockers", collabController.listBlockers);
collabRouter.post("/blockers", collabController.createBlocker);
collabRouter.patch("/blockers/:id", collabController.updateBlocker);
collabRouter.post("/blockers/:id/comments", collabController.commentBlocker);

collabRouter.get("/leaves", collabController.listLeaves);
collabRouter.get("/leave-balance", collabController.leaveBalance);
collabRouter.post("/leaves", collabController.createLeave);
collabRouter.patch("/leaves/:id", collabController.decideLeave);

collabRouter.get("/notifications", collabController.listNotifications);
collabRouter.patch("/notifications/:id", collabController.markNotification);
collabRouter.post("/notifications/read-all", collabController.markAllNotifications);

collabRouter.get("/recognitions", collabController.listRecognitions);
collabRouter.post("/recognitions", collabController.createRecognition);

collabRouter.get("/ideas", collabController.listIdeas);
collabRouter.post("/ideas", collabController.createIdea);
collabRouter.post("/ideas/:id/vote", collabController.voteIdea);
collabRouter.patch("/ideas/:id", collabController.updateIdea);
