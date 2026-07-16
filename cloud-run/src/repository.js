import { google } from 'googleapis';
import { config } from './config.js';

const sheets = google.sheets({ version: 'v4', auth: new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
}) });

export const resources = Object.freeze({
  patients: { tab: 'Patients', key: 'patient_id' },
  facilities: { tab: 'Facilities', key: 'facility_id' },
  programs: { tab: 'Programs', key: 'program_id' },
  visits: { tab: 'Visits', key: 'visit_id' },
  consents: { tab: 'Consents', key: 'consent_id' },
  devices: { tab: 'Devices', key: 'device_id' },
  readings: { tab: 'Device Readings', key: 'reading_id' },
  documents: { tab: 'Documents', key: 'document_id' },
  'condition-groups': { tab: 'Condition Groups', key: 'condition_group_id' },
  diagnoses: { tab: 'Diagnosis Catalog', key: 'diagnosis_id' },
  'catalog-imports': { tab: 'Catalog Imports', key: 'import_id' },
  'medical-orders': { tab: 'Medical Orders', key: 'order_id' },
  'device-activation': { tab: 'Device Activation', key: 'activation_id' },
  medications: { tab: 'Medications', key: 'medication_id' },
  users: { tab: 'Users', key: 'user_id' },
  'activity-log': { tab: 'Activity Log', key: 'activity_id' }
});

const backendHeaders = ['record_json', 'patient_id', 'facility_id', 'updated_at'];
const transientGoogleStatuses = new Set([429, 500, 502, 503, 504]);
const headerCache = new Map();
const recordsCache = new Map();
const CACHE_TTL_MS = 1000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withSheetsRetry(operation) {
  const delays = [500, 1000, 2000, 4000, 8000, 16000, 32000];
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const status = Number(error?.code || error?.status || error?.response?.status);
      if (!transientGoogleStatuses.has(status) || attempt === delays.length) {
        throw error;
      }
      await sleep(delays[attempt] + Math.floor(Math.random() * 250));
    }
  }
  throw new Error('sheets_retry_exhausted');
}

function quoteTab(tab) {
  return `'${tab.replaceAll("'", "''")}'`;
}

async function ensureSheet(resource) {
  const cached = headerCache.get(resource.tab);
  if (cached && cached.expiresAt > Date.now()) return [...cached.headers];

  const metadata = await withSheetsRetry(() => sheets.spreadsheets.get({
    spreadsheetId: config.spreadsheetId,
    fields: 'sheets.properties'
  }));
  const exists = metadata.data.sheets?.some(
    sheet => sheet.properties?.title === resource.tab
  );
  if (!exists) {
    await withSheetsRetry(() => sheets.spreadsheets.batchUpdate({
      spreadsheetId: config.spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: resource.tab } } }] }
    }));
  }

  const response = await withSheetsRetry(() => sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: `${quoteTab(resource.tab)}!1:1`
  }));
  const headers = response.data.values?.[0] || [];
  const requiredHeaders = [resource.key, ...backendHeaders];
  let changed = false;
  for (const header of requiredHeaders) {
    if (!headers.includes(header)) {
      headers.push(header);
      changed = true;
    }
  }
  if (changed || !headers.length) {
    await withSheetsRetry(() => sheets.spreadsheets.values.update({
      spreadsheetId: config.spreadsheetId,
      range: `${quoteTab(resource.tab)}!1:1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] }
    }));
  }
  headerCache.set(resource.tab, { headers: [...headers], expiresAt: Date.now() + 300000 });
  return headers;
}

export async function listRecords(resourceName) {
  const resource = resources[resourceName];
  if (!resource) throw new Error('Unknown resource.');
  const cached = recordsCache.get(resourceName);
  if (cached?.promise) return (await cached.promise).map(cloneRecord);
  if (cached?.records && cached.expiresAt > Date.now()) return cached.records.map(cloneRecord);

  const promise = readRecords(resourceName, resource);
  recordsCache.set(resourceName, { promise, expiresAt: Date.now() + CACHE_TTL_MS });
  try {
    const records = await promise;
    recordsCache.set(resourceName, { records: records.map(cloneRecord), expiresAt: Date.now() + CACHE_TTL_MS });
    return records.map(cloneRecord);
  } catch (error) {
    recordsCache.delete(resourceName);
    throw error;
  }
}

async function readRecords(resourceName, resource) {
  const headers = await ensureSheet(resource);
  const response = await withSheetsRetry(() => sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: `${quoteTab(resource.tab)}!A2:ZZ`
  }));
  return (response.data.values || []).map(values => {
    const row = Object.fromEntries(headers.map((header, index) => [
      header,
      values[index] ?? ''
    ]));
    if (row.record_json) {
      try {
        return JSON.parse(row.record_json);
      } catch {
        return row;
      }
    }
    return row;
  });
}

function cloneRecord(record) {
  return JSON.parse(JSON.stringify(record));
}

export async function getRecord(resourceName, id) {
  const resource = resources[resourceName];
  const records = await listRecords(resourceName);
  return records.find(record => String(record.id || record[resource.key]) === String(id));
}

export async function upsertRecord(resourceName, id, record) {
  const resource = resources[resourceName];
  if (!resource) throw new Error('Unknown resource.');
  recordsCache.delete(resourceName);
  const headers = await ensureSheet(resource);
  const response = await withSheetsRetry(() => sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: `${quoteTab(resource.tab)}!A2:ZZ`
  }));
  const rows = response.data.values || [];
  const keyIndex = headers.indexOf(resource.key);
  const rowIndex = rows.findIndex(row => String(row[keyIndex] || '') === String(id));
  const normalized = {
    ...record,
    id,
    [resource.key]: id,
    updated_at: new Date().toISOString()
  };
  const values = headers.map(header => {
    if (header === resource.key) return id;
    if (header === 'record_json') return JSON.stringify(normalized);
    if (header === 'patient_id') return normalized.patientId || normalized.patient_id || '';
    if (header === 'facility_id') return normalized.facilityId || normalized.facility_id || '';
    if (header === 'updated_at') return normalized.updated_at;
    const value = normalized[header];
    return typeof value === 'object' ? JSON.stringify(value) : value ?? '';
  });
  const targetRow = rowIndex < 0 ? rows.length + 2 : rowIndex + 2;
  await withSheetsRetry(() => sheets.spreadsheets.values.update({
    spreadsheetId: config.spreadsheetId,
    range: `${quoteTab(resource.tab)}!A${targetRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: [values] }
  }));
  return normalized;
}

export async function appendActivity(activity) {
  return upsertRecord('activity-log', activity.activity_id, activity);
}

export async function clearRecords(resourceName) {
  const resource = resources[resourceName];
  if (!resource) throw new Error('Unknown resource.');
  const existingRecords = await listRecords(resourceName);
  recordsCache.delete(resourceName);
  await ensureSheet(resource);
  await withSheetsRetry(() => sheets.spreadsheets.values.clear({
    spreadsheetId: config.spreadsheetId,
    range: `${quoteTab(resource.tab)}!A2:ZZ`
  }));
  recordsCache.set(resourceName, { records: [], expiresAt: Date.now() + CACHE_TTL_MS });
  return existingRecords.length;
}
