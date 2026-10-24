// Kamerayla yürüme: rota bacağını yürüme/biniş evrelerine böler, dönüşleri ve yön okunu hesaplar.
// Açı kuralları: model başlığı h = atan2(dx, dz) (yukarıdan bakınca saat yönünün tersi);
// ekranda/pusulada saat yönü pozitif, bu yüzden modelden saat yönüne çevirmek için -h.
import type { Leg, Segment } from './route';

type Pt = [number, number];
export type Dir = 'straight' | 'slight-left' | 'left' | 'slight-right' | 'right' | 'back';
export type Turn = { at: number; dir: Dir };
export type WalkPhase = { kind: 'walk'; floor: number; pts: Pt[]; cum: number[]; length: number; turns: Turn[] };
export type RidePhase = { kind: 'ride'; mode: 'elevator' | 'stairs' | 'escalator'; from: number; to: number; text: string };
export type Phase = WalkPhase | RidePhase;

const TAU = Math.PI * 2;
export const wrap = (a: number) => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI; // -π..π
const headingOf = (a: Pt, b: Pt) => Math.atan2(b[0] - a[0], b[1] - a[1]);

// sol/sağ: ileri f = (sin h, cos h), sol L = (cos h, -sin h)
export function side(h: number, dx: number, dz: number): 'left' | 'right' {
  return dx * Math.cos(h) - dz * Math.sin(h) > 0 ? 'left' : 'right';
}

function turnDir(hIn: number, hOut: number): Dir {
  const d = wrap(hOut - hIn); // pozitif = model açısı artar = yukarıdan saat yönünün tersi = sola
  const a = Math.abs(d) * 180 / Math.PI;
  if (a < 25) return 'straight';
  if (a > 150) return 'back';
  const l = d > 0;
  if (a < 55) return l ? 'slight-left' : 'slight-right';
  return l ? 'left' : 'right';
}

function walkPhase(floor: number, raw: Pt[]): WalkPhase | null {
  const pts: Pt[] = [];
  for (const p of raw) { const q = pts[pts.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.3) pts.push(p); }
  if (pts.length < 2) return null;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const turns: Turn[] = [];
  for (let i = 1; i < pts.length - 1; i++) {
    const dir = turnDir(headingOf(pts[i - 1], pts[i]), headingOf(pts[i], pts[i + 1]));
    if (dir !== 'straight') turns.push({ at: cum[i], dir });
  }
  return { kind: 'walk', floor, pts, cum, length: cum[cum.length - 1], turns };
}

const rideText = (mode: RidePhase['mode'], name: string, from: number, to: number) => {
  const yon = to > from ? 'çıkın' : 'inin';
  return mode === 'elevator' ? `${name} ile ${to}. kata ${yon}`
    : mode === 'stairs' ? `${name}nden ${to}. kata ${yon}`
      : `Yürüyen merdivenle ${to}. kata ${yon}`;
};

export function phasesOf(leg: Leg): Phase[] {
  const out: Phase[] = [];
  for (const s of leg.segments as Segment[]) {
    if (s.type === 'walk') {
      if (s.transfer) continue; // yürüyen merdivenler arası geçiş: binişin parçası
      const w = walkPhase(s.floor, s.pts);
      if (!w) continue;
      const prev = out[out.length - 1];
      if (prev && prev.kind === 'walk' && prev.floor === w.floor) out[out.length - 1] = walkPhase(w.floor, [...prev.pts, ...w.pts])!;
      else out.push(w);
    } else {
      const prev = out[out.length - 1];
      if (s.kind === 'escalator' && prev && prev.kind === 'ride' && prev.mode === 'escalator') {
        prev.to = s.to; prev.text = rideText('escalator', '', prev.from, prev.to);
      } else {
        out.push({ kind: 'ride', mode: s.kind, from: s.from, to: s.to, text: rideText(s.kind, s.conn.name, s.from, s.to) });
      }
    }
  }
  return out;
}

// yol üzerinde s metredeki nokta ve o andaki yürüyüş başlığı
export function pointAt(w: WalkPhase, s: number): { x: number; z: number; h: number } {
  const t = Math.max(0, Math.min(w.length, s));
  let i = 1;
  while (i < w.cum.length - 1 && w.cum[i] < t) i++;
  const a = w.pts[i - 1], b = w.pts[i], seg = w.cum[i] - w.cum[i - 1] || 1, k = (t - w.cum[i - 1]) / seg;
  return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, h: headingOf(a, b) };
}

// okun göstereceği başlık: birkaç metre ilerideki noktaya doğru (köşelerde yumuşak döner)
export function aimAt(w: WalkPhase, s: number, ahead = 4): number {
  const p = pointAt(w, s), q = pointAt(w, s + ahead);
  return Math.hypot(q.x - p.x, q.z - p.z) < 0.2 ? p.h : Math.atan2(q.x - p.x, q.z - p.z);
}

export const nextTurn = (w: WalkPhase, s: number) => w.turns.find(t => t.at > s + 0.5) ?? null;

export const DIR_TEXT: Record<Dir, string> = {
  straight: 'düz ilerleyin', 'slight-left': 'hafif sola dönün', left: 'sola dönün',
  'slight-right': 'hafif sağa dönün', right: 'sağa dönün', back: 'geri dönün',
};
export const DIR_ANGLE: Record<Dir, number> = { straight: 0, 'slight-left': -40, left: -90, 'slight-right': 40, right: 90, back: 180 };

export const roundM = (m: number) => (m < 10 ? Math.max(1, Math.round(m)) : Math.round(m / 5) * 5);

// Arka kameranın baktığı yön, kuzeyden saat yönünde derece (W3C deviceorientation α, β, γ radyan)
export function cameraHeading(alpha: number, beta: number, gamma: number): number {
  const cY = Math.cos(gamma), cZ = Math.cos(alpha);
  const sX = Math.sin(beta), sY = Math.sin(gamma), sZ = Math.sin(alpha);
  const vx = -cZ * sY - sZ * sX * cY;
  const vy = -sZ * sY + cZ * sX * cY;
  return ((Math.atan2(vx, vy) * 180 / Math.PI) + 360) % 360;
}

// Kalibrasyon c: modeldeki saat yönü başlık = pusula + c. Kullanıcı model başlığı h'ye bakarken pusula ψ ise:
export const calibrate = (hModel: number, compassDeg: number) => wrap(-hModel - compassDeg * Math.PI / 180);
// hedef başlığın telefona göre açısı (derece, sağ pozitif)
export function relative(hTarget: number, compassDeg: number, calib: number): number {
  return wrap(-hTarget - (compassDeg * Math.PI / 180 + calib)) * 180 / Math.PI;
}

// İvmeölçerden adım sayar: büyüklükteki tepe, alt geçirgen süzgeçten sonra eşik ve en az 280 ms aralık
export class StepDetector {
  private avg = 1; private armed = true; private last = 0;
  private onStep: () => void;
  constructor(onStep: () => void) { this.onStep = onStep; }
  push(x: number, y: number, z: number, t = Date.now()) {
    const g = Math.hypot(x, y, z);
    this.avg = this.avg * 0.9 + g * 0.1;
    const d = g - this.avg;
    if (this.armed && d > 0.12 && t - this.last > 280) { this.armed = false; this.last = t; this.onStep(); }
    else if (d < 0.02) this.armed = true;
  }
}
