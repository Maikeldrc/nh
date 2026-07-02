const required = name => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required configuration: ${name}`);
  return value;
};

export const config = Object.freeze({
  port: Number(process.env.PORT || 8080),
  projectId: required('GOOGLE_CLOUD_PROJECT'),
  spreadsheetId: required('GOOGLE_SHEETS_SPREADSHEET_ID'),
  driveFolderId: required('GOOGLE_DRIVE_PDF_FOLDER_ID'),
  frontendOrigins: required('FRONTEND_ORIGINS')
    .split(',')
    .map(origin => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean)
});
