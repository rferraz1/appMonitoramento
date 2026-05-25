import bcrypt from 'bcryptjs';
import { all, get, isPostgres, migrate, run } from './database.js';
import { cameraGroups, excelCodeFor } from './cameraCatalog.js';

const defaultWorksheetName = 'Mensal automático: Janeiro a Dezembro';

export async function seed() {
  await migrate();

  const defaultAdminLogin = 'rsferraz';
  const defaultAdminPassword = '123@Mudar';
  const adminExists = await get('SELECT id FROM users WHERE email = ?', [defaultAdminLogin]);
  const legacyAdmin = await get('SELECT id FROM users WHERE email = ?', ['admin']);

  if (!adminExists && legacyAdmin) {
    await run(`
      UPDATE users
      SET name = ?, email = ?, password_hash = ?, role = ?
      WHERE id = ?
    `, ['Administrador', defaultAdminLogin, bcrypt.hashSync(defaultAdminPassword, 10), 'admin', legacyAdmin.id]);
  } else if (!adminExists) {
    await run(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `, ['Administrador', defaultAdminLogin, bcrypt.hashSync(defaultAdminPassword, 10), 'admin']);
  }

  const vesselCount = await get('SELECT COUNT(*) AS total FROM vessels');
  const total = Number(vesselCount?.total || 0);
  if (total === 0) {
    for (const group of cameraGroups) {
      const vessel = await get(
        'INSERT INTO vessels (name, active) VALUES (?, ?) RETURNING id',
        [group.name, isPostgres ? true : 1]
      );

      for (const [index, name] of group.cameras.entries()) {
        await run(`
          INSERT INTO cameras (vessel_id, excel_code, name, location, active)
          VALUES (?, ?, ?, ?, ?)
        `, [vessel.id, excelCodeFor(group.prefix, index), name, '', isPostgres ? true : 1]);
      }
    }
  }

  const settings = await all('SELECT id FROM excel_settings WHERE id = 1');
  if (!settings.length) {
    await run(`
      INSERT INTO excel_settings (id, excel_url, worksheet_name, enabled)
      VALUES (1, ?, ?, ?)
    `, ['', defaultWorksheetName, isPostgres ? false : 0]);
  }
}
