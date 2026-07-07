import { useState, useEffect, useMemo } from 'react';
import {
  User, Patient, AuditLog, DocumentRecord, Visit, Consent, Device, BPReading,
  ConditionGroupCatalog, DiagnosisCatalog, CatalogImportHistory
} from './types';
import { 
  getPatients, getAuditLogs, getDocuments,
  clearSession, savePatient, saveVisit, saveConsent,
  saveDevice, saveBPReading, saveDocument, addAuditLog, getActiveVisitForPatient,
  getLatestVisitForPatient, getConsentByPatientId, getDeviceByPatientId, getBPReadingsByPatientId,
  getConditionGroups, getDiagnoses, getCatalogImportHistory, saveConditionCatalog,
  setConditionGroupActive, setDiagnosisActive, saveConditionGroup, saveDiagnosis, hydrateDB, getUsers
} from './utils/db';
import { downloadDocument, generateDocument } from './utils/apiClient';
import { getAuthConfigurationError, logout, observeAuthenticatedUser } from './utils/auth';
import { approveMedicalOrder, createMedicalOrder, generateAutoOrderIfNeeded, isMedicalOrderApproved, patientRequiresDevice, rejectMedicalOrder, resubmitMedicalOrder } from './utils/medicalOrders';
import { POWERED_BY, PRODUCT_NAME } from './utils/branding';
import Header from './components/Header';
import Login from './components/Login';
import DashboardNurse from './components/DashboardNurse';
import DashboardAdmin from './components/DashboardAdmin';
import PatientProfile from './components/PatientProfile';
import VisitWizard from './components/VisitWizard';
import { CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import RegisterPatientModal from './components/RegisterPatientModal';
import MedicalOrderReviewModal from './components/MedicalOrderReviewModal';
import ConditionCatalogImportModal from './components/ConditionCatalogImportModal';
import { useLanguage } from './utils/LanguageContext';

export default function App() {
  const { language } = useLanguage();
  const l = (es: string, en: string) => language === 'ES' ? es : en;
  // ----------------------------------------------------
  // APP STATES
  // ----------------------------------------------------
  const [currentUser, setAppUser] = useState<User | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [conditionGroups, setConditionGroups] = useState<ConditionGroupCatalog[]>([]);
  const [diagnoses, setDiagnoses] = useState<DiagnosisCatalog[]>([]);
  const [catalogImports, setCatalogImports] = useState<CatalogImportHistory[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(getAuthConfigurationError());
  
  // Navigation states
  const [currentView, setCurrentView] = useState<'DASHBOARD' | 'PROFILE' | 'VISIT'>('DASHBOARD');
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  
  // Active visit (running in wizard)
  const [activeVisit, setActiveVisit] = useState<Visit | undefined>(undefined);

  // Success Toast / Alert state
  const [toast, setToast] = useState<{ type: 'success' | 'info'; message: string } | null>(null);

  // Register Patient Modal state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isCatalogImportOpen, setIsCatalogImportOpen] = useState(false);

  // Medical Order Review Modal state
  const [medicalOrderReviewPatient, setMedicalOrderReviewPatient] = useState<Patient | null>(null);

  // ----------------------------------------------------
  // INITIALIZATION
  // ----------------------------------------------------
  useEffect(() => {
    return observeAuthenticatedUser(firebaseUser => {
      if (!firebaseUser) {
        clearSession();
        setAppUser(null);
        setAuthLoading(false);
        return;
      }
      setAuthLoading(true);
      setAuthError('');
      void hydrateDB()
        .then(user => {
          setAppUser(user);
          refreshAppState();
        })
        .catch(error => {
          clearSession();
          setAppUser(null);
          setAuthError(formatAuthLoadError(error));
        })
        .finally(() => setAuthLoading(false));
    });
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      showToast(message, 'info');
    };
    window.addEventListener('amavita:api-error', handler);
    return () => window.removeEventListener('amavita:api-error', handler);
  }, []);

  const refreshAppState = () => {
    setPatients(getPatients());
    setAuditLogs(getAuditLogs());
    setDocuments(getDocuments());
    setConditionGroups(getConditionGroups());
    setDiagnoses(getDiagnoses());
    setCatalogImports(getCatalogImportHistory());
  };

  const reloadAppState = async () => {
    const user = await hydrateDB();
    setAppUser(user);
    refreshAppState();
  };

  const formatAuthLoadError = (error: unknown) => {
    const message = error instanceof Error ? error.message : '';
    const status = typeof error === 'object' && error && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : undefined;
    if (message.includes('service_rate_limited') || status === 429) {
      return l(
        'El servicio seguro está ocupado temporalmente. Espere unos segundos e intente iniciar sesión nuevamente.',
        'The secure service is temporarily busy. Wait a few seconds and try logging in again.'
      );
    }
    if (message.includes('secure_service_unavailable') || (status && status >= 500)) {
      return l(
        'El servicio seguro no está disponible temporalmente. Intente nuevamente en unos segundos.',
        'The secure service is temporarily unavailable. Please try again in a few seconds.'
      );
    }
    return message || l('No se pudo cargar su cuenta.', 'Unable to load your account.');
  };

  const handleCatalogImport = (
    groups: ConditionGroupCatalog[],
    importedDiagnoses: DiagnosisCatalog[],
    history: CatalogImportHistory
  ) => {
    if (!currentUser || currentUser.role !== 'ADMIN') return;
    saveConditionCatalog(groups, importedDiagnoses, history);
    addAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      undefined,
      undefined,
      'Catálogo ICD-10 Importado',
      'GENERAL',
      `${history.filename}: ${history.successful_rows} filas importadas, ${history.failed_rows} con errores. Desactivar ausentes: ${history.deactivate_missing ? 'Sí' : 'No'}.`
    );
    refreshAppState();
    showToast(l('Catálogo ICD-10 importado correctamente.', 'ICD-10 catalog imported successfully.'));
  };

  const handleToggleConditionGroup = (id: string, active: boolean) => {
    setConditionGroupActive(id, active);
    refreshAppState();
  };

  const handleToggleDiagnosis = (id: string, active: boolean) => {
    setDiagnosisActive(id, active);
    refreshAppState();
  };

  const handleSaveConditionGroup = (group: ConditionGroupCatalog) => {
    if (!currentUser || currentUser.role !== 'ADMIN') return;
    saveConditionGroup(group);
    addAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      undefined,
      undefined,
      group.is_active ? 'condition_group_updated' : 'condition_group_deactivated',
      'GENERAL',
      ''
    );
    refreshAppState();
  };

  const handleSaveDiagnosis = (diagnosis: DiagnosisCatalog) => {
    if (!currentUser || currentUser.role !== 'ADMIN') return;
    saveDiagnosis(diagnosis);
    addAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      undefined,
      undefined,
      diagnosis.is_active ? 'diagnosis_updated' : 'diagnosis_deactivated',
      'GENERAL',
      ''
    );
    refreshAppState();
  };

  // Show a temporary success/info alert
  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 5000);
  };

  // ----------------------------------------------------
  // AUTHENTICATION HANDLERS
  // ----------------------------------------------------
  const handleLoginSuccess = () => {
    setCurrentView('DASHBOARD');
    setActivePatientId(null);
  };

  const handleLogout = async () => {
    await logout();
    clearSession();
    setAppUser(null);
    setCurrentView('DASHBOARD');
    setActivePatientId(null);
    refreshAppState();
  };

  // ----------------------------------------------------
  // PROFILE & VISIT NAVIGATORS
  // ----------------------------------------------------
  const handleViewProfile = (patientId: string) => {
    setActivePatientId(patientId);
    setCurrentView('PROFILE');
  };

  const handleStartVisit = (patientId: string) => {
    if (!currentUser) return;
    
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;

    // Create a new Visit record
    const newVisit: Visit = {
      id: `vis_${Date.now()}`,
      patientId: patientId,
      nurseId: currentUser.id,
      nurseName: currentUser.name,
      startTime: new Date().toISOString(),
      status: 'IN_PROGRESS',
      currentStep: 1
    };

    saveVisit(newVisit);
    
    // Log physical event
    addAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      patientId,
      `${patient.firstName} ${patient.lastName}`,
      'Visita Iniciada',
      'VISIT',
      `Inicio de visita en ${PRODUCT_NAME} en la habitación ${patient.room || 'N/A'}. ${POWERED_BY}.`
    );

    setActivePatientId(patientId);
    setActiveVisit(newVisit);
    setCurrentView('VISIT');
    refreshAppState();
  };

  const handleContinueVisit = (patientId: string) => {
    if (!currentUser) return;

    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;

    // Find incomplete visit for this patient
    const incompleteVisit = getLatestVisitForPatient(patientId);
    if (incompleteVisit) {
      incompleteVisit.status = 'IN_PROGRESS';
      saveVisit(incompleteVisit);
      setActiveVisit(incompleteVisit);
      
      addAuditLog(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        patientId,
        `${patient.firstName} ${patient.lastName}`,
        'Visita Reanudada',
        'VISIT',
        `Reanudación del proceso de activación. Iniciando en Paso ${incompleteVisit.currentStep}`
      );
    } else {
      // Fallback
      handleStartVisit(patientId);
      return;
    }

    setActivePatientId(patientId);
    setCurrentView('VISIT');
    refreshAppState();
  };

  // ----------------------------------------------------
  // REASSIGN NURSE (ADMIN COMMAND)
  // ----------------------------------------------------
  const handleReassignNurse = (patientId: string, nurseId: string) => {
    if (!currentUser) return;

    const patient = getPatients().find(p => p.id === patientId);
    const nurse = getUsers().find(u => u.id === nurseId && u.role === 'NURSE');
    
    if (patient && nurse) {
      const oldNurseName = patient.assignedNurseName;
      patient.assignedNurseId = nurse.id;
      patient.assignedNurseName = nurse.name;
      savePatient(patient);

      // HIPAA Logging
      addAuditLog(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        patientId,
        `${patient.firstName} ${patient.lastName}`,
        'Enfermera Reasignada',
        'PATIENT',
        `Cambio de personal asignado de "${oldNurseName}" a "${nurse.name}".`
      );

      refreshAppState();
      showToast(`${l('Paciente reasignado correctamente a', 'Patient successfully reassigned to')} ${nurse.name}`);
    }
  };

  const handleGenerateMedicalOrder = (patientId: string, deviceType?: string) => {
    if (!currentUser) return;
    const patient = getPatients().find(p => p.id === patientId);
    if (!patient) return;

    const order = !deviceType && patient.medicalOrder?.status === 'ORDER_REJECTED_NEEDS_REVISION'
      ? resubmitMedicalOrder(patient, currentUser)
      : createMedicalOrder(patient, currentUser, deviceType);
    const latestOrderAction = order.auditTrail[order.auditTrail.length - 1]?.action;

    patient.medicalOrder = order;
    savePatient(patient);

    addAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      patient.id,
      `${patient.firstName} ${patient.lastName}`,
      latestOrderAction === 'RESENT' ? 'Orden Médica Re-enviada' : 'Orden Médica Generada',
      'DEVICE',
      `Orden ${order.id} para ${order.deviceType || patient.requiredDevice}, versión ${order.orderVersion}, enviada a ${order.assignedPhysician}. Estado: ${order.status}. Creada por: ${order.createdBy || currentUser.name}.`
    );

    refreshAppState();
    showToast(l('Orden médica enviada al médico para revisión.', 'Medical order sent to physician for review.'), 'info');
  };

  const handleApproveMedicalOrder = (patientId: string, notes?: string) => {
    if (!currentUser) return;
    const patient = getPatients().find(p => p.id === patientId);
    if (!patient) return;

    const order = approveMedicalOrder(patient, currentUser, notes);
    patient.medicalOrder = order;
    savePatient(patient);

    addAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      patient.id,
      `${patient.firstName} ${patient.lastName}`,
      'Orden Medica Aprobada',
      'DEVICE',
      `Orden ${order.id} aprobada por ${currentUser.name}. Medico asignado: ${order.assignedPhysician}. Fecha: ${order.approvedAt}. Version: ${order.orderVersion}.`
    );

    void generateDocument('MEDICAL_ORDER', patient.id, { order }).then(({ document }) => {
      saveDocument(document);
      refreshAppState();
    });
    addAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      patient.id,
      `${patient.firstName} ${patient.lastName}`,
      `${PRODUCT_NAME} - Orden Medica PDF Generado`,
      'DEVICE',
      `PDF de evidencia generado para orden ${order.id}.`
    );

    refreshAppState();
    showToast(l('Orden medica aprobada. PDF de evidencia generado.', 'Medical order approved. Evidence PDF generated.'));
  };

  const handleRejectMedicalOrder = (patientId: string, notes?: string) => {
    if (!currentUser) return;
    const patient = getPatients().find(p => p.id === patientId);
    if (!patient) return;

    const resolvedNotes = notes || l('Requiere revision antes de activar el dispositivo.', 'Needs revision before device activation.');
    const order = rejectMedicalOrder(patient, currentUser, resolvedNotes);
    patient.medicalOrder = order;
    savePatient(patient);

    addAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      patient.id,
      `${patient.firstName} ${patient.lastName}`,
      'Orden Medica Requiere Revision',
      'DEVICE',
      `Orden ${order.id} rechazada/needs revision por ${currentUser.name}. Nota: ${resolvedNotes}`
    );

    refreshAppState();
    showToast(l('Orden marcada como requiere revision.', 'Order marked as needs revision.'), 'info');
  };

  // ----------------------------------------------------
  // PDF GENERATION BINDINGS
  // ----------------------------------------------------
  const handleDownloadPDF = (docRecord: DocumentRecord) => {
    if (!currentUser) return;
    void downloadDocument(docRecord.id).then(blob => {
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${docRecord.title.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    });

    addAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      docRecord.patientId,
      docRecord.patientName,
      'PDF Descargado',
      'GENERAL',
      `Descarga local del documento "${docRecord.title}" (ID: ${docRecord.id}).`
    );
  };

  const handleGenerateConsentPDF = async (consent: Consent, callback: (pdfDataUrl: string) => void): Promise<void> => {
    if (!currentUser) throw new Error('Authentication required.');
    const patientObj = patients.find(p => p.id === consent.patientId);
    if (!patientObj) throw new Error('Patient record was not found.');

    const { blob } = await generateDocument('CONSENT', patientObj.id, { consent });
    callback(blob ? URL.createObjectURL(blob) : '');
    refreshAppState();
  };

  const handleGenerateDeliveryPDF = async (device: Device, callback: (pdfDataUrl: string) => void): Promise<void> => {
    if (!currentUser) throw new Error('Authentication required.');
    const patientObj = patients.find(p => p.id === device.patientId);
    if (!patientObj) throw new Error('Patient record was not found.');

    const { blob } = await generateDocument('DEVICE_DELIVERY', patientObj.id, { device });
    callback(blob ? URL.createObjectURL(blob) : '');
    refreshAppState();
  };

  // ----------------------------------------------------
  // SAVE WIZARD STATE HANDLER
  // ----------------------------------------------------
  const handleSaveAndExitWizard = (
    visit: Visit,
    consent?: Consent,
    device?: Device,
    reading?: BPReading | BPReading[],
    triggerActivation?: boolean
  ) => {
    if (!currentUser) return;

    const patientObj = patients.find(p => p.id === visit.patientId);
    if (!patientObj) return;

    if (triggerActivation && patientRequiresDevice(patientObj) && !isMedicalOrderApproved(patientObj)) {
      addAuditLog(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        visit.patientId,
        `${patientObj.firstName} ${patientObj.lastName}`,
        'Activación Bloqueada',
        'DEVICE',
        'Intento de activar paciente con dispositivo sin orden médica aprobada.'
      );
      showToast(l('Activación bloqueada: falta orden médica aprobada.', 'Activation blocked: approved medical order is required.'), 'info');
      refreshAppState();
      return;
    }

    // 1. Save Visit object
    saveVisit(visit);

    // 2. Save clinical sub-objects
    if (consent) {
      saveConsent(consent);
      addAuditLog(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        visit.patientId,
        `${patientObj.firstName} ${patientObj.lastName}`,
        'Consentimiento Guardado',
        'CONSENT',
        `Acuerdo firmado registrado para ${consent.signerName}. Estado: ${consent.status}`
      );
    }

    if (device) {
      saveDevice(device);
      addAuditLog(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        visit.patientId,
        `${patientObj.firstName} ${patientObj.lastName}`,
        'Device Entregado/Actualizado',
        'DEVICE',
        `Dispositivo registrado: ${device.brand} (${device.serialNumber}). Conectividad: ${device.status}`
      );
    }

    const readings = reading ? (Array.isArray(reading) ? reading : [reading]) : [];
    readings.forEach((currentReading) => {
      saveBPReading(currentReading);
      const isWeightReading = currentReading.readingType === 'WEIGHT';
      addAuditLog(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        visit.patientId,
        `${patientObj.firstName} ${patientObj.lastName}`,
        isWeightReading ? 'Peso Registrado' : 'Presión Arterial Registrada',
        'BP_READING',
        isWeightReading
          ? `Lectura basal de báscula: ${currentReading.weightLbs} lb.`
          : `Lectura basal: ${currentReading.systolic}/${currentReading.diastolic} mmHg. Pulso: ${currentReading.pulse} bpm.`
      );
    });

    // 3. Finalize Patient statuses
    if (triggerActivation) {
      patientObj.status = 'ACTIVE';
      patientObj.activationDate = new Date().toISOString();
      patientObj.activatedBy = currentUser.name;
      
      savePatient(patientObj);

      addAuditLog(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        visit.patientId,
        `${patientObj.firstName} ${patientObj.lastName}`,
        'Paciente Activado',
        'PATIENT',
        `El paciente ha completado el flujo de ${PRODUCT_NAME} y ha quedado activo en el programa ${patientObj.assignedProgram}.`
      );

      showToast(l(`¡Paciente ${patientObj.firstName} ${patientObj.lastName} activado con éxito!`, `Patient ${patientObj.firstName} ${patientObj.lastName} activated successfully!`));
    } else {
      // Paused / Incomplete or declined
      if (consent?.status === 'DECLINED') {
        patientObj.status = 'CONSENT_DECLINED';
        addAuditLog(
          currentUser.id,
          currentUser.name,
          currentUser.role,
          visit.patientId,
          `${patientObj.firstName} ${patientObj.lastName}`,
          `${PRODUCT_NAME} - Proceso Cancelado`,
          'PATIENT',
          `Proceso abortado. El paciente declinó firmar el consentimiento.`
        );
        showToast(l(`${PRODUCT_NAME}: proceso cancelado porque el paciente declinó el consentimiento.`, `${PRODUCT_NAME}: process canceled because the patient declined consent.`), 'info');
      } else {
        patientObj.status = 'INCOMPLETE';
        addAuditLog(
          currentUser.id,
          currentUser.name,
          currentUser.role,
          visit.patientId,
          `${patientObj.firstName} ${patientObj.lastName}`,
          `${PRODUCT_NAME} - Proceso Pausado`,
          'VISIT',
          `Proceso guardado localmente para continuar en otro momento (Paso ${visit.currentStep}).`
        );
        showToast(l('Proceso guardado. Puede continuar la visita más tarde.', 'Progress saved. You can continue the visit later.'), 'info');
      }
      savePatient(patientObj);
    }

    // Reset wizard
    setActiveVisit(undefined);
    setCurrentView('DASHBOARD');
    refreshAppState();
  };

  // ----------------------------------------------------
  // PATIENT REGISTRATION HANDLER
  // ----------------------------------------------------
  const handleRegisterPatient = (newPatient: Patient) => {
    if (!currentUser) return;

    // Auto-generate medical order for RPM patients
    const autoOrder = generateAutoOrderIfNeeded(newPatient, currentUser);
    if (autoOrder) {
      newPatient.medicalOrder = autoOrder;
    }

    savePatient(newPatient);

    addAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      newPatient.id,
      `${newPatient.firstName} ${newPatient.lastName}`,
      'Paciente Registrado',
      'PATIENT',
      `Nuevo paciente registrado en ${newPatient.nursingHome} (habitacion ${newPatient.room || 'N/A'}) bajo el programa ${newPatient.assignedProgram}.`
    );

    if (autoOrder) {
      addAuditLog(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        newPatient.id,
        `${newPatient.firstName} ${newPatient.lastName}`,
        'Orden Medica Auto-Generada',
        'DEVICE',
        `Orden ${autoOrder.id} generada automaticamente al registrar paciente RPM. Estado: ${autoOrder.status}.`
      );
    }

    refreshAppState();
    showToast(l(`${PRODUCT_NAME}: paciente ${newPatient.firstName} ${newPatient.lastName} registrado con éxito.`, `${PRODUCT_NAME}: patient ${newPatient.firstName} ${newPatient.lastName} registered successfully.`));

    // If admin and an order was auto-generated, open the review modal
    if (autoOrder && currentUser.role === 'ADMIN') {
      setMedicalOrderReviewPatient(newPatient);
    }
  };

  // ----------------------------------------------------
  // PATIENT UPDATE HANDLER
  // ----------------------------------------------------
  const handleUpdatePatient = (updatedPatient: Patient) => {
    if (!currentUser) return;

    savePatient(updatedPatient);

    addAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      updatedPatient.id,
      `${updatedPatient.firstName} ${updatedPatient.lastName}`,
      'Paciente Actualizado',
      'PATIENT',
      `Información del paciente actualizada: Residencia: ${updatedPatient.nursingHome}, Habitación: ${updatedPatient.room || 'N/A'}, Programa: ${updatedPatient.assignedProgram}.`
    );

    refreshAppState();
    showToast(l(`Paciente ${updatedPatient.firstName} ${updatedPatient.lastName} actualizado con éxito.`, `Patient ${updatedPatient.firstName} ${updatedPatient.lastName} updated successfully.`));
  };

  // ----------------------------------------------------
  // RENDER SELECTION
  // ----------------------------------------------------
  const selectedPatient = useMemo(() => {
    if (!activePatientId) return null;
    return patients.find(p => p.id === activePatientId) || null;
  }, [patients, activePatientId]);

  const patientConsent = useMemo(() => {
    if (!activePatientId) return undefined;
    return getConsentByPatientId(activePatientId);
  }, [activePatientId, documents]); // recalculate when docs change

  const patientDevice = useMemo(() => {
    if (!activePatientId) return undefined;
    return getDeviceByPatientId(activePatientId);
  }, [activePatientId, documents]);

  const patientBPReadings = useMemo(() => {
    if (!activePatientId) return [];
    return getBPReadingsByPatientId(activePatientId);
  }, [activePatientId, auditLogs]);

  // If user is not logged in, force Login screen
  if (authLoading) {
    return <div className="min-h-screen grid place-items-center text-sm font-semibold text-slate-600">Loading secure session...</div>;
  }

  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} initialError={authError} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800" id="main-application-frame">
      {/* Top Main navigation header */}
      <Header 
        currentUser={currentUser} 
        onLogout={handleLogout} 
      />

      {/* Main body viewport */}
      <main className="flex-1 max-w-full w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Toast Alert */}
        {toast && (
          <div 
            className={`mb-6 p-4 rounded-xl shadow-lg border flex items-center space-x-3 animate-slide-in max-w-md ${
              toast.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-indigo-50 border-indigo-200 text-indigo-800'
            }`}
            id="global-alert-toast"
          >
            <CheckCircle className={toast.type === 'success' ? 'text-emerald-600' : 'text-indigo-600'} size={20} />
            <span className="text-xs font-bold">{toast.message}</span>
          </div>
        )}

        {/* View Router */}
        {currentView === 'DASHBOARD' && (
          currentUser.role === 'ADMIN' || currentUser.role === 'PHYSICIAN' ? (
            <DashboardAdmin
              currentUser={currentUser}
              patients={patients}
              auditLogs={auditLogs}
              documents={documents}
              users={getUsers()}
              conditionGroups={conditionGroups}
              diagnoses={diagnoses}
              catalogImports={catalogImports}
              onViewProfile={handleViewProfile}
              onReassignNurse={handleReassignNurse}
              onDownloadPDF={handleDownloadPDF}
              onRegisterPatientClick={() => setIsRegisterModalOpen(true)}
              onGenerateMedicalOrder={handleGenerateMedicalOrder}
              onOpenMedicalOrderReview={(p) => setMedicalOrderReviewPatient(p)}
              onImportConditionCatalog={() => setIsCatalogImportOpen(true)}
              onSaveConditionGroup={handleSaveConditionGroup}
              onSaveDiagnosis={handleSaveDiagnosis}
              onUsersChanged={reloadAppState}
              onNotify={showToast}
            />
          ) : (
            <DashboardNurse
              currentUser={currentUser}
              patients={patients}
              onStartVisit={handleStartVisit}
              onViewProfile={handleViewProfile}
              onContinueVisit={handleContinueVisit}
              onRegisterPatientClick={() => setIsRegisterModalOpen(true)}
              onGenerateMedicalOrder={handleGenerateMedicalOrder}
            />
          )
        )}

        {currentView === 'PROFILE' && selectedPatient && (
          <PatientProfile
            currentUser={currentUser}
            patient={selectedPatient}
            consent={patientConsent}
            device={patientDevice}
            bpReadings={patientBPReadings}
            documents={documents.filter(d => d.patientId === selectedPatient.id)}
            auditLogs={auditLogs}
            onBack={() => {
              setCurrentView('DASHBOARD');
              setActivePatientId(null);
            }}
            onStartVisit={handleStartVisit}
            onContinueVisit={handleContinueVisit}
            onDownloadPDF={handleDownloadPDF}
            onUpdatePatient={handleUpdatePatient}
            onGenerateMedicalOrder={handleGenerateMedicalOrder}
            onApproveMedicalOrder={handleApproveMedicalOrder}
            onRejectMedicalOrder={handleRejectMedicalOrder}
            onOpenMedicalOrderReview={(p) => setMedicalOrderReviewPatient(p)}
          />
        )}

        {currentView === 'VISIT' && selectedPatient && (
          <VisitWizard
            currentUser={currentUser}
            patient={selectedPatient}
            existingVisit={activeVisit}
            onSaveAndExit={handleSaveAndExitWizard}
            onCancel={() => {
              setCurrentView('DASHBOARD');
              setActivePatientId(null);
              setActiveVisit(undefined);
            }}
            onGenerateConsentPDF={handleGenerateConsentPDF}
            onGenerateDeliveryPDF={handleGenerateDeliveryPDF}
            onUpdatePatient={handleUpdatePatient}
            onGenerateMedicalOrder={handleGenerateMedicalOrder}
          />
        )}
      </main>
      
      {/* Patient Registration Overlay Modal */}
      <RegisterPatientModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onRegister={handleRegisterPatient}
        currentUser={currentUser}
        users={getUsers()}
        conditionGroups={conditionGroups}
        diagnoses={diagnoses}
      />

      <ConditionCatalogImportModal
        isOpen={isCatalogImportOpen && currentUser.role === 'ADMIN'}
        currentUser={currentUser}
        groups={conditionGroups}
        diagnoses={diagnoses}
        history={catalogImports}
        onClose={() => setIsCatalogImportOpen(false)}
        onConfirm={handleCatalogImport}
        onToggleGroup={handleToggleConditionGroup}
        onToggleDiagnosis={handleToggleDiagnosis}
      />

      {/* Medical Order Review Modal */}
      {medicalOrderReviewPatient && (
        <MedicalOrderReviewModal
          isOpen={!!medicalOrderReviewPatient}
          patient={medicalOrderReviewPatient}
          currentUser={currentUser}
          onClose={() => setMedicalOrderReviewPatient(null)}
          onApprove={handleApproveMedicalOrder}
          onReject={handleRejectMedicalOrder}
        />
      )}

      {/* Universal Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-500 py-6" id="app-footer">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs space-y-1 font-semibold">
          <p>© 2026 ITERA HEALTH. {l('Todos los derechos reservados.', 'All rights reserved.')}</p>
          <p className="text-slate-600">{PRODUCT_NAME} • {POWERED_BY}</p>
        </div>
      </footer>
    </div>
  );
}
