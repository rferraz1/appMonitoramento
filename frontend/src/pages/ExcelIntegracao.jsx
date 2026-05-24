import { useEffect, useState } from 'react';
import { Download, ExternalLink, Plus } from 'lucide-react';
import { api } from '../api/client.js';

export default function ExcelIntegracao() {
  const [settings, setSettings] = useState({ excel_url: '', worksheet_name: '', enabled: false, last_sync_at: '', template: null });
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
    if (!settings.excel_url) {
      setMessage('Cole e salve um link do OneDrive/SharePoint para abrir a planilha online.');
      return;
    }
    window.open(settings.excel_url, '_blank', 'noopener,noreferrer');
  }

  async function downloadLocalWorkbook() {
    try {
      const response = await api.get('/excel/local-workbook', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'PLANILHAFINAL.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setMessage('Planilha baixada.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Não foi possível baixar a planilha.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Integração Excel</h1>
        <p className="text-sm text-slate-500">Preparado para Microsoft Graph API com workbooks no OneDrive ou SharePoint.</p>
      </div>

      <section className="panel max-w-4xl p-5">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold text-slate-950">Arquivo Excel</h2>
            <p className="text-sm text-slate-500">Abra a planilha online pelo link salvo ou baixe o modelo local.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={addSpreadsheetLink}>
              <Plus size={16} />
              Link da planilha
            </button>
            <button className="btn-secondary" onClick={openSpreadsheet}>
              <ExternalLink size={16} />
              Abrir planilha online
            </button>
            <button className="btn-secondary" onClick={downloadLocalWorkbook}>
              <Download size={16} />
              Baixar planilha local
            </button>
          </div>
        </div>
        {message && <div className="mb-4 rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-700">{message}</div>}
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-semibold">Modelo configurado: PLANILHAFINAL.xlsx</p>
            <p className="mt-1">
              O sistema já está preparado para preencher as abas Janeiro a Dezembro, colunas 10:00, 13:00, 16:00,
              eventos técnicos, comportamento do colaborador, responsável e a aba Ocorrências.
            </p>
          </div>
          {(showLinkForm || settings.excel_url) && (
            <label className="block text-sm font-medium text-slate-700">
              Link do arquivo Excel no OneDrive/SharePoint
              <input
                id="excel-url"
                className="input mt-2"
                placeholder="Cole aqui o link da planilha"
                value={settings.excel_url || ''}
                onChange={(e) => setSettings({ ...settings, excel_url: e.target.value })}
              />
            </label>
          )}
          <label className="block text-sm font-medium text-slate-700">
            Nome da aba da planilha
            <input className="input mt-2" value={settings.worksheet_name || ''} onChange={(e) => setSettings({ ...settings, worksheet_name: e.target.value })} />
            <span className="mt-1 block text-xs text-slate-500">Use “Mensal automático: Janeiro a Dezembro” para esta planilha.</span>
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} />
            Ativar integração
          </label>
          {settings.last_sync_at && <p className="text-sm text-slate-500">Última sincronização: {settings.last_sync_at}</p>}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="btn-primary" onClick={save}>Salvar configuração</button>
          <button className="btn-secondary" onClick={test}>Testar conexão</button>
          <button className="btn-secondary" onClick={sync}>Sincronizar dados</button>
          <button className="btn-secondary" onClick={syncLocal}>Sincronizar planilha local</button>
        </div>
      </section>

      <section className="panel max-w-4xl p-5">
        <h2 className="font-semibold text-slate-950">Mapeamento da planilha</h2>
        <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <div className="rounded-md border border-slate-200 p-3">
            <p className="font-medium text-slate-900">Abas mensais</p>
            <p className="mt-1">Janeiro, Fevereiro, Março, Abril, Maio, Junho, Julho, Agosto, Setembro, Outubro, Novembro, Dezembro</p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="font-medium text-slate-900">Colunas atualizadas</p>
            <p className="mt-1">F: 10:00 · G: 13:00 · H: 16:00 · I: Evento técnico · J: Comportamento · K: Responsável</p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="font-medium text-slate-900">Identificação da linha</p>
            <p className="mt-1">Data + ID da câmera no formato CAM 01, CAM 02, CAM 03...</p>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="font-medium text-slate-900">Ocorrências</p>
            <p className="mt-1">Eventos, comportamentos e status diferente de Online são preparados para a aba Ocorrências.</p>
          </div>
          <div className="rounded-md border border-slate-200 p-3 md:col-span-2">
            <p className="font-medium text-slate-900">Novas câmeras</p>
            <p className="mt-1">
              O cadastro já aceita novas câmeras. Na sincronização, cada câmera é enviada com seu código CAM e o nome atual do app.
              Se você editar o nome da câmera no cadastro, a operação de sincronização também prepara a alteração desse nome nas abas mensais e na aba Configurações.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
