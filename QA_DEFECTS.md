# QA Defects

Date: 2026-07-13

| Defect ID | Title | Module | Severity | Priority | Environment | Status | Evidence | Root Cause | Fix | Regression |
|---|---|---|---|---|---|---|---|---|---|---|
| QA-DEF-001 | QA tooling missing from repository | QA Automation | Medium | High | Local | Closed | package.json, Playwright config | No automated production smoke harness existed | Added Playwright production config and smoke tests | Production smoke executed |
| QA-DEF-002 | CSP blocks Google Fonts stylesheet | Frontend Security | Medium | High | Production | Closed | Playwright console error in invalid-login smoke | `src/index.css` imported `fonts.googleapis.com` while CSP allowed only self/inline styles | Removed external font import and switched to system font stacks | Passed in production smoke |
| QA-DEF-003 | Dashboard select controls lack accessible names | Accessibility | High | High | Production | Closed | Axe `select-name` critical and `label-title-only` serious findings | Filter and reassignment `<select>` elements had no explicit accessible name | Added `aria-label` to dashboard filters and nurse reassignment selects | Passed in production axe smoke |
| QA-DEF-004 | CSP blocks Firebase Google API script/connect on mobile | Auth/Security Headers | High | High | Production | Closed | Mobile Playwright console errors for `https://apis.google.com/js/api.js` and `https://apis.google.com/js/gen_204` | CSP `script-src` and `connect-src` did not allow the exact Firebase Google API bridge origin | Added exact `https://apis.google.com` to script and connect sources in `vercel.json` | Passed in three serial production smoke runs |
| QA-DEF-005 | Direct Cloud Run `/healthz` returns Google 404 from QA machine | API/Deployment | Medium | High | Production | Open | `Invoke-WebRequest` to both Cloud Run URLs returned 404 HTML | Unknown; Cloud Run reports service Ready and frontend authenticated API flow works | Not fixed in this cycle | Needs Cloud Run/domain routing investigation |
| QA-DEF-006 | Rapid repeated production logins can produce transient bootstrap 429 | API/Rate Limit | Low | Medium | Production | Open | Full Playwright rerun observed one recovered `429 /v1/bootstrap` for physician after multiple serial logins | Production rate limit or upstream quota under concentrated QA login load | No product fix applied; test treats recovered bootstrap 429 as non-blocking | Final full suite passed |
| QA-DEF-007 | Consent PDF generation fails and blocks nurse visit wizard progression | Documents/PDF | High | High | Production | Closed | Full UI journey originally failed on `/v1/pdfs`; latest validated run completed consent PDF, RPM delivery PDF generation, RPM PDF regeneration, and patient activation | Google Sheets/Drive transient rate limiting plus backend cache race. `listRecords` could read a pending cache entry as completed, and PDF audit logging could block the PDF response. | Made PDF audit logging non-blocking, added sanitized diagnostics, fixed pending-cache handling, reduced record cache TTL, and extended Google Sheets retry backoff with jitter. Deployed Cloud Run revision `amavita-carestart-api-00023-mf9`. | `QA_FULL_UI=1 npx playwright test tests/qa/full-ui-journey.spec.ts --config=playwright.production.config.ts --project=chromium-desktop --grep "admin and nurse"` passed |

Open Critical: 0
Open High: 0
Open Medium: 1 (`QA-DEF-005`)
Open Low: 1 (`QA-DEF-006`)
