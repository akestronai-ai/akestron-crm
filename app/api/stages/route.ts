import { Prisma } from "@prisma/client";
import { api, body, id, text } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  return api(request, async () => {
    const input = await body(request);
    const pipelineId = id(input.pipelineId, "Pipeline");
    const stage = await prisma.$transaction(async tx => {
      await tx.pipeline.findUniqueOrThrow({ where: { id: pipelineId } });
      const last = await tx.pipelineStage.aggregate({ where: { pipelineId }, _max: { order: true } });
      return tx.pipelineStage.create({ data: { pipelineId, name: text(input.name, "Stage name"), color: typeof input.color === "string" ? input.color : "blue", order: (last._max.order ?? 0) + 1 } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { stage };
  });
}
