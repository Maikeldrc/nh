import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import PDFDocument from 'pdfkit';
import { google } from 'googleapis';
import { config } from './config.js';

const drive = google.drive({ version: 'v3', auth: new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/drive']
}) });

function renderPdf(type, patient, source) {
  if (type === 'CONSENT') return renderConsentPdf(patient, source.consent || source);
  if (type === 'DEVICE_DELIVERY') return renderDeviceDeliveryPdf(patient, source.device || source);

  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: 'LETTER', margins: {
      top: 34, bottom: 34, left: 38, right: 38
    } });
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(17).fillColor('#173B67').text('AMAVITA CareStart');
    doc.fontSize(9).fillColor('#506176').text('Powered by ITERA.HEALTH');
    doc.moveDown(0.8);
    doc.fontSize(14).fillColor('#111827').text(titleFor(type));
    doc.moveDown(0.6);
    field(doc, 'Patient', `${patient.firstName || ''} ${patient.lastName || ''}`.trim());
    field(doc, 'Facility', patient.nursingHome || '');
    field(doc, 'Program', patient.assignedProgram || '');
    doc.moveDown(0.5);

    const content = source.consent || source.device || source.order || source;
    for (const [label, value] of Object.entries(content)) {
      if (['patientSignature', 'nurseSignature', 'auditTrail'].includes(label)) continue;
      if (value === undefined || value === null || value === '') continue;
      const printable = typeof value === 'object' ? JSON.stringify(value) : String(value);
      field(doc, humanize(label), printable.slice(0, 900));
    }
    doc.fontSize(7).fillColor('#64748B')
      .text('CONFIDENTIAL MEDICAL RECORD', 38, 742, { align: 'center' });
    doc.end();
  });
}

function renderConsentPdf(patient, consent) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 0,
      autoFirstPage: true,
      bufferPages: false
    });
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const page = { x: 28, y: 24, w: 556, h: 744 };
    const navy = '#1D4E89';
    const blue = '#2563EB';
    const cyan = '#0EA5E9';
    const green = '#059669';
    const line = '#CBD5E1';
    const muted = '#64748B';
    const text = '#111827';
    const soft = '#F8FAFC';

    const generatedAt = consent.dateTime || consent.signedAt || new Date().toISOString();
    const docId = consent.id || `con_${Date.now()}`;
    const patientName = `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || consent.signerName || 'Patient';
    const signerName = consent.signerName || patientName;
    const nurseName = consent.nurseName || consent.capturedBy || 'AMAVITA Nurse';
    const facility = consent.facility || patient.nursingHome || '';
    const program = consent.program || patient.assignedProgram || '';
    const consentMethod = consent.consentMethod || consent.signatureMethod || 'SIGNATURE';
    const authorizedPerson = consent.signerType === 'AUTHORIZED_REPRESENTATIVE' || consent.signedBy === 'REPRESENTATIVE'
      ? `Representative${consent.relationship ? ` - ${consent.relationship}` : ''}`
      : 'Patient (Self)';

    premiumHeader(doc, page, {
      color: navy,
      title: 'AMAVITA CareStart',
      subtitle: 'POWERED BY ITERA.HEALTH',
      docId,
      date: generatedAt,
      by: nurseName
    });

    doc.fillColor(text).font('Helvetica-Bold').fontSize(12.5)
      .text('Patient Care & Consent Agreement', page.x, page.y + 66);
    doc.fillColor(muted).font('Helvetica').fontSize(7.6)
      .text('Confidential medical record documenting patient authorization, consent terms, signatures, and audit details.', page.x, page.y + 82);

    let y = page.y + 101;

    // Patient demographics
    sectionHeader(doc, page.x, y, page.w, 'Patient Demographics', blue);
    y += 18;
    card(doc, page.x, y, page.w, 61, soft, line);
    const leftX = page.x + 13;
    const rightX = page.x + 206;
    const rowYs = [y + 10, y + 28, y + 46];
    labelValue(doc, leftX, rowYs[0], 170, 'Name', patientName);
    labelValue(doc, leftX, rowYs[1], 170, 'DOB', patient.birthDate || patient.dob || '');
    labelValue(doc, leftX, rowYs[2], 170, 'Medicare ID', patient.medicareId || '');
    labelValue(doc, rightX, rowYs[0], 340, 'Nursing Home', facility, { valueSize: facility.length > 58 ? 7.1 : 7.8 });
    labelValue(doc, rightX, rowYs[1], 160, 'Room', patient.room || '');
    labelValue(doc, rightX + 170, rowYs[1], 160, 'Program', program);
    labelValue(doc, rightX, rowYs[2], 340, 'Practice', patient.practice || consent.consentPracticeName || '');
    y += 72;

    // Consent authorization
    sectionHeader(doc, page.x, y, page.w, 'Consent Authorization', cyan);
    y += 18;
    card(doc, page.x, y, page.w, 58, '#FFFFFF', line);
    const authC1 = page.x + 13;
    const authC2 = page.x + 202;
    const authC3 = page.x + 390;
    labelValue(doc, authC1, y + 10, 168, 'Authorized Care Program', program);
    labelValue(doc, authC1, y + 33, 168, 'Consent Template Version', consent.consentVersion || 'v2.0 AMAVITA_ITERA');
    labelValue(doc, authC2, y + 10, 168, 'Signer Name', signerName);
    labelValue(doc, authC2, y + 33, 168, 'Authorized Person', authorizedPerson);
    labelValue(doc, authC3, y + 10, 150, 'Consent Method', humanize(consentMethod));
    labelValue(doc, authC3, y + 33, 150, 'Decision', consent.status || 'GRANTED');
    y += 69;

    // Terms
    sectionHeader(doc, page.x, y, page.w, 'Consent Terms & Conditions', green);
    y += 18;
    card(doc, page.x, y, page.w, 172, '#FFFFFF', line);
    const terms = consentTerms();
    const colW = 255;
    terms.forEach((term, index) => {
      const col = index < 4 ? 0 : 1;
      const row = index % 4;
      const tx = page.x + 13 + (col * 274);
      const ty = y + 10 + (row * 39);
      doc.circle(tx + 3, ty + 5, 2.1).fill(blue);
      doc.fillColor(text).font('Helvetica-Bold').fontSize(6.9)
        .text(term.title, tx + 10, ty, { width: colW, height: 8 });
      doc.fillColor('#334155').font('Helvetica').fontSize(6.35)
        .text(term.body, tx + 10, ty + 8, { width: colW, height: 30, lineGap: 0.2 });
    });
    y += 183;

    // Signatures
    sectionHeader(doc, page.x, y, page.w, 'Signatures & Confirmation', blue);
    y += 18;
    const sigW = (page.w - 10) / 2;
    signatureCard(doc, page.x, y, sigW, 94, 'Patient / Representative Signature', signerName, generatedAt, consent.patientSignature, consent.typedSignatureName);
    signatureCard(doc, page.x + sigW + 10, y, sigW, 94, 'Nurse / Witness Signature', nurseName, generatedAt, consent.nurseSignature);
    y += 105;

    // Audit
    sectionHeader(doc, page.x, y, page.w, 'Audit Log Details', '#7C3AED');
    y += 18;
    card(doc, page.x, y, page.w, 76, '#FFFFFF', line);
    const c1 = page.x + 13;
    const c2 = page.x + 196;
    const c3 = page.x + 358;
    labelValue(doc, c1, y + 10, 170, 'Consent Document ID', docId, { valueSize: 6.8 });
    labelValue(doc, c1, y + 31, 170, 'Audit Trail Token', consent.auditId || `audit_${docId.slice(-8)}`, { valueSize: 6.8 });
    labelValue(doc, c1, y + 52, 170, 'Decision', consent.status || 'GRANTED');
    labelValue(doc, c2, y + 10, 145, 'Signer', signerName);
    labelValue(doc, c2, y + 31, 145, 'Captured By', nurseName);
    labelValue(doc, c2, y + 52, 145, 'Date & Time', formatDateTime(generatedAt), { valueSize: 6.8 });
    labelValue(doc, c3, y + 10, 210, 'Facility', facility, { valueSize: facility.length > 48 ? 6.7 : 7.2 });
    labelValue(doc, c3, y + 43, 210, 'Capture Device', consent.captureDevice || 'AMAVITA CareStart');

    pdfFooter(doc, page, docId);

    doc.end();
  });
}

function renderDeviceDeliveryPdf(patient, device) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 0,
      autoFirstPage: true,
      bufferPages: false
    });
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const page = { x: 28, y: 24, w: 556, h: 744 };
    const blue = '#1D4E89';
    const cyan = '#0EA5E9';
    const green = '#059669';
    const purple = '#7C3AED';
    const line = '#CBD5E1';
    const muted = '#64748B';
    const text = '#111827';
    const soft = '#F8FAFC';

    const generatedAt = device.deliveryDate || device.activationDate || new Date().toISOString();
    const docId = device.id || `dev_${Date.now()}`;
    const patientName = `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Patient';
    const nurseName = device.deliveredBy || 'AMAVITA Nurse';
    const facility = patient.nursingHome || '';
    const program = patient.assignedProgram || '';
    const deviceLabel = device.deviceType || patient.requiredDevice || 'RPM Device';
    const serial = device.serialNumber || device.deviceId || 'N/A';

    premiumHeader(doc, page, {
      color: blue,
      title: 'AMAVITA CareStart',
      subtitle: 'POWERED BY ITERA.HEALTH',
      docId,
      date: generatedAt,
      by: nurseName
    });

    doc.fillColor(text).font('Helvetica-Bold').fontSize(12.5)
      .text('Device Delivery & Activation Confirmation', page.x, page.y + 66);
    doc.fillColor(muted).font('Helvetica').fontSize(7.6)
      .text('Confidential record documenting RPM device assignment, education, first reading, signatures, and activation audit details.', page.x, page.y + 82);

    let y = page.y + 101;

    sectionHeader(doc, page.x, y, page.w, 'Patient & Program', blue);
    y += 18;
    card(doc, page.x, y, page.w, 61, soft, line);
    const leftX = page.x + 13;
    const rightX = page.x + 206;
    const rowYs = [y + 10, y + 28, y + 46];
    labelValue(doc, leftX, rowYs[0], 170, 'Name', patientName);
    labelValue(doc, leftX, rowYs[1], 170, 'DOB', patient.birthDate || patient.dob || '');
    labelValue(doc, leftX, rowYs[2], 170, 'Medicare ID', patient.medicareId || '');
    labelValue(doc, rightX, rowYs[0], 340, 'Nursing Home', facility, { valueSize: facility.length > 58 ? 7.1 : 7.8 });
    labelValue(doc, rightX, rowYs[1], 160, 'Room', patient.room || '');
    labelValue(doc, rightX + 170, rowYs[1], 160, 'Program', program);
    labelValue(doc, rightX, rowYs[2], 340, 'Provider', device.providerName || patient.provider || '');
    y += 72;

    sectionHeader(doc, page.x, y, page.w, 'Device Assignment', cyan);
    y += 18;
    card(doc, page.x, y, page.w, 76, '#FFFFFF', line);
    const c1 = page.x + 13;
    const c2 = page.x + 202;
    const c3 = page.x + 390;
    labelValue(doc, c1, y + 10, 168, 'Device Type', deviceLabel);
    labelValue(doc, c1, y + 33, 168, 'Serial Number / ID', serial, { valueSize: serial.length > 24 ? 6.6 : 7.4 });
    labelValue(doc, c1, y + 56, 168, 'Kit ID', device.kitId || 'N/A');
    labelValue(doc, c2, y + 10, 168, 'Brand / Model', [device.brand, device.model].filter(Boolean).join(' - ') || 'N/A', { valueSize: 6.8 });
    labelValue(doc, c2, y + 33, 168, 'Medical Order', device.providerOrderStatus || 'PENDING');
    labelValue(doc, c2, y + 56, 168, 'Order Reference', device.providerOrderReference || 'N/A', { valueSize: 6.7 });
    labelValue(doc, c3, y + 10, 150, 'Delivered By', nurseName);
    labelValue(doc, c3, y + 33, 150, 'Delivery Date', formatDateTime(generatedAt), { valueSize: 6.6 });
    labelValue(doc, c3, y + 56, 150, 'Status', humanize(device.status || 'DELIVERED_ASSIGNED'), { valueSize: 6.6 });
    y += 87;

    sectionHeader(doc, page.x, y, page.w, 'Delivery, Education & First Reading', green);
    y += 18;
    card(doc, page.x, y, page.w, 124, '#FFFFFF', line);
    checklistItem(doc, page.x + 13, y + 12, 'Device delivered to patient or responsible staff', device.deliveredToPatient);
    checklistItem(doc, page.x + 13, y + 33, 'Device assigned and linked to the patient', device.assignedToPatient);
    checklistItem(doc, page.x + 13, y + 54, 'Measurement technique and device use explained', device.instructionsGiven);
    checklistItem(doc, page.x + 13, y + 75, 'Patient or staff demonstrated understanding', device.understandingDemonstrated);
    checklistItem(doc, page.x + 13, y + 96, 'Device activation confirmed or pending workflow documented', device.deviceActivated);

    const readingX = page.x + 310;
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(7.4).text('First Reading Snapshot', readingX, y + 12, { width: 230 });
    labelValue(doc, readingX, y + 29, 70, 'Systolic', device.systolic || device.firstReading?.systolic || 'N/A');
    labelValue(doc, readingX + 78, y + 29, 70, 'Diastolic', device.diastolic || device.firstReading?.diastolic || 'N/A');
    labelValue(doc, readingX + 156, y + 29, 70, 'Pulse', device.pulse || device.firstReading?.pulse || 'N/A');
    labelValue(doc, readingX, y + 58, 92, 'Weight', device.weightLbs || device.firstReading?.weightLbs || 'N/A');
    labelValue(doc, readingX + 104, y + 58, 120, 'Reading Source', device.readingSource || 'DEVICE');
    labelValue(doc, readingX, y + 87, 224, 'Notes', device.notes || 'No delivery exceptions documented.', { valueSize: 6.6, height: 18 });
    y += 135;

    sectionHeader(doc, page.x, y, page.w, 'Signatures & Confirmation', blue);
    y += 18;
    const sigW = (page.w - 10) / 2;
    signatureCard(doc, page.x, y, sigW, 94, 'Recipient / Staff Signature', patientName, generatedAt, device.recipientSignature);
    signatureCard(doc, page.x + sigW + 10, y, sigW, 94, 'Nurse / Delivery Signature', nurseName, generatedAt, device.nurseSignature);
    y += 105;

    sectionHeader(doc, page.x, y, page.w, 'Audit Log Details', purple);
    y += 18;
    card(doc, page.x, y, page.w, 74, '#FFFFFF', line);
    labelValue(doc, c1, y + 10, 168, 'Device Document ID', docId, { valueSize: 6.8 });
    labelValue(doc, c1, y + 33, 168, 'Device Record ID', device.id || 'N/A', { valueSize: 6.8 });
    labelValue(doc, c1, y + 56, 168, 'Decision', 'DELIVERY DOCUMENTED');
    labelValue(doc, c2, y + 10, 168, 'Captured By', nurseName);
    labelValue(doc, c2, y + 33, 168, 'Date & Time', formatDateTime(generatedAt), { valueSize: 6.8 });
    labelValue(doc, c2, y + 56, 168, 'Capture Device', 'AMAVITA CareStart');
    labelValue(doc, c3, y + 10, 150, 'Facility', facility, { valueSize: facility.length > 34 ? 6.4 : 7.1, height: 18 });
    labelValue(doc, c3, y + 43, 150, 'Program', program);

    pdfFooter(doc, page, docId);
    doc.end();
  });
}

function field(doc, label, value) {
  doc.fontSize(7).fillColor('#64748B').text(label.toUpperCase());
  doc.fontSize(9).fillColor('#111827').text(value, { lineGap: 1 });
  doc.moveDown(0.25);
}

function humanize(value) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ');
}

function titleFor(type) {
  if (type === 'CONSENT') return 'Patient Care & Consent Agreement';
  if (type === 'DEVICE_DELIVERY') return 'Device Delivery & Activation Confirmation';
  return 'Physician Medical Order';
}

export async function createPdf(type, patient, source, user) {
  const id = `doc_${crypto.randomUUID()}`;
  const buffer = await renderPdf(type, patient, source);
  const title = titleFor(type);
  const response = await withPdfStorageError(() => retryTransientGoogleError(() => drive.files.create({
    fields: 'id',
    supportsAllDrives: true,
    requestBody: {
      name: `${id}.pdf`,
      parents: [config.driveFolderId],
      mimeType: 'application/pdf',
      appProperties: {
        patient_id: patient.id,
        document_type: type
      }
    },
    media: { mimeType: 'application/pdf', body: Readable.from([buffer]) }
  })));
  return {
    document: {
      id,
      patientId: patient.id,
      patientName: `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
      visitId: source.consent?.visitId || patient.id,
      type,
      title,
      dateTime: new Date().toISOString(),
      generatedBy: user.name,
      driveFileId: response.data.id
    },
    buffer
  };
}

function premiumHeader(doc, page, meta) {
  doc.roundedRect(page.x, page.y, page.w, 54, 8).fill(meta.color);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(15)
    .text(meta.title, page.x + 18, page.y + 12, { width: 250 });
  doc.fillColor('#DDEBFF').font('Helvetica-Bold').fontSize(7)
    .text(meta.subtitle, page.x + 18, page.y + 31, { width: 250 });
  doc.fillColor('#EAF3FF').font('Helvetica-Bold').fontSize(6.8);
  headerMeta(doc, page.x + 392, page.y + 8, 'DOC ID', meta.docId);
  headerMeta(doc, page.x + 392, page.y + 24, 'DATE', formatDate(meta.date));
  headerMeta(doc, page.x + 392, page.y + 40, 'BY', meta.by);
}

function pdfFooter(doc, page, docId) {
  const footerY = 752;
  doc.moveTo(page.x, footerY - 7).lineTo(page.x + page.w, footerY - 7).strokeColor('#E2E8F0').lineWidth(0.7).stroke();
  doc.fillColor('#475569').font('Helvetica-Bold').fontSize(6.5)
    .text('AMAVITA CARESTART - POWERED BY ITERA.HEALTH - CONFIDENTIAL MEDICAL RECORD - HIPAA COMPLIANT', page.x, footerY, { width: page.w, align: 'center' });
  doc.fillColor('#94A3B8').font('Helvetica').fontSize(5.8)
    .text(`Document Unique ID: ${docId}`, page.x, footerY + 10, { width: page.w, align: 'center' });
}

function checklistItem(doc, x, y, label, checked) {
  doc.circle(x + 5, y + 5, 4.3).fillAndStroke(checked ? '#DCFCE7' : '#F8FAFC', checked ? '#16A34A' : '#CBD5E1');
  if (checked) {
    doc.strokeColor('#16A34A').lineWidth(1.1)
      .moveTo(x + 2.5, y + 5)
      .lineTo(x + 4.7, y + 7.2)
      .lineTo(x + 8.2, y + 2.7)
      .stroke();
  }
  doc.fillColor('#334155').font('Helvetica-Bold').fontSize(6.9).text(label, x + 15, y + 1, { width: 260 });
}

function headerMeta(doc, x, y, label, value) {
  doc.font('Helvetica-Bold').fontSize(5.6).fillColor('#93C5FD').text(label, x, y, { width: 44 });
  doc.font('Helvetica-Bold').fontSize(6.4).fillColor('#FFFFFF').text(String(value || '').slice(0, 42), x + 48, y, { width: 112, ellipsis: true });
}

function sectionHeader(doc, x, y, width, title, color) {
  doc.roundedRect(x, y, width, 12, 4).fill(color);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.4)
    .text(title.toUpperCase(), x + 8, y + 3.1, { width: width - 16 });
}

function card(doc, x, y, width, height, fill, stroke) {
  doc.roundedRect(x, y, width, height, 6).fillAndStroke(fill, stroke);
}

function labelValue(doc, x, y, width, label, value, options = {}) {
  doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(5.6)
    .text(String(label).toUpperCase(), x, y, { width });
  doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(options.valueSize || 7.4)
    .text(String(value || 'N/A'), x, y + 7.2, { width, height: options.height || 10, ellipsis: true });
}

function signatureCard(doc, x, y, width, height, title, signer, date, dataUrl, typedName) {
  card(doc, x, y, width, height, '#FFFFFF', '#CBD5E1');
  doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(7.4).text(title, x + 10, y + 8, { width: width - 20 });
  doc.roundedRect(x + 10, y + 24, width - 20, 38, 4).fillAndStroke('#F8FAFC', '#E2E8F0');
  const image = dataUrlToBuffer(dataUrl);
  if (image) {
    try {
      doc.image(image, x + 16, y + 28, { fit: [width - 32, 30], align: 'center', valign: 'center' });
    } catch {
      drawTypedSignature(doc, x + 16, y + 35, width - 32, typedName || signer);
    }
  } else {
    drawTypedSignature(doc, x + 16, y + 35, width - 32, typedName || signer);
  }
  doc.moveTo(x + 15, y + 68).lineTo(x + width - 15, y + 68).strokeColor('#CBD5E1').lineWidth(0.6).stroke();
  labelValue(doc, x + 12, y + 72, (width - 30) / 2, 'Signer', signer, { valueSize: 6.8 });
  labelValue(doc, x + width / 2, y + 72, (width - 30) / 2, 'Date', formatDateTime(date), { valueSize: 6.5 });
}

function drawTypedSignature(doc, x, y, width, name) {
  doc.fillColor('#1E3A8A').font('Helvetica-BoldOblique').fontSize(12)
    .text(String(name || 'Signed'), x, y, { width, align: 'center', ellipsis: true });
}

function dataUrlToBuffer(value) {
  if (!value || typeof value !== 'string') return undefined;
  const match = value.match(/^data:image\/(?:png|jpeg);base64,(.+)$/);
  return match ? Buffer.from(match[1], 'base64') : undefined;
}

function consentTerms() {
  return [
    ['About these services', 'Care management and remote monitoring support health between visits, including care coordination, regular check-ins, chronic condition support, care plans, and connected-device monitoring when assigned.'],
    ['Voluntary participation', 'Participation is your choice. You may stop services at any time; monthly services stop at the end of the current month and your other Medicare benefits are not affected.'],
    ['Costs', 'Your health plan may cover these services. Depending on the plan, copay, coinsurance, or deductible may apply.'],
    ['Only one provider', 'Only one provider can be paid for the same service in a period. To your knowledge, you are not receiving the same service from another provider or practice.'],
    ['Health information', 'Your health information is protected under HIPAA and may be used or shared electronically with providers involved in your care as allowed by law.'],
    ['Devices and monitoring', 'If assigned a device, use it as directed, take readings as instructed, and return it when services end or when requested by the care team.'],
    ['Emergency care', 'These services are not emergency services and readings/messages may not be reviewed in real time. For a medical emergency, call 911.'],
    ['Stopping services', 'You may stop by telling the care team. For monthly services, stopping takes effect at the end of the current month.']
  ].map(([title, body]) => ({ title, body }));
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleDateString('en-US');
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleString('en-US');
}

export async function getPdfBuffer(driveFileId) {
  const response = await withPdfStorageError(() => retryTransientGoogleError(() => drive.files.get(
    { fileId: driveFileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  )));
  return Buffer.from(response.data);
}

async function withPdfStorageError(operation) {
  try {
    return await operation();
  } catch (error) {
    const status = Number(error?.status || error?.code || error?.response?.status || 0);
    if ([403, 404].includes(status)) {
      const storageError = new Error('pdf_storage_unavailable');
      storageError.status = 503;
      storageError.expose = true;
      throw storageError;
    }
    throw error;
  }
}

async function retryTransientGoogleError(operation) {
  const delays = [400, 1200, 2400];
  let lastError;

  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const status = Number(error?.status || error?.code || error?.response?.status || 0);
      if (![429, 500, 502, 503, 504].includes(status) || attempt === delays.length) break;
      await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    }
  }

  throw lastError;
}
