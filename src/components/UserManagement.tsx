import { useMemo, useState } from 'react';
import { CheckCircle, Copy, Edit3, Plus, ShieldAlert, UserX, X } from 'lucide-react';
import { User, UserRole } from '../types';
import { useLanguage } from '../utils/LanguageContext';
import { createUser, updateUser, type UserMutationPayload } from '../utils/apiClient';
import TablePagination, { usePaginatedRows } from './TablePagination';
import { ROLE_OPTIONS, roleDisplayName } from '../utils/roles';

const ROLES: UserRole[] = ROLE_OPTIONS;

interface UserManagementProps {
  currentUser: User;
  users: User[];
  nursingHomes: string[];
  onUsersChanged: () => Promise<void>;
  onNotify: (message: string, type?: 'success' | 'info') => void;
}

interface FormState {
  id?: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  mfaRequired: boolean;
  facilityIdsText: string;
  nursingHomeAccess: string[];
}

const emptyForm = (): FormState => ({
  name: '',
  email: '',
  role: 'NURSE',
  active: true,
  mfaRequired: true,
  facilityIdsText: '',
  nursingHomeAccess: []
});

function splitValues(value: string): string[] {
  return [...new Set(value.split(/[\n,]+/).map(item => item.trim()).filter(Boolean))];
}

function joinValues(values?: string[]): string {
  return (values || []).join('\n');
}

export default function UserManagement({
  currentUser,
  users,
  nursingHomes,
  onUsersChanged,
  onNotify
}: UserManagementProps) {
  const { language } = useLanguage();
  const l = (es: string, en: string) => language === 'ES' ? es : en;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState('');
  const [setupLink, setSetupLink] = useState('');
  const [pendingDeactivation, setPendingDeactivation] = useState<FormState | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);
  const userPagination = usePaginatedRows(sortedUsers);
  const paginationLabels = {
    showing: l('Mostrando', 'Showing'),
    of: l('de', 'of'),
    previous: l('Anterior', 'Previous'),
    next: l('Siguiente', 'Next')
  };

  if (currentUser.role !== 'ADMIN') {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
        <ShieldAlert size={36} className="mx-auto text-rose-600" />
        <h2 className="mt-3 text-lg font-extrabold text-rose-900">{l('Acceso denegado', 'Access denied')}</h2>
        <p className="mt-1 text-sm font-semibold text-rose-700">
          {l('Solo administradores pueden gestionar usuarios y roles.', 'Only administrators can manage users and roles.')}
        </p>
      </div>
    );
  }

  const openCreate = () => {
    setForm(emptyForm());
    setError('');
    setSetupLink('');
    setIsModalOpen(true);
  };

  const openEdit = (user: User) => {
    setForm({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active !== false,
      mfaRequired: user.mfaRequired === true,
      facilityIdsText: joinValues(user.facilityIds),
      nursingHomeAccess: user.nursingHomeAccess || []
    });
    setError('');
    setSetupLink('');
    setIsModalOpen(true);
  };

  const payloadFromForm = (state: FormState): UserMutationPayload => ({
    name: state.name.trim(),
    email: state.email.trim().toLowerCase(),
    role: state.role,
    active: state.active,
    mfaRequired: state.mfaRequired,
    facilityIds: splitValues(state.facilityIdsText),
    nursingHomeAccess: state.nursingHomeAccess
  });

  const saveForm = async (state = form) => {
    const existing = state.id ? users.find(user => user.id === state.id) : undefined;
    if (existing?.active !== false && state.active === false && !pendingDeactivation) {
      setPendingDeactivation(state);
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      if (state.id) {
        await updateUser(state.id, payloadFromForm(state));
        onNotify(l('Usuario actualizado correctamente.', 'User updated successfully.'));
      } else {
        const result = await createUser(payloadFromForm(state));
        setSetupLink(result.setupLink || '');
        onNotify(l('Usuario creado correctamente.', 'User created successfully.'));
      }
      await onUsersChanged();
      if (state.id) setIsModalOpen(false);
      setPendingDeactivation(null);
    } catch (err) {
      setError(messageForError(err, l));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleUserActive = (user: User) => {
    const next: FormState = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active === false,
      mfaRequired: user.mfaRequired === true,
      facilityIdsText: joinValues(user.facilityIds),
      nursingHomeAccess: user.nursingHomeAccess || []
    };
    if (user.active !== false) {
      setPendingDeactivation(next);
      return;
    }
    void saveForm(next);
  };

  return (
    <div className="space-y-5" id="user-management">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">{l('Usuarios y roles', 'Users & Roles')}</h2>
            <p className="mt-1 max-w-3xl text-sm font-medium text-slate-500">
              {l(
                'Administra acceso, roles, MFA y asignaciones de facilities. Los cambios se aplican en Firebase Auth y en la pestaña Users de Google Sheets.',
                'Manage access, roles, MFA, and facility assignments. Changes are applied in Firebase Auth and the Google Sheets Users tab.'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-xs font-extrabold text-white shadow-lg shadow-blue-600/10 transition hover:bg-blue-700"
          >
            <Plus size={14} className="mr-1.5" />
            {l('Nuevo usuario', 'New User')}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left">{l('Usuario', 'User')}</th>
                <th className="px-5 py-3 text-left">{l('Rol', 'Role')}</th>
                <th className="px-5 py-3 text-left">{l('Estado', 'Status')}</th>
                <th className="px-5 py-3 text-left">MFA</th>
                <th className="px-5 py-3 text-left">{l('Facility IDs', 'Facility IDs')}</th>
                <th className="px-5 py-3 text-left">{l('Nursing homes', 'Nursing Homes')}</th>
                <th className="px-5 py-3 text-left">{l('Creado', 'Created')}</th>
                <th className="px-5 py-3 text-right">{l('Acciones', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {userPagination.pageRows.map(user => (
                <tr key={user.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-4">
                    <div className="font-extrabold text-slate-900">{user.name}</div>
                    <div className="mt-0.5 font-semibold text-slate-500">{user.email}</div>
                  </td>
                  <td className="px-5 py-4">{roleBadge(user.role)}</td>
                  <td className="px-5 py-4">{statusBadge(user.active !== false, l)}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2 py-0.5 font-extrabold ${user.mfaRequired ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {user.mfaRequired ? l('Requerido', 'Required') : l('No requerido', 'Not required')}
                    </span>
                  </td>
                  <td className="max-w-[190px] px-5 py-4 font-semibold text-slate-600">
                    {(user.facilityIds || []).length ? user.facilityIds?.join(', ') : '-'}
                  </td>
                  <td className="max-w-[260px] px-5 py-4 font-semibold text-slate-600">
                    {(user.nursingHomeAccess || []).length ? user.nursingHomeAccess?.join(', ') : '-'}
                  </td>
                  <td className="px-5 py-4 font-mono text-[10px] text-slate-500">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(user)}
                        className="inline-flex items-center rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 font-bold text-blue-700 hover:bg-blue-100"
                      >
                        <Edit3 size={13} className="mr-1" />
                        {l('Editar', 'Edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleUserActive(user)}
                        className={`inline-flex items-center rounded-xl border px-3 py-1.5 font-bold ${
                          user.active !== false
                            ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {user.active !== false ? <UserX size={13} className="mr-1" /> : <CheckCircle size={13} className="mr-1" />}
                        {user.active !== false ? l('Desactivar', 'Deactivate') : l('Activar', 'Activate')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          totalCount={sortedUsers.length}
          page={userPagination.page}
          pageSize={userPagination.pageSize}
          totalPages={userPagination.totalPages}
          startIndex={userPagination.startIndex}
          endIndex={userPagination.endIndex}
          onPageChange={userPagination.setPage}
          labels={paginationLabels}
        />
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 p-5">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  {form.id ? l('Editar usuario', 'Edit User') : l('Nuevo usuario', 'New User')}
                </h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {l('Los roles controlan lo que cada usuario puede ver y modificar.', 'Roles control what each user can see and modify.')}
                </p>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2">
              <label className="space-y-1 text-xs font-bold text-slate-600">
                {l('Nombre', 'Name')}
                <input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800" />
              </label>
              <label className="space-y-1 text-xs font-bold text-slate-600">
                Email
                <input value={form.email} disabled={Boolean(form.id)} onChange={event => setForm({ ...form, email: event.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 disabled:bg-slate-100" />
              </label>
              <label className="space-y-1 text-xs font-bold text-slate-600">
                {l('Rol', 'Role')}
                <select value={form.role} onChange={event => setForm({ ...form, role: event.target.value as UserRole })} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800">
                  {ROLES.map(role => <option key={role} value={role}>{roleDisplayName(role)}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <Toggle label={l('Activo', 'Active')} checked={form.active} onChange={active => setForm({ ...form, active })} />
                <Toggle label="MFA required" checked={form.mfaRequired} onChange={mfaRequired => setForm({ ...form, mfaRequired })} />
              </div>
              <label className="space-y-1 text-xs font-bold text-slate-600 md:col-span-2">
                Facility IDs
                <textarea value={form.facilityIdsText} onChange={event => setForm({ ...form, facilityIdsText: event.target.value })} rows={3} placeholder="facility_001&#10;facility_002" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800" />
                <span className="text-[10px] font-semibold text-slate-400">{l('Uno por línea o separados por coma.', 'One per line or comma-separated.')}</span>
              </label>
              <div className="space-y-2 md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-600">{l('Acceso a nursing homes', 'Nursing Home Access')}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, nursingHomeAccess: [...nursingHomes] })}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-extrabold text-blue-700 transition hover:bg-blue-100"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, nursingHomeAccess: [] })}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-extrabold text-slate-600 transition hover:bg-slate-50"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {nursingHomes.map(home => (
                    <label key={home} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.nursingHomeAccess.includes(home)}
                        onChange={event => {
                          const next = event.target.checked
                            ? [...form.nursingHomeAccess, home]
                            : form.nursingHomeAccess.filter(item => item !== home);
                          setForm({ ...form, nursingHomeAccess: next });
                        }}
                        className="mt-0.5"
                      />
                      <span>{home}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {error && <div className="mx-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">{error}</div>}
            {setupLink && (
              <div className="mx-5 mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-extrabold text-amber-900">{l('Enlace de configuración de contraseña', 'Password setup link')}</p>
                <p className="mt-1 text-xs font-semibold text-amber-800">
                  {l('Este enlace se muestra una sola vez. Envíalo por un canal seguro. No se guarda en Google Sheets.', 'This link is shown once. Send it through a secure channel. It is not stored in Google Sheets.')}
                </p>
                <div className="mt-3 flex gap-2">
                  <input readOnly value={setupLink} className="min-w-0 flex-1 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-slate-700" />
                  <button type="button" onClick={() => void navigator.clipboard.writeText(setupLink)} className="inline-flex items-center rounded-xl bg-amber-600 px-3 py-2 text-xs font-extrabold text-white">
                    <Copy size={13} className="mr-1" />
                    {l('Copiar', 'Copy')}
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 border-t border-slate-200 p-5">
              <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                {l('Cancelar', 'Cancel')}
              </button>
              <button type="button" disabled={isSaving} onClick={() => void saveForm()} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-blue-700 disabled:opacity-60">
                {isSaving ? l('Guardando...', 'Saving...') : l('Guardar usuario', 'Save User')}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeactivation && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <ShieldAlert size={32} className="text-rose-600" />
            <h3 className="mt-3 text-lg font-extrabold text-slate-900">{l('Confirmar desactivación', 'Confirm Deactivation')}</h3>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              {l('Este usuario no podrá iniciar sesión después de ser desactivado.', 'This user will no longer be able to sign in after deactivation.')}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setPendingDeactivation(null)} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700">
                {l('Cancelar', 'Cancel')}
              </button>
              <button type="button" onClick={() => void saveForm(pendingDeactivation)} className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-extrabold text-white">
                {l('Desactivar', 'Deactivate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
      {label}
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
    </label>
  );
}

function roleBadge(role: UserRole) {
  const styles: Record<UserRole, string> = {
    ADMIN: 'bg-blue-50 text-blue-700 border-blue-200',
    NURSE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    AUXILIARY_PERSONNEL: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    PHYSICIAN: 'bg-violet-50 text-violet-700 border-violet-200',
    VIEWER: 'bg-slate-50 text-slate-700 border-slate-200',
    AUDITOR: 'bg-amber-50 text-amber-700 border-amber-200'
  };
  return <span className={`rounded-full border px-2 py-0.5 font-extrabold ${styles[role] || styles.VIEWER}`}>{roleDisplayName(role)}</span>;
}

function statusBadge(active: boolean, l: (es: string, en: string) => string) {
  return active
    ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-extrabold text-emerald-700">{l('Activo', 'Active')}</span>
    : <span className="rounded-full bg-rose-50 px-2 py-0.5 font-extrabold text-rose-700">{l('Inactivo', 'Inactive')}</span>;
}

function messageForError(error: unknown, l: (es: string, en: string) => string): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('email_already_exists')) return l('El email ya existe.', 'Email already exists.');
  if (message.includes('missing_email')) return l('El email es obligatorio.', 'Email is required.');
  if (message.includes('missing_name')) return l('El nombre es obligatorio.', 'Name is required.');
  if (message.includes('missing_role')) return l('El rol es obligatorio.', 'Role is required.');
  if (message.includes('invalid_role')) return l('Rol inválido.', 'Invalid role.');
  if (message.includes('cannot_disable_last_admin')) return l('No puedes desactivar o quitar el último administrador activo.', 'You cannot disable or remove the last active administrator.');
  if (message.includes('permission')) return l('No tienes permisos para esta acción.', 'You do not have permission to perform this action.');
  if (message.includes('session')) return l('La sesión expiró. Inicia sesión nuevamente.', 'Your session expired. Sign in again.');
  return l('No se pudo guardar el usuario.', 'Unable to save the user.');
}
