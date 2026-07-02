import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateConsent,
  validateDevice,
  validatePatient
} from '../src/validation.js';

const basePatient = {
  id: 'pat_1',
  assignedProgram: 'CCM + RPM',
  requiredDevice: 'BP Monitor',
  diagnoses: [
    { icd10Code: 'I10' },
    { icd10Code: 'E11.9' }
  ]
};

test('CCM accepts two unique valid ICD-10 diagnoses', () => {
  assert.doesNotThrow(() => validatePatient(basePatient, [], []));
});

test('CCM rejects fewer than two valid ICD-10 diagnoses', () => {
  assert.throws(
    () => validatePatient({
      ...basePatient,
      diagnoses: [{ icd10Code: 'I10' }, { icd10Code: 'category-only' }]
    }, [], []),
    /CCM requires at least 2/
  );
});

test('CCM rejects duplicate diagnoses', () => {
  assert.throws(
    () => validatePatient({
      ...basePatient,
      diagnoses: [{ icd10Code: 'I10' }, { icd10Code: 'I10' }]
    }, [], []),
    /CCM requires at least 2|Duplicate diagnoses/
  );
});

test('RPM requires a device type', () => {
  assert.throws(
    () => validatePatient({
      ...basePatient,
      assignedProgram: 'RPM',
      requiredDevice: ''
    }, [], []),
    /RPM requires a device type/
  );
});

test('consent requires signer and decision', () => {
  assert.throws(
    () => validateConsent({ signerName: '', status: 'GRANTED' }),
    /signer name and decision/
  );
});

test('active device requires an approved medical order', () => {
  assert.throws(
    () => validateDevice({ id: 'dev_1', status: 'ACTIVE' }, {
      medicalOrder: { status: 'ORDER_PENDING_PHYSICIAN_APPROVAL' }
    }),
    /approved medical order/
  );
});

test('device serial cannot be assigned to another active patient', () => {
  assert.throws(
    () => validateDevice({
      id: 'dev_2',
      patientId: 'pat_2',
      serialNumber: 'ABC-123',
      status: 'DELIVERED_ASSIGNED'
    }, {}, [{
      id: 'dev_1',
      patientId: 'pat_1',
      serialNumber: 'abc-123',
      status: 'ACTIVE'
    }]),
    /already assigned/
  );
});
