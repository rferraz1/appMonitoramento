import { useEffect, useState } from 'react';
import { FileDown } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api/client.js';
import { StatCard } from '../components/StatCard.jsx';

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
  const chartBox = 'analytics-chart h-72 rounded-lg border border-slate-200 bg-white p-4 shadow-sm';

  return (
    <div className="analytics-report space-y-6">
      <div className="print-report-header hidden">
        <p className="text-xs font-semibold uppercase text-brand-700">Baru Offshore</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">Relatório Analítico</h1>
        <p className="mt-1 text-sm text-slate-500">Período: {periodLabel}</p>
      </div>
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Analítico</h1>
          <p className="text-sm text-slate-500">Cards mostram o último status de cada câmera no período; gráficos analisam as verificações por horário.</p>
        </div>
        <div className="print-hidden grid gap-2 sm:grid-cols-[160px_160px_160px_auto_auto]">
          <input type="month" className="input" value={filters.month} onChange={(e) => setFilters({ ...filters, month: e.target.value, start: '', end: '' })} />
          <input type="date" className="input" value={filters.start} onChange={(e) => setFilters({ ...filters, start: e.target.value })} />
          <input type="date" className="input" value={filters.end} onChange={(e) => setFilters({ ...filters, end: e.target.value })} />
          <button className="btn-primary" onClick={load}>Filtrar</button>
          <button className="btn-secondary" onClick={exportAnalyticalPdf}>
            <FileDown size={16} />
            PDF analítico
          </button>
        </div>
      </div>

      <div className="analytics-cards grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Câmeras monitoradas" value={data?.cards.cameras || 0} />
        <StatCard label="Online atual" value={data?.cards.online || 0} tone="green" />
        <StatCard label="Offline atual" value={data?.cards.offline || 0} tone="red" />
        <StatCard label="Manutenção atual" value={data?.cards.maintenance || 0} tone="yellow" />
        <StatCard label="Sem acesso atual" value={data?.cards.noAccess || 0} tone="gray" />
        <StatCard label="Disponib. atual" value={`${data?.cards.availability || 0}%`} tone="green" />
      </div>

      <div className="analytics-charts grid gap-5 xl:grid-cols-2">
        <div className={chartBox}>
          <h2 className="mb-3 font-semibold">Disponibilidade por barco</h2>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={data?.vesselAvailability || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="disponibilidade" fill="#1f7ab8" /></BarChart>
          </ResponsiveContainer>
        </div>
        <div className={chartBox}>
          <h2 className="mb-3 font-semibold">Problemas por câmera</h2>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={data?.cameraProblems || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#dc2626" /></BarChart>
          </ResponsiveContainer>
        </div>
        <div className={chartBox}>
          <h2 className="mb-3 font-semibold">Online vs Offline por mês</h2>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={data?.onlineOfflineByMonth || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend /><Bar dataKey="Online" fill="#16a34a" /><Bar dataKey="Offline" fill="#dc2626" /></BarChart>
          </ResponsiveContainer>
        </div>
        <div className={chartBox}>
          <h2 className="mb-3 font-semibold">Evolução dos últimos 6 meses</h2>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={data?.sixMonths || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Line type="monotone" dataKey="disponibilidade" stroke="#1f7ab8" strokeWidth={2} /></LineChart>
          </ResponsiveContainer>
        </div>
        <div className={`${chartBox} analytics-chart-annual xl:col-span-2`}>
          <h2 className="mb-3 font-semibold">Visão anual</h2>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={data?.annual || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Line type="monotone" dataKey="disponibilidade" stroke="#0f766e" strokeWidth={2} /></LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
