import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EXIT, searchShops, sectorStats, shopKey, shopName, shopWhere } from '@/perpa';
import { listTotals, tl, useStore } from '@/store';
import { C, ZONE, font } from '@/theme';
import { Button, Card, Icon, Progress, ZoneChip } from '@/ui';

const SECTOR_COLORS = [ZONE.KIRMIZI.color, ZONE.MAVI.color, ZONE.YESIL.color, ZONE.SARI.color, C.muted, C.brand];

export default function Home() {
  const location = useStore(s => s.location);
  const lists = useStore(s => s.lists);
  const [q, setQ] = useState('');
  const results = useMemo(() => searchShops(q, 8), [q]);
  const sectors = useMemo(() => sectorStats().filter(s => s.name !== 'Diğer').slice(0, 6), []);
  const recent = lists.find(l => l.status !== 'done') ?? lists[0];
  const here = location ?? EXIT;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.ground }} edges={['top']}>
      <ScrollView contentContainerStyle={st.wrap} keyboardShouldPersistTaps="handled">
        <View style={st.top}>
          <Text style={st.logo}>Perp<Text style={{ color: C.brand }}>AI</Text></Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Konumu QR ile değiştir" onPress={() => router.push('/qr')} style={st.loc}>
            <Icon name="map-marker-outline" size={16} />
            <Text style={st.locText} numberOfLines={1}>{location ? here.label : '8. kat · Ana giriş'}</Text>
            <Icon name="qrcode-scan" size={15} color={C.routeText} />
          </Pressable>
        </View>

        <Text style={st.h1}>Perpa’da ne arıyorsun?</Text>
        <View style={st.search}>
          <Icon name="magnify" color={C.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Firma adı ya da dükkân no (B 1450)" placeholderTextColor={C.muted}
            style={st.searchInput} accessibilityLabel="Ara" autoCorrect={false} />
        </View>
        {results.length ? (
          <Card style={{ paddingVertical: 4 }}>
            {results.map(s => (
              <Pressable key={shopKey(s)} accessibilityRole="button" onPress={() => router.push({ pathname: '/map', params: { shop: shopKey(s) } })} style={st.res}>
                <View style={{ flex: 1 }}>
                  <Text style={st.resName} numberOfLines={1}>{shopName(s)}</Text>
                  <Text style={font.small}>{shopWhere(s)}</Text>
                </View>
                <ZoneChip zone={s.slot.zone} short />
              </Pressable>
            ))}
          </Card>
        ) : null}

        <Card dark style={{ gap: 14, padding: 18 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={st.ctaTitle}>Listeni gir, rotanı al</Text>
              <Text style={st.ctaText}>Ürünleri yaz ya da yapıştır; PerpAI dükkânları bulsun, en kısa rotayı çizsin, ne kadar tuttuğunu kaydetsin.</Text>
            </View>
            <View style={st.ctaIcon}><Icon name="format-list-checks" size={26} color="#FFB27A" /></View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Yeni liste" icon="plus" onPress={() => router.push('/list/new')} style={{ flex: 1 }} />
            <Button title="QR okut" icon="qrcode-scan" kind="onDark" onPress={() => router.push('/qr')} />
          </View>
        </Card>

        <View style={{ gap: 10 }}>
          <Text style={font.h2}>Popüler sektörler</Text>
          <View style={st.grid}>
            {sectors.map((s, i) => (
              <Pressable key={s.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/map', params: { sector: String(s.id) } })} style={st.sector}>
                <View style={[st.sectorBar, { backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length] }]} />
                <Text style={st.sectorName} numberOfLines={2}>{s.name.charAt(0) + s.name.slice(1).toLocaleLowerCase('tr-TR')}</Text>
                <Text style={st.sectorCount}>{s.count}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {recent ? (() => {
          const t = listTotals(recent);
          return (
            <Pressable accessibilityRole="button" onPress={() => router.push(`/list/${recent.id}`)}>
              <Card style={{ gap: 8 }}>
                <Text style={font.small}>Son listen</Text>
                <Text style={font.h2}>{recent.title}</Text>
                <Progress value={t.total ? t.bought / t.total : 0} />
                <Text style={font.small}>{t.bought}/{t.total} alındı{t.priced ? ` · ${tl(t.spent)}` : ''}</Text>
              </Card>
            </Pressable>
          );
        })() : null}

        <Pressable accessibilityRole="button" onPress={() => router.push('/esnaf')}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon name="storefront-outline" size={26} color={C.brand} />
            <View style={{ flex: 1 }}>
              <Text style={font.h2}>Perpa esnafı mısın?</Text>
              <Text style={font.small}>Dükkânını sahiplen, ürünlerini gir; listelerde öne çık.</Text>
            </View>
            <Icon name="chevron-right" color={C.muted} />
          </Card>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 20, gap: 16, paddingBottom: 40 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  logo: { fontSize: 26, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },
  loc: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.card },
  locText: { flexShrink: 1, fontSize: 13, fontWeight: '600', color: C.ink },
  h1: { fontSize: 28, fontWeight: '800', color: C.ink, letterSpacing: -0.6 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 16, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.lineStrong },
  searchInput: { flex: 1, fontSize: 15, color: C.ink, paddingVertical: 12 },
  res: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  resName: { fontSize: 14, fontWeight: '700', color: C.ink },
  ctaTitle: { fontSize: 21, fontWeight: '800', color: '#FFFFFF' },
  ctaText: { fontSize: 14, lineHeight: 20, color: '#C9D3E0' },
  ctaIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: C.ink2, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sector: { width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  sectorBar: { width: 8, height: 28, borderRadius: 4 },
  sectorName: { flex: 1, fontSize: 13, fontWeight: '600', color: C.ink },
  sectorCount: { fontSize: 12, fontWeight: '600', color: C.muted },
});
