import { Router } from "express";
import * as teamUpdatesController from "../controllers/team-updates.controller.js";

export const teamUpdatesRouter = Router();

teamUpdatesRouter.get("/me/update-status", teamUpdatesController.myUpdateStatus);
teamUpdatesRouter.get("/notification-preferences", teamUpdatesController.getNotificationPrefs);
teamUpdatesRouter.put("/notification-preferences", teamUpdatesController.updateNotificationPrefs);

teamUpdatesRouter.get("/team-updates", teamUpdatesController.listTeamUpdates);
teamUpdatesRouter.get("/team-updates/employees/:employeeId", teamUpdatesController.getEmployeeUpdate);
teamUpdatesRouter.get("/team-updates/accountability", teamUpdatesController.taskAccountability);
teamUpdatesRouter.get("/team-updates/activity", teamUpdatesController.activityFeed);
teamUpdatesRouter.post("/team-updates/request", teamUpdatesController.requestUpdate);
teamUpdatesRouter.post("/team-updates/reminders/run", teamUpdatesController.runReminders);
teamUpdatesRouter.get("/team-updates/weekly", teamUpdatesController.weeklyDashboard);
teamUpdatesRouter.post("/team-updates/weekly-summary", teamUpdatesController.generateTeamSummary);

teamUpdatesRouter.get("/organization/work-updates", teamUpdatesController.getPolicy);
teamUpdatesRouter.put("/organization/work-updates", teamUpdatesController.updatePolicy);
