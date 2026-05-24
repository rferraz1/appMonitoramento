import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapStatusToWorkbook, monthSheets, sheetNameForDate, workbookTemplate } from './excelTemplate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultLocalWorkbook = '/Users/rodolfoferraz/Downloads/PLANILHAFINAL.xlsx';
const fallbackWorkbook = path.resolve(__dirname, '../../templates/PLANILHAFINAL.xlsx');

export function localWorkbookPath() {
  const configured = process.env.EXCEL_LOCAL_FILE || defaultLocalWorkbook;
  if (fs.existsSync(configured)) return configured;
  return fallbackWorkbook;
}

function setIfCellExists(worksheet, address, value) {
  const cell = worksheet.getCell(address);
  cell.value = value ?? '';
}

function isoCellDate(cell) {
  if (cell.value instanceof Date) return cell.value.toISOString().slice(0, 10);
  const text = cell.text;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return '';
}

function findRowByDateAndCode(worksheet, date, code) {
  for (let row = workbookTemplate.dataStartRow; row <= worksheet.rowCount; row += 1) {
    if (worksheet.getCell(`C${row}`).text === code && isoCellDate(worksheet.getCell(`A${row}`)) === date) return row;
  }
  return null;
}

function nextAppendRow(worksheet) {
  return Math.max(worksheet.rowCount + 1, workbookTemplate.dataStartRow);
}

function updateCameraNames(workbook, cameras) {
  const worksheets = [workbook.getWorksheet(workbookTemplate.configSheet), ...monthSheets.map((name) => workbook.getWorksheet(name))].filter(Boolean);

  for (const camera of cameras) {
    const code = camera.excel_code;
    if (!code) continue;

    const config = workbook.getWorksheet(workbookTemplate.configSheet);
    if (config) {
      let found = false;
      for (let row = workbookTemplate.dataStartRow + 1; row <= config.rowCount; row += 1) {
        if (config.getCell(`A${row}`).text === code) {
          config.getCell(`B${row}`).value = camera.name;
          config.getCell(`C${row}`).value = camera.vessel_name || camera.location || '';
          config.getCell(`D${row}`).value = camera.active ? 'Ativa' : 'Futura';
          found = true;
        }
      }
      if (!found) {
        const row = config.rowCount + 1;
        config.getCell(`A${row}`).value = code;
        config.getCell(`B${row}`).value = camera.name;
        config.getCell(`C${row}`).value = camera.vessel_name || camera.location || '';
        config.getCell(`D${row}`).value = camera.active ? 'Ativa' : 'Futura';
      }
    }

    for (const worksheet of worksheets.filter((ws) => monthSheets.includes(ws.name))) {
      for (let row = workbookTemplate.dataStartRow; row <= worksheet.rowCount; row += 1) {
        if (worksheet.getCell(`C${row}`).text === code) {
          worksheet.getCell(`D${row}`).value = camera.name;
          worksheet.getCell(`E${row}`).value = camera.vessel_name || camera.location || '';
        }
      }
    }
  }
}

function updateDailyChecks(workbook, checks) {
  const grouped = new Map();

  for (const check of checks) {
    const code = check.excel_code;
    const sheet = sheetNameForDate(check.date);
    if (!code) continue;

    const key = `${sheet}:${check.date}:${code}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        sheet,
        code,
        date: check.date,
        cameraName: check.camera_name,
        vesselLocation: check.vessel_name,
        responsible: check.user_name || 'Sistema',
        technicalEvents: [],
        behaviors: []
      });
    }

    const item = grouped.get(key);
    const column = workbookTemplate.columns[check.time_slot];
    if (column) item[column] = mapStatusToWorkbook(check.status);
    if (check.observation) item.technicalEvents.push(`[${check.time_slot}] ${check.observation}`);
    if (check.behavior_note) item.behaviors.push(`[${check.time_slot}] ${check.behavior_note}`);
    item.responsible = check.user_name || item.responsible;
  }

  for (const item of grouped.values()) {
    const worksheet = workbook.getWorksheet(item.sheet);
    if (!worksheet) continue;
    const row = findRowByDateAndCode(worksheet, item.date, item.code) || nextAppendRow(worksheet);

    setIfCellExists(worksheet, `${workbookTemplate.columns.date}${row}`, new Date(`${item.date}T03:00:00.000Z`));
    setIfCellExists(worksheet, `${workbookTemplate.columns.cameraCode}${row}`, item.code);
    setIfCellExists(worksheet, `${workbookTemplate.columns.cameraName}${row}`, item.cameraName);
    setIfCellExists(worksheet, `${workbookTemplate.columns.vesselLocation}${row}`, item.vesselLocation || '');

    for (const slot of ['10:00', '13:00', '16:00']) {
      const column = workbookTemplate.columns[slot];
      if (item[column]) setIfCellExists(worksheet, `${column}${row}`, item[column]);
    }

    setIfCellExists(worksheet, `${workbookTemplate.columns.technicalEvent}${row}`, item.technicalEvents.join('\n'));
    setIfCellExists(worksheet, `${workbookTemplate.columns.behavior}${row}`, item.behaviors.join('\n'));
    setIfCellExists(worksheet, `${workbookTemplate.columns.responsible}${row}`, item.responsible);
  }

  return grouped.size;
}

export async function syncLocalWorkbook({ checks, cameras }) {
  const filePath = localWorkbookPath();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  updateCameraNames(workbook, cameras);
  const rowsUpdated = updateDailyChecks(workbook, checks);

  await workbook.xlsx.writeFile(filePath);

  return {
    ok: true,
    filePath,
    rowsUpdated,
    message: `Planilha local atualizada: ${rowsUpdated} linhas em ${filePath}`
  };
}
