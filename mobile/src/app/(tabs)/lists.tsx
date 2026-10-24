import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DB, shopByKey } from '@/perpa';
import { listTotals, tl, useStore, type ShopList } from '@/store';
import { C, ZONE, font } from '@/theme';
import { Button, Card, Progress, Segmented } from '@/ui';

const STATUS = {
  active: { label: 'Devam ediyor', bg: C.warnBg, fg: C.warnText, bar: C.brand },
  planned: { label: 'Planlandı', bg: '#DFF4FA', fg: C.routeText, bar: C.route },
  done: { label: 'Tamamlandı', bg: C.okBg, fg: C.okText, bar: C.ok },
} as const;
const BAR = [ZONE.KIRMIZI.color, ZONE.MAVI.color, ZONE.YESIL.color, ZONE.SARI.color, C.muted];

export default function Lists() {
  const lists = useStore(s => s.lists);
  const [tab, setTab] = useState<'all' | 'todo' | 'done'>('all');
  const shown = lists.filter(l => tab === 'all' || (tab === 'done' ? l.status === 'done' : l.status !== 'done'));

  // bu ayın özeti: alınan kalemler, harcama, ziyaret edilen dükkânlar, sektör dağılımı
  const month = useMemo(() => {
    const now = new Date(), start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const items = lists.flatMap(l => l.items).filter(i => i.status === 'bought' && (i.boughtAt ?? 0) >= start);
    const sectors = new Map<string, number>();
    for (const i of items) {
      // önce eşleşmenin kategorisi (ör. "Güvenlik sistemleri"), yoksa firmanın rehberdeki ilk sektörü
      const sid = shopByKey(i.shopKey)?.firm?.s[0];
      const name = i.cat ?? (sid ? DB.sectors[sid] : 'Diğer');
      sectors.set(name, (sectors.get(name) ?? 0) + 1);
    }
    return {
      label: now.toLocaleDateString('tr-TR', { month: 'long' }),
      spent: items.reduce((a, i) => a + (i.price ?? 0), 0),
      count: items.length,
      shops: new Set(items.map(i => i.shopKey)).size,
      visits: new Set(items.map(i => new Date(i.boughtAt ?? 0).toDateString())).size,
      sectors: [...sectors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [lists]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.ground }} edges={['top']}>
      <ScrollView contentContainerStyle={st.wrap}>
        <View style={st.head}>
          <Text style={font.h1}>Listelerim</Text>
          <Button title="Yeni liste" icon="plus" small onPress={() => router.push('/list/new')} />
        </View>

        <Card dark style={{ gap: 12, padding: 16 }}>
          <Text style={{ color: C.mutedOnDark, fontWeight: '600', fontSize: 13 }}>{month.label.charAt(0).toLocaleUpperCase('tr-TR') + month.label.slice(1)} · Perpa harcaman</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '800' }}>{tl(month.spent)}</Text>
          <View style={{ flexDirection: 'row' }}>
            {[[month.visits, 'ziyaret'], [month.count, 'ürün alındı'], [month.shops, 'dükkân']].map(([v, l]) => (
              <View key={l as string} style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '800' }}>{v}</Text>
                <Text style={{ color: '#C9D3E0', fontSize: 12 }}>{l}</Text>
              </View>
            ))}
          </View>
          {month.sectors.length ? (
            <>
              <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' }} accessibilityElementsHidden>
                {month.sectors.map(([n, c], i) => <View key={n} style={{ flex: c, backgroundColor: BAR[i % BAR.length] }} />)}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {month.sectors.map(([n, c]) => <Text key={n} style={{ color: '#C9D3E0', fontSize: 11.5 }}>{n === n.toLocaleUpperCase('tr-TR') ? n.charAt(0) + n.slice(1).toLocaleLowerCase('tr-TR') : n} {c}</Text>)}
              </View>
            </>
          ) : <Text style={{ color: '#C9D3E0', fontSize: 12.5 }}>Bu ay henüz alım yok. Dükkânda “alındı” deyip fiyatı girdiğinde burada toplanır.</Text>}
        </Card>

        <Segmented value={tab} onChange={setTab} options={[{ v: 'all', label: 'Tümü' }, { v: 'todo', label: 'Alınacak' }, { v: 'done', label: 'Geçmiş' }]} />

        {shown.length ? shown.map(l => <ListCard key={l.id} list={l} />) : (
          <Card style={{ gap: 6 }}>
            <Text style={font.h2}>Henüz liste yok</Text>
            <Text style={font.small}>Yeni bir liste oluştur; ne alacağını, ne aldığını ve ne kadar tuttuğunu burada takip et.</Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ListCard({ list }: { list: ShopList }) {
  const t = listTotals(list), S = STATUS[list.status];
  const date = new Date(list.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(`/list/${list.id}`)}>
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Text style={[font.h2, { flex: 1 }]} numberOfLines={1}>{list.title}</Text>
          <View style={{ backgroundColor: S.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ color: S.fg, fontSize: 11, fontWeight: '700' }}>{S.label}</Text></View>
        </View>
        <Progress value={t.total ? t.bought / t.total : 0} color={S.bar} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={font.small}>{t.bought}/{t.total} alındı · {date}</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>{t.priced ? tl(t.spent) : '—'}</Text>
        </View>
      </Card>
    </Pressable>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 20, gap: 14, paddingBottom: 40 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
