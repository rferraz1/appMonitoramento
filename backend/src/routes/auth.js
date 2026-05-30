import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { get, run } from '../db/database.js';
import { authRequired } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await get('SELECT * FROM users WHERE email = ?', [email]);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ message: 'Usuário ou senha inválidos.' });
  }

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '12h' });
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

authRouter.get('/me', authRequired, (req, res) => {
  res.json(req.user);
});

authRouter.put('/password', authRequired, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: 'A nova senha deve ter pelo menos 6 caracteres.' });
  }
  const user = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!bcrypt.compareSync(currentPassword || '', user.password_hash)) {
    return res.status(400).json({ message: 'Senha atual inválida.' });
  }
  await run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(newPassword, 10), req.user.id]);
  res.json({ message: 'Senha alterada com sucesso.' });
});
