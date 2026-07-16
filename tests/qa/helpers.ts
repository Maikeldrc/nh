import { expect, Page, APIRequestContext, request } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface QaCredentials {
  label: string;
  email: string;
  password: string;
}

export interface AuthenticatedSession {
  token: string;
  apiBaseUrl: string;
  bootstrap: BootstrapPayload;
}

export interface BootstrapPayload {
  currentUser: QaUser;
  users: QaUser[];
  patients: QaPatient[];
  documents: Array<Record<string, unknown>>;
  conditionGroups: Array<Record<string, unknown>>;
  diagnoses: Array<Record<string, unknown>>;
}

export interface QaUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'NURSE' | 'AUXILIARY_PERSONNEL' | 'PHYSICIAN' | 'VIEWER' | 'AUDITOR';
  active?: boolean;
}

export interface QaPatient {
  id: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
  medicareId?: string;
  nursingHome: string;
  room?: string;
  provider: string;
  practice: string;
  assignedProgram: string;
  conditions: string[];
  diagnoses?: Array<Record<string, string>>;
  medications: unknown[];
  requiredDevice: string;
  status: string;
  assignedNurseId: string;
  assignedNurseName: string;
  medicalOrder?: Record<string, unknown>;
}

export function credentialsFromEnv(prefix: string, label: string): QaCredentials | undefined {
  const email = process.env[`QA_${prefix}_EMAIL`];
  const password = process.env[`QA_${prefix}_PASSWORD`];
  if (!email || !password) return undefined;
  return { label, email, password };
}

export async function loginAndCaptureSession(page: Page, credentials: QaCredentials): Promise<AuthenticatedSession> {
  let token = '';
  let apiBaseUrl = process.env.QA_API_BASE_URL?.replace(/\/+$/, '') || '';
  let bootstrap: BootstrapPayload | undefined;

  page.on('request', req => {
    if (!req.url().includes('/v1/bootstrap')) return;
    const auth = req.headers().authorization;
    if (auth?.startsWith('Bearer ')) token = auth.slice('Bearer '.length);
    if (!apiBaseUrl) apiBaseUrl = req.url().replace(/\/v1\/bootstrap(?:\?.*)?$/, '');
  });
  page.on('response', async response => {
    if (!response.url().includes('/v1/bootstrap') || response.status() !== 200) return;
    bootstrap = await response.json().catch(() => undefined) as BootstrapPayload | undefined;
  });

  await page.goto('/');
  await page.locator('#login-btn-lang-en').click();
  await page.locator('#email').fill(credentials.email);
  await page.locator('#password').fill(credentials.password);
  await page.locator('#btn-submit-login').click();
  const appFrame = page.locator('#main-application-frame');
  const loginError = page.locator('#login-error-alert');
  await Promise.race([
    appFrame.waitFor({ state: 'visible', timeout: 90_000 }),
    loginError.waitFor({ state: 'visible', timeout: 90_000 })
  ]);
  if (await loginError.isVisible().catch(() => false)) {
    await page.locator('#password').fill('');
    throw new Error(`${credentials.label} credentials were rejected by production authentication.`);
  }
  await expect(appFrame).toBeVisible();
  await expect.poll(() => token, { timeout: 15_000 }).not.toBe('');
  await expect.poll(() => bootstrap, { timeout: 15_000 }).toBeTruthy();

  return { token, apiBaseUrl, bootstrap: bootstrap! };
}

export async function authenticatedRequestContext(token: string): Promise<APIRequestContext> {
  return request.newContext({
    extraHTTPHeaders: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
  });
}

export async function apiJson<T>(
  api: APIRequestContext,
  url: string,
  options: Parameters<APIRequestContext['fetch']>[1] = {}
): Promise<{ status: number; body: T | undefined }> {
  const response = await api.fetch(url, options);
  const body = await response.json().catch(() => undefined) as T | undefined;
  return { status: response.status(), body };
}

export function writeEvidenceJson(path: string, payload: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}
