# QA Final Report

Date: 2026-07-12
URL Validated: https://nhcarestart.vercel.app/
Commit: 4994577 plus local QA harness update pending commit

## Executive Summary

QA execution completed one controlled cycle. The repository was inspected, initial architecture and functional inventory were created, production smoke automation was added, three production defects were corrected and deployed, and the smoke suite passed three consecutive serial production runs. The application is not fully approved because the prompt's full functional, role, API, document, visual, accessibility, privacy, and business-rule matrix has not been exhaustively completed.

## Scope

Modules in scope: authentication, admin dashboard, nurse dashboard, patient registration, patient profile, visit wizard, medical orders, documents/PDFs, audit logs, users, ICD-10 catalog, backend APIs.

## Test Results

- Total tests in matrix: 10 initial
- Passed: 7
- Failed: 1
- Blocked: 0
- Not run: 2

## Defects

- Defects found: 5
- Defects fixed and production validated: 4
- Critical open: 0 known
- High open: 0 known
- Medium open: 1
- Low open: 0 known

## Production Validation

- Frontend: accessible at `https://nhcarestart.vercel.app/`.
- Backend: Cloud Run reports revision `amavita-carestart-api-00017-x7b`, 100% traffic, Ready=True.
- Health endpoint: direct `/healthz` checks to both Cloud Run URLs returned Google 404 HTML from this QA machine; recorded as QA-DEF-005.
- Authentication: invalid login and valid login smoke passed on desktop/mobile.
- Accessibility: authenticated dashboard axe smoke passed after select labeling fix.
- Console/network: no critical console/network errors in final three serial smoke runs.

## Security

Security review is partial. CSP defects on tested auth flows were corrected, and dependency audit has no high/critical findings. Full authorization and IDOR matrix remains pending.

## Residual Risks

- Direct Cloud Run `/healthz` returns 404 from QA machine despite service Ready and frontend authenticated flow working.
- Synthetic patient create/edit/delete and PDF generation flows were not completed in this cycle.
- Full role matrix for NURSE, PHYSICIAN, AUDITOR, VIEWER was not completed.
- Full API negative matrix was not completed.
- Moderate `exceljs -> uuid` dependency advisory remains.

## Final Decision

NOT APPROVED
