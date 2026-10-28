import { api, body, id, sameOrigin, leadInclude, ApiError, type IdContext } from "@/lib/api";
import { leadFields } from "@/lib/lead-fields";
import { prisma } from "@/lib/prisma";
import { normalizeEmail, normalizeProfileUrl } from "@/lib/lead-identity.mjs";
import { Prisma } from "@prisma/client";

function duplicateError(lead: { id: string; name: string; pipelineId: string; stageId: string; createdBy?: { name: string } | null }) {
  return new ApiError("This lead already exists.", 409, "DUPLICATE_LEAD", { duplicate: { id: lead.id, name: lead.name, pipelineId: lead.pipelineId, stageId: lead.stageId, createdBy: lead.createdBy?.name ?? null } });
}

export async function GET(request: Request, { params }: IdContext) {
  return api(request, async () => ({ lead: await prisma.lead.findUniqueOrThrow({ where: { id: id((await params).id) }, include: leadInclude }) }));
}
export async function PUT(request: Request, { params }: IdContext) {
  return api(request, async () => {
    const input = await body(request);
    const leadId = id((await params).id);
    const changes = leadFields(input);
    let lead;
    try {
    lead = await prisma.$transaction(async tx => {
      const previous = await tx.lead.findUniqueOrThrow({ where: { id: leadId } });
      if (input.incrementFollowUp === true) {
        const updated = await tx.lead.update({ where: { id: leadId }, data: { followUpCount: { increment: 1 }, lastContactDate: new Date().toISOString().slice(0, 10) } });
        await tx.leadActivity.create({ data: { leadId, type: "FOLLOW_UP", content: `Follow-up #${updated.followUpCount} executed.` } });
      } else {
        const email = changes.email === undefined ? previous.email : changes.email;
        const profile = changes.profileUrl === undefined ? previous.profileUrl : changes.profileUrl;
        const emailKey = normalizeEmail(typeof email === "string" ? email : null);
        const profileKey = normalizeProfileUrl(typeof profile === "string" ? profile : null);
        if ((previous.emailKey || previous.profileKey) && !emailKey && !profileKey) throw new ApiError("Keep at least one valid email or profile URL on this lead.");
        const duplicate = emailKey || profileKey ? await tx.lead.findFirst({ where: { id: { not: leadId }, OR: [...(emailKey ? [{ emailKey }] : []), ...(profileKey ? [{ profileKey }] : [])] }, select: { id: true, name: true, pipelineId: true, stageId: true, createdBy: { select: { name: true } } } }) : null;
        if (duplicate) throw duplicateError(duplicate);
        Object.assign(changes, { emailKey, profileKey });
        if (typeof changes.stageId === "string" && changes.stageId !== previous.stageId) {
          const stage = await tx.pipelineStage.findUniqueOrThrow({ where: { id: changes.stageId } });
          if (stage.pipelineId !== previous.pipelineId) throw new ApiError("Stage must belong to the lead's pipeline.");
          changes.stageEnteredAt = new Date();
          await tx.leadActivity.create({ data: { leadId, type: "STAGE_CHANGE", content: `Stage updated to "${stage.name}".` } });
        }
        const updated = await tx.lead.update({ where: { id: leadId }, data: changes });
        if (updated.followUpCount > previous.followUpCount) await tx.leadActivity.create({ data: { leadId, type: "FOLLOW_UP", content: `Follow-up #${updated.followUpCount} executed.` } });
      }
      return tx.lead.findUniqueOrThrow({ where: { id: leadId }, include: leadInclude });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000, maxWait: 10000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
        const current = await prisma.lead.findUnique({ where: { id: leadId }, select: { emailKey: true, profileKey: true } });
        const emailKey = normalizeEmail(typeof changes.email === "string" ? changes.email : current?.emailKey);
        const profileKey = normalizeProfileUrl(typeof changes.profileUrl === "string" ? changes.profileUrl : current?.profileKey);
        const duplicate = await prisma.lead.findFirst({ where: { id: { not: leadId }, OR: [...(emailKey ? [{ emailKey }] : []), ...(profileKey ? [{ profileKey }] : [])] }, select: { id: true, name: true, pipelineId: true, stageId: true, createdBy: { select: { name: true } } } });
        if (duplicate) throw duplicateError(duplicate);
      }
      throw error;
    }
    return { lead };
  });
}
export async function DELETE(request: Request, { params }: IdContext) {
  return api(request, async () => {
    sameOrigin(request);
    await prisma.lead.delete({ where: { id: id((await params).id) } });
    return {};
  });
}
