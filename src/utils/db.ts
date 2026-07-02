import {
  Patient, Visit, Consent, Device, BPReading, AuditLog, DocumentRecord, User,
  PatientStatus, UserRole, ConditionGroupCatalog, DiagnosisCatalog, CatalogImportHistory
} from '../types';
import { SEED_PATIENTS, SEED_AUDITS, SEED_USERS } from '../data';
import * as googleSheetsDb from './googleSheetsDb';

const STORAGE_KEYS = {
  PATIENTS: 'amavita_patients',
  VISITS: 'amavita_visits',
  CONSENTS: 'amavita_consents',
  DEVICES: 'amavita_devices',
  BP_READINGS: 'amavita_bp_readings',
  AUDIT_LOGS: 'amavita_audit_logs',
  DOCUMENTS: 'amavita_documents',
  CONDITION_GROUPS: 'amavita_condition_groups',
  DIAGNOSES: 'amavita_diagnoses',
  CATALOG_IMPORTS: 'amavita_catalog_imports',
  CURRENT_USER: 'amavita_current_user'
};

// Local storage helpers
function getStored<T>(key: string, defaultValue: T): T {
  const data = localStorage.getItem(key);
  if (!data) return defaultValue;
  try {
    return JSON.parse(data) as T;
  } catch (e) {
    console.error(`Error parsing localStorage key "${key}":`, e);
    return defaultValue;
  }
}

function setStored<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function syncGoogleSheets(fn: () => void): void {
  try {
    fn();
  } catch (error) {
    console.warn('Google Sheets sync skipped:', error);
  }
}

// Database initializer
export function initDB(forceReset = false): void {
  if (forceReset || !localStorage.getItem(STORAGE_KEYS.PATIENTS)) {
    setStored(STORAGE_KEYS.PATIENTS, SEED_PATIENTS);
    setStored(STORAGE_KEYS.VISITS, [] as Visit[]);
    setStored(STORAGE_KEYS.CONSENTS, [] as Consent[]);
    setStored(STORAGE_KEYS.DEVICES, [] as Device[]);
    setStored(STORAGE_KEYS.BP_READINGS, [] as BPReading[]);
    setStored(STORAGE_KEYS.AUDIT_LOGS, SEED_AUDITS);
    setStored(STORAGE_KEYS.DOCUMENTS, [] as DocumentRecord[]);
    setStored(STORAGE_KEYS.CONDITION_GROUPS, [] as ConditionGroupCatalog[]);
    setStored(STORAGE_KEYS.DIAGNOSES, [] as DiagnosisCatalog[]);
    setStored(STORAGE_KEYS.CATALOG_IMPORTS, [] as CatalogImportHistory[]);
    
    // Default logged in user: Nurse Sofia
    if (!localStorage.getItem(STORAGE_KEYS.CURRENT_USER)) {
      setStored(STORAGE_KEYS.CURRENT_USER, SEED_USERS[0]);
    }
    syncGoogleSheets(() => googleSheetsDb.syncUsers(SEED_USERS));
    
    console.log('AMAVITA CareStart Database Initialized with Seed Data.');
  }
}

// ----------------------------------------------------
// CONDITION GROUPS / ICD-10 CATALOG
// ----------------------------------------------------
export function getConditionGroups(): ConditionGroupCatalog[] {
  initDB();
  return getStored<ConditionGroupCatalog[]>(STORAGE_KEYS.CONDITION_GROUPS, []);
}

export function getDiagnoses(): DiagnosisCatalog[] {
  initDB();
  return getStored<DiagnosisCatalog[]>(STORAGE_KEYS.DIAGNOSES, []);
}

export function getCatalogImportHistory(): CatalogImportHistory[] {
  initDB();
  return getStored<CatalogImportHistory[]>(STORAGE_KEYS.CATALOG_IMPORTS, []);
}

export function saveConditionCatalog(
  groups: ConditionGroupCatalog[],
  diagnoses: DiagnosisCatalog[],
  history: CatalogImportHistory
): void {
  setStored(STORAGE_KEYS.CONDITION_GROUPS, groups);
  setStored(STORAGE_KEYS.DIAGNOSES, diagnoses);
  const imports = getCatalogImportHistory();
  imports.unshift(history);
  setStored(STORAGE_KEYS.CATALOG_IMPORTS, imports.slice(0, 50));
  syncGoogleSheets(() => googleSheetsDb.syncConditionCatalog(groups, diagnoses, history.imported_by));
}

export function setConditionGroupActive(id: string, isActive: boolean): void {
  const groups = getConditionGroups();
  const group = groups.find(item => item.id === id);
  if (group) group.is_active = isActive;
  setStored(STORAGE_KEYS.CONDITION_GROUPS, groups);
}

export function setDiagnosisActive(id: string, isActive: boolean): void {
  const diagnoses = getDiagnoses();
  const diagnosis = diagnoses.find(item => item.id === id);
  if (diagnosis) diagnosis.is_active = isActive;
  setStored(STORAGE_KEYS.DIAGNOSES, diagnoses);
}

// ----------------------------------------------------
// PATIENTS
// ----------------------------------------------------
export function getPatients(): Patient[] {
  initDB();
  return getStored<Patient[]>(STORAGE_KEYS.PATIENTS, []);
}

export function getPatientById(id: string): Patient | undefined {
  return getPatients().find(p => p.id === id);
}

export function savePatient(patient: Patient): void {
  const patients = getPatients();
  const index = patients.findIndex(p => p.id === patient.id);
  if (index >= 0) {
    patients[index] = patient;
    syncGoogleSheets(() => googleSheetsDb.updatePatient(patient));
  } else {
    patients.unshift(patient); // new patients appear first
    syncGoogleSheets(() => googleSheetsDb.createPatient(patient));
  }
  setStored(STORAGE_KEYS.PATIENTS, patients);
}

// ----------------------------------------------------
// VISITS
// ----------------------------------------------------
export function getVisits(): Visit[] {
  initDB();
  return getStored<Visit[]>(STORAGE_KEYS.VISITS, []);
}

export function getVisitById(id: string): Visit | undefined {
  return getVisits().find(v => v.id === id);
}

export function getActiveVisitForPatient(patientId: string): Visit | undefined {
  return getVisits().find(v => v.patientId === patientId && v.status === 'IN_PROGRESS');
}

export function getLatestVisitForPatient(patientId: string): Visit | undefined {
  const patientVisits = getVisits().filter(v => v.patientId === patientId);
  if (patientVisits.length === 0) return undefined;
  // Sort by startTime descending
  return patientVisits.sort((a, b) => b.startTime.localeCompare(a.startTime))[0];
}

export function saveVisit(visit: Visit): void {
  const visits = getVisits();
  const index = visits.findIndex(v => v.id === visit.id);
  if (index >= 0) {
    visits[index] = visit;
  } else {
    visits.push(visit);
  }
  setStored(STORAGE_KEYS.VISITS, visits);
}

// ----------------------------------------------------
// CONSENTS
// ----------------------------------------------------
export function getConsents(): Consent[] {
  initDB();
  return getStored<Consent[]>(STORAGE_KEYS.CONSENTS, []);
}

export function getConsentByPatientId(patientId: string): Consent | undefined {
  // Get most recent consent for patient
  const list = getConsents().filter(c => c.patientId === patientId);
  if (list.length === 0) return undefined;
  return list.sort((a, b) => b.dateTime.localeCompare(a.dateTime))[0];
}

export function saveConsent(consent: Consent): void {
  const consents = getConsents();
  const index = consents.findIndex(c => c.id === consent.id);
  if (index >= 0) {
    consents[index] = consent;
  } else {
    consents.push(consent);
  }
  setStored(STORAGE_KEYS.CONSENTS, consents);
  syncGoogleSheets(() => {
    const patient = getPatientById(consent.patientId);
    googleSheetsDb.createConsent(consent, patient);
    if (consent.nurseAttestations?.length) googleSheetsDb.createNurseAttestation(consent, patient);
  });
}

// ----------------------------------------------------
// DEVICES
// ----------------------------------------------------
export function getDevices(): Device[] {
  initDB();
  return getStored<Device[]>(STORAGE_KEYS.DEVICES, []);
}

export function getDeviceByPatientId(patientId: string): Device | undefined {
  return getDevices().find(d => d.patientId === patientId);
}

export function saveDevice(device: Device): void {
  const devices = getDevices();
  const index = devices.findIndex(d => d.id === device.id);
  if (index >= 0) {
    devices[index] = device;
  } else {
    devices.push(device);
  }
  setStored(STORAGE_KEYS.DEVICES, devices);
  syncGoogleSheets(() => googleSheetsDb.assignDevice(device, getPatientById(device.patientId)));
}

// ----------------------------------------------------
// BLOOD PRESSURE READINGS
// ----------------------------------------------------
export function getBPReadings(): BPReading[] {
  initDB();
  return getStored<BPReading[]>(STORAGE_KEYS.BP_READINGS, []);
}

export function getBPReadingsByPatientId(patientId: string): BPReading[] {
  return getBPReadings()
    .filter(r => r.patientId === patientId)
    .sort((a, b) => b.dateTime.localeCompare(a.dateTime));
}

export function saveBPReading(reading: BPReading): void {
  const readings = getBPReadings();
  const index = readings.findIndex(r => r.id === reading.id);
  if (index >= 0) {
    readings[index] = reading;
  } else {
    readings.push(reading);
  }
  setStored(STORAGE_KEYS.BP_READINGS, readings);
  syncGoogleSheets(() => googleSheetsDb.createAuditLog({
    id: `act_${reading.id}`,
    userId: reading.recordedBy,
    userName: reading.recordedBy,
    userRole: 'NURSE',
    patientId: reading.patientId,
    action: reading.readingType === 'WEIGHT' ? 'Weight Reading Recorded' : 'Blood Pressure Reading Recorded',
    dateTime: reading.dateTime,
    entityType: 'BP_READING',
    details: reading.readingType === 'WEIGHT'
      ? `Weight: ${reading.weightLbs} lb`
      : `BP: ${reading.systolic}/${reading.diastolic}; Pulse: ${reading.pulse}`
  }));
}

// ----------------------------------------------------
// DOCUMENTS
// ----------------------------------------------------
export function getDocuments(): DocumentRecord[] {
  initDB();
  return getStored<DocumentRecord[]>(STORAGE_KEYS.DOCUMENTS, []);
}

export function getDocumentsByPatientId(patientId: string): DocumentRecord[] {
  return getDocuments().filter(d => d.patientId === patientId);
}

export function saveDocument(doc: DocumentRecord): void {
  // PDF data URLs are large. Keep only the latest document for each
  // patient/type pair so regenerating a record cannot exhaust localStorage.
  const docs = getDocuments().filter(
    existing => existing.id !== doc.id
      && !(existing.patientId === doc.patientId && existing.type === doc.type)
  );
  docs.push(doc);

  try {
    setStored(STORAGE_KEYS.DOCUMENTS, docs);
  } catch (error) {
    if (!(error instanceof DOMException) || error.name !== 'QuotaExceededError') {
      throw error;
    }

    // Preserve the document index while dropping large Base64 payloads.
    // The newly generated PDF remains downloadable from the active screen.
    const metadataOnly = docs.map(({ pdfDataUrl: _pdfDataUrl, ...record }) => record);
    localStorage.removeItem(STORAGE_KEYS.DOCUMENTS);

    try {
      setStored(STORAGE_KEYS.DOCUMENTS, metadataOnly);
      console.warn('PDF storage quota reached; document metadata was saved without Base64 payloads.');
    } catch (metadataError) {
      console.error('Unable to persist document metadata:', metadataError);
    }
  }
}

// ----------------------------------------------------
// AUDIT LOGS
// ----------------------------------------------------
export function getAuditLogs(): AuditLog[] {
  initDB();
  return getStored<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, []);
}

export function addAuditLog(
  userId: string,
  userName: string,
  userRole: UserRole,
  patientId: string | undefined,
  patientName: string | undefined,
  action: string,
  entityType: 'PATIENT' | 'VISIT' | 'CONSENT' | 'DEVICE' | 'BP_READING' | 'AUTH' | 'GENERAL',
  details: string
): void {
  const logs = getAuditLogs();
  const newLog: AuditLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId,
    userName,
    userRole,
    patientId,
    patientName,
    action,
    dateTime: new Date().toISOString(),
    entityType,
    details
  };
  logs.unshift(newLog); // Put new logs first
  setStored(STORAGE_KEYS.AUDIT_LOGS, logs);
  syncGoogleSheets(() => googleSheetsDb.createAuditLog(newLog));
}

// ----------------------------------------------------
// USER / SESSION
// ----------------------------------------------------
export function getCurrentUser(): User {
  initDB();
  return getStored<User>(STORAGE_KEYS.CURRENT_USER, SEED_USERS[0]);
}

export function setCurrentUser(user: User): void {
  setStored(STORAGE_KEYS.CURRENT_USER, user);
  addAuditLog(
    user.id,
    user.name,
    user.role,
    undefined,
    undefined,
    `Logged in as ${user.name} (${user.role})`,
    'AUTH',
    `User session established. Role: ${user.role}.`
  );
}

export function clearSession(): void {
  const user = getCurrentUser();
  if (user) {
    addAuditLog(
      user.id,
      user.name,
      user.role,
      undefined,
      undefined,
      'Logged out',
      'AUTH',
      `User session terminated.`
    );
  }
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
}
