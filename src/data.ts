import { Patient, User, AuditLog, Consent, Device, BPReading, DocumentRecord, ConditionGroupCatalog, DiagnosisCatalog, ProgramCatalog } from './types';
import { PRACTICE_NAME } from './utils/branding';

export const NURSING_HOMES = [
  'Input Facility',
  'Broward Nursing and Rehabilitation Center',
  'The Pearl at Fort Lauderdale Rehabilitation and Nursing Center',
  'Pinecrest Center for Rehabilitation and Healing',
  'North Dade Rehab',
  'Susanna Wesley',
  'Hamlin Place of Boynton Beach',
  'Terrace of Delray',
  'The Savoy at Fort Lauderdale Rehab',
  'Saint Johns Nursing',
  'The Legacy at Boca Raton Rehabilitation and Nursing Center',
  'Boca Raton Rehabilitation Center',
  'Deerfield Beach Health and Rehabilitation Center',
  'The Palms Care Center',
  'Lakeside Health Center',
  'Lourdes Noreen McKeen',
  'The Encore at Boca',
  'Medicana Nursing and Rehab',
  'Darcy Hall of Life Care',
  'The Gardens Court',
  'Port St. Lucie',
  'Nspire Healthcare Tamarac',
  'Nspire Lauderhill',
  'Willow Bay Deerfield',
  'Rehabilitation Center of the Palm Beaches',
  'The Woodlands at John Knox Pompano',
  'Nspire Plantation',
  'Pines Trail Center Lake Worth',
  'Tiffany Hall Nursing and Rehab',
  'The Palm Nursing Home',
  'Royal Palm Nursing',
  'Palm City Nursing and Rehab',
  'Okeechobee Nursing',
  'Point Beach Rehab',
  'Villa Maria Nursing',
  'Boynton Beach Nursing',
  'State Veterans - Port St. Lucie',
  'The Luxe at Wellington'
];

export const SEED_USERS: User[] = [
  {
    id: 'nurse_sofia',
    name: 'Sofia Rodriguez, RN',
    role: 'NURSE',
    email: 'sofia.nurse@amavita.com',
    nursingHomeAccess: [...NURSING_HOMES]
  },
  {
    id: 'nurse_carmen',
    name: 'Carmen Ortiz, LPN',
    role: 'NURSE',
    email: 'carmen.nurse@amavita.com',
    nursingHomeAccess: [...NURSING_HOMES]
  },
  {
    id: 'admin_luis',
    name: 'Luis Mendoza',
    role: 'ADMIN',
    email: 'mdavid@itera.health' // Matches current user email for a seamless experience
  },
  {
    id: 'physician_dr_chen',
    name: 'Dr. Robert Chen (Supervising Physician)',
    role: 'ADMIN',
    email: 'dr.chen@amavita.com'
  }
];

export const PROGRAMS = [
  'CCM',
  'RPM',
  'CCM + RPM',
  'CCM + PCM',
  'CCM + RPM + PCM',
  'PCM',
  'RTM',
  'Other'
];

export const DEFAULT_PROGRAM_CATALOG: ProgramCatalog[] = [
  { id: 'program_ccm', code: 'CCM', display: 'CCM', description: 'Chronic Care Management', is_active: true, requires_device: false, source: 'default' },
  { id: 'program_rpm', code: 'RPM', display: 'RPM', description: 'Remote Patient Monitoring', is_active: true, requires_device: true, source: 'default' },
  { id: 'program_pcm', code: 'PCM', display: 'PCM', description: 'Principal Care Management', is_active: true, requires_device: false, source: 'default' },
  { id: 'program_rtm', code: 'RTM', display: 'RTM', description: 'Remote Therapeutic Monitoring', is_active: false, requires_device: true, source: 'default' },
  { id: 'program_other', code: 'Other', display: 'Other', description: 'Other configured service', is_active: false, requires_device: false, source: 'default' }
];

export const DEFAULT_CONDITION_GROUP_CATALOG: ConditionGroupCatalog[] = [
  { id: 'cg_dm', code: 'DM', display: 'Diabetes Mellitus', description: 'Diabetes and related metabolic diagnoses.', icd10_count: 4, is_active: true, imported_at: '', imported_by: 'System', source: 'default' },
  { id: 'cg_hhk', code: 'HHK', display: 'Hypertension - Heart - Kidney', description: 'Hypertension, heart failure, and kidney disease.', icd10_count: 4, is_active: true, imported_at: '', imported_by: 'System', source: 'default' },
  { id: 'cg_cvc', code: 'CVC', display: 'Cardiovascular Comorbidities', description: 'Cardiac rhythm, coronary artery, and valve disease.', icd10_count: 2, is_active: true, imported_at: '', imported_by: 'System', source: 'default' },
  { id: 'cg_copd', code: 'COPD', display: 'Chronic Obstructive Pulmonary Disease', description: 'COPD and chronic lung disease.', icd10_count: 1, is_active: true, imported_at: '', imported_by: 'System', source: 'default' },
  { id: 'cg_ckd', code: 'CKD', display: 'Chronic Kidney Disease', description: 'CKD stages and ESRD.', icd10_count: 1, is_active: true, imported_at: '', imported_by: 'System', source: 'default' },
  { id: 'cg_bh', code: 'BH', display: 'Behavioral Health', description: 'Depression, anxiety, and related behavioral health conditions.', icd10_count: 1, is_active: true, imported_at: '', imported_by: 'System', source: 'default' },
  { id: 'cg_oa', code: 'OA', display: 'Osteoarthritis', description: 'Osteoarthritis and degenerative joint disease.', icd10_count: 1, is_active: true, imported_at: '', imported_by: 'System', source: 'default' },
  { id: 'cg_dem', code: 'DEM', display: 'Dementia and Neurocognitive Disorders', description: 'Dementia, Alzheimer disease, and vascular dementia.', icd10_count: 1, is_active: true, imported_at: '', imported_by: 'System', source: 'default' }
];

export const DEFAULT_DIAGNOSIS_CATALOG: DiagnosisCatalog[] = [
  { id: 'dx_dm_e119', condition_group_id: 'cg_dm', condition_group_code: 'DM', icd10_code: 'E11.9', icd10_display: 'Type 2 Diabetes Mellitus without complications', icd10_description: 'Type 2 Diabetes Mellitus without complications', is_active: true, imported_at: '', imported_by: 'System', source: 'default', relationship_status: 'ACTIVE' },
  { id: 'dx_dm_e1121', condition_group_id: 'cg_dm', condition_group_code: 'DM', icd10_code: 'E11.21', icd10_display: 'Type 2 Diabetes Mellitus with diabetic nephropathy', icd10_description: 'Type 2 Diabetes Mellitus with diabetic nephropathy', is_active: true, imported_at: '', imported_by: 'System', source: 'default', relationship_status: 'ACTIVE' },
  { id: 'dx_dm_e1142', condition_group_id: 'cg_dm', condition_group_code: 'DM', icd10_code: 'E11.42', icd10_display: 'Type 2 Diabetes Mellitus with diabetic polyneuropathy', icd10_description: 'Type 2 Diabetes Mellitus with diabetic polyneuropathy', is_active: true, imported_at: '', imported_by: 'System', source: 'default', relationship_status: 'ACTIVE' },
  { id: 'dx_dm_e109', condition_group_id: 'cg_dm', condition_group_code: 'DM', icd10_code: 'E10.9', icd10_display: 'Type 1 Diabetes Mellitus without complications', icd10_description: 'Type 1 Diabetes Mellitus without complications', is_active: true, imported_at: '', imported_by: 'System', source: 'default', relationship_status: 'ACTIVE' },
  { id: 'dx_hhk_i10', condition_group_id: 'cg_hhk', condition_group_code: 'HHK', icd10_code: 'I10', icd10_display: 'Essential Hypertension', icd10_description: 'Essential Hypertension', is_active: true, imported_at: '', imported_by: 'System', source: 'default', relationship_status: 'ACTIVE' },
  { id: 'dx_hhk_i110', condition_group_id: 'cg_hhk', condition_group_code: 'HHK', icd10_code: 'I11.0', icd10_display: 'Hypertensive Heart Disease with Heart Failure', icd10_description: 'Hypertensive Heart Disease with Heart Failure', is_active: true, imported_at: '', imported_by: 'System', source: 'default', relationship_status: 'ACTIVE' },
  { id: 'dx_hhk_i129', condition_group_id: 'cg_hhk', condition_group_code: 'HHK', icd10_code: 'I12.9', icd10_display: 'Hypertensive Chronic Kidney Disease', icd10_description: 'Hypertensive Chronic Kidney Disease', is_active: true, imported_at: '', imported_by: 'System', source: 'default', relationship_status: 'ACTIVE' },
  { id: 'dx_hhk_i509', condition_group_id: 'cg_hhk', condition_group_code: 'HHK', icd10_code: 'I50.9', icd10_display: 'Congestive Heart Failure', icd10_description: 'Congestive Heart Failure', is_active: true, imported_at: '', imported_by: 'System', source: 'default', relationship_status: 'ACTIVE' },
  { id: 'dx_cvc_i4891', condition_group_id: 'cg_cvc', condition_group_code: 'CVC', icd10_code: 'I48.91', icd10_display: 'Atrial Fibrillation', icd10_description: 'Atrial Fibrillation', is_active: true, imported_at: '', imported_by: 'System', source: 'default', relationship_status: 'ACTIVE' },
  { id: 'dx_cvc_i2510', condition_group_id: 'cg_cvc', condition_group_code: 'CVC', icd10_code: 'I25.10', icd10_display: 'Coronary Artery Disease', icd10_description: 'Coronary Artery Disease', is_active: true, imported_at: '', imported_by: 'System', source: 'default', relationship_status: 'ACTIVE' },
  { id: 'dx_copd_j449', condition_group_id: 'cg_copd', condition_group_code: 'COPD', icd10_code: 'J44.9', icd10_display: 'Chronic Obstructive Pulmonary Disease, Unspecified', icd10_description: 'Chronic Obstructive Pulmonary Disease, Unspecified', is_active: true, imported_at: '', imported_by: 'System', source: 'default', relationship_status: 'ACTIVE' },
  { id: 'dx_ckd_n1830', condition_group_id: 'cg_ckd', condition_group_code: 'CKD', icd10_code: 'N18.30', icd10_display: 'Chronic Kidney Disease, Stage 3', icd10_description: 'Chronic Kidney Disease, Stage 3', is_active: true, imported_at: '', imported_by: 'System', source: 'default', relationship_status: 'ACTIVE' },
  { id: 'dx_bh_f331', condition_group_id: 'cg_bh', condition_group_code: 'BH', icd10_code: 'F33.1', icd10_display: 'Major Depressive Disorder, Recurrent, Moderate', icd10_description: 'Major Depressive Disorder, Recurrent, Moderate', is_active: true, imported_at: '', imported_by: 'System', source: 'default', relationship_status: 'ACTIVE' },
  { id: 'dx_oa_m1990', condition_group_id: 'cg_oa', condition_group_code: 'OA', icd10_code: 'M19.90', icd10_display: 'Osteoarthritis, Unspecified Site', icd10_description: 'Osteoarthritis, Unspecified Site', is_active: true, imported_at: '', imported_by: 'System', source: 'default', relationship_status: 'ACTIVE' },
  { id: 'dx_dem_g309', condition_group_id: 'cg_dem', condition_group_code: 'DEM', icd10_code: 'G30.9', icd10_display: "Alzheimer's Disease, Unspecified", icd10_description: "Alzheimer's Disease, Unspecified", is_active: true, imported_at: '', imported_by: 'System', source: 'default', relationship_status: 'ACTIVE' }
];

export const SEED_PATIENTS: Patient[] = [
  {
    id: 'pat_eleanor',
    firstName: 'Eleanor',
    lastName: 'Vance',
    birthDate: '1938-04-12',
    medicareId: '1EG4-TE5-WY22',
    nursingHome: 'Broward Nursing and Rehabilitation Center',
    room: '104-B',
    provider: 'Dr. Robert Chen',
    practice: PRACTICE_NAME,
    assignedProgram: 'RPM',
    conditions: ['Hypertension', 'Type 2 Diabetes', 'Osteoarthritis'],
    medications: ['Lisinopril 10mg daily', 'Metformin 500mg BID', 'Atorvastatin 20mg daily'],
    requiredDevice: 'BP Monitor',
    medicalOrder: {
      id: 'ord_pat_eleanor',
      status: 'ORDER_REQUIRED',
      createdAt: '',
      createdBy: '',
      createdByUserId: '',
      assignedPhysician: 'Dr. Robert Chen',
      orderVersion: 'order_v2026_07_01',
      auditTrail: []
    },
    status: 'PENDING_CONSENT',
    assignedNurseId: 'nurse_sofia',
    assignedNurseName: 'Sofia Rodriguez, RN'
  },
  {
    id: 'pat_arthur',
    firstName: 'Arthur',
    lastName: 'Pendelton',
    birthDate: '1941-11-23',
    medicareId: '3HN9-RE2-PL90',
    nursingHome: 'Broward Nursing and Rehabilitation Center',
    room: '212-A',
    provider: 'Dr. Robert Chen',
    practice: PRACTICE_NAME,
    assignedProgram: 'CCM + RPM',
    conditions: ['Stage III Chronic Kidney Disease', 'Congestive Heart Failure', 'Severe Hypertension'],
    medications: ['Furosemide 40mg daily', 'Carvedilol 6.25mg BID', 'Losartan 50mg daily'],
    requiredDevice: 'BP Monitor',
    medicalOrder: {
      id: 'ord_pat_arthur',
      status: 'ORDER_PENDING_PHYSICIAN_APPROVAL',
      createdAt: '2026-06-30T10:15:00Z',
      createdBy: 'Sofia Rodriguez, RN',
      createdByUserId: 'nurse_sofia',
      assignedPhysician: 'Dr. Robert Chen',
      orderVersion: 'order_v2026_07_01',
      submittedAt: '2026-06-30T10:15:00Z',
      auditTrail: [
        {
          action: 'CREATED',
          dateTime: '2026-06-30T10:15:00Z',
          userId: 'nurse_sofia',
          userName: 'Sofia Rodriguez, RN',
          notes: 'Order generated and sent to Dr. Robert Chen for review.'
        }
      ]
    },
    status: 'INCOMPLETE',
    assignedNurseId: 'nurse_sofia',
    assignedNurseName: 'Sofia Rodriguez, RN'
  },
  {
    id: 'pat_clara',
    firstName: 'Clara',
    lastName: 'Bow',
    birthDate: '1936-07-29',
    medicareId: '8KJ3-DF4-ZX77',
    nursingHome: 'Pinecrest Center for Rehabilitation and Healing',
    room: '310-C',
    provider: 'Dr. Linda Gross',
    practice: PRACTICE_NAME,
    assignedProgram: 'RPM',
    conditions: ['Hypertension', 'Mild Cognitive Impairment'],
    medications: ['Amlodipine 5mg daily', 'Donepezil 5mg nightly'],
    requiredDevice: 'BP Monitor',
    medicalOrder: {
      id: 'ord_pat_clara',
      status: 'ORDER_APPROVED',
      createdAt: '2026-06-29T09:30:00Z',
      createdBy: 'Sofia Rodriguez, RN',
      createdByUserId: 'nurse_sofia',
      assignedPhysician: 'Dr. Linda Gross',
      orderVersion: 'order_v2026_07_01',
      submittedAt: '2026-06-29T09:30:00Z',
      approvedAt: '2026-06-29T11:05:00Z',
      reviewedBy: 'Dr. Linda Gross',
      reviewedByUserId: 'phys_linda_gross',
      auditTrail: [
        {
          action: 'CREATED',
          dateTime: '2026-06-29T09:30:00Z',
          userId: 'nurse_sofia',
          userName: 'Sofia Rodriguez, RN',
          notes: 'Order generated and sent to Dr. Linda Gross for review.'
        },
        {
          action: 'APPROVED',
          dateTime: '2026-06-29T11:05:00Z',
          userId: 'phys_linda_gross',
          userName: 'Dr. Linda Gross',
          notes: 'Order approved by Dr. Linda Gross.'
        }
      ]
    },
    status: 'DEVICE_PENDING',
    assignedNurseId: 'nurse_sofia',
    assignedNurseName: 'Sofia Rodriguez, RN'
  },
  {
    id: 'pat_maria',
    firstName: 'Maria',
    lastName: 'Gomez',
    birthDate: '1935-08-05',
    medicareId: '7UY3-MK8-QA11',
    nursingHome: 'The Pearl at Fort Lauderdale Rehabilitation and Nursing Center',
    room: '305',
    provider: 'Dr. Sofia Alvarez',
    practice: 'ITERA Geriatrics',
    assignedProgram: 'CCM',
    conditions: ['COPD', 'Hypertension', 'Osteoporosis'],
    medications: ['Symbicort Inhaler BID', 'Albuterol HFA PRN', 'Alendronate 70mg weekly'],
    requiredDevice: 'None',
    status: 'PENDING_CONSENT',
    assignedNurseId: 'nurse_carmen',
    assignedNurseName: 'Carmen Ortiz, LPN'
  },
  {
    id: 'pat_henry',
    firstName: 'Henry',
    lastName: 'Adams',
    birthDate: '1932-12-01',
    medicareId: '9PO2-XC3-VB44',
    nursingHome: 'The Pearl at Fort Lauderdale Rehabilitation and Nursing Center',
    room: '201',
    provider: 'Dr. Sofia Alvarez',
    practice: 'ITERA Geriatrics',
    assignedProgram: 'RPM',
    conditions: ['COPD', 'Congestive Heart Failure'],
    medications: ['Spironolactone 25mg daily', 'Sotalol 80mg BID', 'Advair HFA inhaler'],
    requiredDevice: 'Scale',
    medicalOrder: {
      id: 'ord_pat_henry',
      status: 'ORDER_REJECTED_NEEDS_REVISION',
      createdAt: '2026-06-30T13:00:00Z',
      createdBy: 'Carmen Ortiz, LPN',
      createdByUserId: 'nurse_carmen',
      assignedPhysician: 'Dr. Sofia Alvarez',
      orderVersion: 'order_v2026_07_01',
      submittedAt: '2026-06-30T13:00:00Z',
      rejectedAt: '2026-06-30T15:10:00Z',
      reviewedBy: 'Dr. Sofia Alvarez',
      reviewedByUserId: 'phys_sofia_alvarez',
      revisionNotes: 'Device type requires confirmation before approval.',
      auditTrail: [
        {
          action: 'CREATED',
          dateTime: '2026-06-30T13:00:00Z',
          userId: 'nurse_carmen',
          userName: 'Carmen Ortiz, LPN',
          notes: 'Order generated and sent to Dr. Sofia Alvarez for review.'
        },
        {
          action: 'REJECTED_NEEDS_REVISION',
          dateTime: '2026-06-30T15:10:00Z',
          userId: 'phys_sofia_alvarez',
          userName: 'Dr. Sofia Alvarez',
          notes: 'Device type requires confirmation before approval.'
        }
      ]
    },
    status: 'NEEDS_FOLLOW_UP',
    assignedNurseId: 'nurse_carmen',
    assignedNurseName: 'Carmen Ortiz, LPN'
  },
  {
    id: 'pat_george',
    firstName: 'George',
    lastName: 'Harrison',
    birthDate: '1944-02-25',
    medicareId: '2YT6-GH3-IU55',
    nursingHome: 'Pinecrest Center for Rehabilitation and Healing',
    room: '115',
    provider: 'Dr. Linda Gross',
    practice: PRACTICE_NAME,
    assignedProgram: 'PCM',
    conditions: ['Parkinson\'s Disease', 'Hypertension'],
    medications: ['Carbidopa-Levodopa 25-100mg TID', 'Amlodipine 10mg daily'],
    requiredDevice: 'None',
    status: 'ACTIVE',
    assignedNurseId: 'nurse_sofia',
    assignedNurseName: 'Sofia Rodriguez, RN',
    activationDate: '2026-06-28T14:30:00Z',
    activatedBy: 'nurse_sofia'
  }
];

export const DEFAULT_EXPLANATION_SCRIPT = 
  "Today I will explain the selected healthcare service available to you. This service helps your care team follow your health and contact you when support is needed. Participation is voluntary. You may stop at any time.";

export const DEFAULT_EXPLANATION_SCRIPT_ES =
  "Hoy le explicaré el servicio de gestión del cuidado y/o monitoreo remoto disponible para usted. Estos servicios ayudan a su equipo de atención a dar seguimiento a su salud entre visitas, monitorear sus lecturas cuando corresponda y contactarle cuando necesite apoyo. La participación es voluntaria. Puede retirarse en cualquier momento.";

export const DEFAULT_CONSENT_TEXT = 
  "You agree to participate in {SERVICE}.\n\n" +
  "These services are voluntary. You may stop them at any time.\n\n" +
  "Your health information will be protected and used only as allowed by law.\n\n" +
  "Your health plan may cover these services. A copay or other cost-sharing may apply.\n\n" +
  "You confirm that you are not receiving the same service from another provider or practice.\n\n" +
  "Your device sends readings to your care team. Use it as directed and take your readings as instructed.";

export const DEFAULT_CONSENT_TEXT_ES =
  "Usted acepta participar en {SERVICE}.\n\n" +
  "Estos servicios son voluntarios. Puede cancelarlos en cualquier momento.\n\n" +
  "Su información médica estará protegida y se utilizará únicamente según lo permitido por la ley.\n\n" +
  "Su plan de salud puede cubrir estos servicios. Puede aplicar un copago u otro costo compartido.\n\n" +
  "Usted confirma que no recibe el mismo servicio de otro proveedor o práctica médica.\n\n" +
  "Su dispositivo envía lecturas a su equipo de atención. Úselo según las indicaciones y tome sus lecturas según las instrucciones.";

export const SEED_AUDITS: AuditLog[] = [
  {
    id: 'audit_init',
    userId: 'admin_luis',
    userName: 'Luis Mendoza',
    userRole: 'ADMIN',
    action: 'System initialized with seed data',
    dateTime: '2026-06-29T08:00:00-07:00',
    entityType: 'GENERAL',
    details: 'Initial system load with 6 pre-configured patient records.'
  }
];
