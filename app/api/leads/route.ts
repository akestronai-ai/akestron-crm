import { api, body, id, text, leadInclude, ApiError } from "@/lib/api";
import { leadFields } from "@/lib/lead-fields";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { normalizeEmail, normalizeProfileUrl } from "@/lib/lead-identity.mjs";
import { Prisma } from "@prisma/client";

function duplicateError(lead: { id: string; name: string; pipelineId: string; stageId: string; createdBy?: { name: string } | null }) {
  return new ApiError("This lead already exists.", 409, "DUPLICATE_LEAD", { duplicate: { id: lead.id, name: lead.name, pipelineId: lead.pipelineId, stageId: lead.stageId, createdBy: lead.createdBy?.name ?? null } });
}

async function findDuplicate(tx: Prisma.TransactionClient, emailKey: string | null, profileKey: string | null) {
  if (!emailKey && !profileKey) return null;
  return tx.lead.findFirst({ where: { OR: [...(emailKey ? [{ emailKey }] : []), ...(profileKey ? [{ profileKey }] : [])] }, select: { id: true, name: true, pipelineId: true, stageId: true, createdById: true, createdBy: { select: { name: true } } } });
}

export async function POST(request: Request) {
  return api(request, async () => {
    const input = await body(request);
    const fields = leadFields(input);
    const emailKey = normalizeEmail(typeof fields.email === "string" ? fields.email : null);
    const profileKey = normalizeProfileUrl(typeof fields.profileUrl === "string" ? fields.profileUrl : null);
    if (!emailKey && !profileKey) throw new ApiError("Add a valid email address or Facebook/Instagram profile URL to identify this lead.");
    const user = await getRequestUser(request);
    const data = { ...fields, emailKey, profileKey, createdById: user?.id, name: text(input.name, "Lead name"), pipelineId: id(input.pipelineId, "Pipeline"), stageId: id(input.stageId, "Stage"), lastContactDate: new Date().toISOString().slice(0, 10) } as Prisma.LeadUncheckedCreateInput;
    let lead;
    try {
      lead = await prisma.$transaction(async tx => {
        const duplicate = await findDuplicate(tx, emailKey, profileKey);
        if (duplicate) throw duplicateError(duplicate);
        const stage = await tx.pipelineStage.findUniqueOrThrow({ where: { id: data.stageId } });
        if (stage.pipelineId !== data.pipelineId) throw new ApiError("Stage must belong to the selected pipeline.");
        const created = await tx.lead.create({ data });
        await tx.leadActivity.create({ data: { leadId: created.id, type: "NOTE", content: `Lead created via ${created.channel}.` } });
        return tx.lead.findUniqueOrThrow({ where: { id: created.id }, include: leadInclude });
      }, { timeout: 30000, maxWait: 10000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
        const duplicate = await prisma.lead.findFirst({ where: { OR: [...(emailKey ? [{ emailKey }] : []), ...(profileKey ? [{ profileKey }] : [])] }, select: { id: true, name: true, pipelineId: true, stageId: true, createdById: true, createdBy: { select: { name: true } } } });
        if (duplicate) throw duplicateError(duplicate);
      }
      throw error;
    }
    return { lead };
  });
}
