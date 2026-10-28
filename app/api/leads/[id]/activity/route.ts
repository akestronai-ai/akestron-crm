import { api, body, id, text, type IdContext } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: IdContext) {
  return api(request, async () => {
    const input = await body(request);
    const activity = await prisma.leadActivity.create({ data: { leadId: id((await params).id), content: text(input.content, "Content", 20000), type: input.type ? text(input.type, "Activity type", 50) : "NOTE" } });
    return { activity };
  });
}
