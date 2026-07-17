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

export function getMedicalOrderRequirementIssues(patient, requestedDevice = patient.requiredDevice) {
  const issues = [];
  const diagnoses = Array.isArray(patient.diagnoses) ? patient.diagnoses : [];
  if (!String(patient.firstName || '').trim()) issues.push('First name is required');
  if (!String(patient.lastName || '').trim()) issues.push('Last name is required');
  if (!String(patient.birthDate || '').trim()) issues.push('Date of birth is required');
  if (!String(patient.medicareId || '').trim()) issues.push('Medicare ID is required');
  if (!String(patient.nursingHome || '').trim()) issues.push('Nursing home / facility is required');
  if (!String(patient.provider || '').trim()) issues.push('Supervising physician is required');
  if (!String(patient.assignedProgram || '').toUpperCase().includes('RPM')) issues.push('RPM program must be selected');
  if (!String(requestedDevice || '').trim() || requestedDevice === 'None') issues.push('Required device is required');
  if (!diagnoses.some(diagnosis =>
    String(diagnosis.icd10Code || diagnosis.icd10_code || '').trim()
    && String(diagnosis.icd10Display || diagnosis.icd10_display || '').trim()
  )) {
    issues.push('At least one diagnosis with ICD and ICD name is required');
  }
  return issues;
}

export function validateMedicalOrderRequirements(patient, requestedDevice = patient.requiredDevice) {
  const issues = getMedicalOrderRequirementIssues(patient, requestedDevice);
  if (issues.length) {
    throw validationError(`Medical order cannot be requested until required patient data is complete: ${issues.join('; ')}`);
  }
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
