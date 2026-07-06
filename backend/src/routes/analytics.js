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

  const groupAvailability = [...new Set(checks.map((c) => c.vessel_name))].map((name) => {
    const groupChecks = checks.filter((c) => c.vessel_name === name);
    const groupOnline = groupChecks.filter((c) => c.status === 'Online').length;
    return { name, disponibilidade: groupChecks.length ? Math.round((groupOnline / groupChecks.length) * 100) : 0 };
  });

  const cameraProblems = [...checks.reduce((map, check) => {
    if (check.status === 'Online') return map;
    const current = map.get(check.camera_id) || {
      name: check.camera_name,
      group: check.vessel_name,
      label: `${check.vessel_name} - ${check.camera_name}`,
      value: 0
    };
    current.value += 1;
    map.set(check.camera_id, current);
    return map;
  }, new Map()).values()].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

  const frequentOffline = [...checks.reduce((map, check) => {
    if (check.status !== 'Offline') return map;
    const current = map.get(check.camera_id) || {
      cameraId: check.camera_id,
      name: check.camera_name,
      group: check.vessel_name,
      label: `${check.vessel_name} - ${check.camera_name}`,
      offlineDates: new Set(),
      offlineRecords: 0,
      lastOfflineDate: check.date
    };
    current.offlineDates.add(check.date);
    current.offlineRecords += 1;
    if (check.date > current.lastOfflineDate) current.lastOfflineDate = check.date;
    map.set(check.camera_id, current);
    return map;
  }, new Map()).values()]
    .map((camera) => ({
      cameraId: camera.cameraId,
      name: camera.name,
      group: camera.group,
      label: camera.label,
      offlineDays: camera.offlineDates.size,
      offlineRecords: camera.offlineRecords,
      lastOfflineDate: camera.lastOfflineDate
    }))
    .filter((camera) => camera.offlineDays >= 5)
    .sort((a, b) => b.offlineDays - a.offlineDays || b.offlineRecords - a.offlineRecords || a.label.localeCompare(b.label));

  const monthly = (await all(`
    SELECT substr(date, 1, 7) AS month,
      SUM(CASE WHEN status = 'Online' THEN 1 ELSE 0 END) AS online,
      SUM(CASE WHEN status = 'Offline' THEN 1 ELSE 0 END) AS offline,
      SUM(CASE WHEN status = 'Manutenção' THEN 1 ELSE 0 END) AS maintenance,
      SUM(CASE WHEN status = 'Sem acesso' THEN 1 ELSE 0 END) AS no_access,
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

  const monthlyStatus = monthly.map((row) => {
    const totalRecords = Number(row.total || 0);
    const metric = (value) => totalRecords ? Math.round((Number(value || 0) / totalRecords) * 100) : 0;
    return {
      name: row.month,
      totalRecords,
      Online: metric(row.online),
      'Online registros': Number(row.online || 0),
      Offline: metric(row.offline),
      'Offline registros': Number(row.offline || 0),
      Manutenção: metric(row.maintenance),
      'Manutenção registros': Number(row.maintenance || 0),
      'Sem acesso': metric(row.no_access),
      'Sem acesso registros': Number(row.no_access || 0)
    };
  });

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
    groupAvailability,
    cameraProblems,
    frequentOffline,
    monthlyStatus,
    sixMonths,
    annual
  });
});
