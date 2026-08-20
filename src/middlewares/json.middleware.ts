import type { NextFunction, Request, Response } from "express";
import express from "express";
import { JSON_BODY_LIMIT } from "../constants/defaultValues.js";
import { sendError } from "../config/response.config.js";

export function jsonBody(req: Request, res: Response, next: NextFunction) {
  express.json({ limit: JSON_BODY_LIMIT })(req, res, (err) => {
    if (!err) {
      next();
      return;
    }
    sendError(res, "Invalid JSON body", 400);
  });
}
