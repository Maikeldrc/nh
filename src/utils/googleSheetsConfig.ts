export const GOOGLE_SHEETS_ENABLED =
  import.meta.env.VITE_GOOGLE_SHEETS_ENABLED === 'true';

export const GOOGLE_SHEETS_WEB_APP_URL =
  import.meta.env.VITE_GOOGLE_SHEETS_WEB_APP_URL || '';

export const GOOGLE_SHEETS_SPREADSHEET_ID =
  import.meta.env.VITE_GOOGLE_SHEETS_SPREADSHEET_ID || '';

export const SHEET_TABS = {
  patients: 'Patients',
  facilities: 'Facilities',
  programs: 'Programs',
  patientPrograms: 'Patient Programs',
  diagnoses: 'Conditions / Diagnoses',
  medications: 'Medications',
  medicalOrders: 'Medical Orders',
  devices: 'Devices',
  deviceActivation: 'Device Activation',
  consents: 'Consents',
  consentAuditLog: 'Consent Audit Log',
  nurseAttestations: 'Nurse Attestations',
  appAccess: 'App Access / Caregiver Access',
  users: 'Users',
  activityLog: 'Activity Log'
} as const;

export const ALLOWED_PROGRAMS = [
  'CCM',
  'RPM',
  'CCM + RPM',
  'CCM + PCM',
  'CCM + RPM + PCM',
  'PCM',
  'RTM',
  'Other'
] as const;

export const ALLOWED_ORDER_STATUSES = [
  'Order Required',
  'Pending Physician Approval',
  'Approved',
  'Rejected / Needs Revision'
] as const;

export const ALLOWED_TECHNICAL_ACTIVATION_STATUSES = [
  'Not Started',
  'Pending Order Approval',
  'Delivered / Assigned',
  'Awaiting First Reading',
  'Active',
  'Needs Support'
] as const;

export const REQUIRED_FIELDS = {
  Patients: ['patient_id', 'first_name', 'last_name', 'facility_id', 'registration_status'],
  'Patient Programs': ['patient_program_id', 'patient_id', 'program', 'status'],
  'Conditions / Diagnoses': ['diagnosis_id', 'patient_id', 'icd10_code', 'icd10_display'],
  Medications: ['medication_id', 'patient_id', 'medication_name'],
  'Medical Orders': ['order_id', 'patient_id', 'program', 'order_status'],
  Devices: ['device_id', 'serial_number', 'device_type', 'status'],
  'Device Activation': ['activation_id', 'patient_id', 'device_id', 'technical_activation_status'],
  Consents: ['consent_id', 'patient_id', 'decision', 'signer_name'],
  'Consent Audit Log': ['audit_id', 'consent_id', 'patient_id', 'decision'],
  'Nurse Attestations': ['attestation_id', 'patient_id', 'consent_id', 'nurse_id'],
  'Activity Log': ['activity_id', 'entity_type', 'entity_id', 'action', 'performed_by']
} as const;
