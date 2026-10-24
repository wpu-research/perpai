// Çekirdek modüllere (src/core, web/js'den kopya) tipli giriş noktası
import firmsJson from './core/firms.json';
import { loadData, DB as RawDB, parseList, candidatesFor, chooseShops, shopTitle, PRESETS } from './core/data.js';
import { planRoute, legInstructions } from './core/nav.js';
import { ENTRY, FLOORS, getLayout, variantOf, zoneAt, CELLS, GATES, WELLS, HALL, DIM, GX0, GZ0, GW, GH, floorY } from './core/layout.js';
import { qrList, resolveQR, parseScanned, KIND_LABEL } from './core/qr.js';
import type { ZoneKey } from './theme';

export type Slot = { x: number; z: number; w: number; d: number; rot: number; fx: number; fz: number; zone: ZoneKey; block: 'A' | 'B'; door: { x: number; z: number } };
export type Firm = { i: number; n: string; b: 'A' | 'B'; k: string; no: number; s: number[]; ef: number };
export type Shop = { floor: number; si: number; slot: Slot; block: 'A' | 'B'; no: number; firm: Firm | null };
export type Point = { x: number; z: number; floor: number };
export type Place = Point & { heading: number; label: string; sub?: string; code?: string; source: 'giris' | 'qr' | 'durak' };
export type QRPlace = { code: string; kind: string; floor: number; x: number; z: number; heading: number; label: string; sub: string; zone: ZoneKey | null; block?: 'A' | 'B'; no?: number };

export const DB = RawDB as unknown as { sectors: Record<number, string>; firms: Firm[]; floors: Record<number, Shop[]> };

let ready: Promise<void> | null = null;
export function initData() {
  if (!ready) ready = loadData(firmsJson).then(() => undefined);
  return ready;
}

export const EXIT: Place = { x: ENTRY.x, z: ENTRY.z, floor: ENTRY.floor, heading: Math.PI, label: '8. kat · ana giriş', source: 'giris', code: 'GIRIS' };

export const toPlace = (q: QRPlace): Place => ({
  x: q.x, z: q.z, floor: q.floor, heading: q.heading, label: q.label, sub: q.sub, code: q.code,
  source: q.code === 'GIRIS' ? 'giris' : 'qr',
});

export const shopKey = (s: Shop) => `${s.floor}:${s.si}`;
export function shopByKey(key?: string | null): Shop | null {
  if (!key) return null;
  const [f, si] = key.split(':').map(Number);
  return (DB.floors[f]?.[si] as Shop) ?? null;
}
export const shopName = (s: Shop): string => shopTitle(s);
export const shopWhere = (s: Shop) => `${s.block} Blok · ${s.floor}. kat · No ${s.no}`;

export function sectorStats(): { id: number; name: string; count: number }[] {
  const counts = new Map<number, number>();
  for (const f of DB.firms as Firm[]) for (const s of f.s) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts.entries()].map(([id, count]) => ({ id, count, name: DB.sectors[id] as string })).sort((a, b) => b.count - a.count);
}

// Firma adı ya da "B 1450" ile arama
export function searchShops(q: string, limit = 20): Shop[] {
  const t = q.trim().toLocaleUpperCase('tr-TR');
  if (t.length < 2) return [];
  const m = t.match(/^([AB])\s*[- ]?\s*(\d{1,4})$/);
  const all: Shop[] = Object.values(DB.floors).flat() as Shop[];
  if (m) return all.filter(s => s.block === m[1] && String(s.no).startsWith(m[2])).sort((a, b) => a.no - b.no).slice(0, limit);
  return all.filter(s => s.firm && (s.firm as Firm & { N: string }).N.includes(t)).slice(0, limit);
}

export {
  parseList, candidatesFor, chooseShops, PRESETS, planRoute, legInstructions, ENTRY, FLOORS, getLayout, variantOf, zoneAt,
  CELLS, GATES, WELLS, HALL, DIM, GX0, GZ0, GW, GH, floorY, qrList, resolveQR, parseScanned, KIND_LABEL,
};
