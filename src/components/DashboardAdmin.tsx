import { useState, useEffect, useMemo } from 'react';
import {
  CatalogImportHistory,
  ConditionGroupCatalog,
  DiagnosisCatalog,
  ProgramCatalog,
  Patient,
  User,
  AuditLog,
  DocumentRecord,
  PatientStatus
} from '../types';
import { NURSING_HOMES } from '../data';
import { 
  Search, Users, Shield, FileText, Smartphone, CheckCircle, 
  AlertTriangle, Eye, ArrowUpDown, Calendar, MapPin, Download, History, UserPlus, FileSpreadsheet,
  Trash2, ChevronLeft, ChevronRight, X
} from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';
import { getMedicalOrderStatus, patientRequiresDevice } from '../utils/medicalOrders';
import UserManagement from './UserManagement';
import ClinicalCatalogManagement from './ClinicalCatalogManagement';

interface DashboardAdminProps {
  currentUser: User;
  patients: Patient[];
  auditLogs: AuditLog[];
  documents: DocumentRecord[];
  users: User[];
  conditionGroups: ConditionGroupCatalog[];
  diagnoses: DiagnosisCatalog[];
  catalogImports: CatalogImportHistory[];
  programs: ProgramCatalog[];
  onViewProfile: (patientId: string) => void;
  onReassignNurse: (patientId: string, nurseId: string) => void;
  onDownloadPDF: (docRecord: DocumentRecord) => void;
  onRegisterPatientClick: () => void;
  onGenerateMedicalOrder: (patientId: string) => void;
  onOpenMedicalOrderReview: (patient: Patient) => void;
  onImportConditionCatalog: () => void;
  onSaveConditionGroup: (group: ConditionGroupCatalog) => void;
  onSaveDiagnosis: (diagnosis: DiagnosisCatalog) => void;
  onSaveProgram: (program: ProgramCatalog) => void;
  onUsersChanged: () => Promise<void>;
  onCleanupPatientData: () => Promise<void>;
  onNotify: (message: string, type?: 'success' | 'info') => void;
}

const PATIENTS_PER_PAGE = 10;

export default function DashboardAdmin({
  currentUser,
  patients,
  auditLogs,
  documents,
  users,
  conditionGroups,
  diagnoses,
  catalogImports,
  programs,
  onViewProfile,
  onReassignNurse,
  onDownloadPDF,
  onRegisterPatientClick,
  onGenerateMedicalOrder,
  onOpenMedicalOrderReview,
  onImportConditionCatalog,
  onSaveConditionGroup,
  onSaveDiagnosis,
  onSaveProgram,
  onUsersChanged,
  onCleanupPatientData,
  onNotify
}: DashboardAdminProps) {
  const { language } = useLanguage();
  const l = (es: string, en: string) => language === 'ES' ? es : en;
  const [search, setSearch] = useState('');
  const [selectedNH, setSelectedNH] = useState('');
  const [selectedNurse, setSelectedNurse] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [patientPage, setPatientPage] = useState(1);
  const [isCleanupConfirmOpen, setIsCleanupConfirmOpen] = useState(false);
  const [cleanupConfirmText, setCleanupConfirmText] = useState('');
  const [isCleaningPatientData, setIsCleaningPatientData] = useState(false);
  const isAdmin = currentUser.role === 'ADMIN';
  
  // Tab control: 'patients' | 'audit_logs' | 'documents' | 'catalog' | 'users'
  const [activeTab, setActiveTab] = useState<'patients' | 'audit_logs' | 'documents' | 'catalog' | 'users'>('patients');

  // Filter nurses list for dropdown
  const nursesList = useMemo(() => {
    return users.filter(u => u.role === 'NURSE' && u.active !== false);
  }, [users]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = patients.length;
    const active = patients.filter(p => p.status === 'ACTIVE').length;
    const pendingConsent = patients.filter(p => p.status === 'PENDING_CONSENT').length;
    const pendingDevice = patients.filter(p => p.status === 'DEVICE_PENDING').length;
    const pendingMedicalOrders = patients.filter(p => {
      const status = getMedicalOrderStatus(p);
      return status === 'ORDER_REQUIRED' || status === 'ORDER_PENDING_PHYSICIAN_APPROVAL' || status === 'ORDER_REJECTED_NEEDS_REVISION';
    }).length;
    const followUp = patients.filter(p => p.status === 'NEEDS_FOLLOW_UP').length;
    const incomplete = patients.filter(p => p.status === 'INCOMPLETE').length;

    return { total, active, pendingConsent, pendingDevice, pendingMedicalOrders, followUp, incomplete };
  }, [patients]);

  // Filter Patients
  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      const matchSearch = `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
                          p.medicareId?.toLowerCase().includes(search.toLowerCase()) ||
                          p.provider.toLowerCase().includes(search.toLowerCase());
      
      const matchNH = selectedNH ? p.nursingHome === selectedNH : true;
      const matchNurse = selectedNurse ? p.assignedNurseId === selectedNurse : true;
      const patientPrograms = String(p.assignedProgram || '').split('+').map(program => program.trim());
      const matchProgram = selectedProgram ? patientPrograms.includes(selectedProgram) : true;
      const orderStatus = getMedicalOrderStatus(p);
      const matchStatus = selectedStatus === 'ALL'
        ? true
        : selectedStatus === 'PENDING_MEDICAL_ORDER'
          ? orderStatus === 'ORDER_REQUIRED'
            || orderStatus === 'ORDER_PENDING_PHYSICIAN_APPROVAL'
            || orderStatus === 'ORDER_REJECTED_NEEDS_REVISION'
          : p.status === selectedStatus;

      return matchSearch && matchNH && matchNurse && matchProgram && matchStatus;
    });
  }, [patients, search, selectedNH, selectedNurse, selectedProgram, selectedStatus]);

  const patientTotalPages = Math.max(1, Math.ceil(filteredPatients.length / PATIENTS_PER_PAGE));
  const safePatientPage = Math.min(patientPage, patientTotalPages);
  const patientStartIndex = filteredPatients.length === 0 ? 0 : (safePatientPage - 1) * PATIENTS_PER_PAGE + 1;
  const patientEndIndex = Math.min(safePatientPage * PATIENTS_PER_PAGE, filteredPatients.length);
  const paginatedPatients = filteredPatients.slice(
    (safePatientPage - 1) * PATIENTS_PER_PAGE,
    safePatientPage * PATIENTS_PER_PAGE
  );

  useEffect(() => {
    setPatientPage(1);
  }, [search, selectedNH, selectedNurse, selectedProgram, selectedStatus, activeTab]);

  useEffect(() => {
    if (patientPage > patientTotalPages) setPatientPage(patientTotalPages);
  }, [patientPage, patientTotalPages]);

  // Filtered Documents
  const filteredDocuments = useMemo(() => {
    return documents.filter(d => {
      const matchSearch = d.patientName.toLowerCase().includes(search.toLowerCase());
      const p = patients.find(pat => pat.id === d.patientId);
      const matchNH = selectedNH && p ? p.nursingHome === selectedNH : true;
      return matchSearch && matchNH;
    });
  }, [documents, search, selectedNH, patients]);

  // Status Badge helper
  const getStatusBadge = (status: PatientStatus) => {
    switch (status) {
      case 'PENDING_CONSENT':
        return <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full">{l('Pte. Consentimiento', 'Pending Consent')}</span>;
      case 'CONSENT_COMPLETED':
        return <span className="bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full">{l('Consentimiento OK', 'Consent Complete')}</span>;
      case 'CONSENT_DECLINED':
        return <span className="bg-red-50 text-red-800 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded-full">Declined</span>;
      case 'DEVICE_PENDING':
        return <span className="bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-bold px-2 py-0.5 rounded-full">{l('Dispositivo Pte.', 'Device Pending')}</span>;
      case 'DEVICE_DELIVERED':
        return <span className="bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold px-2 py-0.5 rounded-full">{l('Dispositivo Entregado', 'Device Delivered')}</span>;
      case 'DEVICE_ACTIVATED':
        return <span className="bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full">{l('Dispositivo Activado', 'Device Activated')}</span>;
      case 'FIRST_BP_RECORDED':
        return <span className="bg-orange-50 text-orange-800 border border-orange-200 text-[10px] font-bold px-2 py-0.5 rounded-full">{l('1.ª BP Registrada', 'First BP Recorded')}</span>;
      case 'ACTIVE':
        return <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center">● {l('Activo', 'Active')}</span>;
      case 'INCOMPLETE':
        return <span className="bg-yellow-50 text-yellow-800 border border-yellow-300 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center">{l('Incompleto', 'Incomplete')}</span>;
      case 'NEEDS_FOLLOW_UP':
        return <span className="bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center font-semibold">Follow-up</span>;
      default:
        return <span className="bg-slate-50 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{status}</span>;
    }
  };

  const getMedicalOrderBadge = (patient: Patient) => {
    const status = getMedicalOrderStatus(patient);
    if (!status) return null;
    switch (status) {
      case 'ORDER_APPROVED':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-xl">{l('Orden: Aprobada', 'Order: Approved')}</span>;
      case 'ORDER_REJECTED_NEEDS_REVISION':
        return <span className="bg-rose-50 text-rose-700 border border-rose-100 text-[10px] font-bold px-2 py-0.5 rounded-xl">{l('Orden: Requiere revisión', 'Order: Needs Revision')}</span>;
      case 'ORDER_PENDING_PHYSICIAN_APPROVAL':
        return <span className="bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-bold px-2 py-0.5 rounded-xl">{l('Orden: Pendiente', 'Order: Pending')}</span>;
      default:
        return <span className="bg-orange-50 text-orange-700 border border-orange-100 text-[10px] font-bold px-2 py-0.5 rounded-xl">{l('Orden médica pendiente', 'Medical order pending')}</span>;
    }
  };

  const handleConfirmCleanup = async () => {
    if (cleanupConfirmText !== 'LIMPIAR') return;
    setIsCleaningPatientData(true);
    try {
      await onCleanupPatientData();
      setIsCleanupConfirmOpen(false);
      setCleanupConfirmText('');
    } finally {
      setIsCleaningPatientData(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in" id="dashboard-admin">
      {/* Welcome & Reset Action */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 leading-tight">{l('Operaciones de pacientes', 'Patient Operations')}</h1>
          <p className="text-xs font-bold text-blue-600">{l('Enrolamiento, órdenes médicas, consentimientos y auditoría', 'Enrollment, medical orders, consents, and audit readiness')}</p>
          <p className="text-slate-500 text-sm mt-1 font-medium">
            {l('Sesión', 'Session')}: <span className="font-semibold text-slate-800">{currentUser.name}</span> • {metrics.total} {l('pacientes totales', 'total patients')} • {metrics.pendingMedicalOrders} {l('órdenes médicas pendientes', 'pending medical orders')}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap justify-end gap-2 shrink-0">
            <button
              onClick={() => setIsCleanupConfirmOpen(true)}
              className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition cursor-pointer"
              id="btn-cleanup-patient-data"
            >
              <Trash2 size={13} className="mr-1.5" />
              {l('Limpiar datos', 'Clean Data')}
            </button>
            <button
              onClick={onImportConditionCatalog}
              className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition cursor-pointer"
            >
              <FileSpreadsheet size={13} className="mr-1.5" />
              {l('Importar catálogo ICD-10', 'Import ICD-10 Catalog')}
            </button>
            <button
              onClick={onRegisterPatientClick}
              className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 transition cursor-pointer"
              id="btn-register-patient-admin"
            >
              <UserPlus size={13} className="mr-1.5" /> {l('Registrar Paciente', 'Register Patient')}
            </button>
          </div>
        )}
      </div>

      {/* KPI Stats Widgets */}
      <div className="grid grid-cols-2 lg:grid-cols-7 gap-4" id="admin-stats-grid">
        <div 
          onClick={() => setSelectedStatus('ALL')}
          className={`bg-white p-4 rounded-2xl border transition cursor-pointer hover:shadow-md ${selectedStatus === 'ALL' ? 'border-slate-800 ring-4 ring-slate-800/10 bg-slate-50/50' : 'border-slate-200'}`}
        >
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{l('Total Pacientes', 'Total Patients')}</span>
          <p className="text-3xl font-extrabold text-slate-800 mt-1">{metrics.total}</p>
        </div>

        <div
          onClick={() => setSelectedStatus('PENDING_MEDICAL_ORDER')}
          className={`bg-white p-4 rounded-2xl border transition cursor-pointer hover:shadow-md ${selectedStatus === 'PENDING_MEDICAL_ORDER' ? 'border-orange-500 ring-4 ring-orange-500/10' : 'border-slate-200'}`}
        >
          <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">{l('Órdenes médicas pendientes', 'Pending Medical Orders')}</span>
          <p className="text-3xl font-extrabold text-slate-800 mt-1">{metrics.pendingMedicalOrders}</p>
        </div>

        <div 
          onClick={() => setSelectedStatus('ACTIVE')}
          className={`bg-white p-4 rounded-2xl border transition cursor-pointer hover:shadow-md ${selectedStatus === 'ACTIVE' ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-slate-200'}`}
        >
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">{l('Pacientes Activos', 'Active Patients')}</span>
          <p className="text-3xl font-extrabold text-slate-800 mt-1">{metrics.active}</p>
        </div>

        <div 
          onClick={() => setSelectedStatus('PENDING_CONSENT')}
          className={`bg-white p-4 rounded-2xl border transition cursor-pointer hover:shadow-md ${selectedStatus === 'PENDING_CONSENT' ? 'border-amber-500 ring-4 ring-amber-500/10' : 'border-slate-200'}`}
        >
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">{l('Ptes. Consentimiento', 'Pending Consent')}</span>
          <p className="text-3xl font-extrabold text-slate-800 mt-1">{metrics.pendingConsent}</p>
        </div>

        <div 
          onClick={() => setSelectedStatus('DEVICE_PENDING')}
          className={`bg-white p-4 rounded-2xl border transition cursor-pointer hover:shadow-md ${selectedStatus === 'DEVICE_PENDING' ? 'border-purple-500 ring-4 ring-purple-500/10' : 'border-slate-200'}`}
        >
          <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">{l('Dispositivos Pendientes', 'Pending Devices')}</span>
          <p className="text-3xl font-extrabold text-slate-800 mt-1">{metrics.pendingDevice}</p>
        </div>

        <div 
          onClick={() => setSelectedStatus('INCOMPLETE')}
          className={`bg-white p-4 rounded-2xl border transition cursor-pointer hover:shadow-md ${selectedStatus === 'INCOMPLETE' ? 'border-yellow-500 ring-4 ring-yellow-500/10' : 'border-slate-200'}`}
        >
          <span className="text-[10px] font-bold text-yellow-600 uppercase tracking-wider">{l('Visitas Incompletas', 'Incomplete Visits')}</span>
          <p className="text-3xl font-extrabold text-slate-800 mt-1">{metrics.incomplete}</p>
        </div>

        <div 
          onClick={() => setSelectedStatus('NEEDS_FOLLOW_UP')}
          className={`bg-white p-4 rounded-2xl border transition cursor-pointer hover:shadow-md ${selectedStatus === 'NEEDS_FOLLOW_UP' ? 'border-rose-500 ring-4 ring-rose-500/10' : 'border-slate-200'}`}
        >
          <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">{l('En Seguimiento', 'Follow-up')}</span>
          <p className="text-3xl font-extrabold text-slate-800 mt-1">{metrics.followUp}</p>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-200 bg-white p-1 rounded-xl border max-w-4xl" id="admin-tabs">
        <button
          onClick={() => setActiveTab('patients')}
          className={`flex-1 text-center py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeTab === 'patients' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
          id="tab-patients"
        >
          {l('Pacientes', 'Patients')} ({filteredPatients.length})
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className={`flex-1 text-center py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeTab === 'documents' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
          id="tab-documents"
        >
          {l('Documentos PDF', 'PDF Documents')} ({filteredDocuments.length})
        </button>
        <button
          onClick={() => setActiveTab('audit_logs')}
          className={`flex-1 text-center py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeTab === 'audit_logs' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
          id="tab-audits"
        >
          {l('Registros de Auditoría', 'Audit Logs')} ({auditLogs.length})
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('catalog')}
            className={`flex-1 text-center py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              activeTab === 'catalog' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
            id="tab-clinical-catalog"
          >
            {l('Conditions & Diagnoses', 'Conditions & Diagnoses')} ({conditionGroups.length})
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 text-center py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              activeTab === 'users' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
            id="tab-users"
          >
            {l('Usuarios y Roles', 'Users & Roles')} ({users.length})
          </button>
        )}
      </div>

      {/* Primary Tab View Content */}
      {activeTab === 'users' ? (
        <UserManagement
          currentUser={currentUser}
          users={users}
          onUsersChanged={onUsersChanged}
          onNotify={onNotify}
        />
      ) : activeTab === 'catalog' ? (
        <ClinicalCatalogManagement
          currentUser={currentUser}
          groups={conditionGroups}
          diagnoses={diagnoses}
          history={catalogImports}
          programs={programs}
          onImportExcel={onImportConditionCatalog}
          onSaveGroup={onSaveConditionGroup}
          onSaveDiagnosis={onSaveDiagnosis}
          onSaveProgram={onSaveProgram}
          onNotify={onNotify}
        />
      ) : (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Filters bar always visible (search modifies search context, NH modifies NH context) */}
        <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={l('Buscar por nombre, ID o médico...', 'Search by name, ID, or physician...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 w-full border border-slate-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
            />
          </div>

          <select
            value={selectedNH}
            onChange={(e) => setSelectedNH(e.target.value)}
            aria-label={l('Filtrar por residencia', 'Filter by nursing home')}
            className="px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs bg-white font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">{l('Residencia: Todas', 'Nursing Home: All')}</option>
            {NURSING_HOMES.map(nh => (
              <option key={nh} value={nh}>{nh}</option>
            ))}
          </select>

          <select
            value={selectedNurse}
            onChange={(e) => setSelectedNurse(e.target.value)}
            aria-label={l('Filtrar por enfermera', 'Filter by nurse')}
            className="px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs bg-white font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">{l('Enfermera: Todas', 'Nurse: All')}</option>
            {nursesList.map(n => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>

          <select
            value={selectedProgram}
            onChange={(e) => setSelectedProgram(e.target.value)}
            aria-label={l('Filtrar por programa', 'Filter by program')}
            className="px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs bg-white font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">{l('Programa: Todos', 'Program: All')}</option>
            {programs.filter(program => program.is_active).map(program => (
              <option key={program.id} value={program.code}>{program.display}</option>
            ))}
          </select>

          {activeTab === 'patients' && (
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              aria-label={l('Filtrar por estado', 'Filter by status')}
              className="px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs bg-white font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ALL">{l('Estado: Todos', 'Status: All')}</option>
              <option value="PENDING_MEDICAL_ORDER">{l('Orden médica pendiente', 'Pending Medical Order')}</option>
              <option value="PENDING_CONSENT">{l('Pendiente Consentimiento', 'Pending Consent')}</option>
              <option value="CONSENT_COMPLETED">{l('Consentimiento Firmado', 'Consent Signed')}</option>
              <option value="DEVICE_PENDING">{l('Dispositivo Pendiente', 'Device Pending')}</option>
              <option value="DEVICE_DELIVERED">{l('Dispositivo Entregado', 'Device Delivered')}</option>
              <option value="DEVICE_ACTIVATED">{l('Dispositivo Activado', 'Device Activated')}</option>
              <option value="ACTIVE">{l('Activo', 'Active')}</option>
              <option value="INCOMPLETE">{l('Incompleto', 'Incomplete')}</option>
              <option value="NEEDS_FOLLOW_UP">{l('Requiere Seguimiento', 'Needs Follow-up')}</option>
            </select>
          )}

          <button
            onClick={() => {
              setSearch('');
              setSelectedNH('');
              setSelectedNurse('');
              setSelectedProgram('');
              setSelectedStatus('ALL');
            }}
            className="text-xs text-slate-500 hover:text-slate-800 font-bold px-2 cursor-pointer transition-colors"
          >
            {l('Limpiar Filtros', 'Clear Filters')}
          </button>
        </div>

        {/* Tab 1: Patients Manager */}
        {activeTab === 'patients' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200" id="patients-admin-table">
              <thead className="bg-slate-50/50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-6 py-3.5 text-left">{l('Paciente', 'Patient')}</th>
                  <th scope="col" className="px-6 py-3.5 text-left">{l('Residencia / Hab.', 'Nursing Home / Room')}</th>
                  <th scope="col" className="px-6 py-3.5 text-left">{l('Programa / Equipo', 'Program / Device')}</th>
                  <th scope="col" className="px-6 py-3.5 text-left">{l('Estado', 'Status')}</th>
                  <th scope="col" className="px-6 py-3.5 text-right">{l('Acción', 'Action')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 text-xs">
                {filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-400 font-medium">
                      {l('No se encontraron pacientes que cumplan con los filtros de búsqueda.', 'No patients match the selected search filters.')}
                    </td>
                  </tr>
                ) : (
                  paginatedPatients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-slate-50/20 transition">
                      {/* Name & DOB */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-slate-800">{patient.firstName} {patient.lastName}</div>
                        <div className="text-[10px] text-slate-500 font-medium">DOB: {patient.birthDate} • ID: {patient.medicareId || 'N/A'}</div>
                      </td>

                      {/* NH / Room */}
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                        <div className="font-bold text-slate-700">{patient.nursingHome}</div>
                        <div className="text-[10px] text-slate-500 font-semibold">{l('Hab.', 'Room')}: {patient.room || 'N/A'} • {l('Proveedor', 'Provider')}: {patient.provider}</div>
                        <div className="text-[10px] text-slate-400 font-semibold mt-0.5 flex items-center">
                          {isAdmin ? (
                            <select
                              value={patient.assignedNurseId}
                              onChange={(e) => onReassignNurse(patient.id, e.target.value)}
                              className="bg-transparent border-none text-[10px] text-slate-500 font-semibold focus:outline-none focus:ring-0 cursor-pointer hover:text-slate-800 transition-colors p-0"
                              id={`nurse-select-for-${patient.id}`}
                              title={l('Cambiar enfermera asignada', 'Change assigned nurse')}
                              aria-label={l(
                                `Cambiar enfermera asignada para ${patient.firstName} ${patient.lastName}`,
                                `Change assigned nurse for ${patient.firstName} ${patient.lastName}`
                              )}
                            >
                              {nursesList.map(n => (
                                <option key={n.id} value={n.id}>{n.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span>{patient.assignedNurseName || l('No asignada', 'Unassigned')}</span>
                          )}
                        </div>
                      </td>

                      {/* Prog / Device */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-bold text-blue-800 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-xl text-[10px]">{patient.assignedProgram}</span>
                        <div className="text-[10px] text-slate-500 mt-1.5 font-bold text-slate-600 flex items-center"><Smartphone size={10} className="mr-0.5 text-slate-400" /> {l('Disp.', 'Device')}: {patient.requiredDevice}</div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {getMedicalOrderBadge(patient)}
                          {isAdmin && patientRequiresDevice(patient) && (getMedicalOrderStatus(patient) === 'ORDER_REQUIRED' || getMedicalOrderStatus(patient) === 'ORDER_REJECTED_NEEDS_REVISION') && (
                            <button
                              type="button"
                              onClick={() => onGenerateMedicalOrder(patient.id)}
                              className="rounded-xl border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-extrabold text-orange-700 hover:bg-orange-100"
                            >
                              {getMedicalOrderStatus(patient) === 'ORDER_REJECTED_NEEDS_REVISION'
                                ? l('Re-enviar orden', 'Resend Order')
                                : l('Generar orden médica', 'Generate Medical Order')}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(patient.status)}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          {patientRequiresDevice(patient) && getMedicalOrderStatus(patient) === 'ORDER_PENDING_PHYSICIAN_APPROVAL' && (
                            <button
                              onClick={() => onOpenMedicalOrderReview(patient)}
                              className="inline-flex items-center text-xs font-bold text-violet-700 hover:text-violet-900 px-3 py-1.5 rounded-xl bg-violet-50 hover:bg-violet-100 transition cursor-pointer border border-violet-200"
                              id={`admin-btn-review-order-${patient.id}`}
                            >
                              <Shield size={13} className="mr-1" /> {l('Revisar', 'Review')}
                            </button>
                          )}
                          <button
                            onClick={() => onViewProfile(patient.id)}
                            className="inline-flex items-center text-xs font-bold text-blue-600 hover:text-blue-900 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 transition cursor-pointer border border-blue-200"
                            id={`admin-btn-profile-${patient.id}`}
                          >
                            <Eye size={13} className="mr-1" /> {l('Ver Perfil', 'View Profile')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {filteredPatients.length > PATIENTS_PER_PAGE && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/60">
                <p className="text-xs font-semibold text-slate-500">
                  {l('Mostrando', 'Showing')} {patientStartIndex}-{patientEndIndex} {l('de', 'of')} {filteredPatients.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPatientPage(page => Math.max(1, page - 1))}
                    disabled={safePatientPage === 1}
                    className="inline-flex h-8 items-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft size={14} className="mr-1" />
                    {l('Anterior', 'Previous')}
                  </button>
                  <span className="min-w-[4.5rem] text-center text-xs font-extrabold text-slate-700">
                    {safePatientPage} / {patientTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPatientPage(page => Math.min(patientTotalPages, page + 1))}
                    disabled={safePatientPage === patientTotalPages}
                    className="inline-flex h-8 items-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {l('Siguiente', 'Next')}
                    <ChevronRight size={14} className="ml-1" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Document Browser */}
        {activeTab === 'documents' && (
          <div className="p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-4">{l('Repositorio de Documentación Generada (Firmados)', 'Generated Documentation Repository (Signed)')}</h3>
            
            {filteredDocuments.length === 0 ? (
              <div className="text-center py-12 text-slate-400 space-y-2 border-2 border-dashed border-slate-200 rounded-2xl">
                <FileText size={40} className="mx-auto text-slate-300 stroke-[1.5]" />
                <p className="font-semibold text-sm">{l('No se han generado documentos firmados aún', 'No signed documents have been generated yet')}</p>
                <p className="text-xs">{l('Los documentos PDF se generan automáticamente durante la visita de la enfermera.', 'PDF documents are generated automatically during the nurse visit.')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="admin-documents-grid">
                {filteredDocuments.map((doc) => (
                  <div key={doc.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-start justify-between space-x-4 hover:shadow-sm transition-shadow">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <FileText size={18} className="text-blue-600 shrink-0" />
                        <span className="font-bold text-xs text-slate-800">{doc.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-600">{l('Paciente', 'Patient')}: <span className="font-bold">{doc.patientName}</span></p>
                      <p className="text-[10px] text-slate-400 font-semibold">{l('Generado por', 'Generated by')}: {doc.generatedBy} {l('el', 'on')} {new Date(doc.dateTime).toLocaleString()}</p>
                      <p className="text-[9px] font-mono text-slate-400">{l('ID Único', 'Unique ID')}: {doc.id}</p>
                    </div>
                    <button
                      onClick={() => onDownloadPDF(doc)}
                      className="p-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 shrink-0 inline-flex items-center font-bold cursor-pointer"
                      title={l('Descargar PDF original', 'Download original PDF')}
                      id={`btn-download-${doc.id}`}
                    >
                      <Download size={14} className="mr-1 text-blue-600" /> {l('Descargar', 'Download')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Audit Logs Browser */}
        {activeTab === 'audit_logs' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center">
                <History size={16} className="mr-1.5 text-slate-500" /> {l('Registro de Auditoría de Seguridad (HIPAA)', 'Security Audit Log (HIPAA)')}
              </h3>
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-xl">
                HIPAA Compliant Log • {l('Solo lectura', 'Read only')}
              </span>
            </div>

            <div className="max-h-[450px] overflow-y-auto border border-slate-200 rounded-2xl shadow-inner bg-slate-50/30">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider sticky top-0">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 text-left">Timestamp</th>
                    <th scope="col" className="px-4 py-2.5 text-left">{l('Usuario / Rol', 'User / Role')}</th>
                    <th scope="col" className="px-4 py-2.5 text-left">{l('Acción', 'Action')}</th>
                    <th scope="col" className="px-4 py-2.5 text-left">{l('Paciente', 'Patient')}</th>
                    <th scope="col" className="px-4 py-2.5 text-left font-mono">{l('Detalle', 'Details')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100 text-[11px] font-semibold text-slate-600">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/20">
                      <td className="px-4 py-2 whitespace-nowrap text-slate-400 font-mono text-[10px]">
                        {new Date(log.dateTime).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className="font-bold text-slate-800">{log.userName}</span>
                        <span className="ml-1 px-1.5 bg-slate-100 border text-slate-500 text-[8px] font-bold rounded-xl">{log.userRole}</span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap font-bold text-slate-800">
                        {log.action}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-blue-600 font-bold">
                        {log.patientName || '-'}
                      </td>
                      <td className="px-4 py-2 text-slate-500 font-mono max-w-xs truncate text-[10px]" title={log.details}>
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      )}
      {isCleanupConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  {l('Confirmar limpieza de datos', 'Confirm Data Cleanup')}
                </h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {l('Esta acción no se puede deshacer.', 'This action cannot be undone.')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isCleaningPatientData) return;
                  setIsCleanupConfirmOpen(false);
                  setCleanupConfirmText('');
                }}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label={l('Cerrar confirmación', 'Close confirmation')}
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-900">
                <p>
                  {l(
                    'Se eliminarán pacientes, visitas, consentimientos, dispositivos, lecturas, órdenes/activaciones, medicaciones, documentos PDF y auditoría previa de pacientes.',
                    'Patients, visits, consents, devices, readings, orders/activations, medications, PDF documents, and previous patient audit history will be deleted.'
                  )}
                </p>
                <p className="mt-2">
                  {l(
                    'Se conservan usuarios, roles, accesos, catálogos ICD-10, historial de importación de nomencladores y configuración general.',
                    'Users, roles, access, ICD-10 catalogs, catalog import history, and general configuration are preserved.'
                  )}
                </p>
              </div>
              <label className="block text-xs font-extrabold text-slate-700" htmlFor="cleanup-confirm-text">
                {l('Escriba LIMPIAR para confirmar', 'Type LIMPIAR to confirm')}
              </label>
              <input
                id="cleanup-confirm-text"
                value={cleanupConfirmText}
                onChange={(event) => setCleanupConfirmText(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-800 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                autoComplete="off"
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 p-5">
              <button
                type="button"
                onClick={() => {
                  setIsCleanupConfirmOpen(false);
                  setCleanupConfirmText('');
                }}
                disabled={isCleaningPatientData}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {l('Cancelar', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmCleanup}
                disabled={cleanupConfirmText !== 'LIMPIAR' || isCleaningPatientData}
                className="inline-flex items-center rounded-xl bg-rose-600 px-4 py-2 text-xs font-extrabold text-white shadow-lg shadow-rose-600/20 transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                id="btn-confirm-cleanup-patient-data"
              >
                <Trash2 size={14} className="mr-1.5" />
                {isCleaningPatientData ? l('Limpiando...', 'Cleaning...') : l('Eliminar datos', 'Delete Data')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
