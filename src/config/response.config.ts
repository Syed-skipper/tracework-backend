import type { Response } from "express";

export function sendSuccess<T>(res: Response, data: T, status = 200) {
  return res.status(status).json(data);
}

export function sendCreated<T>(res: Response, data: T) {
  return res.status(201).json(data);
}

export function sendMessage(res: Response, message: string, status = 200) {
  return res.status(status).json({ ok: true, message });
}

export function sendError(res: Response, error: string, status = 400) {
  return res.status(status).json({ error });
}
