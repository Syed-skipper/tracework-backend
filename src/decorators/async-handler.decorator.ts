import type { NextFunction, Request, Response } from "express";

type AsyncRoute<T extends Request = Request> = (req: T, res: Response, next: NextFunction) => Promise<unknown>;

/** Wraps an async controller so rejected promises reach the error middleware. */
export function asyncHandler<T extends Request>(fn: AsyncRoute<T>) {
  return (req: T, res: Response, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}
