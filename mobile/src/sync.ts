// Listeleri sunucuya yedekler (server/sync.js). Hesap kayıt istemez: cihaz ilk açılışta bir hesap ve
// yedek kodu alır; başka telefonda yedek kodu girilince listeler geri gelir. Sunucuya ulaşılamazsa sessizce bekler.
import { API_BASE } from './perpa';
import { useStore, type ShopList } from './store';

async function call<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const r = await fetch(API_BASE + path, { ...init, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || 'Sunucuya ulaşılamadı.');
  return body as T;
}

let timer: ReturnType<typeof setTimeout> | null = null;

async function ensureAccount() {
  const s = useStore.getState();
  if (s.syncToken) return s.syncToken;
  const r = await call<{ token: string; code: string }>('/api/sync/register', { method: 'POST' });
  useStore.getState().setSync(r.token, r.code);
  return r.token;
}

export async function pushNow() {
  const token = await ensureAccount();
  await call('/api/sync/lists', { method: 'PUT', body: JSON.stringify({ lists: useStore.getState().lists }) }, token);
  useStore.getState().setSyncedAt(Date.now());
}

const schedule = () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { pushNow().catch(() => {}); }, 3000);
};

// uygulama açılınca bir kez: hesap yoksa al, listeler değiştikçe yedekle
export function startSync() {
  ensureAccount().then(schedule).catch(() => {});
  return useStore.subscribe((s, prev) => { if (s.lists !== prev.lists) schedule(); });
}

// başka telefondaki yedeği bu telefona getir: sunucudaki listeler + yalnız bu telefonda olanlar
export async function restoreFrom(code: string) {
  const r = await call<{ token: string; code: string }>('/api/sync/restore', { method: 'POST', body: JSON.stringify({ code }) });
  const { lists } = await call<{ lists: ShopList[] }>('/api/sync/lists', {}, r.token);
  const st = useStore.getState();
  const ids = new Set(lists.map(l => l.id));
  st.setSync(r.token, r.code);
  st.replaceLists([...lists, ...st.lists.filter(l => !ids.has(l.id))].sort((a, b) => b.createdAt - a.createdAt));
  await pushNow();
  return lists.length;
}
