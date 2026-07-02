import React, { createContext, useContext, useState, useEffect } from 'react';
import { POWERED_BY, PRODUCT_NAME } from './branding';

export type Language = 'ES' | 'EN';

export const translations = {
  ES: {
    // Header
    amavita_portal: PRODUCT_NAME,
    at_service_of: POWERED_BY,
    change_user: "Cambiar de Usuario (Simulación)",
    ideal_for_testing: "Ideal para probar los dos roles en la app",
    sign_out: "Cerrar Sesión Activa",
    admin: "Administrador",
    nurse: "Enfermera",
    general_access: "Acceso General",
    nurse_visits: "Enfermera Visitas",
    select_language: "Idioma",

    // Login
    login_title: PRODUCT_NAME,
    login_subtitle: POWERED_BY,
    login_btn: "Iniciar Sesión",
    email_label: "Correo electrónico institucional",
    pass_label: "Contraseña",
    quick_logins: "Accesos Rápidos de Simulación",
    invalid_creds: "Credenciales inválidas. Para demostración, use los accesos rápidos de abajo.",
    enter_email: "Por favor, ingrese un correo electrónico.",

    // Dashboard Nurse
    assigned_patients: "Mis Pacientes Asignados",
    search_placeholder: "Buscar por nombre, Medicare ID o asilo...",
    filter_all: "Todos",
    filter_pending_consent: "Pendientes Consentimiento",
    filter_pending_device: "Pendientes Equipo",
    filter_activated: "Activos / Conectados",
    start_visit: "Iniciar Visita",
    continue_visit: "Continuar Visita",
    view_profile: "Ver Perfil",
    room: "Habitación",
    no_patients: "No se encontraron pacientes asignados con el criterio de búsqueda.",

    // Dashboard Admin
    admin_dashboard: "Panel de Control Administrativo (HIPAA)",
    tab_patients: "Pacientes Registrados",
    tab_audit: "Logs de Auditoría",
    tab_docs: "Documentos Contractuales",
    assigned_nurse: "Enfermera Asignada",
    reassign_nurse: "Reasignar Enfermera",
    program: "Programa",
    status: "Estado",
    actions: "Acciones",
    all_audit_logs: "Bitácora Completa de Auditoría e Interacciones (HIPAA)",
    user: "Usuario",
    entity: "Entidad",
    details: "Detalles",
    date_time: "Fecha y Hora",
    search_logs: "Buscar en los logs...",
    contractual_docs: "Listado de Documentos Contractuales y Consentimientos",
    doc_type: "Tipo Documento",
    patient: "Paciente",
    version: "Versión",
    generated_by: "Generado Por",
    download_pdf: "Descargar PDF",

    // Patient Profile
    back_to_dashboard: "Volver al Dashboard",
    phone: "Teléfono",
    birth_date: "Fecha de Nacimiento",
    clinical_data: "Información Clínica",
    conditions: "Condiciones Médicas",
    medications: "Medicamentos",
    programs: "Programas Clínicos",
    documents: "Documentos de Visita",
    bp_history: "Historial de Lecturas de Presión",
    audit_trail: "Rastro de Auditoría del Paciente",
    device_assigned: "Dispositivo Asignado",
    device_type: "Tipo de Dispositivo",
    model: "Modelo",
    serial_number: "Número de Serie",
    not_assigned: "No hay un dispositivo registrado.",

    // Wizard
    step: "Paso",
    of: "de",
    exit_wizard: "Salir del Asistente",
    save_and_continue: "Guardar y Continuar",
    save_progress: "Guardar Progreso Localmente",
    back: "Atrás",
    finalize_visit: "Finalizar Visita",
    cancel_flow: "Cancelar Flujo (Declinado)",

    // Steps
    step1_title: "Paso 1: Confirmación de Identidad",
    step1_subtitle: "Por favor, valide los datos del paciente con sus credenciales físicas o brazalete.",
    step2_title: "Paso 2: Explicación del Servicio",
    step2_subtitle: "Lea el script clínico explicativo al paciente para asegurar consentimiento informado.",
    step3_title: "Paso 3: Consentimiento Informado",
    step3_subtitle: "Lea y registre los detalles del consentimiento. Si el paciente declina, el flujo se detiene por cumplimiento.",
    step4_title: "Paso 4: Entrega y Configuración del Device",
    step4_subtitle: "Asigne el monitor y registre el número de serie único y el Kit ID de la caja.",
    step5_title: "Paso 5: Activación y Conectividad del Equipo",
    step5_subtitle: "Verifique que el dispositivo se haya conectado a la plataforma y transmita señales LTE.",
    step6_title: "Paso 6: Primera Lectura de Presión Arterial",
    step6_subtitle: "Tome la lectura basal inicial y compárela con los rangos clínicos establecidos.",
    step7_title: "Paso 7: Finalización de la Visita Clíncia",
    step7_subtitle: "Revise el resumen final de la visita y genere los documentos PDF con firmas contractuales.",

    marcar_todos: "Marcar todos",
    desmarcar_todos: "Desmarcar todos",
  },
  EN: {
    // Header
    amavita_portal: PRODUCT_NAME,
    at_service_of: POWERED_BY,
    change_user: "Switch User (Simulation)",
    ideal_for_testing: "Ideal for testing both roles in the app",
    sign_out: "Sign Out Active Session",
    admin: "Administrator",
    nurse: "Nurse",
    general_access: "General Access",
    nurse_visits: "Visiting Nurse",
    select_language: "Language",

    // Login
    login_title: PRODUCT_NAME,
    login_subtitle: POWERED_BY,
    login_btn: "Log In",
    email_label: "Institutional Email",
    pass_label: "Password",
    quick_logins: "Quick Simulation Logins",
    invalid_creds: "Invalid credentials. For demonstration, use the quick access options below.",
    enter_email: "Please enter an email address.",

    // Dashboard Nurse
    assigned_patients: "My Assigned Patients",
    search_placeholder: "Search by name, Medicare ID or nursing home...",
    filter_all: "All",
    filter_pending_consent: "Pending Consent",
    filter_pending_device: "Pending Device",
    filter_activated: "Active / Connected",
    start_visit: "Start Visit",
    continue_visit: "Continue Visit",
    view_profile: "View Profile",
    room: "Room",
    no_patients: "No assigned patients found matching the search criteria.",

    // Dashboard Admin
    admin_dashboard: "Administrative Control Panel (HIPAA)",
    tab_patients: "Registered Patients",
    tab_audit: "Audit Logs",
    tab_docs: "Contractual Documents",
    assigned_nurse: "Assigned Nurse",
    reassign_nurse: "Reassign Nurse",
    program: "Program",
    status: "Status",
    actions: "Actions",
    all_audit_logs: "Complete Audit and Interaction Log (HIPAA)",
    user: "User",
    entity: "Entity",
    details: "Details",
    date_time: "Date & Time",
    search_logs: "Search logs...",
    contractual_docs: "List of Contractual Documents and Consents",
    doc_type: "Document Type",
    patient: "Patient",
    version: "Version",
    generated_by: "Generated By",
    download_pdf: "Download PDF",

    // Patient Profile
    back_to_dashboard: "Back to Dashboard",
    phone: "Phone",
    birth_date: "Date of Birth",
    clinical_data: "Clinical Information",
    conditions: "Medical Conditions",
    medications: "Medications",
    programs: "Clinical Programs",
    documents: "Visit Documents",
    bp_history: "Blood Pressure Reading History",
    audit_trail: "Patient Audit Trail",
    device_assigned: "Assigned Device",
    device_type: "Device Type",
    model: "Model",
    serial_number: "Serial Number",
    not_assigned: "No registered device found.",

    // Wizard
    step: "Step",
    of: "of",
    exit_wizard: "Exit Wizard",
    save_and_continue: "Save & Continue",
    save_progress: "Save Progress Locally",
    back: "Back",
    finalize_visit: "Finalize Visit",
    cancel_flow: "Cancel Flow (Declined)",

    // Steps
    step1_title: "Step 1: Identity Confirmation",
    step1_subtitle: "Please validate patient details with physical ID or wristband.",
    step2_title: "Step 2: Service Explanation",
    step2_subtitle: "Read the explanatory clinical script to the patient to ensure informed consent.",
    step3_title: "Step 3: Informed Consent",
    step3_subtitle: "Read and record consent details. If the patient declines, the flow stops for compliance.",
    step4_title: "Step 4: Device Delivery & Configuration",
    step4_subtitle: "Assign the monitor and record the unique serial number and Kit ID from the box.",
    step5_title: "Step 5: Equipment Activation & Connectivity",
    step5_subtitle: "Verify that the device has connected to the platform and transmits LTE signals.",
    step6_title: "Step 6: First Blood Pressure Reading",
    step6_subtitle: "Take the initial baseline reading and compare it with established clinical ranges.",
    step7_title: "Step 7: Visit Completion",
    step7_subtitle: "Review the final visit summary and generate PDF documents with contractual signatures.",

    marcar_todos: "Confirm each item",
    desmarcar_todos: "Deselect all",
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations.ES) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language');
    return (saved === 'EN' || saved === 'ES') ? saved : 'ES';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app_language', lang);
  };

  const t = (key: keyof typeof translations.ES): string => {
    const langDict = translations[language] || translations.ES;
    return langDict[key] || translations.ES[key] || String(key);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
