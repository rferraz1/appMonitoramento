import { useEffect, useMemo, useState } from 'react';
import { PackagePlus, Pencil } from 'lucide-react';
import { api } from '../api/client.js';
import { StatCard } from '../components/StatCard.jsx';

const emptyForm = {
  category: '',
  name: '',
  model: '',
  quantity: 1,
  received_at: new Date().toISOString().slice(0, 10),
  notes: ''
};

export default function EstoqueTI() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('success');

  async function load() {
    const response = await api.get('/inventory');
    setItems(response.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveItem(event) {
    event.preventDefault();
    setMessage('');
    try {
      if (editingId) {
        await api.put(`/inventory/${editingId}`, form);
      } else {
        await api.post('/inventory', form);
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
      setMessageTone('success');
      setMessage(editingId ? 'Equipamento atualizado.' : 'Equipamento cadastrado no estoque.');
    } catch (error) {
      setMessageTone('error');
      setMessage(error.response?.data?.message || 'Não foi possível salvar o equipamento.');
    }
  }

  function editItem(item) {
    setEditingId(item.id);
    setForm({
      category: item.category,
      name: item.name,
      model: item.model || '',
      quantity: item.quantity,
      received_at: item.received_at || '',
      notes: item.notes || ''
    });
    setMessage('');
  }

  const summary = useMemo(() => ({
    types: items.length,
    units: items.reduce((total, item) => total + Number(item.quantity || 0), 0),
    categories: new Set(items.map((item) => item.category)).size
  }), [items]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Estoque de TI</h1>
        <p className="text-sm text-slate-500">Controle de equipamentos recebidos e quantidades disponíveis.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Itens cadastrados" value={summary.types} />
        <StatCard label="Unidades em estoque" value={summary.units} tone="green" />
        <StatCard label="Categorias" value={summary.categories} />
      </div>

      {message && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          messageTone === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-red-200 bg-red-50 text-red-800'
        }`}>
          {message}
        </div>
      )}

      <section className="panel p-5">
        <h2 className="font-semibold text-slate-950">{editingId ? 'Editar equipamento' : 'Cadastrar equipamento recebido'}</h2>
        <form onSubmit={saveItem} className="mt-4 grid gap-3 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Categoria</label>
            <input
              className="input"
              list="inventory-categories"
              placeholder="Ex.: Periféricos ou Celulares"
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              required
            />
            <datalist id="inventory-categories">
              <option value="Periféricos" />
              <option value="Celulares" />
              <option value="Computadores" />
              <option value="Rede" />
              <option value="Acessórios" />
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Equipamento</label>
            <input
              className="input"
              placeholder="Ex.: Kit mouse e teclado"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Modelo</label>
            <input
              className="input"
              placeholder="Ex.: Samsung Galaxy A15"
              value={form.model}
              onChange={(event) => setForm({ ...form, model: event.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Quantidade</label>
            <input
              className="input"
              type="number"
              min="0"
              step="1"
              value={form.quantity}
              onChange={(event) => setForm({ ...form, quantity: event.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Data de recebimento</label>
            <input
              className="input"
              type="date"
              value={form.received_at}
              onChange={(event) => setForm({ ...form, received_at: event.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Observação</label>
            <input
              className="input"
              placeholder="Informação complementar"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </div>
          <div className="flex gap-2 lg:col-span-3 lg:justify-end">
            {editingId && (
              <button type="button" className="btn-secondary" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
                Cancelar
              </button>
            )}
            <button className="btn-primary">
              <PackagePlus size={16} />
              {editingId ? 'Atualizar' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-950">Equipamentos cadastrados</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[800px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Categoria</th>
                <th className="px-5 py-3">Equipamento</th>
                <th className="px-5 py-3">Modelo</th>
                <th className="px-5 py-3">Quantidade</th>
                <th className="px-5 py-3">Recebido em</th>
                <th className="px-5 py-3">Observação</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 && (
                <tr><td className="px-5 py-5 text-slate-500" colSpan="7">Nenhum equipamento cadastrado.</td></tr>
              )}
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-4 text-slate-600">{item.category}</td>
                  <td className="px-5 py-4 font-medium text-slate-900">{item.name}</td>
                  <td className="px-5 py-4 text-slate-600">{item.model || '-'}</td>
                  <td className="px-5 py-4 font-semibold text-slate-900">{item.quantity}</td>
                  <td className="px-5 py-4 text-slate-600">{item.received_at || '-'}</td>
                  <td className="px-5 py-4 text-slate-600">{item.notes || '-'}</td>
                  <td className="px-5 py-4">
                    <button className="btn-secondary" onClick={() => editItem(item)}>
                      <Pencil size={15} />
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
