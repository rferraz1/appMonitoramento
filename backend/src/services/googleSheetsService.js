export async function syncGoogleSheets(settings, checks, { timeoutMs } = {}) {
  if (!settings?.enabled) {
    return { ok: false, skipped: true, message: 'Integração Google Sheets está desativada.' };
  }

  if (!settings?.google_webhook_url) {
    return { ok: false, skipped: true, message: 'Informe a URL do Apps Script para sincronizar a planilha.' };
  }

  const groupedByDate = checks.reduce((groups, check) => {
    const date = check.date || '';
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(check);
    return groups;
  }, new Map());

  let rowsSent = 0;
  for (const [date, dateChecks] of groupedByDate.entries()) {
    const payload = {
      date,
      checks: dateChecks.map((check) => ({
      cameraCode: check.excel_code || String(check.camera_id),
      cameraName: check.camera_name,
      vesselName: check.vessel_name,
      timeSlot: check.time_slot,
      status: check.status,
      observation: check.observation || '',
      behaviorNote: check.behavior_note || '',
      userName: check.user_name || 'Sistema'
      }))
    };

    try {
      const response = await fetch(settings.google_webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        redirect: 'follow',
        signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined
      });

      if (!response.ok) {
        return { ok: false, message: `Google Sheets respondeu com erro ${response.status}.` };
      }
      const result = await response.json().catch(() => null);
      if (!result?.ok) return { ok: false, message: 'O Apps Script não confirmou a atualização da planilha.' };
      rowsSent += Number(result.registros ?? payload.checks.length);
    } catch (error) {
      if (error.name === 'TimeoutError') {
        return { ok: false, message: 'A sincronização da Planilha Google excedeu o tempo de espera.' };
      }
      return { ok: false, message: `Falha ao atualizar a Planilha Google: ${error.message}` };
    }
  }

  return {
    ok: true,
    syncedAt: new Date().toISOString(),
    rowsSent,
    message: `Planilha Google atualizada: ${rowsSent} verificações enviadas.`
  };
}

export async function testGoogleSheetsWebhook(settings) {
  if (!settings?.google_webhook_url) {
    return { ok: false, message: 'Informe a URL do Apps Script.' };
  }

  try {
    const response = await fetch(settings.google_webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '', checks: [] }),
      redirect: 'follow'
    });

    if (!response.ok) return { ok: false, message: `Webhook respondeu com erro ${response.status}.` };
    const result = await response.json().catch(() => null);
    if (!result?.ok) return { ok: false, message: 'O Apps Script não confirmou a conexão.' };
    return { ok: true, message: 'Conexão com Google Sheets confirmada.' };
  } catch (error) {
    return { ok: false, message: `Não foi possível conectar ao Google Sheets: ${error.message}` };
  }
}
