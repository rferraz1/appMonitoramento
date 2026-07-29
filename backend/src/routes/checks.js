import { Router } from 'express';
import { all, get, isPostgres, run } from '../db/database.js';
import { syncGoogleSheets } from '../services/googleSheetsService.js';
import { syncLocalWorkbook } from '../services/localExcelService.js';

export const checksRouter = Router();
const slots = ['10:00', '13:00', '16:00'];
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Acesso restrito ao administrador.' });
  next();
}

function dateRange(start, end) {
  if (!datePattern.test(start) || !datePattern.test(end)) return [];

  const dates = [];
  const current = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(current.getTime()) || Number.isNaN(last.getTime()) || current > last) return [];

  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

function normalizeHolidayDates(value) {
  const dates = Array.isArray(value)
    ? value
    : String(value || '').split(/[\s,;]+/);

  return new Set(
    dates
      .map((date) => String(date || '').trim())
      .filter((date) => datePattern.test(date))
  );
}

function isWeekend(date) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

function businessDateRange(start, end, { skipWeekends = true, holidays = [] } = {}) {
  const holidayDates = normalizeHolidayDates(holidays);
  const selected = [];
  const excluded = [];

  dateRange(start, end).forEach((date) => {
    const reason = skipWeekends && isWeekend(date)
      ? 'fim de semana'
      : holidayDates.has(date)
        ? 'feriado'
        : '';

    if (reason) {
      excluded.push({ date, reason });
      return;
    }

    selected.push(date);
  });

  return { selected, excluded };
}

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

async function checksForDates(dates) {
  if (!dates.length) return [];
  const placeholders = dates.map(() => '?').join(', ');
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
    WHERE checks.date IN (${placeholders})
    ORDER BY checks.date, checks.time_slot, COALESCE(cameras.excel_code, cameras.name)
  `, dates);
}

async function activeChecksForDate(date, vesselId) {
  const params = [date];
  let sql = `
    SELECT checks.*
    FROM checks
    JOIN cameras ON cameras.id = checks.camera_id
    JOIN vessels ON vessels.id = checks.vessel_id
    WHERE checks.date = ?
      AND cameras.active = ${isPostgres ? 'true' : '1'}
      AND vessels.active = ${isPostgres ? 'true' : '1'}
  `;
  if (vesselId) {
    sql += ' AND checks.vessel_id = ?';
    params.push(vesselId);
  }
  sql += ' ORDER BY checks.camera_id, checks.time_slot';
  return all(sql, params);
}

async function latestCheckDateBefore(date, vesselId) {
  const params = [date];
  let sql = `
    SELECT MAX(checks.date) AS date
    FROM checks
    JOIN cameras ON cameras.id = checks.camera_id
    JOIN vessels ON vessels.id = checks.vessel_id
    WHERE checks.date < ?
      AND cameras.active = ${isPostgres ? 'true' : '1'}
      AND vessels.active = ${isPostgres ? 'true' : '1'}
  `;
  if (vesselId) {
    sql += ' AND checks.vessel_id = ?';
    params.push(vesselId);
  }
  const row = await get(sql, params);
  return row?.date || null;
}

async function saveRepeatedChecks(rowsToSave, userId) {
  for (let index = 0; index < rowsToSave.length; index += 100) {
    const batch = rowsToSave.slice(index, index + 100);
    const values = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').join(', ');
    const params = batch.flatMap((check) => [
      check.date,
      check.time_slot,
      check.vessel_id,
      check.camera_id,
      check.status,
      '',
      '',
      userId
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

  const savedDates = [...new Set(rowsToSave.map((check) => check.date))];
  const savedKeys = new Set(rowsToSave.map((check) => `${check.date}:${check.camera_id}:${check.time_slot}`));
  const savedChecks = (await checksForDates(savedDates)).filter((check) =>
    savedKeys.has(`${check.date}:${check.camera_id}:${check.time_slot}`)
  );

  const settings = await get('SELECT enabled, google_webhook_url FROM excel_settings WHERE id = 1');
  const googleSync = await syncGoogleSheets(settings, savedChecks, { timeoutMs: 15000 });

  if (googleSync.ok) {
    await run('UPDATE excel_settings SET last_sync_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1', [googleSync.syncedAt]);
  }

  return { savedDates, savedChecks, googleSync };
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

checksRouter.post('/repeat-days', adminOnly, async (req, res) => {
  const {
    sourceDate,
    startDate,
    endDate,
    vessel_id: vesselId,
    overwrite = false,
    skipWeekends = true,
    holidays = []
  } = req.body;

  if (!datePattern.test(sourceDate || '') || !datePattern.test(startDate || '') || !datePattern.test(endDate || '')) {
    return res.status(400).json({ message: 'Informe datas válidas para origem, início e fim.' });
  }

  const { selected, excluded } = businessDateRange(startDate, endDate, { skipWeekends, holidays });
  const targetDates = selected.filter((date) => date !== sourceDate);
  if (!targetDates.length) {
    return res.status(400).json({ message: 'Selecione pelo menos um dia útil de destino diferente da data de origem.' });
  }
  if (targetDates.length > 31) {
    return res.status(400).json({ message: 'Repita no máximo 31 dias por vez.' });
  }

  const sourceChecks = await activeChecksForDate(sourceDate, vesselId);
  if (!sourceChecks.length) {
    return res.status(400).json({ message: 'A data de origem não possui status salvos para repetir.' });
  }

  const existingChecks = await checksForDates(targetDates);
  const existingKeys = new Set(existingChecks.map((check) => `${check.date}:${check.camera_id}:${check.time_slot}`));
  const rowsToSave = [];
  let skipped = 0;

  targetDates.forEach((date) => {
    sourceChecks.forEach((check) => {
      const key = `${date}:${check.camera_id}:${check.time_slot}`;
      if (!overwrite && existingKeys.has(key)) {
        skipped += 1;
        return;
      }
      rowsToSave.push({
        date,
        time_slot: check.time_slot,
        vessel_id: check.vessel_id,
        camera_id: check.camera_id,
        status: check.status
      });
    });
  });

  if (!rowsToSave.length) {
    return res.json({
      message: 'Nenhum registro novo para repetir. Os dias selecionados já possuem status salvos.',
      createdOrUpdated: 0,
      skipped,
      skippedDates: excluded,
      googleSync: { ok: false, skipped: true, message: 'Sem registros para sincronizar.' }
    });
  }

  const { savedDates, googleSync } = await saveRepeatedChecks(rowsToSave, req.user.id);

  const syncWarning = googleSync.ok ? '' : ` Planilha Google não atualizada: ${googleSync.message}`;
  res.json({
    message: `${rowsToSave.length} verificações repetidas em ${savedDates.length} dia(s).${syncWarning}`,
    createdOrUpdated: rowsToSave.length,
    skipped,
    targetDays: savedDates.length,
    skippedDates: excluded,
    googleSync
  });
});

checksRouter.post('/fill-missing-days', adminOnly, async (req, res) => {
  const {
    startDate,
    endDate,
    vessel_id: vesselId,
    skipWeekends = true,
    holidays = []
  } = req.body;

  if (!datePattern.test(startDate || '') || !datePattern.test(endDate || '')) {
    return res.status(400).json({ message: 'Informe datas válidas para início e fim.' });
  }

  const { selected: targetDates, excluded } = businessDateRange(startDate, endDate, { skipWeekends, holidays });
  if (!targetDates.length) {
    return res.status(400).json({ message: 'Selecione um intervalo com pelo menos um dia útil para preencher.' });
  }
  if (targetDates.length > 31) {
    return res.status(400).json({ message: 'Preencha no máximo 31 dias por vez.' });
  }

  const previousDate = await latestCheckDateBefore(startDate, vesselId);
  let latestSourceChecks = previousDate ? await activeChecksForDate(previousDate, vesselId) : [];
  const existingChecks = await checksForDates(targetDates);
  const rowsToSave = [];
  let skippedExistingDays = 0;
  let skippedNoSourceDays = 0;
  let filledDays = 0;

  for (const targetDate of targetDates) {
    const checksOnTargetDate = existingChecks.filter((check) =>
      check.date === targetDate && (!vesselId || Number(check.vessel_id) === Number(vesselId))
    );

    if (checksOnTargetDate.length) {
      latestSourceChecks = await activeChecksForDate(targetDate, vesselId);
      skippedExistingDays += 1;
      continue;
    }

    if (!latestSourceChecks.length) {
      skippedNoSourceDays += 1;
      continue;
    }

    const createdForDate = latestSourceChecks.map((check) => ({
      date: targetDate,
      time_slot: check.time_slot,
      vessel_id: check.vessel_id,
      camera_id: check.camera_id,
      status: check.status
    }));
    rowsToSave.push(...createdForDate);
    latestSourceChecks = createdForDate;
    filledDays += 1;
  }

  if (!rowsToSave.length) {
    return res.json({
      message: 'Nenhum dia vazio foi preenchido. O intervalo já possui marcações ou não existe dia anterior marcado para copiar.',
      createdOrUpdated: 0,
      filledDays,
      skippedExistingDays,
      skippedNoSourceDays,
      skippedDates: excluded,
      googleSync: { ok: false, skipped: true, message: 'Sem registros para sincronizar.' }
    });
  }

  const { googleSync } = await saveRepeatedChecks(rowsToSave, req.user.id);
  const syncWarning = googleSync.ok ? '' : ` Planilha Google não atualizada: ${googleSync.message}`;

  res.json({
    message: `${rowsToSave.length} verificações criadas em ${filledDays} dia(s) vazio(s), copiando o último dia marcado.${syncWarning}`,
    createdOrUpdated: rowsToSave.length,
    filledDays,
    skippedExistingDays,
    skippedNoSourceDays,
    skippedDates: excluded,
    googleSync
  });
});
