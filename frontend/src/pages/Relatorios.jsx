import { useState } from 'react';

export default function Relatorios() {
  const [form, setForm] = useState({ type: 'daily', value: new Date().toISOString().slice(0, 10), format: 'xlsx' });

  function typeInput() {
    if (form.type === 'annual') return <input className="input" type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />;
    if (form.type === 'monthly') return <input className="input" type="month" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />;
    return <input className="input" type="date" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />;
  }

  function exportReport() {
    const token = localStorage.getItem('token');
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/reports?type=${form.type}&value=${form.value}&format=${form.format}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.blob())
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = `relatorio-${form.type}-${form.value}.${form.format}`;
        link.click();
        URL.revokeObjectURL(objectUrl);
      });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Relatórios</h1>
        <p className="text-sm text-slate-500">Exporte registros e um resumo analítico em Excel, incluindo observações e comportamentos.</p>
      </div>

      <section className="panel max-w-3xl p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Tipo
            <select className="input mt-2" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, value: e.target.value === 'annual' ? new Date().getFullYear().toString() : new Date().toISOString().slice(0, e.target.value === 'monthly' ? 7 : 10) })}>
              <option value="daily">Relatório diário</option>
              <option value="monthly">Relatório mensal</option>
              <option value="annual">Relatório anual</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Período
            <div className="mt-2">{typeInput()}</div>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Formato
            <select className="input mt-2" value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>
              <option value="xlsx">Excel</option>
              <option value="csv">CSV</option>
            </select>
          </label>
        </div>
        <button className="btn-primary mt-6" onClick={exportReport}>Exportar relatório</button>
      </section>
      <section className="panel max-w-3xl border-brand-100 bg-brand-50 p-5 text-sm text-brand-800">
        Os gráficos visuais para reunião podem ser exportados na aba <strong>Analítico</strong>, pelo botão <strong>PDF analítico</strong>.
      </section>
    </div>
  );
}
