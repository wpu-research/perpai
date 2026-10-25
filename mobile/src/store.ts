// Uygulama durumu: alışveriş listeleri, harcamalar, QR konumu. Cihazda kalıcı (AsyncStorage);
// liste satırları eşleştirme ipucu için sunucuya gider (yapay zekâ), listelerin eşitlemesi sonraki adım.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { aiHints, candidatesFor, chooseShops, parseList, shopKey, type Hint, type Place, type Shop } from './perpa';

export type ItemStatus = 'todo' | 'bought' | 'skipped';
export type ListItem = {
  id: string;
  raw: string;
  label: string;
  qty: string | null;
  cat: string | null;
  shopKey: string | null;   // seçilen dükkân (kat:slot)
  pool: string[];           // alternatif dükkânlar
  status: ItemStatus;
  price: number | null;     // birim değil, satırın toplam tutarı (₺)
  boughtAt: number | null;
};
export type ListStatus = 'planned' | 'active' | 'done';
export type ShopList = {
  id: string;
  title: string;
  createdAt: number;
  status: ListStatus;
  pick: 'uzman' | 'yakin';
  items: ListItem[];
  here: Place | null;       // navigasyonda son bilinen konum (QR ya da varılan dükkân)
};

type State = {
  lists: ShopList[];
  hints: Record<string, Hint>; // satır -> yapay zekâ ipucu (önbellek)
  location: (Place & { at: number }) | null;   // son QR konumu
  calib: number | null;                        // kamera yönü: pusula -> model açısı farkı (guide.ts)
  stride: number;                              // adım boyu (m), iki QR arasından öğrenilir
  merchantToken: string | null;                // esnaf oturumu (server/merchant.js)
  createList: (text: string, title: string, pick: 'uzman' | 'yakin') => string;
  rematch: (id: string, pick: 'uzman' | 'yakin') => void;
  nextAlternative: (listId: string, itemId: string) => void;
  setItem: (listId: string, itemId: string, patch: Partial<ListItem>) => void;
  setList: (listId: string, patch: Partial<ShopList>) => void;
  deleteList: (listId: string) => void;
  setLocation: (p: Place | null) => void;
  setCalib: (c: number | null) => void;
  setStride: (m: number) => void;
  setMerchantToken: (t: string | null) => void;
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

type Choice = { shop: Shop; score: number };
type Matched = { label: string; raw: string; qty: string | null; ai?: Hint | null; cands?: { cat: string | null; list: Choice[] }; pool?: Choice[]; choice?: Choice };

function match(text: string, pick: 'uzman' | 'yakin', hints: Record<string, Hint> = {}): ListItem[] {
  const items = (parseList(text) as Matched[]).slice(0, 15);
  for (const it of items) { it.ai = hints[it.raw] ?? null; it.cands = candidatesFor(it); }
  chooseShops(items, pick);
  return items.map(it => ({
    id: uid(), raw: it.raw, label: it.label, qty: it.qty, cat: it.cands?.cat ?? null,
    shopKey: it.choice ? shopKey(it.choice.shop) : null,
    pool: (it.pool ?? it.cands?.list ?? []).slice(0, 8).map(c => shopKey(c.shop)),
    status: 'todo', price: null, boughtAt: null,
  }));
}

export const useStore = create<State>()(persist((set, get) => ({
  lists: [],
  hints: {},
  location: null,
  calib: null,
  stride: 0.7,
  merchantToken: null,
  createList: (text, title, pick) => {
    const id = uid();
    const list: ShopList = { id, title: title.trim() || 'Alışveriş listesi', createdAt: Date.now(), status: 'planned', pick, items: match(text, pick, get().hints), here: null };
    set({ lists: [list, ...get().lists] });
    // önce kurallarla hemen eşleştir; yapay zekâ ipuçları gelince yeniden eşleştir
    const missing = list.items.map(i => i.raw).filter(r => !get().hints[r]);
    if (missing.length) {
      aiHints(missing).then(hs => {
        const got = Object.fromEntries(hs.flatMap((h, k) => (h ? [[missing[k], h]] : [])));
        if (!Object.keys(got).length) return;
        set({ hints: { ...get().hints, ...got } });
        const l = get().lists.find(x => x.id === id);
        if (l) get().rematch(id, l.pick);
      });
    }
    return id;
  },
  rematch: (id, pick) => set({
    lists: get().lists.map(l => {
      if (l.id !== id) return l;
      const fresh = match(l.items.map(i => i.raw).join('\n'), pick, get().hints);
      // alınmış kalemlerin durumunu koru
      const items = fresh.map((f, k) => (l.items[k] && l.items[k].status !== 'todo' ? { ...l.items[k] } : f));
      return { ...l, pick, items };
    }),
  }),
  nextAlternative: (listId, itemId) => set({
    lists: get().lists.map(l => l.id !== listId ? l : {
      ...l, items: l.items.map(i => {
        if (i.id !== itemId || i.pool.length < 2) return i;
        const k = i.pool.indexOf(i.shopKey ?? '');
        return { ...i, shopKey: i.pool[(k + 1) % i.pool.length] };
      }),
    }),
  }),
  setItem: (listId, itemId, patch) => set({
    lists: get().lists.map(l => l.id !== listId ? l : { ...l, items: l.items.map(i => i.id === itemId ? { ...i, ...patch } : i) }),
  }),
  setList: (listId, patch) => set({ lists: get().lists.map(l => l.id === listId ? { ...l, ...patch } : l) }),
  deleteList: listId => set({ lists: get().lists.filter(l => l.id !== listId) }),
  setLocation: p => set({ location: p ? { ...p, at: Date.now() } : null }),
  setCalib: c => set({ calib: c }),
  setStride: m => set({ stride: m }),
  setMerchantToken: t => set({ merchantToken: t }),
}), { name: 'perpai-v1', storage: createJSONStorage(() => AsyncStorage) }));

export const useList = (id?: string) => useStore(s => s.lists.find(l => l.id === id));

export const listTotals = (l: ShopList) => {
  const bought = l.items.filter(i => i.status === 'bought');
  return {
    bought: bought.length,
    total: l.items.length,
    spent: bought.reduce((a, i) => a + (i.price ?? 0), 0),
    priced: bought.filter(i => i.price != null).length,
    shops: new Set(bought.map(i => i.shopKey)).size,
  };
};

export const tl = (n: number) => '₺' + n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
