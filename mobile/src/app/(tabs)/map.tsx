import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FloorMap } from '@/FloorMap';
import { DB, FLOORS, searchShops, shopByKey, shopKey, shopName, shopWhere, type Firm, type Shop } from '@/perpa';
import { useStore } from '@/store';
import { C, font } from '@/theme';
import { Button, Card, Icon, ZoneChip } from '@/ui';

export default function MapTab() {
  const params = useLocalSearchParams<{ shop?: string; sector?: string }>();
  const location = useStore(s => s.location);
  const createList = useStore(s => s.createList);
  const [sel, setSel] = useState<string | null>(params.shop ?? null);
  const [floor, setFloor] = useState(() => shopByKey(params.shop)?.floor ?? location?.floor ?? 8);
  const [q, setQ] = useState('');
  const sectorId = params.sector ? Number(params.sector) : null;

  // başka ekrandan yeni bir dükkânla gelindiyse seçimi güncelle
  const [prevShop, setPrevShop] = useState(params.shop);
  if (params.shop !== prevShop) {
    setPrevShop(params.shop);
    if (params.shop) { setSel(params.shop); const s = shopByKey(params.shop); if (s) setFloor(s.floor); }
  }

  const list: Shop[] = useMemo(() => {
    if (q.trim().length >= 2) return searchShops(q, 30);
    if (sectorId != null) {
      return (DB.firms as (Firm & { shop?: Shop })[]).filter(f => f.s.includes(sectorId) && f.shop).map(f => f.shop as Shop)
        .sort((a, b) => a.floor - b.floor || a.no - b.no);
    }
    return [];
  }, [q, sectorId]);
  const selected = shopByKey(sel);
  const onFloor = list.filter(s => s.floor === floor).length;

  const goTo = (s: Shop) => {
    const id = createList(`${s.block} ${s.no}`, shopName(s), 'yakin');
    router.push(`/route/${id}`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.ground }} edges={['top']}>
      <ScrollView contentContainerStyle={st.wrap} keyboardShouldPersistTaps="handled">
        <Text style={font.h1}>Kat planı</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {Array.from({ length: FLOORS }, (_, i) => FLOORS - i).map(f => {
            const has = list.some(s => s.floor === f);
            return (
              <Pressable key={f} accessibilityRole="button" accessibilityLabel={`${f}. kat`} onPress={() => setFloor(f)}
                style={[st.fl, f === floor && st.flOn, has && f !== floor && st.flHas]}>
                <Text style={[st.flText, f === floor && { color: '#FFFFFF' }]}>{f}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <FloorMap floor={floor} height={250} highlight={sel}
          markers={location && location.floor === floor ? [{ x: location.x, z: location.z, color: C.route, kind: 'me' }] : []} />
        <View style={st.legend}>
          <ZoneChip zone="KIRMIZI" /><ZoneChip zone="SARI" /><ZoneChip zone="MAVI" /><ZoneChip zone="YESIL" />
          <Text style={font.tiny}>{floor}. kat · {floor <= 3 ? 'garaj katı' : floor === 8 ? 'ana giriş katı' : ''}</Text>
        </View>

        {selected ? (
          <Card style={{ gap: 8 }}>
            <Text style={font.h2}>{shopName(selected)}</Text>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Text style={font.small}>{shopWhere(selected)}</Text><ZoneChip zone={selected.slot.zone} /></View>
            <Button title="Buraya git" icon="navigation-variant" onPress={() => goTo(selected)} />
          </Card>
        ) : null}

        <View style={st.search}>
          <Icon name="magnify" color={C.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Firma ya da dükkân no ara" placeholderTextColor={C.muted} style={{ flex: 1, fontSize: 15, color: C.ink, paddingVertical: 12 }} accessibilityLabel="Haritada ara" autoCorrect={false} />
        </View>
        {sectorId != null && !q ? <Text style={font.small}>{DB.sectors[sectorId]} · {list.length} firma · bu katta {onFloor}</Text> : null}
        {list.slice(0, 60).map(s => (
          <Pressable key={shopKey(s)} accessibilityRole="button" onPress={() => { setSel(shopKey(s)); setFloor(s.floor); }} style={[st.row, sel === shopKey(s) && { borderColor: C.brand }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }} numberOfLines={1}>{shopName(s)}</Text>
              <Text style={font.small}>{shopWhere(s)}</Text>
            </View>
            <ZoneChip zone={s.slot.zone} short />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 20, gap: 12, paddingBottom: 40 },
  fl: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  flOn: { backgroundColor: C.ink, borderColor: C.ink },
  flHas: { backgroundColor: '#DFF4FA', borderColor: '#9FD2E2' },
  flText: { fontWeight: '700', color: C.ink },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.lineStrong },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 12 },
});
