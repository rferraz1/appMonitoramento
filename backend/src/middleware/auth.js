import jwt from 'jsonwebtoken';
import { db } from '../db/database.js';

export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return res.status(401).json({ message: 'Token não informado.' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(401).json({ message: 'Usuário inválido.' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Token inválido ou expirado.' });
  }
}
