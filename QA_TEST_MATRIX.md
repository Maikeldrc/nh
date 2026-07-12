# QA Test Matrix

Date: 2026-07-12
Environment: Production

| Test ID | Module | Feature | Test Type | Priority | Role | Preconditions | Test Data | Steps | Expected Result | Actual Result | Status | Defect ID | Evidence | Last Run | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| QA-TC-001 | Auth | Login page render | E2E | Critical | Public | None | none | Open `/` | Login form visible | Pending run | Not Run |  |  | 2026-07-12 | Playwright. |
| QA-TC-002 | Auth | Invalid login | E2E/Security | High | Public | None | `qa_auto_invalid_user@example.test` | Submit wrong credentials | Generic error, no secrets | Pending run | Not Run |  | `qa-evidence/screenshots/*login-invalid.png` | 2026-07-12 | No brute force. |
| QA-TC-003 | Auth | Valid login | E2E | Critical | ADMIN | Test credential provided | Existing QA user | Submit valid credentials | Dashboard loads | Dashboard loaded; axe failed after load | Failed | QA-DEF-003 | `qa-evidence/playwright-artifacts/*dashboard*` | 2026-07-12 | Credentials supplied out-of-band by user. |
| QA-TC-004 | Accessibility | Dashboard axe scan | Accessibility | High | ADMIN | Logged in | Existing QA user | Run axe scan | No serious/critical violations | Critical/serious select-name findings | Failed | QA-DEF-003 | Playwright JSON | 2026-07-12 | Color contrast temporarily excluded pending full visual pass. |
| QA-TC-005 | Backend | Syntax check | Static | Critical | N/A | Repo available | none | `npm --prefix cloud-run run check` | Pass | Pass | Passed |  | Console log | 2026-07-12 |  |
| QA-TC-006 | Backend | Validation unit tests | Unit | Critical | N/A | Repo available | synthetic fixtures | `npm --prefix cloud-run test` | Pass | 7 passed | Passed |  | Console log | 2026-07-12 |  |
| QA-TC-007 | Frontend | TypeScript build | Static | Critical | N/A | Repo available | none | `npm run lint && npm run build` | Pass | Pass with chunk warning | Passed |  | Console log | 2026-07-12 |  |
| QA-TC-008 | Security | Dependency audit high+ | Security | High | N/A | Repo available | none | `npm audit --audit-level=high` | No high/critical | No high/critical; 2 moderate | Passed |  | Console log | 2026-07-12 | Moderate findings documented separately. |
| QA-TC-009 | API | Unauthenticated `/v1/bootstrap` | API/Security | Critical | Public | Backend reachable | none | GET without token | 401 | Pending | Not Run |  |  | 2026-07-12 | Requires reliable Cloud Run URL access. |
| QA-TC-010 | Patient | Synthetic patient create/edit | E2E | Critical | ADMIN/NURSE | Logged in | `QA_AUTO_PATIENT_001` | Create, verify, edit | Persisted synthetic record | Pending | Not Run |  |  | 2026-07-12 | Cleanup policy required. |
