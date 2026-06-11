import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { isExpired } from "./retention";
import type { ScanJob } from "./types";

export interface ScanRepository {
  create(job: ScanJob): Promise<ScanJob>;
  get(scanId: string): Promise<ScanJob | null>;
  delete(scanId: string): Promise<void>;
  extendExpiration(scanId: string, expiresAt: string): Promise<void>;
  pruneExpired(now?: Date): Promise<number>;
}

let repository: ScanRepository | null = null;

export function getScanRepository(): ScanRepository {
  if (repository) return repository;

  const databaseUrl = process.env.DATABASE_URL;
  repository = databaseUrl?.startsWith("postgres")
    ? new PostgresScanRepository(databaseUrl)
    : new FileScanRepository(process.env.SCAN_STORE_PATH);

  return repository;
}

export function resetScanRepositoryForTests(nextRepository: ScanRepository | null) {
  repository = nextRepository;
}

class FileScanRepository implements ScanRepository {
  private readonly filePath: string;

  constructor(filePath = path.join(process.cwd(), ".data", "scans.json")) {
    this.filePath = filePath;
  }

  async create(job: ScanJob): Promise<ScanJob> {
    const jobs = await this.readAll();
    jobs[job.scanId] = job;
    await this.writeAll(jobs);
    return job;
  }

  async get(scanId: string): Promise<ScanJob | null> {
    const jobs = await this.readAll();
    const job = jobs[scanId] ?? null;

    if (!job) return null;
    if (isExpired(job.expiresAt)) {
      delete jobs[scanId];
      await this.writeAll(jobs);
      return null;
    }

    return job;
  }

  async delete(scanId: string): Promise<void> {
    const jobs = await this.readAll();
    delete jobs[scanId];
    await this.writeAll(jobs);
  }

  async extendExpiration(scanId: string, expiresAt: string): Promise<void> {
    const jobs = await this.readAll();
    if (jobs[scanId]) {
      jobs[scanId] = {
        ...jobs[scanId],
        expiresAt
      };
      await this.writeAll(jobs);
    }
  }

  async pruneExpired(now = new Date()): Promise<number> {
    const jobs = await this.readAll();
    const before = Object.keys(jobs).length;
    const activeEntries = Object.entries(jobs).filter(([, job]) => !isExpired(job.expiresAt, now));
    await this.writeAll(Object.fromEntries(activeEntries));
    return before - activeEntries.length;
  }

  private async readAll(): Promise<Record<string, ScanJob>> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf-8")) as Record<string, ScanJob>;
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? error.code : undefined;
      if (code === "ENOENT") return {};
      throw error;
    }
  }

  private async writeAll(jobs: Record<string, ScanJob>): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    await writeFile(tempPath, JSON.stringify(jobs, null, 2), "utf-8");
    await rename(tempPath, this.filePath);
  }
}

class PostgresScanRepository implements ScanRepository {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined
    });
  }

  async create(job: ScanJob): Promise<ScanJob> {
    await this.pool.query(
      `insert into scan_jobs (
        id, username, purpose, mode, status, progress, found_count, checked_count, failed_rate,
        doppelganger_score, rarity_score, exposure_score, impersonation_score, cleanup_score,
        country_distribution, category_distribution, preview_results, results,
        maigret_report_html, maigret_report_filename, maigret_report_generated_at,
        created_at, finished_at, expires_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15::jsonb, $16::jsonb, $17::jsonb, $18::jsonb,
        $19, $20, $21,
        $22, $23, $24
      )
      on conflict (id) do update set
        username = excluded.username,
        purpose = excluded.purpose,
        mode = excluded.mode,
        status = excluded.status,
        progress = excluded.progress,
        found_count = excluded.found_count,
        checked_count = excluded.checked_count,
        failed_rate = excluded.failed_rate,
        doppelganger_score = excluded.doppelganger_score,
        rarity_score = excluded.rarity_score,
        exposure_score = excluded.exposure_score,
        impersonation_score = excluded.impersonation_score,
        cleanup_score = excluded.cleanup_score,
        country_distribution = excluded.country_distribution,
        category_distribution = excluded.category_distribution,
        preview_results = excluded.preview_results,
        results = excluded.results,
        maigret_report_html = excluded.maigret_report_html,
        maigret_report_filename = excluded.maigret_report_filename,
        maigret_report_generated_at = excluded.maigret_report_generated_at,
        finished_at = excluded.finished_at,
        expires_at = excluded.expires_at`,
      [
        job.scanId,
        job.username,
        job.purpose,
        job.mode,
        job.status,
        job.progress,
        job.foundCount,
        job.checkedCount,
        job.failedRate,
        job.doppelgangerScore,
        job.rarityScore,
        job.exposureScore,
        job.impersonationScore,
        job.cleanupScore,
        JSON.stringify(job.countryDistribution),
        JSON.stringify(job.categoryDistribution),
        JSON.stringify(job.previewResults),
        JSON.stringify(job.results),
        job.maigretReport?.html ?? null,
        job.maigretReport?.htmlFilename ?? null,
        job.maigretReport?.generatedAt ?? null,
        job.createdAt,
        job.finishedAt,
        job.expiresAt
      ]
    );

    return job;
  }

  async get(scanId: string): Promise<ScanJob | null> {
    const result = await this.pool.query(
      `select * from scan_jobs where id = $1 and expires_at > now() limit 1`,
      [scanId]
    );
    const row = result.rows[0];
    return row ? mapPostgresRow(row) : null;
  }

  async delete(scanId: string): Promise<void> {
    await this.pool.query(`delete from scan_jobs where id = $1`, [scanId]);
  }

  async extendExpiration(scanId: string, expiresAt: string): Promise<void> {
    await this.pool.query(`update scan_jobs set expires_at = greatest(expires_at, $2::timestamptz) where id = $1`, [
      scanId,
      expiresAt
    ]);
  }

  async pruneExpired(): Promise<number> {
    const result = await this.pool.query(`delete from scan_jobs where expires_at <= now()`);
    return result.rowCount ?? 0;
  }
}

function mapPostgresRow(row: Record<string, unknown>): ScanJob {
  return {
    scanId: String(row.id),
    username: String(row.username),
    purpose: row.purpose as ScanJob["purpose"],
    mode: row.mode as ScanJob["mode"],
    status: row.status as ScanJob["status"],
    progress: Number(row.progress),
    foundCount: Number(row.found_count),
    checkedCount: Number(row.checked_count),
    failedRate: Number(row.failed_rate),
    doppelgangerScore: Number(row.doppelganger_score),
    rarityScore: Number(row.rarity_score),
    exposureScore: Number(row.exposure_score),
    impersonationScore: Number(row.impersonation_score),
    cleanupScore: Number(row.cleanup_score),
    countryDistribution: row.country_distribution as ScanJob["countryDistribution"],
    categoryDistribution: row.category_distribution as ScanJob["categoryDistribution"],
    previewResults: row.preview_results as ScanJob["previewResults"],
    results: row.results as ScanJob["results"],
    maigretReportAvailable: Boolean(row.maigret_report_html),
    maigretReportFilename: row.maigret_report_filename ? String(row.maigret_report_filename) : undefined,
    maigretReport: row.maigret_report_html
      ? {
          html: String(row.maigret_report_html),
          htmlFilename: row.maigret_report_filename ? String(row.maigret_report_filename) : undefined,
          generatedAt: row.maigret_report_generated_at
            ? new Date(String(row.maigret_report_generated_at)).toISOString()
            : undefined
        }
      : undefined,
    createdAt: new Date(String(row.created_at)).toISOString(),
    finishedAt: row.finished_at ? new Date(String(row.finished_at)).toISOString() : null,
    expiresAt: new Date(String(row.expires_at)).toISOString()
  };
}
