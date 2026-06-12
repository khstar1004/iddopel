import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { defaultFileStorePath } from "./file-store-path";
import { resolvePostgresUrl } from "./postgres-env";

export interface AdminAuditChange {
  before: string | number | boolean | null;
  after: string | number | boolean | null;
}

export type AdminAuditChanges = Record<string, AdminAuditChange>;

export interface AdminAuditEvent {
  id: string;
  action: string;
  actor: string;
  requestKeyHash: string;
  changes: AdminAuditChanges;
  createdAt: string;
}

interface AdminAuditEventInput {
  action: string;
  actor: string;
  requestKeyHash: string;
  changes: AdminAuditChanges;
}

interface AdminAuditLogStore {
  append(input: AdminAuditEventInput, now?: Date): Promise<AdminAuditEvent>;
  list(limit?: number): Promise<AdminAuditEvent[]>;
}

interface AdminAuditFile {
  events?: AdminAuditEvent[];
}

let auditLogStore: AdminAuditLogStore | null = null;

export function getAdminAuditLogStore(): AdminAuditLogStore {
  if (!auditLogStore) {
    const databaseUrl = resolvePostgresUrl();
    auditLogStore = databaseUrl
      ? new PostgresAdminAuditLogStore(databaseUrl)
      : new FileAdminAuditLogStore(process.env.ADMIN_AUDIT_LOG_STORE_PATH);
  }

  return auditLogStore;
}

export function resetAdminAuditLogStoreForTests(nextStore: AdminAuditLogStore | null) {
  auditLogStore = nextStore;
}

export async function recordAdminAuditEvent(
  request: Request,
  input: Pick<AdminAuditEventInput, "action" | "changes"> & { actor?: string }
) {
  const changes = sanitizeAuditChanges(input.changes);
  if (Object.keys(changes).length === 0) return null;

  return getAdminAuditLogStore().append({
    action: input.action,
    actor: sanitizeText(input.actor || "admin", 80),
    requestKeyHash: adminAuditRequestKey(request),
    changes
  });
}

export function listAdminAuditEvents(limit = 10) {
  return getAdminAuditLogStore().list(limit);
}

export function adminAuditRequestKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "anonymous";
  const userAgent = (request.headers.get("user-agent") ?? "unknown-agent").trim().replace(/\s+/g, " ").slice(0, 160);
  return createHash("sha256").update(`admin-audit:${ip}\n${userAgent}`).digest("hex");
}

export class FileAdminAuditLogStore implements AdminAuditLogStore {
  private readonly filePath: string;
  private queue = Promise.resolve();

  constructor(filePath = defaultFileStorePath("admin-audit-log.json")) {
    this.filePath = filePath;
  }

  append(input: AdminAuditEventInput, now = new Date()): Promise<AdminAuditEvent> {
    return this.withQueue(async () => {
      const events = await this.readAll();
      const event: AdminAuditEvent = {
        id: randomUUID(),
        action: sanitizeText(input.action, 100),
        actor: sanitizeText(input.actor, 80),
        requestKeyHash: input.requestKeyHash,
        changes: sanitizeAuditChanges(input.changes),
        createdAt: now.toISOString()
      };
      await this.writeAll([event, ...events].slice(0, 100));
      return event;
    });
  }

  list(limit = 10): Promise<AdminAuditEvent[]> {
    return this.withQueue(async () => {
      const events = await this.readAll();
      return events
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
        .slice(0, normalizeLimit(limit));
    });
  }

  private async readAll(): Promise<AdminAuditEvent[]> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      try {
        const parsed = JSON.parse(raw) as AdminAuditFile;
        return Array.isArray(parsed.events)
          ? parsed.events.map(normalizeAuditEvent).filter((event): event is AdminAuditEvent => event !== null)
          : [];
      } catch (parseError) {
        if (parseError instanceof SyntaxError) {
          await backupCorruptFile(this.filePath);
          return [];
        }
        throw parseError;
      }
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? error.code : undefined;
      if (code === "ENOENT") return [];
      throw error;
    }
  }

  private writeAll(events: AdminAuditEvent[]) {
    return atomicWriteJson(this.filePath, { events });
  }

  private async withQueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.queue.then(operation, operation);
    this.queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }
}

class PostgresAdminAuditLogStore implements AdminAuditLogStore {
  private readonly pool: Pool;
  private readonly ready: Promise<void>;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined
    });
    this.ready = ensurePostgresAdminAuditTable(this.pool);
  }

  async append(input: AdminAuditEventInput, now = new Date()): Promise<AdminAuditEvent> {
    await this.ready;
    const event: AdminAuditEvent = {
      id: randomUUID(),
      action: sanitizeText(input.action, 100),
      actor: sanitizeText(input.actor, 80),
      requestKeyHash: input.requestKeyHash,
      changes: sanitizeAuditChanges(input.changes),
      createdAt: now.toISOString()
    };
    await this.pool.query(
      `insert into admin_audit_events (id, action, actor, request_key_hash, changes, created_at)
       values ($1, $2, $3, $4, $5, $6)`,
      [event.id, event.action, event.actor, event.requestKeyHash, event.changes, event.createdAt]
    );
    return event;
  }

  async list(limit = 10): Promise<AdminAuditEvent[]> {
    await this.ready;
    const result = await this.pool.query(
      `select id, action, actor, request_key_hash, changes, created_at
       from admin_audit_events
       order by created_at desc
       limit $1`,
      [normalizeLimit(limit)]
    );

    return result.rows.map((row) => ({
      id: String(row.id),
      action: String(row.action),
      actor: String(row.actor),
      requestKeyHash: String(row.request_key_hash),
      changes: sanitizeAuditChanges(row.changes as AdminAuditChanges),
      createdAt: new Date(String(row.created_at)).toISOString()
    }));
  }
}

async function ensurePostgresAdminAuditTable(pool: Pool) {
  await pool.query(`
    create table if not exists admin_audit_events (
      id text primary key,
      action text not null,
      actor text not null,
      request_key_hash text not null,
      changes jsonb not null,
      created_at timestamptz not null
    );

    create index if not exists admin_audit_events_created_at_idx on admin_audit_events (created_at desc);
  `);
}

function normalizeAuditEvent(value: unknown): AdminAuditEvent | null {
  if (!value || typeof value !== "object") return null;
  const event = value as Partial<AdminAuditEvent>;
  if (typeof event.id !== "string" || typeof event.action !== "string" || typeof event.createdAt !== "string") {
    return null;
  }

  return {
    id: event.id,
    action: event.action,
    actor: typeof event.actor === "string" ? event.actor : "admin",
    requestKeyHash: typeof event.requestKeyHash === "string" ? event.requestKeyHash : "",
    changes: sanitizeAuditChanges(event.changes ?? {}),
    createdAt: event.createdAt
  };
}

function sanitizeAuditChanges(changes: AdminAuditChanges): AdminAuditChanges {
  return Object.fromEntries(
    Object.entries(changes)
      .map(([key, change]) => [
        sanitizeText(key, 80),
        {
          before: sanitizeAuditValue(change?.before),
          after: sanitizeAuditValue(change?.after)
        }
      ])
      .filter(([key]) => key)
  );
}

function sanitizeAuditValue(value: unknown): string | number | boolean | null {
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return sanitizeText(value, 200);
  return null;
}

function sanitizeText(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeLimit(value: number) {
  if (!Number.isInteger(value)) return 10;
  return Math.min(50, Math.max(1, value));
}

async function backupCorruptFile(filePath: string) {
  const suffix = new Date().toISOString().replace(/[:.]/g, "-");
  await rename(filePath, `${filePath}.corrupt-${suffix}`).catch(() => undefined);
}

async function atomicWriteJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(tempPath, JSON.stringify(value, null, 2), "utf-8");
  try {
    await rename(tempPath, filePath);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}
