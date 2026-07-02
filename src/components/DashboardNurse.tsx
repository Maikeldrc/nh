import { useState, useMemo } from 'react';
import { Patient, User, PatientStatus } from '../types';
import { NURSING_HOMES, PROGRAMS } from '../data';
import { 
  Search, Users, FileText, Smartphone, CheckCircle, 
  AlertTriangle, ArrowRight, Play, RefreshCw, Eye, MapPin, Calendar, UserPlus
} from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';
import { getMedicalOrderStatus, patientRequiresDevice } from '../utils/medicalOrders';
import { POWERED_BY, PRODUCT_NAME } from '../utils/branding';

interface DashboardNurseProps {
  currentUser: User;
  onStartVisit: (patientId: string) => void;
  onViewProfile: (patientId: string) => void;
  onContinueVisit: (patientId: string) => void;
  patients: Patient[];
  onRegisterPatientClick: () => void;
  onGenerateMedicalOrder: (patientId: string) => void;
}

export default function DashboardNurse({ 
  currentUser, 
  patients, 
  onStartVisit, 
  onViewProfile, 
  onContinueVisit,
  onRegisterPatientClick,
  onGenerateMedicalOrder
}: DashboardNurseProps) {
  const [search, setSearch] = useState('');
  const [selectedNH, setSelectedNH] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const { language, t } = useLanguage();
  const l = (es: string, en: string) => language === 'ES' ? es : en;

  // Filter patients assigned to this nurse
  const assignedPatients = useMemo(() => {
    return patients.filter(p => p.assignedNurseId === currentUser.id);
  }, [patients, currentUser.id]);


  // Statistics calculations
  const stats = useMemo(() => {
    const total = assignedPatients.length;
    const pendingConsent = assignedPatients.filter(p => p.status === 'PENDING_CONSENT').length;
    const pendingDevice = assignedPatients.filter(p => p.status === 'DEVICE_PENDING').length;
    const pendingMedicalOrders = assignedPatients.filter(p => {
      const status = getMedicalOrderStatus(p);
      return status === 'ORDER_REQUIRED' || status === 'ORDER_PENDING_PHYSICIAN_APPROVAL' || status === 'ORDER_REJECTED_NEEDS_REVISION';
    }).length;
    const activeToday = assignedPatients.filter(p => p.status === 'ACTIVE').length; // Simplification
    const incomplete = assignedPatients.filter(p => p.status === 'INCOMPLETE').length;
    const followUp = assignedPatients.filter(p => p.status === 'NEEDS_FOLLOW_UP').length;

    return { total, pendingConsent, pendingDevice, pendingMedicalOrders, activeToday, incomplete, followUp };
  }, [assignedPatients]);

  // Handle filtering
  const filteredPatients = useMemo(() => {
    return assignedPatients.filter(p => {
      const matchSearch = `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
                          p.medicareId?.toLowerCase().includes(search.toLowerCase());
      
      const matchNH = selectedNH ? p.nursingHome === selectedNH : true;
      
      const orderStatus = getMedicalOrderStatus(p);
      const matchStatus = selectedStatus === 'ALL'
        ? true
        : selectedStatus === 'PENDING_MEDICAL_ORDER'
          ? orderStatus === 'ORDER_REQUIRED'
            || orderStatus === 'ORDER_PENDING_PHYSICIAN_APPROVAL'
            || orderStatus === 'ORDER_REJECTED_NEEDS_REVISION'
          : p.status === selectedStatus;

      return matchSearch && matchNH && matchStatus;
    });
  }, [assignedPatients, search, selectedNH, selectedStatus]);

  // Status Badge helper
  const getStatusBadge = (status: PatientStatus) => {
    switch (status) {
      case 'PENDING_CONSENT':
        return <span className="bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold px-2.5 py-1 rounded-full">{l('Pendiente Consentimiento', 'Pending Consent')}</span>;
      case 'CONSENT_COMPLETED':
        return <span className="bg-blue-50 text-blue-800 border border-blue-200 text-xs font-semibold px-2.5 py-1 rounded-full">{l('Consentimiento Firmado', 'Consent Signed')}</span>;
      case 'CONSENT_DECLINED':
        return <span className="bg-red-50 text-red-800 border border-red-200 text-xs font-semibold px-2.5 py-1 rounded-full">{l('Consentimiento Rechazado', 'Consent Declined')}</span>;
      case 'DEVICE_PENDING':
        return <span className="bg-purple-50 text-purple-800 border border-purple-200 text-xs font-semibold px-2.5 py-1 rounded-full">{l('Dispositivo Pendiente', 'Device Pending')}</span>;
      case 'DEVICE_DELIVERED':
        return <span className="bg-teal-50 text-teal-800 border border-teal-200 text-xs font-semibold px-2.5 py-1 rounded-full">{l('Dispositivo Entregado', 'Device Delivered')}</span>;
      case 'DEVICE_ACTIVATED':
        return <span className="bg-blue-50 text-blue-800 border border-blue-200 text-xs font-semibold px-2.5 py-1 rounded-full">{l('Dispositivo Activado', 'Device Activated')}</span>;
      case 'FIRST_BP_RECORDED':
        return <span className="bg-orange-50 text-orange-800 border border-orange-200 text-xs font-semibold px-2.5 py-1 rounded-full">{l('Primera BP Registrada', 'First BP Recorded')}</span>;
      case 'ACTIVE':
        return <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center"><CheckCircle size={12} className="mr-1 text-emerald-600" /> {l('Activo', 'Active')}</span>;
      case 'INCOMPLETE':
        return <span className="bg-yellow-50 text-yellow-800 border border-yellow-200 text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center"><AlertTriangle size={12} className="mr-1 text-yellow-600" /> {l('Visita Incompleta', 'Incomplete Visit')}</span>;
      case 'NEEDS_FOLLOW_UP':
        return <span className="bg-rose-50 text-rose-800 border border-rose-200 text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center"><AlertTriangle size={12} className="mr-1 text-rose-600" /> {l('Requiere Seguimiento', 'Needs Follow-up')}</span>;
      default:
        return <span className="bg-slate-50 text-slate-800 text-xs font-semibold px-2.5 py-1 rounded-full">{status}</span>;
    }
  };

  const getMedicalOrderBadge = (patient: Patient) => {
    const status = getMedicalOrderStatus(patient);
    if (!status) return null;
    switch (status) {
      case 'ORDER_APPROVED':
        return <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-xl font-bold border border-emerald-100">{l('Orden: Aprobada', 'Order: Approved')}</span>;
      case 'ORDER_REJECTED_NEEDS_REVISION':
        return <span className="bg-rose-50 text-rose-700 px-2.5 py-0.5 rounded-xl font-bold border border-rose-100">{l('Orden: Requiere revisión', 'Order: Needs Revision')}</span>;
      case 'ORDER_PENDING_PHYSICIAN_APPROVAL':
        return <span className="bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-xl font-bold border border-amber-100">{l('Orden: Pendiente', 'Order: Pending')}</span>;
      default:
        return <span className="bg-orange-50 text-orange-700 px-2.5 py-0.5 rounded-xl font-bold border border-orange-100">{l('Orden médica pendiente', 'Medical order pending')}</span>;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in" id="dashboard-nurse">
      {/* Intro / Welcome Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 leading-tight">{PRODUCT_NAME}</h1>
          <p className="text-xs font-bold text-blue-600">{POWERED_BY}</p>
          <p className="text-slate-500 text-sm mt-1">
            {l('Enfermera', 'Nurse')}: <span className="font-semibold text-slate-800">{currentUser.name}</span> • {l('Gestione el enrolamiento presencial hoy.', 'Manage today’s on-site enrollment.')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex space-x-2 text-xs font-semibold text-slate-500 bg-slate-50 py-1.5 px-3 rounded-xl border border-slate-200">
            <MapPin size={14} className="text-slate-400 shrink-0" />
            <span>
              Nursing Homes: {currentUser.nursingHomeAccess?.length === NURSING_HOMES.length 
                ? (language === 'ES' ? 'Todos' : 'All') 
                : `${currentUser.nursingHomeAccess?.length || 0} ${l('asignados', 'assigned')}`}
            </span>
          </div>
          <button
            onClick={onRegisterPatientClick}
            className="inline-flex items-center justify-center px-4.5 py-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 transition cursor-pointer"
            id="btn-register-patient-nurse"
          >
            <UserPlus size={14} className="mr-1.5" />
            {l('Registrar Paciente', 'Register Patient')}
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4" id="nurse-stats-grid">
        <div 
          onClick={() => setSelectedStatus('PENDING_CONSENT')}
          className={`bg-white p-4 rounded-2xl border transition cursor-pointer hover:shadow-md ${selectedStatus === 'PENDING_CONSENT' ? 'border-amber-500 ring-4 ring-amber-500/10' : 'border-slate-200'}`}
        >
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{l('Consent. Pendientes', 'Pending Consents')}</span>
            <FileText size={18} className="text-amber-500 shrink-0" />
          </div>
          <p className="text-3xl font-extrabold text-slate-800 mt-2">{stats.pendingConsent}</p>
        </div>

        <div
          onClick={() => setSelectedStatus('PENDING_MEDICAL_ORDER')}
          className={`bg-white p-4 rounded-2xl border transition cursor-pointer hover:shadow-md ${selectedStatus === 'PENDING_MEDICAL_ORDER' ? 'border-orange-500 ring-4 ring-orange-500/10' : 'border-slate-200'}`}
        >
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">{l('Órdenes médicas pendientes', 'Pending Medical Orders')}</span>
            <FileText size={18} className="text-orange-500 shrink-0" />
          </div>
          <p className="text-3xl font-extrabold text-slate-800 mt-2">{stats.pendingMedicalOrders}</p>
        </div>

        <div 
          onClick={() => setSelectedStatus('DEVICE_PENDING')}
          className={`bg-white p-4 rounded-2xl border transition cursor-pointer hover:shadow-md ${selectedStatus === 'DEVICE_PENDING' ? 'border-purple-500 ring-4 ring-purple-500/10' : 'border-slate-200'}`}
        >
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{l('Dispositivos Pendientes', 'Pending Devices')}</span>
            <Smartphone size={18} className="text-purple-500 shrink-0" />
          </div>
          <p className="text-3xl font-extrabold text-slate-800 mt-2">{stats.pendingDevice}</p>
        </div>

        <div 
          onClick={() => setSelectedStatus('INCOMPLETE')}
          className={`bg-white p-4 rounded-2xl border transition cursor-pointer hover:shadow-md ${selectedStatus === 'INCOMPLETE' ? 'border-yellow-500 ring-4 ring-yellow-500/10' : 'border-slate-200'}`}
        >
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{l('Visitas Incompletas', 'Incomplete Visits')}</span>
            <RefreshCw size={18} className="text-yellow-500 shrink-0" />
          </div>
          <p className="text-3xl font-extrabold text-slate-800 mt-2">{stats.incomplete}</p>
        </div>

        <div 
          onClick={() => setSelectedStatus('NEEDS_FOLLOW_UP')}
          className={`bg-white p-4 rounded-2xl border transition cursor-pointer hover:shadow-md ${selectedStatus === 'NEEDS_FOLLOW_UP' ? 'border-rose-500 ring-4 ring-rose-500/10' : 'border-slate-200'}`}
        >
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{l('Requieren Seguimiento', 'Need Follow-up')}</span>
            <AlertTriangle size={18} className="text-rose-500 shrink-0" />
          </div>
          <p className="text-3xl font-extrabold text-slate-800 mt-2">{stats.followUp}</p>
        </div>

        <div 
          onClick={() => setSelectedStatus('ACTIVE')}
          className={`bg-white p-4 rounded-2xl border transition cursor-pointer hover:shadow-md ${selectedStatus === 'ACTIVE' ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-slate-200'}`}
        >
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{l('Pacientes Activos', 'Active Patients')}</span>
            <CheckCircle size={18} className="text-emerald-500 shrink-0" />
          </div>
          <p className="text-3xl font-extrabold text-slate-800 mt-2">{stats.activeToday}</p>
        </div>
      </div>

      {/* Main Panel Area: Patients list and search filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" id="nurse-patients-panel">
        <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-800 font-sans tracking-tight">{t('assigned_patients')} ({filteredPatients.length})</h2>
            <p className="text-slate-500 text-xs mt-0.5 font-medium">
              {language === 'ES' 
                ? 'Seleccione un paciente para iniciar o continuar el proceso guiado en sitio.' 
                : 'Select a patient to start or continue the on-site guided process.'}
            </p>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder={t('search_placeholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 w-60 border border-slate-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
              />
            </div>

            {/* NH Filter */}
            <select
              value={selectedNH}
              onChange={(e) => setSelectedNH(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-700"
            >
              <option value="">{language === 'ES' ? 'Todos los Nursing Homes' : 'All Nursing Homes'}</option>
              {NURSING_HOMES.map(nh => (
                <option key={nh} value={nh}>{nh}</option>
              ))}
            </select>

            {/* Reset Filter Button */}
            {selectedStatus !== 'ALL' && (
              <button
                onClick={() => setSelectedStatus('ALL')}
                className="px-3 py-1.5 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition font-bold cursor-pointer"
              >
                {language === 'ES' ? 'Ver Todos' : 'View All'}
              </button>
            )}
          </div>
        </div>

        {/* Patients Grid / List */}
        {filteredPatients.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Users size={40} className="mx-auto stroke-[1.5] text-slate-300" />
            <p className="font-semibold text-sm text-slate-600">{t('no_patients')}</p>
            <p className="text-xs">
              {language === 'ES' 
                ? 'Intente modificar sus filtros de búsqueda o consulte al Administrador.' 
                : 'Try modifying your search filters or consult the Administrator.'}
            </p>
          </div>

        ) : (
          <div className="divide-y divide-slate-100" id="nurse-patients-list">
            {filteredPatients.map((patient) => {
              const isResume = patient.status === 'INCOMPLETE';
              
              return (
                <div 
                  key={patient.id} 
                  className="px-4 py-4 sm:px-5 hover:bg-slate-50/40 transition grid grid-cols-1 lg:grid-cols-[minmax(210px,0.85fr)_minmax(360px,1.7fr)_minmax(296px,auto)] items-center gap-4 lg:gap-6"
                  id={`patient-row-${patient.id}`}
                >
                  {/* Identity */}
                  <div className="min-w-0 space-y-2">
                    <div className="flex items-center flex-wrap gap-2">
                      <h3 className="font-extrabold text-slate-800 text-sm sm:text-base truncate">{patient.firstName} {patient.lastName}</h3>
                      {getStatusBadge(patient.status)}
                    </div>
                    <div className="flex items-center text-xs text-slate-500 font-semibold">
                      <Calendar size={13} className="mr-1.5 text-slate-400 shrink-0" />
                      <span>DOB: {patient.birthDate}</span>
                    </div>
                  </div>

                  {/* Facility and clinical assignment */}
                  <div className="min-w-0 space-y-2.5">
                    <div className="flex items-start text-xs text-slate-600 font-semibold min-w-0">
                      <MapPin size={13} className="mr-1.5 mt-0.5 text-slate-400 shrink-0" />
                      <span className="leading-relaxed">
                        {patient.nursingHome}
                        <span className="text-slate-300 mx-1.5">•</span>
                        {language === 'ES' ? 'Habitación' : 'Room'} {patient.room || 'N/A'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center text-xs gap-2">
                      <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-xl font-bold border border-slate-200">
                        Prog: {patient.assignedProgram}
                      </span>
                      {patient.requiredDevice !== 'None' && (
                        <span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-xl font-bold border border-blue-100 flex items-center">
                          <Smartphone size={11} className="mr-1 text-blue-500" /> {language === 'ES' ? 'Requerido' : 'Required'}: {patient.requiredDevice}
                        </span>
                      )}
                      {getMedicalOrderBadge(patient)}
                      {patientRequiresDevice(patient) && getMedicalOrderStatus(patient) === 'ORDER_REQUIRED' && (
                        <button
                          type="button"
                          onClick={() => onGenerateMedicalOrder(patient.id)}
                          className="inline-flex items-center rounded-xl border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-extrabold text-orange-700 hover:bg-orange-100"
                        >
                          <FileText size={11} className="mr-1" /> {l('Generar orden', 'Generate Order')}
                        </button>
                      )}
                      {patientRequiresDevice(patient) && getMedicalOrderStatus(patient) === 'ORDER_REJECTED_NEEDS_REVISION' && (
                        <button
                          type="button"
                          onClick={() => onGenerateMedicalOrder(patient.id)}
                          className="inline-flex items-center rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-extrabold text-rose-700 hover:bg-rose-100"
                        >
                          <RefreshCw size={11} className="mr-1" /> {l('Corregir / re-enviar', 'Revise / Resend')}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-2 w-full lg:w-auto lg:min-w-[296px]">
                    <button
                      onClick={() => onViewProfile(patient.id)}
                      className="inline-flex h-10 w-full items-center justify-center px-3 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition cursor-pointer"
                      id={`btn-view-profile-${patient.id}`}
                    >
                      <Eye size={14} className="mr-1.5 text-slate-500" /> {language === 'ES' ? 'Perfil' : 'Profile'}
                    </button>

                    {patient.status === 'ACTIVE' ? (
                      <span className="inline-flex h-10 w-full items-center justify-center px-3 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <CheckCircle size={14} className="mr-1.5" /> {language === 'ES' ? 'Completado' : 'Completed'}
                      </span>
                    ) : isResume ? (
                      <button
                        onClick={() => onContinueVisit(patient.id)}
                        className="inline-flex h-10 w-full items-center justify-center px-3 text-xs font-extrabold text-white bg-yellow-600 hover:bg-yellow-700 rounded-xl shadow-lg shadow-yellow-600/20 transition cursor-pointer"
                        id={`btn-continue-visit-${patient.id}`}
                      >
                        <RefreshCw size={14} className="mr-1.5 animate-spin-slow" /> {t('continue_visit')}
                      </button>
                    ) : (
                      <button
                        onClick={() => onStartVisit(patient.id)}
                        className="inline-flex h-10 w-full items-center justify-center px-3 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/20 transition cursor-pointer"
                        id={`btn-start-visit-${patient.id}`}
                      >
                        <Play size={12} className="mr-1.5 fill-current" /> {t('start_visit')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
