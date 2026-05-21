import { Router } from 'express';
import { db } from '../db/database.js';
import { syncLocalWorkbook } from '../services/localExcelService.js';

export const checksRouter = Router();
const slots = ['10:00', '13:00', '16:00'];

function checksForDate(date) {
  return db.prepare(`
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
  `).all(date);
}

function camerasForSync() {
  return db.prepare(`
    SELECT cameras.*,
      vessels.name AS vessel_name
    FROM cameras
    JOIN vessels ON vessels.id = cameras.vessel_id
    ORDER BY COALESCE(cameras.excel_code, cameras.name)
  `).all().map((camera) => ({ ...camera, active: Boolean(camera.active) }));
}

checksRouter.get('/day/:date', (req, res) => {
  const cameras = db.prepare(`
    SELECT cameras.*, vessels.name AS vessel_name, vessels.active AS vessel_active
    FROM cameras
    JOIN vessels ON vessels.id = cameras.vessel_id
    WHERE cameras.active = 1 AND vessels.active = 1
    ORDER BY vessels.name, cameras.name
  `).all();

  const checks = db.prepare(`
    SELECT checks.*, users.name AS user_name
    FROM checks
    JOIN users ON users.id = checks.user_id
    WHERE date = ?
  `).all(req.params.date);

  const byCamera = cameras.reduce((acc, camera) => {
    const key = `${camera.vessel_id}:${camera.vessel_name}`;
    if (!acc[key]) acc[key] = { id: camera.vessel_id, name: camera.vessel_name, cameras: [] };
    acc[key].cameras.push({
      id: camera.id,
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
  const completed = checks.filter((check) => check.status).length;

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

  const upsert = db.prepare(`
    INSERT INTO checks (date, time_slot, vessel_id, camera_id, status, observation, behavior_note, user_id, updated_at)
    VALUES (@date, @time_slot, @vessel_id, @camera_id, @status, @observation, @behavior_note, @user_id, CURRENT_TIMESTAMP)
    ON CONFLICT(date, time_slot, camera_id) DO UPDATE SET
      status = excluded.status,
      observation = excluded.observation,
      behavior_note = excluded.behavior_note,
      user_id = excluded.user_id,
      updated_at = CURRENT_TIMESTAMP
  `);

  const insertObservation = db.prepare(`
    INSERT INTO observations (check_id, note, behavior_note, user_id)
    VALUES (?, ?, ?, ?)
  `);

  const getCheck = db.prepare('SELECT id FROM checks WHERE date = ? AND time_slot = ? AND camera_id = ?');

  const transaction = db.transaction(() => {
    for (const check of checks.filter((item) => item.status)) {
      upsert.run({
        date: req.params.date,
        time_slot: check.time_slot,
        vessel_id: check.vessel_id,
        camera_id: check.camera_id,
        status: check.status,
        observation: check.observation || '',
        behavior_note: check.behavior_note || '',
        user_id: req.user.id
      });
      const saved = getCheck.get(req.params.date, check.time_slot, check.camera_id);
      if ((check.observation || check.behavior_note) && saved) {
        insertObservation.run(saved.id, check.observation || '', check.behavior_note || '', req.user.id);
      }
    }
  });

  transaction();

  try {
    const localSync = await syncLocalWorkbook({
      checks: checksForDate(req.params.date),
      cameras: camerasForSync()
    });
    res.json({ message: 'Salvo com sucesso. Planilha local atualizada.', localSync });
  } catch (error) {
    res.json({
      message: 'Salvo com sucesso no app, mas não foi possível atualizar a planilha local.',
      localSync: { ok: false, message: error.message }
    });
  }
});
