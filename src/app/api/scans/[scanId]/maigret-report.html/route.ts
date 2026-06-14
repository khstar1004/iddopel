import { canAccessFullReport } from "@/lib/entitlements";
import { sanitizeMaigretHtmlReport } from "@/lib/maigret-report";
import { getStoredScan } from "@/lib/scan-store";
import { createTossPreflightResponse, rejectDisallowedTossCors, withTossCors } from "@/lib/toss-cors";

interface RouteContext {
  params: Promise<{ scanId: string }>;
}

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

  if (!scan.maigretReport?.html) {
    return withTossCors(
      request,
      Response.json(
        { error: { code: "HTML_REPORT_NOT_FOUND", message: "원본 HTML 리포트가 없어요." } },
        { status: 404 }
      )
    );
  }

  const filename = safeContentDispositionFilename(scan.maigretReport.htmlFilename ?? `id-doppelganger-${scan.username}.html`);

  return withTossCors(
    request,
    new Response(sanitizeMaigretHtmlReport(scan.maigretReport.html), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self';"
      }
    })
  );
}

function safeContentDispositionFilename(value: string) {
  const safe = value
    .trim()
    .replace(/[\r\n"]/g, "_")
    .slice(0, 120);
  return safe || "id-doppelganger-report.html";
}
