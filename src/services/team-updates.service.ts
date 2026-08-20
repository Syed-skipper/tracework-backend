import { env } from "../config/env.config.js";
import { ADMIN_ROLES, MANAGER_ROLES } from "../constants/defaultValues.js";
import { DEFAULT_WORK_UPDATE_POLICY, NOTIFICATION_KINDS } from "../constants/notifications.js";
import { HttpError } from "../exceptions/http.exception.js";
import type { AuthedUser } from "../interface/auth.interface.js";
import { addDays, isoDate, parseDate, startOfDay } from "../utils/dates.js";
import { prisma } from "../utils/prisma.js";
import {
  dailyReminderEmail,
  managerRequestEmail,
  taskDueEmail,
  weeklySummaryEmail,
} from "./email.service.js";
import { notify } from "./notification.service.js";
import { generateWeeklyStatus } from "./ai.service.js";
import { generateWeeklyStatusForUser } from "./ai-config.service.js";

export type UpdateStatus = "updated" | "not_updated" | "needs_attention";

function requireEnterprise(user: AuthedUser) {
  if (user.organization.kind === "PERSONAL") {
    throw new HttpError(403, "Team work updates are available on company workspaces");
  }
}

function canManageTeam(user: AuthedUser) {
  return MANAGER_ROLES.includes(user.role);
}

function isWorkingDay(date: Date, workingDays: number[]) {
  return workingDays.includes(date.getUTCDay());
}

function addWorkingDaysBack(from: Date, days: number, workingDays: number[]) {
  let cursor = addDays(from, -1);
  let left = days;
  let guard = 0;
  while (left > 0 && guard < 21) {
    if (isWorkingDay(cursor, workingDays)) left -= 1;
    if (left > 0) cursor = addDays(cursor, -1);
    guard += 1;
  }
  return cursor;
}

export async function getOrCreatePolicy(organizationId: string, kind: string) {
  const defaults =
    kind === "PERSONAL"
      ? { ...DEFAULT_WORK_UPDATE_POLICY, enabled: false }
      : DEFAULT_WORK_UPDATE_POLICY;
  return prisma.organizationWorkUpdatePolicy.upsert({
    where: { organizationId },
    create: { organizationId, ...defaults },
    update: {},
  });
}

export function serializePolicy(p: Awaited<ReturnType<typeof getOrCreatePolicy>>) {
  return {
    enabled: p.enabled,
    requireDaily: p.requireDaily,
    reminderTime: p.reminderTime,
    workingDays: p.workingDays,
    notifyInApp: p.notifyInApp,
    notifyEmail: p.notifyEmail,
    reminderFrequency: p.reminderFrequency,
  };
}

async function visibleMembers(user: AuthedUser) {
  requireEnterprise(user);
  const where = {
    organizationId: user.organizationId,
    isActive: true,
    ...(ADMIN_ROLES.includes(user.role) ? {} : { OR: [{ managerId: user.id }, { id: user.id }] }),
  };
  return prisma.user.findMany({
    where,
    include: { department: true, teams: { include: { team: true } } },
    orderBy: { name: "asc" },
  });
}

function hasMeaningfulUpdate(journal: { completed: string[]; focus: string | null; blocked: string[] } | null) {
  if (!journal) return false;
  return journal.completed.length > 0 || Boolean(journal.focus?.trim()) || journal.blocked.length > 0;
}

export async function myUpdateStatus(user: AuthedUser, dateRaw?: string) {
  const date = dateRaw ? parseDate(dateRaw) : startOfDay();
  if (user.organization.kind === "PERSONAL") {
    return {
      date: isoDate(date),
      updated: true,
      status: "updated" as const,
      requireDaily: false,
      message: "",
    };
  }
  const policy = await getOrCreatePolicy(user.organizationId, user.organization.kind);
  const journal = await prisma.dailyJournal.findUnique({
    where: { userId_date: { userId: user.id, date } },
  });
  const updated = hasMeaningfulUpdate(journal);
  return {
    date: isoDate(date),
    updated,
    status: updated ? "updated" : "not_updated",
    requireDaily: policy.requireDaily && policy.enabled,
    message: updated
      ? "Today's work update is in."
      : "You haven't added today's work update yet.",
  };
}

async function classifyMember(
  member: { id: string; managerId: string | null },
  date: Date,
  workingDays: number[],
) {
  const weekAgo = addDays(date, -7);
  const attentionSince = addWorkingDaysBack(date, 2, workingDays);

  const [journal, recentJournals, overdue, blocked, pendingRequest, tasks] = await Promise.all([
    prisma.dailyJournal.findUnique({ where: { userId_date: { userId: member.id, date } } }),
    prisma.dailyJournal.findMany({
      where: { userId: member.id, date: { lte: date } },
      orderBy: { date: "desc" },
      take: 14,
    }),
    prisma.task.count({
      where: { assigneeId: member.id, status: { not: "DONE" }, dueDate: { lt: date } },
    }),
    prisma.task.count({ where: { assigneeId: member.id, status: "BLOCKED" } }),
    prisma.updateRequest.findFirst({
      where: { toId: member.id, createdAt: { gte: addDays(date, -2) } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.findMany({
      where: { assigneeId: member.id, updatedAt: { gte: weekAgo } },
      select: { status: true, dueDate: true, title: true, priority: true, updatedAt: true },
    }),
  ]);

  const updated = hasMeaningfulUpdate(journal);
  const lastJournal = recentJournals.find((j) => hasMeaningfulUpdate(j)) ?? null;
  const lastUpdateAt = lastJournal?.updatedAt ?? lastJournal?.createdAt ?? null;
  const missedDays = !lastJournal || lastJournal.date < attentionSince;
  const reasons: string[] = [];
  if (missedDays) reasons.push("hasn't submitted an update for 2 working days");
  if (pendingRequest && !updated) reasons.push("manager requested an update");
  if (!updated && overdue > 0) reasons.push(`${overdue} overdue task${overdue === 1 ? "" : "s"}`);
  if (!updated && blocked > 0) reasons.push(`${blocked} blocked task${blocked === 1 ? "" : "s"}`);

  let status: UpdateStatus = "not_updated";
  if (updated) status = "updated";
  if (reasons.length) status = "needs_attention";

  return {
    updated,
    status,
    lastUpdateAt,
    lastUpdateDate: lastJournal ? isoDate(lastJournal.date) : null,
    reasons,
    overdue,
    blocked,
    inProgress: tasks.filter((t) => t.status === "IN_PROGRESS" || t.status === "TODO").length,
    completedThisWeek: tasks.filter((t) => t.status === "DONE").length,
    sharedUpdate: journal
      ? {
          focus: journal.focus,
          completed: journal.completed,
          blocked: journal.blocked,
          tomorrow: journal.tomorrow,
        }
      : null,
  };
}

export async function listTeamUpdates(user: AuthedUser, query: Record<string, unknown>) {
  if (!canManageTeam(user)) throw new HttpError(403, "Only managers and admins can view team work updates");
  const date = typeof query.date === "string" ? parseDate(query.date) : startOfDay();
  const policy = await getOrCreatePolicy(user.organizationId, user.organization.kind);
  let members = await visibleMembers(user);
  const catalog = members;

  const dept = typeof query.department === "string" ? query.department : "";
  const managerId = typeof query.managerId === "string" ? query.managerId : "";
  const employeeId = typeof query.employeeId === "string" ? query.employeeId : "";
  const teamId = typeof query.team === "string" ? query.team : "";
  const statusFilter = typeof query.status === "string" ? query.status : "all";

  if (dept) members = members.filter((m) => m.department?.name === dept);
  if (managerId) members = members.filter((m) => m.managerId === managerId || m.id === managerId);
  if (employeeId) members = members.filter((m) => m.id === employeeId);
  if (teamId) members = members.filter((m) => m.teams.some((t) => t.teamId === teamId || t.team.name === teamId));

  const rows = await Promise.all(
    members.map(async (m) => {
      const info = await classifyMember(m, date, policy.workingDays);
      return {
        userId: m.id,
        name: m.name,
        email: m.email,
        jobTitle: m.jobTitle,
        department: m.department?.name ?? "",
        managerId: m.managerId,
        avatarInitials: m.avatarInitials,
        ...info,
      };
    }),
  );

  const filtered = statusFilter === "all" ? rows : rows.filter((r) => r.status === statusFilter);
  const totals = {
    employees: rows.length,
    updated: rows.filter((r) => r.updated).length,
    notUpdated: rows.filter((r) => !r.updated && r.status !== "needs_attention").length,
    needsAttention: rows.filter((r) => r.status === "needs_attention").length,
  };

  const taskTotals = await prisma.task.groupBy({
    by: ["status"],
    where: { assigneeId: { in: members.map((m) => m.id) } },
    _count: true,
  });
  const overdue = await prisma.task.count({
    where: {
      assigneeId: { in: members.map((m) => m.id) },
      status: { not: "DONE" },
      dueDate: { lt: date },
    },
  });

  const orgTeams = await prisma.team.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { name: "asc" },
  });
  const managerIds = [...new Set(catalog.map((m) => m.managerId).filter(Boolean))] as string[];
  const managers = managerIds.length
    ? await prisma.user.findMany({ where: { id: { in: managerIds } }, select: { id: true, name: true } })
    : [];

  return {
    date: isoDate(date),
    policy: serializePolicy(policy),
    totals,
    tasks: {
      completed: taskTotals.find((t) => t.status === "DONE")?._count ?? 0,
      inProgress: taskTotals.find((t) => t.status === "IN_PROGRESS")?._count ?? 0,
      blocked: taskTotals.find((t) => t.status === "BLOCKED")?._count ?? 0,
      overdue,
    },
    filters: {
      departments: [...new Set(catalog.map((m) => m.department?.name).filter(Boolean))] as string[],
      teams: orgTeams.map((t) => ({ id: t.id, name: t.name })),
      managers,
      employees: catalog.map((m) => ({ id: m.id, name: m.name })),
    },
    employees: filtered,
  };
}

export async function getEmployeeUpdate(user: AuthedUser, employeeId: string, dateRaw?: string) {
  if (!canManageTeam(user)) throw new HttpError(403, "Forbidden");
  const date = dateRaw ? parseDate(dateRaw) : startOfDay();
  const members = await visibleMembers(user);
  const member = members.find((m) => m.id === employeeId);
  if (!member) throw new HttpError(404, "Employee not found or not in your team");
  const policy = await getOrCreatePolicy(user.organizationId, user.organization.kind);
  const info = await classifyMember(member, date, policy.workingDays);
  const tasks = await prisma.task.findMany({
    where: { assigneeId: member.id },
    include: { project: true },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  return {
    user: {
      id: member.id,
      name: member.name,
      jobTitle: member.jobTitle,
      department: member.department?.name ?? "",
      email: member.email,
    },
    date: isoDate(date),
    ...info,
    privacyNote: "Mood and private journal notes stay with the employee. This view shows submitted work updates and tasks only.",
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      project: t.project.name,
      status: t.status,
      dueDate: t.dueDate ? isoDate(t.dueDate) : "",
      priority: t.priority,
    })),
  };
}

export async function taskAccountability(user: AuthedUser) {
  if (!canManageTeam(user)) throw new HttpError(403, "Forbidden");
  const members = await visibleMembers(user);
  const today = startOfDay();
  const rows = await Promise.all(
    members.map(async (m) => {
      const tasks = await prisma.task.findMany({ where: { assigneeId: m.id } });
      return {
        userId: m.id,
        name: m.name,
        assigned: tasks.length,
        completed: tasks.filter((t) => t.status === "DONE").length,
        inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
        overdue: tasks.filter((t) => t.status !== "DONE" && t.dueDate && t.dueDate < today).length,
        blocked: tasks.filter((t) => t.status === "BLOCKED").length,
      };
    }),
  );
  return { data: rows };
}

export async function activityFeed(user: AuthedUser) {
  if (!canManageTeam(user)) throw new HttpError(403, "Forbidden");
  const members = await visibleMembers(user);
  const ids = members.map((m) => m.id);
  const since = addDays(startOfDay(), -3);
  const [journals, tasks, blockers] = await Promise.all([
    prisma.dailyJournal.findMany({
      where: { userId: { in: ids }, date: { gte: since } },
      include: { user: true },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    prisma.task.findMany({
      where: { assigneeId: { in: ids }, updatedAt: { gte: since }, status: { in: ["DONE", "BLOCKED"] } },
      include: { assignee: true },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    prisma.blocker.findMany({
      where: { raisedById: { in: ids }, raisedAt: { gte: since } },
      include: { raisedBy: true },
      orderBy: { raisedAt: "desc" },
      take: 15,
    }),
  ]);

  const events = [
    ...journals
      .filter((j) => hasMeaningfulUpdate(j))
      .map((j) => ({
        at: j.updatedAt.toISOString(),
        userId: j.userId,
        name: j.user.name,
        kind: "update" as const,
        text: j.completed[0] || j.focus || "Added a work update",
      })),
    ...tasks.map((t) => ({
      at: t.updatedAt.toISOString(),
      userId: t.assigneeId,
      name: t.assignee.name,
      kind: t.status === "BLOCKED" ? ("blocked" as const) : ("completed" as const),
      text: t.title,
    })),
    ...blockers.map((b) => ({
      at: b.raisedAt.toISOString(),
      userId: b.raisedById,
      name: b.raisedBy.name,
      kind: "blocked" as const,
      text: b.title,
    })),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 40);

  return { data: events };
}

export async function requestUpdate(user: AuthedUser, body: Record<string, unknown>) {
  if (!canManageTeam(user)) throw new HttpError(403, "Only managers can request an update");
  const toId = String(body?.employeeId ?? "");
  const message = String(body?.message ?? "").trim();
  if (!toId || !message) throw new HttpError(400, "Employee and message are required");
  const members = await visibleMembers(user);
  const target = members.find((m) => m.id === toId);
  if (!target) throw new HttpError(404, "Employee not found in your team");

  const created = await prisma.updateRequest.create({
    data: {
      organizationId: user.organizationId,
      fromId: user.id,
      toId,
      message,
    },
  });

  const policy = await getOrCreatePolicy(user.organizationId, user.organization.kind);
  const mail = managerRequestEmail(target.name, user.name, message, envApp());
  await notify({
    userId: toId,
    kind: NOTIFICATION_KINDS.MANAGER_REQUEST,
    title: "Your manager requested an update",
    body: message,
    actionUrl: "/my-day",
    email: policy.notifyEmail ? mail : undefined,
    required: true,
    forceInApp: policy.notifyInApp,
    forceEmail: policy.notifyEmail,
  });

  return { ok: true, id: created.id, message: "Update request sent" };
}

function envApp() {
  return env.appUrl.replace(/\/$/, "");
}

async function claimDispatch(organizationId: string, userId: string, kind: string, date: Date) {
  try {
    await prisma.reminderDispatch.create({
      data: { organizationId, userId, kind, date },
    });
    return true;
  } catch {
    return false;
  }
}

function pastReminderTime(reminderTime: string) {
  const [h, m] = reminderTime.split(":").map((part) => Number(part) || 0);
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() >= h * 60 + m;
}

async function sendEmployeeReminder(
  member: { id: string; name: string; role: string },
  organizationId: string,
  policy: Awaited<ReturnType<typeof getOrCreatePolicy>>,
  today: Date,
) {
  if (member.role === "ORG_ADMIN" || member.role === "HR_ADMIN") return false;
  if (policy.reminderFrequency === "off") return false;
  const journal = await prisma.dailyJournal.findUnique({
    where: { userId_date: { userId: member.id, date: today } },
  });
  if (hasMeaningfulUpdate(journal)) return false;
  if (!(await claimDispatch(organizationId, member.id, NOTIFICATION_KINDS.WORK_UPDATE_REMINDER, today))) {
    return false;
  }
  const mail = dailyReminderEmail(member.name, envApp());
  await notify({
    userId: member.id,
    kind: NOTIFICATION_KINDS.WORK_UPDATE_REMINDER,
    title: "You haven't added today's work update",
    body: "Take a moment to record what you worked on today.",
    actionUrl: "/my-day",
    email: policy.notifyEmail ? mail : undefined,
    required: policy.requireDaily,
    forceInApp: policy.notifyInApp,
    forceEmail: policy.notifyEmail && policy.requireDaily ? true : undefined,
  });
  return true;
}

export async function runMissingReminders(user: AuthedUser) {
  if (!canManageTeam(user)) throw new HttpError(403, "Forbidden");
  const policy = await getOrCreatePolicy(user.organizationId, user.organization.kind);
  if (!policy.enabled) return { sent: 0, skipped: "Reminders are disabled for this organization" };

  const today = startOfDay();
  if (!isWorkingDay(today, policy.workingDays)) {
    return { sent: 0, skipped: "Today is not a working day" };
  }

  const members = await visibleMembers(user);
  let sent = 0;
  for (const member of members) {
    if (await sendEmployeeReminder(member, user.organizationId, policy, today)) sent += 1;
  }
  return { sent, date: isoDate(today) };
}

async function sendTaskDueReminders(member: { id: string; name: string }, organizationId: string, today: Date) {
  const tomorrow = addDays(today, 1);
  const dueSoon = await prisma.task.findMany({
    where: { assigneeId: member.id, status: { not: "DONE" }, dueDate: tomorrow },
  });
  const overdue = await prisma.task.findMany({
    where: { assigneeId: member.id, status: { not: "DONE" }, dueDate: { lt: today } },
  });

  let sent = 0;
  for (const task of dueSoon) {
    if (!(await claimDispatch(organizationId, member.id, `${NOTIFICATION_KINDS.TASK_DUE_SOON}:${task.id}`, today))) {
      continue;
    }
    await notify({
      userId: member.id,
      kind: NOTIFICATION_KINDS.TASK_DUE_SOON,
      title: "Your task is due tomorrow",
      body: `“${task.title}” is due tomorrow.`,
      actionUrl: "/tasks",
      email: taskDueEmail(member.name, task.title, "due tomorrow", envApp()),
    });
    sent += 1;
  }
  for (const task of overdue.slice(0, 3)) {
    if (!(await claimDispatch(organizationId, member.id, `${NOTIFICATION_KINDS.TASK_OVERDUE}:${task.id}`, today))) {
      continue;
    }
    await notify({
      userId: member.id,
      kind: NOTIFICATION_KINDS.TASK_OVERDUE,
      title: "Your task is overdue",
      body: `“${task.title}” is overdue.`,
      actionUrl: "/tasks",
      email: taskDueEmail(member.name, task.title, "overdue", envApp()),
    });
    sent += 1;
  }
  return sent;
}

async function notifyManagerOfMissingUpdates(
  members: { id: string; name: string; managerId: string | null }[],
  organizationId: string,
  workingDays: number[],
  today: Date,
) {
  let sent = 0;
  for (const member of members) {
    if (!member.managerId) continue;
    const info = await classifyMember(member, today, workingDays);
    if (!info.reasons.includes("hasn't submitted an update for 2 working days")) continue;
    if (!(await claimDispatch(organizationId, member.managerId, `${NOTIFICATION_KINDS.MANAGER_MISSING}:${member.id}`, today))) {
      continue;
    }
    await notify({
      userId: member.managerId,
      kind: NOTIFICATION_KINDS.MANAGER_MISSING,
      title: `${member.name} hasn't submitted an update for 2 working days`,
      body: "They may need a reminder — not a performance judgment.",
      actionUrl: "/team/updates",
    });
    sent += 1;
  }
  return sent;
}

/** Org-wide reminder pass used by the scheduler. Deduped per user per day. */
export async function runScheduledWorkUpdateJobs() {
  const today = startOfDay();
  const orgs = await prisma.organization.findMany({
    where: { kind: "ENTERPRISE" },
    include: { workUpdatePolicy: true, users: { where: { isActive: true } } },
  });

  let reminders = 0;
  let due = 0;
  let missing = 0;
  let weekly = 0;

  for (const org of orgs) {
    const policy = org.workUpdatePolicy ?? (await getOrCreatePolicy(org.id, org.kind));
    if (!policy.enabled) continue;
    if (!isWorkingDay(today, policy.workingDays)) continue;
    if (!pastReminderTime(policy.reminderTime)) continue;

    for (const member of org.users) {
      if (await sendEmployeeReminder(member, org.id, policy, today)) reminders += 1;
      due += await sendTaskDueReminders(member, org.id, today);
    }
    missing += await notifyManagerOfMissingUpdates(org.users, org.id, policy.workingDays, today);

    const lastWorking = [...policy.workingDays].sort((a, b) => a - b).at(-1);
    if (today.getUTCDay() === lastWorking) {
      for (const member of org.users) {
        if (member.role === "ORG_ADMIN" || member.role === "HR_ADMIN") continue;
        if (!(await claimDispatch(org.id, member.id, NOTIFICATION_KINDS.WEEKLY_SUMMARY, today))) continue;
        await notifyWeeklySummaryReady(member.id);
        weekly += 1;
      }
    }
  }

  return { reminders, due, missing, weekly };
}

export async function weeklyDashboard(user: AuthedUser) {
  if (!canManageTeam(user)) throw new HttpError(403, "Forbidden");
  const today = startOfDay();
  const weekStart = addDays(today, -4);
  const policy = await getOrCreatePolicy(user.organizationId, user.organization.kind);
  const members = await visibleMembers(user);
  const ids = members.map((m) => m.id);

  let expected = 0;
  for (let d = new Date(weekStart); d <= today; d = addDays(d, 1)) {
    if (isWorkingDay(d, policy.workingDays)) expected += members.length;
  }

  const [journals, tasks, attention] = await Promise.all([
    prisma.dailyJournal.findMany({
      where: { userId: { in: ids }, date: { gte: weekStart, lte: today } },
    }),
    prisma.task.findMany({ where: { assigneeId: { in: ids } } }),
    Promise.all(members.map(async (m) => ({ m, info: await classifyMember(m, today, policy.workingDays) }))),
  ]);

  const submitted = journals.filter((j) => hasMeaningfulUpdate(j)).length;
  const needing = attention
    .filter((x) => x.info.status === "needs_attention")
    .map((x) => ({
      userId: x.m.id,
      name: x.m.name,
      reasons: x.info.reasons,
    }));

  return {
    period: { from: isoDate(weekStart), to: isoDate(today) },
    employees: members.length,
    updatesSubmitted: submitted,
    expectedUpdates: expected,
    updateCompletion: expected ? Math.round((submitted / expected) * 100) : 0,
    tasksCompleted: tasks.filter((t) => t.status === "DONE").length,
    inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    blocked: tasks.filter((t) => t.status === "BLOCKED").length,
    needingAttention: needing,
  };
}

export async function generateTeamSummary(user: AuthedUser) {
  if (!canManageTeam(user)) throw new HttpError(403, "Forbidden");
  const today = startOfDay();
  const weekStart = addDays(today, -4);
  const members = await visibleMembers(user);
  const ids = members.map((m) => m.id);
  const journals = await prisma.dailyJournal.findMany({
    where: { userId: { in: ids }, date: { gte: weekStart, lte: today } },
    include: { user: true },
  });
  const tasks = await prisma.task.findMany({
    where: { assigneeId: { in: ids }, updatedAt: { gte: weekStart } },
  });

  const completed = [
    ...journals.flatMap((j) => j.completed),
    ...tasks.filter((t) => t.status === "DONE").map((t) => t.title),
  ];
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").map((t) => t.title);
  const blockers = [
    ...journals.flatMap((j) => j.blocked),
    ...tasks.filter((t) => t.status === "BLOCKED").map((t) => t.title),
  ];
  const nextWeek = journals.flatMap((j) => j.tomorrow);

  const input = {
    name: user.organization.name,
    periodLabel: `${isoDate(weekStart)} – ${isoDate(today)}`,
    completed,
    inProgress,
    learned: [],
    blockers,
    nextWeek,
    format: "manager" as const,
  };

  try {
    const ai = await generateWeeklyStatusForUser(user, { ...input, preferAi: true });
    return { ...ai, source: ai.source, employees: members.length };
  } catch {
    const template = await generateWeeklyStatus(input);
    return { ...template, source: "template" as const, employees: members.length };
  }
}

export async function getPolicy(user: AuthedUser) {
  if (!ADMIN_ROLES.includes(user.role)) throw new HttpError(403, "Only organization admins can manage work-update policy");
  const policy = await getOrCreatePolicy(user.organizationId, user.organization.kind);
  return serializePolicy(policy);
}

export async function updatePolicy(user: AuthedUser, body: Record<string, unknown>) {
  if (!ADMIN_ROLES.includes(user.role)) throw new HttpError(403, "Only organization admins can manage work-update policy");
  const current = await getOrCreatePolicy(user.organizationId, user.organization.kind);
  const workingDays = Array.isArray(body.workingDays)
    ? (body.workingDays as unknown[]).map((n) => Number(n)).filter((n) => n >= 0 && n <= 6)
    : current.workingDays;
  const updated = await prisma.organizationWorkUpdatePolicy.update({
    where: { organizationId: user.organizationId },
    data: {
      ...(typeof body.enabled === "boolean" ? { enabled: body.enabled } : {}),
      ...(typeof body.requireDaily === "boolean" ? { requireDaily: body.requireDaily } : {}),
      ...(typeof body.reminderTime === "string" ? { reminderTime: body.reminderTime } : {}),
      ...(workingDays.length ? { workingDays } : {}),
      ...(typeof body.notifyInApp === "boolean" ? { notifyInApp: body.notifyInApp } : {}),
      ...(typeof body.notifyEmail === "boolean" ? { notifyEmail: body.notifyEmail } : {}),
      ...(typeof body.reminderFrequency === "string" ? { reminderFrequency: body.reminderFrequency } : {}),
    },
  });
  return serializePolicy(updated);
}

export async function notifyWeeklySummaryReady(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const mail = weeklySummaryEmail(user.name, envApp());
  await notify({
    userId,
    kind: NOTIFICATION_KINDS.WEEKLY_SUMMARY,
    title: "Your weekly summary is ready",
    body: "Review, edit, and share what you worked on this week.",
    actionUrl: "/reviews?type=weekly",
    email: mail,
  });
}
