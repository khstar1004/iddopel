import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FileCommerceRepository } from "./commerce-repository";
import type { ReportOrder } from "./types";

describe("FileCommerceRepository", () => {
  it("backs up a corrupted local order store and continues writing", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "orders-store-"));
    const filePath = path.join(dir, "orders.json");
    const repository = new FileCommerceRepository(filePath);
    await writeFile(filePath, '{"broken": true} trailing', "utf-8");

    const order = orderFixture("order_recovered");
    await expect(repository.create(order)).resolves.toEqual(order);

    const persisted = JSON.parse(await readFile(filePath, "utf-8")) as Record<string, ReportOrder>;
    expect(persisted.order_recovered).toMatchObject({ orderId: "order_recovered" });
    expect((await readdir(dir)).some((name) => name.startsWith("orders.json.corrupt-"))).toBe(true);
  });

  it("serializes concurrent writes to the local order store", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "orders-store-"));
    const filePath = path.join(dir, "orders.json");
    const repository = new FileCommerceRepository(filePath);

    await Promise.all([
      repository.create(orderFixture("order_one")),
      repository.create(orderFixture("order_two")),
      repository.update({ ...orderFixture("order_three"), status: "PAID", paymentKey: "payment_three" })
    ]);

    const persisted = JSON.parse(await readFile(filePath, "utf-8")) as Record<string, ReportOrder>;
    expect(Object.keys(persisted).sort()).toEqual(["order_one", "order_three", "order_two"]);
    expect(persisted.order_three.status).toBe("PAID");
  });
});

function orderFixture(orderId: string): ReportOrder {
  return {
    orderId,
    scanId: `scan_${orderId}`,
    productId: "DETAILED_REPORT",
    amount: 2900,
    currency: "KRW",
    orderName: "정밀 리포트",
    provider: "MOCK",
    status: "READY",
    checkoutUrl: `http://127.0.0.1/checkout/${orderId}`,
    paymentKey: null,
    reportTokenHash: null,
    createdAt: new Date("2026-06-11T00:00:00.000Z").toISOString(),
    paidAt: null
  };
}
