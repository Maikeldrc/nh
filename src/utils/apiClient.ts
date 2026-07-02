import { getIdentityToken } from './auth';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

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
  conditionGroups: import('../types').ConditionGroupCatalog[];
  diagnoses: import('../types').DiagnosisCatalog[];
  catalogImports: import('../types').CatalogImportHistory[];
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
    const requestId = response.headers.get('x-request-id');
    throw new Error(requestId
      ? `The secure service rejected the request. Reference: ${requestId}`
      : 'The secure service rejected the request.');
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
  if (!response.ok) throw new Error('Unable to retrieve the document.');
  return response.blob();
}

export async function generateDocument(
  type: import('../types').DocumentRecord['type'],
  patientId: string,
  source: Record<string, unknown>
): Promise<{ document: import('../types').DocumentRecord; blob: Blob }> {
  const document = await apiRequest<import('../types').DocumentRecord>('/v1/pdfs', {
    method: 'POST',
    body: JSON.stringify({ type, patientId, source })
  });
  const blob = await downloadDocument(document.id);
  return { document, blob };
}
