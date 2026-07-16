import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Download,
  Edit3,
  FileSpreadsheet,
  Link2,
  Plus,
  Search,
  ShieldAlert,
  X
} from 'lucide-react';
import {
  CatalogImportHistory,
  ConditionGroupCatalog,
  DiagnosisCatalog,
  ProgramCatalog,
  User
} from '../types';
import { useLanguage } from '../utils/LanguageContext';

type CatalogTab = 'overview' | 'programs' | 'groups' | 'diagnoses' | 'relationships' | 'history';

interface Props {
  currentUser: User;
  groups: ConditionGroupCatalog[];
  diagnoses: DiagnosisCatalog[];
  history: CatalogImportHistory[];
  programs: ProgramCatalog[];
  onImportExcel: () => void;
  onSaveGroup: (group: ConditionGroupCatalog) => void;
  onSaveDiagnosis: (diagnosis: DiagnosisCatalog) => void;
  onSaveProgram: (program: ProgramCatalog) => void;
  onNotify: (message: string, type?: 'success' | 'info') => void;
}

interface GroupForm {
  id?: string;
  display: string;
  code: string;
  description: string;
  is_active: boolean;
}

interface DiagnosisForm {
  id?: string;
  condition_group_id: string;
  icd10_code: string;
  icd10_display: string;
  icd10_description: string;
  is_active: boolean;
}

interface ProgramForm {
  id?: string;
  code: string;
  display: string;
  description: string;
  is_active: boolean;
  requires_device: boolean;
}

const cleanCode = (value: string) => value.trim().replace(/\s+/g, '_');
const cleanIcd = (value: string) => value.trim().toUpperCase();

export default function ClinicalCatalogManagement({
  currentUser,
  groups,
  diagnoses,
  history,
  programs,
  onImportExcel,
  onSaveGroup,
  onSaveDiagnosis,
  onSaveProgram,
  onNotify
}: Props) {
  const { language } = useLanguage();
  const l = (es: string, en: string) => language === 'ES' ? es : en;
  const [tab, setTab] = useState<CatalogTab>('overview');
  const [groupSearch, setGroupSearch] = useState('');
  const [diagnosisSearch, setDiagnosisSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [diagnosisFilter, setDiagnosisFilter] = useState('ALL');
  const [diagnosisGroupFilter, setDiagnosisGroupFilter] = useState('');
  const [programSearch, setProgramSearch] = useState('');
  const [programFilter, setProgramFilter] = useState('ALL');
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id || '');
  const [groupForm, setGroupForm] = useState<GroupForm | null>(null);
  const [diagnosisForm, setDiagnosisForm] = useState<DiagnosisForm | null>(null);
  const [programForm, setProgramForm] = useState<ProgramForm | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; body: string; action: () => void } | null>(null);
  const [error, setError] = useState('');

  const metrics = useMemo(() => {
    const activeGroups = groups.filter(group => group.is_active).length;
    const inactiveGroups = groups.length - activeGroups;
    const activeDiagnoses = diagnoses.filter(diagnosis => diagnosis.is_active).length;
    const inactiveDiagnoses = diagnoses.length - activeDiagnoses;
    const withoutGroup = diagnoses.filter(diagnosis => !diagnosis.condition_group_id).length;
    const latestImport = [...history].sort((a, b) => b.imported_at.localeCompare(a.imported_at))[0];
    const latestUpdated = [...groups, ...diagnoses]
      .map(item => ({ at: item.updated_at || item.imported_at || '', by: item.updated_by || item.imported_by || '' }))
      .filter(item => item.at)
      .sort((a, b) => b.at.localeCompare(a.at))[0];
    const activePrograms = programs.filter(program => program.is_active).length;
    return { activeGroups, inactiveGroups, activeDiagnoses, inactiveDiagnoses, withoutGroup, latestImport, latestUpdated, activePrograms };
  }, [groups, diagnoses, history, programs]);

  const filteredPrograms = useMemo(() => {
    return programs
      .filter(program => program.display.toLowerCase().includes(programSearch.toLowerCase())
        || program.code.toLowerCase().includes(programSearch.toLowerCase()))
      .filter(program => programFilter === 'ALL' ? true : programFilter === 'ACTIVE' ? program.is_active : !program.is_active)
      .sort((a, b) => a.display.localeCompare(b.display));
  }, [programs, programSearch, programFilter]);

  const filteredGroups = useMemo(() => {
    return groups
      .filter(group => group.display.toLowerCase().includes(groupSearch.toLowerCase())
        || group.code.toLowerCase().includes(groupSearch.toLowerCase()))
      .filter(group => groupFilter === 'ALL' ? true : groupFilter === 'ACTIVE' ? group.is_active : !group.is_active)
      .sort((a, b) => a.display.localeCompare(b.display));
  }, [groups, groupSearch, groupFilter]);

  const filteredDiagnoses = useMemo(() => {
    return diagnoses
      .filter(diagnosis => diagnosis.icd10_code.toLowerCase().includes(diagnosisSearch.toLowerCase())
        || diagnosis.icd10_display.toLowerCase().includes(diagnosisSearch.toLowerCase())
        || diagnosis.icd10_description.toLowerCase().includes(diagnosisSearch.toLowerCase()))
      .filter(diagnosis => diagnosisFilter === 'ALL' ? true : diagnosisFilter === 'ACTIVE' ? diagnosis.is_active : !diagnosis.is_active)
      .filter(diagnosis => diagnosisGroupFilter ? diagnosis.condition_group_id === diagnosisGroupFilter : true)
      .sort((a, b) => a.icd10_code.localeCompare(b.icd10_code));
  }, [diagnoses, diagnosisSearch, diagnosisFilter, diagnosisGroupFilter]);

  const selectedGroup = groups.find(group => group.id === selectedGroupId) || groups[0];
  const selectedGroupDiagnoses = selectedGroup
    ? diagnoses.filter(diagnosis => diagnosis.condition_group_id === selectedGroup.id)
    : [];

  if (currentUser.role !== 'ADMIN') {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
        <ShieldAlert size={36} className="mx-auto text-rose-600" />
        <h2 className="mt-3 text-lg font-extrabold text-rose-900">{l('Acceso denegado', 'Access denied')}</h2>
        <p className="mt-1 text-sm font-semibold text-rose-700">
          {l('Solo administradores pueden gestionar el catálogo clínico.', 'Only administrators can manage the clinical catalog.')}
        </p>
      </div>
    );
  }

  const openNewGroup = () => {
    setError('');
    setGroupForm({ display: '', code: '', description: '', is_active: true });
  };

  const openNewProgram = () => {
    setError('');
    setProgramForm({ code: '', display: '', description: '', is_active: true, requires_device: false });
  };

  const openNewDiagnosis = (groupId = selectedGroup?.id || groups[0]?.id || '') => {
    setError('');
    setDiagnosisForm({
      condition_group_id: groupId,
      icd10_code: '',
      icd10_display: '',
      icd10_description: '',
      is_active: true
    });
  };

  const saveGroup = () => {
    if (!groupForm) return;
    const display = groupForm.display.trim();
    const code = cleanCode(groupForm.code);
    if (!display || !code) {
      setError(l('Display y code son obligatorios.', 'Display and code are required.'));
      return;
    }
    const duplicate = groups.find(group => group.id !== groupForm.id && group.code.toLowerCase() === code.toLowerCase());
    if (duplicate) {
      setError(l('Ya existe un grupo con ese code.', 'A group with that code already exists.'));
      return;
    }
    const now = new Date().toISOString();
    const savedGroup: ConditionGroupCatalog = {
      id: groupForm.id || `cg_${code.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}`,
      display,
      code,
      description: groupForm.description.trim(),
      icd10_count: diagnoses.filter(diagnosis => diagnosis.condition_group_id === groupForm.id && diagnosis.is_active).length,
      is_active: groupForm.is_active,
      imported_at: groupForm.id ? groups.find(group => group.id === groupForm.id)?.imported_at || now : now,
      imported_by: groupForm.id ? groups.find(group => group.id === groupForm.id)?.imported_by || currentUser.name : currentUser.name,
      created_at: groupForm.id ? groups.find(group => group.id === groupForm.id)?.created_at : now,
      created_by: groupForm.id ? groups.find(group => group.id === groupForm.id)?.created_by : currentUser.name,
      updated_at: now,
      updated_by: currentUser.name,
      source: 'manual'
    };
    onSaveGroup(savedGroup);
    if (groupForm.id) {
      diagnoses
        .filter(diagnosis => diagnosis.condition_group_id === groupForm.id && diagnosis.condition_group_code !== code)
        .forEach(diagnosis => onSaveDiagnosis({
          ...diagnosis,
          condition_group_code: code,
          updated_at: now,
          updated_by: currentUser.name
        }));
    }
    setGroupForm(null);
    onNotify(l('Grupo clínico guardado.', 'Clinical category saved.'));
  };

  const saveProgram = () => {
    if (!programForm) return;
    const code = cleanCode(programForm.code);
    const display = programForm.display.trim();
    if (!code || !display) {
      setError(l('Code y display son obligatorios.', 'Code and display are required.'));
      return;
    }
    const duplicate = programs.find(program => program.id !== programForm.id && program.code.toLowerCase() === code.toLowerCase());
    if (duplicate) {
      setError(l('Ya existe un programa con ese code.', 'A program with that code already exists.'));
      return;
    }
    const now = new Date().toISOString();
    const existing = programForm.id ? programs.find(program => program.id === programForm.id) : undefined;
    onSaveProgram({
      id: programForm.id || `program_${code.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}`,
      code,
      display,
      description: programForm.description.trim(),
      is_active: programForm.is_active,
      requires_device: programForm.requires_device,
      created_at: existing?.created_at || now,
      created_by: existing?.created_by || currentUser.name,
      updated_at: now,
      updated_by: currentUser.name,
      source: existing?.source || 'manual'
    });
    setProgramForm(null);
  };

  const saveDiagnosis = () => {
    if (!diagnosisForm) return;
    const group = groups.find(item => item.id === diagnosisForm.condition_group_id);
    const icd10 = cleanIcd(diagnosisForm.icd10_code);
    const display = diagnosisForm.icd10_display.trim();
    if (!icd10 || !display) {
      setError(l('ICD-10 code y display son obligatorios.', 'ICD-10 code and display are required.'));
      return;
    }
    if (!/^[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/i.test(icd10)) {
      setError(l('Formato ICD-10 inválido.', 'Invalid ICD-10 format.'));
      return;
    }
    const duplicate = diagnoses.find(diagnosis =>
      diagnosis.id !== diagnosisForm.id
      && diagnosis.condition_group_id === diagnosisForm.condition_group_id
      && diagnosis.icd10_code.toUpperCase() === icd10
    );
    if (duplicate) {
      setError(l('Ya existe ese ICD-10 dentro del grupo seleccionado.', 'That ICD-10 already exists in the selected group.'));
      return;
    }
    const now = new Date().toISOString();
    const existing = diagnosisForm.id ? diagnoses.find(diagnosis => diagnosis.id === diagnosisForm.id) : undefined;
    onSaveDiagnosis({
      id: diagnosisForm.id || `dx_${(group?.code || 'unassigned').toLowerCase()}_${icd10.toLowerCase().replace('.', '_')}_${Date.now()}`,
      condition_group_id: group?.id || '',
      condition_group_code: group?.code || '',
      icd10_code: icd10,
      icd10_display: display,
      icd10_description: diagnosisForm.icd10_description.trim() || display,
      is_active: diagnosisForm.is_active,
      imported_at: existing?.imported_at || now,
      imported_by: existing?.imported_by || currentUser.name,
      created_at: existing?.created_at || now,
      created_by: existing?.created_by || currentUser.name,
      updated_at: now,
      updated_by: currentUser.name,
      source: 'manual',
      relationship_status: group ? 'ACTIVE' : 'UNASSIGNED'
    });
    setDiagnosisForm(null);
    onNotify(l('Diagnóstico guardado.', 'Diagnosis saved.'));
  };

  const toggleGroup = (group: ConditionGroupCatalog) => {
    const activeDiagnoses = diagnoses.filter(diagnosis => diagnosis.condition_group_id === group.id && diagnosis.is_active).length;
    const action = () => {
      onSaveGroup({ ...group, is_active: !group.is_active, updated_at: new Date().toISOString(), updated_by: currentUser.name });
      setConfirm(null);
      onNotify(group.is_active ? l('Grupo desactivado.', 'Clinical category deactivated.') : l('Grupo activado.', 'Clinical category activated.'));
    };
    if (group.is_active && activeDiagnoses > 0) {
      setConfirm({
        title: l('Desactivar grupo clínico', 'Deactivate Clinical Category'),
        body: l(`Este grupo tiene ${activeDiagnoses} diagnósticos activos. No se eliminarán, pero dejarán de aparecer para nuevos registros si el grupo queda inactivo.`, `This group has ${activeDiagnoses} active diagnoses. They will not be deleted, but the group will stop appearing for new registrations.`),
        action
      });
    } else {
      action();
    }
  };

  const toggleDiagnosis = (diagnosis: DiagnosisCatalog) => {
    setConfirm({
      title: diagnosis.is_active ? l('Desactivar diagnóstico', 'Deactivate Diagnosis') : l('Activar diagnóstico', 'Activate Diagnosis'),
      body: l('Los pacientes existentes conservarán su diagnóstico histórico.', 'Existing patients will keep their historical diagnosis.'),
      action: () => {
        onSaveDiagnosis({ ...diagnosis, is_active: !diagnosis.is_active, updated_at: new Date().toISOString(), updated_by: currentUser.name });
        setConfirm(null);
        onNotify(diagnosis.is_active ? l('Diagnóstico desactivado.', 'Diagnosis deactivated.') : l('Diagnóstico activado.', 'Diagnosis activated.'));
      }
    });
  };

  const toggleProgram = (program: ProgramCatalog) => {
    onSaveProgram({
      ...program,
      is_active: !program.is_active,
      updated_at: new Date().toISOString(),
      updated_by: currentUser.name
    });
    onNotify(program.is_active ? l('Programa desactivado.', 'Program deactivated.') : l('Programa activado.', 'Program activated.'));
  };

  const moveDiagnosis = (diagnosis: DiagnosisCatalog, groupId: string) => {
    const group = groups.find(item => item.id === groupId);
    if (!group) return;
    onSaveDiagnosis({
      ...diagnosis,
      condition_group_id: group.id,
      condition_group_code: group.code,
      relationship_status: 'ACTIVE',
      updated_at: new Date().toISOString(),
      updated_by: currentUser.name
    });
    onNotify(l('Relación actualizada.', 'Relationship updated.'));
  };

  const exportCsv = () => {
    const rows = [
      ['condition_group_code', 'condition_group_display', 'condition_group_active', 'icd10_code', 'icd10_display', 'icd10_description', 'diagnosis_active'],
      ...diagnoses.map(diagnosis => {
        const group = groups.find(item => item.id === diagnosis.condition_group_id);
        return [
          group?.code || diagnosis.condition_group_code,
          group?.display || '',
          String(group?.is_active ?? ''),
          diagnosis.icd10_code,
          diagnosis.icd10_display,
          diagnosis.icd10_description,
          String(diagnosis.is_active)
        ];
      })
    ];
    const csv = rows.map(row => row.map(cell => `"${String(cell || '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `amavita-clinical-catalog-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onNotify(l('Catálogo exportado.', 'Catalog exported.'), 'info');
  };

  return (
    <div className="space-y-5" id="clinical-catalog-management">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">{l('Conditions & Diagnoses', 'Conditions & Diagnoses')}</h2>
            <p className="mt-1 max-w-3xl text-sm font-medium text-slate-500">
              {l(
                'Gestiona categorías clínicas, diagnósticos ICD-10 y sus relaciones. Los cambios afectan nuevos registros; pacientes existentes conservan su historial.',
                'Manage clinical categories, ICD-10 diagnoses, and their relationships. Changes affect new registrations; existing patient records keep their history.'
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={openNewGroup} className="inline-flex items-center rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-extrabold text-blue-700 hover:bg-blue-100">
              <Plus size={14} className="mr-1" /> {l('New Condition Group', 'New Condition Group')}
            </button>
            <button onClick={() => openNewDiagnosis()} className="inline-flex items-center rounded-xl bg-blue-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-blue-700">
              <Plus size={14} className="mr-1" /> {l('New Diagnosis', 'New Diagnosis')}
            </button>
            <button onClick={onImportExcel} className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50">
              <FileSpreadsheet size={14} className="mr-1" /> {l('Import Excel', 'Import Excel')}
            </button>
            <button onClick={exportCsv} className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50">
              <Download size={14} className="mr-1" /> {l('Export Catalog', 'Export Catalog')}
            </button>
          </div>
        </div>
      </div>

      <div className="flex max-w-3xl rounded-xl border border-slate-200 bg-white p-1">
        {(['overview', 'programs', 'groups', 'diagnoses', 'relationships', 'history'] as CatalogTab[]).map(item => (
          <button key={item} onClick={() => setTab(item)} className={`flex-1 rounded-xl px-3 py-2 text-xs font-extrabold ${tab === item ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
            {tabLabel(item, l)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <Metric label={l('Active Groups', 'Active Groups')} value={metrics.activeGroups} />
          <Metric label={l('Inactive Groups', 'Inactive Groups')} value={metrics.inactiveGroups} tone="amber" />
          <Metric label={l('Active ICD-10', 'Active ICD-10')} value={metrics.activeDiagnoses} tone="emerald" />
          <Metric label={l('Active Programs', 'Active Programs')} value={metrics.activePrograms} tone="violet" />
          <Metric label={l('Inactive ICD-10', 'Inactive ICD-10')} value={metrics.inactiveDiagnoses} tone="rose" />
          <Metric label={l('Without Group', 'Without Group')} value={metrics.withoutGroup} tone="violet" />
          <Metric label={l('Last Import', 'Last Import')} value={metrics.latestImport ? new Date(metrics.latestImport.imported_at).toLocaleDateString() : '-'} />
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 md:col-span-3 xl:col-span-6">
            <p className="text-sm font-extrabold text-blue-900">
              {l('Cambios a este catálogo afectan qué condiciones y diagnósticos estarán disponibles durante el registro de pacientes. Los registros históricos no se modifican automáticamente.', 'Changes to this catalog affect which conditions and diagnoses are available during patient registration. Existing patient records are not automatically changed.')}
            </p>
            <p className="mt-2 text-xs font-semibold text-blue-700">
              {l('Última actualización por', 'Last updated by')}: {metrics.latestUpdated?.by || '-'} {metrics.latestUpdated?.at ? `· ${new Date(metrics.latestUpdated.at).toLocaleString()}` : ''}
            </p>
          </div>
        </div>
      )}

      {tab === 'programs' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 p-4">
            <Toolbar search={programSearch} setSearch={setProgramSearch} filter={programFilter} setFilter={setProgramFilter} placeholder={l('Search programs...', 'Search programs...')} />
            <button onClick={openNewProgram} className="inline-flex items-center rounded-xl bg-blue-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-blue-700">
              <Plus size={14} className="mr-1" /> {l('New Program', 'New Program')}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3 text-left">Program</th>
                  <th className="px-5 py-3 text-left">Code</th>
                  <th className="px-5 py-3 text-left">Device</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Updated</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPrograms.map(program => (
                  <tr key={program.id}>
                    <td className="px-5 py-4"><strong className="text-slate-900">{program.display}</strong><p className="mt-1 text-slate-500">{program.description || '-'}</p></td>
                    <td className="px-5 py-4 font-mono font-bold text-slate-600">{program.code}</td>
                    <td className="px-5 py-4 font-bold text-slate-600">{program.requires_device ? 'Required' : 'Not required'}</td>
                    <td className="px-5 py-4"><StatusBadge active={program.is_active} l={l} /></td>
                    <td className="px-5 py-4 text-[10px] font-semibold text-slate-500">{program.updated_at ? new Date(program.updated_at).toLocaleString() : '-'}</td>
                    <td className="px-5 py-4 text-right">
                      <ActionButtons
                        onEdit={() => setProgramForm({ id: program.id, code: program.code, display: program.display, description: program.description || '', is_active: program.is_active, requires_device: program.requires_device === true })}
                        onToggle={() => toggleProgram(program)}
                        active={program.is_active}
                        l={l}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'groups' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Toolbar search={groupSearch} setSearch={setGroupSearch} filter={groupFilter} setFilter={setGroupFilter} placeholder={l('Search condition groups...', 'Search condition groups...')} />
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3 text-left">Display</th>
                  <th className="px-5 py-3 text-left">Code</th>
                  <th className="px-5 py-3 text-left">ICD-10</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Updated</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGroups.map(group => (
                  <tr key={group.id}>
                    <td className="px-5 py-4"><strong className="text-slate-900">{group.display}</strong><p className="mt-1 text-slate-500">{group.description || '-'}</p></td>
                    <td className="px-5 py-4 font-mono font-bold text-slate-600">{group.code}</td>
                    <td className="px-5 py-4 font-extrabold">{group.icd10_count}</td>
                    <td className="px-5 py-4"><StatusBadge active={group.is_active} l={l} /></td>
                    <td className="px-5 py-4 text-[10px] font-semibold text-slate-500">{group.updated_at ? new Date(group.updated_at).toLocaleString() : group.imported_at ? new Date(group.imported_at).toLocaleString() : '-'}</td>
                    <td className="px-5 py-4 text-right">
                      <ActionButtons
                        onView={() => { setSelectedGroupId(group.id); setTab('relationships'); }}
                        onEdit={() => setGroupForm({ id: group.id, display: group.display, code: group.code, description: group.description, is_active: group.is_active })}
                        onToggle={() => toggleGroup(group)}
                        active={group.is_active}
                        l={l}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'diagnoses' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap gap-3 border-b border-slate-200 bg-slate-50/60 p-4">
            <div className="relative min-w-[240px] flex-1">
              <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
              <input value={diagnosisSearch} onChange={event => setDiagnosisSearch(event.target.value)} placeholder={l('Search ICD-10 or diagnosis...', 'Search ICD-10 or diagnosis...')} className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-xs font-semibold" />
            </div>
            <select value={diagnosisFilter} onChange={event => setDiagnosisFilter(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold">
              <option value="ALL">All status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <select value={diagnosisGroupFilter} onChange={event => setDiagnosisGroupFilter(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold">
              <option value="">All groups</option>
              {groups.map(group => <option key={group.id} value={group.id}>{group.display}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3 text-left">ICD-10</th>
                  <th className="px-5 py-3 text-left">Diagnosis</th>
                  <th className="px-5 py-3 text-left">Clinical Category</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDiagnoses.map(diagnosis => (
                  <tr key={diagnosis.id}>
                    <td className="px-5 py-4"><span className="rounded-lg bg-blue-50 px-2 py-1 font-mono font-extrabold text-blue-700">{diagnosis.icd10_code}</span></td>
                    <td className="px-5 py-4"><strong className="text-slate-900">{diagnosis.icd10_display}</strong><p className="mt-1 text-slate-500">{diagnosis.icd10_description}</p></td>
                    <td className="px-5 py-4 font-semibold text-slate-600">{groups.find(group => group.id === diagnosis.condition_group_id)?.display || '-'}</td>
                    <td className="px-5 py-4"><StatusBadge active={diagnosis.is_active} l={l} /></td>
                    <td className="px-5 py-4 text-right">
                      <ActionButtons
                        onEdit={() => setDiagnosisForm({ id: diagnosis.id, condition_group_id: diagnosis.condition_group_id, icd10_code: diagnosis.icd10_code, icd10_display: diagnosis.icd10_display, icd10_description: diagnosis.icd10_description, is_active: diagnosis.is_active })}
                        onToggle={() => toggleDiagnosis(diagnosis)}
                        active={diagnosis.is_active}
                        l={l}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'relationships' && (
        <div className="grid gap-4 lg:grid-cols-[minmax(280px,0.9fr)_minmax(420px,1.5fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <input value={groupSearch} onChange={event => setGroupSearch(event.target.value)} placeholder={l('Search clinical categories...', 'Search clinical categories...')} className="mb-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold" />
            <div className="max-h-[520px] space-y-2 overflow-y-auto">
              {filteredGroups.map(group => (
                <button key={group.id} onClick={() => setSelectedGroupId(group.id)} className={`w-full rounded-xl border p-3 text-left ${selectedGroup?.id === group.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <span className="block text-xs font-extrabold text-slate-900">{group.display}</span>
                  <span className="mt-1 flex items-center justify-between text-[10px] font-bold text-slate-500">
                    {group.code} · {diagnoses.filter(diagnosis => diagnosis.condition_group_id === group.id).length} ICD-10
                    <StatusBadge active={group.is_active} l={l} compact />
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">{selectedGroup?.display || l('Select a category', 'Select a category')}</h3>
                <p className="text-xs font-semibold text-slate-500">{l('Diagnósticos relacionados al grupo seleccionado.', 'Diagnoses related to the selected category.')}</p>
              </div>
              <button onClick={() => openNewDiagnosis(selectedGroup?.id)} className="inline-flex items-center rounded-xl bg-blue-600 px-3 py-2 text-xs font-extrabold text-white">
                <Plus size={14} className="mr-1" /> {l('Create under group', 'Create under group')}
              </button>
            </div>
            <div className="space-y-3">
              {selectedGroupDiagnoses.map(diagnosis => (
                <div key={diagnosis.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className="rounded-lg bg-blue-50 px-2 py-1 font-mono text-xs font-extrabold text-blue-700">{diagnosis.icd10_code}</span>
                      <h4 className="mt-2 text-sm font-extrabold text-slate-900">{diagnosis.icd10_display}</h4>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{diagnosis.icd10_description}</p>
                    </div>
                    <StatusBadge active={diagnosis.is_active} l={l} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select value={diagnosis.condition_group_id} onChange={event => moveDiagnosis(diagnosis, event.target.value)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-bold">
                      {groups.map(group => <option key={group.id} value={group.id}>{group.display}</option>)}
                    </select>
                    <button onClick={() => setDiagnosisForm({ id: diagnosis.id, condition_group_id: diagnosis.condition_group_id, icd10_code: diagnosis.icd10_code, icd10_display: diagnosis.icd10_display, icd10_description: diagnosis.icd10_description, is_active: diagnosis.is_active })} className="inline-flex items-center rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                      <Edit3 size={13} className="mr-1" /> Edit
                    </button>
                    <button onClick={() => toggleDiagnosis(diagnosis)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700">
                      {diagnosis.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))}
              {selectedGroupDiagnoses.length === 0 && <EmptyState text={l('Este grupo no tiene diagnósticos relacionados.', 'This group has no related diagnoses.')} />}
            </div>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {history.length === 0 && <EmptyState text={l('No hay historial de importaciones.', 'No import history yet.')} />}
          <div className="space-y-2">
            {history.map(item => (
              <div key={item.id} className="flex flex-wrap justify-between gap-3 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">
                <span><strong className="text-slate-900">{item.filename}</strong> · {item.imported_by}</span>
                <span>{item.successful_rows} ok · {item.failed_rows} errors · {new Date(item.imported_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {groupForm && (
        <Modal title={groupForm.id ? l('Edit Condition Group', 'Edit Condition Group') : l('New Condition Group', 'New Condition Group')} onClose={() => setGroupForm(null)} error={error} onSave={saveGroup} l={l}>
          <Field label="Display" value={groupForm.display} onChange={display => setGroupForm({ ...groupForm, display })} />
          <Field label="Code" value={groupForm.code} onChange={code => setGroupForm({ ...groupForm, code })} />
          <label className="space-y-1 text-xs font-bold text-slate-600 md:col-span-2">
            Description
            <textarea value={groupForm.description} onChange={event => setGroupForm({ ...groupForm, description: event.target.value })} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800" />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
            <input type="checkbox" checked={groupForm.is_active} onChange={event => setGroupForm({ ...groupForm, is_active: event.target.checked })} />
            Active
          </label>
        </Modal>
      )}

      {programForm && (
        <Modal title={programForm.id ? l('Edit Program', 'Edit Program') : l('New Program', 'New Program')} onClose={() => setProgramForm(null)} error={error} onSave={saveProgram} l={l}>
          <Field label="Code" value={programForm.code} onChange={code => setProgramForm({ ...programForm, code })} />
          <Field label="Display" value={programForm.display} onChange={display => setProgramForm({ ...programForm, display })} />
          <label className="space-y-1 text-xs font-bold text-slate-600 md:col-span-2">
            Description
            <textarea value={programForm.description} onChange={event => setProgramForm({ ...programForm, description: event.target.value })} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800" />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
            <input type="checkbox" checked={programForm.requires_device} onChange={event => setProgramForm({ ...programForm, requires_device: event.target.checked })} />
            Requires device
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
            <input type="checkbox" checked={programForm.is_active} onChange={event => setProgramForm({ ...programForm, is_active: event.target.checked })} />
            Active
          </label>
        </Modal>
      )}

      {diagnosisForm && (
        <Modal title={diagnosisForm.id ? l('Edit ICD-10 Diagnosis', 'Edit ICD-10 Diagnosis') : l('New ICD-10 Diagnosis', 'New ICD-10 Diagnosis')} onClose={() => setDiagnosisForm(null)} error={error} onSave={saveDiagnosis} l={l}>
          <label className="space-y-1 text-xs font-bold text-slate-600 md:col-span-2">
            Clinical Category
            <select value={diagnosisForm.condition_group_id} onChange={event => setDiagnosisForm({ ...diagnosisForm, condition_group_id: event.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800">
              <option value="">Unassigned</option>
              {groups.map(group => <option key={group.id} value={group.id}>{group.display}</option>)}
            </select>
          </label>
          <Field label="ICD-10 Code" value={diagnosisForm.icd10_code} onChange={icd10_code => setDiagnosisForm({ ...diagnosisForm, icd10_code })} />
          <Field label="Display" value={diagnosisForm.icd10_display} onChange={icd10_display => setDiagnosisForm({ ...diagnosisForm, icd10_display })} />
          <label className="space-y-1 text-xs font-bold text-slate-600 md:col-span-2">
            Description
            <textarea value={diagnosisForm.icd10_description} onChange={event => setDiagnosisForm({ ...diagnosisForm, icd10_description: event.target.value })} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800" />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
            <input type="checkbox" checked={diagnosisForm.is_active} onChange={event => setDiagnosisForm({ ...diagnosisForm, is_active: event.target.checked })} />
            Active
          </label>
        </Modal>
      )}

      {confirm && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <AlertTriangle size={32} className="text-amber-600" />
            <h3 className="mt-3 text-lg font-extrabold text-slate-900">{confirm.title}</h3>
            <p className="mt-2 text-sm font-semibold text-slate-600">{confirm.body}</p>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setConfirm(null)} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700">Cancel</button>
              <button onClick={confirm.action} className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-extrabold text-white">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function tabLabel(tab: CatalogTab, l: (es: string, en: string) => string) {
  const labels: Record<CatalogTab, string> = {
    overview: l('Overview', 'Overview'),
    programs: l('Programs', 'Programs'),
    groups: l('Clinical Categories', 'Clinical Categories'),
    diagnoses: l('ICD-10 Diagnoses', 'ICD-10 Diagnoses'),
    relationships: l('Relationships', 'Relationships'),
    history: l('Import History', 'Import History')
  };
  return labels[tab];
}

function Metric({ label, value, tone = 'blue' }: { label: string; value: string | number; tone?: 'blue' | 'amber' | 'emerald' | 'rose' | 'violet' }) {
  const color = {
    blue: 'text-blue-700',
    amber: 'text-amber-700',
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
    violet: 'text-violet-700'
  }[tone];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-extrabold ${color}`}>{value}</p>
    </div>
  );
}

function Toolbar({ search, setSearch, filter, setFilter, placeholder }: { search: string; setSearch: (value: string) => void; filter: string; setFilter: (value: string) => void; placeholder: string }) {
  return (
    <div className="flex flex-wrap gap-3 border-b border-slate-200 bg-slate-50/60 p-4">
      <div className="relative min-w-[240px] flex-1">
        <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-xs font-semibold" />
      </div>
      <select value={filter} onChange={event => setFilter(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold">
        <option value="ALL">All status</option>
        <option value="ACTIVE">Active</option>
        <option value="INACTIVE">Inactive</option>
      </select>
    </div>
  );
}

function StatusBadge({ active, l, compact = false }: { active: boolean; l: (es: string, en: string) => string; compact?: boolean }) {
  return <span className={`rounded-full px-2 py-0.5 font-extrabold ${compact ? 'text-[9px]' : 'text-[10px]'} ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{active ? l('Activo', 'Active') : l('Inactivo', 'Inactive')}</span>;
}

function ActionButtons({ onView, onEdit, onToggle, active, l }: { onView?: () => void; onEdit: () => void; onToggle: () => void; active: boolean; l: (es: string, en: string) => string }) {
  return (
    <div className="flex justify-end gap-2">
      {onView && <button onClick={onView} className="inline-flex items-center rounded-xl border border-slate-200 px-3 py-1.5 font-bold text-slate-700"><Link2 size={13} className="mr-1" /> {l('Ver', 'View')}</button>}
      <button onClick={onEdit} className="inline-flex items-center rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 font-bold text-blue-700"><Edit3 size={13} className="mr-1" /> Edit</button>
      <button onClick={onToggle} className="rounded-xl border border-slate-200 px-3 py-1.5 font-bold text-slate-700">{active ? 'Deactivate' : 'Activate'}</button>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm font-semibold text-slate-400">{text}</div>;
}

function Modal({ title, children, error, onSave, onClose, l }: { title: string; children: ReactNode; error: string; onSave: () => void; onClose: () => void; l: (es: string, en: string) => string }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <h3 className="text-lg font-extrabold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">{children}</div>
        {error && <div className="mx-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">{error}</div>}
        <div className="flex justify-end gap-3 border-t border-slate-200 p-5">
          <button onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700">{l('Cancelar', 'Cancel')}</button>
          <button onClick={onSave} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-extrabold text-white">{l('Guardar', 'Save')}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1 text-xs font-bold text-slate-600">
      {label}
      <input value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800" />
    </label>
  );
}
