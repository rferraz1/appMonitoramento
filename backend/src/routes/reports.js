import { Router } from 'express';
import ExcelJS from 'exceljs';
import { all } from '../db/database.js';

export const reportsRouter = Router();

function rangeFor(type, value) {
  if (type === 'daily') return { start: value, end: value };
  if (type === 'annual') return { start: `${value}-01-01`, end: `${value}-12-31` };
  return { start: `${value}-01`, end: `${value}-31` };
}

async function reportRows(start, end) {
  return all(`
    SELECT checks.date AS "Data",
      checks.time_slot AS "Horario",
      vessels.name AS "Grupo",
      cameras.name AS "Camera",
      cameras.location AS "Localizacao",
      checks.status AS "Status",
      checks.observation AS "Observacao",
      checks.behavior_note AS "Comportamento",
      users.name AS "Usuario",
      checks.updated_at AS "AtualizadoEm"
    FROM checks
    JOIN vessels ON vessels.id = checks.vessel_id
    JOIN cameras ON cameras.id = checks.camera_id
    JOIN users ON users.id = checks.user_id
    WHERE checks.date BETWEEN ? AND ?
    ORDER BY checks.date, checks.time_slot, vessels.name, cameras.name
  `, [start, end]);
}

function summaryFor(rows, start, end) {
  const count = (status) => rows.filter((row) => row.Status === status).length;
  const online = count('Online');
  return {
    periodo: start === end ? start : `${start} a ${end}`,
    total: rows.length,
    online,
    offline: count('Offline'),
    maintenance: count('Manutenção'),
    noAccess: count('Sem acesso'),
    availability: rows.length ? Math.round((online / rows.length) * 100) : 0
  };
}

function toCsv(rows) {
  const headers = Object.keys(rows[0] || {
    Data: '', Horario: '', Grupo: '', Camera: '', Localizacao: '', Status: '', Observacao: '', Comportamento: '', Usuario: '', AtualizadoEm: ''
  });
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [headers.map(escape).join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n');
}

reportsRouter.get('/', async (req, res) => {
  const { type = 'daily', value = new Date().toISOString().slice(0, 10), format = 'csv' } = req.query;
  const { start, end } = rangeFor(type, value);
  const rows = await reportRows(start, end);
  const filename = `relatorio-${type}-${value}`;

  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Baru Offshore';

    const summary = summaryFor(rows, start, end);
    const overview = workbook.addWorksheet('Resumo Executivo', { views: [{ showGridLines: false }] });
    overview.mergeCells('A1:F1');
    overview.getCell('A1').value = 'BARU OFFSHORE - MONITORAMENTO DE CAMERAS';
    overview.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 16 };
    overview.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF102A43' } };
    overview.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    overview.getRow(1).height = 34;
    overview.mergeCells('A2:F2');
    overview.getCell('A2').value = `Relatorio Executivo | Periodo: ${summary.periodo}`;
    overview.getCell('A2').font = { italic: true, color: { argb: 'FF526276' } };

    const metrics = [
      ['Total de verificacoes', summary.total],
      ['Online', summary.online],
      ['Offline', summary.offline],
      ['Manutencao', summary.maintenance],
      ['Sem acesso', summary.noAccess],
      ['Disponibilidade', `${summary.availability}%`]
    ];
    overview.getRow(4).values = metrics.map(([label]) => label);
    overview.getRow(5).values = metrics.map(([, value]) => value);
    ['A', 'B', 'C', 'D', 'E', 'F'].forEach((column, index) => {
      overview.getColumn(column).width = 23;
      overview.getCell(`${column}4`).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      overview.getCell(`${column}4`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF102A43' } };
      overview.getCell(`${column}5`).font = { bold: true, size: 18, color: { argb: index === 1 ? 'FF166534' : index === 2 ? 'FF991B1B' : 'FF172033' } };
      overview.getCell(`${column}5`).alignment = { horizontal: 'center', vertical: 'middle' };
      overview.getCell(`${column}4`).alignment = { horizontal: 'center', vertical: 'middle' };
    });
    overview.getRow(5).height = 36;

    const worksheet = workbook.addWorksheet('Registros');
    worksheet.columns = Object.keys(rows[0] || {
      Data: '', Horario: '', Grupo: '', Camera: '', Localizacao: '', Status: '', Observacao: '', Comportamento: '', Usuario: '', AtualizadoEm: ''
    }).map((key) => ({ header: key, key, width: ['Camera', 'Grupo', 'Observacao', 'Comportamento'].includes(key) ? 28 : 18 }));
    rows.forEach((row) => worksheet.addRow(row));
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    worksheet.autoFilter = { from: 'A1', to: 'J1' };
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF102A43' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    worksheet.getRow(1).height = 28;
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.alignment = { vertical: 'middle', wrapText: true };
      const statusCell = row.getCell('Status');
      if (statusCell.value === 'Online') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
        statusCell.font = { bold: true, color: { argb: 'FF166534' } };
      }
      if (statusCell.value === 'Offline') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        statusCell.font = { bold: true, color: { argb: 'FF991B1B' } };
      }
    });
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  }

  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send(toCsv(rows));
});
