# Apps Script Google Sheets

Use este codigo no Apps Script da planilha configurada no app. Ele recebe uma data por webhook, remove as linhas existentes dessa mesma data em `Base_App` e na aba mensal `App_*`, e grava novamente todas as linhas do dia em lote.

```javascript
const BASE_SHEET_NAME = 'Base_App';
const HEADERS = [
  'Data',
  'ID',
  'Nome da Camera',
  'Grupo',
  'Horario',
  'Status',
  'Observacao',
  'Comportamento',
  'Responsavel',
  'AtualizadoEm'
];

const MONTH_SHEETS = [
  'App_Janeiro',
  'App_Fevereiro',
  'App_Marco',
  'App_Abril',
  'App_Maio',
  'App_Junho',
  'App_Julho',
  'App_Agosto',
  'App_Setembro',
  'App_Outubro',
  'App_Novembro',
  'App_Dezembro'
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const payload = parsePayload_(e);
    const checks = Array.isArray(payload.checks) ? payload.checks : [];

    if (!checks.length) {
      return json_({ ok: true, message: 'Conexao com Google Sheets confirmada.', registros: 0 });
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const date = parseDate_(payload.date);
    const dateKey = formatDateKey_(date);
    const rows = checks.map((check) => buildRow_(date, check));

    replaceDateRows_(getOrCreateSheet_(spreadsheet, BASE_SHEET_NAME), dateKey, rows);
    replaceDateRows_(getOrCreateSheet_(spreadsheet, monthSheetName_(date)), dateKey, rows);

    return json_({
      ok: true,
      message: 'Planilha Google atualizada.',
      registros: rows.length
    });
  } catch (error) {
    return json_({
      ok: false,
      message: error.message || String(error)
    });
  } finally {
    lock.releaseLock();
  }
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  return JSON.parse(e.postData.contents);
}

function buildRow_(date, check) {
  return [
    date,
    check.cameraCode || '',
    check.cameraName || '',
    check.vesselName || '',
    check.timeSlot || '',
    check.status || '',
    check.observation || '',
    check.behaviorNote || '',
    check.userName || 'Sistema',
    new Date()
  ];
}

function replaceDateRows_(sheet, dateKey, rows) {
  ensureHeader_(sheet);
  deleteRowsForDate_(sheet, dateKey);

  if (!rows.length) return;

  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, HEADERS.length).setValues(rows);
  sheet.getRange(startRow, 1, rows.length, 1).setNumberFormat('dd/MM/yyyy');
  sheet.getRange(startRow, 10, rows.length, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
}

function deleteRowsForDate_(sheet, dateKey) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const rowsToDelete = [];

  values.forEach((row, index) => {
    if (dateKey_(row[0]) === dateKey) {
      rowsToDelete.push(index + 2);
    }
  });

  deleteContiguousRows_(sheet, rowsToDelete);
}

function deleteContiguousRows_(sheet, rows) {
  if (!rows.length) return;

  rows.sort((a, b) => b - a);
  let blockEnd = rows[0];
  let blockStart = rows[0];

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (row === blockStart - 1) {
      blockStart = row;
      continue;
    }

    sheet.deleteRows(blockStart, blockEnd - blockStart + 1);
    blockStart = row;
    blockEnd = row;
  }

  sheet.deleteRows(blockStart, blockEnd - blockStart + 1);
}

function ensureHeader_(sheet) {
  const current = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const needsHeader = HEADERS.some((header, index) => current[index] !== header);
  if (!needsHeader) return;

  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#17324d')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
}

function getOrCreateSheet_(spreadsheet, name) {
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function monthSheetName_(date) {
  return MONTH_SHEETS[date.getMonth()];
}

function parseDate_(value) {
  if (value instanceof Date) return value;

  const text = String(value || '').trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));

  throw new Error(`Data invalida: ${value}`);
}

function dateKey_(value) {
  if (value instanceof Date) return formatDateKey_(value);

  const text = String(value || '').trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${String(br[2]).padStart(2, '0')}-${String(br[1]).padStart(2, '0')}`;

  return text;
}

function formatDateKey_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function json_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
```
