import { Router } from 'express';
import ExcelJS from 'exceljs';
import { db } from '../db/database.js';

export const reportsRouter = Router();

function rangeFor(type, value) {
  if (type === 'daily') return { start: value, end: value };
  if (type === 'annual') return { start: `${value}-01-01`, end: `${value}-12-31` };
  return { start: `${value}-01`, end: `${value}-31` };
}

function reportRows(start, end) {
  return db.prepare(`
    SELECT checks.date AS Data,
      checks.time_slot AS Horario,
      vessels.name AS Barco,
      cameras.name AS Camera,
      cameras.location AS Localizacao,
      checks.status AS Status,
      checks.observation AS Observacao,
      checks.behavior_note AS Comportamento,
      users.name AS Usuario,
      checks.updated_at AS AtualizadoEm
    FROM checks
    JOIN vessels ON vessels.id = checks.vessel_id
    JOIN cameras ON cameras.id = checks.camera_id
    JOIN users ON users.id = checks.user_id
    WHERE checks.date BETWEEN ? AND ?
    ORDER BY checks.date, checks.time_slot, vessels.name, cameras.name
  `).all(start, end);
}

function toCsv(rows) {
  const headers = Object.keys(rows[0] || {
    Data: '', Horario: '', Barco: '', Camera: '', Localizacao: '', Status: '', Observacao: '', Comportamento: '', Usuario: '', AtualizadoEm: ''
  });
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [headers.map(escape).join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n');
}

reportsRouter.get('/', async (req, res) => {
  const { type = 'daily', value = new Date().toISOString().slice(0, 10), format = 'csv' } = req.query;
  const { start, end } = rangeFor(type, value);
  const rows = reportRows(start, end);
  const filename = `relatorio-${type}-${value}`;

  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Relatorio');
    worksheet.columns = Object.keys(rows[0] || {
      Data: '', Horario: '', Barco: '', Camera: '', Localizacao: '', Status: '', Observacao: '', Comportamento: '', Usuario: '', AtualizadoEm: ''
    }).map((key) => ({ header: key, key, width: 20 }));
    rows.forEach((row) => worksheet.addRow(row));
    worksheet.getRow(1).font = { bold: true };
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  }

  const csv = toCsv(rows);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send(csv);
});
