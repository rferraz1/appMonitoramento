import { Router } from 'express';
import { db } from '../db/database.js';
import { syncChecks, testConnection } from '../services/graphExcelService.js';
import { workbookTemplate } from '../services/excelTemplate.js';
import { syncLocalWorkbook } from '../services/localExcelService.js';

export const excelRouter = Router();

function getSettings() {
  return db.prepare('SELECT * FROM excel_settings WHERE id = 1').get();
}

excelRouter.get('/settings', (_req, res) => {
  const settings = getSettings();
  res.json({ ...settings, enabled: Boolean(settings.enabled), template: workbookTemplate });
});

excelRouter.put('/settings', (req, res) => {
  const { excel_url = '', worksheet_name = '', enabled = false } = req.body;
  db.prepare(`
    INSERT INTO excel_settings (id, excel_url, worksheet_name, enabled, updated_at)
    VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      excel_url = excluded.excel_url,
      worksheet_name = excluded.worksheet_name,
      enabled = excluded.enabled,
      updated_at = CURRENT_TIMESTAMP
  `).run(excel_url, worksheet_name, enabled ? 1 : 0);
  const saved = getSettings();
  res.json({ ...saved, enabled: Boolean(saved.enabled), template: workbookTemplate });
});

excelRouter.post('/test', async (_req, res) => {
  res.json(await testConnection(getSettings()));
});

excelRouter.post('/sync', async (_req, res) => {
  const checks = db.prepare(`
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
  `).all();
  const cameras = db.prepare(`
    SELECT cameras.*,
      vessels.name AS vessel_name
    FROM cameras
    JOIN vessels ON vessels.id = cameras.vessel_id
    ORDER BY COALESCE(cameras.excel_code, cameras.name)
  `).all().map((camera) => ({ ...camera, active: Boolean(camera.active) }));
  const result = await syncChecks(getSettings(), checks, cameras);
  if (result.ok) {
    db.prepare('UPDATE excel_settings SET last_sync_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(result.syncedAt);
  }
  res.json(result);
});

excelRouter.post('/sync-local', async (_req, res) => {
  const checks = db.prepare(`
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
  `).all();
  const cameras = db.prepare(`
    SELECT cameras.*,
      vessels.name AS vessel_name
    FROM cameras
    JOIN vessels ON vessels.id = cameras.vessel_id
    ORDER BY COALESCE(cameras.excel_code, cameras.name)
  `).all().map((camera) => ({ ...camera, active: Boolean(camera.active) }));

  try {
    const result = await syncLocalWorkbook({ checks, cameras });
    res.json(result);
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});
