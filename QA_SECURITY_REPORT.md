# QA Security Report

Date: 2026-07-12
Environment: Production and local static review

## Controls Observed

- Backend requires Firebase ID token on `/v1/*`.
- Backend maps identity token to provisioned app user before data access.
- Backend enforces role-based and facility/patient-based access checks.
- Error handler avoids logging bodies, tokens, patient identifiers, and exception payloads.
- Vercel CSP restricts script sources to self and connect sources to Google/Firebase/Run domains.
- Frontend documented environment policy forbids secrets in `VITE_*`.

## Findings

- `npm audit` currently reports 2 moderate vulnerabilities. No high/critical finding has been confirmed yet.
- Production console reported CSP blocking a Google Fonts stylesheet. This is not a data exposure issue, but it is a policy/configuration defect and causes console errors. Local fix removes the remote font import instead of broadening CSP.
- Mobile production smoke reported CSP blocking `https://apis.google.com/js/api.js` and a `gen_204` connection, used by Firebase/Identity Platform. The deployed fix permits only `https://apis.google.com` in `script-src` and `connect-src`.
- Full production authorization matrix is pending authenticated API tests.
- Secrets scan is pending.

## Status

Production smoke security checks passed for invalid login error disclosure, CSP console errors on tested flows, and no high/critical dependency audit findings. Full authorization matrix remains pending; security validation is not complete.
