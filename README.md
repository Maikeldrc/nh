<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# AMAVITA CareStart

AMAVITA CareStart uses Vercel only for static frontend assets. Authentication
and every request containing PHI go directly from the browser to Google Cloud.

```text
Vercel static frontend
  -> Google Identity Platform
  -> Cloud Run API
  -> service account
  -> private Google Sheets and Drive
```

## Security boundaries

- Do not add Vercel Functions, API routes, middleware, SSR, Server Actions,
  analytics, session replay, or error payload capture.
- Do not put PHI in URLs, route parameters, titles, metadata, logs, or errors.
- Do not expose Sheet IDs, Drive folder IDs, service account keys, or OAuth
  client secrets in `VITE_*` variables.
- Clinical data is held only in browser memory and is cleared on logout or
  refresh. Language preference is the only localStorage value.
- Cloud Run accepts public network traffic because Identity Platform tokens are
  not Google Cloud IAM tokens. Every `/v1/*` route verifies the ID token and the
  active application user before accessing data.

## Identity Platform

1. Enable Identity Platform in the same Google Cloud project covered by the
   applicable BAA.
2. Configure email/password or the organization's managed Google provider.
3. Add `nhcarestart.vercel.app` as an authorized domain.
4. Disable public self-signup operationally. Provision users through the
   authenticated admin endpoint.
5. Enable email enumeration protection, password policy, and MFA.
6. Create a Firebase Web App and copy only its public web configuration into
   Vercel using the names in `.env.example`.

The first admin must be created in Identity Platform and inserted manually in
the `Users` sheet with these fields:

```json
{
  "id": "usr_initial_admin",
  "identityUid": "IDENTITY_PLATFORM_UID",
  "email": "admin@example.com",
  "name": "Initial Administrator",
  "role": "ADMIN",
  "active": true,
  "mfaRequired": true,
  "facilityIds": [],
  "nursingHomeAccess": []
}
```

The API supports existing columns and adds `record_json` for the complete
server-side representation.

## Service account and private resources

Create a dedicated service account, for example:

```text
amavita-carestart-api@PROJECT_ID.iam.gserviceaccount.com
```

Share the production Sheet and the private PDF Drive folder only with that
service account. Do not enable link sharing. Grant the Cloud Run service account
only the runtime roles it needs, including permission to use Identity Platform
administration for user provisioning. Use Application Default Credentials;
never create or upload a JSON private key.

## Deploy Cloud Run

From the repository root:

```bash
gcloud builds submit ./cloud-run \
  --tag REGION-docker.pkg.dev/PROJECT_ID/amavita/carestart-api

gcloud run deploy amavita-carestart-api \
  --image REGION-docker.pkg.dev/PROJECT_ID/amavita/carestart-api \
  --region REGION \
  --service-account amavita-carestart-api@PROJECT_ID.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_CLOUD_PROJECT=PROJECT_ID,GOOGLE_SHEETS_SPREADSHEET_ID=SHEET_ID,GOOGLE_DRIVE_PDF_FOLDER_ID=DRIVE_FOLDER_ID,FRONTEND_ORIGINS=https://nhcarestart.vercel.app
```

`--allow-unauthenticated` only exposes the HTTPS entry point. Application access
remains protected because all `/v1/*` endpoints require and verify an Identity
Platform bearer token.

Enable the Google Sheets API, Google Drive API, Identity Toolkit API, Cloud Run,
Cloud Build, Artifact Registry, and Secret Manager APIs before deployment.

## Vercel

Set only these public values for Production:

```text
VITE_API_BASE_URL
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
```

Redeploy after changing variables. Do not configure the Sheet ID, Drive folder,
Apps Script URL, private keys, or OAuth client secret in Vercel.

## Local development

Use `.env.local` for the public frontend values:

```bash
npm install
npm run dev
```

The Cloud Run service uses the variables documented in
`cloud-run/.env.example`. Use `gcloud auth application-default login` only for
local backend development.

## Verification

```bash
npm run lint
npm run build
cd cloud-run
npm install
npm run check
npm test
```
