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
    await activity(req, 'login_success', 'AUTH', req.user.id, undefined);
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
    const patient = resource === 'patients'
      ? record
      : await getRecord('patients', record.patientId);
    if (patient && !canWritePatient(req.user, patient)) {
      return res.status(403).json({ error: 'forbidden' });
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
    const saved = await upsertRecord(resource, id, record);
    await activity(req, actionFor(resource, record), resource, id, record.patientId || patient?.id);
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
    const input = req.body;
    const identity = await getAuth().createUser({
      email: input.email,
      displayName: input.name,
      disabled: input.active === false
    });
    const record = {
      id: `usr_${crypto.randomUUID()}`,
      identityUid: identity.uid,
      email: input.email.toLowerCase(),
      name: input.name,
      role: String(input.role || 'VIEWER').toUpperCase(),
      active: input.active !== false,
      mfaRequired: input.mfaRequired !== false,
      facilityIds: input.facilityIds || [],
      nursingHomeAccess: input.nursingHomeAccess || [],
      createdAt: new Date().toISOString(),
      createdBy: req.user.id
    };
    await upsertRecord('users', record.id, record);
    await activity(req, 'created_user', 'USER', record.id);
    return res.status(201).json(record);
  } catch (error) {
    return next(error);
  }
});

app.patch('/v1/users/:id', requireRoles('ADMIN'), async (req, res, next) => {
  try {
    const existing = await getRecord('users', req.params.id);
    if (!existing) return res.status(404).json({ error: 'not_found' });
    const updated = { ...existing, ...req.body, id: req.params.id };
    if (updated.identityUid && req.body.active !== undefined) {
      await getAuth().updateUser(updated.identityUid, { disabled: !req.body.active });
    }
    await upsertRecord('users', updated.id, updated);
    await activity(req, updated.active ? 'updated_user' : 'disabled_user', 'USER', updated.id);
    return res.json(updated);
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
    await activity(req, 'generated_pdf', 'DOCUMENT', document.id, patient.id);
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
    await activity(req, 'downloaded_pdf', 'DOCUMENT', document.id, patient.id);
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
  // Never log request bodies, tokens, patient identifiers, or exception payloads.
  console.error(JSON.stringify({
    severity: 'ERROR',
    request_id: req.requestId,
    route: req.route?.path || 'unknown',
    status: error.status || 500,
    error_type: error.name || 'Error'
  }));
  return res.status(error.status || 500).json({
    error: error.status === 422 ? error.message : 'secure_service_error',
    request_id: req.requestId
  });
});

function actionFor(resource, record) {
  if (resource === 'patients') return 'updated_patient';
  if (resource === 'diagnoses') return 'added_diagnosis';
  if (resource === 'medications') return 'added_medication';
  if (resource === 'medical-orders') return 'created_medical_order';
  if (resource === 'devices') return 'assigned_device';
  if (resource === 'device-activation') return 'changed_activation_status';
  if (resource === 'consents') return 'created_consent';
  if (resource === 'catalog-imports') return 'imported_icd10_catalog';
  return `updated_${resource.replaceAll('-', '_')}`;
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
