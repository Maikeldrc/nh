import {
  AuditLog,
  BPReading,
  Consent,
  Device,
  DiagnosisCatalog,
  Medication,
  Patient,
  User
} from '../types';
import { SHEET_TABS } from './googleSheetsConfig';
import { enqueueGoogleSheetsAction, SheetWrite } from './googleSheetsClient';

const nowIso = () => new Date().toISOString();
const normalize = (value: unknown) => String(value ?? '').trim();
const boolText = (value: unknown) => Boolean(value) ? 'TRUE' : 'FALSE';
const id = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const orderStatusLabel = (status?: string) => {
  switch (status) {
    case 'ORDER_APPROVED': return 'Approved';
    case 'ORDER_REJECTED_NEEDS_REVISION': return 'Rejected / Needs Revision';
    case 'ORDER_PENDING_PHYSICIAN_APPROVAL': return 'Pending Physician Approval';
    default: return 'Order Required';
  }
};

const activationStatusLabel = (status?: string) => {
  switch (status) {
    case 'PENDING_ORDER_APPROVAL': return 'Pending Order Approval';
    case 'DELIVERED_ASSIGNED': return 'Delivered / Assigned';
    case 'AWAITING_FIRST_READING': return 'Awaiting First Reading';
    case 'ACTIVE': return 'Active';
    case 'NEEDS_SUPPORT': return 'Needs Support';
    default: return 'Not Started';
  }
};

const patientFacilityId = (patient: Patient) =>
  `fac_${normalize(patient.nursingHome).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'unknown'}`;

const write = (tab: string, primaryKey: string, row: Record<string, unknown>, mode: 'append' | 'upsert' | 'update' = 'upsert'): SheetWrite => ({
  tab,
  primaryKey,
  mode,
  row
});

function validatePatientForSheets(patient: Patient) {
  if (!patient.id) throw new Error('Missing required field: patient_id');
  if (!patient.firstName?.trim()) throw new Error('Missing required field: first_name');
  if (!patient.lastName?.trim()) throw new Error('Missing required field: last_name');
  if (patient.assignedProgram.includes('RPM') && (!patient.requiredDevice || patient.requiredDevice === 'None')) {
    throw new Error('RPM requires a device type.');
  }
  if (patient.assignedProgram.includes('CCM')) {
    const codes = new Set(
      (patient.diagnoses || [])
        .map(diagnosis => diagnosis.icd10Code?.trim().toUpperCase())
        .filter(code => code && /^[A-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/.test(code))
    );
    if (codes.size < 2) throw new Error('CCM requires at least 2 valid ICD-10 diagnoses.');
  }
}

function patientWrites(patient: Patient, user?: User | string): SheetWrite[] {
  validatePatientForSheets(patient);
  const actor = typeof user === 'string' ? user : user?.name || patient.assignedNurseName || 'System';
  const timestamp = nowIso();
  const facilityId = patientFacilityId(patient);
  const writes: SheetWrite[] = [
    write(SHEET_TABS.facilities, 'facility_id', {
      facility_id: facilityId,
      facility_name: patient.nursingHome,
      active: 'TRUE',
      updated_at: timestamp
    }),
    write(SHEET_TABS.patients, 'patient_id', {
      patient_id: patient.id,
      first_name: patient.firstName,
      last_name: patient.lastName,
      date_of_birth: patient.birthDate,
      medicare_id: patient.medicareId || '',
      facility_id: facilityId,
      room: patient.room || '',
      ltc_confirmed: boolText((patient.conditions || []).includes('Long Term Care (LTC)')),
      registration_status: patient.status,
      created_at: timestamp,
      created_by: actor,
      updated_at: timestamp,
      updated_by: actor
    }),
    write(SHEET_TABS.patientPrograms, 'patient_program_id', {
      patient_program_id: `pp_${patient.id}_${patient.assignedProgram.replace(/[^A-Za-z0-9]+/g, '_')}`,
      patient_id: patient.id,
      program: patient.assignedProgram,
      required_device: patient.requiredDevice || '',
      status: patient.status,
      start_date: patient.activationDate || timestamp,
      end_date: '',
      created_at: timestamp,
      created_by: actor
    })
  ];

  (patient.diagnoses || []).forEach(diagnosis => {
    writes.push(write(SHEET_TABS.diagnoses, 'diagnosis_id', {
      diagnosis_id: `dx_${patient.id}_${diagnosis.icd10Code.replace(/[^A-Za-z0-9]+/g, '_')}`,
      patient_id: patient.id,
      condition_group_display: diagnosis.conditionGroupDisplay,
      condition_group_code: diagnosis.conditionGroupCode,
      icd10_code: diagnosis.icd10Code,
      icd10_display: diagnosis.icd10Display,
      source: 'Patient Registration',
      selected_at: timestamp,
      selected_by: actor
    }));
  });

  (patient.medications || []).forEach((medication, index) => {
    if (typeof medication === 'string') {
      writes.push(write(SHEET_TABS.medications, 'medication_id', {
        medication_id: `med_${patient.id}_${index}`,
        patient_id: patient.id,
        medication_name: medication,
        normalized_medication_name: medication.toLowerCase(),
        strength: '',
        frequency: '',
        pending_review: 'FALSE',
        selected_at: timestamp,
        selected_by: actor
      }));
      return;
    }

    writes.push(write(SHEET_TABS.medications, 'medication_id', {
      medication_id: `med_${patient.id}_${medication.normalized_medication_name.replace(/[^A-Za-z0-9]+/g, '_')}_${index}`,
      patient_id: patient.id,
      medication_name: medication.medication_name,
      normalized_medication_name: medication.normalized_medication_name,
      strength: medication.strength,
      frequency: medication.frequency,
      pending_review: boolText(medication.pending_review),
      selected_at: medication.selected_at || timestamp,
      selected_by: medication.selected_by || actor
    }));
  });

  if (patient.medicalOrder) writes.push(medicalOrderWrite(patient));
  return writes;
}

function medicalOrderWrite(patient: Patient): SheetWrite {
  const order = patient.medicalOrder;
  if (!order) throw new Error('Missing medical order.');
  return write(SHEET_TABS.medicalOrders, 'order_id', {
    order_id: order.id,
    patient_id: patient.id,
    program: patient.assignedProgram,
    device_type: order.deviceType || patient.requiredDevice || '',
    ordering_physician: order.assignedPhysician,
    order_status: orderStatusLabel(order.status),
    order_created_at: order.createdAt,
    order_created_by: order.createdBy,
    physician_approved_at: order.approvedAt || '',
    physician_rejected_at: order.rejectedAt || '',
    rejection_reason: order.revisionNotes || '',
    order_pdf_url: ''
  });
}

export function createPatient(patient: Patient, user?: User | string): void {
  enqueueGoogleSheetsAction({ action: 'createPatient', writes: patientWrites(patient, user) });
}

export function updatePatient(patient: Patient, user?: User | string): void {
  enqueueGoogleSheetsAction({ action: 'updatePatient', writes: patientWrites(patient, user) });
}

export function createConsent(consent: Consent, patient?: Patient, user?: User | string): void {
  if (!consent.signerName?.trim()) throw new Error('Consent requires signer name.');
  if (!consent.status) throw new Error('Consent requires decision.');
  const actor = typeof user === 'string' ? user : user?.name || consent.capturedBy || consent.nurseName || 'System';
  const facilityId = patient ? patientFacilityId(patient) : consent.facility || '';
  const createdAt = consent.signedAt || consent.dateTime || nowIso();

  enqueueGoogleSheetsAction({
    action: 'createConsent',
    writes: [
      write(SHEET_TABS.consents, 'consent_id', {
        consent_id: consent.id,
        patient_id: consent.patientId,
        selected_programs: consent.program,
        consent_template_version: consent.consentVersion,
        consent_method: consent.consentMethod || consent.signatureMethod || 'SIGNATURE',
        signer_type: consent.signerType || consent.signedBy,
        signer_name: consent.signerName,
        decision: consent.status,
        signed_at: consent.signedAt || consent.dateTime,
        signed_by: consent.signedBy,
        consent_pdf_url: consent.pdfId || '',
        language: consent.language || '',
        created_at: createdAt,
        created_by: actor
      }),
      write(SHEET_TABS.consentAuditLog, 'audit_id', {
        audit_id: consent.auditId || id('aud'),
        consent_id: consent.id,
        patient_id: consent.patientId,
        decision: consent.status,
        signer_name: consent.signerName,
        signer_type: consent.signerType || consent.signedBy,
        captured_by: consent.capturedBy || actor,
        facility_id: facilityId,
        capture_device: consent.captureDevice || '',
        date_time: createdAt,
        audit_token: consent.auditId || '',
        ip_address: '',
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
      })
    ]
  });
}

export function createMedicalOrder(patient: Patient): void {
  if (!patient.medicalOrder) return;
  enqueueGoogleSheetsAction({ action: 'createMedicalOrder', writes: [medicalOrderWrite(patient)] });
}

export function updateMedicalOrderStatus(patient: Patient): void {
  if (!patient.medicalOrder) return;
  enqueueGoogleSheetsAction({ action: 'updateMedicalOrderStatus', writes: [medicalOrderWrite(patient)] });
}

export function assignDevice(device: Device, patient?: Patient, user?: User | string): void {
  if (!device.serialNumber?.trim()) throw new Error('Device serial number is required.');
  const actor = typeof user === 'string' ? user : user?.name || device.deliveredBy || 'System';
  const timestamp = device.deliveryDate || nowIso();
  enqueueGoogleSheetsAction({
    action: 'assignDevice',
    writes: [
      write(SHEET_TABS.devices, 'device_id', {
        device_id: device.id,
        serial_number: device.serialNumber,
        device_type: device.deviceType,
        vendor: device.brand,
        status: activationStatusLabel(device.status),
        assigned_patient_id: device.patientId,
        assigned_at: timestamp,
        assigned_by: actor
      }),
      write(SHEET_TABS.deviceActivation, 'activation_id', {
        activation_id: `act_${device.id}`,
        patient_id: device.patientId,
        device_id: device.id,
        technical_activation_status: activationStatusLabel(device.status),
        delivered_at: device.deliveryDate || '',
        assigned_at: timestamp,
        first_reading_received_at: device.status === 'ACTIVE' ? (device.activationDate || timestamp) : '',
        activated_at: device.activationDate || '',
        support_notes: device.notes || '',
        updated_by: actor,
        updated_at: nowIso()
      })
    ],
    metadata: { facility_id: patient ? patientFacilityId(patient) : undefined }
  });
}

export function updateDeviceActivationStatus(device: Device, user?: User | string): void {
  assignDevice(device, undefined, user);
}

export function addDiagnosis(patient: Patient, diagnosis: Patient['diagnoses'][number], selectedBy: string): void {
  enqueueGoogleSheetsAction({
    action: 'addDiagnosis',
    writes: [write(SHEET_TABS.diagnoses, 'diagnosis_id', {
      diagnosis_id: `dx_${patient.id}_${diagnosis.icd10Code.replace(/[^A-Za-z0-9]+/g, '_')}`,
      patient_id: patient.id,
      condition_group_display: diagnosis.conditionGroupDisplay,
      condition_group_code: diagnosis.conditionGroupCode,
      icd10_code: diagnosis.icd10Code,
      icd10_display: diagnosis.icd10Display,
      source: 'Manual',
      selected_at: nowIso(),
      selected_by: selectedBy
    })]
  });
}

export function addMedication(patientId: string, medication: Medication | string, selectedBy: string): void {
  const med = typeof medication === 'string'
    ? { medication_name: medication, normalized_medication_name: medication.toLowerCase(), strength: '', frequency: '', pending_review: false, selected_at: nowIso(), selected_by: selectedBy }
    : medication;

  enqueueGoogleSheetsAction({
    action: 'addMedication',
    writes: [write(SHEET_TABS.medications, 'medication_id', {
      medication_id: id('med'),
      patient_id: patientId,
      medication_name: med.medication_name,
      normalized_medication_name: med.normalized_medication_name,
      strength: med.strength,
      frequency: med.frequency,
      pending_review: boolText(med.pending_review),
      selected_at: med.selected_at || nowIso(),
      selected_by: med.selected_by || selectedBy
    })]
  });
}

export function createAuditLog(log: AuditLog): void {
  enqueueGoogleSheetsAction({
    action: 'createAuditLog',
    writes: [write(SHEET_TABS.activityLog, 'activity_id', {
      activity_id: log.id,
      entity_type: log.entityType,
      entity_id: log.patientId || '',
      patient_id: log.patientId || '',
      action: log.action,
      previous_value: '',
      new_value: log.details,
      performed_by: log.userName,
      performed_at: log.dateTime
    }, 'append')]
  });
}

export function createNurseAttestation(consent: Consent, patient?: Patient): void {
  enqueueGoogleSheetsAction({
    action: 'createNurseAttestation',
    writes: [write(SHEET_TABS.nurseAttestations, 'attestation_id', {
      attestation_id: `att_${consent.id}`,
      patient_id: consent.patientId,
      consent_id: consent.id,
      nurse_id: consent.capturedBy || consent.nurseName,
      attestation_text: (consent.nurseAttestations || []).join('; '),
      attested_at: consent.signedAt || consent.dateTime,
      facility_id: patient ? patientFacilityId(patient) : consent.facility || '',
      script_version: consent.consentVersion
    })]
  });
}

export function syncUsers(users: User[]): void {
  enqueueGoogleSheetsAction({
    action: 'syncUsers',
    writes: users.map(user => write(SHEET_TABS.users, 'user_id', {
      user_id: user.id,
      name: user.name,
      role: user.role,
      email: user.email,
      credentials: '',
      active: 'TRUE',
      created_at: nowIso()
    }))
  });
}

export function syncConditionCatalog(groups: { id: string; display: string; code: string }[], diagnoses: DiagnosisCatalog[], importedBy: string): void {
  enqueueGoogleSheetsAction({
    action: 'syncConditionCatalog',
    writes: diagnoses.map(diagnosis => write(SHEET_TABS.diagnoses, 'diagnosis_id', {
      diagnosis_id: `catalog_${diagnosis.condition_group_code}_${diagnosis.icd10_code}`.replace(/[^A-Za-z0-9_]+/g, '_'),
      patient_id: '',
      condition_group_display: groups.find(group => group.id === diagnosis.condition_group_id)?.display || diagnosis.condition_group_code,
      condition_group_code: diagnosis.condition_group_code,
      icd10_code: diagnosis.icd10_code,
      icd10_display: diagnosis.icd10_display,
      source: 'Catalog Import',
      selected_at: diagnosis.imported_at || nowIso(),
      selected_by: diagnosis.imported_by || importedBy
    }))
  });
}
