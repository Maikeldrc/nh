import { useState, FormEvent, useEffect } from 'react';
import { Patient, User } from '../types';
import { PROGRAMS } from '../data';
import { X, Edit3, Calendar, MapPin, HeartPulse, Save } from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';
import { MEDICAL_ORDER_VERSION } from '../utils/medicalOrders';

interface EditPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedPatient: Patient) => void;
  patient: Patient;
  currentUser: User;
  nursingHomes: string[];
}

export default function EditPatientModal({
  isOpen,
  onClose,
  onSave,
  patient,
  currentUser,
  nursingHomes
}: EditPatientModalProps) {
  const { language } = useLanguage();
  
  // Form states pre-populated with the current patient details
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [medicareId, setMedicareId] = useState('');
  const [nursingHome, setNursingHome] = useState('');
  const [room, setRoom] = useState('');
  const [assignedProgram, setAssignedProgram] = useState<Patient['assignedProgram']>('RPM');
  const [conditionsInput, setConditionsInput] = useState('');
  const [medicationsInput, setMedicationsInput] = useState('');
  const [requiredDevice, setRequiredDevice] = useState('BP Monitor');
  const [isLtc, setIsLtc] = useState(true); // Pre-fill with true since it's mandatory, but must be checked

  // Set initial state from patient when modal opens or patient changes
  useEffect(() => {
    if (patient) {
      setFirstName(patient.firstName || '');
      setLastName(patient.lastName || '');
      setBirthDate(patient.birthDate || '');
      setMedicareId(patient.medicareId || '');
      setNursingHome(patient.nursingHome || nursingHomes[0] || '');
      setRoom(patient.room || '');
      setAssignedProgram(patient.assignedProgram || 'RPM');
      setRequiredDevice(patient.requiredDevice || 'BP Monitor');
      
      // Filter out the LTC condition from input string if already present (since it's added automatically)
      const nonLtcConditions = (patient.conditions || []).filter(
        c => !c.toLowerCase().includes('long term care') && !c.toLowerCase().includes('ltc')
      );
      setConditionsInput(nonLtcConditions.join(', '));
      
      setMedicationsInput((patient.medications || []).map(m => typeof m === 'string' ? m : `${m.medication_name} ${m.strength} — ${m.frequency}`).join(', '));
      
      // Determine if they are LTC (should be true for all registered patients under the new policy)
      const hasLtc = (patient.conditions || []).some(
        c => c.toLowerCase().includes('long term care') || c.toLowerCase().includes('ltc')
      );
      setIsLtc(hasLtc);
    }
  }, [patient, isOpen, nursingHomes]);

  // Filter programs to exclude RTM
  const eligiblePrograms = PROGRAMS.filter(prog => prog !== 'RTM');

  // Errors state
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!firstName.trim()) {
      newErrors.firstName = language === 'ES' ? 'El nombre es obligatorio' : 'First name is required';
    }
    if (!lastName.trim()) {
      newErrors.lastName = language === 'ES' ? 'El apellido es obligatorio' : 'Last name is required';
    }
    if (!birthDate) {
      newErrors.birthDate = language === 'ES' ? 'La fecha de nacimiento es obligatoria' : 'Date of birth is required';
    } else {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(birthDate)) {
        newErrors.birthDate = language === 'ES' ? 'Formato inválido (AAAA-MM-DD)' : 'Invalid format (YYYY-MM-DD)';
      }
    }
    if (!medicareId.trim()) {
      newErrors.medicareId = language === 'ES' ? 'El Medicare ID es obligatorio' : 'Medicare ID is required';
    }
    if (!nursingHome) {
      newErrors.nursingHome = language === 'ES' ? 'Debe seleccionar un asilo/residencia' : 'Nursing home is required';
    }
    if (!isLtc) {
      newErrors.isLtc = language === 'ES' ? 'El paciente debe ser Long Term Care (LTC) obligatoriamente' : 'The patient must be Long Term Care (LTC)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Parse conditions (making sure Long Term Care (LTC) is at the top)
    const extraConditions = conditionsInput
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0 && !c.toLowerCase().includes('long term care') && !c.toLowerCase().includes('ltc'));
    
    const conditions = ['Long Term Care (LTC)', ...extraConditions];
    
    const medications = medicationsInput
      .split(',')
      .map(m => m.trim())
      .filter(m => m.length > 0);

    const updatedPatient: Patient = {
      ...patient,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthDate,
      medicareId: medicareId.trim(),
      nursingHome,
      room: room.trim() || undefined,
      assignedProgram,
      conditions,
      medications,
      requiredDevice,
      medicalOrder: assignedProgram.includes('RPM') && requiredDevice !== 'None'
        ? patient.medicalOrder || {
            id: `ord_pending_${patient.id}`,
            status: 'ORDER_REQUIRED',
            createdAt: '',
            createdBy: '',
            createdByUserId: '',
            assignedPhysician: patient.provider,
            orderVersion: MEDICAL_ORDER_VERSION,
            auditTrail: []
          }
        : undefined
    };

    onSave(updatedPatient);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto" id="edit-patient-modal-container">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-2xl w-full mx-4 overflow-hidden z-10 my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 text-white flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-white/10 p-2 rounded-lg">
              <Edit3 size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {language === 'ES' ? 'Editar Información del Paciente' : 'Edit Patient Information'}
              </h2>
              <p className="text-xs text-blue-100/80">
                {language === 'ES' ? 'Modifique los datos clínicos y demográficos del paciente' : 'Modify clinical & demographic details'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition shrink-0 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* Section 1: Demographics */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center">
              <Calendar size={13} className="mr-1.5 text-blue-500" />
              {language === 'ES' ? '1. Datos Demográficos' : '1. Demographic Data'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'ES' ? 'Nombre(s) *' : 'First Name *'}
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-semibold ${
                    errors.firstName ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-300'
                  }`}
                  placeholder="e.g. John"
                />
                {errors.firstName && <span className="text-[10px] text-red-500 font-semibold mt-0.5 block">{errors.firstName}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'ES' ? 'Apellido(s) *' : 'Last Name *'}
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-semibold ${
                    errors.lastName ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-300'
                  }`}
                  placeholder="e.g. Doe"
                />
                {errors.lastName && <span className="text-[10px] text-red-500 font-semibold mt-0.5 block">{errors.lastName}</span>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'ES' ? 'Fecha de Nacimiento *' : 'Date of Birth *'}
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-semibold ${
                    errors.birthDate ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-300'
                  }`}
                />
                {errors.birthDate && <span className="text-[10px] text-red-500 font-semibold mt-0.5 block">{errors.birthDate}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Medicare ID *
                </label>
                <input
                  type="text"
                  value={medicareId}
                  onChange={(e) => setMedicareId(e.target.value.toUpperCase())}
                  className={`w-full px-3 py-2 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-semibold ${
                    errors.medicareId ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-300'
                  }`}
                  placeholder="e.g. 1EG4-TE5-WY22"
                />
                {errors.medicareId && <span className="text-[10px] text-red-500 font-semibold mt-0.5 block">{errors.medicareId}</span>}
              </div>
            </div>
          </div>

          {/* Section 2: Facility & Program */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center">
              <MapPin size={13} className="mr-1.5 text-blue-500" />
              {language === 'ES' ? '2. Residencia & Programas' : '2. Facility & Programs'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'ES' ? 'Nursing Home / Residencia *' : 'Nursing Home / Facility *'}
                </label>
                <select
                  value={nursingHome}
                  onChange={(e) => setNursingHome(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-semibold ${
                    errors.nursingHome ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-300'
                  }`}
                >
                  {nursingHomes.map(nh => (
                    <option key={nh} value={nh}>{nh}</option>
                  ))}
                </select>
                {errors.nursingHome && <span className="text-[10px] text-red-500 font-semibold mt-0.5 block">{errors.nursingHome}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'ES' ? 'Habitación' : 'Room'}
                </label>
                <input
                  type="text"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-semibold"
                  placeholder="e.g. 104-B"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'ES' ? 'Programa Asignado' : 'Assigned Program'}
                </label>
                <select
                  value={assignedProgram}
                  onChange={(e) => setAssignedProgram(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-semibold"
                >
                  {eligiblePrograms.map(prog => (
                    <option key={prog} value={prog}>{prog}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end pb-1.5">
                {/* Balance column placeholder */}
              </div>
            </div>

            {/* Mandatory Long Term Care (LTC) Confirmation Checkbox */}
            <div className="p-4 bg-blue-50/50 border border-blue-200/50 rounded-xl space-y-2 mt-2">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isLtc}
                  onChange={(e) => setIsLtc(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <div className="select-none">
                  <span className="text-xs font-extrabold text-slate-800 flex items-center">
                    {language === 'ES' 
                      ? 'Confirmar que el paciente es Long Term Care (LTC) *' 
                      : 'Confirm patient is Long Term Care (LTC) *'}
                    <span className="ml-1 text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-extrabold uppercase">
                      Obligatorio
                    </span>
                  </span>
                  <p className="text-[10px] text-slate-500 font-semibold leading-relaxed mt-0.5">
                    {language === 'ES'
                      ? 'Esta es una condición obligatoria y requerida para proceder con el registro en la plataforma.'
                      : 'This is a mandatory condition required to proceed with platform registration.'}
                  </p>
                </div>
              </label>
              {errors.isLtc && (
                <span className="text-[10px] text-red-500 font-semibold block pl-7">
                  {errors.isLtc}
                </span>
              )}
            </div>
          </div>

          {/* Section 3: Clinical Background */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center">
              <HeartPulse size={13} className="mr-1.5 text-blue-500" />
              {language === 'ES' ? '3. Antecedentes Clínicos' : '3. Clinical Profile'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'ES' ? 'Dispositivo Requerido' : 'Required Device'}
                </label>
                <select
                  value={requiredDevice}
                  onChange={(e) => setRequiredDevice(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-semibold"
                >
                  <option value="BP Monitor">BPM</option>
                  <option value="Scale">SCALE</option>
                </select>
              </div>

              <div />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ES' ? 'Diagnósticos / Condiciones (separados por comas)' : 'Medical Conditions (comma separated)'}
              </label>
              <input
                type="text"
                value={conditionsInput}
                onChange={(e) => setConditionsInput(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-semibold"
                placeholder="e.g. Hypertension, COPD, Osteoarthritis"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ES' ? 'Medicamentos Actuales (separados por comas)' : 'Current Medications (comma separated)'}
              </label>
              <input
                type="text"
                value={medicationsInput}
                onChange={(e) => setMedicationsInput(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-semibold"
                placeholder="e.g. Lisinopril 10mg daily, Metformin 500mg BID"
              />
            </div>
          </div>

          {/* Footer Controls */}
          <div className="pt-4 border-t border-slate-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 cursor-pointer transition shrink-0"
            >
              {language === 'ES' ? 'Cancelar' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 cursor-pointer transition flex items-center shrink-0"
            >
              <Save size={14} className="mr-1.5" />
              {language === 'ES' ? 'Guardar Cambios' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
