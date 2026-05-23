import { useEffect, useState } from 'react';
import { KeyRound, UserPlus } from 'lucide-react';
import { api } from '../api/client.js';

export default function Usuarios() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'operator' });
  const [passwords, setPasswords] = useState({});
  const [message, setMessage] = useState('');

  async function load() {
    const response = await api.get('/users');
    setUsers(response.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function createUser(event) {
    event.preventDefault();
    setMessage('');
    try {
      await api.post('/users', form);
      setForm({ name: '', email: '', password: '', role: 'operator' });
      await load();
      setMessage('Usuário criado com sucesso.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Não foi possível criar o usuário.');
    }
  }

  async function resetPassword(userId) {
    setMessage('');
    try {
      await api.put(`/users/${userId}/password`, { password: passwords[userId] || '' });
      setPasswords((current) => ({ ...current, [userId]: '' }));
      setMessage('Senha redefinida com sucesso.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Não foi possível redefinir a senha.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Usuários e Acessos</h1>
        <p className="text-sm text-slate-500">Crie acessos autorizados por você usando e-mail e senha.</p>
      </div>

      {message && <div className="rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700">{message}</div>}

      <section className="panel p-5">
        <h2 className="font-semibold text-slate-950">Novo usuário</h2>
        <form onSubmit={createUser} className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_160px_180px_auto]">
          <input className="input" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="E-mail/login" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input" type="password" placeholder="Senha" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="operator">Operador</option>
            <option value="admin">Administrador</option>
          </select>
          <button className="btn-primary">
            <UserPlus size={16} />
            Criar
          </button>
        </form>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-950">Usuários cadastrados</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {users.map((user) => (
            <div className="grid gap-3 p-5 lg:grid-cols-[1fr_180px_260px_auto] lg:items-center" key={user.id}>
              <div>
                <p className="font-medium text-slate-900">{user.name}</p>
                <p className="text-sm text-slate-500">{user.email}</p>
              </div>
              <span className="w-fit rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                {user.role === 'admin' ? 'Administrador' : 'Operador'}
              </span>
              <input
                className="input"
                type="password"
                placeholder="Nova senha"
                value={passwords[user.id] || ''}
                onChange={(e) => setPasswords((current) => ({ ...current, [user.id]: e.target.value }))}
              />
              <button className="btn-secondary" onClick={() => resetPassword(user.id)}>
                <KeyRound size={16} />
                Redefinir
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
