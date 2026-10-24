// Geometri birleştirme ve canvas doku yardımcıları
import * as THREE from 'three';

const unitBox = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
const UB_P = unitBox.attributes.position.array, UB_N = unitBox.attributes.normal.array, UB_UV = unitBox.attributes.uv.array;

const tmpC = new THREE.Color();

// Tek çağrıda çizilecek kutu/dörtgen yığını (vertex color'lı)
export class Builder {
  constructor() { this.p = []; this.n = []; this.c = []; this.uv = []; }
  // rot: Y ekseni etrafında; yerel +z -> (sin rot, cos rot)
  box(cx, cy, cz, sx, sy, sz, rot, color, shade = 1) {
    const cs = Math.cos(rot), sn = Math.sin(rot);
    tmpC.set(color).multiplyScalar(shade);
    for (let i = 0; i < UB_P.length; i += 3) {
      const lx = UB_P[i] * sx, ly = UB_P[i + 1] * sy, lz = UB_P[i + 2] * sz;
      this.p.push(cx + lx * cs + lz * sn, cy + ly, cz - lx * sn + lz * cs);
      const nx = UB_N[i], ny = UB_N[i + 1], nz = UB_N[i + 2];
      this.n.push(nx * cs + nz * sn, ny, -nx * sn + nz * cs);
      // üst yüzleri biraz açık, alt yüzleri koyu: ucuz ortam gölgesi
      const k = ny > 0.5 ? 1.08 : ny < -0.5 ? 0.7 : 1;
      this.c.push(tmpC.r * k, tmpC.g * k, tmpC.b * k);
    }
    for (let i = 0; i < UB_UV.length; i++) this.uv.push(UB_UV[i]);
  }
  // dikey dörtgen: merkez, genişlik, yükseklik, rot (normal yerel +z), uv dikdörtgeni [u0,v0,u1,v1]
  quad(cx, cy, cz, w, h, rot, uvr = [0, 0, 1, 1], color = 0xffffff) {
    const cs = Math.cos(rot), sn = Math.sin(rot), hw = w / 2, hh = h / 2;
    const P = (lx, ly) => [cx + lx * cs, cy + ly, cz - lx * sn];
    const v = [P(-hw, -hh), P(hw, -hh), P(hw, hh), P(-hw, -hh), P(hw, hh), P(-hw, hh)];
    const [u0, v0, u1, v1] = uvr;
    const uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v0], [u1, v1], [u0, v1]];
    tmpC.set(color);
    for (let k = 0; k < 6; k++) {
      this.p.push(...v[k]); this.n.push(sn, 0, cs); this.uv.push(...uvs[k]); this.c.push(tmpC.r, tmpC.g, tmpC.b);
    }
  }
  // yatay dörtgen (yukarı bakan)
  flat(cx, cy, cz, sx, sz, rot, color, down = false) {
    const cs = Math.cos(rot), sn = Math.sin(rot), hx = sx / 2, hz = sz / 2;
    const P = (lx, lz) => [cx + lx * cs + lz * sn, cy, cz - lx * sn + lz * cs];
    let v = [P(-hx, hz), P(hx, hz), P(hx, -hz), P(-hx, hz), P(hx, -hz), P(-hx, -hz)];
    if (down) v = [v[0], v[2], v[1], v[3], v[5], v[4]];
    tmpC.set(color);
    for (let k = 0; k < 6; k++) { this.p.push(...v[k]); this.n.push(0, down ? -1 : 1, 0); this.uv.push(0, 0); this.c.push(tmpC.r, tmpC.g, tmpC.b); }
  }
  get empty() { return this.p.length === 0; }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    return g;
  }
}

export function canvasTex(w, h, draw, opts = {}) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'); draw(ctx, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = opts.aniso ?? 8;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...opts.repeat); }
  t.canvas = cv;
  return t;
}

// metni kutuya sığdır
export function fitText(ctx, text, maxW, size, weight = '700', family = 'Inter, Arial, sans-serif') {
  let s = size;
  do { ctx.font = `${weight} ${s}px ${family}`; s -= 1; } while (ctx.measureText(text).width > maxW && s > 8);
  return s + 1;
}

export function wrap2(ctx, text, maxW) {
  const words = text.split(' '); let a = '', i = 0;
  for (; i < words.length; i++) { const t = a ? a + ' ' + words[i] : words[i]; if (ctx.measureText(t).width > maxW && a) break; a = t; }
  let b = words.slice(i).join(' ');
  if (ctx.measureText(b).width > maxW) { while (b.length > 1 && ctx.measureText(b + '…').width > maxW) b = b.slice(0, -1); b += '…'; }
  return [a, b];
}

export const hex = c => '#' + new THREE.Color(c).getHexString();

// Basit tekrarlanabilir rastgele
export function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
