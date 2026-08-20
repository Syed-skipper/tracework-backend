import { env } from "../config/env.config.js";
import {
  DEFAULT_NOTIFICATION_PREFS,
  KIND_PREFERENCE,
  type NotificationKind,
  type PreferenceKey,
} from "../constants/notifications.js";
import type { AuthedUser } from "../interface/auth.interface.js";
import { prisma } from "../utils/prisma.js";
import { serializeNotification } from "../utils/serialize.js";
import { sendEmail } from "./email.service.js";

export async function getOrCreatePrefs(userId: string) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...DEFAULT_NOTIFICATION_PREFS },
    update: {},
  });
}

export function serializePrefs(p: Awaited<ReturnType<typeof getOrCreatePrefs>>) {
  return {
    dailyUpdateReminders: p.dailyUpdateReminders,
    taskAssignments: p.taskAssignments,
    taskDueReminders: p.taskDueReminders,
    managerRequests: p.managerRequests,
    weeklySummary: p.weeklySummary,
    channelInApp: p.channelInApp,
    channelEmail: p.channelEmail,
  };
}

export async function updatePrefs(user: AuthedUser, body: Record<string, unknown>) {
  const current = await getOrCreatePrefs(user.id);
  const bool = (key: string, fallback: boolean) =>
    typeof body[key] === "boolean" ? (body[key] as boolean) : fallback;
  const updated = await prisma.notificationPreference.update({
    where: { userId: user.id },
    data: {
      dailyUpdateReminders: bool("dailyUpdateReminders", current.dailyUpdateReminders),
      taskAssignments: bool("taskAssignments", current.taskAssignments),
      taskDueReminders: bool("taskDueReminders", current.taskDueReminders),
      managerRequests: bool("managerRequests", current.managerRequests),
      weeklySummary: bool("weeklySummary", current.weeklySummary),
      channelInApp: bool("channelInApp", current.channelInApp),
      channelEmail: bool("channelEmail", current.channelEmail),
    },
  });
  return serializePrefs(updated);
}

export interface NotifyInput {
  userId: string;
  kind: NotificationKind | string;
  title: string;
  body: string;
  actionUrl?: string;
  email?: { subject: string; body: string };
  /** Required reminders ignore opt-out except channel still respected for email vs in-app org policy. */
  required?: boolean;
  forceEmail?: boolean;
  forceInApp?: boolean;
}

export async function notify(input: NotifyInput) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    include: { notificationPreference: true, organization: true },
  });
  if (!user || !user.isActive) return null;

  const prefs = user.notificationPreference ?? DEFAULT_NOTIFICATION_PREFS;
  const prefKey = KIND_PREFERENCE[input.kind as NotificationKind] as PreferenceKey | undefined;
  const typeEnabled = !prefKey || prefs[prefKey] !== false || input.required;

  if (!typeEnabled) return null;

  const inApp = input.forceInApp || prefs.channelInApp;
  const emailOn = input.forceEmail || prefs.channelEmail;

  let created = null;
  if (inApp) {
    created = await prisma.notification.create({
      data: {
        userId: user.id,
        kind: input.kind,
        title: input.title,
        body: input.body,
        actionUrl: input.actionUrl ?? null,
      },
    });
  }

  if (emailOn && input.email) {
    await sendEmail({
      to: user.email,
      toUserId: user.id,
      organizationId: user.organizationId,
      subject: input.email.subject,
      body: input.email.body,
    });
  }

  return created;
}

export async function listNotifications(user: AuthedUser) {
  const items = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  return { data: items.map(serializeNotification) };
}

export async function markNotification(user: AuthedUser, id: string, read: unknown) {
  const item = await prisma.notification.findFirst({ where: { id, userId: user.id } });
  if (!item) return null;
  const updated = await prisma.notification.update({
    where: { id: item.id },
    data: { read: Boolean(read ?? true) },
  });
  return serializeNotification(updated);
}

export async function markAllNotifications(user: AuthedUser) {
  await prisma.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
  return { ok: true };
}

export function appLink(path: string) {
  return `${env.appUrl}${path}`;
}
