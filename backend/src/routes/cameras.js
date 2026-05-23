import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/database.js';
import { playbackUrl, startStream, stopStream, streamStatus } from '../services/rtspProxyService.js';

export const camerasRouter = Router();

const mapCamera = (camera) => ({ ...camera, active: Boolean(camera.active) });

function buildIntelbrasRtsp({ stream_ip, stream_login, stream_password }) {
  const ip = String(stream_ip || '').trim();
  const login = encodeURIComponent(String(stream_login || '').trim());
  const password = encodeURIComponent(String(stream_password || '').trim());
  if (!ip || !login || !password) return '';
  return `rtsp://${login}:${password}@${ip}:554/cam/realmonitor?channel=1&subtype=0`;
}

function nextExcelCode() {
  const rows = db.prepare('SELECT excel_code FROM cameras WHERE excel_code IS NOT NULL').all();
  const max = rows.reduce((current, row) => {
    const match = String(row.excel_code).match(/(\d+)$/);
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  return `NEW-${String(max + 1).padStart(2, '0')}`;
}

camerasRouter.get('/', (req, res) => {
  const { active } = req.query;
  let sql = `
    SELECT cameras.*, vessels.name AS vessel_name
    FROM cameras
    JOIN vessels ON vessels.id = cameras.vessel_id
  `;
  const params = [];
  if (active === 'true') sql += ' WHERE cameras.active = 1 AND vessels.active = 1';
  sql += ' ORDER BY vessels.id, COALESCE(cameras.excel_code, cameras.name), cameras.name';
  res.json(db.prepare(sql).all(...params).map(mapCamera));
});

camerasRouter.post('/', (req, res) => {
  const { vessel_id, name, location = '', active = true } = req.body;
  if (!vessel_id || !name?.trim()) return res.status(400).json({ message: 'Barco e nome da câmera são obrigatórios.' });
  const result = db.prepare(`
    INSERT INTO cameras (vessel_id, excel_code, name, location, active)
    VALUES (?, ?, ?, ?, ?)
  `).run(vessel_id, nextExcelCode(), name.trim(), location, active ? 1 : 0);
  res.status(201).json(mapCamera(db.prepare('SELECT * FROM cameras WHERE id = ?').get(result.lastInsertRowid)));
});

camerasRouter.put('/:id', (req, res) => {
  const { vessel_id, name, location = '', active = true } = req.body;
  if (!vessel_id || !name?.trim()) return res.status(400).json({ message: 'Barco e nome da câmera são obrigatórios.' });
  db.prepare(`
    UPDATE cameras SET vessel_id = ?, name = ?, location = ?, active = ? WHERE id = ?
  `).run(vessel_id, name.trim(), location, active ? 1 : 0, req.params.id);
  res.json(mapCamera(db.prepare('SELECT * FROM cameras WHERE id = ?').get(req.params.id)));
});

camerasRouter.put('/:id/image', (req, res) => {
  const { imageData } = req.body;
  if (!imageData?.startsWith('data:image/')) {
    return res.status(400).json({ message: 'Imagem inválida.' });
  }

  const match = imageData.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
  if (!match) return res.status(400).json({ message: 'Formato de imagem não suportado.' });

  const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
  const buffer = Buffer.from(match[2], 'base64');
  const uploadDir = path.resolve(process.cwd(), 'uploads/cameras');
  fs.mkdirSync(uploadDir, { recursive: true });

  const filename = `camera-${req.params.id}-${Date.now()}.${extension}`;
  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, buffer);

  const imageUrl = `/uploads/cameras/${filename}`;
  db.prepare('UPDATE cameras SET image_url = ? WHERE id = ?').run(imageUrl, req.params.id);
  res.json(mapCamera(db.prepare('SELECT * FROM cameras WHERE id = ?').get(req.params.id)));
});

camerasRouter.put('/:id/stream', (req, res) => {
  const { stream_url = '', stream_ip = '', stream_login = '', stream_password = '' } = req.body;
  const value = stream_url.trim() || buildIntelbrasRtsp({ stream_ip, stream_login, stream_password });

  if (value && !/^https?:\/\//i.test(value) && !/^rtsp:\/\//i.test(value)) {
    return res.status(400).json({ message: 'Informe uma URL iniciando com http://, https:// ou rtsp://.' });
  }

  db.prepare(`
    UPDATE cameras
    SET stream_url = ?, stream_ip = ?, stream_login = ?, stream_password = ?
    WHERE id = ?
  `).run(value, stream_ip.trim(), stream_login.trim(), stream_password, req.params.id);
  res.json(mapCamera(db.prepare('SELECT * FROM cameras WHERE id = ?').get(req.params.id)));
});

camerasRouter.post('/:id/stream/start', (req, res) => {
  const camera = db.prepare('SELECT * FROM cameras WHERE id = ?').get(req.params.id);
  if (!camera?.stream_url) return res.status(400).json({ message: 'Configure a URL RTSP da câmera antes de iniciar.' });

  try {
    const status = startStream(req.params.id, camera.stream_url);
    res.json({
      ...status,
      message: 'Proxy RTSP iniciado. Aguarde alguns segundos para o vídeo carregar.',
      playbackUrl: playbackUrl(req.params.id)
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

camerasRouter.post('/:id/stream/stop', (req, res) => {
  res.json(stopStream(req.params.id));
});

camerasRouter.get('/:id/stream/status', (req, res) => {
  res.json(streamStatus(req.params.id));
});
