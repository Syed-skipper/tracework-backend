import jwt from "jsonwebtoken";
import { env } from "../config/env.config.js";
import { JWT_EXPIRES_IN } from "../constants/defaultValues.js";

export function signToken(userId: string) {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string) {
  return jwt.verify(token, env.jwtSecret) as { sub?: string };
}
