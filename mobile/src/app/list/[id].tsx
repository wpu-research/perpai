import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { shopByKey, shopName } from '@/perpa';
import { listTotals, tl, useList, useStore, type ListItem } from '@/store';
import { C, font } from '@/theme';
import { Button, Card, Icon, Segmented, Stat, ZoneChip } from '@/ui';

export default function ListDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const list = useList(id);
  const { rematch, nextAlternative, setItem, deleteList } = useStore();
  if (!list) return <View style={{ flex: 1, padding: 20 }}><Text style={font.body}>Liste bulunamadı.</Text></View>;
  const t = listTotals(list);
  const bought = list.items.filter(i => i.status === 'bought');
  const todo = list.items.filter(i => i.status === 'todo');
  const skipped = list.items.filter(i => i.status === 'skipped');
  const unmatched = todo.filter(i => !i.shopKey);

  const remove = () => Alert.alert('Liste silinsin mi?', list.title, [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Sil', style: 'destructive', onPress: () => { deleteList(list.id); router.back(); } },
  ]);

  return (
    <>
      <Stack.Screen options={{ title: list.title, headerRight: () => (
        <Pressable accessibilityRole="button" accessibilityLabel="Listeyi sil" onPress={remove} hitSlop={12}><Icon name="trash-can-outline" /></Pressable>
      ) }} />
      <ScrollView contentContainerStyle={st.wrap}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Stat value={`${t.bought}/${t.total}`} label="alındı" />
          <Stat value={t.priced ? tl(t.spent) : '—'} label="harcanan" />
          <Stat value={String(new Set(todo.filter(i => i.shopKey).map(i => i.shopKey)).size)} label="dükkân kaldı" />
        </View>

        {list.status !== 'done' ? (
          <Segmented value={list.pick} onChange={v => rematch(list.id, v)} options={[{ v: 'uzman', label: 'Uzman firma' }, { v: 'yakin', label: 'En kısa rota' }]} />
        ) : null}

        {todo.length ? <Text style={st.section}>ALINACAK</Text> : null}
        {todo.map(i => <ItemRow key={i.id} item={i}
          onAlt={i.pool.length > 1 ? () => nextAlternative(list.id, i.id) : undefined}
          onToggle={() => setItem(list.id, i.id, { status: 'skipped' })} toggleIcon="close" toggleLabel="Atla" />)}
        {unmatched.length ? <Text style={font.tiny}>Eşleşmeyen kalemler rotaya girmez; adı değiştirip yeni liste oluşturabilir ya da dükkân numarası yazabilirsin.</Text> : null}

        {bought.length ? <Text style={st.section}>ALINDI</Text> : null}
        {bought.map(i => <ItemRow key={i.id} item={i} done onToggle={() => setItem(list.id, i.id, { status: 'todo', boughtAt: null })} toggleIcon="undo" toggleLabel="Geri al" />)}

        {skipped.length ? <Text style={st.section}>ATLANAN</Text> : null}
        {skipped.map(i => <ItemRow key={i.id} item={i} muted onToggle={() => setItem(list.id, i.id, { status: 'todo' })} toggleIcon="undo" toggleLabel="Geri al" />)}

        {todo.some(i => i.shopKey) ? (
          <Button title="Rotayı çiz" icon="map-marker-path" onPress={() => router.push(`/route/${list.id}`)} style={{ marginTop: 6 }} />
        ) : list.status !== 'done' && list.items.length ? (
          <Card style={{ gap: 6 }}><Text style={font.h2}>Liste tamam</Text><Text style={font.small}>Alınacak kalem kalmadı.</Text></Card>
        ) : null}
      </ScrollView>
    </>
  );
}

function ItemRow({ item, done, muted, onAlt, onToggle, toggleIcon, toggleLabel }: {
  item: ListItem; done?: boolean; muted?: boolean; onAlt?: () => void; onToggle: () => void; toggleIcon: 'close' | 'undo'; toggleLabel: string;
}) {
  const shop = shopByKey(item.shopKey);
  return (
    <Card style={[st.row, muted && { opacity: 0.6 }]}>
      <View style={[st.box, done && { backgroundColor: C.ok, borderColor: C.ok }]}>{done ? <Icon name="check" size={15} color="#FFFFFF" /> : null}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: C.ink }}>{item.label}{item.qty ? <Text style={{ fontWeight: '500', color: C.muted }}>  × {item.qty}</Text> : null}</Text>
        {shop ? (
          <>
            <Text style={{ fontSize: 12.5, color: C.ink }} numberOfLines={1}>{shopName(shop)}</Text>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Text style={font.tiny}>{shop.block} {shop.floor}. kat · No {shop.no}</Text><ZoneChip zone={shop.slot.zone} short />
            </View>
          </>
        ) : <Text style={{ fontSize: 12.5, color: '#B3261E' }}>Eşleşen dükkân bulunamadı</Text>}
      </View>
      {done ? <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>{item.price != null ? tl(item.price) : '—'}</Text> : null}
      {onAlt ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Başka dükkân öner" onPress={onAlt} style={st.iconBtn}><Icon name="swap-horizontal" size={19} /></Pressable>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel={toggleLabel} onPress={onToggle} style={st.iconBtn}><Icon name={toggleIcon} size={18} color={C.muted} /></Pressable>
    </Card>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 16, gap: 10, paddingBottom: 40 },
  section: { fontSize: 12.5, fontWeight: '700', letterSpacing: 1, color: C.muted, marginTop: 8, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#B4BFCC', alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: '#F7F9FB', alignItems: 'center', justifyContent: 'center' },
});
