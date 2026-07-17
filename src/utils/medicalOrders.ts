import { MedicalOrder, MedicalOrderStatus, Patient, User } from '../types';

export const MEDICAL_ORDER_VERSION = 'order_v2026_07_01';
export type OrderableDeviceType = 'BP Monitor' | 'Scale';

export function parseOrderDeviceTypes(value?: string): OrderableDeviceType[] {
  const parts = (value || '').split('+').map(part => part.trim());
  return (['BP Monitor', 'Scale'] as OrderableDeviceType[]).filter(device => parts.includes(device));
}

export function getOrderRequestedDevices(order?: MedicalOrder, patient?: Patient): OrderableDeviceType[] {
  if (order?.deviceApprovals?.length) {
    return order.deviceApprovals.map(device => device.deviceType);
  }
  return parseOrderDeviceTypes(order?.deviceType || patient?.requiredDevice);
}

export function getApprovedOrderDeviceTypes(patient: Patient): OrderableDeviceType[] {
  const orders = getPatientMedicalOrders(patient);
  return Array.from(new Set(orders.flatMap(order => {
    if (order.deviceApprovals?.length) {
      return order.deviceApprovals
        .filter(device => device.status === 'APPROVED')
        .map(device => device.deviceType);
    }
    return order.status === 'ORDER_APPROVED' ? getOrderRequestedDevices(order, patient) : [];
  })));
}

export function getPatientMedicalOrders(patient: Patient): MedicalOrder[] {
  const orders = patient.medicalOrders ? [...patient.medicalOrders] : [];
  if (patient.medicalOrder && !orders.some(order => order.id === patient.medicalOrder?.id)) {
    orders.push(patient.medicalOrder);
  }
  return orders;
}

export function getRequiredOrderDeviceTypes(patient: Patient): OrderableDeviceType[] {
  return parseOrderDeviceTypes(patient.requiredDevice);
}

export function patientRequiresDevice(patient: Patient): boolean {
  return patient.assignedProgram.includes('RPM') && Boolean(patient.requiredDevice && patient.requiredDevice !== 'None');
}

export function getMedicalOrderStatus(patient: Patient): MedicalOrderStatus | null {
  if (!patientRequiresDevice(patient)) return null;
  const order = patient.medicalOrder;
  const requiredDevices = getRequiredOrderDeviceTypes(patient);
  const approvedDevices = getApprovedOrderDeviceTypes(patient);
  if (requiredDevices.length > 0 && requiredDevices.every(device => approvedDevices.includes(device))) return 'ORDER_APPROVED';
  if (!order) return 'ORDER_REQUIRED';
  if (order.deviceApprovals?.length) {
    const requestedDevices = getOrderRequestedDevices(order, patient);
    const hasPendingCoverageForMissingDevices = requiredDevices
      .filter(device => !approvedDevices.includes(device))
      .every(device => requestedDevices.includes(device));
    if (!hasPendingCoverageForMissingDevices) return 'ORDER_REQUIRED';
    if (order.deviceApprovals.some(device => device.status === 'REJECTED')) return 'ORDER_REJECTED_NEEDS_REVISION';
    return 'ORDER_PENDING_PHYSICIAN_APPROVAL';
  }
  return order.status || 'ORDER_REQUIRED';
}

export function isMedicalOrderApproved(patient: Patient): boolean {
  return getMedicalOrderStatus(patient) === 'ORDER_APPROVED';
}

export function createMedicalOrder(patient: Patient, user: User, deviceType = patient.requiredDevice): MedicalOrder {
  const now = new Date().toISOString();
  const requestedDevices = parseOrderDeviceTypes(deviceType);
  return {
    id: `ord_${patient.id}_${Date.now()}`,
    status: 'ORDER_PENDING_PHYSICIAN_APPROVAL',
    deviceType,
    deviceApprovals: requestedDevices.map(device => ({
      deviceType: device,
      status: 'PENDING'
    })),
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
  return approveMedicalOrderDevices(patient, user, getOrderRequestedDevices(patient.medicalOrder, patient), notes);
}

export function approveMedicalOrderDevices(patient: Patient, user: User, approvedDevices: string[], notes?: string): MedicalOrder {
  const now = new Date().toISOString();
  const existingOrder = patient.medicalOrder || createMedicalOrder(patient, user);
  const requestedDevices = getOrderRequestedDevices(existingOrder, patient);
  const normalizedApprovedDevices = approvedDevices.filter((device): device is OrderableDeviceType =>
    requestedDevices.includes(device as OrderableDeviceType)
  );
  const deviceApprovals = requestedDevices.map(device => {
    const existingApproval = existingOrder.deviceApprovals?.find(approval => approval.deviceType === device);
    if (existingApproval?.status === 'APPROVED') return existingApproval;
    if (!normalizedApprovedDevices.includes(device)) {
      return existingApproval || { deviceType: device, status: 'PENDING' as const };
    }
    return {
      deviceType: device,
      status: 'APPROVED' as const,
      approvedAt: now,
      approvedBy: user.name,
      approvedByUserId: user.id,
      notes
    };
  });
  const allApproved = requestedDevices.length > 0 && requestedDevices.every(device =>
    deviceApprovals.some(approval => approval.deviceType === device && approval.status === 'APPROVED')
  );
  return {
    ...existingOrder,
    status: allApproved ? 'ORDER_APPROVED' : 'ORDER_PENDING_PHYSICIAN_APPROVAL',
    deviceApprovals,
    approvedAt: allApproved ? now : existingOrder.approvedAt,
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
        notes: notes || `Approved devices: ${normalizedApprovedDevices.join(', ') || 'None'}.`
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
