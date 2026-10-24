// OTOMATİK KOPYA — kaynak: web/js/qr.js (npm run sync-core)
// QR konum kayıtları: her kodun binadaki yeri ve QR'a bakan kişinin yönü.
// Kod biçimleri: GIRIS · D-A11-1350 (dükkân kapısı) · E19-11 (avlu asansörü)
//                K2-8 (kapı/merdiven) · YK8-A / YK8-B (yürüyen merdiven uçları)
import { CONNECTORS, ENTRY, FLOORS, WELLS, ZONE_LABEL } from './layout.js';
import { DB, shopTitle } from './data.js';

let cache = null;

export function qrList() {
  if (cache) return cache;
  const out = [];
  out.push({ code: 'GIRIS', kind: 'giris', floor: ENTRY.floor, x: ENTRY.x, z: ENTRY.z, heading: Math.PI,
    label: '8. kat · ana giriş', sub: 'Meydan kapısı', zone: null });
  for (let f = 1; f <= FLOORS; f++) {
    for (const s of DB.floors[f]) {
      const sl = s.slot;
      out.push({ code: `D-${s.block}${f}-${s.no}`, kind: 'kapi', floor: f, x: sl.door.x, z: sl.door.z,
        heading: Math.atan2(-sl.fx, -sl.fz), label: `${s.block} Blok · ${f}. kat · No ${s.no}`,
        sub: s.firm ? shopTitle(s) : '', zone: sl.zone, block: s.block, no: s.no, shop: s });
    }
    for (const c of CONNECTORS) {
      if (c.type === 'elevator') {
        out.push({ code: `E${c.cell.elevator}-${f}`, kind: 'asansor', floor: f, x: c.pt.x, z: c.pt.z,
          heading: Math.atan2(c.cab.x - c.pt.x, c.cab.z - c.pt.z), label: `${c.cell.block} Blok · ${f}. kat · Asansör ${c.cell.elevator}`,
          sub: ZONE_LABEL[c.cell.color], zone: c.cell.color });
      } else if (c.type === 'stairs') {
        const g = c.gate;
        out.push({ code: `K${g.n}-${f}`, kind: 'merdiven', floor: f, x: g.door.x, z: g.door.z,
          heading: Math.atan2(-g.face[0], -g.face[1]), label: `${g.block} Blok · ${f}. kat · Kapı ${g.n}`,
          sub: 'Merdiven', zone: 'KIRMIZI' });
      }
    }
    for (const w of WELLS) {
      out.push({ code: `Y${w.id}${f}-A`, kind: 'yuruyen', floor: f, x: 0, z: w.z0 - 2, heading: 0,
        label: `Orta salon · ${f}. kat`, sub: `${w.name} yürüyen merdiven (güney ucu)`, zone: null });
      out.push({ code: `Y${w.id}${f}-B`, kind: 'yuruyen', floor: f, x: 0, z: w.z1 + 2, heading: Math.PI,
        label: `Orta salon · ${f}. kat`, sub: `${w.name} yürüyen merdiven (kuzey ucu)`, zone: null });
    }
  }
  // aynı kat/blokta tekrar eden dükkân numaralarına sonek ver
  const seen = new Map();
  for (const q of out) {
    const n = seen.get(q.code) || 0; seen.set(q.code, n + 1);
    if (n) q.code = `${q.code}-${n + 1}`;
  }
  cache = out;
  return out;
}

export function resolveQR(code) {
  if (!code) return null;
  const c = String(code).trim().toUpperCase();
  return qrList().find(q => q.code === c) || null;
}

export const QR_BASE = 'https://perpai-web-production.up.railway.app/';
export const qrURL = code => {
  const base = globalThis.location?.origin ? `${location.origin}${location.pathname.replace(/qr\.html$/, '')}` : QR_BASE;
  return `${base}?q=${encodeURIComponent(code)}`;
};

// Okunan metin: tam URL, ham kod ya da "A 1350" gibi dükkân numarası
export function parseScanned(text) {
  if (!text) return null;
  const t = String(text).trim();
  try {
    const u = new URL(t);
    const q = u.searchParams.get('q');
    if (q) return resolveQR(q);
  } catch { /* URL değil */ }
  const direct = resolveQR(t);
  if (direct) return direct;
  const m = t.match(/^([abAB])\s*[- ]?\s*(\d{1,4})$/);
  if (m) {
    const b = m[1].toUpperCase(), no = +m[2];
    const doors = qrList().filter(q => q.kind === 'kapi' && q.block === b);
    doors.sort((x, y) => Math.abs(x.no - no) - Math.abs(y.no - no));
    return doors[0] || null;
  }
  return null;
}

export const KIND_LABEL = { giris: 'Ana giriş', kapi: 'Dükkân kapısı', asansor: 'Asansör', merdiven: 'Kapı / merdiven', yuruyen: 'Yürüyen merdiven' };
