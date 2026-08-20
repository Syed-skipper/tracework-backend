import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { env } from "../config/env.config.js";
import {
  BCRYPT_ROUNDS,
  DEFAULT_DEPARTMENTS,
  DEFAULT_LEAVE_TYPES,
  RESET_TOKEN_TTL_MS,
} from "../constants/defaultValues.js";
import {
  loginDto,
  registerDto,
  registerPersonalDto,
  resetPasswordDto,
  type LoginDto,
  type RegisterDto,
} from "../dtos/auth.dto.js";
import { HttpError } from "../exceptions/http.exception.js";
import { prisma } from "../utils/prisma.js";
import { initials, publicUser } from "../utils/serialize.js";
import { signToken } from "../utils/jwt.js";

const userPublicInclude = {
  department: true,
  skills: { include: { skill: true } },
  organization: true,
} as const;

export async function login(input: unknown) {
  const body = loginDto.safeParse(input);
  if (!body.success) throw new HttpError(400, "Email and password are required");
  return loginWith(body.data);
}

async function loginWith(data: LoginDto) {
  const user = await prisma.user.findFirst({
    where: { email: data.email.toLowerCase() },
    include: userPublicInclude,
  });
  if (!user || !user.isActive) throw new HttpError(401, "Invalid credentials");
  const ok = await bcrypt.compare(data.password, user.passwordHash);
  if (!ok) throw new HttpError(401, "Invalid credentials");
  return { token: signToken(user.id), user: publicUser(user) };
}

/** Personal Mode: no company name — private workspace (org kind PERSONAL, never shown as a company). */
export async function registerPersonal(input: unknown) {
  const body = registerPersonalDto.safeParse(input);
  if (!body.success) throw new HttpError(400, "Name, email and password are required");

  const email = body.data.email.toLowerCase();
  const existingUser = await prisma.user.findFirst({ where: { email } });
  if (existingUser) throw new HttpError(409, "An account with that email already exists");

  const org = await prisma.organization.create({
    data: {
      name: `personal_${randomBytes(10).toString("hex")}`,
      plan: "Personal",
      kind: "PERSONAL",
    },
  });

  await prisma.project.create({
    data: { organizationId: org.id, name: "Personal" },
  });

  const passwordHash = await bcrypt.hash(body.data.password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email,
      passwordHash,
      name: body.data.name.trim(),
      role: "EMPLOYEE",
      jobTitle: body.data.jobTitle?.trim() || null,
      avatarInitials: initials(body.data.name.trim()),
    },
    include: userPublicInclude,
  });

  return { token: signToken(user.id), user: publicUser(user) };
}

/** Zoho-style: public signup creates a new organization + its admin only. Employees are added by admin. */
export async function registerOrganization(input: unknown) {
  const body = registerDto.safeParse(input);
  if (!body.success) throw new HttpError(400, "Name, email, password and organization are required");
  return registerOrgWith(body.data);
}

async function registerOrgWith(data: RegisterDto) {
  const email = data.email.toLowerCase();
  const existingUser = await prisma.user.findFirst({ where: { email } });
  if (existingUser) throw new HttpError(409, "An account with that email already exists");

  const existingOrg = await prisma.organization.findFirst({
    where: { name: data.organization, kind: "ENTERPRISE" },
  });
  if (existingOrg) {
    throw new HttpError(
      409,
      "This organization already exists. Ask your admin to create your employee account, then sign in.",
    );
  }

  const org = await prisma.organization.create({
    data: { name: data.organization, plan: "Free", kind: "ENTERPRISE" },
  });

  for (const name of DEFAULT_DEPARTMENTS) {
    await prisma.department.upsert({
      where: { organizationId_name: { organizationId: org.id, name } },
      update: {},
      create: { organizationId: org.id, name },
    });
  }
  for (const lt of DEFAULT_LEAVE_TYPES) {
    await prisma.leaveType.upsert({
      where: { organizationId_name: { organizationId: org.id, name: lt.name } },
      update: {},
      create: { organizationId: org.id, ...lt },
    });
  }

  await prisma.project.create({
    data: { organizationId: org.id, name: "Personal" },
  });

  await prisma.organizationWorkUpdatePolicy.create({
    data: { organizationId: org.id, enabled: true, requireDaily: false },
  });

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email,
      passwordHash,
      name: data.name,
      role: "ORG_ADMIN",
      jobTitle: "Organization Admin",
      avatarInitials: initials(data.name),
    },
    include: userPublicInclude,
  });
  return { token: signToken(user.id), user: publicUser(user) };
}

export const register = registerOrganization;

export async function forgotPassword(emailRaw: unknown) {
  const email = typeof emailRaw === "string" ? emailRaw.toLowerCase() : "";
  if (!email) throw new HttpError(400, "Email is required");
  const user = await prisma.user.findFirst({ where: { email } });
  let resetToken: string | undefined;
  if (user) {
    resetToken = randomBytes(24).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: resetToken,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });
  }
  return {
    ok: true,
    message: "If an account exists, a reset link is on its way.",
    ...(env.isDev && resetToken ? { resetToken } : {}),
  };
}

export async function resetPassword(input: unknown) {
  const body = resetPasswordDto.safeParse(input);
  if (!body.success) throw new HttpError(400, "Password must be at least 8 characters");
  const row = await prisma.passwordResetToken.findUnique({ where: { token: body.data.token } });
  if (!row || row.usedAt || row.expiresAt < new Date()) throw new HttpError(400, "Reset link is invalid or expired");
  const passwordHash = await bcrypt.hash(body.data.password, BCRYPT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ]);
  return { ok: true };
}
