import { MedicalOrder, MedicalOrderStatus, Patient, User } from '../types';

export const MEDICAL_ORDER_VERSION = 'order_v2026_07_01';

export function patientRequiresDevice(patient: Patient): boolean {
  return patient.assignedProgram.includes('RPM') && Boolean(patient.requiredDevice && patient.requiredDevice !== 'None');
}

export function getMedicalOrderStatus(patient: Patient): MedicalOrderStatus | null {
  if (!patientRequiresDevice(patient)) return null;
  return patient.medicalOrder?.status || 'ORDER_REQUIRED';
}

export function isMedicalOrderApproved(patient: Patient): boolean {
  return getMedicalOrderStatus(patient) === 'ORDER_APPROVED';
}

export function createMedicalOrder(patient: Patient, user: User, deviceType = patient.requiredDevice): MedicalOrder {
  const now = new Date().toISOString();
  return {
    id: `ord_${patient.id}_${Date.now()}`,
    status: 'ORDER_PENDING_PHYSICIAN_APPROVAL',
    deviceType,
    createdAt: now,
    createdBy: user.name,
    createdByUserId: user.id,
    assignedPhysician: patient.provider,
    orderVersion: MEDICAL_ORDER_VERSION,
    submittedAt: now,
    auditTrail: [
      {
        action: 'CREATED',
        dateTime: now,
        userId: user.id,
        userName: user.name,
        notes: `Order for ${deviceType} generated and sent to ${patient.provider} for review.`
      }
    ]
  };
}

export function resubmitMedicalOrder(patient: Patient, user: User): MedicalOrder {
  const now = new Date().toISOString();
  const existingOrder = patient.medicalOrder || createMedicalOrder(patient, user);
  return {
    ...existingOrder,
    status: 'ORDER_PENDING_PHYSICIAN_APPROVAL',
    submittedAt: now,
    revisionNotes: undefined,
    auditTrail: [
      ...existingOrder.auditTrail,
      {
        action: 'RESENT',
        dateTime: now,
        userId: user.id,
        userName: user.name,
        notes: `Revised order resent to ${existingOrder.assignedPhysician}.`
      }
    ]
  };
}

export function approveMedicalOrder(patient: Patient, user: User, notes?: string): MedicalOrder {
  const now = new Date().toISOString();
  const existingOrder = patient.medicalOrder || createMedicalOrder(patient, user);
  return {
    ...existingOrder,
    status: 'ORDER_APPROVED',
    approvedAt: now,
    rejectedAt: undefined,
    reviewedBy: user.name,
    reviewedByUserId: user.id,
    revisionNotes: notes, // Store the approval notes here
    auditTrail: [
      ...existingOrder.auditTrail,
      {
        action: 'APPROVED',
        dateTime: now,
        userId: user.id,
        userName: user.name,
        notes: notes || `Order approved by ${user.name}.`
      }
    ]
  };
}

export function rejectMedicalOrder(patient: Patient, user: User, notes = 'Needs revision before device activation.'): MedicalOrder {
  const now = new Date().toISOString();
  const existingOrder = patient.medicalOrder || createMedicalOrder(patient, user);
  return {
    ...existingOrder,
    status: 'ORDER_REJECTED_NEEDS_REVISION',
    rejectedAt: now,
    approvedAt: undefined,
    reviewedBy: user.name,
    reviewedByUserId: user.id,
    revisionNotes: notes,
    auditTrail: [
      ...existingOrder.auditTrail,
      {
        action: 'REJECTED_NEEDS_REVISION',
        dateTime: now,
        userId: user.id,
        userName: user.name,
        notes
      }
    ]
  };
}

export function generateAutoOrderIfNeeded(patient: Patient, user: User): MedicalOrder | undefined {
  if (!patient.assignedProgram.includes('RPM')) return undefined;
  if (!patient.requiredDevice || patient.requiredDevice === 'None') return undefined;
  return createMedicalOrder(patient, user);
}
