import {
  CatalogImportHistory,
  ConditionGroupCatalog,
  DiagnosisCatalog,
  User
} from '../types';

export interface CatalogImportRow {
  rowNumber: number;
  groupDisplay: string;
  groupCode: string;
  groupDescription: string;
  icd10Code: string;
  icd10Display: string;
  icd10Description: string;
}

export interface CatalogImportError {
  rowNumber: number;
  messages: string[];
}

export interface CatalogImportPreview {
  filename: string;
  rows: CatalogImportRow[];
  errors: CatalogImportError[];
  totalRows: number;
  totalGroups: number;
  totalDiagnoses: number;
  newGroups: number;
  updatedGroups: number;
  newDiagnoses: number;
  updatedDiagnoses: number;
}

const HEADER_ALIASES = {
  groupDisplay: ['condition group display', 'condition_group_display', 'group display', 'group name'],
  groupCode: ['condition group code', 'condition_group_code', 'group code', 'internal key', 'code'],
  groupDescription: ['group description', 'condition group description', 'group_description'],
  icd10Code: ['icd-10 code', 'icd10 code', 'icd_10_code', 'icd10_code', 'diagnosis code'],
  icd10Display: ['icd-10 display', 'icd10 display', 'diagnosis display', 'diagnosis name'],
  icd10Description: ['icd-10 description', 'icd10 description', 'diagnosis description']
} as const;

const REQUIRED_HEADERS: Array<keyof typeof HEADER_ALIASES> = [
  'groupDisplay',
  'groupCode',
  'icd10Code',
  'icd10Display'
];

const normalizeHeader = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const normalizeCode = (value: unknown) => String(value ?? '').trim().toUpperCase();
const cellText = (value: unknown) => {
  if (value && typeof value === 'object' && 'text' in value) {
    return String((value as { text?: string }).text ?? '').trim();
  }
  return String(value ?? '').trim();
};

const findHeaderKey = (header: string): keyof typeof HEADER_ALIASES | undefined =>
  (Object.keys(HEADER_ALIASES) as Array<keyof typeof HEADER_ALIASES>)
    .find(key => HEADER_ALIASES[key].includes(header as never));

export async function parseConditionCatalogWorkbook(
  file: File,
  existingGroups: ConditionGroupCatalog[],
  existingDiagnoses: DiagnosisCatalog[]
): Promise<CatalogImportPreview> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('The workbook does not contain a worksheet.');

  const headerMap = new Map<keyof typeof HEADER_ALIASES, number>();
  sheet.getRow(1).eachCell((cell, columnNumber) => {
    const key = findHeaderKey(normalizeHeader(cell.value));
    if (key && !headerMap.has(key)) headerMap.set(key, columnNumber);
  });

  const missingHeaders = REQUIRED_HEADERS.filter(key => !headerMap.has(key));
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
  }

  const rows: CatalogImportRow[] = [];
  const errors: CatalogImportError[] = [];

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const worksheetRow = sheet.getRow(rowNumber);
    const read = (key: keyof typeof HEADER_ALIASES) => {
      const column = headerMap.get(key);
      return column ? cellText(worksheetRow.getCell(column).value) : '';
    };

    const row: CatalogImportRow = {
      rowNumber,
      groupDisplay: read('groupDisplay'),
      groupCode: normalizeCode(read('groupCode')),
      groupDescription: read('groupDescription'),
      icd10Code: normalizeCode(read('icd10Code')),
      icd10Display: read('icd10Display'),
      icd10Description: read('icd10Description')
    };

    if (!Object.values(row).some(value => typeof value === 'string' && value.length > 0)) continue;

    const rowErrors: string[] = [];
    if (!row.groupDisplay) rowErrors.push('Condition Group Display is required.');
    if (!row.groupCode) rowErrors.push('Condition Group Code is required.');
    if (!row.icd10Code) rowErrors.push('ICD-10 Code is required.');
    if (!row.icd10Display) rowErrors.push('ICD-10 Display is required.');
    if (row.icd10Code && !/^[A-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/.test(row.icd10Code)) {
      rowErrors.push('ICD-10 Code format is invalid.');
    }

    if (rowErrors.length > 0) errors.push({ rowNumber, messages: rowErrors });
    else rows.push(row);
  }

  const groupCodes = new Set(rows.map(row => row.groupCode));
  const diagnosisKeys = new Set(rows.map(row => `${row.groupCode}|${row.icd10Code}`));
  const existingGroupCodes = new Set(existingGroups.map(group => group.code.toUpperCase()));
  const existingDiagnosisKeys = new Set(
    existingDiagnoses.map(diagnosis => `${diagnosis.condition_group_code.toUpperCase()}|${diagnosis.icd10_code.toUpperCase()}`)
  );

  return {
    filename: file.name,
    rows,
    errors,
    totalRows: Math.max(0, sheet.rowCount - 1),
    totalGroups: groupCodes.size,
    totalDiagnoses: diagnosisKeys.size,
    newGroups: [...groupCodes].filter(code => !existingGroupCodes.has(code)).length,
    updatedGroups: [...groupCodes].filter(code => existingGroupCodes.has(code)).length,
    newDiagnoses: [...diagnosisKeys].filter(key => !existingDiagnosisKeys.has(key)).length,
    updatedDiagnoses: [...diagnosisKeys].filter(key => existingDiagnosisKeys.has(key)).length
  };
}

export function applyConditionCatalogImport(
  preview: CatalogImportPreview,
  existingGroups: ConditionGroupCatalog[],
  existingDiagnoses: DiagnosisCatalog[],
  user: User,
  deactivateMissing: boolean
): {
  groups: ConditionGroupCatalog[];
  diagnoses: DiagnosisCatalog[];
  history: CatalogImportHistory;
} {
  const now = new Date().toISOString();
  const groups = existingGroups.map(group => ({ ...group }));
  const diagnoses = existingDiagnoses.map(diagnosis => ({ ...diagnosis }));
  const importedGroupCodes = new Set<string>();
  const importedDiagnosisKeys = new Set<string>();

  for (const row of preview.rows) {
    importedGroupCodes.add(row.groupCode);
    let group = groups.find(item => item.code.toUpperCase() === row.groupCode);
    if (!group) {
      group = {
        id: `cg_${row.groupCode.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        display: row.groupDisplay,
        code: row.groupCode,
        description: row.groupDescription,
        icd10_count: 0,
        is_active: true,
        imported_at: now,
        imported_by: user.name
      };
      groups.push(group);
    } else {
      Object.assign(group, {
        display: row.groupDisplay,
        description: row.groupDescription,
        is_active: true,
        imported_at: now,
        imported_by: user.name
      });
    }

    const diagnosisKey = `${row.groupCode}|${row.icd10Code}`;
    importedDiagnosisKeys.add(diagnosisKey);
    let diagnosis = diagnoses.find(item =>
      item.condition_group_code.toUpperCase() === row.groupCode
      && item.icd10_code.toUpperCase() === row.icd10Code
    );
    if (!diagnosis) {
      diagnosis = {
        id: `dx_${row.groupCode.toLowerCase()}_${row.icd10Code.toLowerCase().replace('.', '_')}`,
        condition_group_id: group.id,
        condition_group_code: group.code,
        icd10_code: row.icd10Code,
        icd10_display: row.icd10Display,
        icd10_description: row.icd10Description || row.icd10Display,
        is_active: true,
        imported_at: now,
        imported_by: user.name
      };
      diagnoses.push(diagnosis);
    } else {
      Object.assign(diagnosis, {
        condition_group_id: group.id,
        condition_group_code: group.code,
        icd10_display: row.icd10Display,
        icd10_description: row.icd10Description || row.icd10Display,
        is_active: true,
        imported_at: now,
        imported_by: user.name
      });
    }
  }

  if (deactivateMissing) {
    groups.forEach(group => {
      if (!importedGroupCodes.has(group.code.toUpperCase())) group.is_active = false;
    });
    diagnoses.forEach(diagnosis => {
      const key = `${diagnosis.condition_group_code.toUpperCase()}|${diagnosis.icd10_code.toUpperCase()}`;
      if (!importedDiagnosisKeys.has(key)) diagnosis.is_active = false;
    });
  }

  groups.forEach(group => {
    group.icd10_count = diagnoses.filter(diagnosis =>
      diagnosis.condition_group_id === group.id && diagnosis.is_active
    ).length;
  });

  return {
    groups,
    diagnoses,
    history: {
      id: `catalog_import_${Date.now()}`,
      filename: preview.filename,
      imported_by: user.name,
      imported_at: now,
      total_rows: preview.totalRows,
      successful_rows: preview.rows.length,
      failed_rows: preview.errors.length,
      import_status: preview.errors.length > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED',
      deactivate_missing: deactivateMissing
    }
  };
}
