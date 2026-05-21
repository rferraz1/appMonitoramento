import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const processes = new Map();
const streamsRoot = path.resolve(process.cwd(), 'tmp/streams');

function streamDir(cameraId) {
  return path.join(streamsRoot, `camera-${cameraId}`);
}

function playlistPath(cameraId) {
  return path.join(streamDir(cameraId), 'index.m3u8');
}

export function playbackUrl(cameraId) {
  return `/streams/camera-${cameraId}/index.m3u8`;
}

export function streamStatus(cameraId) {
  const processInfo = processes.get(String(cameraId));
  const playlistReady = fs.existsSync(playlistPath(cameraId));
  return {
    running: Boolean(processInfo),
    playlistReady,
    playbackUrl: playlistReady ? playbackUrl(cameraId) : null,
    startedAt: processInfo?.startedAt || null
  };
}

export function stopStream(cameraId) {
  const key = String(cameraId);
  const processInfo = processes.get(key);
  if (processInfo) {
    processInfo.child.kill('SIGTERM');
    processes.delete(key);
  }
  return streamStatus(cameraId);
}

export function startStream(cameraId, rtspUrl) {
  if (!rtspUrl?.startsWith('rtsp://')) {
    throw new Error('A URL precisa começar com rtsp:// para iniciar o proxy.');
  }

  stopStream(cameraId);

  const dir = streamDir(cameraId);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const args = [
    '-rtsp_transport', 'tcp',
    '-i', rtspUrl,
    '-an',
    '-c:v', 'copy',
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '4',
    '-hls_flags', 'delete_segments+append_list',
    playlistPath(cameraId)
  ];

  const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
  const key = String(cameraId);
  const processInfo = {
    child,
    startedAt: new Date().toISOString(),
    lastError: ''
  };
  processes.set(key, processInfo);

  child.stderr.on('data', (data) => {
    processInfo.lastError = data.toString().slice(-1000);
  });

  child.on('exit', () => {
    processes.delete(key);
  });

  return streamStatus(cameraId);
}
