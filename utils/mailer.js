/**
 * Envío de correo vía la API HTTP de Resend (no SMTP).
 * Railway bloquea conexiones salientes por el puerto SMTP (587/465),
 * así que usamos su API sobre HTTPS, que sí funciona.
 * La API key de Resend se guarda en SMTP_PASS para no pedir otra variable.
 */
async function sendMail({ from, to, subject, html }) {
  const apiKey = process.env.SMTP_PASS;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to, subject, html })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
  return res.json();
}

function mailConfigured() {
  return !!(process.env.SMTP_PASS && process.env.SMTP_FROM);
}

module.exports = { sendMail, mailConfigured };
