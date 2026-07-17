import { useMemo, useState, type ReactNode } from 'react';
import { Patient, PatientStatus, User } from '../types';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock3,
  Eye,
  FileText,
  MapPin,
  MoreHorizontal,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';
import { getBPReadingsByPatientId, getDeviceByPatientId, getLatestVisitForPatient } from '../utils/db';
import { getMedicalOrderStatus, getRequiredOrderDeviceTypes, patientRequiresDevice } from '../utils/medicalOrders';
import TablePagination, { usePaginatedRows } from './TablePagination';

interface DashboardNurseProps {
  currentUser: User;
  onStartVisit: (patientId: string) => void;
  onViewProfile: (patientId: string) => void;
  onContinueVisit: (patientId: string) => void;
  patients: Patient[];
  nursingHomes: string[];
  onRegisterPatientClick: () => void;
  onGenerateMedicalOrder: (patientId: string) => void;
}

type SortOption = 'PRIORITY' | 'UPDATED' | 'NAME' | 'FACILITY' | 'STATUS';
type BadgeTone = 'slate' | 'blue' | 'amber' | 'emerald' | 'rose';
type WorklistFilter =
  | 'ALL'
  | 'PENDING_CONSENT'
  | 'PENDING_PRACTITIONER_APPROVAL'
  | 'PENDING_DEVICE'
  | 'PENDING_ACTIVATION'
  | 'IN_PROGRESS_OPERATIONAL'
  | 'DATA_NEEDS_VERIFICATION'
  | 'ACTIVE'
  | PatientStatus;

interface WorklistRow {
  patient: Patient;
  enrollmentStatus: 'Not started' | 'In progress' | 'Consent declined' | 'Enrollment completed' | 'Pending activation' | 'Active';
  enrollmentTone: BadgeTone;
  nextAction: string;
  nextActionTone: BadgeTone;
  priority: number;
  programs: string[];
  requirements: string[];
  orderLabel?: string;
  orderTone?: BadgeTone;
  dataIssues: string[];
  latestVisit?: ReturnType<typeof getLatestVisitForPatient>;
  lastUpdated?: string;
  temporalLabel?: string;
  hasDevice: boolean;
  hasFirstReading: boolean;
  requiresDevice: boolean;
  orderStatus: ReturnType<typeof getMedicalOrderStatus>;
}

const PATIENTS_PER_PAGE = 10;
const PATIENT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const TEST_VALUE_PATTERN = /\b(demo|test|qa[_\s-]?draft|sample|asdf|qwe|xxx|zzzz|sasasa)\b/i;

const badgeToneClasses: Record<BadgeTone, string> = {
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700'
};

const statusSortOrder: Record<WorklistRow['enrollmentStatus'], number> = {
  'Not started': 1,
  'In progress': 2,
  'Consent declined': 3,
  'Enrollment completed': 4,
  'Pending activation': 5,
  Active: 6
};

function formatPrograms(assignedProgram: string): string[] {
  return assignedProgram
    .split('+')
    .map(program => program.trim())
    .filter(Boolean);
}

function toTimestamp(value?: string): number {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isValidBirthDate(value?: string): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const today = new Date();
  return year >= 1900 && date <= today;
}

function daysSince(value?: string): number | null {
  const timestamp = toTimestamp(value);
  if (!timestamp) return null;
  const diff = Date.now() - timestamp;
  if (diff < 0) return 0;
  return Math.floor(diff / 86_400_000);
}

function conciseDate(value?: string): string {
  const timestamp = toTimestamp(value);
  if (!timestamp) return 'Not recorded';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(timestamp));
}

function getDataIssues(patient: Patient): string[] {
  const issues: string[] = [];
  if (!isValidBirthDate(patient.birthDate)) issues.push('DOB needs verification');
  if (!patient.nursingHome || patient.nursingHome === 'Input Facility') issues.push('Facility not confirmed');
  if (!patient.room || patient.room.trim().toUpperCase() === 'N/A') issues.push('Room not provided');
  const searchableValues = [
    patient.firstName,
    patient.lastName,
    patient.medicareId,
    patient.room,
    patient.nursingHome
  ].filter(Boolean).join(' ');
  if (TEST_VALUE_PATTERN.test(searchableValues)) issues.push('Test or temporary value detected');
  return issues;
}

function getEnrollmentStatus(patient: Patient, latestVisit?: ReturnType<typeof getLatestVisitForPatient>): Pick<WorklistRow, 'enrollmentStatus' | 'enrollmentTone'> {
  if (patient.status === 'CONSENT_DECLINED') return { enrollmentStatus: 'Consent declined', enrollmentTone: 'rose' };
  if (patient.status === 'ACTIVE') return { enrollmentStatus: 'Active', enrollmentTone: 'emerald' };
  if (patient.status === 'ENROLLMENT_COMPLETED_PENDING_ACTIVATION' || patient.activationBlocker === 'AWAITING_MEDICAL_ORDER_APPROVAL') {
    return { enrollmentStatus: 'Pending activation', enrollmentTone: 'amber' };
  }
  if (patient.status === 'DEVICE_ACTIVATED' || patient.status === 'FIRST_BP_RECORDED') {
    return { enrollmentStatus: 'Enrollment completed', enrollmentTone: 'emerald' };
  }
  if (!latestVisit && patient.status === 'PENDING_CONSENT') return { enrollmentStatus: 'Not started', enrollmentTone: 'slate' };
  return { enrollmentStatus: 'In progress', enrollmentTone: 'blue' };
}

function getLastUpdated(patient: Patient, latestVisit?: ReturnType<typeof getLatestVisitForPatient>): string | undefined {
  const candidates = [
    latestVisit?.lastSavedAt,
    latestVisit?.endTime,
    latestVisit?.startTime,
    patient.activationDate,
    patient.medicalOrder?.approvedAt,
    patient.medicalOrder?.rejectedAt,
    patient.medicalOrder?.submittedAt,
    patient.medicalOrder?.createdAt
  ].filter(Boolean) as string[];
  return candidates.sort((a, b) => toTimestamp(b) - toTimestamp(a))[0];
}

function buildWorklistRow(patient: Patient): WorklistRow {
  const latestVisit = getLatestVisitForPatient(patient.id);
  const device = getDeviceByPatientId(patient.id);
  const readings = getBPReadingsByPatientId(patient.id);
  const orderStatus = getMedicalOrderStatus(patient);
  const requiresDevice = patientRequiresDevice(patient);
  const hasDevice = Boolean(device?.serialNumber || device?.deviceId || device?.deliveredToPatient || device?.assignedToPatient);
  const hasFirstReading = readings.length > 0;
  const dataIssues = getDataIssues(patient);
  const { enrollmentStatus, enrollmentTone } = getEnrollmentStatus(patient, latestVisit);
  const programs = formatPrograms(patient.assignedProgram);
  const requiredDevices = getRequiredOrderDeviceTypes(patient);
  const requirements = requiredDevices.length
    ? requiredDevices.map(deviceType => `${deviceType === 'BP Monitor' ? 'BP monitor' : deviceType} required`)
    : (requiresDevice && patient.requiredDevice !== 'None' ? [`${patient.requiredDevice} required`] : []);

  let orderLabel: WorklistRow['orderLabel'];
  let orderTone: WorklistRow['orderTone'];
  if (orderStatus === 'ORDER_APPROVED') {
    orderLabel = 'Approved';
    orderTone = 'emerald';
  } else if (orderStatus === 'ORDER_PENDING_PHYSICIAN_APPROVAL') {
    orderLabel = 'Approval pending';
    orderTone = 'amber';
  } else if (orderStatus === 'ORDER_REJECTED_NEEDS_REVISION') {
    orderLabel = 'Approval needs revision';
    orderTone = 'rose';
  } else if (orderStatus === 'ORDER_REQUIRED') {
    orderLabel = 'Approval required';
    orderTone = 'amber';
  }

  let nextAction = 'No action required';
  let nextActionTone: WorklistRow['nextActionTone'] = 'slate';
  let priority = 90;

  if (dataIssues.length > 0) {
    nextAction = 'Verify patient data';
    nextActionTone = 'rose';
    priority = 5;
  } else if (patient.status === 'CONSENT_DECLINED' || patient.status === 'ACTIVE') {
    nextAction = 'No action required';
    nextActionTone = patient.status === 'ACTIVE' ? 'emerald' : 'slate';
    priority = patient.status === 'ACTIVE' ? 95 : 92;
  } else if (patient.status === 'PENDING_CONSENT') {
    nextAction = 'Obtain consent';
    nextActionTone = 'amber';
    priority = 10;
  } else if (orderStatus === 'ORDER_REJECTED_NEEDS_REVISION') {
    nextAction = 'Resolve practitioner approval';
    nextActionTone = 'rose';
    priority = 15;
  } else if (orderStatus === 'ORDER_REQUIRED' || orderStatus === 'ORDER_PENDING_PHYSICIAN_APPROVAL') {
    nextAction = 'Request practitioner approval';
    nextActionTone = 'amber';
    priority = 20;
  } else if (requiresDevice && !hasDevice) {
    nextAction = requirements.some(requirement => requirement.toLowerCase().includes('scale')) ? 'Assign device' : 'Assign BP monitor';
    nextActionTone = 'blue';
    priority = 30;
  } else if (requiresDevice && !hasFirstReading) {
    nextAction = 'Complete first reading';
    nextActionTone = 'blue';
    priority = 40;
  } else if (enrollmentStatus === 'Pending activation') {
    nextAction = 'Pending activation';
    nextActionTone = 'amber';
    priority = 50;
  } else if (patient.status === 'INCOMPLETE') {
    nextAction = 'Continue visit';
    nextActionTone = 'blue';
    priority = 25;
  }

  const lastUpdated = getLastUpdated(patient, latestVisit);
  const pendingSince = patient.activationDate || patient.medicalOrder?.submittedAt || latestVisit?.lastSavedAt || latestVisit?.startTime;
  const pendingDays = daysSince(pendingSince);
  const temporalLabel = enrollmentStatus === 'Pending activation' && pendingDays !== null
    ? `Pending activation · ${pendingDays} day${pendingDays === 1 ? '' : 's'}`
    : enrollmentStatus === 'Enrollment completed' && latestVisit?.endTime
      ? `Enrollment completed ${conciseDate(latestVisit.endTime)}`
      : latestVisit?.startTime
        ? `Visit started ${conciseDate(latestVisit.startTime)}`
        : lastUpdated
          ? `Last updated ${conciseDate(lastUpdated)}`
          : undefined;

  return {
    patient,
    enrollmentStatus,
    enrollmentTone,
    nextAction,
    nextActionTone,
    priority,
    programs,
    requirements,
    orderLabel,
    orderTone,
    dataIssues,
    latestVisit,
    lastUpdated,
    temporalLabel,
    hasDevice,
    hasFirstReading,
    requiresDevice,
    orderStatus
  };
}

function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span className={`inline-flex min-h-6 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold ${badgeToneClasses[tone]}`}>
      {children}
    </span>
  );
}

export default function DashboardNurse({
  currentUser,
  patients,
  nursingHomes,
  onStartVisit,
  onViewProfile,
  onContinueVisit,
  onRegisterPatientClick,
  onGenerateMedicalOrder
}: DashboardNurseProps) {
  const [search, setSearch] = useState('');
  const [selectedNH, setSelectedNH] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<WorklistFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('PRIORITY');
  const { language, t } = useLanguage();
  const l = (es: string, en: string) => language === 'ES' ? es : en;
  const patientPageSizePreferenceKey = `amavita.patientPageSize.${currentUser.id}`;
  const [patientPageSize, setPatientPageSize] = useState(() => {
    const stored = Number(window.localStorage.getItem(patientPageSizePreferenceKey));
    return PATIENT_PAGE_SIZE_OPTIONS.includes(stored) ? stored : PATIENTS_PER_PAGE;
  });

  const assignedPatients = useMemo(() => {
    return patients.filter(patient => patient.assignedNurseId === currentUser.id);
  }, [patients, currentUser.id]);

  const rows = useMemo(() => assignedPatients.map(buildWorklistRow), [assignedPatients]);

  const stats = useMemo(() => {
    const total = rows.length;
    const pendingConsent = rows.filter(row => row.patient.status === 'PENDING_CONSENT').length;
    const pendingPractitionerApprovals = rows.filter(row =>
      row.orderStatus === 'ORDER_REQUIRED'
      || row.orderStatus === 'ORDER_PENDING_PHYSICIAN_APPROVAL'
      || row.orderStatus === 'ORDER_REJECTED_NEEDS_REVISION'
    ).length;
    const pendingDevice = rows.filter(row => row.requiresDevice && !row.hasDevice).length;
    const pendingActivation = rows.filter(row => row.enrollmentStatus === 'Pending activation').length;
    const inProgress = rows.filter(row => row.enrollmentStatus === 'In progress').length;
    const dataNeedsVerification = rows.filter(row => row.dataIssues.length > 0).length;
    const active = rows.filter(row => row.patient.status === 'ACTIVE').length;
    return { total, pendingConsent, pendingPractitionerApprovals, pendingDevice, pendingActivation, inProgress, dataNeedsVerification, active };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    const filtered = rows.filter(row => {
      const patient = row.patient;
      const matchSearch = !searchTerm || [
        patient.firstName,
        patient.lastName,
        patient.medicareId,
        patient.room
      ].filter(Boolean).join(' ').toLowerCase().includes(searchTerm);

      const matchNH = selectedNH ? patient.nursingHome === selectedNH : true;

      const matchStatus = selectedStatus === 'ALL'
        ? true
        : selectedStatus === 'PENDING_PRACTITIONER_APPROVAL'
          ? row.orderStatus === 'ORDER_REQUIRED'
            || row.orderStatus === 'ORDER_PENDING_PHYSICIAN_APPROVAL'
            || row.orderStatus === 'ORDER_REJECTED_NEEDS_REVISION'
          : selectedStatus === 'PENDING_DEVICE'
            ? row.requiresDevice && !row.hasDevice
            : selectedStatus === 'PENDING_ACTIVATION'
              ? row.enrollmentStatus === 'Pending activation'
              : selectedStatus === 'IN_PROGRESS_OPERATIONAL'
                ? row.enrollmentStatus === 'In progress'
                : selectedStatus === 'DATA_NEEDS_VERIFICATION'
                  ? row.dataIssues.length > 0
                  : selectedStatus === 'PENDING_CONSENT'
                    ? patient.status === 'PENDING_CONSENT'
                    : patient.status === selectedStatus;

      return matchSearch && matchNH && matchStatus;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'PRIORITY') return a.priority - b.priority || (toTimestamp(b.lastUpdated) - toTimestamp(a.lastUpdated));
      if (sortBy === 'UPDATED') return toTimestamp(b.lastUpdated) - toTimestamp(a.lastUpdated);
      if (sortBy === 'NAME') return `${a.patient.lastName} ${a.patient.firstName}`.localeCompare(`${b.patient.lastName} ${b.patient.firstName}`);
      if (sortBy === 'FACILITY') return a.patient.nursingHome.localeCompare(b.patient.nursingHome) || a.patient.lastName.localeCompare(b.patient.lastName);
      return statusSortOrder[a.enrollmentStatus] - statusSortOrder[b.enrollmentStatus] || a.patient.lastName.localeCompare(b.patient.lastName);
    });
  }, [rows, search, selectedNH, selectedStatus, sortBy]);

  const patientPagination = usePaginatedRows(filteredRows, patientPageSize);
  const paginationLabels = {
    showing: l('Mostrando', 'Showing'),
    of: l('de', 'of'),
    previous: l('Anterior', 'Previous'),
    next: l('Siguiente', 'Next'),
    rowsPerPage: l('Pacientes por página', 'Patients per page'),
    patients: l('pacientes', 'patients')
  };

  const handlePatientPageSizeChange = (nextPageSize: number) => {
    setPatientPageSize(nextPageSize);
    window.localStorage.setItem(patientPageSizePreferenceKey, String(nextPageSize));
    patientPagination.setPage(1);
  };

  const clearAllFilters = () => {
    setSearch('');
    setSelectedNH('');
    setSelectedStatus('ALL');
    setSortBy('PRIORITY');
  };

  const hasActiveFilters = Boolean(search || selectedNH || selectedStatus !== 'ALL' || sortBy !== 'PRIORITY');

  const statusFilterLabel = selectedStatus === 'PENDING_PRACTITIONER_APPROVAL'
    ? 'Pending practitioner approvals'
    : selectedStatus === 'PENDING_DEVICE'
      ? 'Pending devices'
      : selectedStatus === 'PENDING_ACTIVATION'
        ? 'Pending activation'
        : selectedStatus === 'IN_PROGRESS_OPERATIONAL'
          ? 'In progress'
          : selectedStatus === 'DATA_NEEDS_VERIFICATION'
            ? 'Data needs verification'
            : selectedStatus === 'PENDING_CONSENT'
              ? 'Pending consent'
              : selectedStatus === 'ACTIVE'
                ? 'Active'
                : selectedStatus;

  const renderPrimaryAction = (row: WorklistRow) => {
    const patient = row.patient;
    if (patient.status === 'ACTIVE' || row.enrollmentStatus === 'Enrollment completed' || row.enrollmentStatus === 'Pending activation') {
      return (
        <button onClick={() => onViewProfile(patient.id)} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-3 text-xs font-extrabold text-white transition hover:bg-slate-800">
          <Eye size={14} className="mr-1.5" /> View enrollment
        </button>
      );
    }
    if (patient.status === 'INCOMPLETE' || row.latestVisit?.status === 'IN_PROGRESS') {
      return (
        <button onClick={() => onContinueVisit(patient.id)} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-3 text-xs font-extrabold text-white shadow-lg shadow-blue-600/15 transition hover:bg-blue-700" id={`btn-continue-visit-${patient.id}`}>
          <RefreshCw size={14} className="mr-1.5" /> {t('continue_visit')}
        </button>
      );
    }
    return (
      <button onClick={() => onStartVisit(patient.id)} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-3 text-xs font-extrabold text-white shadow-lg shadow-blue-600/15 transition hover:bg-blue-700" id={`btn-start-visit-${patient.id}`}>
        <Play size={13} className="mr-1.5 fill-current" /> {t('start_visit')}
      </button>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in" id="dashboard-nurse">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold leading-tight text-slate-800">{l('Lista de pacientes asignados', 'Assigned Patient Worklist')}</h1>
          <p className="text-xs font-bold text-blue-600">{l('Visitas en sitio, consentimientos, equipos y primeras lecturas', 'Operational enrollment worklist')}</p>
          <p className="mt-1 text-sm text-slate-500">
            {l('Enfermera', 'Nurse')}: <span className="font-semibold text-slate-800">{currentUser.name}</span> • {stats.total} {l('pacientes asignados', 'assigned patients')} • {stats.pendingPractitionerApprovals} pending practitioner approvals
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-500">
            <MapPin size={14} className="text-slate-400" />
            <span>
              Nursing Homes: {currentUser.nursingHomeAccess?.length === nursingHomes.length ? 'All' : `${currentUser.nursingHomeAccess?.length || 0} assigned`}
            </span>
          </div>
          <button onClick={onRegisterPatientClick} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-4 text-xs font-extrabold text-white shadow-lg shadow-blue-600/10 transition hover:bg-blue-700" id="btn-register-patient-nurse">
            <UserPlus size={14} className="mr-1.5" />
            {l('Registrar Paciente', 'Register Patient')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-7" id="nurse-stats-grid">
        {[
          { key: 'PENDING_CONSENT' as WorklistFilter, label: 'Pending consents', value: stats.pendingConsent, icon: FileText, tone: 'amber' },
          { key: 'PENDING_PRACTITIONER_APPROVAL' as WorklistFilter, label: 'Pending practitioner approvals', value: stats.pendingPractitionerApprovals, icon: ShieldCheck, tone: 'amber' },
          { key: 'PENDING_DEVICE' as WorklistFilter, label: 'Pending devices', value: stats.pendingDevice, icon: Smartphone, tone: 'blue' },
          { key: 'PENDING_ACTIVATION' as WorklistFilter, label: 'Pending activation', value: stats.pendingActivation, icon: Clock3, tone: 'amber' },
          { key: 'IN_PROGRESS_OPERATIONAL' as WorklistFilter, label: 'In progress', value: stats.inProgress, icon: Activity, tone: 'blue' },
          { key: 'DATA_NEEDS_VERIFICATION' as WorklistFilter, label: 'Data verification', value: stats.dataNeedsVerification, icon: AlertTriangle, tone: 'rose' },
          { key: 'ACTIVE' as WorklistFilter, label: 'Active', value: stats.active, icon: CheckCircle, tone: 'emerald' }
        ].map(({ key, label, value, icon: Icon, tone }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSelectedStatus(key)}
            className={`rounded-2xl border bg-white p-4 text-left transition hover:shadow-md ${selectedStatus === key ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-slate-200'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{label}</span>
              <Icon size={18} className={`${tone === 'emerald' ? 'text-emerald-500' : tone === 'rose' ? 'text-rose-500' : tone === 'blue' ? 'text-blue-500' : 'text-amber-500'} shrink-0`} />
            </div>
            <p className="mt-2 text-3xl font-extrabold text-slate-800">{value}</p>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" id="nurse-patients-panel">
        <div className="border-b border-slate-200 bg-slate-50/50 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-base font-bold tracking-tight text-slate-800">{t('assigned_patients')} ({filteredRows.length})</h2>
              <p className="mt-0.5 text-xs font-medium text-slate-500">Prioritized by next operational action, data readiness, and activation blockers.</p>
            </div>

            <div className="grid w-full gap-2 md:grid-cols-[minmax(280px,1fr)_minmax(210px,0.7fr)_minmax(210px,0.7fr)] xl:max-w-5xl">
              <div className="relative">
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by patient name, Medicare ID, or room"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={selectedNH}
                onChange={(event) => setSelectedNH(event.target.value)}
                aria-label="Filter by nursing home"
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Nursing Homes</option>
                {nursingHomes.map(nursingHome => (
                  <option key={nursingHome} value={nursingHome}>{nursingHome}</option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortOption)}
                aria-label="Sort patients"
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="PRIORITY">Highest priority</option>
                <option value="UPDATED">Recently updated</option>
                <option value="NAME">Patient name</option>
                <option value="FACILITY">Facility</option>
                <option value="STATUS">Enrollment status</option>
              </select>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {search && <Badge tone="slate">Search: {search}</Badge>}
              {selectedNH && <Badge tone="slate">Facility: {selectedNH}</Badge>}
              {selectedStatus !== 'ALL' && <Badge tone="blue">Status: {statusFilterLabel}</Badge>}
              {sortBy !== 'PRIORITY' && <Badge tone="slate">Sort: {sortBy === 'UPDATED' ? 'Recently updated' : sortBy === 'NAME' ? 'Patient name' : sortBy === 'FACILITY' ? 'Facility' : 'Enrollment status'}</Badge>}
              <button type="button" onClick={clearAllFilters} className="inline-flex min-h-8 items-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-extrabold text-slate-700 transition hover:bg-slate-50">
                <X size={13} className="mr-1" /> Clear all
              </button>
            </div>
          )}
        </div>

        {filteredRows.length === 0 ? (
          <div className="space-y-2 p-12 text-center text-slate-400">
            <Users size={40} className="mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">{t('no_patients')}</p>
            <p className="text-xs">Try modifying search, filters, or sort.</p>
          </div>
        ) : (
          <div id="nurse-patients-list">
            <div className="hidden grid-cols-[minmax(220px,1.1fr)_minmax(210px,1fr)_minmax(260px,1.2fr)_minmax(170px,0.85fr)_minmax(210px,1fr)_minmax(210px,0.95fr)] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 xl:grid">
              <span>Patient</span>
              <span>Location</span>
              <span>Programs & requirements</span>
              <span>Enrollment status</span>
              <span>Next action</span>
              <span className="text-right">Actions</span>
            </div>

            <div className="divide-y divide-slate-100">
              {patientPagination.pageRows.map((row) => {
                const patient = row.patient;
                const canGenerateOrder = row.orderStatus === 'ORDER_REQUIRED' || row.orderStatus === 'ORDER_REJECTED_NEEDS_REVISION';
                return (
                  <article
                    key={patient.id}
                    className="grid grid-cols-1 gap-4 px-5 py-5 transition hover:bg-slate-50/60 xl:grid-cols-[minmax(220px,1.1fr)_minmax(210px,1fr)_minmax(260px,1.2fr)_minmax(170px,0.85fr)_minmax(210px,1fr)_minmax(210px,0.95fr)] xl:items-center"
                    id={`patient-row-${patient.id}`}
                  >
                    <div className="min-w-0">
                      <p className="xl:hidden text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Patient</p>
                      <h3 className="truncate text-base font-extrabold text-slate-900">{patient.firstName} {patient.lastName}</h3>
                      <p className="mt-1 text-xs font-semibold text-slate-500">Medicare ID: {patient.medicareId || 'Not provided'}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {row.dataIssues.slice(0, 2).map(issue => <span key={issue}><Badge tone="rose">{issue}</Badge></span>)}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="xl:hidden text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Location</p>
                      <p className="flex min-w-0 items-start text-sm font-bold text-slate-800">
                        <MapPin size={14} className="mr-1.5 mt-0.5 shrink-0 text-slate-400" />
                        <span className="min-w-0 truncate">{patient.nursingHome || 'Facility not confirmed'}</span>
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">Room {patient.room || 'N/A'}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">DOB: {patient.birthDate || 'Not provided'}</p>
                    </div>

                    <div className="min-w-0">
                      <p className="xl:hidden text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Programs & requirements</p>
                      <div className="flex flex-wrap gap-1.5">
                        {row.programs.length > 0 ? row.programs.map(program => <span key={program}><Badge tone="slate">{program}</Badge></span>) : <Badge tone="slate">No program</Badge>}
                        {row.requirements.map(requirement => <span key={requirement}><Badge tone="blue">{requirement}</Badge></span>)}
                        {row.orderLabel && <Badge tone={row.orderTone || 'amber'}>{row.orderLabel}</Badge>}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="xl:hidden text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Enrollment status</p>
                      <Badge tone={row.enrollmentTone}>{row.enrollmentStatus}</Badge>
                      {row.temporalLabel && <p className="mt-2 text-xs font-semibold text-slate-500">{row.temporalLabel}</p>}
                    </div>

                    <div className="min-w-0">
                      <p className="xl:hidden text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Next action</p>
                      <Badge tone={row.nextActionTone}>{row.nextAction}</Badge>
                      {row.lastUpdated && <p className="mt-2 text-xs font-semibold text-slate-500">Last updated {conciseDate(row.lastUpdated)}</p>}
                    </div>

                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row xl:justify-end">
                      <div className="w-full sm:w-44 xl:w-40">{renderPrimaryAction(row)}</div>
                      <button onClick={() => onViewProfile(patient.id)} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 sm:w-36 xl:w-32" id={`btn-view-profile-${patient.id}`}>
                        <Eye size={14} className="mr-1.5 text-slate-500" /> View profile
                      </button>
                      {canGenerateOrder && (
                        <details className="relative">
                          <summary className="inline-flex min-h-11 w-full cursor-pointer list-none items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 sm:w-11" aria-label="More actions">
                            <MoreHorizontal size={16} />
                          </summary>
                          <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                            <button type="button" onClick={() => onGenerateMedicalOrder(patient.id)} className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-xs font-extrabold text-slate-700 hover:bg-slate-50">
                              <FileText size={13} className="mr-2" /> {row.orderStatus === 'ORDER_REJECTED_NEEDS_REVISION' ? 'Revise / resend order' : 'Request approval'}
                            </button>
                          </div>
                        </details>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <TablePagination
              totalCount={filteredRows.length}
              page={patientPagination.page}
              pageSize={patientPagination.pageSize}
              totalPages={patientPagination.totalPages}
              startIndex={patientPagination.startIndex}
              endIndex={patientPagination.endIndex}
              onPageChange={patientPagination.setPage}
              pageSizeOptions={PATIENT_PAGE_SIZE_OPTIONS}
              onPageSizeChange={handlePatientPageSizeChange}
              labels={paginationLabels}
            />
          </div>
        )}
      </div>
    </div>
  );
}
