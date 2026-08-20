import { MANAGER_ROLES } from "../constants/defaultValues.js";
import { HttpError } from "../exceptions/http.exception.js";
import * as notificationService from "./notification.service.js";
import type { AuthedUser } from "../interface/auth.interface.js";
import { parseDate } from "../utils/dates.js";
import { prisma } from "../utils/prisma.js";
import {
  blockerStatusFromLabel,
  ideaStatusFromLabel,
  leaveStatusFromLabel,
  serializeBlocker,
  serializeIdea,
  serializeLeave,
  serializeRecognition,
} from "../utils/serialize.js";

const blockerInclude = {
  raisedBy: true,
  owner: true,
  comments: { include: { author: true }, orderBy: { createdAt: "asc" as const } },
};

export async function listBlockers(user: AuthedUser) {
  const items = await prisma.blocker.findMany({
    where: { raisedBy: { organizationId: user.organizationId } },
    include: blockerInclude,
    orderBy: { raisedAt: "desc" },
  });
  return { data: items.map(serializeBlocker) };
}

export async function createBlocker(user: AuthedUser, body: Record<string, unknown>) {
  const title = String(body?.title ?? "").trim();
  const description = String(body?.description ?? "").trim();
  if (!title || !description) throw new HttpError(400, "Title and description are required");
  const item = await prisma.blocker.create({
    data: {
      title,
      description,
      severity: String(body?.severity ?? "Medium"),
      affected: Number(body?.affected ?? 1),
      raisedById: user.id,
      ownerId: typeof body?.ownerId === "string" ? body.ownerId : null,
    },
    include: blockerInclude,
  });
  return serializeBlocker(item);
}

export async function updateBlocker(user: AuthedUser, id: string, body: Record<string, unknown>) {
  const item = await prisma.blocker.findFirst({
    where: { id, raisedBy: { organizationId: user.organizationId } },
  });
  if (!item) throw new HttpError(404, "Blocker not found");
  const status = typeof body?.status === "string" ? body.status : undefined;
  const updated = await prisma.blocker.update({
    where: { id: item.id },
    data: {
      ...(status ? { status: blockerStatusFromLabel[status] ?? status } : {}),
      ...(body?.ownerId !== undefined ? { ownerId: body.ownerId as string | null } : {}),
      ...(body?.title ? { title: String(body.title) } : {}),
    },
    include: blockerInclude,
  });
  return serializeBlocker(updated);
}

export async function commentBlocker(user: AuthedUser, id: string, bodyRaw: unknown) {
  const body = String(bodyRaw ?? "").trim();
  if (!body) throw new HttpError(400, "Comment is required");
  const item = await prisma.blocker.findFirst({
    where: { id, raisedBy: { organizationId: user.organizationId } },
  });
  if (!item) throw new HttpError(404, "Blocker not found");
  await prisma.comment.create({ data: { authorId: user.id, body, blockerId: item.id } });
  if (item.raisedById !== user.id) {
    await notificationService.notify({
      userId: item.raisedById,
      kind: "task_comment",
      title: "Someone commented on your task",
      body: `${user.name} commented on “${item.title}”.`,
      actionUrl: "/team/blockers",
    });
  }
  const refreshed = await prisma.blocker.findUniqueOrThrow({ where: { id: item.id }, include: blockerInclude });
  return serializeBlocker(refreshed);
}

export async function listLeaves(user: AuthedUser) {
  const items = await prisma.leaveRequest.findMany({
    where: { user: { organizationId: user.organizationId } },
    include: { leaveType: true },
    orderBy: { requestedAt: "desc" },
  });
  return { data: items.map(serializeLeave) };
}

export async function leaveBalance(user: AuthedUser) {
  const types = await prisma.leaveType.findMany({ where: { organizationId: user.organizationId } });
  const yearStart = new Date(new Date().getUTCFullYear(), 0, 1);
  const approved = await prisma.leaveRequest.findMany({
    where: { userId: user.id, status: "APPROVED", from: { gte: yearStart } },
  });
  const usedByType = new Map<string, number>();
  for (const r of approved) {
    usedByType.set(r.leaveTypeId, (usedByType.get(r.leaveTypeId) ?? 0) + r.days);
  }
  return {
    data: types.map((t) => ({
      type: t.name,
      remaining: Math.max(0, t.daysPerYear - (usedByType.get(t.id) ?? 0)),
      total: t.daysPerYear,
    })),
  };
}

export async function createLeave(user: AuthedUser, body: Record<string, unknown>) {
  if (!body?.from || !body?.to || !body?.reason) throw new HttpError(400, "Incomplete leave request");
  const from = parseDate(String(body.from));
  const to = parseDate(String(body.to));
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
  const typeName = String(body?.type ?? "Casual");
  const leaveType =
    (await prisma.leaveType.findFirst({
      where: { organizationId: user.organizationId, name: { contains: typeName, mode: "insensitive" } },
    })) ??
    (await prisma.leaveType.findFirst({ where: { organizationId: user.organizationId } }));
  if (!leaveType) throw new HttpError(400, "No leave types configured");
  const created = await prisma.leaveRequest.create({
    data: {
      userId: user.id,
      leaveTypeId: leaveType.id,
      from,
      to,
      days,
      reason: String(body.reason),
    },
    include: { leaveType: true },
  });
  return serializeLeave(created);
}

export async function decideLeave(user: AuthedUser, id: string, statusRaw: unknown) {
  const item = await prisma.leaveRequest.findFirst({
    where: { id, user: { organizationId: user.organizationId } },
    include: { leaveType: true, user: true },
  });
  if (!item) throw new HttpError(404, "Leave request not found");
  const next = leaveStatusFromLabel[String(statusRaw)] ?? statusRaw;
  if (next === "APPROVED" || next === "REJECTED") {
    if (!MANAGER_ROLES.includes(user.role)) throw new HttpError(403, "Forbidden");
  } else if (item.userId !== user.id) {
    throw new HttpError(403, "Forbidden");
  }
  const updated = await prisma.leaveRequest.update({
    where: { id: item.id },
    data: { status: next as typeof item.status },
    include: { leaveType: true },
  });
  if (next === "APPROVED" || next === "REJECTED") {
    await notificationService.notify({
      userId: item.userId,
      kind: "leave",
      title: next === "APPROVED" ? "Leave approved" : "Leave rejected",
      body: `Your ${item.leaveType.name.toLowerCase()} request was ${next === "APPROVED" ? "approved" : "rejected"}.`,
      actionUrl: "/leave",
    });
  }
  return serializeLeave(updated);
}

export async function listNotifications(user: AuthedUser) {
  return notificationService.listNotifications(user);
}

export async function markNotification(user: AuthedUser, id: string, read: unknown) {
  const updated = await notificationService.markNotification(user, id, read);
  if (!updated) throw new HttpError(404, "Notification not found");
  return updated;
}

export async function markAllNotifications(user: AuthedUser) {
  return notificationService.markAllNotifications(user);
}

export async function listRecognitions(user: AuthedUser) {
  const items = await prisma.recognition.findMany({
    where: { from: { organizationId: user.organizationId } },
    include: { from: true, to: true },
    orderBy: { createdAt: "desc" },
  });
  return { data: items.map(serializeRecognition) };
}

export async function createRecognition(user: AuthedUser, body: Record<string, unknown>) {
  const toId = String(body?.toId ?? "");
  const badge = String(body?.badge ?? "").trim();
  const message = String(body?.message ?? "").trim();
  if (!toId || !badge || !message) throw new HttpError(400, "Recipient, badge and message are required");
  const created = await prisma.recognition.create({
    data: { fromId: user.id, toId, badge, message },
    include: { from: true, to: true },
  });
  await notificationService.notify({
    userId: toId,
    kind: "recognition",
    title: `${user.name} recognised you`,
    body: `${badge} — ${message}`,
    actionUrl: "/recognition",
  });
  return serializeRecognition(created);
}

export async function listIdeas(user: AuthedUser) {
  const items = await prisma.idea.findMany({
    where: { author: { organizationId: user.organizationId } },
    include: { author: true, _count: { select: { comments: true } } },
    orderBy: { createdAt: "desc" },
  });
  return { data: items.map(serializeIdea) };
}

export async function createIdea(user: AuthedUser, body: Record<string, unknown>) {
  const title = String(body?.title ?? "").trim();
  const description = String(body?.description ?? "").trim();
  if (!title || !description) throw new HttpError(400, "Title and description are required");
  const created = await prisma.idea.create({
    data: {
      authorId: user.id,
      title,
      description,
      category: String(body?.category ?? "Engineering"),
      votes: 1,
    },
    include: { author: true, _count: { select: { comments: true } } },
  });
  await prisma.ideaVote.create({ data: { ideaId: created.id, userId: user.id } });
  return serializeIdea(created);
}

export async function voteIdea(user: AuthedUser, id: string) {
  const idea = await prisma.idea.findFirst({
    where: { id, author: { organizationId: user.organizationId } },
  });
  if (!idea) throw new HttpError(404, "Idea not found");
  const existing = await prisma.ideaVote.findUnique({
    where: { ideaId_userId: { ideaId: idea.id, userId: user.id } },
  });
  if (existing) {
    await prisma.ideaVote.delete({ where: { id: existing.id } });
    await prisma.idea.update({ where: { id: idea.id }, data: { votes: { decrement: 1 } } });
  } else {
    await prisma.ideaVote.create({ data: { ideaId: idea.id, userId: user.id } });
    await prisma.idea.update({ where: { id: idea.id }, data: { votes: { increment: 1 } } });
  }
  const refreshed = await prisma.idea.findUniqueOrThrow({
    where: { id: idea.id },
    include: { author: true, _count: { select: { comments: true } } },
  });
  return serializeIdea(refreshed);
}

export async function updateIdea(user: AuthedUser, id: string, body: Record<string, unknown>) {
  if (!MANAGER_ROLES.includes(user.role)) throw new HttpError(403, "Forbidden");
  const idea = await prisma.idea.findFirst({
    where: { id, author: { organizationId: user.organizationId } },
  });
  if (!idea) throw new HttpError(404, "Idea not found");
  const status = typeof body?.status === "string" ? body.status : undefined;
  const updated = await prisma.idea.update({
    where: { id: idea.id },
    data: {
      ...(status ? { status: ideaStatusFromLabel[status] ?? status } : {}),
    },
    include: { author: true, _count: { select: { comments: true } } },
  });
  return serializeIdea(updated);
}
