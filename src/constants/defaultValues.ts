import type { Role } from "@prisma/client";

export const DEFAULT_PORT = 4000;
export const JWT_EXPIRES_IN = "7d";
export const BCRYPT_ROUNDS = 10;
export const JSON_BODY_LIMIT = "1mb";
export const PAGE_DEFAULT = 1;
export const PAGE_LIMIT_DEFAULT = 50;
export const PAGE_LIMIT_MAX = 100;
export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
export const DEFAULT_TASK_ESTIMATE_MINS = 60;
export const DEFAULT_LEARNING_MINUTES = 30;
export const DEFAULT_GOAL_TARGET_DATE = "2026-12-31";

export const DEFAULT_DEPARTMENTS = ["Engineering", "Product", "Design", "QA", "HR", "Marketing"] as const;

export const DEFAULT_LEAVE_TYPES = [
  { name: "Casual Leave", daysPerYear: 12, accrual: "Annual grant", carry: "3 days" },
  { name: "Sick Leave", daysPerYear: 8, accrual: "Annual grant", carry: "None" },
  { name: "Earned Leave", daysPerYear: 18, accrual: "1.5 / month", carry: "Unlimited" },
] as const;

export const DEFAULT_ROLE: Role = "EMPLOYEE";
export const MANAGER_ROLES: Role[] = ["MANAGER", "HR_ADMIN", "ORG_ADMIN"];
export const ADMIN_ROLES: Role[] = ["HR_ADMIN", "ORG_ADMIN"];
