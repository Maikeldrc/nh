/**
 * AMAVITA CareStart Google Sheets backend.
 *
 * Deploy as a Google Apps Script Web App:
 * - Execute as: Me
 * - Who has access: Anyone with the link, or your Workspace users
 *
 * Script Properties:
 * - SPREADSHEET_ID: target spreadsheet id
 */

const TAB_SCHEMAS = {
  'Patients': ['patient_id', 'first_name', 'last_name', 'date_of_birth', 'medicare_id', 'facility_id', 'room', 'ltc_confirmed', 'registration_status', 'created_at', 'created_by', 'updated_at', 'updated_by'],
  'Facilities': ['facility_id', 'facility_name', 'active', 'updated_at'],
  'Programs': ['program_id', 'program', 'requires_device', 'active'],
  'Patient Programs': ['patient_program_id', 'patient_id', 'program', 'required_device', 'status', 'start_date', 'end_date', 'created_at', 'created_by'],
  'Conditions / Diagnoses': ['diagnosis_id', 'patient_id', 'condition_group_display', 'condition_group_code', 'icd10_code', 'icd10_display', 'source', 'selected_at', 'selected_by'],
  'Medications': ['medication_id', 'patient_id', 'medication_name', 'normalized_medication_name', 'strength', 'frequency', 'pending_review', 'selected_at', 'selected_by'],
  'Medical Orders': ['order_id', 'patient_id', 'program', 'device_type', 'ordering_physician', 'order_status', 'order_created_at', 'order_created_by', 'physician_approved_at', 'physician_rejected_at', 'rejection_reason', 'order_pdf_url'],
  'Devices': ['device_id', 'serial_number', 'device_type', 'vendor', 'status', 'assigned_patient_id', 'assigned_at', 'assigned_by'],
  'Device Activation': ['activation_id', 'patient_id', 'device_id', 'technical_activation_status', 'delivered_at', 'assigned_at', 'first_reading_received_at', 'activated_at', 'support_notes', 'updated_by', 'updated_at'],
  'Consents': ['consent_id', 'patient_id', 'selected_programs', 'consent_template_version', 'consent_method', 'signer_type', 'signer_name', 'decision', 'signed_at', 'signed_by', 'consent_pdf_url', 'language', 'created_at', 'created_by'],
  'Consent Audit Log': ['audit_id', 'consent_id', 'patient_id', 'decision', 'signer_name', 'signer_type', 'captured_by', 'facility_id', 'capture_device', 'date_time', 'audit_token', 'ip_address', 'user_agent'],
  'Nurse Attestations': ['attestation_id', 'patient_id', 'consent_id', 'nurse_id', 'attestation_text', 'attested_at', 'facility_id', 'script_version'],
  'App Access / Caregiver Access': ['access_id', 'patient_id', 'person_name', 'relationship', 'access_type', 'patient_authorized', 'authorized_at', 'status', 'created_by', 'created_at'],
  'Users': ['user_id', 'name', 'role', 'email', 'credentials', 'active', 'created_at'],
  'Activity Log': ['activity_id', 'entity_type', 'entity_id', 'patient_id', 'action', 'previous_value', 'new_value', 'performed_by', 'performed_at']
};

const UNIQUE_CONSTRAINTS = {
  'Conditions / Diagnoses': ['patient_id', 'icd10_code'],
  'Devices': ['serial_number']
};

const ALLOWED_ORDER_STATUSES = ['Order Required', 'Pending Physician Approval', 'Approved', 'Rejected / Needs Revision'];
const ALLOWED_TECHNICAL_ACTIVATION_STATUSES = ['Not Started', 'Pending Order Approval', 'Delivered / Assigned', 'Awaiting First Reading', 'Active', 'Needs Support'];

function doGet() {
  return jsonResponse({ ok: true, service: 'AMAVITA CareStart Sheets API', tabs: Object.keys(TAB_SCHEMAS) });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const spreadsheet = openSpreadsheet_(payload.spreadsheet_id);
    setupSpreadsheet_(spreadsheet);

    const writes = payload.writes || [];
    validateBatchRules_(spreadsheet, writes);
    writes.forEach(write => applyWrite_(spreadsheet, write));

    return jsonResponse({ ok: true, action: payload.action || 'unknown', write_count: writes.length });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error && error.message ? error.message : error) });
  } finally {
    lock.releaseLock();
  }
}

function setupSpreadsheet() {
  setupSpreadsheet_(openSpreadsheet_());
}

function setupSpreadsheet_(spreadsheet) {
  Object.keys(TAB_SCHEMAS).forEach(tabName => {
    const sheet = getOrCreateSheet_(spreadsheet, tabName);
    const headers = TAB_SCHEMAS[tabName];
    const current = sheet.getRange(1, 1, 1, Math.max(headers.length, sheet.getLastColumn() || headers.length)).getValues()[0];
    if (!current[0]) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      return;
    }

    headers.forEach((header, index) => {
      if (current[index] !== header) sheet.getRange(1, index + 1).setValue(header);
    });
  });
  seedPrograms_(spreadsheet);
}

function seedPrograms_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('Programs');
  if (!sheet || sheet.getLastRow() > 1) return;
  const rows = [
    ['prog_ccm', 'CCM', 'FALSE', 'TRUE'],
    ['prog_rpm', 'RPM', 'TRUE', 'TRUE'],
    ['prog_ccm_rpm', 'CCM + RPM', 'TRUE', 'TRUE'],
    ['prog_ccm_pcm', 'CCM + PCM', 'FALSE', 'TRUE'],
    ['prog_ccm_rpm_pcm', 'CCM + RPM + PCM', 'TRUE', 'TRUE'],
    ['prog_pcm', 'PCM', 'FALSE', 'TRUE'],
    ['prog_rtm', 'RTM', 'TRUE', 'TRUE'],
    ['prog_other', 'Other', 'FALSE', 'TRUE']
  ];
  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

function applyWrite_(spreadsheet, write) {
  if (!write || !write.tab || !write.row || !write.primaryKey) throw new Error('Invalid write payload.');
  const sheet = spreadsheet.getSheetByName(write.tab);
  if (!sheet) throw new Error(`Missing Google Sheet tab: ${write.tab}`);

  const headers = getHeaders_(sheet);
  const primaryIndex = headers.indexOf(write.primaryKey);
  if (primaryIndex < 0) throw new Error(`Missing primary key column "${write.primaryKey}" in tab "${write.tab}".`);

  validateRequiredFields_(write.tab, write.row);
  validateDomainRules_(spreadsheet, write);
  validateUniqueConstraints_(sheet, headers, write);

  const rowValues = headers.map(header => write.row[header] == null ? '' : write.row[header]);
  const mode = write.mode || 'upsert';
  const existingRow = findRowByPrimaryKey_(sheet, primaryIndex + 1, write.row[write.primaryKey]);

  if (mode === 'append') {
    if (existingRow) throw new Error(`Duplicate primary key ${write.row[write.primaryKey]} in ${write.tab}.`);
    sheet.appendRow(rowValues);
    return;
  }

  if (existingRow) {
    sheet.getRange(existingRow, 1, 1, headers.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

function validateDomainRules_(spreadsheet, write) {
  if (write.tab === 'Patient Programs') {
    const program = String(write.row.program || '');
    if (program.indexOf('RPM') >= 0 && !write.row.required_device) {
      throw new Error('RPM program requires required_device.');
    }
  }

  if (write.tab === 'Conditions / Diagnoses' && write.row.icd10_code) {
    if (!/^[A-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/.test(String(write.row.icd10_code).toUpperCase())) {
      throw new Error(`Invalid ICD-10 code: ${write.row.icd10_code}`);
    }
  }

  if (write.tab === 'Medical Orders' && ALLOWED_ORDER_STATUSES.indexOf(String(write.row.order_status || '')) < 0) {
    throw new Error(`Invalid medical order status: ${write.row.order_status}`);
  }

  if (write.tab === 'Device Activation') {
    const status = String(write.row.technical_activation_status || '');
    if (ALLOWED_TECHNICAL_ACTIVATION_STATUSES.indexOf(status) < 0) {
      throw new Error(`Invalid technical activation status: ${status}`);
    }
    if (status === 'Active' && !patientHasApprovedOrder_(spreadsheet, write.row.patient_id)) {
      throw new Error('Cannot activate device unless medical order status is Approved.');
    }
  }

  if (write.tab === 'Consents') {
    if (!write.row.signer_name || !write.row.decision) {
      throw new Error('Consent completion requires signer_name and decision.');
    }
  }
}

function validateBatchRules_(spreadsheet, writes) {
  const programWrites = writes.filter(write => write.tab === 'Patient Programs');
  programWrites.forEach(write => {
    const program = String(write.row.program || '');
    if (program.indexOf('CCM') < 0) return;
    const patientId = write.row.patient_id;
    const incomingCodes = writes
      .filter(item => item.tab === 'Conditions / Diagnoses' && item.row.patient_id === patientId)
      .map(item => String(item.row.icd10_code || '').toUpperCase())
      .filter(code => /^[A-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/.test(code));
    const existingCodes = getExistingDiagnosisCodes_(spreadsheet, patientId);
    const uniqueCodes = {};
    existingCodes.concat(incomingCodes).forEach(code => uniqueCodes[code] = true);
    if (Object.keys(uniqueCodes).length < 2) {
      throw new Error('CCM requires at least 2 chronic conditions with valid ICD-10 codes.');
    }
  });
}

function patientHasApprovedOrder_(spreadsheet, patientId) {
  const sheet = spreadsheet.getSheetByName('Medical Orders');
  if (!sheet || sheet.getLastRow() < 2) return false;
  const headers = getHeaders_(sheet);
  const patientIndex = headers.indexOf('patient_id');
  const statusIndex = headers.indexOf('order_status');
  return sheet.getDataRange().getValues().slice(1).some(row =>
    String(row[patientIndex]) === String(patientId) && String(row[statusIndex]) === 'Approved'
  );
}

function getExistingDiagnosisCodes_(spreadsheet, patientId) {
  const sheet = spreadsheet.getSheetByName('Conditions / Diagnoses');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const headers = getHeaders_(sheet);
  const patientIndex = headers.indexOf('patient_id');
  const codeIndex = headers.indexOf('icd10_code');
  if (patientIndex < 0 || codeIndex < 0) return [];
  return sheet.getDataRange().getValues().slice(1)
    .filter(row => String(row[patientIndex]) === String(patientId))
    .map(row => String(row[codeIndex] || '').toUpperCase())
    .filter(Boolean);
}

function validateRequiredFields_(tab, row) {
  const required = {
    'Patients': ['patient_id', 'first_name', 'last_name', 'facility_id', 'registration_status'],
    'Patient Programs': ['patient_program_id', 'patient_id', 'program', 'status'],
    'Conditions / Diagnoses': ['diagnosis_id', 'icd10_code', 'icd10_display'],
    'Medical Orders': ['order_id', 'patient_id', 'program', 'order_status'],
    'Devices': ['device_id', 'serial_number', 'device_type', 'status'],
    'Device Activation': ['activation_id', 'patient_id', 'device_id', 'technical_activation_status'],
    'Consents': ['consent_id', 'patient_id', 'decision', 'signer_name'],
    'Consent Audit Log': ['audit_id', 'consent_id', 'patient_id', 'decision'],
    'Activity Log': ['activity_id', 'entity_type', 'action', 'performed_by']
  }[tab] || [];

  required.forEach(field => {
    if (row[field] === undefined || row[field] === null || row[field] === '') {
      throw new Error(`Missing required field "${field}" for ${tab}.`);
    }
  });
}

function validateUniqueConstraints_(sheet, headers, write) {
  const fields = UNIQUE_CONSTRAINTS[write.tab];
  if (!fields) return;

  const values = sheet.getDataRange().getValues();
  const fieldIndexes = fields.map(field => headers.indexOf(field));
  if (fieldIndexes.some(index => index < 0)) return;

  const primaryIndex = headers.indexOf(write.primaryKey);
  const nextPrimary = String(write.row[write.primaryKey] || '');
  const duplicate = values.slice(1).some(row => {
    const sameComposite = fieldIndexes.every((index, i) => String(row[index] || '').toUpperCase() === String(write.row[fields[i]] || '').toUpperCase());
    const samePrimary = String(row[primaryIndex] || '') === nextPrimary;
    return sameComposite && !samePrimary;
  });

  if (duplicate) throw new Error(`Duplicate record in ${write.tab} for unique fields: ${fields.join(', ')}`);
}

function findRowByPrimaryKey_(sheet, primaryColumn, primaryValue) {
  if (!primaryValue) return 0;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const values = sheet.getRange(2, primaryColumn, lastRow - 1, 1).getValues();
  const matchIndex = values.findIndex(row => String(row[0]) === String(primaryValue));
  return matchIndex >= 0 ? matchIndex + 2 : 0;
}

function getHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
}

function getOrCreateSheet_(spreadsheet, tabName) {
  return spreadsheet.getSheetByName(tabName) || spreadsheet.insertSheet(tabName);
}

function openSpreadsheet_(spreadsheetId) {
  const id = spreadsheetId || PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Missing spreadsheet id. Set SPREADSHEET_ID script property or pass spreadsheet_id.');
  return SpreadsheetApp.openById(id);
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
