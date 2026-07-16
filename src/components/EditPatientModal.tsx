import { useState, FormEvent, useEffect } from 'react';
import { ConditionGroupCatalog, DiagnosisCatalog, Patient, PatientDiagnosis, User } from '../types';
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
  const [isDiagnosisDropdownOpen, setIsDiagnosisDropdownOpen] = useState(false);
  const [medicationsInput, setMedicationsInput] = useState('');
  const [requiredDevice, setRequiredDevice] = useState('BP Monitor');
  const [isLtc, setIsLtc] = useState(true); // Pre-fill with true since it's mandatory, but must be checked
  const ICD10_CODE_PATTERN = /^[A-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/;
  const CCM_CONDITIONS_ERROR = 'CCM requires at least 2 chronic conditions with valid ICD-10 codes.';
  const assignedProgramIncludesCcm = assignedProgram
    .split('+')
    .some(programPart => programPart.trim().toUpperCase() === 'CCM');
  const meetsCcmConditionsRequirement = !assignedProgramIncludesCcm
    || Array.from(selectedDiagnosisCodes(selectedConditions)).filter(code => ICD10_CODE_PATTERN.test(code)).length >= 2;

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
      const selectedCodes = conditionGroupOptions
        .filter(group => group.diagnoses.some(diagnosis => selectedDiagnosisLabels.includes(formatDiagnosis(diagnosis))))
        .map(group => group.code);
      const savedGroupCodes = (patient.diagnoses || []).map(diagnosis => diagnosis.conditionGroupCode);
      setSelectedCategoryCodes(Array.from(new Set([...selectedCodes, ...savedGroupCodes])));
      setCategorySearch('');
      setDiagnosisSearch('');
      
      setMedicationsInput((patient.medications || []).map(m => typeof m === 'string' ? m : `${m.medication_name} ${m.strength} — ${m.frequency}`).join(', '));
      
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
    if (selectedCategoryCodes.length === 0) {
      newErrors.conditions = l('Seleccione al menos un Condition Group.', 'Select at least one Condition Group.');
    } else if (!selectedConditions.some(condition => condition !== 'Clinical Review Required')) {
      newErrors.conditions = l('Debe seleccionar un diagnóstico específico con código ICD-10.', 'Select a specific diagnosis with an ICD-10 code.');
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

    const conditions = ['Long Term Care (LTC)', ...selectedConditions];
    const patientDiagnoses: PatientDiagnosis[] = conditionGroupOptions.flatMap(group =>
      group.diagnoses
        .filter(diagnosis => selectedConditions.includes(formatDiagnosis(diagnosis)))
        .map(diagnosis => ({
          conditionGroupCode: group.code,
          conditionGroupDisplay: group.display,
          icd10Code: diagnosis.code,
          icd10Display: diagnosis.name
        }))
    );
    
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
      diagnoses: patientDiagnoses,
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

            <div className="space-y-3 p-4 bg-blue-50/30 border border-blue-100 rounded-xl">
              <label className="block text-xs font-bold text-slate-700">
                {l('Diagnósticos / Condiciones *', 'Diagnoses / Conditions *')}
              </label>

              {isCategoryDropdownOpen && (
                <div
                  className="fixed inset-0 z-10 bg-transparent"
                  onClick={() => setIsCategoryDropdownOpen(false)}
                />
              )}
              {isDiagnosisDropdownOpen && (
                <div
                  className="fixed inset-0 z-10 bg-transparent"
                  onClick={() => setIsDiagnosisDropdownOpen(false)}
                />
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="relative z-20">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    {l('Categorías Clínicas', 'Clinical Categories')}
                  </label>
                  <input
                    type="text"
                    value={categorySearch}
                    onChange={(e) => {
                      setCategorySearch(e.target.value);
                      setIsCategoryDropdownOpen(true);
                    }}
                    onFocus={() => setIsCategoryDropdownOpen(true)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-semibold"
                    placeholder={l('Buscar categoría...', 'Search category...')}
                  />
                  {isCategoryDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto">
                      {conditionGroupOptions
                        .filter(group => group.display.toLowerCase().includes(categorySearch.toLowerCase()))
                        .map(group => {
                          const isSelected = selectedCategoryCodes.includes(group.code);
                          return (
                            <div
                              key={group.code}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedCategoryCodes(selectedCategoryCodes.filter(code => code !== group.code));
                                  const removedDiagnosisLabels = group.diagnoses.map(formatDiagnosis);
                                  setSelectedConditions(selectedConditions.filter(condition => !removedDiagnosisLabels.includes(condition)));
                                } else {
                                  setSelectedCategoryCodes([...selectedCategoryCodes, group.code]);
                                }
                                setCategorySearch('');
                              }}
                              className={`px-3 py-2 text-xs font-semibold hover:bg-blue-50 hover:text-blue-700 cursor-pointer flex justify-between items-center transition-colors ${
                                isSelected ? 'bg-blue-50/50 text-blue-700 font-bold' : 'text-slate-700'
                              }`}
                            >
                              <span>{group.display}</span>
                              <span className="text-[10px] text-slate-400 font-bold">{group.code}</span>
                            </div>
                          );
                        })}
                      {conditionGroupOptions.filter(group => group.display.toLowerCase().includes(categorySearch.toLowerCase())).length === 0 && (
                        <div className="px-3 py-2 text-xs text-slate-400 italic">
                          {l('Sin resultados', 'No results found')}
                        </div>
                      )}
                    </div>
                  )}
                  {selectedCategoryCodes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selectedCategoryCodes.map(code => {
                        const group = conditionGroupOptions.find(item => item.code === code);
                        return (
                          <span key={code} className="inline-flex items-center text-[9px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-extrabold">
                            {group?.display || code}
                            <button
                              type="button"
                              onClick={() => {
                                const removedDiagnosisLabels = group?.diagnoses.map(formatDiagnosis) || [];
                                setSelectedCategoryCodes(selectedCategoryCodes.filter(item => item !== code));
                                setSelectedConditions(selectedConditions.filter(condition => !removedDiagnosisLabels.includes(condition)));
                              }}
                              className="ml-1 text-slate-400 hover:text-slate-600 font-bold"
                            >
                              x
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="relative z-20">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    {l('Diagnósticos Disponibles (filtrados)', 'Available Diagnoses (filtered)')}
                  </label>
                  <input
                    type="text"
                    disabled={selectedCategoryCodes.length === 0}
                    value={diagnosisSearch}
                    onChange={(e) => {
                      setDiagnosisSearch(e.target.value);
                      setIsDiagnosisDropdownOpen(true);
                    }}
                    onFocus={() => setIsDiagnosisDropdownOpen(true)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-semibold disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                    placeholder={selectedCategoryCodes.length > 0
                      ? l('Buscar diagnóstico o CIE-10...', 'Search diagnosis or ICD-10...')
                      : l('Seleccione al menos una categoría', 'Select at least one category')
                    }
                  />
                  {isDiagnosisDropdownOpen && selectedCategoryCodes.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto">
                      {conditionGroupOptions
                        .filter(group => selectedCategoryCodes.includes(group.code))
                        .flatMap(group => group.diagnoses)
                        .filter((diagnosis, index, self) => self.findIndex(item => item.code === diagnosis.code) === index)
                        .filter(diagnosis =>
                          diagnosis.name.toLowerCase().includes(diagnosisSearch.toLowerCase()) ||
                          diagnosis.code.toLowerCase().includes(diagnosisSearch.toLowerCase())
                        )
                        .map(diagnosis => {
                          const formattedValue = formatDiagnosis(diagnosis);
                          const isSelected = selectedConditions.includes(formattedValue);
                          return (
                            <div
                              key={diagnosis.code}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedConditions(selectedConditions.filter(condition => condition !== formattedValue));
                                } else {
                                  setSelectedConditions([...selectedConditions, formattedValue]);
                                }
                              }}
                              className={`px-3 py-2 text-xs font-semibold hover:bg-blue-50 hover:text-blue-700 cursor-pointer flex justify-between items-center transition-colors ${
                                isSelected ? 'bg-blue-50/50 text-blue-700 font-bold' : 'text-slate-700'
                              }`}
                            >
                              <span>{diagnosis.name} <span className="text-[10px] text-slate-400 font-bold ml-1">{diagnosis.code}</span></span>
                              {isSelected && <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-md font-bold">OK</span>}
                            </div>
                          );
                        })}
                      <div
                        onClick={() => {
                          const reviewValue = 'Clinical Review Required';
                          if (selectedConditions.includes(reviewValue)) {
                            setSelectedConditions(selectedConditions.filter(condition => condition !== reviewValue));
                          } else {
                            setSelectedConditions([...selectedConditions, reviewValue]);
                          }
                        }}
                        className={`px-3 py-2 text-xs font-bold hover:bg-amber-100 cursor-pointer border-t border-slate-100 transition-colors flex justify-between items-center ${
                          selectedConditions.includes('Clinical Review Required') ? 'bg-amber-100 text-amber-800' : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        <span>{l('Marcar para revisión clínica', 'Mark for clinical review')}</span>
                        {selectedConditions.includes('Clinical Review Required') && <span className="text-[10px] bg-amber-600 text-white px-1.5 py-0.5 rounded-md font-bold">OK</span>}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {selectedConditions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2 relative z-10">
                  {selectedConditions.map(condition => {
                    const isReview = condition === 'Clinical Review Required';
                    return (
                      <span
                        key={condition}
                        className={`inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                          isReview
                            ? 'bg-amber-50 border-amber-200 text-amber-800'
                            : 'bg-blue-50 border-blue-200 text-blue-800'
                        }`}
                      >
                        {condition}
                        <button
                          type="button"
                          onClick={() => setSelectedConditions(selectedConditions.filter(item => item !== condition))}
                          className="ml-1.5 hover:text-red-500 text-slate-400 font-bold"
                        >
                          x
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              {(errors.conditions || !meetsCcmConditionsRequirement) && (
                <p className="text-xs font-semibold text-red-600">
                  {errors.conditions || CCM_CONDITIONS_ERROR}
                </p>
              )}
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
