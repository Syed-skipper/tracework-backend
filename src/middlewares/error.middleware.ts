import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../exceptions/http.exception.js";
import { sendError } from "../config/response.config.js";

function isJsonParseError(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const e = err as { type?: string; status?: number; statusCode?: number };
  return e.type === "entity.parse.failed" || (err instanceof SyntaxError && (e.status === 400 || e.statusCode === 400));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    sendError(res, err.message, err.status);
    return;
  }
  if (isJsonParseError(err)) {
    sendError(res, "Invalid JSON body", 400);
    return;
  }
  console.error(err);
  sendError(res, "Internal server error", 500);
}
