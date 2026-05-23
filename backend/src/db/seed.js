import bcrypt from 'bcryptjs';
import { db, migrate } from './database.js';
import { cameraGroups, excelCodeFor } from './cameraCatalog.js';

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
      cameraGroups.forEach((group) => {
        const vesselId = insertVessel.run(group.name).lastInsertRowid;
        group.cameras.forEach((name, index) => {
          insertCamera.run(vesselId, excelCodeFor(group.prefix, index), name, '', 1);
        });
      });
    });

    transaction();
  }

  db.prepare(`
    INSERT OR IGNORE INTO excel_settings (id, excel_url, worksheet_name, enabled)
    VALUES (1, '', 'Mensal automático: Janeiro a Dezembro', 0)
  `).run();
}
