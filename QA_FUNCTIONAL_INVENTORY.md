# QA Functional Inventory

Date: 2026-07-12
Environment: Production

| ID | Module | Screen | Route | Feature | Role | Preconditions | APIs | Entities | Criticality | Coverage | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| FI-001 | Auth | Login | `/` | Email/password login | All provisioned users | Firebase configured | Firebase Auth, `/v1/bootstrap` | users | Critical | Automated smoke | Invalid and valid login covered by Playwright smoke. |
| FI-002 | Auth | Login | `/` | Language switch ES/EN | Public | None | None | none | Low | Automated smoke | Smoke switches to EN. |
| FI-003 | Dashboard | Admin dashboard | state view | KPI cards, patient list, filters | ADMIN, PHYSICIAN | Authenticated | `/v1/bootstrap` | patients, documents, audit-log | Critical | Pending deeper E2E | Code inventory complete, production interaction pending. |
| FI-004 | Dashboard | Nurse dashboard | state view | Assigned patient worklist | NURSE | Authenticated nurse | `/v1/bootstrap` | patients | Critical | Not run | Needs nurse credentials or role-switch user. |
| FI-005 | Patient registration | Modal | state modal | Create synthetic patient | ADMIN, NURSE | Authenticated | `PUT /v1/patients/:id` | patients, activity-log | Critical | Planned | Must use `QA_AUTO_` prefix. |
| FI-006 | Medical orders | Modal/profile/dashboard | state modal | Generate, approve, reject medical order | ADMIN, PHYSICIAN/NURSE by flow | Patient requiring RPM | `PUT /v1/patients/:id`, `POST /v1/pdfs` | patients, documents | Critical | Pending | Backend restricts physician to medical-order-only patient updates. |
| FI-007 | Visit wizard | Wizard | state view | Identity, service explanation, consent, RPM device, activation | NURSE, ADMIN by access | Patient available | `PUT /v1/visits`, `PUT /v1/consents`, `PUT /v1/devices`, `POST /v1/pdfs` | visits, consents, devices, readings, documents | Critical | Pending | Includes regenerate RPM delivery PDF. |
| FI-008 | Documents | Dashboard/profile | state view | Download generated PDFs | Authorized patient reader | Existing document | `GET /v1/documents/:id/content` | documents | High | Pending | Cache-control no-store in backend. |
| FI-009 | Audit | Admin dashboard | state tab | View activity log | ADMIN, AUDITOR | Authenticated | `/v1/bootstrap`, `/v1/activity-log` | activity-log | High | Pending | User action writes append-only rows. |
| FI-010 | User management | Admin dashboard tab | state tab | Create/update users | ADMIN | Authenticated admin | `POST /v1/users`, `PATCH /v1/users/:id` | users | Critical | Pending | Must not create persistent test users unless cleanup is defined. |
| FI-011 | Clinical catalog | Admin dashboard tab | state tab | Manage condition groups and ICD-10 diagnoses | ADMIN | Authenticated admin | `PUT /v1/condition-groups/:id`, `PUT /v1/diagnoses/:id` | condition-groups, diagnoses | High | Pending | Backend validates duplicates and ICD-10 format. |
| FI-012 | Catalog import | Modal | state modal | Import ICD-10 catalog from spreadsheet | ADMIN | Valid spreadsheet file | `PUT /v1/catalog-imports/:id`, related resources | catalog-imports, diagnoses | Medium | Not run | File parsing is frontend-side. |
| FI-013 | API security | Backend | `/v1/*` | Token and role enforcement | All | ID token or none | All `/v1` endpoints | all | Critical | Partial automated/local | Needs production API negative tests with token. |
