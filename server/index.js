// PerpAI API: alışveriş listesi satırlarını Claude ile Perpa sektörlerine ve firma adı ipuçlarına eşler.
// POST /api/hints  {lines: string[]}  ->  {hints: [{i, label, cat, sectors, terms}]}
// Uygulama bu ipuçlarıyla kendi dükkân seçimini yapar; sunucuya ulaşamazsa kural tabanlı eşleştirmeye düşer.
import http from 'node:http';
import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

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
    'access-control-allow-methods': 'POST, GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(JSON.stringify(body));
}

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true, model: MODEL });
  if (req.method !== 'POST' || req.url !== '/api/hints') return send(res, 404, { error: 'bulunamadı' });

  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (limited(ip)) return send(res, 429, { error: 'çok fazla istek, biraz sonra dene' });

  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 20000) return send(res, 413, { error: 'liste çok uzun' }); }
  let lines;
  try { lines = JSON.parse(raw).lines; } catch { return send(res, 400, { error: 'geçersiz JSON' }); }
  if (!Array.isArray(lines) || !lines.length || lines.length > MAX_LINES || lines.some(l => typeof l !== 'string')) {
    return send(res, 400, { error: `lines: 1-${MAX_LINES} metin satırı` });
  }
  lines = lines.map(l => l.slice(0, MAX_LINE));

  try {
    send(res, 200, { hints: await hintsFor(lines) });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return send(res, 503, { error: 'yapay zekâ meşgul' });
    if (e instanceof Anthropic.APIError) { console.error('Claude API', e.status, e.message); return send(res, 502, { error: 'yapay zekâ hatası' }); }
    console.error(e); send(res, 500, { error: 'sunucu hatası' });
  }
}).listen(PORT, () => console.log(`PerpAI API :${PORT}`));
