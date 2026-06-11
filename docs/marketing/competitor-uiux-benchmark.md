# Competitor UI/UX Benchmark

Last updated: 2026-06-11

## What To Copy

| Service | Current signal | What ID 도플갱어 should copy |
| --- | --- | --- |
| Namechk | Username/domain availability starts with a simple search box and turns each channel into a scannable status tile. | Keep the input obvious, make platform candidates card-like, and make the first result screen readable without opening a report. |
| WhatsMyName.io | Public username search is framed as research leads, not identity proof. | Keep the same safety boundary everywhere: 공개 username 흔적, not 동일인 계정. |
| Apify Maigret Actor | Sells Maigret as a large-site username scan with exposure score, category breakdown, and dossier-style output. | Use Maigret aggressively for real scans, but translate raw dossier output into Korean result cards, risk labels, and HTML/PDF reports. |
| FootprintIQ | Groups findings by category/risk and gives an action plan instead of only a hit list. | Put cleanup hints and action guidance directly on result cards and in the detailed report. |
| Maigret iOS | Mobile positioning emphasizes quick dossier collection from many websites. | Keep the mobile shell simple and report-driven, while avoiding people-search claims that could create review risk. |

## Product Decisions From The Benchmark

- Results come before scores. Users want to know what was found first; rarity/exposure scores are supporting interpretation below the candidate cards.
- The primary CTA is `내 아이디 흔적 찾기`, not a score-focused CTA.
- Free output should show useful candidate cards immediately, then use locked/mosaic rows for the remaining detailed URLs after the first free report.
- The detailed report should expose Maigret HTML/PDF output in the product screen, not only as a file download.
- Every surface must repeat the boundary: this is username-string checking and does not prove that accounts belong to the same person.

## Source URLs Checked

- Namechk: https://namechk.com/
- WhatsMyName.io: https://whatsmyname.io/
- Apify Maigret Actor: https://apify.com/apivault_labs/maigret-username-osint/input-schema
- FootprintIQ digital footprint scanner: https://footprintiq.app/digital-footprint-scanner
- Maigret iOS App Store listing: https://apps.apple.com/in/app/maigret-username-osint-tools/id6443857922
