# QA Architecture

Date: 2026-07-12
Production URL: https://nhcarestart.vercel.app/

## Component Diagram

```text
Browser
  -> Vercel static React/Vite frontend
  -> Firebase / Google Identity Platform
  -> Google Cloud Run API (Express)
  -> Google Sheets repository
  -> Google Drive PDF storage
```

## Frontend

- Framework: React 19 with Vite.
- Styling: Tailwind CSS classes through `@tailwindcss/vite`.
- Authentication client: Firebase Auth browser SDK with session persistence.
- Main router: state-based views in `src/App.tsx`, not URL route based.
- Primary modules: login, admin dashboard, nurse dashboard, patient profile, visit wizard, medical order review, user management, ICD-10 catalog management/import.

## Backend

- Runtime: Node.js 20 on Cloud Run.
- Framework: Express 5.
- Security middleware: Helmet, CORS allowlist, Firebase Admin ID token verification.
- Endpoints:
  - `GET /healthz`
  - `GET /v1/bootstrap`
  - `GET /v1/:resource`
  - `PUT /v1/:resource/:id`
  - `POST /v1/activity-log`
  - `POST /v1/users`
  - `PATCH /v1/users/:id`
  - `POST /v1/pdfs`
  - `GET /v1/documents/:id/content`

## Data Stores

- Google Sheets stores structured records via `cloud-run/src/repository.js`.
- Google Drive stores generated PDF binaries.
- Frontend stores hydrated records in browser memory through `src/utils/db.ts`; no PHI localStorage was observed in code.

## Authentication And Authorization

- Firebase Auth signs users in.
- Cloud Run verifies ID tokens with Firebase Admin.
- App users are provisioned in the `users` sheet.
- Role model: `ADMIN`, `NURSE`, `PHYSICIAN`, `VIEWER`, `AUDITOR`.
- Patient access is enforced by role, assigned nurse, `nursingHomeAccess`, `facilityIds`, or patient-bound user.
- MFA is enforced server-side when `mfaRequired` is true and token lacks a second factor.

## Deployment

- Frontend: Vercel static deployment from Git, configured by `vercel.json`.
- Backend: Cloud Run service `amavita-carestart-api` in `us-central1`.
- Current known backend revision from previous deployment: `amavita-carestart-api-00016-f8v`.

## External Services

- Firebase / Identity Platform.
- Google Sheets API.
- Google Drive API.
- Cloud Run / Cloud Build / Artifact Registry.
- Vercel.

## Initial Risks

- Production QA depends on a valid test login and potential MFA policy.
- Vercel CLI token was previously invalid, so frontend deployment verification may depend on Git integration.
- Current Node local runtime is `20.14.0`; latest Vite React plugin warns it expects `^20.19.0 || >=22.12.0`.
- `npm audit` currently reports moderate vulnerabilities.
- Backend generic resource endpoint needs continued authorization and validation coverage.
