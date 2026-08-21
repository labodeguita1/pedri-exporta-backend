const router      = require('express').Router();
const db          = require('../db/database');
const requireAuth = require('../middleware/auth');

/* GET /api/zones — público (lo consulta la tienda y el carrito) */
router.get('/', (req, res) => {
  const all = db.zones.list();
  // Sin el parámetro ?all=1 solo devuelve las activas
  if (req.query.all !== '1') return res.json(all.filter(z => z.activa));
  res.json(all);
});

/* POST /api/zones [ADMIN] */
router.post('/', requireAuth, (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'name es requerido' });
    res.status(201).json(db.zones.create(req.body));
  } catch (err) { next(err); }
});

/* PATCH /api/zones/:id [ADMIN] */
router.patch('/:id', requireAuth, (req, res, next) => {
  try {
    const z = db.zones.update(req.params.id, req.body);
    if (!z) return res.status(404).json({ error: 'Zona no encontrada' });
    res.json(z);
  } catch (err) { next(err); }
});

/* DELETE /api/zones/:id [ADMIN] */
router.delete('/:id', requireAuth, (req, res, next) => {
  try {
    const z = db.zones.remove(req.params.id);
    if (!z) return res.status(404).json({ error: 'Zona no encontrada' });
    res.json({ ok: true, id: z.id });
  } catch (err) { next(err); }
});

module.exports = router;
