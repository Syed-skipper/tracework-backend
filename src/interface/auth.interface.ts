import type { Request } from "express";
import type { Organization, User as DbUser } from "@prisma/client";

export type AuthedUser = DbUser & {
  department: { name: string } | null;
  skills: { level: number; trend: string; skill: { name: string } }[];
  organization: Pick<Organization, "id" | "name" | "plan" | "kind">;
};

export type AuthedRequest = Request & { user: AuthedUser };