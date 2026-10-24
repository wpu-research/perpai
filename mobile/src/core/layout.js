// OTOMATİK KOPYA — kaynak: web/js/layout.js (npm run sync-core)
// Perpa bina yerleşimi: saf veri (three.js'e bağımlı değil).
// Gerçek kat planlarındaki mantık: iki blok (B solda, A sağda), aradaki orta salon,
// her blokta dış çeperde KIRMIZI HAT koridoru ve içeride 4 avlu (sarı/mavi/yeşil),
// numaralı kapı-merdivenler, avlu asansörleri ve orta salonda yürüyen merdivenler.

export const FH = 4.5;            // kat yüksekliği (m)
export const FLOORS = 13;
export const CEIL = 4.1;          // tavan yüksekliği
export const floorY = f => (f - 1) * FH;

// Izgara: 1 m hücre
export const GX0 = -166, GZ0 = -56, GW = 332, GH = 120;
export const cellIdx = (x, z) => {
  const i = Math.floor(x - GX0), j = Math.floor(z - GZ0);
  if (i < 0 || j < 0 || i >= GW || j >= GH) return -1;
  return j * GW + i;
};
export const cellCenter = idx => [GX0 + (idx % GW) + 0.5, GZ0 + Math.floor(idx / GW) + 0.5];

// Bölge kodları
export const Z = { NONE: 0, RED: 1, CROSS: 2, AVLU: 3, HALL: 4, PASS: 5, BRIDGE: 6, GARAGE: 7, ENTRY: 8 };

export const ZONE_COLORS = {
  KIRMIZI: 0xd2232a, SARI: 0xf2b705, MAVI: 0x1f6fd1, YESIL: 0x3fae49,
};
export const ZONE_LABEL = { KIRMIZI: 'Kırmızı hat', SARI: 'Sarı avlu', MAVI: 'Mavi avlu', YESIL: 'Yeşil avlu' };

export const BLOCKS = [
  { id: 'B', cx: -85, inner: +1 },   // iç yüz (orta salona bakan) +u yönünde
  { id: 'A', cx: +85, inner: -1 },
];
const HU = 75, HV = 50;            // blok yarı boyutları
const STRIP = 7, RED_W = 6;         // dış dükkan şeridi derinliği, kırmızı hat genişliği
const IN_U = HU - STRIP - RED_W;    // 62  iç bölge yarı genişliği
const IN_V = HV - STRIP - RED_W;    // 37
const CROSS = 2.5;                  // ara koridor yarı genişliği
const CELL_HU = (IN_U - CROSS) / 2; // 29.75
const CELL_HV = (IN_V - CROSS) / 2; // 17.25
const OCT_VOID = 5, OCT_RING = 9, OCT_SHOP = 15;

export const HALL = { x0: -10, x1: 10, z0: -50, z1: 50 };
export const WELLS = [ // yürüyen merdiven boşlukları (orta salon)
  { id: 'G', name: 'Güney', x0: -5, x1: 5, z0: -34, z1: -14 },
  { id: 'K', name: 'Kuzey', x0: -5, x1: 5, z0: 14, z1: 34 },
];
export const ENTRY = { x: 0, z: 60, floor: 8 }; // ana giriş (meydan tarafı, 8. kat)

const octR = (du, dv) => Math.max(Math.abs(du), Math.abs(dv), (Math.abs(du) + Math.abs(dv)) * 0.70710678);

export const variantOf = f => (f <= 3 ? 'G' : f === 8 ? 'E' : 'N');

// Avlular (hücreler)
export const CELLS = [];
{
  // gerçek kat planlarından: sıra arka-sol, arka-sağ, ön-sol, ön-sağ (blok ortasındaki yeşil
  // bölge avluya ait değil, dükkân renkleri firmalar.json'daki gerçek renkten gelir)
  const real = {
    B: { colors: ['MAVI', 'SARI', 'MAVI', 'SARI'], elev: [20, 19, 13, 14] },
    A: { colors: ['SARI', 'MAVI', 'SARI', 'MAVI'], elev: [18, 17, 15, 16] },
  };
  for (const blk of BLOCKS) {
    const R = real[blk.id];
    let k = 0;
    for (const sv of [-1, 1]) for (const su of [-1, 1]) {
      const cu = su * (CROSS + CELL_HU), cv = sv * (CROSS + CELL_HV);
      CELLS.push({
        block: blk.id, cx: blk.cx + cu, cz: cv, color: R.colors[k], front: sv > 0,
        elevator: R.elev[k], idx: CELLS.length,
      });
      k++;
    }
  }
}

// Kapılar / merdiven çekirdekleri (1-12)
export const GATES = [];
{
  // yerler gerçek kat planından (scripts/fit_coords.py, kapı ikonları); u blok merkezine göre
  const REAL = {
    B: [{ n: 1, u: 37.5, v: HV, side: 'front' }, { n: 2, u: -34, v: HV, side: 'front' }, { n: 3, u: -HU, v: 36, side: 'end' },
      { n: 4, u: -63, v: -HV, side: 'back' }, { n: 5, u: -38, v: -HV, side: 'back' }, { n: 6, u: 30, v: -HV, side: 'back' }],
    A: [{ n: 7, u: -41.5, v: -HV, side: 'back' }, { n: 8, u: 28.5, v: -HV, side: 'back' }, { n: 9, u: 56, v: -HV, side: 'back' },
      { n: 10, u: 62, v: HV, side: 'front' }, { n: 11, u: 33, v: HV, side: 'front' }, { n: 12, u: -30.5, v: HV, side: 'front' }],
  };
  for (const blk of BLOCKS) {
    for (const s of REAL[blk.id]) {
      let core, door, face;
      if (s.side === 'front' || s.side === 'back') {
        const sg = Math.sign(s.v);
        core = { x: blk.cx + s.u, z: sg * (HV - STRIP / 2), w: 6, d: STRIP, rot: sg > 0 ? Math.PI : 0 };
        door = { x: blk.cx + s.u, z: sg * (HV - STRIP - 2) };
        face = [0, -sg];
      } else {
        const sg = Math.sign(s.u);
        core = { x: blk.cx + sg * (HU - STRIP / 2), z: s.v, w: 6, d: STRIP, rot: sg > 0 ? -Math.PI / 2 : Math.PI / 2 };
        door = { x: blk.cx + sg * (HU - STRIP - 2), z: s.v };
        face = [-sg, 0];
      }
      GATES.push({ n: s.n, block: blk.id, core, door, face });
    }
  }
}

// çekirdeğin x/z yarı boyutları
export function coreHalf(c) {
  const horiz = Math.abs(Math.sin(c.rot)) < 0.5;
  return horiz ? [c.w / 2, c.d / 2] : [c.d / 2, c.w / 2];
}

// Dikey bağlantılar (rota motoru için)
// type: elevator | escalator | stairs ; her biri için giriş/çıkış noktaları
export const CONNECTORS = [];
for (const c of CELLS) {
  CONNECTORS.push({
    type: 'elevator', id: `E${c.elevator}`, name: `${c.elevator} no'lu avlu asansörü`, cell: c,
    pt: { x: c.cx + 3.2, z: c.cz }, cab: { x: c.cx, z: c.cz },
  });
}
for (const w of WELLS) {
  CONNECTORS.push({
    type: 'escalator', id: `Y${w.id}`, name: `orta salon (${w.name}) yürüyen merdiveni`, well: w,
    upFrom: { x: -2.5, z: w.z0 - 1.5 }, upTo: { x: -2.5, z: w.z1 + 1.5 },
    downFrom: { x: 2.5, z: w.z1 + 1.5 }, downTo: { x: 2.5, z: w.z0 - 1.5 },
  });
}
for (const g of GATES) {
  CONNECTORS.push({ type: 'stairs', id: `K${g.n}`, name: `Kapı ${g.n} merdiveni`, gate: g, pt: g.door });
}

// Dikey maliyet (metre eşdeğeri)
export function verticalCost(type, df) {
  const n = Math.abs(df);
  if (type === 'elevator') return 70 + 5 * n;
  if (type === 'escalator') return 40 * n;
  return 20 + 35 * n; // merdiven
}

// --- Dükkan slotları -------------------------------------------------------
// Her slot: {x,z,w,d,rot(θ: yerel +z → (sinθ,cosθ)), zone, block, cell}
function facingRot(fx, fz) { return Math.atan2(fx, fz); }

function blockSlots(blk, variant) {
  const out = [];
  const garage = variant === 'G';
  const push = (u, v, w, d, fx, fz, zone, cell = null) =>
    out.push({ x: blk.cx + u, z: v, w, d, rot: facingRot(fx, fz), fx, fz, zone, block: blk.id, cell });
  const gateHit = (x, z, hx, hz) => GATES.some(g => {
    if (g.block !== blk.id) return false;
    const [cx, cz] = coreHalf(g.core);
    return Math.abs(g.core.x - x) < cx + hx - 0.05 && Math.abs(g.core.z - z) < cz + hz - 0.05;
  });
  // gerçek dükkân cephesi ~3,5 m; B Blok gerçekte A'dan ~%14 uzun, aynı çevreye daha çok dükkân sığıyor
  const SW = blk.id === 'B' ? 3.1 : 3.6;
  // dış şerit: ön ve arka yüz
  for (const sv of [1, -1]) {
    if (garage && sv > 0) continue;
    for (let u = -HU + SW / 2; u <= HU - SW / 2 + 0.01; u += SW) {
      const v = sv * (HV - STRIP / 2);
      if (Math.abs(u) > HU - STRIP + 0.1) continue; // köşeler kapalı
      if (gateHit(blk.cx + u, v, SW / 2, STRIP / 2)) continue;
      push(u, v, SW, STRIP, 0, -sv, 'KIRMIZI');
    }
  }
  // yan yüzler (iç yüzde orta salona geçişler var)
  for (const su of [1, -1]) {
    const isInner = su === blk.inner;
    for (let v = -HV + STRIP + SW / 2; v <= HV - STRIP - SW / 2 + 0.01; v += SW) {
      if (garage && v > 0) continue;
      const u = su * (HU - STRIP / 2);
      if (isInner && PASSAGES.some(p => Math.abs(p - v) < 5)) continue;
      if (gateHit(blk.cx + u, v, STRIP / 2, SW / 2)) continue;
      push(u, v, SW, STRIP, -su, 0, 'KIRMIZI');
    }
  }
  // garaj katları: garaja bakan sırt sırta dükkân sırası (gerçek planda 1–3. katların ortasında)
  if (garage) {
    for (let u = -HU + STRIP + SW / 2; u <= HU - STRIP - SW / 2 + 0.01; u += SW) {
      push(u, GARAGE_ROW - 3, SW, 6, 0, -1, 'KIRMIZI');
      push(u, GARAGE_ROW + 3, SW, 6, 0, 1, 'KIRMIZI');
    }
  }
  // avlular
  for (const c of CELLS.filter(c => c.block === blk.id)) {
    if (garage && c.front) continue;
    const cu = c.cx - blk.cx, cv = c.cz;
    // sekizgen halka dükkanları (çapraz kenarlar)
    for (let k = 1; k < 8; k += 2) {
      const a = k * Math.PI / 4, nx = Math.cos(a), nz = Math.sin(a), tx = -nz, tz = nx;
      for (const o of [-1.9, 1.9]) {
        const r = (OCT_RING + OCT_SHOP) / 2;
        out.push({ x: c.cx + nx * r + tx * o, z: cv + nz * r + tz * o, w: 3.7, d: OCT_SHOP - OCT_RING,
          rot: facingRot(-nx, -nz), fx: -nx, fz: -nz, zone: c.color, block: blk.id, cell: c.idx });
      }
    }
    // yan bölgeler: radyal koridora ve hücre kenarına bakan sıralar
    for (const su of [-1, 1]) for (const sv of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const u = cu + su * (OCT_SHOP + 0.2 + 3.6 * i + 1.8);
        push(u, cv + sv * (2 + 3), 3.6, 6, 0, -sv, c.color, c.idx);            // radyal koridora bakan
        push(u, cv + sv * (CELL_HV - 3), 3.6, 6, 0, sv, c.color, c.idx);        // dış koridora bakan
      }
    }
  }
  return out;
}
export const PASSAGES = [-25, 0, 25];
const GARAGE_ROW = 20.5; // garaj katlarındaki dükkân sırasının ortası (v) // orta salon -> blok geçişleri (v)

// --- Yürünebilir ızgara -----------------------------------------------------
export function buildGrid(variant) {
  const zone = new Uint8Array(GW * GH);
  const meta = new Int8Array(GW * GH).fill(-1); // avlu hücre indeksi
  const set = (x0, x1, z0, z1, code, m = -1) => {
    for (let z = Math.floor(z0); z < Math.ceil(z1); z++) for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
      const cx = x + 0.5, cz = z + 0.5;
      if (cx < x0 || cx > x1 || cz < z0 || cz > z1) continue;
      const i = cellIdx(cx, cz);
      if (i >= 0) { zone[i] = code; meta[i] = m; }
    }
  };
  for (const blk of BLOCKS) {
    const X = u => blk.cx + u;
    // kırmızı hat halkası
    set(X(-HU + STRIP), X(HU - STRIP), HV - STRIP - RED_W, HV - STRIP, Z.RED);
    set(X(-HU + STRIP), X(HU - STRIP), -HV + STRIP, -HV + STRIP + RED_W, Z.RED);
    set(X(-HU + STRIP), X(-HU + STRIP + RED_W), -HV + STRIP, HV - STRIP, Z.RED);
    set(X(HU - STRIP - RED_W), X(HU - STRIP), -HV + STRIP, HV - STRIP, Z.RED);
    // ara koridorlar
    set(X(-IN_U), X(IN_U), -CROSS, CROSS, Z.CROSS);
    set(X(-CROSS), X(CROSS), -IN_V, IN_V, Z.CROSS);
    // orta salona geçişler
    const innerU = blk.inner * HU;
    for (const p of PASSAGES) set(Math.min(X(innerU), X(innerU - blk.inner * (STRIP + 0.5))), Math.max(X(innerU), X(innerU - blk.inner * (STRIP + 0.5))), p - 2.5, p + 2.5, Z.PASS);
    if (variant === 'G') { // garaj: ön yarı açık alan
      set(X(-HU + STRIP), X(HU - STRIP), 0, HV - STRIP, Z.GARAGE);
      set(X(-HU + 1), X(HU - 1), 2, HV - 1, Z.GARAGE);
      set(X(-HU + STRIP), X(HU - STRIP), GARAGE_ROW - 6, GARAGE_ROW + 6, Z.NONE);
    }
  }
  for (const c of CELLS) {
    if (variant === 'G' && c.front) continue;
    for (let z = Math.floor(c.cz - CELL_HV); z < c.cz + CELL_HV; z++) for (let x = Math.floor(c.cx - CELL_HU); x < c.cx + CELL_HU; x++) {
      const px = x + 0.5, pz = z + 0.5, du = px - c.cx, dv = pz - c.cz;
      if (Math.abs(du) > CELL_HU || Math.abs(dv) > CELL_HV) continue;
      const r = octR(du, dv);
      let walk = false;
      if (r >= OCT_VOID && r < OCT_RING) walk = true;
      if (Math.abs(dv) <= 2 && Math.abs(du) >= OCT_RING - 1) walk = true;           // D/B radyal
      if (Math.abs(du) <= 2 && Math.abs(dv) >= OCT_RING - 1) walk = true;           // K/G radyal
      if (Math.abs(dv) <= 1.2 && du >= 1.4 && du < OCT_VOID) { const i = cellIdx(px, pz); zone[i] = Z.BRIDGE; meta[i] = c.idx; continue; }
      if (walk) { const i = cellIdx(px, pz); zone[i] = Z.AVLU; meta[i] = c.idx; }
    }
  }
  // orta salon (yürüyen merdiven boşlukları hariç)
  set(HALL.x0, HALL.x1, HALL.z0, HALL.z1, Z.HALL);
  for (const w of WELLS) set(w.x0, w.x1, w.z0, w.z1, Z.NONE);
  if (variant === 'E') set(-6, 6, HALL.z1 - 0.5, 62, Z.ENTRY);
  // merdiven çekirdekleri yürünemez
  for (const g of GATES) {
    const [hw, hd] = coreHalf(g.core);
    set(g.core.x - hw, g.core.x + hw, g.core.z - hd, g.core.z + hd, Z.NONE);
  }
  return { zone, meta, variant };
}

// --- Varyant bazında yerleşim ---------------------------------------------
const cache = {};
export function getLayout(variant) {
  if (cache[variant]) return cache[variant];
  const grid = buildGrid(variant);
  const slots = [];
  for (const blk of BLOCKS) for (const s of blockSlots(blk, variant)) slots.push(s);
  // kapı noktası: dükkanın önündeki en yakın yürünebilir hücre
  for (const s of slots) {
    const dx = s.x + s.fx * (s.d / 2 + 1.4), dz = s.z + s.fz * (s.d / 2 + 1.4);
    s.door = nearestWalkable(grid, dx, dz) || { x: dx, z: dz };
  }
  cache[variant] = { variant, grid, slots };
  return cache[variant];
}

export function nearestWalkable(grid, x, z, maxR = 4) {
  for (let r = 0; r <= maxR; r++) {
    let best = null, bd = 1e9;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const i = cellIdx(x + dx, z + dz);
      if (i >= 0 && grid.zone[i]) {
        const [cx, cz] = cellCenter(i), d = (cx - x) ** 2 + (cz - z) ** 2;
        if (d < bd) { bd = d; best = { x: cx, z: cz }; }
      }
    }
    if (best) return best;
  }
  return null;
}

export function zoneAt(grid, x, z) {
  const i = cellIdx(x, z);
  if (i < 0) return null;
  const code = grid.zone[i];
  const blk = x < HALL.x0 ? 'B Blok' : x > HALL.x1 ? 'A Blok' : null;
  switch (code) {
    case Z.RED: return { key: 'red', text: `${blk} · Kırmızı hat`, color: 'KIRMIZI' };
    case Z.CROSS: return { key: 'cross' + blk, text: `${blk} · ara koridor` };
    case Z.AVLU: case Z.BRIDGE: {
      const c = CELLS[grid.meta[i]];
      return { key: 'avlu' + c.idx, text: `${blk} · ${ZONE_LABEL[c.color]}`, color: c.color };
    }
    case Z.HALL: case Z.PASS: return { key: 'hall', text: 'Orta salon' };
    case Z.GARAGE: return { key: 'garage' + blk, text: `${blk} · Garaj` };
    case Z.ENTRY: return { key: 'entry', text: 'Ana giriş' };
    default: return null;
  }
}

// geometri yardımcıları (render için)
export const DIM = { HU, HV, STRIP, RED_W, IN_U, IN_V, CROSS, CELL_HU, CELL_HV, OCT_VOID, OCT_RING, OCT_SHOP };
