import { api, body, ApiError } from "@/lib/api";
import { getRequestUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncLeadReminders } from "@/lib/reminder-sync.mjs";

export async function POST(request: Request) {
  return api(request, async () => {
    await body(request);
    const user = await getRequestUser(request);
    if (!user) throw new ApiError("Sign in to continue.", 401);
    const reminders = await syncLeadReminders({
      userId: user.id,
      query: (sql: string, params: Array<string | null>) => prisma.$queryRawUnsafe(sql, ...params),
    });
    return { reminders };
  });
}
