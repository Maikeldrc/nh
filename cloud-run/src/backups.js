import crypto from 'node:crypto';
import { google } from 'googleapis';
import { config } from './config.js';
import {
  getRecord,
  invalidateRepositoryCache,
  listRecords,
  upsertRecord
} from './repository.js';

const googleAuth = new google.auth.GoogleAuth({
  scopes: [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets'
  ]
});
const drive = google.drive({ version: 'v3', auth: googleAuth });
const sheets = google.sheets({ version: 'v4', auth: googleAuth });
const transientGoogleStatuses = new Set([429, 500, 502, 503, 504]);
const CONFIG_ID = 'backup_config';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryGoogle(operation) {
  const delays = [500, 1000, 2000, 4000, 8000];
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const status = Number(error?.code || error?.status || error?.response?.status);
      if (!transientGoogleStatuses.has(status) || attempt === delays.length) throw error;
      await sleep(delays[attempt] + Math.floor(Math.random() * 250));
    }
  }
  throw new Error('google_retry_exhausted');
}

export async function getBackupOverview() {
  const [configRecord, backupRows] = await Promise.all([
    getBackupConfig(),
    listRecords('backups')
  ]);
  const backups = backupRows
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, 50);
  return {
    config: {
      ...configRecord,
      nextScheduledAt: nextScheduledAt(configRecord, backups)
    },
    backups
  };
}

export async function saveBackupConfig(input, user) {
  const current = await getBackupConfig();
  const now = new Date().toISOString();
  const everyHours = Number(input.everyHours || current.everyHours || 24);
  const record = {
    ...current,
    id: CONFIG_ID,
    enabled: input.enabled === undefined ? current.enabled : input.enabled === true,
    driveFolderId: String(input.driveFolderId || '').trim(),
    everyHours: Number.isFinite(everyHours) && everyHours > 0 ? Math.min(720, Math.max(1, Math.round(everyHours))) : 24,
    updatedAt: now,
    updatedBy: user.name
  };
  await upsertRecord('backup-config', CONFIG_ID, record);
  return record;
}

export async function createSpreadsheetBackup(user, options = {}) {
  const backupId = `backup_${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();
  const folderId = await resolveBackupFolderId(options.driveFolderId);
  const name = `amavita-carestart-backup-${createdAt.replace(/[:.]/g, '-')}`;
  const requestBody = {
    name,
    appProperties: {
      amavita_backup: 'true',
      source_spreadsheet_id: config.spreadsheetId,
      backup_id: backupId
    }
  };
  if (folderId) requestBody.parents = [folderId];

  const response = await retryGoogle(() => drive.files.copy({
    fileId: config.spreadsheetId,
    fields: 'id,name,webViewLink,createdTime',
    supportsAllDrives: true,
    requestBody
  }));

  const record = {
    id: backupId,
    fileId: response.data.id,
    fileName: response.data.name || name,
    driveUrl: response.data.webViewLink || `https://docs.google.com/spreadsheets/d/${response.data.id}`,
    status: 'AVAILABLE',
    createdAt,
    createdBy: user.name,
    notes: options.notes || 'Google Drive spreadsheet backup.',
    lastRestoredAt: '',
    lastRestoredBy: ''
  };
  await upsertRecord('backups', backupId, record);

  const currentConfig = await getBackupConfig();
  await upsertRecord('backup-config', CONFIG_ID, {
    ...currentConfig,
    lastBackupAt: createdAt,
    lastBackupId: backupId,
    updatedAt: createdAt,
    updatedBy: user.name
  });

  return record;
}

export async function restoreSpreadsheetBackup(backupId, user) {
  const backup = await getRecord('backups', backupId);
  if (!backup || !backup.fileId) {
    const error = new Error('backup_not_found');
    error.status = 404;
    error.expose = true;
    throw error;
  }

  const safetyBackup = await createSpreadsheetBackup(user, {
    notes: `Safety backup before restoring ${backup.fileName || backup.id}.`
  });
  await restoreSheetsFromBackupFile(backup.fileId);

  const now = new Date().toISOString();
  const updatedBackup = {
    ...backup,
    lastRestoredAt: now,
    lastRestoredBy: user.name,
    status: 'AVAILABLE'
  };
  await upsertRecord('backups', backup.id, updatedBackup);
  invalidateRepositoryCache();
  return { restoredBackup: updatedBackup, safetyBackup };
}

async function getBackupConfig() {
  const existing = await getRecord('backup-config', CONFIG_ID);
  return existing || {
    id: CONFIG_ID,
    enabled: false,
    driveFolderId: '',
    everyHours: 24,
    lastBackupAt: '',
    lastBackupId: '',
    updatedAt: '',
    updatedBy: ''
  };
}

async function resolveBackupFolderId(overrideFolderId) {
  if (overrideFolderId) return overrideFolderId;
  const backupConfig = await getBackupConfig();
  if (backupConfig.driveFolderId) return backupConfig.driveFolderId;
  const spreadsheet = await retryGoogle(() => drive.files.get({
    fileId: config.spreadsheetId,
    fields: 'parents',
    supportsAllDrives: true
  }));
  return spreadsheet.data.parents?.[0] || '';
}

function nextScheduledAt(configRecord, backups) {
  if (!configRecord.enabled) return '';
  const lastBackupAt = configRecord.lastBackupAt || backups[0]?.createdAt;
  if (!lastBackupAt) return '';
  const last = new Date(lastBackupAt);
  if (Number.isNaN(last.getTime())) return '';
  return new Date(last.getTime() + (Number(configRecord.everyHours || 24) * 60 * 60 * 1000)).toISOString();
}

async function restoreSheetsFromBackupFile(backupSpreadsheetId) {
  const [backupMetadata, targetMetadata] = await Promise.all([
    retryGoogle(() => sheets.spreadsheets.get({
      spreadsheetId: backupSpreadsheetId,
      fields: 'sheets.properties(sheetId,title,index)'
    })),
    retryGoogle(() => sheets.spreadsheets.get({
      spreadsheetId: config.spreadsheetId,
      fields: 'sheets.properties(sheetId,title,index)'
    }))
  ]);

  const backupSheets = (backupMetadata.data.sheets || [])
    .map(sheet => sheet.properties)
    .filter(Boolean)
    .sort((a, b) => Number(a.index || 0) - Number(b.index || 0));
  const oldSheets = (targetMetadata.data.sheets || [])
    .map(sheet => sheet.properties)
    .filter(Boolean);

  if (backupSheets.length === 0) {
    const error = new Error('backup_has_no_sheets');
    error.status = 422;
    error.expose = true;
    throw error;
  }

  const copiedSheets = [];
  for (const backupSheet of backupSheets) {
    const copied = await retryGoogle(() => sheets.spreadsheets.sheets.copyTo({
      spreadsheetId: backupSpreadsheetId,
      sheetId: backupSheet.sheetId,
      requestBody: { destinationSpreadsheetId: config.spreadsheetId }
    }));
    copiedSheets.push({
      sheetId: copied.data.sheetId,
      title: backupSheet.title,
      index: backupSheet.index || 0
    });
  }

  const restoreStamp = Date.now();
  if (oldSheets.length > 0) {
    await retryGoogle(() => sheets.spreadsheets.batchUpdate({
      spreadsheetId: config.spreadsheetId,
      requestBody: {
        requests: oldSheets.map(sheet => ({
          updateSheetProperties: {
            properties: {
              sheetId: sheet.sheetId,
              title: `__restore_old_${sheet.sheetId}_${restoreStamp}`
            },
            fields: 'title'
          }
        }))
      }
    }));
  }

  await retryGoogle(() => sheets.spreadsheets.batchUpdate({
    spreadsheetId: config.spreadsheetId,
    requestBody: {
      requests: [
        ...copiedSheets.map(sheet => ({
          updateSheetProperties: {
            properties: {
              sheetId: sheet.sheetId,
              title: sheet.title,
              index: sheet.index
            },
            fields: 'title,index'
          }
        })),
        ...oldSheets.map(sheet => ({ deleteSheet: { sheetId: sheet.sheetId } }))
      ]
    }
  }));
}
