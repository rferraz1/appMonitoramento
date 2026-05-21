import { buildCameraNameOperations, buildOccurrenceOperations, buildWorkbookOperations, workbookTemplate } from './excelTemplate.js';

export async function testConnection(settings) {
  if (!settings?.excel_url || !settings?.worksheet_name) {
    return { ok: false, message: 'Informe o link do Excel. O padrão da planilha executiva já está configurado.' };
  }

  return {
    ok: true,
    message: `Mock Microsoft Graph: configuração válida para o modelo ${workbookTemplate.name}. Integração real ainda não ativada.`,
    template: workbookTemplate
  };
}

export async function syncChecks(settings, checks, cameras = []) {
  if (!settings?.enabled) {
    return { ok: false, message: 'Integração Excel está desativada.' };
  }

  const workbookOperations = buildWorkbookOperations(checks);
  const occurrenceOperations = buildOccurrenceOperations(checks);
  const cameraNameOperations = buildCameraNameOperations(cameras);

  return {
    ok: true,
    message: `Mock Microsoft Graph: ${workbookOperations.length} atualizações mensais, ${occurrenceOperations.length} ocorrências e ${cameraNameOperations.length} nomes de câmeras preparados para sincronização.`,
    template: workbookTemplate,
    workbookOperations,
    occurrenceOperations,
    cameraNameOperations,
    syncedAt: new Date().toISOString()
  };
}
