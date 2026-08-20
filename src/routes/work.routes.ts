import { Router } from "express";
import * as workController from "../controllers/work.controller.js";

export const workRouter = Router();

workRouter.get("/tasks", workController.listTasks);
workRouter.post("/tasks", workController.createTask);
workRouter.get("/tasks/:id", workController.getTask);
workRouter.patch("/tasks/:id", workController.updateTask);
workRouter.delete("/tasks/:id", workController.deleteTask);

workRouter.get("/journals", workController.listJournals);
workRouter.post("/journals", workController.saveJournal);
workRouter.get("/journals/:id", workController.getJournal);
workRouter.patch("/journals/:id", workController.updateJournal);
workRouter.delete("/journals/:id", workController.deleteJournal);

workRouter.get("/daily-plans", workController.listDailyPlans);
workRouter.get("/learnings", workController.listLearnings);
workRouter.post("/learnings", workController.createLearning);
workRouter.get("/goals", workController.listGoals);
workRouter.post("/goals", workController.createGoal);
workRouter.patch("/goals/:id", workController.updateGoal);
workRouter.get("/events", workController.listEvents);
workRouter.get("/achievements", workController.listAchievements);
