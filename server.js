require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const multer       = require('multer');
const fs           = require('fs');
const errorHandler = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 3001;

/* ── Directorio de uploads ── */
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

/* ── Multer: subida de imágenes de productos ── */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `img_${Date.now()}${ext}`;
    cb(null, name);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype);
    cb(ok ? null : new Error('Solo se permiten imágenes'), ok);
  }
});

/* ── Cabeceras de seguridad HTTP ── */
app.use(helmet({
  contentSecurityPolicy: false  // desactivado para no romper el admin panel inline
}));

/* ── Middleware global ── */
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10kb' }));

/* ── Rate limiting: máx 10 intentos de login por IP cada 15 min ── */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos. Espera 15 minutos e intenta de nuevo.' },
  standardHeaders: true,
  legacyHeaders:   false
});

/* ── Rate limiting: máx 5 registros por IP por hora ── */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiadas cuentas creadas desde esta IP. Espera una hora.' },
  standardHeaders: true,
  legacyHeaders:   false
});

/* ── Servir admin panel estático + uploads ── */
app.use(express.static(path.join(__dirname, 'public')));

/* ── Ruta raíz → tienda ── */
app.get('/', (req, res) => res.redirect('/tienda.html'));

/* ── Rutas API ── */
app.use('/api/auth',              require('./routes/auth'));
app.use('/api/products',          require('./routes/products'));
app.use('/api/orders',            require('./routes/orders'));
app.use('/api/zones',             require('./routes/zones'));
app.use('/api/users/login',       loginLimiter);
app.use('/api/users/register',    registerLimiter);
app.use('/api/users',             require('./routes/users'));

const db          = require('./db/database');
const requireAuth = require('./middleware/auth');

/* GET /api/categories — atajo directo */
app.get('/api/categories', (req, res) => res.json(db.categories.allWithCount()));

/* GET /api/settings — público (lo consulta la tienda) */
app.get('/api/settings', (req, res) => res.json(db.settings.get()));

/* PATCH /api/settings — solo admin, acepta todos los campos editables */
app.patch('/api/settings', requireAuth, (req, res) => {
  const allowed = [
    'store_open', 'maintenance', 'auto_schedule',
    'name', 'tagline', 'whatsapp', 'phone',
    'description', 'about_text', 'logo_emoji', 'hours',
    'footer_note', 'color_primary', 'color_accent'
  ];
  const patch = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) patch[k] = req.body[k]; });
  res.json(db.settings.set(patch));
});

/* POST /api/upload — subida de imagen [ADMIN] */
app.post('/api/upload', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen' });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url, filename: req.file.filename });
});

/* ── Health check ── */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

/* ── Error handler ── */
app.use(errorHandler);

/* ── Sincronizar admin desde variables de entorno (siempre) ── */
async function syncAdmin() {
  const bcrypt   = require('bcryptjs');
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'pedriexporta2026';
  const hash     = await bcrypt.hash(password, 12);
  db.admins.seed([{ id: 1, username, password_hash: hash }]);
  console.log(`🔑 Admin: ${username}`);
}

/* ── Iniciar servidor ── */
app.listen(PORT, async () => {
  await db.initDB();   // Cargar datos desde Supabase (si está configurado)
  await syncAdmin();
  console.log(`\n⚡ Pedri Exporta API corriendo en http://localhost:${PORT}`);
  console.log(`📋 Panel admin: http://localhost:${PORT}/admin.html`);
});
