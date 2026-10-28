import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getRequestUser } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { expectedOrigin } from "@/lib/request-origin.mjs";
export { ApiError } from "@/lib/errors";

export async function api(request: Request, run: () => Promise<Record<string, unknown>>, options: { public?: boolean } = {}) {
  try {
    if (!process.env.DATABASE_URL) throw new ApiError("Set DATABASE_URL and run npm run db:migrate before using the app.", 503);
    if (!options.public && !(await getRequestUser(request))) throw new ApiError("Sign in to continue.", 401);
    return NextResponse.json({ success: true, ...await run() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    let status = 500;
    let message = "Could not load or save your data. Check the PostgreSQL connection and try again.";
    let extra: Record<string, unknown> = {};
    if (error instanceof ApiError) { status = error.status; message = error.message; extra = { ...(error.code ? { code: error.code } : {}), ...(error.details ?? {}) }; }
    else if (error instanceof SyntaxError) { status = 400; message = "Invalid JSON request."; }
    else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") { status = 404; message = "Record not found."; }
      else if (["P2002", "P2003", "P2004", "P2023"].includes(error.code)) { status = 400; message = "Invalid data or record relationship."; }
      else if (["P2021", "P2022"].includes(error.code)) { status = 503; message = "Database setup is required. Run npm run db:migrate."; }
      else if (error.code === "P2034") { status = 409; message = "Another change was saved at the same time. Please retry."; }
    }
    // Do not log connection errors: they can contain database connection details.
    return NextResponse.json({ success: false, error: message, ...extra }, { status, headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": "900" } : {}) } });
  }
}

export function text(value: unknown, field: string, max = 500) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new ApiError(`${field} is required and must be under ${max} characters.`);
  return value.trim();
}

export function id(value: unknown, field = "Record") {
  const result = text(value, field);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result)) throw new ApiError(`Invalid ${field.toLowerCase()} ID.`);
  return result;
}

export async function body(request: Request): Promise<Record<string, unknown>> {
  sameOrigin(request);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new ApiError("Send JSON content.", 415);
  const value = await request.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError("Expected a JSON object.");
  return value;
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  let expected: string;
  try { expected = expectedOrigin(request.url, request.headers.get("host")); }
  catch { throw new ApiError("Invalid request origin.", 403); }
  if (!origin || origin !== expected) throw new ApiError("Invalid request origin.", 403);
}

export type IdContext = { params: Promise<{ id: string }> };
export const leadInclude = { stage: true, activities: { orderBy: { createdAt: "desc" as const } } };
export const pipelineInclude = { stages: { orderBy: [{ order: "asc" as const }, { id: "asc" as const }], include: { leads: { include: { activities: { orderBy: { createdAt: "desc" as const } } } } } } };
