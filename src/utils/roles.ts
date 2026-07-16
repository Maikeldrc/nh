import { UserRole } from '../types';

export const AUXILIARY_PERSONNEL_ROLE: UserRole = 'AUXILIARY_PERSONNEL';

export const ROLE_OPTIONS: UserRole[] = ['ADMIN', 'NURSE', AUXILIARY_PERSONNEL_ROLE, 'PHYSICIAN', 'VIEWER', 'AUDITOR'];

export function isEnrollmentOperationsRole(role: UserRole): boolean {
  return role === 'NURSE' || role === AUXILIARY_PERSONNEL_ROLE;
}

export function roleDisplayName(role: UserRole): string {
  if (role === AUXILIARY_PERSONNEL_ROLE) return 'Auxiliary Personnel — Enrollment Operations';
  return role;
}
