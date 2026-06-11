import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { publicOrder } from "@/lib/commerce";
import { getCommerceRepository } from "@/lib/commerce-repository";

interface RouteContext {
  params: Promise<{ orderId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { orderId } = await context.params;
  const order = await getCommerceRepository().get(orderId);

  if (!order) {
    return jsonError("NOT_FOUND", "주문을 찾을 수 없어요.", 404);
  }

  return NextResponse.json(publicOrder(order));
}
