import bcrypt from 'bcryptjs';
import { db, migrate } from './database.js';

const cameras = [
  ['CAM 01', 'BARU ANDES', true],
  ['CAM 02', 'BARU SIERRA', true],
  ['CAM 03', 'BARU 1935', true],
  ['CAM 04', 'BARU SURFER', true],
  ['CAM 05', 'BARU 1000', true],
  ['CAM 06', 'BARU WORK STATION', true],
  ['CAM 07', 'BARU MARACANA', true],
  ['CAM 08', 'BARU ILHA', true],
  ['CAM 09', 'BARU CENTRO', true],
  ['CAM 10', 'BARU FLAMENGO', true],
  ['CAM 11', 'BARU PEDROZA', true],
  ['CAM 12', 'BARU FOSTER', true],
  ['CAM 13', 'BARU MARAGA', true],
  ['CAM 14', 'Reserva/Futura 01', false],
  ['CAM 15', 'Reserva/Futura 02', false],
  ['CAM 16', 'Reserva/Futura 03', false],
  ['CAM 17', 'Reserva/Futura 04', false],
  ['CAM 18', 'Reserva/Futura 05', false],
  ['CAM 19', 'Reserva/Futura 06', false],
  ['CAM 20', 'Reserva/Futura 07', false],
  ['CAM 21', 'Reserva/Futura 08', false],
  ['CAM 22', 'Reserva/Futura 09', false],
  ['CAM 23', 'Reserva/Futura 10', false]
];

export function seed() {
  migrate();

  const userExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin');
  if (!userExists) {
    db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `).run('Administrador', 'admin', bcrypt.hashSync('Baru123@Mudar', 10), 'admin');
  }

  const vesselCount = db.prepare('SELECT COUNT(*) AS total FROM vessels').get().total;
  if (vesselCount === 0) {
    const insertVessel = db.prepare('INSERT INTO vessels (name, active) VALUES (?, 1)');
    const insertCamera = db.prepare(`
      INSERT INTO cameras (vessel_id, excel_code, name, location, active)
      VALUES (?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      const vesselId = insertVessel.run('Baru Offshore').lastInsertRowid;
      cameras.forEach(([code, name, active]) => {
        insertCamera.run(vesselId, code, name, '', active ? 1 : 0);
      });
    });

    transaction();
  }

  db.prepare(`
    INSERT OR IGNORE INTO excel_settings (id, excel_url, worksheet_name, enabled)
    VALUES (1, '', 'Mensal automático: Janeiro a Dezembro', 0)
  `).run();
}
