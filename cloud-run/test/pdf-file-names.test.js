import test from 'node:test';
import assert from 'node:assert/strict';

process.env.GOOGLE_CLOUD_PROJECT ||= 'test-project';
process.env.GOOGLE_SHEETS_SPREADSHEET_ID ||= 'test-sheet';
process.env.GOOGLE_DRIVE_PDF_FOLDER_ID ||= 'test-folder';
process.env.FRONTEND_ORIGINS ||= 'http://localhost:3000';

const { buildPdfFileName } = await import('../src/pdf.js');

test('PDF file names include patient name, document type, and document code', () => {
  assert.equal(
    buildPdfFileName('CONSENT', { firstName: 'Juana', lastName: 'Carrasco' }, 'doc_abc123'),
    'Juana_Carrasco_Consent_doc_abc123.pdf'
  );
  assert.equal(
    buildPdfFileName('MEDICAL_ORDER', { firstName: 'Robert', lastName: 'Chen' }, 'doc_order_1'),
    'Robert_Chen_Order_doc_order_1.pdf'
  );
  assert.equal(
    buildPdfFileName('DEVICE_DELIVERY', { firstName: 'Ana Maria', lastName: 'Perez-Lopez' }, 'doc_device_2'),
    'Ana_Maria_Perez_Lopez_Device_doc_device_2.pdf'
  );
});
