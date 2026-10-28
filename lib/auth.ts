import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import { validatePassword, hashPassword, verifyPassword, DUMMY_HASH } from "@/lib/password.mjs";

export const SESSION_COOKIE = "crm_session";
const SESSION_DAYS = 7;
let activePasswordChecks = 0;
const MAX_ACTIVE_PASSWORD_CHECKS = 4;
export function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
export { validatePassword, hashPassword, verifyPassword };
export async function verifyUnknown(password: string) { await verifyPassword(DUMMY_HASH, password); }
export async function runPasswordCheck<T>(check: () => Promise<T>): Promise<T> {
  if (activePasswordChecks >= MAX_ACTIVE_PASSWORD_CHECKS) throw new ApiError("Sign-in is temporarily busy. Try again shortly.", 429);
  activePasswordChecks++;
  try { return await check(); } finally { activePasswordChecks--; }
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await prisma.appSession.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  return { token, expiresAt };
}

export async function reserveLoginAttempt(email: string) {
  const global = await prisma.$queryRawUnsafe<{ count: number }[]>(
    `INSERT INTO auth_attempts(email, count, "windowStartedAt") VALUES ('__global__', 1, now())
     ON CONFLICT (email) DO UPDATE SET
       count = CASE WHEN auth_attempts."windowStartedAt" < now() - interval '15 minutes' THEN 1 ELSE auth_attempts.count + 1 END,
       "windowStartedAt" = CASE WHEN auth_attempts."windowStartedAt" < now() - interval '15 minutes' THEN now() ELSE auth_attempts."windowStartedAt" END
     RETURNING count`);
  if (Number(global[0]?.count) > 60) throw new ApiError("Sign-in is temporarily busy. Try again in 15 minutes.", 429);
  await prisma.$executeRaw`DELETE FROM auth_attempts WHERE email <> '__global__' AND "windowStartedAt" < now() - interval '1 day'`;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) throw new ApiError("Email or password is incorrect.", 401);
  const result = await prisma.$queryRawUnsafe<{ count: number }[]>(
    `INSERT INTO auth_attempts(email, count, "windowStartedAt") VALUES ($1, 1, now())
     ON CONFLICT (email) DO UPDATE SET
       count = CASE WHEN auth_attempts."windowStartedAt" < now() - interval '15 minutes' THEN 1 ELSE auth_attempts.count + 1 END,
       "windowStartedAt" = CASE WHEN auth_attempts."windowStartedAt" < now() - interval '15 minutes' THEN now() ELSE auth_attempts."windowStartedAt" END
     RETURNING count`, email);
  if (Number(result[0]?.count) > 10) throw new ApiError("Too many sign-in attempts. Try again in 15 minutes.", 429);
}

export async function getRequestUser(request?: Request) {
  const header = request?.headers.get("cookie") ?? (await cookies()).toString();
  const match = header.match(/(?:^|;\s*)crm_session=([^;]+)/);
  if (!match) return null;
  let token: string;
  try { token = decodeURIComponent(match[1]); } catch { return null; }
  if (token.length > 100) return null;
  const session = await prisma.appSession.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: { select: { id: true, email: true, name: true } } } });
  if (!session || session.expiresAt <= new Date()) return null;
  return session.user;
}

export function sessionCookie(token: string, expiresAt: Date) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
