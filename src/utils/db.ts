import {
  AuditLog,
  BPReading,
  CatalogImportHistory,
  ConditionGroupCatalog,
  Consent,
  Device,
  DiagnosisCatalog,
  DocumentRecord,
  Patient,
  User,
  UserRole,
  Visit
} from '../types';
import {
  createActivity,
  getBootstrap,
  saveResource,
  type BootstrapPayload
} from './apiClient';

interface MemoryDatabase {
  users: User[];
  patients: Patient[];
  visits: Visit[];
  consents: Consent[];
  devices: Device[];
  readings: BPReading[];
  auditLogs: AuditLog[];
  documents: DocumentRecord[];
  conditionGroups: ConditionGroupCatalog[];
  diagnoses: DiagnosisCatalog[];
  catalogImports: CatalogImportHistory[];
  currentUser: User | null;
}

const emptyDatabase = (): MemoryDatabase => ({
  users: [],
  patients: [],
  visits: [],
  consents: [],
  devices: [],
  readings: [],
  auditLogs: [],
  documents: [],
  conditionGroups: [],
  diagnoses: [],
  catalogImports: [],
  currentUser: null
});

let db = emptyDatabase();

function reportRemoteFailure(error: unknown): void {
  window.dispatchEvent(new CustomEvent('amavita:api-error', {
    detail: error instanceof Error ? error.message : 'Secure service request failed.'
  }));
}

function remote(task: Promise<unknown>): void {
  void task.catch(reportRemoteFailure);
}

function replaceById<T extends { id: string }>(list: T[], record: T): T[] {
  const index = list.findIndex(item => item.id === record.id);
  if (index < 0) return [record, ...list];
  const next = [...list];
  next[index] = record;
  return next;
}

export function initDB(forceReset = false): void {
  if (forceReset) db = emptyDatabase();
}

export async function hydrateDB(): Promise<User> {
  const payload: BootstrapPayload = await getBootstrap();
  db = {
    users: payload.users || [],
    patients: payload.patients || [],
    visits: payload.visits || [],
    consents: payload.consents || [],
    devices: payload.devices || [],
    readings: payload.readings || [],
    documents: payload.documents || [],
    auditLogs: payload.auditLogs || [],
    conditionGroups: payload.conditionGroups || [],
    diagnoses: payload.diagnoses || [],
    catalogImports: payload.catalogImports || [],
    currentUser: payload.currentUser
  };
  return payload.currentUser;
}

export function getConditionGroups(): ConditionGroupCatalog[] {
  return [...db.conditionGroups];
}

export function getDiagnoses(): DiagnosisCatalog[] {
  return [...db.diagnoses];
}

export function getCatalogImportHistory(): CatalogImportHistory[] {
  return [...db.catalogImports];
}

export function saveConditionCatalog(
  groups: ConditionGroupCatalog[],
  diagnoses: DiagnosisCatalog[],
  history: CatalogImportHistory
): void {
  db.conditionGroups = groups;
  db.diagnoses = diagnoses;
  db.catalogImports = [history, ...db.catalogImports].slice(0, 50);
  remote(saveResource('catalog-imports', {
    ...history,
    groups,
    diagnoses
  }));
}

export function saveConditionGroup(group: ConditionGroupCatalog): void {
  db.conditionGroups = replaceById(db.conditionGroups, group);
  db.conditionGroups = db.conditionGroups.map(item => ({
    ...item,
    icd10_count: db.diagnoses.filter(diagnosis =>
      diagnosis.condition_group_id === item.id && diagnosis.is_active
    ).length
  }));
  remote(saveResource('condition-groups', group));
}

export function saveDiagnosis(diagnosis: DiagnosisCatalog): void {
  db.diagnoses = replaceById(db.diagnoses, diagnosis);
  db.conditionGroups = db.conditionGroups.map(group => ({
    ...group,
    icd10_count: db.diagnoses.filter(item =>
      item.condition_group_id === group.id && item.is_active
    ).length
  }));
  remote(saveResource('diagnoses', diagnosis));
}

export function setConditionGroupActive(id: string, isActive: boolean): void {
  const record = db.conditionGroups.find(item => item.id === id);
  if (!record) return;
  record.is_active = isActive;
  saveConditionGroup(record);
}

export function setDiagnosisActive(id: string, isActive: boolean): void {
  const record = db.diagnoses.find(item => item.id === id);
  if (!record) return;
  record.is_active = isActive;
  saveDiagnosis(record);
}

export function getPatients(): Patient[] {
  return [...db.patients];
}

export function getUsers(): User[] {
  return [...db.users];
}

export function getPatientById(id: string): Patient | undefined {
  return db.patients.find(patient => patient.id === id);
}

export function savePatient(patient: Patient): void {
  db.patients = replaceById(db.patients, patient);
  remote(saveResource('patients', patient));
}

export function getVisits(): Visit[] {
  return [...db.visits];
}

export function getVisitById(id: string): Visit | undefined {
  return db.visits.find(visit => visit.id === id);
}

export function getActiveVisitForPatient(patientId: string): Visit | undefined {
  return db.visits.find(visit =>
    visit.patientId === patientId && visit.status === 'IN_PROGRESS'
  );
}

export function getLatestVisitForPatient(patientId: string): Visit | undefined {
  return db.visits
    .filter(visit => visit.patientId === patientId)
    .sort((a, b) => b.startTime.localeCompare(a.startTime))[0];
}

export function saveVisit(visit: Visit): void {
  db.visits = replaceById(db.visits, visit);
  remote(saveResource('visits', visit));
}

export function getConsents(): Consent[] {
  return [...db.consents];
}

export function getConsentByPatientId(patientId: string): Consent | undefined {
  return db.consents
    .filter(consent => consent.patientId === patientId)
    .sort((a, b) => b.dateTime.localeCompare(a.dateTime))[0];
}

export function saveConsent(consent: Consent): void {
  db.consents = replaceById(db.consents, consent);
  remote(saveResource('consents', consent));
}

export function getDevices(): Device[] {
  return [...db.devices];
}

export function getDeviceByPatientId(patientId: string): Device | undefined {
  return db.devices.find(device => device.patientId === patientId);
}

export function saveDevice(device: Device): void {
  db.devices = replaceById(db.devices, device);
  remote(saveResource('devices', device));
}

export function getBPReadings(): BPReading[] {
  return [...db.readings];
}

export function getBPReadingsByPatientId(patientId: string): BPReading[] {
  return db.readings
    .filter(reading => reading.patientId === patientId)
    .sort((a, b) => b.dateTime.localeCompare(a.dateTime));
}

export function saveBPReading(reading: BPReading): void {
  db.readings = replaceById(db.readings, reading);
  remote(saveResource('readings', reading));
}

export function getDocuments(): DocumentRecord[] {
  return [...db.documents];
}

export function getDocumentsByPatientId(patientId: string): DocumentRecord[] {
  return db.documents.filter(document => document.patientId === patientId);
}

export function saveDocument(document: DocumentRecord): void {
  db.documents = replaceById(db.documents, document);
  remote(saveResource('documents', document));
}

export function getAuditLogs(): AuditLog[] {
  return [...db.auditLogs];
}

export function addAuditLog(
  userId: string,
  userName: string,
  userRole: UserRole,
  patientId: string | undefined,
  _patientName: string | undefined,
  action: string,
  entityType: AuditLog['entityType'],
  _details: string
): void {
  const log: AuditLog = {
    id: `log_${crypto.randomUUID()}`,
    userId,
    userName,
    userRole,
    patientId,
    action,
    dateTime: new Date().toISOString(),
    entityType,
    details: ''
  };
  db.auditLogs = [log, ...db.auditLogs];
  remote(createActivity({
    activity_id: log.id,
    action,
    entity_type: entityType,
    entity_id: patientId,
    patient_id: patientId,
    result: 'success'
  }));
}

export function getCurrentUser(): User | null {
  return db.currentUser;
}

export function setCurrentUser(user: User): void {
  db.currentUser = user;
}

export function clearSession(): void {
  db = emptyDatabase();
}
