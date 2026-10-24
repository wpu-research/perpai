// Avatar, kalabalık, hayaletler ve rota görselleri
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { CELLS, BLOCKS, DIM, HALL, floorY, variantOf, FH } from './layout.js';
import { canvasTex } from './geo.js';
import { roundRect } from './world.js';

// ---------------------------------------------------------------- insan
export function makePerson({ jacket = 0x2b6cb0, pants = 0x2d3142, skin = 0xe0b48f, hair = 0x2b1d14, fes = false, ghost = false, scale = 1 } = {}) {
  const g = new THREE.Group();
  const M = c => ghost
    ? new THREE.MeshLambertMaterial({ color: c, emissive: 0x88aaff, emissiveIntensity: 0.6, transparent: true, opacity: 0.55, depthWrite: false })
    : new THREE.MeshLambertMaterial({ color: c });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 4, 10), M(jacket)); torso.position.y = 1.18; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), M(skin)); head.position.y = 1.68; g.add(head);
  if (!ghost) { const hr = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(hair)); hr.position.y = 1.7; g.add(hr); }
  if (fes) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.2, 14), new THREE.MeshLambertMaterial({ color: 0xb3121d, transparent: ghost, opacity: ghost ? 0.85 : 1 }));
    f.position.y = 1.86; g.add(f);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.15), new THREE.MeshLambertMaterial({ color: 0x111111 })); p.position.set(0.05, 1.9, 0); p.rotation.z = 0.6; g.add(p);
    const beard = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), M(0xdddddd)); beard.position.set(0, 1.58, 0.08); beard.scale.set(1, 1.2, 0.7); g.add(beard);
  }
  const limb = (r, l, c) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 3, 8), M(c)); m.geometry.translate(0, -l / 2 - r, 0); return m; };
  const legL = limb(0.09, 0.62, pants), legR = limb(0.09, 0.62, pants);
  legL.position.set(-0.1, 0.88, 0); legR.position.set(0.1, 0.88, 0); g.add(legL, legR);
  const armL = limb(0.07, 0.5, jacket), armR = limb(0.07, 0.5, jacket);
  armL.position.set(-0.3, 1.45, 0); armR.position.set(0.3, 1.45, 0); g.add(armL, armR);
  g.userData = { legL, legR, armL, armR, torso, phase: 0 };
  g.scale.setScalar(scale);
  return g;
}

export function animatePerson(p, speed, dt) {
  const u = p.userData;
  u.phase += dt * (speed > 0.05 ? 2.2 + speed * 1.6 : 0);
  const a = speed > 0.05 ? Math.sin(u.phase) * Math.min(0.75, 0.3 + speed * 0.12) : u.legL.rotation.x * 0.85;
  u.legL.rotation.x = a; u.legR.rotation.x = -a;
  u.armL.rotation.x = -a * 0.8; u.armR.rotation.x = a * 0.8;
  u.torso.position.y = 1.18 + (speed > 0.05 ? Math.abs(Math.sin(u.phase)) * 0.04 : 0);
}

// ---------------------------------------------------------------- avatar
export class Avatar {
  constructor() {
    this.obj = makePerson({ jacket: 0xe85d04, pants: 0x1d3557 });
    // sırt çantası
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.18), new THREE.MeshLambertMaterial({ color: 0x14213d }));
    bag.position.set(0, 1.22, -0.25); this.obj.add(bag);
    // telefon
    this.phone = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.01), new THREE.MeshBasicMaterial({ color: 0x9ef0ff }));
    this.phone.position.set(0.3, 1.05, 0.25); this.phone.rotation.x = -0.8; this.obj.add(this.phone);
    // halka (konum işareti)
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.6, 32), new THREE.MeshBasicMaterial({ color: 0xff7a00, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.04; this.obj.add(this.ring);
    this.bags = [];
    this.heading = Math.PI;
  }
  addBag(color) {
    const n = this.bags.length;
    const b = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.1), new THREE.MeshLambertMaterial({ color }));
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 12, Math.PI), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    h.position.y = 0.16; b.add(body, h);
    b.position.set(n % 2 ? 0.42 : -0.42, 0.72 - Math.floor(n / 2) * 0.07, 0.04 * (n >> 1));
    this.obj.add(b); this.bags.push(b);
  }
}

// ---------------------------------------------------------------- kalabalık
export class Crowd {
  constructor(scene, n = 110) {
    this.n = n;
    const body = new THREE.CapsuleGeometry(0.22, 0.75, 3, 8); body.translate(0, 0.95, 0);
    const head = new THREE.SphereGeometry(0.15, 10, 8); head.translate(0, 1.65, 0);
    const legs = new THREE.BoxGeometry(0.34, 0.6, 0.18); legs.translate(0, 0.3, 0);
    this.body = new THREE.InstancedMesh(body, new THREE.MeshLambertMaterial(), n);
    this.head = new THREE.InstancedMesh(head, new THREE.MeshLambertMaterial(), n);
    this.legs = new THREE.InstancedMesh(legs, new THREE.MeshLambertMaterial(), n);
    const jackets = [0x2d3142, 0x4f5d75, 0x8d5524, 0x1d3557, 0x6d6875, 0x264653, 0x9b2226, 0x3a5a40, 0x222222, 0xb5838d, 0x588157, 0x7f5539];
    const skins = [0xe0b48f, 0xc68642, 0xf1c27d, 0x8d5524, 0xffdbac];
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      this.body.setColorAt(i, c.set(jackets[i % jackets.length]));
      this.head.setColorAt(i, c.set(skins[i % skins.length]));
      this.legs.setColorAt(i, c.set(i % 3 ? 0x2b2d42 : 0x3d405b));
    }
    for (const m of [this.body, this.head, this.legs]) { m.frustumCulled = false; scene.add(m); }
    this.agents = [];
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(1, 1, 1); this.p = new THREE.Vector3();
  }
  loopsFor(v) {
    const L = [];
    const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]];
    for (const b of BLOCKS) {
      const hu = DIM.HU - DIM.STRIP - DIM.RED_W / 2, hv = DIM.HV - DIM.STRIP - DIM.RED_W / 2;
      if (v === 'G') L.push(rect(b.cx - hu, -hv, b.cx + hu, 0));
      else { L.push(rect(b.cx - hu, -hv, b.cx + hu, hv)); L.push(rect(b.cx - hu, -hv, b.cx + hu, hv).reverse()); }
      L.push([[b.cx - DIM.IN_U, 0], [b.cx + DIM.IN_U, 0], [b.cx - DIM.IN_U, 0]]);
    }
    for (const c of CELLS) {
      if (v === 'G' && c.front) continue;
      const r = 7.4, pts = [];
      for (let k = 0; k <= 8; k++) { const a = k * Math.PI / 4 + Math.PI / 8; pts.push([c.cx + Math.cos(a) * r, c.cz + Math.sin(a) * r]); }
      L.push(pts);
      L.push([[c.cx - DIM.CELL_HU + 1, c.cz], [c.cx - 9, c.cz], [c.cx - DIM.CELL_HU + 1, c.cz]]);
    }
    L.push([[-7.5, -46], [-7.5, 46], [7.5, 46], [7.5, -46], [-7.5, -46]]);
    return L.map(pts => {
      const seg = []; let tot = 0;
      for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); tot += l; }
      return { pts, seg, tot };
    });
  }
  setFloor(f) {
    this.y = floorY(f);
    const loops = this.loopsFor(variantOf(f));
    const weights = loops.map(l => l.tot);
    const W = weights.reduce((a, b) => a + b, 0);
    this.agents = [];
    for (let i = 0; i < this.n; i++) {
      let r = Math.random() * W, k = 0; while (r > weights[k]) { r -= weights[k]; k++; }
      this.agents.push({ loop: loops[k], d: Math.random() * loops[k].tot, v: (0.9 + Math.random() * 0.7) * (Math.random() < 0.5 ? 1 : -1), off: (Math.random() - 0.5) * 3.2, stop: 0, ph: Math.random() * 6 });
    }
  }
  update(dt, t) {
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i], L = a.loop;
      if (a.stop > 0) a.stop -= dt; else { a.d = (a.d + a.v * dt + L.tot) % L.tot; if (Math.random() < dt * 0.04) a.stop = 2 + Math.random() * 5; }
      let d = a.d, k = 0; while (k < L.seg.length - 1 && d > L.seg[k]) { d -= L.seg[k]; k++; }
      const [x0, z0] = L.pts[k], [x1, z1] = L.pts[k + 1], tt = L.seg[k] ? d / L.seg[k] : 0;
      const dx = (x1 - x0) / (L.seg[k] || 1), dz = (z1 - z0) / (L.seg[k] || 1);
      const x = x0 + (x1 - x0) * tt - dz * a.off, z = z0 + (z1 - z0) * tt + dx * a.off;
      const head = Math.atan2(dx * Math.sign(a.v), dz * Math.sign(a.v));
      this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), head);
      const bob = a.stop > 0 ? 0 : Math.abs(Math.sin(t * 6 + a.ph)) * 0.04;
      this.p.set(x, this.y + bob, z);
      this.m4.compose(this.p, this.q, this.s);
      this.body.setMatrixAt(i, this.m4); this.head.setMatrixAt(i, this.m4);
      this.p.y = this.y; this.m4.compose(this.p, this.q, this.s); this.legs.setMatrixAt(i, this.m4);
    }
    for (const m of [this.body, this.head, this.legs]) m.instanceMatrix.needsUpdate = true;
  }
  set visible(v) { for (const m of [this.body, this.head, this.legs]) m.visible = v; }
}

// ---------------------------------------------------------------- konuşma balonu
export function bubble(text, w = 640) {
  const meas = document.createElement('canvas').getContext('2d'); meas.font = '600 32px Inter, Arial';
  const lines = [];
  for (const para of text.split('\n')) {
    let cur = '';
    for (const word of para.split(' ')) {
      const t = cur ? cur + ' ' + word : word;
      if (meas.measureText(t).width > w - 60 && cur) { lines.push(cur); cur = word; } else cur = t;
    }
    lines.push(cur);
  }
  const h = 60 + lines.length * 44;
  const t = canvasTex(w, h, (c) => {
    c.fillStyle = 'rgba(255,255,255,.95)'; roundRect(c, 4, 4, w - 8, h - 30, 26); c.fill();
    c.beginPath(); c.moveTo(w / 2 - 18, h - 27); c.lineTo(w / 2, h - 4); c.lineTo(w / 2 + 18, h - 27); c.fill();
    c.fillStyle = '#1b1f2a'; c.font = '600 32px Inter, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
    lines.forEach((l, i) => c.fillText(l, w / 2, 40 + i * 44));
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, toneMapped: false }));
  s.scale.set(w / 160, h / 160, 1); s.renderOrder = 20;
  return s;
}

// ---------------------------------------------------------------- rota görselleri
export class RouteViz {
  constructor(world) {
    this.world = world;
    this.walkGroup = new THREE.Group(); world.groups.route.add(this.walkGroup);
    this.xrayGroup = new THREE.Group(); world.groups.xray.add(this.xrayGroup);
    const chev = new THREE.Shape(); chev.moveTo(-0.45, -0.25); chev.lineTo(0, 0.25); chev.lineTo(0.45, -0.25); chev.lineTo(0.45, -0.05); chev.lineTo(0, 0.45); chev.lineTo(-0.45, -0.05);
    const cg = new THREE.ShapeGeometry(chev); cg.rotateX(-Math.PI / 2);
    this.chevGeo = cg;
    this.chevMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 4, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    this.beacon.visible = false; world.groups.route.add(this.beacon);
    this.beaconRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 40), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, toneMapped: false }));
    this.beaconRing.rotation.x = -Math.PI / 2; world.groups.route.add(this.beaconRing); this.beaconRing.visible = false;
    this.mats = [];
  }
  // yürüme modu: mevcut kattaki yol parçaları
  showWalk(pathsOnFloor, floor) {
    this.walkGroup.clear();
    const pts = [];
    for (const path of pathsOnFloor) {
      for (let i = 1; i < path.length; i++) {
        const [x0, z0] = path[i - 1], [x1, z1] = path[i], L = Math.hypot(x1 - x0, z1 - z0);
        const rot = Math.atan2(x1 - x0, z1 - z0);
        for (let d = 0.8; d < L; d += 1.7) pts.push([x0 + (x1 - x0) * d / L, z0 + (z1 - z0) * d / L, rot]);
      }
    }
    if (!pts.length) { this.chev = null; return; }
    const m = new THREE.InstancedMesh(this.chevGeo, this.chevMat, pts.length);
    const o = new THREE.Object3D();
    pts.forEach(([x, z, r], i) => { o.position.set(x, floorY(floor) + 0.035, z); o.rotation.set(0, r, 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, new THREE.Color(0x00e5ff)); });
    m.frustumCulled = false;
    this.walkGroup.add(m); this.chev = { m, n: pts.length, pts };
  }
  setBeacon(x, z, floor) {
    if (x == null) { this.beacon.visible = this.beaconRing.visible = false; return; }
    this.beacon.position.set(x, floorY(floor) + 2, z); this.beaconRing.position.set(x, floorY(floor) + 0.05, z);
    this.beacon.visible = this.beaconRing.visible = true;
  }
  update(t, avatarPos) {
    if (this.chev) {
      const c = new THREE.Color();
      for (let i = 0; i < this.chev.n; i++) {
        const [x, z] = this.chev.pts[i];
        const k = 0.5 + 0.5 * Math.sin(t * 6 - i * 0.55);
        const near = avatarPos ? Math.hypot(x - avatarPos.x, z - avatarPos.z) : 99;
        c.setRGB(0.1 + 0.6 * k, 0.75 + 0.25 * k, 1).multiplyScalar(near < 1.2 ? 0.2 : 1);
        this.chev.m.setColorAt(i, c);
      }
      this.chev.m.instanceColor.needsUpdate = true;
    }
    if (this.beacon.visible) {
      this.beacon.material.opacity = 0.18 + 0.12 * Math.sin(t * 4);
      const s = 1 + 0.25 * ((t * 1.5) % 1); this.beaconRing.scale.set(s, s, s);
      this.beaconRing.material.opacity = 1 - ((t * 1.5) % 1);
    }
    for (const m of this.mats) m.dashOffset = -t * 6;
    if (this.reveal) {
      const now = performance.now(); this.reveal.t += Math.min(0.1, (now - (this.reveal.last || now)) / 1000); this.reveal.last = now;
      const n = Math.min(this.reveal.lines.length, Math.ceil(this.reveal.t / 2.5 * this.reveal.lines.length) + 2);
      this.reveal.lines.forEach((l, i) => { l.visible = i < n; });
    }
  }
  // x-ray: tüm rota 3B
  showXray(route, stopsInfo, startLabel) {
    const W = this.world, XS = W.XS;
    this.xrayGroup.clear(); this.mats = [];
    const Y = f => floorY(f) * XS + 0.6;
    const palette = [0x00e5ff, 0xffd166, 0x06d6a0, 0xef476f, 0xa29bfe, 0xff9f1c, 0x4cc9f0, 0xf72585, 0x90be6d, 0xf8961e, 0x43aa8b];
    const lines = [];
    route.legs.forEach((leg, li) => {
      const pos = [];
      for (const s of leg.segments) {
        if (s.type === 'walk') for (const [x, z] of s.pts) pos.push(x, Y(s.floor), z);
        else if (s.kind === 'escalator') { pos.push(s.a.x, Y(s.from), s.a.z, s.b.x, Y(s.to), s.b.z); }
        else { pos.push(s.x, Y(s.from), s.z, s.x, Y(s.to), s.z); }
      }
      const geo = new LineGeometry(); geo.setPositions(pos);
      const mat = new LineMaterial({ color: palette[li % palette.length], linewidth: 7, worldUnits: false, dashed: false, transparent: true, opacity: 0.95, depthTest: false });
      mat.resolution.set(window.innerWidth, window.innerHeight);
      const line = new Line2(geo, mat); line.computeLineDistances(); line.renderOrder = 8;
      this.xrayGroup.add(line); lines.push(line); this.mats.push(mat);
      const glow = new LineMaterial({ color: palette[li % palette.length], linewidth: 22, transparent: true, opacity: 0.22, depthTest: false });
      glow.resolution.set(window.innerWidth, window.innerHeight);
      const gl = new Line2(geo, glow); gl.renderOrder = 7; this.xrayGroup.add(gl); lines.push(gl);
    });
    // pinler
    const pin = (x, y, z, text, color) => {
      const s = W.label(text, '#0b1220', color, 0.9, true); s.position.set(x, y + 8, z); this.xrayGroup.add(s);
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(color), toneMapped: false }));
      stick.position.set(x, y + 4, z); this.xrayGroup.add(stick);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(1.8, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(color), toneMapped: false })); dot.position.set(x, y, z); this.xrayGroup.add(dot);
    };
    pin(stopsInfo.start.x, Y(stopsInfo.start.floor), stopsInfo.start.z, startLabel, '#ffffff');
    stopsInfo.stops.forEach((s, i) => pin(s.x, Y(s.floor), s.z, `${i + 1}. ${s.short}`, '#' + new THREE.Color(palette[(i + 1) % palette.length]).getHexString()));
    this.reveal = { t: 0, lines: lines.filter((_, i) => i % 2 === 0).flatMap((l, i) => [l, lines[i * 2 + 1]]) };
    this.reveal.lines.forEach(l => { l.visible = false; });
  }
  resize() { for (const c of this.xrayGroup.children) if (c.material?.resolution) c.material.resolution.set(window.innerWidth, window.innerHeight); }
}

export { FH };
