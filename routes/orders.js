const router      = require('express').Router();
const db          = require('../db/database');
const requireAuth = require('../middleware/auth');

/* POST /api/orders  [PUBLIC] */
router.post('/', (req, res, next) => {
  try {
    const { customer_name, items } = req.body;
    if (!customer_name || !items || !items.length)
      return res.status(400).json({ error: 'customer_name e items son requeridos' });

    const order = db.orders.create(req.body);
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
