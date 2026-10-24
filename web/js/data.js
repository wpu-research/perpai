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

// Her kat/blok için slotlara numara ver, firmaları numarasına en yakın slota yerleştir
function assignFirms() {
  const ranges = {};
  for (const f of DB.firms) {
    const key = f.b + f.ef; const r = ranges[key] || (ranges[key] = { lo: Infinity, hi: -Infinity, list: [] });
    r.lo = Math.min(r.lo, f.no); r.hi = Math.max(r.hi, f.no); r.list.push(f);
  }
  for (let fl = 1; fl <= FLOORS; fl++) {
    const lay = getLayout(variantOf(fl));
    const shops = lay.slots.map((slot, si) => ({ floor: fl, si, slot, block: slot.block, no: 0, firm: null }));
    for (const b of ['A', 'B']) {
      const mine = shops.filter(s => s.block === b);
      let r = ranges[b + fl];
      if (!r) { // veri yoksa komşu katlardan aralık uydur
        const prev = ranges[b + (fl - 1)], next = ranges[b + (fl + 1)];
        const lo = prev ? prev.hi + 3 : (next ? Math.max(1, next.lo - mine.length * 2) : fl * 150);
        r = { lo, hi: next ? next.lo - 3 : lo + mine.length * 2, list: [] };
      }
      const N = mine.length;
      mine.forEach((s, j) => { s.no = Math.round(r.lo + (r.hi - r.lo) * (N > 1 ? j / (N - 1) : 0)); });
      for (let j = 1; j < N; j++) if (mine[j].no <= mine[j - 1].no) mine[j].no = mine[j - 1].no + 1;
      for (const f of r.list.sort((a, c) => a.no - c.no)) {
        let best = -1, bd = Infinity;
        for (let j = 0; j < N; j++) if (!mine[j].firm) { const d = Math.abs(mine[j].no - f.no); if (d < bd) { bd = d; best = j; } }
        if (best < 0) continue;
        mine[best].firm = f; mine[best].no = f.no; f.shop = mine[best];
      }
    }
    DB.floors[fl] = shops;
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
  { re: /\bcam\b|ayna/, s: [10], n: /CAM|AYNA/, cat: 'Cam' },
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
  const rule = RULES.find(r => r.re.test(low));
  const tokens = up.split(/[^A-ZÇĞİÖŞÜ0-9]+/).filter(t => t.length >= 4);
  const out = [];
  for (const f of DB.firms) {
    if (!f.shop) continue;
    let sc = 0;
    if (rule) {
      const sec = f.s.some(x => rule.s.includes(x)), nm = rule.n.test(f.N);
      sc = (nm ? 3 : 0) + (sec ? 2 : 0) + (nm && sec ? 1 : 0);
    }
    if (tokens.length) { const hits = tokens.filter(t => f.N.includes(t)).length; if (hits) sc = Math.max(sc, 2 + hits * 2); }
    if (sc >= 2) out.push({ shop: f.shop, score: sc, h: hash(f.i) });
  }
  out.sort((a, b) => b.score - a.score || a.h - b.h);
  return { cat: rule ? rule.cat : (out.length ? 'Firma adı' : null), list: out.slice(0, 60) };
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
