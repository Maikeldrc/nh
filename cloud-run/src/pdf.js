import crypto from 'node:crypto';
import PDFDocument from 'pdfkit';
import { google } from 'googleapis';
import { config } from './config.js';

const drive = google.drive({ version: 'v3', auth: new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/drive.file']
}) });

function renderPdf(type, patient, source) {
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
  const response = await drive.files.create({
    fields: 'id',
    requestBody: {
      name: `${id}.pdf`,
      parents: [config.driveFolderId],
      mimeType: 'application/pdf',
      appProperties: {
        patient_id: patient.id,
        document_type: type
      }
    },
    media: { mimeType: 'application/pdf', body: buffer }
  });
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

export async function getPdfBuffer(driveFileId) {
  const response = await drive.files.get(
    { fileId: driveFileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(response.data);
}
