import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { all, get, run } from '../db/database.js';

export const usersRouter = Router();

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Acesso restrito ao administrador.' });
  next();
}

const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  created_at: user.created_at
});

usersRouter.use(adminOnly);

usersRouter.get('/', async (_req, res) => {
  const users = await all('SELECT id, name, email, role, created_at FROM users ORDER BY name');
  res.json(users.map(publicUser));
});

usersRouter.post('/', async (req, res) => {
  const { name, email, password, role = 'operator' } = req.body;
  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ message: 'Nome, e-mail e senha são obrigatórios.' });
  }
  if (password.length < 6) return res.status(400).json({ message: 'A senha deve ter pelo menos 6 caracteres.' });
  if (!['admin', 'operator'].includes(role)) return res.status(400).json({ message: 'Perfil inválido.' });

  const exists = await get('SELECT id FROM users WHERE email = ?', [email.trim()]);
  if (exists) return res.status(400).json({ message: 'Já existe usuário com esse e-mail.' });

  const user = await get(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, ?)
    RETURNING id, name, email, role, created_at
  `, [name.trim(), email.trim(), bcrypt.hashSync(password, 10), role]);
  res.status(201).json(publicUser(user));
});

usersRouter.put('/:id/password', async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ message: 'A senha deve ter pelo menos 6 caracteres.' });

  await run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(password, 10), req.params.id]);
  res.json({ message: 'Senha redefinida com sucesso.' });
});
