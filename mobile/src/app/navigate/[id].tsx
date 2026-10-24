import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { FloorMap, boxOf } from '@/FloorMap';
import { EXIT, shopName, shopWhere, type Place } from '@/perpa';
import { planFor, rideIcon, startOf, stepsOf, type Segment } from '@/route';
import { useList, useStore } from '@/store';
import { C, font } from '@/theme';
import { Button, Card, Icon, ZoneChip, type IconName } from '@/ui';

type Walk = Extract<Segment, { type: 'walk' }>;

export default function Navigate() {
  const { id, arrived } = useLocalSearchParams<{ id: string; arrived?: string }>();
  const list = useList(id);
  const location = useStore(s => s.location);
  const { setItem, setList } = useStore();
  const [shopping, setShopping] = useState(arrived === '1');
  // kamerayla yürüyüşten "vardım" ile dönüldüyse alışveriş satırlarını aç
  const [prevArrived, setPrevArrived] = useState(arrived);
  if (arrived !== prevArrived) { setPrevArrived(arrived); if (arrived === '1') setShopping(true); }

  const here: Place | null = list ? startOf(list, location) : null;
  const plan = useMemo(() => (list && here ? planFor(list, here) : null), [list, here]);
  const leg = plan?.legs[0] ?? null;
  const stop = leg && plan && leg.toStop != null ? plan.stops[leg.toStop] : null;

  // bacağın geçtiği katlar (yürüme parçalarının sırasıyla)
  const floors = useMemo(() => {
    if (!leg) return [] as number[];
    const f: number[] = [];
    for (const s of leg.segments) if (s.type === 'walk' && !s.transfer && !f.includes(s.floor)) f.push(s.floor);
    return f.length ? f : [leg.fromFloor];
  }, [leg]);
  const [viewFloor, setViewFloor] = useState<number | null>(null);
  const legKey = `${leg?.toStop}|${here?.x}|${here?.z}|${here?.floor}`;
  const [prevLeg, setPrevLeg] = useState(legKey);
  if (legKey !== prevLeg) { setPrevLeg(legKey); setViewFloor(null); setShopping(false); }
  const floor = viewFloor ?? floors[0] ?? here?.floor ?? 8;

  if (!list || !plan || !leg || !here) return null;

  const paths = (leg.segments.filter(s => s.type === 'walk' && s.floor === floor) as Walk[]).map(s => s.pts);
  const target = stop ? { x: stop.x, z: stop.z, floor: stop.floor } : EXIT;
  const markers = [
    ...(here.floor === floor ? [{ x: here.x, z: here.z, color: C.route, kind: 'me' as const }] : []),
    ...(target.floor === floor ? [{ x: target.x, z: target.z, color: stop ? C.brand : C.ink, label: stop ? '1' : 'Ç' }] : []),
  ];
  const focus = boxOf([...paths.flat(), ...markers.map(m => [m.x, m.z] as [number, number])]);
  const steps = stepsOf(leg, stop ? `No ${stop.shop.no} · ${shopName(stop.shop)}` : 'Ana giriş · çıkış');
  const remaining = plan.stops.length;

  const finishExit = () => {
    setList(list.id, { status: 'done', here: null });
    router.replace(`/list/${list.id}`);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={st.wrap} keyboardShouldPersistTaps="handled">
        <Card dark style={st.instr}>
          <View style={st.instrIcon}><Icon name={(steps[0]?.ride ? 'swap-vertical' : 'arrow-up-bold') as IconName} size={26} color="#FFFFFF" /></View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: C.mutedOnDark, fontSize: 12.5, fontWeight: '600' }}>{steps[0]?.dist ?? ''}</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800' }}>{steps[0]?.text}</Text>
            {steps[1] ? <Text style={{ color: '#C9D3E0', fontSize: 12.5 }} numberOfLines={2}>Sonra: {steps[1].text}</Text> : null}
          </View>
        </Card>

        <Button title="Kamerayla yürü · sesli yönlendirme" icon="camera-outline" kind="dark" onPress={() => router.push({ pathname: '/ar/[id]', params: { id: list.id } })} />

        <View style={st.where}>
          <Icon name="crosshairs-gps" size={16} color={C.route} />
          <Text style={[font.small, { flex: 1 }]} numberOfLines={1}>Konum: {here.label}{here.source === 'qr' ? ' · QR' : ''}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/qr', params: { list: list.id } })} style={st.qrBtn}>
            <Icon name="qrcode-scan" size={16} color={C.routeText} /><Text style={{ color: C.routeText, fontWeight: '700', fontSize: 13 }}>QR okut</Text>
          </Pressable>
        </View>

        {floors.length > 1 ? (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {floors.map(f => (
              <Pressable key={f} accessibilityRole="button" onPress={() => setViewFloor(f)} style={[st.fTab, f === floor && st.fTabOn]}>
                <Text style={{ fontWeight: '700', color: f === floor ? '#FFFFFF' : C.ink }}>{f}. kat</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <FloorMap floor={floor} paths={paths} markers={markers} focus={focus} highlight={stop?.key ?? null} height={280} />

        <Card style={{ gap: 0, paddingVertical: 6 }}>
          {steps.map((s, i) => (
            <View key={i} style={[st.step, i === steps.length - 1 && { borderBottomWidth: 0 }]}>
              <Icon name={(s.final ? 'flag-checkered' : s.ride ? rideIcon(s.text.includes('asansör') ? 'elevator' : s.text.includes('Yürüyen') ? 'escalator' : 'stairs') : 'walk') as IconName} size={17} color={s.final ? C.brand : C.muted} />
              <Text style={{ flex: 1, fontSize: 13.5, color: C.ink, fontWeight: s.final || s.ride ? '700' : '500' }}>{s.text}</Text>
              {s.dist ? <Text style={font.tiny}>{s.dist}</Text> : null}
            </View>
          ))}
        </Card>

        {stop ? (
          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: C.routeText, fontWeight: '800', fontSize: 12, letterSpacing: 1.2 }}>SIRADAKİ DÜKKÂN · {remaining} kaldı</Text>
              <Text style={font.tiny}>{Math.round(leg.length)} m</Text>
            </View>
            <Text style={font.h2}>{shopName(stop.shop)}</Text>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Text style={font.small}>{shopWhere(stop.shop)}</Text><ZoneChip zone={stop.shop.slot.zone} /></View>
            {shopping
              ? <Shopping key={stop.key} items={stop.items} onDone={(rows) => {
                  for (const r of rows) setItem(list.id, r.id, r.take ? { status: 'bought', price: r.price, boughtAt: Date.now() } : { status: 'skipped' });
                  setList(list.id, { here: { x: stop.x, z: stop.z, floor: stop.floor, heading: 0, label: shopWhere(stop.shop), source: 'durak' } });
                }} />
              : <>
                  <Text style={font.small}>{stop.items.map(i => i.label + (i.qty ? ` × ${i.qty}` : '')).join(' · ')}</Text>
                  <Button title="Vardım" icon="check" onPress={() => setShopping(true)} />
                </>}
          </Card>
        ) : (
          <Card style={{ gap: 10 }}>
            <Text style={font.h2}>Liste tamam</Text>
            <Text style={font.small}>Ana girişe dönüş: {Math.round(leg.length)} m. Harcamaların “Listelerim”de.</Text>
            <Button title="Çıktım, listeyi kapat" icon="exit-run" onPress={finishExit} />
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type Row = { id: string; label: string; qty: string | null; take: boolean; price: number | null; text: string };

function Shopping({ items, onDone }: { items: { id: string; label: string; qty: string | null }[]; onDone: (rows: Row[]) => void }) {
  const [rows, setRows] = useState<Row[]>(() => items.map(i => ({ id: i.id, label: i.label, qty: i.qty, take: true, price: null, text: '' })));
  const set = (k: number, p: Partial<Row>) => setRows(r => r.map((x, i) => (i === k ? { ...x, ...p } : x)));
  return (
    <View style={{ gap: 8 }}>
      {rows.map((r, k) => (
        <View key={r.id} style={st.shopRow}>
          <Switch value={r.take} onValueChange={v => set(k, { take: v })} trackColor={{ true: C.ok }} accessibilityLabel={`${r.label} alındı`} />
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: r.take ? C.ink : C.muted }}>{r.label}{r.qty ? ` × ${r.qty}` : ''}</Text>
          <View style={st.price}>
            <Text style={{ color: C.muted, fontWeight: '700' }}>₺</Text>
            <TextInput value={r.text} editable={r.take} keyboardType="decimal-pad" placeholder="Fiyat" placeholderTextColor={C.muted} accessibilityLabel={`${r.label} fiyatı`}
              onChangeText={t => { const n = parseFloat(t.replace(/\./g, '').replace(',', '.')); set(k, { text: t, price: Number.isFinite(n) ? n : null }); }}
              style={{ flex: 1, fontSize: 15, color: C.ink, paddingVertical: 8 }} />
          </View>
        </View>
      ))}
      <Text style={font.tiny}>Fiyat isteğe bağlı; girersen aylık harcamana eklenir. Alınmayanlar “atlandı” olur, listeden geri alabilirsin.</Text>
      <Button title="Kaydet · sıradaki dükkân" icon="arrow-right" onPress={() => onDone(rows)} />
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 14, gap: 10, paddingBottom: 40 },
  instr: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  instrIcon: { width: 50, height: 50, borderRadius: 14, backgroundColor: C.route, alignItems: 'center', justifyContent: 'center' },
  where: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  qrBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#DFF4FA' },
  fTab: { minHeight: 40, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, justifyContent: 'center' },
  fTabOn: { backgroundColor: C.ink, borderColor: C.ink },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  price: { width: 110, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 10, paddingHorizontal: 10, minHeight: 44 },
});
