import { NextResponse } from "next/server";
import { buildHealthStatus } from "@/lib/health";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(buildHealthStatus(process.env), {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
