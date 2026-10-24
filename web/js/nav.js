// Rota motoru: ızgara üzerinde Dijkstra, katlar arası bağlantı seçimi, çok duraklı tur.
import {
  GW, GH, cellIdx, cellCenter, getLayout, variantOf, CONNECTORS, verticalCost, zoneAt, floorY,
} from './layout.js';

const SQ2 = Math.SQRT2;
const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, SQ2], [1, -1, SQ2], [-1, 1, SQ2], [-1, -1, SQ2]];

class Heap {
  constructor() { this.k = []; this.v = []; }
  push(key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop(), n = k.length;
    if (n) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1; if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
  get size() { return this.k.length; }
}

// Bir noktadan tüm kata mesafe alanı + ebeveyn ağacı
export function field(floor, x, z) {
  const { grid } = getLayout(variantOf(floor));
  const zone = grid.zone, N = GW * GH;
  const dist = new Float32Array(N).fill(Infinity), par = new Int32Array(N).fill(-1);
  const s = cellIdx(x, z);
  const h = new Heap(); dist[s] = 0; h.push(0, s);
  while (h.size) {
    const i = h.pop(), d = dist[i], ix = i % GW, iz = (i / GW) | 0;
    for (const [dx, dz, w] of NB) {
      const nx = ix + dx, nz = iz + dz;
      if (nx < 0 || nz < 0 || nx >= GW || nz >= GH) continue;
      const j = nz * GW + nx;
      if (!zone[j]) continue;
      if (dx && dz && (!zone[iz * GW + nx] || !zone[nz * GW + ix])) continue; // köşe kesme yok
      const nd = d + w;
      if (nd < dist[j]) { dist[j] = nd; par[j] = i; h.push(nd, j); }
    }
  }
  return { floor, x, z, dist, par, grid };
}

const at = (f, p) => f.dist[cellIdx(p.x, p.z)];

// f ağacında p'den köke giden hücre yolu (kök = alanın başladığı nokta)
function toRoot(f, p) {
  const out = []; let i = cellIdx(p.x, p.z);
  while (i >= 0) { out.push(cellCenter(i)); i = f.par[i]; }
  return out;
}

function los(grid, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), n = Math.ceil(L / 0.25);
  for (let k = 1; k < n; k++) {
    const t = k / n, x = a[0] + dx * t, z = a[1] + dz * t;
    // yarı-genişlik payı: avatar duvara sürtmesin
    for (const [ox, oz] of [[0, 0], [0.45, 0], [-0.45, 0], [0, 0.45], [0, -0.45]]) {
      const i = cellIdx(x + ox, z + oz);
      if (i < 0 || !grid.zone[i]) return false;
    }
  }
  return true;
}

export function smooth(grid, pts) {
  if (pts.length < 3) return pts.slice();
  const out = [pts[0]]; let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !los(grid, pts[i], pts[j])) j--;
    out.push(pts[j]); i = j;
  }
  return out;
}

function polyLen(p) { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; }

// İki durak arası maliyet + kullanılacak bağlantı
function bestLink(fa, fb) {
  if (fa.floor === fb.floor) return { cost: at(fa, fb), via: null };
  const up = fb.floor > fa.floor, df = fb.floor - fa.floor;
  let best = { cost: Infinity, via: null };
  for (const c of CONNECTORS) {
    let a, b;
    if (c.type === 'escalator') { a = up ? c.upFrom : c.downFrom; b = up ? c.upTo : c.downTo; }
    else { a = c.pt; b = c.pt; }
    const cost = at(fa, a) + verticalCost(c.type, df) + at(fb, b);
    if (cost < best.cost) best = { cost, via: c, a, b };
  }
  return best;
}

// Held-Karp (n <= 11) ya da en yakın komşu + 2-opt
function solveTour(C, n) {
  // düğüm 0 = başlangıç, n+1 = bitiş (aynı nokta), 1..n = duraklar
  if (n === 0) return [];
  if (n <= 11) {
    const FULL = 1 << n, dp = new Float64Array(FULL * n).fill(Infinity), pr = new Int8Array(FULL * n).fill(-1);
    for (let i = 0; i < n; i++) dp[(1 << i) * n + i] = C[0][i + 1];
    for (let m = 1; m < FULL; m++) for (let i = 0; i < n; i++) {
      const cur = dp[m * n + i]; if (!(m & (1 << i)) || cur === Infinity) continue;
      for (let j = 0; j < n; j++) {
        if (m & (1 << j)) continue;
        const nm = m | (1 << j), v = cur + C[i + 1][j + 1];
        if (v < dp[nm * n + j]) { dp[nm * n + j] = v; pr[nm * n + j] = i; }
      }
    }
    let best = Infinity, last = -1;
    for (let i = 0; i < n; i++) { const v = dp[(FULL - 1) * n + i] + C[i + 1][n + 1]; if (v < best) { best = v; last = i; } }
    const order = []; let m = FULL - 1;
    while (last >= 0) { order.push(last); const p = pr[m * n + last]; m &= ~(1 << last); last = p; }
    return order.reverse();
  }
  const left = new Set([...Array(n).keys()]), order = []; let cur = -1;
  while (left.size) {
    let b = null, bd = Infinity;
    for (const j of left) { const d = C[cur + 1][j + 1]; if (d < bd) { bd = d; b = j; } }
    order.push(b); left.delete(b); cur = b;
  }
  const cost = o => o.reduce((s, v, k) => s + C[(k ? o[k - 1] : -1) + 1][v + 1], 0) + C[o[o.length - 1] + 1][n + 1];
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) {
      const o2 = order.slice(0, i).concat(order.slice(i, j + 1).reverse(), order.slice(j + 1));
      if (cost(o2) < cost(order) - 1e-6) { order.splice(0, n, ...o2); improved = true; }
    }
  }
  return order;
}

// stops: [{x,z,floor, ...}] ; start: {x,z,floor}
// dönen: { order, legs:[{from,to,segments,length}], total }
export function planRoute(start, stops, fixedOrder = false, end = start) {
  const nodes = [start, ...stops, end];
  const fields = nodes.map(p => field(p.floor, p.x, p.z));
  const n = stops.length;
  const C = Array.from({ length: n + 2 }, () => new Float64Array(n + 2));
  const L = Array.from({ length: n + 2 }, () => Array(n + 2));
  const fi = k => fields[k];
  for (let a = 0; a < n + 2; a++) for (let b = 0; b < n + 2; b++) {
    if (a === b) continue;
    const l = bestLink(fi(a), fi(b));
    C[a][b] = l.cost; L[a][b] = l;
  }
  const order = fixedOrder ? [...Array(n).keys()] : solveTour(C, n);
  const seq = [0, ...order.map(i => i + 1), n + 1];
  const legs = [];
  let total = 0;
  for (let k = 0; k < seq.length - 1; k++) {
    const a = seq[k], b = seq[k + 1];
    const leg = buildLeg(fi(a), fi(b), L[a][b]);
    leg.toStop = b === n + 1 ? null : b - 1;
    legs.push(leg); total += leg.length;
  }
  return { order, legs, total };
}

// Bir bacağın segmentleri: walk / ride
function buildLeg(fa, fb, link) {
  const segs = [];
  const walk = (f, from, toField) => {
    // from noktasından toField'in köküne
    const raw = toRoot(toField, from);
    const pts = smooth(toField.grid, raw.map(p => [p[0], p[1]]));
    pts[0] = [from.x, from.z];
    return { type: 'walk', floor: f, pts, length: polyLen(pts) };
  };
  if (!link.via) {
    segs.push(walk(fa.floor, { x: fa.x, z: fa.z }, fb));
  } else {
    const c = link.via;
    // fa'dan bağlantı giriş noktasına: fa ağacında a'dan köke yolu ters çevir
    const back = walk(fa.floor, link.a, fa);
    back.pts.reverse(); back.pts[0] = [fa.x, fa.z]; back.pts[back.pts.length - 1] = [link.a.x, link.a.z];
    segs.push(back);
    segs.push(...rideSegments(c, fa.floor, fb.floor));
    segs.push(walk(fb.floor, link.b, fb));
  }
  // son nokta: hedef
  const last = segs[segs.length - 1];
  last.pts[last.pts.length - 1] = [fb.x, fb.z];
  return { segments: segs, length: segs.reduce((s, g) => s + (g.length || 0), 0) + (link.via ? verticalCost(link.via.type, fb.floor - fa.floor) : 0), via: link.via, fromFloor: fa.floor, toFloor: fb.floor };
}

function rideSegments(c, f0, f1) {
  const out = [], dir = Math.sign(f1 - f0);
  if (c.type === 'elevator') {
    out.push({ type: 'ride', kind: 'elevator', conn: c, from: f0, to: f1, x: c.pt.x, z: c.pt.z, cab: c.cab });
  } else if (c.type === 'stairs') {
    out.push({ type: 'ride', kind: 'stairs', conn: c, from: f0, to: f1, x: c.pt.x, z: c.pt.z });
  } else {
    // her kat için ayrı yürüyen merdiven + aradaki katta boşluğun etrafından dolaşma
    for (let f = f0; f !== f1; f += dir) {
      const a = dir > 0 ? c.upFrom : c.downFrom, b = dir > 0 ? c.upTo : c.downTo;
      out.push({ type: 'ride', kind: 'escalator', conn: c, from: f, to: f + dir, a, b });
      if (f + dir !== f1) {
        const sx = Math.sign(a.x) * 7.5;
        out.push({ type: 'walk', floor: f + dir, pts: [[b.x, b.z], [sx, b.z], [sx, a.z], [a.x, a.z]], length: Math.abs(sx - b.x) * 2 + Math.abs(a.z - b.z), transfer: true });
      }
    }
  }
  return out;
}

// --- Tarif üretimi --------------------------------------------------------
export function legInstructions(leg, target) {
  const steps = [];
  const fmt = m => `${Math.max(5, Math.round(m / 5) * 5)} m`;
  for (const s of leg.segments) {
    if (s.type === 'walk') {
      if (s.transfer) continue;
      const { grid } = getLayout(variantOf(s.floor));
      // yol boyunca bölge değişimleri
      let runs = [], cur = null;
      for (let i = 1; i < s.pts.length; i++) {
        const [x0, z0] = s.pts[i - 1], [x1, z1] = s.pts[i], len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(len / 1.5));
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n, zz = zoneAt(grid, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
          if (!zz) continue;
          if (!cur || cur.key !== zz.key) { cur = { key: zz.key, text: zz.text, len: 0 }; runs.push(cur); }
          cur.len += len / n;
        }
      }
      runs = runs.filter((r, i) => r.len >= 4 || i === runs.length - 1);
      const merged = [];
      for (const r of runs) { const p = merged[merged.length - 1]; if (p && p.key === r.key) p.len += r.len; else merged.push({ ...r }); }
      merged.forEach((r, i) => {
        const verb = i === 0 ? 'boyunca ilerleyin' : 'bölümüne geçin';
        steps.push({ floor: s.floor, text: `${r.text} ${verb}`, dist: fmt(r.len) });
      });
    } else if (s.type === 'ride') {
      const yon = s.to > s.from ? 'çıkın' : 'inin';
      const dirText = s.kind === 'elevator' ? `${s.conn.name} ile ${s.to}. kata ${yon}`
        : s.kind === 'stairs' ? `${s.conn.name}nden ${s.to}. kata ${yon}`
          : `Yürüyen merdivenle ${s.to}. kata ${yon}`;
      const prev = steps[steps.length - 1];
      if (s.kind === 'escalator' && prev && prev.esc) { prev.text = dirText; continue; }
      steps.push({ floor: s.from, text: dirText, esc: s.kind === 'escalator', ride: true });
    }
  }
  if (target) steps.push({ text: target, final: true });
  return steps;
}

export { floorY };
