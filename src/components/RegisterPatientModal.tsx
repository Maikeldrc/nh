import { useEffect, useState, FormEvent } from 'react';
import { Patient, User, Medication, ConditionGroupCatalog, DiagnosisCatalog, ProgramCatalog } from '../types';
import { X, UserPlus, Calendar, MapPin, HeartPulse, UserCheck, Stethoscope, CheckCheck, CheckCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';
import { POWERED_BY, PRACTICE_NAME, PRODUCT_NAME } from '../utils/branding';
import { isEnrollmentOperationsRole } from '../utils/roles';

interface RegisterPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (patient: Patient) => void;
  currentUser: User;
  users: User[];
  conditionGroups: ConditionGroupCatalog[];
  diagnoses: DiagnosisCatalog[];
  programs: ProgramCatalog[];
  nursingHomes: string[];
}

export default function RegisterPatientModal({
  isOpen,
  onClose,
  onRegister,
  currentUser,
  users,
  conditionGroups,
  diagnoses,
  programs,
  nursingHomes
}: RegisterPatientModalProps) {
  const { language } = useLanguage();
  const defaultNursingHome = nursingHomes.find(home => home === 'Input Facility') || nursingHomes[0] || '';
  
  // Autocomplete Data
  interface ConditionGroup {
    code: string;
    display: string;
    diagnoses: { name: string; code: string }[];
  }
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

  const FALLBACK_CONDITION_GROUPS: ConditionGroup[] = [
    {
      code: 'DM',
      display: 'Diabetes Mellitus',
      diagnoses: [
        { name: 'Type 2 Diabetes Mellitus without complications', code: 'E11.9' },
        { name: 'Type 2 Diabetes Mellitus with diabetic nephropathy', code: 'E11.21' },
        { name: 'Type 2 Diabetes Mellitus with diabetic polyneuropathy', code: 'E11.42' },
        { name: 'Type 1 Diabetes Mellitus without complications', code: 'E10.9' }
      ]
    },
    {
      code: 'CVC',
      display: 'Cardiovascular Comorbidities',
      diagnoses: [
        { name: 'Atrial Fibrillation', code: 'I48.91' },
        { name: 'Coronary Artery Disease', code: 'I25.10' },
        { name: 'Angine Pectoris', code: 'I20.9' },
        { name: 'Aortic Valve Stenosis', code: 'I35.0' }
      ]
    },
    {
      code: 'HHK',
      display: 'Hypertension - Heart - Kidney',
      diagnoses: [
        { name: 'Essential Hypertension', code: 'I10' },
        { name: 'Hypertensive Heart Disease with Heart Failure', code: 'I11.0' },
        { name: 'Hypertensive Chronic Kidney Disease', code: 'I12.9' },
        { name: 'Congestive Heart Failure', code: 'I50.9' }
      ]
    },
    {
      code: 'BH',
      display: 'Behavioral Health',
      diagnoses: [
        { name: 'Major Depressive Disorder, Recurrent, Moderate', code: 'F33.1' },
        { name: 'Generalized Anxiety Disorder', code: 'F41.1' },
        { name: 'Major Depressive Disorder, Single Episode, Unspecified', code: 'F32.9' }
      ]
    },
    {
      code: 'CKD',
      display: 'Chronic Kidney Disease',
      diagnoses: [
        { name: 'Chronic Kidney Disease, Stage 3 (Moderate)', code: 'N18.30' },
        { name: 'Chronic Kidney Disease, Stage 4 (Severe)', code: 'N18.4' },
        { name: 'End Stage Renal Disease', code: 'N18.6' },
        { name: 'Chronic Kidney Disease, Unspecified', code: 'N18.9' }
      ]
    },
    {
      code: 'HLD',
      display: 'Hyperlipidemia - Lipid Disorders',
      diagnoses: [
        { name: 'Pure Hypercholesterolemia', code: 'E78.00' },
        { name: 'Mixed Hyperlipidemia', code: 'E78.2' },
        { name: 'Hyperlipidemia, Unspecified', code: 'E78.5' }
      ]
    },
    {
      code: 'LTM',
      display: 'Long-term Medication Use',
      diagnoses: [
        { name: 'Long-term (current) use of anticoagulants', code: 'Z79.01' },
        { name: 'Long-term (current) use of insulin', code: 'Z79.4' },
        { name: 'Long-term (current) use of opiate analgesic', code: 'Z79.891' }
      ]
    },
    {
      code: 'OB',
      display: 'Obesity - BMI',
      diagnoses: [
        { name: 'Morbid Obesity due to excess calories', code: 'E66.01' },
        { name: 'Obesity, Unspecified', code: 'E66.9' },
        { name: 'BMI 40.0 or over, adult', code: 'Z68.41' }
      ]
    },
    {
      code: 'SDOH',
      display: 'SDOH Z-codes',
      diagnoses: [
        { name: 'Problems related to housing and economic circumstances', code: 'Z59.9' },
        { name: 'Problems related to living alone', code: 'Z60.2' },
        { name: 'Lack of adequate physical food', code: 'Z59.41' }
      ]
    },
    {
      code: 'PD',
      display: 'Prediabetes',
      diagnoses: [
        { name: 'Prediabetes (Borderline Diabetes)', code: 'R73.03' }
      ]
    },
    {
      code: 'CMP',
      display: 'Chronic Musculoskeletal Pain',
      diagnoses: [
        { name: 'Chronic Pain Syndrome', code: 'G89.4' },
        { name: 'Low Back Pain', code: 'M54.50' },
        { name: 'Fibromyalgia', code: 'M79.7' }
      ]
    },
    {
      code: 'ASCVD',
      display: 'Atherosclerotic Cardiovascular Disease (ASCVD)',
      diagnoses: [
        { name: 'Atherosclerotic Heart Disease of native coronary artery', code: 'I25.10' },
        { name: 'Peripheral Vascular Disease, Unspecified', code: 'I73.9' }
      ]
    },
    {
      code: 'COPD',
      display: 'Chronic Obstructive Pulmonary Disease (COPD)',
      diagnoses: [
        { name: 'COPD with acute lower respiratory infection', code: 'J44.0' },
        { name: 'COPD with acute exacerbation', code: 'J44.1' },
        { name: 'Chronic Obstructive Pulmonary Disease, Unspecified', code: 'J44.9' }
      ]
    },
    {
      code: 'ASTH',
      display: 'Asthma',
      diagnoses: [
        { name: 'Mild Intermittent Asthma, Uncomplicated', code: 'J45.20' },
        { name: 'Moderate Persistent Asthma, Uncomplicated', code: 'J45.40' },
        { name: 'Asthma, Unspecified', code: 'J45.909' }
      ]
    },
    {
      code: 'SA',
      display: 'Sleep Apnea and Sleep-Related Breathing Disorders',
      diagnoses: [
        { name: 'Obstructive Sleep Apnea (Adult)', code: 'G47.33' },
        { name: 'Sleep Apnea, Unspecified', code: 'G47.30' }
      ]
    },
    {
      code: 'CAN',
      display: 'Active Malignant Neoplasms (Cancer)',
      diagnoses: [
        { name: 'Malignant Neoplasm of Breast', code: 'C50.919' },
        { name: 'Malignant Neoplasm of Prostate', code: 'C61' },
        { name: 'Malignant Neoplasm of Bronchus or Lung', code: 'C34.90' }
      ]
    },
    {
      code: 'DEM',
      display: 'Dementia and Major Neurocognitive Disorders',
      diagnoses: [
        { name: 'Alzheimer\'s Disease, Unspecified', code: 'G30.9' },
        { name: 'Dementia in conditions classified elsewhere without behavioral disturbance', code: 'F02.80' },
        { name: 'Vascular Dementia without behavioral disturbance', code: 'F01.50' }
      ]
    },
    {
      code: 'STR',
      display: 'Stroke and Transient Ischemic Attack (Acute Cerebrovascular Disease)',
      diagnoses: [
        { name: 'Cerebral Infarction, Unspecified', code: 'I63.9' },
        { name: 'Transient Cerebral Ischemic Attack, Unspecified', code: 'G45.9' }
      ]
    },
    {
      code: 'OA',
      display: 'Osteoarthritis',
      diagnoses: [
        { name: 'Bilateral Primary Osteoarthritis of Knee', code: 'M17.12' },
        { name: 'Osteoarthritis, Unspecified Site', code: 'M19.90' }
      ]
    },
    {
      code: 'OP',
      display: 'Osteoporosis',
      diagnoses: [
        { name: 'Age-related Osteoporosis without current pathological fracture', code: 'M81.0' },
        { name: 'Other Osteoporosis without current pathological fracture', code: 'M81.8' }
      ]
    },
    {
      code: 'RA',
      display: 'Rheumatoid Arthritis and Inflammatory Arthropathies',
      diagnoses: [
        { name: 'Rheumatoid Arthritis without rheumatoid factor, unspecified site', code: 'M06.00' },
        { name: 'Rheumatoid Arthritis, Unspecified', code: 'M06.9' }
      ]
    },
    {
      code: 'TD',
      display: 'Thyroid Disorders',
      diagnoses: [
        { name: 'Hypothyroidism, Unspecified', code: 'E03.9' },
        { name: 'Hyperthyroidism, Unspecified', code: 'E05.90' }
      ]
    },
    {
      code: 'PK',
      display: 'Parkinson\'s Disease and Movement Disorders',
      diagnoses: [
        { name: 'Parkinson\'s Disease', code: 'G20' },
        { name: 'Essential Tremor', code: 'G25.0' }
      ]
    },
    {
      code: 'EP',
      display: 'Epilepsy and Recurrent Seizures',
      diagnoses: [
        { name: 'Epilepsy, Unspecified, not intractable, without status epilepticus', code: 'G40.909' }
      ]
    },
    {
      code: 'SUD',
      display: 'Substance Use Disorders',
      diagnoses: [
        { name: 'Alcohol Abuse, Uncomplicated', code: 'F10.10' },
        { name: 'Tobacco Use Disorder', code: 'F17.200' }
      ]
    },
    {
      code: 'BP',
      display: 'Bipolar and Related Disorders',
      diagnoses: [
        { name: 'Bipolar Disorder, Unspecified', code: 'F31.9' }
      ]
    },
    {
      code: 'TSD',
      display: 'Trauma- and Stressor-related Disorders (incl. PTSD)',
      diagnoses: [
        { name: 'Post-Traumatic Stress Disorder, Unspecified', code: 'F43.10' },
        { name: 'Adjustment Disorder, Unspecified', code: 'F43.20' }
      ]
    },
    {
      code: 'SZ',
      display: 'Schizophrenia and Other Psychotic Disorders',
      diagnoses: [
        { name: 'Schizophrenia, Unspecified', code: 'F20.9' },
        { name: 'Schizoaffective Disorder, Unspecified', code: 'F25.9' }
      ]
    },
    {
      code: 'CLD',
      display: 'Chronic Liver Disease and Cirrhosis',
      diagnoses: [
        { name: 'Cirrhosis of Liver, Unspecified', code: 'K74.60' },
        { name: 'Nonalcoholic Steatohepatitis (NASH)', code: 'K75.81' }
      ]
    },
    {
      code: 'HIV',
      display: 'HIV/AIDS',
      diagnoses: [
        { name: 'Human Immunodeficiency Virus [HIV] disease', code: 'B20' }
      ]
    },
    {
      code: 'CVH',
      display: 'Chronic Viral Hepatitis (Hepatitis B and C)',
      diagnoses: [
        { name: 'Chronic Hepatitis C', code: 'B18.2' },
        { name: 'Chronic Hepatitis B without delta-agent', code: 'B18.1' }
      ]
    },
    {
      code: 'IBD',
      display: 'Inflammatory Bowel Disease (Crohn\'s Disease and Ulcerative Colitis)',
      diagnoses: [
        { name: 'Crohn\'s Disease, Unspecified', code: 'K50.90' },
        { name: 'Ulcerative Colitis, Unspecified', code: 'K51.90' }
      ]
    },
    {
      code: 'AN',
      display: 'Anemias',
      diagnoses: [
        { name: 'Iron Deficiency Anemia, Unspecified', code: 'D50.9' },
        { name: 'Anemia in Chronic Kidney Disease', code: 'D63.1' }
      ]
    },
    {
      code: 'MS',
      display: 'Multiple Sclerosis and Demyelinating Diseases',
      diagnoses: [
        { name: 'Multiple Sclerosis', code: 'G35' }
      ]
    },
    {
      code: 'MIG',
      display: 'Migraine and Other Chronic Headache Disorders',
      diagnoses: [
        { name: 'Migraine without aura, not intractable', code: 'G43.009' },
        { name: 'Chronic Tension-Type Headache', code: 'G44.22' }
      ]
    },
    {
      code: 'ADHD',
      display: 'Attention-Deficit/Hyperactivity Disorder (ADHD)',
      diagnoses: [
        { name: 'ADHD, Combined Type', code: 'F90.2' },
        { name: 'ADHD, Unspecified Type', code: 'F90.9' }
      ]
    },
    {
      code: 'OCD',
      display: 'Obsessive-Compulsive and Related Disorders',
      diagnoses: [
        { name: 'Obsessive-Compulsive Disorder', code: 'F42.9' }
      ]
    },
    {
      code: 'FED',
      display: 'Feeding and Eating Disorders',
      diagnoses: [
        { name: 'Anorexia Nervosa, Unspecified', code: 'F50.00' },
        { name: 'Bulimia Nervosa', code: 'F50.2' }
      ]
    }
  ];

  const CONDITION_GROUPS: ConditionGroup[] = conditionGroups.length > 0
    ? conditionGroups
        .filter(group => group.is_active)
        .map(group => ({
          code: group.code,
          display: group.display,
          diagnoses: diagnoses
            .filter(diagnosis => diagnosis.is_active && diagnosis.condition_group_id === group.id)
            .map(diagnosis => ({ name: diagnosis.icd10_display, code: diagnosis.icd10_code }))
        }))
    : FALLBACK_CONDITION_GROUPS;

  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [medicareId, setMedicareId] = useState('');
  const [nursingHome, setNursingHome] = useState(defaultNursingHome);
  const [room, setRoom] = useState('');
  const activePrograms = programs.filter(program => program.is_active);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const assignedProgram = selectedPrograms.join(' + ');
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [manualDiagnoses, setManualDiagnoses] = useState<ManualDiagnosis[]>([createManualDiagnosis()]);
  useEffect(() => {
    if (!nursingHome && defaultNursingHome) setNursingHome(defaultNursingHome);
  }, [nursingHome, defaultNursingHome]);
  
  // Auto-complete inputs
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedCategoryCodes, setSelectedCategoryCodes] = useState<string[]>([]);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  
  const [diagnosisSearch, setDiagnosisSearch] = useState('');
  const [isDiagnosisDropdownOpen, setIsDiagnosisDropdownOpen] = useState(false);

  // Medications structured state
  const [medications, setMedications] = useState<Medication[]>([]);
  const [isMedicationListPending, setIsMedicationListPending] = useState(false);
  const [isAddingMed, setIsAddingMed] = useState(false);
  const [medSearch, setMedSearch] = useState('');
  const [isMedDropdownOpen, setIsMedDropdownOpen] = useState(false);
  const [medStrength, setMedStrength] = useState('');
  const [medFrequency, setMedFrequency] = useState('Daily');

  const COMMON_MEDICATIONS = [
    'Lisinopril', 'Metformin', 'Atorvastatin', 'Amlodipine', 'Furosemide',
    'Omeprazole', 'Losartan', 'Gabapentin', 'Levothyroxine', 'Sertraline',
    'Pantoprazole', 'Hydrochlorothiazide', 'Carvedilol', 'Metoprolol', 'Simvastatin'
  ];

  const DEVICE_OPTIONS = [
    { value: 'BP Monitor', label: 'BPM' },
    { value: 'Scale', label: 'SCALE' }
  ];
  const [selectedRequiredDevices, setSelectedRequiredDevices] = useState<string[]>([]);
  const requiredDevice = selectedRequiredDevices.join(' + ');
  const [isLtc, setIsLtc] = useState(false); // Mandatory condition for Long Term Care (LTC)
  
  // Nurses list
  const nurses = users.filter(u => isEnrollmentOperationsRole(u.role) && u.active !== false);
  const assignedNurseId = isEnrollmentOperationsRole(currentUser.role) ? currentUser.id : (nurses[0]?.id || '');
  const physicians = users
    .filter(user => user.role === 'PHYSICIAN' && user.active !== false)
    .sort((a, b) => a.name.localeCompare(b.name));
  const [selectedPhysicianId, setSelectedPhysicianId] = useState('');
  const selectedPhysician = physicians.find(physician => physician.id === selectedPhysicianId);

  // RTM and inactive programs are not available during new patient registration.
  const eligiblePrograms = activePrograms.filter(program => program.code !== 'RTM' && program.code !== 'Other');
  useEffect(() => {
    const eligibleCodes = eligiblePrograms.map(program => program.code);
    setSelectedPrograms(previous => {
      const eligibleSelection = previous.filter(code => eligibleCodes.includes(code));
      return eligibleSelection.includes('CCM') && eligibleSelection.includes('PCM')
        ? eligibleSelection.filter(code => code !== 'PCM')
        : eligibleSelection;
    });
  }, [programs]);

  const toggleProgramSelection = (programCode: string, checked: boolean) => {
    setSelectedPrograms(previous => {
      if (!checked) {
        return previous.filter(code => code !== programCode);
      }

      const nextPrograms = previous.filter(code => {
        if (programCode === 'CCM') return code !== 'PCM';
        if (programCode === 'PCM') return code !== 'CCM';
        return true;
      });

      return Array.from(new Set([...nextPrograms, programCode]));
    });
  };

  const toggleRequiredDevice = (device: string, checked: boolean) => {
    setSelectedRequiredDevices(previous => checked
      ? Array.from(new Set([...previous, device]))
      : previous.filter(selectedDevice => selectedDevice !== device)
    );
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
  const selectedValidIcd10Codes = new Set(
    completedManualDiagnoses
      .map(diagnosis => diagnosis.icd10Code)
      .filter(code => ICD10_CODE_PATTERN.test(code))
  );
  const meetsCcmConditionsRequirement = !assignedProgramIncludesCcm || selectedValidIcd10Codes.size >= 2;
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

  // Errors state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
      // Basic format check
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
    if (!selectedPhysician) {
      newErrors.provider = language === 'ES' ? 'Seleccione el médico supervisor.' : 'Select the supervising physician.';
    }
    if (!isLtc) {
      newErrors.isLtc = language === 'ES' ? 'El paciente debe ser Long Term Care (LTC) obligatoriamente' : 'The patient must be Long Term Care (LTC)';
    }
    if (selectedPrograms.length === 0) {
      newErrors.assignedProgram = language === 'ES' ? 'Seleccione al menos un programa.' : 'Select at least one program.';
    }
    if (assignedProgram.includes('RPM') && selectedRequiredDevices.length === 0) {
      newErrors.requiredDevice = language === 'ES' ? 'Seleccione al menos un dispositivo requerido.' : 'Select at least one required device.';
    }
    if (completedManualDiagnoses.length === 0) {
      newErrors.conditions = language === 'ES'
        ? 'Agregue al menos un ICD y el nombre del diagnóstico.'
        : 'Add at least one ICD and diagnosis name.';
    } else if (hasPartialManualDiagnosis) {
      newErrors.conditions = language === 'ES'
        ? 'Cada fila debe tener ICD y nombre del ICD, o estar completamente vacía.'
        : 'Each row must include both ICD and ICD name, or be completely empty.';
    }
    if (!meetsCcmConditionsRequirement) {
      newErrors.conditions = CCM_CONDITIONS_ERROR;
    }
    if (medications.length === 0 && !isMedicationListPending) {
      newErrors.medications = language === 'ES'
        ? 'Agregue al menos un medicamento o marque que la lista no está disponible en este momento.'
        : 'Add at least one medication or mark that the medication list is not available at this time.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const hasUnsavedChanges = () => {
    return firstName.trim().length > 0 || 
           lastName.trim().length > 0 || 
           birthDate.length > 0 || 
           medicareId.trim().length > 0;
  };

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setBirthDate('');
    setMedicareId('');
    setNursingHome(defaultNursingHome);
    setRoom('');
    setSelectedPrograms([]);
    setSelectedConditions([]);
    setManualDiagnoses([createManualDiagnosis()]);
    setCategorySearch('');
    setSelectedCategoryCodes([]);
    setDiagnosisSearch('');
    setMedications([]);
    setIsMedicationListPending(false);
    setMedSearch('');
    setMedStrength('');
    setIsLtc(false);
    setSelectedRequiredDevices([]);
    setSelectedPhysicianId('');
    setErrors({});
  };

  const validateDraft = () => {
    const newErrors: Record<string, string> = {};
    if (!firstName.trim() && !lastName.trim() && !medicareId.trim()) {
      newErrors.draft = language === 'ES'
        ? 'Para guardar un borrador, capture al menos nombre, apellido o Medicare ID.'
        : 'To save a draft, enter at least first name, last name, or Medicare ID.';
    }
    if (hasPartialManualDiagnosis) {
      newErrors.conditions = language === 'ES'
        ? 'Cada fila de ICD debe tener código y nombre, o estar completamente vacía.'
        : 'Each ICD row must include both code and name, or be completely empty.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCancel = () => {
    if (hasUnsavedChanges()) {
      setShowCancelConfirm(true);
    } else {
      onClose();
    }
  };

  const buildPatientPayload = (status: Patient['status']): Patient => {
    const isDraft = status === 'INCOMPLETE';
    const displayFirstName = firstName.trim() || (isDraft ? 'Draft' : '');
    const displayLastName = lastName.trim() || (isDraft ? 'Patient' : '');

    const conditions = [
      ...(isLtc ? ['Long Term Care (LTC)'] : []),
      ...completedManualDiagnoses.map(diagnosis => `${diagnosis.icd10Display} · ${diagnosis.icd10Code}`)
    ];
    const patientDiagnoses = completedManualDiagnoses.map(diagnosis => ({
      conditionGroupCode: 'MANUAL',
      conditionGroupDisplay: 'Manual Entry',
      icd10Code: diagnosis.icd10Code,
      icd10Display: diagnosis.icd10Display
    }));
    
    const finalMedications = [...medications];
    const selectedNurse = nurses.find(n => n.id === assignedNurseId) || currentUser;
    const supervisingPhysician = selectedPhysician?.name || '';

    return {
      id: `pat_${Date.now()}`,
      firstName: displayFirstName,
      lastName: displayLastName,
      birthDate,
      medicareId: medicareId.trim() || undefined,
      nursingHome: nursingHome || defaultNursingHome || 'Input Facility',
      room: room.trim() || undefined,
      provider: supervisingPhysician,
      practice: PRACTICE_NAME,    // default medical practice
      assignedProgram,
      conditions,
      diagnoses: patientDiagnoses,
      medications: finalMedications,
      medicationsPendingReview: isMedicationListPending,
      requiredDevice,
      status,
      assignedNurseId: selectedNurse.id,
      assignedNurseName: selectedNurse.name
    };
  };

  const submitDraft = async () => {
    if (!validateDraft()) return;
    setIsSaving(true);

    const draftPatient = buildPatientPayload('INCOMPLETE');

    await new Promise(resolve => setTimeout(resolve, 500));

    onRegister(draftPatient);

    setSuccessMessage(language === 'ES' ? `${PRODUCT_NAME}: borrador guardado.` : `${PRODUCT_NAME}: draft saved.`);
    setTimeout(() => {
      setIsSaving(false);
      resetForm();
      onClose();
    }, 500);
  };

  const submitForm = async (action: 'CLOSE' | 'ADD_ANOTHER') => {
    if (!validate()) return;
    setIsSaving(true);

    const newPatient = buildPatientPayload('PENDING_CONSENT');

    // Simulate short network delay for loading feedback
    await new Promise(resolve => setTimeout(resolve, 500));
    
    onRegister(newPatient);

    if (action === 'CLOSE') {
      setSuccessMessage(language === 'ES' ? `${PRODUCT_NAME}: paciente registrado con éxito.` : `${PRODUCT_NAME}: patient registered successfully.`);
      setTimeout(() => {
        setIsSaving(false);
        resetForm();
        onClose();
      }, 500);
    } else {
      setSuccessMessage(language === 'ES' ? `${PRODUCT_NAME}: paciente registrado con éxito. Puedes agregar otro.` : `${PRODUCT_NAME}: patient registered successfully. You can now add another patient.`);
      setIsSaving(false);
      
      resetForm();
      
      setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto" id="register-patient-modal-container">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-2xl w-full mx-4 overflow-hidden z-10 my-8">
        {/* Header */}
        <div className="premium-dark-header bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 text-white flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-white/10 p-2 rounded-lg">
              <UserPlus size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {language === 'ES' ? 'Registrar Nuevo Paciente' : 'Register New Patient'}
              </h2>
              <p className="text-[11px] font-bold text-white">{PRODUCT_NAME} · {POWERED_BY}</p>
              <p className="text-xs text-blue-100/80">
                {language === 'ES' ? 'Complete la información demográfica y médica basal' : 'Fill out clinical & demographic details'}
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
        <form onSubmit={(e) => { e.preventDefault(); submitForm('CLOSE'); }} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto relative">
          
          {successMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-sm font-bold flex items-center space-x-2 sticky top-0 z-10 shadow-sm">
              <CheckCircle size={16} />
              <span>{successMessage}</span>
            </div>
          )}
          
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

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ES' ? 'Médico supervisor *' : 'Supervising physician *'}
              </label>
              <select
                value={selectedPhysicianId}
                onChange={(e) => setSelectedPhysicianId(e.target.value)}
                className={`w-full px-3 py-2 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-semibold ${
                  errors.provider ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-300'
                }`}
              >
                <option value="">{language === 'ES' ? 'Seleccione un médico' : 'Select a physician'}</option>
                {physicians.map(physician => (
                  <option key={physician.id} value={physician.id}>{physician.name}</option>
                ))}
              </select>
              {physicians.length === 0 && (
                <span className="text-[10px] text-amber-600 font-semibold mt-1 block">
                  {language === 'ES' ? 'No hay médicos activos registrados.' : 'No active physicians are registered.'}
                </span>
              )}
              {errors.provider && <span className="text-[10px] text-red-500 font-semibold mt-0.5 block">{errors.provider}</span>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ES' ? 'Programa Asignado' : 'Assigned Program'}
              </label>
              <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-300 bg-slate-50 p-2 sm:grid-cols-2 lg:grid-cols-3">
                {eligiblePrograms.map(program => {
                  const checked = selectedPrograms.includes(program.code);
                  return (
                    <label
                      key={program.id}
                      className={`flex cursor-pointer items-center rounded-lg border px-2.5 py-2 text-xs font-extrabold transition ${
                        checked ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => toggleProgramSelection(program.code, event.target.checked)}
                        className="mr-2 h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      {program.display}
                    </label>
                  );
                })}
                {eligiblePrograms.length === 0 && (
                  <p className="px-2 py-1 text-xs font-semibold text-rose-600 sm:col-span-2 lg:col-span-3">
                    {language === 'ES' ? 'No hay programas activos configurados.' : 'No active programs are configured.'}
                  </p>
                )}
              </div>
              {assignedProgram && (
                <p className="mt-1 text-[10px] font-bold text-blue-700">
                  {language === 'ES' ? 'Seleccionado' : 'Selected'}: {assignedProgram}
                </p>
              )}
              {errors.assignedProgram && <span className="text-[10px] text-red-500 font-semibold mt-0.5 block">{errors.assignedProgram}</span>}
            </div>

            {/* RPM Auto-order banner */}
            {assignedProgram.includes('RPM') && (
              <div className="flex items-start space-x-3 p-3.5 bg-violet-50 border border-violet-200 rounded-xl">
                <div className="bg-violet-100 p-1.5 rounded-lg shrink-0 mt-0.5">
                  <Stethoscope size={14} className="text-violet-600" />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-violet-800">
                    {language === 'ES' ? 'Orden médica automática' : 'Automatic Medical Order'}
                  </p>
                  <p className="text-[10px] text-violet-600 font-semibold leading-relaxed mt-0.5">
                    {language === 'ES'
                      ? 'Al registrar este paciente se generará automáticamente una orden médica pendiente de aprobación del médico.'
                      : 'Registering this patient will automatically generate a medical order pending physician approval.'}
                  </p>
                </div>
              </div>
            )}

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

            <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'ES' ? 'Dispositivo Requerido' : 'Required Device'}
                </label>
                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border bg-slate-50 p-2 ${
                  errors.requiredDevice ? 'border-red-500 ring-1 ring-red-500/20' : 'border-slate-300'
                }`}>
                  {DEVICE_OPTIONS.map(device => {
                    const checked = selectedRequiredDevices.includes(device.value);
                    return (
                      <label
                        key={device.value}
                        className={`flex cursor-pointer items-center rounded-lg border px-3 py-2.5 text-xs font-extrabold transition ${
                          checked ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => toggleRequiredDevice(device.value, event.target.checked)}
                          className="mr-2 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        {device.label}
                      </label>
                    );
                  })}
                </div>
                {requiredDevice && (
                  <p className="text-[10px] text-blue-600 font-semibold mt-1">
                    {language === 'ES' ? 'Seleccionado' : 'Selected'}: {requiredDevice}
                  </p>
                )}
                {errors.requiredDevice && <span className="text-[10px] text-red-500 font-semibold mt-0.5 block">{errors.requiredDevice}</span>}
            </div>

            {/* Structured Conditions / Diagnoses Section */}
            <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center justify-between gap-3">
                <label className="block text-xs font-bold text-slate-700">
                  {language === 'ES' ? 'Condiciones / Diagnósticos *' : 'Conditions / Diagnoses *'}
                </label>
                <button
                  type="button"
                  onClick={() => setManualDiagnoses([...manualDiagnoses, createManualDiagnosis()])}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center bg-blue-50 px-2 py-1 rounded-md"
                >
                  + {language === 'ES' ? 'Agregar ICD' : 'Add ICD'}
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
                        {language === 'ES' ? 'Nombre del ICD' : 'ICD Name'}
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
                        placeholder={language === 'ES' ? 'Ej. Type 2 Diabetes Mellitus without complications' : 'e.g. Type 2 Diabetes Mellitus without complications'}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setManualDiagnoses(manualDiagnoses.length === 1 ? [createManualDiagnosis()] : manualDiagnoses.filter(item => item.id !== diagnosis.id))}
                      className="mt-5 px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 bg-white hover:bg-slate-50"
                    >
                      {language === 'ES' ? 'Eliminar' : 'Remove'}
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

            {/* Structured Medications Section */}
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
                    {/* Name */}
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
                    {/* Strength */}
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
                    {/* Frequency */}
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
                        // Prevent duplicates based on name + strength + frequency
                        const isDup = medications.some(m => 
                          m.normalized_medication_name === newMed.normalized_medication_name &&
                          m.strength.toLowerCase() === newMed.strength.toLowerCase() &&
                          m.frequency === newMed.frequency
                        );
                        if (!isDup) {
                          setMedications([...medications, newMed]);
                        }
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

              {/* Medication List */}
              {medications.length > 0 && !isMedicationListPending && (
                <div className="space-y-2 mt-2">
                  {medications.map((med, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white border border-slate-200 px-3 py-2 rounded-lg relative z-10">
                      <div className="text-xs font-semibold text-slate-800">
                        {med.medication_name} {med.strength && <span className="text-slate-500 font-normal">{med.strength}</span>} <span className="text-slate-400 mx-1">—</span> <span className="text-slate-600 font-bold">{med.frequency}</span>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setMedSearch(med.medication_name);
                            setMedStrength(med.strength);
                            setMedFrequency(med.frequency);
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

              {/* Pending Option */}
              <div className="flex items-center pt-2">
                <input
                  type="checkbox"
                  id="meds-pending"
                  checked={isMedicationListPending}
                  onChange={(e) => setIsMedicationListPending(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="meds-pending" className="ml-2 text-xs font-bold text-slate-600 cursor-pointer">
                  {language === 'ES' ? 'Lista de medicamentos no disponible en este momento' : 'Medication list not available at this time'}
                </label>
              </div>
              {errors.medications && (
                <p className="text-xs font-semibold text-red-600">
                  {errors.medications}
                </p>
              )}
            </div>
          </div>

          {/* Footer Controls */}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex flex-col gap-3 rounded-b-2xl sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-5">
              {errors.draft && (
                <p className="text-xs font-semibold text-red-600">
                  {errors.draft}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            {/* Cancel */}
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 transition disabled:opacity-50 cursor-pointer"
            >
              <X size={14} />
              {language === 'ES' ? 'Cancelar' : 'Cancel'}
            </button>
            {/* Draft */}
            <button
              type="button"
              onClick={submitDraft}
              disabled={isSaving}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-amber-300 rounded-xl text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 transition disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <><Loader2 size={14} className="animate-spin" />{language === 'ES' ? 'Guardando...' : 'Saving...'}</>
              ) : (
                <><CheckCircle size={14} />{language === 'ES' ? 'Guardar Draft' : 'Save Draft'}</>
              )}
            </button>
            {/* Register */}
            <button
              type="button"
              onClick={() => submitForm('CLOSE')}
              disabled={isSaving || !meetsCcmConditionsRequirement}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSaving ? (
                <><Loader2 size={14} className="animate-spin" />{language === 'ES' ? 'Guardando...' : 'Saving...'}</>
              ) : (
                <><CheckCheck size={14} />{language === 'ES' ? 'Registrar' : 'Register'}</>
              )}
            </button>
            </div>
          </div>
        </form>
      </div>

      {/* Cancel Confirmation Overlay */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">{language === 'ES' ? '¿Descartar cambios?' : 'Discard changes?'}</h2>
            <p className="mt-2 text-sm text-slate-600">{language === 'ES' ? 'Tienes cambios sin guardar. ¿Estás seguro de que quieres cancelar el registro?' : 'You have unsaved changes. Are you sure you want to cancel registration?'}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowCancelConfirm(false)} className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50">
                {language === 'ES' ? 'Continuar Editando' : 'Continue Editing'}
              </button>
              <button type="button" onClick={() => { setShowCancelConfirm(false); onClose(); }} className="px-4 py-2 rounded-xl bg-rose-600 text-xs font-bold text-white hover:bg-rose-700">
                {language === 'ES' ? 'Descartar' : 'Discard'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
