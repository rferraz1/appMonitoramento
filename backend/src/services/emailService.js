export async function notifyAccessRequest({ name, email }) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'noreply@baruoffshore.com';

  if (!adminEmail || !apiKey) {
    return { sent: false, reason: 'E-mail não configurado.' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: adminEmail,
      subject: 'Nova solicitação de acesso - Baru Offshore',
      html: `
        <p>Nova solicitação de acesso ao sistema.</p>
        <p><strong>Nome:</strong> ${escapeHtml(name)}</p>
        <p><strong>E-mail:</strong> ${escapeHtml(email)}</p>
        <p>Acesse a aba Usuários para aprovar ou rejeitar.</p>
      `
    })
  });

  if (!response.ok) return { sent: false, reason: await response.text() };
  return { sent: true };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}
