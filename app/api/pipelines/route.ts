import { api, body, pipelineInclude, text, ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { defaultStages } from "@/lib/default-stages.mjs";

export async function GET(request: Request) {
  return api(request, async () => ({ pipelines: await prisma.pipeline.findMany({ include: pipelineInclude, orderBy: { createdAt: "asc" } }) }));
}
export async function POST(request: Request) {
  return api(request, async () => {
    const input = await body(request);
    const stages = input.stages ?? [];
    if (!Array.isArray(stages) || stages.length > 50) throw new ApiError("Use up to 50 stages.");
    const validStages = (stages.length ? stages : defaultStages).map((s, index) => {
      if (!s || typeof s !== "object") throw new ApiError("Invalid stage.");
      return { name: text(s.name, "Stage name"), color: typeof s.color === "string" ? s.color : "blue", order: index + 1 };
    });
    const pipeline = await prisma.pipeline.create({ data: { name: text(input.name, "Pipeline name"), description: typeof input.description === "string" ? input.description : "", stages: { create: validStages } }, include: pipelineInclude });
    return { pipeline };
  });
}
