# QA Test Matrix

Date: 2026-07-12
Environment: Production

| Test ID | Module | Feature | Test Type | Priority | Role | Preconditions | Test Data | Steps | Expected Result | Actual Result | Status | Defect ID | Evidence | Last Run | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| QA-TC-001 | Auth | Login page render | E2E | Critical | Public | None | none | Open `/` | Login form visible | Login form visible desktop/mobile | Passed |  | screenshots local | 2026-07-12 | Three serial production runs passed. |
| QA-TC-002 | Auth | Invalid login | E2E/Security | High | Public | None | `qa_auto_invalid_user@example.test` | Submit wrong credentials | Generic error, no secrets | Generic error, no secrets | Passed | QA-DEF-002, QA-DEF-004 fixed | `qa-evidence/screenshots/*login-invalid.png` local | 2026-07-12 | No brute force. |
| QA-TC-003 | Auth | Valid login | E2E | Critical | ADMIN | Test credential provided | Existing QA user | Submit valid credentials | Dashboard loads | Dashboard loaded desktop/mobile | Passed | QA-DEF-003 fixed | `qa-evidence/screenshots/*dashboard-authenticated.png` local | 2026-07-12 | Three serial production runs passed. |
| QA-TC-004 | Accessibility | Dashboard axe scan | Accessibility | High | ADMIN | Logged in | Existing QA user | Run axe scan | No serious/critical violations | No serious/critical violations after fix | Passed | QA-DEF-003 fixed | Playwright JSON local | 2026-07-12 | Color contrast excluded pending full visual pass. |
| QA-TC-005 | Backend | Syntax check | Static | Critical | N/A | Repo available | none | `npm --prefix cloud-run run check` | Pass | Pass | Passed |  | Console log | 2026-07-12 |  |
| QA-TC-006 | Backend | Validation unit tests | Unit | Critical | N/A | Repo available | synthetic fixtures | `npm --prefix cloud-run test` | Pass | 7 passed | Passed |  | Console log | 2026-07-12 |  |
| QA-TC-007 | Frontend | TypeScript build | Static | Critical | N/A | Repo available | none | `npm run lint && npm run build` | Pass | Pass with chunk warning | Passed |  | Console log | 2026-07-12 |  |
| QA-TC-008 | Security | Dependency audit high+ | Security | High | N/A | Repo available | none | `npm audit --audit-level=high` | No high/critical | No high/critical; 2 moderate | Passed |  | Console log | 2026-07-12 | Moderate findings documented separately. |
| QA-TC-009 | API | Public `/healthz` | API | High | Public | Backend reachable | none | GET `/healthz` | 200 `{ok:true}` | Cloud Run service Ready, but direct health URL returned Google 404 from this environment | Failed | QA-DEF-005 | command output | 2026-07-12 | App authenticated bootstrap works through frontend; direct health discrepancy remains. |
| QA-TC-010 | Patient | Synthetic patient create/edit | E2E | Critical | ADMIN/NURSE | Logged in | `QA_AUTO_PATIENT_001` | Create, verify, edit | Persisted synthetic record | Pending | Not Run |  |  | 2026-07-12 | Cleanup policy required. |
