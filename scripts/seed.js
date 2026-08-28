/**
 * scripts/seed.js
 * Poblar la base de datos con categorías, productos y admin inicial.
 * Seguro de ejecutar varias veces (sobreescribe).
 * Uso: node scripts/seed.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const db     = require('../db/database');

/* ── Categorías ── */
const CATEGORIES = [
  { id: 1, slug: 'motos',          name: 'Motos',          sort_order: 1 },
  { id: 2, slug: 'triciclos',      name: 'Triciclos',      sort_order: 2 },
  { id: 3, slug: 'bicimotos',      name: 'Bicimotos',      sort_order: 3 },
  { id: 4, slug: 'energia_solar',  name: 'Energía Solar',  sort_order: 4 },
  { id: 5, slug: 'baterias',       name: 'Baterías',       sort_order: 5 },
  { id: 6, slug: 'al_por_mayor',   name: 'Al por Mayor',   sort_order: 6 },
  { id: 7, slug: 'autos_camiones', name: 'Autos y Camiones', sort_order: 7 },
  { id: 8, slug: 'otros',          name: 'Otros',          sort_order: 8 },
];

/* ── Productos ── */
function p(id, category_id, name, price, opts = {}) {
  return {
    id, category_id, name,
    description:         opts.desc        || '',
    price,
    old_price:           opts.old_price   || null,
    image_url:           opts.img         || '',
    disponible:          opts.disponible  !== false,
    has_weight_selector: !!opts.has_weight,
    has_flavor_selector: !!opts.has_flavor,
    min_qty:             opts.min_qty     || 1,
    deleted:             false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

const PRODUCTS = [
  // Productos de ejemplo — reemplázalos desde el panel admin
  p(1,  1, 'Moto Eléctrica JMD 72V (Azul)',            2000.00, { desc: '72V 50Ah · Autonomía 120km/carga · Batería litio antiexplosiva · Envío incluido a todas las provincias', img: '/img/products/moto-jmd-azul.jpg' }),
  p(2,  1, 'Moto Eléctrica JMD 72V (Negro)',           2000.00, { desc: '72V 50Ah · Autonomía 120km/carga · Batería litio antiexplosiva · Envío incluido a todas las provincias', img: '/img/products/moto-jmd-negro.jpg' }),
  p(13, 1, 'Moto de Gasolina GN150F (Negro)',          1680.00, { desc: 'Envío y arancel incluido a todas las provincias', img: '/img/products/moto-gn150-negro.jpg' }),
  p(14, 1, 'Moto de Gasolina GN150F (Rojo)',           1680.00, { desc: 'Envío y arancel incluido a todas las provincias', img: '/img/products/moto-gn150-rojo.jpg' }),
  p(23, 1, 'Moto Eléctrica F1 (Negro)',                2250.00, { desc: '72V 50Ah · Batería litio · Envío a todas las provincias', img: '/img/products/moto-f1-negro.jpg' }),
  p(24, 1, 'Moto Eléctrica F1 (Azul)',                 2250.00, { desc: '72V 50Ah · Batería litio · Envío a todas las provincias', img: '/img/products/moto-f1-azul.jpg' }),
  p(25, 1, 'Moto Eléctrica F1 (Rojo)',                 2250.00, { desc: '72V 50Ah · Batería litio · Envío a todas las provincias', img: '/img/products/moto-f1-rojo.jpg' }),
  p(26, 1, 'Moto Eléctrica Urbana 72V (Rosa)',         2500.00, { desc: '72V 55Ah · Batería litio antiexplosiva · Autonomía 120km · Envío incluido', img: '/img/products/moto-urbana-rosa.jpg' }),
  p(27, 1, 'Moto Eléctrica Urbana 72V (Morado)',       2500.00, { desc: '72V 55Ah · Batería litio antiexplosiva · Autonomía 120km · Envío incluido', img: '/img/products/moto-urbana-morado.jpg' }),
  p(28, 1, 'Moto Eléctrica Urbana 72V (Azul)',         2500.00, { desc: '72V 55Ah · Batería litio antiexplosiva · Autonomía 120km · Envío incluido', img: '/img/products/moto-urbana-azul.jpg' }),
  p(29, 1, 'Moto Eléctrica Urbana 72V (Rojo)',         2500.00, { desc: '72V 55Ah · Batería litio antiexplosiva · Autonomía 120km · Envío incluido', img: '/img/products/moto-urbana-rojo.jpg' }),
  p(30, 1, 'Moto Eléctrica Urbana 72V (Negro)',        2500.00, { desc: '72V 55Ah · Batería litio antiexplosiva · Autonomía 120km · Envío incluido', img: '/img/products/moto-urbana-negro.jpg' }),
  p(3,  2, 'Triciclo Híbrido con Panel Solar',         5000.00, { desc: 'Batería plomo ácido · Extensor de gasolina · Panel solar en el techo · Arancel aduanal incluido', img: '/img/products/triciclo-jmd-solar.jpg' }),
  p(4,  2, 'Triciclo Combustión 250cc',                5550.00, { desc: '8-10 pasajeros · Directo a chapa · Disponible ya en La Habana y Camagüey, entrega inmediata (consultar disponibilidad en otras provincias)', img: '/img/products/triciclo-250cc.jpg' }),
  p(36, 2, 'Triciclo MIKAZUKI XL',                     5600.00, { desc: 'Batería litio 72V 65Ah · Extensor de gasolina · 1.8 metros de largo · Techo corredizo · Envío y aranceles incluidos', img: '/img/products/triciclo-mikazuki-xl.jpg' }),
  p(37, 2, 'Triciclo Eléctrico Litio 72V',             4200.00, { desc: '72V 65Ah · Envío y aranceles incluidos', img: '/img/products/triciclo-litio-azul.jpg' }),
  p(38, 2, 'Triciclo MIKAZUKI Híbrido con Panel Solar', 5500.00, { desc: 'Batería litio 72V 65Ah LiFePO4 · Extensor de gasolina · Panel solar en el techo · Aranceles y envío incluidos', img: '/img/products/triciclo-mikazuki-solar.jpg' }),
  p(5,  3, 'Bicimoto Eléctrica JMD (Rojo)',            1485.00, { desc: '48V 60Ah · 3000W · Envío incluido a todas las provincias', img: '/img/products/bicimoto-jmd-rojo.jpg' }),
  p(15, 3, 'Bicimoto Eléctrica JMD (Azul)',            1485.00, { desc: '48V 60Ah · 3000W · Envío incluido a todas las provincias', img: '/img/products/bicimoto-jmd-azul.jpg' }),
  p(16, 3, 'Bicimoto Eléctrica JMD (Morado)',          1485.00, { desc: '48V 60Ah · 3000W · Envío incluido a todas las provincias', img: '/img/products/bicimoto-jmd.jpg' }),
  p(17, 3, 'Bicimoto Eléctrica Deportiva 72V (Verde)',  1650.00, { desc: '72V 45Ah · Batería litio LiFePO4 · Envío incluido a todas las provincias', img: '/img/products/bicimoto2-verde.jpg' }),
  p(18, 3, 'Bicimoto Eléctrica Deportiva 72V (Azul)',   1650.00, { desc: '72V 45Ah · Batería litio LiFePO4 · Envío incluido a todas las provincias', img: '/img/products/bicimoto2-azul.jpg' }),
  p(19, 3, 'Bicimoto Eléctrica Deportiva 72V (Negro)',  1650.00, { desc: '72V 45Ah · Batería litio LiFePO4 · Envío incluido a todas las provincias', img: '/img/products/bicimoto2-negro.jpg' }),
  p(20, 3, 'Bicimoto Eléctrica Deportiva 72V (Rojo)',   1650.00, { desc: '72V 45Ah · Batería litio LiFePO4 · Envío incluido a todas las provincias', img: '/img/products/bicimoto2-rojo.jpg' }),
  p(21, 3, 'Bicimoto Eléctrica Deportiva 72V (Naranja)',1650.00, { desc: '72V 45Ah · Batería litio LiFePO4 · Envío incluido a todas las provincias', img: '/img/products/bicimoto2-naranja.jpg' }),
  p(22, 3, 'Bicimoto Eléctrica Deportiva 72V (Morado)', 1650.00, { desc: '72V 45Ah · Batería litio LiFePO4 · Envío incluido a todas las provincias', img: '/img/products/bicimoto2-morado.jpg' }),
  p(31, 3, 'Bicimoto Eléctrica GONGAROS 48V (Rosa)',   1050.00, { desc: '48V 45Ah · Autonomía 120km · Envío incluido a todas las provincias', img: '/img/products/bicimoto-gongaros-rosa.jpg' }),
  p(32, 3, 'Bicimoto Eléctrica GONGAROS 48V (Rojo)',   1050.00, { desc: '48V 45Ah · Autonomía 120km · Envío incluido a todas las provincias', img: '/img/products/bicimoto-gongaros-rojo.jpg' }),
  p(33, 3, 'Bicimoto Eléctrica GONGAROS 48V (Morado)', 1050.00, { desc: '48V 45Ah · Autonomía 120km · Envío incluido a todas las provincias', img: '/img/products/bicimoto-gongaros-morado.jpg' }),
  p(34, 3, 'Bicimoto Eléctrica GONGAROS 48V (Azul)',   1050.00, { desc: '48V 45Ah · Autonomía 120km · Envío incluido a todas las provincias', img: '/img/products/bicimoto-gongaros-azul.jpg' }),
  p(35, 3, 'Bicimoto Eléctrica GONGAROS 48V (Verde)',  1050.00, { desc: '48V 45Ah · Autonomía 120km · Envío incluido a todas las provincias', img: '/img/products/bicimoto-gongaros-verde.jpg' }),
  p(7,  4, 'Panel Solar 400W (ejemplo)',                220.00, { desc: 'Monocristalino', img: 'https://placehold.co/400x400/002a8f/ffffff?text=Panel+Solar' }),
  p(8,  4, 'Kit Solar Completo 1000W (ejemplo)',        950.00, { desc: 'Panel + inversor + soportes', img: 'https://placehold.co/400x400/002a8f/ffffff?text=Kit+Solar' }),
  p(9,  5, 'Batería de Litio SRNE 51.2V 205Ah',        2350.00, { desc: '51.2V / 10.49KWH / 205Ah · Batería de fosfato de hierro y litio (LiFePO4) · Entrega en 90 días · Varias provincias de Cuba', img: '/img/products/bateria-srne-51v.jpg' }),
  p(10, 5, 'Batería Solar de Gel 200Ah (ejemplo)',      320.00, { img: 'https://placehold.co/400x400/002a8f/ffffff?text=Bateria+Solar', disponible: false }),
  p(39, 6, 'Ventilador Portátil F6 (Mayoreo)',           40.00, { desc: 'Batería 20000mAh con función power bank · Funcionamiento silencioso 30dB · Luz LED de 4 niveles · Control remoto · Mínimo de compra: 50 unidades · Recogida en almacén en 90 días · Varias provincias de Cuba', img: '/img/products/ventilador-f6.jpg', min_qty: 50 }),
  p(11, 6, 'Unidad de Motor GN125 Tipo A (Suzuki)',     537.00, { desc: 'Incluye 1 palanca de cambio y 1 tapa trasera izquierda · Precio final, incluye costos de importación · Mínimo de compra: 10 unidades', img: '/img/products/motor-gn125-tipo-a.jpg', min_qty: 10 }),
  p(12, 6, 'Contenedor de Baterías x100 (ejemplo)',   24000.00, { desc: 'Precio mayorista', img: 'https://placehold.co/400x400/002a8f/ffffff?text=Lote+Baterias', disponible: false }),
  p(40, 1, 'Moto XMT 250cc',                          2800.00, { desc: '250cc · Envío y arancel incluido', img: '/img/products/moto-xmt-250.jpg' }),
  p(41, 1, 'Moto Krenston 250cc',                     3500.00, { desc: '250cc · Envío y arancel incluido', img: '/img/products/moto-krenston-250.jpg' }),
  p(42, 1, 'Moto GN125F Misaki',                      1950.00, { desc: '125cc · Envío y arancel incluido', img: '/img/products/moto-gn125-misaki.jpg' }),
  p(43, 1, 'Moto GN125F (Copia Suzuki)',               1760.00, { desc: '125cc · Arancel incluido', img: '/img/products/moto-gn125-copia.jpg' }),
  p(44, 1, 'Moto Dmax 200cc',                          2500.00, { desc: '200cc · Incluye todo (envío y arancel)', img: '/img/products/moto-dmax-200.jpg' }),
  p(45, 1, 'Moto Tank-Max 180cc',                      2200.00, { desc: '180cc · Arancel incluido', img: '/img/products/moto-tankmax-180.jpg' }),
  p(46, 2, 'Triciclo Híbrido de Pasajeros 2000W',      4990.00, { desc: 'Motor DC sin escobillas 2000W · Batería litio 72V 100Ah · Extensor de autonomía 6000W · Capacidad de carga 1000kg · 1 conductor + 8 pasajeros · Velocidad +40km/h · Autonomía +100km · Llave inteligente · CarPlay', img: '/img/products/triciclo-hibrido-pasajeros.jpg' }),
  p(47, 2, 'Triciclo Híbrido con Panel Solar 600W',    4850.00, { desc: 'Motor 2000W · Batería litio 72V 70Ah · Extensor de autonomía 4500W · Panel solar 600W', img: '/img/products/triciclo-hibrido-solar-600w.jpg' }),
  p(48, 2, 'Triciclo Híbrido DRV 1800W',               4450.00, { desc: 'Motor 1800W · Batería de gel 60V 65Ah · Extensor de autonomía 4500W', img: '/img/products/triciclo-drv-1800w.jpg' }),
];

/* ── Variantes de productos ── */
const VARIANTS = [];

/* ── Ejecutar seed ── */
async function seed() {
  console.log('🌱 Iniciando seed...\n');

  // Categorías
  db.categories.seed(CATEGORIES);
  console.log(`✅ ${CATEGORIES.length} categorías insertadas`);

  // Productos
  db.products.seed(PRODUCTS);
  console.log(`✅ ${PRODUCTS.length} productos insertados`);

  // Variantes
  db.variants.seed(VARIANTS);
  console.log(`✅ ${VARIANTS.length} variantes insertadas`);

  // Admin
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'pedriexporta2026';
  const hash     = await bcrypt.hash(password, 10);
  db.admins.seed([{ id: 1, username, password_hash: hash }]);
  console.log(`✅ Admin creado: ${username} / ${password}`);

  // Pedidos vacíos (archivo inicial)
  const fs   = require('fs');
  const path = require('path');
  const ordersFile = path.join(__dirname, '..', 'data', 'orders.json');
  if (!fs.existsSync(ordersFile)) {
    fs.writeFileSync(ordersFile, '[]', 'utf8');
    console.log('✅ Archivo orders.json creado');
  }

  console.log('\n🎉 Seed completado. La base de datos está lista.');
  console.log('   Ejecuta: node server.js  (o npm start)');
}

seed().catch(err => { console.error('❌ Error en seed:', err); process.exit(1); });
