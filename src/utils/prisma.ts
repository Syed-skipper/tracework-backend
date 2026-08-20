import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.config.js";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isDev ? ["error", "warn"] : ["error"],
  });

if (!env.isProd) globalForPrisma.prisma = prisma;
