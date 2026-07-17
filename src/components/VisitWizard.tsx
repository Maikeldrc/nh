import React, { useState, useEffect, useRef } from 'react';
import { Patient, Visit, Consent, Device, BPReading, User, DocumentRecord, TechnicalActivationStatus, ConditionGroupCatalog, DiagnosisCatalog } from '../types';
import SignaturePad from './SignaturePad';
import { 
  Check, ArrowRight, ArrowLeft, Save, AlertTriangle, ShieldAlert,
  Smartphone, UserCheck, FileText, CheckCircle, Activity, Play, Info, Edit3, AlertCircle, RefreshCw,
  UserRound, ShieldCheck, UsersRound, FileSignature, Type, AudioLines, Pencil,
  X as XIcon, UserRoundCheck, Bookmark, Clock3, Monitor, ScanBarcode, GraduationCap,
  HeartPulse, ClipboardCheck, FileCheck, LogOut
} from 'lucide-react';
import { DEFAULT_EXPLANATION_SCRIPT, DEFAULT_EXPLANATION_SCRIPT_ES, DEFAULT_CONSENT_TEXT, DEFAULT_CONSENT_TEXT_ES } from '../data';
import { useLanguage } from '../utils/LanguageContext';
import EditPatientModal from './EditPatientModal';
import { getMedicalOrderStatus, isMedicalOrderApproved, patientRequiresDevice } from '../utils/medicalOrders';
import { POWERED_BY, PRODUCT_NAME } from '../utils/branding';

interface VisitWizardProps {
  currentUser: User;
  patient: Patient;
  existingVisit?: Visit;
  onSaveAndExit: (
    visit: Visit,
    consent?: Consent,
    device?: Device,
    reading?: BPReading | BPReading[],
    triggerActivation?: boolean
  ) => void;
  onCancel: () => void;
  onGenerateConsentPDF: (consent: Consent, callback: (pdfDataUrl: string) => void) => Promise<void>;
  onGenerateDeliveryPDF: (device: Device, callback: (pdfDataUrl: string) => void) => Promise<void>;
  onUpdatePatient?: (updatedPatient: Patient) => void;
  onGenerateMedicalOrder: (patientId: string, deviceType?: string) => void;
  nursingHomes: string[];
  conditionGroups: ConditionGroupCatalog[];
  diagnoses: DiagnosisCatalog[];
}

const TECHNICAL_ACTIVATION_STATUS_OPTIONS: Array<{
  value: TechnicalActivationStatus;
  es: string;
  en: string;
  descriptionEs: string;
  descriptionEn: string;
}> = [
  {
    value: 'NOT_STARTED',
    es: 'No iniciado',
    en: 'Not Started',
    descriptionEs: 'La activación no ha comenzado.',
    descriptionEn: 'Activation has not started.'
  },
  {
    value: 'PENDING_ORDER_APPROVAL',
    es: 'Pendiente de aprobación de orden',
    en: 'Pending Order Approval',
    descriptionEs: 'Esperando la aprobación del médico.',
    descriptionEn: 'Waiting for physician approval.'
  },
  {
    value: 'DELIVERED_ASSIGNED',
    es: 'Entregado / Asignado',
    en: 'Delivered / Assigned',
    descriptionEs: 'Dispositivo entregado y vinculado.',
    descriptionEn: 'Device delivered and linked.'
  },
  {
    value: 'AWAITING_FIRST_READING',
    es: 'Esperando primera lectura',
    en: 'Awaiting First Reading',
    descriptionEs: 'Esperando la primera lectura válida.',
    descriptionEn: 'Waiting for first valid reading.'
  },
  {
    value: 'ACTIVE',
    es: 'Activo',
    en: 'Active',
    descriptionEs: 'Primera lectura recibida.',
    descriptionEn: 'First reading received.'
  },
  {
    value: 'NEEDS_SUPPORT',
    es: 'Requiere soporte',
    en: 'Needs Support',
    descriptionEs: 'El problema requiere asistencia.',
    descriptionEn: 'Issue requires assistance.'
  }
];

const CONSENT_TEXT_VERSION = 'v2.0 AMAVITA_ITERA';
const CONSENT_TEXT_EFFECTIVE_DATE = 'July 1, 2026';
const FULL_CONSENT_SECTIONS = [
  {
    title: 'About these services',
    body: 'Your provider offers care management and remote monitoring to help support your health between visits. These services may include care coordination, regular check-ins, help managing chronic conditions, a personal care plan, and remote monitoring if a connected device is assigned to you.'
  },
  {
    title: 'Your participation is voluntary',
    body: 'Taking part is your choice. You may stop these services at any time. For services billed each month, stopping takes effect at the end of the current month. Your decision will not affect your other Medicare benefits or your regular care.'
  },
  {
    title: 'Costs',
    body: 'Your health plan may cover these services. Depending on your plan, a copay, coinsurance, or deductible may apply.'
  },
  {
    title: 'Only one provider',
    body: 'Only one provider can be paid for the same service in a given period. To your knowledge, you are not receiving these services from another provider or practice.'
  },
  {
    title: 'Your health information',
    body: 'Your health information is protected under HIPAA. To provide these services, your care team may keep an electronic care plan and use or share your health information electronically with other providers involved in your care, as allowed by law.'
  },
  {
    title: 'Devices and remote monitoring',
    body: 'If a device is assigned to you, you agree to use the device as directed and take your readings as instructed. Your readings are sent securely to your care team to help manage your health. You agree to return the device if your services end or if your care team asks you to return it.'
  },
  {
    title: 'Emergency care',
    body: 'These services are not emergency services. Your care team may not review your messages, readings, or health information in real time. If you have a medical emergency, call 911.'
  },
  {
    title: 'Stopping these services',
    body: 'You may stop at any time by telling your care team. For monthly services, your stop takes effect at the end of the current month.'
  }
] as const;
const FULL_CONSENT_LEGAL_TEXT = FULL_CONSENT_SECTIONS
  .map(({ title, body }) => `${title}\n${body}`)
  .join('\n\n');

export default function VisitWizard({
  currentUser,
  patient,
  existingVisit,
  onSaveAndExit,
  onCancel,
  onGenerateConsentPDF,
  onGenerateDeliveryPDF,
  onUpdatePatient,
  onGenerateMedicalOrder,
  nursingHomes,
  conditionGroups,
  diagnoses
}: VisitWizardProps) {
  const { language, t } = useLanguage();
  const l = (es: string, en: string) => language === 'ES' ? es : en;
  const STEP2_GUIDE_SCRIPT_VERSION = 'amavita_step2_guide_v2026_06_30';
  const savedForm = (existingVisit?.formState || {}) as Record<string, unknown>;
  const savedBool = (key: string, fallback = false) => typeof savedForm[key] === 'boolean' ? Boolean(savedForm[key]) : fallback;
  const savedString = (key: string, fallback = '') => typeof savedForm[key] === 'string' ? String(savedForm[key]) : fallback;
  const savedChoice = <T extends string>(key: string, fallback: T): T => typeof savedForm[key] === 'string' ? savedForm[key] as T : fallback;
  const normalizedInitialStep = existingVisit?.currentStep ? Math.min(existingVisit.currentStep, 3) : 1;

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // ----------------------------------------------------
  // INITIAL STATE HANDLERS
  // ----------------------------------------------------
  
  // Current active step (1 to 5)
  const [step, setStep] = useState(normalizedInitialStep);


  // STEP 1: IDENTITY CONFIRMATION
  const [idConfirmed, setIdConfirmed] = useState(savedBool('idConfirmed'));
  const [patientAvailable, setPatientAvailable] = useState(savedBool('patientAvailable'));
  const [patientCanDecide, setPatientCanDecide] = useState(savedBool('patientCanDecide'));
  const [repPresent, setRepPresent] = useState(savedBool('repPresent'));
  const [representativeAvailability, setRepresentativeAvailability] = useState<'NONE' | 'FAMILY' | 'LEGAL' | 'REMOTE'>(savedChoice('representativeAvailability', 'NONE'));
  const [readinessRepName, setReadinessRepName] = useState(savedString('readinessRepName'));
  const [readinessRepRelationship, setReadinessRepRelationship] = useState(savedString('readinessRepRelationship'));
  const [readinessRepAuthority, setReadinessRepAuthority] = useState<'HEALTH_CARE_PROXY' | 'POWER_OF_ATTORNEY' | 'GUARDIAN' | 'OTHER' | ''>(savedChoice('readinessRepAuthority', ''));
  const [readinessRepPhone, setReadinessRepPhone] = useState(savedString('readinessRepPhone'));
  const [readinessRepEmail, setReadinessRepEmail] = useState(savedString('readinessRepEmail'));
  const [representativeContactMode, setRepresentativeContactMode] = useState<'IN_PERSON' | 'PHONE' | 'VIDEO'>(savedChoice('representativeContactMode', 'IN_PERSON'));
  const [preferredExplanationLanguage, setPreferredExplanationLanguage] = useState<'English' | 'Spanish' | 'Other'>(savedChoice('preferredExplanationLanguage', language === 'ES' ? 'Spanish' : 'English'));
  const [decisionMaker, setDecisionMaker] = useState<'PATIENT' | 'REPRESENTATIVE'>(savedChoice('decisionMaker', 'PATIENT'));
  const [participationDecisionPath, setParticipationDecisionPath] = useState<'PATIENT' | 'REPRESENTATIVE' | ''>(() => {
    const savedPath = savedChoice<'PATIENT' | 'REPRESENTATIVE' | ''>('participationDecisionPath', '');
    if (savedPath) return savedPath;
    if (savedChoice<'PATIENT' | 'REPRESENTATIVE'>('decisionMaker', 'PATIENT') === 'REPRESENTATIVE') return 'REPRESENTATIVE';
    return savedBool('patientCanDecide') ? 'PATIENT' : '';
  });

  // STEP 2: SERVICE EXPLANATION
  const [explainedService, setExplainedService] = useState(savedBool('explainedService'));
  const [explainedVoluntary, setExplainedVoluntary] = useState(savedBool('explainedVoluntary'));
  const [explainedStopAnytime, setExplainedStopAnytime] = useState(savedBool('explainedStopAnytime'));
  const [explainedCostSharing, setExplainedCostSharing] = useState(savedBool('explainedCostSharing'));
  const [explainedSingleProvider, setExplainedSingleProvider] = useState(savedBool('explainedSingleProvider'));
  const [explainedContact, setExplainedContact] = useState(savedBool('explainedContact'));
  const [explainedDeviceUsage, setExplainedDeviceUsage] = useState(savedBool('explainedDeviceUsage'));
  const [explainedQuestionsTime, setExplainedQuestionsTime] = useState(savedBool('explainedQuestionsTime'));
  const [patientUnderstood, setPatientUnderstood] = useState(savedBool('patientUnderstood'));
  const [serviceExplanationConfirmed, setServiceExplanationConfirmed] = useState(savedBool('serviceExplanationConfirmed'));
  const [explanationLanguage, setExplanationLanguage] = useState<'English' | 'Spanish' | 'Other'>(savedChoice('explanationLanguage', language === 'ES' ? 'Spanish' : 'English'));
  const [interpreterUsed, setInterpreterUsed] = useState(savedBool('interpreterUsed'));
  const [interpreterName, setInterpreterName] = useState(savedString('interpreterName'));
  const [showDetailedEnrollmentGuide, setShowDetailedEnrollmentGuide] = useState(savedBool('showDetailedEnrollmentGuide'));
  const [wantsPatientAppInfo, setWantsPatientAppInfo] = useState<'YES' | 'NO' | ''>(savedChoice('wantsPatientAppInfo', ''));

  // STEP 3: PATIENT CONSENT
  const [consentDecision, setConsentDecision] = useState<'ACCEPT' | 'DECLINE' | null>(savedChoice<'ACCEPT' | 'DECLINE' | ''>('consentDecision', '') || null);
  const consentDeclined = consentDecision === 'DECLINE';
  const [consentSignerType, setConsentSignerType] = useState<'PATIENT' | 'REPRESENTATIVE' | 'UNABLE'>(savedChoice('consentSignerType', 'PATIENT'));
  const [signerName, setSignerName] = useState(savedString('signerName', `${patient.firstName} ${patient.lastName}`));
  const [repRelationship, setRepRelationship] = useState(savedString('repRelationship'));
  const [authorityType, setAuthorityType] = useState<'HEALTH_CARE_PROXY' | 'POWER_OF_ATTORNEY' | 'GUARDIAN' | 'OTHER' | ''>(savedChoice('authorityType', ''));
  const [representativePhone, setRepresentativePhone] = useState(savedString('representativePhone'));
  const [representativeEmail, setRepresentativeEmail] = useState(savedString('representativeEmail'));
  const [representativeSignatureMethod, setRepresentativeSignatureMethod] = useState<'IN_PERSON' | 'REMOTE_LINK' | 'PHONE_VIDEO_VERBAL'>(savedChoice('representativeSignatureMethod', 'IN_PERSON'));
  const [signatureMethod, setSignatureMethod] = useState<'DRAW' | 'TYPE' | 'UNABLE'>(savedChoice('signatureMethod', 'DRAW'));
  const [typedSignatureName, setTypedSignatureName] = useState(savedString('typedSignatureName'));
  const [typedSignatureAgreed, setTypedSignatureAgreed] = useState(savedBool('typedSignatureAgreed'));
  const [typedSignatureConfirmed, setTypedSignatureConfirmed] = useState(savedBool('typedSignatureConfirmed'));
  const [unableSignMethod, setUnableSignMethod] = useState<'VERBAL' | 'MARK_X' | 'REPRESENTATIVE_SIGNATURE' | ''>(savedChoice('unableSignMethod', ''));
  const [unableToSignReason, setUnableToSignReason] = useState(savedString('unableToSignReason'));
  const [unableConsentConfirmed, setUnableConsentConfirmed] = useState(savedBool('unableConsentConfirmed'));
  const [declineReason, setDeclineReason] = useState(savedString('declineReason'));
  const [declineNotes, setDeclineNotes] = useState(savedString('declineNotes'));
  const [verbalConsentNurseNote, setVerbalConsentNurseNote] = useState(savedString('verbalConsentNurseNote'));
  const [patientSignature, setPatientSignature] = useState(savedString('patientSignature'));
  const [nurseSignature, setNurseSignature] = useState(savedString('nurseSignature'));
  const [attestationExplained, setAttestationExplained] = useState(savedBool('attestationExplained'));
  const [attestationQuestions, setAttestationQuestions] = useState(savedBool('attestationQuestions'));
  const [attestationVoluntary, setAttestationVoluntary] = useState(savedBool('attestationVoluntary'));
  const [attestationCosts, setAttestationCosts] = useState(savedBool('attestationCosts'));
  const [attestationWitnessed, setAttestationWitnessed] = useState(savedBool('attestationWitnessed'));
  const [staffAttestationConfirmed, setStaffAttestationConfirmed] = useState(savedBool('staffAttestationConfirmed'));
  const [markWitnessName, setMarkWitnessName] = useState(savedString('markWitnessName'));
  const [markWitnessRole, setMarkWitnessRole] = useState(savedString('markWitnessRole'));
  const [markWitnessAttested, setMarkWitnessAttested] = useState(savedBool('markWitnessAttested'));
  const [consentPdfUrl, setConsentPdfUrl] = useState('');
  const [consentPdfGenerated, setConsentPdfGenerated] = useState(false);
  const [isGeneratingConsentPdf, setIsGeneratingConsentPdf] = useState(false);
  const [autoConsentPdfAttempted, setAutoConsentPdfAttempted] = useState(false);
  const [consentPdfProgress, setConsentPdfProgress] = useState(0);
  const [consentPdfProgressLabel, setConsentPdfProgressLabel] = useState('');
  const [showFullConsent, setShowFullConsent] = useState(false);
  const previousSignatureMethodRef = useRef(signatureMethod);
  const isVerbalConsent = signatureMethod === 'UNABLE' && unableSignMethod === 'VERBAL';
  const isMarkXConsent = signatureMethod === 'UNABLE' && unableSignMethod === 'MARK_X';
  const needsRepresentativeDetails = consentSignerType === 'REPRESENTATIVE' ||
    (signatureMethod === 'UNABLE' && unableSignMethod === 'REPRESENTATIVE_SIGNATURE');
  const representativeComplete = !needsRepresentativeDetails ||
    Boolean(signerName.trim() && repRelationship.trim() && authorityType && representativePhone.trim() && representativeSignatureMethod);
  const typedSignatureComplete = Boolean(typedSignatureName.trim() && typedSignatureAgreed && typedSignatureConfirmed);
  const unableConsentComplete = signatureMethod !== 'UNABLE' || Boolean(
    unableSignMethod &&
    (isVerbalConsent || unableToSignReason.trim()) &&
    (!isMarkXConsent || patientSignature) &&
    (!isMarkXConsent || (markWitnessName.trim() && markWitnessRole.trim() && markWitnessAttested)) &&
    unableConsentConfirmed
  );
  const patientEvidenceComplete =
    signatureMethod === 'DRAW' ? Boolean(patientSignature) :
    signatureMethod === 'TYPE' ? typedSignatureComplete :
    unableConsentComplete;
  const nurseAttestationComplete = Boolean(nurseSignature || staffAttestationConfirmed);
  const consentRecordComplete = consentDecision === 'ACCEPT' &&
    representativeComplete &&
    Boolean(signerName.trim()) &&
    patientEvidenceComplete &&
    nurseAttestationComplete;

  // STEP 4: DEVICE DELIVERY
  const [deviceType, setDeviceType] = useState<'BP Monitor' | 'Scale' | 'Pulse Oximeter' | 'Glucometer' | 'Other'>(savedChoice('deviceType', 'BP Monitor'));
  const [brand, setBrand] = useState(savedString('brand', 'ITERA Health Monitor'));
  const [model, setModel] = useState(savedString('model', 'IT-RPM-500'));
  const [serialNumber, setSerialNumber] = useState(savedString('serialNumber'));
  const [kitId, setKitId] = useState(savedString('kitId'));
  const [deviceId, setDeviceId] = useState(savedString('deviceId'));
  const [devDeliveredToPatient, setDevDeliveredToPatient] = useState(savedBool('devDeliveredToPatient'));
  const [devAssignedToPatient, setDevAssignedToPatient] = useState(savedBool('devAssignedToPatient', true));
  const [devInstructionsGiven, setDevInstructionsGiven] = useState(savedBool('devInstructionsGiven'));
  const [devUnderstandingDemonstrated, setDevUnderstandingDemonstrated] = useState(savedBool('devUnderstandingDemonstrated'));
  const [deviceActivatedCheck, setDeviceActivatedCheck] = useState(savedBool('deviceActivatedCheck'));
  const [deliveryNotes, setDeliveryNotes] = useState(savedString('deliveryNotes'));
  const [recipientSignature, setRecipientSignature] = useState(savedString('recipientSignature'));
  const [deliveryNurseSignature, setDeliveryNurseSignature] = useState(savedString('deliveryNurseSignature'));
  const [deliveryPdfUrl, setDeliveryPdfUrl] = useState('');
  const [deliveryPdfGenerated, setDeliveryPdfGenerated] = useState(false);
  const [isGeneratingDeliveryPdf, setIsGeneratingDeliveryPdf] = useState(false);
  const [deliveryPdfProgress, setDeliveryPdfProgress] = useState(0);
  const [deliveryPdfProgressLabel, setDeliveryPdfProgressLabel] = useState('');
  const [educationRecipient, setEducationRecipient] = useState<'PATIENT' | 'FACILITY_STAFF' | 'CAREGIVER' | 'AUTHORIZED_REPRESENTATIVE'>(savedChoice('educationRecipient', 'PATIENT'));

  // Additional Device States
  const [hasAdditionalDevice, setHasAdditionalDevice] = useState(savedBool('hasAdditionalDevice'));
  const [additionalDeviceType, setAdditionalDeviceType] = useState<'BP Monitor' | 'Scale' | 'Pulse Oximeter' | 'Glucometer' | 'Other'>(savedChoice('additionalDeviceType', 'Scale'));
  const [additionalSerialNumber, setAdditionalSerialNumber] = useState(savedString('additionalSerialNumber'));
  const [additionalDeviceId, setAdditionalDeviceId] = useState(savedString('additionalDeviceId'));
  const [additionalKitId, setAdditionalKitId] = useState(savedString('additionalKitId'));

  // STEP 5: DEVICE ACTIVATION STATUS
  const [deviceAssignedPlatform, setDeviceAssignedPlatform] = useState(savedBool('deviceAssignedPlatform'));
  const [serialLinkedToPatient, setSerialLinkedToPatient] = useState(savedBool('serialLinkedToPatient'));
  const [connectivityConfirmed, setConnectivityConfirmed] = useState(savedBool('connectivityConfirmed'));
  const [firstReadingTransmitted, setFirstReadingTransmitted] = useState(savedBool('firstReadingTransmitted'));
  const [patientInstructed, setPatientInstructed] = useState(savedBool('patientInstructed'));
  const [nhStaffInstructed, setNhStaffInstructed] = useState(savedBool('nhStaffInstructed'));
  const [activationStatus, setActivationStatus] = useState<TechnicalActivationStatus>(savedChoice('activationStatus', 'NOT_STARTED'));
  const [activationNotes, setActivationNotes] = useState(savedString('activationNotes'));
  const [providerOrderStatus, setProviderOrderStatus] = useState<'YES' | 'NO' | 'PENDING'>(savedChoice('providerOrderStatus', 'PENDING'));
  const [providerName, setProviderName] = useState(savedString('providerName', patient.provider || ''));
  const [providerOrderDate, setProviderOrderDate] = useState(savedString('providerOrderDate'));
  const [providerOrderReference, setProviderOrderReference] = useState(savedString('providerOrderReference'));
  const [providerOrderNotes, setProviderOrderNotes] = useState(savedString('providerOrderNotes'));
  const [transmissionFailureReason, setTransmissionFailureReason] = useState(savedString('transmissionFailureReason'));
  const [activationAttested, setActivationAttested] = useState(savedBool('activationAttested'));
  const [showExitDialog, setShowExitDialog] = useState(false);

  // STEP 6: BLOOD PRESSURE READING
  const [systolic, setSystolic] = useState(savedString('systolic'));
  const [diastolic, setDiastolic] = useState(savedString('diastolic'));
  const [pulse, setPulse] = useState(savedString('pulse'));
  const [scaleWeight, setScaleWeight] = useState(savedString('scaleWeight'));
  const [bpArm, setBpArm] = useState<'LEFT' | 'RIGHT'>(savedChoice('bpArm', 'LEFT'));
  const [bpPosition, setBpPosition] = useState<'SITTING' | 'LYING' | 'STANDING'>(savedChoice('bpPosition', 'SITTING'));
  const [bpSource, setBpSource] = useState<'DEVICE' | 'MANUAL'>(savedChoice('bpSource', 'DEVICE'));
  const [bpRested, setBpRested] = useState(savedBool('bpRested'));
  const [bpCuffCorrect, setBpCuffCorrect] = useState(savedBool('bpCuffCorrect'));
  const [bpReviewedWithPatient, setBpReviewedWithPatient] = useState(savedBool('bpReviewedWithPatient'));
  const [bpNotes, setBpNotes] = useState(savedString('bpNotes'));
  const [bpSavedLocal, setBpSavedLocal] = useState(savedBool('bpSavedLocal'));

  const isRpmApplicable = patient.assignedProgram.includes('RPM');
  const requiresMedicalOrder = patientRequiresDevice(patient);
  const medicalOrderStatus = getMedicalOrderStatus(patient);
  const medicalOrderApproved = isMedicalOrderApproved(patient);
  const deviceActionsBlocked = false; // Allow device delivery and checklist completion even if medical order is not approved yet
  const selectedMonitoringDeviceTypes = Array.from(new Set([
    deviceType,
    ...(hasAdditionalDevice ? [additionalDeviceType] : [])
  ])).filter(device => device === 'BP Monitor' || device === 'Scale');
  const requiresBpReading = selectedMonitoringDeviceTypes.includes('BP Monitor');
  const requiresScaleReading = selectedMonitoringDeviceTypes.includes('Scale');
  const bpReadingComplete = !requiresBpReading || Boolean(systolic && diastolic && pulse);
  const scaleReadingComplete = !requiresScaleReading || Boolean(scaleWeight);

  useEffect(() => {
    if (requiresMedicalOrder && !medicalOrderApproved) {
      setActivationStatus('PENDING_ORDER_APPROVAL');
    } else {
      setActivationStatus(current => current === 'PENDING_ORDER_APPROVAL' ? 'NOT_STARTED' : current);
    }
  }, [requiresMedicalOrder, medicalOrderApproved]);
  const selectedServiceName = patient.assignedProgram === 'RPM'
    ? l('Monitoreo Remoto de Pacientes', 'Remote Patient Monitoring')
    : patient.assignedProgram === 'CCM'
      ? l('Gestión de Cuidados Crónicos', 'Chronic Care Management')
      : patient.assignedProgram === 'CCM + RPM'
        ? l('Gestión de Cuidados Crónicos y Monitoreo Remoto de Pacientes', 'Chronic Care Management and Remote Patient Monitoring')
        : patient.assignedProgram === 'PCM'
          ? l('Gestión de Cuidados Principales', 'Principal Care Management')
          : patient.assignedProgram === 'RTM'
            ? l('Monitoreo Terapéutico Remoto', 'Remote Therapeutic Monitoring')
            : patient.assignedProgram;

  const step2GuideScript = l(
    `El Dr. Pedro Martinez-Clark, su cardiólogo, quiere darle un seguimiento más cercano a su salud mientras usted está aquí en el nursing home.

La idea es que su equipo de cuidado pueda estar más pendiente de usted entre visitas, especialmente de su presión arterial, síntomas, medicamentos y cualquier cambio importante.

Como parte de este seguimiento, se le asignará una Care Manager, quien podrá comunicarse con usted y ayudar a darle seguimiento a su cuidado.

Además, el doctor indicó el uso de este dispositivo para monitorear su presión arterial. Sus lecturas se enviarán de forma segura al equipo clínico.

Si usted desea, también podemos ayudarle a instalar una aplicación móvil en su celular. Desde la aplicación podrá ver el historial de sus mediciones, revisar su plan de cuidado y comunicarse con su Care Team.

También, si usted lo autoriza, un familiar o caregiver puede descargar la aplicación para estar al tanto de su seguimiento, ver información importante de su cuidado y comunicarse con el Care Team cuando sea necesario.

La participación es voluntaria y usted puede detener el servicio en cualquier momento.

Medicare cubre este servicio. Si aplica algún copago, dependerá de su cobertura. Si usted tiene seguro secundario o suplementario, este podría ayudar a cubrirlo.

Para poder activarlo, necesito confirmar que este mismo seguimiento no se lo está dando otro médico.

Este servicio no es para emergencias. Si está de acuerdo, podemos continuar con su autorización.`,
    `Dr. Pedro Martinez-Clark, your cardiologist, wants to follow your health more closely while you are here in the nursing home.

The goal is for your care team to keep a closer eye on you between visits, especially your blood pressure, symptoms, medications, and any important changes.

As part of this follow-up, a Care Manager will be assigned to you. The Care Manager may contact you and help follow your care.

The doctor also indicated use of this device to monitor your blood pressure. Your readings will be sent securely to the clinical team.

If you would like, we can also help install a mobile app on your phone. From the app, you can view your measurement history, review your care plan, and communicate with your Care Team.

Also, if you authorize it, a family member or caregiver can download the app to stay informed about your follow-up, view important care information, and communicate with the Care Team when needed.

Participation is voluntary, and you may stop the service at any time.

Medicare covers this service. If any copay applies, it depends on your coverage. If you have secondary or supplemental insurance, it may help cover it.

To activate it, I need to confirm that another doctor is not already providing this same follow-up.

This service is not for emergencies. If you agree, we can continue with your authorization.`
  );
  const localizedConsentText = (language === 'ES' ? DEFAULT_CONSENT_TEXT_ES : DEFAULT_CONSENT_TEXT)
    .replace('{SERVICE}', selectedServiceName);

  const representativeRequired = decisionMaker === 'REPRESENTATIVE' || !patientCanDecide;
  const readinessRepresentativeComplete = representativeAvailability !== 'NONE' &&
    Boolean(readinessRepName.trim() && readinessRepRelationship.trim() && readinessRepAuthority && readinessRepPhone.trim());
  const step1Complete = idConfirmed && (
    participationDecisionPath === 'PATIENT'
      ? patientCanDecide
      : participationDecisionPath === 'REPRESENTATIVE' && readinessRepresentativeComplete
  );

  // CHECKLIST COMPLETION
  const isAllStep2Selected = explainedService &&
    explainedVoluntary &&
    explainedStopAnytime &&
    explainedCostSharing &&
    explainedSingleProvider &&
    explainedContact &&
    explainedQuestionsTime &&
    patientUnderstood &&
    (isRpmApplicable ? explainedDeviceUsage : true) &&
    (!interpreterUsed || Boolean(interpreterName.trim()));

  const step2Complete = serviceExplanationConfirmed;
  const step3Complete = consentDeclined || (consentRecordComplete && consentPdfGenerated);
  const firstReadingComplete = selectedMonitoringDeviceTypes.length === 0 || (bpReadingComplete && scaleReadingComplete);
  const deviceRequirementsReadyForPdf = isRpmApplicable && (
    Boolean(serialNumber.trim()) &&
    devDeliveredToPatient &&
    devInstructionsGiven &&
    devUnderstandingDemonstrated
  );
  const step4Complete = !isRpmApplicable || deviceRequirementsReadyForPdf;
  const isEnrollmentComplete = step1Complete && step2Complete && step3Complete && step4Complete && !consentDeclined;
  const canActivatePatient = isEnrollmentComplete && (!requiresMedicalOrder || medicalOrderApproved);

  const completedRequirements = [
    step1Complete && 'IDENTITY_READINESS',
    step2Complete && 'SERVICE_EXPLANATION',
    step3Complete && 'CONSENT',
    step4Complete && 'RPM_DEVICE'
  ].filter(Boolean) as string[];
  const missingRequirements = [
    !step1Complete && 'Identity and readiness requirements',
    !step2Complete && 'Service explanation confirmation',
    !step3Complete && 'Consent decision, evidence, attestation, or PDF',
    !step4Complete && isRpmApplicable && 'Approved medical order, device delivery, first reading, or PDF'
  ].filter(Boolean) as string[];

  const workflowProgress = Math.round((step / 3) * 100);

  const canAdvanceCurrentStep =
    (step === 1 && step1Complete) ||
    (step === 2 && step2Complete) ||
    (step === 3 && (step3Complete || consentDeclined));

  const getStepState = (stepNumber: number) => {
    if (stepNumber === 4 && !isRpmApplicable) return 'NOT_APPLICABLE';
    if (stepNumber === step) return 'CURRENT';
    if (stepNumber < step) return 'COMPLETED';
    return 'UPCOMING';
  };

  const finalReviewItems = [
    { label: l('Identidad Confirmada', 'Identity Confirmed'), ready: idConfirmed, step: 1 },
    { label: l('Preparación del Paciente Confirmada', 'Patient Readiness Confirmed'), ready: step1Complete, step: 1 },
    { label: l('Explicación del Servicio Completada', 'Service Explanation Completed'), ready: step2Complete, step: 2 },
    { label: l('Decisión de Consentimiento Registrada', 'Consent Decision Recorded'), ready: consentDecision !== null, step: 3 },
    { label: l('Firma o Consentimiento Verbal Documentado', 'Consent Signed or Verbal Consent Documented'), ready: patientEvidenceComplete, step: 3 },
    { label: l('PDF de Consentimiento Generado', 'Consent PDF Generated'), ready: consentPdfGenerated, step: 3 },
    { label: l('Atestación del Personal de Inscripción Completada', 'Enrollment Personnel Attestation Completed'), ready: nurseAttestationComplete, step: 3 },
    { label: l('Orden médica aprobada', 'Medical Order Approved'), ready: requiresMedicalOrder ? medicalOrderApproved : null, step: 4 },
    { label: l('Dispositivo RPM Asignado', 'RPM Device Assigned'), ready: isRpmApplicable ? devDeliveredToPatient : null, step: 4 },
    { label: l('Dispositivo RPM Entregado', 'RPM Device Delivered'), ready: isRpmApplicable ? devDeliveredToPatient : null, step: 4 },
    { label: l('Primera Lectura Recibida', 'First Reading Received'), ready: isRpmApplicable ? firstReadingComplete : null, step: 4 },
    { label: l('PDF de Entrega del Dispositivo Generado', 'Device Delivery PDF Generated'), ready: isRpmApplicable ? deliveryPdfGenerated : null, step: 4 }
  ];
  const firstPendingStep = finalReviewItems.find(item => item.ready === false)?.step || 1;

  /*
   * Kept as a single expression so each confirmation must be checked
   * individually by the nurse; there is intentionally no select-all action.
   */
  const legacyStep2Completion = explainedService &&
    explainedVoluntary &&
    explainedStopAnytime &&
    explainedCostSharing &&
    explainedContact &&
    (patient.requiredDevice === 'None' ? true : explainedDeviceUsage) &&
    explainedQuestionsTime &&
    patientUnderstood;

  const isAllStep4Selected = devDeliveredToPatient && devInstructionsGiven && devUnderstandingDemonstrated && deviceAssignedPlatform && connectivityConfirmed && firstReadingTransmitted && patientInstructed && nhStaffInstructed;

  const handleSelectAllStep4 = () => {
    const newValue = !isAllStep4Selected;
    setDevDeliveredToPatient(newValue);
    setDevInstructionsGiven(newValue);
    setDevUnderstandingDemonstrated(newValue);
    setDeviceAssignedPlatform(newValue);
    setConnectivityConfirmed(newValue);
    setFirstReadingTransmitted(newValue);
    if (newValue) {
      setDeviceActivatedCheck(true);
      setActivationStatus('ACTIVE');
    } else {
      setDeviceActivatedCheck(false);
      setActivationStatus('NOT_STARTED');
    }
    setPatientInstructed(newValue);
    setNhStaffInstructed(newValue);
  };

  // Setup defaults if RPM applies
  useEffect(() => {
    if (patient.requiredDevice && patient.requiredDevice !== 'None') {
      const dev = patient.requiredDevice as any;
      if (['BP Monitor', 'Scale', 'Pulse Oximeter', 'Glucometer'].includes(dev)) {
        setDeviceType(dev);
      }
    }
  }, [patient]);

  // Sync signer name if patient signing self
  useEffect(() => {
    if (consentSignerType === 'PATIENT' || consentSignerType === 'UNABLE') {
      setSignerName(`${patient.firstName} ${patient.lastName}`);
      setRepRelationship('');
    } else {
      setSignerName('');
    }
  }, [consentSignerType, patient]);

  useEffect(() => {
    if (consentSignerType === 'UNABLE') {
      setSignatureMethod('UNABLE');
    }
  }, [consentSignerType]);

  useEffect(() => {
    if (representativeSignatureMethod === 'REMOTE_LINK' && consentSignerType === 'REPRESENTATIVE') {
      setSignatureMethod('TYPE');
    }
  }, [representativeSignatureMethod, consentSignerType]);

  useEffect(() => {
    if (previousSignatureMethodRef.current === signatureMethod) return;
    previousSignatureMethodRef.current = signatureMethod;
    setPatientSignature('');
    setTypedSignatureConfirmed(false);
    setUnableConsentConfirmed(false);
    setConsentPdfGenerated(false);
    setConsentPdfUrl('');
    setIsGeneratingConsentPdf(false);
    setAutoConsentPdfAttempted(false);
    setConsentPdfProgress(0);
    setConsentPdfProgressLabel('');
  }, [signatureMethod]);

  useEffect(() => {
    if (signatureMethod === 'UNABLE' && unableSignMethod === 'REPRESENTATIVE_SIGNATURE') {
      setSignerName('');
      setRepRelationship('');
      setAuthorityType('');
    }
  }, [signatureMethod, unableSignMethod]);

  useEffect(() => {
    if (!consentRecordComplete) {
      setIsGeneratingConsentPdf(false);
      return;
    }
    if (consentDecision === 'ACCEPT' && !consentPdfGenerated && !isGeneratingConsentPdf && !autoConsentPdfAttempted) {
      triggerConsentPDFGeneration(true);
    }
  }, [consentDecision, consentPdfGenerated, consentRecordComplete, isGeneratingConsentPdf, autoConsentPdfAttempted]);

  // ----------------------------------------------------
  // BUSINESS VALIDATION ALERTS
  // ----------------------------------------------------
  const bpAlerts = () => {
    const sys = parseInt(systolic);
    const dia = parseInt(diastolic);
    
    if (isNaN(sys) || isNaN(dia)) return null;

    if (sys >= 140 || dia >= 90) {
      return {
        type: 'warning',
        title: l('Lectura Elevada', 'High Pressure Alert'),
        msg: l('Puede ser necesaria una revisión clínica. Asegúrese de que el paciente descanse 5 minutos y repita la prueba si es necesario.', 'Clinical review may be needed. Ensure the patient rests for 5 minutes and repeat the test if necessary.')
      };
    }
    if (sys <= 90 || dia <= 60) {
      return {
        type: 'warning',
        title: l('Lectura Baja', 'Low Pressure Alert'),
        msg: l('Puede ser necesaria una revisión clínica. Verifique si el paciente tiene síntomas de mareo o fatiga.', 'Clinical review may be needed. Check whether the patient has symptoms of dizziness or fatigue.')
      };
    }
    return null;
  };

  // ----------------------------------------------------
  // SUB-STEP NAVIGATION
  // ----------------------------------------------------
  const handleNext = () => {
    if (step === 3 && consentDeclined) {
      handleSaveAndExitLocal();
      return;
    }

    if (!canAdvanceCurrentStep) return;

    if (step === 3 && !isRpmApplicable) {
      setStep(5);
      return;
    }

    setStep(prev => Math.min(prev + 1, 5));
  };

  const handleBack = () => {
    if (step === 5 && !isRpmApplicable) {
      setStep(3);
      return;
    }
    setStep(prev => Math.max(prev - 1, 1));
  };

  // ----------------------------------------------------
  // SIGNATURE BINDINGS
  // ----------------------------------------------------
  const handleSavePatientSignature = (base64: string) => {
    setPatientSignature(base64);
  };
  const handleSaveNurseSignature = (base64: string) => {
    setNurseSignature(base64);
  };
  const handleSaveRecipientSignature = (base64: string) => {
    setRecipientSignature(base64);
  };
  const handleSaveDeliveryNurseSignature = (base64: string) => {
    setDeliveryNurseSignature(base64);
  };

  const handleSelectAllStep2 = () => {
    setExplainedService(true);
    setExplainedVoluntary(true);
    setExplainedStopAnytime(true);
    setExplainedCostSharing(true);
    setExplainedSingleProvider(true);
    setExplainedContact(true);
    setExplainedDeviceUsage(isRpmApplicable);
    setExplainedQuestionsTime(true);
    setPatientUnderstood(true);
  };

  // ----------------------------------------------------
  // DOCUMENT GENERATION TRIGGERS
  // ----------------------------------------------------
  const triggerConsentPDFGeneration = async (isAutomatic = false): Promise<boolean> => {
    if (!consentRecordComplete) {
      setAlertMessage(l('Complete la identificación del firmante, la evidencia de consentimiento y la atestación del personal de inscripción antes de generar el PDF.', 'Complete signer identification, consent evidence, and the enrollment personnel attestation before generating the PDF.'));
      return false;
    }
    if (isGeneratingConsentPdf) return false;
    if (consentPdfGenerated) return true;
    if (isAutomatic) setAutoConsentPdfAttempted(true);

    setIsGeneratingConsentPdf(true);
    setConsentPdfProgress(8);
    setConsentPdfProgressLabel(l('Preparando datos del consentimiento...', 'Preparing consent data...'));
    const progressTimer = window.setInterval(() => {
      setConsentPdfProgress(previous => {
        if (previous < 32) {
          setConsentPdfProgressLabel(l('Generando documento PDF...', 'Rendering PDF document...'));
          return previous + 8;
        }
        if (previous < 68) {
          setConsentPdfProgressLabel(l('Guardando PDF en Google Drive...', 'Saving PDF to Google Drive...'));
          return previous + 6;
        }
        if (previous < 90) {
          setConsentPdfProgressLabel(l('Verificando archivo generado...', 'Verifying generated file...'));
          return previous + 3;
        }
        return previous;
      });
    }, 550);

    const mockConsentObj: Consent = {
      id: `con_${Date.now()}`,
      patientId: patient.id,
      visitId: existingVisit?.id || `vis_${Date.now()}`,
      program: patient.assignedProgram,
      status: consentDeclined ? 'DECLINED' : 'GRANTED',
      consentVersion: CONSENT_TEXT_VERSION,
      consentLegalText: FULL_CONSENT_LEGAL_TEXT,
      consentPracticeName: patient.practice,
      consentEffectiveDate: CONSENT_TEXT_EFFECTIVE_DATE,
      signedBy: (consentSignerType === 'REPRESENTATIVE' || (signatureMethod === 'UNABLE' && unableSignMethod === 'REPRESENTATIVE_SIGNATURE')) ? 'REPRESENTATIVE' : 'PATIENT',
      signerName,
      relationship: repRelationship || undefined,
      authorityType: authorityType || undefined,
      representativePhone: representativePhone || undefined,
      representativeEmail: representativeEmail || undefined,
      representativeSignatureMethod: needsRepresentativeDetails ? representativeSignatureMethod : undefined,
      consentMethod: signatureMethod === 'TYPE'
        ? 'TYPED_SIGNATURE'
        : signatureMethod === 'UNABLE'
          ? (unableSignMethod === 'REPRESENTATIVE_SIGNATURE' ? 'REPRESENTATIVE_SIGNATURE' : unableSignMethod || 'VERBAL')
          : 'SIGNATURE',
      signatureMethod,
      typedSignatureName: signatureMethod === 'TYPE' ? typedSignatureName : undefined,
      typedSignatureAgreement: signatureMethod === 'TYPE' ? typedSignatureAgreed : undefined,
      signerType: (consentSignerType === 'REPRESENTATIVE' || (signatureMethod === 'UNABLE' && unableSignMethod === 'REPRESENTATIVE_SIGNATURE')) ? 'AUTHORIZED_REPRESENTATIVE' : 'PATIENT',
      unableToSignReason: unableToSignReason || undefined,
      nurseNotes: verbalConsentNurseNote || undefined,
      nurseAttestations: ['SIGNER_IDENTITY_ROLE_CONFIRMED', 'VOLUNTARY_DECISION_CONFIRMED', 'SIGNATURE_OR_VERBAL_CONSENT_WITNESSED'],
      facility: patient.nursingHome,
      captureDevice: PRODUCT_NAME,
      language,
      explanationLanguage,
      patientSignature,
      nurseSignature,
      nurseName: currentUser.name,
      dateTime: new Date().toISOString(),
      signedAt: new Date().toISOString(),
      capturedBy: currentUser.name,
      pdfGenerated: true,
      auditId: `con_audit_${Math.random().toString(36).substring(2, 9).toUpperCase()}`
    };

    try {
      await onGenerateConsentPDF(mockConsentObj, (dataUrl) => {
        window.clearInterval(progressTimer);
        setConsentPdfProgress(100);
        setConsentPdfProgressLabel(l('PDF generado correctamente.', 'PDF generated successfully.'));
        setConsentPdfUrl(dataUrl);
        setConsentPdfGenerated(true);
      });
      return true;
    } catch (error) {
      window.clearInterval(progressTimer);
      setConsentPdfGenerated(false);
      setConsentPdfUrl('');
      setConsentPdfProgress(0);
      setConsentPdfProgressLabel('');
      setAlertMessage(formatPdfGenerationError(error, 'consent'));
      return false;
    } finally {
      window.clearInterval(progressTimer);
      setIsGeneratingConsentPdf(false);
    }
  };

  const triggerDeliveryPDFGeneration = async () => {
    if (isGeneratingDeliveryPdf) return;
    const previousDeliveryPdfGenerated = deliveryPdfGenerated;
    const previousDeliveryPdfUrl = deliveryPdfUrl;
    if (deviceActionsBlocked) {
      setAlertMessage(l(
        'No se puede entregar, activar ni generar el PDF del dispositivo hasta que la orden médica esté aprobada.',
        'Device delivery, activation, and PDF generation are blocked until the medical order is approved.'
      ));
      return;
    }
    if (!deviceRequirementsReadyForPdf) {
      setAlertMessage(l(
        'Complete la orden médica aprobada, el serial del dispositivo, la entrega, educación, conectividad y primera lectura antes de generar el PDF.',
        'Complete the approved medical order, device serial number, delivery, education, connectivity, and the first reading before generating the PDF.'
      ));
      return;
    }

    const activeNurseSig = deliveryNurseSignature || nurseSignature || currentUser.name;
    if (!activeNurseSig) {
      setAlertMessage('Staff attestation is required to certify delivery.');
      return;
    }

    const mockDeviceObj: Device & {
      firstReading?: { systolic?: string; diastolic?: string; pulse?: string; weightLbs?: string };
      readingSource?: string;
    } = {
      id: `dev_${Date.now()}`,
      patientId: patient.id,
      deviceType,
      brand,
      model,
      serialNumber: serialNumber || deviceId || 'N/A',
      kitId: kitId || deviceId || 'N/A',
      deviceId,
      status: activationStatus,
      deliveryDate: new Date().toISOString(),
      deliveredBy: currentUser.name,
      deliveredToPatient: devDeliveredToPatient,
      assignedToPatient: devAssignedToPatient,
      instructionsGiven: devInstructionsGiven,
      understandingDemonstrated: devUnderstandingDemonstrated,
      deviceActivated: deviceActivatedCheck,
      recipientSignature: recipientSignature || patientSignature || undefined,
      nurseSignature: activeNurseSig,
      notes: deliveryNotes,
      providerOrderStatus: medicalOrderApproved ? 'YES' : 'PENDING',
      providerName: patient.medicalOrder?.assignedPhysician || patient.provider,
      providerOrderDate: patient.medicalOrder?.approvedAt || undefined,
      providerOrderReference: patient.medicalOrder?.id,
      providerOrderNotes: patient.medicalOrder
        ? `Medical order status: ${patient.medicalOrder.status}; version: ${patient.medicalOrder.orderVersion}`
        : undefined,
      firstReading: {
        systolic: systolic || undefined,
        diastolic: diastolic || undefined,
        pulse: pulse || undefined,
        weightLbs: scaleWeight || undefined
      },
      readingSource: bpSource
    };

    setIsGeneratingDeliveryPdf(true);
    setDeliveryPdfProgress(8);
    setDeliveryPdfProgressLabel(l('Preparando datos de entrega...', 'Preparing delivery data...'));
    const progressTimer = window.setInterval(() => {
      setDeliveryPdfProgress(previous => {
        if (previous < 32) {
          setDeliveryPdfProgressLabel(l('Generando documento PDF...', 'Rendering PDF document...'));
          return previous + 8;
        }
        if (previous < 68) {
          setDeliveryPdfProgressLabel(l('Guardando PDF en Google Drive...', 'Saving PDF to Google Drive...'));
          return previous + 6;
        }
        if (previous < 90) {
          setDeliveryPdfProgressLabel(l('Verificando archivo generado...', 'Verifying generated file...'));
          return previous + 3;
        }
        return previous;
      });
    }, 550);

    try {
      await onGenerateDeliveryPDF(mockDeviceObj, (dataUrl) => {
        window.clearInterval(progressTimer);
        setDeliveryPdfProgress(100);
        setDeliveryPdfProgressLabel(l('PDF generado correctamente.', 'PDF generated successfully.'));
        setDeliveryPdfUrl(dataUrl);
        setDeliveryPdfGenerated(true);
      });
    } catch (error) {
      window.clearInterval(progressTimer);
      setDeliveryPdfGenerated(previousDeliveryPdfGenerated);
      setDeliveryPdfUrl(previousDeliveryPdfUrl);
      setDeliveryPdfProgress(0);
      setDeliveryPdfProgressLabel('');
      setAlertMessage(formatPdfGenerationError(error, 'delivery'));
    } finally {
      window.clearInterval(progressTimer);
      setIsGeneratingDeliveryPdf(false);
    }
  };

  const formatPdfGenerationError = (error: unknown, documentType: 'consent' | 'delivery') => {
    const message = error instanceof Error ? error.message : '';
    const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: unknown }).status) : undefined;
    const requestId = typeof error === 'object' && error && 'requestId' in error ? String((error as { requestId?: unknown }).requestId || '') : '';
    if (message.includes('pdf_storage_unavailable')) {
      return l(
        'No se pudo guardar el PDF en Google Drive. Verifique que la carpeta de PDFs esté compartida con la cuenta de servicio de Cloud Run.',
        'Unable to save the PDF to Google Drive. Verify that the PDF folder is shared with the Cloud Run service account.'
      );
    }
    if (message.includes('service_rate_limited') || message.includes('429') || status === 429) {
      return l(
        'El servicio seguro está limitando temporalmente la generación de PDFs. Espere unos segundos e intente nuevamente.',
        'The secure service is temporarily rate limiting PDF generation. Wait a few seconds and try again.'
      );
    }
    if (message.includes('secure_service_unavailable') || (status && status >= 500)) {
      return l(
        requestId
          ? `El servicio seguro no estuvo disponible temporalmente. Intente nuevamente. Referencia: ${requestId}`
          : 'El servicio seguro no estuvo disponible temporalmente. Intente nuevamente.',
        requestId
          ? `The secure service was temporarily unavailable. Please try again. Reference: ${requestId}`
          : 'The secure service was temporarily unavailable. Please try again.'
      );
    }
    return documentType === 'consent'
      ? l('No se pudo generar el PDF de consentimiento. Intente nuevamente.', 'Unable to generate the consent PDF. Please try again.')
      : l('No se pudo generar el PDF de entrega. Intente nuevamente.', 'Unable to generate the delivery PDF. Please try again.');
  };

  // ----------------------------------------------------
  // SAVE & ACTIVATE HANDLERS
  // ----------------------------------------------------
  const createStateBundles = (isFinalActivation = false) => {
    const visitId = existingVisit?.id || `vis_${Date.now()}`;
    const formState = {
      idConfirmed,
      patientAvailable,
      patientCanDecide,
      repPresent,
      representativeAvailability,
      readinessRepName,
      readinessRepRelationship,
      readinessRepAuthority,
      readinessRepPhone,
      readinessRepEmail,
      representativeContactMode,
      preferredExplanationLanguage,
      decisionMaker,
      participationDecisionPath,
      explainedService,
      explainedVoluntary,
      explainedStopAnytime,
      explainedCostSharing,
      explainedSingleProvider,
      explainedContact,
      explainedDeviceUsage,
      explainedQuestionsTime,
      patientUnderstood,
      serviceExplanationConfirmed,
      explanationLanguage,
      interpreterUsed,
      interpreterName,
      showDetailedEnrollmentGuide,
      wantsPatientAppInfo,
      consentDecision: consentDecision || '',
      consentSignerType,
      signerName,
      repRelationship,
      authorityType,
      representativePhone,
      representativeEmail,
      representativeSignatureMethod,
      signatureMethod,
      typedSignatureName,
      typedSignatureAgreed,
      typedSignatureConfirmed,
      unableSignMethod,
      unableToSignReason,
      unableConsentConfirmed,
      declineReason,
      declineNotes,
      verbalConsentNurseNote,
      patientSignature,
      nurseSignature,
      attestationExplained,
      attestationQuestions,
      attestationVoluntary,
      attestationCosts,
      attestationWitnessed,
      staffAttestationConfirmed,
      markWitnessName,
      markWitnessRole,
      markWitnessAttested,
      consentPdfGenerated,
      deviceType,
      brand,
      model,
      serialNumber,
      kitId,
      deviceId,
      devDeliveredToPatient,
      devAssignedToPatient,
      devInstructionsGiven,
      devUnderstandingDemonstrated,
      deviceActivatedCheck,
      deliveryNotes,
      recipientSignature,
      deliveryNurseSignature,
      deliveryPdfGenerated,
      educationRecipient,
      hasAdditionalDevice,
      additionalDeviceType,
      additionalSerialNumber,
      additionalDeviceId,
      additionalKitId,
      deviceAssignedPlatform,
      serialLinkedToPatient,
      connectivityConfirmed,
      firstReadingTransmitted,
      patientInstructed,
      nhStaffInstructed,
      activationStatus,
      activationNotes,
      providerOrderStatus,
      providerName,
      providerOrderDate,
      providerOrderReference,
      providerOrderNotes,
      transmissionFailureReason,
      activationAttested,
      systolic,
      diastolic,
      pulse,
      scaleWeight,
      bpArm,
      bpPosition,
      bpSource,
      bpRested,
      bpCuffCorrect,
      bpReviewedWithPatient,
      bpNotes,
      bpSavedLocal
    };
    
    // Visit Object
    const visitObj: Visit = {
      id: visitId,
      patientId: patient.id,
      nurseId: currentUser.id,
      nurseName: currentUser.name,
      startTime: existingVisit?.startTime || new Date().toISOString(),
      endTime: isFinalActivation ? new Date().toISOString() : undefined,
      status: isFinalActivation ? 'COMPLETED' : 'IN_PROGRESS',
      currentStep: step,
      notes: deliveryNotes || activationNotes || bpNotes || undefined,
      completedRequirements,
      missingRequirements,
      lastSavedBy: currentUser.name,
      lastSavedAt: new Date().toISOString(),
      explanationLanguage,
      interpreterUsed,
      interpreterName: interpreterUsed ? interpreterName : undefined,
      preferredExplanationLanguage,
      serviceExplanation: {
        nurseUserId: currentUser.id,
        nurseName: currentUser.name,
        patientId: patient.id,
        confirmedAt: serviceExplanationConfirmed ? new Date().toISOString() : undefined,
        scriptVersion: STEP2_GUIDE_SCRIPT_VERSION,
        checkboxMarked: serviceExplanationConfirmed,
        status: serviceExplanationConfirmed ? 'explained_and_understood' : 'pending'
      },
      representativeName: representativeAvailability !== 'NONE' ? readinessRepName : undefined,
      representativeRelationship: representativeAvailability !== 'NONE' ? readinessRepRelationship : undefined,
      representativeAuthority: representativeAvailability !== 'NONE' ? readinessRepAuthority : undefined,
      representativeContact: representativeAvailability !== 'NONE' ? `${representativeContactMode}: ${readinessRepPhone}` : undefined,
      formState
    };

    // Consent Object (if signed)
    let consentObj: Consent | undefined = undefined;
    if (consentDecision === 'ACCEPT' && consentRecordComplete) {
      consentObj = {
        id: `con_${patient.id}`,
        patientId: patient.id,
        visitId,
        program: patient.assignedProgram,
        status: consentDeclined ? 'DECLINED' : 'GRANTED',
        consentVersion: CONSENT_TEXT_VERSION,
        consentLegalText: FULL_CONSENT_LEGAL_TEXT,
        consentPracticeName: patient.practice,
        consentEffectiveDate: CONSENT_TEXT_EFFECTIVE_DATE,
        signedBy: (consentSignerType === 'REPRESENTATIVE' || (signatureMethod === 'UNABLE' && unableSignMethod === 'REPRESENTATIVE_SIGNATURE')) ? 'REPRESENTATIVE' : 'PATIENT',
        signerName,
        relationship: repRelationship || undefined,
        authorityType: authorityType || undefined,
        representativePhone: representativePhone || undefined,
        representativeEmail: representativeEmail || undefined,
        representativeSignatureMethod: needsRepresentativeDetails ? representativeSignatureMethod : undefined,
        consentMethod: signatureMethod === 'TYPE'
          ? 'TYPED_SIGNATURE'
          : signatureMethod === 'UNABLE'
            ? (unableSignMethod === 'REPRESENTATIVE_SIGNATURE' ? 'REPRESENTATIVE_SIGNATURE' : unableSignMethod || 'VERBAL')
            : 'SIGNATURE',
        signatureMethod,
        typedSignatureName: signatureMethod === 'TYPE' ? typedSignatureName : undefined,
        typedSignatureAgreement: signatureMethod === 'TYPE' ? typedSignatureAgreed : undefined,
        signerType: (consentSignerType === 'REPRESENTATIVE' || (signatureMethod === 'UNABLE' && unableSignMethod === 'REPRESENTATIVE_SIGNATURE')) ? 'AUTHORIZED_REPRESENTATIVE' : 'PATIENT',
        unableToSignReason: unableToSignReason || undefined,
        nurseNotes: verbalConsentNurseNote || undefined,
        nurseAttestations: ['SIGNER_IDENTITY_ROLE_CONFIRMED', 'VOLUNTARY_DECISION_CONFIRMED', 'SIGNATURE_OR_VERBAL_CONSENT_WITNESSED'],
        facility: patient.nursingHome,
        captureDevice: PRODUCT_NAME,
        language,
        explanationLanguage,
        patientSignature,
        nurseSignature,
        nurseName: currentUser.name,
        dateTime: new Date().toISOString(),
        signedAt: new Date().toISOString(),
        capturedBy: currentUser.name,
        pdfGenerated: consentPdfGenerated,
        auditId: `con_audit_${Math.random().toString(36).substring(2, 9).toUpperCase()}`
      };
    } else if (consentDeclined) {
      const declinedByRepresentative = participationDecisionPath === 'REPRESENTATIVE';
      // Declined object
      consentObj = {
        id: `con_${patient.id}`,
        patientId: patient.id,
        visitId,
        program: patient.assignedProgram,
        status: 'DECLINED',
        consentVersion: CONSENT_TEXT_VERSION,
        consentLegalText: FULL_CONSENT_LEGAL_TEXT,
        consentPracticeName: patient.practice,
        consentEffectiveDate: CONSENT_TEXT_EFFECTIVE_DATE,
        signedBy: declinedByRepresentative ? 'REPRESENTATIVE' : 'PATIENT',
        signerName: declinedByRepresentative ? readinessRepName : `${patient.firstName} ${patient.lastName}`,
        relationship: declinedByRepresentative ? readinessRepRelationship : undefined,
        authorityType: declinedByRepresentative ? readinessRepAuthority : undefined,
        representativePhone: declinedByRepresentative ? readinessRepPhone : undefined,
        representativeEmail: declinedByRepresentative ? representativeEmail || undefined : undefined,
        declineReason: declineReason || undefined,
        nurseNotes: declineNotes || undefined,
        declineDateTime: new Date().toISOString(),
        facility: patient.nursingHome,
        captureDevice: PRODUCT_NAME,
        language,
        explanationLanguage,
        patientSignature: '',
        nurseSignature: '',
        nurseName: currentUser.name,
        dateTime: new Date().toISOString(),
        pdfGenerated: false,
        auditId: `con_audit_declined_${Date.now()}`
      };
    }

    // Device Object (if delivery has some details inputted or patient program needs it)
    let deviceObj: Device | undefined = undefined;
    if (isRpmApplicable && (deviceType || deviceId || devDeliveredToPatient)) {
      deviceObj = {
        id: `dev_${patient.id}`,
        patientId: patient.id,
        deviceType,
        brand: brand || 'N/A',
        model: model || 'N/A',
        serialNumber: serialNumber || deviceId || 'N/A',
        kitId: kitId || deviceId || 'N/A',
        deviceId,
        status: isFinalActivation
          ? 'ACTIVE'
          : activationStatus === 'NOT_STARTED' && (devDeliveredToPatient || devAssignedToPatient)
            ? 'DELIVERED_ASSIGNED'
            : activationStatus,
        deliveryDate: new Date().toISOString(),
        activationDate: activationStatus === 'ACTIVE' ? new Date().toISOString() : undefined,
        deliveredBy: currentUser.name,
        deliveredToPatient: devDeliveredToPatient,
        assignedToPatient: devAssignedToPatient,
        instructionsGiven: devInstructionsGiven,
        understandingDemonstrated: devUnderstandingDemonstrated,
        deviceActivated: deviceActivatedCheck,
        recipientSignature: recipientSignature || patientSignature || undefined,
        nurseSignature: deliveryNurseSignature || nurseSignature || undefined,
        notes: deliveryNotes || transmissionFailureReason || undefined,
        providerOrderStatus: medicalOrderApproved ? 'YES' : 'PENDING',
        providerName: patient.medicalOrder?.assignedPhysician || providerName,
        providerOrderDate: patient.medicalOrder?.approvedAt || providerOrderDate || undefined,
        providerOrderReference: patient.medicalOrder?.id || providerOrderReference || undefined,
        providerOrderNotes: patient.medicalOrder
          ? `Medical order status: ${patient.medicalOrder.status}; version: ${patient.medicalOrder.orderVersion}`
          : providerOrderNotes || undefined
      };
    }

    // Device reading objects (if captured)
    const readingObjs: BPReading[] = [];
    if (requiresBpReading && systolic && diastolic && pulse) {
      readingObjs.push({
        id: `bp_${patient.id}_${Date.now()}`,
        patientId: patient.id,
        visitId,
        readingType: 'BLOOD_PRESSURE',
        deviceType: 'BP Monitor',
        systolic: parseInt(systolic),
        diastolic: parseInt(diastolic),
        pulse: parseInt(pulse),
        dateTime: new Date().toISOString(),
        arm: bpArm,
        position: bpPosition,
        source: bpSource,
        rested: bpRested,
        cuffCorrect: bpCuffCorrect,
        reviewedWithPatient: bpReviewedWithPatient,
        notes: bpNotes || undefined,
        recordedBy: currentUser.name
      });
    }
    if (requiresScaleReading && scaleWeight) {
      readingObjs.push({
        id: `scale_${patient.id}_${Date.now()}`,
        patientId: patient.id,
        visitId,
        readingType: 'WEIGHT',
        deviceType: 'Scale',
        weightLbs: parseFloat(scaleWeight),
        dateTime: new Date().toISOString(),
        source: 'DEVICE',
        reviewedWithPatient: bpReviewedWithPatient,
        notes: bpNotes || undefined,
        recordedBy: currentUser.name
      });
    }
    const readingObj = readingObjs.length > 1 ? readingObjs : readingObjs[0];

    return { visitObj, consentObj, deviceObj, readingObj };
  };

  const handleSaveAndExitLocal = () => {
    const { visitObj, consentObj, deviceObj, readingObj } = createStateBundles(consentDeclined);
    
    // Check if consent was declined, update state appropriately
    if (consentDeclined) {
      patient.status = 'CONSENT_DECLINED';
    } else {
      patient.status = 'INCOMPLETE'; // Marks visit to be resumed
    }

    onSaveAndExit(visitObj, consentObj, deviceObj, readingObj, false);
  };

  const handleCompleteEnrollmentLocal = () => {
    if (!isEnrollmentComplete) {
      setAlertMessage(l('Complete todos los requisitos operativos para finalizar la inscripción.', 'Complete all operational requirements to finish enrollment.'));
      return;
    }
    patient.status = 'ENROLLMENT_COMPLETED_PENDING_ACTIVATION';
    patient.activationBlocker = 'AWAITING_MEDICAL_ORDER_APPROVAL';
    
    const { visitObj, consentObj, deviceObj, readingObj } = createStateBundles(true);
    onSaveAndExit(visitObj, consentObj, deviceObj, readingObj, false);
    
    setAlertMessage(l(`${PRODUCT_NAME}: inscripción completada. El paciente aún no está activo. La activación estará disponible una vez que se apruebe la orden médica.`, `${PRODUCT_NAME}: enrollment completed. The patient is not active yet. Activation will be available once the medical order is approved.`));
  };

  const handleActivatePatientLocal = () => {
    // ----------------------------------------------------
    // HARD COMPLIANCE RULES
    // ----------------------------------------------------
    
    if (!canActivatePatient || !activationAttested) {
      setAlertMessage(l('Complete todos los requisitos, incluyendo la orden médica, y confirme la atestación de activación.', 'Complete all required items, including medical order approval, and confirm the activation attestation.'));
      return;
    }

    const { visitObj, consentObj, deviceObj, readingObj } = createStateBundles(true);
    onSaveAndExit(visitObj, consentObj, deviceObj, readingObj, true);
  };

  // ----------------------------------------------------
  // RENDERING STEPS
  // ----------------------------------------------------
  const navigateToStep = (targetStep: number) => {
    setStep(targetStep);
    requestAnimationFrame(() => {
      document.getElementById('wizard-body')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const renderStepIndicator = () => {
    const stepNames = language === 'ES' ? [
      'Identidad',
      'Guía',
      'Consentimiento',
      'Dispositivo RPM',
      'Activación'
    ] : [
      'Identity',
      'Guide',
      'Consent',
      'RPM Device',
      'Activation'
    ];

    return (
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm animate-fade-in" id="wizard-progress">
        {/* Name and context header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
              {language === 'ES' ? 'Paciente' : 'Patient'}
            </span>
            <span className="font-extrabold text-slate-800 text-sm">{patient.firstName} {patient.lastName}</span>
          </div>
          <span className="hidden text-[10px] font-bold text-blue-600 sm:inline">{PRODUCT_NAME} · {POWERED_BY}</span>
          <span className="text-xs font-bold text-slate-500">
            {language === 'ES' ? 'Progreso:' : 'Progress:'} {workflowProgress}%
          </span>
        </div>

        {/* Dots & lines indicator */}
        <div className="hidden md:flex justify-between items-center relative pr-4">
          {stepNames.map((name, i) => {
            const stepNum = i + 1;
            const state = getStepState(stepNum);
            const isDone = state === 'COMPLETED';
            const isActive = state === 'CURRENT';
            const isNotApplicable = state === 'NOT_APPLICABLE';
            
            return (
              <div key={i} className="flex flex-1 justify-center relative z-10">
                <button
                  type="button"
                  onClick={() => navigateToStep(stepNum)}
                  aria-label={`${l('Ir al paso', 'Go to step')} ${stepNum}: ${name}`}
                  aria-current={isActive ? 'step' : undefined}
                  className="group flex min-h-12 min-w-16 flex-col items-center rounded-lg px-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border-2 transition group-hover:scale-105 group-hover:border-blue-400 ${
                    isDone ? 'bg-blue-600 border-blue-600 text-white' :
                    isActive ? 'bg-blue-50 border-blue-600 text-blue-600 ring-4 ring-blue-500/10' :
                    isNotApplicable ? 'bg-slate-100 border-slate-300 text-slate-500' :
                    'bg-white border-slate-200 text-slate-400'
                  }`}>
                    {isDone ? <Check size={14} className="stroke-[2.5]" /> : isNotApplicable ? 'N/A' : stepNum}
                  </span>
                  <span className={`text-[9px] mt-1.5 max-w-28 text-center font-bold leading-tight transition group-hover:text-blue-600 ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>{name}</span>
                </button>
              </div>
            );
          })}
          {/* Horizontal connecting background line */}
          <div className="absolute top-4 left-6 right-6 h-[2px] bg-slate-100 -z-0" />
        </div>

        {/* Mobile Simplified progress */}
        <div className="md:hidden">
          <div className="flex items-start justify-between">
            {stepNames.map((name, i) => {
              const stepNum = i + 1;
              const state = getStepState(stepNum);
              const isDone = state === 'COMPLETED';
              const isActive = state === 'CURRENT';

              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => navigateToStep(stepNum)}
                  aria-label={`${l('Ir al paso', 'Go to step')} ${stepNum}: ${name}`}
                  aria-current={isActive ? 'step' : undefined}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold ${
                    isDone
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : isActive
                        ? 'border-blue-600 bg-blue-50 text-blue-600 ring-4 ring-blue-500/10'
                        : 'border-slate-200 bg-white text-slate-400'
                  }`}>
                    {isDone ? <Check size={14} className="stroke-[2.5]" /> : stepNum}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center space-x-2">
            <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full transition" style={{ width: `${workflowProgress}%` }} />
            </div>
            <span className="text-xs font-bold text-slate-600">
              {language === 'ES' ? `Paso ${step} de 5` : `Step ${step} of 5`}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const staffRoleLabel = currentUser.role === 'NURSE' ? 'Nurse' : 'Enrollment staff';
  const selectedServices = patient.assignedProgram || 'Not selected';
  const providerDisplayName = patient.provider?.trim() || '[Provider Name]';
  const providerDisplayWithTitle = /^dr\.?\s/i.test(providerDisplayName)
    ? providerDisplayName
    : `Dr. ${providerDisplayName}`;
  const deviceSetupReady = isRpmApplicable && medicalOrderApproved && Boolean(serialNumber.trim()) && devDeliveredToPatient && devInstructionsGiven && devUnderstandingDemonstrated;
  const consentMethodSelected = consentDecision === 'DECLINE' || (
    signatureMethod === 'DRAW' ||
    signatureMethod === 'TYPE' ||
    (signatureMethod === 'UNABLE' && Boolean(unableSignMethod))
  );
  const simplifiedStep2Ready = consentDecision === 'DECLINE' || (serviceExplanationConfirmed && consentRecordComplete && consentPdfGenerated);
  const canCompleteSimplifiedEnrollment = consentDecision === 'ACCEPT' && consentPdfGenerated;
  const rpmActivationLabel = !isRpmApplicable
    ? 'Not applicable'
    : firstReadingComplete && deviceSetupReady
      ? 'Active'
      : firstReadingComplete
        ? 'First reading captured'
        : 'Awaiting first reading';

  const setConsentMethod = (method: 'DRAW' | 'TYPE' | 'VERBAL' | 'MARK_X' | 'REPRESENTATIVE_SIGNATURE') => {
    setConsentPdfGenerated(false);
    setConsentPdfUrl('');
    setAutoConsentPdfAttempted(false);
    if (method === 'DRAW') {
      setSignatureMethod('DRAW');
      setUnableSignMethod('');
      setUnableConsentConfirmed(false);
    } else if (method === 'TYPE') {
      setSignatureMethod('TYPE');
      setUnableSignMethod('');
      setUnableConsentConfirmed(false);
    } else {
      setSignatureMethod('UNABLE');
      setUnableSignMethod(method);
      if (method === 'VERBAL') {
        setUnableToSignReason('');
      }
      if (method === 'REPRESENTATIVE_SIGNATURE') {
        setConsentSignerType('REPRESENTATIVE');
        setDecisionMaker('REPRESENTATIVE');
      }
    }
  };

  const handleSimplifiedContinueFromStep1 = () => {
    if (!idConfirmed) {
      setAlertMessage('Verify identity before continuing.');
      return;
    }
    if (!participationDecisionPath) {
      setAlertMessage('Select whether the patient can make the participation decision.');
      return;
    }
    if (participationDecisionPath === 'REPRESENTATIVE' && !readinessRepresentativeComplete) {
      setAlertMessage('Complete authorized representative identity and authority before continuing.');
      return;
    }
    setAlertMessage(null);
    setStep(2);
  };

  const handleSimplifiedConsentContinue = async () => {
    if (!serviceExplanationConfirmed) {
      setAlertMessage('Confirm the explanation before documenting consent.');
      return;
    }
    if (!consentDecision) {
      setAlertMessage('Select the participation decision.');
      return;
    }
    if (consentDecision === 'DECLINE') {
      handleSaveAndExitLocal();
      return;
    }
    if (!consentMethodSelected) {
      setAlertMessage('Select how consent will be documented.');
      return;
    }
    if (!representativeComplete) {
      setAlertMessage('Complete the authorized representative identity and authority fields.');
      return;
    }
    if (!signerName.trim()) {
      setAlertMessage('Enter the signer name before continuing.');
      return;
    }
    if (!patientEvidenceComplete) {
      if (signatureMethod === 'DRAW') {
        setAlertMessage('Capture and save the signature before continuing.');
      } else if (signatureMethod === 'TYPE') {
        setAlertMessage('Complete and confirm the typed signature before continuing.');
      } else if (isVerbalConsent) {
        setAlertMessage('Confirm verbal consent before continuing.');
      } else if (isMarkXConsent) {
        setAlertMessage('Capture the Mark/X signature and complete witness attestation before continuing.');
      } else {
        setAlertMessage('Complete the selected consent evidence before continuing.');
      }
      return;
    }
    if (!nurseAttestationComplete) {
      setAlertMessage('Confirm the enrollment personnel attestation before continuing.');
      return;
    }
    if (!consentRecordComplete) {
      setAlertMessage('Complete the consent method, signer information, and staff attestation.');
      return;
    }
    let pdfReady = consentPdfGenerated;
    if (!pdfReady && !isGeneratingConsentPdf) {
      pdfReady = await triggerConsentPDFGeneration(true);
    }
    if (pdfReady) {
      setAlertMessage(null);
      setStep(3);
    }
  };

  const handleSimplifiedCompleteEnrollment = async () => {
    if (!canCompleteSimplifiedEnrollment) {
      setAlertMessage('Consent must be completed before enrollment can be finished.');
      return;
    }
    if (isRpmApplicable && deviceSetupReady && !deliveryPdfGenerated && !isGeneratingDeliveryPdf) {
      await triggerDeliveryPDFGeneration();
    }
    const shouldActivate = !isRpmApplicable || (isRpmApplicable && deviceSetupReady && firstReadingComplete);
    const { visitObj, consentObj, deviceObj, readingObj } = createStateBundles(false);
    visitObj.status = 'COMPLETED';
    visitObj.endTime = new Date().toISOString();
    visitObj.currentStep = 3;
    setAlertMessage(null);
    onSaveAndExit(visitObj, consentObj, deviceObj, readingObj, shouldActivate);
  };

  const ThreeStepProgress = () => {
    const steps = ['Confirm patient', 'Explain & obtain consent', 'Complete enrollment'];
    return (
      <div className="enrollment-topbar" id="wizard-progress">
        <div className="enrollment-header">
          <div className="enrollment-brand">
            <div>
              <p className="enrollment-brand-kicker">{PRODUCT_NAME}</p>
              <h1>On-site enrollment</h1>
            </div>
          </div>
          <div className="enrollment-time">
            <Clock3 size={18} aria-hidden="true" />
            <span>Estimated time: 4-7 minutes</span>
          </div>
        </div>
        <div className="enrollment-stepper" role="list" aria-label="Enrollment progress">
          {steps.map((name, index) => {
            const stepNumber = index + 1;
            const isCurrent = step === stepNumber;
            const isDone = step > stepNumber;
            const canNavigateToStep = stepNumber === 1 || (stepNumber === 2 && step1Complete) || (stepNumber === 3 && consentPdfGenerated);
            return (
              <button
                key={name}
                type="button"
                onClick={() => {
                  if (canNavigateToStep) {
                    setStep(stepNumber);
                  }
                }}
                disabled={!canNavigateToStep}
                className={`enrollment-step ${isCurrent ? 'is-active' : ''} ${isDone ? 'is-complete' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
                role="listitem"
              >
                <span className="enrollment-step-number">{isDone ? <Check size={16} aria-hidden="true" /> : stepNumber}</span>
                <span className="enrollment-step-text">{name}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const SectionHeader = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
    <div className="enrollment-section-title">
      <span className="enrollment-section-icon" aria-hidden="true">{icon}</span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );

  const DecisionCard = ({ active, title, helper, icon, onClick }: { active: boolean; title: string; helper?: string; icon?: React.ReactNode; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className={`enrollment-selection-card ${active ? 'is-selected' : ''}`}
      aria-pressed={active}
    >
      {icon && <span className="enrollment-selection-icon" aria-hidden="true">{icon}</span>}
      <span className="enrollment-selection-copy">
        <span className="enrollment-selection-title">{title}</span>
        {helper && <span className="enrollment-selection-helper">{helper}</span>}
      </span>
      <span className="enrollment-radio" aria-hidden="true" />
    </button>
  );

  return (
    <div className="enrollment-shell text-slate-900" id="wizard-container">
      <ThreeStepProgress />

      {alertMessage && (
        <div className="enrollment-alert" role="alert" aria-live="polite">
          <AlertCircle size={18} aria-hidden="true" />
          {alertMessage}
        </div>
      )}

      <main className="enrollment-card-shell" id="wizard-body">
        {step === 1 && (
          <section className="enrollment-screen">
            <SectionHeader
              icon={<ShieldCheck size={24} />}
              title="Confirm patient"
              description="Verify the patient and confirm whether the patient can make the participation decision."
            />

            <div className="enrollment-summary-card">
              <div className="enrollment-card-heading">
                <div className="enrollment-row-heading">
                  <div>
                    <h3>Patient summary</h3>
                    <p>Please verify the patient information below.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="enrollment-ghost-action"
                >
                  <Pencil size={16} className="mr-2" /> Edit patient
                </button>
              </div>
              <div className="enrollment-summary-grid">
                {[
                  ['Patient name', `${patient.firstName} ${patient.lastName}`],
                  ['Date of birth', patient.birthDate],
                  ['Ordering provider', patient.provider],
                  ['Selected services', selectedServices]
                ].map(([label, value]) => (
                  <div className="enrollment-summary-item" key={label}>
                    <p>{label}</p>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <label className={`enrollment-attestation ${idConfirmed ? 'is-complete' : ''}`}>
              <input
                type="checkbox"
                checked={idConfirmed}
                onChange={(event) => setIdConfirmed(event.target.checked)}
                className="mt-1 h-6 w-6 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                <strong>I verified the patient's identity using at least two identifiers.</strong>
                <small>Identity verification is required before consent can be captured.</small>
              </span>
            </label>

            <div className="enrollment-subcard space-y-4">
              <h3 className="enrollment-question-title">Can the patient understand the explanation and make a participation decision?</h3>
              <div className="enrollment-selection-grid two">
                <DecisionCard
                  active={participationDecisionPath === 'PATIENT'}
                  title="Yes, the patient can decide"
                  helper="Decision maker and consent provider will be set to Patient."
                  icon={<UserRound size={22} />}
                  onClick={() => {
                    setParticipationDecisionPath('PATIENT');
                    setPatientCanDecide(true);
                    setDecisionMaker('PATIENT');
                    setConsentSignerType('PATIENT');
                    setRepresentativeAvailability('NONE');
                    setRepPresent(false);
                    setPatientAvailable(true);
                  }}
                />
                <DecisionCard
                  active={participationDecisionPath === 'REPRESENTATIVE'}
                  title="No, authorized representative required"
                  helper="Decision maker and consent provider will be set to Authorized representative."
                  icon={<UserRoundCheck size={22} />}
                  onClick={() => {
                    setParticipationDecisionPath('REPRESENTATIVE');
                    setPatientCanDecide(false);
                    setDecisionMaker('REPRESENTATIVE');
                    setConsentSignerType('REPRESENTATIVE');
                    setRepresentativeAvailability(representativeAvailability === 'NONE' ? 'LEGAL' : representativeAvailability);
                    setRepPresent(true);
                  }}
                />
              </div>
              {participationDecisionPath === 'REPRESENTATIVE' && (
                <p className="enrollment-info-banner"><Info size={16} aria-hidden="true" /> Complete the authorized representative fields below to continue.</p>
              )}
            </div>

            {participationDecisionPath === 'REPRESENTATIVE' && (
              <div className="enrollment-form-grid">
                <div>
                  <label className="mb-1 block text-sm font-bold">Full legal name</label>
                  <input value={readinessRepName} onChange={(e) => { setReadinessRepName(e.target.value); setSignerName(e.target.value); }} className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold">Relationship to patient</label>
                  <input value={readinessRepRelationship} onChange={(e) => { setReadinessRepRelationship(e.target.value); setRepRelationship(e.target.value); }} className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold">Authority basis</label>
                  <select value={readinessRepAuthority} onChange={(e) => { setReadinessRepAuthority(e.target.value as typeof readinessRepAuthority); setAuthorityType(e.target.value as typeof authorityType); }} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base">
                    <option value="">Select</option>
                    <option value="HEALTH_CARE_PROXY">Health care surrogate</option>
                    <option value="POWER_OF_ATTORNEY">Health care power of attorney</option>
                    <option value="GUARDIAN">Legal guardian</option>
                    <option value="OTHER">Other authorized representative</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold">Phone number</label>
                  <input value={readinessRepPhone} onChange={(e) => { setReadinessRepPhone(e.target.value); setRepresentativePhone(e.target.value); }} className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base" />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-bold">Email, optional</label>
                  <input type="email" value={readinessRepEmail} onChange={(e) => { setReadinessRepEmail(e.target.value); setRepresentativeEmail(e.target.value); }} className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base" />
                </div>
              </div>
            )}
          </section>
        )}

        {step === 2 && (
          <section className="enrollment-screen">
            <SectionHeader
              icon={<FileSignature size={24} />}
              title="Explain & obtain consent"
              description="Explain the selected services, record the decision, and document consent."
            />

            <section className="enrollment-guide-card">
              <div className="min-w-0">
                <p className="enrollment-eyebrow">Enrollment guide</p>
                <ul className="enrollment-guide-list">
                  {[
                    `${providerDisplayWithTitle} would like our care team to help monitor and coordinate your care between visits.`,
                    'A Care Manager may contact you to review your health, medications, symptoms, and care needs.',
                    isRpmApplicable ? 'If remote monitoring is included, you will receive a connected device that securely sends your readings to the care team.' : '',
                    'Participation is voluntary. You may stop the service at any time.',
                    'Medicare may cover the service, but cost-sharing may apply depending on your coverage.',
                    'Only one practitioner may provide and bill for the same service during the applicable billing period.',
                    'This service is not for emergencies. If you have a medical emergency, call 911.'
                  ].filter(Boolean).map(item => (
                    <li key={item}><CheckCircle size={15} aria-hidden="true" /> <span>{item}</span></li>
                  ))}
                </ul>
                <button type="button" onClick={() => setShowDetailedEnrollmentGuide(!showDetailedEnrollmentGuide)} className="enrollment-ghost-action mt-5">
                  <FileText size={16} className="mr-2" aria-hidden="true" />
                  {showDetailedEnrollmentGuide ? 'Hide detailed script' : 'View detailed script'}
                </button>
                {showDetailedEnrollmentGuide && (
                  <div className="mt-4 rounded-xl border border-blue-100 bg-white p-4 text-base leading-relaxed text-slate-700">
                    {step2GuideScript.split('\n\n').map((paragraph, index) => <p key={index} className="mb-3 last:mb-0">{paragraph}</p>)}
                  </div>
                )}
              </div>
            </section>

            <label className={`enrollment-attestation ${serviceExplanationConfirmed ? 'is-complete' : ''}`}>
              <input type="checkbox" checked={serviceExplanationConfirmed} onChange={(e) => setServiceExplanationConfirmed(e.target.checked)} className="mt-1 h-6 w-6 rounded text-blue-600" />
              <span className="enrollment-attestation-icon" aria-hidden="true"><ShieldCheck size={22} /></span>
              <span>
                <strong>I explained the selected services, answered questions, and confirmed understanding.</strong>
                <small>This step is required before capturing consent.</small>
              </span>
            </label>

            <section className="enrollment-subcard space-y-4">
              <h3 className="enrollment-question-title">What is the participation decision?</h3>
              <p className="enrollment-muted-copy">Record the patient's decision for the selected services.</p>
              <div className="enrollment-selection-grid two">
                <DecisionCard active={consentDecision === 'ACCEPT'} title="Accept services" helper="Patient agrees to receive the selected services." onClick={() => setConsentDecision('ACCEPT')} />
                <DecisionCard active={consentDecision === 'DECLINE'} title="Decline services" helper="Patient does not want to receive the services." onClick={() => setConsentDecision('DECLINE')} />
              </div>
              {consentDecision === 'DECLINE' && (
                <div className="enrollment-consent-panel">
                  <label className="mb-1 block text-sm font-bold">Reason, optional</label>
                  <textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-300 p-3 text-base" />
                  <p className="mt-3 text-sm font-semibold text-slate-600">No signature is required when services are declined. The decline will be recorded and the enrollment flow will close.</p>
                </div>
              )}
            </section>

            {consentDecision === 'ACCEPT' && (
              <>
                <section className="enrollment-summary-card">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="enrollment-row-heading">
                      <div>
                        <h3>Participation summary</h3>
                        <p>The patient has accepted services.</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setStep(1)} className="enrollment-ghost-action"><Pencil size={16} className="mr-2" /> Edit responses</button>
                  </div>
                  <div className="enrollment-summary-grid mt-4">
                    <div className="enrollment-summary-item">
                      <p>Participation decision</p>
                      <strong>Accept services</strong>
                    </div>
                    <div className="enrollment-summary-item">
                      <p>Consent provided by</p>
                      <strong>{decisionMaker === 'REPRESENTATIVE' ? 'Authorized representative' : 'Patient'}</strong>
                    </div>
                  </div>
                </section>

                {decisionMaker === 'REPRESENTATIVE' && (
                  <section className="enrollment-form-grid">
                    <div><label className="mb-1 block text-sm font-bold">Full legal name</label><input value={signerName} onChange={(e) => setSignerName(e.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base" /></div>
                    <div><label className="mb-1 block text-sm font-bold">Relationship to patient</label><input value={repRelationship} onChange={(e) => setRepRelationship(e.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base" /></div>
                    <div><label className="mb-1 block text-sm font-bold">Authority basis</label><select value={authorityType} onChange={(e) => setAuthorityType(e.target.value as typeof authorityType)} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"><option value="">Select</option><option value="HEALTH_CARE_PROXY">Health care surrogate</option><option value="POWER_OF_ATTORNEY">Health care power of attorney</option><option value="GUARDIAN">Legal guardian</option><option value="OTHER">Other authorized representative</option></select></div>
                    <div><label className="mb-1 block text-sm font-bold">Phone number</label><input value={representativePhone} onChange={(e) => setRepresentativePhone(e.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base" /></div>
                    <div className="md:col-span-2"><label className="mb-1 block text-sm font-bold">Email, optional</label><input type="email" value={representativeEmail} onChange={(e) => setRepresentativeEmail(e.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base" /></div>
                  </section>
                )}

                <section className="enrollment-subcard space-y-4">
                  <h3 className="enrollment-question-title">How will consent be documented?</h3>
                  <p className="enrollment-muted-copy">Select the method used to capture consent.</p>
                  <div className="enrollment-selection-grid consent-methods">
                    <DecisionCard active={signatureMethod === 'DRAW'} title="Draw signature" helper="Capture a handwritten signature." onClick={() => setConsentMethod('DRAW')} />
                    <DecisionCard active={signatureMethod === 'TYPE'} title="Type full legal name" helper="Enter the signer's full legal name." icon={<Type size={22} />} onClick={() => setConsentMethod('TYPE')} />
                    <DecisionCard active={isVerbalConsent} title="Verbal consent" helper="Document that verbal consent was provided." icon={<AudioLines size={22} />} onClick={() => setConsentMethod('VERBAL')} />
                    <DecisionCard active={isMarkXConsent} title="Mark or X" helper="Signer marks an X to consent." icon={<XIcon size={22} />} onClick={() => setConsentMethod('MARK_X')} />
                    <DecisionCard active={unableSignMethod === 'REPRESENTATIVE_SIGNATURE'} title="Representative signature" helper="Authorized representative signs on behalf of the patient." icon={<UserRoundCheck size={22} />} onClick={() => setConsentMethod('REPRESENTATIVE_SIGNATURE')} />
                  </div>

                  {signatureMethod === 'DRAW' && (
                    <div className="enrollment-signature-panel">
                      <div>
                        <h4>Signer details</h4>
                        <p>Enter the name of the person providing consent.</p>
                        <label className="mt-4 mb-2 block text-sm font-bold">Signer name</label>
                        <input value={signerName} onChange={(e) => setSignerName(e.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base" />
                      </div>
                      <div>
                        <div className="mb-3 flex items-center gap-2">
                          <h4>{decisionMaker === 'REPRESENTATIVE' ? 'Representative signature' : 'Patient signature'}</h4>
                          <span className="enrollment-required-badge">Required</span>
                        </div>
                        <SignaturePad id="simplified-draw-signature" label={decisionMaker === 'REPRESENTATIVE' ? 'Authorized Representative Signature' : 'Patient Signature'} onSave={handleSavePatientSignature} onClear={() => setPatientSignature('')} savedDataUrl={patientSignature} signerName={signerName} confirmLabel="Save signature" />
                      </div>
                    </div>
                  )}

                  {signatureMethod === 'TYPE' && (
                    <div className="enrollment-consent-panel space-y-4">
                      <div><label className="mb-1 block text-sm font-bold">Full legal name</label><input value={typedSignatureName} onChange={(e) => setTypedSignatureName(e.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base" /></div>
                      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white p-4"><input type="checkbox" checked={typedSignatureAgreed} onChange={(e) => setTypedSignatureAgreed(e.target.checked)} className="mt-1 h-5 w-5 rounded text-blue-600" /><span className="text-base font-bold">I confirm that typing my full legal name represents my signature.</span></label>
                      <button type="button" onClick={() => { setSignerName(typedSignatureName.trim()); setTypedSignatureConfirmed(true); }} disabled={!typedSignatureName.trim() || !typedSignatureAgreed} className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-extrabold text-white disabled:opacity-50">Confirm typed signature</button>
                    </div>
                  )}

                  {isVerbalConsent && (
                    <div className="enrollment-consent-panel enrollment-form-grid">
                      <div><p className="text-sm font-bold text-slate-500">Consent obtained by</p><p className="text-lg font-black">{currentUser.name}</p></div>
                      <div><p className="text-sm font-bold text-slate-500">Staff role/title</p><p className="text-lg font-black">{staffRoleLabel}</p></div>
                      <div><p className="text-sm font-bold text-slate-500">Facility</p><p className="text-lg font-black">{patient.nursingHome}</p></div>
                      <div><p className="text-sm font-bold text-slate-500">Date and time</p><p className="text-lg font-black">{new Date().toLocaleString()}</p></div>
                      <div className="md:col-span-2"><label className="mb-1 block text-sm font-bold">Consent documentation note, optional</label><textarea value={verbalConsentNurseNote} onChange={(e) => setVerbalConsentNurseNote(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-300 p-3 text-base" /></div>
                      <button type="button" onClick={() => setUnableConsentConfirmed(true)} className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-extrabold text-white">Confirm verbal consent</button>
                    </div>
                  )}

                  {isMarkXConsent && (
                    <div className="enrollment-consent-panel space-y-4">
                      <SignaturePad id="simplified-mark-x" label="Mark/X signature area" onSave={handleSavePatientSignature} onClear={() => setPatientSignature('')} savedDataUrl={patientSignature} signerName={signerName} confirmLabel="Save Mark/X" />
                      <div><label className="mb-1 block text-sm font-bold">Reason full signature could not be provided</label><textarea value={unableToSignReason} onChange={(e) => setUnableToSignReason(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-300 p-3 text-base" /></div>
                      <div className="grid gap-4 md:grid-cols-2"><div><label className="mb-1 block text-sm font-bold">Witness name</label><input value={markWitnessName} onChange={(e) => setMarkWitnessName(e.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base" /></div><div><label className="mb-1 block text-sm font-bold">Witness role/title</label><input value={markWitnessRole} onChange={(e) => setMarkWitnessRole(e.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base" /></div></div>
                      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white p-4"><input type="checkbox" checked={markWitnessAttested} onChange={(e) => setMarkWitnessAttested(e.target.checked)} className="mt-1 h-5 w-5 rounded text-blue-600" /><span className="text-base font-bold">Witness attestation completed.</span></label>
                      <button type="button" onClick={() => setUnableConsentConfirmed(true)} disabled={!patientSignature || !unableToSignReason.trim() || !markWitnessName.trim() || !markWitnessRole.trim() || !markWitnessAttested} className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-extrabold text-white disabled:opacity-50">Confirm Mark/X</button>
                    </div>
                  )}
                </section>

                <label className={`enrollment-attestation ${staffAttestationConfirmed ? 'is-complete' : ''}`}>
                  <input type="checkbox" checked={staffAttestationConfirmed} onChange={(e) => setStaffAttestationConfirmed(e.target.checked)} className="mt-1 h-6 w-6 rounded text-blue-600" />
                  <span className="enrollment-attestation-icon" aria-hidden="true"><ClipboardCheck size={22} /></span>
                  <span>
                    <strong>I confirm that I verified the signer’s identity and role, explained the selected services, answered questions, and accurately documented the patient’s or authorized representative’s decision.</strong>
                    <small><span className="enrollment-required-badge">Required</span></small>
                  </span>
                </label>

                <div className="enrollment-pdf-card">
                  <span className="enrollment-section-icon" aria-hidden="true"><FileCheck size={20} /></span>
                  <div>
                    <p>Consent PDF</p>
                    <strong className={consentPdfGenerated ? 'text-emerald-700' : 'text-slate-800'}>{isGeneratingConsentPdf ? 'Generating automatically...' : consentPdfGenerated ? 'Generated and attached' : 'Will generate automatically after consent is confirmed.'}</strong>
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {step === 3 && (
          <section className="enrollment-screen">
            <SectionHeader
              icon={<ClipboardCheck size={24} />}
              title="Complete enrollment"
              description={isRpmApplicable ? 'Finalize RPM setup if applicable, then finish enrollment.' : 'Review the CCM enrollment summary and finish.'}
            />

            <section className="enrollment-row-card">
              <div className="enrollment-row-heading">
                <div>
                  <h3>Optional patient app</h3>
                  <p>Would the patient or caregiver like information about the mobile app?</p>
                </div>
              </div>
              <div className="enrollment-segmented">
                <DecisionCard active={wantsPatientAppInfo === 'YES'} title="Yes" onClick={() => setWantsPatientAppInfo('YES')} />
                <DecisionCard active={wantsPatientAppInfo === 'NO'} title="No" onClick={() => setWantsPatientAppInfo('NO')} />
              </div>
            </section>

            {!isRpmApplicable ? (
              <section className="enrollment-subcard">
                <h3 className="enrollment-question-title">Enrollment summary</h3>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {[['Identity verified', idConfirmed], ['Service explanation completed', serviceExplanationConfirmed], ['Consent recorded', consentDecision === 'ACCEPT'], ['Consent PDF generated', consentPdfGenerated], ['CCM enrollment ready', true]].map(([label, ready]) => (
                    <div key={String(label)} className="enrollment-check-row rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <CheckCircle size={20} className={ready ? 'text-emerald-600' : 'text-slate-300'} />
                      <span className="text-base font-extrabold">{label as string}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <section className="enrollment-complete-grid">
                <div className="space-y-5">
                <div className="enrollment-subcard">
                  <h3 className="enrollment-question-title"><Monitor size={20} aria-hidden="true" /> RPM device setup</h3>
                  <div className="mt-4">
                    {medicalOrderApproved ? (
                      <p className="enrollment-success-banner"><CheckCircle size={16} aria-hidden="true" /> RPM order approved</p>
                    ) : (
                      <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-base font-bold text-amber-900">RPM device assignment requires an approved medical order.</p>
                    )}
                  </div>
                </div>

                {medicalOrderApproved && (
                  <>
                    <div className="enrollment-subcard">
                      <h4 className="enrollment-question-title"><ScanBarcode size={20} aria-hidden="true" /> Device information</h4>
                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <div><label className="mb-1 block text-sm font-bold">Device</label><select value={deviceType} onChange={(e) => setDeviceType(e.target.value as typeof deviceType)} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"><option value="BP Monitor">BP Monitor</option><option value="Scale">Scale</option><option value="Other">Other</option></select></div>
                        <div><label className="mb-1 block text-sm font-bold">Model</label><input value={model} onChange={(e) => setModel(e.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base" placeholder="Device model" /></div>
                        <div><label className="mb-1 block text-sm font-bold">Device ID</label><input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base" placeholder="Device ID" /></div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => setHasAdditionalDevice(previous => !previous)}
                          className="min-h-11 rounded-xl border border-blue-200 px-4 text-sm font-extrabold text-blue-700 hover:bg-blue-50"
                        >
                          {hasAdditionalDevice ? 'Remove second device' : 'Add second device'}
                        </button>
                      </div>
                      {hasAdditionalDevice && (
                        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                          <p className="text-sm font-extrabold text-blue-950">Second device</p>
                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-sm font-bold">Device type</label>
                              <select value={additionalDeviceType} onChange={(e) => setAdditionalDeviceType(e.target.value as typeof additionalDeviceType)} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base">
                                <option value="BP Monitor">BP Monitor</option>
                                <option value="Scale">Scale</option>
                                <option value="Pulse Oximeter">Pulse Oximeter</option>
                                <option value="Glucometer">Glucometer</option>
                                <option value="Other">Other</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-sm font-bold">Device ID</label>
                              <input value={additionalSerialNumber} onChange={(e) => setAdditionalSerialNumber(e.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base" placeholder="Second device ID" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="enrollment-subcard">
                      <h4 className="enrollment-question-title"><GraduationCap size={20} aria-hidden="true" /> Delivery and education</h4>
                      <div className="mt-4 space-y-3">
                        {[['Device delivered to the patient or responsible staff', devDeliveredToPatient, setDevDeliveredToPatient], ['Device use and measurement technique explained', devInstructionsGiven, setDevInstructionsGiven], ['Patient or responsible staff demonstrated understanding', devUnderstandingDemonstrated, setDevUnderstandingDemonstrated]].map(([label, checked, setter]) => (
                          <label key={String(label)} className="flex cursor-pointer items-start gap-4 rounded-xl border border-slate-200 p-4">
                            <input type="checkbox" checked={Boolean(checked)} onChange={(e) => (setter as React.Dispatch<React.SetStateAction<boolean>>)(e.target.checked)} className="mt-1 h-5 w-5 rounded text-blue-600" />
                            <span className="text-base font-bold">{label as string}</span>
                          </label>
                        ))}
                      </div>
                      <div className="mt-4"><label className="mb-1 block text-sm font-bold">Who received the education?</label><select value={educationRecipient} onChange={(e) => setEducationRecipient(e.target.value as typeof educationRecipient)} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"><option value="PATIENT">Patient</option><option value="FACILITY_STAFF">Facility staff</option><option value="CAREGIVER">Caregiver</option><option value="AUTHORIZED_REPRESENTATIVE">Authorized representative</option></select></div>
                    </div>

                    <div className="enrollment-subcard">
                      <h4 className="enrollment-question-title"><HeartPulse size={20} aria-hidden="true" /> First reading</h4>
                      <p className="mt-1 text-sm font-semibold text-slate-600">The first reading is helpful, but enrollment can be completed while activation is pending.</p>
                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <div><label className="mb-1 block text-sm font-bold">Systolic</label><input inputMode="numeric" value={systolic} onChange={(e) => setSystolic(e.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base" /></div>
                        <div><label className="mb-1 block text-sm font-bold">Diastolic</label><input inputMode="numeric" value={diastolic} onChange={(e) => setDiastolic(e.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base" /></div>
                        <div><label className="mb-1 block text-sm font-bold">Pulse</label><input inputMode="numeric" value={pulse} onChange={(e) => setPulse(e.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base" /></div>
                      </div>
                    </div>
                  </>
                )}
                </div>
                <aside className="enrollment-sidebar">
                  <div className="enrollment-subcard">
                    <h3 className="enrollment-question-title">Enrollment checklist</h3>
                    <div className="mt-4 space-y-3">
                      {[
                        ['Patient identity verified', idConfirmed],
                        ['Consent documented', consentPdfGenerated],
                        ['Device assigned', deviceSetupReady],
                        ['Education completed', devInstructionsGiven && devUnderstandingDemonstrated],
                        ['First reading captured', firstReadingComplete],
                        ['Enrollment finalized', canCompleteSimplifiedEnrollment]
                      ].map(([label, ready]) => (
                        <div key={String(label)} className="enrollment-check-row">
                          <CheckCircle size={17} className={ready ? 'text-emerald-700' : 'text-slate-300'} aria-hidden="true" />
                          <span>{label as string}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="enrollment-subcard">
                    <h3 className="enrollment-question-title">Patient summary</h3>
                    <div className="mt-4 space-y-3 text-sm">
                      <p><strong>{patient.firstName} {patient.lastName}</strong></p>
                      <p>Services: <strong>{selectedServices}</strong></p>
                      <p>Decision maker: <strong>{decisionMaker === 'REPRESENTATIVE' ? 'Authorized representative' : 'Patient'}</strong></p>
                      <p>Consent method: <strong>{signatureMethod === 'UNABLE' ? unableSignMethod.replaceAll('_', ' ') : signatureMethod}</strong></p>
                      <p>Facility: <strong>{patient.nursingHome}</strong></p>
                    </div>
                  </div>
                </aside>
              </section>
            )}

            <section className="enrollment-subcard bg-slate-50">
              <h3 className="text-2xl font-black">Enrollment completed</h3>
              <p className="mt-1 text-base font-semibold text-slate-600">{patient.firstName} {patient.lastName} is ready to finish enrollment.</p>
              <div className="enrollment-status-grid">
                <div className="enrollment-status-tile success"><p>Consent</p><strong>Completed</strong></div>
                <div className="enrollment-status-tile neutral"><p>CCM</p><strong>{patient.assignedProgram.includes('CCM') ? 'Enrolled' : 'Not selected'}</strong></div>
                {isRpmApplicable && <div className={`enrollment-status-tile ${deviceSetupReady ? 'success' : 'warning'}`}><p>RPM device</p><strong>{deviceSetupReady ? 'Assigned' : 'Pending'}</strong></div>}
                {isRpmApplicable && <div className="enrollment-status-tile info"><p>RPM activation</p><strong>{rpmActivationLabel}</strong></div>}
              </div>
            </section>
          </section>
        )}

        <footer className="enrollment-action-bar">
          <button type="button" onClick={() => setShowExitDialog(true)} className="enrollment-exit-action"><LogOut size={16} className="mr-2" />Exit enrollment</button>
          <div className="enrollment-action-group">
            <button type="button" onClick={handleSaveAndExitLocal} className="enrollment-secondary-action"><Bookmark size={16} className="mr-2" />Save & continue later</button>
            {step > 1 && <button type="button" onClick={() => setStep(step - 1)} className="enrollment-secondary-action"><ArrowLeft size={16} className="mr-2" />Back</button>}
            {step === 1 && <button type="button" onClick={handleSimplifiedContinueFromStep1} disabled={!step1Complete} className="enrollment-primary-action">Continue<ArrowRight size={16} className="ml-2" /></button>}
            {step === 2 && <button type="button" onClick={handleSimplifiedConsentContinue} disabled={isGeneratingConsentPdf} className="enrollment-primary-action">{isGeneratingConsentPdf ? 'Generating PDF...' : consentDecision === 'DECLINE' ? 'Record decline & finish' : 'Continue to document consent'}<ArrowRight size={16} className="ml-2" /></button>}
            {step === 3 && <button type="button" onClick={handleSimplifiedCompleteEnrollment} disabled={!canCompleteSimplifiedEnrollment || isGeneratingDeliveryPdf} className="enrollment-complete-action">{isGeneratingDeliveryPdf ? 'Saving device record...' : 'Complete enrollment'}<CheckCircle size={16} className="ml-2" /></button>}
          </div>
        </footer>
      </main>

      <EditPatientModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={(updatedPatient) => {
          if (onUpdatePatient) {
            onUpdatePatient(updatedPatient);
          }
        }}
        patient={patient}
        currentUser={currentUser}
        nursingHomes={nursingHomes}
        conditionGroups={conditionGroups}
        diagnoses={diagnoses}
      />

      {showExitDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="exit-enrollment-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 id="exit-enrollment-title" className="text-xl font-extrabold text-slate-900">Exit enrollment?</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">Do you want to save this enrollment as a draft or discard it?</p>
            <div className="mt-6 flex flex-col gap-3">
              <button type="button" onClick={() => { setShowExitDialog(false); handleSaveAndExitLocal(); }} className="min-h-12 rounded-xl bg-blue-600 px-5 text-sm font-extrabold text-white hover:bg-blue-700">Save Draft & Exit</button>
              <button type="button" onClick={() => { setShowExitDialog(false); onCancel(); }} className="min-h-11 rounded-xl border border-rose-200 bg-rose-50 px-5 text-sm font-bold text-rose-700 hover:bg-rose-100">Discard Enrollment</button>
              <button type="button" onClick={() => setShowExitDialog(false)} className="min-h-11 rounded-xl border border-slate-300 px-5 text-sm font-bold text-slate-700 hover:bg-slate-50">Continue Editing</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6" id="wizard-container">
      {/* Step header */}
      {renderStepIndicator()}

      {/* Main wizard cards */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" id="wizard-body">
        
        {/* Step 1: Confirm Identity */}
        {step === 1 && (
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{l('Paso 1: Identidad', 'Step 1: Identity')}</h2>
                <p className="text-slate-500 text-sm mt-1">{l('Confirme la identidad del paciente antes de continuar.', 'Confirm the patient identity before continuing.')}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center justify-center px-4.5 py-2 text-xs font-extrabold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200/60 transition cursor-pointer self-start sm:self-center shrink-0"
                id="btn-edit-patient-wizard"
              >
                <Edit3 size={13} className="mr-1.5 text-blue-500" />
                {language === 'ES' ? 'Editar Paciente' : 'Edit Patient'}
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{l('Nombre del Paciente', 'Patient Name')}</p>
                <p className="text-base font-black text-slate-800 mt-0.5">{patient.firstName} {patient.lastName}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{l('Fecha de Nacimiento', 'Date of Birth')}</p>
                <p className="text-base font-semibold text-slate-800 mt-0.5">{patient.birthDate}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{l('Residencia', 'Nursing Home')}</p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5">{patient.nursingHome}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{l('Habitación', 'Room')}</p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5">{l('Habitación', 'Room')}: {patient.room || l('No provisto', 'Not provided')}</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-start space-x-3 cursor-pointer p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition">
                <input
                  type="checkbox"
                  checked={idConfirmed}
                  onChange={(e) => setIdConfirmed(e.target.checked)}
                  className="h-4.5 w-4.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 mt-0.5 cursor-pointer"
                />
                <div>
                  <p className="text-sm font-bold text-slate-800">{l('Identidad Confirmada físicamente', 'Identity Physically Confirmed')}</p>
                  <p className="text-xs text-slate-500">{l('Verifiqué la identidad del paciente usando los identificadores requeridos en la residencia.', 'I verified the patient’s identity using the required identifiers at the nursing home.')}</p>
                </div>
              </label>

              <label className="flex items-start space-x-3 cursor-pointer p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition">
                <input
                  type="checkbox"
                  checked={patientAvailable}
                  onChange={(e) => setPatientAvailable(e.target.checked)}
                  className="h-4.5 w-4.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 mt-0.5 cursor-pointer"
                />
                <div>
                  <p className="text-sm font-bold text-slate-800">{l('Paciente preparado para la explicación', 'Patient Ready for Explanation')}</p>
                  <p className="text-xs text-slate-500">{l('El paciente está despierto, disponible y puede escuchar la explicación del servicio.', 'Patient is awake, available, and able to listen to the service explanation.')}</p>
                </div>
              </label>

              <label className="flex items-start space-x-3 cursor-pointer p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition">
                <input
                  type="checkbox"
                  checked={patientCanDecide}
                  onChange={(e) => setPatientCanDecide(e.target.checked)}
                  className="h-4.5 w-4.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 mt-0.5 cursor-pointer"
                />
                <div>
                  <p className="text-sm font-bold text-slate-800">{l('El paciente parece capaz de tomar una decisión', 'Patient Appears Able to Make a Decision')}</p>
                  <p className="text-xs text-slate-500">{l('El paciente parece capaz de comprender la explicación y decidir sobre su participación.', 'Patient appears able to understand the explanation and make a participation decision.')}</p>
                </div>
              </label>

              <div className={`rounded-2xl border p-5 ${representativeRequired ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 bg-slate-50/50'}`}>
                <div className="mb-4">
                  <h3 className="text-sm font-extrabold text-slate-900">{l('Representante presente / disponible', 'Representative Present / Available')}</h3>
                  <p className="mt-1 text-xs text-slate-500">{representativeRequired
                    ? l('Se requiere un representante porque el paciente no está preparado o no parece capaz de decidir.', 'A representative is required because the patient is not ready or does not appear able to decide.')
                    : l('Documente si un representante participa en el proceso.', 'Document whether a representative is participating in the process.')}
                  </p>
                </div>
                <select
                  value={representativeAvailability}
                  onChange={(e) => {
                    const value = e.target.value as typeof representativeAvailability;
                    setRepresentativeAvailability(value);
                    setRepPresent(value !== 'NONE');
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold"
                >
                  <option value="NONE">{l('No hay representante presente', 'No representative present')}</option>
                  <option value="FAMILY">{l('Familiar presente', 'Family member present')}</option>
                  <option value="LEGAL">{l('Representante legal presente', 'Legal representative present')}</option>
                  <option value="REMOTE">{l('Representante disponible remotamente', 'Representative available remotely')}</option>
                </select>

                {representativeAvailability !== 'NONE' && (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <input value={readinessRepName} onChange={(e) => setReadinessRepName(e.target.value)} placeholder={l('Nombre completo *', 'Representative full name *')} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
                    <input value={readinessRepRelationship} onChange={(e) => setReadinessRepRelationship(e.target.value)} placeholder={l('Relación con el paciente *', 'Relationship to patient *')} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
                    <select value={readinessRepAuthority} onChange={(e) => setReadinessRepAuthority(e.target.value as typeof readinessRepAuthority)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
                      <option value="">{l('Tipo de autoridad *', 'Authority type *')}</option>
                      <option value="HEALTH_CARE_PROXY">Health Care Proxy</option>
                      <option value="POWER_OF_ATTORNEY">Power of Attorney</option>
                      <option value="GUARDIAN">{l('Tutor legal', 'Guardian')}</option>
                      <option value="OTHER">{l('Otro', 'Other')}</option>
                    </select>
                    <input value={readinessRepPhone} onChange={(e) => setReadinessRepPhone(e.target.value)} placeholder={l('Teléfono *', 'Phone number *')} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
                    <input type="email" value={readinessRepEmail} onChange={(e) => setReadinessRepEmail(e.target.value)} placeholder={l('Correo electrónico (opcional)', 'Email (optional)')} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
                    <select value={representativeContactMode} onChange={(e) => setRepresentativeContactMode(e.target.value as typeof representativeContactMode)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
                      <option value="IN_PERSON">{l('Presente en persona', 'Present in person')}</option>
                      <option value="PHONE">{l('Teléfono', 'Phone')}</option>
                      <option value="VIDEO">Video</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Explain Service */}
        {step === 2 && (
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{l('Paso 2: Guía', 'Step 2: Guide')}</h2>
              <p className="text-slate-500 text-sm mt-1">{l('Lea o use como guía el siguiente script diseñado para adultos mayores.', 'Read or use the following script as guidance for older adults.')}</p>
            </div>

            {/* Script Box */}
            <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-5 relative overflow-hidden flex items-start space-x-4">
              <Info size={22} className="text-blue-600 shrink-0 mt-1" />
              <div className="space-y-4">
                <p className="text-[10px] font-black text-blue-700 uppercase tracking-wider">{l('Script para la Enfermera', 'Nurse Script')}</p>
                <div className="space-y-4 text-sm font-semibold leading-relaxed text-slate-800">
                  {step2GuideScript.split('\n\n').map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              </div>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-extrabold text-slate-900">{l('Confirmación de explicación', 'Explanation Confirmation')}</h3>
              <label className="mt-4 flex cursor-pointer items-start gap-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-5 transition hover:bg-blue-50">
                <input
                  type="checkbox"
                  checked={serviceExplanationConfirmed}
                  onChange={(e) => setServiceExplanationConfirmed(e.target.checked)}
                  className="mt-0.5 h-6 w-6 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-bold leading-relaxed text-slate-800">
                  {l(
                    'Confirmo que expliqué al paciente los puntos esenciales del servicio, respondí sus preguntas y el paciente verbalizó entender la explicación.',
                    'I confirm that I explained the essential points of the service to the patient, answered their questions, and the patient verbally confirmed understanding the explanation.'
                  )}
                </span>
              </label>
              <p className="mt-3 text-[11px] font-semibold text-slate-500">
                {l(`Versión del script: ${STEP2_GUIDE_SCRIPT_VERSION}`, `Script version: ${STEP2_GUIDE_SCRIPT_VERSION}`)}
              </p>
            </section>
            </div>
        )}

        {/* Step 3: Patient Consent Form */}
        {step === 3 && (
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{l('Paso 3: Consentimiento Informado', 'Step 3: Informed Consent')}</h2>
              <p className="text-slate-500 text-sm mt-1">
                {l(
                  'Registre la decisión del paciente y capture firmas o evidencia de consentimiento verbal.',
                  'Record the patient’s decision and capture signatures or verbal consent evidence.'
                )}
              </p>
            </div>

            <div className="space-y-6" id="guided-consent-workflow">
              <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-extrabold uppercase tracking-wide text-slate-800">
                  {PRODUCT_NAME} · CONSENTIMIENTO PARA SERVICIOS CLÍNICOS / CARE AGREEMENT
                </h3>
                <div className="space-y-4 text-base leading-relaxed text-slate-600">
                  <p>You agree to participate in the selected care management and/or remote monitoring service.</p>
                  <p>These services are voluntary. You may stop them at any time.</p>
                  <p>Your health information will be protected and used only as allowed by law.</p>
                  <p>Your health plan may cover these services. A copay or other cost-sharing may apply.</p>
                  <p>You confirm that you are not receiving the same service from another provider or practice.</p>
                  <p>Your device sends readings to your care team. Use it as directed and take your readings as instructed.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFullConsent(current => !current)}
                  aria-expanded={showFullConsent}
                  aria-controls="full-consent-legal-text"
                  className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-extrabold text-blue-700 transition hover:border-blue-400 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <FileText size={16} aria-hidden="true" />
                  {showFullConsent ? l('Ocultar consentimiento completo', 'Hide full consent') : l('Ver consentimiento completo', 'View full consent')}
                </button>

                {showFullConsent && (
                  <div id="full-consent-legal-text" className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                    <div className="border-b border-slate-200 pb-4">
                      <p className="text-base font-extrabold text-slate-900">{patient.practice}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {l('Fecha efectiva', 'Effective date')}: {CONSENT_TEXT_EFFECTIVE_DATE}
                      </p>
                    </div>
                    <div className="mt-5 space-y-5">
                      {FULL_CONSENT_SECTIONS.map(section => (
                        <section key={section.title}>
                          <h4 className="text-sm font-extrabold text-slate-900">{section.title}</h4>
                          <p className="mt-1 text-sm leading-relaxed text-slate-600">{section.body}</p>
                        </section>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">{l('Decisión de consentimiento', 'Consent Decision')}</p>
                  <h3 className="mt-1 text-lg font-extrabold text-slate-900">{l('Registre la decisión del paciente', 'Record the patient’s decision')}</h3>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className={`cursor-pointer rounded-2xl border-2 p-5 transition ${consentDecision === 'ACCEPT' ? 'border-blue-600 bg-blue-50 ring-4 ring-blue-500/10' : 'border-slate-200 hover:border-blue-300'}`}>
                    <div className="flex items-start gap-3">
                      <input type="radio" name="guidedConsentDecision" checked={consentDecision === 'ACCEPT'} onChange={() => setConsentDecision('ACCEPT')} className="mt-1 h-5 w-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-extrabold text-slate-900">{l('El paciente acepta participar y firmar', 'The patient agrees to participate and sign')}</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">{l('Continúe para capturar las firmas requeridas.', 'Continue to capture the required signature(s).')}</p>
                      </div>
                    </div>
                  </label>
                  <label className={`cursor-pointer rounded-2xl border-2 p-5 transition ${consentDecision === 'DECLINE' ? 'border-rose-500 bg-rose-50 ring-4 ring-rose-500/10' : 'border-slate-200 hover:border-rose-300'}`}>
                    <div className="flex items-start gap-3">
                      <input type="radio" name="guidedConsentDecision" checked={consentDecision === 'DECLINE'} onChange={() => {
                        setConsentDecision('DECLINE');
                        setPatientSignature('');
                        setNurseSignature('');
                        setTypedSignatureName('');
                        setTypedSignatureAgreed(false);
                        setTypedSignatureConfirmed(false);
                        setUnableSignMethod('');
                        setUnableToSignReason('');
                        setUnableConsentConfirmed(false);
                        setConsentPdfGenerated(false);
                      }} className="mt-1 h-5 w-5 text-rose-600" />
                      <div>
                        <p className="text-sm font-extrabold text-slate-900">{l('El paciente rechazó', 'The patient declined')}</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">{l('El flujo de inscripción se detendrá y el rechazo quedará documentado.', 'The enrollment flow will stop and the decline will be documented.')}</p>
                      </div>
                    </div>
                  </label>
                </div>
              </section>

              {consentDecision === 'DECLINE' && (
                <section className="rounded-2xl border border-rose-200 bg-rose-50/50 p-6 shadow-sm">
                  <div className="mb-5 flex items-start gap-3">
                    <AlertTriangle size={21} className="mt-0.5 shrink-0 text-rose-600" />
                    <div>
                      <h3 className="text-base font-extrabold text-rose-950">{l('Documentar rechazo', 'Document Decline')}</h3>
                      <p className="mt-1 text-xs text-rose-700">{l('No se solicitarán firmas. Guarde el rechazo para cerrar esta visita.', 'No signatures will be requested. Save the decline to close this visit.')}</p>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-700">{l('Motivo del rechazo (opcional)', 'Reason for decline (optional)')}</label>
                      <select value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm">
                        <option value="">{l('Seleccione un motivo', 'Select a reason')}</option>
                        <option value="NOT_INTERESTED">{l('No está interesado', 'Not interested')}</option>
                        <option value="COST_CONCERN">{l('Preocupación por costos', 'Cost concern')}</option>
                        <option value="NEEDS_MORE_TIME">{l('Necesita más tiempo', 'Needs more time')}</option>
                        <option value="OTHER">{l('Otro', 'Other')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-700">{l('Notas de enfermería', 'Nurse notes')}</label>
                      <textarea value={declineNotes} onChange={(e) => setDeclineNotes(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm" placeholder={l('Agregue contexto clínico si es necesario...', 'Add clinical context if needed...')} />
                    </div>
                  </div>
                  <div className="mt-5 flex justify-end">
                    <button type="button" onClick={handleSaveAndExitLocal} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-rose-600 px-6 text-sm font-extrabold text-white shadow-lg shadow-rose-600/20 hover:bg-rose-700">
                      {l('Guardar Rechazo y Cerrar', 'Save Decline and Close')}
                    </button>
                  </div>
                </section>
              )}

              {consentDecision === 'ACCEPT' && (
                <>
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">{l('Identidad del firmante', 'Signer Identity')}</p>
                    <h3 className="mb-5 mt-1 text-lg font-extrabold text-slate-900">{l('¿Quién proporciona el consentimiento?', 'Who is providing consent?')}</h3>
                    <div className="grid gap-3 lg:grid-cols-3">
                      {[
                        { value: 'PATIENT', es: 'El Paciente (Self)', en: 'The Patient (Self)' },
                        { value: 'REPRESENTATIVE', es: 'Representante Autorizado', en: 'Authorized Representative' },
                        { value: 'UNABLE', es: 'Paciente sin capacidad física para firmar', en: 'Patient unable to physically sign' }
                      ].map((option) => (
                        <label key={option.value} className={`cursor-pointer rounded-xl border p-4 ${consentSignerType === option.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                          <div className="flex items-start gap-2.5">
                            <input type="radio" name="guidedSignerType" checked={consentSignerType === option.value} onChange={() => setConsentSignerType(option.value as typeof consentSignerType)} className="mt-0.5 h-4.5 w-4.5 text-blue-600" />
                            <span className="text-sm font-bold text-slate-800">{l(option.es, option.en)}</span>
                          </div>
                        </label>
                      ))}
                    </div>

                    {needsRepresentativeDetails && (
                      <div className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-5 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-bold text-slate-700">{l('Nombre completo *', 'Full name *')}</label>
                          <input value={signerName} onChange={(e) => setSignerName(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-bold text-slate-700">{l('Relación con el paciente *', 'Relationship to patient *')}</label>
                          <input value={repRelationship} onChange={(e) => setRepRelationship(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-bold text-slate-700">{l('Tipo de autoridad *', 'Authority type *')}</label>
                          <select value={authorityType} onChange={(e) => setAuthorityType(e.target.value as typeof authorityType)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
                            <option value="">{l('Seleccione', 'Select')}</option>
                            <option value="HEALTH_CARE_PROXY">Health Care Proxy</option>
                            <option value="POWER_OF_ATTORNEY">Power of Attorney</option>
                            <option value="GUARDIAN">{l('Tutor legal', 'Guardian')}</option>
                            <option value="OTHER">{l('Otro', 'Other')}</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-bold text-slate-700">{l('Teléfono *', 'Phone number *')}</label>
                          <input value={representativePhone} onChange={(e) => setRepresentativePhone(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
                        </div>
                        <div className="md:col-span-2">
                          <label className="mb-1 block text-xs font-bold text-slate-700">{l('Correo electrónico (opcional)', 'Email (optional)')}</label>
                          <input type="email" value={representativeEmail} onChange={(e) => setRepresentativeEmail(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
                        </div>
                        <div className="md:col-span-2">
                          <label className="mb-1 block text-xs font-bold text-slate-700">{l('Método de firma *', 'Signature method *')}</label>
                          <select value={representativeSignatureMethod} onChange={(e) => setRepresentativeSignatureMethod(e.target.value as typeof representativeSignatureMethod)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
                            <option value="IN_PERSON">{l('En persona', 'In person')}</option>
                            <option value="REMOTE_LINK">{l('Enlace remoto', 'Remote link')}</option>
                            <option value="PHONE_VIDEO_VERBAL">{l('Consentimiento verbal por teléfono/video', 'Phone/video verbal consent')}</option>
                          </select>
                        </div>
                      </div>
                    )}

                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">{l('Evidencia de consentimiento', 'Consent Evidence')}</p>
                        <h3 className="mt-1 text-lg font-extrabold text-slate-900">
                          {consentSignerType === 'REPRESENTATIVE' ? l('Firma del Representante Autorizado', 'Authorized Representative Signature') :
                            isVerbalConsent ? l('Consentimiento Verbal del Paciente', 'Patient Verbal Consent') :
                            consentSignerType === 'UNABLE' ? l('Marca / Consentimiento del Paciente', 'Patient Mark / Consent') :
                            l('Firma del Paciente', 'Patient Signature')}
                        </h3>
                      </div>
                      <div className="rounded-xl bg-slate-100 px-3 py-2 text-right text-[11px] text-slate-500">
                        <p className="font-bold text-slate-700">{signerName || l('Firmante pendiente', 'Signer pending')}</p>
                        <p>{new Date().toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="mb-5 grid gap-3 md:grid-cols-3">
                      {[
                        ['DRAW', l('Dibujar firma con dedo o stylus', 'Draw signature with finger or stylus'), l('Método predeterminado en persona.', 'Default in-person method.')],
                        ['TYPE', l('Escribir nombre legal completo para firmar', 'Type full legal name to sign'), l('Úselo para representantes remotos o si dibujar no es práctico.', 'Use for remote representatives or when drawing is not practical.')],
                        ['UNABLE', l('No puede firmar físicamente', 'Unable to physically sign'), l('Documente consentimiento verbal, marca/X o representante.', 'Document verbal consent, Mark/X, or representative signing.')]
                      ].map(([value, title, helper]) => (
                        <label key={value} className={`cursor-pointer rounded-2xl border-2 p-4 transition ${signatureMethod === value ? 'border-blue-600 bg-blue-50 ring-4 ring-blue-500/10' : 'border-slate-200 hover:border-blue-300'}`}>
                          <input
                            type="radio"
                            name="signatureMethod"
                            checked={signatureMethod === value}
                            onChange={() => {
                              setSignatureMethod(value as typeof signatureMethod);
                              if (value === 'UNABLE') setConsentSignerType('UNABLE');
                              if (value !== 'UNABLE' && consentSignerType === 'UNABLE') setConsentSignerType('PATIENT');
                            }}
                            className="sr-only"
                          />
                          <span className="block text-sm font-extrabold text-slate-900">{title}</span>
                          <span className="mt-1 block text-xs leading-relaxed text-slate-500">{helper}</span>
                        </label>
                      ))}
                    </div>

                    {signatureMethod === 'DRAW' && (
                      <SignaturePad
                        id="guided-patient-consent"
                        label={consentSignerType === 'REPRESENTATIVE' ? l('Firma del representante', 'Representative signature') : l('Firma del paciente', 'Patient signature')}
                        onSave={handleSavePatientSignature}
                        onClear={() => setPatientSignature('')}
                        savedDataUrl={patientSignature}
                        signerName={signerName || `${patient.firstName} ${patient.lastName}`}
                        confirmLabel={l('Confirmar Firma', 'Confirm Signature')}
                      />
                    )}

                    {signatureMethod === 'TYPE' && (
                      <div className="space-y-5 rounded-2xl border border-blue-200 bg-blue-50/50 p-5">
                        <div>
                          <label className="mb-1.5 block text-xs font-bold text-slate-700">{l('Nombre legal completo *', 'Full legal name *')}</label>
                          <input
                            value={typedSignatureName}
                            onChange={(e) => {
                              setTypedSignatureName(e.target.value);
                              setTypedSignatureConfirmed(false);
                              setConsentPdfGenerated(false);
                            }}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-800"
                            placeholder={signerName || `${patient.firstName} ${patient.lastName}`}
                          />
                        </div>
                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-blue-200 bg-white p-4">
                          <input
                            type="checkbox"
                            checked={typedSignatureAgreed}
                            onChange={(e) => {
                              setTypedSignatureAgreed(e.target.checked);
                              setTypedSignatureConfirmed(false);
                              setConsentPdfGenerated(false);
                            }}
                            className="mt-0.5 h-5 w-5 rounded text-blue-600"
                          />
                          <span className="text-sm font-bold text-slate-800">{l('Acepto que este nombre escrito es mi firma electrónica.', 'I agree that this typed name is my electronic signature.')}</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            if (!typedSignatureName.trim() || !typedSignatureAgreed) return;
                            setSignerName(typedSignatureName.trim());
                            setTypedSignatureConfirmed(true);
                          }}
                          disabled={!typedSignatureName.trim() || !typedSignatureAgreed || typedSignatureConfirmed}
                          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-extrabold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <CheckCircle size={16} className="mr-2" /> {l('Confirmar Firma Tipeada', 'Confirm Typed Signature')}
                        </button>
                        {typedSignatureConfirmed && (
                          <p className="text-xs font-bold text-emerald-700">{l('Firma tipeada confirmada y lista para el registro de auditoría.', 'Typed signature confirmed and ready for the audit record.')}</p>
                        )}
                      </div>
                    )}

                    {signatureMethod === 'UNABLE' && (
                      <div className="space-y-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-bold text-slate-700">{l('Método especial *', 'Special method *')}</label>
                            <select
                              value={unableSignMethod}
                              onChange={(e) => {
                                setUnableSignMethod(e.target.value as typeof unableSignMethod);
                                setPatientSignature('');
                                setUnableConsentConfirmed(false);
                                setConsentPdfGenerated(false);
                              }}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                            >
                              <option value="">{l('Seleccione', 'Select')}</option>
                              <option value="VERBAL">{l('Consentimiento verbal obtenido', 'Verbal consent obtained')}</option>
                              <option value="MARK_X">{l('Firma con marca / X', 'Mark/X signature')}</option>
                              <option value="REPRESENTATIVE_SIGNATURE">{l('Firmará un representante autorizado', 'Authorized representative will sign instead')}</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-bold text-slate-700">{l('Motivo por el que no pudo firmar físicamente *', 'Reason patient could not physically sign *')}</label>
                            <textarea
                              value={unableToSignReason}
                              onChange={(e) => {
                                setUnableToSignReason(e.target.value);
                                setUnableConsentConfirmed(false);
                                setConsentPdfGenerated(false);
                              }}
                              rows={3}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                            />
                          </div>
                        </div>
                        {isMarkXConsent && (
                          <div className="rounded-2xl border border-amber-200 bg-white p-4">
                            <p className="mb-3 text-xs font-semibold text-slate-600">
                              {l(
                                'Capture aquí la marca o X realizada por el paciente. Seleccionar el método no confirma la marca hasta guardar esta captura.',
                                'Capture the patient mark or X here. Selecting the method does not confirm the mark until this capture is saved.'
                              )}
                            </p>
                            <SignaturePad
                              id="patient-mark-x-signature"
                              label={l('Marca / X del paciente', 'Patient Mark / X')}
                              onSave={handleSavePatientSignature}
                              onClear={() => {
                                setPatientSignature('');
                                setUnableConsentConfirmed(false);
                              }}
                              savedDataUrl={patientSignature}
                              signerName={`${patient.firstName} ${patient.lastName}`}
                              confirmLabel={l('Guardar Marca / X', 'Save Mark / X')}
                            />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (!unableSignMethod || !unableToSignReason.trim() || (isMarkXConsent && !patientSignature)) return;
                            setUnableConsentConfirmed(true);
                          }}
                          disabled={!unableSignMethod || !unableToSignReason.trim() || (isMarkXConsent && !patientSignature) || unableConsentConfirmed}
                          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-amber-600 px-5 text-sm font-extrabold text-white shadow-lg shadow-amber-600/20 hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <CheckCircle size={16} className="mr-2" />
                          {isVerbalConsent
                            ? l('Confirmar Consentimiento Verbal', 'Confirm Verbal Consent')
                            : isMarkXConsent
                              ? l('Confirmar Marca / X', 'Confirm Mark / X')
                              : l('Confirmar Firma', 'Confirm Signature')}
                        </button>
                        {unableConsentConfirmed && (
                          <p className="text-xs font-bold text-emerald-700">{l('Método especial confirmado. La atestación de enfermería sigue siendo obligatoria.', 'Special method confirmed. Nurse attestation is still required.')}</p>
                        )}
                      </div>
                    )}
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-5">
                      <h3 className="text-lg font-extrabold text-slate-900">{l('Atestación del Personal de Inscripción', 'Enrollment Personnel Attestation')}</h3>
                      <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-600">
                        {l(
                          'La explicación del servicio se completó en el Paso 2. La enfermera confirma que la identidad y el rol del firmante fueron confirmados, que el paciente o representante tomó una decisión voluntaria, y que la firma o el consentimiento verbal fue presenciado/documentado durante este encuentro.',
                          'The service explanation was completed in Step 2. The nurse confirms that the signer’s identity and role were confirmed, the patient or representative made a voluntary decision, and the signature or verbal consent was witnessed/documented during this encounter.'
                        )}
                      </p>
                    </div>
                    <div className="mb-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
                      <div><span className="block text-slate-400">{l('Enfermera / Testigo', 'Nurse / Witness')}</span><strong>{currentUser.name}</strong></div>
                      <div><span className="block text-slate-400">{l('Credenciales', 'Credentials')}</span><strong>{currentUser.name.match(/,\s*(.+)$/)?.[1] || 'AMAVITA Nurse'}</strong></div>
                      <div><span className="block text-slate-400">{l('Residencia', 'Facility')}</span><strong>{patient.nursingHome}</strong></div>
                      <div><span className="block text-slate-400">{l('Fecha y Hora', 'Date & Time')}</span><strong>{new Date().toLocaleString()}</strong></div>
                    </div>
                    <SignaturePad
                      id="guided-nurse-attestation"
                      label={l('Firma de atestación de enfermería', 'Nurse attestation signature')}
                      onSave={handleSaveNurseSignature}
                      onClear={() => setNurseSignature('')}
                      savedDataUrl={nurseSignature}
                      signerName={currentUser.name}
                      confirmLabel={l('Confirmar Atestación', 'Confirm Attestation')}
                    />
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-slate-900 p-6 text-white shadow-xl">
                    <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-end">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-300">{l('Registro final', 'Final Record')}</p>
                        <h3 className="mt-1 text-lg font-extrabold">{l('Registro de Consentimiento y Generación de PDF', 'Consent Record & PDF Generation')}</h3>
                        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-300">{l('Este registro almacenará los detalles del consentimiento, firmas, información del firmante y metadatos de auditoría clínica.', 'This record will store consent details, signatures, signer information, and clinical audit metadata.')}</p>
                        <div className="mt-5 grid gap-2 text-xs sm:grid-cols-2">
                          {[
                            [consentDecision === 'ACCEPT', l('Decisión registrada', 'Consent decision recorded')],
                            [representativeComplete && Boolean(signerName), l('Firmante identificado', 'Signer identified')],
                            [patientEvidenceComplete, l('Firma o consentimiento verbal documentado', 'Signature captured or verbal consent documented')],
                            [nurseAttestationComplete, l('Atestación del personal de inscripción completa', 'Enrollment personnel attestation completed')],
                            [consentPdfGenerated, l('PDF de consentimiento generado', 'Consent PDF generated')]
                          ].map(([complete, label], index) => (
                            <div key={index} className="flex items-center gap-2">
                              <CheckCircle size={15} className={complete ? 'text-emerald-400' : 'text-slate-600'} />
                              <span className={complete ? 'text-slate-100' : 'text-slate-500'}>{label as string}</span>
                            </div>
                          ))}
                        </div>
                        <details className="mt-5 rounded-xl border border-slate-700 bg-slate-800/70 p-4 text-xs">
                          <summary className="cursor-pointer font-bold text-slate-200">{l('Ver metadatos de auditoría', 'View audit metadata')}</summary>
                          <dl className="mt-3 grid gap-2 text-slate-300 sm:grid-cols-2">
                            <div>Consent version: <strong>{CONSENT_TEXT_VERSION}</strong></div>
                            <div>{l('Capturado por', 'Captured by')}: <strong>{currentUser.name}</strong></div>
                            <div>{l('Residencia', 'Facility')}: <strong>{patient.nursingHome}</strong></div>
                            <div>{l('Programa', 'Program')}: <strong>{patient.assignedProgram}</strong></div>
                            <div>{l('Tipo de firmante', 'Signer type')}: <strong>{consentSignerType}</strong></div>
                            <div>{l('Aplicación', 'Application')}: <strong>{PRODUCT_NAME}</strong></div>
                          </dl>
                        </details>
                      </div>
                      <div className="flex flex-col gap-3">
                        {consentPdfGenerated && consentPdfUrl ? (
                          <a href={consentPdfUrl} download={`Consent_${patient.lastName}_${patient.firstName}.pdf`} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-500 px-5 text-sm font-extrabold text-white hover:bg-emerald-400">
                            <CheckCircle size={17} className="mr-2" /> {l('Descargar PDF Generado', 'Download Generated PDF')}
                          </a>
                        ) : consentPdfGenerated ? (
                          <div className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-500 px-5 text-sm font-extrabold text-white">
                            <CheckCircle size={17} className="mr-2" /> {l('PDF guardado en Drive', 'PDF saved to Drive')}
                          </div>
                        ) : (
                          <button type="button" onClick={() => triggerConsentPDFGeneration()} disabled={!consentRecordComplete || isGeneratingConsentPdf} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-500 px-5 text-sm font-extrabold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">
                            <FileText size={17} className="mr-2" /> {isGeneratingConsentPdf ? l('Generando PDF...', 'Generating PDF...') : l('Generar Registro PDF de Consentimiento', 'Generate Consent Record PDF')}
                          </button>
                        )}
                        {isGeneratingConsentPdf && (
                          <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-3">
                            <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-slate-200">
                              <span>{consentPdfProgressLabel || l('Generando PDF...', 'Generating PDF...')}</span>
                              <span>{Math.max(8, Math.min(99, consentPdfProgress))}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-700">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-400 transition-all duration-500"
                                style={{ width: `${Math.max(8, Math.min(99, consentPdfProgress))}%` }}
                              />
                            </div>
                            <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
                              {l(
                                'No cierre esta pantalla. El archivo se está generando y guardando de forma segura.',
                                'Do not close this screen. The file is being generated and saved securely.'
                              )}
                            </p>
                          </div>
                        )}
                        <button type="button" onClick={handleSaveAndExitLocal} className="min-h-11 rounded-xl border border-slate-600 px-5 text-sm font-bold text-slate-200 hover:bg-slate-800">
                          {l('Guardar Borrador', 'Save Draft')}
                        </button>
                      </div>
                    </div>
                  </section>
                </>
              )}
            </div>

            <div className="hidden" aria-hidden="true">
            {/* Terms text */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-48 overflow-y-auto text-xs text-slate-600 leading-relaxed space-y-2">
              <p className="font-bold text-slate-800">{l('CONSENTIMIENTO PARA SERVICIOS CLÍNICOS', 'CARE AGREEMENT')}</p>
              {(language === 'ES' ? DEFAULT_CONSENT_TEXT_ES : DEFAULT_CONSENT_TEXT).split('\n\n').map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>

            {/* Choice selection - Mutually exclusive options, sitting on same line if space permits */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-4 max-w-4xl" id="consent-options-container">
              {/* Option A: Accepts */}
              <label className={`flex-1 min-w-[280px] max-w-md flex items-start space-x-3 p-4 border rounded-xl cursor-pointer transition ${
                consentDecision === 'ACCEPT' 
                  ? 'border-blue-600 bg-blue-50/40 ring-4 ring-blue-500/10' 
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`} id="consent-accept-option">
                <input
                  type="radio"
                  name="consentSelection"
                  checked={consentDecision === 'ACCEPT'}
                  onChange={() => {
                    setConsentDecision('ACCEPT');
                  }}
                  className="h-4.5 w-4.5 text-blue-600 border-slate-300 focus:ring-blue-500 mt-0.5 cursor-pointer"
                />
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {language === 'ES' ? 'El paciente acepta firmar el consentimiento' : 'The patient agrees to sign the consent'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {language === 'ES' 
                      ? 'Se habilitarán los campos de firma autógrafa para el paciente/representante y la enfermera testigo.' 
                      : 'Handwritten signature fields will be enabled for the patient/representative and the witness nurse.'}
                  </p>
                </div>
              </label>

              {/* Option B: Declined */}
              <label className={`flex-1 min-w-[280px] max-w-md flex items-start space-x-3 p-4 border rounded-xl cursor-pointer transition ${
                consentDecision === 'DECLINE' 
                  ? 'border-rose-600 bg-rose-50/40 ring-4 ring-rose-500/10' 
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`} id="consent-decline-option">
                <input
                  type="radio"
                  name="consentSelection"
                  checked={consentDecision === 'DECLINE'}
                  onChange={() => {
                    setConsentDecision('DECLINE');
                    setPatientSignature('');
                    setNurseSignature('');
                    setConsentPdfGenerated(false);
                  }}
                  className="h-4.5 w-4.5 text-rose-600 border-rose-300 focus:ring-rose-500 mt-0.5 cursor-pointer"
                />
                <div>
                  <p className="text-sm font-bold text-rose-950">
                    {language === 'ES' ? 'El paciente RECHAZÓ firmar el consentimiento (Consent Declined)' : 'The patient DECLINED to sign the consent (Consent Declined)'}
                  </p>
                  <p className="text-xs text-rose-700 mt-0.5">
                    {language === 'ES' 
                      ? 'El flujo se completará como no-elegible por rechazo de firma según regulaciones HIPAA.' 
                      : 'The enrollment will stop because the patient declined to participate in the selected service(s).'}
                  </p>
                </div>
              </label>
            </div>

            {consentDecision === 'ACCEPT' && (
              <div className="space-y-6 animate-fade-in">
                {/* Form Inputs */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase">
                      {language === 'ES' ? '¿Quién firma el documento?' : 'Who is signing the document?'}
                    </label>
                    <div className="mt-1 flex space-x-4">
                      <label className="inline-flex items-center text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="signer"
                          checked={consentSignerType === 'PATIENT'}
                          onChange={() => setConsentSignerType('PATIENT')}
                          className="mr-1.5 text-indigo-600 focus:ring-indigo-500"
                        />
                        {language === 'ES' ? 'El Paciente (Self)' : 'The Patient (Self)'}
                      </label>
                      <label className="inline-flex items-center text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="signer"
                          checked={consentSignerType === 'REPRESENTATIVE'}
                          onChange={() => setConsentSignerType('REPRESENTATIVE')}
                          className="mr-1.5 text-indigo-600 focus:ring-indigo-500"
                        />
                        {language === 'ES' ? 'Representante Autorizado' : 'Authorized Representative'}
                      </label>
                    </div>
                  </div>

                  {consentSignerType === 'REPRESENTATIVE' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in" id="representative-details-row">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase">
                          {language === 'ES' ? 'Nombre Completo del Representante' : 'Full Name of Representative'}
                        </label>
                        <input
                          type="text"
                          value={signerName}
                          onChange={(e) => setSignerName(e.target.value)}
                          className="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder={language === 'ES' ? 'Ingrese nombre del representante' : 'Enter representative full name'}
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase">
                          {language === 'ES' ? 'Relación o Parentesco con el Paciente' : 'Relationship to Patient'}
                        </label>
                        <input
                          type="text"
                          value={repRelationship}
                          onChange={(e) => setRepRelationship(e.target.value)}
                          className="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder={language === 'ES' ? 'Ej: Hijo, Esposa, Apoderado Legal...' : 'e.g. Son, Wife, Legal Representative...'}
                          required
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Signatures pads */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 border border-slate-200 rounded-xl bg-slate-50">
                    <SignaturePad
                      id="patient-consent"
                      label={l('FIRMA DEL PACIENTE O REPRESENTANTE', 'PATIENT OR REPRESENTATIVE SIGNATURE')}
                      onSave={handleSavePatientSignature}
                      onClear={() => setPatientSignature('')}
                      savedDataUrl={patientSignature}
                      signerName={consentSignerType === 'PATIENT' ? `${patient.firstName} ${patient.lastName}` : (signerName || '---')}
                    />
                  </div>

                  <div className="p-4 border border-slate-200 rounded-xl bg-slate-50">
                    <SignaturePad
                      id="nurse-consent"
                      label={l('FIRMA DEL TESTIGO / ENFERMERA (AMAVITA)', 'WITNESS / NURSE SIGNATURE (AMAVITA)')}
                      onSave={handleSaveNurseSignature}
                      onClear={() => setNurseSignature('')}
                      savedDataUrl={nurseSignature}
                      signerName={currentUser.name}
                    />
                  </div>
                </div>

                {/* PDF generation block */}
                <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-800">{l('Generación del Acuerdo PDF de Consentimiento', 'Consent Agreement PDF Generation')}</p>
                    <p className="text-[10px] text-slate-400">{l('Este documento es auditable y guardará de forma inalterable las firmas y coordenadas clínicas.', 'This auditable document will permanently preserve signatures and clinical coordinates.')}</p>
                  </div>
                  
                  {consentPdfGenerated ? (
                    <div className="flex flex-col items-end space-y-1">
                      <span className="inline-flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 border border-emerald-200 rounded">
                        <CheckCircle size={14} className="mr-1.5" /> {l('PDF Generado', 'PDF Generated')}
                      </span>
                      <a 
                        href={consentPdfUrl} 
                        download={`Consentimiento_${patient.lastName}_${patient.firstName}.pdf`}
                        className="text-[11px] font-bold text-indigo-600 hover:underline"
                        id="download-generated-consent"
                      >
                        {l('Descargar PDF generado', 'Download generated PDF')}
                      </a>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => triggerConsentPDFGeneration()}
                      disabled={!patientSignature || !nurseSignature}
                      className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50 transition cursor-pointer"
                      id="btn-gen-consent-pdf"
                    >
                      <FileText size={14} className="inline-block mr-1.5" /> {l('Generar PDF de Consentimiento', 'Generate Consent PDF')}
                    </button>
                  )}
                </div>
              </div>
            )}
            </div>
          </div>
        )}

        {/* Step 4: Device Delivery and Setup */}
        {step === 4 && (
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{l('Paso 4: Dispositivo RPM', 'Step 4: RPM Device')}</h2>
              <p className="text-slate-500 text-sm mt-1">{l('Documente la entrega, configuración y activación del dispositivo.', 'Document device delivery, setup, and activation.')}</p>
            </div>

            <section className={`rounded-2xl border p-5 ${
              medicalOrderApproved
                ? 'border-emerald-200 bg-emerald-50/60'
                : medicalOrderStatus === 'ORDER_REJECTED_NEEDS_REVISION'
                  ? 'border-rose-200 bg-rose-50/70'
                  : 'border-orange-200 bg-orange-50/70'
            }`}>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <h3 className="text-sm font-extrabold text-slate-900">{l('Orden médica requerida para dispositivo', 'Medical Order Required for Device')}</h3>
                  <p className="text-xs font-semibold text-slate-700">
                    {l('Ningún device puede entregarse, activarse ni cerrarse sin orden médica aprobada por el médico.',
                      'No device can be delivered, activated, or closed without a physician-approved medical order.')}
                  </p>
                  <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                    <span className="rounded-xl border border-slate-200 bg-white px-2.5 py-1">Prog: {patient.assignedProgram}</span>
                    <span className="rounded-xl border border-slate-200 bg-white px-2.5 py-1">{l('Requerido', 'Required')}: {patient.requiredDevice}</span>
                    <span className={`rounded-xl border px-2.5 py-1 ${
                      medicalOrderApproved
                        ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                        : medicalOrderStatus === 'ORDER_REJECTED_NEEDS_REVISION'
                          ? 'border-rose-200 bg-rose-100 text-rose-800'
                          : 'border-orange-200 bg-orange-100 text-orange-800'
                    }`}>
                      {medicalOrderApproved
                        ? l('Orden: Aprobada', 'Order: Approved')
                        : medicalOrderStatus === 'ORDER_REJECTED_NEEDS_REVISION'
                          ? l('Orden: Requiere revisión', 'Order: Needs Revision')
                          : medicalOrderStatus === 'ORDER_PENDING_PHYSICIAN_APPROVAL'
                            ? l('Orden: Pendiente aprobación médica', 'Order: Pending Physician Approval')
                            : l('Orden médica pendiente', 'Medical order pending')}
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600">
                    <p>{l('Médico asignado', 'Assigned Physician')}: <strong>{patient.medicalOrder?.assignedPhysician || patient.provider}</strong></p>
                    <p>{l('Versión de orden', 'Order Version')}: <strong>{patient.medicalOrder?.orderVersion || 'order_v2026_07_01'}</strong></p>
                    {patient.medicalOrder?.revisionNotes && <p className="text-rose-700">{l('Nota de revisión', 'Revision Note')}: {patient.medicalOrder.revisionNotes}</p>}
                  </div>
                </div>
                {(medicalOrderStatus === 'ORDER_REQUIRED' || medicalOrderStatus === 'ORDER_REJECTED_NEEDS_REVISION') && (
                  <button
                    type="button"
                    onClick={() => onGenerateMedicalOrder(patient.id)}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-orange-600 px-4 text-xs font-extrabold text-white shadow-lg shadow-orange-600/20 hover:bg-orange-700"
                  >
                    <FileText size={14} className="mr-1.5" />
                    {medicalOrderStatus === 'ORDER_REJECTED_NEEDS_REVISION'
                      ? l('Corregir / re-enviar orden', 'Revise / Resend Order')
                      : l('Generar orden médica', 'Generate Medical Order')}
                  </button>
                )}
              </div>
            </section>

            {/* Device specs form fields */}
            <div className="space-y-4 rounded-2xl border border-slate-200 p-5 bg-white">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{l('Dispositivo Principal', 'Primary Device')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase">{l('Dispositivo', 'Device')}</label>
                  <select
                    value={deviceType}
                    onChange={(e) => setDeviceType(e.target.value as any)}
                    disabled={deviceActionsBlocked}
                    className="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-semibold bg-white disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="BP Monitor">{l('Monitor de Presion Arterial', 'BP Monitor')}</option>
                    <option value="Scale">{l('Bascula', 'Scale')}</option>
                    <option value="Other">{l('Otro', 'Other')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase">{l('Modelo', 'Model')}</label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    disabled={deviceActionsBlocked}
                    className="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-semibold disabled:bg-slate-100 disabled:text-slate-400"
                    placeholder={l('Modelo del dispositivo', 'Device model')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase">{l('Device ID *', 'Device ID *')}</label>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    disabled={deviceActionsBlocked}
                    className="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-semibold disabled:bg-slate-100 disabled:text-slate-400"
                    placeholder="Device ID"
                  />
                </div>
              </div>

              {/* Add Additional Device Toggle */}
              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasAdditionalDevice}
                    onChange={(e) => {
                      const isAddingSecondDevice = e.target.checked;
                      setHasAdditionalDevice(isAddingSecondDevice);
                      if (isAddingSecondDevice) {
                        onGenerateMedicalOrder(patient.id, additionalDeviceType);
                      }
                    }}
                    disabled={deviceActionsBlocked}
                    className="h-4.5 w-4.5 text-indigo-600 rounded cursor-pointer"
                  />
                  <span className="text-xs font-bold text-indigo-700">
                    {l('+ Añadir segundo dispositivo (ej. Bascula)', '+ Add second device (e.g. Scale)')}
                  </span>
                </label>
              </div>

              {/* Additional Device Section */}
              {hasAdditionalDevice && (
                <div className="pt-4 border-t border-slate-100 space-y-4 animate-fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{l('Dispositivo Adicional', 'Additional Device')}</h3>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase ${
                      medicalOrderApproved && patient.medicalOrder?.deviceType === additionalDeviceType
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-amber-200 bg-amber-50 text-amber-700'
                    }`}>
                      {medicalOrderApproved && patient.medicalOrder?.deviceType === additionalDeviceType
                        ? l('Orden aprobada', 'Order approved')
                        : l('Nueva orden pendiente de aprobación', 'New order pending approval')}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase">{l('Dispositivo', 'Device')}</label>
                      <select
                        value={additionalDeviceType}
                        onChange={(e) => {
                          const nextDeviceType = e.target.value as typeof additionalDeviceType;
                          setAdditionalDeviceType(nextDeviceType);
                          onGenerateMedicalOrder(patient.id, nextDeviceType);
                        }}
                        disabled={deviceActionsBlocked}
                        className="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-semibold bg-white disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <option value="Scale">{l('Bascula', 'Scale')}</option>
                        <option value="BP Monitor">{l('Monitor de Presion Arterial', 'BP Monitor')}</option>
                        <option value="Other">{l('Otro', 'Other')}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase">{l('Device ID *', 'Device ID *')}</label>
                      <input
                        type="text"
                        value={additionalSerialNumber}
                        onChange={(e) => setAdditionalSerialNumber(e.target.value)}
                        disabled={deviceActionsBlocked}
                        className="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-semibold disabled:bg-slate-100 disabled:text-slate-400"
                        placeholder={l('Device ID adicional', 'Additional device ID')}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Checklist */}
            <div className="space-y-2.5 border-t border-slate-150 pt-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{l('Lista de Verificacion de Entrega y Educacion', 'Delivery and Education Checklist')}</h3>
              </div>
              <div className="space-y-3">
                <label className="flex items-start space-x-3 p-3 border border-slate-100 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                  <input
                    type="checkbox"
                    checked={devDeliveredToPatient}
                    onChange={(e) => setDevDeliveredToPatient(e.target.checked)}
                    disabled={deviceActionsBlocked}
                    className="h-4.5 w-4.5 text-indigo-600 rounded mt-0.5"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    {l('Dispositivo entregado al paciente o al personal responsable', 'Device delivered to the patient or responsible staff')}
                  </span>
                </label>

                <label className="flex items-start space-x-3 p-3 border border-slate-100 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                  <input
                    type="checkbox"
                    checked={devInstructionsGiven}
                    onChange={(e) => setDevInstructionsGiven(e.target.checked)}
                    disabled={deviceActionsBlocked}
                    className="h-4.5 w-4.5 text-indigo-600 rounded mt-0.5"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    {l('Se explico el uso del dispositivo y la tecnica de medicion', 'The use of the device and measurement technique was explained')}
                  </span>
                </label>

                <label className="flex items-start space-x-3 p-3 border border-slate-100 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                  <input
                    type="checkbox"
                    checked={devUnderstandingDemonstrated}
                    onChange={(e) => setDevUnderstandingDemonstrated(e.target.checked)}
                    disabled={deviceActionsBlocked}
                    className="h-4.5 w-4.5 text-indigo-600 rounded mt-0.5"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    {l('El paciente o el personal responsable demostraron entender el uso del dispositivo', 'The patient or responsible staff demonstrated proper understanding of device use')}
                  </span>
                </label>
              </div>
            </div>

            <section className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold text-slate-900">{l('Primera Lectura', 'First Reading')}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {selectedMonitoringDeviceTypes.map(type => (
                    <span key={type} className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[10px] font-extrabold text-blue-700">
                      {type === 'BP Monitor' ? 'BP' : l('Bascula', 'Scale')}
                    </span>
                  ))}
                </div>
              </div>

              {selectedMonitoringDeviceTypes.length === 0 ? (
                <p className="rounded-xl border border-dashed border-blue-200 bg-white/70 px-4 py-3 text-xs font-semibold text-slate-500">
                  {l('Seleccione BP Monitor o Bascula en los dispositivos para registrar la primera lectura.', 'Select BP Monitor or Scale in the devices to record the first reading.')}
                </p>
              ) : (
                <div className="space-y-4">
                  {requiresBpReading && (
                    <div className="rounded-2xl border border-blue-200 bg-white p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-extrabold text-slate-900">{l('Lectura de Presión Arterial', 'Blood Pressure Reading')}</p>
                          <p className="text-[10px] font-semibold text-slate-500">{l('Requerida para BP Monitor', 'Required for BP Monitor')}</p>
                        </div>
                        {bpReadingComplete && <CheckCircle size={16} className="text-emerald-600" />}
                      </div>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div><label className="mb-1 block text-xs font-bold text-slate-700">Systolic *</label><input inputMode="numeric" value={systolic} onChange={(e) => setSystolic(e.target.value)} disabled={deviceActionsBlocked} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:bg-slate-100 disabled:text-slate-400" /></div>
                        <div><label className="mb-1 block text-xs font-bold text-slate-700">Diastolic *</label><input inputMode="numeric" value={diastolic} onChange={(e) => setDiastolic(e.target.value)} disabled={deviceActionsBlocked} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:bg-slate-100 disabled:text-slate-400" /></div>
                        <div><label className="mb-1 block text-xs font-bold text-slate-700">Pulse *</label><input inputMode="numeric" value={pulse} onChange={(e) => setPulse(e.target.value)} disabled={deviceActionsBlocked} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:bg-slate-100 disabled:text-slate-400" /></div>
                      </div>
                    </div>
                  )}

                  {requiresScaleReading && (
                    <div className="rounded-2xl border border-blue-200 bg-white p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-extrabold text-slate-900">{l('Lectura de Peso', 'Weight Reading')}</p>
                          <p className="text-[10px] font-semibold text-slate-500">{l('Requerida para Bascula', 'Required for Scale')}</p>
                        </div>
                        {scaleReadingComplete && <CheckCircle size={16} className="text-emerald-600" />}
                      </div>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-xs font-bold text-slate-700">{l('Peso', 'Weight')} *</label>
                          <div className="relative">
                            <input inputMode="decimal" value={scaleWeight} onChange={(e) => setScaleWeight(e.target.value)} disabled={deviceActionsBlocked} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 pr-12 text-sm disabled:bg-slate-100 disabled:text-slate-400" />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">lb</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!firstReadingComplete && selectedMonitoringDeviceTypes.length > 0 && (
                <p className="mt-3 text-xs font-semibold text-blue-800">
                  {l('Registre la primera lectura para cada dispositivo añadido al paciente.', 'Record the first reading for each device added to the patient.')}
                </p>
              )}
            </section>

            {/* Status and Notes */}
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
              <fieldset>
                <legend className="block text-xs font-bold text-slate-700 uppercase">
                  {l('Estado de Activación Técnica', 'Technical Activation Status')}
                </legend>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup">
                  {TECHNICAL_ACTIVATION_STATUS_OPTIONS.map((option) => {
                    const isSelected = activationStatus === option.value;
                    const isDisabled = deviceActionsBlocked || (requiresMedicalOrder && !medicalOrderApproved);

                    return (
                      <label
                        key={option.value}
                        className={`relative flex min-h-16 items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-sm font-bold transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-sm'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/40'
                        } ${isDisabled ? 'cursor-not-allowed opacity-55 hover:border-slate-200 hover:bg-white' : 'cursor-pointer active:scale-[0.99]'}`}
                      >
                        <input
                          type="radio"
                          name="technical_activation_status"
                          value={option.value}
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={() => {
                            setActivationStatus(option.value);
                            setDeviceActivatedCheck(option.value === 'ACTIVE');
                          }}
                          className="sr-only"
                        />
                        <span className="min-w-0">
                          <span className="block font-bold">{l(option.es, option.en)}</span>
                          <span className={`mt-1 block text-xs font-medium leading-snug ${
                            isSelected ? 'text-blue-700' : 'text-slate-500'
                          }`}>
                            {l(option.descriptionEs, option.descriptionEn)}
                          </span>
                        </span>
                        {isSelected && (
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white" aria-hidden="true">
                            <Check size={16} strokeWidth={3} />
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="mt-4">
                <label className="block text-xs font-bold text-slate-700 uppercase">{l('Notas Adicionales / Soporte de Conectividad', 'Additional Notes / Connectivity Support')}</label>
                <textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  rows={2}
                  disabled={deviceActionsBlocked}
                  className="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-white disabled:bg-slate-100 disabled:text-slate-400"
                  placeholder={l('Indique detalles específicos del soporte, entrega física o enlace celular...', 'Enter specific support, physical delivery, or cellular connection details...')}
                />
              </div>
            </div>

            {/* PDF generation block */}
            <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-800">{l('Generar PDF de Entrega y Activación RPM', 'Generate RPM Device Delivery & Activation PDF')}</p>
                <p className="text-[10px] text-slate-400">{l('Título legal', 'Legal title')}: "RPM Device Delivery & Activation Confirmation".</p>
                {deliveryPdfGenerated && (
                  <p className="max-w-xl text-[10px] font-semibold text-slate-500">
                    {l(
                      'Puede cambiar las opciones del dispositivo y regenerar el PDF. El nuevo PDF sustituirá al anterior en esta pantalla.',
                      'You can change the device options and regenerate the PDF. The new PDF will replace the previous one on this screen.'
                    )}
                  </p>
                )}
              </div>
              
              {deliveryPdfGenerated ? (
                <div className="flex flex-col items-end gap-2">
                  <span className="inline-flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 border border-emerald-200 rounded">
                    <CheckCircle size={14} className="mr-1.5" /> {l('PDF de Entrega Generado', 'Delivery PDF Generated')}
                  </span>
                  {deliveryPdfUrl ? (
                    <a
                      href={deliveryPdfUrl}
                      download={`Entrega_Equipo_${patient.lastName}_${patient.firstName}.pdf`}
                      className="text-[11px] font-bold text-indigo-600 hover:underline"
                      id="download-generated-delivery"
                    >
                      {l('Descargar PDF generado', 'Download generated PDF')}
                    </a>
                  ) : (
                    <span className="text-[11px] font-bold text-emerald-700">
                      {l('Guardado en Drive', 'Saved to Drive')}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={triggerDeliveryPDFGeneration}
                    disabled={deviceActionsBlocked || !deviceRequirementsReadyForPdf || !nurseSignature || isGeneratingDeliveryPdf}
                    className="inline-flex items-center rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-[11px] font-bold text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50"
                    id="btn-regenerate-delivery-pdf"
                  >
                    <RefreshCw size={13} className={`mr-1.5 ${isGeneratingDeliveryPdf ? 'animate-spin' : ''}`} />
                    {isGeneratingDeliveryPdf ? l('Regenerando PDF...', 'Regenerating PDF...') : l('Regenerar PDF', 'Regenerate PDF')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={triggerDeliveryPDFGeneration}
                  disabled={deviceActionsBlocked || !deviceRequirementsReadyForPdf || !nurseSignature || isGeneratingDeliveryPdf}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50 transition cursor-pointer"
                  id="btn-gen-delivery-pdf"
                >
                  <Smartphone size={14} className="inline-block mr-1.5" /> {isGeneratingDeliveryPdf ? l('Generando PDF...', 'Generating PDF...') : l('Generar PDF de Confirmación de Entrega', 'Generate Delivery Confirmation PDF')}
                </button>
              )}
            </div>
            {isGeneratingDeliveryPdf && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-blue-900">
                  <span>{deliveryPdfProgressLabel || l('Generando PDF...', 'Generating PDF...')}</span>
                  <span>{Math.max(8, Math.min(99, deliveryPdfProgress))}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-blue-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-all duration-500"
                    style={{ width: `${Math.max(8, Math.min(99, deliveryPdfProgress))}%` }}
                  />
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-blue-800">
                  {l(
                    'No cierre esta pantalla. El PDF de entrega se está generando y guardando de forma segura.',
                    'Do not close this screen. The delivery PDF is being generated and saved securely.'
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Final summary review and activate */}
        {step === 5 && (
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{l('Paso 5: Activación', 'Step 5: Activation')}</h2>
              <p className="text-slate-500 text-sm mt-1">{l('Revise el resumen final antes de activar al paciente.', 'Review the final summary before activating the patient.')}</p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="grid divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
                {finalReviewItems.map((item, index) => {
                  const status = item.ready === null ? 'N/A' : item.ready ? 'READY' : 'PENDING';
                  return (
                    <div key={index} className="flex items-center justify-between gap-4 border-b border-slate-100 p-4 last:border-b-0 md:last:border-b">
                      <div className="flex items-center gap-3">
                        <CheckCircle size={18} className={status === 'READY' ? 'text-emerald-500' : status === 'N/A' ? 'text-slate-300' : 'text-amber-500'} />
                        <span className="text-xs font-bold text-slate-800">{item.label}</span>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${
                        status === 'READY' ? 'bg-emerald-100 text-emerald-800' :
                        status === 'N/A' ? 'bg-slate-100 text-slate-500' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {status === 'READY' ? l('Listo', 'Ready') : status === 'N/A' ? l('No Aplica', 'Not Applicable') : l('Pendiente', 'Pending')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {isEnrollmentComplete && (!requiresMedicalOrder || medicalOrderApproved) === false && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 mb-4">
                <div className="flex items-center space-x-3">
                  <div className="text-blue-600 shrink-0">
                    <AlertCircle size={24} />
                  </div>
                  <p className="text-sm font-bold text-blue-800">
                    {l('La inscripción se puede completar, pero la activación del paciente está pendiente de la aprobación de la orden médica.', 'Enrollment can be completed, but patient activation is pending medical order approval.')}
                  </p>
                </div>
              </div>
            )}

            {!isEnrollmentComplete ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-extrabold text-amber-950">{l('Hay requisitos pendientes', 'Required items need attention')}</h3>
                    <p className="mt-1 text-xs text-amber-800">{l('Complete todos los elementos obligatorios antes de activar al paciente.', 'Complete all required items before activating the patient.')}</p>
                  </div>
                  <button type="button" onClick={() => setStep(firstPendingStep)} className="min-h-11 rounded-xl bg-amber-600 px-5 text-sm font-extrabold text-white hover:bg-amber-700">
                    {l('Resolver Requisitos Pendientes', 'Resolve Required Items')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
                <h3 className="text-base font-extrabold text-blue-950">{l('Atestación de Activación', 'Activation Attestation')}</h3>
                <p className="mt-2 text-sm leading-relaxed text-blue-900">{l(
                  'Activar este paciente guardará un registro de inscripción con fecha y hora, marcará al paciente como Activo y bloqueará los detalles críticos. Los cambios futuros requerirán una nota de enmienda.',
                  'Activating this patient will save a timestamped enrollment record, mark the patient as Active, and lock critical enrollment details. Future changes will require an amendment note.'
                )}</p>
                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-blue-200 bg-white p-4">
                  <input type="checkbox" checked={activationAttested} onChange={(e) => setActivationAttested(e.target.checked)} className="mt-0.5 h-5 w-5 rounded text-blue-600" />
                  <span className="text-sm font-bold text-slate-800">{l('Confirmo que todos los pasos obligatorios se han completado.', 'I confirm all required enrollment steps have been completed.')}</span>
                </label>
              </div>
            )}

            <div className="hidden" aria-hidden="true">
            {/* Verification checklist matrix */}
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-slate-50/50">
              
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <UserCheck className={idConfirmed ? 'text-emerald-500' : 'text-slate-300'} size={20} />
                  <div>
                    <p className="text-xs font-bold text-slate-800">{l('Identidad Confirmada', 'Identity Confirmed')}</p>
                    <p className="text-[10px] text-slate-500">{l('Paso 1: Datos demográficos físicos validados.', 'Step 1: Physical demographic data validated.')}</p>
                  </div>
                </div>
                {idConfirmed ? (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">{l('Listo', 'Ready')}</span>
                ) : (
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">{l('Pendiente', 'Pending')}</span>
                )}
              </div>

              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Info className={patientUnderstood ? 'text-emerald-500' : 'text-slate-300'} size={20} />
                  <div>
                    <p className="text-xs font-bold text-slate-800">{l('Servicio Clínico Explicado', 'Clinical Service Explained')}</p>
                    <p className="text-[10px] text-slate-500">{l('Paso 2: Guion voluntario y costos compartidos explicados.', 'Step 2: Voluntary participation and cost-sharing script reviewed.')}</p>
                  </div>
                </div>
                {patientUnderstood ? (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">{l('Listo', 'Ready')}</span>
                ) : (
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">{l('Pendiente', 'Pending')}</span>
                )}
              </div>

              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className={consentPdfGenerated ? 'text-emerald-500' : 'text-slate-300'} size={20} />
                  <div>
                    <p className="text-xs font-bold text-slate-800">{l('Consentimiento Médico Firmado y PDF Generado', 'Medical Consent Signed and PDF Generated')}</p>
                    <p className="text-[10px] text-slate-500">{l('Paso 3: Firmas registradas y PDF contractual generado.', 'Step 3: Signatures logged and contractual PDF generated.')}</p>
                  </div>
                </div>
                {consentPdfGenerated ? (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">{l('Listo', 'Ready')}</span>
                ) : (
                  <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">{l('No firmado / Sin PDF', 'Not Signed / No PDF')}</span>
                )}
              </div>

              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Smartphone className={deliveryPdfGenerated ? 'text-emerald-500' : 'text-slate-300'} size={20} />
                  <div>
                    <p className="text-xs font-bold text-slate-800">{l('Entrega de Dispositivo y PDF de Recepción', 'Device Delivery and Receipt PDF')}</p>
                    <p className="text-[10px] text-slate-500">{l('Paso 4: Dispositivo configurado, verificado y PDF generado.', 'Step 4: Device configured, verified, and PDF generated.')}</p>
                  </div>
                </div>
                {deliveryPdfGenerated ? (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">{l('Listo', 'Ready')}</span>
                ) : (
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">{l('Pendiente S/N o PDF', 'Serial Number or PDF Pending')}</span>
                )}
              </div>
            </div>

            {/* Disclaimer or locks */}
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start space-x-3 text-xs text-blue-900">
              <CheckCircle size={18} className="text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-blue-900">{l('Compromiso Clínico del Paciente Activo', 'Active Patient Clinical Commitment')}</p>
                <p className="text-blue-800 leading-relaxed">{l('Al hacer clic en “Activar Paciente”, se guardará un registro inmutable con fecha y hora, el estado cambiará a “Active” y se bloquearán los cambios críticos de la visita.', 'Clicking “Activate Patient” will save an immutable timestamped log, change the patient status to “Active,” and lock critical visit changes.')}</p>
              </div>
            </div>
            </div>
          </div>
        )}

        {/* Wizard Footer Controls */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
          {/* Cancel button */}
          <button
            type="button"
            onClick={() => setShowExitDialog(true)}
            className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-900 cursor-pointer text-center"
            id="btn-cancel-wizard"
          >
            {l('Salir de la Inscripción', 'Exit Enrollment')}
          </button>

          {/* Core controls */}
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
            {/* Save & continue later */}
            <button
              type="button"
              onClick={handleSaveAndExitLocal}
              className="inline-flex items-center justify-center px-4.5 py-2.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-xl shadow-sm cursor-pointer"
              id="btn-save-and-continue"
            >
              <Save size={14} className="mr-1.5" /> {language === 'ES' ? 'Guardar y Continuar Más Tarde' : 'Save & Continue Later'}
            </button>

            {/* Back button */}
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center justify-center px-4.5 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-sm cursor-pointer"
                id="btn-prev-step"
              >
                <ArrowLeft size={14} className="mr-1.5" /> {language === 'ES' ? 'Atrás' : 'Back'}
              </button>
            )}

            {/* Next button / Active patient trigger */}
            {step < 5 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canAdvanceCurrentStep}
                className="inline-flex items-center justify-center px-5 py-2.5 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/20 cursor-pointer disabled:opacity-50"
                id="btn-next-step"
              >
                {step === 3 && consentDeclined
                  ? l('Finalizar y Cerrar', 'Finish & Close')
                  : l('Siguiente', 'Next')}
                <ArrowRight size={14} className="ml-1.5" />
              </button>
            ) : (
              <div className="flex w-full sm:w-auto space-x-2">
                <button
                  type="button"
                  onClick={handleCompleteEnrollmentLocal}
                  disabled={!isEnrollmentComplete}
                  className="inline-flex items-center justify-center px-4.5 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-sm cursor-pointer disabled:opacity-50"
                  id="btn-complete-enrollment"
                >
                  <CheckCircle size={14} className="mr-1.5" /> {language === 'ES' ? 'Completar Inscripción' : 'Complete Enrollment'}
                </button>
                <div className="relative group flex">
                  <button
                    type="button"
                    onClick={handleActivatePatientLocal}
                    disabled={!canActivatePatient || !activationAttested}
                    className="inline-flex items-center justify-center px-5 py-2.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-lg shadow-emerald-600/20 cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none w-full"
                    id="btn-activate-patient"
                  >
                    <CheckCircle size={14} className="mr-1.5" /> {language === 'ES' ? 'Activar Paciente' : 'Activate Patient'}
                  </button>
                  {(!canActivatePatient || !activationAttested) && (
                    <div className="absolute bottom-full right-0 mb-2 w-64 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg invisible group-hover:visible z-10 text-center">
                      {(!requiresMedicalOrder || medicalOrderApproved) 
                        ? (language === 'ES' ? 'La activación requiere que todos los documentos y la atestación se completen.' : 'Activation requires all documents and attestation to be completed.')
                        : (language === 'ES' ? 'La activación requiere la aprobación de la orden médica.' : 'Activation requires medical order approval.')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Patient Overlay Modal */}
      <EditPatientModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={(updatedPatient) => {
          if (onUpdatePatient) {
            onUpdatePatient(updatedPatient);
          }
        }}
        patient={patient}
        currentUser={currentUser}
        nursingHomes={nursingHomes}
        conditionGroups={conditionGroups}
        diagnoses={diagnoses}
      />

      {showExitDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="exit-enrollment-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 id="exit-enrollment-title" className="text-xl font-extrabold text-slate-900">{l('¿Salir de la inscripción?', 'Exit Enrollment?')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{l('¿Desea guardar esta inscripción como borrador o descartarla?', 'Do you want to save this enrollment as a draft or discard it?')}</p>
            <div className="mt-6 flex flex-col gap-3">
              <button type="button" onClick={() => { setShowExitDialog(false); handleSaveAndExitLocal(); }} className="min-h-12 rounded-xl bg-blue-600 px-5 text-sm font-extrabold text-white hover:bg-blue-700">
                {l('Guardar Borrador y Salir', 'Save Draft & Exit')}
              </button>
              <button type="button" onClick={() => { setShowExitDialog(false); onCancel(); }} className="min-h-11 rounded-xl border border-rose-200 bg-rose-50 px-5 text-sm font-bold text-rose-700 hover:bg-rose-100">
                {l('Descartar Inscripción', 'Discard Enrollment')}
              </button>
              <button type="button" onClick={() => setShowExitDialog(false)} className="min-h-11 rounded-xl border border-slate-300 px-5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                {l('Continuar Editando', 'Continue Editing')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {alertMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="premium-dark-header bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 flex items-center text-white">
              <Info size={24} className="mr-3 text-blue-200" />
              <h2 className="text-lg font-bold">{language === 'ES' ? 'Aviso' : 'Notice'}</h2>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-700 leading-relaxed font-medium">{alertMessage}</p>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end">
              <button 
                type="button" 
                onClick={() => setAlertMessage(null)} 
                className="px-6 py-2 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20"
              >
                {language === 'ES' ? 'Aceptar' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
