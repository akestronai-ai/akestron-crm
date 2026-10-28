import { api, body, ApiError } from "@/lib/api";
import { randomBytes } from "node:crypto";
import { hashToken, reserveLoginAttempt, runPasswordCheck, sessionCookie, validatePassword, verifyPassword, verifyUnknown } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  let cookie: string | null = null;
  const response = await api(request, async () => {
    const input = await body(request);
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    const password = input.password;
    if (!email || email.length > 320 || typeof password !== "string" || !validatePassword(password)) throw new ApiError("Email or password is incorrect.", 401);
    await reserveLoginAttempt(email);
    const user = await prisma.appUser.findUnique({ where: { email } });
    if (!user) { await runPasswordCheck(() => verifyUnknown(password)); throw new ApiError("Email or password is incorrect.", 401); }
    if (!(await runPasswordCheck(() => verifyPassword(user.passwordHash, password)))) throw new ApiError("Email or password is incorrect.", 401);
    const session = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM app_users WHERE id = ${user.id}::uuid FOR UPDATE`;
      const current = await tx.appUser.findUnique({ where: { id: user.id } });
      if (!current || current.passwordHash !== user.passwordHash) throw new ApiError("Email or password is incorrect.", 401);
      const raw = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + 7 * 86400000);
      await tx.appSession.create({ data: { userId: user.id, tokenHash: hashToken(raw), expiresAt } });
      return { token: raw, expiresAt };
    });
    cookie = sessionCookie(session.token, session.expiresAt);
    return { user: { id: user.id, name: user.name, email: user.email } };
  }, { public: true });
  if (response.ok && cookie) response.headers.set("Set-Cookie", cookie);
  return response;
}
