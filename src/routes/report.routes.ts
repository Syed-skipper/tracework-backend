import { Router } from "express";
import * as reportController from "../controllers/report.controller.js";

export const reportRouter = Router();

reportRouter.get("/reviews/options", reportController.options);
reportRouter.get("/reviews", reportController.list);
reportRouter.post("/reviews/generate", reportController.generate);
reportRouter.get("/reviews/:id", reportController.getOne);
reportRouter.patch("/reviews/:id", reportController.update);
reportRouter.post("/reviews/:id/regenerate", reportController.regenerate);
reportRouter.post("/reviews/:id/email", reportController.email);

reportRouter.get("/review-periods", reportController.listPeriods);
reportRouter.post("/review-periods", reportController.createPeriod);
reportRouter.patch("/review-periods/:id", reportController.updatePeriod);
reportRouter.post("/review-periods/:id/duplicate", reportController.duplicatePeriod);
