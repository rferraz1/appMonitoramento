import dotenv from 'dotenv';
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from './db/database.js';
import { seed } from './db/seed.js';
import { authRequired } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';
import { vesselsRouter } from './routes/vessels.js';
import { camerasRouter } from './routes/cameras.js';
import { checksRouter } from './routes/checks.js';
import { analyticsRouter } from './routes/analytics.js';
import { reportsRouter } from './routes/reports.js';
import { excelRouter } from './routes/excel.js';
import { usersRouter } from './routes/users.js';
import { inventoryRouter } from './routes/inventory.js';

dotenv.config();
await migrate();
await seed();

const app = express();
const port = process.env.PORT || 4000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '15mb' }));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
app.use('/streams', express.static(path.resolve(process.cwd(), 'tmp/streams')));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/vessels', authRequired, vesselsRouter);
app.use('/api/cameras', authRequired, camerasRouter);
app.use('/api/checks', authRequired, checksRouter);
app.use('/api/analytics', authRequired, analyticsRouter);
app.use('/api/reports', authRequired, reportsRouter);
app.use('/api/excel', authRequired, excelRouter);
app.use('/api/users', authRequired, usersRouter);
app.use('/api/inventory', authRequired, inventoryRouter);
app.use('/api', (_req, res) => res.status(404).json({ message: 'Rota da API não encontrada.' }));

const frontendDist = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (_req, res, next) => {
  const indexFile = path.join(frontendDist, 'index.html');
  if (!indexFile.startsWith(frontendDist) || !path.isAbsolute(indexFile)) return next();
  res.sendFile(indexFile, (error) => {
    if (error) next();
  });
});

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`API rodando em http://localhost:${port}/api`);
  });
}

export default app;
