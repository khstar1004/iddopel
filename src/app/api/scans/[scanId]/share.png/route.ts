import { buildShareCardPng } from "@/lib/share-card";
import { getStoredSummary } from "@/lib/scan-store";

interface RouteContext {
  params: Promise<{ scanId: string }>;
}

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext) {
  const { scanId } = await context.params;
  const summary = await getStoredSummary(scanId);

  if (!summary) {
    return Response.json({ error: { code: "NOT_FOUND", message: "공유 카드를 만들 점검 기록을 찾을 수 없어요." } }, { status: 404 });
  }

  const png = await buildShareCardPng(summary, { origin: new URL(request.url).origin });
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="id-doppelganger-${summary.username}-share.png"`,
      "Cache-Control": "private, max-age=300"
    }
  });
}
