import { z } from "zod";

export const loginDto = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerDto = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  organization: z.string().min(2),
});

export const registerPersonalDto = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  jobTitle: z.string().optional(),
});

export const createEmployeeDto = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["EMPLOYEE", "MANAGER", "HR_ADMIN", "ORG_ADMIN"]).default("EMPLOYEE"),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  managerId: z.string().optional(),
  temporaryPassword: z.string().min(8).optional(),
});

export const forgotPasswordDto = z.object({
  email: z.string().email(),
});

export const resetPasswordDto = z.object({
  password: z.string().min(8),
  token: z.string().min(8),
});

export const createOrganizationDto = z.object({
  name: z.string().min(2),
});

export type LoginDto = z.infer<typeof loginDto>;
export type RegisterDto = z.infer<typeof registerDto>;
export type RegisterPersonalDto = z.infer<typeof registerPersonalDto>;
export type CreateEmployeeDto = z.infer<typeof createEmployeeDto>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordDto>;
export type ResetPasswordDto = z.infer<typeof resetPasswordDto>;
export type CreateOrganizationDto = z.infer<typeof createOrganizationDto>;
