import type { Priority, TaskStatus } from "@prisma/client";
import type { Request } from "express";
import { DEFAULT_GOAL_TARGET_DATE, DEFAULT_LEARNING_MINUTES, DEFAULT_TASK_ESTIMATE_MINS } from "../constants/defaultValues.js";
import { HttpError } from "../exceptions/http.exception.js";
import type { AuthedUser } from "../interface/auth.interface.js";
import { isoDate, parseDate, startOfDay, addDays } from "../utils/dates.js";
import { paginated, parsePage } from "../utils/pagination.js";
import { prisma } from "../utils/prisma.js";
import { serializeGoal, serializeJournal, serializeLearning, serializeTask } from "../utils/serialize.js";

async function ensureProject(organizationId: string, name: string) {
  return prisma.project.upsert({
    where: { organizationId_name: { organizationId, name } },
    update: {},
    create: { organizationId, name },
  });
}

export async function listTasks(user: AuthedUser, query: Request["query"]) {
  const { page, limit } = parsePage(query);
  const q = String(query.q ?? "").toLowerCase();
  const status = query.status as TaskStatus | undefined;
  const assigneeId = typeof query.assigneeId === "string" ? query.assigneeId : undefined;
  const due = typeof query.due === "string" ? query.due : undefined;
  const tasks = await prisma.task.findMany({
    where: {
      assignee: { organizationId: user.organizationId },
      ...(status ? { status } : {}),
      ...(assigneeId ? { assigneeId } : {}),
      ...(due ? { dueDate: parseDate(due) } : {}),
    },
    include: { project: true },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });
  let items = tasks.map(serializeTask);
  if (q) items = items.filter((t) => `${t.title} ${t.project} ${t.tags.join(" ")}`.toLowerCase().includes(q));
  return paginated(items, page, limit);
}

export async function createTask(user: AuthedUser, body: Record<string, unknown>) {
  const title = String(body?.title ?? "").trim();
  if (!title) throw new HttpError(400, "title is required");
  const projectName = String(body?.project ?? "Personal").trim() || "Personal";
  const project = await ensureProject(user.organizationId, projectName);
  const task = await prisma.task.create({
    data: {
      projectId: project.id,
      assigneeId: typeof body?.assigneeId === "string" ? body.assigneeId : user.id,
      title,
      description: (body?.description as string) || null,
      priority: ((body?.priority as Priority) ?? "MEDIUM") as Priority,
      status: ((body?.status as TaskStatus) ?? "TODO") as TaskStatus,
      dueDate: body?.dueDate ? parseDate(String(body.dueDate)) : startOfDay(),
      estimateMins: Number(body?.estimateMins ?? DEFAULT_TASK_ESTIMATE_MINS),
      tags: Array.isArray(body?.tags) ? (body.tags as string[]) : [],
    },
    include: { project: true },
  });
  if (task.assigneeId !== user.id) {
    const { notify } = await import("./notification.service.js");
    const { NOTIFICATION_KINDS } = await import("../constants/notifications.js");
    const { taskAssignedEmail } = await import("./email.service.js");
    const { env } = await import("../config/env.config.js");
    const assignee = await prisma.user.findUnique({ where: { id: task.assigneeId } });
    if (assignee) {
      await notify({
        userId: assignee.id,
        kind: NOTIFICATION_KINDS.TASK_ASSIGNED,
        title: "A new task has been assigned to you",
        body: `${user.name} assigned “${task.title}”.`,
        actionUrl: "/tasks",
        email: taskAssignedEmail(assignee.name, task.title, env.appUrl.replace(/\/$/, "")),
      });
    }
  }
  return serializeTask(task);
}

export async function getTask(user: AuthedUser, id: string) {
  const task = await prisma.task.findFirst({
    where: { id, assignee: { organizationId: user.organizationId } },
    include: { project: true },
  });
  if (!task) throw new HttpError(404, "Task not found");
  return serializeTask(task);
}

export async function updateTask(user: AuthedUser, id: string, body: Record<string, unknown>) {
  const task = await prisma.task.findFirst({
    where: { id, assignee: { organizationId: user.organizationId } },
  });
  if (!task) throw new HttpError(404, "Task not found");
  let projectId = task.projectId;
  if (body?.project) {
    projectId = (await ensureProject(user.organizationId, String(body.project))).id;
  }
  const updated = await prisma.task.update({
    where: { id: task.id },
    data: {
      projectId,
      ...(body?.title ? { title: String(body.title) } : {}),
      ...(body?.description !== undefined ? { description: (body.description as string) || null } : {}),
      ...(body?.priority ? { priority: body.priority as Priority } : {}),
      ...(body?.status ? { status: body.status as TaskStatus } : {}),
      ...(body?.dueDate ? { dueDate: parseDate(String(body.dueDate)) } : {}),
      ...(body?.estimateMins !== undefined ? { estimateMins: Number(body.estimateMins) } : {}),
      ...(body?.assigneeId ? { assigneeId: String(body.assigneeId) } : {}),
      ...(Array.isArray(body?.tags) ? { tags: body.tags as string[] } : {}),
    },
    include: { project: true, assignee: true },
  });

  const { notify } = await import("./notification.service.js");
  const { NOTIFICATION_KINDS } = await import("../constants/notifications.js");
  if (body?.status && body.status !== task.status) {
    if (updated.status === "BLOCKED" && updated.assignee.managerId) {
      await notify({
        userId: updated.assignee.managerId,
        kind: NOTIFICATION_KINDS.MANAGER_BLOCKED,
        title: `${updated.assignee.name} reported a blocked task`,
        body: `“${updated.title}” is blocked.`,
        actionUrl: "/team/updates",
      });
    }
    if (
      updated.status === "DONE" &&
      (updated.priority === "HIGH" || updated.priority === "CRITICAL") &&
      updated.assignee.managerId
    ) {
      await notify({
        userId: updated.assignee.managerId,
        kind: NOTIFICATION_KINDS.MANAGER_COMPLETED,
        title: `${updated.assignee.name} completed a high-priority task`,
        body: `“${updated.title}” is done.`,
        actionUrl: "/team/updates",
      });
    }
    if (updated.assigneeId === user.id && body.status) {
      // no extra ping to self
    }
  }
  if (body?.assigneeId && body.assigneeId !== task.assigneeId && updated.assigneeId !== user.id) {
    const { taskAssignedEmail } = await import("./email.service.js");
    const { env } = await import("../config/env.config.js");
    await notify({
      userId: updated.assigneeId,
      kind: NOTIFICATION_KINDS.TASK_ASSIGNED,
      title: "A new task has been assigned to you",
      body: `${user.name} assigned “${updated.title}”.`,
      actionUrl: "/tasks",
      email: taskAssignedEmail(updated.assignee.name, updated.title, env.appUrl.replace(/\/$/, "")),
    });
  }
  return serializeTask(updated);
}

export async function deleteTask(user: AuthedUser, id: string) {
  const task = await prisma.task.findFirst({
    where: { id, assignee: { organizationId: user.organizationId } },
  });
  if (!task) throw new HttpError(404, "Task not found");
  await prisma.task.delete({ where: { id: task.id } });
  return { ok: true };
}

export async function listJournals(user: AuthedUser, query: Request["query"]) {
  const { page, limit } = parsePage(query);
  const userId = typeof query.userId === "string" ? query.userId : user.id;
  if (userId !== user.id && user.role === "EMPLOYEE") throw new HttpError(403, "Forbidden");
  const journals = await prisma.dailyJournal.findMany({
    where: { userId, user: { organizationId: user.organizationId } },
    orderBy: { date: "desc" },
  });
  return paginated(journals.map(serializeJournal), page, limit);
}

export async function getJournal(user: AuthedUser, id: string) {
  const journal = await prisma.dailyJournal.findFirst({
    where: { id, user: { organizationId: user.organizationId } },
  });
  if (!journal) throw new HttpError(404, "Journal not found");
  if (journal.userId !== user.id && journal.isPrivate && user.role === "EMPLOYEE") {
    throw new HttpError(403, "Forbidden");
  }
  return serializeJournal(journal);
}

function journalData(body: Record<string, unknown>) {
  return {
    ...(body?.completion !== undefined ? { completion: Number(body.completion) } : {}),
    ...(body?.mood !== undefined ? { mood: Number(body.mood) } : {}),
    ...(body?.focus !== undefined ? { focus: body.focus as string } : {}),
    ...(Array.isArray(body?.completed) ? { completed: body.completed as string[] } : {}),
    ...(Array.isArray(body?.learned) ? { learned: body.learned as string[] } : {}),
    ...(Array.isArray(body?.blocked) ? { blocked: body.blocked as string[] } : {}),
    ...(Array.isArray(body?.tomorrow) ? { tomorrow: body.tomorrow as string[] } : {}),
    ...(body?.managerNote !== undefined ? { managerNote: body.managerNote as string } : {}),
  };
}

export async function saveJournal(user: AuthedUser, body: Record<string, unknown>) {
  const date = body?.date ? parseDate(String(body.date)) : startOfDay();
  const journal = await prisma.dailyJournal.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: journalData(body),
    create: {
      userId: user.id,
      date,
      completion: Number(body?.completion ?? 0),
      mood: body?.mood != null ? Number(body.mood) : 3,
      focus: (body?.focus as string) ?? null,
      completed: Array.isArray(body?.completed) ? (body.completed as string[]) : [],
      learned: Array.isArray(body?.learned) ? (body.learned as string[]) : [],
      blocked: Array.isArray(body?.blocked) ? (body.blocked as string[]) : [],
      tomorrow: Array.isArray(body?.tomorrow) ? (body.tomorrow as string[]) : [],
      managerNote: (body?.managerNote as string) ?? null,
    },
  });
  await prisma.dailyPlan.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: { focus: journal.focus, mood: journal.mood },
    create: { userId: user.id, date, focus: journal.focus, mood: journal.mood },
  });
  const meaningful =
    journal.completed.length > 0 || Boolean(journal.focus?.trim()) || journal.blocked.length > 0;
  if (meaningful && user.managerId) {
    const pending = await prisma.updateRequest.findFirst({
      where: { toId: user.id, createdAt: { gte: addDays(date, -2) } },
      orderBy: { createdAt: "desc" },
    });
    if (pending) {
      const { notify } = await import("./notification.service.js");
      const { NOTIFICATION_KINDS } = await import("../constants/notifications.js");
      await notify({
        userId: user.managerId,
        kind: NOTIFICATION_KINDS.MANAGER_REQUEST,
        title: `${user.name} submitted an update`,
        body: journal.completed[0] || journal.focus || "Added today's work update.",
        actionUrl: "/team/updates",
      });
    }
    if (journal.blocked.length > 0) {
      try {
        await prisma.reminderDispatch.create({
          data: {
            organizationId: user.organizationId,
            userId: user.id,
            kind: "manager_help",
            date,
          },
        });
        const { notify } = await import("./notification.service.js");
        const { NOTIFICATION_KINDS } = await import("../constants/notifications.js");
        await notify({
          userId: user.managerId,
          kind: NOTIFICATION_KINDS.MANAGER_BLOCKED,
          title: `${user.name} requested help`,
          body: journal.blocked[0] ?? "Reported a blocker in today's update.",
          actionUrl: "/team/updates",
        });
      } catch {
        /* already notified today */
      }
    }
  }
  return serializeJournal(journal);
}

export async function updateJournal(user: AuthedUser, id: string, body: Record<string, unknown>) {
  const journal = await prisma.dailyJournal.findFirst({ where: { id, userId: user.id } });
  if (!journal) throw new HttpError(404, "Journal not found");
  const updated = await prisma.dailyJournal.update({
    where: { id: journal.id },
    data: journalData(body),
  });
  return serializeJournal(updated);
}

export async function deleteJournal(user: AuthedUser, id: string) {
  const journal = await prisma.dailyJournal.findFirst({ where: { id, userId: user.id } });
  if (!journal) throw new HttpError(404, "Journal not found");
  await prisma.dailyJournal.delete({ where: { id: journal.id } });
  return { ok: true };
}

export async function listDailyPlans(user: AuthedUser) {
  const plans = await prisma.dailyPlan.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
  });
  return {
    data: plans.map((p) => ({
      date: isoDate(p.date),
      ...(p.focus ? { focus: p.focus } : {}),
      mood: p.mood,
      userId: p.userId,
    })),
  };
}

export async function listLearnings(user: AuthedUser, query: Request["query"]) {
  const userId = typeof query.userId === "string" ? query.userId : user.id;
  if (userId !== user.id && user.role === "EMPLOYEE") throw new HttpError(403, "Forbidden");
  const entries = await prisma.learningEntry.findMany({
    where: { userId, user: { organizationId: user.organizationId } },
    orderBy: { date: "desc" },
  });
  return { data: entries.map(serializeLearning) };
}

export async function createLearning(user: AuthedUser, body: Record<string, unknown>) {
  const topic = String(body?.topic ?? "").trim();
  if (!topic) throw new HttpError(400, "topic is required");
  const entry = await prisma.learningEntry.create({
    data: {
      userId: user.id,
      topic,
      description: String(body?.description ?? "Logged from Tracework"),
      date: body?.date ? parseDate(String(body.date)) : startOfDay(),
      minutes: Number(body?.minutes ?? DEFAULT_LEARNING_MINUTES),
      confidence: Number(body?.confidence ?? 3),
      project: (body?.project as string) ?? null,
      tags: Array.isArray(body?.tags) ? (body.tags as string[]) : [],
    },
  });
  return serializeLearning(entry);
}

export async function listGoals(user: AuthedUser, query: Request["query"]) {
  const userId = typeof query.userId === "string" ? query.userId : user.id;
  if (userId !== user.id && user.role === "EMPLOYEE") throw new HttpError(403, "Forbidden");
  const goals = await prisma.goal.findMany({
    where: { userId, user: { organizationId: user.organizationId } },
    include: { milestones: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return { data: goals.map(serializeGoal) };
}

export async function createGoal(user: AuthedUser, body: Record<string, unknown>) {
  const title = String(body?.title ?? "").trim();
  if (!title) throw new HttpError(400, "title is required");
  const milestones = Array.isArray(body?.milestones) ? (body.milestones as { title: string; done?: boolean }[]) : undefined;
  const goal = await prisma.goal.create({
    data: {
      userId: user.id,
      title,
      type: String(body?.type ?? "Professional"),
      progress: Number(body?.progress ?? 0),
      targetDate: body?.targetDate ? parseDate(String(body.targetDate)) : parseDate(DEFAULT_GOAL_TARGET_DATE),
      evidence: Array.isArray(body?.evidence) ? (body.evidence as string[]) : [],
      milestones: milestones ? { create: milestones.map((m) => ({ title: m.title, done: Boolean(m.done) })) } : undefined,
    },
    include: { milestones: true },
  });
  return serializeGoal(goal);
}

export async function updateGoal(user: AuthedUser, id: string, body: Record<string, unknown>) {
  const goal = await prisma.goal.findFirst({ where: { id, userId: user.id }, include: { milestones: true } });
  if (!goal) throw new HttpError(404, "Goal not found");
  if (body?.milestoneId) {
    const ms = goal.milestones.find((m) => m.id === body.milestoneId);
    if (!ms) throw new HttpError(404, "Milestone not found");
    await prisma.goalMilestone.update({ where: { id: ms.id }, data: { done: !ms.done } });
  }
  const refreshed = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id }, include: { milestones: true } });
  const progress = refreshed.milestones.length
    ? Math.round((refreshed.milestones.filter((m) => m.done).length / refreshed.milestones.length) * 100)
    : refreshed.progress;
  const updated = await prisma.goal.update({
    where: { id: goal.id },
    data: {
      progress,
      ...(body?.title ? { title: String(body.title) } : {}),
      ...(body?.evidence ? { evidence: body.evidence as string[] } : {}),
    },
    include: { milestones: { orderBy: { createdAt: "asc" } } },
  });
  return serializeGoal(updated);
}

export async function listEvents(user: AuthedUser) {
  const events = await prisma.calendarEvent.findMany({
    where: { userId: user.id },
    orderBy: { date: "asc" },
  });
  return {
    data: events.map((e) => ({
      id: e.id,
      title: e.title,
      date: isoDate(e.date),
      ...(e.time ? { time: e.time } : {}),
      kind: e.kind,
    })),
  };
}

export async function listAchievements(user: AuthedUser, query: Request["query"]) {
  const userId = typeof query.userId === "string" ? query.userId : user.id;
  if (userId !== user.id && user.role === "EMPLOYEE") throw new HttpError(403, "Forbidden");
  const rows = await prisma.achievement.findMany({
    where: { userId, user: { organizationId: user.organizationId } },
    orderBy: { createdAt: "desc" },
  });
  return { data: rows.map((a) => ({ id: a.id, title: a.title, detail: a.detail, at: a.at })) };
}
