import { useState, FormEvent, useEffect } from 'react';
import { ConditionGroupCatalog, DiagnosisCatalog, Medication, Patient, PatientDiagnosis, User } from '../types';
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
  conditionGroups: ConditionGroupCatalog[];
  diagnoses: DiagnosisCatalog[];
}

export default function EditPatientModal({
  isOpen,
  onClose,
  onSave,
  patient,
  currentUser,
  nursingHomes,
  conditionGroups,
  diagnoses
}: EditPatientModalProps) {
  const { language } = useLanguage();
  const l = (es: string, en: string) => language === 'ES' ? es : en;
  type ConditionGroupOption = {
    code: string;
    display: string;
    diagnoses: { name: string; code: string }[];
  };
  type ManualDiagnosis = {
    id: string;
    icd10Code: string;
    icd10Display: string;
  };
  const createManualDiagnosis = (): ManualDiagnosis => ({
    id: `manual_diag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    icd10Code: '',
    icd10Display: ''
  });
  const conditionGroupOptions: ConditionGroupOption[] = conditionGroups
    .filter(group => group.is_active)
    .map(group => ({
      code: group.code,
      display: group.display,
      diagnoses: diagnoses
        .filter(diagnosis => diagnosis.is_active && diagnosis.condition_group_id === group.id)
        .map(diagnosis => ({ name: diagnosis.icd10_display, code: diagnosis.icd10_code }))
    }));
  const formatDiagnosis = (diagnosis: { name: string; code: string }) => `${diagnosis.name} · ${diagnosis.code}`;
  const selectedDiagnosisCodes = (selectedConditions: string[]) => new Set(
    conditionGroupOptions.flatMap(group => group.diagnoses)
      .filter(diagnosis => selectedConditions.includes(formatDiagnosis(diagnosis)))
      .map(diagnosis => diagnosis.code.trim().toUpperCase())
  );
  
  // Form states pre-populated with the current patient details
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [medicareId, setMedicareId] = useState('');
  const [nursingHome, setNursingHome] = useState('');
  const [room, setRoom] = useState('');
  const [assignedProgram, setAssignedProgram] = useState<Patient['assignedProgram']>('RPM');
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedCategoryCodes, setSelectedCategoryCodes] = useState<string[]>([]);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [diagnosisSearch, setDiagnosisSearch] = useState('');
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [manualDiagnoses, setManualDiagnoses] = useState<ManualDiagnosis[]>([createManualDiagnosis()]);
  const [isDiagnosisDropdownOpen, setIsDiagnosisDropdownOpen] = useState(false);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [isMedicationListPending, setIsMedicationListPending] = useState(false);
  const [isAddingMed, setIsAddingMed] = useState(false);
  const [medSearch, setMedSearch] = useState('');
  const [isMedDropdownOpen, setIsMedDropdownOpen] = useState(false);
  const [medStrength, setMedStrength] = useState('');
  const [medFrequency, setMedFrequency] = useState('Daily');
  const [requiredDevice, setRequiredDevice] = useState('');
  const [isLtc, setIsLtc] = useState(true); // Pre-fill with true since it's mandatory, but must be checked
  const COMMON_MEDICATIONS = [
    'Lisinopril', 'Metformin', 'Atorvastatin', 'Amlodipine', 'Furosemide',
    'Omeprazole', 'Losartan', 'Gabapentin', 'Levothyroxine', 'Sertraline',
    'Pantoprazole', 'Hydrochlorothiazide', 'Carvedilol', 'Metoprolol', 'Simvastatin'
  ];
  const toEditableMedication = (medication: string | Medication): Medication => {
    if (typeof medication !== 'string') return medication;
    return {
      medication_name: medication,
      normalized_medication_name: medication.toLowerCase(),
      strength: '',
      frequency: '',
      source: 'Existing Record',
      selected_by: patient.assignedNurseName || currentUser.name,
      selected_at: new Date().toISOString()
    };
  };
  const ICD10_CODE_PATTERN = /^[A-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/;
  const CCM_CONDITIONS_ERROR = 'CCM requires at least 2 chronic conditions with valid ICD-10 codes.';
  const assignedProgramIncludesCcm = assignedProgram
    .split('+')
    .some(programPart => programPart.trim().toUpperCase() === 'CCM');
  const completedManualDiagnoses = manualDiagnoses
    .map(diagnosis => ({
      ...diagnosis,
      icd10Code: diagnosis.icd10Code.trim().toUpperCase(),
      icd10Display: diagnosis.icd10Display.trim()
    }))
    .filter(diagnosis => diagnosis.icd10Code && diagnosis.icd10Display);
  const hasPartialManualDiagnosis = manualDiagnoses.some(diagnosis =>
    Boolean(diagnosis.icd10Code.trim()) !== Boolean(diagnosis.icd10Display.trim())
  );
  const meetsCcmConditionsRequirement = !assignedProgramIncludesCcm
    || Array.from(new Set<string>(completedManualDiagnoses.map(diagnosis => diagnosis.icd10Code))).filter(code => ICD10_CODE_PATTERN.test(code)).length >= 2;
  const findCatalogDiagnosisName = (icd10Code: string) => {
    const normalizedCode = icd10Code.trim().toUpperCase();
    const compactCode = normalizedCode.replace('.', '');
    if (!normalizedCode) return '';
    const match = diagnoses.find(diagnosis => {
      const catalogCode = diagnosis.icd10_code.trim().toUpperCase();
      return diagnosis.is_active && (catalogCode === normalizedCode || catalogCode.replace('.', '') === compactCode);
    });
    return match?.icd10_display || match?.icd10_description || '';
  };
  const updateManualDiagnosisCode = (index: number, value: string) => {
    const icd10Code = value.toUpperCase();
    const catalogName = findCatalogDiagnosisName(icd10Code);
    setManualDiagnoses(previous => previous.map((diagnosis, diagnosisIndex) =>
      diagnosisIndex === index
        ? { ...diagnosis, icd10Code, icd10Display: catalogName || diagnosis.icd10Display }
        : diagnosis
    ));
  };

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
      setRequiredDevice(patient.requiredDevice || '');
      
      const savedDiagnosisLabels = (patient.diagnoses || []).map(diagnosis => `${diagnosis.icd10Display} · ${diagnosis.icd10Code}`);
      const savedReviewFlag = (patient.conditions || []).includes('Clinical Review Required') ? ['Clinical Review Required'] : [];
      const matchedConditionLabels = (patient.conditions || [])
        .filter(condition => condition !== 'Clinical Review Required')
        .filter(condition => !condition.toLowerCase().includes('long term care') && !condition.toLowerCase().includes('ltc'))
        .map(condition => {
          const match = conditionGroupOptions
            .flatMap(group => group.diagnoses)
            .find(diagnosis => formatDiagnosis(diagnosis) === condition || diagnosis.name === condition || diagnosis.code === condition);
          return match ? formatDiagnosis(match) : '';
        })
        .filter(Boolean);
      const selectedDiagnosisLabels = Array.from(new Set([...savedDiagnosisLabels, ...matchedConditionLabels, ...savedReviewFlag]));
      setSelectedConditions(selectedDiagnosisLabels);
      const manualRows = (patient.diagnoses || []).map(diagnosis => ({
        id: `manual_diag_${diagnosis.icd10Code}_${Math.random().toString(36).slice(2, 8)}`,
        icd10Code: diagnosis.icd10Code,
        icd10Display: diagnosis.icd10Display
      }));
      setManualDiagnoses(manualRows.length > 0 ? manualRows : [createManualDiagnosis()]);
      const selectedCodes = conditionGroupOptions
        .filter(group => group.diagnoses.some(diagnosis => selectedDiagnosisLabels.includes(formatDiagnosis(diagnosis))))
        .map(group => group.code);
      const savedGroupCodes = (patient.diagnoses || []).map(diagnosis => diagnosis.conditionGroupCode);
      setSelectedCategoryCodes(Array.from(new Set([...selectedCodes, ...savedGroupCodes])));
      setCategorySearch('');
      setDiagnosisSearch('');
      
      setMedications((patient.medications || []).map(toEditableMedication));
      setIsMedicationListPending(Boolean(patient.medicationsPendingReview));
      setIsAddingMed(false);
      setMedSearch('');
      setMedStrength('');
      setMedFrequency('Daily');
      
      // Determine if they are LTC (should be true for all registered patients under the new policy)
      const hasLtc = (patient.conditions || []).some(
        c => c.toLowerCase().includes('long term care') || c.toLowerCase().includes('ltc')
      );
      setIsLtc(hasLtc);
    }
  }, [patient, isOpen, nursingHomes, conditionGroups, diagnoses]);

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
    if (assignedProgram.includes('RPM') && !requiredDevice) {
      newErrors.requiredDevice = l('Seleccione el dispositivo requerido.', 'Select the required device.');
    }
    if (completedManualDiagnoses.length === 0) {
      newErrors.conditions = l('Agregue al menos un ICD y el nombre del diagnóstico.', 'Add at least one ICD and diagnosis name.');
    } else if (hasPartialManualDiagnosis) {
      newErrors.conditions = l('Cada fila debe tener ICD y nombre del ICD, o estar completamente vacía.', 'Each row must include both ICD and ICD name, or be completely empty.');
    }
    if (!meetsCcmConditionsRequirement) {
      newErrors.conditions = CCM_CONDITIONS_ERROR;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const conditions = [
      'Long Term Care (LTC)',
      ...completedManualDiagnoses.map(diagnosis => `${diagnosis.icd10Display} · ${diagnosis.icd10Code}`)
    ];
    const patientDiagnoses: PatientDiagnosis[] = completedManualDiagnoses.map(diagnosis => ({
      conditionGroupCode: 'MANUAL',
      conditionGroupDisplay: 'Manual Entry',
      icd10Code: diagnosis.icd10Code,
      icd10Display: diagnosis.icd10Display
    }));
    
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
      diagnoses: patientDiagnoses,
      medications,
      medicationsPendingReview: isMedicationListPending,
      requiredDevice,
      medicalOrder: assignedProgram.includes('RPM') && requiredDevice
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
                  <option value="" disabled>{l('Seleccione dispositivo', 'Select device')}</option>
                  <option value="BP Monitor">BPM</option>
                  <option value="Scale">SCALE</option>
                </select>
                {errors.requiredDevice && (
                  <span className="mt-1 block text-[10px] font-semibold text-red-500">
                    {errors.requiredDevice}
                  </span>
                )}
              </div>

              <div />
            </div>

            <div className="space-y-3 p-4 bg-blue-50/30 border border-blue-100 rounded-xl">
              <div className="flex items-center justify-between gap-3">
                <label className="block text-xs font-bold text-slate-700">
                  {l('Diagnósticos / Condiciones *', 'Diagnoses / Conditions *')}
                </label>
                <button
                  type="button"
                  onClick={() => setManualDiagnoses([...manualDiagnoses, createManualDiagnosis()])}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center bg-blue-50 px-2 py-1 rounded-md"
                >
                  + {l('Agregar ICD', 'Add ICD')}
                </button>
              </div>

              <div className="space-y-2">
                {manualDiagnoses.map((diagnosis, index) => (
                  <div key={diagnosis.id} className="grid grid-cols-1 md:grid-cols-[150px_1fr_auto] gap-2 items-start">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">ICD</label>
                      <input
                        type="text"
                        value={diagnosis.icd10Code}
                        onChange={(e) => updateManualDiagnosisCode(index, e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-semibold"
                        placeholder="E11.9"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">
                        {l('Nombre del ICD', 'ICD Name')}
                      </label>
                      <input
                        type="text"
                        value={diagnosis.icd10Display}
                        onChange={(e) => {
                          const next = [...manualDiagnoses];
                          next[index] = { ...diagnosis, icd10Display: e.target.value };
                          setManualDiagnoses(next);
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-semibold"
                        placeholder={l('Ej. Type 2 Diabetes Mellitus without complications', 'e.g. Type 2 Diabetes Mellitus without complications')}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setManualDiagnoses(manualDiagnoses.length === 1 ? [createManualDiagnosis()] : manualDiagnoses.filter(item => item.id !== diagnosis.id))}
                      className="mt-5 px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 bg-white hover:bg-slate-50"
                    >
                      {l('Eliminar', 'Remove')}
                    </button>
                  </div>
                ))}
              </div>
              {(errors.conditions || !meetsCcmConditionsRequirement) && (
                <p className="text-xs font-semibold text-red-600">
                  {errors.conditions || CCM_CONDITIONS_ERROR}
                </p>
              )}
            </div>

            <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-bold text-slate-700">
                  {language === 'ES' ? 'Medicamentos Actuales' : 'Current Medications'}
                </label>
                {!isMedicationListPending && !isAddingMed && (
                  <button
                    type="button"
                    onClick={() => setIsAddingMed(true)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center bg-blue-50 px-2 py-1 rounded-md"
                  >
                    + {language === 'ES' ? 'Agregar Medicamento' : 'Add Medication'}
                  </button>
                )}
              </div>

              {isMedDropdownOpen && (
                <div
                  className="fixed inset-0 z-10 bg-transparent"
                  onClick={() => setIsMedDropdownOpen(false)}
                />
              )}

              {isAddingMed && !isMedicationListPending && (
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm relative z-20 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="relative col-span-1">
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">
                        {language === 'ES' ? 'Nombre del Medicamento' : 'Medication Name'}
                      </label>
                      <input
                        type="text"
                        value={medSearch}
                        onChange={(e) => {
                          setMedSearch(e.target.value);
                          setIsMedDropdownOpen(true);
                        }}
                        onFocus={() => setIsMedDropdownOpen(true)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 font-semibold"
                        placeholder={language === 'ES' ? 'Buscar medicamento...' : 'Search medication name...'}
                      />
                      {isMedDropdownOpen && medSearch.length > 0 && (
                        <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 max-h-40 overflow-y-auto">
                          {COMMON_MEDICATIONS
                            .filter(m => m.toLowerCase().includes(medSearch.toLowerCase()))
                            .map(m => (
                              <div
                                key={m}
                                onClick={() => {
                                  setMedSearch(m);
                                  setIsMedDropdownOpen(false);
                                }}
                                className="px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer font-semibold text-slate-700"
                              >
                                {m}
                              </div>
                            ))}
                          {COMMON_MEDICATIONS.filter(m => m.toLowerCase().includes(medSearch.toLowerCase())).length === 0 && (
                            <div className="px-3 py-2 text-xs text-slate-500 italic">
                              {language === 'ES' ? `Presione enter para usar "${medSearch}"` : `Press enter to use "${medSearch}"`}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="col-span-1">
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">
                        {language === 'ES' ? 'Dosis / Concentración' : 'Strength'}
                      </label>
                      <input
                        type="text"
                        value={medStrength}
                        onChange={(e) => setMedStrength(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 font-semibold"
                        placeholder="e.g. 10 mg"
                      />
                    </div>

                    <div className="col-span-1">
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">
                        {language === 'ES' ? 'Frecuencia' : 'Frequency'}
                      </label>
                      <select
                        value={medFrequency}
                        onChange={(e) => setMedFrequency(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 font-semibold bg-white"
                      >
                        <option value="Daily">Daily</option>
                        <option value="Twice daily">Twice daily</option>
                        <option value="Three times daily">Three times daily</option>
                        <option value="Every morning">Every morning</option>
                        <option value="Every night">Every night</option>
                        <option value="As needed">As needed</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingMed(false);
                        setMedSearch('');
                        setMedStrength('');
                        setMedFrequency('Daily');
                      }}
                      className="text-[10px] px-3 py-1.5 text-slate-500 hover:bg-slate-100 rounded-md font-bold"
                    >
                      {language === 'ES' ? 'Cancelar' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      disabled={!medSearch.trim()}
                      onClick={() => {
                        if (!medSearch.trim()) return;
                        const newMed: Medication = {
                          medication_name: medSearch.trim(),
                          normalized_medication_name: medSearch.trim().toLowerCase(),
                          strength: medStrength.trim(),
                          frequency: medFrequency,
                          source: 'Manual Entry',
                          selected_by: currentUser.name,
                          selected_at: new Date().toISOString()
                        };
                        const isDup = medications.some(m =>
                          m.normalized_medication_name === newMed.normalized_medication_name &&
                          m.strength.toLowerCase() === newMed.strength.toLowerCase() &&
                          m.frequency === newMed.frequency
                        );
                        if (!isDup) setMedications([...medications, newMed]);
                        setMedSearch('');
                        setMedStrength('');
                        setMedFrequency('Daily');
                        setIsAddingMed(false);
                      }}
                      className="text-[10px] px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold disabled:opacity-50"
                    >
                      {language === 'ES' ? 'Guardar' : 'Save Medication'}
                    </button>
                  </div>
                </div>
              )}

              {medications.length > 0 && !isMedicationListPending && (
                <div className="space-y-2 mt-2">
                  {medications.map((med, idx) => (
                    <div key={`${med.normalized_medication_name}-${idx}`} className="flex justify-between items-center bg-white border border-slate-200 px-3 py-2 rounded-lg relative z-10">
                      <div className="text-xs font-semibold text-slate-800">
                        {med.medication_name}
                        {med.strength && <span className="text-slate-500 font-normal"> {med.strength}</span>}
                        {med.frequency && (
                          <>
                            <span className="text-slate-400 mx-1">-</span>
                            <span className="text-slate-600 font-bold">{med.frequency}</span>
                          </>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setMedSearch(med.medication_name);
                            setMedStrength(med.strength);
                            setMedFrequency(med.frequency || 'Daily');
                            setMedications(medications.filter((_, i) => i !== idx));
                            setIsAddingMed(true);
                          }}
                          className="text-[10px] text-blue-600 hover:text-blue-800 font-bold"
                        >
                          {language === 'ES' ? 'Editar' : 'Edit'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setMedications(medications.filter((_, i) => i !== idx))}
                          className="text-[10px] text-red-500 hover:text-red-700 font-bold"
                        >
                          {language === 'ES' ? 'Eliminar' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center pt-2">
                <input
                  type="checkbox"
                  id="edit-meds-pending"
                  checked={isMedicationListPending}
                  onChange={(e) => setIsMedicationListPending(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="edit-meds-pending" className="ml-2 text-xs font-bold text-slate-600 cursor-pointer">
                  {language === 'ES' ? 'Lista de medicamentos no disponible en este momento' : 'Medication list not available at this time'}
                </label>
              </div>
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
