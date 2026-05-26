import { Router } from 'express';
import { all, get, isPostgres, run } from '../db/database.js';
import { syncGoogleSheets } from '../services/googleSheetsService.js';
import { syncLocalWorkbook } from '../services/localExcelService.js';

export const checksRouter = Router();
const slots = ['10:00', '13:00', '16:00'];

async function checksForDate(date) {
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
    WHERE checks.date = ?
    ORDER BY checks.date, checks.time_slot, COALESCE(cameras.excel_code, cameras.name)
  `, [date]);
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

checksRouter.get('/day/:date', async (req, res) => {
  const { vessel_id } = req.query;
  const cameraParams = [isPostgres ? true : 1, isPostgres ? true : 1];
  let cameraSql = `
    SELECT cameras.*, vessels.name AS vessel_name, vessels.active AS vessel_active
    FROM cameras
    JOIN vessels ON vessels.id = cameras.vessel_id
    WHERE cameras.active = ? AND vessels.active = ?
  `;
  if (vessel_id) {
    cameraSql += ' AND vessels.id = ?';
    cameraParams.push(vessel_id);
  }
  cameraSql += ' ORDER BY vessels.id, COALESCE(cameras.excel_code, cameras.name), cameras.name';

  const cameras = await all(cameraSql, cameraParams);
  const checks = await all(`
    SELECT checks.*, users.name AS user_name
    FROM checks
    JOIN users ON users.id = checks.user_id
    WHERE date = ?
  `, [req.params.date]);

  const byCamera = cameras.reduce((acc, camera) => {
    const key = `${camera.vessel_id}:${camera.vessel_name}`;
    if (!acc[key]) acc[key] = { id: camera.vessel_id, name: camera.vessel_name, cameras: [] };
    acc[key].cameras.push({
      id: camera.id,
      excel_code: camera.excel_code,
      name: camera.name,
      location: camera.location,
      checks: slots.map((slot) => checks.find((c) => c.camera_id === camera.id && c.time_slot === slot) || {
        date: req.params.date,
        time_slot: slot,
        vessel_id: camera.vessel_id,
        camera_id: camera.id,
        status: '',
        observation: '',
        behavior_note: ''
      })
    });
    return acc;
  }, {});

  const expected = cameras.length * slots.length;
  const completed = checks.filter((check) => check.status && cameras.some((camera) => camera.id === check.camera_id)).length;

  res.json({
    date: req.params.date,
    timeSlots: slots,
    vessels: Object.values(byCamera),
    validation: {
      expected,
      completed,
      missing: Math.max(expected - completed, 0),
      complete: expected > 0 && completed >= expected
    }
  });
});

checksRouter.post('/day/:date', async (req, res) => {
  const { checks = [] } = req.body;
  const allowed = new Set(['Online', 'Offline', 'Manutenção', 'Sem acesso']);
  const invalid = checks.find((check) => !allowed.has(check.status));
  if (invalid) return res.status(400).json({ message: 'Todos os registros salvos precisam ter status válido.' });

  const submittedChecks = [...new Map(
    checks.filter((item) => item.status).map((check) => [`${check.camera_id}:${check.time_slot}`, check])
  ).values()];

  if (!submittedChecks.length) {
    return res.json({ message: 'Não há alterações para salvar.' });
  }

  for (let index = 0; index < submittedChecks.length; index += 100) {
    const batch = submittedChecks.slice(index, index + 100);
    const values = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').join(', ');
    const params = batch.flatMap((check) => [
      req.params.date,
      check.time_slot,
      check.vessel_id,
      check.camera_id,
      check.status,
      check.observation || '',
      check.behavior_note || '',
      req.user.id
    ]);

    await run(`
      INSERT INTO checks (date, time_slot, vessel_id, camera_id, status, observation, behavior_note, user_id, updated_at)
      VALUES ${values}
      ON CONFLICT(date, time_slot, camera_id) DO UPDATE SET
        status = EXCLUDED.status,
        observation = EXCLUDED.observation,
        behavior_note = EXCLUDED.behavior_note,
        user_id = EXCLUDED.user_id,
        updated_at = CURRENT_TIMESTAMP
    `, params);
  }

  const savedChecksForDate = await checksForDate(req.params.date);
  const submittedKeys = new Set(submittedChecks.map((check) => `${check.camera_id}:${check.time_slot}`));
  const savedChecks = savedChecksForDate.filter((check) => submittedKeys.has(`${check.camera_id}:${check.time_slot}`));
  const savedByKey = new Map(savedChecks.map((check) => [`${check.camera_id}:${check.time_slot}`, check]));
  const observations = submittedChecks
    .filter((check) => check.observation || check.behavior_note)
    .map((check) => ({ check, saved: savedByKey.get(`${check.camera_id}:${check.time_slot}`) }))
    .filter(({ saved }) => saved);

  for (let index = 0; index < observations.length; index += 100) {
    const batch = observations.slice(index, index + 100);
    const values = batch.map(() => '(?, ?, ?, ?)').join(', ');
    const params = batch.flatMap(({ check, saved }) => [
      saved.id,
      check.observation || '',
      check.behavior_note || '',
      req.user.id
    ]);

      await run(`
        INSERT INTO observations (check_id, note, behavior_note, user_id)
        VALUES ${values}
      `, params);
  }

  const settings = await get('SELECT enabled, google_webhook_url FROM excel_settings WHERE id = 1');
  const googleSync = await syncGoogleSheets(settings, savedChecks, { timeoutMs: 15000 });

  if (googleSync.ok) {
    await run('UPDATE excel_settings SET last_sync_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1', [googleSync.syncedAt]);
    return res.json({ message: 'Salvo com sucesso. Planilha Google atualizada.', googleSync });
  }

  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return res.json({
      message: `Salvo no app, mas a Planilha Google não foi atualizada: ${googleSync.message}`,
      googleSync
    });
  }

  try {
    const localSync = await syncLocalWorkbook({
      checks: savedChecks,
      cameras: await camerasForSync()
    });
    res.json({ message: 'Salvo com sucesso. Planilha local atualizada.', localSync });
  } catch (error) {
    res.json({
      message: 'Salvo com sucesso no app, mas não foi possível atualizar a planilha local.',
      localSync: { ok: false, message: error.message }
    });
  }
});
