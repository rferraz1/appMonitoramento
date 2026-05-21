import { Router } from 'express';
import { db } from '../db/database.js';

export const vesselsRouter = Router();

vesselsRouter.get('/', (_req, res) => {
  const vessels = db.prepare('SELECT * FROM vessels ORDER BY active DESC, name').all();
  res.json(vessels.map((v) => ({ ...v, active: Boolean(v.active) })));
});

vesselsRouter.post('/', (req, res) => {
  const { name, active = true } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: 'Nome do barco é obrigatório.' });
  const result = db.prepare('INSERT INTO vessels (name, active) VALUES (?, ?)').run(name.trim(), active ? 1 : 0);
  res.status(201).json(db.prepare('SELECT * FROM vessels WHERE id = ?').get(result.lastInsertRowid));
});

vesselsRouter.put('/:id', (req, res) => {
  const { name, active = true } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: 'Nome do barco é obrigatório.' });
  db.prepare('UPDATE vessels SET name = ?, active = ? WHERE id = ?').run(name.trim(), active ? 1 : 0, req.params.id);
  res.json(db.prepare('SELECT * FROM vessels WHERE id = ?').get(req.params.id));
});
