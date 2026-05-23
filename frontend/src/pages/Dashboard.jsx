import { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { api } from '../api/client.js';

const today = new Date().toISOString().slice(0, 10);

function TrafficStatus({ value, onChange }) {
  const lights = [
    {
      status: 'Online',
      label: 'Online',
      activeClass: 'border-emerald-600 bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.16)]',
      inactiveClass: 'border-emerald-200 bg-emerald-100 hover:bg-emerald-200'
    },
    {
      status: 'Offline',
      label: 'Offline',
      activeClass: 'border-red-600 bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.16)]',
      inactiveClass: 'border-red-200 bg-red-100 hover:bg-red-200'
    }
  ];

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-center gap-4">
        {lights.map((light) => {
          const active = value === light.status;
          return (
            <button
              key={light.status}
              type="button"
              className={`flex flex-col items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-slate-700 transition ${
                active ? 'bg-white' : 'hover:bg-white'
              }`}
              onClick={() => onChange(light.status)}
              aria-pressed={active}
              title={light.label}
            >
              <span
                className={`block size-8 rounded-full border-2 transition ${
                  active ? light.activeClass : light.inactiveClass
                }`}
              />
              {light.label}
            </button>
          );
        })}
      </div>
      {!value && <p className="mt-2 text-center text-xs text-slate-500">Aguardando checagem</p>}
      {value && value !== 'Online' && value !== 'Offline' && (
        <p className="mt-2 text-center text-xs text-amber-700">Status anterior: {value}</p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [date, setDate] = useState(today);
  const [data, setData] = useState(null);
  const [allGroups, setAllGroups] = useState([]);
  const [selectedVesselId, setSelectedVesselId] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    const response = await api.get(`/checks/day/${date}`, {
      params: selectedVesselId ? { vessel_id: selectedVesselId } : {}
    });
    setData(response.data);
  }

  async function loadGroups() {
    const response = await api.get('/vessels');
    setAllGroups(response.data.filter((vessel) => vessel.active));
  }

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    load();
  }, [date, selectedVesselId]);

  const flatChecks = useMemo(() => {
    if (!data) return [];
    return data.vessels.flatMap((vessel) => vessel.cameras.flatMap((camera) => camera.checks));
  }, [data]);

  function updateCheck(cameraId, slot, field, value) {
    setData((current) => ({
      ...current,
      vessels: current.vessels.map((vessel) => ({
        ...vessel,
        cameras: vessel.cameras.map((camera) =>
          camera.id === cameraId
            ? {
                ...camera,
                checks: camera.checks.map((check) => (check.time_slot === slot ? { ...check, [field]: value } : check))
              }
            : camera
        )
      }))
    }));
  }

  async function save() {
    setSaving(true);
    setMessage('');
    try {
      const response = await api.post(`/checks/day/${date}`, { checks: flatChecks.filter((check) => check.status) });
      await load();
      setMessage(response.data.message || 'Salvo com sucesso.');
    } finally {
      setSaving(false);
    }
  }

  const completed = flatChecks.filter((check) => check.status).length;
  const expected = flatChecks.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Dashboard Diário</h1>
          <p className="text-sm text-slate-500">Selecione a data e o grupo para checar as câmeras nos horários fixos.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select className="input min-w-64" value={selectedVesselId} onChange={(event) => setSelectedVesselId(event.target.value)}>
            <option value="">Todos os grupos</option>
            {allGroups.map((vessel) => (
              <option value={vessel.id} key={vessel.id}>{vessel.name}</option>
            ))}
          </select>
          <input type="date" className="input" value={date} onChange={(event) => setDate(event.target.value)} />
          <button className="btn-primary" onClick={save} disabled={saving}>
            <Save size={16} />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      <div className={`rounded-lg border px-4 py-3 text-sm ${completed === expected ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
        {completed === expected ? 'Todas as câmeras exibidas foram checadas nos 3 horários.' : `Pendências no grupo exibido: ${expected - completed} de ${expected} verificações.`}
      </div>
      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}

      <div className="space-y-5">
        {data?.vessels.map((vessel) => (
          <section className="panel overflow-hidden" key={vessel.id}>
            <div className="border-b border-slate-200 bg-white px-4 py-3">
              <h2 className="font-semibold text-slate-950">{vessel.name}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="w-48 px-4 py-3">Câmera</th>
                    {data.timeSlots.map((slot) => (
                      <th className="px-4 py-3" key={slot}>{slot}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vessel.cameras.map((camera) => (
                    <tr key={camera.id} className="align-top">
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-900">{camera.name}</p>
                        <p className="text-xs text-slate-500">{camera.location}</p>
                      </td>
                      {camera.checks.map((check) => (
                        <td className="px-4 py-4" key={check.time_slot}>
                          <TrafficStatus value={check.status} onChange={(status) => updateCheck(camera.id, check.time_slot, 'status', status)} />
                          <textarea
                            className="input mt-2 min-h-20"
                            placeholder="Observação"
                            value={check.observation || ''}
                            onChange={(event) => updateCheck(camera.id, check.time_slot, 'observation', event.target.value)}
                          />
                          <textarea
                            className="input mt-2 min-h-16"
                            placeholder="Comportamento inadequado"
                            value={check.behavior_note || ''}
                            onChange={(event) => updateCheck(camera.id, check.time_slot, 'behavior_note', event.target.value)}
                          />
                          {check.user_name && (
                            <p className="mt-2 text-xs text-slate-500">Editado por {check.user_name} em {check.updated_at}</p>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
