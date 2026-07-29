# Apps Script Google Sheets

Use este codigo no Apps Script da planilha configurada no app. Ele recebe o webhook do backend e atualiza `Base_App` e a aba mensal `App_*` em lote.

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
  const payload = parsePayload_(e);
  const checks = Array.isArray(payload.checks) ? payload.checks : [];

  if (!checks.length) {
    return json_({ ok: true, message: 'Conexao com Google Sheets confirmada.', registros: 0 });
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const date = parseDate_(payload.date);
  const rows = checks.map((check) => buildRow_(date, check));

  upsertRows_(getOrCreateSheet_(spreadsheet, BASE_SHEET_NAME), rows);
  upsertRows_(getOrCreateSheet_(spreadsheet, monthSheetName_(date)), rows);

  return json_({
    ok: true,
    message: 'Planilha Google atualizada.',
    registros: rows.length
  });
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

function upsertRows_(sheet, incomingRows) {
  ensureHeader_(sheet);

  const lastRow = sheet.getLastRow();
  const existingRows = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues()
    : [];

  const incomingKeys = new Set(incomingRows.map(rowKey_));
  const keptRows = existingRows.filter((row) => !incomingKeys.has(rowKey_(row)));
  const nextRows = keptRows.concat(incomingRows).sort(compareRows_);

  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, HEADERS.length).clearContent();
  }

  if (nextRows.length) {
    sheet.getRange(2, 1, nextRows.length, HEADERS.length).setValues(nextRows);
    sheet.getRange(2, 1, nextRows.length, 1).setNumberFormat('dd/MM/yyyy');
    sheet.getRange(2, 10, nextRows.length, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  }

  sheet.autoResizeColumns(1, HEADERS.length);
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

function rowKey_(row) {
  return [dateKey_(row[0]), row[1], row[4]].join('|');
}

function dateKey_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  const text = String(value || '').trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${String(br[2]).padStart(2, '0')}-${String(br[1]).padStart(2, '0')}`;

  return text;
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

function compareRows_(a, b) {
  return rowKey_(a).localeCompare(rowKey_(b));
}

function json_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
```
