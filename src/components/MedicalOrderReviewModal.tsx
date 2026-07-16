import { useState } from 'react';
import { Patient, User } from '../types';
import { X, CheckCircle, AlertTriangle, ClipboardList, User as UserIcon, Activity, Pill, Stethoscope, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';
import { getMedicalOrderStatus } from '../utils/medicalOrders';

interface MedicalOrderReviewModalProps {
  isOpen: boolean;
  patient: Patient;
  currentUser: User;
  onClose: () => void;
  onApprove: (patientId: string, notes?: string) => void;
  onReject: (patientId: string, notes: string) => void;
}

export default function MedicalOrderReviewModal({
  isOpen,
  patient,
  currentUser,
  onClose,
  onApprove,
  onReject
}: MedicalOrderReviewModalProps) {
  const { language } = useLanguage();
  const l = (es: string, en: string) => language === 'ES' ? es : en;

  const [rejecting, setRejecting] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [showAudit, setShowAudit] = useState(false);
  
  // Pre-load default text for RPM medical order notes
  const orderedDeviceType = patient.medicalOrder?.deviceType || patient.requiredDevice;
  const defaultNotesText = orderedDeviceType && orderedDeviceType !== 'None'
    ? `Remote patient monitoring is medically necessary for managing the patient's conditions. Monitor vitals daily using the provided ${orderedDeviceType}.`
    : `Remote patient monitoring is medically necessary. Monitor vitals daily.`;
  const [approvalNotes, setApprovalNotes] = useState(defaultNotesText);

  if (!isOpen) return null;

  const order = patient.medicalOrder;
  const orderStatus = getMedicalOrderStatus(patient);
  const canReview = orderStatus === 'ORDER_PENDING_PHYSICIAN_APPROVAL';
  const isAlreadyApproved = orderStatus === 'ORDER_APPROVED';
  const longTermCareLabel = 'Long Term Care (LTC)';
  const isLongTermCare = patient.conditions.some(condition => condition.trim().toLowerCase() === longTermCareLabel.toLowerCase());
  const clinicalConditions = patient.conditions.filter(condition => condition.trim().toLowerCase() !== longTermCareLabel.toLowerCase());

  const handleApprove = () => {
    onApprove(patient.id, approvalNotes.trim());
    onClose();
  };

  const handleReject = () => {
    if (!rejectionNotes.trim()) return;
    onReject(patient.id, rejectionNotes.trim());
    onClose();
  };

  const statusBadge = () => {
    switch (orderStatus) {
      case 'ORDER_PENDING_PHYSICIAN_APPROVAL':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle size={12} className="mr-1" />
            {l('Pendiente de Aprobacion', 'Pending Approval')}
          </span>
        );
      case 'ORDER_APPROVED':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle size={12} className="mr-1" />
            {l('Aprobada', 'Approved')}
          </span>
        );
      case 'ORDER_REJECTED_NEEDS_REVISION':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
            <AlertTriangle size={12} className="mr-1" />
            {l('Requiere Revision', 'Needs Revision')}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto" id="medical-order-review-modal">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-2xl w-full mx-4 overflow-hidden z-10 my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-700 via-indigo-700 to-blue-700 px-6 py-5 text-white">
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-3">
              <div className="bg-white/15 p-2.5 rounded-xl">
                <Stethoscope size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-base font-extrabold tracking-tight">
                  {l('Revision de Orden Medica', 'Medical Order Review')}
                </h2>
                <p className="text-xs text-violet-200 mt-0.5">
                  {l('Aprobacion de medico requerida para activar RPM', 'Physician approval required to activate RPM')}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white hover:bg-white/15 p-1.5 rounded-lg transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Status row */}
          <div className="mt-4 flex items-center space-x-3">
            {statusBadge()}
            {order && (
              <span className="text-xs text-violet-200 font-mono">
                {order.id}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Patient Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-3">
              <UserIcon size={14} className="text-indigo-500" />
              <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                {l('Datos del Paciente', 'Patient Information')}
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div>
                <span className="text-slate-500 font-semibold">{l('Nombre:', 'Name:')}</span>
                <span className="ml-1 font-extrabold text-slate-900">{patient.firstName} {patient.lastName}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">Medicare ID:</span>
                <span className="ml-1 font-extrabold text-slate-900 font-mono">{patient.medicareId || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">{l('F. Nacimiento:', 'DOB:')}</span>
                <span className="ml-1 text-slate-800 font-semibold">{patient.birthDate}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">{l('Residencia:', 'Facility:')}</span>
                <span className="ml-1 text-slate-800 font-semibold">{patient.nursingHome}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">{l('Programa:', 'Program:')}</span>
                <span className="ml-1 font-extrabold text-indigo-700">{patient.assignedProgram}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">{l('Dispositivo:', 'Device:')}</span>
                <span className="ml-1 font-extrabold text-violet-700">{orderedDeviceType}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">{l('Medico asignado:', 'Assigned Physician:')}</span>
                <span className="ml-1 text-slate-800 font-semibold">{patient.provider}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">{l('Habitacion:', 'Room:')}</span>
                <span className="ml-1 text-slate-800 font-semibold">{patient.room || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Long Term Care */}
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <CheckCircle size={14} className="text-emerald-500" />
              <h3 className="text-xs font-extrabold text-emerald-600 uppercase tracking-wider">
                {l('Long Term Care', 'Long Term Care')}
              </h3>
            </div>
            <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${
              isLongTermCare
                ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                : 'border-amber-200 bg-amber-100 text-amber-800'
            }`}>
              {isLongTermCare
                ? l('Paciente confirmado como Long Term Care (LTC)', 'Patient confirmed as Long Term Care (LTC)')
                : l('No confirmado como Long Term Care (LTC)', 'Not confirmed as Long Term Care (LTC)')}
            </span>
          </div>

          {/* Conditions */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Activity size={14} className="text-blue-500" />
              <h3 className="text-xs font-extrabold text-blue-600 uppercase tracking-wider">
                {l('Diagnosticos / Condiciones', 'Diagnoses / Conditions')}
              </h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {clinicalConditions.length > 0
                ? clinicalConditions.map((c, i) => (
                  <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full border border-blue-200">
                    {c}
                  </span>
                ))
                : <span className="text-xs text-slate-400 italic">{l('Sin condiciones registradas', 'No conditions recorded')}</span>
              }
            </div>
          </div>

          {/* Medications */}
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Pill size={14} className="text-violet-500" />
              <h3 className="text-xs font-extrabold text-violet-600 uppercase tracking-wider">
                {l('Medicamentos Actuales', 'Current Medications')}
              </h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {patient.medications.length > 0
                ? patient.medications.map((m, i) => {
                    const label = typeof m === 'string' ? m : `${m.medication_name} ${m.strength} — ${m.frequency}`;
                    return (
                      <span key={i} className="px-2 py-0.5 bg-violet-100 text-violet-800 text-xs font-semibold rounded-full border border-violet-200">
                        {label}
                      </span>
                    );
                  })
                : <span className="text-xs text-slate-400 italic">{l('Sin medicamentos registrados', 'No medications recorded')}</span>
              }
            </div>
          </div>

          {/* Order Details */}
          {order && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-3">
                <ClipboardList size={14} className="text-slate-500" />
                <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                  {l('Detalles de la Orden', 'Order Details')}
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div>
                  <span className="text-slate-500 font-semibold">{l('Version:', 'Version:')}</span>
                  <span className="ml-1 font-mono text-slate-800 font-semibold">{order.orderVersion}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">{l('Creada:', 'Created:')}</span>
                  <span className="ml-1 text-slate-800 font-semibold">
                    {order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">{l('Creada por:', 'Created by:')}</span>
                  <span className="ml-1 text-slate-800 font-semibold">{order.createdBy || 'Sistema'}</span>
                </div>
                {order.approvedAt && (
                  <div>
                    <span className="text-slate-500 font-semibold">{l('Aprobada:', 'Approved:')}</span>
                    <span className="ml-1 text-emerald-700 font-bold">{new Date(order.approvedAt).toLocaleString()}</span>
                  </div>
                )}
                {order.reviewedBy && (
                  <div>
                    <span className="text-slate-500 font-semibold">{l('Revisada por:', 'Reviewed by:')}</span>
                    <span className="ml-1 text-slate-800 font-semibold">{order.reviewedBy}</span>
                  </div>
                )}
              </div>

              {/* Audit Trail toggle */}
              {order.auditTrail.length > 0 && (
                <div className="mt-3">
                  <button
                    onClick={() => setShowAudit(v => !v)}
                    className="flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-700 font-semibold transition cursor-pointer"
                  >
                    <FileText size={12} />
                    <span>{l('Registro de Auditoria', 'Audit Trail')} ({order.auditTrail.length})</span>
                    {showAudit ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {showAudit && (
                    <div className="mt-2 space-y-1.5">
                      {order.auditTrail.map((entry, i) => (
                        <div key={i} className="bg-white border border-slate-100 rounded-lg p-2.5 text-xs">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-extrabold text-slate-700 uppercase tracking-wide text-[10px]">{entry.action}</span>
                            <span className="text-slate-400 font-mono text-[10px]">{new Date(entry.dateTime).toLocaleString()}</span>
                          </div>
                          <span className="text-slate-500">{entry.userName}</span>
                          {entry.notes && <p className="text-slate-600 mt-0.5 italic">{entry.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Already approved message */}
          {isAlreadyApproved && (
            <div className="flex items-center space-x-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle size={20} className="text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-extrabold text-emerald-800">{l('Orden ya aprobada', 'Order already approved')}</p>
                <p className="text-xs text-emerald-600">{l('Esta orden ya fue aprobada y el PDF fue generado.', 'This order was already approved and the PDF was generated.')}</p>
              </div>
            </div>
          )}

          {/* Rejection notes input */}
          {rejecting && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle size={14} className="text-red-500" />
                <h3 className="text-xs font-extrabold text-red-700 uppercase tracking-wider">
                  {l('Motivo de Revision Requerida', 'Reason for Revision Required')}
                </h3>
              </div>
              <textarea
                value={rejectionNotes}
                onChange={e => setRejectionNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-red-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-400 text-slate-800 font-semibold resize-none"
                placeholder={l('Describir el motivo o correcciones necesarias...', 'Describe the reason or corrections needed...')}
                autoFocus
              />
              <div className="flex space-x-2 justify-end">
                <button
                  onClick={() => { setRejecting(false); setRejectionNotes(''); }}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg bg-white cursor-pointer transition"
                >
                  {l('Cancelar', 'Cancel')}
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectionNotes.trim()}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg cursor-pointer transition"
                >
                  {l('Confirmar Revision', 'Confirm Revision')}
                </button>
              </div>
            </div>
          )}

          {/* Approval notes input (Visible when review is active and not rejecting) */}
          {canReview && !rejecting && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center space-x-2">
                <ClipboardList size={14} className="text-indigo-500" />
                <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  {l('Notas de la Orden Medica / Indicacion', 'Medical Order Notes / Prescription')}
                </h3>
              </div>
              <textarea
                value={approvalNotes}
                onChange={e => setApprovalNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-semibold"
                placeholder={l('Escribir las notas de la orden medica...', 'Enter clinical order notes...')}
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {canReview && !rejecting && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex flex-col items-stretch gap-3">
            <p className="text-xs text-slate-400 font-semibold">
              {l('Revisando como', 'Reviewing as')}: <span className="text-slate-600 font-bold">{currentUser.name}</span>
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setRejecting(true)}
                className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-red-700 border border-red-200 bg-red-50 hover:bg-red-100 rounded-xl transition cursor-pointer"
              >
                <AlertTriangle size={13} />
                <span>{l('Requiere Revision', 'Needs Revision')}</span>
              </button>
              <button
                onClick={handleApprove}
                className="flex items-center space-x-1.5 px-5 py-2 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-lg shadow-emerald-600/20 transition cursor-pointer"
              >
                <CheckCircle size={14} />
                <span>{l('Aprobar Orden', 'Approve Order')}</span>
              </button>
            </div>
          </div>
        )}

        {!canReview && !rejecting && (
          <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold text-slate-700 border border-slate-300 bg-white hover:bg-slate-50 rounded-xl transition cursor-pointer"
            >
              {l('Cerrar', 'Close')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
