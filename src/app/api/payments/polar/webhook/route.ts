import { Webhooks } from "@polar-sh/nextjs";
import type { NextRequest } from "next/server";
import { jsonError } from "@/lib/api";
import { grantPolarOrderPaid } from "@/lib/polar-payments";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return jsonError("CONFIGURATION_ERROR", "Polar webhook secret이 설정되어 있지 않아요.", 501);
  }

  const handler = Webhooks({
    webhookSecret,
    onOrderPaid: async (payload) => {
      await grantPolarOrderPaid(payload.data);
    }
  });

  return handler(request);
}
