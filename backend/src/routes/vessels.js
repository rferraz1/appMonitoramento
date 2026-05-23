import { Router } from 'express';
import { all, get, isPostgres, run } from '../db/database.js';

export const vesselsRouter = Router();

const mapVessel = (vessel) => ({ ...vessel, active: Boolean(vessel.active) });

vesselsRouter.get('/', async (_req, res) => {
  const vessels = await all('SELECT * FROM vessels ORDER BY active DESC, id');
  res.json(vessels.map(mapVessel));
});

vesselsRouter.post('/', async (req, res) => {
  const { name, active = true } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: 'Nome do grupo é obrigatório.' });

  const vessel = await get(
    'INSERT INTO vessels (name, active) VALUES (?, ?) RETURNING *',
    [name.trim(), isPostgres ? Boolean(active) : active ? 1 : 0]
  );
  res.status(201).json(mapVessel(vessel));
});

vesselsRouter.put('/:id', async (req, res) => {
  const { name, active = true } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: 'Nome do grupo é obrigatório.' });

  await run('UPDATE vessels SET name = ?, active = ? WHERE id = ?', [
    name.trim(),
    isPostgres ? Boolean(active) : active ? 1 : 0,
    req.params.id
  ]);
  res.json(mapVessel(await get('SELECT * FROM vessels WHERE id = ?', [req.params.id])));
});
