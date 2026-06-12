import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { defaultFileStorePath } from "./file-store-path";
import { resolvePostgresUrl } from "./postgres-env";
import type { ReportOrder } from "./types";

export interface CommerceRepository {
  create(order: ReportOrder): Promise<ReportOrder>;
  get(orderId: string): Promise<ReportOrder | null>;
  update(order: ReportOrder): Promise<ReportOrder>;
  findPaidOrderByTokenHash(scanId: string, tokenHash: string): Promise<ReportOrder | null>;
  findPaidOrderByPaymentKey(provider: ReportOrder["provider"], paymentKey: string): Promise<ReportOrder | null>;
}

let commerceRepository: CommerceRepository | null = null;

export function getCommerceRepository(): CommerceRepository {
  if (commerceRepository) return commerceRepository;

  const databaseUrl = resolvePostgresUrl();
  commerceRepository = databaseUrl
    ? new PostgresCommerceRepository(databaseUrl)
    : new FileCommerceRepository(process.env.ORDER_STORE_PATH);

  return commerceRepository;
}

export function resetCommerceRepositoryForTests(nextRepository: CommerceRepository | null) {
  commerceRepository = nextRepository;
}

export class FileCommerceRepository implements CommerceRepository {
  private readonly filePath: string;
  private queue = Promise.resolve();

  constructor(filePath = defaultFileStorePath("orders.json")) {
    this.filePath = filePath;
  }

  async create(order: ReportOrder): Promise<ReportOrder> {
    return this.withQueue(async () => {
      const orders = await this.readAll();
      orders[order.orderId] = order;
      await this.writeAll(orders);
      return order;
    });
  }

  async get(orderId: string): Promise<ReportOrder | null> {
    return this.withQueue(async () => {
      const orders = await this.readAll();
      return orders[orderId] ?? null;
    });
  }

  async update(order: ReportOrder): Promise<ReportOrder> {
    return this.withQueue(async () => {
      const orders = await this.readAll();
      orders[order.orderId] = order;
      await this.writeAll(orders);
      return order;
    });
  }

  async findPaidOrderByTokenHash(scanId: string, tokenHash: string): Promise<ReportOrder | null> {
    return this.withQueue(async () => {
      const orders = await this.readAll();
      return (
        Object.values(orders).find(
          (order) => order.scanId === scanId && order.status === "PAID" && order.reportTokenHash === tokenHash
        ) ?? null
      );
    });
  }

  async findPaidOrderByPaymentKey(provider: ReportOrder["provider"], paymentKey: string): Promise<ReportOrder | null> {
    return this.withQueue(async () => {
      const orders = await this.readAll();
      return (
        Object.values(orders).find(
          (order) => order.provider === provider && order.status === "PAID" && order.paymentKey === paymentKey
        ) ?? null
      );
    });
  }

  private async readAll(): Promise<Record<string, ReportOrder>> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      try {
        return JSON.parse(raw) as Record<string, ReportOrder>;
      } catch (parseError) {
        if (parseError instanceof SyntaxError) {
          await this.backupCorruptFile();
          return {};
        }
        throw parseError;
      }
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? error.code : undefined;
      if (code === "ENOENT") return {};
      throw error;
    }
  }

  private async backupCorruptFile() {
    const suffix = new Date().toISOString().replace(/[:.]/g, "-");
    await rename(this.filePath, `${this.filePath}.corrupt-${suffix}`).catch(() => undefined);
  }

  private async withQueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.queue.then(operation, operation);
    this.queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  private async writeAll(orders: Record<string, ReportOrder>) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    await writeFile(tempPath, JSON.stringify(orders, null, 2), "utf-8");
    try {
      await rename(tempPath, this.filePath);
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }
}

class PostgresCommerceRepository implements CommerceRepository {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined
    });
  }

  async create(order: ReportOrder): Promise<ReportOrder> {
    await this.pool.query(
      `insert into report_orders (
        id, scan_id, product_id, amount, currency, order_name, provider, status,
        checkout_url, payment_key, report_token_hash, created_at, paid_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      orderToParams(order)
    );
    return order;
  }

  async get(orderId: string): Promise<ReportOrder | null> {
    const result = await this.pool.query(`select * from report_orders where id = $1 limit 1`, [orderId]);
    return result.rows[0] ? mapOrderRow(result.rows[0]) : null;
  }

  async update(order: ReportOrder): Promise<ReportOrder> {
    await this.pool.query(
      `update report_orders set
        scan_id = $2,
        product_id = $3,
        amount = $4,
        currency = $5,
        order_name = $6,
        provider = $7,
        status = $8,
        checkout_url = $9,
        payment_key = $10,
        report_token_hash = $11,
        created_at = $12,
        paid_at = $13
      where id = $1`,
      orderToParams(order)
    );
    return order;
  }

  async findPaidOrderByTokenHash(scanId: string, tokenHash: string): Promise<ReportOrder | null> {
    const result = await this.pool.query(
      `select * from report_orders where scan_id = $1 and report_token_hash = $2 and status = 'PAID' limit 1`,
      [scanId, tokenHash]
    );
    return result.rows[0] ? mapOrderRow(result.rows[0]) : null;
  }

  async findPaidOrderByPaymentKey(provider: ReportOrder["provider"], paymentKey: string): Promise<ReportOrder | null> {
    const result = await this.pool.query(
      `select * from report_orders where provider = $1 and payment_key = $2 and status = 'PAID' limit 1`,
      [provider, paymentKey]
    );
    return result.rows[0] ? mapOrderRow(result.rows[0]) : null;
  }
}

function orderToParams(order: ReportOrder) {
  return [
    order.orderId,
    order.scanId,
    order.productId,
    order.amount,
    order.currency,
    order.orderName,
    order.provider,
    order.status,
    order.checkoutUrl,
    order.paymentKey,
    order.reportTokenHash,
    order.createdAt,
    order.paidAt
  ];
}

function mapOrderRow(row: Record<string, unknown>): ReportOrder {
  return {
    orderId: String(row.id),
    scanId: String(row.scan_id),
    productId: row.product_id as ReportOrder["productId"],
    amount: Number(row.amount),
    currency: row.currency as ReportOrder["currency"],
    orderName: String(row.order_name),
    provider: row.provider as ReportOrder["provider"],
    status: row.status as ReportOrder["status"],
    checkoutUrl: row.checkout_url ? String(row.checkout_url) : null,
    paymentKey: row.payment_key ? String(row.payment_key) : null,
    reportTokenHash: row.report_token_hash ? String(row.report_token_hash) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    paidAt: row.paid_at ? new Date(String(row.paid_at)).toISOString() : null
  };
}
