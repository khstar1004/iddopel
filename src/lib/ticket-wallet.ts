import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { Pool } from "pg";
import {
  betaScanReferralCode,
  getBetaScanUsageStore,
  transferBetaScanReferralTickets
} from "./beta-scan-quota";
import { defaultFileStorePath } from "./file-store-path";
import { resolvePostgresUrl } from "./postgres-env";

const scryptAsync = promisify(scrypt);
export const ticketWalletSessionCookieName = "id_doppelganger_ticket_session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 180;

export interface TicketWalletAccount {
  accountId: string;
  emailHash: string;
  emailMasked: string;
  ownerToken: string;
  recoveryCodeHash: string;
  sessionTokenHash: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface PublicTicketWallet {
  authenticated: true;
  accountId: string;
  emailMasked: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface TicketWalletClaimResult {
  account: TicketWalletAccount;
  wallet: PublicTicketWallet;
  sessionToken: string;
  recoveryCode?: string;
  created: boolean;
  transferredReferralTickets: number;
}

interface TicketWalletStore {
  getByEmailHash(emailHash: string): Promise<TicketWalletAccount | null>;
  getBySessionTokenHash(sessionTokenHash: string): Promise<TicketWalletAccount | null>;
  create(account: TicketWalletAccount): Promise<TicketWalletAccount>;
  updateSession(accountId: string, sessionTokenHash: string | null, now?: Date): Promise<TicketWalletAccount | null>;
}

export class TicketWalletError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 422,
    public details?: unknown
  ) {
    super(message);
  }
}

let walletStore: TicketWalletStore | null = null;

export function getTicketWalletStore(): TicketWalletStore {
  if (!walletStore) {
    const databaseUrl = resolvePostgresUrl();
    walletStore = databaseUrl
      ? new PostgresTicketWalletStore(databaseUrl)
      : new FileTicketWalletStore(process.env.TICKET_WALLET_STORE_PATH);
  }

  return walletStore;
}

export function resetTicketWalletStoreForTests(nextStore: TicketWalletStore | null) {
  walletStore = nextStore;
}

export async function claimTicketWallet(input: {
  email: unknown;
  recoveryCode?: unknown;
  anonymousOwnerToken?: string | null;
}): Promise<TicketWalletClaimResult> {
  const email = normalizeTicketWalletEmail(input.email);
  const emailHash = hashTicketWalletEmail(email);
  const store = getTicketWalletStore();
  const now = new Date();
  const existing = await store.getByEmailHash(emailHash);
  let account = existing;
  let recoveryCode: string | undefined;
  let created = false;

  if (account) {
    const recoveryInput = typeof input.recoveryCode === "string" ? input.recoveryCode.trim() : "";
    if (!recoveryInput) {
      throw new TicketWalletError(
        "TICKET_WALLET_RECOVERY_REQUIRED",
        "이미 저장된 티켓 지갑이에요. 복구코드를 입력해 주세요.",
        409,
        { emailMasked: account.emailMasked }
      );
    }

    if (!await verifySecret(recoveryInput, account.recoveryCodeHash)) {
      throw new TicketWalletError("TICKET_WALLET_RECOVERY_INVALID", "복구코드가 맞지 않아요.", 401);
    }
  } else {
    recoveryCode = generateRecoveryCode();
    account = await store.create({
      accountId: `wallet_${randomBytes(12).toString("hex")}`,
      emailHash,
      emailMasked: maskTicketWalletEmail(email),
      ownerToken: generateSecretToken(),
      recoveryCodeHash: await hashSecret(recoveryCode),
      sessionTokenHash: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      lastLoginAt: null
    });
    created = true;
  }

  const sessionToken = generateSecretToken();
  const sessionTokenHash = hashSessionToken(sessionToken);
  const updated = await store.updateSession(account.accountId, sessionTokenHash, now);
  if (!updated) {
    throw new TicketWalletError("TICKET_WALLET_NOT_FOUND", "티켓 지갑을 찾지 못했어요.", 404);
  }

  const transfer = await transferBetaScanReferralTickets(
    getBetaScanUsageStore(),
    betaScanReferralCode(input.anonymousOwnerToken),
    betaScanReferralCode(updated.ownerToken),
    now
  );

  return {
    account: updated,
    wallet: publicTicketWallet(updated),
    sessionToken,
    recoveryCode,
    created,
    transferredReferralTickets: transfer.transferred
  };
}

export async function resolveTicketWalletSession(request: Request): Promise<TicketWalletAccount | null> {
  const sessionToken = readCookie(request, ticketWalletSessionCookieName);
  if (!sessionToken) return null;
  return getTicketWalletStore().getBySessionTokenHash(hashSessionToken(sessionToken));
}

export async function logoutTicketWallet(request: Request): Promise<void> {
  const account = await resolveTicketWalletSession(request);
  if (!account) return;
  await getTicketWalletStore().updateSession(account.accountId, null);
}

export function publicTicketWallet(account: TicketWalletAccount): PublicTicketWallet {
  return {
    authenticated: true,
    accountId: account.accountId,
    emailMasked: account.emailMasked,
    createdAt: account.createdAt,
    lastLoginAt: account.lastLoginAt
  };
}

export function ticketWalletSessionCookie(sessionToken: string, request: Request) {
  const secure = shouldUseSecureCookie(request) ? "; Secure" : "";
  return `${ticketWalletSessionCookieName}=${sessionToken}; Path=/; Max-Age=${sessionMaxAgeSeconds}; HttpOnly; SameSite=Lax${secure}`;
}

export function clearTicketWalletSessionCookie(request: Request) {
  const secure = shouldUseSecureCookie(request) ? "; Secure" : "";
  return `${ticketWalletSessionCookieName}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
}

export function normalizeTicketWalletEmail(value: unknown) {
  if (typeof value !== "string") {
    throw new TicketWalletError("TICKET_WALLET_EMAIL_INVALID", "이메일을 입력해 주세요.");
  }

  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new TicketWalletError("TICKET_WALLET_EMAIL_INVALID", "사용 가능한 이메일을 입력해 주세요.");
  }

  return email;
}

function hashTicketWalletEmail(email: string) {
  return createHash("sha256").update(`ticket-wallet-email:${email}`).digest("hex");
}

function maskTicketWalletEmail(email: string) {
  const [local, domain] = email.split("@");
  const safeLocal = local || "user";
  const visible = safeLocal.slice(0, 1);
  return `${visible}${"*".repeat(Math.min(3, Math.max(2, safeLocal.length - 1)))}@${domain}`;
}

function generateSecretToken() {
  return randomBytes(32).toString("base64url");
}

function generateRecoveryCode() {
  return randomBytes(12).toString("base64url");
}

function hashSessionToken(sessionToken: string) {
  return createHash("sha256").update(`ticket-wallet-session:${sessionToken}`).digest("hex");
}

async function hashSecret(secret: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scryptAsync(secret, salt, 32) as Buffer;
  return `${salt}:${derived.toString("base64url")}`;
}

async function verifySecret(secret: string, storedHash: string) {
  const [salt, expected] = storedHash.split(":");
  if (!salt || !expected) return false;
  try {
    const expectedBuffer = Buffer.from(expected, "base64url");
    const derived = await scryptAsync(secret, salt, 32) as Buffer;
    return expectedBuffer.length === derived.length && timingSafeEqual(derived, expectedBuffer);
  } catch {
    return false;
  }
}

function readCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  const parts = cookie.split(";").map((part) => part.trim());
  const prefix = `${name}=`;
  const match = parts.find((part) => part.startsWith(prefix));
  if (!match) return null;
  try {
    return decodeURIComponent(match.slice(prefix.length));
  } catch {
    return null;
  }
}

function shouldUseSecureCookie(request: Request) {
  return new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

export class FileTicketWalletStore implements TicketWalletStore {
  private readonly filePath: string;
  private queue = Promise.resolve();

  constructor(filePath = defaultFileStorePath("ticket-wallets.json")) {
    this.filePath = filePath;
  }

  getByEmailHash(emailHash: string): Promise<TicketWalletAccount | null> {
    return this.withQueue(async () => {
      const accounts = await this.readAll();
      return Object.values(accounts).find((account) => account.emailHash === emailHash) ?? null;
    });
  }

  getBySessionTokenHash(sessionTokenHash: string): Promise<TicketWalletAccount | null> {
    return this.withQueue(async () => {
      const accounts = await this.readAll();
      return Object.values(accounts).find((account) => account.sessionTokenHash === sessionTokenHash) ?? null;
    });
  }

  create(account: TicketWalletAccount): Promise<TicketWalletAccount> {
    return this.withQueue(async () => {
      const accounts = await this.readAll();
      accounts[account.accountId] = account;
      await this.writeAll(accounts);
      return account;
    });
  }

  updateSession(accountId: string, sessionTokenHash: string | null, now = new Date()): Promise<TicketWalletAccount | null> {
    return this.withQueue(async () => {
      const accounts = await this.readAll();
      const account = accounts[accountId];
      if (!account) return null;
      const next = {
        ...account,
        sessionTokenHash,
        updatedAt: now.toISOString(),
        lastLoginAt: sessionTokenHash ? now.toISOString() : account.lastLoginAt
      };
      accounts[accountId] = next;
      await this.writeAll(accounts);
      return next;
    });
  }

  private async readAll(): Promise<Record<string, TicketWalletAccount>> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      return JSON.parse(raw) as Record<string, TicketWalletAccount>;
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? error.code : undefined;
      if (code === "ENOENT") return {};
      if (error instanceof SyntaxError) {
        await rename(this.filePath, `${this.filePath}.corrupt-${new Date().toISOString().replace(/[:.]/g, "-")}`).catch(() => undefined);
        return {};
      }
      throw error;
    }
  }

  private async writeAll(accounts: Record<string, TicketWalletAccount>) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    await writeFile(tempPath, JSON.stringify(accounts, null, 2), "utf-8");
    try {
      await rename(tempPath, this.filePath);
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    }
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

class PostgresTicketWalletStore implements TicketWalletStore {
  private readonly pool: Pool;
  private readonly ready: Promise<void>;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined
    });
    this.ready = ensurePostgresTicketWalletTables(this.pool);
  }

  async getByEmailHash(emailHash: string): Promise<TicketWalletAccount | null> {
    await this.ready;
    const result = await this.pool.query(`select * from ticket_wallet_accounts where email_hash = $1 limit 1`, [emailHash]);
    return result.rows[0] ? mapPostgresTicketWallet(result.rows[0]) : null;
  }

  async getBySessionTokenHash(sessionTokenHash: string): Promise<TicketWalletAccount | null> {
    await this.ready;
    const result = await this.pool.query(
      `select * from ticket_wallet_accounts where session_token_hash = $1 limit 1`,
      [sessionTokenHash]
    );
    return result.rows[0] ? mapPostgresTicketWallet(result.rows[0]) : null;
  }

  async create(account: TicketWalletAccount): Promise<TicketWalletAccount> {
    await this.ready;
    await this.pool.query(
      `insert into ticket_wallet_accounts (
        id, email_hash, email_masked, owner_token, recovery_code_hash, session_token_hash,
        created_at, updated_at, last_login_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        account.accountId,
        account.emailHash,
        account.emailMasked,
        account.ownerToken,
        account.recoveryCodeHash,
        account.sessionTokenHash,
        account.createdAt,
        account.updatedAt,
        account.lastLoginAt
      ]
    );
    return account;
  }

  async updateSession(accountId: string, sessionTokenHash: string | null, now = new Date()): Promise<TicketWalletAccount | null> {
    await this.ready;
    const result = await this.pool.query(
      `update ticket_wallet_accounts
       set session_token_hash = $2,
           updated_at = $3,
           last_login_at = case when $2::text is null then last_login_at else $3::timestamptz end
       where id = $1
       returning *`,
      [accountId, sessionTokenHash, now.toISOString()]
    );
    return result.rows[0] ? mapPostgresTicketWallet(result.rows[0]) : null;
  }
}

async function ensurePostgresTicketWalletTables(pool: Pool) {
  await pool.query(`
    create table if not exists ticket_wallet_accounts (
      id text primary key,
      email_hash text not null unique,
      email_masked text not null,
      owner_token text not null unique,
      recovery_code_hash text not null,
      session_token_hash text unique,
      created_at timestamptz not null,
      updated_at timestamptz not null,
      last_login_at timestamptz
    );

    create index if not exists ticket_wallet_accounts_session_idx on ticket_wallet_accounts (session_token_hash);
  `);
}

function mapPostgresTicketWallet(row: Record<string, unknown>): TicketWalletAccount {
  return {
    accountId: String(row.id),
    emailHash: String(row.email_hash),
    emailMasked: String(row.email_masked),
    ownerToken: String(row.owner_token),
    recoveryCodeHash: String(row.recovery_code_hash),
    sessionTokenHash: row.session_token_hash ? String(row.session_token_hash) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    lastLoginAt: row.last_login_at ? new Date(String(row.last_login_at)).toISOString() : null
  };
}
