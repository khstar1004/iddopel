import { canAccessFullReport } from "@/lib/entitlements";
import { buildPdfReport } from "@/lib/report-pdf";
import { getStoredScan } from "@/lib/scan-store";
import { createTossPreflightResponse, rejectDisallowedTossCors, withTossCors } from "@/lib/toss-cors";

interface RouteContext {
  params: Promise<{ scanId: string }>;
}

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return createTossPreflightResponse(request, ["GET"]);
}

export async function GET(request: Request, context: RouteContext) {
  const corsError = rejectDisallowedTossCors(request);
  if (corsError) return corsError;

  const { scanId } = await context.params;
  const scan = await getStoredScan(scanId);

  if (!scan) {
    return withTossCors(
      request,
      Response.json({ error: { code: "NOT_FOUND", message: "점검 기록을 찾을 수 없어요." } }, { status: 404 })
    );
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const hasAccess = await canAccessFullReport(scanId, token, request);

  if (!hasAccess) {
    return withTossCors(
      request,
      Response.json({ error: { code: "PAYMENT_REQUIRED", message: "정밀 리포트 결제가 필요해요." } }, { status: 402 })
    );
  }

  const pdf = await buildPdfReport(scan, scan.results.filter((result) => result.status === "FOUND"));
  return withTossCors(
    request,
    new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="id-doppelganger-${scan.username}.pdf"`
      }
    })
  );
}
