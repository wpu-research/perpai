// Esnaf: kapıdaki QR ile dükkânı sahiplen → yönetim onayı → ürün ve fiyat gir (server/merchant.js).
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { API_BASE, parseScanned, type QRPlace } from '@/perpa';
import { tl, useStore } from '@/store';
import { C, font } from '@/theme';
import { Button, Card, Icon } from '@/ui';

type Merchant = { name: string; phone: string; block: string; floor: number; no: number; status: 'pending' | 'approved' | 'rejected' };
type Product = { id: number; name: string; price: number | null; in_stock: boolean };

async function api<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  const r = await fetch(API_BASE + path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || 'Sunucuya ulaşılamadı.');
  return body as T;
}

export default function Esnaf() {
  const token = useStore(s => s.merchantToken);
  const setToken = useStore(s => s.setMerchantToken);
  const [me, setMe] = useState<{ merchant: Merchant; products: Product[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setBusy(true); setErr(null);
    try { setMe(await api('/api/merchant/me', token)); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }, [token]);
  useEffect(() => {
    if (!token) return;
    let alive = true;
    api<{ merchant: Merchant; products: Product[] }>('/api/merchant/me', token)
      .then(r => { if (alive) setMe(r); })
      .catch(e => { if (alive) setErr((e as Error).message); });
    return () => { alive = false; };
  }, [token]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={st.wrap} keyboardShouldPersistTaps="handled">
        {!token ? <Claim onDone={setToken} /> : !me ? (
          <Card style={{ gap: 10 }}>
            <Text style={font.small}>{busy ? 'Yükleniyor…' : err ?? ''}</Text>
            {err ? <Button title="Tekrar dene" kind="secondary" onPress={load} /> : null}
          </Card>
        ) : (
          <>
            <Card style={{ gap: 6 }}>
              <Text style={font.small}>{me.merchant.block} Blok · {me.merchant.floor}. kat · No {me.merchant.no}</Text>
              <Text style={font.h2}>{me.merchant.name}</Text>
              <Status s={me.merchant.status} />
            </Card>
            {me.merchant.status === 'pending' ? (
              <Card style={{ gap: 10 }}>
                <Text style={font.body}>Başvurun Perpa yönetimine ulaştı. Yönetim {me.merchant.phone} numarasını arayıp dükkânın sana ait olduğunu doğrulayınca ürün ekleyebileceksin.</Text>
                <Button title="Durumu yenile" icon="refresh" kind="secondary" onPress={load} disabled={busy} />
              </Card>
            ) : me.merchant.status === 'rejected' ? (
              <Card style={{ gap: 10 }}>
                <Text style={font.body}>Başvuru onaylanmadı. Bilgileri kontrol edip yeniden başvurabilirsin.</Text>
                <Button title="Yeniden başvur" kind="secondary" onPress={() => { setToken(null); setMe(null); }} />
              </Card>
            ) : (
              <Products token={token} products={me.products} reload={load} />
            )}
            {err ? <Text style={st.err}>{err}</Text> : null}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Status({ s }: { s: Merchant['status'] }) {
  const m = { pending: ['clock-outline', 'Onay bekliyor', '#8A5A00', '#FFF1D6'], approved: ['check-circle', 'Onaylı', C.okText, C.okBg], rejected: ['close-circle', 'Onaylanmadı', '#B3261E', '#FDE3E1'] }[s] as [string, string, string, string];
  return (
    <View style={[st.badge, { backgroundColor: m[3] }]}>
      <Icon name={m[0] as never} size={16} color={m[2]} /><Text style={{ color: m[2], fontWeight: '700', fontSize: 13 }}>{m[1]}</Text>
    </View>
  );
}

function Claim({ onDone }: { onDone: (t: string) => void }) {
  const [perm, requestPerm] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [door, setDoor] = useState<QRPlace | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const take = (text: string) => {
    const q = parseScanned(text) as QRPlace | null;
    if (!q || q.kind !== 'kapi') { setErr('Bu bir dükkân kapısı QR’ı değil.'); return; }
    setDoor(q); setScanning(false); setErr(null);
  };
  const submit = async () => {
    if (!door) return;
    setBusy(true); setErr(null);
    try {
      const r = await api<{ token: string }>('/api/merchant/claim', null, { method: 'POST', body: JSON.stringify({ code: door.code, name, phone }) });
      onDone(r.token);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <View style={{ gap: 14 }}>
      <Text style={font.h1}>Dükkânını sahiplen</Text>
      <Text style={font.body}>Ürünlerini girdiğinde, listesinde o ürün olan ziyaretçiler doğrudan senin dükkânına yönlendirilir.</Text>
      <Card style={{ gap: 10 }}>
        <Text style={font.h2}>1 · Kapındaki QR</Text>
        {door ? (
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Icon name="check-circle" color={C.okText} /><Text style={[font.body, { flex: 1 }]}>{door.label}</Text>
            <Pressable accessibilityRole="button" onPress={() => setDoor(null)}><Text style={{ color: C.routeText, fontWeight: '700' }}>Değiştir</Text></Pressable>
          </View>
        ) : scanning && perm?.granted ? (
          <View style={st.cam}>
            <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => take(data)} />
          </View>
        ) : (
          <>
            <Button title="QR’ı kamerayla okut" icon="qrcode-scan" onPress={async () => { if (!perm?.granted) await requestPerm(); setScanning(true); }} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput value={code} onChangeText={setCode} placeholder="ya da kod: D-A11-1350" placeholderTextColor={C.muted} autoCapitalize="characters" autoCorrect={false} style={[st.input, { flex: 1 }]} accessibilityLabel="Kapı kodu" />
              <Button title="Tamam" small kind="secondary" onPress={() => code.trim() && take(code.trim())} />
            </View>
          </>
        )}
      </Card>
      <Card style={{ gap: 10, opacity: door ? 1 : 0.5 }}>
        <Text style={font.h2}>2 · Bilgilerin</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Firma ya da ad soyad" placeholderTextColor={C.muted} style={st.input} editable={!!door} accessibilityLabel="Firma ya da ad soyad" />
        <TextInput value={phone} onChangeText={setPhone} placeholder="Telefon (yönetim arayıp doğrular)" placeholderTextColor={C.muted} keyboardType="phone-pad" style={st.input} editable={!!door} accessibilityLabel="Telefon" />
        <Button title="Başvuruyu gönder" icon="send" onPress={submit} disabled={!door || name.trim().length < 3 || phone.replace(/\D/g, '').length < 10 || busy} />
      </Card>
      {err ? <Text style={st.err}>{err}</Text> : null}
    </View>
  );
}

function Products({ token, products, reload }: { token: string; products: Product[]; reload: () => void }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const add = async () => {
    setErr(null);
    const p = parseFloat(price.replace(/\./g, '').replace(',', '.'));
    try {
      await api('/api/merchant/products', token, { method: 'POST', body: JSON.stringify({ name, price: Number.isFinite(p) ? p : null }) });
      setName(''); setPrice(''); reload();
    } catch (e) { setErr((e as Error).message); }
  };
  const remove = async (id: number) => {
    try { await api(`/api/merchant/products/${id}`, token, { method: 'DELETE' }); reload(); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <>
      <Card style={{ gap: 10 }}>
        <Text style={font.h2}>Ürün ekle</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Ürün adı (ör. POS rulosu 57 mm)" placeholderTextColor={C.muted} style={st.input} accessibilityLabel="Ürün adı" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput value={price} onChangeText={setPrice} placeholder="Fiyat ₺ (isteğe bağlı)" placeholderTextColor={C.muted} keyboardType="decimal-pad" style={[st.input, { flex: 1 }]} accessibilityLabel="Fiyat" />
          <Button title="Ekle" icon="plus" onPress={add} disabled={name.trim().length < 2} />
        </View>
        {err ? <Text style={st.err}>{err}</Text> : null}
      </Card>
      <Text style={font.small}>{products.length} ürün · ziyaretçinin listesinde geçen ürünler seni öne çıkarır</Text>
      {products.map(p => (
        <View key={p.id} style={st.row}>
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: C.ink }}>{p.name}</Text>
          {p.price != null ? <Text style={font.small}>{tl(p.price)}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={`${p.name} sil`} onPress={() => remove(p.id)} style={{ padding: 8 }}><Icon name="trash-can-outline" color={C.muted} /></Pressable>
        </View>
      ))}
    </>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 20, gap: 14, paddingBottom: 40 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.card, paddingHorizontal: 12, fontSize: 15, color: C.ink },
  cam: { height: 260, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' },
  err: { color: '#B3261E', fontSize: 13.5 },
  badge: { flexDirection: 'row', gap: 6, alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingLeft: 14, minHeight: 52 },
});
