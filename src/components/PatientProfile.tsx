import { useMemo, useState } from 'react';
import { Patient, User, Consent, Device, BPReading, DocumentRecord, AuditLog, ConditionGroupCatalog, DiagnosisCatalog, ProgramCatalog } from '../types';
import { 
  ArrowLeft, FileText, Smartphone, Activity, CheckCircle, 
  AlertTriangle, Play, RefreshCw, Calendar, MapPin, Download, History, List, ShieldAlert, Edit3
} from 'lucide-react';
import EditPatientModal from './EditPatientModal';
import { useLanguage } from '../utils/LanguageContext';
import { getMedicalOrderStatus, patientRequiresDevice } from '../utils/medicalOrders';
import { isEnrollmentOperationsRole } from '../utils/roles';

interface PatientProfileProps {
  currentUser: User;
  patient: Patient;
  consent?: Consent;
  device?: Device;
  bpReadings: BPReading[];
  documents: DocumentRecord[];
  auditLogs: AuditLog[];
  nursingHomes: string[];
  conditionGroups: ConditionGroupCatalog[];
  diagnoses: DiagnosisCatalog[];
  programs: ProgramCatalog[];
  onBack: () => void;
  onStartVisit?: (patientId: string) => void;
  onContinueVisit?: (patientId: string) => void;
  onDownloadPDF: (docRecord: DocumentRecord) => void;
  onUpdatePatient: (updatedPatient: Patient) => void;
  onGenerateMedicalOrder: (patientId: string) => void;
  onApproveMedicalOrder: (patientId: string, notes?: string) => void;
  onRejectMedicalOrder: (patientId: string, notes?: string) => void;
  onOpenMedicalOrderReview?: (patient: Patient) => void;
}

export default function PatientProfile({
  currentUser,
  patient,
  consent,
  device,
  bpReadings,
  documents,
  auditLogs,
  nursingHomes,
  conditionGroups,
  diagnoses,
  programs,
  onBack,
  onStartVisit,
  onContinueVisit,
  onDownloadPDF,
  onUpdatePatient,
  onGenerateMedicalOrder,
  onApproveMedicalOrder,
  onRejectMedicalOrder,
  onOpenMedicalOrderReview
}: PatientProfileProps) {
  const { language } = useLanguage();
  const l = (es: string, en: string) => language === 'ES' ? es : en;
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Filter logs for this specific patient
  const patientLogs = useMemo(() => {
    return auditLogs.filter(log => log.patientId === patient.id);
  }, [auditLogs, patient.id]);
  const uniqueReadings = useMemo(() => {
    const seen = new Set<string>();
    return bpReadings.filter(reading => {
      const key = reading.readingType === 'WEIGHT'
        ? `WEIGHT:${reading.weightLbs ?? ''}`
        : `BP:${reading.systolic ?? ''}:${reading.diastolic ?? ''}:${reading.pulse ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [bpReadings]);

  // Is the visit resumable?
  const isResumable = patient.status === 'INCOMPLETE';
  const medicalOrderStatus = getMedicalOrderStatus(patient);
  const visibleDeviceStatus = patient.status === 'ACTIVE'
    ? 'ACTIVE'
    : device?.status === 'PENDING_ORDER_APPROVAL' && medicalOrderStatus === 'ORDER_APPROVED'
      ? 'DELIVERED_ASSIGNED'
      : device?.status === 'NOT_STARTED' && (device.deliveredToPatient || device.assignedToPatient)
        ? 'DELIVERED_ASSIGNED'
        : device?.status;

  // Helper to format status badges
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING_CONSENT':
        return <span className="bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold px-2.5 py-1 rounded-full">{l('Pendiente de Consentimiento', 'Pending Consent')}</span>;
      case 'CONSENT_COMPLETED':
        return <span className="bg-blue-50 text-blue-800 border border-blue-200 text-xs font-semibold px-2.5 py-1 rounded-full">{l('Consentimiento Completado', 'Consent Completed')}</span>;
      case 'CONSENT_DECLINED':
        return <span className="bg-red-50 text-red-800 border border-red-200 text-xs font-semibold px-2.5 py-1 rounded-full">{l('Consentimiento Rechazado', 'Consent Declined')}</span>;
      case 'DEVICE_PENDING':
        return <span className="bg-purple-50 text-purple-800 border border-purple-200 text-xs font-semibold px-2.5 py-1 rounded-full">{l('Dispositivo Pendiente', 'Device Pending')}</span>;
      case 'DEVICE_DELIVERED':
        return <span className="bg-teal-50 text-teal-800 border border-teal-200 text-xs font-semibold px-2.5 py-1 rounded-full">{l('Dispositivo Entregado', 'Device Delivered')}</span>;
      case 'DEVICE_ACTIVATED':
        return <span className="bg-blue-50 text-blue-800 border border-blue-200 text-xs font-semibold px-2.5 py-1 rounded-full">{l('Dispositivo Activado', 'Device Activated')}</span>;
      case 'FIRST_BP_RECORDED':
        return <span className="bg-orange-50 text-orange-800 border border-orange-200 text-xs font-semibold px-2.5 py-1 rounded-full">{l('Lectura de BP Registrada', 'BP Reading Recorded')}</span>;
      case 'ACTIVE':
        return <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center"><CheckCircle size={12} className="mr-1 text-emerald-600" /> {l('Paciente Activo', 'Active Patient')}</span>;
      case 'INCOMPLETE':
        return <span className="bg-yellow-50 text-yellow-800 border border-yellow-200 text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center"><AlertTriangle size={12} className="mr-1 text-yellow-600" /> {l('Visita Incompleta', 'Incomplete Visit')}</span>;
      case 'NEEDS_FOLLOW_UP':
        return <span className="bg-rose-50 text-rose-800 border border-rose-200 text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center"><AlertTriangle size={12} className="mr-1 text-rose-600" /> {l('Requiere Seguimiento', 'Needs Follow-up')}</span>;
      default:
        return <span className="bg-slate-50 text-slate-800 text-xs font-semibold px-2.5 py-1 rounded-full">{status}</span>;
    }
  };

  const renderMedicalOrderBadge = () => {
    switch (medicalOrderStatus) {
      case 'ORDER_APPROVED':
        return <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700">{l('Orden aprobada', 'Order Approved')}</span>;
      case 'ORDER_REJECTED_NEEDS_REVISION':
        return <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-extrabold text-rose-700">{l('Needs Revision', 'Needs Revision')}</span>;
      case 'ORDER_PENDING_PHYSICIAN_APPROVAL':
        return <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-extrabold text-amber-700">{l('Orden médica pendiente', 'Medical Order Pending')}</span>;
      case 'ORDER_REQUIRED':
        return <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-extrabold text-orange-700">{l('Order Required', 'Order Required')}</span>;
      default:
        return <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-extrabold text-slate-600">{l('No aplica', 'Not Applicable')}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id={`patient-profile-${patient.id}`}>
      {/* Top action bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={onBack}
            className="inline-flex items-center text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 px-4 py-2 rounded-xl hover:bg-slate-50 transition cursor-pointer"
            id="btn-back-to-dashboard"
          >
            <ArrowLeft size={14} className="mr-1.5" /> {l('Volver al Panel', 'Back to Dashboard')}
          </button>
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl hover:bg-blue-100 transition cursor-pointer shadow-sm"
            id="btn-edit-patient-profile"
          >
            <Edit3 size={14} className="mr-1.5 text-blue-500" /> {l('Editar Paciente', 'Edit Patient')}
          </button>
        </div>

        {/* Start/Resume Visit button only for Nurses & Non-Active patients */}
        {isEnrollmentOperationsRole(currentUser.role) && patient.status !== 'ACTIVE' && (
          <div className="flex space-x-2">
            {isResumable && onContinueVisit ? (
              <button
                onClick={() => onContinueVisit(patient.id)}
                className="inline-flex items-center justify-center px-4.5 py-2.5 text-xs font-extrabold text-white bg-yellow-600 hover:bg-yellow-700 rounded-xl shadow-lg shadow-yellow-600/20 transition cursor-pointer"
                id="btn-profile-continue-visit"
              >
                <RefreshCw size={12} className="mr-1.5 animate-spin-slow" /> {l('Continuar Visita', 'Continue Visit')}
              </button>
            ) : onStartVisit ? (
              <button
                onClick={() => onStartVisit(patient.id)}
                className="inline-flex items-center justify-center px-4.5 py-2.5 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/20 transition cursor-pointer"
                id="btn-profile-start-visit"
              >
                <Play size={12} className="mr-1.5 fill-current" /> {l('Iniciar Visita', 'Start Visit')}
              </button>
            ) : null}
          </div>
        )}
      </div>

      {/* Main Profile Header details */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-3 flex-wrap gap-y-1">
              <h2 className="text-2xl font-black text-slate-800 leading-tight">{patient.firstName} {patient.lastName}</h2>
              {getStatusBadge(patient.status)}
            </div>
            <div className="flex flex-wrap items-center text-xs text-slate-500 font-bold gap-x-4 gap-y-1">
              <span className="flex items-center"><Calendar size={13} className="mr-1 text-slate-400" /> {l('Nacimiento', 'Date of Birth')}: {patient.birthDate}</span>
              <span className="flex items-center"><MapPin size={13} className="mr-1 text-slate-400" /> {patient.nursingHome} • {l('Habitación', 'Room')} {patient.room || 'N/A'}</span>
              <span className="text-slate-400">• Medicare ID: {patient.medicareId || l('No provisto', 'Not provided')}</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs space-y-1 w-full md:w-auto">
            <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">{l('Asignación Clínica', 'Clinical Assignment')}</p>
            <p className="font-bold text-slate-800">{l('Programa', 'Program')}: <span className="text-blue-600">{patient.assignedProgram}</span></p>
            <p className="font-semibold text-slate-600">{l('Enfermera', 'Nurse')}: {patient.assignedNurseName}</p>
          </div>
        </div>
      </div>

      {/* Bento-grid of Clinical Profile & Devices status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Box 1: Clinical profile */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center">
            <List size={14} className="mr-1.5 text-slate-500" /> {l('Perfil Clínico', 'Clinical Profile')}
          </h3>

          <div className="space-y-3 text-xs">
            {/* Conditions */}
            <div>
              <h4 className="font-bold text-slate-700">{l('Diagnósticos Principales', 'Primary Diagnoses')}</h4>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {patient.conditions.map((cond, i) => (
                  <span key={i} className="bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded-xl font-bold border border-slate-200">
                    {cond}
                  </span>
                ))}
              </div>
            </div>

            {/* Medications */}
            <div>
              <h4 className="font-bold text-slate-700">{l('Medicamentos Activos', 'Active Medications')}</h4>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-600 font-bold">
                {patient.medications.map((med, i) => {
                  const label = typeof med === 'string' ? med : `${med.medication_name} ${med.strength} — ${med.frequency}`;
                  return <li key={i}>{label}</li>;
                })}
              </ul>
            </div>

            {/* Medical provider details */}
            <div className="pt-2 border-t border-slate-100 space-y-1">
              <p className="text-slate-500 font-semibold">{l('Práctica', 'Practice')}: <span className="font-bold text-slate-600">{patient.practice}</span></p>
            </div>
          </div>
        </div>

        {/* Box 2: Devices & Verification Checklist */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center">
            <Smartphone size={14} className="mr-1.5 text-slate-500" /> {l('Equipamiento y Activación', 'Equipment and Activation')}
          </h3>

          <div className="text-xs space-y-3">
            <div>
              <p className="text-slate-500 font-bold">{l('Equipo Requerido', 'Required Device')}: <span className="font-bold text-slate-800">{patient.requiredDevice}</span></p>
            </div>

            {patientRequiresDevice(patient) && (
              <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black text-slate-800">{l('Orden médica de dispositivo', 'Device Medical Order')}</p>
                  {renderMedicalOrderBadge()}
                </div>
                <div className="space-y-0.5 text-[10px] font-bold text-slate-600">
                  <p>{l('Médico asignado', 'Assigned Physician')}: {patient.medicalOrder?.assignedPhysician || patient.provider}</p>
                  <p>{l('Versión', 'Version')}: {patient.medicalOrder?.orderVersion || 'order_v2026_07_01'}</p>
                  {patient.medicalOrder?.submittedAt && <p>{l('Enviada', 'Submitted')}: {new Date(patient.medicalOrder.submittedAt).toLocaleString()}</p>}
                  {patient.medicalOrder?.approvedAt && <p>{l('Aprobada', 'Approved')}: {new Date(patient.medicalOrder.approvedAt).toLocaleString()}</p>}
                  {patient.medicalOrder?.rejectedAt && <p>{l('Rechazada', 'Rejected')}: {new Date(patient.medicalOrder.rejectedAt).toLocaleString()}</p>}
                  {patient.medicalOrder?.revisionNotes && <p>{l('Nota', 'Note')}: {patient.medicalOrder.revisionNotes}</p>}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {(medicalOrderStatus === 'ORDER_REQUIRED' || medicalOrderStatus === 'ORDER_REJECTED_NEEDS_REVISION') && (
                    <button
                      type="button"
                      onClick={() => onGenerateMedicalOrder(patient.id)}
                      className="rounded-xl border border-orange-200 bg-white px-3 py-1.5 text-[11px] font-extrabold text-orange-700 hover:bg-orange-100"
                    >
                      {medicalOrderStatus === 'ORDER_REJECTED_NEEDS_REVISION' ? l('Corregir / re-enviar', 'Revise / Resend') : l('Generar orden medica', 'Generate Medical Order')}
                    </button>
                  )}
                  {(currentUser.role === 'ADMIN' || currentUser.role === 'PHYSICIAN') && medicalOrderStatus === 'ORDER_PENDING_PHYSICIAN_APPROVAL' && (
                    <button
                      type="button"
                      onClick={() => onOpenMedicalOrderReview?.(patient)}
                      className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-extrabold text-violet-700 hover:bg-violet-100 flex items-center space-x-1"
                    >
                      <ShieldAlert size={12} />
                      <span>{l('Revisar Orden', 'Review Order')}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {device ? (
              <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                <p className="font-bold text-slate-800 text-xs">{l('Dispositivo Entregado', 'Delivered Device')}:</p>
                <p className="text-slate-600 font-bold">{device.deviceType} - {device.model}</p>
                <p className="text-[10px] text-slate-400 font-mono">Device ID: {device.serialNumber || device.deviceId || 'N/A'}</p>
                
                <div className="pt-1.5 flex justify-between items-center text-[10px] font-semibold">
                  <span className="text-slate-500">{l('Estado de Envío', 'Delivery Status')}:</span>
                  <span className={`font-bold uppercase ${
                    visibleDeviceStatus === 'ACTIVE' ? 'text-emerald-600' : visibleDeviceStatus === 'NEEDS_SUPPORT' ? 'text-rose-600' : 'text-amber-600'
                  }`}>{(visibleDeviceStatus || device.status).replace(/_/g, ' ')}</span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-slate-400 italic">
                {patient.requiredDevice === 'None' ? l('No requiere monitoreo remoto de dispositivo', 'No remote monitoring device required') : l('Dispositivo no entregado aún', 'Device not delivered yet')}
              </div>
            )}

            {/* Consent Details block */}
            <div className="pt-3 border-t border-slate-100 space-y-1.5">
              <h4 className="font-bold text-slate-700">{l('Consentimiento Médico', 'Medical Consent')}</h4>
              {consent ? (
                <div className="space-y-1 text-slate-600 font-bold">
                  <p className="flex items-center text-emerald-600 font-bold"><CheckCircle size={12} className="mr-1" /> {l('Autorizado el', 'Authorized on')} {new Date(consent.dateTime).toLocaleDateString()}</p>
                  <p className="text-[10px] text-slate-400">{l('Firmado por', 'Signed by')}: {consent.signerName} ({consent.signedBy})</p>
                </div>
              ) : (
                <p className="text-amber-600 font-bold flex items-center"><AlertTriangle size={12} className="mr-1" /> {l('Consentimiento Pendiente de Firma', 'Consent Awaiting Signature')}</p>
              )}
            </div>
          </div>
        </div>

        {/* Box 3: Device Reading History */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center">
            <Activity size={14} className="mr-1.5 text-slate-500" /> {l('Lecturas Iniciales', 'Initial Readings')}
          </h3>

          {uniqueReadings.length === 0 ? (
            <div className="text-center py-6 text-slate-400 border border-dashed border-slate-200 rounded-xl text-xs italic">
              {l('Ninguna lectura registrada', 'No readings recorded')}
            </div>
          ) : (
            <div className="space-y-3">
              {uniqueReadings.map((reading) => {
                const isWeightReading = reading.readingType === 'WEIGHT';
                
                return (
                  <div key={reading.id} className="p-3 border rounded-xl bg-slate-50/50">
                    {isWeightReading ? (
                      <div className="flex justify-between items-center">
                        <span className="text-2xl font-black text-slate-800">{reading.weightLbs} <span className="text-xs font-bold text-slate-500">lb</span></span>
                        <span className="text-xs font-bold text-slate-700">{l('Peso', 'Weight')}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center">
                        <span className="text-2xl font-black text-slate-800">{reading.systolic}/{reading.diastolic} <span className="text-xs font-bold text-slate-500">mmHg</span></span>
                        <span className="text-xs font-bold text-slate-700">{reading.pulse} <span className="text-[9px] text-slate-400 uppercase font-mono">BPM</span></span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Contractual and Auditing Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Documents repository */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center">
            <FileText size={14} className="mr-1.5 text-slate-500" /> {l('Documentación Firmada', 'Signed Documents')}
          </h3>

          {documents.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs italic">
              {l('No se han generado documentos de consentimiento o entrega para este paciente.', 'No consent or delivery documents have been generated for this patient.')}
            </div>
          ) : (
            <div className="space-y-2.5">
              {documents.map((doc) => (
                <div key={doc.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between" id={`doc-item-${doc.id}`}>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{doc.title}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">ID: {doc.id} • {new Date(doc.dateTime).toLocaleString()}</p>
                    <p className="text-[9px] text-slate-500 font-bold">{l('Por', 'By')}: {doc.generatedBy}</p>
                  </div>
                  <button
                    onClick={() => onDownloadPDF(doc)}
                    className="p-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 inline-flex items-center font-bold cursor-pointer"
                    id={`btn-download-doc-${doc.id}`}
                  >
                    <Download size={13} className="mr-1 text-blue-600" /> {l('Descargar', 'Download')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audit trail trail */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center">
            <History size={14} className="mr-1.5 text-slate-500" /> {l('Historial de Auditoría Local (HIPAA)', 'Local Audit History (HIPAA)')}
          </h3>

          {patientLogs.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs italic">
              {l('No hay registros para este paciente.', 'No logs are recorded for this patient.')}
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-3 pr-1 rounded-xl bg-slate-50/40">
              {patientLogs.map((log) => (
                <article key={log.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-[11px]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <span className="font-extrabold text-slate-900">{log.action}</span>
                    <time className="text-[10px] text-slate-500 font-mono">
                      {new Date(log.dateTime).toLocaleString()}
                    </time>
                  </div>

                  <dl className="grid grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-3 py-3">
                    <div>
                      <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{l('Usuario', 'User')}</dt>
                      <dd className="mt-0.5 font-bold text-slate-700">{log.userName}</dd>
                    </div>
                    <div>
                      <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{l('Rol', 'Role')}</dt>
                      <dd className="mt-0.5">
                        <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-extrabold text-slate-600">
                          {log.userRole}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-400">User ID</dt>
                      <dd className="mt-0.5 font-mono text-[10px] text-slate-600 break-all">{log.userId}</dd>
                    </div>
                    <div>
                      <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Audit ID</dt>
                      <dd className="mt-0.5 font-mono text-[10px] text-slate-600 break-all">{log.id}</dd>
                    </div>
                    <div>
                      <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{l('Entidad', 'Entity')}</dt>
                      <dd className="mt-0.5 font-semibold text-slate-600">{log.entityType}</dd>
                    </div>
                    <div>
                      <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Patient ID</dt>
                      <dd className="mt-0.5 font-mono text-[10px] text-slate-600 break-all">{log.patientId || '-'}</dd>
                    </div>
                  </dl>

                  <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">{l('Contenido', 'Content')}</p>
                    <p className="text-[11px] leading-relaxed font-medium text-slate-700 whitespace-pre-wrap break-words">{log.details}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Patient Overlay Modal */}
      <EditPatientModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={onUpdatePatient}
        patient={patient}
        currentUser={currentUser}
        nursingHomes={nursingHomes}
        conditionGroups={conditionGroups}
        diagnoses={diagnoses}
        programs={programs}
      />
    </div>
  );
}
