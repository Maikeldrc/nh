/**
 * Types and interfaces for AMAVITA CareStart, powered by ITERA.HEALTH.
 */

export type UserRole = 'NURSE' | 'AUXILIARY_PERSONNEL' | 'ADMIN' | 'PHYSICIAN' | 'VIEWER' | 'AUDITOR';

export interface User {
  id: string;
  identityUid?: string;
  name: string;
  role: UserRole;
  email: string;
  active?: boolean;
  mfaRequired?: boolean;
  facilityIds?: string[];
  patientId?: string;
  nursingHomeAccess?: string[]; // nursing home names accessible (nurses see their own or specific NH)
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export type PatientStatus =
  | 'PENDING_CONSENT'
  | 'CONSENT_COMPLETED'
  | 'CONSENT_DECLINED'
  | 'DEVICE_PENDING'
  | 'DEVICE_DELIVERED'
  | 'DEVICE_ACTIVATED'
  | 'FIRST_BP_RECORDED'
  | 'ENROLLMENT_COMPLETED_PENDING_ACTIVATION'
  | 'ACTIVE'
  | 'INCOMPLETE'
  | 'NEEDS_FOLLOW_UP';

export type MedicalOrderStatus =
  | 'ORDER_REQUIRED'
  | 'ORDER_PENDING_PHYSICIAN_APPROVAL'
  | 'ORDER_APPROVED'
  | 'ORDER_REJECTED_NEEDS_REVISION';

export interface MedicalOrderAudit {
  action: 'CREATED' | 'RESENT' | 'APPROVED' | 'REJECTED_NEEDS_REVISION';
  dateTime: string;
  userId: string;
  userName: string;
  notes?: string;
}

export interface MedicalOrder {
  id: string;
  status: MedicalOrderStatus;
  deviceType?: string;
  createdAt: string;
  createdBy: string;
  createdByUserId: string;
  assignedPhysician: string;
  orderVersion: string;
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  reviewedBy?: string;
  reviewedByUserId?: string;
  revisionNotes?: string;
  auditTrail: MedicalOrderAudit[];
}

export interface Medication {
  medication_name: string;
  normalized_medication_name: string;
  strength: string;
  frequency: string;
  source: string;
  selected_by: string;
  selected_at: string;
  pending_review?: boolean;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  medicareId?: string;
  nursingHome: string;
  room?: string;
  provider: string;
  practice: string;
  assignedProgram: string;
  conditions: string[];
  diagnoses?: PatientDiagnosis[];
  medications: (string | Medication)[];
  medicationsPendingReview?: boolean;
  requiredDevice: string;
  medicalOrder?: MedicalOrder;
  status: PatientStatus;
  assignedNurseId: string;
  assignedNurseName: string;
  activationDate?: string;
  activatedBy?: string;
  activationBlocker?: 'AWAITING_MEDICAL_ORDER_APPROVAL';
}

export interface PatientDiagnosis {
  conditionGroupCode: string;
  conditionGroupDisplay: string;
  icd10Code: string;
  icd10Display: string;
}

export interface ConditionGroupCatalog {
  id: string;
  display: string;
  code: string;
  description: string;
  icd10_count: number;
  is_active: boolean;
  imported_at: string;
  imported_by: string;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  source?: string;
  version?: string;
}

export interface DiagnosisCatalog {
  id: string;
  condition_group_id: string;
  condition_group_code: string;
  icd10_code: string;
  icd10_display: string;
  icd10_description: string;
  is_active: boolean;
  imported_at: string;
  imported_by: string;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  source?: string;
  version?: string;
  relationship_status?: 'ACTIVE' | 'INACTIVE' | 'UNASSIGNED';
}

export interface ProgramCatalog {
  id: string;
  code: string;
  display: string;
  description?: string;
  is_active: boolean;
  requires_device?: boolean;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  source?: string;
}

export interface FacilityCatalog {
  id: string;
  name: string;
  display: string;
  is_active: boolean;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  source?: string;
  is_deleted?: boolean;
  deleted_at?: string;
  deleted_by?: string;
}

export interface CatalogImportHistory {
  id: string;
  filename: string;
  imported_by: string;
  imported_at: string;
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  import_status: 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED';
  deactivate_missing: boolean;
}

export interface Visit {
  id: string;
  patientId: string;
  nurseId: string;
  nurseName: string;
  startTime: string;
  endTime?: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED';
  currentStep: number; // 1 to 7
  notes?: string;
  completedRequirements?: string[];
  missingRequirements?: string[];
  lastSavedBy?: string;
  lastSavedAt?: string;
  explanationLanguage?: string;
  interpreterUsed?: boolean;
  interpreterName?: string;
  preferredExplanationLanguage?: string;
  serviceExplanation?: {
    nurseUserId: string;
    nurseName: string;
    patientId: string;
    confirmedAt?: string;
    scriptVersion: string;
    checkboxMarked: boolean;
    status: 'explained_and_understood' | 'pending';
  };
  representativeName?: string;
  representativeRelationship?: string;
  representativeAuthority?: string;
  representativeContact?: string;
  formState?: Record<string, unknown>;
}

export interface Consent {
  id: string;
  patientId: string;
  visitId: string;
  program: string;
  status: 'GRANTED' | 'DECLINED';
  consentVersion: string;
  consentLegalText: string;
  consentPracticeName: string;
  consentEffectiveDate: string;
  signedBy: 'PATIENT' | 'REPRESENTATIVE';
  signerName: string;
  relationship?: string; // e.g. "Son", "Spouse" (if representative)
  authorityType?: 'DESIGNATED_HEALTH_CARE_SURROGATE' | 'HEALTH_CARE_POWER_OF_ATTORNEY' | 'COURT_APPOINTED_LEGAL_GUARDIAN' | 'STATUTORY_HEALTH_CARE_PROXY' | 'OTHER_LEGAL_AUTHORITY';
  authorityBasis?: string;
  representativePhone?: string;
  representativeSignatureMethod?: 'IN_PERSON' | 'REMOTE_LINK' | 'PHONE_VIDEO_VERBAL';
  consentMethod?: 'SIGNATURE' | 'TYPED_SIGNATURE' | 'VERBAL' | 'MARK_X' | 'REPRESENTATIVE_SIGNATURE';
  signatureMethod?: 'DRAW' | 'TYPE' | 'UNABLE';
  typedSignatureName?: string;
  typedSignatureAgreement?: boolean;
  signerType?: 'PATIENT' | 'AUTHORIZED_REPRESENTATIVE';
  signedAt?: string;
  capturedBy?: string;
  unableToSignReason?: string;
  declineReason?: string;
  nurseNotes?: string;
  nurseAttestations?: string[];
  finalAttestationText?: string;
  finalAttestationConfirmed?: boolean;
  finalAttestationConfirmedAt?: string;
  documentedByUserId?: string;
  documentedByName?: string;
  documentedByRole?: string;
  documentedAt?: string;
  signerIdentity?: string;
  representativeAuthority?: string;
  markXWitness?: {
    name: string;
    role: string;
    facility?: string;
    userId?: string;
    witnessedAt: string;
    witnessedByAuthenticatedUser: boolean;
  };
  markXEvidenceCaptured?: boolean;
  facility?: string;
  captureDevice?: string;
  language?: string;
  explanationLanguage?: string;
  declineDateTime?: string;
  patientSignature: string; // Base64 image
  nurseSignature: string; // Base64 image
  nurseName: string;
  dateTime: string;
  pdfGenerated: boolean;
  pdfId?: string;
  auditId: string;
}

export type TechnicalActivationStatus =
  | 'NOT_STARTED'
  | 'PENDING_ORDER_APPROVAL'
  | 'DELIVERED_ASSIGNED'
  | 'AWAITING_FIRST_READING'
  | 'ACTIVE'
  | 'NEEDS_SUPPORT';

export interface Device {
  id: string;
  patientId: string;
  deviceType: 'BP Monitor' | 'Scale' | 'Pulse Oximeter' | 'Glucometer' | 'Other';
  brand: string;
  model: string;
  serialNumber: string;
  kitId: string;
  deviceId: string;
  status: TechnicalActivationStatus;
  deliveryDate?: string;
  activationDate?: string;
  deliveredBy: string;
  deliveredToPatient: boolean;
  assignedToPatient: boolean;
  instructionsGiven: boolean;
  understandingDemonstrated: boolean;
  deviceActivated: boolean;
  nurseSignature?: string; // Base64 image
  recipientSignature?: string; // Base64 image
  notes?: string;
  providerOrderStatus?: 'YES' | 'NO' | 'PENDING';
  providerName?: string;
  providerOrderDate?: string;
  providerOrderReference?: string;
  providerOrderNotes?: string;
  pdfId?: string;
  pdfGenerated?: boolean;
}

export interface BPReading {
  id: string;
  patientId: string;
  visitId: string;
  readingType?: 'BLOOD_PRESSURE' | 'WEIGHT';
  deviceType?: 'BP Monitor' | 'Scale';
  systolic?: number;
  diastolic?: number;
  pulse?: number;
  weightLbs?: number;
  dateTime: string;
  arm?: 'LEFT' | 'RIGHT';
  position?: 'SITTING' | 'LYING' | 'STANDING';
  source: 'DEVICE' | 'MANUAL';
  rested?: boolean;
  cuffCorrect?: boolean;
  reviewedWithPatient: boolean;
  notes?: string;
  recordedBy: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  patientId?: string;
  patientName?: string;
  action: string;
  dateTime: string;
  entityType: 'PATIENT' | 'VISIT' | 'CONSENT' | 'DEVICE' | 'BP_READING' | 'AUTH' | 'GENERAL';
  details: string;
}

export interface DocumentRecord {
  id: string;
  patientId: string;
  patientName: string;
  visitId: string;
  type: 'CONSENT' | 'DEVICE_DELIVERY' | 'MEDICAL_ORDER';
  title: string;
  fileName?: string;
  dateTime: string;
  generatedBy: string;
  version?: string;
  driveFileId?: string;
}
