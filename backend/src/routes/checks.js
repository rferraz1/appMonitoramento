import { Router } from 'express';
import { all, get, isPostgres, run } from '../db/database.js';
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

  for (const check of checks.filter((item) => item.status)) {
    await run(`
      INSERT INTO checks (date, time_slot, vessel_id, camera_id, status, observation, behavior_note, user_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(date, time_slot, camera_id) DO UPDATE SET
        status = EXCLUDED.status,
        observation = EXCLUDED.observation,
        behavior_note = EXCLUDED.behavior_note,
        user_id = EXCLUDED.user_id,
        updated_at = CURRENT_TIMESTAMP
    `, [
      req.params.date,
      check.time_slot,
      check.vessel_id,
      check.camera_id,
      check.status,
      check.observation || '',
      check.behavior_note || '',
      req.user.id
    ]);

    const saved = await get('SELECT id FROM checks WHERE date = ? AND time_slot = ? AND camera_id = ?', [
      req.params.date,
      check.time_slot,
      check.camera_id
    ]);

    if ((check.observation || check.behavior_note) && saved) {
      await run(`
        INSERT INTO observations (check_id, note, behavior_note, user_id)
        VALUES (?, ?, ?, ?)
      `, [saved.id, check.observation || '', check.behavior_note || '', req.user.id]);
    }
  }

  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return res.json({
      message: 'Salvo com sucesso no app. A planilha online será atualizada quando a integração Microsoft Graph estiver ativa.',
      localSync: { ok: false, message: 'Sincronização local desativada em produção.' }
    });
  }

  try {
    const localSync = await syncLocalWorkbook({
      checks: await checksForDate(req.params.date),
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
