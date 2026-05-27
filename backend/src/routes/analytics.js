import { Router } from 'express';
import { all } from '../db/database.js';

export const analyticsRouter = Router();

function periodFromQuery(query) {
  if (query.start && query.end) return { start: query.start, end: query.end };
  const month = query.month || new Date().toISOString().slice(0, 7);
  return { start: `${month}-01`, end: `${month}-31` };
}

analyticsRouter.get('/', async (req, res) => {
  const { start, end } = periodFromQuery(req.query);
  const checks = await all(`
    SELECT checks.*, vessels.name AS vessel_name, cameras.name AS camera_name
    FROM checks
    JOIN vessels ON vessels.id = checks.vessel_id
    JOIN cameras ON cameras.id = checks.camera_id
    WHERE date BETWEEN ? AND ?
  `, [start, end]);

  const total = checks.length;
  const latestByCamera = new Map();
  checks.forEach((check) => {
    const current = latestByCamera.get(check.camera_id);
    const key = `${check.date}-${check.time_slot}`;
    if (!current || key > `${current.date}-${current.time_slot}`) latestByCamera.set(check.camera_id, check);
  });
  const currentStatuses = [...latestByCamera.values()];
  const monitoredCameras = currentStatuses.length;
  const count = (status) => currentStatuses.filter((check) => check.status === status).length;
  const online = count('Online');
  const offline = count('Offline');
  const maintenance = count('Manutenção');
  const noAccess = count('Sem acesso');

  const group = (keyFn, filterFn = () => true) => {
    const map = new Map();
    checks.filter(filterFn).forEach((check) => {
      const key = keyFn(check);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  };

  const vesselAvailability = [...new Set(checks.map((c) => c.vessel_name))].map((name) => {
    const vesselChecks = checks.filter((c) => c.vessel_name === name);
    const vesselOnline = vesselChecks.filter((c) => c.status === 'Online').length;
    return { name, disponibilidade: vesselChecks.length ? Math.round((vesselOnline / vesselChecks.length) * 100) : 0 };
  });

  const monthly = (await all(`
    SELECT substr(date, 1, 7) AS month,
      SUM(CASE WHEN status = 'Online' THEN 1 ELSE 0 END) AS online,
      SUM(CASE WHEN status = 'Offline' THEN 1 ELSE 0 END) AS offline,
      COUNT(*) AS total
    FROM checks
    GROUP BY substr(date, 1, 7)
    ORDER BY month DESC
    LIMIT 12
  `)).reverse();

  const sixMonths = monthly.slice(-6).map((row) => ({
    name: row.month,
    disponibilidade: row.total ? Math.round((Number(row.online || 0) / Number(row.total)) * 100) : 0
  }));

  const annual = (await all(`
    SELECT substr(date, 1, 4) AS year,
      SUM(CASE WHEN status = 'Online' THEN 1 ELSE 0 END) AS online,
      COUNT(*) AS total
    FROM checks
    GROUP BY substr(date, 1, 4)
    ORDER BY year
  `)).map((row) => ({
    name: row.year,
    disponibilidade: row.total ? Math.round((Number(row.online || 0) / Number(row.total)) * 100) : 0
  }));

  res.json({
    cards: {
      cameras: monitoredCameras,
      records: total,
      online,
      offline,
      maintenance,
      noAccess,
      availability: monitoredCameras ? Math.round((online / monitoredCameras) * 100) : 0
    },
    vesselAvailability,
    cameraProblems: group((c) => c.camera_name, (c) => c.status !== 'Online'),
    onlineOfflineByMonth: monthly.map((row) => ({ name: row.month, Online: Number(row.online || 0), Offline: Number(row.offline || 0) })),
    sixMonths,
    annual
  });
});
