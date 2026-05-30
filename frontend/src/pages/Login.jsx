import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: 'rsferraz', password: '123@Mudar' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Falha no login.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-slate-100 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <img src="/baru-login-boat.jpeg" alt="Embarcação Baru Offshore" className="absolute inset-0 h-full w-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-slate-950/70" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-14 w-24 place-items-center rounded-md bg-white p-2">
            <img src="/baru-logo.png" alt="Baru Offshore" className="max-h-full max-w-full object-contain" />
          </div>
          <div>
            <p className="font-semibold">Baru Offshore</p>
            <p className="text-sm text-slate-400">Controle diário de câmeras</p>
          </div>
        </div>
        <div className="relative max-w-xl">
          <h1 className="text-4xl font-semibold leading-tight">Operação centralizada para checagem de câmeras embarcadas.</h1>
          <p className="mt-5 text-slate-300">
            Registre status por data, horário, barco e câmera com rastreabilidade de edição e relatórios analíticos.
          </p>
        </div>
        <p className="relative text-sm text-slate-300">10:00 | 13:00 | 16:00</p>
      </section>

      <main className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="panel w-full max-w-md p-8">
          <h2 className="text-2xl font-bold text-slate-950">Entrar</h2>
          <p className="mt-1 text-sm text-slate-500">
            Acesse o painel de monitoramento.
          </p>
          {error && <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <label className="mt-6 block text-sm font-medium text-slate-700">
            Usuário
            <input
              className="input mt-2"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Senha
            <input
              className="input mt-2"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          <button className="btn-primary mt-6 w-full" disabled={loading}>
            {loading ? 'Aguarde...' : 'Entrar'}
          </button>
          <p className="mt-4 text-center text-xs text-slate-500">Novos acessos são criados pelo administrador em Usuários e Acessos.</p>
        </form>
      </main>
    </div>
  );
}
