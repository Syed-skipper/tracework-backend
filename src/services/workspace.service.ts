import { DEFAULT_DEPARTMENTS, DEFAULT_LEAVE_TYPES } from "../constants/defaultValues.js";
import { createOrganizationDto } from "../dtos/auth.dto.js";
import { HttpError } from "../exceptions/http.exception.js";
import type { AuthedUser } from "../interface/auth.interface.js";
import { prisma } from "../utils/prisma.js";
import { publicUser } from "../utils/serialize.js";

const userPublicInclude = {
  department: true,
  skills: { include: { skill: true } },
  organization: true,
} as const;

/**
 * Upgrade a Personal workspace into an Enterprise organization.
 * Journals/tasks stay on the same user; private notes remain private by design.
 */
export async function createOrganizationFromPersonal(user: AuthedUser, input: unknown) {
  if (user.organization.kind !== "PERSONAL") {
    throw new HttpError(400, "You already belong to a company workspace");
  }

  const body = createOrganizationDto.safeParse(input);
  if (!body.success) throw new HttpError(400, "Organization name is required");

  const name = body.data.name.trim();
  const clash = await prisma.organization.findFirst({
    where: { name, kind: "ENTERPRISE" },
  });
  if (clash) throw new HttpError(409, "An organization with that name already exists");

  await prisma.organization.update({
    where: { id: user.organizationId },
    data: { name, plan: "Free", kind: "ENTERPRISE" },
  });

  await prisma.organizationWorkUpdatePolicy.upsert({
    where: { organizationId: user.organizationId },
    create: { organizationId: user.organizationId, enabled: true, requireDaily: false },
    update: { enabled: true },
  });

  for (const dept of DEFAULT_DEPARTMENTS) {
    await prisma.department.upsert({
      where: { organizationId_name: { organizationId: user.organizationId, name: dept } },
      update: {},
      create: { organizationId: user.organizationId, name: dept },
    });
  }
  for (const lt of DEFAULT_LEAVE_TYPES) {
    await prisma.leaveType.upsert({
      where: { organizationId_name: { organizationId: user.organizationId, name: lt.name } },
      update: {},
      create: { organizationId: user.organizationId, ...lt },
    });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: "ORG_ADMIN", jobTitle: user.jobTitle || "Organization Admin" },
    include: userPublicInclude,
  });

  return {
    user: publicUser(updated),
    message: "Organization created. You are the admin. Add employees from Admin → Employees.",
  };
}
