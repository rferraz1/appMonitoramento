import { useEffect, useState } from 'react';
import { Activity, Camera, CalendarDays, FileDown, ShieldCheck, SignalHigh, SignalZero, Wrench } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api/client.js';

const monthlyStatuses = ['Online', 'Offline', 'Manutenção', 'Sem acesso'];
const chartGrid = '#e2e8f0';
const chartTick = { fontSize: 12, fill: '#64748b' };

function MonthlyStatusTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 text-xs shadow-sm">
      <p className="mb-2 font-semibold text-slate-900">{label} · {row.totalRecords} verificações</p>
      {monthlyStatuses.map((status) => (
        <p className="text-slate-600" key={status}>
          {status}: <span className="font-semibold">{row[status]}%</span> ({row[`${status} registros`]})
        </p>
      ))}
    </div>
  );
}

function MetricCard({ label, value, description, tone = 'default', icon: Icon }) {
  const tones = {
    default: 'border-slate-200 text-slate-700',
    brand: 'border-brand-100 bg-brand-50/60 text-brand-700',
    green: 'border-emerald-100 bg-emerald-50/65 text-emerald-700',
    red: 'border-red-100 bg-red-50/65 text-red-700',
    yellow: 'border-amber-100 bg-amber-50/65 text-amber-700',
    gray: 'border-slate-200 bg-slate-50 text-slate-600'
  };

  return (
    <article className={`stat-card analytics-metric rounded-xl border bg-white p-4 shadow-sm ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <span className="rounded-lg bg-white/80 p-2 shadow-sm ring-1 ring-black/5">
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </article>
  );
}

function ChartPanel({ title, context, className = '', children, style }) {
  return (
    <section className={`analytics-chart analytics-panel rounded-xl border border-slate-200 bg-white shadow-sm ${className}`} style={style}>
      <div className="border-b border-slate-100 px-5 pb-3 pt-4">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{context}</p>
      </div>
      <div className="analytics-chart-body px-3 pb-4 pt-3">
        {children}
      </div>
    </section>
  );
}

export default function Analitico() {
  const [filters, setFilters] = useState({ month: new Date().toISOString().slice(0, 7), start: '', end: '' });
  const [data, setData] = useState(null);

  async function load() {
    const params = filters.start && filters.end ? { start: filters.start, end: filters.end } : { month: filters.month };
    const response = await api.get('/analytics', { params });
    setData(response.data);
  }

  useEffect(() => {
    load();
  }, []);

  function exportAnalyticalPdf() {
    const previousTitle = document.title;
    document.title = `Baru-Offshore-Analitico-${filters.start && filters.end ? `${filters.start}-${filters.end}` : filters.month}`;
    window.print();
    document.title = previousTitle;
  }

  const periodLabel = filters.start && filters.end ? `${filters.start} a ${filters.end}` : filters.month;
  const checksLabel = data?.cards.records || 0;
  const problemsChartHeight = Math.max(320, (data?.cameraProblems?.length || 0) * 34 + 70);

  return (
    <div className="analytics-report space-y-6">
      <div className="print-report-header hidden">
        <p className="text-xs font-semibold uppercase text-brand-700">Baru Offshore</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">Relatório Analítico</h1>
        <p className="mt-1 text-sm text-slate-500">Período: {periodLabel}</p>
      </div>
      <section className="analytics-hero print-hidden overflow-hidden rounded-2xl bg-slate-950 text-white shadow-sm">
        <div className="grid gap-6 p-6 xl:grid-cols-[1fr_590px] xl:items-end">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-brand-100">Baru Offshore · Inteligência operacional</p>
            <h1 className="text-3xl font-semibold tracking-tight">Painel Analítico</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
              Disponibilidade das câmeras embarcadas e ocorrências registradas nos horários operacionais.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-slate-100">
                <CalendarDays size={15} className="text-brand-100" />
                Período: {periodLabel}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-slate-100">
                <Activity size={15} className="text-emerald-300" />
                {checksLabel} verificações registradas
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Filtros do relatório</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs text-slate-300">
                Mês
                <input type="month" className="analytics-filter mt-1" value={filters.month} onChange={(e) => setFilters({ ...filters, month: e.target.value, start: '', end: '' })} />
              </label>
              <label className="text-xs text-slate-300">
                Data inicial
                <input type="date" className="analytics-filter mt-1" value={filters.start} onChange={(e) => setFilters({ ...filters, start: e.target.value })} />
              </label>
              <label className="text-xs text-slate-300">
                Data final
                <input type="date" className="analytics-filter mt-1" value={filters.end} onChange={(e) => setFilters({ ...filters, end: e.target.value })} />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-secondary border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={exportAnalyticalPdf}>
                <FileDown size={16} />
                PDF executivo
              </button>
              <button className="btn-primary bg-brand-500 hover:bg-brand-600" onClick={load}>Aplicar filtros</button>
            </div>
          </div>
        </div>
      </section>

      <div className="analytics-cards grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Câmeras" value={data?.cards.cameras || 0} description="Monitoradas no período" tone="brand" icon={Camera} />
        <MetricCard label="Online atual" value={data?.cards.online || 0} description="Último status" tone="green" icon={SignalHigh} />
        <MetricCard label="Offline atual" value={data?.cards.offline || 0} description="Último status" tone="red" icon={SignalZero} />
        <MetricCard label="Manutenção" value={data?.cards.maintenance || 0} description="Último status" tone="yellow" icon={Wrench} />
        <MetricCard label="Sem acesso" value={data?.cards.noAccess || 0} description="Último status" tone="gray" icon={Activity} />
        <MetricCard label="Disponibilidade" value={`${data?.cards.availability || 0}%`} description="Situação atual" tone="green" icon={ShieldCheck} />
      </div>

      <div className="analytics-charts grid gap-5 xl:grid-cols-2">
        <ChartPanel title="Disponibilidade por grupo" context="Percentual Online considerando as verificações do período." className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.groupAvailability || []} layout="vertical" margin={{ left: 4, right: 28 }}>
              <CartesianGrid stroke={chartGrid} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} unit="%" tick={chartTick} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" width={205} interval={0} tick={chartTick} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value) => [`${value}%`, 'Disponibilidade']} />
              <Bar dataKey="disponibilidade" fill="#1677ad" radius={[0, 6, 6, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Status por mês" context="Composição percentual dos registros em cada mês." className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.monthlyStatus || []}>
              <CartesianGrid stroke={chartGrid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={chartTick} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} unit="%" tick={chartTick} axisLine={false} tickLine={false} />
              <Tooltip content={<MonthlyStatusTooltip />} />
              <Legend />
              <Bar dataKey="Online" stackId="status" fill="#059669" />
              <Bar dataKey="Offline" stackId="status" fill="#dc2626" />
              <Bar dataKey="Manutenção" stackId="status" fill="#d97706" />
              <Bar dataKey="Sem acesso" stackId="status" fill="#64748b" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel
          title="Problemas por câmera"
          context="Ocorrências Offline, Manutenção ou Sem acesso, identificadas por grupo."
          className="analytics-chart-problems xl:col-span-2"
          style={{ height: `${problemsChartHeight}px` }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.cameraProblems || []} layout="vertical" margin={{ left: 8, right: 28 }}>
              <CartesianGrid stroke={chartGrid} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={chartTick} axisLine={false} tickLine={false} />
              <YAxis dataKey="label" type="category" width={430} interval={0} tick={chartTick} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value) => [value, 'Ocorrências']} />
              <Bar dataKey="value" fill="#dc2626" radius={[0, 6, 6, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Evolução dos últimos 6 meses" context="Tendência histórica de disponibilidade." className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.sixMonths || []}><CartesianGrid stroke={chartGrid} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={chartTick} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} unit="%" tick={chartTick} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [`${value}%`, 'Disponibilidade']} /><Line type="monotone" dataKey="disponibilidade" stroke="#1677ad" strokeWidth={3} dot={{ r: 4, fill: '#1677ad' }} /></LineChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Visão anual" context="Disponibilidade consolidada por ano." className="analytics-chart-annual h-[320px] xl:col-span-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.annual || []}><CartesianGrid stroke={chartGrid} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={chartTick} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} unit="%" tick={chartTick} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [`${value}%`, 'Disponibilidade']} /><Line type="monotone" dataKey="disponibilidade" stroke="#0f766e" strokeWidth={3} dot={{ r: 5, fill: '#0f766e' }} /></LineChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>
    </div>
  );
}
