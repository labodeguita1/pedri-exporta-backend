/**
 * db/database.js — Motor de datos con Supabase + fallback JSON
 * Si SUPABASE_URL y SUPABASE_KEY están configurados, persiste en la nube.
 * Si no, usa archivos JSON locales.
 */

const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/* ── Cache en memoria ── */
const cache = {};

/* ── Cliente Supabase (lazy) ── */
let supabase = null;
function getSB() {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) return null;
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(url, key);
  return supabase;
}

/* ── Cargar datos desde Supabase al arrancar ── */
async function initDB() {
  const sb = getSB();
  if (!sb) {
    console.log('📁 Almacenamiento: archivos JSON locales');
    return;
  }
  try {
    const { data, error } = await sb.from('store').select('id, data');
    if (error) throw error;
    for (const row of (data || [])) {
      cache[row.id] = row.data;
    }
    console.log(`☁️  Supabase: ${(data||[]).length} colecciones cargadas`);
  } catch (e) {
    console.warn('⚠️  Supabase no disponible, usando JSON:', e.message);
  }
}

/* ── Helpers de lectura/escritura ── */
function readFile(name) {
  if (cache[name] !== undefined) return cache[name];
  const file = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return []; }
}

function writeFile(name, data) {
  cache[name] = data;
  // Guardar JSON local (desarrollo)
  try {
    const file = path.join(DATA_DIR, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch {}
  // Persistir en Supabase (producción) — fire and forget
  const sb = getSB();
  if (sb) {
    sb.from('store')
      .upsert({ id: name, data, updated_at: new Date().toISOString() })
      .then(({ error }) => { if (error) console.warn('Supabase write error:', name, error.message); })
      .catch(e => console.warn('Supabase write error:', name, e.message));
  }
}

/* ── Auto-increment ID ── */
function nextId(collection) {
  if (!Array.isArray(collection) || !collection.length) return 1;
  return Math.max(...collection.map(r => r.id)) + 1;
}

/* ── Timestamp ── */
function now() { return new Date().toISOString(); }

/* ══════════════════════════════════════════════════
   CATEGORÍAS
══════════════════════════════════════════════════ */
const categories = {
  all() { return readFile('categories'); },

  findBySlug(slug) {
    return this.all().find(c => c.slug === slug) || null;
  },

  allWithCount() {
    const cats  = this.all();
    const prods = products.all();
    return cats.map(c => ({
      ...c,
      product_count: prods.filter(p => p.category_id === c.id && !p.deleted).length
    })).sort((a, b) => a.sort_order - b.sort_order);
  },

  seed(rows) {
    writeFile('categories', rows);
  }
};

/* ══════════════════════════════════════════════════
   PRODUCTOS
══════════════════════════════════════════════════ */
const products = {
  all() { return readFile('products'); },

  list({ category_slug, disponible } = {}) {
    let rows = this.all().filter(p => !p.deleted);
    if (category_slug) {
      const cat = categories.findBySlug(category_slug);
      if (cat) rows = rows.filter(p => p.category_id === cat.id);
    }
    if (disponible !== undefined) {
      rows = rows.filter(p => p.disponible === (disponible === '1' || disponible === true));
    }
    const cats     = categories.all();
    const variants = readFile('variants');
    return rows.map(p => ({
      ...p,
      category: cats.find(c => c.id === p.category_id) || null,
      variants:  variants.filter(v => v.product_id === p.id)
    }));
  },

  findById(id) {
    const p        = this.all().find(p => p.id === +id && !p.deleted);
    if (!p) return null;
    const cats     = categories.all();
    const variants = readFile('variants');
    return {
      ...p,
      category: cats.find(c => c.id === p.category_id) || null,
      variants:  variants.filter(v => v.product_id === p.id)
    };
  },

  create(data) {
    const rows = this.all();
    const item = {
      id:                   nextId(rows),
      category_id:          data.category_id,
      name:                 data.name,
      description:          data.description || '',
      price:                parseFloat(data.price),
      old_price:            data.old_price ? parseFloat(data.old_price) : null,
      image_url:            data.image_url || '',
      disponible:           data.disponible !== false,
      has_weight_selector:  !!data.has_weight_selector,
      has_flavor_selector:  !!data.has_flavor_selector,
      deleted:              false,
      created_at:           now(),
      updated_at:           now()
    };
    rows.push(item);
    writeFile('products', rows);
    return item;
  },

  update(id, data) {
    const rows = this.all();
    const idx  = rows.findIndex(p => p.id === +id);
    if (idx === -1) return null;
    const allowed = ['name','description','price','old_price','image_url',
                     'disponible','has_weight_selector','has_flavor_selector','category_id'];
    allowed.forEach(k => { if (data[k] !== undefined) rows[idx][k] = data[k]; });
    if (data.price)     rows[idx].price     = parseFloat(data.price);
    if (data.old_price) rows[idx].old_price = parseFloat(data.old_price);
    rows[idx].updated_at = now();
    writeFile('products', rows);
    return rows[idx];
  },

  toggle(id) {
    const rows = this.all();
    const idx  = rows.findIndex(p => p.id === +id);
    if (idx === -1) return null;
    rows[idx].disponible  = !rows[idx].disponible;
    rows[idx].updated_at  = now();
    writeFile('products', rows);
    return rows[idx];
  },

  softDelete(id) {
    const rows = this.all();
    const idx  = rows.findIndex(p => p.id === +id);
    if (idx === -1) return null;
    rows[idx].deleted     = true;
    rows[idx].disponible  = false;
    rows[idx].updated_at  = now();
    writeFile('products', rows);
    return rows[idx];
  },

  seed(rows) { writeFile('products', rows); }
};

/* ══════════════════════════════════════════════════
   VARIANTES
══════════════════════════════════════════════════ */
const variants = {
  all() { return readFile('variants'); },

  byProduct(product_id) {
    const pid = parseInt(product_id);
    return this.all().filter(v => v.product_id === pid).sort((a, b) => a.sort_order - b.sort_order);
  },

  add(product_id, label, type = 'weight') {
    const rows = this.all();
    const pid  = parseInt(product_id);
    const maxId    = rows.reduce((m, v) => Math.max(m, v.id), 0);
    const maxOrder = rows.filter(v => v.product_id === pid && v.type === type).reduce((m, v) => Math.max(m, v.sort_order), 0);
    const item = { id: maxId + 1, product_id: pid, type, label: label.trim(), price_modifier: 0, sort_order: maxOrder + 1 };
    rows.push(item);
    writeFile('variants', rows);
    return item;
  },

  remove(variant_id) {
    const vid  = parseInt(variant_id);
    const rows = this.all();
    const idx  = rows.findIndex(v => v.id === vid);
    if (idx === -1) return null;
    const removed = rows.splice(idx, 1)[0];
    writeFile('variants', rows);
    return removed;
  },

  seed(rows) { writeFile('variants', rows); }
};

/* ══════════════════════════════════════════════════
   PEDIDOS
══════════════════════════════════════════════════ */
const orders = {
  all() { return readFile('orders'); },

  list({ status, date } = {}) {
    let rows = this.all();
    if (status) rows = rows.filter(o => o.status === status);
    if (date)   rows = rows.filter(o => o.created_at.startsWith(date));
    return rows.sort((a, b) => b.id - a.id);
  },

  findById(id) {
    return this.all().find(o => o.id === +id) || null;
  },

  create({ customer_name, customer_phone, receptor_name, receptor_phone, customer_address, notes, items, zona, costo_envio, user_id }) {
    const rows  = this.all();
    const prods = products.all();

    const lineItems = items.map(item => {
      const prod = prods.find(p => p.id === +item.product_id);
      if (!prod) throw new Error(`Producto ${item.product_id} no encontrado`);
      const subtotal = prod.price * item.quantity;
      return {
        product_id:    prod.id,
        product_name:  prod.name,
        product_price: prod.price,
        variant_label: item.variant_label || null,
        quantity:      item.quantity,
        subtotal
      };
    });

    const subtotal = lineItems.reduce((s, i) => s + i.subtotal, 0);
    const total    = subtotal + (costo_envio || 0);

    const order = {
      id:               nextId(rows),
      user_id:          user_id || null,
      customer_name,
      customer_phone:   customer_phone || '',
      receptor_name:    receptor_name  || '',
      receptor_phone:   receptor_phone || '',
      customer_address: customer_address || '',
      zona:             zona || '',
      costo_envio:      costo_envio || 0,
      notes:            notes || '',
      items:            lineItems,
      total,
      status:           'pendiente',
      whatsapp_sent:    false,
      created_at:       now(),
      updated_at:       now()
    };

    rows.push(order);
    writeFile('orders', rows);
    return order;
  },

  updateStatus(id, status) {
    const rows = this.all();
    const idx  = rows.findIndex(o => o.id === +id);
    if (idx === -1) return null;
    rows[idx].status     = status;
    rows[idx].updated_at = now();
    writeFile('orders', rows);
    return rows[idx];
  },

  markWhatsapp(id) {
    const rows = this.all();
    const idx  = rows.findIndex(o => o.id === +id);
    if (idx === -1) return null;
    rows[idx].whatsapp_sent = true;
    rows[idx].updated_at    = now();
    writeFile('orders', rows);
    return rows[idx];
  },

  delete(id) {
    const rows = this.all();
    const idx  = rows.findIndex(o => o.id === +id);
    if (idx === -1) return false;
    rows.splice(idx, 1);
    writeFile('orders', rows);
    return true;
  },

  stats() {
    const all   = this.all();
    const today = new Date().toISOString().slice(0, 10);
    const week  = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);

    const todayOrders = all.filter(o => o.created_at.startsWith(today));
    const weekOrders  = all.filter(o => o.created_at >= week);

    const prods     = products.all();
    const available = prods.filter(p => p.disponible && !p.deleted).length;

    return {
      total_products:     prods.filter(p => !p.deleted).length,
      available_products: available,
      orders_today:       todayOrders.length,
      orders_week:        weekOrders.length,
      revenue_today:      todayOrders.reduce((s, o) => s + o.total, 0),
      revenue_week:       weekOrders.reduce((s, o) => s + o.total, 0),
      orders_by_status: {
        pendiente:  all.filter(o => o.status === 'pendiente').length,
        confirmado: all.filter(o => o.status === 'confirmado').length,
        entregado:  all.filter(o => o.status === 'entregado').length
      }
    };
  }
};

/* ══════════════════════════════════════════════════
   USUARIOS
══════════════════════════════════════════════════ */
const users = {
  all() { return readFile('users'); },

  findById(id) {
    return this.all().find(u => u.id === parseInt(id)) || null;
  },

  findByCorreo(correo) {
    return this.all().find(u => u.correo === correo.toLowerCase().trim()) || null;
  },

  create({ nombre, apellido, telefono, correo, password_hash, acepto_terminos, acepto_promociones }) {
    const rows = this.all();
    const user = {
      id:                 nextId(rows),
      nombre,
      apellido,
      telefono:           telefono || null,
      correo:             correo.toLowerCase().trim(),
      password_hash,
      acepto_terminos:    acepto_terminos    === true,
      acepto_promociones: acepto_promociones === true,
      created_at:         now()
    };
    rows.push(user);
    writeFile('users', rows);
    return user;
  },

  updatePassword(id, password_hash) {
    const rows = this.all();
    const idx  = rows.findIndex(u => u.id === parseInt(id));
    if (idx === -1) return null;
    rows[idx].password_hash = password_hash;
    writeFile('users', rows);
    return rows[idx];
  },

  stats(userId) {
    const uid  = parseInt(userId);
    const ords = orders.all().filter(o => o.user_id === uid);
    const total_pedidos = ords.length;
    const total_gastado = ords.reduce((s, o) => s + (o.total || 0), 0);
    const sorted        = [...ords].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const ultimo_pedido = sorted[0]?.created_at || null;

    const freq = {};
    ords.forEach(o => (o.items || []).forEach(it => {
      freq[it.product_name] = (freq[it.product_name] || 0) + it.quantity;
    }));
    const favoritos = Object.entries(freq)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, qty]) => ({ name, qty }));

    return { total_pedidos, total_gastado, ultimo_pedido, favoritos };
  },

  listWithStats() {
    return this.all().map(u => {
      const st = this.stats(u.id);
      const { password_hash, ...safe } = u;
      return { ...safe, ...st };
    });
  }
};

/* ══════════════════════════════════════════════════
   ADMINS
══════════════════════════════════════════════════ */
const admins = {
  all() { return readFile('admins'); },

  findByUsername(username) {
    return this.all().find(a => a.username === username) || null;
  },

  seed(rows) { writeFile('admins', rows); }
};

/* ══════════════════════════════════════════════════
   ZONAS DE ENVÍO
══════════════════════════════════════════════════ */
const zones = {
  all() { return readFile('zones'); },

  list() { return this.all().sort((a, b) => a.sort_order - b.sort_order); },

  create({ name, costo, activa }) {
    const rows = this.all();
    const item = {
      id:         nextId(rows),
      name:       name.trim(),
      costo:      parseFloat(costo) || 0,
      activa:     activa !== false,
      sort_order: rows.length + 1
    };
    rows.push(item);
    writeFile('zones', rows);
    return item;
  },

  update(id, data) {
    const rows = this.all();
    const idx  = rows.findIndex(z => z.id === +id);
    if (idx === -1) return null;
    if (data.name   !== undefined) rows[idx].name   = data.name.trim();
    if (data.costo  !== undefined) rows[idx].costo  = parseFloat(data.costo);
    if (data.activa !== undefined) rows[idx].activa = !!data.activa;
    writeFile('zones', rows);
    return rows[idx];
  },

  remove(id) {
    const rows = this.all();
    const idx  = rows.findIndex(z => z.id === +id);
    if (idx === -1) return null;
    const removed = rows.splice(idx, 1)[0];
    writeFile('zones', rows);
    return removed;
  },

  seed(rows) { writeFile('zones', rows); }
};

/* ══════════════════════════════════════════════════
   SETTINGS
══════════════════════════════════════════════════ */
const settings = {
  get() {
    const saved = readFile('settings');
    if (saved && !Array.isArray(saved) && Object.keys(saved).length > 0) {
      return { ...this.defaults(), ...saved };
    }
    return this.defaults();
  },

  set(data) {
    const current = this.get();
    const updated = { ...current, ...data };
    writeFile('settings', updated);
    return updated;
  },

  defaults() {
    return {
      store_open:    true,
      maintenance:   false,
      auto_schedule: true,
      name:          'Pedri Exporta',
      tagline:       'Movilidad, energía y tecnología para tu futuro',
      whatsapp:      '',
      phone:         '',
      description:   'Motos, triciclos, bicimotos, energía solar y baterías al mejor precio, con entrega confiable.',
      about_text:    'Pedri Exporta es una comercializadora especializada en movilidad eléctrica y energía solar: motos, triciclos, bicimotos, paneles solares y baterías, con precios competitivos y atención cercana a cada cliente.',
      logo_emoji:    '⚡',
      hours:         'Lunes a Sábado · 8:00 AM – 6:00 PM',
      footer_note:   '© 2026 Pedri Exporta · Todos los derechos reservados.',
      color_primary: '#002a8f',
      color_accent:  '#cf142b'
    };
  }
};

/* ══════════════════════════════════════════════════
   RESET TOKENS
══════════════════════════════════════════════════ */
const resetTokens = {
  all() {
    const data = readFile('reset_tokens');
    return Array.isArray(data) ? data : [];
  },

  create(userId) {
    const crypto = require('crypto');
    const token  = crypto.randomBytes(32).toString('hex');
    const rows   = this.all().filter(t => t.user_id !== userId);
    rows.push({ token, user_id: userId, expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
    writeFile('reset_tokens', rows);
    return token;
  },

  consume(token) {
    const rows  = this.all();
    const idx   = rows.findIndex(t => t.token === token);
    if (idx === -1) return null;
    const entry = rows[idx];
    if (new Date(entry.expires_at) < new Date()) {
      rows.splice(idx, 1); writeFile('reset_tokens', rows);
      return null;
    }
    rows.splice(idx, 1);
    writeFile('reset_tokens', rows);
    return entry.user_id;
  }
};

module.exports = { categories, products, variants, orders, admins, settings, users, zones, resetTokens, initDB };
