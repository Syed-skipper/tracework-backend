import cors from "cors";
import express from "express";
import { env } from "./config/env.config.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { jsonBody } from "./middlewares/json.middleware.js";
import { registerRoutes } from "./routes/index.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.isDev) {
          callback(null, true);
          return;
        }
        callback(null, env.frontendOrigins.includes(origin));
      },
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.use(jsonBody);

  registerRoutes(app);
  app.use(errorHandler);

  return app;
}
