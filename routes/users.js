const router          = require('express').Router();
const bcrypt          = require('bcryptjs');
const jwt             = require('jsonwebtoken');
const nodemailer      = require('nodemailer');
const { body, validationResult } = require('express-validator');
const db              = require('../db/database');
const requireAuth     = require('../middleware/auth');
const requireUserAuth = require('../middleware/userAuth');

function getTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

/* ── helpers ── */
function signUserToken(user) {
  return jwt.sign(
    { userId: user.id, role: 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function safeUser(u) {
  const { password_hash, ...rest } = u;
  return rest;
}

/* ── Validaciones de registro ── */
const validarRegistro = [
  body('nombre')
    .trim().escape()
    .notEmpty().withMessage('El nombre es obligatorio.')
    .isLength({ min: 2, max: 50 }).withMessage('El nombre debe tener entre 2 y 50 caracteres.'),

  body('apellido')
    .trim().escape()
    .notEmpty().withMessage('El apellido es obligatorio.')
    .isLength({ min: 2, max: 50 }).withMessage('El apellido debe tener entre 2 y 50 caracteres.'),

  body('correo')
    .trim().normalizeEmail()
    .isEmail().withMessage('El correo electrónico no es válido.')
    .isLength({ max: 255 }).withMessage('El correo es demasiado largo.'),

  body('telefono')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[0-9+\-\s()]{7,20}$/)
    .withMessage('El teléfono solo puede contener números y los símbolos + - ( ).'),

  body('password')
    .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres.')
    .matches(/[A-Z]/).withMessage('La contraseña debe tener al menos una letra mayúscula.')
    .matches(/[0-9]/).withMessage('La contraseña debe tener al menos un número.'),

  body('confirmar_password')
    .custom((value, { req }) => {
      if (value !== req.body.password)
        throw new Error('Las contraseñas no coinciden.');
      return true;
    }),

  body('acepto_terminos')
    .equals('true').withMessage('Debes aceptar los términos y condiciones para registrarte.')
];

/* ── Validaciones de login ── */
const validarLogin = [
  body('correo')
    .trim().normalizeEmail()
    .isEmail().withMessage('Correo electrónico inválido.'),
  body('password')
    .notEmpty().withMessage('La contraseña es obligatoria.')
    .isLength({ max: 128 }).withMessage('Contraseña demasiado larga.')
];

/* ══════════════════════════════════════════════════
   POST /api/users/register
══════════════════════════════════════════════════ */
router.post('/register', validarRegistro, async (req, res, next) => {
  try {
    // Verificar errores de validación
    const errores = validationResult(req);
    if (!errores.isEmpty())
      return res.status(400).json({ error: errores.array()[0].msg });

    const { nombre, apellido, telefono, correo, password, acepto_promociones } = req.body;

    // Verificar correo duplicado
    if (db.users.findByCorreo(correo))
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });

    // Hash de contraseña con 12 salt rounds (seguro y estándar)
    const password_hash = await bcrypt.hash(password, 12);

    const user = db.users.create({
      nombre,
      apellido,
      telefono:           telefono || null,
      correo,
      password_hash,
      acepto_terminos:    true,
      acepto_promociones: acepto_promociones === 'true'
    });

    const token = signUserToken(user);
    res.status(201).json({ token, user: safeUser(user) });
  } catch (err) { next(err); }
});

/* ══════════════════════════════════════════════════
   POST /api/users/login
══════════════════════════════════════════════════ */
router.post('/login', validarLogin, async (req, res, next) => {
  try {
    const errores = validationResult(req);
    if (!errores.isEmpty())
      return res.status(400).json({ error: errores.array()[0].msg });

    const { correo, password } = req.body;

    const user = db.users.findByCorreo(correo);

    // Mismo mensaje para correo y contraseña incorrectos (evita enumerar usuarios)
    if (!user)
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok)
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });

    const token = signUserToken(user);
    res.json({ token, user: safeUser(user) });
  } catch (err) { next(err); }
});

/* GET /api/users/me  [usuario autenticado] */
router.get('/me', requireUserAuth, (req, res) => {
  const user = db.users.findById(req.user.userId);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  const stats = db.users.stats(user.id);
  res.json({ ...safeUser(user), ...stats });
});

/* GET /api/users/me/orders  [usuario autenticado] */
router.get('/me/orders', requireUserAuth, (req, res) => {
  const uid  = parseInt(req.user.userId);
  const ords = db.orders.all()
    .filter(o => o.user_id === uid)
    .sort((a, b) => b.id - a.id);
  res.json(ords);
});

/* GET /api/users  [admin] */
router.get('/', requireAuth, (req, res) => {
  res.json(db.users.listWithStats());
});

/* GET /api/users/:id  [admin] */
router.get('/:id', requireAuth, (req, res) => {
  const user = db.users.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  const stats  = db.users.stats(user.id);
  const orders = db.orders.all()
    .filter(o => o.user_id === user.id)
    .sort((a, b) => b.id - a.id);
  res.json({ ...safeUser(user), ...stats, orders });
});

/* ══════════════════════════════════════════════════
   POST /api/users/forgot-password
   Envía email con link de reset (válido 1 hora)
══════════════════════════════════════════════════ */
router.post('/forgot-password', async (req, res, next) => {
  try {
    const correo = (req.body.correo || '').trim().toLowerCase();
    if (!correo) return res.status(400).json({ error: 'El correo es obligatorio' });

    // Siempre responder OK para no revelar si el correo existe
    const user = db.users.findByCorreo(correo);
    if (!user) return res.json({ ok: true });

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER)
      return res.status(503).json({ error: 'El servicio de correo no está configurado. Contacta al administrador.' });

    const token       = db.resetTokens.create(user.id);
    const frontendUrl = process.env.FRONTEND_URL || `http://localhost:${process.env.PORT || 3003}`;
    const resetLink   = `${frontendUrl}/reset-password.html?token=${token}`;
    const storeName   = (db.settings.get().name) || 'Pedri Exporta';

    await getTransporter().sendMail({
      from:    `"${storeName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to:      user.correo,
      subject: `Recuperar contraseña — ${storeName}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
          <h2 style="color:#c9184a">🔑 Recuperar contraseña</h2>
          <p>Hola <strong>${user.nombre}</strong>,</p>
          <p>Recibimos una solicitud para restablecer tu contraseña en <strong>${storeName}</strong>.</p>
          <p style="margin:24px 0">
            <a href="${resetLink}" style="background:#c9184a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
              Restablecer contraseña
            </a>
          </p>
          <p style="color:#888;font-size:.85rem">Este enlace expira en 1 hora. Si no solicitaste esto, ignora este correo.</p>
        </div>`
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* ══════════════════════════════════════════════════
   POST /api/users/reset-password
   Valida el token y actualiza la contraseña
══════════════════════════════════════════════════ */
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password)
      return res.status(400).json({ error: 'Token y contraseña son obligatorios' });
    if (password.length < 8)
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    if (!/[A-Z]/.test(password))
      return res.status(400).json({ error: 'La contraseña debe tener al menos una letra mayúscula' });
    if (!/[0-9]/.test(password))
      return res.status(400).json({ error: 'La contraseña debe tener al menos un número' });

    const userId = db.resetTokens.consume(token);
    if (!userId) return res.status(400).json({ error: 'El enlace no es válido o ha expirado' });

    const users = db.users.all();
    const idx   = users.findIndex(u => u.id === userId);
    if (idx === -1) return res.status(404).json({ error: 'Usuario no encontrado' });

    users[idx].password_hash = await bcrypt.hash(password, 12);
    const fs   = require('fs');
    const path = require('path');
    fs.writeFileSync(path.join(__dirname, '..', 'data', 'users.json'), JSON.stringify(users, null, 2), 'utf8');

    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
