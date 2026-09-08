const router      = require('express').Router();
const db          = require('../db/database');
const requireAuth = require('../middleware/auth');
const { getTransporter, mailConfigured } = require('../utils/mailer');

/* Avisar al admin por correo, sin depender de que el cliente mande el WhatsApp */
async function notifyNewOrder(order) {
  console.log('[notifyNewOrder] pedido', order.id,
    'SMTP_HOST=' + JSON.stringify(process.env.SMTP_HOST),
    'SMTP_USER=' + JSON.stringify(process.env.SMTP_USER),
    'ADMIN_NOTIFICATION_EMAIL=' + JSON.stringify(process.env.ADMIN_NOTIFICATION_EMAIL));
  if (!mailConfigured() || !process.env.ADMIN_NOTIFICATION_EMAIL) {
    console.log('[notifyNewOrder] omitido: correo no configurado');
    return;
  }
  try {
    const storeName = (db.settings.get().name) || 'Pedri Exporta';
    const itemsHtml = order.items.map(i =>
      `<tr>
        <td style="padding:6px 10px">${i.product_name}${i.variant_label ? ' (' + i.variant_label + ')' : ''}</td>
        <td style="padding:6px 10px;text-align:center">${i.quantity}</td>
        <td style="padding:6px 10px;text-align:right">$${i.subtotal.toFixed(2)}</td>
      </tr>`
    ).join('');

    await getTransporter().sendMail({
      from:    `"${storeName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to:      process.env.ADMIN_NOTIFICATION_EMAIL,
      subject: `🛒 Nuevo pedido #${order.id} — ${storeName}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px">
          <h2 style="color:#cf142b">🛒 Nuevo pedido #${order.id}</h2>
          <p><strong>Cliente:</strong> ${order.customer_name}<br>
             <strong>Teléfono:</strong> ${order.customer_phone || '—'}<br>
             <strong>Recibe:</strong> ${order.receptor_name || '—'} (${order.receptor_phone || '—'})<br>
             <strong>Dirección:</strong> ${order.customer_address || '—'}<br>
             <strong>Zona:</strong> ${order.zona || '—'}</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <thead><tr style="border-bottom:2px solid #eee;text-align:left">
              <th style="padding:6px 10px">Producto</th><th>Cant.</th><th style="text-align:right">Subtotal</th>
            </tr></thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <p style="font-size:1.1rem"><strong>Total: $${order.total.toFixed(2)}</strong></p>
          ${order.notes ? `<p><strong>Notas:</strong> ${order.notes}</p>` : ''}
        </div>`
    });
    console.log('[notifyNewOrder] correo enviado ok para pedido', order.id);
  } catch (e) {
    console.warn('[notifyNewOrder] ERROR enviando correo para pedido', order.id, ':', e.message);
  }
}

/* POST /api/orders  [PUBLIC] */
router.post('/', (req, res, next) => {
  try {
    const { customer_name, items } = req.body;
    if (!customer_name || !items || !items.length)
      return res.status(400).json({ error: 'customer_name e items son requeridos' });

    const order = db.orders.create(req.body);
    notifyNewOrder(order);
    res.status(201).json(order);
  } catch (err) {
    err.status = 400;
    next(err);
  }
});

/* PATCH /api/orders/:id/whatsapp  [PUBLIC] */
router.patch('/:id/whatsapp', (req, res, next) => {
  try {
    const o = db.orders.markWhatsapp(req.params.id);
    if (!o) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* GET /api/orders/admin/stats  [ADMIN] — debe ir ANTES de /:id */
router.get('/admin/stats', requireAuth, (req, res) => {
  res.json(db.orders.stats());
});

/* GET /api/orders  [ADMIN] */
router.get('/', requireAuth, (req, res) => {
  const { status, date } = req.query;
  res.json(db.orders.list({ status, date }));
});

/* GET /api/orders/:id  [ADMIN] */
router.get('/:id', requireAuth, (req, res) => {
  const o = db.orders.findById(req.params.id);
  if (!o) return res.status(404).json({ error: 'Pedido no encontrado' });
  res.json(o);
});

/* PATCH /api/orders/:id/status  [ADMIN] */
router.patch('/:id/status', requireAuth, (req, res, next) => {
  try {
    const { status } = req.body;
    const valid = ['pendiente', 'confirmado', 'entregado'];
    if (!valid.includes(status))
      return res.status(400).json({ error: `Estado inválido. Use: ${valid.join(', ')}` });

    const o = db.orders.updateStatus(req.params.id, status);
    if (!o) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(o);
  } catch (err) { next(err); }
});

/* DELETE /api/orders/:id  [ADMIN] */
router.delete('/:id', requireAuth, (req, res) => {
  const ok = db.orders.delete(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Pedido no encontrado' });
  res.json({ ok: true });
});

module.exports = router;
