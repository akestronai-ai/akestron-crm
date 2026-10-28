import { api, sameOrigin } from "@/lib/api";
import { clearSessionCookie, hashToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const response = await api(request, async () => {
    sameOrigin(request);
    const cookie = request.headers.get("cookie")?.match(/(?:^|;\s*)crm_session=([^;]+)/)?.[1];
    if (cookie) {
      let token: string | null = null;
      try { token = decodeURIComponent(cookie); } catch { /* Clear malformed cookie values without a database lookup. */ }
      if (token) await prisma.appSession.deleteMany({ where: { tokenHash: hashToken(token) } });
    }
    return {};
  }, { public: true });
  if (response.ok) response.headers.set("Set-Cookie", clearSessionCookie());
  return response;
}
