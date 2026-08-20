import { ADMIN_ROLES, MANAGER_ROLES } from "../constants/defaultValues.js";
import {
  PERIODS_BY_TYPE,
  REPORT_TYPE_LABELS,
  isReportFormat,
  isReportType,
  mapLegacyFormat,
  type PeriodPreset,
  type ReportFormat,
  type ReportSubjectType,
  type ReportType,
} from "../constants/reports.js";
import { HttpError } from "../exceptions/http.exception.js";
import type { AuthedUser } from "../interface/auth.interface.js";
import {
  addDays,
  addMonths,
  endOfMonth,
  isoDate,
  parseDate,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "../utils/dates.js";
import { prisma } from "../utils/prisma.js";
import { generateReportWithAi } from "./ai-config.service.js";
import { sendEmail } from "./email.service.js";
import { renderReportTemplate, reportTitle, type ReportWorkContext } from "./report-format.service.js";
import { getOrCreatePolicy } from "./team-updates.service.js";

function canManage(user: AuthedUser) {
  return MANAGER_ROLES.includes(user.role);
}

export function resolvePeriod(
  preset: PeriodPreset | string,
  startRaw?: string,
  endRaw?: string,
  today = startOfDay(),
) {
  if (preset === "custom") {
    if (!startRaw || !endRaw) throw new HttpError(400, "Custom period needs a start and end date");
    const start = parseDate(startRaw);
    const end = parseDate(endRaw);
    if (end < start) throw new HttpError(400, "End date must be on or after the start date");
    return { start, end, preset: "custom" as const };
  }
  if (preset === "today") return { start: today, end: today, preset };
  if (preset === "yesterday") {
    const d = addDays(today, -1);
    return { start: d, end: d, preset };
  }
  if (preset === "this_week") return { start: startOfWeek(today), end: today, preset };
  if (preset === "last_week") {
    const thisMon = startOfWeek(today);
    return { start: addDays(thisMon, -7), end: addDays(thisMon, -1), preset };
  }
  if (preset === "this_month") return { start: startOfMonth(today), end: today, preset };
  if (preset === "last_month") {
    const firstThis = startOfMonth(today);
    const firstLast = startOfMonth(addMonths(today, -1));
    return { start: firstLast, end: addDays(firstThis, -1), preset };
  }
  if (preset === "last_3_months") return { start: addMonths(today, -3), end: today, preset };
  if (preset === "last_6_months") return { start: addMonths(today, -6), end: today, preset };
  if (preset === "last_12_months") return { start: addMonths(today, -12), end: today, preset };
  throw new HttpError(400, "Unknown review period");
}

async function visibleEmployees(user: AuthedUser) {
  if (user.organization.kind === "PERSONAL" || !canManage(user)) {
    return prisma.user.findMany({
      where: { id: user.id },
      include: { department: true, manager: true, teams: { include: { team: true } } },
    });
  }
  return prisma.user.findMany({
    where: {
      organizationId: user.organizationId,
      isActive: true,
      ...(ADMIN_ROLES.includes(user.role) ? {} : { OR: [{ managerId: user.id }, { id: user.id }] }),
    },
    include: { department: true, manager: true, teams: { include: { team: true } } },
    orderBy: { name: "asc" },
  });
}

async function resolveSubjects(
  user: AuthedUser,
  subjectType: ReportSubjectType,
  subjectId?: string,
) {
  if (subjectType === "self") {
    return {
      ids: [user.id],
      name: user.name,
      kind: "self" as const,
      managerName: undefined as string | undefined,
    };
  }
  if (!canManage(user) || user.organization.kind === "PERSONAL") {
    throw new HttpError(403, "You can only generate reports for your own work");
  }
  const people = await visibleEmployees(user);
  if (subjectType === "employee") {
    if (!subjectId) throw new HttpError(400, "Select an employee");
    const member = people.find((p) => p.id === subjectId);
    if (!member) throw new HttpError(403, "You are not authorized to report on this employee");
    return {
      ids: [member.id],
      name: member.name,
      kind: "employee" as const,
      managerName: member.manager?.name,
    };
  }
  if (subjectType === "team") {
    if (!subjectId) throw new HttpError(400, "Select a team");
    const team = await prisma.team.findFirst({
      where: { id: subjectId, organizationId: user.organizationId },
      include: { members: true },
    });
    if (!team) throw new HttpError(404, "Team not found");
    const allowed = new Set(people.map((p) => p.id));
    const ids = team.members.map((m) => m.userId).filter((id) => allowed.has(id));
    if (!ids.length) throw new HttpError(403, "No authorized people on this team");
    return { ids, name: team.name, kind: "team" as const, managerName: undefined };
  }
  throw new HttpError(400, "Unknown subject");
}

async function collectContext(
  user: AuthedUser,
  input: {
    reportType: ReportType;
    format: ReportFormat;
    start: Date;
    end: Date;
    subjectType: ReportSubjectType;
    subjectId?: string;
    managerName?: string;
  },
): Promise<ReportWorkContext> {
  const subject = await resolveSubjects(user, input.subjectType, input.subjectId);
  const start = input.start;
  const end = input.end;
  const endExclusive = addDays(end, 1);
  const isSelfOnly = subject.kind === "self";

  const [journals, tasks, learnings, goals, achievements, recognitions, blockers] = await Promise.all([
    prisma.dailyJournal.findMany({
      where: { userId: { in: subject.ids }, date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
    }),
    prisma.task.findMany({
      where: { assigneeId: { in: subject.ids } },
      include: { project: true },
    }),
    prisma.learningEntry.findMany({
      where: { userId: { in: subject.ids }, date: { gte: start, lte: end } },
    }),
    prisma.goal.findMany({
      where: { userId: { in: subject.ids } },
      include: { milestones: true },
    }),
    prisma.achievement.findMany({
      where: { userId: { in: subject.ids }, createdAt: { gte: start, lt: endExclusive } },
    }),
    prisma.recognition.findMany({
      where: { toId: { in: subject.ids }, createdAt: { gte: start, lt: endExclusive } },
    }),
    prisma.blocker.findMany({
      where: { raisedById: { in: subject.ids }, raisedAt: { gte: start, lt: endExclusive } },
    }),
  ]);

  const sharedJournals = journals.filter((j) => {
    if (isSelfOnly) return true;
    return j.completed.length > 0 || Boolean(j.focus?.trim()) || j.blocked.length > 0 || j.learned.length > 0;
  });

  const tasksInRange = tasks.filter((t) => t.updatedAt >= start && t.updatedAt < endExclusive);
  const completedTasks = tasksInRange.filter((t) => t.status === "DONE");
  const inProgressTasks = tasks.filter((t) => t.status === "IN_PROGRESS" || t.status === "TODO");
  const blockedTasks = tasks.filter((t) => t.status === "BLOCKED");

  let updatesSubmitted = sharedJournals.length;
  let expectedUpdates: number | undefined;
  if (subject.kind === "team") {
    const policy = await getOrCreatePolicy(user.organizationId, user.organization.kind);
    let expected = 0;
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      if (policy.workingDays.includes(d.getUTCDay())) expected += subject.ids.length;
    }
    expectedUpdates = expected;
  }

  return {
    reportType: input.reportType,
    format: input.format,
    periodLabel: isoDate(start) === isoDate(end) ? isoDate(start) : `${isoDate(start)} – ${isoDate(end)}`,
    subjectName: subject.name,
    subjectKind: subject.kind,
    managerName: input.managerName || subject.managerName,
    employeeCount: subject.kind === "team" ? subject.ids.length : undefined,
    updatesSubmitted: subject.kind === "team" ? updatesSubmitted : undefined,
    expectedUpdates,
    completed: [
      ...sharedJournals.flatMap((j) => j.completed),
      ...completedTasks.map((t) => t.title),
    ],
    inProgress: [
      ...sharedJournals.map((j) => j.focus).filter((v): v is string => Boolean(v?.trim())),
      ...inProgressTasks.map((t) => t.title),
    ],
    learned: [
      ...sharedJournals.flatMap((j) => j.learned),
      ...learnings.map((l) => (l.minutes ? `${l.topic} (${l.minutes} min)` : l.topic)),
    ],
    blockers: [
      ...sharedJournals.flatMap((j) => j.blocked),
      ...blockedTasks.map((t) => t.title),
      ...blockers.map((b) => b.title),
    ],
    nextWeek: sharedJournals.flatMap((j) => j.tomorrow),
    projects: [...new Set(tasksInRange.map((t) => t.project.name).filter((n) => n && n !== "Personal"))],
    goals: goals.map((g) => ({ title: g.title, progress: g.progress })),
    achievements: achievements.map((a) => a.title),
    recognitions: recognitions.map((r) => r.message),
    tasksCompleted: completedTasks.length,
    tasksAssigned: tasks.length,
    tasksInProgress: inProgressTasks.length,
    tasksBlocked: blockedTasks.length,
  };
}

export function serializeReport(row: {
  id: string;
  reportType: string;
  subjectType: string;
  subjectId: string | null;
  subjectName: string;
  startDate: Date;
  endDate: Date;
  title: string;
  format: string;
  content: string;
  subjectLine: string | null;
  status: string;
  version: number;
  rootId: string | null;
  source: string;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
}) {
  return {
    id: row.id,
    reportType: row.reportType,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    subjectName: row.subjectName,
    startDate: isoDate(row.startDate),
    endDate: isoDate(row.endDate),
    title: row.title,
    format: row.format,
    content: row.content,
    subjectLine: row.subjectLine,
    status: row.status,
    version: row.version,
    rootId: row.rootId,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdById: row.createdById,
  };
}

export async function options(user: AuthedUser) {
  const people = await visibleEmployees(user);
  const teams =
    canManage(user) && user.organization.kind !== "PERSONAL"
      ? await prisma.team.findMany({
          where: { organizationId: user.organizationId },
          orderBy: { name: "asc" },
        })
      : [];
  const manager = canManage(user) && user.organization.kind !== "PERSONAL";
  return {
    reportTypes: [
      { id: "daily", label: REPORT_TYPE_LABELS.daily },
      { id: "weekly", label: REPORT_TYPE_LABELS.weekly },
      { id: "monthly", label: REPORT_TYPE_LABELS.monthly },
      ...(manager ? [{ id: "performance", label: REPORT_TYPE_LABELS.performance }] : []),
      { id: "custom", label: REPORT_TYPE_LABELS.custom },
    ],
    periodsByType: PERIODS_BY_TYPE,
    formats: [
      { id: "professional", label: "Professional" },
      { id: "bullets", label: "Bullet points" },
      { id: "detailed", label: "Detailed" },
      { id: "email", label: "Email" },
    ],
    subjects: {
      self: { id: user.id, name: user.name },
      employees: manager
        ? people.filter((p) => p.id !== user.id).map((p) => ({ id: p.id, name: p.name, jobTitle: p.jobTitle }))
        : [],
      teams: teams.map((t) => ({ id: t.id, name: t.name })),
    },
    canManage: manager,
    recipients: [
      { email: user.email, name: user.name, label: "Me" },
      ...people
        .filter((p) => p.id !== user.id && p.email)
        .map((p) => ({ email: p.email, name: p.name, label: p.name })),
    ],
  };
}

export async function generate(
  user: AuthedUser,
  body: Record<string, unknown>,
  opts?: { save?: boolean },
) {
  const reportTypeRaw = String(body.reportType ?? "weekly");
  if (!isReportType(reportTypeRaw)) throw new HttpError(400, "Unknown report type");
  const reportType = reportTypeRaw;
  if (reportType === "performance" && !canManage(user)) {
    throw new HttpError(403, "Only managers can generate performance reviews");
  }

  const formatRaw = String(body.format ?? "professional");
  const format = isReportFormat(formatRaw) ? formatRaw : mapLegacyFormat(formatRaw);

  let subjectType = String(body.subjectType ?? "self") as ReportSubjectType;
  if (subjectType !== "self" && subjectType !== "employee" && subjectType !== "team") subjectType = "self";
  if (reportType === "performance" && subjectType === "self") {
    /* allowed: manager reviewing themselves is odd but OK */
  }
  if (reportType === "performance" && subjectType === "team") {
    throw new HttpError(400, "Performance reviews are for one employee");
  }

  const period = resolvePeriod(
    String(body.period ?? (reportType === "daily" ? "today" : reportType === "monthly" ? "this_month" : "this_week")),
    typeof body.startDate === "string" ? body.startDate : undefined,
    typeof body.endDate === "string" ? body.endDate : undefined,
  );

  const ctx = await collectContext(user, {
    reportType,
    format,
    start: period.start,
    end: period.end,
    subjectType,
    subjectId: typeof body.subjectId === "string" ? body.subjectId : undefined,
    managerName: typeof body.managerName === "string" ? body.managerName : undefined,
  });

  const template = renderReportTemplate(ctx);
  const preferAi = body.preferAi !== false;
  const ai = await generateReportWithAi(user, ctx, template, preferAi);

  const title = reportTitle(ctx);
  let saved = null;
  if (opts?.save !== false) {
    const previous = await prisma.generatedReport.findFirst({
      where: {
        createdById: user.id,
        reportType,
        subjectType,
        subjectId: typeof body.subjectId === "string" ? body.subjectId : user.id,
        startDate: period.start,
        endDate: period.end,
        status: "active",
      },
      orderBy: { version: "desc" },
    });
    const rootId = previous?.rootId ?? previous?.id ?? null;
    const version = previous ? previous.version + 1 : 1;
    saved = await prisma.generatedReport.create({
      data: {
        organizationId: user.organizationId,
        createdById: user.id,
        reportType,
        subjectType,
        subjectId: typeof body.subjectId === "string" ? body.subjectId : user.id,
        subjectName: ctx.subjectName,
        startDate: period.start,
        endDate: period.end,
        title,
        format,
        content: ai.body,
        subjectLine: ai.subject,
        version,
        rootId,
        source: ai.source,
      },
    });
  }

  return {
    ...(saved ? serializeReport(saved) : {}),
    id: saved?.id,
    title,
    subject: ai.subject,
    body: ai.body,
    content: ai.body,
    format,
    reportType,
    subjectType,
    subjectName: ctx.subjectName,
    startDate: isoDate(period.start),
    endDate: isoDate(period.end),
    source: ai.source,
    provider: ai.provider,
    model: ai.model,
    aiConfigured: ai.aiConfigured,
    aiMessage: ai.aiMessage,
    version: saved?.version ?? 1,
    evidence: {
      tasksCompleted: ctx.tasksCompleted,
      tasksAssigned: ctx.tasksAssigned,
      completedItems: ctx.completed.length,
      recordedNote: "This report is based on recorded work updates, tasks, goals, and learning. AI only rephrased listed facts.",
    },
  };
}

export async function listReports(user: AuthedUser) {
  const items = await prisma.generatedReport.findMany({
    where: { createdById: user.id, status: { not: "archived" } },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  return { data: items.map(serializeReport) };
}

async function ownedReport(user: AuthedUser, id: string) {
  const row = await prisma.generatedReport.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!row) throw new HttpError(404, "Report not found");
  if (row.createdById !== user.id && !ADMIN_ROLES.includes(user.role)) {
    throw new HttpError(403, "You cannot open this report");
  }
  return row;
}

export async function getReport(user: AuthedUser, id: string) {
  return serializeReport(await ownedReport(user, id));
}

export async function updateReport(user: AuthedUser, id: string, body: Record<string, unknown>) {
  const row = await ownedReport(user, id);
  const updated = await prisma.generatedReport.update({
    where: { id: row.id },
    data: {
      ...(typeof body.content === "string" ? { content: body.content } : {}),
      ...(typeof body.subjectLine === "string" ? { subjectLine: body.subjectLine } : {}),
      ...(body.status === "archived" || body.status === "active" ? { status: body.status } : {}),
    },
  });
  return serializeReport(updated);
}

export async function regenerate(user: AuthedUser, id: string, body: Record<string, unknown> = {}) {
  const row = await ownedReport(user, id);
  return generate(user, {
    reportType: row.reportType,
    format: row.format,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    startDate: isoDate(row.startDate),
    endDate: isoDate(row.endDate),
    period: "custom",
    preferAi: body.preferAi !== false,
    managerName: body.managerName,
  });
}

export async function emailReport(user: AuthedUser, id: string, body: Record<string, unknown>) {
  const row = await ownedReport(user, id);
  const to = String(body.to ?? "").trim().toLowerCase();
  const subject = String(body.subject ?? row.subjectLine ?? row.title);
  const content = String(body.body ?? row.content);
  if (!to || !to.includes("@")) throw new HttpError(400, "Choose a recipient email");
  const allowed = await options(user);
  if (!allowed.recipients.some((r) => r.email.toLowerCase() === to) && to !== user.email.toLowerCase()) {
    throw new HttpError(403, "You can only email permitted addresses");
  }
  const recipient = await prisma.user.findFirst({
    where: { organizationId: user.organizationId, email: { equals: to, mode: "insensitive" } },
  });
  const result = await sendEmail({
    to,
    toUserId: recipient?.id,
    organizationId: user.organizationId,
    subject,
    body: content,
  });
  return { ok: true, status: result.status, message: result.status === "sent" ? "Email sent" : "Email queued" };
}

export async function listPeriods(user: AuthedUser) {
  if (!canManage(user) || user.organization.kind === "PERSONAL") return { data: [] };
  const items = await prisma.savedReviewPeriod.findMany({
    where: { organizationId: user.organizationId, archived: false },
    orderBy: { startDate: "desc" },
  });
  return {
    data: items.map((p) => ({
      id: p.id,
      name: p.name,
      startDate: isoDate(p.startDate),
      endDate: isoDate(p.endDate),
    })),
  };
}

export async function createPeriod(user: AuthedUser, body: Record<string, unknown>) {
  if (!canManage(user) || user.organization.kind === "PERSONAL") {
    throw new HttpError(403, "Only managers can save review periods");
  }
  const name = String(body.name ?? "").trim();
  if (!name) throw new HttpError(400, "Name is required");
  const start = parseDate(String(body.startDate ?? ""));
  const end = parseDate(String(body.endDate ?? ""));
  if (end < start) throw new HttpError(400, "End date must be on or after the start date");
  const created = await prisma.savedReviewPeriod.create({
    data: {
      organizationId: user.organizationId,
      createdById: user.id,
      name,
      startDate: start,
      endDate: end,
    },
  });
  return { id: created.id, name: created.name, startDate: isoDate(start), endDate: isoDate(end) };
}

export async function updatePeriod(user: AuthedUser, id: string, body: Record<string, unknown>) {
  if (!canManage(user)) throw new HttpError(403, "Forbidden");
  const row = await prisma.savedReviewPeriod.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!row) throw new HttpError(404, "Period not found");
  const updated = await prisma.savedReviewPeriod.update({
    where: { id: row.id },
    data: {
      ...(typeof body.name === "string" ? { name: body.name.trim() } : {}),
      ...(typeof body.startDate === "string" ? { startDate: parseDate(body.startDate) } : {}),
      ...(typeof body.endDate === "string" ? { endDate: parseDate(body.endDate) } : {}),
      ...(typeof body.archived === "boolean" ? { archived: body.archived } : {}),
    },
  });
  return { id: updated.id, name: updated.name, startDate: isoDate(updated.startDate), endDate: isoDate(updated.endDate) };
}

export async function duplicatePeriod(user: AuthedUser, id: string) {
  const row = await prisma.savedReviewPeriod.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!row) throw new HttpError(404, "Period not found");
  return createPeriod(user, {
    name: `${row.name} (copy)`,
    startDate: isoDate(row.startDate),
    endDate: isoDate(row.endDate),
  });
}
