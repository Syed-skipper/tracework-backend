import "dotenv/config";

function required(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:8080,http://localhost:5173";

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production",
  isDev: process.env.NODE_ENV !== "production",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/workpulse?schema=public"),
  jwtSecret: required("JWT_SECRET", "dev-secret-change-me"),
  /** 32-byte key material for encrypting BYOK API keys (hex or any string; hashed to 32 bytes). */
  aiEncryptionKey: process.env.AI_ENCRYPTION_KEY ?? process.env.JWT_SECRET ?? "dev-secret-change-me",
  frontendOrigins: frontendOrigin
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean),
  openRouterBaseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  appUrl: process.env.APP_URL ?? "http://localhost:8080",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "Tracework <noreply@tracework.local>",
};
