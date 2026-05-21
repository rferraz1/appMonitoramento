import { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Camera, Lock, Monitor, Play, Save, Square, User } from 'lucide-react';
import { api } from '../api/client.js';

function StreamPlayer({ url, name }) {
  const videoRef = useRef(null);
  const isRtsp = /^rtsp:\/\//i.test(url || '');
  const isMjpeg = /\.(mjpg|mjpeg)(\?|$)/i.test(url || '') || /mjpeg|snapshot|video\.cgi/i.test(url || '');
  const isHls = /\.m3u8(\?|$)/i.test(url || '');

  useEffect(() => {
    if (!url || !isHls || !videoRef.current) return undefined;
    if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = url;
      return undefined;
    }
    if (!Hls.isSupported()) return undefined;

    const hls = new Hls();
    hls.loadSource(url);
    hls.attachMedia(videoRef.current);
    return () => hls.destroy();
  }, [url, isHls]);

  if (!url) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
        <div className="grid size-16 place-items-center rounded-full bg-white shadow-sm">
          <Camera size={30} />
        </div>
        <p className="text-sm font-medium">Stream não configurado</p>
      </div>
    );
  }

  if (isRtsp) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center">
        <Camera className="text-slate-400" size={34} />
        <div>
          <p className="text-sm font-semibold text-slate-700">RTSP configurado</p>
          <p className="mt-1 text-xs text-slate-500">O navegador não reproduz RTSP direto. Para ver aqui, use HLS/MJPEG ou um proxy RTSP para HLS.</p>
        </div>
      </div>
    );
  }

  if (isMjpeg) {
    return <img src={url} alt={name} className="h-full w-full object-cover" />;
  }

  return (
    <video
      ref={videoRef}
      className="h-full w-full bg-black object-contain"
      src={isHls ? undefined : url}
      controls
      muted
      playsInline
    />
  );
}

export default function Cameras() {
  const [cameras, setCameras] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [playbackUrls, setPlaybackUrls] = useState({});
  const [loadingId, setLoadingId] = useState(null);
  const [message, setMessage] = useState('');

  async function load() {
    const response = await api.get('/cameras');
    setCameras(response.data);
    setDrafts(Object.fromEntries(response.data.map((camera) => [camera.id, {
      stream_ip: camera.stream_ip || '',
      stream_login: camera.stream_login || 'admin',
      stream_password: camera.stream_password || ''
    }])));
  }

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => ({
    total: cameras.length,
    active: cameras.filter((camera) => camera.active).length,
    future: cameras.filter((camera) => !camera.active).length,
    withStream: cameras.filter((camera) => camera.stream_url).length
  }), [cameras]);

  async function saveStream(cameraId) {
    setLoadingId(cameraId);
    setMessage('');
    try {
      await api.put(`/cameras/${cameraId}/stream`, drafts[cameraId] || {});
      await load();
      setMessage('Dados da câmera salvos. RTSP montado automaticamente.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Não foi possível salvar o stream.');
    } finally {
      setLoadingId(null);
    }
  }

  async function startRtsp(cameraId) {
    setLoadingId(cameraId);
    setMessage('');
    try {
      const response = await api.post(`/cameras/${cameraId}/stream/start`);
      const url = `${apiOrigin}${response.data.playbackUrl}?t=${Date.now()}`;
      setPlaybackUrls((current) => ({ ...current, [cameraId]: url }));
      setMessage(response.data.message);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Não foi possível iniciar a transmissão.');
    } finally {
      setLoadingId(null);
    }
  }

  async function stopRtsp(cameraId) {
    setLoadingId(cameraId);
    setMessage('');
    try {
      await api.post(`/cameras/${cameraId}/stream/stop`);
      setPlaybackUrls((current) => ({ ...current, [cameraId]: '' }));
      setMessage('Transmissão parada.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Não foi possível parar a transmissão.');
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Câmeras</h1>
          <p className="text-sm text-slate-500">Visualização de vídeo das câmeras Intelbras IM4C por URL de stream.</p>
        </div>
        <div className="grid grid-cols-4 overflow-hidden rounded-lg border border-slate-200 bg-white text-center shadow-sm">
          <div className="px-4 py-3">
            <p className="text-lg font-bold">{summary.total}</p>
            <p className="text-xs text-slate-500">Total</p>
          </div>
          <div className="border-l border-slate-200 px-4 py-3">
            <p className="text-lg font-bold text-emerald-700">{summary.active}</p>
            <p className="text-xs text-slate-500">Ativas</p>
          </div>
          <div className="border-l border-slate-200 px-4 py-3">
            <p className="text-lg font-bold text-slate-600">{summary.future}</p>
            <p className="text-xs text-slate-500">Futuras</p>
          </div>
          <div className="border-l border-slate-200 px-4 py-3">
            <p className="text-lg font-bold text-brand-700">{summary.withStream}</p>
            <p className="text-xs text-slate-500">Com stream</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Informe apenas IP, login e senha. O sistema monta automaticamente o RTSP Intelbras no padrão <span className="font-semibold">/cam/realmonitor?channel=1&subtype=0</span> e usa o proxy local para abrir no navegador.
      </div>
      {message && <div className="rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700">{message}</div>}

      <div className="grid gap-5 xl:grid-cols-2">
        {cameras.map((camera) => (
          <article className="panel overflow-hidden" key={camera.id}>
            <div className="aspect-video bg-slate-100">
              <StreamPlayer url={playbackUrls[camera.id] || camera.stream_url} name={camera.name} />
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">{camera.excel_code}</p>
                  <h2 className="mt-1 font-semibold text-slate-950">{camera.name}</h2>
                  <p className="text-sm text-slate-500">{camera.vessel_name}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${camera.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {camera.active ? 'Ativa' : 'Futura'}
                </span>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-[1fr_130px_150px_auto]">
                <label className="relative">
                  <Monitor className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    className="input pl-9"
                    placeholder="IP da câmera"
                    value={drafts[camera.id]?.stream_ip || ''}
                    onChange={(event) => setDrafts((current) => ({ ...current, [camera.id]: { ...current[camera.id], stream_ip: event.target.value } }))}
                  />
                </label>
                <label className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    className="input pl-9"
                    placeholder="Login"
                    value={drafts[camera.id]?.stream_login || ''}
                    onChange={(event) => setDrafts((current) => ({ ...current, [camera.id]: { ...current[camera.id], stream_login: event.target.value } }))}
                  />
                </label>
                <label className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    className="input pl-9"
                    type="password"
                    placeholder="Senha/chave"
                    value={drafts[camera.id]?.stream_password || ''}
                    onChange={(event) => setDrafts((current) => ({ ...current, [camera.id]: { ...current[camera.id], stream_password: event.target.value } }))}
                  />
                </label>
                <button className="btn-primary" onClick={() => saveStream(camera.id)} disabled={loadingId === camera.id}>
                  <Save size={16} />
                  {loadingId === camera.id ? 'Salvando...' : 'Salvar stream'}
                </button>
              </div>
              {camera.stream_url && (
                <div className="mt-3 flex gap-2">
                  <button className="btn-secondary flex-1" onClick={() => startRtsp(camera.id)} disabled={loadingId === camera.id}>
                    <Play size={16} />
                    Iniciar transmissão
                  </button>
                  <button className="btn-secondary" onClick={() => stopRtsp(camera.id)} disabled={loadingId === camera.id}>
                    <Square size={16} />
                    Parar
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
