import { HttpError } from "../exceptions/http.exception.js";

export function isoDate(value: Date | null | undefined) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function parseDate(value: string) {
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, "Invalid date");
  return d;
}

export function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/** Monday 00:00 UTC of the week containing `date`. */
export function startOfWeek(date: Date) {
  const d = startOfDay(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

export function startOfMonth(date: Date) {
  const d = startOfDay(date);
  d.setUTCDate(1);
  return d;
}

export function endOfMonth(date: Date) {
  return addDays(startOfMonth(addMonths(date, 1)), -1);
}
