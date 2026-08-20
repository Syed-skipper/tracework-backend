export const REPORT_TYPES = ["daily", "weekly", "monthly", "performance", "custom"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_FORMATS = ["professional", "bullets", "detailed", "email"] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

export const SUBJECT_TYPES = ["self", "employee", "team"] as const;
export type ReportSubjectType = (typeof SUBJECT_TYPES)[number];

export const PERIOD_PRESETS = [
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "last_3_months",
  "last_6_months",
  "last_12_months",
  "custom",
] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const PERIODS_BY_TYPE: Record<string, PeriodPreset[]> = {
  daily: ["today", "yesterday", "custom"],
  weekly: ["this_week", "last_week", "custom"],
  monthly: ["this_month", "last_month", "last_3_months", "custom"],
  performance: ["last_3_months", "last_6_months", "last_12_months", "custom"],
  custom: ["this_week", "this_month", "last_3_months", "last_6_months", "last_12_months", "custom"],
};

export const REPORT_TYPE_LABELS: Record<string, string> = {
  daily: "Daily Update",
  weekly: "Weekly Summary",
  monthly: "Monthly Review",
  performance: "Performance Review",
  custom: "Custom Report",
};

export function mapLegacyFormat(format: string | undefined): ReportFormat {
  if (format === "bullets") return "bullets";
  if (format === "detailed") return "detailed";
  if (format === "email") return "email";
  return "professional";
}

export function isReportType(value: string): value is ReportType {
  return (REPORT_TYPES as readonly string[]).includes(value);
}

export function isReportFormat(value: string): value is ReportFormat {
  return (REPORT_FORMATS as readonly string[]).includes(value);
}
