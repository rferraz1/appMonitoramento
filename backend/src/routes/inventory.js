import { Router } from 'express';
import { all, get, run } from '../db/database.js';

export const inventoryRouter = Router();

function itemPayload(body) {
  const category = String(body.category || '').trim();
  const name = String(body.name || '').trim();
  const model = String(body.model || '').trim();
  const receivedAt = String(body.received_at || '').trim();
  const notes = String(body.notes || '').trim();
  const quantity = Number(body.quantity);

  if (!category || !name) return { error: 'Categoria e equipamento são obrigatórios.' };
  if (!Number.isInteger(quantity) || quantity < 0) return { error: 'Quantidade deve ser um número inteiro igual ou maior que zero.' };

  return { category, name, model, quantity, receivedAt, notes };
}

inventoryRouter.get('/', async (_req, res) => {
  const items = await all(`
    SELECT *
    FROM inventory_items
    ORDER BY category, name, model, id DESC
  `);
  res.json(items);
});

inventoryRouter.post('/', async (req, res) => {
  const item = itemPayload(req.body);
  if (item.error) return res.status(400).json({ message: item.error });

  const created = await get(`
    INSERT INTO inventory_items (category, name, model, quantity, received_at, notes)
    VALUES (?, ?, ?, ?, ?, ?)
    RETURNING *
  `, [item.category, item.name, item.model, item.quantity, item.receivedAt, item.notes]);
  res.status(201).json(created);
});

inventoryRouter.put('/:id', async (req, res) => {
  const item = itemPayload(req.body);
  if (item.error) return res.status(400).json({ message: item.error });

  await run(`
    UPDATE inventory_items
    SET category = ?, name = ?, model = ?, quantity = ?, received_at = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [item.category, item.name, item.model, item.quantity, item.receivedAt, item.notes, req.params.id]);
  const updated = await get('SELECT * FROM inventory_items WHERE id = ?', [req.params.id]);
  if (!updated) return res.status(404).json({ message: 'Equipamento não encontrado.' });
  res.json(updated);
});
