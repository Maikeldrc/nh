import { ChangeEvent, useState } from 'react';
import { AlertTriangle, CheckCircle, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import {
  CatalogImportHistory,
  ConditionGroupCatalog,
  DiagnosisCatalog,
  User
} from '../types';
import {
  applyConditionCatalogImport,
  CatalogImportPreview,
  parseConditionCatalogWorkbook
} from '../utils/conditionCatalogImport';
import { useLanguage } from '../utils/LanguageContext';

interface Props {
  isOpen: boolean;
  currentUser: User;
  groups: ConditionGroupCatalog[];
  diagnoses: DiagnosisCatalog[];
  history: CatalogImportHistory[];
  onClose: () => void;
  onConfirm: (
    groups: ConditionGroupCatalog[],
    diagnoses: DiagnosisCatalog[],
    history: CatalogImportHistory
  ) => void;
  onToggleGroup: (id: string, active: boolean) => void;
  onToggleDiagnosis: (id: string, active: boolean) => void;
}

export default function ConditionCatalogImportModal({
  isOpen,
  currentUser,
  groups,
  diagnoses,
  history,
  onClose,
  onConfirm,
  onToggleGroup,
  onToggleDiagnosis
}: Props) {
  const { language } = useLanguage();
  const l = (es: string, en: string) => language === 'ES' ? es : en;
  const [preview, setPreview] = useState<CatalogImportPreview | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [deactivateMissing, setDeactivateMissing] = useState(false);
  const [selectedGroupCode, setSelectedGroupCode] = useState('');
  const [completed, setCompleted] = useState(false);

  if (!isOpen) return null;

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCompleted(false);
    setPreview(null);
    setParseError('');
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setParseError(l('Seleccione un archivo .xlsx.', 'Select an .xlsx file.'));
      return;
    }
    setIsParsing(true);
    try {
      setPreview(await parseConditionCatalogWorkbook(file, groups, diagnoses));
    } catch (error) {
      setParseError(error instanceof Error ? error.message : l('No se pudo leer el archivo.', 'Unable to read file.'));
    } finally {
      setIsParsing(false);
    }
  };

  const confirmImport = () => {
    if (!preview || preview.rows.length === 0) return;
    const result = applyConditionCatalogImport(preview, groups, diagnoses, currentUser, deactivateMissing);
    onConfirm(result.groups, result.diagnoses, result.history);
    setCompleted(true);
    setPreview(null);
  };

  const activeGroup = groups.find(group => group.code === selectedGroupCode);
  const groupDiagnoses = activeGroup
    ? diagnoses.filter(diagnosis => diagnosis.condition_group_id === activeGroup.id)
    : [];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl border border-slate-200">
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-6 py-5 flex justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">
              {l('Importar grupos de condiciones y catálogo ICD-10', 'Import Condition Groups & ICD-10 Catalog')}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {l('Solo administradores. Importación idempotente por Group Code + ICD-10.', 'Administrators only. Idempotent by Group Code + ICD-10.')}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100" aria-label="Close">
            <X size={20} />
          </button>
        </header>

        <div className="p-6 space-y-6">
          <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileSpreadsheet className="text-blue-700" size={20} />
              <h3 className="font-bold text-slate-900">{l('1. Cargar Excel', '1. Upload Excel')}</h3>
            </div>
            <label className="flex items-center justify-center gap-2 min-h-24 border-2 border-dashed border-blue-300 bg-white rounded-2xl cursor-pointer hover:border-blue-500">
              {isParsing ? <Loader2 className="animate-spin text-blue-600" /> : <Upload className="text-blue-600" />}
              <span className="text-sm font-bold text-blue-800">
                {isParsing ? l('Leyendo archivo...', 'Reading file...') : l('Seleccionar archivo .xlsx', 'Select .xlsx file')}
              </span>
              <input type="file" accept=".xlsx" onChange={handleFile} className="sr-only" />
            </label>
            {parseError && (
              <p className="mt-3 text-sm font-semibold text-red-700 flex items-center gap-2">
                <AlertTriangle size={16} /> {parseError}
              </p>
            )}
            {completed && (
              <p className="mt-3 text-sm font-semibold text-emerald-700 flex items-center gap-2">
                <CheckCircle size={16} /> {l('Catálogo importado correctamente.', 'Catalog imported successfully.')}
              </p>
            )}
          </section>

          {preview && (
            <section className="rounded-2xl border border-slate-200 p-5 space-y-4">
              <h3 className="font-bold text-slate-900">{l('2. Vista previa y validación', '2. Preview and validation')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  [l('Grupos encontrados', 'Groups found'), preview.totalGroups],
                  [l('Códigos ICD-10', 'ICD-10 codes'), preview.totalDiagnoses],
                  [l('Grupos nuevos / actualizados', 'New / updated groups'), `${preview.newGroups} / ${preview.updatedGroups}`],
                  [l('Diagnósticos nuevos / actualizados', 'New / updated diagnoses'), `${preview.newDiagnoses} / ${preview.updatedDiagnoses}`],
                  [l('Filas totales', 'Total rows'), preview.totalRows],
                  [l('Filas válidas', 'Valid rows'), preview.rows.length],
                  [l('Filas con errores', 'Rows with errors'), preview.errors.length]
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                    <p className="text-[10px] uppercase font-bold text-slate-500">{label}</p>
                    <p className="text-xl font-extrabold text-slate-900 mt-1">{value}</p>
                  </div>
                ))}
              </div>

              {preview.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-xl border border-red-200">
                  {preview.errors.map(error => (
                    <div key={error.rowNumber} className="px-3 py-2 text-xs border-b border-red-100 bg-red-50 text-red-800">
                      <strong>{l('Fila', 'Row')} {error.rowNumber}:</strong> {error.messages.join(' ')}
                    </div>
                  ))}
                </div>
              )}

              <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                <input
                  type="checkbox"
                  checked={deactivateMissing}
                  onChange={event => setDeactivateMissing(event.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                {l('Desactivar códigos ausentes en esta importación', 'Deactivate missing codes from this import')}
              </label>

              <button
                type="button"
                disabled={preview.rows.length === 0}
                onClick={confirmImport}
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
              >
                {l('Confirmar importación', 'Confirm Import')}
              </button>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-900">{l('Administrar catálogo', 'Manage Catalog')}</h3>
              <span className="text-xs text-slate-500">{groups.length} groups · {diagnoses.length} ICD-10</span>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
                {groups.length === 0 && <p className="p-4 text-xs text-slate-500">{l('No hay catálogo importado.', 'No catalog imported.')}</p>}
                {groups.map(group => (
                  <button
                    type="button"
                    key={group.id}
                    onClick={() => setSelectedGroupCode(group.code)}
                    className={`w-full flex items-center justify-between p-3 border-b text-left ${selectedGroupCode === group.code ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                  >
                    <span>
                      <strong className="block text-xs text-slate-900">{group.display}</strong>
                      <span className="text-[10px] text-slate-500">{group.code} · {group.icd10_count} ICD-10</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={group.is_active}
                      onClick={event => event.stopPropagation()}
                      onChange={event => onToggleGroup(group.id, event.target.checked)}
                      aria-label={`${group.display} active`}
                    />
                  </button>
                ))}
              </div>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
                {!activeGroup && <p className="p-4 text-xs text-slate-500">{l('Seleccione un grupo.', 'Select a group.')}</p>}
                {groupDiagnoses.map(diagnosis => (
                  <label key={diagnosis.id} className="flex items-center justify-between p-3 border-b hover:bg-slate-50">
                    <span>
                      <strong className="block text-xs text-slate-900">{diagnosis.icd10_display}</strong>
                      <span className="text-[10px] text-slate-500">{diagnosis.icd10_code}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={diagnosis.is_active}
                      onChange={event => onToggleDiagnosis(diagnosis.id, event.target.checked)}
                      aria-label={`${diagnosis.icd10_code} active`}
                    />
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-5">
            <h3 className="font-bold text-slate-900 mb-3">{l('Historial de importación', 'Import History')}</h3>
            <div className="space-y-2">
              {history.length === 0 && <p className="text-xs text-slate-500">{l('Sin importaciones.', 'No imports yet.')}</p>}
              {history.slice(0, 8).map(item => (
                <div key={item.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-slate-50 p-3 text-xs">
                  <span><strong>{item.filename}</strong> · {item.imported_by}</span>
                  <span>{item.successful_rows} ok · {item.failed_rows} errors · {new Date(item.imported_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
