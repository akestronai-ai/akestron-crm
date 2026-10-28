import { api, body, id, text, pipelineInclude, sameOrigin, type IdContext } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: IdContext) {
  return api(request, async () => ({ pipeline: await prisma.pipeline.findUniqueOrThrow({ where: { id: id((await params).id) }, include: pipelineInclude }) }));
}
export async function PUT(request: Request, { params }: IdContext) {
  return api(request, async () => {
    const input = await body(request);
    const data = { ...(input.name !== undefined ? { name: text(input.name, "Pipeline name") } : {}), ...(typeof input.description === "string" ? { description: input.description } : {}) };
    return { pipeline: await prisma.pipeline.update({ where: { id: id((await params).id) }, data, include: pipelineInclude }) };
  });
}
export async function DELETE(request: Request, { params }: IdContext) {
  return api(request, async () => {
    sameOrigin(request);
    await prisma.pipeline.delete({ where: { id: id((await params).id) } });
    return {};
  });
}
