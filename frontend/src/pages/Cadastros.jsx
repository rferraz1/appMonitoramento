import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export default function Cadastros() {
  const [vessels, setVessels] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [vesselForm, setVesselForm] = useState({ name: '', active: true });
  const [cameraForm, setCameraForm] = useState({ vessel_id: '', name: '', location: '', active: true });
  const [editingVessel, setEditingVessel] = useState(null);
  const [editingCamera, setEditingCamera] = useState(null);

  async function load() {
    const [vesselRes, cameraRes] = await Promise.all([api.get('/vessels'), api.get('/cameras')]);
    setVessels(vesselRes.data);
    setCameras(cameraRes.data);
    if (!cameraForm.vessel_id && vesselRes.data[0]) setCameraForm((form) => ({ ...form, vessel_id: vesselRes.data[0].id }));
  }

  useEffect(() => {
    load();
  }, []);

  async function saveVessel(event) {
    event.preventDefault();
    if (editingVessel) await api.put(`/vessels/${editingVessel}`, vesselForm);
    else await api.post('/vessels', vesselForm);
    setVesselForm({ name: '', active: true });
    setEditingVessel(null);
    load();
  }

  async function saveCamera(event) {
    event.preventDefault();
    if (editingCamera) await api.put(`/cameras/${editingCamera}`, cameraForm);
    else await api.post('/cameras', cameraForm);
    setCameraForm({ vessel_id: vessels[0]?.id || '', name: '', location: '', active: true });
    setEditingCamera(null);
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Cadastros</h1>
        <p className="text-sm text-slate-500">Gerencie barcos, câmeras ativas e capacidade futura de expansão.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="panel p-5">
          <h2 className="font-semibold text-slate-950">Barcos</h2>
          <form onSubmit={saveVessel} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <input className="input" placeholder="Nome do barco" value={vesselForm.name} onChange={(e) => setVesselForm({ ...vesselForm, name: e.target.value })} />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={vesselForm.active} onChange={(e) => setVesselForm({ ...vesselForm, active: e.target.checked })} />
              Ativo
            </label>
            <button className="btn-primary">{editingVessel ? 'Atualizar' : 'Cadastrar'}</button>
          </form>
          <div className="mt-5 divide-y divide-slate-100">
            {vessels.map((vessel) => (
              <div className="flex items-center justify-between py-3" key={vessel.id}>
                <div>
                  <p className="font-medium text-slate-900">{vessel.name}</p>
                  <p className="text-xs text-slate-500">{vessel.active ? 'Ativo' : 'Inativo'}</p>
                </div>
                <button className="btn-secondary" onClick={() => { setEditingVessel(vessel.id); setVesselForm({ name: vessel.name, active: vessel.active }); }}>
                  Editar
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="font-semibold text-slate-950">Câmeras</h2>
          <form onSubmit={saveCamera} className="mt-4 grid gap-3">
            <select className="input" value={cameraForm.vessel_id} onChange={(e) => setCameraForm({ ...cameraForm, vessel_id: e.target.value })}>
              {vessels.map((vessel) => <option value={vessel.id} key={vessel.id}>{vessel.name}</option>)}
            </select>
            <div className="grid gap-3 md:grid-cols-2">
              <input className="input" placeholder="Nome da câmera" value={cameraForm.name} onChange={(e) => setCameraForm({ ...cameraForm, name: e.target.value })} />
              <input className="input" placeholder="Localização" value={cameraForm.location} onChange={(e) => setCameraForm({ ...cameraForm, location: e.target.value })} />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={cameraForm.active} onChange={(e) => setCameraForm({ ...cameraForm, active: e.target.checked })} />
                Câmera ativa
              </label>
              <button className="btn-primary">{editingCamera ? 'Atualizar' : 'Cadastrar'}</button>
            </div>
          </form>
          <div className="mt-4 rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-700">
            Modelo atual: {cameras.filter((camera) => camera.active).length} câmeras ativas. Estrutura pronta para adicionar mais 10 ou mais câmeras.
          </div>
          <div className="mt-5 max-h-[520px] divide-y divide-slate-100 overflow-auto">
            {cameras.map((camera) => (
              <div className="flex items-center justify-between gap-3 py-3" key={camera.id}>
                <div>
                  <p className="font-medium text-slate-900">{camera.excel_code ? `${camera.excel_code} · ` : ''}{camera.name}</p>
                  <p className="text-xs text-slate-500">{camera.vessel_name} · {camera.location || 'Sem localização'} · {camera.active ? 'Ativa' : 'Futura/Inativa'}</p>
                </div>
                <button className="btn-secondary" onClick={() => { setEditingCamera(camera.id); setCameraForm({ vessel_id: camera.vessel_id, name: camera.name, location: camera.location || '', active: camera.active }); }}>
                  Editar
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
