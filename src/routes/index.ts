import type { Express } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { sendSuccess } from "../config/response.config.js";
import { SERVICE_NAME } from "../constants/index.js";
import { authRouter } from "./auth.routes.js";
import { usersRouter } from "./users.routes.js";
import { orgRouter } from "./org.routes.js";
import { workRouter } from "./work.routes.js";
import { collabRouter } from "./collab.routes.js";
import { insightsRouter } from "./insights.routes.js";
import { teamUpdatesRouter } from "./team-updates.routes.js";
import { reportRouter } from "./report.routes.js";
import { aiRouter } from "./ai.routes.js";

export function registerRoutes(app: Express) {
  app.get("/api/health", (_req, res) => {
    sendSuccess(res, { ok: true, service: SERVICE_NAME });
  });

  app.use("/api/auth", authRouter);
  app.use("/api", requireAuth, usersRouter);
  app.use("/api", requireAuth, orgRouter);
  app.use("/api", requireAuth, workRouter);
  app.use("/api", requireAuth, collabRouter);
  app.use("/api", requireAuth, insightsRouter);
  app.use("/api", requireAuth, teamUpdatesRouter);
  app.use("/api", requireAuth, reportRouter);
  app.use("/api/ai", requireAuth, aiRouter);
}
