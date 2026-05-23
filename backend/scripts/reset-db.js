import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const configured = process.env.DATABASE_FILE || './data/monitoramento.sqlite';
const dbFile = path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);

if (fs.existsSync(dbFile)) fs.rmSync(dbFile);
if (fs.existsSync(`${dbFile}-wal`)) fs.rmSync(`${dbFile}-wal`);
if (fs.existsSync(`${dbFile}-shm`)) fs.rmSync(`${dbFile}-shm`);

const { seed } = await import('../src/db/seed.js');
await seed();
console.log(`Banco resetado em ${dbFile}`);
