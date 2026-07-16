import { useMemo, useState } from 'react';
import { Edit3, Plus, Search, Trash2 } from 'lucide-react';
import { FacilityCatalog, Patient, User } from '../types';
import { useLanguage } from '../utils/LanguageContext';
import TablePagination, { usePaginatedRows } from './TablePagination';

interface FacilityManagementProps {
  currentUser: User;
  facilities: FacilityCatalog[];
  patients: Patient[];
  users: User[];
  onSaveFacility: (facility: FacilityCatalog) => Promise<void>;
  onDeleteFacility: (facility: FacilityCatalog) => Promise<void>;
  onNotify: (message: string, type?: 'success' | 'info') => void;
}

interface FacilityForm {
  id?: string;
  name: string;
  is_active: boolean;
}

export default function FacilityManagement({
  currentUser,
  facilities,
  patients,
  users,
  onSaveFacility,
  onDeleteFacility,
  onNotify
}: FacilityManagementProps) {
  const { language } = useLanguage();
  const l = (es: string, en: string) => language === 'ES' ? es : en;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [form, setForm] = useState<FacilityForm | null>(null);
  const [error, setError] = useState('');
  const [isDeletingId, setIsDeletingId] = useState('');
  const [isSavingId, setIsSavingId] = useState('');

  const visibleFacilities = useMemo(() => {
    return facilities
      .filter(facility => !facility.is_deleted)
      .filter(facility => {
        const label = (facility.display || facility.name || '').toLowerCase();
        return label.includes(search.toLowerCase());
      })
      .filter(facility => statusFilter === 'ALL' ? true : statusFilter === 'ACTIVE' ? facility.is_active !== false : facility.is_active === false)
      .sort((a, b) => (a.display || a.name).localeCompare(b.display || b.name));
  }, [facilities, search, statusFilter]);

  const pagination = usePaginatedRows(visibleFacilities);
  const paginationLabels = {
    showing: l('Mostrando', 'Showing'),
    of: l('de', 'of'),
    previous: l('Anterior', 'Previous'),
    next: l('Siguiente', 'Next')
  };

  const usageFor = (facility: FacilityCatalog) => {
    const names = new Set([facility.name, facility.display].filter(Boolean));
    const patientCount = patients.filter(patient => names.has(patient.nursingHome)).length;
    const userCount = users.filter(user => (user.nursingHomeAccess || []).some(home => names.has(home))).length;
    return { patientCount, userCount, canDelete: patientCount === 0 && userCount === 0 };
  };

  const openNew = () => {
    setError('');
    setForm({ name: '', is_active: true });
  };

  const saveForm = async () => {
    if (!form) return;
    const name = form.name.trim();
    if (!name) {
      setError(l('El nombre del facility es obligatorio.', 'Facility name is required.'));
      return;
    }
    const duplicate = facilities.find(facility =>
      facility.id !== form.id
      && !facility.is_deleted
      && (facility.display || facility.name).trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      setError(l('Ya existe un facility con ese nombre.', 'A facility with that name already exists.'));
      return;
    }
    const now = new Date().toISOString();
    const existing = form.id ? facilities.find(facility => facility.id === form.id) : undefined;
    const nextFacility = {
      id: form.id || `facility_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}_${Date.now()}`,
      name,
      display: name,
      is_active: form.is_active,
      created_at: existing?.created_at || now,
      created_by: existing?.created_by || currentUser.name,
      updated_at: now,
      updated_by: currentUser.name,
      source: existing?.source || 'manual'
    };
    setIsSavingId(nextFacility.id);
    try {
      await onSaveFacility(nextFacility);
      setForm(null);
    } catch {
      onNotify(l('No se pudo guardar el facility.', 'Unable to save facility.'), 'info');
    } finally {
      setIsSavingId('');
    }
  };

  const toggleFacility = async (facility: FacilityCatalog) => {
    setIsSavingId(facility.id);
    try {
      await onSaveFacility({
        ...facility,
        is_active: facility.is_active === false,
        updated_at: new Date().toISOString(),
        updated_by: currentUser.name
      });
    } catch {
      onNotify(l('No se pudo actualizar el facility.', 'Unable to update facility.'), 'info');
    } finally {
      setIsSavingId('');
    }
  };

  const deleteFacility = async (facility: FacilityCatalog) => {
    const usage = usageFor(facility);
    if (!usage.canDelete) {
      onNotify(l('No se puede eliminar: existen pacientes o usuarios asociados.', 'Cannot delete: patients or users are associated.'), 'info');
      return;
    }
    setIsDeletingId(facility.id);
    try {
      await onDeleteFacility(facility);
    } catch (caught) {
      const message = caught instanceof Error && caught.message === 'facility_in_use'
        ? l('No se puede eliminar: existen registros asociados a este facility.', 'Cannot delete: records are associated with this facility.')
        : l('No se pudo eliminar el facility.', 'Unable to delete facility.');
      onNotify(message, 'info');
    } finally {
      setIsDeletingId('');
    }
  };

  return (
    <div className="space-y-5" id="facility-management">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Nursing Home / Facility</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              {l('Gestiona facilities disponibles para registros, filtros y accesos de usuarios.', 'Manage facilities available for registration, filters, and user access.')}
            </p>
          </div>
          <button type="button" onClick={openNew} className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-xs font-extrabold text-white shadow-lg shadow-blue-600/10 transition hover:bg-blue-700">
            <Plus size={14} className="mr-1.5" />
            {l('Nuevo facility', 'New Facility')}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-3 border-b border-slate-200 bg-slate-50/60 p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder={l('Buscar facility...', 'Search facility...')} className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-xs font-semibold" />
          </div>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold">
            <option value="ALL">All status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left">Facility</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Patients</th>
                <th className="px-5 py-3 text-left">User Access</th>
                <th className="px-5 py-3 text-left">Updated</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagination.pageRows.map(facility => {
                const usage = usageFor(facility);
                return (
                  <tr key={facility.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <div className="font-extrabold text-slate-900">{facility.display || facility.name}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-slate-400">{facility.id}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${facility.is_active === false ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>
                        {facility.is_active === false ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-600">{usage.patientCount}</td>
                    <td className="px-5 py-4 font-bold text-slate-600">{usage.userCount}</td>
                    <td className="px-5 py-4 font-mono text-[10px] text-slate-500">{facility.updated_at ? new Date(facility.updated_at).toLocaleDateString() : '-'}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setForm({ id: facility.id, name: facility.display || facility.name, is_active: facility.is_active !== false })} disabled={isSavingId === facility.id || isDeletingId === facility.id} className="inline-flex items-center rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 font-bold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">
                          <Edit3 size={13} className="mr-1" /> Edit
                        </button>
                        <button type="button" onClick={() => void toggleFacility(facility)} disabled={isSavingId === facility.id || isDeletingId === facility.id} className="rounded-xl border border-slate-200 px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                          {facility.is_active === false ? 'Activate' : 'Deactivate'}
                        </button>
                        <button type="button" onClick={() => void deleteFacility(facility)} disabled={!usage.canDelete || isSavingId === facility.id || isDeletingId === facility.id} className="inline-flex items-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 font-bold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50">
                          <Trash2 size={13} className="mr-1" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pagination.pageRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center font-semibold text-slate-400">
                    {l('No hay facilities para mostrar.', 'No facilities to show.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          totalCount={visibleFacilities.length}
          page={pagination.page}
          pageSize={pagination.pageSize}
          totalPages={pagination.totalPages}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
          onPageChange={pagination.setPage}
          labels={paginationLabels}
        />
      </div>

      {form && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 p-5">
              <h3 className="text-lg font-extrabold text-slate-900">{form.id ? l('Editar facility', 'Edit Facility') : l('Nuevo facility', 'New Facility')}</h3>
            </div>
            <div className="space-y-4 p-5">
              <label className="space-y-1 text-xs font-bold text-slate-600">
                Facility name
                <input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800" />
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
                <input type="checkbox" checked={form.is_active} onChange={event => setForm({ ...form, is_active: event.target.checked })} />
                Active
              </label>
              {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 p-5">
              <button type="button" onClick={() => setForm(null)} disabled={Boolean(isSavingId)} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                {l('Cancelar', 'Cancel')}
              </button>
              <button type="button" onClick={() => void saveForm()} disabled={Boolean(isSavingId)} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                {isSavingId ? l('Guardando...', 'Saving...') : l('Guardar', 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
