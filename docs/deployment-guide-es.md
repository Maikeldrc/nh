# Guia paso a paso para configurar y desplegar AMAVITA CareStart

Esta guia esta escrita para una persona con conocimientos basicos, sin asumir experiencia en DevOps.

El objetivo es dejar funcionando:

1. El frontend en Vercel.
2. La autenticacion en Google Identity Platform / Firebase Authentication.
3. El backend seguro en Google Cloud Run.
4. La base de datos inicial en Google Sheets.
5. Los PDFs privados en Google Drive.

La arquitectura final debe quedar asi:

```text
Usuario
  -> https://nhcarestart.vercel.app
  -> Login con Google Identity Platform / Firebase Auth
  -> Cloud Run API
  -> Service Account
  -> Google Sheets privado + Google Drive privado
```

Importante:

- Vercel solo sirve archivos estaticos del frontend.
- Vercel no debe recibir secretos, PHI, IDs privados de Sheets, IDs de Drive ni llaves privadas.
- Todo dato clinico debe pasar por Cloud Run.
- Cloud Run valida el token del usuario antes de leer o escribir en Google Sheets.

---

## 0. Datos que debes tener a mano

Antes de empezar, abre un documento temporal y guarda estos valores. Los vas a ir llenando paso a paso:

```text
PROJECT_ID=itera-tools
REGION=us-central1
SERVICE_NAME=amavita-carestart-api
SHEET_ID=1JnQwDU2tmqJPMLtIEJC_JI8AsK96VSJtz1HUOlYmK2
DRIVE_FOLDER_ID=1Ge-YsoXJxA0av-nRmUvSHICdwvjLwT6Y
CLOUD_RUN_URL=
VERCEL_URL=https://nhcarestart.vercel.app

VITE_API_BASE_URL=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=

FIRST_ADMIN_EMAIL=
FIRST_ADMIN_UID=
SERVICE_ACCOUNT_EMAIL=amavita-carestart-api@itera-tools.iam.gserviceaccount.com
```

Recomendacion:

- Usa `us-central1` como region si no tienes una razon especifica para otra.
- No guardes secretos ni PHI en chats, notas publicas, tickets ni repositorios.

---

## 1. Preparar tu cuenta de Google Cloud

### 1.1 Entrar a Google Cloud Console

1. Abre:
   <https://console.cloud.google.com/>
2. Inicia sesion con la cuenta administradora del proyecto.
3. Arriba, en el selector de proyecto, selecciona tu proyecto.
4. Copia el `Project ID`.
5. Pegalo en tu lista:

```text
PROJECT_ID=tu-project-id
```

Ejemplo:

```text
PROJECT_ID=amavita-carestart-prod
```

### 1.2 Confirmar que el proyecto correcto tiene el BAA

Antes de subir PHI:

1. Confirma que el BAA con Google cubre este proyecto.
2. No uses otro proyecto personal o de pruebas para PHI.
3. Si tienes dudas, valida con la persona responsable de cumplimiento.

---

## 2. Usar Google Cloud Shell

Para evitar instalar herramientas en tu computadora, usaremos Google Cloud Shell.

### 2.1 Abrir Cloud Shell

1. En Google Cloud Console, busca el icono `>_` arriba a la derecha.
2. Haz clic en `Activate Cloud Shell`.
3. Espera a que abra una terminal en la parte inferior.

### 2.2 Configurar el proyecto en Cloud Shell

En Cloud Shell, pega este comando reemplazando `TU_PROJECT_ID`:

```bash
gcloud config set project TU_PROJECT_ID
```

Ejemplo:

```bash
gcloud config set project amavita-carestart-prod
```

Verifica:

```bash
gcloud config get-value project
```

Debe mostrar tu `PROJECT_ID`.

### 2.3 Definir variables para no repetir texto

En Cloud Shell, pega esto reemplazando `TU_PROJECT_ID`:

```bash
export PROJECT_ID="TU_PROJECT_ID"
export REGION="us-central1"
export SERVICE_NAME="amavita-carestart-api"
export ARTIFACT_REPO="amavita"
```

Verifica:

```bash
echo $PROJECT_ID
echo $REGION
```

---

## 3. Habilitar APIs necesarias

En Cloud Shell, ejecuta:

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  sheets.googleapis.com \
  drive.googleapis.com \
  identitytoolkit.googleapis.com \
  secretmanager.googleapis.com
```

Espera a que termine.

Si pregunta por permisos o confirmacion, acepta.

Estas APIs permiten:

- `Cloud Run`: ejecutar el backend.
- `Cloud Build`: construir la imagen del backend.
- `Artifact Registry`: guardar la imagen Docker.
- `Google Sheets API`: leer/escribir la base de datos.
- `Google Drive API`: guardar PDFs.
- `Identity Toolkit API`: validar usuarios de Identity Platform / Firebase Auth.
- `Secret Manager`: disponible para secretos futuros, aunque esta version no debe necesitar secretos en Vercel.

---

## 4. Crear el Google Sheet privado

### 4.1 Crear el archivo

1. Abre:
   <https://sheets.google.com/>
2. Crea un Google Sheet nuevo.
3. Nombre sugerido:

```text
AMAVITA CareStart Production Database
```

### 4.2 Copiar el Sheet ID

En la URL veras algo asi:

```text
https://docs.google.com/spreadsheets/d/1AbCDefGhIjKlMnOpQrStUvWxYz/edit
```

El Sheet ID es la parte entre `/d/` y `/edit`:

```text
1AbCDefGhIjKlMnOpQrStUvWxYz
```

Guardalo:

```text
SHEET_ID=1AbCDefGhIjKlMnOpQrStUvWxYz
```

### 4.3 Pestañas que usara la app

El backend puede crear las pestañas automaticamente, pero si quieres crearlas manualmente, usa estos nombres exactos:

```text
Patients
Facilities
Programs
Visits
Consents
Devices
Device Readings
Documents
Condition Groups
Diagnosis Catalog
Catalog Imports
Medical Orders
Device Activation
Medications
Users
Activity Log
```

No cambies los nombres. El backend los busca exactamente asi.

---

## 5. Crear carpeta privada para PDFs en Google Drive

### 5.1 Crear carpeta

1. Abre:
   <https://drive.google.com/>
2. Crea una carpeta.
3. Nombre sugerido:

```text
AMAVITA CareStart Private PDFs
```

### 5.2 Copiar el Drive Folder ID

La URL se vera asi:

```text
https://drive.google.com/drive/folders/1XyZAbCdEfGhIjKlMnOp
```

El folder ID es la parte final:

```text
1XyZAbCdEfGhIjKlMnOp
```

Guardalo:

```text
DRIVE_FOLDER_ID=1XyZAbCdEfGhIjKlMnOp
```

### 5.3 Seguridad de la carpeta

1. No actives `Anyone with the link`.
2. No la compartas con usuarios normales.
3. Mas adelante la compartiras solo con la service account de Cloud Run.

---

## 6. Crear la Service Account para Cloud Run

La service account es la identidad del backend. Cloud Run la usara para acceder al Sheet y Drive.

### 6.1 Crear service account

En Cloud Shell:

```bash
gcloud iam service-accounts create amavita-carestart-api \
  --display-name="AMAVITA CareStart API"
```

El email sera:

```text
amavita-carestart-api@PROJECT_ID.iam.gserviceaccount.com
```

Guardalo:

```text
SERVICE_ACCOUNT_EMAIL=amavita-carestart-api@PROJECT_ID.iam.gserviceaccount.com
```

Ejemplo:

```text
SERVICE_ACCOUNT_EMAIL=amavita-carestart-api@amavita-carestart-prod.iam.gserviceaccount.com
```

### 6.2 Dar acceso al Google Sheet

1. Abre el Google Sheet.
2. Clic en `Share`.
3. Pega el email de la service account.
4. Rol: `Editor`.
5. Desactiva notificacion si aparece.
6. Clic en `Share`.

### 6.3 Dar acceso a la carpeta de Drive

1. Abre la carpeta privada de Drive.
2. Clic derecho sobre la carpeta.
3. Clic en `Share`.
4. Pega el email de la service account.
5. Rol: `Editor`.
6. Clic en `Share`.

### 6.4 Permiso para administrar usuarios

Si quieres que el admin de la app pueda crear usuarios desde el sistema, la service account necesita permisos de Firebase Authentication / Identity Platform.

En Google Cloud Console:

1. Ve a `IAM & Admin`.
2. Clic en `Grant Access`.
3. Principal:

```text
amavita-carestart-api@PROJECT_ID.iam.gserviceaccount.com
```

4. Agrega el rol:

```text
Firebase Authentication Admin
```

En algunas consolas puede aparecer como:

```text
Identity Platform Admin
```

Si no vas a crear usuarios desde la app todavia, puedes dejar este paso para despues.

---

## 7. Configurar Identity Platform / Firebase Authentication

### 7.1 Abrir Identity Platform

1. En Google Cloud Console, busca `Identity Platform`.
2. Entra al servicio.
3. Si te pide habilitarlo, haz clic en `Enable`.

### 7.2 Configurar proveedor de login

Opcion simple inicial:

1. Ve a `Providers`.
2. Habilita `Email / Password`.
3. Guarda.

Opcion recomendada para produccion:

- Usar Google Workspace / proveedor corporativo.
- Requerir MFA.
- No permitir auto-registro publico.

### 7.3 Dominios autorizados

Agrega estos dominios:

```text
localhost
nhcarestart.vercel.app
```

Si usas otro dominio propio, agregalo tambien.

### 7.4 Crear Firebase Web App

Aunque uses Identity Platform, el frontend usa el SDK web de Firebase para iniciar sesion.

1. Abre:
   <https://console.firebase.google.com/>
2. Selecciona el mismo proyecto de Google Cloud.
3. En `Project settings`, busca `Your apps`.
4. Agrega una app web.
5. Nombre sugerido:

```text
AMAVITA CareStart Web
```

6. Copia la configuracion web.

Se vera parecida a:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "tu-project.firebaseapp.com",
  projectId: "tu-project",
  appId: "1:123:web:abc"
};
```

Guarda estos valores:

```text
VITE_FIREBASE_API_KEY=apiKey
VITE_FIREBASE_AUTH_DOMAIN=authDomain
VITE_FIREBASE_PROJECT_ID=projectId
VITE_FIREBASE_APP_ID=appId
```

Estos valores son publicos para el frontend. No son el OAuth client secret.

---

## 8. Crear el primer usuario admin

Necesitas un primer admin para entrar a la app.

### 8.1 Crear usuario en Firebase / Identity Platform

1. Abre Firebase Console o Identity Platform.
2. Ve a `Authentication` / `Users`.
3. Clic en `Add user`.
4. Email:

```text
admin@tu-dominio.com
```

5. Password temporal fuerte.
6. Guarda.

### 8.2 Copiar UID del usuario

En la lista de usuarios, abre el usuario admin y copia su `UID`.

Guardalo:

```text
FIRST_ADMIN_UID=uid_del_usuario
FIRST_ADMIN_EMAIL=admin@tu-dominio.com
```

### 8.3 Insertar admin en Google Sheets

Abre el Google Sheet.

Si no existe la pestaña `Users`, creala.

En la fila 1 pon estos headers:

```text
user_id	record_json	patient_id	facility_id	updated_at
```

Nota: son columnas separadas. En Google Sheets puedes pegarlas en una sola fila y Sheets las separara si usas tabs.

En la fila 2:

Columna `user_id`:

```text
usr_initial_admin
```

Columna `record_json`, reemplazando email y UID:

```json
{"id":"usr_initial_admin","user_id":"usr_initial_admin","identityUid":"FIRST_ADMIN_UID","email":"FIRST_ADMIN_EMAIL","name":"Initial Administrator","role":"ADMIN","active":true,"mfaRequired":false,"facilityIds":[],"nursingHomeAccess":[]}
```

Ejemplo:

```json
{"id":"usr_initial_admin","user_id":"usr_initial_admin","identityUid":"abc123uid","email":"admin@amavita.com","name":"Initial Administrator","role":"ADMIN","active":true,"mfaRequired":false,"facilityIds":[],"nursingHomeAccess":[]}
```

Importante:

- Para la primera prueba puedes dejar `mfaRequired:false`.
- Despues de validar el login y configurar MFA, cambia a `mfaRequired:true`.
- El `identityUid` debe coincidir exactamente con el UID del usuario en Firebase / Identity Platform.

---

## 9. Subir codigo a GitHub

La ruta mas sencilla es que Cloud Shell clone el repo desde GitHub.

### 9.1 Confirmar que el repo tiene el codigo actualizado

En tu PC, desde la carpeta del proyecto:

```powershell
cd "D:\Dev\Codex\Nursing Home\amavita-onboarding-app"
```

Verifica estado:

```powershell
git status
```

Si este repo usa el git alternativo creado por Codex, el comando interno usado en este workspace es:

```powershell
git --git-dir=.codex-git --work-tree=. status
```

Para subir a GitHub:

```powershell
git --git-dir=.codex-git --work-tree=. push origin main
```

El repo remoto esperado es:

```text
https://github.com/Maikeldrc/nh.git
```

---

## 10. Preparar Cloud Shell con el codigo

En Cloud Shell:

```bash
git clone https://github.com/Maikeldrc/nh.git
cd nh
```

Confirma que ves las carpetas:

```bash
ls
```

Debes ver algo como:

```text
cloud-run
src
package.json
vercel.json
```

---

## 11. Probar frontend y backend antes de desplegar

### 11.1 Probar frontend

En Cloud Shell, dentro del repo:

```bash
npm install
npm run lint
npm run build
```

Resultado esperado:

- `npm run lint` termina sin errores.
- `npm run build` crea la carpeta `dist`.

Puede aparecer advertencia de chunks grandes. Eso no bloquea el despliegue.

### 11.2 Probar backend

```bash
cd cloud-run
npm install
npm run check
npm test
cd ..
```

Resultado esperado:

- `npm run check` sin errores.
- `npm test` pasando.

---

## 12. Crear Artifact Registry

Artifact Registry guarda la imagen del backend.

En Cloud Shell:

```bash
gcloud artifacts repositories create $ARTIFACT_REPO \
  --repository-format=docker \
  --location=$REGION \
  --description="AMAVITA CareStart containers"
```

Si dice que ya existe, no pasa nada. Continua.

---

## 13. Construir imagen del backend

Desde la raiz del repo en Cloud Shell:

```bash
gcloud builds submit ./cloud-run \
  --tag $REGION-docker.pkg.dev/$PROJECT_ID/$ARTIFACT_REPO/carestart-api
```

Esto puede tardar varios minutos.

Resultado esperado:

```text
SUCCESS
```

---

## 14. Desplegar Cloud Run

Antes de ejecutar, define tus IDs:

```bash
export SHEET_ID="TU_SHEET_ID"
export DRIVE_FOLDER_ID="TU_DRIVE_FOLDER_ID"
export FRONTEND_ORIGINS="https://nhcarestart.vercel.app"
export SERVICE_ACCOUNT_EMAIL="amavita-carestart-api@$PROJECT_ID.iam.gserviceaccount.com"
```

Ahora despliega:

```bash
gcloud run deploy $SERVICE_NAME \
  --image $REGION-docker.pkg.dev/$PROJECT_ID/$ARTIFACT_REPO/carestart-api \
  --region $REGION \
  --service-account $SERVICE_ACCOUNT_EMAIL \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_SHEETS_SPREADSHEET_ID=$SHEET_ID,GOOGLE_DRIVE_PDF_FOLDER_ID=$DRIVE_FOLDER_ID,FRONTEND_ORIGINS=$FRONTEND_ORIGINS
```

Cuando pregunte:

```text
Allow unauthenticated invocations?
```

Responde:

```text
y
```

Por que se permite unauthenticated:

- El endpoint HTTPS debe poder recibir llamadas del navegador.
- Pero las rutas `/v1/*` validan el token de Firebase / Identity Platform.
- Sin token valido, Cloud Run debe responder `401` o `403`.

Al terminar, copia la URL que muestra Cloud Run.

Ejemplo:

```text
https://amavita-carestart-api-abc123-uc.a.run.app
```

Guardala:

```text
CLOUD_RUN_URL=https://amavita-carestart-api-abc123-uc.a.run.app
VITE_API_BASE_URL=https://amavita-carestart-api-abc123-uc.a.run.app
```

---

## 15. Probar Cloud Run

### 15.1 Health check

En Cloud Shell:

```bash
curl https://TU_CLOUD_RUN_URL/healthz
```

Reemplaza `TU_CLOUD_RUN_URL`.

Resultado esperado:

```json
{"ok":true}
```

### 15.2 Probar que las rutas privadas bloquean sin login

```bash
curl -i https://TU_CLOUD_RUN_URL/v1/bootstrap
```

Resultado esperado:

```text
401
```

Esto es correcto. Significa que la API no entrega datos sin token.

---

## 16. Configurar frontend local

Esto es para probar en tu computadora.

### 16.1 Crear `.env.local`

En:

```text
D:\Dev\Codex\Nursing Home\amavita-onboarding-app
```

Crea un archivo:

```text
.env.local
```

Contenido:

```env
VITE_API_BASE_URL="https://TU_CLOUD_RUN_URL"
VITE_FIREBASE_API_KEY="TU_FIREBASE_API_KEY"
VITE_FIREBASE_AUTH_DOMAIN="TU_PROJECT.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="TU_PROJECT_ID"
VITE_FIREBASE_APP_ID="TU_FIREBASE_APP_ID"
```

Ejemplo:

```env
VITE_API_BASE_URL="https://amavita-carestart-api-abc123-uc.a.run.app"
VITE_FIREBASE_API_KEY="AIza..."
VITE_FIREBASE_AUTH_DOMAIN="amavita-carestart-prod.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="amavita-carestart-prod"
VITE_FIREBASE_APP_ID="1:123456789:web:abc123"
```

### 16.2 Ejecutar local

En PowerShell:

```powershell
cd "D:\Dev\Codex\Nursing Home\amavita-onboarding-app"
npm install
npm run dev
```

Abre:

```text
http://localhost:3000/
```

Resultado esperado:

- Ves pantalla de login.
- Puedes iniciar sesion con el admin.
- Despues del login carga el dashboard.

Si ves:

```text
Identity Platform configuration is incomplete.
```

significa que falta o esta mal algun valor en `.env.local`.

---

## 17. Configurar Vercel

### 17.1 Importar repo

1. Abre:
   <https://vercel.com/>
2. Entra a tu cuenta.
3. Clic en `Add New Project`.
4. Importa:

```text
Maikeldrc/nh
```

### 17.2 Configuracion de build

Usa:

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

### 17.3 Variables de entorno en Vercel

En el proyecto de Vercel:

1. Ve a `Settings`.
2. Ve a `Environment Variables`.
3. Agrega estas variables para `Production`:

```env
VITE_API_BASE_URL="https://TU_CLOUD_RUN_URL"
VITE_FIREBASE_API_KEY="TU_FIREBASE_API_KEY"
VITE_FIREBASE_AUTH_DOMAIN="TU_PROJECT.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="TU_PROJECT_ID"
VITE_FIREBASE_APP_ID="TU_FIREBASE_APP_ID"
```

No agregues a Vercel:

```text
GOOGLE_SHEETS_SPREADSHEET_ID
GOOGLE_DRIVE_PDF_FOLDER_ID
SERVICE_ACCOUNT_EMAIL
OAuth client secret
Service account JSON
Private keys
PHI
```

### 17.4 Desplegar

1. Clic en `Deploy`.
2. Espera a que termine.
3. Abre:

```text
https://nhcarestart.vercel.app
```

Si el dominio final de Vercel es diferente, debes:

1. Agregar ese dominio en Identity Platform / Firebase Auth como authorized domain.
2. Agregarlo en `FRONTEND_ORIGINS` de Cloud Run.
3. Redesplegar o actualizar Cloud Run.

---

## 18. Actualizar FRONTEND_ORIGINS si cambia la URL de Vercel

Si tu URL real no es `https://nhcarestart.vercel.app`, actualiza Cloud Run:

```bash
gcloud run services update amavita-carestart-api \
  --region us-central1 \
  --update-env-vars FRONTEND_ORIGINS=https://TU_DOMINIO_REAL
```

Tambien puedes permitir local y produccion:

```bash
gcloud run services update amavita-carestart-api \
  --region us-central1 \
  --update-env-vars FRONTEND_ORIGINS=https://nhcarestart.vercel.app,http://localhost:3000
```

Para produccion estricta, deja solo el dominio real de Vercel.

---

## 19. Verificacion funcional completa

Haz estas pruebas en este orden:

### 19.1 Login

1. Abre `https://nhcarestart.vercel.app`.
2. Inicia sesion con el admin.
3. Debe cargar dashboard.

Si login falla:

- Revisa que el usuario exista en Firebase / Identity Platform.
- Revisa que el mismo UID exista en la pestaña `Users`.
- Revisa que `active` sea `true`.
- Revisa que `mfaRequired` no este en `true` antes de configurar MFA.

### 19.2 Google Sheets

Despues de entrar:

1. Abre el Sheet.
2. Verifica que existan o se creen pestañas.
3. Verifica que `Activity Log` reciba eventos.

### 19.3 Registrar paciente

1. En la app, registra un paciente.
2. Revisa la pestaña `Patients`.
3. Debe aparecer el registro con `record_json`.

### 19.4 Validacion CCM

Prueba registrar un paciente con programa que incluya CCM:

```text
CCM
CCM + RPM
CCM + PCM
CCM + RPM + PCM
```

Debe exigir al menos 2 diagnosticos ICD-10 validos.

Mensaje esperado:

```text
CCM requires at least 2 chronic conditions with valid ICD-10 codes.
```

### 19.5 PDFs

1. Genera un consentimiento o documento.
2. Revisa la carpeta privada de Drive.
3. Debe aparecer el PDF.
4. Verifica que no tenga link publico.

### 19.6 API sin token

Abre en navegador:

```text
https://TU_CLOUD_RUN_URL/v1/bootstrap
```

Debe bloquear acceso. Si muestra datos sin login, hay un problema serio.

---

## 20. Como crear usuarios nuevos

Ruta inicial simple:

1. Crear usuario en Firebase / Identity Platform.
2. Copiar UID.
3. Agregarlo a la pestaña `Users`.

Ejemplo de usuario nurse:

```json
{"id":"usr_nurse_001","user_id":"usr_nurse_001","identityUid":"UID_AQUI","email":"nurse@amavita.com","name":"Nurse Name","role":"NURSE","active":true,"mfaRequired":true,"facilityIds":["facility_001"],"nursingHomeAccess":["The Pearl at Fort Lauderdale Rehabilitation and Nursing Center"]}
```

Roles soportados:

```text
ADMIN
NURSE
PHYSICIAN
VIEWER
AUDITOR
```

Recomendacion:

- Admin: acceso operativo completo.
- Nurse: acceso a pacientes asignados o facilities permitidas.
- Physician: revisar/aprobar ordenes segun permisos.
- Viewer: solo lectura.
- Auditor: lectura/auditoria.

---

## 21. Actualizar el sistema en el futuro

Cuando haya cambios de codigo:

### 21.1 Subir cambios a GitHub

En tu PC:

```powershell
cd "D:\Dev\Codex\Nursing Home\amavita-onboarding-app"
git --git-dir=.codex-git --work-tree=. status
git --git-dir=.codex-git --work-tree=. add .
git --git-dir=.codex-git --work-tree=. commit -m "Describe el cambio"
git --git-dir=.codex-git --work-tree=. push origin main
```

### 21.2 Actualizar backend Cloud Run

En Cloud Shell:

```bash
cd nh
git pull
gcloud builds submit ./cloud-run \
  --tag $REGION-docker.pkg.dev/$PROJECT_ID/$ARTIFACT_REPO/carestart-api

gcloud run deploy $SERVICE_NAME \
  --image $REGION-docker.pkg.dev/$PROJECT_ID/$ARTIFACT_REPO/carestart-api \
  --region $REGION \
  --service-account $SERVICE_ACCOUNT_EMAIL \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_SHEETS_SPREADSHEET_ID=$SHEET_ID,GOOGLE_DRIVE_PDF_FOLDER_ID=$DRIVE_FOLDER_ID,FRONTEND_ORIGINS=$FRONTEND_ORIGINS
```

### 21.3 Actualizar frontend Vercel

Si Vercel esta conectado a GitHub, normalmente despliega automatico al hacer push a `main`.

Si no despliega:

1. Entra a Vercel.
2. Abre el proyecto.
3. Ve a `Deployments`.
4. Clic en `Redeploy`.

---

## 22. Problemas comunes

### La app abre en blanco en localhost

Revisa `.env.local`.

Debe tener:

```env
VITE_API_BASE_URL="..."
VITE_FIREBASE_API_KEY="..."
VITE_FIREBASE_AUTH_DOMAIN="..."
VITE_FIREBASE_PROJECT_ID="..."
VITE_FIREBASE_APP_ID="..."
```

Despues reinicia:

```powershell
npm run dev
```

### Login correcto, pero dashboard no carga

Revisa:

1. `VITE_API_BASE_URL` apunta a Cloud Run correcto.
2. Cloud Run tiene `FRONTEND_ORIGINS` con tu dominio.
3. El usuario existe en la pestaña `Users`.
4. `identityUid` coincide con Firebase UID.
5. `active` es `true`.
6. Cloud Run tiene acceso al Sheet.

### Error 403

Puede significar:

- Usuario no activo.
- Rol sin permiso.
- Facility/patient no asignado.
- MFA requerido pero no completado.

### Error 401

Puede significar:

- No hay sesion.
- Token expirado.
- Token invalido.
- Proyecto Firebase equivocado.

### Cloud Run no puede leer Google Sheets

Revisa:

1. Sheets API habilitada.
2. Sheet compartido con service account.
3. `GOOGLE_SHEETS_SPREADSHEET_ID` correcto.
4. Service account correcta asignada a Cloud Run.

### PDFs no aparecen en Drive

Revisa:

1. Drive API habilitada.
2. Folder ID correcto.
3. Carpeta compartida con service account como Editor.
4. Cloud Run logs para errores de Drive.

### Vercel funciona pero local no

Revisa que `.env.local` tenga los mismos `VITE_*` que Vercel.

### Local funciona pero Vercel no

Revisa variables en Vercel:

1. Que esten en `Production`.
2. Que hayas redeploy despues de cambiarlas.
3. Que el dominio de Vercel este autorizado en Firebase.
4. Que `FRONTEND_ORIGINS` en Cloud Run incluya la URL de Vercel.

---

## 23. Checklist final de seguridad

Antes de usar con pacientes reales:

```text
[ ] BAA con Google confirmado para este proyecto.
[ ] Google Sheet privado, sin link sharing.
[ ] Drive folder privado, sin link sharing.
[ ] Service account dedicada para Cloud Run.
[ ] Sheet compartido solo con service account y admins necesarios.
[ ] Drive folder compartido solo con service account y admins necesarios.
[ ] Identity Platform configurado.
[ ] MFA activado para usuarios reales.
[ ] Primer admin con mfaRequired=true despues de probar MFA.
[ ] Vercel sin Sheet ID, Drive ID, private keys ni OAuth secrets.
[ ] Cloud Run con FRONTEND_ORIGINS limitado.
[ ] /v1/bootstrap devuelve 401 sin token.
[ ] Usuarios tienen roles correctos.
[ ] Usuarios inactivos tienen active=false.
[ ] PDFs no son publicos.
[ ] No se guarda PHI en localStorage.
```

---

## 24. Archivos importantes del proyecto

Frontend:

```text
src/App.tsx
src/utils/auth.ts
src/utils/apiClient.ts
src/utils/db.ts
```

Backend:

```text
cloud-run/src/server.js
cloud-run/src/security.js
cloud-run/src/repository.js
cloud-run/src/validation.js
cloud-run/src/pdf.js
```

Variables frontend:

```text
.env.example
.env.local
```

Variables backend:

```text
cloud-run/.env.example
```

Deploy frontend:

```text
vercel.json
```

---

## 25. Referencias oficiales

- Cloud Run deployment:
  <https://cloud.google.com/run/docs/deploying>
- Cloud Run environment variables:
  <https://cloud.google.com/run/docs/configuring/services/environment-variables>
- Firebase web setup:
  <https://firebase.google.com/docs/web/setup>
- Vercel environment variables:
  <https://vercel.com/docs/environment-variables>

