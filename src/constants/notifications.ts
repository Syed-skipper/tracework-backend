export const NOTIFICATION_KINDS = {
  WORK_UPDATE_REMINDER: "work_update_reminder",
  TASK_ASSIGNED: "task_assigned",
  TASK_DUE_SOON: "task_due_soon",
  TASK_OVERDUE: "task_overdue",
  MANAGER_REQUEST: "manager_request",
  WEEKLY_SUMMARY: "weekly_summary",
  TASK_COMMENT: "task_comment",
  TASK_STATUS: "task_status",
  ORG_ANNOUNCEMENT: "org_announcement",
  LEAVE: "leave",
  RECOGNITION: "recognition",
  BLOCKER: "blocker",
  GOAL: "goal",
  TEAM: "team",
  REMINDER: "reminder",
  MANAGER_BLOCKED: "manager_blocked",
  MANAGER_COMPLETED: "manager_completed",
  MANAGER_MISSING: "manager_missing",
} as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[keyof typeof NOTIFICATION_KINDS];

export type PreferenceKey =
  | "dailyUpdateReminders"
  | "taskAssignments"
  | "taskDueReminders"
  | "managerRequests"
  | "weeklySummary";

export const KIND_PREFERENCE: Partial<Record<NotificationKind, PreferenceKey>> = {
  work_update_reminder: "dailyUpdateReminders",
  task_assigned: "taskAssignments",
  task_due_soon: "taskDueReminders",
  task_overdue: "taskDueReminders",
  manager_request: "managerRequests",
  weekly_summary: "weeklySummary",
};

export const DEFAULT_NOTIFICATION_PREFS = {
  dailyUpdateReminders: true,
  taskAssignments: true,
  taskDueReminders: true,
  managerRequests: true,
  weeklySummary: true,
  channelInApp: true,
  channelEmail: true,
};

export const DEFAULT_WORK_UPDATE_POLICY = {
  enabled: true,
  requireDaily: false,
  reminderTime: "17:00",
  workingDays: [1, 2, 3, 4, 5],
  notifyInApp: true,
  notifyEmail: true,
  reminderFrequency: "once_daily",
};
