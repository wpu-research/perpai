// Liste eşitleme: kayıt gerektirmeyen cihaz hesabı + yedek kodu. Listeler sunucuda saklanır,
// başka telefonda yedek kodu girilince geri gelir.
import crypto from 'node:crypto';

let db = null;
export function useDb(pool) { db = pool; }

export async function migrate() {
  if (!db) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id SERIAL PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      code TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS user_lists (
      user_id INT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      list_id TEXT NOT NULL,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, list_id)
    );
  `);
}

// karıştırılabilecek harfler yok (0/O, 1/I/L)
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from(crypto.randomBytes(8), b => ALPHA[b % ALPHA.length]).join('').replace(/(.{4})(.{4})/, '$1-$2');
const tokenOf = req => (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();

async function user(req) {
  const t = tokenOf(req);
  if (!t) return null;
  const { rows } = await db.query('SELECT id, code FROM app_users WHERE token = $1', [t]);
  return rows[0] ?? null;
}

export async function register() {
  const token = crypto.randomBytes(24).toString('base64url');
  for (let k = 0; k < 5; k++) {
    const code = newCode();
    try {
      await db.query('INSERT INTO app_users (token, code) VALUES ($1, $2)', [token, code]);
      return [200, { token, code }];
    } catch (e) { if (e.code !== '23505') throw e; } // kod çakıştı, yenisini dene
  }
  return [500, { error: 'kod üretilemedi' }];
}

export async function restore(body) {
  const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/(.{4})(.{4})/, '$1-$2');
  const { rows } = await db.query('SELECT token, code FROM app_users WHERE code = $1', [code]);
  if (!rows[0]) return [404, { error: 'Bu yedek kodu bulunamadı.' }];
  return [200, rows[0]];
}

export async function getLists(req) {
  const u = await user(req);
  if (!u) return [401, { error: 'oturum yok' }];
  const { rows } = await db.query('SELECT data FROM user_lists WHERE user_id = $1 ORDER BY updated_at DESC', [u.id]);
  return [200, { code: u.code, lists: rows.map(r => r.data) }];
}

// istemcinin tüm listeleri: gelenleri yazar, gelmeyenleri siler (telefondaki durum esas)
export async function putLists(req, body) {
  const u = await user(req);
  if (!u) return [401, { error: 'oturum yok' }];
  const lists = Array.isArray(body.lists) ? body.lists.filter(l => l && typeof l.id === 'string' && l.id.length <= 40).slice(0, 300) : null;
  if (!lists) return [400, { error: 'lists gerekli' }];
  const c = await db.connect();
  try {
    await c.query('BEGIN');
    await c.query('DELETE FROM user_lists WHERE user_id = $1 AND NOT (list_id = ANY($2))', [u.id, lists.map(l => l.id)]);
    for (const l of lists) {
      await c.query(`INSERT INTO user_lists (user_id, list_id, data) VALUES ($1, $2, $3)
        ON CONFLICT (user_id, list_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`, [u.id, l.id, l]);
    }
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  return [200, { ok: true, n: lists.length }];
}
