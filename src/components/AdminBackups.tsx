import { useEffect, useState } from 'react';
import { CalendarClock, DatabaseBackup, ExternalLink, RefreshCw, RotateCcw, Save } from 'lucide-react';
import {
  createBackupNow,
  getBackupOverview,
  restoreBackup,
  saveBackupConfig,
  type BackupConfigPayload,
  type BackupRecordPayload
} from '../utils/apiClient';
import { useLanguage } from '../utils/LanguageContext';
import TablePagination, { usePaginatedRows } from './TablePagination';

interface Props {
  onNotify: (message: string, type?: 'success' | 'info') => void;
}

const emptyConfig: BackupConfigPayload = {
  id: 'backup_config',
  enabled: false,
  driveFolderId: '',
  everyHours: 24
};

export default function AdminBackups({ onNotify }: Props) {
  const { language } = useLanguage();
  const l = (es: string, en: string) => language === 'ES' ? es : en;
  const [config, setConfig] = useState<BackupConfigPayload>(emptyConfig);
  const [backups, setBackups] = useState<BackupRecordPayload[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupRecordPayload | null>(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const backupPagination = usePaginatedRows(backups);
  const paginationLabels = {
    showing: l('Mostrando', 'Showing'),
    of: l('de', 'of'),
    previous: l('Anterior', 'Previous'),
    next: l('Siguiente', 'Next')
  };

  const loadBackups = async () => {
    setIsLoading(true);
    try {
      const overview = await getBackupOverview();
      setConfig(overview.config || emptyConfig);
      setBackups(overview.backups || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadBackups();
  }, []);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const saved = await saveBackupConfig({
        enabled: config.enabled,
        driveFolderId: config.driveFolderId,
        everyHours: config.everyHours
      });
      setConfig(saved);
      onNotify(l('Configuración de backups guardada.', 'Backup schedule saved.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackupNow = async () => {
    setIsCreating(true);
    try {
      const backup = await createBackupNow({
        driveFolderId: config.driveFolderId,
        notes: 'Manual Google Drive spreadsheet backup.'
      });
      setBackups(previous => [backup, ...previous]);
      setConfig(previous => ({ ...previous, lastBackupAt: backup.createdAt, lastBackupId: backup.id }));
      onNotify(l('Backup creado correctamente.', 'Backup created successfully.'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget || restoreConfirmText !== 'RESTORE BACKUP') return;
    setIsRestoring(true);
    try {
      const result = await restoreBackup(restoreTarget.id);
      setRestoreTarget(null);
      setRestoreConfirmText('');
      await loadBackups();
      onNotify(l(
        `Backup restaurado. Se creó backup de seguridad: ${result.safetyBackup.fileName}.`,
        `Backup restored. Safety backup created: ${result.safetyBackup.fileName}.`
      ));
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-5" id="admin-backups">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
              <DatabaseBackup size={20} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">{l('Google Drive Backups', 'Google Drive Backups')}</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {l(
                  'Crea backups completos del spreadsheet, guarda una programación y restaura desde un backup seleccionado.',
                  'Create full spreadsheet backups, save a schedule, and restore from a selected backup.'
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadBackups}
              disabled={isLoading}
              className="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-xs font-extrabold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={`mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
              {l('Actualizar', 'Refresh')}
            </button>
            <button
              type="button"
              onClick={handleBackupNow}
              disabled={isCreating}
              className="inline-flex h-10 items-center rounded-xl bg-blue-600 px-4 text-xs font-extrabold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-50"
            >
              <DatabaseBackup size={14} className="mr-1.5" />
              {isCreating ? l('Creando...', 'Creating...') : l('Backup ahora', 'Backup now')}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Metric label={l('Estado Drive', 'Drive Status')} value={config.driveFolderId ? l('Configurado', 'Configured') : l('Carpeta del spreadsheet', 'Spreadsheet folder')} />
          <Metric label={l('Último backup', 'Last Backup')} value={formatDate(config.lastBackupAt) || '-'} />
          <Metric label={l('Próximo programado', 'Next Scheduled')} value={formatDate(config.nextScheduledAt) || (config.enabled ? '-' : l('Deshabilitado', 'Disabled'))} />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[160px_minmax(240px,1fr)_170px_140px] lg:items-end">
          <label className="space-y-2">
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{l('Habilitado', 'Enabled')}</span>
            <button
              type="button"
              onClick={() => setConfig(previous => ({ ...previous, enabled: !previous.enabled }))}
              className={`flex h-10 w-full items-center justify-between rounded-xl border px-3 text-xs font-extrabold ${
                config.enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
            >
              {config.enabled ? l('Activo', 'On') : l('Inactivo', 'Off')}
              <span className={`h-4 w-4 rounded-full ${config.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            </button>
          </label>
          <label className="space-y-2">
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Google Drive Folder ID</span>
            <input
              value={config.driveFolderId || ''}
              onChange={event => setConfig(previous => ({ ...previous, driveFolderId: event.target.value.trim() }))}
              placeholder={l('Dejar vacío para usar la carpeta del spreadsheet', 'Leave blank to use the spreadsheet folder')}
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="space-y-2">
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{l('Cada horas', 'Every hours')}</span>
            <input
              type="number"
              min={1}
              max={720}
              value={config.everyHours || 24}
              onChange={event => setConfig(previous => ({ ...previous, everyHours: Number(event.target.value || 24) }))}
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-xs font-extrabold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            <Save size={14} className="mr-1.5" />
            {isSaving ? l('Guardando...', 'Saving...') : l('Guardar', 'Save')}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">{l('Backups disponibles', 'Available Backups')}</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {l('La restauración crea primero un backup de seguridad y luego reemplaza los datos actuales.', 'Restore creates a safety backup first, then replaces the current workbook data.')}
            </p>
          </div>
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-extrabold text-slate-600">{backups.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left">{l('Creado', 'Created')}</th>
                <th className="px-5 py-3 text-left">{l('Archivo backup', 'Backup File')}</th>
                <th className="px-5 py-3 text-left">{l('Estado', 'Status')}</th>
                <th className="px-5 py-3 text-left">{l('Última restauración', 'Last Restored')}</th>
                <th className="px-5 py-3 text-left">{l('Notas', 'Notes')}</th>
                <th className="px-5 py-3 text-right">{l('Acción', 'Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center font-semibold text-slate-400">
                    {isLoading ? l('Cargando backups...', 'Loading backups...') : l('No hay backups disponibles.', 'No backups available.')}
                  </td>
                </tr>
              ) : backupPagination.pageRows.map(backup => (
                <tr key={backup.id}>
                  <td className="px-5 py-4 font-semibold text-slate-600">{formatDate(backup.createdAt)}</td>
                  <td className="px-5 py-4">
                    <div className="font-extrabold text-slate-900">{backup.fileName}</div>
                    <div className="mt-1 font-mono text-[10px] text-slate-400">{backup.fileId}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-extrabold text-emerald-700">{backup.status || 'AVAILABLE'}</span>
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-500">{formatDate(backup.lastRestoredAt) || '-'}</td>
                  <td className="px-5 py-4 font-semibold text-slate-500">{backup.notes || '-'}</td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      {backup.driveUrl && (
                        <a
                          href={backup.driveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 items-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          <ExternalLink size={13} className="mr-1" /> Drive
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setRestoreTarget(backup)}
                        className="inline-flex h-9 items-center rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-800 hover:bg-amber-100"
                      >
                        <RotateCcw size={13} className="mr-1" /> {l('Restaurar', 'Restore')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          totalCount={backups.length}
          page={backupPagination.page}
          pageSize={backupPagination.pageSize}
          totalPages={backupPagination.totalPages}
          startIndex={backupPagination.startIndex}
          endIndex={backupPagination.endIndex}
          onPageChange={backupPagination.setPage}
          labels={paginationLabels}
        />
      </div>

      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 p-5">
              <h3 className="text-base font-extrabold text-slate-900">{l('Confirmar restauración', 'Confirm Restore')}</h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {l('Se creará un backup de seguridad antes de reemplazar el spreadsheet actual.', 'A safety backup will be created before replacing the current spreadsheet.')}
              </p>
            </div>
            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-900">
                {restoreTarget.fileName}
              </div>
              <label className="block text-xs font-extrabold text-slate-700" htmlFor="restore-confirm-text">
                {l('Escriba RESTORE BACKUP para confirmar', 'Type RESTORE BACKUP to confirm')}
              </label>
              <input
                id="restore-confirm-text"
                value={restoreConfirmText}
                onChange={event => setRestoreConfirmText(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 p-5">
              <button
                type="button"
                onClick={() => {
                  setRestoreTarget(null);
                  setRestoreConfirmText('');
                }}
                disabled={isRestoring}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"
              >
                {l('Cancelar', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleRestore}
                disabled={restoreConfirmText !== 'RESTORE BACKUP' || isRestoring}
                className="inline-flex items-center rounded-xl bg-amber-600 px-4 py-2 text-xs font-extrabold text-white disabled:opacity-50"
              >
                <RotateCcw size={14} className="mr-1.5" />
                {isRestoring ? l('Restaurando...', 'Restoring...') : l('Restaurar backup', 'Restore Backup')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
        <CalendarClock size={12} />
        {label}
      </div>
      <p className="mt-2 text-xs font-extrabold text-slate-900">{value}</p>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}
