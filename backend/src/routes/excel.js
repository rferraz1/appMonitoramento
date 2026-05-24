import { Router } from 'express';
import { all, get, isPostgres, run } from '../db/database.js';
import { syncChecks, testConnection } from '../services/graphExcelService.js';
import { workbookTemplate } from '../services/excelTemplate.js';
import { localWorkbookPath, syncLocalWorkbook } from '../services/localExcelService.js';

export const excelRouter = Router();

async function getSettings() {
  return get('SELECT * FROM excel_settings WHERE id = 1');
}

function mapSettings(settings) {
  return { ...settings, enabled: Boolean(settings.enabled), template: workbookTemplate };
}

async function checksForSync() {
  return all(`
    SELECT checks.*,
      cameras.excel_code,
      cameras.name AS camera_name,
      vessels.name AS vessel_name,
      users.name AS user_name
    FROM checks
    JOIN cameras ON cameras.id = checks.camera_id
    JOIN vessels ON vessels.id = checks.vessel_id
    JOIN users ON users.id = checks.user_id
    ORDER BY checks.date DESC, checks.time_slot DESC
  `);
}

async function camerasForSync() {
  return (await all(`
    SELECT cameras.*,
      vessels.name AS vessel_name
    FROM cameras
    JOIN vessels ON vessels.id = cameras.vessel_id
    ORDER BY vessels.id, COALESCE(cameras.excel_code, cameras.name)
  `)).map((camera) => ({ ...camera, active: Boolean(camera.active) }));
}

excelRouter.get('/settings', async (_req, res) => {
  res.json(mapSettings(await getSettings()));
});

excelRouter.put('/settings', async (req, res) => {
  const { excel_url = '', worksheet_name = '', enabled = false } = req.body;
  await run(`
    INSERT INTO excel_settings (id, excel_url, worksheet_name, enabled, updated_at)
    VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      excel_url = EXCLUDED.excel_url,
      worksheet_name = EXCLUDED.worksheet_name,
      enabled = EXCLUDED.enabled,
      updated_at = CURRENT_TIMESTAMP
  `, [excel_url, worksheet_name, isPostgres ? Boolean(enabled) : enabled ? 1 : 0]);
  res.json(mapSettings(await getSettings()));
});

excelRouter.post('/test', async (_req, res) => {
  res.json(await testConnection(await getSettings()));
});

excelRouter.post('/sync', async (_req, res) => {
  const result = await syncChecks(await getSettings(), await checksForSync(), await camerasForSync());
  if (result.ok) {
    await run('UPDATE excel_settings SET last_sync_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1', [result.syncedAt]);
  }
  res.json(result);
});

excelRouter.post('/sync-local', async (_req, res) => {
  try {
    const result = await syncLocalWorkbook({ checks: await checksForSync(), cameras: await camerasForSync() });
    res.json(result);
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

excelRouter.get('/local-workbook', (_req, res) => {
  const filePath = localWorkbookPath();
  res.download(filePath, 'PLANILHAFINAL.xlsx');
});
