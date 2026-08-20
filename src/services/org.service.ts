import { ADMIN_ROLES } from "../constants/defaultValues.js";
import { HttpError } from "../exceptions/http.exception.js";
import type { AuthedUser } from "../interface/auth.interface.js";
import { prisma } from "../utils/prisma.js";
import { serializeIntegration } from "../utils/serialize.js";

export async function getOrganization(user: AuthedUser) {
  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    include: { departments: { orderBy: { name: "asc" } }, _count: { select: { users: true } } },
  });
  if (!org) throw new HttpError(404, "Organization not found");
  return {
    id: org.id,
    name: org.kind === "PERSONAL" ? "Personal workspace" : org.name,
    plan: org.plan,
    kind: org.kind,
    workspaceMode: org.kind === "PERSONAL" ? "personal" : "enterprise",
    employees: org._count.users,
    departments: org.kind === "PERSONAL" ? [] : org.departments.map((d) => d.name),
  };
}

export async function listDepartments(user: AuthedUser) {
  const departments = await prisma.department.findMany({
    where: { organizationId: user.organizationId },
    include: { manager: true, _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });
  return {
    data: departments.map((d) => ({
      id: d.id,
      name: d.name,
      employees: d._count.users,
      manager: d.manager?.name ?? null,
    })),
  };
}

export async function createDepartment(user: AuthedUser, nameRaw: unknown) {
  if (!ADMIN_ROLES.includes(user.role)) throw new HttpError(403, "Forbidden");
  const name = String(nameRaw ?? "").trim();
  if (!name) throw new HttpError(400, "Department name is required");
  const dept = await prisma.department.create({
    data: { organizationId: user.organizationId, name },
    include: { _count: { select: { users: true } } },
  });
  return { id: dept.id, name: dept.name, employees: dept._count.users, manager: null };
}

export async function listProjects(user: AuthedUser) {
  const projects = await prisma.project.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { name: "asc" },
  });
  return { data: projects.map((p) => ({ id: p.id, name: p.name })) };
}

export async function listIntegrations(user: AuthedUser) {
  const items = await prisma.integration.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { name: "asc" },
  });
  return { data: items.map(serializeIntegration) };
}

export async function toggleIntegration(user: AuthedUser, id: string, connected: unknown) {
  const item = await prisma.integration.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!item) throw new HttpError(404, "Integration not found");
  const updated = await prisma.integration.update({
    where: { id: item.id },
    data: { connected: Boolean(connected) },
  });
  return serializeIntegration(updated);
}

export async function listLeaveTypes(user: AuthedUser) {
  const types = await prisma.leaveType.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { name: "asc" },
  });
  return {
    data: types.map((t) => ({
      id: t.id,
      name: t.name,
      days: t.daysPerYear,
      accrual: t.accrual,
      carry: t.carry,
    })),
  };
}

export async function updateLeaveType(user: AuthedUser, id: string, body: Record<string, unknown>) {
  if (!ADMIN_ROLES.includes(user.role)) throw new HttpError(403, "Forbidden");
  const type = await prisma.leaveType.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!type) throw new HttpError(404, "Leave type not found");
  const updated = await prisma.leaveType.update({
    where: { id: type.id },
    data: {
      daysPerYear: Number(body?.days ?? type.daysPerYear),
      ...(body?.accrual ? { accrual: String(body.accrual) } : {}),
      ...(body?.carry ? { carry: String(body.carry) } : {}),
    },
  });
  return { id: updated.id, name: updated.name, days: updated.daysPerYear, accrual: updated.accrual, carry: updated.carry };
}
