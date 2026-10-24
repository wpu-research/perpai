// 3D dünya: dış cephe + meydan, katlar (detaylı / sade), çekirdekler, x-ray görünüm.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  FH, FLOORS, CEIL, floorY, GW, GH, GX0, GZ0, Z, CELLS, GATES, WELLS, HALL, BLOCKS, PASSAGES, ZONE_COLORS,
  ZONE_LABEL, DIM, getLayout, variantOf, coreHalf, ENTRY,
} from './layout.js';
import { Builder, canvasTex, fitText, wrap2, hex, rng } from './geo.js';
import { DB } from './data.js';

const TOP = floorY(FLOORS) + FH;      // çatı
const PLAZA_Y = floorY(8);           // meydan kotu = 8. kat
const ZC = Object.fromEntries(Object.entries(ZONE_COLORS).map(([k, v]) => [k, new THREE.Color(v)]));

export class World {
  constructor(canvas) {
    // Optimus/hibrit GPU'larda 'high-performance' bağlam açamayabiliyor: sırayla daha hafif ayarları dene
    let r = null, lastErr;
    for (const opts of [{ antialias: true, powerPreference: 'high-performance' }, { antialias: true }, { antialias: false, powerPreference: 'low-power' }]) {
      try { r = new THREE.WebGLRenderer({ canvas, ...opts }); break; } catch (e) { lastErr = e; }
    }
    if (!r) throw new Error('WEBGL: ' + (lastErr?.message || 'WebGL bağlamı açılamadı'));
    this.renderer = r;
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.95;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 3000);
    this.groups = {};
    for (const n of ['exterior', 'lite', 'detail', 'cores', 'xray', 'route', 'actors']) {
      this.groups[n] = new THREE.Group(); this.groups[n].name = n; this.scene.add(this.groups[n]);
    }
    this.variantCache = {};
    this.floor = 8;
    this.mats();
    this.lights();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- malzemeler
  mats() {
    const tile = canvasTex(512, 512, (c, w, h) => {
      const R = rng(7);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const v = 222 + Math.floor(R() * 14);
        c.fillStyle = `rgb(${v},${v - 3},${v - 8})`; c.fillRect(x * 64, y * 64, 64, 64);
        for (let k = 0; k < 30; k++) { c.fillStyle = `rgba(120,110,100,${R() * 0.12})`; c.fillRect(x * 64 + R() * 64, y * 64 + R() * 64, 2, 2); }
      }
      c.strokeStyle = 'rgba(150,140,130,.55)'; c.lineWidth = 2;
      for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(i * 64, 0); c.lineTo(i * 64, h); c.stroke(); c.beginPath(); c.moveTo(0, i * 64); c.lineTo(w, i * 64); c.stroke(); }
    }, { repeat: [1, 1] });
    tile.wrapS = tile.wrapT = THREE.RepeatWrapping;
    this.M = {
      vc: new THREE.MeshLambertMaterial({ vertexColors: true }),
      floor: new THREE.MeshLambertMaterial({ map: tile, color: 0xffffff }),
      ceil: new THREE.MeshLambertMaterial({ color: 0xd9d6cf, side: THREE.DoubleSide }),
      glass: new THREE.MeshLambertMaterial({ color: 0xbfd9e6, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
      light: new THREE.MeshBasicMaterial({ color: 0xfffaf0 }),
      liteSolid: new THREE.MeshLambertMaterial({ vertexColors: true }),
      liteX: new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.13, depthWrite: false }),
      slabX: new THREE.MeshBasicMaterial({ color: 0x9fb3c8, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }),
      slabSolid: new THREE.MeshLambertMaterial({ color: 0xcfcac2, side: THREE.DoubleSide }),
      concrete: new THREE.MeshLambertMaterial({ color: 0xb8b2a8 }),
      steel: new THREE.MeshLambertMaterial({ color: 0x8a9096 }),
      steps: new THREE.MeshLambertMaterial({ color: 0x9aa1a8 }),
    };
    // dünya koordinatında karo: uv = xz/4
    this.M.floor.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = (vec4(position,1.0)).xz / 4.8;\n#endif');
    };
  }

  lights() {
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xc2baa9, 1.6);
    this.scene.add(this.hemi);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    this.sun = new THREE.DirectionalLight(0xfff1dd, 1.6);
    this.sun.position.set(-200, 400, 300);
    this.scene.add(this.sun);
  }

  // ---------------------------------------------------------------- yapı
  build() {
    this.buildCores();
    this.buildExterior();
    for (let f = 1; f <= FLOORS; f++) {
      const v = variantOf(f), V = this.variant(v);
      const m = new THREE.Mesh(V.lite, this.M.liteSolid); m.position.y = floorY(f); m.userData.floor = f;
      const s = new THREE.Mesh(V.slab, this.M.slabSolid); s.position.y = floorY(f) - 0.02; s.userData.floor = f;
      this.groups.lite.add(m, s);
    }
    this.detailGroup = new THREE.Group(); this.groups.detail.add(this.detailGroup);
    this.buildXray();
  }

  slabShape(v) {
    const sh = new THREE.Shape();
    const x0 = -160.3, x1 = 160.3, z0 = -50.3, z1 = 50.3;
    // xz -> shape(x, -z)
    sh.moveTo(x0, -z0); sh.lineTo(x1, -z0); sh.lineTo(x1, -z1);
    if (v === 'E') { sh.lineTo(6, -z1); sh.lineTo(6, -62); sh.lineTo(-6, -62); sh.lineTo(-6, -z1); }
    sh.lineTo(x0, -z1); sh.lineTo(x0, -z0);
    for (const c of CELLS) {
      if (v === 'G' && c.front) continue;
      const h = new THREE.Path(), r = DIM.OCT_VOID / Math.cos(Math.PI / 8);
      for (let k = 0; k <= 8; k++) { const a = Math.PI / 8 + k * Math.PI / 4; const px = c.cx + r * Math.cos(a), pz = c.cz + r * Math.sin(a); k ? h.lineTo(px, -pz) : h.moveTo(px, -pz); }
      sh.holes.push(h);
    }
    for (const w of WELLS) {
      const h = new THREE.Path(); h.moveTo(w.x0, -w.z0); h.lineTo(w.x0, -w.z1); h.lineTo(w.x1, -w.z1); h.lineTo(w.x1, -w.z0); h.lineTo(w.x0, -w.z0); sh.holes.push(h);
    }
    const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2);
    return g;
  }

  // varyant bazında paylaşılan geometriler
  variant(v) {
    if (this.variantCache[v]) return this.variantCache[v];
    const lay = getLayout(v);
    const slab = this.slabShape(v);
    // sade (lite): dükkan kütleleri
    const L = new Builder();
    for (const s of lay.slots) {
      const col = ZC[s.zone].clone().lerp(new THREE.Color(0xffffff), 0.35);
      L.box(s.x, 1.6, s.z, s.w - 0.2, 3.2, s.d - 0.2, s.rot, col);
    }
    for (const g of GATES) { const [hx, hz] = coreHalf(g.core); L.box(g.core.x, 2, g.core.z, hx * 2, 4, hz * 2, 0, 0x8b7355); }
    const V = { lay, slab, lite: L.geometry() };
    this.variantCache[v] = V;
    return V;
  }

  // detaylı kat (varyant başına bir kez kurulur)
  variantDetail(v) {
    const V = this.variant(v);
    if (V.detail) return V.detail;
    const lay = V.lay, R = rng(v.charCodeAt(0) * 99);
    const W = new Builder(), G = new Builder(), Lt = new Builder();
    const prodPal = [0xe63946, 0xf1faee, 0x457b9d, 0x1d3557, 0xffb703, 0x2a9d8f, 0x264653, 0xe76f51, 0x8d99ae, 0x111111, 0xff7f11, 0x6a4c93];
    const wall = 0xeeebe5;
    for (const s of lay.slots) {
      const cs = Math.cos(s.rot), sn = Math.sin(s.rot);
      const L = (lx, lz) => [s.x + lx * cs + lz * sn, s.z - lx * sn + lz * cs];
      const bx = (lx, ly, lz, sx, sy, sz, col, shade) => { const [x, z] = L(lx, lz); W.box(x, ly, z, sx, sy, sz, s.rot, col, shade); };
      const hw = s.w / 2, hd = s.d / 2;
      bx(0, CEIL / 2, -hd + 0.07, s.w, CEIL, 0.14, wall);                    // arka duvar
      bx(-hw + 0.06, CEIL / 2, 0, 0.12, CEIL, s.d, wall, 0.95);             // yan duvarlar
      bx(hw - 0.06, CEIL / 2, 0, 0.12, CEIL, s.d, wall, 0.95);
      bx(0, 3.35, hd - 0.12, s.w, 0.85, 0.24, ZC[s.zone]);                  // alın bandı (hat rengi)
      bx(0, CEIL - 0.15, hd - 0.15, s.w, 0.3, 0.3, 0x3a3d42);               // kepenk kutusu
      bx(0, 2.86, hd - 0.12, s.w - 0.1, 0.1, 0.2, 0x2b2e33);
      // raflar ve ürünler
      bx(0, 1.15, -hd + 0.45, s.w - 0.5, 2.3, 0.55, 0xd7d2c8);
      for (let row = 0; row < 3; row++) {
        let x = -hw + 0.45;
        while (x < hw - 0.6) {
          const bw = 0.25 + R() * 0.45, bh = 0.2 + R() * 0.35;
          if (x + bw > hw - 0.4) break;
          bx(x + bw / 2, 0.45 + row * 0.72 + bh / 2, -hd + 0.5, bw, bh, 0.35, prodPal[(R() * prodPal.length) | 0]);
          x += bw + 0.05;
        }
      }
      if (s.d > 5.5) bx(-hw + 0.45, 1.0, -0.6, 0.5, 2.0, s.d - 3.4, 0xcfc9bd);
      bx(hw * 0.35, 0.5, hd - 1.7, Math.min(1.8, s.w * 0.4), 1.0, 0.6, 0x8a6a4a); // tezgah
      bx(hw * 0.35, 1.08, hd - 1.7, 0.4, 0.15, 0.3, 0x222222);                  // yazar kasa
      // cam vitrin (kapı boşluklu)
      const gw = hw - 0.7;
      const [g1x, g1z] = L(-hw + gw / 2 + 0.05, hd - 0.1), [g2x, g2z] = L(hw - gw / 2 - 0.05, hd - 0.1);
      G.box(g1x, 1.4, g1z, gw, 2.8, 0.04, s.rot, 0xffffff);
      G.box(g2x, 1.4, g2z, gw, 2.8, 0.04, s.rot, 0xffffff);
      const [lx, lz] = L(0, -0.4);
      Lt.flat(lx, CEIL - 0.02, lz, s.w * 0.5, 0.6, s.rot, 0xffffff, true);
    }
    // merdiven çekirdekleri (kat seviyesi kapı + çerçeve)
    for (const g of GATES) {
      const [fx, fz] = g.face, rot = Math.atan2(fx, fz), [hx, hz] = coreHalf(g.core);
      const ox = g.core.x + fx * (fx ? hx : 0), oz = g.core.z + fz * (fz ? hz : 0);
      W.box(ox, 1.25, oz, 0.1, 2.5, 0.1, rot, 0x333333);
      W.box(ox + Math.cos(rot) * 0, 1.2, oz, 2.2, 2.4, 0.08, rot, 0x6b5b45);
      W.box(ox, 2.55, oz, 2.6, 0.2, 0.15, rot, 0x2f6b3a);
    }
    // korkuluklar: avlu boşlukları
    const rail = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), rot = Math.atan2(z1 - z0, -(x1 - x0)) + Math.PI / 2;
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, r2 = Math.atan2(-(z1 - z0), x1 - x0);
      G.box(mx, 0.55, mz, len, 1.0, 0.05, r2, 0xffffff);
      W.box(mx, 1.1, mz, len, 0.07, 0.1, r2, 0x9aa1a8);
    };
    for (const c of CELLS) {
      if (v === 'G' && c.front) continue;
      const r = DIM.OCT_VOID / Math.cos(Math.PI / 8);
      for (let k = 0; k < 8; k++) {
        const a0 = -Math.PI / 8 + k * Math.PI / 4, a1 = a0 + Math.PI / 4;
        const p0 = [c.cx + r * Math.cos(a0), c.cz + r * Math.sin(a0)], p1 = [c.cx + r * Math.cos(a1), c.cz + r * Math.sin(a1)];
        if (k === 0) { // doğu kenarı: köprü boşluğu
          rail(p0[0], p0[1], p0[0], c.cz - 1.3); rail(p1[0], c.cz + 1.3, p1[0], p1[1]);
          // köprü korkulukları
          rail(c.cx + 1.8, c.cz - 1.3, p0[0], c.cz - 1.3); rail(c.cx + 1.8, c.cz + 1.3, p0[0], c.cz + 1.3);
          continue;
        }
        rail(p0[0], p0[1], p1[0], p1[1]);
      }
      // köprü zemini
      W.box(c.cx + 3.4, -0.1, c.cz, 3.3, 0.2, 2.6, 0, 0xc9c4ba);
    }
    for (const w of WELLS) { rail(w.x0, w.z0 + 2, w.x0, w.z1 - 2); rail(w.x1, w.z0 + 2, w.x1, w.z1 - 2); }
    // tavan ışıkları: koridorlarda 6 m'de bir
    const grid = lay.grid;
    for (let j = 3; j < GH; j += 6) for (let i = 3; i < GW; i += 6) {
      const idx = j * GW + i;
      if (!grid.zone[idx]) continue;
      let ok = true;
      for (let dz = -1; dz <= 1 && ok; dz++) for (let dx = -1; dx <= 1; dx++) if (!grid.zone[idx + dz * GW + dx]) { ok = false; break; }
      if (!ok) continue;
      Lt.flat(GX0 + i + 0.5, CEIL - 0.02, GZ0 + j + 0.5, 1.2, 1.2, 0, 0xffffff, true);
    }
    // orta salon arka duvarı: Atatürk köşesi
    W.box(0, 2, HALL.z0 + 0.1, 20, 4, 0.2, 0, 0xe8e3da);
    if (v !== 'E') W.box(0, 2, HALL.z1 - 0.1, 20, 4, 0.2, 0, 0xe8e3da);
    else { W.box(-8, 2, HALL.z1, 4, 4, 0.3, 0, 0xe8e3da); W.box(8, 2, HALL.z1, 4, 4, 0.3, 0, 0xe8e3da); }
    // köşeler (kapalı dolu kütle)
    for (const b of BLOCKS) for (const su of [-1, 1]) for (const sv of [-1, 1]) {
      W.box(b.cx + su * (DIM.HU - DIM.STRIP / 2), CEIL / 2, sv * (DIM.HV - DIM.STRIP / 2), DIM.STRIP, CEIL, DIM.STRIP, 0, 0xd8d3ca);
    }
    // garaj katı: park etmiş araçlar
    if (v === 'G') {
      const carCols = [0xffffff, 0x222222, 0xb0b5ba, 0x8b0000, 0x1e3a5f, 0xd4c9a8];
      for (const b of BLOCKS) for (let u = -60; u <= 60; u += 3) for (const vv of [12, 22, 32]) {
        if (R() < 0.3) continue;
        const col = carCols[(R() * carCols.length) | 0];
        W.box(b.cx + u, 0.55, vv, 1.8, 0.8, 4.3, 0, col);
        W.box(b.cx + u, 1.15, vv - 0.2, 1.6, 0.5, 2.3, 0, col, 0.85);
        G.box(b.cx + u, 1.15, vv - 0.2, 1.62, 0.45, 2.32, 0, 0x88aacc);
      }
    }
    V.detail = { walls: W.geometry(), glass: G.geometry(), lights: Lt.geometry() };
    // dükkan tabelaları: slot başına dörtgen, atlas uv'leri
    const S = new Builder(), cols = 8, rowsN = Math.ceil(lay.slots.length / cols);
    V.atlas = { cols, rows: rowsN, cw: 256, ch: 56 };
    lay.slots.forEach((s, k) => {
      const u0 = (k % cols) / cols, v1 = 1 - Math.floor(k / cols) / rowsN, v0 = v1 - 1 / rowsN;
      const w = s.w - 0.3, h = w * 56 / 256;
      S.quad(s.x + s.fx * (s.d / 2 + 0.005), 3.35, s.z + s.fz * (s.d / 2 + 0.005), w, Math.min(h, 0.8), s.rot, [u0, v0, u0 + 1 / cols, v1]);
    });
    V.detail.signs = S.geometry();
    // yön tabelaları
    V.way = this.wayfinding(v);
    return V.detail;
  }

  wayfinding(v) {
    const list = [];
    const add = (x, z, rot, kind, data) => list.push({ x, z, rot, kind, data });
    for (const c of CELLS) {
      if (v === 'G' && c.front) continue;
      add(c.cx, c.cz + DIM.CELL_HV - 0.6, 0, 'avlu', c);
      add(c.cx, c.cz - DIM.CELL_HV + 0.6, Math.PI, 'avlu', c);
      add(c.cx + DIM.CELL_HU - 0.6, c.cz, Math.PI / 2, 'avlu', c);
      add(c.cx - DIM.CELL_HU + 0.6, c.cz, -Math.PI / 2, 'avlu', c);
    }
    for (const b of BLOCKS) {
      for (const p of PASSAGES) add(b.cx + b.inner * (DIM.HU + 1.0), p, b.inner * Math.PI / 2, 'blok', b);
      for (const u of [-40, 0, 40]) for (const sv of [-1, 1]) {
        if (v === 'G' && sv > 0) continue;
        add(b.cx + u, sv * (DIM.HV - DIM.STRIP - DIM.RED_W / 2), sv > 0 ? 0 : Math.PI, 'red', b);
      }
    }
    for (const z of [-44, -6, 6, 44]) add(0, z, z > 0 ? 0 : Math.PI, 'hall', z);
    const B = new Builder(), T = new Builder();
    const cols = 2, rows = Math.ceil(list.length / cols);
    list.forEach((s, k) => {
      const u0 = (k % cols) / cols, v1 = 1 - Math.floor(k / cols) / rows, v0 = v1 - 1 / rows;
      const w = 4.2, h = w * 64 / 512;
      B.box(s.x, 3.3, s.z, w + 0.1, h + 0.1, 0.08, s.rot, 0x1c2633);
      for (const side of [1, -1]) {
        const r = s.rot + (side < 0 ? Math.PI : 0);
        T.quad(s.x + Math.sin(r) * 0.05, 3.3, s.z + Math.cos(r) * 0.05, w, h, r, [u0, v0, u0 + 1 / cols, v1]);
      }
      for (const o of [-1.6, 1.6]) B.box(s.x + Math.cos(s.rot) * o, 3.75, s.z - Math.sin(s.rot) * o, 0.03, 0.75, 0.03, 0, 0x555555);
    });
    return { list, boards: B.geometry(), text: T.geometry(), cols, rows };
  }

  // kat başına atlas çizimi
  drawShopAtlas(f) {
    const V = this.variant(variantOf(f)), A = V.atlas;
    const shops = DB.floors[f];
    const tex = canvasTex(A.cols * A.cw, A.rows * A.ch, (c) => {
      shops.forEach((s, k) => {
        const x = (k % A.cols) * A.cw, y = Math.floor(k / A.cols) * A.ch, zc = hex(ZONE_COLORS[s.slot.zone]);
        c.fillStyle = zc; c.fillRect(x, y, A.cw, A.ch);
        c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x, y + A.ch - 4, A.cw, 4);
        const dark = s.slot.zone === 'SARI';
        c.fillStyle = dark ? '#1b1b1b' : '#fff';
        c.font = '800 30px Inter, Arial, sans-serif'; c.textBaseline = 'middle';
        const no = String(s.no).padStart(4, '0');
        c.fillText(no, x + 8, y + A.ch / 2);
        const nw = c.measureText(no).width + 16;
        if (s.firm) {
          c.font = '600 15px Inter, Arial, sans-serif';
          const [l1, l2] = wrap2(c, s.firm.n, A.cw - nw - 8);
          c.fillText(l1, x + nw, y + (l2 ? 18 : A.ch / 2)); if (l2) c.fillText(l2, x + nw, y + 37);
        } else {
          c.font = '500 13px Inter, Arial, sans-serif'; c.globalAlpha = 0.75;
          c.fillText(`${s.block} BLOK · ${f}. KAT`, x + nw, y + A.ch / 2); c.globalAlpha = 1;
        }
      });
    }, { aniso: 4 });
    tex.generateMipmaps = true;
    return tex;
  }

  drawWayAtlas(f, way) {
    return canvasTex(1024, way.rows * 64, (c) => {
      way.list.forEach((s, k) => {
        const x = (k % 2) * 512, y = Math.floor(k / 2) * 64;
        c.fillStyle = '#1c2633'; c.fillRect(x, y, 512, 64);
        let stripe = '#888', text = '', sub = '';
        if (s.kind === 'avlu') { stripe = hex(ZONE_COLORS[s.data.color]); text = `${ZONE_LABEL[s.data.color].toLocaleUpperCase('tr-TR')}`; sub = `Asansör ${s.data.elevator} · ${f}. kat`; }
        if (s.kind === 'red') { stripe = hex(ZONE_COLORS.KIRMIZI); text = 'KIRMIZI HAT'; sub = `${s.data.id} Blok · ${f}. kat`; }
        if (s.kind === 'blok') { stripe = '#f5f5f5'; text = `${s.data.id} BLOK ${s.data.id === 'A' ? '›' : '‹'}`; sub = `${f}. kat`; }
        if (s.kind === 'hall') { stripe = '#4cc9f0'; text = 'ORTA SALON'; sub = `‹ B Blok · Yürüyen merdiven · A Blok › · ${f}. kat`; }
        c.fillStyle = stripe; c.fillRect(x, y, 14, 64);
        c.fillStyle = '#fff'; c.textBaseline = 'middle';
        fitText(c, text, 280, 30, '800'); c.fillText(text, x + 28, y + 32);
        const tw = c.measureText(text).width;
        c.globalAlpha = 0.8; fitText(c, sub, 512 - tw - 60, 18, '500'); c.fillText(sub, x + 40 + tw, y + 34); c.globalAlpha = 1;
      });
    }, { aniso: 4 });
  }

  setFloor(f) {
    this.floor = f;
    const v = variantOf(f), V = this.variant(v), D = this.variantDetail(v);
    const g = this.detailGroup;
    g.clear();
    this._atlasCache = this._atlasCache || new Map();
    let at = this._atlasCache.get(f);
    if (!at) {
      at = { shop: this.drawShopAtlas(f), way: this.drawWayAtlas(f, V.way) };
      this._atlasCache.set(f, at);
      if (this._atlasCache.size > 4) { const k = this._atlasCache.keys().next().value; const o = this._atlasCache.get(k); o.shop.dispose(); o.way.dispose(); this._atlasCache.delete(k); }
    }
    g.add(new THREE.Mesh(V.slab, this.M.floor));
    const ceil = new THREE.Mesh(V.slab, this.M.ceil); ceil.position.y = CEIL; g.add(ceil);
    g.add(new THREE.Mesh(D.walls, this.M.vc));
    g.add(new THREE.Mesh(D.lights, this.M.light));
    g.add(new THREE.Mesh(D.signs, new THREE.MeshBasicMaterial({ map: at.shop, toneMapped: false })));
    g.add(new THREE.Mesh(V.way.boards, this.M.vc));
    g.add(new THREE.Mesh(V.way.text, new THREE.MeshBasicMaterial({ map: at.way, toneMapped: false })));
    const glass = new THREE.Mesh(D.glass, this.M.glass); glass.renderOrder = 2; g.add(glass);
    g.position.y = floorY(f);
    for (const m of this.groups.lite.children) m.visible = m.userData.floor !== f;
    this.floorChanged?.(f);
  }

  // ---------------------------------------------------------------- çekirdekler
  buildCores() {
    const B = new Builder(), G = new Builder(), S = new Builder();
    // avlu asansörleri: cam şaft + çelik dikmeler
    this.cabins = {};
    for (const c of CELLS) {
      for (let k = 0; k < 4; k++) {
        const a = Math.PI / 4 + k * Math.PI / 2;
        B.box(c.cx + Math.cos(a) * 1.55, TOP / 2, c.cz + Math.sin(a) * 1.55, 0.14, TOP, 0.14, 0, 0x7d8790);
      }
      for (let f = 1; f <= FLOORS; f++) B.box(c.cx, floorY(f) + CEIL + 0.15, c.cz, 3.3, 0.18, 3.3, 0, 0x7d8790);
      const cab = new THREE.Group();
      const cb = new Builder(), cg = new Builder();
      cb.box(0, 0.05, 0, 2.3, 0.1, 2.3, 0, 0x30363d); cb.box(0, 2.5, 0, 2.3, 0.12, 2.3, 0, 0x30363d);
      for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) cb.box(x, 1.25, z, 0.1, 2.5, 0.1, 0, 0xb8c0c8);
      cb.box(0, 2.62, 0, 1.4, 0.12, 0.3, 0, 0xff3b30);
      cg.box(0, 1.25, -1.12, 2.2, 2.4, 0.03, 0, 0xffffff); cg.box(-1.12, 1.25, 0, 0.03, 2.4, 2.2, 0, 0xffffff); cg.box(0, 1.25, 1.12, 2.2, 2.4, 0.03, 0, 0xffffff);
      cab.add(new THREE.Mesh(cb.geometry(), this.M.vc));
      const cgm = new THREE.Mesh(cg.geometry(), this.M.glass); cgm.renderOrder = 3; cab.add(cgm);
      const f0 = 1 + ((c.idx * 5) % FLOORS);
      cab.position.set(c.cx, floorY(f0), c.cz);
      cab.userData = { target: floorY(f0), idle: true };
      this.groups.cores.add(cab);
      this.cabins[c.elevator] = cab;
    }
    // yürüyen merdivenler: her kat arası, iki boşlukta (malzeme başına tek geometri)
    const esc = { steps: [], glass: [], steel: [] };
    const put = (arr, geo, x, y, z, rx) => { geo.rotateX(rx); geo.translate(x, y, z); arr.push(geo); };
    for (const w of WELLS) for (let f = 1; f < FLOORS; f++) {
      const y0 = floorY(f), y1 = floorY(f + 1), run = w.z1 - w.z0, ang = Math.atan2(y1 - y0, run), len = Math.hypot(run, y1 - y0);
      for (const x of [-2.5, 2.5]) {
        const zc = (w.z0 + w.z1) / 2, yc = (y0 + y1) / 2;
        put(esc.steps, new THREE.BoxGeometry(1.5, 0.5, len), x, yc - 0.2, zc, -ang);
        for (const sx of [-0.85, 0.85]) {
          put(esc.glass, new THREE.BoxGeometry(0.12, 1.0, len), x + sx, yc + 0.45, zc, -ang);
          put(esc.steel, new THREE.BoxGeometry(0.14, 0.08, len), x + sx, yc + 0.95, zc, -ang);
        }
      }
      B.box(0, (floorY(f) + floorY(f + 1)) / 2, (w.z0 + w.z1) / 2, 0.6, 0.6, w.z1 - w.z0 - 2, 0, 0xb0aaa0); // orta kiriş
    }
    for (const [k, mat] of [['steps', this.M.steps], ['glass', this.M.glass], ['steel', this.M.steel]]) {
      const m = new THREE.Mesh(mergeGeometries(esc[k]), mat); if (k === 'glass') m.renderOrder = 2;
      this.groups.cores.add(m);
    }
    // merdiven çekirdekleri (tüm yükseklik)
    for (const g of GATES) {
      const [hx, hz] = coreHalf(g.core);
      S.box(g.core.x, TOP / 2, g.core.z, hx * 2, TOP, hz * 2, 0, 0x9c8f7c);
    }
    this.groups.cores.add(new THREE.Mesh(B.geometry(), this.M.vc));
    const gm = new THREE.Mesh(G.geometry(), this.M.glass); this.groups.cores.add(gm);
    this.stairCores = new THREE.Mesh(S.geometry(), this.M.vc); this.groups.cores.add(this.stairCores);
    // asansör şaft camları (tek silindir)
    const shafts = CELLS.map(c => new THREE.CylinderGeometry(1.5, 1.5, TOP, 16, 1, true).translate(c.cx, TOP / 2, c.cz));
    const sh = new THREE.Mesh(mergeGeometries(shafts), this.M.glass); sh.renderOrder = 1; this.groups.cores.add(sh);
  }

  // ---------------------------------------------------------------- dış cephe
  buildExterior() {
    const g = this.groups.exterior, y0 = PLAZA_Y;
    // gökyüzü
    const sky = new Sky(); sky.scale.setScalar(4500);
    const u = sky.material.uniforms; u.turbidity.value = 2.2; u.rayleigh.value = 2.6; u.mieCoefficient.value = 0.005; u.mieDirectionalG.value = 0.85;
    const sun = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(58), THREE.MathUtils.degToRad(160));
    u.sunPosition.value.copy(sun);
    this.sky = sky; this.scene.add(sky);
    // cephe dokusu: krem renkli bantlar + yatay şerit pencereler
    const facade = (wm) => canvasTex(512, 256, (c, w, h) => {
      c.fillStyle = '#e9e1cf'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#2f4256'; c.fillRect(0, 70, w, 90);
      c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(0, 74, w, 14);
      c.fillStyle = '#d9cfb8';
      for (let x = 0; x < w; x += 64) c.fillRect(x, 66, 8, 98);
      c.fillStyle = '#c9bfa8'; c.fillRect(0, 160, w, 6); c.fillRect(0, 0, w, 4);
    }, { repeat: [wm, 1] });
    const floorsVis = FLOORS - 7; // 8..13
    const H = floorsVis * FH;
    const mk = (w, rx, mat) => new THREE.Mesh(new THREE.PlaneGeometry(w, H), mat);
    const fM = (w) => new THREE.MeshLambertMaterial({ map: (() => { const t = facade(w / 16); t.repeat.set(w / 16, floorsVis); return t; })() });
    const front1 = mk(149.7, 0, fM(150)); front1.position.set(-85.15, y0 + H / 2, 50.35);
    const front2 = mk(149.7, 0, fM(150)); front2.position.set(85.15, y0 + H / 2, 50.35);
    const back = mk(320.6, 0, fM(320)); back.position.set(0, y0 + H / 2, -50.35); back.rotation.y = Math.PI;
    const left = mk(100.7, 0, fM(100)); left.position.set(-160.35, y0 + H / 2, 0); left.rotation.y = -Math.PI / 2;
    const right = mk(100.7, 0, fM(100)); right.position.set(160.35, y0 + H / 2, 0); right.rotation.y = Math.PI / 2;
    g.add(front1, front2, back, left, right);
    // orta salon cephesi (kule arkası)
    const hallWall = new THREE.Mesh(new THREE.PlaneGeometry(20.6, H), new THREE.MeshLambertMaterial({ color: 0xd6ccb6 }));
    hallWall.position.set(0, y0 + H / 2, 50.3); g.add(hallWall);
    // çatı + yeşil çatı bahçeleri + teknik odalar
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(321, 101), new THREE.MeshLambertMaterial({ color: 0x9aa39b }));
    roof.rotation.x = -Math.PI / 2; roof.position.y = TOP + 0.05; g.add(roof);
    const RB = new Builder(); const R = rng(3);
    for (const b of BLOCKS) {
      RB.box(b.cx, TOP + 0.6, 46, 148, 1.2, 8, 0, 0x6f8f5b);
      RB.box(b.cx, TOP + 0.6, -46, 148, 1.2, 8, 0, 0x6f8f5b);
      for (let k = 0; k < 6; k++) RB.box(b.cx - 60 + k * 24 + R() * 6, TOP + 1.5, -15 + R() * 30, 6 + R() * 6, 3, 5 + R() * 5, 0, 0xc8c3b8);
      RB.box(b.cx, TOP + 0.4, 0, 150.5, 0.8, 0.8, 0, 0xc9bfa8);
      for (const c of CELLS.filter(c => c.block === b.id)) RB.box(c.cx, TOP + 1.2, c.cz, 9, 2.4, 9, 0, 0xa9c4d4); // ışıklık
      // çatı kenarında "PERPA TİCARET MERKEZİ" levhası
    }
    for (const x of [-150, -20, 20, 150]) for (const z of [-50, 50]) RB.box(x, TOP + 0.9, z, 0.5, 1.8, 0.5, 0, 0xc9bfa8);
    g.add(new THREE.Mesh(RB.geometry(), this.M.vc));
    // cam kemerli giriş kulesi
    const glassMat = new THREE.MeshPhongMaterial({ color: 0x9fc3d6, specular: 0xffffff, shininess: 90, transparent: true, opacity: 0.78, side: THREE.DoubleSide });
    const mull = canvasTex(256, 256, (c, w, h) => {
      c.fillStyle = '#8fb6cc'; c.fillRect(0, 0, w, h);
      const grd = c.createLinearGradient(0, 0, w, h); grd.addColorStop(0, 'rgba(255,255,255,.35)'); grd.addColorStop(1, 'rgba(0,30,60,.2)');
      c.fillStyle = grd; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#e4e2dc'; c.lineWidth = 6; c.strokeRect(0, 0, w, h);
      c.lineWidth = 3; c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
    }, { repeat: [5, 8] });
    glassMat.map = mull;
    const TH = 30, tz0 = 50, tz1 = 57, tw = 20;
    const tower = new THREE.Group(); g.add(tower);
    const tfront = new THREE.Mesh(new THREE.PlaneGeometry(tw, TH - 4), glassMat); tfront.position.set(0, y0 + 4 + (TH - 4) / 2, tz1); tower.add(tfront);
    for (const x of [-7, 7]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), glassMat); p.position.set(x, y0 + 2, tz1); tower.add(p); }
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(tz1 - tz0, TH), glassMat); p.position.set(s * tw / 2, y0 + TH / 2, (tz0 + tz1) / 2); p.rotation.y = Math.PI / 2; tower.add(p); }
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(tw / 2, tw / 2, tz1 - tz0, 32, 1, true, -Math.PI / 2, Math.PI), glassMat);
    arch.rotation.x = Math.PI / 2; arch.position.set(0, y0 + TH, (tz0 + tz1) / 2); tower.add(arch);
    const archFace = new THREE.Mesh(new THREE.CircleGeometry(tw / 2, 32, 0, Math.PI), glassMat); archFace.position.set(0, y0 + TH, tz1); tower.add(archFace);
    // beton pilonlar (fotoğraftaki krem kuleler)
    const PB = new Builder();
    for (const s of [-1, 1]) PB.box(s * (tw / 2 + 2.2), y0 + (TH + 2) / 2, (tz0 + tz1) / 2 + 0.5, 4.4, TH + 2, 8, 0, 0xe3dccb);
    PB.box(0, y0 + 4.1, tz1 + 0.3, tw, 0.4, 0.8, 0, 0xe3dccb);
    PB.box(0, y0 + TH + 0.2, tz1 + 0.2, tw + 1, 0.4, 0.6, 0, 0xd7cfbf);
    // bayrak direkleri
    PB.box(-6, y0 + TH + 10 + 6, (tz0 + tz1) / 2, 0.25, 12, 0.25, 0, 0xdddddd);
    PB.box(7, y0 + TH + 7 + 6, (tz0 + tz1) / 2, 0.25, 10, 0.25, 0, 0xdddddd);
    tower.add(new THREE.Mesh(PB.geometry(), this.M.vc));
    // PERPA yazısı
    const sign = canvasTex(1024, 300, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.font = '900 230px "Arial Black", Inter, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 16; c.strokeStyle = '#ffffff'; c.strokeText('PERPA', w / 2, h / 2 + 10);
      c.fillStyle = '#e0607e'; c.fillText('PERPA', w / 2, h / 2 + 10);
    });
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(19, 5.6), new THREE.MeshBasicMaterial({ map: sign, transparent: true, toneMapped: false }));
    sm.position.set(0, y0 + TH + 3.4, tz1 + 0.6); tower.add(sm);
    const roofSign = canvasTex(1024, 160, (c, w, h) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = '#d42a3a'; c.font = '900 92px Inter, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('PERPA', w / 2, 62); c.font = '700 40px Inter, Arial'; c.fillText('TİCARET MERKEZİ', w / 2, 128);
    });
    for (const x of [-70, 90]) {
      const rs = new THREE.Mesh(new THREE.PlaneGeometry(16, 2.5), new THREE.MeshBasicMaterial({ map: roofSign, toneMapped: false }));
      rs.position.set(x, TOP + 3, 47); g.add(rs);
    }
    // bayraklar (dalgalanan)
    this.flags = [];
    const tr = canvasTex(300, 200, (c, w, h) => {
      c.fillStyle = '#e30a17'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#fff'; c.beginPath(); c.arc(112, 100, 50, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#e30a17'; c.beginPath(); c.arc(125, 100, 40, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; c.save(); c.translate(178, 100); c.beginPath();
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 4 * Math.PI / 5; c.lineTo(Math.cos(a) * 25, Math.sin(a) * 25); }
      c.closePath(); c.rotate(0); c.fill(); c.restore();
    });
    const wf = canvasTex(300, 200, (c, w, h) => { c.fillStyle = '#f4f4f4'; c.fillRect(0, 0, w, h); c.fillStyle = '#d42a3a'; c.font = '900 52px Inter, Arial'; c.textAlign = 'center'; c.fillText('PERPA', w / 2, 118); });
    for (const [x, top, tex] of [[-6, y0 + TH + 22, tr], [7, y0 + TH + 18, wf]]) {
      const fg = new THREE.PlaneGeometry(6, 4, 20, 4);
      const fm = new THREE.Mesh(fg, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
      fm.position.set(x + 3.1, top - 2, (tz0 + tz1) / 2); g.add(fm);
      this.flags.push({ m: fm, base: fg.attributes.position.array.slice() });
    }
    // kapılar
    const doorMat = new THREE.MeshPhongMaterial({ color: 0xbfe0ee, transparent: true, opacity: 0.45, shininess: 100 });
    this.doors = [];
    for (const s of [-1, 1]) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(2, 3.4, 0.06), doorMat);
      d.position.set(s * 1, y0 + 1.7, tz1); d.userData.base = s * 1; d.userData.s = s; g.add(d); this.doors.push(d);
    }
    // meydan zemini (bina tabanı boşluklu)
    const pave = canvasTex(512, 512, (c, w, h) => {
      const R2 = rng(11);
      c.fillStyle = '#8f877a'; c.fillRect(0, 0, w, h);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) {
        const v = 168 + R2() * 30; c.fillStyle = `rgb(${v},${v - 6},${v - 14})`;
        c.fillRect(x * 64 + (y % 2) * 32, y * 32, 62, 30);
        if (y % 2 && x === 7) c.fillRect(0, y * 32, 30, 30);
      }
    }, { repeat: [60, 60] });
    const gs = new THREE.Shape(); gs.moveTo(-600, 600); gs.lineTo(600, 600); gs.lineTo(600, -600); gs.lineTo(-600, -600); gs.lineTo(-600, 600);
    const hole = new THREE.Path(); hole.moveTo(-160.2, -50.2); hole.lineTo(-160.2, 50.2); hole.lineTo(160.2, 50.2); hole.lineTo(160.2, -50.2); hole.lineTo(-160.2, -50.2);
    gs.holes.push(hole);
    const gg = new THREE.ShapeGeometry(gs); gg.rotateX(-Math.PI / 2);
    const uv = gg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 20, uv.getY(i) / 20);
    pave.repeat.set(1, 1);
    const ground = new THREE.Mesh(gg, new THREE.MeshLambertMaterial({ map: pave }));
    ground.position.y = y0 - 0.01; g.add(ground);
    // çim alanlar, ağaçlar, lambalar, yol + metrobüs
    const P = new Builder();
    for (const s of [-1, 1]) {
      P.box(s * 45, y0 + 0.25, 100, 60, 0.5, 70, 0, 0x5f9443);
      P.box(s * 45, y0 + 0.3, 100, 62, 0.4, 72, 0, 0xc9c1ad, 0.9);
      P.box(s * 45, y0 + 0.55, 100, 60, 0.12, 70, 0, 0x5f9443);
      for (let k = 0; k < 9; k++) P.box(s * 14.5, y0 + 0.7, 70 + k * 8, 1.4, 1.4, 1.4, 0, 0xd8d0be);
    }
    const trees = [], R3 = rng(5);
    for (let k = 0; k < 60; k++) {
      const s = k % 2 ? 1 : -1;
      trees.push([s * (18 + R3() * 55), 68 + R3() * 64, 0.8 + R3() * 0.6]);
    }
    for (let k = 0; k < 40; k++) trees.push([(R3() - 0.5) * 900, 150 + R3() * 260, 1 + R3()]);
    for (let k = 0; k < 40; k++) { const side = k % 2 ? 1 : -1; trees.push([side * (175 + R3() * 120), (R3() - 0.5) * 300, 1 + R3()]); }
    for (const [x, z, s] of trees) {
      P.box(x, y0 + 1.5 * s, z, 0.4 * s, 3 * s, 0.4 * s, 0, 0x6b4f35);
      P.box(x, y0 + 4.2 * s, z, 3.6 * s, 3.2 * s, 3.6 * s, R3(), 0x2f6b2f);
      P.box(x, y0 + 5.6 * s, z, 2.4 * s, 2.0 * s, 2.4 * s, R3(), 0x3c7d34);
    }
    for (let k = 0; k < 8; k++) for (const s of [-1, 1]) {
      const z = 66 + k * 11;
      P.box(s * 9, y0 + 2.5, z, 0.18, 5, 0.18, 0, 0x333333);
      P.box(s * 9, y0 + 5.1, z, 0.7, 0.7, 0.7, 0, 0xfafafa);
    }
    // ilan panoları
    for (const [x, z] of [[-22, 72], [24, 80]]) P.box(x, y0 + 2.2, z, 4, 3, 0.3, 0.3, 0xd94f7a);
    // yol, metrobüs şeridi, durak
    P.box(0, y0 - 0.05, 185, 1200, 0.1, 40, 0, 0x3a3d40);
    P.box(0, y0, 185, 1200, 0.02, 9, 0, 0x5b4040);
    for (let x = -580; x < 580; x += 12) for (const z of [171, 178, 192, 199]) P.box(x, y0 + 0.03, z, 5, 0.02, 0.25, 0, 0xffffff);
    P.box(0, y0 + 5.5, 185, 46, 0.5, 6, 0, 0xc0c6cc);  // durak üst yapısı
    for (const x of [-21, 21]) P.box(x, y0 + 2.75, 185, 0.4, 5.5, 0.4, 0, 0x777777);
    P.box(0, y0 + 9, 166, 6, 0.6, 26, 0, 0x9aa0a6); // üst geçit
    for (const z of [156, 176]) P.box(0, y0 + 4.5, z, 0.8, 9, 0.8, 0, 0x777777);
    // binanın alt katları: yamaç tarafında görünen istinat duvarı
    P.box(0, y0 - 0.3, 150, 1200, 0.6, 1, 0, 0x888888);
    g.add(new THREE.Mesh(P.geometry(), this.M.vc));
    const stopSign = canvasTex(512, 128, (c, w, h) => { c.fillStyle = '#0a4ea2'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '800 64px Inter, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Ⓜ PERPA', w / 2, 52); c.font = '500 26px Inter'; c.fillText('Metrobüs durağı', w / 2, 104); });
    const ss = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), new THREE.MeshBasicMaterial({ map: stopSign, toneMapped: false }));
    ss.position.set(0, y0 + 7.2, 182); g.add(ss);
    const ss2 = ss.clone(); ss2.rotation.y = Math.PI; ss2.position.z = 188; g.add(ss2);
    // metrobüsler
    this.buses = [];
    const busMat = new THREE.MeshLambertMaterial({ color: 0xfafafa });
    for (const [x, z, dir] of [[-200, 183, 1], [150, 187, -1]]) {
      const bus = new THREE.Group();
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(18, 3.2, 2.6), busMat); b1.position.y = 1.9; bus.add(b1);
      const win = new THREE.Mesh(new THREE.BoxGeometry(17, 1.1, 2.65), new THREE.MeshLambertMaterial({ color: 0x223344 })); win.position.y = 2.4; bus.add(win);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(18.05, 0.3, 2.66), new THREE.MeshLambertMaterial({ color: 0xc8102e })); stripe.position.y = 1.3; bus.add(stripe);
      bus.position.set(x, y0, z); bus.userData.dir = dir; g.add(bus); this.buses.push(bus);
    }
    // uzaktaki şehir silüeti
    const C = new Builder(), R4 = rng(21);
    for (let k = 0; k < 160; k++) {
      const a = R4() * Math.PI * 2, d = 500 + R4() * 700, h = 10 + R4() * (R4() < 0.08 ? 110 : 35);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (z > 0 && Math.abs(x) < 300 && d < 600) continue;
      C.box(x, y0 - 20 + h / 2, z, 15 + R4() * 25, h + 20, 15 + R4() * 25, R4() * 3, [0xd8cfc0, 0xc9b9a6, 0xe7e2d8, 0xb9a48a, 0x9fb0c0][(R4() * 5) | 0]);
    }
    const city = new THREE.Mesh(C.geometry(), this.M.vc); g.add(city);
  }

  // ---------------------------------------------------------------- x-ray
  buildXray() {
    this.XS = 2.4; // dikey açma katsayısı
    const g = this.groups.xray;
    for (let f = 1; f <= FLOORS; f++) {
      const V = this.variant(variantOf(f));
      const y = floorY(f) * this.XS;
      const s = new THREE.Mesh(V.slab, this.M.slabX); s.position.y = y; g.add(s);
      const m = new THREE.Mesh(V.lite, this.M.liteX); m.position.y = y; m.scale.y = 0.55; g.add(m);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(320.6, 0.01, 100.6)), new THREE.LineBasicMaterial({ color: 0x8fb3d9, transparent: true, opacity: 0.5 }));
      edge.position.y = y; g.add(edge);
      const lab = this.label(`${f}. KAT`, '#cfe3ff', 'rgba(15,25,40,.75)', 0.55, true);
      lab.position.set(-172, y + 1, 50); g.add(lab);
    }
    g.visible = false;
  }

  label(text, color = '#fff', bg = 'rgba(0,0,0,.7)', size = 1, screen = false) {
    const t = canvasTex(512, 128, (c, w, h) => {
      c.font = '800 54px Inter, Arial, sans-serif'; const tw = c.measureText(text).width;
      const bw = Math.min(w, tw + 50);
      c.fillStyle = bg; roundRect(c, (w - bw) / 2, 18, bw, 92, 24); c.fill();
      c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, 66);
    });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, toneMapped: false }));
    sp.scale.set(16 * size, 4 * size, 1); sp.renderOrder = 10;
    if (screen) { sp.material.sizeAttenuation = false; sp.scale.set(0.15 * size, 0.0375 * size, 1); }
    return sp;
  }

  // ---------------------------------------------------------------- mod
  setMode(mode) {
    this.mode = mode;
    const G = this.groups;
    const ext = mode === 'exterior';
    G.exterior.visible = ext || mode === 'walk';
    this.sky.visible = mode !== 'xray';
    G.xray.visible = mode === 'xray';
    G.lite.visible = mode !== 'xray';
    G.detail.visible = mode === 'walk' || mode === 'exterior';
    G.cores.visible = mode !== 'xray';
    G.actors.visible = mode !== 'xray';
    this.scene.background = mode === 'xray' ? new THREE.Color(0x0b1220) : null;
    this.scene.fog = mode === 'walk' ? new THREE.Fog(0xe9e5dc, 40, 190) : null;
    this.hemi.intensity = mode === 'xray' ? 2.2 : 1.6;
  }

  update(dt, t) {
    for (const fl of this.flags || []) {
      const p = fl.m.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = fl.base[i * 3];
        p.setZ(i, Math.sin(x * 0.9 - t * 4) * 0.35 * ((x + 3) / 6));
      }
      p.needsUpdate = true;
    }
    for (const b of this.buses || []) { b.position.x += b.userData.dir * dt * 14; if (Math.abs(b.position.x) > 600) b.position.x = -b.userData.dir * 600; }
    // boşta asansörler gezinsin
    for (const cab of Object.values(this.cabins)) {
      const u = cab.userData; if (!u.idle) continue;
      const d = u.target - cab.position.y;
      if (Math.abs(d) < 0.05) { u.wait = (u.wait || 0) - dt; if (u.wait <= 0) { u.target = floorY(1 + ((Math.random() * FLOORS) | 0)); u.wait = 3 + Math.random() * 6; } }
      else cab.position.y += Math.sign(d) * Math.min(Math.abs(d), dt * 2.2);
    }
  }

  openDoors(avatarPos) {
    for (const d of this.doors) {
      const near = avatarPos && Math.abs(avatarPos.x) < 8 && Math.abs(avatarPos.z - 57) < 7 && Math.abs(avatarPos.y - PLAZA_Y) < 2;
      const tgt = d.userData.base + (near ? d.userData.s * 1.9 : 0);
      d.position.x += (tgt - d.position.x) * 0.15;
    }
  }

  render() { this.renderer.render(this.scene, this.camera); }
}

export function roundRect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

export { PLAZA_Y, TOP };
