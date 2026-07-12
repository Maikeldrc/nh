# QA Defects

Date: 2026-07-12

| Defect ID | Title | Module | Severity | Priority | Environment | Status | Evidence | Root Cause | Fix | Regression |
|---|---|---|---|---|---|---|---|---|---|---|
| QA-DEF-001 | QA tooling missing from repository | QA Automation | Medium | High | Local | Closed | package.json, Playwright config | No automated production smoke harness existed | Added Playwright production config and smoke tests | Production smoke executed |
| QA-DEF-002 | CSP blocks Google Fonts stylesheet | Frontend Security | Medium | High | Production | Closed | Playwright console error in invalid-login smoke | `src/index.css` imported `fonts.googleapis.com` while CSP allowed only self/inline styles | Removed external font import and switched to system font stacks | Passed in production smoke |
| QA-DEF-003 | Dashboard select controls lack accessible names | Accessibility | High | High | Production | Closed | Axe `select-name` critical and `label-title-only` serious findings | Filter and reassignment `<select>` elements had no explicit accessible name | Added `aria-label` to dashboard filters and nurse reassignment selects | Passed in production axe smoke |
| QA-DEF-004 | CSP blocks Firebase Google API script/connect on mobile | Auth/Security Headers | High | High | Production | Closed | Mobile Playwright console errors for `https://apis.google.com/js/api.js` and `https://apis.google.com/js/gen_204` | CSP `script-src` and `connect-src` did not allow the exact Firebase Google API bridge origin | Added exact `https://apis.google.com` to script and connect sources in `vercel.json` | Passed in three serial production smoke runs |
| QA-DEF-005 | Direct Cloud Run `/healthz` returns Google 404 from QA machine | API/Deployment | Medium | High | Production | Open | `Invoke-WebRequest` to both Cloud Run URLs returned 404 HTML | Unknown; Cloud Run reports service Ready and frontend authenticated API flow works | Not fixed in this cycle | Needs Cloud Run/domain routing investigation |

Open Critical: 0
Open High: 0
Open Medium: 1 (`QA-DEF-005`)
