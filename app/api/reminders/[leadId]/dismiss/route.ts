import { api, body, id, ApiError } from "@/lib/api";
import { getRequestUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dismissLeadReminder } from "@/lib/reminder-sync.mjs";

type Context = { params: Promise<{ leadId: string }> };

export async function POST(request: Request, { params }: Context) {
  return api(request, async () => {
    const input = await body(request);
    const user = await getRequestUser(request);
    if (!user) throw new ApiError("Sign in to continue.", 401);
    const leadId = id((await params).leadId, "Lead");
    const episode = parseTimestamp(input.episode, "Reminder episode");
    const lastRemindedAt = parseTimestamp(input.lastRemindedAt, "Reminder time");
    const dismissed = await dismissLeadReminder({
      userId: user.id,
      leadId,
      stageEnteredAt: episode,
      lastRemindedAt,
      query: (sql: string, values: Array<string | null>) => prisma.$queryRawUnsafe(sql, ...values),
    });
    return { dismissed: dismissed.length > 0 };
  });
}

function parseTimestamp(value: unknown, field: string) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) throw new ApiError(`Invalid ${field.toLowerCase()}.`);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) throw new ApiError(`Invalid ${field.toLowerCase()}.`);
  return date;
}
