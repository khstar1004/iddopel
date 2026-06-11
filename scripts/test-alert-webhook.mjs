const webhookUrl = process.env.ALERT_WEBHOOK_URL?.trim() ?? "";
const provider = ["generic", "slack", "discord"].includes(process.env.ALERT_WEBHOOK_PROVIDER)
  ? process.env.ALERT_WEBHOOK_PROVIDER
  : "generic";
const runbookUrl = process.env.ALERT_RUNBOOK_URL?.trim() ?? "";
const timeoutMs = clamp(Number(process.env.ALERT_WEBHOOK_TIMEOUT_MS || "1500"), 250, 5000);

async function main() {
  assertHttps(webhookUrl, "ALERT_WEBHOOK_URL must be an HTTPS webhook URL.");
  if (runbookUrl) assertHttps(runbookUrl, "ALERT_RUNBOOK_URL must be HTTPS when set.");

  const payload = buildPayload({
    provider,
    runbookUrl,
    summary: "[ID 도플갱어] launch alert route test",
    fields: [
      `release=${process.env.RELEASE_VERSION || "manual-test"}`,
      `env=${process.env.NODE_ENV || "production"}`,
      `sentAt=${new Date().toISOString()}`,
      runbookUrl ? `runbook=${runbookUrl}` : null
    ].filter(Boolean)
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const report = {
      ok: response.ok,
      status: response.status,
      provider,
      webhookHost: new URL(webhookUrl).hostname
    };
    console.log(JSON.stringify(report, null, 2));
    if (!response.ok) process.exit(1);
  } finally {
    clearTimeout(timer);
  }
}

function buildPayload({ provider, summary, fields, runbookUrl }) {
  if (provider === "slack") {
    return {
      text: summary,
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: `*${summary}*` } },
        { type: "section", text: { type: "mrkdwn", text: fields.map((field) => `\`${field}\``).join("\n") } }
      ]
    };
  }

  if (provider === "discord") {
    return {
      content: summary,
      embeds: [{ title: "Launch alert route test", description: fields.join("\n"), color: 15_167_430 }]
    };
  }

  return {
    event: "id_doppelganger_alert_test",
    summary,
    severity: "page",
    fields,
    runbookUrl: runbookUrl || undefined
  };
}

function assertHttps(value, message) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return;
  } catch {
    // Fall through to the user-facing error below.
  }

  throw new Error(message);
}

function clamp(value, minimum, maximum) {
  if (!Number.isFinite(value)) return 1500;
  return Math.min(Math.max(value, minimum), maximum);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
