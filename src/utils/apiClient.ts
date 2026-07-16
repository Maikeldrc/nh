import { getIdentityToken } from './auth';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;
  requestId?: string;
  code?: string;

  constructor(message: string, status: number, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.requestId = requestId;
    this.code = message;
  }
}

export interface BootstrapPayload {
  currentUser: import('../types').User;
  users: import('../types').User[];
  patients: import('../types').Patient[];
  visits: import('../types').Visit[];
  consents: import('../types').Consent[];
  devices: import('../types').Device[];
  readings: import('../types').BPReading[];
  documents: import('../types').DocumentRecord[];
  auditLogs: import('../types').AuditLog[];
  facilities: import('../types').FacilityCatalog[];
  conditionGroups: import('../types').ConditionGroupCatalog[];
  diagnoses: import('../types').DiagnosisCatalog[];
  catalogImports: import('../types').CatalogImportHistory[];
  programs: import('../types').ProgramCatalog[];
}

export interface UserMutationPayload {
  name?: string;
  email?: string;
  role?: import('../types').UserRole;
  active?: boolean;
  mfaRequired?: boolean;
  facilityIds?: string[];
  nursingHomeAccess?: string[];
}

export interface CreateUserResponse {
  user: import('../types').User;
  setupLink?: string;
}

export interface CleanupPatientDataResponse {
  ok: boolean;
  cleared: Record<string, number>;
  deletedPdfFiles: number;
  missingPdfFiles: number;
  failedPdfFiles: number;
}

export interface BackupConfigPayload {
  id: string;
  enabled: boolean;
  driveFolderId: string;
  everyHours: number;
  lastBackupAt?: string;
  lastBackupId?: string;
  nextScheduledAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface BackupRecordPayload {
  id: string;
  fileId: string;
  fileName: string;
  driveUrl: string;
  status: 'AVAILABLE' | 'RESTORED' | 'FAILED';
  createdAt: string;
  createdBy: string;
  notes?: string;
  lastRestoredAt?: string;
  lastRestoredBy?: string;
}

export interface BackupOverviewPayload {
  config: BackupConfigPayload;
  backups: BackupRecordPayload[];
}

function requireApiBaseUrl(): string {
  if (!API_BASE_URL) throw new Error('Cloud Run API URL is not configured.');
  return API_BASE_URL;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = await getIdentityToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/json');
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${requireApiBaseUrl()}${path}`, {
    ...init,
    headers,
    credentials: 'omit',
    referrerPolicy: 'no-referrer'
  });

  if (response.status === 401) {
    throw new Error('Your session has expired.');
  }
  if (response.status === 403) {
    throw new Error('You do not have permission to perform this action.');
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => undefined) as { error?: string; request_id?: string } | undefined;
    const requestId = payload?.request_id || response.headers.get('x-request-id') || undefined;
    if (payload?.error) {
      throw new ApiError(payload.error, response.status, requestId);
    }
    throw new ApiError(requestId
      ? `The secure service rejected the request. Reference: ${requestId}`
      : 'The secure service rejected the request.', response.status, requestId);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function getBootstrap(): Promise<BootstrapPayload> {
  return apiRequest<BootstrapPayload>('/v1/bootstrap');
}

export function saveResource<T extends { id: string }>(
  resource: string,
  record: T
): Promise<T> {
  return apiRequest<T>(`/v1/${resource}/${encodeURIComponent(record.id)}`, {
    method: 'PUT',
    body: JSON.stringify(record)
  });
}

export function createActivity(record: Record<string, unknown>): Promise<void> {
  return apiRequest<void>('/v1/activity-log', {
    method: 'POST',
    body: JSON.stringify(record)
  });
}

export function createUser(payload: UserMutationPayload): Promise<CreateUserResponse> {
  return apiRequest<CreateUserResponse>('/v1/users', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateUser(
  userId: string,
  payload: UserMutationPayload
): Promise<import('../types').User> {
  return apiRequest<import('../types').User>(`/v1/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function deleteResource(resource: string, id: string): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>(`/v1/${resource}/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}

export function cleanupPatientData(): Promise<CleanupPatientDataResponse> {
  return apiRequest<CleanupPatientDataResponse>('/v1/admin/cleanup-patient-data', {
    method: 'POST'
  });
}

export function getBackupOverview(): Promise<BackupOverviewPayload> {
  return apiRequest<BackupOverviewPayload>('/v1/admin/backups');
}

export function saveBackupConfig(
  payload: Pick<BackupConfigPayload, 'enabled' | 'driveFolderId' | 'everyHours'>
): Promise<BackupConfigPayload> {
  return apiRequest<BackupConfigPayload>('/v1/admin/backups/config', {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function createBackupNow(payload: { driveFolderId?: string; notes?: string } = {}): Promise<BackupRecordPayload> {
  return apiRequest<BackupRecordPayload>('/v1/admin/backups', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function restoreBackup(backupId: string): Promise<{ restoredBackup: BackupRecordPayload; safetyBackup: BackupRecordPayload }> {
  return apiRequest<{ restoredBackup: BackupRecordPayload; safetyBackup: BackupRecordPayload }>(
    `/v1/admin/backups/${encodeURIComponent(backupId)}/restore`,
    { method: 'POST' }
  );
}

export async function downloadDocument(documentId: string): Promise<Blob> {
  const token = await getIdentityToken();
  const response = await fetch(
    `${requireApiBaseUrl()}/v1/documents/${encodeURIComponent(documentId)}/content`,
    {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'omit',
      referrerPolicy: 'no-referrer'
    }
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => undefined) as { error?: string; request_id?: string } | undefined;
    throw new ApiError(payload?.error || 'Unable to retrieve the document.', response.status, payload?.request_id);
  }
  return response.blob();
}

export async function generateDocument(
  type: import('../types').DocumentRecord['type'],
  patientId: string,
  source: Record<string, unknown>
): Promise<{ document: import('../types').DocumentRecord; blob?: Blob }> {
  const document = await apiRequest<import('../types').DocumentRecord>('/v1/pdfs', {
    method: 'POST',
    body: JSON.stringify({ type, patientId, source })
  });
  const blob = await downloadDocument(document.id).catch(() => undefined);
  return { document, blob };
}
