import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { getAuth } from 'firebase-admin/auth';
import { config } from './config.js';
import {
  appendActivity,
  getRecord,
  listRecords,
  resources,
  upsertRecord
} from './repository.js';
import {
  authenticate,
  canReadPatient,
  canWritePatient,
  hasSecondFactor,
  normalizeUser,
  requestContext,
  requireRoles
} from './security.js';
import { validateConsent, validateDevice, validatePatient } from './validation.js';
import { createPdf, getPdfBuffer } from './pdf.js';

const app = express();
const USER_ROLES = new Set(['ADMIN', 'NURSE', 'PHYSICIAN', 'VIEWER', 'AUDITOR']);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(requestContext);
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.frontendOrigins.includes(origin.replace(/\/+$/, ''))) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed.'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 3600
}));
app.use(express.json({ limit: '12mb', strict: true }));

app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.use('/v1', authenticate);
app.use('/v1', async (req, res, next) => {
  try {
    const rows = await listRecords('users');
    const row = rows.find(candidate => {
      const user = normalizeUser(candidate);
      return user.identityUid === req.identity.uid
        || user.email === String(req.identity.email || '').toLowerCase();
    });
    if (!row) return res.status(403).json({ error: 'user_not_provisioned' });
    req.user = normalizeUser(row);
    if (!req.user.active) return res.status(403).json({ error: 'user_disabled' });
    if (req.user.mfaRequired && !hasSecondFactor(req.identity)) {
      return res.status(403).json({ error: 'mfa_required' });
    }
    return next();
  } catch (error) {
    return next(error);
  }
});

app.get('/v1/bootstrap', async (req, res, next) => {
  try {
    const patients = (await listRecords('patients'))
      .filter(patient => canReadPatient(req.user, patient));
    const patientIds = new Set(patients.map(patient => patient.id));
    const related = async resource => (await listRecords(resource))
      .filter(record => !record.patientId || patientIds.has(record.patientId));
    const [visits, consents, devices, readings, documents, conditionGroups,
      diagnoses, catalogImports, auditLogs, users] = await Promise.all([
      related('visits'),
      related('consents'),
      related('devices'),
      related('readings'),
      related('documents'),
      listRecords('condition-groups'),
      listRecords('diagnoses'),
      listRecords('catalog-imports'),
      ['ADMIN', 'AUDITOR'].includes(req.user.role)
        ? related('activity-log')
        : Promise.resolve([]),
      req.user.role === 'ADMIN'
        ? listRecords('users').then(rows => rows.map(normalizeUser))
        : Promise.resolve([req.user])
    ]);
    activity(req, 'login_success', 'AUTH', req.user.id, undefined).catch(error => {
      console.error(JSON.stringify({
        severity: 'ERROR',
        request_id: req.requestId,
        route: '/v1/bootstrap',
        status: error.status || error.code || 500,
        error_type: error.name || 'Error',
        non_blocking: true
      }));
    });
    res.set('Cache-Control', 'no-store');
    return res.json({
      currentUser: req.user,
      users,
      patients,
      visits,
      consents,
      devices,
      readings,
      documents,
      auditLogs,
      conditionGroups,
      diagnoses,
      catalogImports
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/v1/:resource', async (req, res, next) => {
  try {
    const resource = req.params.resource;
    if (!resources[resource]) return res.status(404).json({ error: 'not_found' });
    let records = await listRecords(resource);
    if (resource === 'patients') {
      records = records.filter(record => canReadPatient(req.user, record));
    } else if (records.some(record => record.patientId)) {
      const patients = await listRecords('patients');
      const allowedIds = new Set(patients
        .filter(patient => canReadPatient(req.user, patient))
        .map(patient => patient.id));
      records = records.filter(record => !record.patientId || allowedIds.has(record.patientId));
    }
    res.set('Cache-Control', 'no-store');
    return res.json(records);
  } catch (error) {
    return next(error);
  }
});

app.put('/v1/:resource/:id', async (req, res, next) => {
  try {
    const { resource, id } = req.params;
    if (!resources[resource]) return res.status(404).json({ error: 'not_found' });
    if (['users', 'activity-log'].includes(resource)) {
      return res.status(405).json({ error: 'method_not_allowed' });
    }
    const record = { ...req.body, id };
    if (['condition-groups', 'diagnoses', 'catalog-imports'].includes(resource) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'forbidden' });
    }
    const patient = resource === 'patients'
      ? record
      : await getRecord('patients', record.patientId);
    if (patient && !canWritePatient(req.user, patient)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    if (req.user.role === 'PHYSICIAN') {
      if (resource !== 'patients') {
        return res.status(403).json({ error: 'forbidden' });
      }
      const existingPatient = await getRecord('patients', id);
      if (!existingPatient || !isMedicalOrderOnlyUpdate(existingPatient, record)) {
        return res.status(403).json({ error: 'forbidden' });
      }
    }
    if (resource === 'patients') {
      validatePatient(record, await listRecords('patients'), await listRecords('devices'));
      if (String(record.assignedProgram || '').toUpperCase().includes('RPM')
        && !record.medicalOrder) {
        record.medicalOrder = pendingMedicalOrder(record, req.user);
      }
    }
    if (resource === 'consents') validateConsent(record);
    if (resource === 'devices') {
      validateDevice(record, patient, await listRecords('devices'));
    }
    if (resource === 'condition-groups') {
      validateConditionGroup(record, await listRecords('condition-groups'), id);
    }
    if (resource === 'diagnoses') {
      validateDiagnosis(record, await listRecords('diagnoses'), await listRecords('condition-groups'), id);
    }
    const existing = ['condition-groups', 'diagnoses'].includes(resource)
      ? await getRecord(resource, id)
      : undefined;
    const saved = await upsertRecord(resource, id, record);
    await activity(req, actionFor(resource, record, existing), resource, id, record.patientId || patient?.id);
    return res.json(saved);
  } catch (error) {
    return next(error);
  }
});

app.post('/v1/activity-log', async (req, res, next) => {
  try {
    const allowed = ['action', 'entity_type', 'entity_id', 'patient_id', 'result'];
    const safe = Object.fromEntries(allowed.map(key => [key, req.body[key] || '']));
    await activity(
      req,
      safe.action,
      safe.entity_type,
      safe.entity_id,
      safe.patient_id,
      safe.result || 'success'
    );
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

app.post('/v1/users', requireRoles('ADMIN'), async (req, res, next) => {
  try {
    const input = normalizeUserInput(req.body, true);
    const existingUsers = (await listRecords('users')).map(normalizeUser);
    if (existingUsers.some(user => user.email === input.email)) {
      throw httpError(409, 'email_already_exists');
    }

    const identity = await getAuth().createUser({
      email: input.email,
      displayName: input.name,
      disabled: input.active === false
    });
    const setupLink = await getAuth().generatePasswordResetLink(input.email);
    const record = {
      id: `usr_${crypto.randomUUID()}`,
      user_id: undefined,
      identityUid: identity.uid,
      email: input.email,
      name: input.name,
      role: input.role,
      active: input.active,
      mfaRequired: input.mfaRequired,
      facilityIds: input.facilityIds,
      nursingHomeAccess: input.nursingHomeAccess,
      createdAt: new Date().toISOString(),
      createdBy: req.user.id
    };
    await upsertRecord('users', record.id, record);
    await activity(req, 'created_user', 'USER', record.id);
    return res.status(201).json({
      user: normalizeUser(record),
      setupLink
    });
  } catch (error) {
    return next(error);
  }
});

app.patch('/v1/users/:id', requireRoles('ADMIN'), async (req, res, next) => {
  try {
    const existingRows = await listRecords('users');
    const existing = existingRows.find(row => normalizeUser(row).id === req.params.id);
    if (!existing) return res.status(404).json({ error: 'not_found' });
    const existingUser = normalizeUser(existing);
    const input = normalizeUserInput(req.body, false);
    const nextActive = input.active ?? existingUser.active;
    const nextRole = input.role ?? existingUser.role;

    if (existingUser.role === 'ADMIN' && (nextActive === false || nextRole !== 'ADMIN')) {
      const otherActiveAdmins = existingRows
        .map(normalizeUser)
        .filter(user => user.id !== existingUser.id && user.role === 'ADMIN' && user.active);
      if (!otherActiveAdmins.length) throw httpError(422, 'cannot_disable_last_admin');
    }

    const updated = {
      ...existing,
      name: input.name ?? existingUser.name,
      email: existingUser.email,
      role: nextRole,
      active: nextActive,
      mfaRequired: input.mfaRequired ?? existingUser.mfaRequired,
      facilityIds: input.facilityIds ?? existingUser.facilityIds,
      nursingHomeAccess: input.nursingHomeAccess ?? existingUser.nursingHomeAccess,
      identityUid: existingUser.identityUid,
      createdAt: existingUser.createdAt,
      createdBy: existingUser.createdBy,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.id,
      id: req.params.id
    };

    if (updated.identityUid && input.active !== undefined) {
      await getAuth().updateUser(updated.identityUid, {
        disabled: !input.active,
        displayName: updated.name
      });
    } else if (updated.identityUid && input.name !== undefined) {
      await getAuth().updateUser(updated.identityUid, { displayName: updated.name });
    }

    await upsertRecord('users', updated.id, updated);
    await auditUserChanges(req, existingUser, normalizeUser(updated));
    return res.json(normalizeUser(updated));
  } catch (error) {
    return next(error);
  }
});

app.post('/v1/pdfs', async (req, res, next) => {
  try {
    const patient = await getRecord('patients', req.body.patientId);
    if (!patient || !canReadPatient(req.user, patient)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    const allowedTypes = ['CONSENT', 'DEVICE_DELIVERY', 'MEDICAL_ORDER'];
    if (!allowedTypes.includes(req.body.type)) {
      return res.status(422).json({ error: 'invalid_document_type' });
    }
    const { document } = await createPdf(req.body.type, patient, req.body.source || {}, req.user);
    await upsertRecord('documents', document.id, document);
    activity(req, 'generated_pdf', 'DOCUMENT', document.id, patient.id).catch(error => {
      console.error(JSON.stringify({
        severity: 'ERROR',
        request_id: req.requestId,
        route: '/v1/pdfs',
        status: error.status || error.code || 500,
        error_type: error.name || 'Error',
        non_blocking: true
      }));
    });
    return res.status(201).json(document);
  } catch (error) {
    return next(error);
  }
});

app.get('/v1/documents/:id/content', async (req, res, next) => {
  try {
    const document = await getRecord('documents', req.params.id);
    const patient = document && await getRecord('patients', document.patientId);
    if (!document || !patient || !canReadPatient(req.user, patient)) {
      return res.status(404).json({ error: 'not_found' });
    }
    const buffer = await getPdfBuffer(document.driveFileId);
    activity(req, 'downloaded_pdf', 'DOCUMENT', document.id, patient.id).catch(error => {
      console.error(JSON.stringify({
        severity: 'ERROR',
        request_id: req.requestId,
        route: '/v1/documents/:id/content',
        status: error.status || error.code || 500,
        error_type: error.name || 'Error',
        non_blocking: true
      }));
    });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${document.id}.pdf"`,
      'Cache-Control': 'private, no-store'
    });
    return res.send(buffer);
  } catch (error) {
    return next(error);
  }
});

app.use((error, req, res, _next) => {
  if (error.code === 'auth/email-already-exists') {
    error.status = 409;
    error.message = 'email_already_exists';
    error.expose = true;
  } else if ([429, 500, 502, 503, 504].includes(Number(error.code || error.status || error.response?.status))) {
    error.status = Number(error.code || error.status || error.response?.status);
    error.message = error.status === 429 ? 'service_rate_limited' : 'secure_service_unavailable';
    error.expose = true;
  }
  // Never log request bodies, tokens, patient identifiers, or exception payloads.
  const upstreamStatus = Number(error.cause?.status || error.cause?.code || error.cause?.response?.status || 0) || undefined;
  console.error(JSON.stringify({
    severity: 'ERROR',
    request_id: req.requestId,
    route: req.route?.path || 'unknown',
    status: error.status || 500,
    error_type: error.name || 'Error',
    error_message: sanitizeLogValue(error.message),
    stack_top: sanitizeLogValue(String(error.stack || '').split('\n')[1] || ''),
    upstream_status: upstreamStatus,
    upstream_error_type: error.cause?.name
  }));
  return res.status(error.status || 500).json({
    error: error.status && error.expose ? error.message : 'secure_service_error',
    request_id: req.requestId
  });
});

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  return error;
}

function sanitizeLogValue(value) {
  return String(value || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\bpat_[A-Za-z0-9_-]+\b/g, '[patient_id]')
    .replace(/\bdoc_[A-Za-z0-9_-]+\b/g, '[document_id]')
    .slice(0, 240);
}

function isMedicalOrderOnlyUpdate(existing, next) {
  const normalize = (record) => {
    const copy = { ...record };
    delete copy.medicalOrder;
    delete copy.medical_order;
    delete copy.patient_id;
    delete copy.updated_at;
    delete copy.updatedAt;
    return stableStringify(copy);
  };
  return normalize(existing) === normalize(next);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function normalizeUserInput(input, requireRequiredFields) {
  const email = input.email === undefined ? undefined : String(input.email || '').trim().toLowerCase();
  const name = input.name === undefined ? undefined : String(input.name || '').trim();
  const role = input.role === undefined ? undefined : String(input.role || '').trim().toUpperCase();
  if (requireRequiredFields && !email) throw httpError(422, 'missing_email');
  if (requireRequiredFields && !name) throw httpError(422, 'missing_name');
  if (requireRequiredFields && !role) throw httpError(422, 'missing_role');
  if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw httpError(422, 'invalid_email');
  }
  if (role !== undefined && !USER_ROLES.has(role)) throw httpError(422, 'invalid_role');
  return {
    email,
    name,
    role,
    active: input.active === undefined ? (requireRequiredFields ? true : undefined) : input.active !== false,
    mfaRequired: input.mfaRequired === undefined ? (requireRequiredFields ? true : undefined) : input.mfaRequired === true,
    facilityIds: input.facilityIds === undefined ? undefined : arrayValue(input.facilityIds),
    nursingHomeAccess: input.nursingHomeAccess === undefined ? undefined : arrayValue(input.nursingHomeAccess)
  };
}

function arrayValue(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map(item => String(item).trim()).filter(Boolean))];
  }
  if (!value) return [];
  return [...new Set(String(value).split(/[\n,]+/).map(item => item.trim()).filter(Boolean))];
}

async function auditUserChanges(req, before, after) {
  const tasks = [];
  if (before.active !== after.active) {
    tasks.push(activity(req, after.active ? 'enabled_user' : 'disabled_user', 'USER', after.id));
  }
  if (before.role !== after.role) {
    tasks.push(activity(req, 'changed_user_role', 'USER', after.id));
  }
  if (JSON.stringify(before.facilityIds) !== JSON.stringify(after.facilityIds)
    || JSON.stringify(before.nursingHomeAccess) !== JSON.stringify(after.nursingHomeAccess)) {
    tasks.push(activity(req, 'changed_user_access', 'USER', after.id));
  }
  tasks.push(activity(req, 'updated_user', 'USER', after.id));
  await Promise.all(tasks);
}

function actionFor(resource, record, existing) {
  if (resource === 'patients') return 'updated_patient';
  if (resource === 'condition-groups') {
    if (!existing) return 'condition_group_created';
    if (existing.is_active !== record.is_active) {
      return record.is_active ? 'condition_group_activated' : 'condition_group_deactivated';
    }
    return 'condition_group_updated';
  }
  if (resource === 'diagnoses') {
    if (!existing) return 'diagnosis_created';
    if (existing.condition_group_id !== record.condition_group_id) return 'diagnosis_moved_to_group';
    if (existing.is_active !== record.is_active) {
      return record.is_active ? 'diagnosis_activated' : 'diagnosis_deactivated';
    }
    return 'diagnosis_updated';
  }
  if (resource === 'medications') return 'added_medication';
  if (resource === 'medical-orders') return 'created_medical_order';
  if (resource === 'devices') return 'assigned_device';
  if (resource === 'device-activation') return 'changed_activation_status';
  if (resource === 'consents') return 'created_consent';
  if (resource === 'catalog-imports') return 'imported_icd10_catalog';
  return `updated_${resource.replaceAll('-', '_')}`;
}

function validateConditionGroup(group, allGroups, id) {
  const display = String(group.display || '').trim();
  const code = String(group.code || '').trim();
  if (!display) throw httpError(422, 'condition_group_display_required');
  if (!code) throw httpError(422, 'condition_group_code_required');
  const duplicate = allGroups.find(item =>
    String(item.id) !== String(id)
    && String(item.code || '').trim().toLowerCase() === code.toLowerCase()
  );
  if (duplicate) throw httpError(422, 'duplicate_condition_group_code');
}

function validateDiagnosis(diagnosis, allDiagnoses, allGroups, id) {
  const code = String(diagnosis.icd10_code || '').trim().toUpperCase();
  const display = String(diagnosis.icd10_display || '').trim();
  if (!code) throw httpError(422, 'icd10_code_required');
  if (!display) throw httpError(422, 'icd10_display_required');
  if (!/^[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/i.test(code)) {
    throw httpError(422, 'invalid_icd10_code');
  }
  if (diagnosis.condition_group_id) {
    const group = allGroups.find(item => String(item.id) === String(diagnosis.condition_group_id));
    if (!group) throw httpError(422, 'condition_group_not_found');
  }
  const groupCode = String(diagnosis.condition_group_code || '').trim().toLowerCase();
  const duplicate = allDiagnoses.find(item =>
    String(item.id) !== String(id)
    && String(item.condition_group_code || '').trim().toLowerCase() === groupCode
    && String(item.icd10_code || '').trim().toUpperCase() === code
  );
  if (duplicate) throw httpError(422, 'duplicate_icd10_in_condition_group');
}

function pendingMedicalOrder(patient, user) {
  return {
    id: `ord_${crypto.randomUUID()}`,
    status: 'ORDER_PENDING_PHYSICIAN_APPROVAL',
    deviceType: patient.requiredDevice,
    createdAt: new Date().toISOString(),
    createdBy: user.name,
    createdByUserId: user.id,
    assignedPhysician: patient.provider || '',
    orderVersion: '1.0',
    auditTrail: []
  };
}

async function activity(req, action, entityType, entityId, patientId, result = 'success') {
  return appendActivity({
    activity_id: `act_${crypto.randomUUID()}`,
    user_id: req.user.id,
    user_name: req.user.name,
    role: req.user.role,
    action,
    entity_type: entityType,
    entity_id: entityId || '',
    patient_id: patientId || '',
    timestamp: new Date().toISOString(),
    result,
    request_id: req.requestId
  });
}

app.listen(config.port, () => {
  console.log(JSON.stringify({
    severity: 'INFO',
    message: 'AMAVITA secure API started',
    port: config.port
  }));
});
