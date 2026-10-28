import type { Prisma } from "@prisma/client";
import { ApiError, id, text } from "./api";
import { normalizeEmail, normalizeProfileUrl } from "./lead-identity.mjs";

export function leadFields(input: Record<string, unknown>) {
  const fields: Prisma.LeadUncheckedUpdateInput = {};
  if (input.name !== undefined) fields.name = text(input.name, "Lead name");
  for (const key of ["company", "niche", "location", "email", "phone", "website", "profileUrl", "techStack", "notes", "nextFollowUpDate"] as const) {
    const value = input[key];
    if (value === undefined) continue;
    if (value !== null && (typeof value !== "string" || value.length > 20000)) throw new ApiError("Invalid " + key + ".");
    if (key === "email" && typeof value === "string" && value.trim() && !normalizeEmail(value)) throw new ApiError("Enter a valid email address.");
    if (key === "profileUrl" && typeof value === "string" && value.trim() && !normalizeProfileUrl(value)) throw new ApiError("Enter a valid Facebook or Instagram profile URL.");
    fields[key] = value === null || !value.trim() ? null : value.trim();
  }
  if (input.channel !== undefined) fields.channel = text(input.channel, "Channel", 100);
  if (input.tier !== undefined) {
    if (typeof input.tier !== "string" || !["PLATINUM", "GOLD", "BRONZE"].includes(input.tier)) throw new ApiError("Invalid tier.");
    fields.tier = input.tier;
  }
  for (const key of ["dealValue", "followUpCount"] as const) {
    if (input[key] === undefined) continue;
    const value = input[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || (key === "followUpCount" && (!Number.isSafeInteger(value) || value > 2147483647))) throw new ApiError("Invalid " + key + ".");
    fields[key] = value;
  }
  if (input.stageId !== undefined) fields.stageId = id(input.stageId, "Stage");
  return fields;
}
