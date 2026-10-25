// PerpAI API: alışveriş listesi satırlarını Claude ile Perpa sektörlerine ve firma adı ipuçlarına eşler.
// POST /api/hints  {lines: string[]}  ->  {hints: [{i, label, cat, sectors, terms}]}
// POST /api/trace  {app, events: []}   ->  saha testi kaydı (Railway günlüğüne yazılır)
// Esnaf (merchant.js): POST /api/merchant/claim · GET /api/merchant/me · POST/DELETE /api/merchant/products
// Yönetim: GET /admin (onay sayfası, parola ADMIN_PASSWORD) · POST /admin/merchant/:id/approve|reject
// Uygulama bu ipuçlarıyla kendi dükkân seçimini yapar; sunucuya ulaşamazsa kural tabanlı eşleştirmeye düşer.
import http from 'node:http';
import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import * as M from './merchant.js';

const PORT = Number(process.env.PORT) || 8080;
const MODEL = 'claude-haiku-5-5';
const MAX_LINES = 30, MAX_LINE = 120;
const RATE = { windowMs: 60 * 60 * 1000, max: 60 }; // IP başına saatte 60 istek

const SECTORS = JSON.parse(fs.readFileSync(new URL('./sectors.json', import.meta.url), 'utf8'));
const SECTOR_IDS = new Set(Object.keys(SECTORS).map(Number));
const client = new Anthropic(); // ANTHROPIC_API_KEY ortam değişkeninden

const SYSTEM = `Sen PerpAI'sin: İstanbul Perpa Ticaret Merkezi'nde (elektrik, elektronik, bilişim, hırdavat ağırlıklı ~4.700 dükkân) alışveriş listesini dükkânlara eşleyen yardımcı.
Her liste satırı için:
- label: ürünün sade Türkçe adı (miktar ve birim olmadan).
- cat: kısa kategori adı (ör. "Güvenlik sistemleri", "Network / bilişim", "Elektrik malzemesi").
- sectors: bu ürünü satan firmaların bulunabileceği Perpa sektör kimlikleri, en olası önce, en fazla 4. Yalnızca aşağıdaki listeden.
- terms: bu ürünü satan bir firmanın ticari unvanında geçebilecek, ürüne özgü BÜYÜK HARF Türkçe kelimeler (ör. KABLO, KAMERA, KLİMA, AKÜ, HIRDAVAT), en fazla 5, her biri en az 3 harf. Hemen her firmada geçen genel kelimeleri (TEKNİK, TİCARET, SANAYİ, ELEKTRONİK, ELEKTRİK, MÜHENDİSLİK, GRUP, PAZARLAMA, SİSTEM) yazma.
Satır bir firma adı ya da dükkân numarasıysa (ör. "B 1450") sectors boş kalsın, terms satırdaki ayırt edici kelimeler olsun.
Ürün Perpa'da satılacak bir şey değilse sectors ve terms boş kalsın.

Perpa sektörleri (kimlik: ad):
${Object.entries(SECTORS).map(([id, n]) => `${id}: ${n}`).join('\n')}`;

const Hints = z.object({
  hints: z.array(z.object({
    i: z.number().int(),
    label: z.string(),
    cat: z.string(),
    sectors: z.array(z.number().int()),
    terms: z.array(z.string()),
  })),
});

async function hintsFor(lines) {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: 'low', format: zodOutputFormat(Hints) },
    system: SYSTEM,
    messages: [{ role: 'user', content: lines.map((l, i) => `${i}. ${l}`).join('\n') }],
  });
  if (response.stop_reason === 'refusal' || !response.parsed_output) return [];
  return response.parsed_output.hints
    .filter(h => h.i >= 0 && h.i < lines.length)
    .map(h => ({
      i: h.i, label: h.label.slice(0, 80), cat: h.cat.slice(0, 40),
      sectors: h.sectors.filter(s => SECTOR_IDS.has(s)).slice(0, 4),
      terms: h.terms.map(t => t.toLocaleUpperCase('tr-TR').trim()).filter(t => t.length >= 3).slice(0, 5),
    }));
}

const hits = new Map(); // ip -> [zaman damgaları]
function limited(ip) {
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < RATE.windowMs);
  arr.push(now); hits.set(ip, arr);
  return arr.length > RATE.max;
}

function send(res, code, body) {
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, GET, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
  });
  res.end(JSON.stringify(body));
}

async function readBody(req, limit) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > limit) throw Object.assign(new Error('büyük'), { code: 413 }); }
  return raw;
}

// esnaf ve yönetim uçları
async function merchantRoutes(req, res, ip) {
  const url = req.url.split('?')[0];
  if (url === '/admin' || url.startsWith('/admin/')) {
    if (!M.adminOk(req)) {
      res.writeHead(401, { 'www-authenticate': 'Basic realm="PerpAI yonetim", charset="UTF-8"', 'content-type': 'text/plain; charset=utf-8' });
      return res.end('Parola gerekli.');
    }
    const m = url.match(/^\/admin\/merchant\/(\d+)\/(approve|reject)$/);
    if (req.method === 'POST' && m) {
      await M.decide(Number(m[1]), m[2] === 'approve' ? 'approved' : 'rejected');
      res.writeHead(303, { location: '/admin' }); return res.end();
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(await M.adminPage());
  }
  if (req.method === 'GET' && url === '/api/merchant/me') return send(res, ...(await M.mine(req)));
  const del = url.match(/^\/api\/merchant\/products\/(\d+)$/);
  if (req.method === 'DELETE' && del) return send(res, ...(await M.deleteProduct(req, Number(del[1]))));
  if (req.method === 'POST' && (url === '/api/merchant/claim' || url === '/api/merchant/products')) {
    if (limited(ip)) return send(res, 429, { error: 'çok fazla istek, biraz sonra dene' });
    let body;
    try { body = JSON.parse(await readBody(req, 5000)); } catch { return send(res, 400, { error: 'geçersiz istek' }); }
    return send(res, ...(url === '/api/merchant/claim' ? await M.claim(body) : await M.addProduct(req, body)));
  }
  return send(res, 404, { error: 'bulunamadı' });
}

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true, model: MODEL, db: M.hasDb() });

  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (req.url.startsWith('/api/merchant') || req.url.startsWith('/admin')) {
    if (!M.hasDb()) return send(res, 503, { error: 'veritabanı yok' });
    try { return await merchantRoutes(req, res, ip); } catch (e) { console.error(e); return send(res, 500, { error: 'sunucu hatası' }); }
  }
  if (req.method !== 'POST' || (req.url !== '/api/hints' && req.url !== '/api/trace')) return send(res, 404, { error: 'bulunamadı' });
  if (limited(ip)) return send(res, 429, { error: 'çok fazla istek, biraz sonra dene' });

  let raw;
  try { raw = await readBody(req, req.url === '/api/trace' ? 400000 : 20000); } catch { return send(res, 413, { error: 'istek çok büyük' }); }

  // saha testi kaydı (uygulamada kullanıcı açıkça başlatır): Railway günlüğüne tek satır JSON
  if (req.url === '/api/trace') {
    try {
      const t = JSON.parse(raw);
      if (!Array.isArray(t.events)) throw new Error('events');
      console.log('TRACE ' + JSON.stringify({ at: new Date().toISOString(), app: String(t.app || '').slice(0, 20), events: t.events.slice(0, 5000) }));
      return send(res, 200, { ok: true, n: t.events.length });
    } catch { return send(res, 400, { error: 'geçersiz kayıt' }); }
  }
  let lines;
  try { lines = JSON.parse(raw).lines; } catch { return send(res, 400, { error: 'geçersiz JSON' }); }
  if (!Array.isArray(lines) || !lines.length || lines.length > MAX_LINES || lines.some(l => typeof l !== 'string')) {
    return send(res, 400, { error: `lines: 1-${MAX_LINES} metin satırı` });
  }
  lines = lines.map(l => l.slice(0, MAX_LINE));

  // yapay zekâ ipuçları + esnafların girdiği ürünlerden doğrudan dükkânlar
  let hints = [];
  try {
    hints = await hintsFor(lines);
  } catch (e) {
    if (e instanceof Anthropic.APIError) console.error('Claude API', e.status, e.message); else console.error(e);
  }
  try {
    const byI = new Map(hints.map(h => [h.i, h]));
    for (let i = 0; i < lines.length; i++) {
      const h = byI.get(i);
      const shops = await M.shopsFor(lines[i], h?.terms ?? []);
      if (h) h.shops = shops;
      else if (shops.length) hints.push({ i, label: lines[i], cat: 'Esnaf ürünü', sectors: [], terms: [], shops });
    }
  } catch (e) { console.error('ürün araması', e); }
  send(res, 200, { hints });
}).listen(PORT, () => console.log(`PerpAI API :${PORT}`));
M.migrate().then(() => M.hasDb() && console.log('veritabanı hazır')).catch(e => console.error('migrate', e));
