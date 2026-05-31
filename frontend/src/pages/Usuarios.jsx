import { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, Trash2, UserPlus } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Usuarios() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', role: 'operator' });
  const [passwords, setPasswords] = useState({});
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [message, setMessage] = useState('');

  async function load() {
    const usersResponse = await api.get('/users');
    setUsers(usersResponse.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function createUser(event) {
    event.preventDefault();
    setMessage('');
    const password = form.password.trim();
    const confirmPassword = form.confirmPassword.trim();
    if (password !== confirmPassword) {
      setMessage('As senhas digitadas não conferem.');
      return;
    }
    try {
      await api.post('/users', {
        ...form,
        email: form.email.trim(),
        password
      });
      setForm({ name: '', email: '', password: '', confirmPassword: '', role: 'operator' });
      await load();
      setMessage(`Usuário criado com sucesso. Login: ${form.email.trim().toLowerCase()}`);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Não foi possível criar o usuário.');
    }
  }

  async function resetPassword(userId) {
    setMessage('');
    try {
      await api.put(`/users/${userId}/password`, { password: String(passwords[userId] || '').trim() });
      setPasswords((current) => ({ ...current, [userId]: '' }));
      setMessage('Senha redefinida com sucesso.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Não foi possível redefinir a senha.');
    }
  }

  async function deleteUser(user) {
    if (!window.confirm(`Excluir o usuário ${user.email}? Esta ação não pode ser desfeita.`)) return;
    setMessage('');
    try {
      const response = await api.delete(`/users/${user.id}`);
      await load();
      setMessage(response.data?.message || 'Usuário excluído com sucesso.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Não foi possível excluir o usuário.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Usuários e Acessos</h1>
        <p className="text-sm text-slate-500">Crie acessos diretamente no banco do ambiente atual e redefina senhas quando necessário.</p>
      </div>

      {message && <div className="rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700">{message}</div>}

      <section className="panel p-5">
        <h2 className="font-semibold text-slate-950">Novo usuário</h2>
        <form onSubmit={createUser} className="mt-4 grid gap-3 xl:grid-cols-[1fr_1fr_180px_180px_170px_auto]">
          <input className="input" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="E-mail/login" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <div className="relative">
            <input
              className="input pr-10"
              type={showCreatePassword ? 'text' : 'password'}
              placeholder="Senha"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100"
              onClick={() => setShowCreatePassword((value) => !value)}
              title={showCreatePassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showCreatePassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <input
            className="input"
            type={showCreatePassword ? 'text' : 'password'}
            placeholder="Confirmar senha"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          />
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
            <div className="grid gap-3 p-5 xl:grid-cols-[1fr_180px_260px_auto_auto] xl:items-center" key={user.id}>
              <div>
                <p className="font-medium text-slate-900">{user.name}</p>
                <p className="text-sm text-slate-500">{user.email}</p>
              </div>
              <span className="w-fit rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                {user.role === 'admin' ? 'Administrador' : 'Operador'}
              </span>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={visiblePasswords[user.id] ? 'text' : 'password'}
                  placeholder="Nova senha"
                  autoComplete="new-password"
                  value={passwords[user.id] || ''}
                  onChange={(e) => setPasswords((current) => ({ ...current, [user.id]: e.target.value }))}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100"
                  onClick={() => setVisiblePasswords((current) => ({ ...current, [user.id]: !current[user.id] }))}
                  title={visiblePasswords[user.id] ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {visiblePasswords[user.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button className="btn-secondary" onClick={() => resetPassword(user.id)}>
                <KeyRound size={16} />
                Redefinir
              </button>
              <button
                className="btn-secondary border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => deleteUser(user)}
                disabled={Number(user.id) === Number(currentUser?.id)}
                title={Number(user.id) === Number(currentUser?.id) ? 'Você não pode excluir seu próprio usuário logado' : 'Excluir usuário'}
              >
                <Trash2 size={16} />
                Excluir
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
