import type { User as DbUser } from "@prisma/client";
import {
  BlockerStatus,
  IdeaStatus,
  LeaveRequestStatus,
  type Blocker,
  type Comment,
  type DailyJournal,
  type Goal,
  type Idea,
  type Integration,
  type LearningEntry,
  type LeaveRequest,
  type LeaveType,
  type Notification,
  type Recognition,
  type Task,
  type User,
} from "@prisma/client";
import { isoDate } from "./dates.js";

type UserWithRelations = User & {
  department: { name: string } | null;
  skills: { level: number; trend: string; skill: { name: string } }[];
  organization?: { id: string; name: string; plan: string; kind: string } | null;
};

export function publicUser(user: UserWithRelations) {
  const isPersonal = user.organization?.kind === "PERSONAL";
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    jobTitle: user.jobTitle ?? "",
    department: user.department?.name ?? "",
    ...(user.managerId ? { managerId: user.managerId } : {}),
    joinedAt: isoDate(user.joinedAt),
    avatarInitials: user.avatarInitials ?? initials(user.name),
    skills: user.skills.map((s) => ({
      name: s.skill.name,
      level: s.level,
      trend: (s.trend === "up" ? "up" : "flat") as "up" | "flat",
    })),
    isActive: user.isActive,
    workspaceMode: (isPersonal ? "personal" : "enterprise") as "personal" | "enterprise",
    organizationId: user.organizationId,
    organizationPlan: user.organization?.plan ?? "Free",
    ...(isPersonal ? {} : { organizationName: user.organization?.name }),
  };
}

export type PublicUser = ReturnType<typeof publicUser>;

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function serializeTask(task: Task & { project: { name: string } }) {
  return {
    id: task.id,
    title: task.title,
    ...(task.description ? { description: task.description } : {}),
    project: task.project.name,
    assigneeId: task.assigneeId,
    priority: task.priority,
    status: task.status,
    dueDate: isoDate(task.dueDate),
    estimateMins: task.estimateMins,
    tags: task.tags,
  };
}

export function serializeJournal(journal: DailyJournal) {
  return {
    id: journal.id,
    date: isoDate(journal.date),
    userId: journal.userId,
    completion: journal.completion,
    mood: (journal.mood ?? 3) as 1 | 2 | 3 | 4 | 5,
    ...(journal.focus ? { focus: journal.focus } : {}),
    completed: journal.completed,
    learned: journal.learned,
    blocked: journal.blocked,
    tomorrow: journal.tomorrow,
    ...(journal.managerNote ? { managerNote: journal.managerNote } : {}),
  };
}

export function serializeLearning(entry: LearningEntry) {
  return {
    id: entry.id,
    topic: entry.topic,
    description: entry.description,
    date: isoDate(entry.date),
    minutes: entry.minutes,
    confidence: entry.confidence,
    ...(entry.project ? { project: entry.project } : {}),
    tags: entry.tags,
  };
}

export function serializeGoal(goal: Goal & { milestones: { id: string; title: string; done: boolean }[] }) {
  return {
    id: goal.id,
    title: goal.title,
    type: goal.type as "Personal" | "Professional" | "Learning" | "Team",
    progress: goal.progress,
    targetDate: isoDate(goal.targetDate) || "2026-12-31",
    milestones: goal.milestones.map((m) => ({ id: m.id, title: m.title, done: m.done })),
    evidence: goal.evidence,
  };
}

const blockerStatus: Record<BlockerStatus, "Open" | "In Review" | "Resolved"> = {
  OPEN: "Open",
  IN_REVIEW: "In Review",
  RESOLVED: "Resolved",
};

export function serializeBlocker(
  blocker: Blocker & {
    raisedBy: { name: string };
    owner: { name: string } | null;
    comments: (Comment & { author: { name: string } })[];
  },
) {
  return {
    id: blocker.id,
    title: blocker.title,
    description: blocker.description,
    severity: blocker.severity as "Critical" | "High" | "Medium",
    affected: blocker.affected,
    ...(blocker.owner ? { owner: blocker.owner.name } : {}),
    raisedBy: blocker.raisedBy.name,
    raisedAt: isoDate(blocker.raisedAt),
    status: blockerStatus[blocker.status],
    comments: blocker.comments.map((c) => ({
      id: c.id,
      author: c.author.name,
      body: c.body,
      at: relativeTime(c.createdAt),
    })),
  };
}

const leaveStatus: Record<LeaveRequestStatus, "Pending" | "Approved" | "Rejected" | "Cancelled"> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

function shortLeaveType(name: string) {
  if (name.toLowerCase().includes("sick")) return "Sick";
  if (name.toLowerCase().includes("earned")) return "Earned";
  return "Casual";
}

export function serializeLeave(req: LeaveRequest & { leaveType: LeaveType }) {
  return {
    id: req.id,
    userId: req.userId,
    type: shortLeaveType(req.leaveType.name) as "Casual" | "Sick" | "Earned",
    from: isoDate(req.from),
    to: isoDate(req.to),
    days: req.days,
    reason: req.reason,
    status: leaveStatus[req.status],
    requestedAt: isoDate(req.requestedAt),
  };
}

export function serializeNotification(n: Notification) {
  return {
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    at: clockOrRelative(n.createdAt),
    createdAt: n.createdAt.toISOString(),
    read: n.read,
    actionUrl: n.actionUrl ?? null,
  };
}

const ideaStatus: Record<IdeaStatus, string> = {
  NEW: "New",
  UNDER_REVIEW: "Under Review",
  PLANNED: "Planned",
  IN_PROGRESS: "In Progress",
  IMPLEMENTED: "Implemented",
  REJECTED: "Rejected",
};

export function serializeIdea(idea: Idea & { author: { name: string }; _count: { comments: number } }) {
  return {
    id: idea.id,
    title: idea.title,
    description: idea.description,
    category: idea.category,
    status: ideaStatus[idea.status],
    votes: idea.votes,
    author: idea.author.name,
    comments: idea._count.comments,
  };
}

export function serializeRecognition(r: Recognition & { from: { name: string }; to: { name: string } }) {
  return {
    id: r.id,
    from: r.from.name,
    to: r.to.name,
    badge: r.badge,
    message: r.message,
    at: relativeTime(r.createdAt),
  };
}

export function serializeIntegration(i: Integration) {
  return {
    id: i.id,
    name: i.name,
    description: i.description,
    connected: i.connected,
    category: i.category,
  };
}

export function relativeTime(date: Date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24 && date.toDateString() === new Date().toDateString()) {
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return "Last week";
}

function clockOrRelative(date: Date) {
  if (date.toDateString() === new Date().toDateString()) {
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  return relativeTime(date);
}

export const ideaStatusFromLabel: Record<string, IdeaStatus> = {
  New: "NEW",
  "Under Review": "UNDER_REVIEW",
  Planned: "PLANNED",
  "In Progress": "IN_PROGRESS",
  Implemented: "IMPLEMENTED",
  Rejected: "REJECTED",
};

export const blockerStatusFromLabel: Record<string, BlockerStatus> = {
  Open: "OPEN",
  "In Review": "IN_REVIEW",
  Resolved: "RESOLVED",
};

export const leaveStatusFromLabel: Record<string, LeaveRequestStatus> = {
  Pending: "PENDING",
  Approved: "APPROVED",
  Rejected: "REJECTED",
  Cancelled: "CANCELLED",
};

export type AuthedUser = DbUser & {
  department: { name: string } | null;
  skills: { level: number; trend: string; skill: { name: string } }[];
};
