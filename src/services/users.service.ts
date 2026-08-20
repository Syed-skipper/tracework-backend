import type { Role } from "@prisma/client";
import type { Request } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { ADMIN_ROLES, BCRYPT_ROUNDS, MANAGER_ROLES } from "../constants/defaultValues.js";
import { createEmployeeDto } from "../dtos/auth.dto.js";
import { HttpError } from "../exceptions/http.exception.js";
import type { AuthedUser } from "../interface/auth.interface.js";
import { addDays, isoDate, startOfDay } from "../utils/dates.js";
import { paginated, parsePage } from "../utils/pagination.js";
import { prisma } from "../utils/prisma.js";
import {
  initials,
  publicUser,
  serializeGoal,
  serializeLearning,
  serializeLeave,
  serializeRecognition,
} from "../utils/serialize.js";

export function getMe(user: AuthedUser) {
  return publicUser(user);
}

export async function updateMe(user: AuthedUser, body: { name?: string; jobTitle?: string }) {
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const jobTitle = typeof body?.jobTitle === "string" ? body.jobTitle.trim() : undefined;
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(name ? { name, avatarInitials: name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() } : {}),
      ...(jobTitle !== undefined ? { jobTitle } : {}),
    },
    include: { department: true, skills: { include: { skill: true } }, organization: true },
  });
  return publicUser(updated);
}

export async function listUsers(user: AuthedUser, query: Request["query"]) {
  const { page, limit } = parsePage(query);
  const q = String(query.q ?? "").toLowerCase();
  const role = query.role as Role | undefined;
  const people = await prisma.user.findMany({
    where: {
      organizationId: user.organizationId,
      ...(role ? { role } : {}),
    },
    include: { department: true, skills: { include: { skill: true } }, organization: true },
    orderBy: { name: "asc" },
  });
  let items = people.map(publicUser);
  if (q) items = items.filter((u) => `${u.name} ${u.email} ${u.jobTitle}`.toLowerCase().includes(q));
  return paginated(items, page, limit);
}

export async function getUser(current: AuthedUser, id: string) {
  const found = await prisma.user.findFirst({
    where: { id, organizationId: current.organizationId },
    include: { department: true, skills: { include: { skill: true } }, organization: true },
  });
  if (!found) throw new HttpError(404, "User not found");
  return publicUser(found);
}

/** HR / org-admin employee 360 — summaries only; journals stay private. */
export async function getHrOverview(current: AuthedUser, employeeId: string) {
  if (!ADMIN_ROLES.includes(current.role)) {
    throw new HttpError(403, "Only HR and organization admins can open employee 360");
  }

  const employee = await prisma.user.findFirst({
    where: { id: employeeId, organizationId: current.organizationId },
    include: { department: true, skills: { include: { skill: true } }, organization: true },
  });
  if (!employee) throw new HttpError(404, "User not found");

  const today = startOfDay();
  const weekAgo = addDays(today, -7);
  const monthAgo = addDays(today, -30);
  const yearStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));

  const [leaveTypes, leaveRequests, approvedLeaves, learnings, goals, recognitions, tasks, achievements, learningLast30] =
    await Promise.all([
      prisma.leaveType.findMany({ where: { organizationId: current.organizationId } }),
      prisma.leaveRequest.findMany({
        where: { userId: employee.id },
        include: { leaveType: true },
        orderBy: { requestedAt: "desc" },
        take: 20,
      }),
      prisma.leaveRequest.findMany({
        where: { userId: employee.id, status: "APPROVED", from: { gte: yearStart } },
      }),
      prisma.learningEntry.findMany({
        where: { userId: employee.id },
        orderBy: { date: "desc" },
        take: 12,
      }),
      prisma.goal.findMany({
        where: { userId: employee.id },
        include: { milestones: { orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.recognition.findMany({
        where: { toId: employee.id },
        include: { from: true, to: true },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
      prisma.task.findMany({
        where: { assigneeId: employee.id },
        include: { project: true },
        orderBy: { updatedAt: "desc" },
        take: 40,
      }),
      prisma.achievement.findMany({
        where: { userId: employee.id },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.learningEntry.aggregate({
        where: { userId: employee.id, date: { gte: monthAgo } },
        _sum: { minutes: true },
        _count: true,
      }),
    ]);

  const usedByType = new Map<string, number>();
  for (const r of approvedLeaves) {
    usedByType.set(r.leaveTypeId, (usedByType.get(r.leaveTypeId) ?? 0) + r.days);
  }

  const open = tasks.filter((t) => t.status === "TODO" || t.status === "BLOCKED").length;
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const doneThisWeek = tasks.filter((t) => t.status === "DONE" && t.updatedAt >= weekAgo).length;

  return {
    user: publicUser(employee),
    leave: {
      balance: leaveTypes.map((t) => ({
        type: t.name,
        remaining: Math.max(0, t.daysPerYear - (usedByType.get(t.id) ?? 0)),
        total: t.daysPerYear,
      })),
      requests: leaveRequests.map(serializeLeave),
    },
    learning: {
      sessionsLast30Days: learningLast30._count,
      minutesLast30Days: learningLast30._sum.minutes ?? 0,
      recent: learnings.map(serializeLearning),
    },
    goals: goals.map(serializeGoal),
    recognition: recognitions.map(serializeRecognition),
    achievements: achievements.map((a) => ({
      id: a.id,
      title: a.title,
      detail: a.detail,
      at: a.at,
    })),
    tasks: {
      open,
      inProgress,
      doneThisWeek,
      recent: tasks.slice(0, 10).map((t) => ({
        id: t.id,
        title: t.title,
        project: t.project.name,
        status: t.status,
        dueDate: isoDate(t.dueDate),
      })),
    },
    privacyNote: "Daily journals and mood stay private. This view is for people-ops summaries only.",
  };
}

/** Zoho-style: only org/HR admins can create employee accounts inside the company. */
export async function createEmployee(current: AuthedUser, input: unknown) {
  if (!ADMIN_ROLES.includes(current.role)) {
    throw new HttpError(403, "Only organization admins can create employees");
  }

  const body = createEmployeeDto.safeParse(input);
  if (!body.success) throw new HttpError(400, "Name and work email are required");

  const email = body.data.email.toLowerCase();
  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) throw new HttpError(409, "An account with that email already exists");

  let departmentId: string | undefined;
  if (body.data.department?.trim()) {
    const dept = await prisma.department.upsert({
      where: {
        organizationId_name: {
          organizationId: current.organizationId,
          name: body.data.department.trim(),
        },
      },
      update: {},
      create: { organizationId: current.organizationId, name: body.data.department.trim() },
    });
    departmentId = dept.id;
  }

  if (body.data.managerId) {
    const manager = await prisma.user.findFirst({
      where: { id: body.data.managerId, organizationId: current.organizationId, isActive: true },
    });
    if (!manager) throw new HttpError(400, "Manager not found in your organization");
  }

  const temporaryPassword =
    body.data.temporaryPassword?.trim() || `Wp-${randomBytes(4).toString("hex")}`;
  const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      organizationId: current.organizationId,
      email,
      passwordHash,
      name: body.data.name.trim(),
      role: body.data.role,
      jobTitle: body.data.jobTitle?.trim() || null,
      departmentId: departmentId ?? null,
      managerId: body.data.managerId || null,
      avatarInitials: initials(body.data.name.trim()),
    },
    include: { department: true, skills: { include: { skill: true } }, organization: true },
  });

  return {
    user: publicUser(user),
    temporaryPassword,
    message: "Employee created. Share the temporary password so they can sign in.",
  };
}

export async function updateUser(current: AuthedUser, id: string, body: Record<string, unknown>) {
  if (!ADMIN_ROLES.includes(current.role) && !MANAGER_ROLES.includes(current.role) && current.id !== id) {
    throw new HttpError(403, "Forbidden");
  }
  const found = await prisma.user.findFirst({
    where: { id, organizationId: current.organizationId },
  });
  if (!found) throw new HttpError(404, "User not found");
  const data: {
    isActive?: boolean;
    role?: Role;
    jobTitle?: string;
    managerId?: string | null;
    departmentId?: string | null;
  } = {};
  if (typeof body?.isActive === "boolean") {
    if (!ADMIN_ROLES.includes(current.role)) throw new HttpError(403, "Forbidden");
    data.isActive = body.isActive;
  }
  if (body?.role) {
    if (!ADMIN_ROLES.includes(current.role)) throw new HttpError(403, "Only admins can change roles");
    data.role = body.role as Role;
  }
  if (body?.jobTitle !== undefined) data.jobTitle = String(body.jobTitle);
  if (body?.managerId !== undefined) {
    if (!ADMIN_ROLES.includes(current.role) && !MANAGER_ROLES.includes(current.role)) {
      throw new HttpError(403, "Forbidden");
    }
    data.managerId = body.managerId ? String(body.managerId) : null;
  }
  if (typeof body?.department === "string" && body.department.trim()) {
    if (!ADMIN_ROLES.includes(current.role)) throw new HttpError(403, "Forbidden");
    const dept = await prisma.department.upsert({
      where: {
        organizationId_name: { organizationId: current.organizationId, name: body.department.trim() },
      },
      update: {},
      create: { organizationId: current.organizationId, name: body.department.trim() },
    });
    data.departmentId = dept.id;
  }
  const updated = await prisma.user.update({
    where: { id: found.id },
    data,
    include: { department: true, skills: { include: { skill: true } }, organization: true },
  });
  return publicUser(updated);
}

export async function listSkills(user: AuthedUser) {
  const skills = await prisma.userSkill.findMany({
    where: { userId: user.id },
    include: { skill: true },
    orderBy: { level: "desc" },
  });
  return {
    data: skills.map((s) => ({ name: s.skill.name, level: s.level, trend: s.trend === "up" ? "up" : "flat" })),
  };
}

export async function addSkill(user: AuthedUser, body: { name?: string; level?: number }) {
  const name = String(body?.name ?? "").trim();
  if (!name) throw new HttpError(400, "Skill name is required");
  const skill = await prisma.skill.upsert({ where: { name }, update: {}, create: { name } });
  const row = await prisma.userSkill.upsert({
    where: { userId_skillId: { userId: user.id, skillId: skill.id } },
    update: { level: Number(body?.level ?? 20), trend: "up" },
    create: { userId: user.id, skillId: skill.id, level: Number(body?.level ?? 20), trend: "up" },
    include: { skill: true },
  });
  return { name: row.skill.name, level: row.level, trend: row.trend };
}
