import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  adminAuditRequestKey,
  FileAdminAuditLogStore,
  listAdminAuditEvents,
  recordAdminAuditEvent,
  resetAdminAuditLogStoreForTests
} from "./admin-audit-log";

describe("admin audit log", () => {
  let dir: string | null = null;

  afterEach(async () => {
    resetAdminAuditLogStoreForTests(null);
    if (dir) await rm(dir, { recursive: true, force: true });
    dir = null;
  });

  it("records sanitized admin setting changes", async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "admin-audit-log-"));
    resetAdminAuditLogStoreForTests(new FileAdminAuditLogStore(path.join(dir, "audit.json")));
    const request = new Request("https://id.example.com/admin", {
      headers: {
        "x-forwarded-for": "203.0.113.9",
        "user-agent": "Vitest Browser"
      }
    });

    const event = await recordAdminAuditEvent(request, {
      action: "scan_settings.update",
      actor: "admin",
      changes: {
        freeScanLimit: { before: 5, after: 9 },
        publicScanEnabled: { before: true, after: false }
      }
    });
    const events = await listAdminAuditEvents(10);

    expect(event?.requestKeyHash).toHaveLength(64);
    expect(event?.requestKeyHash).not.toContain("203.0.113.9");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "scan_settings.update",
      actor: "admin",
      changes: {
        freeScanLimit: { before: 5, after: 9 },
        publicScanEnabled: { before: true, after: false }
      }
    });
  });

  it("does not create events for empty change sets", async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "admin-audit-empty-"));
    resetAdminAuditLogStoreForTests(new FileAdminAuditLogStore(path.join(dir, "audit.json")));

    const event = await recordAdminAuditEvent(new Request("https://id.example.com/admin"), {
      action: "scan_settings.update",
      changes: {}
    });

    expect(event).toBeNull();
    expect(await listAdminAuditEvents()).toEqual([]);
  });

  it("builds stable hashed request keys from request identity", () => {
    const request = new Request("https://id.example.com/admin", {
      headers: {
        "x-real-ip": "198.51.100.8",
        "user-agent": "Vitest Browser"
      }
    });

    expect(adminAuditRequestKey(request)).toBe(adminAuditRequestKey(request));
    expect(adminAuditRequestKey(request)).toHaveLength(64);
  });
});
