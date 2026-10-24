// Listeden rota: alınacak kalemleri dükkâna göre grupla, bulunduğun yerden en kısa turu kur.
import { EXIT, legInstructions, planRoute, shopByKey, type Place, type Point, type Shop } from './perpa';
import type { ListItem, ShopList } from './store';

export type Stop = Point & { key: string; shop: Shop; items: ListItem[] };
export type Segment =
  | { type: 'walk'; floor: number; pts: [number, number][]; length: number; transfer?: boolean }
  | { type: 'ride'; kind: 'elevator' | 'stairs' | 'escalator'; from: number; to: number; conn: { name: string; id: string } };
export type Leg = { segments: Segment[]; length: number; toStop: number | null; fromFloor: number; toFloor: number; via: { type: string; name: string } | null };
export type Plan = { stops: Stop[]; legs: Leg[]; total: number };

export function stopsOf(list: ShopList): Stop[] {
  const by = new Map<string, ListItem[]>();
  for (const it of list.items) {
    if (it.status !== 'todo' || !it.shopKey) continue;
    by.set(it.shopKey, [...(by.get(it.shopKey) ?? []), it]);
  }
  const out: Stop[] = [];
  for (const [key, items] of by) {
    const shop = shopByKey(key);
    if (shop) out.push({ key, shop, items, x: shop.slot.door.x, z: shop.slot.door.z, floor: shop.floor });
  }
  return out;
}

// start: liste için kaydedilmiş konum > son QR (30 dk içinde) > ana giriş
export function startOf(list: ShopList, qr: (Place & { at: number }) | null): Place {
  if (list.here) return list.here;
  if (qr && Date.now() - qr.at < 30 * 60 * 1000) return qr;
  return EXIT;
}

export function planFor(list: ShopList, start: Place): Plan {
  const stops = stopsOf(list);
  const r = planRoute(start, stops, false, EXIT) as { order: number[]; legs: Leg[]; total: number };
  const ordered = r.order.map(i => stops[i]);
  // bacakların toStop'u orijinal sıraya göre; sıralı listeye çevir
  const legs = r.legs.map(l => ({ ...l, toStop: l.toStop == null ? null : ordered.indexOf(stops[l.toStop]) }));
  return { stops: ordered, legs, total: r.total };
}

export const walkLength = (p: Plan) => p.legs.reduce((s, l) => s + l.segments.reduce((a, g) => a + (g.type === 'walk' ? g.length : 0), 0), 0);
export const floorsOf = (p: Plan) => [...new Set(p.stops.map(s => s.floor))];
export const etaMinutes = (p: Plan) => {
  const rides = p.legs.flatMap(l => l.segments).filter(g => g.type === 'ride') as Extract<Segment, { type: 'ride' }>[];
  const sec = walkLength(p) / 1.25 + rides.reduce((a, r) => a + (r.kind === 'elevator' ? 60 : r.kind === 'stairs' ? 25 : 35), 0) + p.stops.length * 240;
  return Math.max(1, Math.round(sec / 60));
};

export type Step = { text: string; dist?: string; ride?: boolean; final?: boolean; floor?: number };
export const stepsOf = (leg: Leg, target: string): Step[] => legInstructions(leg, target);

export function rideIcon(kind: string) {
  return kind === 'elevator' ? 'elevator-passenger' : kind === 'stairs' ? 'stairs' : 'escalator';
}
