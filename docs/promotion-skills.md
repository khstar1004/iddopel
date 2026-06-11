# Promotion Skill Setup

This project is prepared to use Codex marketing skills after product launch.

## Installed Skills
Installed into `C:\Users\USER\.codex\skills` from `coreyhaines31/marketingskills`:

- `product-marketing`: canonical product context in `.agents/product-marketing.md`
- `marketing-plan`: 12-month GTM and AARRR planning
- `launch`: launch checklist, Product Hunt/beta/announcement planning
- `seo-audit`: technical and on-page SEO reviews
- `programmatic-seo`: scalable guide/use-case/comparison page planning
- `ai-seo`: AI search and answer engine optimization
- `schema`: JSON-LD and structured data planning
- `aso`: App Store and Google Play listing optimization
- `copywriting`: landing page and marketing copy
- `cro`: conversion review for landing, pricing, checkout, and report paywall
- `analytics`: GA4/GTM/GSC tracking plan and conversion measurement
- `customer-research`: ICP, review mining, VOC, and customer interview synthesis
- `competitors`: alternative/comparison pages and competitor positioning
- `cold-email`: human-reviewed B2B outbound email drafts
- `directory-submissions`: launch directory and backlink submission planning
- `free-tools`: engineering-as-marketing strategy for the free scan surface

## Deliberately Deferred
- Advertising MCPs and account-control skills: defer until production domain, GA4/GSC, ad accounts, and explicit approval rules are ready.
- Phone, SMS, LinkedIn automation, and fully autonomous sales agents: defer because this product needs tight responsible-use positioning and human review.
- `markster-os` full workspace: defer because it is a separate Git-backed GTM operating system, not just a lightweight skill install.
- Hyper MCP dependent skills: defer until Hyper MCP and required integrations are connected.

## Guardrails For Future Promotion
- Do not market the product as people search, identity proof, same-person probability, or deanonymization.
- Do not generate campaigns that encourage harassment, stalking, doxxing, or searching by real name, phone, email, resident-number-like values, location, images, or post content.
- Keep all outbound, ad publishing, budget changes, and campaign activation human-approved.
- Keep paid acquisition experiments paused/draft until tracking, conversion events, and daily budget caps are verified.

## Recommended Launch Order
1. Finish production domain, SSL, Toss/store credentials, and `release:production` checks.
2. Use `analytics`, `schema`, `seo-audit`, and `aso` before public launch.
3. Use `copywriting`, `cro`, and `launch` to refine the landing page, pricing/paywall, and announcement copy.
4. Use `programmatic-seo`, `ai-seo`, `competitors`, and `directory-submissions` after the public marketing pages are live.
5. Use `cold-email` only for human-reviewed outreach to clearly relevant creators, small brands, agencies, or founder communities.

Restart Codex after this setup so newly installed skills are available in future turns.
