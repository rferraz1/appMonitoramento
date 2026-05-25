import { useEffect, useState } from 'react';
import { ExternalLink, Plus } from 'lucide-react';
import { api } from '../api/client.js';

export default function ExcelIntegracao() {
  const [settings, setSettings] = useState({
    excel_url: '',
    worksheet_name: '',
    google_sheet_url: '',
    google_webhook_url: '',
    enabled: false,
    last_sync_at: '',
    template: null
  });
  const [message, setMessage] = useState('');
  const [showLinkForm, setShowLinkForm] = useState(false);

  async function load() {
    const response = await api.get('/excel/settings');
    setSettings(response.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    const response = await api.put('/excel/settings', settings);
    setSettings(response.data);
    setMessage('Configurações salvas.');
  }

  async function test() {
    const response = await api.post('/excel/test');
    setMessage(response.data.message);
  }

  async function sync() {
    const response = await api.post('/excel/sync');
    setMessage(response.data.message);
    load();
  }

  async function syncLocal() {
    try {
      const response = await api.post('/excel/sync-local');
      setMessage(response.data.message);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Falha ao sincronizar planilha local.');
    }
  }

  function addSpreadsheetLink() {
    setShowLinkForm(true);
    setTimeout(() => document.getElementById('excel-url')?.focus(), 50);
  }

  function openSpreadsheet() {
    if (!settings.google_sheet_url) {
      setMessage('Cole e salve o link da Planilha Google onde está a aba Base_App.');
      return;
    }
    window.open(settings.google_sheet_url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Integração Planilha</h1>
        <p className="text-sm text-slate-500">Atualização automática de status no Google Sheets por Apps Script.</p>
      </div>

      <section className="panel max-w-4xl p-5">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold text-slate-950">Planilha Google</h2>
            <p className="text-sm text-slate-500">Configure a planilha e o webhook que receberá os status salvos no dashboard.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={addSpreadsheetLink}>
              <Plus size={16} />
              Link Google Sheets
            </button>
            <button className="btn-secondary" onClick={openSpreadsheet}>
              <ExternalLink size={16} />
              Abrir planilha
            </button>
          </div>
        </div>
        {message && <div className="mb-4 rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-700">{message}</div>}
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-semibold">Integração via Google Apps Script</p>
            <p className="mt-1">
              Ao clicar em Salvar no dashboard, os registros são enviados para a aba Base_App da planilha configurada.
            </p>
          </div>
          {(showLinkForm || settings.google_sheet_url) && (
            <label className="block text-sm font-medium text-slate-700">
              Link da Planilha Google
              <input
                id="excel-url"
                className="input mt-2"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={settings.google_sheet_url || ''}
                onChange={(e) => setSettings({ ...settings, google_sheet_url: e.target.value })}
              />
            </label>
          )}
          <label className="block text-sm font-medium text-slate-700">
            URL do Apps Script
            <input
              className="input mt-2"
              placeholder="https://script.google.com/macros/s/.../exec"
              value={settings.google_webhook_url || ''}
              onChange={(e) => setSettings({ ...settings, google_webhook_url: e.target.value })}
            />
            <span className="mt-1 block text-xs text-slate-500">URL gerada em Implantar &gt; App da Web no Apps Script.</span>
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} />
            Ativar atualização automática no Google Sheets
          </label>
          {settings.last_sync_at && <p className="text-sm text-slate-500">Última sincronização: {settings.last_sync_at}</p>}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="btn-primary" onClick={save}>Salvar configuração</button>
          <button className="btn-secondary" onClick={test}>Testar conexão</button>
          <button className="btn-secondary" onClick={sync}>Enviar registros salvos</button>
          {import.meta.env.DEV && <button className="btn-secondary" onClick={syncLocal}>Sincronizar planilha local</button>}
        </div>
      </section>

      <section className="panel max-w-4xl p-5">
        <h2 className="font-semibold text-slate-950">Dados enviados para Base_App</h2>
        <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <div className="rounded-md border border-slate-200 p-3">
            <p className="font-medium text-slate-900">Identificação</p>
            <p className="mt-1">Data, ID, Nome da Camera, Grupo e Horario</p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="font-medium text-slate-900">Monitoramento</p>
            <p className="mt-1">Status, Observacao, Comportamento, Responsavel e AtualizadoEm</p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="font-medium text-slate-900">Atualização</p>
            <p className="mt-1">A mesma combinação Data + ID + Horario é atualizada quando houver nova edição.</p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="font-medium text-slate-900">Status</p>
            <p className="mt-1">Online e Offline selecionados no painel diário são enviados no salvamento.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
