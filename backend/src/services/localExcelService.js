import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapStatusToWorkbook, monthSheets, sheetNameForDate, workbookTemplate } from './excelTemplate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultLocalWorkbook = '/Users/rodolfoferraz/Downloads/PLANILHAFINAL.xlsx';
const fallbackWorkbook = path.resolve(__dirname, '../../templates/PLANILHAFINAL.xlsx');
const cameraSlotsPerDay = 23;

function localWorkbookPath() {
  const configured = process.env.EXCEL_LOCAL_FILE || defaultLocalWorkbook;
  if (fs.existsSync(configured)) return configured;
  return fallbackWorkbook;
}

function cameraNumber(code) {
  const match = String(code || '').match(/CAM\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function rowFor(date, code) {
  const day = Number(date.slice(8, 10));
  const number = cameraNumber(code);
  if (!day || !number) return null;
  return workbookTemplate.dataStartRow + (day - 1) * cameraSlotsPerDay + (number - 1);
}

function setIfCellExists(worksheet, address, value) {
  const cell = worksheet.getCell(address);
  cell.value = value ?? '';
}

function updateCameraNames(workbook, cameras) {
  const worksheets = [workbook.getWorksheet(workbookTemplate.configSheet), ...monthSheets.map((name) => workbook.getWorksheet(name))].filter(Boolean);

  for (const camera of cameras) {
    const code = camera.excel_code;
    if (!code) continue;

    const config = workbook.getWorksheet(workbookTemplate.configSheet);
    if (config) {
      for (let row = workbookTemplate.dataStartRow + 1; row <= config.rowCount; row += 1) {
        if (config.getCell(`A${row}`).text === code) {
          config.getCell(`B${row}`).value = camera.name;
          config.getCell(`C${row}`).value = camera.vessel_name || camera.location || '';
          config.getCell(`D${row}`).value = camera.active ? 'Ativa' : 'Futura';
        }
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
    const row = rowFor(check.date, code);
    const sheet = sheetNameForDate(check.date);
    if (!row) continue;

    const key = `${sheet}:${row}:${code}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        sheet,
        row,
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

    setIfCellExists(worksheet, `${workbookTemplate.columns.date}${item.row}`, new Date(`${item.date}T03:00:00.000Z`));
    setIfCellExists(worksheet, `${workbookTemplate.columns.cameraCode}${item.row}`, item.code);
    setIfCellExists(worksheet, `${workbookTemplate.columns.cameraName}${item.row}`, item.cameraName);
    setIfCellExists(worksheet, `${workbookTemplate.columns.vesselLocation}${item.row}`, item.vesselLocation || '');

    for (const slot of ['10:00', '13:00', '16:00']) {
      const column = workbookTemplate.columns[slot];
      if (item[column]) setIfCellExists(worksheet, `${column}${item.row}`, item[column]);
    }

    setIfCellExists(worksheet, `${workbookTemplate.columns.technicalEvent}${item.row}`, item.technicalEvents.join('\n'));
    setIfCellExists(worksheet, `${workbookTemplate.columns.behavior}${item.row}`, item.behaviors.join('\n'));
    setIfCellExists(worksheet, `${workbookTemplate.columns.responsible}${item.row}`, item.responsible);
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
