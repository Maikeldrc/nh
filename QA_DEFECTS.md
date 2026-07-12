# QA Defects

Date: 2026-07-12

| Defect ID | Title | Module | Severity | Priority | Environment | Status | Evidence | Root Cause | Fix | Regression |
|---|---|---|---|---|---|---|---|---|---|---|
| QA-DEF-001 | QA tooling missing from repository | QA Automation | Medium | High | Local | Fixed locally | package.json, Playwright config | No automated production smoke harness existed | Added Playwright production config and smoke tests | Pending first run |
| QA-DEF-002 | CSP blocks Google Fonts stylesheet | Frontend Security | Medium | High | Production | Fixed locally | Playwright console error in invalid-login smoke | `src/index.css` imported `fonts.googleapis.com` while CSP allowed only self/inline styles | Removed external font import and switched to system font stacks | Pending redeploy and production rerun |
| QA-DEF-003 | Dashboard select controls lack accessible names | Accessibility | High | High | Production | Fixed locally | Axe `select-name` critical and `label-title-only` serious findings | Filter and reassignment `<select>` elements had no explicit accessible name | Added `aria-label` to dashboard filters and nurse reassignment selects | Pending redeploy and production rerun |
| QA-DEF-004 | CSP blocks Firebase Google API script on mobile | Auth/Security Headers | High | High | Production | Fixed locally | Mobile Playwright console error for `https://apis.google.com/js/api.js` | CSP `script-src` allowed only `'self'`, but Firebase Auth mobile flow loads the Google API bridge script | Added exact `https://apis.google.com` script source in `vercel.json` | Pending redeploy and production rerun |

Open Critical: 0
Open High: 2 pending production validation (`QA-DEF-003`, `QA-DEF-004`)
