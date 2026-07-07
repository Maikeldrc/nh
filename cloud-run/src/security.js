import crypto from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) initializeApp();

export function requestContext(req, res, next) {
  req.requestId = req.get('x-request-id') || crypto.randomUUID();
  res.set('x-request-id', req.requestId);
  next();
}

export async function authenticate(req, res, next) {
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: 'authentication_required' });

  try {
    req.identity = await getAuth().verifyIdToken(match[1], true);
    return next();
  } catch {
    return res.status(401).json({ error: 'invalid_session' });
  }
}

export function normalizeUser(row) {
  const payload = row.record_json ? JSON.parse(row.record_json) : row;
  const role = String(payload.role || '').toUpperCase();
  const facilityIds = arrayValue(payload.facilityIds ?? payload.facility_ids);
  const nursingHomeAccess = arrayValue(
    payload.nursingHomeAccess ?? payload.nursing_home_access
  );
  return {
    id: payload.id || payload.user_id,
    identityUid: payload.identityUid || payload.identity_uid,
    email: String(payload.email || '').toLowerCase(),
    name: payload.name || '',
    role,
    active: booleanValue(payload.active),
    mfaRequired: booleanValue(payload.mfaRequired ?? payload.mfa_required),
    facilityIds,
    patientId: payload.patientId || payload.patient_id || undefined,
    nursingHomeAccess,
    createdAt: payload.createdAt || payload.created_at || undefined,
    createdBy: payload.createdBy || payload.created_by || undefined,
    updatedAt: payload.updatedAt || payload.updated_at || undefined,
    updatedBy: payload.updatedBy || payload.updated_by || undefined
  };
}

function arrayValue(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(value).split(',').map(item => item.trim()).filter(Boolean);
  }
}

function booleanValue(value) {
  return value === true || String(value).toLowerCase() === 'true';
}

export function canReadPatient(user, patient) {
  if (user.role === 'ADMIN' || user.role === 'AUDITOR') return true;
  if (user.patientId) return user.patientId === patient.id;
  if (patient.assignedNurseId === user.id) return true;
  return user.nursingHomeAccess.includes(patient.nursingHome)
    || user.facilityIds.includes(patient.facilityId);
}

export function canWritePatient(user, patient) {
  if (user.role === 'ADMIN') return true;
  if (!['NURSE', 'PHYSICIAN'].includes(user.role)) return false;
  return canReadPatient(user, patient);
}

export function requireRoles(...roles) {
  return (req, res, next) => roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ error: 'forbidden' });
}

export function hasSecondFactor(identity) {
  return Boolean(identity.firebase?.sign_in_second_factor);
}
