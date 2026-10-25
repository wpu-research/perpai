// Gerçek Perpa firma rehberi verisi -> dükkan slotları; alışveriş listesi eşleştirme.
import { getLayout, variantOf, FLOORS, ENTRY } from './layout.js';

export const MAIN_FLOORS = [2, 5, 8, 11, 13];
export function entryFloor(k) {
  const fl = k.split('-').map(Number);
  return fl.find(f => MAIN_FLOORS.includes(f)) ?? fl[0];
}

const trUp = s => s.toLocaleUpperCase('tr-TR');
const trLow = s => s.toLocaleLowerCase('tr-TR');

export const DB = { sectors: {}, firms: [], floors: {} };

// json verilirse (mobil uygulama, paketlenmiş veri) onu kullanır; yoksa web'de dosyayı çeker
export async function loadData(json) {
  const d = json || await (await fetch('data/firms.json')).json();
  DB.sectors = d.sectors; DB.firms = d.firms;
  for (const f of DB.firms) { f.ef = entryFloor(f.k); f.N = trUp(f.n); }
  assignFirms();
  return DB;
}

// Firmaları dükkân yuvalarına yerleştir.
// Konumu bilinen firma (p: perpa.com.tr haritasından, scripts/fit_coords.py) kendine en yakın boş
// yuvaya oturur; konumsuz firmalar ve kaydı olmayan dükkânlar numarası komşulardan tahmin edilerek doldurulur.
const ZONE_OF = { K: 'KIRMIZI', S: 'SARI', M: 'MAVI', Y: 'YESIL' };
const d2 = (a, x, z) => (a.x - x) ** 2 + (a.z - z) ** 2;

function assignFirms() {
  // kat/blok numara aralıkları (kaydı hiç olmayan katlarda numara uydurmak için)
  const ranges = {};
  for (const f of DB.firms) {
    const r = ranges[f.b + f.ef] || (ranges[f.b + f.ef] = { lo: Infinity, hi: -Infinity });
    r.lo = Math.min(r.lo, f.no); r.hi = Math.max(r.hi, f.no);
  }
  const zoneVotes = new Map(); // yuva -> {renk: oy} (aynı varyanttaki tüm katlardan)
  for (let fl = 1; fl <= FLOORS; fl++) {
    const lay = getLayout(variantOf(fl));
    const shops = lay.slots.map((slot, si) => ({ floor: fl, si, slot, block: slot.block, no: 0, firm: null, est: false }));
    for (const b of ['A', 'B']) {
      const mine = shops.filter(s => s.block === b);
      const firms = DB.firms.filter(f => f.b === b && f.ef === fl);
      // 1) konumlu firmalar: en yakın çiftten başlayarak açgözlü eşleme
      const pairs = [];
      for (const f of firms) if (f.p) {
        const [x, z] = f.p;
        for (let j = 0; j < mine.length; j++) { const d = d2(mine[j].slot, x, z); if (d < 1600) pairs.push([d, f, j]); }
      }
      pairs.sort((p, q) => p[0] - q[0]);
      for (const [, f, j] of pairs) {
        if (f.shop || mine[j].firm) continue;
        mine[j].firm = f; mine[j].no = f.no; f.shop = mine[j];
        if (f.c) {
          const v = zoneVotes.get(mine[j].slot) || {}; v[ZONE_OF[f.c]] = (v[ZONE_OF[f.c]] || 0) + 1; zoneVotes.set(mine[j].slot, v);
        }
      }
      // 2) boş yuvaların numarası: en yakın iki konumlu dükkândan
      const known = mine.filter(s => s.firm);
      const used = new Set(known.map(s => s.no));
      for (const s of mine) {
        if (s.firm) continue;
        s.est = true;
        if (!known.length) { // bu katta hiç kayıt yok: komşu katların aralığından sırayla
          const prev = ranges[b + (fl - 1)], next = ranges[b + (fl + 1)], N = mine.length, j = mine.indexOf(s);
          const lo = prev ? prev.hi + 3 : (next ? Math.max(1, next.lo - N * 2) : fl * 150);
          const hi = next ? next.lo - 3 : lo + N * 2;
          s.no = Math.round(lo + j * Math.max(1, (hi - lo) / Math.max(1, N - 1)));
          continue;
        }
        const near = known.map(k => [d2(k.slot, s.slot.x, s.slot.z), k]).sort((p, q) => p[0] - q[0]).slice(0, 2);
        const w = near.map(([d]) => 1 / (Math.sqrt(d) + 0.5));
        let no = Math.round(near.reduce((a, [, k], i) => a + k.no * w[i], 0) / w.reduce((a, c) => a + c, 0));
        for (let k = 0; used.has(no) && k < 40; k++) no += (k % 2 ? -k : k);
        s.no = no; used.add(no);
      }
      // 3) konumsuz firmalar: numarası en yakın boş yuvaya
      for (const f of firms) {
        if (f.shop) continue;
        let best = -1, bd = Infinity;
        for (let j = 0; j < mine.length; j++) if (!mine[j].firm) { const d = Math.abs(mine[j].no - f.no); if (d < bd) { bd = d; best = j; } }
        if (best < 0) continue;
        mine[best].firm = f; mine[best].no = f.no; mine[best].est = false; f.shop = mine[best];
      }
    }
    DB.floors[fl] = shops;
  }
  // yuva renkleri: gerçek plandaki renklerin çoğunluğu; oyu olmayan yuva en yakın oylu yuvadan alır
  for (const v of ['G', 'E', 'N']) {
    const slots = getLayout(v).slots;
    const voted = slots.filter(s => zoneVotes.has(s));
    if (!voted.length) continue;
    const pick = s => { const o = zoneVotes.get(s); return Object.keys(o).reduce((a, c) => (o[c] > o[a] ? c : a)); };
    const zone = new Map(voted.map(s => [s, pick(s)]));
    for (const s of slots) {
      if (zone.has(s)) continue;
      let best = null, bd = Infinity;
      for (const o of voted) if (o.block === s.block) { const d = d2(o, s.x, s.z); if (d < bd) { bd = d; best = o; } }
      if (best && bd < 15 * 15) zone.set(s, zone.get(best));
    }
    for (const [s, z] of zone) s.zone = z;
  }
}

// --- Liste eşleştirme ------------------------------------------------------
// s: sektör id'leri (perpa.com.tr), n: firma adında aranacak kalıp
const RULES = [
  { re: /kamera|nvr|dvr|cctv|alarm|kayıt cihaz|güvenlik/, s: [64, 67, 5], n: /GÜVENLİK|KAMERA|CCTV|ALARM|SECURITY|GÖZETİM/, cat: 'Güvenlik sistemleri' },
  { re: /cat ?[56]|ethernet|network|rj ?45|konnekt|switch|modem|router|fiber|wifi|wi-fi|access point|patch/, s: [5, 67], n: /BİLİŞİM|NETWORK|KABLO|TELEKOM|İLETİŞİM|NET\b|DATA/, cat: 'Network / bilişim' },
  { re: /adaptör|adaptor|güç kaynağı|smps|trafo|sigorta|şalter|priz|anahtar|nym|ttr|röle|kontaktör|kablo|uzatma/, s: [64, 63], n: /ELEKTRİK|KABLO|ENERJİ|ELEKTRO|ŞALT/, cat: 'Elektrik malzemesi' },
  { re: /\bled\b|ampul|aydınlatma|spot|armatür|projektör|şerit|lamba|avize/, s: [65], n: /AYDINLATMA|LED|LIGHT|IŞIK|LAMBA/, cat: 'Aydınlatma' },
  { re: /vida|civata|cıvata|somun|dübel|matkap|hırdavat|pense|tornavida|zımpara|el aleti|silikon tabanca|perçin|testere|tork/, s: [61], n: /HIRDAVAT|BAĞLANTI|CIVATA|CİVATA|VİDA|TEKNİK|NALBUR/, cat: 'Teknik hırdavat' },
  { re: /laptop|bilgisayar|ssd|\bram\b|anakart|ekran kartı|monitör|klavye|mouse|harddisk|hdd|usb|flash|tablet/, s: [5], n: /BİLGİSAYAR|BİLİŞİM|COMPUTER|TEKNOLOJİ|DONANIM/, cat: 'Bilgisayar' },
  { re: /yazıcı|toner|kartuş|mürekkep|fotokopi/, s: [5, 6], n: /TONER|YAZICI|BÜRO|OFİS|KARTUŞ/, cat: 'Yazıcı / sarf' },
  { re: /telefon|kılıf|şarj|powerbank|kulaklık|telsiz|santral/, s: [67], n: /TELEKOM|İLETİŞİM|MOBİL|GSM|TELEFON|TELSİZ|SANTRAL/, cat: 'Telekomünikasyon' },
  { re: /arduino|raspberry|sensör|servo|step motor|robot|lehim|breadboard|direnç|kondansatör|entegre|transistör|devre|pcb|elektronik|osiloskop|multimetre/, s: [64, 60, 5], n: /ELEKTRONİK|ROBOT|KOMPONENT|DEVRE|MEKATRONİK/, cat: 'Elektronik / robotik' },
  { re: /\bpil\b|pil |batarya|akü|lipo|\bups\b|inverter|solar|güneş paneli/, s: [63, 64], n: /AKÜ|PİL|BATARYA|ENERJİ|UPS|GÜÇ|SOLAR/, cat: 'Enerji' },
  { re: /pnömatik|valf|piston|plc|otomasyon|sürücü|rulman|redüktör|motor|kayış|hidrolik/, s: [60, 59], n: /OTOMASYON|PNÖMATİK|HİDROLİK|MAKİNA|MAKINA|RULMAN|MOTOR/, cat: 'Otomasyon / makina' },
  { re: /kağıt|\ba4\b|defter|kalem|kırtasiye|zarf|dosya|klasör/, s: [6], n: /KIRTASİYE|KAĞIT|BÜRO|OFİS/, cat: 'Kırtasiye' },
  { re: /kartvizit|broşür|baskı|matbaa|afiş|etiket|tabela|branda|reklam/, s: [32, 30], n: /MATBAA|BASKI|REKLAM|DİJİTAL|ETİKET|TABELA|BASIM/, cat: 'Baskı / reklam' },
  { re: /parfüm|kozmetik|krem|şampuan|makyaj/, s: [7], n: /KOZMETİK|PARFÜM/, cat: 'Kozmetik' },
  { re: /ilaç|medikal|tansiyon|maske|eldiven|tıbbi|ilk yardım/, s: [8], n: /MEDİKAL|TIBBİ|SAĞLIK|MEDİCAL/, cat: 'Medikal' },
  { re: /yedek parça|\boto\b|far |silecek|lastik|araç|otomotiv/, s: [52, 54], n: /OTO|OTOMOTİV|YEDEK/, cat: 'Oto yedek parça' },
  { re: /boya|yapıştırıcı|kimya|tiner|sprey|yağ|gres/, s: [69], n: /KİMYA|BOYA/, cat: 'Kimyasal' },
  { re: /plastik|kauçuk|conta|hortum|pleksi/, s: [68], n: /PLASTİK|KAUÇUK|CONTA|HORTUM|PLEKSİ/, cat: 'Plastik / kauçuk' },
  { re: /vana|kombi|tesisat|boru|doğalgaz|petek|pompa|musluk/, s: [50], n: /TESİSAT|ISI|TERMO|POMPA|VANA/, cat: 'Mekanik tesisat' },
  { re: /klima|süpürge|ütü|beyaz eşya|blender|ev aleti|fırın/, s: [66], n: /ELEKTRİKLİ|BEYAZ|KLİMA/, cat: 'Elektrikli ev aletleri' },
  { re: /fotoğraf|lens|tripod|objektif|vesikalık|drone/, s: [79], n: /FOTO|OPTİK|GÖRÜNTÜ/, cat: 'Fotoğrafçılık' },
  { re: /gözlük|saat/, s: [73], n: /GÖZLÜK|OPTİK|SAAT/, cat: 'Gözlük / saat' },
  { re: /oyuncak|hediye|bijuteri|hediyelik/, s: [3], n: /OYUNCAK|HEDİYE/, cat: 'Hediyelik' },
  { re: /bardak|tabak|mutfak|tencere|termos/, s: [80, 58], n: /ZÜCCACİYE|MUTFAK/, cat: 'Züccaciye' },
  { re: /\bcam\b|\bayna/, s: [10], n: /CAM|AYNA/, cat: 'Cam' },
  { re: /çay|kahve|yemek|döner|tost|börek|simit|lokanta/, s: [17, 12], n: /CAFE|KAFE|RESTORAN|LOKANTA|BÜFE|DÖNER|PİDE|KEBAP/, cat: 'Yeme-içme' },
  { re: /kargo|gönderi|paket gönder/, s: [75], n: /KARGO|EXPRESS|LOJİSTİK/, cat: 'Kargo' },
  { re: /banka|atm|para çek/, s: [18], n: /BANK|KATILIM/, cat: 'Banka' },
  { re: /mali müşavir|muhasebe/, s: [19], n: /MÜŞAVİR|MUHASEBE/, cat: 'Mali müşavirlik' },
];

const QTY = /^\s*(?:[-•*]\s*)?(\d+[.,]?\d*)\s*(adet|tane|x|×|m|mt|metre|kg|paket|kutu|top|rulo|çift)?(?=\s)\s*/i;

export function parseList(text) {
  return text.split(/\n|,|;/).map(l => l.trim()).filter(l => l.length > 1).map(line => {
    let qty = null, rest = line.replace(/^[-•*]\s*/, '');
    const m = rest.match(QTY);
    if (m && m[1]) { qty = m[1] + (m[2] ? ' ' + m[2] : ''); rest = rest.slice(m[0].length); }
    return { raw: line, qty, label: rest.charAt(0).toLocaleUpperCase('tr-TR') + rest.slice(1) };
  });
}

// --- Yapay zekâ ipuçları (server/: Claude, satır -> sektörler + firma adı kelimeleri) ----------
export const API_BASE = 'https://perpai-api-production.up.railway.app';

// Satır başına ipucu dizisi döner (eşleşmeyen satır null); sunucuya ulaşılamazsa hepsi null.
export async function aiHints(lines, ms = 8000) {
  const empty = lines.map(() => null);
  if (!lines.length) return empty;
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(API_BASE + '/api/hints', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lines: lines.slice(0, 30) }), signal: ctl.signal,
    });
    if (!r.ok) return empty;
    const { hints } = await r.json();
    for (const h of hints || []) if (h.i >= 0 && h.i < lines.length) empty[h.i] = h;
    return empty;
  } catch { return empty; } finally { clearTimeout(timer); }
}

const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// elle yazılmış kural öncelikli (ölçümde daha isabetli); kuralın tanımadığı üründe yapay zekâ ipucu (item.ai)
function ruleFor(item, low) {
  const r = RULES.find(x => x.re.test(low));
  const ai = item.ai;
  if (r || !ai || (!ai.sectors.length && !ai.terms.length)) return r;
  return { s: ai.sectors, n: ai.terms.length ? new RegExp(ai.terms.map(escRe).join('|')) : /(?!)/, cat: ai.cat, ai: true };
}

function hash(n) { n = ((n >>> 16) ^ n) * 0x45d9f3b; n = ((n >>> 16) ^ n) * 0x45d9f3b; return ((n >>> 16) ^ n) >>> 0; }

export function candidatesFor(item) {
  const low = trLow(item.label), up = trUp(item.label);
  // doğrudan dükkan numarası: "B 1450", "A-847"
  const dm = item.label.match(/^([abAB])\s*[- ]?\s*(\d{1,4})$/);
  if (dm) {
    const b = dm[1].toUpperCase(), no = +dm[2];
    const all = Object.values(DB.floors).flat().filter(s => s.block === b);
    all.sort((x, y) => Math.abs(x.no - no) - Math.abs(y.no - no));
    return { cat: 'Dükkan numarası', list: all.slice(0, 1).map(s => ({ shop: s, score: 9 })) };
  }
  // esnafın kendi girdiği üründen gelen dükkânlar (sunucu, item.ai.shops) en üstte
  const direct = [];
  for (const d of item.ai?.shops ?? []) {
    const pool = (DB.floors[d.floor] || []).filter(s => s.block === d.block);
    const shop = pool.find(s => s.no === d.no) ?? pool.sort((x, y) => Math.abs(x.no - d.no) - Math.abs(y.no - d.no))[0];
    if (shop && !direct.some(c => c.shop === shop)) direct.push({ shop, score: 9, product: d.product, price: d.price });
  }
  const rule = ruleFor(item, low);
  const tokens = up.split(/[^A-ZÇĞİÖŞÜ0-9]+/).filter(t => t.length >= 4);
  const out = [];
  for (const f of DB.firms) {
    if (!f.shop) continue;
    let sc = 0;
    if (rule) {
      const sec = f.s.some(x => rule.s.includes(x)), nm = rule.n.test(f.N);
      sc = (nm ? 3 : 0) + (sec ? 2 : 0) + (nm && sec ? 1 : 0);
      // yapay zekâ tahmini: ad+sektör birlikte tutarsa tek kelimelik ad eşleşmesini (4) geçer, tek başına geçmez
      if (rule.ai) sc = nm && sec ? 5 : nm ? 3 : sec ? 2 : 0;
    }
    if (tokens.length) { const hits = tokens.filter(t => f.N.includes(t)).length; if (hits) sc = Math.max(sc, 2 + hits * 2); }
    if (sc >= 2) out.push({ shop: f.shop, score: sc, h: hash(f.i) });
  }
  out.sort((a, b) => b.score - a.score || a.h - b.h);
  const list = [...direct, ...out.filter(c => !direct.some(d => d.shop === c.shop))].slice(0, 60);
  return { cat: direct.length ? 'Esnaf ürünü' : rule ? rule.cat : (out.length ? 'Firma adı' : null), list };
}

const pos = s => ({ x: s.slot.door.x, z: s.slot.door.z, floor: s.floor });
const approx = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z) + Math.abs(a.floor - b.floor) * 45;

// Adaylar arasından turu kısaltacak dükkanları seç
export function chooseShops(items, mode = 'uzman') {
  const start = { x: ENTRY.x, z: ENTRY.z, floor: ENTRY.floor };
  const live = items.filter(it => it.cands && it.cands.list.length);
  for (const it of live) {
    const best = it.cands.list.slice(0, 25);
    it.pool = best;
    if (it.locked) continue;
    if (mode === 'uzman') { it.choice = best[0]; continue; }
    it.choice = best.reduce((a, c) => (approx(start, pos(c.shop)) - 25 * c.score < approx(start, pos(a.shop)) - 25 * a.score ? c : a));
  }
  for (let pass = 0; pass < (mode === 'uzman' ? 0 : 3); pass++) for (const it of live) {
    if (it.locked) continue;
    const others = live.filter(o => o !== it).map(o => pos(o.choice.shop));
    let bc = Infinity;
    for (const c of it.pool) {
      const p = pos(c.shop);
      const cost = others.reduce((s, o) => s + approx(p, o), 0) / Math.max(1, others.length) + approx(start, p) * 0.4 - 25 * c.score;
      if (cost < bc) { bc = cost; it.choice = c; }
    }
  }
  return live;
}

export function shopTitle(s) {
  return s.firm ? s.firm.n : `Dükkan ${s.no}`;
}

export const PRESETS = {
  guvenlik: { title: 'Güvenlik kamerası kurulumu', text: '4 adet IP kamera\nNVR kayıt cihazı\n100 m Cat6 kablo\nRJ45 konnektör\n12V adaptör\nVida ve dübel' },
  robot: { title: 'Robotik proje', text: 'Arduino Mega\n2 adet servo motor\nLipo batarya\nLehim teli\nUltrasonik sensör\nLED şerit' },
  ofis: { title: 'Ofis açılışı', text: '2 adet laptop\nLazer yazıcı\nToner\nModem\nKartvizit baskı\nLED panel armatür\nÇay ocağı için kahve' },
};
