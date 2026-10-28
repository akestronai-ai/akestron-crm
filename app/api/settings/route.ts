import { api, body, ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

function schedule(startDate: string) {
  const today = new Date().toISOString().slice(0, 10);
  const currentDay = Math.max(1, Math.floor((Date.parse(today) - Date.parse(startDate)) / 86400000) + 1);
  return { startDate, currentDay, today };
}
export async function GET(request: Request) {
  return api(request, async () => {
    const settings = await prisma.warmupSettings.findUniqueOrThrow({ where: { id: "default" } });
    return schedule(settings.startDate);
  });
}
export async function POST(request: Request) {
  return api(request, async () => {
    const input = await body(request);
    const startDate = input.startDate ?? new Date().toISOString().slice(0, 10);
    if (typeof startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isFinite(Date.parse(startDate)) || new Date(startDate).toISOString().slice(0, 10) !== startDate) throw new ApiError("Enter a valid date (YYYY-MM-DD).");
    await prisma.warmupSettings.upsert({ where: { id: "default" }, create: { id: "default", startDate }, update: { startDate } });
    return schedule(startDate);
  });
}
