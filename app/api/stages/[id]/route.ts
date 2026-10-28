import { api, body, id, text, sameOrigin, ApiError, type IdContext } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: IdContext) {
  return api(request, async () => {
    const input = await body(request);
    if (input.order !== undefined && (typeof input.order !== "number" || !Number.isInteger(input.order) || input.order < 0)) throw new ApiError("Invalid stage order.");
    const data = { ...(input.name !== undefined ? { name: text(input.name, "Stage name") } : {}), ...(typeof input.color === "string" ? { color: input.color } : {}), ...(typeof input.order === "number" ? { order: input.order } : {}) };
    return { stage: await prisma.pipelineStage.update({ where: { id: id((await params).id) }, data }) };
  });
}
export async function DELETE(request: Request, { params }: IdContext) {
  return api(request, async () => {
    sameOrigin(request);
    await prisma.pipelineStage.delete({ where: { id: id((await params).id) } });
    return {};
  });
}
