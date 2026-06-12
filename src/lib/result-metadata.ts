import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { ScanResult } from "./types";

type FetchLike = typeof fetch;
type LookupLike = (hostname: string, options: { all: true }) => Promise<Array<{ address: string; family: number }>>;

interface MetadataOptions {
  fetchImpl?: FetchLike;
  lookupImpl?: LookupLike;
  limit?: number;
  timeoutMs?: number;
  maxBytes?: number;
}

interface PageMetadata {
  title?: string;
  description?: string;
  imageUrl?: string;
}

const defaultMetadataLimit = 3;
const defaultMetadataTimeoutMs = 1200;
const defaultMetadataMaxBytes = 64 * 1024;
const metadataUserAgent = "id-doppelganger-metadata/1.0";

export async function enrichScanResultsWithMetadata(results: ScanResult[], options: MetadataOptions = {}) {
  if (process.env.SCAN_RESULT_METADATA_ENABLED === "false") return results;

  const limit = positiveInt(process.env.SCAN_RESULT_METADATA_LIMIT, options.limit ?? defaultMetadataLimit);
  if (limit <= 0) return results;

  const timeoutMs = positiveInt(process.env.SCAN_RESULT_METADATA_TIMEOUT_MS, options.timeoutMs ?? defaultMetadataTimeoutMs);
  const maxBytes = positiveInt(process.env.SCAN_RESULT_METADATA_MAX_BYTES, options.maxBytes ?? defaultMetadataMaxBytes);
  const fetchImpl = options.fetchImpl ?? fetch;
  const lookupImpl = options.lookupImpl ?? dnsLookup;
  const candidates = results.filter((result) => result.status === "FOUND").slice(0, limit);
  const enriched = new Map(
    await Promise.all(
      candidates.map(async (result) => {
        const metadata = await fetchResultMetadata(result.url, {
          fetchImpl,
          lookupImpl,
          timeoutMs,
          maxBytes
        });
        return [result.id, metadata] as const;
      })
    )
  );

  return results.map((result) => {
    const metadata = enriched.get(result.id);
    if (!metadata) return result;

    return {
      ...result,
      evidenceTitle: metadata.title ?? result.evidenceTitle,
      evidenceDescription: metadata.description ?? result.evidenceDescription,
      evidenceImageUrl: metadata.imageUrl ?? result.evidenceImageUrl,
      profileImageUrl: result.profileImageUrl ?? metadata.imageUrl
    };
  });
}

export async function fetchResultMetadata(
  rawUrl: string,
  {
    fetchImpl = fetch,
    lookupImpl = dnsLookup,
    timeoutMs = defaultMetadataTimeoutMs,
    maxBytes = defaultMetadataMaxBytes
  }: MetadataOptions = {}
): Promise<PageMetadata | null> {
  const url = await safeMetadataUrl(rawUrl, lookupImpl);
  if (!url) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": metadataUserAgent
      },
      redirect: "manual",
      signal: controller.signal
    });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) return null;

    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (contentLength > maxBytes) return null;

    const html = await readResponsePrefix(response, maxBytes);
    return metadataFromHtml(html, url);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function metadataFromHtml(html: string, baseUrl: string): PageMetadata | null {
  const title =
    cleanText(metaContent(html, "property", "og:title") ?? metaContent(html, "name", "twitter:title") ?? titleContent(html));
  const description = cleanText(
    metaContent(html, "property", "og:description") ??
      metaContent(html, "name", "description") ??
      metaContent(html, "name", "twitter:description")
  );
  const imageUrl = safeMetadataImageUrl(
    metaContent(html, "property", "og:image") ?? metaContent(html, "name", "twitter:image"),
    baseUrl
  );

  if (!title && !description && !imageUrl) return null;
  return { title, description, imageUrl };
}

async function safeMetadataUrl(rawUrl: string, lookupImpl: LookupLike) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (isBlockedHostname(url.hostname)) return null;

  try {
    const records = await lookupImpl(url.hostname, { all: true });
    if (records.some((record) => isPrivateAddress(record.address))) return null;
  } catch {
    return null;
  }

  return url.toString();
}

function isBlockedHostname(hostname: string) {
  const normalized = hostname.replace(/\.$/, "").toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "metadata.google.internal" ||
    normalized === "169.254.169.254" ||
    isPrivateAddress(normalized)
  );
}

function isPrivateAddress(value: string) {
  const version = isIP(value);
  if (version === 4) return isPrivateIpv4(value);
  if (version === 6) return isPrivateIpv6(value);
  return false;
}

function isPrivateIpv4(value: string) {
  const parts = value.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isPrivateIpv6(value: string) {
  const normalized = value.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("ff")
  );
}

async function readResponsePrefix(response: Response, maxBytes: number) {
  if (!response.body) return response.text();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      const remaining = maxBytes - total;
      chunks.push(value.length > remaining ? value.slice(0, remaining) : value);
      total += Math.min(value.length, remaining);
      if (value.length > remaining) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(concatChunks(chunks, total));
}

function concatChunks(chunks: Uint8Array[], total: number) {
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function titleContent(html: string) {
  return html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
}

function metaContent(html: string, attributeName: "name" | "property", attributeValue: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const attributes = parseAttributes(tag);
    if (attributes[attributeName]?.toLowerCase() === attributeValue.toLowerCase()) {
      return attributes.content;
    }
  }

  return undefined;
}

function parseAttributes(tag: string) {
  const attributes: Record<string, string> = {};
  const pattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(tag))) {
    attributes[match[1].toLowerCase()] = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function cleanText(value: string | undefined) {
  const cleaned = decodeHtmlEntities(String(value ?? ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? cleaned.slice(0, 180) : undefined;
}

function safeMetadataImageUrl(value: string | undefined, baseUrl: string) {
  if (!value) return undefined;

  try {
    const url = new URL(decodeHtmlEntities(value), baseUrl);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " "
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, body: string) => {
    const key = body.toLowerCase();
    if (key.startsWith("#x")) return safeCodePoint(Number.parseInt(key.slice(2), 16), entity);
    if (key.startsWith("#")) return safeCodePoint(Number.parseInt(key.slice(1), 10), entity);
    return named[key] ?? entity;
  });
}

function safeCodePoint(value: number, fallback: string) {
  if (!Number.isInteger(value) || value < 0 || value > 0x10ffff) return fallback;
  return String.fromCodePoint(value);
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}
