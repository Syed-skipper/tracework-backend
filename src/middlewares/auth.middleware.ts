import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../exceptions/http.exception.js";
import type { AuthedRequest, AuthedUser } from "../interface/auth.interface.js";
import { prisma } from "../utils/prisma.js";
import { verifyToken } from "../utils/jwt.js";
import { ADMIN_ROLES, MANAGER_ROLES } from "../constants/defaultValues.js";
import type { Role } from "@prisma/client";

export const managerRoles = MANAGER_ROLES;
export const adminRoles = ADMIN_ROLES;

export function authed(req: Request): AuthedUser {
  return (req as AuthedRequest).user;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new HttpError(401, "Unauthorized");
    const payload = verifyToken(token);
    if (!payload.sub) throw new HttpError(401, "Unauthorized");
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { department: true, skills: { include: { skill: true } }, organization: true },
    });
    if (!user || !user.isActive) throw new HttpError(401, "Unauthorized");
    (req as AuthedRequest).user = user;
    next();
  } catch (err) {
    if (err instanceof HttpError) next(err);
    else next(new HttpError(401, "Unauthorized"));
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthedRequest).user;
    if (!user || !roles.includes(user.role)) {
      next(new HttpError(403, "Forbidden"));
      return;
    }
    next();
  };
}
