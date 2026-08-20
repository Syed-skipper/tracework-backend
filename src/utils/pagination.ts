import type { Request } from "express";
import { PAGE_DEFAULT, PAGE_LIMIT_DEFAULT, PAGE_LIMIT_MAX } from "../constants/defaultValues.js";

export function parsePage(query: Request["query"]) {
  const page = Math.max(1, Number(query.page ?? PAGE_DEFAULT) || PAGE_DEFAULT);
  const limit = Math.min(PAGE_LIMIT_MAX, Math.max(1, Number(query.limit ?? PAGE_LIMIT_DEFAULT) || PAGE_LIMIT_DEFAULT));
  return { page, limit };
}

export function paginated<T>(items: T[], page: number, limit: number) {
  const start = (page - 1) * limit;
  return {
    data: items.slice(start, start + limit),
    meta: { page, limit, total: items.length, pages: Math.ceil(items.length / Math.max(limit, 1)) },
  };
}
