const router      = require('express').Router();
const db          = require('../db/database');
const requireAuth = require('../middleware/auth');

/* GET /api/categories */
router.get('/categories', (req, res) => {
  res.json(db.categories.allWithCount());
});

/* GET /api/products */
router.get('/', (req, res) => {
  const { category, disponible } = req.query;
  res.json(db.products.list({ category_slug: category, disponible }));
});

/* GET /api/products/:id */
router.get('/:id', (req, res) => {
  const p = db.products.findById(req.params.id);
  if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(p);
});

/* POST /api/products  [ADMIN] */
router.post('/', requireAuth, (req, res, next) => {
  try {
    const { name, category_id, price } = req.body;
    if (!name || !category_id || price === undefined)
      return res.status(400).json({ error: 'name, category_id y price son requeridos' });
    const p = db.products.create(req.body);
    res.status(201).json(p);
  } catch (err) { next(err); }
});

/* PATCH /api/products/:id  [ADMIN] */
router.patch('/:id', requireAuth, (req, res, next) => {
  try {
    const p = db.products.update(req.params.id, req.body);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(p);
  } catch (err) { next(err); }
});

/* PATCH /api/products/:id/toggle  [ADMIN] */
router.patch('/:id/toggle', requireAuth, (req, res, next) => {
  try {
    const p = db.products.toggle(req.params.id);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(p);
  } catch (err) { next(err); }
});

/* DELETE /api/products/:id  [ADMIN] — soft delete */
router.delete('/:id', requireAuth, (req, res, next) => {
  try {
    const p = db.products.softDelete(req.params.id);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ message: 'Producto desactivado', id: p.id });
  } catch (err) { next(err); }
});

/* GET /api/products/:id/variants */
router.get('/:id/variants', requireAuth, (req, res) => {
  res.json(db.variants.byProduct(req.params.id));
});

/* POST /api/products/:id/variants  [ADMIN] */
router.post('/:id/variants', requireAuth, (req, res, next) => {
  try {
    const { label, type } = req.body;
    if (!label || !label.trim())
      return res.status(400).json({ error: 'label es requerido' });
    const v = db.variants.add(req.params.id, label, type || 'weight');
    res.status(201).json(v);
  } catch (err) { next(err); }
});

/* DELETE /api/products/:id/variants/:vid  [ADMIN] */
router.delete('/:id/variants/:vid', requireAuth, (req, res, next) => {
  try {
    const v = db.variants.remove(req.params.vid);
    if (!v) return res.status(404).json({ error: 'Variante no encontrada' });
    res.json({ message: 'Variante eliminada', id: v.id });
  } catch (err) { next(err); }
});

module.exports = router;
