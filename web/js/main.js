// PerpAI — akış: fotoğraf → dış cephe → liste okutma → x-ray rota → yürüyüş → bitiş
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  ENTRY, floorY, FLOORS, CELLS, GX0, GZ0, GW, GH, Z, GATES, CONNECTORS, ZONE_COLORS, ZONE_LABEL,
  getLayout, variantOf, zoneAt, nearestWalkable, coreHalf, HALL, cellIdx,
} from './layout.js';
import { planRoute } from './nav.js';
import { loadData, DB, parseList, candidatesFor, chooseShops, PRESETS, shopTitle, aiHints } from './data.js';
import { World, PLAZA_Y } from './world.js';
import { Avatar, Crowd, RouteViz, animatePerson, makePerson, bubble } from './actors.js';
import { resolveQR, parseScanned } from './qr.js';
import { openScanner } from './scanner.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

let world;
try { world = new World($('#c')); } catch (e) { window.__perpaiFail?.(e.message); throw e; }
const cam = world.camera;
const controls = new OrbitControls(cam, world.renderer.domElement);
controls.enabled = false; controls.enableDamping = true;

const S = {
  mode: 'intro', story: false, items: [], route: null, stops: [], ordered: [],
  actions: [], ai: 0, paused: false, speed: 4, camMode: 'follow', trail: [],
  done: new Set(), flags: {}, walked: 0, t0: 0, pick: 'uzman',
  start: null,
};
// ana giriş: hem varsayılan başlangıç hem her turun çıkışı
const EXIT = { x: ENTRY.x, z: ENTRY.z, floor: ENTRY.floor, heading: Math.PI, entry: true, code: 'GIRIS', label: '8. kat · ana giriş' };
S.start = EXIT;
const startLabel = () => S.start.entry ? 'GİRİŞ' : 'SEN BURADASIN';
let avatar, crowd, routeViz, plazaPeople = [];
const ghosts = [];

// ------------------------------------------------------------------ açılış
(async function boot() {
  try {
    await loadData();
    world.build();
    for (const v of ['N', 'E', 'G']) world.variantDetail(v);
    world.setFloor(8);
    avatar = new Avatar(); world.groups.actors.add(avatar.obj);
    avatar.obj.position.set(0, PLAZA_Y, 92); avatar.obj.rotation.y = Math.PI;
    crowd = new Crowd(world.groups.actors, 120); crowd.setFloor(8);
    routeViz = new RouteViz(world);
    makePlazaPeople();
    world.setMode('exterior');
    cam.position.set(0, PLAZA_Y + 9, 240); cam.lookAt(0, PLAZA_Y + 18, 50);
    $('#loading').classList.add('done');
    $('#btnShop').disabled = $('#btnStory').disabled = $('#btnIntroQR').disabled = false;
    // QR linkiyle gelindiyse (…/?q=D-A11-1350) o noktadan başla
    const q = resolveQR(new URLSearchParams(location.search).get('q'));
    if (q) setStartFromQR(q, true);
  } catch (e) {
    console.error(e);
    window.__perpaiFail?.(e.message);
  }
  requestAnimationFrame(loop);
})();

function makePlazaPeople() {
  const cols = [0x264653, 0x9b2226, 0x3a5a40, 0x6d6875, 0x1d3557, 0x7f5539, 0x222222, 0xb5838d];
  for (let i = 0; i < 14; i++) {
    const p = makePerson({ jacket: cols[i % cols.length], pants: 0x2b2d42 });
    const x = (Math.random() - 0.5) * 16, z = 62 + Math.random() * 90;
    p.position.set(x, PLAZA_Y, z);
    p.userData.v = (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 0.5);
    world.groups.exterior.add(p); plazaPeople.push(p);
  }
}

function show(id) { $$('.screen').forEach(s => s.classList.toggle('show', s.id === id)); }

// ------------------------------------------------------------------ 1 → 2: dış cephe uçuşu
$('#btnShop').onclick = () => startFlight(false);
$('#btnStory').onclick = () => startFlight(true);
$('#btnStory2').onclick = () => { resetWalk(); startFlight(true, true); };
$('#btnAgain').onclick = () => { resetWalk(); startFlight(false, true); };

function setStartFromQR(q, fromLink = false) {
  S.start = q.code === 'GIRIS' ? EXIT : { x: q.x, z: q.z, floor: q.floor, heading: q.heading, entry: false, code: q.code, label: q.label, sub: q.sub };
  const b = $('#qrBanner');
  if (S.start.entry) { b.hidden = true; $('#btnShop').innerHTML = '<span class="ic">🛒</span> Alışverişe başla'; }
  else {
    b.hidden = false;
    b.innerHTML = `<b>📍 QR okundu</b><span>${esc(q.label)}${q.sub ? ' · ' + esc(q.sub) : ''}</span>`;
    $('#btnShop').innerHTML = '<span class="ic">🛒</span> Buradan alışverişe başla';
  }
  $('#scanWhere').textContent = S.start.entry ? '8. kat · ana giriş' : q.label;
  if (fromLink) history.replaceState(null, '', location.pathname + '?q=' + encodeURIComponent(q.code));
}

// iç mekânda, başlangıç noktasında dur (QR ile başlarken)
function placeAtStart() {
  const st = S.start;
  world.setMode('walk'); world.setFloor(st.floor); crowd.setFloor(st.floor); S.floorInit = true;
  avatar.obj.position.set(st.x, floorY(st.floor), st.z); avatar.heading = st.heading; avatar.obj.rotation.y = st.heading;
  const fx = Math.sin(st.heading), fz = Math.cos(st.heading);
  cam.position.set(st.x - fx * 5, floorY(st.floor) + 2.8, st.z - fz * 5);
  cam.lookAt(st.x + fx * 4, floorY(st.floor) + 1.4, st.z + fz * 4);
}

async function startFlight(story, quick = false) {
  S.story = story;
  show(null);
  if (!S.start.entry) {
    S.mode = 'scan'; controls.enabled = false;
    $('#fade').classList.add('on'); await sleep(400);
    placeAtStart();
    $('#fade').classList.remove('on');
    caption(`📍 ${S.start.label}${S.start.sub ? ' · ' + S.start.sub : ''}`);
    await sleep(1600); caption('');
    openScan(); return;
  }
  S.mode = 'fly';
  world.setMode('exterior'); world.setFloor(8); crowd.setFloor(8); controls.enabled = false;
  avatar.obj.position.set(0, PLAZA_Y, 92); avatar.obj.rotation.y = Math.PI; avatar.heading = Math.PI;
  caption(story ? 'Rivayet odur ki… Okmeydanı, Halil Rıfat Paşa Mahallesi. Perpa Ticaret Merkezi.' : 'Okmeydanı · Perpa Ticaret Merkezi · ana giriş (8. kat)');
  const keys = quick
    ? [[0, 14, 150, 0, 22, 50], [0, PLAZA_Y - PLAZA_Y + 3.2, 99, 0, 2.2, 60]]
    : [[0, 9, 240, 0, 18, 50], [-60, 26, 170, 0, 16, 40], [30, 12, 130, 0, 20, 52], [0, 4.5, 104, 0, 9, 55], [0, 3.2, 99, 0, 2.2, 60]];
  const dur = quick ? 2.5 : 9;
  await tweenPath(keys.map(k => [k[0], k[1] + (k === keys[0] && !quick ? PLAZA_Y : PLAZA_Y), k[2], k[3], k[4] + PLAZA_Y, k[5]]), dur);
  caption('');
  openScan();
}

function tweenPath(keys, dur) {
  return new Promise(res => {
    const t0 = performance.now();
    const cp = new THREE.CatmullRomCurve3(keys.map(k => new THREE.Vector3(k[0], k[1], k[2])));
    const ct = new THREE.CatmullRomCurve3(keys.map(k => new THREE.Vector3(k[3], k[4], k[5])));
    S.anim = () => {
      const t = Math.min(1, (performance.now() - t0) / 1000 / dur), e = ease(t);
      cam.position.copy(cp.getPoint(e)); cam.lookAt(ct.getPoint(e));
      if (t >= 1) { S.anim = null; res(); }
    };
  });
}

let capT;
function caption(text) {
  const c = $('#caption'); clearTimeout(capT);
  if (!text) { c.classList.remove('on'); return; }
  c.textContent = text; c.classList.add('on');
}

// ------------------------------------------------------------------ 2: liste okutma
const STORY = {
  title: 'Padişahın fermanı',
  lines: ['3. katta kaybolan Halil Rıfat Paşa\'yı bul', '5. kattaki ulaktan fermanı al', 'Mektubu Perpa\'daki kırtasiyeciye teslim et', 'Çıkışı bul (bulabilirsen)'],
};

function openScan() {
  S.mode = 'scan'; show('scan');
  $('#results').innerHTML = ''; $('#btnRoute').disabled = true;
  const pr = $('#presets'); pr.innerHTML = '';
  $('#pickMode').style.display = S.story ? 'none' : '';
  if (S.story) {
    $('#scanTitle').textContent = '📜 Halil Rıfat Paşa Görevi';
    $('#listText').value = STORY.lines.join('\n'); $('#listText').readOnly = true;
    pr.innerHTML = `<div class="chip on">Rivayete göre: Paşa padişahın mektubunu Perpa'da bir kırtasiyeciye götürürken 3. katta kayboldu. Ulak da 5. katta…</div>`;
  } else {
    $('#scanTitle').textContent = 'Alışveriş listen';
    $('#listText').readOnly = false;
    if (!$('#listText').value || $('#listText').dataset.story) $('#listText').value = PRESETS.guvenlik.text;
    for (const [k, p] of Object.entries(PRESETS)) {
      const b = document.createElement('button'); b.className = 'chip'; b.textContent = p.title;
      if ($('#listText').value === p.text) b.classList.add('on');
      b.onclick = () => { $('#listText').value = p.text; $$('#presets .chip').forEach(c => c.classList.remove('on')); b.classList.add('on'); renderPaper(); $('#results').innerHTML = ''; $('#btnRoute').disabled = true; };
      pr.appendChild(b);
    }
  }
  $('#listText').dataset.story = S.story ? '1' : '';
  renderPaper();
}
$$('#pickMode button').forEach(b => b.onclick = () => {
  S.pick = b.dataset.v; $$('#pickMode button').forEach(x => x.classList.toggle('on', x === b));
  if (S.items.length && !S.story) scanList();
});
$('#listText').addEventListener('input', () => { renderPaper(); $('#btnRoute').disabled = true; });

function renderPaper() {
  const p = $('#paper');
  const lines = $('#listText').value.split('\n').filter(l => l.trim()).slice(0, 9);
  p.className = 'paper' + (S.story ? ' ferman' : '');
  p.innerHTML = (S.story ? '<h4>FERMAN-I ÂLÎ</h4>' : '') + lines.map((l, i) => `<div class="ln" data-i="${i}">${S.story ? (i + 1) + '. ' : '- '}${esc(l)}</div>`).join('');
  $('#vfLabel').textContent = S.story ? 'Fermanı çerçeveye al' : 'Listeyi çerçeveye al';
}
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

$('#btnScan').onclick = $('#btnScan2').onclick = () => scanList();

async function scanList() {
  if (S.scanning) return; S.scanning = true;
  $('#results').innerHTML = ''; $('#btnRoute').disabled = true;
  $('#laser').classList.add('on'); $('#vfLabel').textContent = 'PerpAI okuyor…';
  const lns = $$('#paper .ln');
  let items;
  if (S.story) items = storyItems();
  else {
    items = parseList($('#listText').value).slice(0, 10);
    const hints = await aiHints(items.map(it => it.raw));
    items.forEach((it, k) => { it.ai = hints[k]; it.cands = candidatesFor(it); });
    chooseShops(items, S.pick);
  }
  S.items = items;
  for (let i = 0; i < items.length; i++) {
    await sleep(420);
    const ok = !!items[i].choice;
    lns[i]?.classList.add(ok ? 'hit' : 'miss');
    $('#results').appendChild(resultCard(items[i], i));
  }
  await sleep(300);
  $('#laser').classList.remove('on');
  const n = items.filter(i => i.choice).length;
  $('#vfLabel').textContent = `${n}/${items.length} kalem eşleşti`;
  $('#btnRoute').disabled = n === 0;
  S.scanning = false;
}

function zoneChip(zone) { return `<span class="zone ${zone}">${ZONE_LABEL[zone]}</span>`; }

function resultCard(it, i) {
  const d = document.createElement('div');
  if (!it.choice) {
    d.className = 'res miss';
    d.innerHTML = `<div class="n">!</div><div><div class="t">${esc(it.label)}</div><div class="s">Eşleşen firma bulunamadı — bu kalem rotaya eklenmedi</div></div><span></span>`;
    return d;
  }
  const c = it.choice, s = c.shop;
  d.className = 'res';
  const where = c.ghost ? `${c.floor}. kat · ${c.where}` : `${s.block} Blok · ${s.floor}. kat · No ${s.no} ${zoneChip(s.slot.zone)}`;
  const firm = c.ghost ? c.ghost.name : shopTitle(s);
  d.innerHTML = `<div class="n">${i + 1}</div><div><div class="t">${esc(it.label)}${it.qty ? ` <span style="color:var(--muted);font-weight:500">× ${esc(it.qty)}</span>` : ''}</div>
    <div class="s">→ <b style="color:#fff">${esc(firm)}</b><br>${where}${it.cands?.cat ? ` · <i>${esc(it.cands.cat)}</i>` : ''}</div></div>`;
  if (it.pool && it.pool.length > 1) {
    const b = document.createElement('button'); b.className = 'alt'; b.textContent = '↻ başka';
    b.title = `${it.pool.length} aday arasından başka bir dükkân`;
    b.onclick = () => {
      it.alt = ((it.alt ?? it.pool.indexOf(it.choice)) + 1) % it.pool.length;
      it.choice = it.pool[it.alt]; it.locked = true;
      d.replaceWith(resultCard(it, i));
    };
    d.appendChild(b);
  } else d.appendChild(document.createElement('span'));
  return d;
}

// Hikâye modu durakları
function storyItems() {
  const g3 = getLayout('G').grid, g5 = getLayout('N').grid;
  const pc = CELLS.find(c => c.block === 'B' && !c.front && c.cx < -100);
  const uc = CELLS.find(c => c.block === 'A' && c.front && c.cx > 100);
  const pp = nearestWalkable(g3, pc.cx - 7.5, pc.cz), up = nearestWalkable(g5, uc.cx, uc.cz + 7.5);
  const pasa = { label: 'Halil Rıfat Paşa\'yı bul', choice: { ghost: { name: 'Halil Rıfat Paşa (hayalet)', fes: true, color: 0x2c3e75, lines: ['Evlâdım! 150 senedir şu kırtasiyeciyi arıyorum…', 'Asansör üçer üçer çıkıyor, merdiven aşağı iniyor!', 'Padişahın mektubu bende. Al, sen götür!'] }, floor: 3, x: pp.x, z: pp.z, where: `B Blok · ${ZONE_LABEL[pc.color]} (garaj katı)` } };
  const ulak = { label: 'Ulaktan fermanı al', choice: { ghost: { name: 'Padişahın ulağı (hayalet)', fes: true, color: 0x6b3e1f, lines: ['Fermanı Paşa\'ya getirdim, 5. katta kayboldum…', 'Yıllardır aynı sarı avluda dönüp duruyorum.', 'Al fermanı, bu işi bir yapay zekâ çözer!'] }, floor: 5, x: up.x, z: up.z, where: `A Blok · ${ZONE_LABEL[uc.color]}` } };
  const kc = candidatesFor({ label: 'kırtasiye kağıt kalem' });
  const near = kc.list.slice(0, 40).sort((a, b) => cost(a.shop) - cost(b.shop));
  function cost(s) { return Math.abs(s.slot.door.x - up.x) + Math.abs(s.slot.door.z - up.z) + Math.abs(s.floor - 5) * 45; }
  const k = near[0];
  const kirt = { label: 'Mektubu kırtasiyeciye teslim et', choice: k, pool: near.slice(0, 8), cands: { cat: 'Kırtasiye (gerçek Perpa firması)' } };
  return [pasa, ulak, kirt];
}

// ------------------------------------------------------------------ 3: rota planı
$('#btnRoute').onclick = () => planAndShow();
$('#btnBack').onclick = () => { controls.enabled = false; if (S.start.entry) { world.setMode('exterior'); placeScanCam(); } else placeAtStart(); openScan(); };

function placeScanCam() { cam.position.set(0, PLAZA_Y + 3.2, 99); cam.lookAt(0, PLAZA_Y + 2.2, 60); }

function stopFromItem(it, i) {
  const c = it.choice;
  if (c.ghost) return { kind: 'ghost', x: c.x, z: c.z, floor: c.floor, title: it.label, firm: c.ghost.name, ghost: c.ghost, where: c.where, short: c.ghost.name.split(' (')[0], item: it };
  const s = c.shop;
  return { kind: 'shop', x: s.slot.door.x, z: s.slot.door.z, floor: s.floor, title: it.label, firm: shopTitle(s), shop: s, short: it.label.length > 16 ? it.label.slice(0, 15) + '…' : it.label, item: it };
}

async function planAndShow() {
  const items = S.items.filter(i => i.choice);
  S.stops = items.map(stopFromItem);
  $('#fade').classList.add('on'); await sleep(450);
  const start = S.start;
  S.route = planRoute(start, S.stops, S.story, EXIT);
  S.ordered = S.route.order.map(i => S.stops[i]);
  world.setMode('xray'); show('plan'); S.mode = 'plan';
  routeViz.showXray(S.route, { start, stops: S.ordered }, startLabel());
  setupGhosts();
  controls.enabled = true; controls.autoRotate = true; controls.autoRotateSpeed = 0.6;
  frameXray();
  $('#fade').classList.remove('on');
  // özet
  const walk = S.route.legs.reduce((s, l) => s + l.segments.filter(g => g.type === 'walk').reduce((a, g) => a + g.length, 0), 0);
  const rides = S.route.legs.flatMap(l => l.segments.filter(g => g.type === 'ride'));
  const floors = new Set(S.ordered.map(s => s.floor));
  const mins = Math.round((walk / 1.25 + rides.reduce((a, r) => a + (r.kind === 'elevator' ? 60 : r.kind === 'stairs' ? 25 : 35), 0) + S.ordered.length * 240) / 60);
  S.summary = { walk, rides: rides.length, floors: floors.size, mins };
  $('#planTitle').textContent = S.story ? 'Görev rotası hazır' : 'En kısa tur hazır';
  $('#planStats').innerHTML = `<div class="stat"><b>${Math.round(walk)} m</b><span>yürüme</span></div><div class="stat"><b>${floors.size} kat</b><span>${S.ordered.length} durak</span></div><div class="stat"><b>~${mins} dk</b><span>alışveriş dahil</span></div>`;
  const pal = ['#00e5ff', '#ffd166', '#06d6a0', '#ef476f', '#a29bfe', '#ff9f1c', '#4cc9f0', '#f72585', '#90be6d', '#f8961e', '#43aa8b'];
  $('#planStops').innerHTML = S.ordered.map((s, i) => {
    const leg = S.route.legs[i];
    const via = leg.via ? `${leg.via.type === 'elevator' ? '🛗' : leg.via.type === 'stairs' ? '🪜' : '↗'} ${leg.via.name}` : 'aynı kat';
    const where = s.kind === 'shop' ? `${s.shop.block} Blok · ${s.floor}. kat · No ${s.shop.no}` : `${s.floor}. kat · ${s.where}`;
    return `<li><i style="background:${pal[(i + 1) % pal.length]}">${i + 1}</i><div><b>${esc(s.title)}</b><small>${esc(s.firm)}</small><small>${where} · ${via} · ${Math.round(leg.length)} m</small></div></li>`;
  }).join('') + `<li><i style="background:#fff">⟲</i><div><b>Çıkış</b><small>8. kat ana giriş · ${Math.round(S.route.legs[S.route.legs.length - 1].length)} m</small></div></li>`;
}

function frameXray() {
  const box = new THREE.Box3();
  const add = (x, f, z) => box.expandByPoint(new THREE.Vector3(x, floorY(f) * world.XS, z));
  add(ENTRY.x, ENTRY.floor, ENTRY.z); add(S.start.x, S.start.floor, S.start.z);
  for (const s of S.ordered) add(s.x, s.floor, s.z);
  const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  const r = Math.max(90, sz.x * 0.75, sz.z * 1.2, sz.y * 1.4);
  controls.target.copy(c);
  cam.position.set(c.x - r * 0.95, c.y + r * 0.7, c.z + r * 1.05);
  controls.update();
}

function setupGhosts() {
  for (const g of ghosts) world.groups.actors.remove(g.obj);
  ghosts.length = 0;
  for (const s of S.stops.filter(s => s.kind === 'ghost')) {
    const p = makePerson({ jacket: s.ghost.color, pants: 0x222244, fes: true, ghost: true, scale: 1.05 });
    p.position.set(s.x - 1.2, floorY(s.floor), s.z);
    const lab = world.label(s.ghost.name.split(' (')[0], '#fff', 'rgba(60,80,160,.8)', 0.16);
    lab.position.set(0, 2.25, 0); p.add(lab);
    world.groups.actors.add(p);
    ghosts.push({ obj: p, stop: s, base: floorY(s.floor) });
  }
}

// ------------------------------------------------------------------ 4: yürüyüş
$('#btnWalk').onclick = () => startWalk();

function buildActions(prelude = S.start.entry) {
  const A = prelude ? [{ type: 'walk', floor: 8, pts: [[0, 92], [0, ENTRY.z]], outside: true }] : [];
  S.route.legs.forEach((leg, li) => {
    for (const s of leg.segments) {
      if (s.type === 'walk') { if (s.pts.length > 1) A.push({ type: 'walk', floor: s.floor, pts: s.pts, leg: li }); }
      else A.push({ type: s.kind, seg: s, leg: li });
    }
    if (leg.toStop != null) A.push({ type: 'visit', stop: S.stops[leg.toStop], leg: li });
  });
  A.push({ type: 'walk', floor: 8, pts: [[0, ENTRY.z], [0, 92]], outside: true, leg: S.route.legs.length - 1 });
  A.push({ type: 'finish' });
  for (const a of A) if (a.type === 'walk') { a.len = 0; a.cum = [0]; for (let i = 1; i < a.pts.length; i++) { a.len += Math.hypot(a.pts[i][0] - a.pts[i - 1][0], a.pts[i][1] - a.pts[i - 1][1]); a.cum.push(a.len); } }
  return A;
}

async function startWalk() {
  $('#fade').classList.add('on'); await sleep(450);
  S.actions = buildActions(); S.ai = 0; S.done.clear(); S.flags = {}; S.walked = 0; S.trail = []; S.t0 = performance.now();
  S.legIdx = 0; S.paused = false;
  for (const b of avatar.bags.splice(0)) avatar.obj.remove(b);
  avatar.obj.visible = true;
  controls.enabled = false; controls.autoRotate = false;
  world.setMode('walk');
  if (S.start.entry) {
    avatar.obj.position.set(0, PLAZA_Y, 92); avatar.heading = Math.PI; enterFloor(8);
    cam.position.set(0, PLAZA_Y + 4, 100); cam.lookAt(0, PLAZA_Y + 1.5, 80);
  } else { placeAtStart(); enterFloor(S.start.floor); }
  setCam(S.camMode === 'orbit' ? 'follow' : S.camMode);
  show('hud'); S.mode = 'walk';
  buildFloorbar(); renderChecklist(); updateRouteViz();
  $('#fade').classList.remove('on');
  if (S.story) toast('📜 Rivayete göre Halil Rıfat Paşa, padişahın mektubunu Perpa\'da bir kırtasiyeciye götürürken 3. katta kayboldu. Onu bulmaya giden ulak da 5. katta…', 'lore', 7000);
  else toast(`🧭 ${S.ordered.length} dükkân · ${S.summary.floors} kat · ${Math.round(S.summary.walk)} m. Oklar yolu gösteriyor.`, 'good', 4500);
}

// QR okutuldu: konumu düzelt, kalan durakları buradan yeniden planla
function relocate(q) {
  if (S.mode !== 'walk') {
    setStartFromQR(q);
    toast(`📍 Başlangıç: ${q.label}`, 'good', 3500);
    if (S.mode === 'plan') planAndShow();
    if (S.mode === 'scan' || S.mode === 'intro') { if (S.mode === 'scan') placeAtStart(); }
    return;
  }
  const oldFloor = world.floor;
  const doneStops = S.ordered.filter((_, i) => S.done.has(i));
  const remaining = S.ordered.filter((_, i) => !S.done.has(i));
  const here = { x: q.x, z: q.z, floor: q.floor };
  S.route = planRoute(here, remaining, S.story, EXIT);
  S.stops = remaining;
  S.ordered = [...doneStops, ...S.route.order.map(i => remaining[i])];
  S.done = new Set(doneStops.map((_, i) => i));
  S.actions = buildActions(false); S.ai = 0; S.legIdx = 0; S.trail = [];
  for (const a of S.actions) { a.d = 0; a.ph = 0; a.t = 0; }
  $('#stairFade').classList.remove('on');
  avatar.obj.position.set(q.x, floorY(q.floor), q.z); avatar.heading = q.heading; avatar.obj.rotation.y = q.heading;
  if (world.mode !== 'walk') world.setMode('walk');
  enterFloor(q.floor);
  renderChecklist(); buildFloorbar();
  const nx = nextStop();
  const moved = oldFloor !== q.floor ? `${oldFloor}. katta sanılıyordun → ${q.floor}. kattasın. ` : '';
  toast(`📍 Konum QR ile düzeltildi: ${q.label}. ${moved}Rota yeniden hesaplandı${nx ? ` · sıradaki: ${nx.title}` : ''}.`, 'good', 6000);
}

function resetWalk() {
  S.mode = 'idle'; S.actions = []; routeViz?.setBeacon(null); routeViz?.walkGroup.clear();
}

function enterFloor(f) {
  if (world.floor !== f || !S.floorInit) { world.setFloor(f); crowd.setFloor(f); }
  S.floorInit = true;
  applyCamVisibility();
  updateRouteViz();
  buildFloorbar();
  mmBase = null;
  if (f === 3 && !S.flags.f3 && !S.story) { S.flags.f3 = true; toast('👻 3. kat… Rivayete göre Halil Rıfat Paşa burada kayboldu. Sakin ol, PerpAI yanında.', 'lore', 5000); }
  if (f === 5 && !S.flags.f5 && !S.story) { S.flags.f5 = true; toast('📯 5. kat: padişahın ulağının son görüldüğü kat.', 'lore', 4500); }
}

function currentFloor() { const a = S.actions[S.ai]; return world.floor; }

function updateRouteViz() {
  if (!routeViz || !S.actions.length) return;
  const f = world.floor, paths = [];
  for (let i = S.ai; i < S.actions.length; i++) {
    const a = S.actions[i];
    if (a.type === 'visit' || a.type === 'finish') break;
    if (a.type === 'walk' && a.floor === f && !a.outside) paths.push(i === S.ai ? remainingPts(a) : a.pts);
  }
  routeViz.showWalk(paths, f);
  const st = nextStop();
  if (st && st.floor === f) routeViz.setBeacon(st.x, st.z, f); else routeViz.setBeacon(null);
}

function remainingPts(a) {
  const d = a.d || 0; let k = 1; while (k < a.cum.length - 1 && a.cum[k] < d) k++;
  const p = posAlong(a, d);
  return [[p[0], p[1]], ...a.pts.slice(k)];
}

function nextStop() {
  for (let i = S.ai; i < S.actions.length; i++) if (S.actions[i].type === 'visit') return S.actions[i].stop;
  return null;
}

function posAlong(a, d) {
  let k = 1; while (k < a.cum.length - 1 && a.cum[k] < d) k++;
  const t = (d - a.cum[k - 1]) / Math.max(1e-6, a.cum[k] - a.cum[k - 1]);
  const [x0, z0] = a.pts[k - 1], [x1, z1] = a.pts[k];
  return [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, Math.atan2(x1 - x0, z1 - z0)];
}

function nextAction() {
  S.ai++;
  const a = S.actions[S.ai];
  if (!a) return;
  a.d = 0; a.ph = 0; a.t = 0;
  if (a.leg != null && a.leg !== S.legIdx) { S.legIdx = a.leg; }
  updateRouteViz(); renderChecklist();
}

function stepWalker(dt) {
  const a = S.actions[S.ai]; if (!a) return 0;
  const sim = dt * S.speed, ob = avatar.obj;
  let speed = 0;
  switch (a.type) {
    case 'walk': {
      if (a.floor !== world.floor && !a.outside) enterFloor(a.floor);
      const v = 1.4; a.d = (a.d || 0) + v * sim; speed = v * Math.min(S.speed, 3);
      S.walked += v * sim;
      const [x, z, h] = posAlong(a, Math.min(a.d, a.len));
      ob.position.set(x, floorY(a.floor), z); turnTo(h, dt);
      if (a.d >= a.len) nextAction();
      checkLore();
      break;
    }
    case 'elevator': {
      const s = a.seg, cab = world.cabins[s.conn.cell.elevator];
      if (!a.ph) {
        a.ph = 1; cab.userData.idle = false; cab.position.y = floorY(s.from);
        toast(`🛗 ${s.conn.name}: ${s.from}. kat → ${s.to}. kat`, '', 3000);
        if (!S.flags.elev) { S.flags.elev = true; setTimeout(() => toast('"Üçer, beşer çıkan asansörler…" Bu sefer tam katına çıkıyor. 😉', 'lore', 4200), 900); }
        a.p0 = [s.x, s.z]; a.p1 = [s.cab.x + 0.2, s.cab.z];
      }
      if (a.ph === 1) { // kabine yürü
        a.t += sim / 1.6; const t = Math.min(1, a.t);
        ob.position.set(lerp(a.p0[0], a.p1[0], t), floorY(s.from), lerp(a.p0[1], a.p1[1], t)); turnTo(Math.atan2(a.p1[0] - a.p0[0], a.p1[1] - a.p0[1]), dt); speed = 1.4;
        if (t >= 1) { a.ph = 2; a.t = 0; a.dur = 1.6 + 0.5 * Math.abs(s.to - s.from); }
      } else if (a.ph === 2) { // yolculuk
        a.t += sim / a.dur; const t = Math.min(1, a.t), y = lerp(floorY(s.from), floorY(s.to), ease(t));
        ob.position.y = y; cab.position.y = y; turnTo(-Math.PI / 2, dt);
        if (t > 0.5 && world.floor !== s.to) enterFloor(s.to);
        if (t >= 1) { a.ph = 3; a.t = 0; }
      } else { // dışarı
        a.t += sim / 1.6; const t = Math.min(1, a.t);
        ob.position.set(lerp(a.p1[0], a.p0[0], t), floorY(s.to), lerp(a.p1[1], a.p0[1], t)); turnTo(Math.atan2(a.p0[0] - a.p1[0], a.p0[1] - a.p1[1]), dt); speed = 1.4;
        if (t >= 1) { cab.userData.idle = true; cab.userData.target = floorY(s.to); cab.userData.wait = 4; nextAction(); }
      }
      break;
    }
    case 'escalator': {
      const s = a.seg;
      if (!a.ph) { a.ph = 1; if (!S.flags['esc' + S.legIdx]) { S.flags['esc' + S.legIdx] = true; toast(`↗ ${s.conn.name}: ${s.to > s.from ? 'yukarı' : 'aşağı'}`, '', 2500); } }
      const L = Math.hypot(s.b.x - s.a.x, s.b.z - s.a.z, floorY(s.to) - floorY(s.from));
      a.t += sim * 0.9 / L; const t = Math.min(1, a.t);
      ob.position.set(lerp(s.a.x, s.b.x, t), lerp(floorY(s.from), floorY(s.to), t), lerp(s.a.z, s.b.z, t));
      turnTo(Math.atan2(s.b.x - s.a.x, s.b.z - s.a.z), dt);
      if (t > 0.55 && world.floor !== s.to) enterFloor(s.to);
      if (t >= 1) nextAction();
      break;
    }
    case 'stairs': {
      const s = a.seg;
      if (!a.ph) {
        a.ph = 1; a.real = 0;
        const n = Math.abs(s.to - s.from);
        $('#stairText').innerHTML = `🪜 ${s.conn.name}<br>${s.from}. kat → ${s.to}. kat<small>${n} kat · ~${n * 26} basamak ${s.to > s.from ? 'çıkılıyor' : 'iniliyor'}</small>`;
        $('#stairFade').classList.add('on');
      }
      a.real += dt;
      if (a.real > 0.5 && world.floor !== s.to) { enterFloor(s.to); ob.position.set(s.x, floorY(s.to), s.z); }
      if (a.real > 1.3) { $('#stairFade').classList.remove('on'); nextAction(); }
      break;
    }
    case 'visit': speed = stepVisit(a, dt, sim); break;
    case 'finish': finish(); S.ai++; break;
  }
  return speed;
}

function stepVisit(a, dt, sim) {
  const st = a.stop, ob = avatar.obj;
  if (!a.ph) {
    a.ph = 1; a.t = 0; a.real = 0;
    if (st.kind === 'shop') {
      const sl = st.shop.slot;
      a.p0 = [ob.position.x, ob.position.z];
      a.p1 = [sl.x + sl.fx * (sl.d / 2 - 2.2), sl.z + sl.fz * (sl.d / 2 - 2.2)];
    } else { a.p0 = [ob.position.x, ob.position.z]; a.p1 = [st.x - 0.1, st.z]; }
  }
  if (a.ph === 1) { // içeri gir
    a.t += sim / 2.2; const t = Math.min(1, a.t);
    ob.position.x = lerp(a.p0[0], a.p1[0], t); ob.position.z = lerp(a.p0[1], a.p1[1], t);
    turnTo(Math.atan2(a.p1[0] - a.p0[0], a.p1[1] - a.p0[1]), dt);
    if (st.kind === 'ghost') turnTo(Math.atan2(st.x - 1.2 - ob.position.x, st.z - ob.position.z), dt);
    if (t >= 1) { a.ph = 2; arrive(st, a); }
    return 1.2;
  }
  if (a.ph === 2) { // alışveriş / konuşma (gerçek zaman)
    a.real += dt;
    const hold = st.kind === 'ghost' ? 6.5 : 2.4 / Math.sqrt(S.speed / 2);
    if (st.kind === 'ghost' && a.bub) {
      const k = Math.min(st.ghost.lines.length - 1, Math.floor(a.real / (hold / st.ghost.lines.length)));
      if (k !== a.line) { a.line = k; a.gh.obj.remove(a.bub); a.bub = bubble(st.ghost.lines[k], 760); a.bub.scale.multiplyScalar(0.62); a.bub.position.set(0, 3.0, 0); a.gh.obj.add(a.bub); }
    }
    if (a.real > hold) { a.ph = 3; a.t = 0; if (a.bub) a.gh.obj.remove(a.bub); }
    return 0;
  }
  // dışarı çık
  a.t += sim / 2.2; const t = Math.min(1, a.t);
  ob.position.x = lerp(a.p1[0], a.p0[0], t); ob.position.z = lerp(a.p1[1], a.p0[1], t);
  turnTo(Math.atan2(a.p0[0] - a.p1[0], a.p0[1] - a.p1[1]), dt);
  if (t >= 1) nextAction();
  return 1.2;
}

function arrive(st, a) {
  const idx = S.ordered.indexOf(st);
  S.done.add(idx);
  const cols = [0xff7a00, 0x00b4d8, 0x2a9d8f, 0xe63946, 0x9b5de5, 0xf15bb5, 0xfee440, 0x00f5d4];
  if (st.kind === 'shop') {
    avatar.addBag(cols[idx % cols.length]);
    const q = st.item.qty ? ` (${st.item.qty})` : '';
    if (S.story) toast(`✉️ Mektup teslim edildi! ${st.firm}: "Paşam, bunu 1880'den beri bekliyorduk."`, 'lore', 5500);
    else toast(`✅ ${st.title}${q} alındı — ${st.firm} · No ${st.shop.no}`, 'good', 3500);
  } else {
    const gh = ghosts.find(g => g.stop === st);
    a.gh = gh; a.line = -1; a.bub = bubble('…', 760); a.bub.visible = false; gh.obj.add(a.bub);
    toast(`👻 ${st.ghost.name} bulundu!`, 'lore', 3000);
    if (st.floor === 3) avatar.addBag(0xf3e2b8);
  }
  renderChecklist();
}

function finish() {
  S.mode = 'done';
  const secs = Math.round((performance.now() - S.t0) / 1000);
  if (S.story) {
    $('#doneMedal').textContent = '🍐';
    $('#doneTitle').textContent = 'Perpa\'nın şifresi çözüldü!';
    $('#doneText').innerHTML = 'Paşa bulundu, ferman alındı, mektup kırtasiyeye ulaştı ve <b>çıkış bulundu</b>. Komple Teori\'ye göre Perpa\'dan çıkabilen bir yapay zekâ "harbi yapay zekâ" demek… yani ayvayı yedik. 🏅';
  } else {
    $('#doneMedal').textContent = '🏅';
    $('#doneTitle').textContent = 'Liste tamam, çıkış bulundu!';
    $('#doneText').innerHTML = `${S.ordered.length} dükkân gezildi. Bir ziyaretçi Perpa'da çıkışı bulmak için 3 saat dolaştığını anlatmış; PerpAI ile tahmini toplam süre ~${S.summary.mins} dk.`;
  }
  $('#doneStats').innerHTML = `<div class="stat"><b>${Math.round(S.walked)} m</b><span>yürünen</span></div><div class="stat"><b>${S.summary.rides}</b><span>kat geçişi</span></div><div class="stat"><b>${S.summary.floors}</b><span>farklı kat</span></div>`;
  $('#target').innerHTML = `<div class="k">Tamamlandı</div><div class="h">${S.story ? 'Görev bitti' : 'Liste tamam'}</div><div class="f">Çıkış bulundu · 8. kat ana giriş</div>`;
  $('#instr').innerHTML = '<div class="now">🎉 Perpa\'dan çıktınız</div>';
  renderChecklist();
  show('done'); $('#hud').classList.add('show');
}

function turnTo(h, dt) {
  let d = h - avatar.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
  avatar.heading += d * Math.min(1, dt * 10);
  avatar.obj.rotation.y = avatar.heading;
}

function checkLore() {
  const x = avatar.obj.position.x;
  const side = x < HALL.x0 ? 'B' : x > HALL.x1 ? 'A' : null;
  if (side && S.lastSide && side !== S.lastSide && !S.flags.ab) {
    S.flags.ab = true;
    toast('Efsaneye göre A Blok\'takiler B Blok\'u, B\'dekiler A\'yı göremez. PerpAI ikisini de görüyor. 👀', 'lore', 5000);
  }
  if (side) S.lastSide = side;
}

// ------------------------------------------------------------------ kamera
function setCam(m) {
  S.camMode = m;
  $$('#cCam button').forEach(b => b.classList.toggle('on', b.dataset.v === m));
  controls.enabled = m === 'orbit';
  if (m === 'orbit') { controls.autoRotate = false; controls.target.copy(avatar.obj.position).add(new THREE.Vector3(0, 1.5, 0)); }
  applyCamVisibility();
}

function applyCamVisibility() {
  const top = S.camMode === 'top' && S.mode === 'walk';
  const outside = avatar && avatar.obj.position.z > 50.5;
  if (world.mode === 'walk') world.groups.exterior.visible = !top || outside;
  const ceil = world.detailGroup.children[1];
  if (ceil) ceil.visible = !top;
  const lightsMesh = world.detailGroup.children[3];
  if (lightsMesh) lightsMesh.visible = !top;
  for (const m of world.groups.lite.children) m.visible = m.userData.floor !== world.floor && !(top && m.userData.floor > world.floor);
  world.groups.cores.children.forEach(c => { if (c === world.stairCores) c.visible = !top; });
}

const tmpV = new THREE.Vector3(), tmpL = new THREE.Vector3();
// kamera dükkan duvarlarının içine girmesin: avatardan geriye doğru ilk engelde dur
function clampToWalkable(from, to) {
  const grid = getLayout(variantOf(world.floor)).grid;
  const i0 = cellIdx(from.x, from.z);
  if (i0 < 0 || !grid.zone[i0]) return to;
  const dx = to.x - from.x, dz = to.z - from.z, L = Math.hypot(dx, dz), n = Math.max(1, Math.ceil(L / 0.25));
  for (let k = 1; k <= n; k++) {
    const t = k / n, i = cellIdx(from.x + dx * t, from.z + dz * t);
    if (i < 0 || !grid.zone[i]) {
      const tt = Math.max(0, (k - 3) / n);
      to.x = from.x + dx * tt; to.z = from.z + dz * tt; to.y = Math.max(to.y, from.y + 3.4);
      break;
    }
  }
  return to;
}
function updateCamera(dt) {
  const p = avatar.obj.position, h = avatar.heading, fw = new THREE.Vector3(Math.sin(h), 0, Math.cos(h));
  const a = S.actions[S.ai], k = 1 - Math.exp(-dt * 3.5);
  // iz (trail)
  const last = S.trail[S.trail.length - 1];
  if (!last || last.distanceTo(p) > 0.35) { S.trail.push(p.clone()); if (S.trail.length > 80) S.trail.shift(); }
  if (S.camMode === 'orbit') { controls.target.lerp(tmpV.copy(p).add(new THREE.Vector3(0, 1.5, 0)), k); return; }
  if (S.camMode === 'fps') {
    cam.position.lerp(tmpV.copy(p).add(new THREE.Vector3(0, 1.62, 0)).addScaledVector(fw, 0.25), Math.min(1, k * 3));
    tmpL.copy(p).add(new THREE.Vector3(0, 1.5, 0)).addScaledVector(fw, 10);
    cam.lookAt(tmpL); return;
  }
  if (S.camMode === 'top') {
    applyCamVisibility();
    cam.position.lerp(tmpV.set(p.x, p.y + 42, p.z + 16), k);
    cam.lookAt(p.x, p.y, p.z - 2); return;
  }
  // 3. şahıs
  if (a && a.type === 'elevator' && a.ph === 2) {
    const c = a.seg.cab, sw = Math.sin(performance.now() / 2500);
    cam.position.set(c.x + 4.2, p.y + 1.7 + sw * 0.3, c.z + 1.6 * sw); cam.lookAt(c.x - 3, p.y + 1.1, c.z - sw); return;
  }
  if (a && a.type === 'escalator') {
    const w = a.seg.conn.well;
    tmpV.set(p.x + (p.x < 0 ? 2.4 : -2.4), p.y + 2.6, Math.max(w.z0 - 3, Math.min(w.z1 + 3, p.z - fw.z * 6)));
    cam.position.lerp(tmpV, k); cam.lookAt(p.x, p.y + 1.3, p.z + fw.z * 3); return;
  }
  let back = null, dist = 0;
  for (let i = S.trail.length - 1; i > 0; i--) {
    dist += S.trail[i].distanceTo(S.trail[i - 1]);
    if (dist > 6.5) { back = S.trail[i - 1]; break; }
  }
  if (!back || Math.abs(back.y - p.y) > 1) back = tmpL.copy(p).addScaledVector(fw, -6.5);
  tmpV.set(back.x, p.y + 3.0, back.z);
  clampToWalkable(p, tmpV);
  cam.position.lerp(tmpV, k);
  if (Math.abs(cam.position.y - tmpV.y) > 2) cam.position.y = tmpV.y;
  cam.lookAt(p.x + fw.x * 3, p.y + 1.4, p.z + fw.z * 3);
}

// ------------------------------------------------------------------ HUD
function toast(text, cls = '', ms = 3200) {
  const t = document.createElement('div'); t.className = 'toast ' + cls; t.textContent = text;
  $('#toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 500); }, ms);
  while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
}

function renderChecklist() {
  const cur = nextStop();
  $('#checklist').innerHTML = `<h4>${S.story ? 'Görev' : 'Liste'} · ${S.done.size}/${S.ordered.length}</h4>` + S.ordered.map((s, i) => {
    const ok = S.done.has(i), c = s === cur && !ok;
    const w = s.kind === 'shop' ? `${s.shop.block} · ${s.floor}. kat · No ${s.shop.no}` : `${s.floor}. kat`;
    return `<div class="ck ${ok ? 'ok' : ''} ${c ? 'cur' : ''}"><div class="b">${ok ? '✓' : ''}</div><div class="l">${esc(s.title)}<small>${esc(w)}</small></div></div>`;
  }).join('') + (S.story ? `<div class="ck ${S.mode === 'done' ? 'ok' : ''}"><div class="b">${S.mode === 'done' ? '✓' : ''}</div><div class="l">Çıkışı bul<small>8. kat ana giriş</small></div></div>` : '');
}

function buildFloorbar() {
  const fb = $('#floorbar'); const stopFloors = new Set(S.ordered.filter((s, i) => !S.done.has(i)).map(s => s.floor));
  fb.innerHTML = Array.from({ length: FLOORS }, (_, i) => i + 1).map(f => `<div class="${f === world.floor ? 'cur' : ''} ${stopFloors.has(f) ? 'stop' : ''}">${f}</div>`).join('');
  $('#mmFloor').textContent = `${world.floor}. KAT`;
}

function describeAction(a) {
  if (!a) return '';
  if (a.type === 'elevator') return `🛗 ${a.seg.conn.name} ile ${a.seg.to}. kata ${a.seg.to > a.seg.from ? 'çıkın' : 'inin'}`;
  if (a.type === 'stairs') return `🪜 ${a.seg.conn.name}nden ${a.seg.to}. kata ${a.seg.to > a.seg.from ? 'çıkın' : 'inin'}`;
  if (a.type === 'escalator') return `↗ Yürüyen merdivenle ${a.seg.to}. kata ${a.seg.to > a.seg.from ? 'çıkın' : 'inin'}`;
  if (a.type === 'visit') {
    const s = a.stop;
    if (s.kind === 'ghost') return `👻 ${s.ghost.name.split(' (')[0]} ileride!`;
    const p = avatar.obj.position, h = avatar.heading, sl = s.shop.slot;
    const cross = Math.sin(h) * (sl.z - p.z) - Math.cos(h) * (sl.x - p.x);
    return `🏁 No ${s.shop.no} ${cross < 0 ? 'solunuzda' : 'sağınızda'} — ${s.firm}`;
  }
  if (a.type === 'finish') return '🚪 Çıkış: ana giriş';
  return '';
}

let hudT = 0;
function updateHUD(dt) {
  hudT += dt; if (hudT < 0.2) return; hudT = 0;
  const st = nextStop(), a = S.actions[S.ai];
  if (!a) return;
  // kalan mesafe (bir sonraki ziyarete kadar)
  let rem = 0, nextEv = null, distToEv = 0;
  for (let i = S.ai; i < S.actions.length; i++) {
    const b = S.actions[i];
    if (b.type === 'walk') { const r = b.len - (i === S.ai ? (b.d || 0) : 0); rem += r; if (!nextEv) distToEv += r; }
    else if (b.type === 'visit' || b.type === 'finish') { if (!nextEv) nextEv = b; break; }
    else { if (!nextEv && i !== S.ai) nextEv = b; rem += 15; }
  }
  const idx = st ? S.ordered.indexOf(st) : -1;
  if (st) {
    const where = st.kind === 'shop' ? `${st.shop.block} Blok · ${st.floor}. kat · No ${st.shop.no} ${zoneChip(st.shop.slot.zone)}` : `${st.floor}. kat · ${st.where}`;
    $('#target').innerHTML = `<div class="k">Sıradaki · ${idx + 1}/${S.ordered.length}</div><div class="h">${esc(st.title)}</div><div class="f">${esc(st.firm)}<br>${where}</div>
      <div class="d"><span><b>${Math.round(rem)} m</b> kaldı</span><span><b>~${Math.max(1, Math.round(rem / 1.25 / 60))} dk</b> yürüyerek</span><span>${S.speed}× hız</span></div>`;
  } else {
    $('#target').innerHTML = `<div class="k">${S.story ? 'Son görev' : 'Liste tamam'}</div><div class="h">Çıkışı bul</div><div class="f">8. kat · ana giriş (meydan)</div><div class="d"><span><b>${Math.round(rem)} m</b> kaldı</span></div>`;
  }
  let now;
  if (a.type === 'walk') {
    const z = a.outside ? null : zoneAt(getLayout(variantOf(a.floor)).grid, avatar.obj.position.x, avatar.obj.position.z);
    now = a.outside ? (a.pts[1][1] < a.pts[0][1] ? '🚪 Ana girişten içeri girin (8. kat)' : '🌳 Meydana çıkın') : `${z ? z.text : 'Koridor'} boyunca ilerleyin`;
  } else now = describeAction(a);
  const nx = a.type === 'walk' ? nextEv || S.actions[S.ai + 1] : S.actions[S.ai + 1];
  $('#instr').innerHTML = `<div class="now">${now}</div>${nx ? `<div class="next">Sonra (${Math.round(distToEv)} m): ${describeAction(nx)}</div>` : ''}`;
}

// ------------------------------------------------------------------ mini harita
const mm = $('#minimap'), mx = mm.getContext('2d');
let mmBase = null;
const MS = 2;
const mmX = x => (x - GX0) * MS, mmY = z => (z - GZ0) * MS;
function drawMinimapBase() {
  const v = variantOf(world.floor), lay = getLayout(v);
  const c = document.createElement('canvas'); c.width = mm.width; c.height = mm.height; const x = c.getContext('2d');
  x.fillStyle = '#0d1421'; x.fillRect(0, 0, c.width, c.height);
  const img = x.getImageData(0, 0, c.width, c.height), D = img.data;
  const zc = { 1: [120, 52, 56], 2: [70, 80, 96], 3: [62, 84, 74], 4: [52, 78, 110], 5: [52, 78, 110], 6: [90, 90, 60], 7: [64, 64, 70], 8: [110, 90, 60] };
  for (let i = 0; i < lay.grid.zone.length; i++) {
    const zz = lay.grid.zone[i]; if (!zz) continue;
    const gx = i % GW, gy = (i / GW) | 0, col = zc[zz];
    for (let a = 0; a < MS; a++) for (let b = 0; b < MS; b++) { const k = ((gy * MS + b) * c.width + gx * MS + a) * 4; D[k] = col[0]; D[k + 1] = col[1]; D[k + 2] = col[2]; D[k + 3] = 255; }
  }
  x.putImageData(img, 0, 0);
  for (const s of lay.slots) {
    x.save(); x.translate(mmX(s.x), mmY(s.z)); x.rotate(-s.rot);
    x.fillStyle = '#' + new THREE.Color(ZONE_COLORS[s.zone]).getHexString();
    x.globalAlpha = 0.85; x.fillRect(-s.w * MS / 2 + 0.5, -s.d * MS / 2 + 0.5, s.w * MS - 1, s.d * MS - 1); x.restore();
  }
  x.fillStyle = '#8b7355';
  for (const g of GATES) { const [hx, hz] = coreHalf(g.core); x.fillRect(mmX(g.core.x - hx), mmY(g.core.z - hz), hx * 2 * MS, hz * 2 * MS); }
  x.fillStyle = '#fff'; x.font = '700 9px Inter';
  for (const c2 of CELLS) { if (v === 'G' && c2.front) continue; x.beginPath(); x.arc(mmX(c2.cx), mmY(c2.cz), 2.4, 0, 7); x.fill(); }
  x.font = '800 16px Inter'; x.globalAlpha = 0.6; x.fillText('B BLOK', mmX(-100), mmY(-52) + 10); x.fillText('A BLOK', mmX(70), mmY(-52) + 10); x.globalAlpha = 1;
  return c;
}
function drawMinimap() {
  if (!mmBase) mmBase = drawMinimapBase();
  mx.drawImage(mmBase, 0, 0);
  const f = world.floor;
  mx.lineWidth = 3; mx.strokeStyle = '#00e5ff'; mx.lineJoin = 'round';
  mx.beginPath();
  for (let i = S.ai; i < S.actions.length; i++) {
    const a = S.actions[i]; if (a.type === 'visit') break;
    if (a.type !== 'walk' || a.floor !== f) continue;
    const pts = i === S.ai ? remainingPts(a) : a.pts;
    pts.forEach((p, k) => k ? mx.lineTo(mmX(p[0]), mmY(p[1])) : mx.moveTo(mmX(p[0]), mmY(p[1])));
  }
  mx.stroke();
  S.ordered.forEach((s, i) => {
    if (s.floor !== f) return;
    mx.fillStyle = S.done.has(i) ? '#3fae49' : '#fff'; mx.beginPath(); mx.arc(mmX(s.x), mmY(s.z), 5, 0, 7); mx.fill();
    mx.fillStyle = '#04121c'; mx.font = '800 8px Inter'; mx.textAlign = 'center'; mx.fillText(i + 1, mmX(s.x), mmY(s.z) + 3); mx.textAlign = 'left';
  });
  const p = avatar.obj.position, h = avatar.heading;
  mx.save(); mx.translate(mmX(p.x), mmY(p.z)); mx.rotate(-h + Math.PI);
  mx.fillStyle = '#ff7a00'; mx.strokeStyle = '#fff'; mx.lineWidth = 1.5;
  mx.beginPath(); mx.moveTo(0, -8); mx.lineTo(6, 6); mx.lineTo(0, 3); mx.lineTo(-6, 6); mx.closePath(); mx.fill(); mx.stroke(); mx.restore();
}

// ------------------------------------------------------------------ kontroller
$('#cPlay').onclick = () => togglePause();
function togglePause() { S.paused = !S.paused; $('#cPlay').textContent = S.paused ? '▶' : '⏸'; }
$$('#cSpeed button').forEach(b => b.onclick = () => setSpeed(+b.dataset.v));
function setSpeed(v) { S.speed = v; $$('#cSpeed button').forEach(x => x.classList.toggle('on', +x.dataset.v === v)); }
$$('#cCam button').forEach(b => b.onclick = () => setCam(b.dataset.v));
$('#cXray').onclick = () => toggleXray();
let xrayFromWalk = false, savedCam = null;
function toggleXray() {
  if (S.mode !== 'walk' && !xrayFromWalk) return;
  if (!xrayFromWalk) {
    xrayFromWalk = true; S.wasPaused = S.paused; S.paused = true; savedCam = S.camMode;
    world.setMode('xray'); controls.enabled = true; controls.autoRotate = true;
    frameXray();
    if (!S.youMarker) { S.youMarker = world.label('SEN BURADASIN', '#fff', '#ff7a00', 1, true); world.groups.xray.add(S.youMarker); }
    const p = avatar.obj.position; S.youMarker.position.set(p.x, floorY(world.floor) * world.XS + 8, p.z); S.youMarker.visible = true;
    routeViz.reveal = null; routeViz.xrayGroup.children.forEach(c => c.visible = true);
    $('#cXray').textContent = '🚶 Devam';
  } else {
    xrayFromWalk = false; S.paused = S.wasPaused; world.setMode('walk'); setCam(savedCam);
    $('#cXray').textContent = '🧊 Rota';
  }
}
window.addEventListener('keydown', e => {
  if (S.mode !== 'walk' || e.target.tagName === 'TEXTAREA') return;
  if (e.code === 'Space') { e.preventDefault(); togglePause(); }
  if (e.key >= '1' && e.key <= '4') setCam(['follow', 'fps', 'top', 'orbit'][+e.key - 1]);
  if (e.key === '+' || e.key === '=') setSpeed(Math.min(8, S.speed * 2));
  if (e.key === '-') setSpeed(Math.max(1, S.speed / 2));
  if (e.key === 'r' || e.key === 'R') toggleXray();
});
window.addEventListener('resize', () => routeViz?.resize());

// ------------------------------------------------------------------ döngü
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
  if (S.anim) S.anim();
  world.update(dt, t);
  if (crowd && (S.mode === 'walk' || S.mode === 'fly' || S.mode === 'scan' || S.mode === 'done')) crowd.update(dt, t);
  for (const p of plazaPeople) {
    p.position.z += p.userData.v * dt; if (p.position.z > 155) p.userData.v = -Math.abs(p.userData.v); if (p.position.z < 60) p.userData.v = Math.abs(p.userData.v);
    p.rotation.y = p.userData.v > 0 ? 0 : Math.PI; animatePerson(p, Math.abs(p.userData.v), dt);
  }
  for (const g of ghosts) { g.obj.position.y = g.base + 0.25 + Math.sin(t * 2) * 0.15; g.obj.rotation.y = Math.sin(t * 0.7) * 0.6; animatePerson(g.obj, 0, dt); }
  if (avatar) {
    let sp = 0;
    if (S.mode === 'walk' && !S.paused) sp = stepWalker(dt);
    animatePerson(avatar.obj, S.paused ? 0 : sp, dt);
    world.openDoors(avatar.obj.position);
    if (S.mode === 'walk' || S.mode === 'done') {
      if (!xrayFromWalk) updateCamera(dt);
      routeViz.update(t, avatar.obj.position);
      if (S.mode === 'walk') { updateHUD(dt); drawMinimap(); }
    }
    if (S.mode === 'plan' || xrayFromWalk || world.mode === 'xray') routeViz.update(t, null);
  }
  if (controls.enabled) controls.update();
  world.render();
}

// geliştirme için
// QR tarayıcı: oyun içinden, okutma ekranından ve girişten açılır
function scanQR() {
  const wasPaused = S.paused; if (S.mode === 'walk') S.paused = true;
  openScanner({
    parse: parseScanned,
    onResult: q => { relocate(q); if (S.mode === 'walk') S.paused = wasPaused; },
    onClose: () => { if (S.mode === 'walk') S.paused = wasPaused; },
  });
}
$('#cQR').onclick = scanQR;
$('#btnWhere').onclick = scanQR;
$('#btnIntroQR').onclick = scanQR;

window.PerpAI = {
  S, world, DB, cam, setCam, setSpeed, startFlight, scanList, planAndShow, startWalk, relocate, resolveQR,
  // test: simülasyonu ileri sar
  ff(sec, until) { for (let i = 0; i < sec * 20; i++) { if (S.mode !== 'walk') break; const sp = stepWalker(0.05); updateCamera(0.05); if (until && until(S.actions[S.ai])) break; } },
};
