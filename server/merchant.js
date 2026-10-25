// Esnaf: dükkân sahiplenme, yönetim onayı, ürün kataloğu (Postgres).
// Doğrulama: esnaf kapıdaki QR'ı okutup ad ve telefon bırakır; yönetim /admin sayfasında arayıp onaylar.
import crypto from 'node:crypto';
import pg from 'pg';

const db = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;
export const hasDb = () => !!db;

export async function migrate() {
  if (!db) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS merchants (
      id SERIAL PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      block CHAR(1) NOT NULL,
      floor INT NOT NULL,
      no INT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      decided_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      merchant_id INT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      norm TEXT NOT NULL,
      price NUMERIC(12,2),
      in_stock BOOLEAN NOT NULL DEFAULT true,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS products_merchant ON products(merchant_id);
  `);
}

export const norm = s => s.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();
const tokenOf = req => (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();

async function me(req) {
  const t = tokenOf(req);
  if (!t || !db) return null;
  const { rows } = await db.query('SELECT id, name, phone, block, floor, no, status, created_at FROM merchants WHERE token = $1', [t]);
  return rows[0] ?? null;
}

// --- uygulama uçları; dönüş: [kod, gövde]
export async function claim(body) {
  const m = String(body.code || '').trim().toUpperCase().match(/^D-([AB])(\d{1,2})-(\d{1,4})/);
  const name = String(body.name || '').trim().slice(0, 80);
  const phone = String(body.phone || '').replace(/\D/g, '').slice(-11);
  if (!m) return [400, { error: 'Kapıdaki QR geçersiz (D-A11-1350 gibi olmalı).' }];
  if (name.length < 3) return [400, { error: 'Ad soyad ya da firma adı gerekli.' }];
  if (phone.length < 10) return [400, { error: 'Telefon numarası eksik.' }];
  const floor = Number(m[2]), no = Number(m[3]);
  if (floor < 1 || floor > 13) return [400, { error: 'Kat 1-13 arası olmalı.' }];
  const token = crypto.randomBytes(24).toString('base64url');
  await db.query('INSERT INTO merchants (token, name, phone, block, floor, no) VALUES ($1,$2,$3,$4,$5,$6)', [token, name, phone, m[1], floor, no]);
  return [200, { token, status: 'pending' }];
}

export async function mine(req) {
  const mm = await me(req);
  if (!mm) return [401, { error: 'oturum yok' }];
  const { rows } = await db.query('SELECT id, name, price::float8 AS price, in_stock FROM products WHERE merchant_id = $1 ORDER BY name', [mm.id]);
  return [200, { merchant: mm, products: rows }];
}

export async function addProduct(req, body) {
  const mm = await me(req);
  if (!mm) return [401, { error: 'oturum yok' }];
  if (mm.status !== 'approved') return [403, { error: 'Dükkân henüz onaylanmadı.' }];
  const name = String(body.name || '').trim().slice(0, 120);
  if (name.length < 2) return [400, { error: 'Ürün adı gerekli.' }];
  const price = body.price == null || body.price === '' ? null : Number(body.price);
  if (price != null && !(price >= 0 && price < 1e9)) return [400, { error: 'Fiyat geçersiz.' }];
  const { rows: [{ n }] } = await db.query('SELECT count(*)::int AS n FROM products WHERE merchant_id = $1', [mm.id]);
  if (n >= 500) return [400, { error: 'En fazla 500 ürün.' }];
  const { rows } = await db.query('INSERT INTO products (merchant_id, name, norm, price) VALUES ($1,$2,$3,$4) RETURNING id, name, price::float8 AS price, in_stock',
    [mm.id, name, norm(name), price]);
  return [200, { product: rows[0] }];
}

export async function deleteProduct(req, id) {
  const mm = await me(req);
  if (!mm) return [401, { error: 'oturum yok' }];
  await db.query('DELETE FROM products WHERE id = $1 AND merchant_id = $2', [id, mm.id]);
  return [200, { ok: true }];
}

// liste satırı için onaylı esnafların ürünlerinden dükkânlar (kelimelerin hepsi ürün adında geçmeli)
export async function shopsFor(line, terms = []) {
  if (!db) return [];
  const words = norm(line).replace(/^\d+\s*(adet|m|metre|kg|lt|paket|kutu|top|tane)?\s*/, '').split(/[^\p{L}\p{N}]+/u).filter(w => w.length >= 3).slice(0, 4);
  const extra = terms.map(norm).filter(w => w.length >= 3).slice(0, 3);
  if (!words.length && !extra.length) return [];
  const all = words.length ? words : extra;
  const { rows } = await db.query(
    `SELECT DISTINCT ON (m.id) m.block, m.floor, m.no, p.name AS product, p.price
       FROM products p JOIN merchants m ON m.id = p.merchant_id
      WHERE m.status = 'approved' AND p.in_stock AND p.norm LIKE ALL($1)
      ORDER BY m.id, p.updated_at DESC LIMIT 8`,
    [all.map(w => `%${w.replace(/[%_]/g, '')}%`)]);
  return rows.map(r => ({ block: r.block.trim(), floor: r.floor, no: r.no, product: r.product, price: r.price == null ? null : Number(r.price) }));
}

// --- yönetim sayfası (HTTP temel kimlik doğrulaması: kullanıcı adı serbest, parola ADMIN_PASSWORD)
export function adminOk(req) {
  const pw = process.env.ADMIN_PASSWORD;
  const h = req.headers.authorization || '';
  if (!pw || !h.startsWith('Basic ')) return false;
  const given = Buffer.from(h.slice(6), 'base64').toString().split(':').slice(1).join(':');
  const a = Buffer.from(given), b = Buffer.from(pw);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function adminPage() {
  const { rows } = await db.query(`SELECT m.*, (SELECT count(*) FROM products p WHERE p.merchant_id = m.id)::int AS n
    FROM merchants m ORDER BY (m.status = 'pending') DESC, m.created_at DESC LIMIT 300`);
  const label = { pending: 'Onay bekliyor', approved: 'Onaylı', rejected: 'Reddedildi' };
  const tr = rows.map(m => `<tr><td>${esc(m.block)} ${m.floor}. kat · No ${m.no}</td><td>${esc(m.name)}</td>
    <td><a href="tel:${esc(m.phone)}">${esc(m.phone)}</a></td><td>${label[m.status] ?? esc(m.status)}</td><td>${m.n}</td>
    <td>${new Date(m.created_at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</td>
    <td>${m.status !== 'approved' ? `<form method="post" action="/admin/merchant/${m.id}/approve"><button>Onayla</button></form>` : ''}
        ${m.status !== 'rejected' ? `<form method="post" action="/admin/merchant/${m.id}/reject"><button class="r">Reddet</button></form>` : ''}</td></tr>`).join('');
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PerpAI · Esnaf onayları</title><style>
body{font:15px system-ui,sans-serif;margin:0;padding:16px;background:#F3F5F8;color:#0E1726}h1{font-size:22px}
table{border-collapse:collapse;width:100%;background:#fff}td,th{padding:8px 10px;border-bottom:1px solid #E1E6EE;text-align:left;vertical-align:top}
form{display:inline}button{padding:6px 12px;border:0;border-radius:8px;background:#0A8FB0;color:#fff;font-weight:600;cursor:pointer}
button.r{background:#B3261E}.n{color:#4A5568;font-size:13px}</style></head><body>
<h1>Esnaf onayları</h1><p class="n">Onaylamadan önce numarayı arayıp dükkânın sahibi ya da çalışanı olduğunu doğrulayın. Onaylı esnaf ürün ekleyebilir; ürünleri listelerde öne çıkar.</p>
<div style="overflow-x:auto"><table><tr><th>Dükkân</th><th>Ad</th><th>Telefon</th><th>Durum</th><th>Ürün</th><th>Başvuru</th><th></th></tr>${tr || '<tr><td colspan="7">Henüz başvuru yok.</td></tr>'}</table></div>
</body></html>`;
}

export async function decide(id, status) {
  await db.query('UPDATE merchants SET status = $1, decided_at = now() WHERE id = $2', [status, id]);
}
