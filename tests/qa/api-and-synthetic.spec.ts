import { expect, test } from '@playwright/test';
import {
  apiJson,
  authenticatedRequestContext,
  BootstrapPayload,
  credentialsFromEnv,
  loginAndCaptureSession,
  QaPatient,
  QaUser,
  writeEvidenceJson
} from './helpers';

test.describe.serial('Production API and synthetic-data QA', () => {
  test('admin API creates a QA_AUTO patient and enforces validation boundaries', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Synthetic production writes run once on desktop to avoid duplicate QA records.');
    const adminCredentials = credentialsFromEnv('ADMIN', 'admin');
    test.skip(!adminCredentials, 'QA_ADMIN_EMAIL and QA_ADMIN_PASSWORD are required.');

    const session = await loginAndCaptureSession(page, adminCredentials!);
    expect(session.bootstrap.currentUser.role).toBe('ADMIN');

    const api = await authenticatedRequestContext(session.token);
    const anonymousApi = await authenticatedRequestContext('');
    const unauthenticated = await apiJson<Record<string, unknown>>(
      anonymousApi,
      `${session.apiBaseUrl}/v1/bootstrap`
    );
    expect(unauthenticated.status).toBe(401);

    const nurseFromEnv = process.env.QA_NURSE_EMAIL?.toLowerCase();
    const assignedNurse = findActiveNurse(session.bootstrap.users, nurseFromEnv);
    expect(assignedNurse, 'An active nurse is required to assign the synthetic patient.').toBeTruthy();

    const existingPatient = session.bootstrap.patients[0];
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const patientId = `pat_qa_auto_${timestamp}_${testInfo.workerIndex}`;
    const patient: QaPatient = {
      id: patientId,
      firstName: `QA_AUTO_PATIENT_${timestamp}`,
      lastName: 'AUTOMATED',
      birthDate: '1945-01-15',
      medicareId: `QA_AUTO_MEDICARE_${timestamp}`,
      nursingHome: existingPatient?.nursingHome || 'Amavita Heartwood',
      room: `QA_AUTO_${timestamp}`,
      provider: 'Dr. QA_AUTO Physician',
      practice: 'QA_AUTO_TEST_PRACTICE',
      assignedProgram: 'CCM + RPM',
      conditions: [
        'Essential Hypertension',
        'Type 2 Diabetes Mellitus without complications'
      ],
      diagnoses: [
        {
          conditionGroupCode: 'HHK',
          conditionGroupDisplay: 'Hypertension - Heart - Kidney',
          icd10Code: 'I10',
          icd10Display: 'Essential Hypertension'
        },
        {
          conditionGroupCode: 'DM',
          conditionGroupDisplay: 'Diabetes Mellitus',
          icd10Code: 'E11.9',
          icd10Display: 'Type 2 Diabetes Mellitus without complications'
        }
      ],
      medications: [],
      requiredDevice: 'BP Monitor',
      status: 'PENDING_CONSENT',
      assignedNurseId: assignedNurse!.id,
      assignedNurseName: assignedNurse!.name
    };

    const createResult = await apiJson<QaPatient>(api, `${session.apiBaseUrl}/v1/patients/${patientId}`, {
      method: 'PUT',
      data: patient
    });
    expect(createResult.status).toBe(200);
    expect(createResult.body?.id).toBe(patientId);
    expect(createResult.body?.medicalOrder?.status).toBe('ORDER_PENDING_PHYSICIAN_APPROVAL');

    const refreshed = await apiJson<BootstrapPayload>(api, `${session.apiBaseUrl}/v1/bootstrap`);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body?.patients.some(item => item.id === patientId)).toBe(true);

    const invalidPatient = {
      ...patient,
      id: `${patientId}_invalid`,
      assignedProgram: 'CCM',
      requiredDevice: '',
      diagnoses: [patient.diagnoses![0]]
    };
    const invalidResult = await apiJson<Record<string, unknown>>(
      api,
      `${session.apiBaseUrl}/v1/patients/${invalidPatient.id}`,
      { method: 'PUT', data: invalidPatient }
    );
    expect(invalidResult.status).toBe(422);

    const notFoundResult = await apiJson<Record<string, unknown>>(api, `${session.apiBaseUrl}/v1/not-real`);
    expect(notFoundResult.status).toBe(404);
    await api.dispose();
    await anonymousApi.dispose();

    writeEvidenceJson('qa-evidence/logs/synthetic-data.json', {
      generatedAt: new Date().toISOString(),
      apiBaseUrl: session.apiBaseUrl,
      patientId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      assignedNurseEmail: assignedNurse!.email,
      expectedMedicalOrderStatus: 'ORDER_PENDING_PHYSICIAN_APPROVAL',
      retainedInProductionForEvidence: true
    });
  });

  test('nurse and physician credentials respect production authorization boundaries', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'API authorization boundaries run once on desktop.');
    const nurseCredentials = credentialsFromEnv('NURSE', 'nurse');
    const physicianCredentials = credentialsFromEnv('PHYSICIAN', 'physician');
    test.skip(!nurseCredentials || !physicianCredentials, 'Nurse and physician QA credentials are required.');

    const nurseContext = await browser.newContext({ baseURL: process.env.QA_BASE_URL || 'https://nhcarestart.vercel.app' });
    const nursePage = await nurseContext.newPage();
    const nurseSession = await loginAndCaptureSession(nursePage, nurseCredentials!);
    expect(nurseSession.bootstrap.currentUser.role).toBe('NURSE');
    const nurseApi = await authenticatedRequestContext(nurseSession.token);
    const nurseUserCreate = await apiJson<Record<string, unknown>>(
      nurseApi,
      `${nurseSession.apiBaseUrl}/v1/users`,
      {
        method: 'POST',
        data: {
          email: `qa_auto_${Date.now()}@example.test`,
          name: 'QA AUTO forbidden user',
          role: 'VIEWER',
          active: true,
          mfaRequired: true
        }
      }
    );
    expect(nurseUserCreate.status).toBe(403);
    await nursePage.screenshot({
      path: `qa-evidence/screenshots/${testInfo.project.name}-nurse-authz-boundary.png`,
      fullPage: true
    });
    await nurseApi.dispose();
    await nurseContext.close();

    const physicianContext = await browser.newContext({ baseURL: process.env.QA_BASE_URL || 'https://nhcarestart.vercel.app' });
    const physicianPage = await physicianContext.newPage();
    const physicianSession = await loginAndCaptureSession(physicianPage, physicianCredentials!);
    expect(physicianSession.bootstrap.currentUser.role).toBe('PHYSICIAN');
    const physicianApi = await authenticatedRequestContext(physicianSession.token);
    const physicianUserCreate = await apiJson<Record<string, unknown>>(
      physicianApi,
      `${physicianSession.apiBaseUrl}/v1/users`,
      {
        method: 'POST',
        data: {
          email: `qa_auto_physician_${Date.now()}@example.test`,
          name: 'QA AUTO forbidden physician user',
          role: 'VIEWER',
          active: true,
          mfaRequired: true
        }
      }
    );
    expect(physicianUserCreate.status).toBe(403);
    await physicianPage.screenshot({
      path: `qa-evidence/screenshots/${testInfo.project.name}-physician-authz-boundary.png`,
      fullPage: true
    });
    await physicianApi.dispose();
    await physicianContext.close();
  });
});

function findActiveNurse(users: QaUser[], preferredEmail?: string): QaUser | undefined {
  return users.find(user => user.role === 'NURSE'
    && user.active !== false
    && preferredEmail
    && user.email.toLowerCase() === preferredEmail)
    || users.find(user => user.role === 'NURSE' && user.active !== false);
}
