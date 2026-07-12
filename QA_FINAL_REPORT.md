# QA Final Report

Date: 2026-07-12
URL Validated: https://nhcarestart.vercel.app/
Commit: local full UI QA harness update pending commit

## Executive Summary

QA execution completed an expanded production cycle plus an attempted full UI journey. Role/API smoke coverage passed for admin, nurse, and physician users, and admin-only/physician restriction UI passed. The full nurse enrollment journey is blocked in production by consent PDF generation failure.

## Scope

Modules in scope: authentication, admin dashboard, nurse dashboard, patient registration, patient profile, visit wizard, medical orders, documents/PDFs, audit logs, users, ICD-10 catalog, backend APIs.

## Test Results

- Production Playwright: 12 passed, 6 skipped intentionally
- Full UI journey: blocked at nurse Step 3 consent PDF generation
- Admin-only/physician restriction UI: passed
- Frontend TypeScript: passed
- Frontend production build: passed
- Backend syntax check: passed
- Backend unit tests: 7 passed
- Security audit: no high/critical findings

## Defects

- Defects found: 7
- Defects fixed and production validated: 4
- Critical open: 0 known
- High open: 1
- Medium open: 1
- Low open: 1

## Production Validation

- Frontend: accessible at `https://nhcarestart.vercel.app/`.
- Backend: Cloud Run reports revision `amavita-carestart-api-00017-x7b`, 100% traffic, Ready=True.
- Health endpoint: direct `/healthz` checks to both Cloud Run URLs returned Google 404 HTML from this QA machine; recorded as QA-DEF-005.
- Authentication: invalid login and valid login smoke passed on desktop/mobile.
- Roles: admin, nurse, and physician authenticated and showed role-appropriate dashboards on desktop/mobile.
- Authorization/API: unauthenticated API access rejected; nurse/physician user-creation attempts rejected; invalid patient payload rejected; synthetic admin patient creation succeeded.
- Full UI journey: admin patient registration, admin medical order review/approval, nurse Step 1 identity, Step 2 explanation, typed patient signature, and nurse attestation were exercised.
- Blocking failure: consent PDF generation fails with generic secure service error, preventing nurse from advancing to RPM device and activation.
- Accessibility: authenticated dashboard axe smoke passed after select labeling fix.
- Console/network: no critical console/network errors in final three serial smoke runs.

## Security

Security review covered CSP/auth smoke, dependency audit, unauthenticated API rejection, role boundary checks for user creation, and backend validation rejection. Full IDOR and destructive-action matrix remains pending.

## Residual Risks

- Direct Cloud Run `/healthz` returns 404 from QA machine despite service Ready and frontend authenticated `/v1/*` flow working.
- Consent PDF generation blocks the visit wizard; cannot certify consent, RPM PDF, activation, or final patient active state until fixed.
- Synthetic production records were retained as evidence and should be cleaned up after audit sign-off.
- Full AUDITOR/VIEWER matrix remains pending because credentials were not supplied.
- Full PDF visual/content verification remains pending.
- Moderate `exceljs -> uuid` dependency advisory remains.
- Rapid repeated production logins produced one transient 429 that recovered; consider quota/backoff review for sustained QA load.

## Final Decision

NOT APPROVED FOR FULL OPERATION. Tested smoke/role/admin-only flows pass, but the full nurse enrollment flow is blocked by `QA-DEF-007`.
