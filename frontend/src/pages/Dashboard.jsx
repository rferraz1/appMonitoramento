import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Copy, Save, SignalHigh } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const today = new Date().toISOString().slice(0, 10);
const checkKey = (check) => `${check.camera_id}:${check.time_slot}`;

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
      {value && ['Online', 'Offline'].includes(value) && (
        <p className={`mt-2 text-center text-xs font-semibold ${value === 'Online' ? 'text-emerald-700' : 'text-red-700'}`}>
          Selecionado: {value}
        </p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [date, setDate] = useState(today);
  const [data, setData] = useState(null);
  const [allGroups, setAllGroups] = useState([]);
  const [selectedVesselId, setSelectedVesselId] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('success');
  const [changedKeys, setChangedKeys] = useState(new Set());
  const [repeatDaysOpen, setRepeatDaysOpen] = useState(false);
  const [repeatDaysSaving, setRepeatDaysSaving] = useState(false);
  const [repeatDaysForm, setRepeatDaysForm] = useState({
    sourceDate: today,
    startDate: today,
    endDate: today,
    overwrite: false
  });

  async function load() {
    const response = await api.get(`/checks/day/${date}`, {
      params: selectedVesselId ? { vessel_id: selectedVesselId } : {}
    });
    setData(response.data);
    setChangedKeys(new Set());
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
    if (!Array.isArray(data?.vessels)) return [];
    return data.vessels.flatMap((vessel) =>
      (vessel.cameras || []).flatMap((camera) => camera.checks || [])
    );
  }, [data]);

  function updateCheck(cameraId, slot, field, value) {
    setChangedKeys((current) => new Set(current).add(`${cameraId}:${slot}`));
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

  function fillRemainingOnline(slot) {
    const checksToChange = flatChecks.filter((check) => check.time_slot === slot && !check.status);
    const changed = checksToChange.length;

    setChangedKeys((current) => {
      const next = new Set(current);
      checksToChange.forEach((check) => next.add(checkKey(check)));
      return next;
    });

    setData((current) => ({
      ...current,
      vessels: current.vessels.map((vessel) => ({
        ...vessel,
        cameras: vessel.cameras.map((camera) => ({
          ...camera,
          checks: camera.checks.map((check) => {
            if (check.time_slot !== slot || check.status) return check;
            return { ...check, status: 'Online' };
          })
        }))
      }))
    }));

    setMessageTone('pending');
    setMessage(changed
      ? `${changed} câmeras restantes marcadas Online em ${slot}. Clique em Salvar.`
      : `Nenhuma câmera pendente em ${slot}.`);
  }

  function repeatStatuses(sourceSlot, targetSlot) {
    const checksToChange = (data?.vessels || []).flatMap((vessel) => vessel.cameras.flatMap((camera) => {
      const sourceStatus = camera.checks.find((check) => check.time_slot === sourceSlot)?.status;
      const targetCheck = camera.checks.find((check) => check.time_slot === targetSlot);
      return sourceStatus && sourceStatus !== targetCheck?.status ? [targetCheck] : [];
    }));
    const changed = checksToChange.length;

    setChangedKeys((current) => {
      const next = new Set(current);
      checksToChange.forEach((check) => next.add(checkKey(check)));
      return next;
    });

    setData((current) => ({
      ...current,
      vessels: current.vessels.map((vessel) => ({
        ...vessel,
        cameras: vessel.cameras.map((camera) => {
          const sourceStatus = camera.checks.find((check) => check.time_slot === sourceSlot)?.status;
          if (!sourceStatus) return camera;

          return {
            ...camera,
            checks: camera.checks.map((check) => {
              if (check.time_slot !== targetSlot) return check;
              return { ...check, status: sourceStatus };
            })
          };
        })
      }))
    }));

    setMessageTone('pending');
    setMessage(changed
      ? `${changed} status copiados de ${sourceSlot} para ${targetSlot}. Clique em Salvar.`
      : `Não há alterações para copiar de ${sourceSlot} para ${targetSlot}.`);
  }

  async function save() {
    const changedChecks = flatChecks.filter((check) => changedKeys.has(checkKey(check)) && check.status);
    if (!changedChecks.length) {
      setMessageTone('pending');
      setMessage('Não há alterações para salvar.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const response = await api.post(`/checks/day/${date}`, { checks: changedChecks });
      await load();
      setMessageTone('success');
      setMessage(response.data.message || 'Salvo com sucesso.');
    } catch (error) {
      setMessageTone('error');
      setMessage(error.response?.data?.message || 'Não foi possível salvar os status.');
    } finally {
      setSaving(false);
    }
  }

  function toggleRepeatDays() {
    setRepeatDaysOpen((current) => {
      const next = !current;
      if (next) {
        setRepeatDaysForm((form) => ({
          ...form,
          sourceDate: date,
          startDate: form.startDate || date,
          endDate: form.endDate || date
        }));
      }
      return next;
    });
  }

  async function repeatDays() {
    if (!window.confirm('Repetir os status salvos da data de origem para os dias selecionados?')) return;

    setRepeatDaysSaving(true);
    setMessage('');
    try {
      const response = await api.post('/checks/repeat-days', {
        ...repeatDaysForm,
        vessel_id: selectedVesselId || undefined
      });
      await load();
      setMessageTone(response.data.googleSync?.ok === false ? 'pending' : 'success');
      setMessage(response.data.message || 'Dias repetidos com sucesso.');
    } catch (error) {
      setMessageTone('error');
      setMessage(error.response?.data?.message || 'Não foi possível repetir os dias selecionados.');
    } finally {
      setRepeatDaysSaving(false);
    }
  }

  async function fillMissingDays() {
    if (!window.confirm('Preencher os dias vazios do intervalo copiando o último dia marcado anterior?')) return;

    setRepeatDaysSaving(true);
    setMessage('');
    try {
      const response = await api.post('/checks/fill-missing-days', {
        startDate: repeatDaysForm.startDate,
        endDate: repeatDaysForm.endDate,
        vessel_id: selectedVesselId || undefined
      });
      await load();
      setMessageTone(response.data.googleSync?.ok === false ? 'pending' : 'success');
      setMessage(response.data.message || 'Dias vazios preenchidos com sucesso.');
    } catch (error) {
      setMessageTone('error');
      setMessage(error.response?.data?.message || 'Não foi possível preencher os dias vazios.');
    } finally {
      setRepeatDaysSaving(false);
    }
  }

  const completed = flatChecks.filter((check) => check.status).length;
  const expected = flatChecks.length;
  const canRepeatDays = user?.role === 'admin';

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
      {message && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          messageTone === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : messageTone === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-amber-200 bg-amber-50 text-amber-800'
        }`}>
          {message}
        </div>
      )}

      <section className="panel p-4">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
            <h2 className="font-semibold text-slate-950">Ações rápidas</h2>
            <p className="text-sm text-slate-500">Use Todos os grupos para operar as 60 câmeras.</p>
          </div>
          {canRepeatDays && (
            <button
              type="button"
              className="btn-secondary h-9 w-9 px-0 text-slate-500"
              onClick={toggleRepeatDays}
              title="Repetir dias"
              aria-label="Repetir dias"
              aria-expanded={repeatDaysOpen}
            >
              <CalendarPlus size={16} />
            </button>
          )}
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-[112px_1fr] xl:items-center">
          <span className="text-sm font-medium text-slate-600">Restantes online</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {(data?.timeSlots || []).map((slot) => (
              <button className="btn-secondary h-10 border-emerald-200 px-3 text-emerald-700 hover:bg-emerald-50" onClick={() => fillRemainingOnline(slot)} key={`online-${slot}`}>
                <SignalHigh size={16} />
                {slot}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-[112px_1fr] xl:items-center">
          <span className="text-sm font-medium text-slate-600">Repetir status</span>
          <div className="grid gap-2 sm:grid-cols-2">
            <button className="btn-secondary h-10 px-3" onClick={() => repeatStatuses('10:00', '13:00')}>
              <Copy size={16} />
              10:00 para 13:00
            </button>
            <button className="btn-secondary h-10 px-3" onClick={() => repeatStatuses('13:00', '16:00')}>
              <Copy size={16} />
              13:00 para 16:00
            </button>
          </div>
        </div>
        {canRepeatDays && repeatDaysOpen && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <label className="text-sm font-medium text-slate-700">
                Origem
                <input
                  type="date"
                  className="input mt-2"
                  value={repeatDaysForm.sourceDate}
                  onChange={(event) => setRepeatDaysForm((form) => ({ ...form, sourceDate: event.target.value }))}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Início
                <input
                  type="date"
                  className="input mt-2"
                  value={repeatDaysForm.startDate}
                  onChange={(event) => setRepeatDaysForm((form) => ({ ...form, startDate: event.target.value }))}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Fim
                <input
                  type="date"
                  className="input mt-2"
                  value={repeatDaysForm.endDate}
                  onChange={(event) => setRepeatDaysForm((form) => ({ ...form, endDate: event.target.value }))}
                />
              </label>
              <div className="flex items-end">
                <button className="btn-primary h-10 w-full" onClick={repeatDays} disabled={repeatDaysSaving}>
                  <CalendarPlus size={16} />
                  {repeatDaysSaving ? 'Repetindo...' : 'Repetir'}
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  checked={repeatDaysForm.overwrite}
                  onChange={(event) => setRepeatDaysForm((form) => ({ ...form, overwrite: event.target.checked }))}
                />
                Substituir status já salvos nos dias selecionados
              </label>
              <button className="btn-secondary h-10 border-brand-200 px-3 text-brand-700 hover:bg-brand-50" onClick={fillMissingDays} disabled={repeatDaysSaving}>
                <CalendarPlus size={16} />
                Preencher vazios
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="space-y-5">
        {(data?.vessels || []).map((vessel) => (
          <section className="panel overflow-hidden" key={vessel.id}>
            <div className="border-b border-slate-200 bg-white px-4 py-3">
              <h2 className="font-semibold text-slate-950">{vessel.name}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="w-48 px-4 py-3">Câmera</th>
                    {(data?.timeSlots || []).map((slot) => (
                      <th className="px-4 py-3" key={slot}>{slot}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(vessel.cameras || []).map((camera) => (
                    <tr key={camera.id} className="align-top">
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-900">{camera.name}</p>
                        <p className="text-xs text-slate-500">{camera.location}</p>
                      </td>
                      {(camera.checks || []).map((check) => (
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
