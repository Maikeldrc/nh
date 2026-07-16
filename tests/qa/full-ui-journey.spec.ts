import { expect, Locator, Page, test } from '@playwright/test';
import fs from 'node:fs/promises';
import { apiJson, authenticatedRequestContext, BootstrapPayload, credentialsFromEnv, loginAndCaptureSession } from './helpers';

test.describe.serial('Production full UI journey QA', () => {
  test.setTimeout(300_000);

  test('admin and nurse complete the core UI workflow end to end', async ({ browser }, testInfo) => {
    test.skip(process.env.QA_FULL_UI !== '1', 'Set QA_FULL_UI=1 to run the destructive full UI production journey.');
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Full production write journey runs once on desktop.');
    const adminCredentials = credentialsFromEnv('ADMIN', 'admin');
    const nurseCredentials = credentialsFromEnv('NURSE', 'nurse');
    test.skip(!adminCredentials || !nurseCredentials, 'Admin and nurse QA credentials are required.');

    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const firstName = `QA_UI_${stamp}`;
    const lastName = 'FULLFLOW';
    const fullName = `${firstName} ${lastName}`;

    const adminContext = await browser.newContext({ baseURL: process.env.QA_BASE_URL || 'https://nhcarestart.vercel.app' });
    const adminPage = await adminContext.newPage();
    const adminSession = await loginAndCaptureSession(adminPage, adminCredentials!);
    await registerPatientThroughUi(adminPage, firstName, lastName, stamp);
    await expect(adminPage.locator('#patients-admin-table').getByText(fullName)).toBeVisible({ timeout: 30_000 });
    await approveMedicalOrderThroughUi(adminPage, fullName);
    await waitForPatientReadyInApi(adminSession, fullName);
    await adminPage.screenshot({ path: `qa-evidence/screenshots/${testInfo.project.name}-full-ui-admin-registered.png`, fullPage: true });
    await adminContext.close();

    const nurseContext = await browser.newContext({ baseURL: process.env.QA_BASE_URL || 'https://nhcarestart.vercel.app' });
    const nursePage = await nurseContext.newPage();
    await capturePdfFailures(nursePage, testInfo.project.name);
    await loginAndCaptureSession(nursePage, nurseCredentials!);
    await filterDashboard(nursePage, firstName);
    await runNurseVisitThroughUi(nursePage, fullName, stamp);
    await expect(nursePage.getByRole('heading', { name: fullName })).toBeVisible({ timeout: 30_000 });
    await nursePage.screenshot({ path: `qa-evidence/screenshots/${testInfo.project.name}-full-ui-nurse-completed.png`, fullPage: true });
    await nurseContext.close();
  });

  test('admin-only UI areas and physician restrictions render correctly', async ({ browser }, testInfo) => {
    test.skip(process.env.QA_FULL_UI !== '1', 'Set QA_FULL_UI=1 to run extended production UI coverage.');
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Admin-only UI coverage runs once on desktop.');
    const adminCredentials = credentialsFromEnv('ADMIN', 'admin');
    const physicianCredentials = credentialsFromEnv('PHYSICIAN', 'physician');
    test.skip(!adminCredentials || !physicianCredentials, 'Admin and physician QA credentials are required.');

    const adminContext = await browser.newContext({ baseURL: process.env.QA_BASE_URL || 'https://nhcarestart.vercel.app' });
    const adminPage = await adminContext.newPage();
    await loginAndCaptureSession(adminPage, adminCredentials!);
    await adminPage.locator('#tab-users').click();
    await expect(adminPage.locator('#user-management')).toBeVisible();
    await expect(adminPage.getByRole('button', { name: /New User|Nuevo usuario/i })).toBeVisible();
    await adminPage.locator('#tab-facilities').click();
    await manageFacilityThroughUi(adminPage, `QA Facility ${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`);
    await adminPage.locator('#tab-clinical-catalog').click();
    await expect(adminPage.getByText(/Clinical Catalog|Catálogo|Categorias|Categories/i).first()).toBeVisible();
    await adminPage.locator('#tab-documents').click();
    await expect(adminPage.locator('#admin-documents-grid')).toBeVisible();
    await adminPage.locator('#tab-audits').click();
    await expect(adminPage.getByText(/Audit Logs|Auditor/i).first()).toBeVisible();
    await adminPage.screenshot({ path: `qa-evidence/screenshots/${testInfo.project.name}-full-ui-admin-admin-only-tabs.png`, fullPage: true });
    await adminContext.close();

    const physicianContext = await browser.newContext({ baseURL: process.env.QA_BASE_URL || 'https://nhcarestart.vercel.app' });
    const physicianPage = await physicianContext.newPage();
    await loginAndCaptureSession(physicianPage, physicianCredentials!);
    await expect(physicianPage.locator('#tab-users')).toHaveCount(0);
    await expect(physicianPage.locator('#tab-clinical-catalog')).toHaveCount(0);
    await expect(physicianPage.locator('#btn-register-patient-admin')).toHaveCount(0);
    await physicianPage.locator('#tab-documents').click();
    await expect(physicianPage.getByText(/PDF Documents|Documentos PDF|Generated Documentation|Repositorio/i).first()).toBeVisible();
    await physicianPage.screenshot({ path: `qa-evidence/screenshots/${testInfo.project.name}-full-ui-physician-restricted-tabs.png`, fullPage: true });
    await physicianContext.close();
  });
});

async function capturePdfFailures(page: Page, projectName: string): Promise<void> {
  page.on('response', async response => {
    if (!response.url().includes('/v1/pdfs') || response.ok()) return;
    const payload = await response.json().catch(() => undefined) as { error?: string; request_id?: string } | undefined;
    const record = {
      projectName,
      status: response.status(),
      error: payload?.error || 'unknown_pdf_error',
      requestId: payload?.request_id || '',
      capturedAt: new Date().toISOString()
    };
    await fs.mkdir('qa-evidence/logs', { recursive: true });
    await fs.writeFile('qa-evidence/logs/full-ui-pdf-errors.json', `${JSON.stringify(record, null, 2)}\n`);
  });
}

async function registerPatientThroughUi(page: Page, firstName: string, lastName: string, stamp: string): Promise<void> {
  await page.locator('#btn-register-patient-admin').click();
  const modal = page.locator('#register-patient-modal-container');
  await expect(modal).toBeVisible();
  await modal.getByPlaceholder('e.g. John').fill(firstName);
  await modal.getByPlaceholder('e.g. Doe').fill(lastName);
  await modal.locator('input[type="date"]').fill('1945-01-15');
  await modal.getByPlaceholder('e.g. 1EG4-TE5-WY22').fill(`QAUI${stamp}`);
  await modal.getByPlaceholder('e.g. 104-B').fill(`QA_UI_${stamp}`);
  await modal.getByLabel('CCM').check();
  await modal.getByLabel('RPM').check();
  await modal.getByLabel(/Confirm patient is Long Term Care|Confirmar que el paciente/i).check();

  await selectClinicalCategory(modal, 'Hypertension');
  await selectClinicalCategory(modal, 'Diabetes');
  await selectDiagnosis(modal, 'I10', /Essential Hypertension/i);
  await selectDiagnosis(modal, 'E11.9', /Type 2 Diabetes Mellitus without complications/i);
  await closeDropdownOverlay(page);

  await modal.getByRole('button', { name: /Add Medication|Agregar Medicamento/i }).click();
  await modal.getByPlaceholder(/Search medication name|Buscar medicamento/i).fill('Lisinopril');
  await modal.getByText('Lisinopril', { exact: true }).click();
  await modal.getByPlaceholder('e.g. 10 mg').fill('10 mg');
  await modal.getByRole('button', { name: /Save Medication|Guardar/i }).click();

  await modal.getByRole('button', { name: /^Register$|^Registrar$/i }).click();
  await expect(modal).toHaveCount(0, { timeout: 30_000 });
}

async function closeDropdownOverlay(page: Page): Promise<void> {
  const overlay = page.locator('div.fixed.inset-0.z-10.bg-transparent').first();
  if (await overlay.isVisible().catch(() => false)) {
    await overlay.click({ force: true, position: { x: 4, y: 4 } });
  }
}

async function selectClinicalCategory(modal: Locator, search: string): Promise<void> {
  const input = modal.getByPlaceholder(/Search & add categories|Buscar y agregar categorías/i);
  await input.fill(search);
  await modal.getByText(new RegExp(search, 'i')).first().click();
}

async function selectDiagnosis(modal: Locator, search: string, diagnosisName: RegExp): Promise<void> {
  const input = modal.getByPlaceholder(/Search diagnosis or ICD-10|Buscar diagnóstico/i);
  await input.fill(search);
  await modal.getByText(diagnosisName).first().click();
}

async function filterDashboard(page: Page, query: string): Promise<void> {
  const search = page.getByPlaceholder(/Search by name|Buscar por nombre/i).first();
  await search.fill(query);
  await expect(page.getByText(query).first()).toBeVisible({ timeout: 30_000 });
}

async function waitForPatientReadyInApi(session: Awaited<ReturnType<typeof loginAndCaptureSession>>, fullName: string): Promise<void> {
  const api = await authenticatedRequestContext(session.token);
  await expect.poll(async () => {
    const refreshed = await apiJson<BootstrapPayload>(api, `${session.apiBaseUrl}/v1/bootstrap`);
    const patient = refreshed.body?.patients.find(item => `${item.firstName} ${item.lastName}` === fullName);
    return patient ? `${patient.status}:${patient.medicalOrder?.status}` : 'missing';
  }, { timeout: 60_000, intervals: [1000, 2000, 3000, 5000] }).toBe('PENDING_CONSENT:ORDER_APPROVED');
  await api.dispose();
}

async function manageFacilityThroughUi(page: Page, facilityName: string): Promise<void> {
  const panel = page.locator('#facility-management');
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: /New Facility|Nuevo facility/i }).click();
  await page.getByLabel(/Facility name/i).fill(facilityName);
  await page.getByRole('button', { name: /^Save$|^Guardar$/i }).click();
  await panel.getByPlaceholder(/Search facility|Buscar facility/i).fill(facilityName);
  const row = panel.getByRole('row').filter({ hasText: facilityName });
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.getByRole('button', { name: /Deactivate/i }).click();
  await expect(row).toContainText(/Inactive/i);
  await row.getByRole('button', { name: /Activate/i }).click();
  await expect(row).toContainText(/Active/i);
  await row.getByRole('button', { name: /Delete/i }).click();
  await expect(row).toHaveCount(0, { timeout: 30_000 });
}

async function approveMedicalOrderThroughUi(page: Page, fullName: string): Promise<void> {
  const row = page.getByRole('row').filter({ hasText: fullName }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  if (!(await page.locator('#medical-order-review-modal').isVisible().catch(() => false))) {
    await row.getByRole('button', { name: /Review|Revisar/i }).click();
    await expect(page.locator('#medical-order-review-modal')).toBeVisible();
  }
  await page.getByRole('button', { name: /Approve Order|Aprobar Orden/i }).click();
  await expect(page.locator('#medical-order-review-modal')).toHaveCount(0, { timeout: 30_000 });
  await expect(row).toContainText(/Approved|Aprobada/i, { timeout: 30_000 });
}

async function runNurseVisitThroughUi(page: Page, fullName: string, stamp: string): Promise<void> {
  const row = page.locator('#nurse-patients-list').getByText(fullName).locator('xpath=ancestor::*[starts-with(@id, "patient-row-")]').first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.getByRole('button', { name: /Start Visit|Iniciar/i }).click();

  await page.getByLabel(/Identity Physically Confirmed|Identidad Confirmada/i).check();
  await page.getByLabel(/Patient Ready for Explanation|Paciente preparado/i).check();
  await page.getByLabel(/Patient Appears Able|capaz de tomar/i).check();
  await page.locator('#btn-next-step').click();

  await page.getByLabel(/I confirm that I explained|Confirmo que expliqué/i).check();
  await page.locator('#btn-next-step').click();

  await page.getByLabel(/The patient agrees to participate|paciente acepta participar/i).check();
  await page.getByText(/Type full legal name|Escribir nombre legal/i).click();
  await page.getByPlaceholder(fullName).fill(fullName);
  await page.getByLabel(/I agree that this typed name|Acepto que este nombre/i).check();
  await page.getByRole('button', { name: /Confirm Typed Signature|Confirmar Firma Tipeada/i }).click();
  await drawAndSaveSignature(page, 'guided-nurse-attestation');
  await expect(page.getByText(/Consent PDF generated|PDF de consentimiento generado|PDF saved to Drive|PDF guardado/i).first()).toBeVisible({ timeout: 90_000 });
  await page.locator('#btn-next-step').click();

  await page.getByPlaceholder('S/N').fill(`QA-DEVICE-${stamp}`);
  await page.getByLabel(/Device delivered to the patient|Dispositivo entregado/i).check();
  await page.getByLabel(/The use of the device|Se explico el uso/i).check();
  await page.getByLabel(/demonstrated proper understanding|demostraron entender/i).check();
  await fillInputAfterLabel(page, 'Systolic', '118');
  await fillInputAfterLabel(page, 'Diastolic', '72');
  await fillInputAfterLabel(page, 'Pulse', '68');
  await page.locator('#btn-gen-delivery-pdf').click();
  await expect(page.locator('#btn-regenerate-delivery-pdf')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(/replace the previous one|sustituirá al anterior/i)).toBeVisible();
  await page.locator('#btn-regenerate-delivery-pdf').click();
  await expect(page.locator('#btn-regenerate-delivery-pdf')).toBeVisible({ timeout: 90_000 });
  await page.locator('#btn-next-step').click();

  await page.getByLabel(/I confirm all required enrollment steps|Confirmo que todos/i).check();
  await page.locator('#btn-activate-patient').click();
  await expect(page.locator('#dashboard-nurse')).toBeVisible({ timeout: 30_000 });
}

async function fillInputAfterLabel(page: Page, labelText: string, value: string): Promise<void> {
  const input = page.locator('label')
    .filter({ hasText: new RegExp(labelText, 'i') })
    .locator('xpath=following-sibling::input')
    .first();
  await input.fill(value);
}

async function drawAndSaveSignature(page: Page, id: string): Promise<void> {
  const canvas = page.locator(`#canvas-${id}`);
  await expect(canvas).toBeVisible();
  const points = await page.evaluate((canvasId) => {
    const target = document.querySelector<HTMLCanvasElement>(`#canvas-${canvasId}`);
    if (!target) throw new Error(`Missing signature canvas: ${canvasId}`);
    const rect = target.getBoundingClientRect();
    return [
      [rect.left + 24, rect.top + 42],
      [rect.left + 92, rect.top + 72],
      [rect.left + 164, rect.top + 48],
      [rect.left + 238, rect.top + 82]
    ];
  }, id);
  const dispatch = async (type: string, point: number[]) => {
    await canvas.dispatchEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: point[0],
      clientY: point[1]
    });
  };
  await dispatch('mousedown', points[0]);
  await page.waitForTimeout(100);
  for (const point of points.slice(1)) {
    await dispatch('mousemove', point);
    await page.waitForTimeout(50);
  }
  await dispatch('mouseup', points[3]);
  await expect(page.locator(`#btn-save-sig-${id}`)).toBeEnabled({ timeout: 5_000 });
  await page.locator(`#btn-save-sig-${id}`).click();
}
