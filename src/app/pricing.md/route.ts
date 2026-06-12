const siteUrl = normalizeOrigin(process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "https://YOUR_PRODUCTION_DOMAIN");

export function GET() {
  return new Response(buildPricingMarkdown(siteUrl), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}

function buildPricingMarkdown(origin: string) {
  return `# Pricing - ID 도플갱어

Last updated: 2026-06-11

## Free Summary Scan
- Price: 0 KRW
- Includes: username validation, legitimate-purpose confirmation, summary score, rarity score, exposure score, impersonation-candidate signal, abandoned-account risk signal, category and country distribution, preview results, local deletion flow.
- Best for: checking whether a username, nickname, creator handle, or brand name needs deeper review.
- Start: ${origin}/

## First Detailed Report
- Price: 0 KRW for the first detailed report per browser owner token.
- Includes: full report access for one eligible scan, full result rows where available, risk labels, action guidance, HTML/PDF report download.
- Notes: Eligibility is browser-token based and intended for a one-time evaluation.

## Paid Detailed Report
- Price: configured through the live checkout provider after production launch.
- Includes: full result URLs where available, platform/category context, risk labels, action guidance, HTML/PDF report download, paid report entitlement.
- Payment provider: configured live checkout provider for web checkout when production keys are configured.
- Native app payments: disabled until Apple In-App Purchase and Google Play Billing products, receipt verification, sandbox purchases, restore flow, and review notes are production-ready.

## Monthly Monitoring
- Price: not publicly priced yet.
- Includes: browser-token ownership, monitored username list, due re-check workflow, cancellation/deletion flow.

## Safety And Scope
- ID 도플갱어 checks public username-string candidates only.
- It is not a people-search, identity-proof, location-inference, email-search, phone-search, or real-name-search service.
- Results do not prove that discovered accounts belong to the same person.

## Contact
- Privacy: ${origin}/privacy
- Responsible use: ${origin}/responsible-use
- Terms: ${origin}/terms
`;
}

function normalizeOrigin(value: string) {
  if (!value) return "https://YOUR_PRODUCTION_DOMAIN";
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value.replace(/\/$/, "");
  }
  return `https://${value.replace(/\/$/, "")}`;
}
