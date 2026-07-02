const ICD10_PATTERN = /^[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/i;

export function validatePatient(patient, allPatients, allDevices) {
  const program = String(patient.assignedProgram || patient.program || '').toUpperCase();
  const diagnoses = Array.isArray(patient.diagnoses) ? patient.diagnoses : [];
  const validCodes = new Set(diagnoses
    .map(item => String(item.icd10Code || item.icd10_code || '').trim().toUpperCase())
    .filter(code => ICD10_PATTERN.test(code)));

  if (program.includes('CCM') && validCodes.size < 2) {
    throw validationError('CCM requires at least 2 chronic conditions with valid ICD-10 codes.');
  }
  if (program.includes('RPM') && !String(patient.requiredDevice || '').trim()) {
    throw validationError('RPM requires a device type.');
  }

  const duplicateCodes = diagnoses.length !== new Set(diagnoses.map(item =>
    String(item.icd10Code || item.icd10_code || '').trim().toUpperCase()
  )).size;
  if (duplicateCodes) throw validationError('Duplicate diagnoses are not allowed.');

  const serial = String(patient.deviceSerial || '').trim().toUpperCase();
  if (serial && allDevices.some(device =>
    device.patientId !== patient.id
    && String(device.serialNumber || '').trim().toUpperCase() === serial
    && device.status === 'ACTIVE'
  )) {
    throw validationError('Device serial is already assigned to an active patient.');
  }

  return patient;
}

export function validateConsent(consent) {
  if (!String(consent.signerName || '').trim() || !consent.status) {
    throw validationError('Consent requires signer name and decision.');
  }
}

export function validateDevice(device, patient, allDevices = []) {
  if (device.status === 'ACTIVE'
    && patient?.medicalOrder?.status !== 'ORDER_APPROVED') {
    throw validationError('Device activation requires an approved medical order.');
  }
  const serial = String(device.serialNumber || '').trim().toUpperCase();
  if (serial && allDevices.some(existing =>
    existing.id !== device.id
    && existing.patientId !== device.patientId
    && String(existing.serialNumber || '').trim().toUpperCase() === serial
    && ['ACTIVE', 'DELIVERED_ASSIGNED', 'AWAITING_FIRST_READING'].includes(existing.status)
  )) {
    throw validationError('Device serial is already assigned to another patient.');
  }
}

export function validationError(message) {
  const error = new Error(message);
  error.status = 422;
  return error;
}
