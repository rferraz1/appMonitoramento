export async function syncGoogleSheets(settings, checks) {
  if (!settings?.enabled) {
    return { ok: false, skipped: true, message: 'Integração Google Sheets está desativada.' };
  }

  if (!settings?.google_webhook_url) {
    return { ok: false, skipped: true, message: 'Informe a URL do Apps Script para sincronizar a planilha.' };
  }

  const date = checks[0]?.date || '';
  const payload = {
    date,
    checks: checks.map((check) => ({
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
      redirect: 'follow'
    });

    if (!response.ok) {
      return { ok: false, message: `Google Sheets respondeu com erro ${response.status}.` };
    }
    const result = await response.json().catch(() => null);
    if (!result?.ok) return { ok: false, message: 'O Apps Script não confirmou a atualização da planilha.' };

    return {
      ok: true,
      syncedAt: new Date().toISOString(),
      rowsSent: Number(result.registros ?? payload.checks.length),
      message: `Planilha Google atualizada: ${payload.checks.length} verificações enviadas.`
    };
  } catch (error) {
    return { ok: false, message: `Falha ao atualizar a Planilha Google: ${error.message}` };
  }
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
