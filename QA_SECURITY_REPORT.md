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

- `npm audit --audit-level=high` passes. Two moderate advisories remain through `exceljs -> uuid`.
- `npm audit fix --force` was intentionally not applied because it would install `exceljs@3.4.0`, a breaking downgrade from the current 4.x dependency.
- Production console previously reported CSP blocking a Google Fonts stylesheet. The fix removes the remote font import instead of broadening CSP.
- Mobile production smoke previously reported CSP blocking `https://apis.google.com/js/api.js` and a `gen_204` connection, used by Firebase/Identity Platform. The deployed fix permits only `https://apis.google.com` in `script-src` and `connect-src`.
- Production authorization tests now cover unauthenticated `/v1/bootstrap` rejection, nurse user-creation rejection, physician user-creation rejection, and invalid patient validation rejection.
- Secrets scan is pending.

## Status

Production security checks passed for invalid login error disclosure, CSP console errors on tested flows, role authorization boundaries tested, validation rejection, and no high/critical dependency audit findings. Full IDOR/destructive-action matrix remains pending.
