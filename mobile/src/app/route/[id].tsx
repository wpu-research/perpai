import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { shopName } from '@/perpa';
import { etaMinutes, floorsOf, planFor, rideIcon, startOf, walkLength } from '@/route';
import { useList, useStore } from '@/store';
import { C, ZONE, font } from '@/theme';
import { Button, Card, Icon, Stat, type IconName } from '@/ui';

export default function RouteSummary() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const list = useList(id);
  const location = useStore(s => s.location);
  const setList = useStore(s => s.setList);
  const start = list ? startOf(list, location) : null;
  const plan = useMemo(() => (list && start ? planFor(list, start) : null), [list, start]);
  if (!list || !plan || !start) return null;

  const go = () => {
    setList(list.id, { status: 'active', here: list.here ?? start });
    router.replace(`/navigate/${list.id}`);
  };

  return (
    <ScrollView contentContainerStyle={st.wrap}>
      <Card dark style={{ gap: 14 }}>
        <Text style={{ color: '#7FE3FF', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }}>EN KISA TUR</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Stat dark value={`${Math.round(walkLength(plan))} m`} label="yürüme" />
          <Stat dark value={`${floorsOf(plan).length} kat`} label={`${plan.stops.length} dükkân`} />
          <Stat dark value={`~${etaMinutes(plan)} dk`} label="alışveriş dahil" />
        </View>
      </Card>

      <Pressable accessibilityRole="button" onPress={() => router.push('/qr')} style={st.start}>
        <Icon name="map-marker" color={C.route} />
        <View style={{ flex: 1 }}>
          <Text style={font.tiny}>Başlangıç</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>{start.label}</Text>
        </View>
        <Text style={{ color: C.routeText, fontWeight: '700', fontSize: 13 }}>QR ile değiştir</Text>
      </Pressable>

      {plan.legs.map((leg, i) => {
        const stop = leg.toStop != null ? plan.stops[leg.toStop] : null;
        const via = leg.via;
        const z = stop ? ZONE[stop.shop.slot.zone] : null;
        return (
          <View key={i} style={{ gap: 6 }}>
            <View style={st.via}>
              <Icon name={(via ? rideIcon(via.type) : 'walk') as IconName} size={16} color={C.muted} />
              <Text style={font.small}>{via ? `${via.name} · ${leg.fromFloor} → ${leg.toFloor}. kat` : 'aynı kat'} · {Math.round(leg.length)} m</Text>
            </View>
            <Card style={st.stop}>
              <View style={[st.num, { backgroundColor: z?.color ?? '#FFFFFF', borderColor: z ? z.color : C.ink }]}>
                <Text style={{ color: z?.fg ?? C.ink, fontWeight: '800', fontSize: 12 }}>{stop ? i + 1 : 'Ç'}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                {stop ? (
                  <>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>{stop.items.map(it => it.label).join(' + ')}</Text>
                    <Text style={{ fontSize: 12.5, color: C.ink }} numberOfLines={1}>{shopName(stop.shop)}</Text>
                    <Text style={font.tiny}>{stop.shop.block} Blok · {stop.floor}. kat · No {stop.shop.no} · {z?.label}</Text>
                  </>
                ) : (
                  <>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>Çıkış</Text>
                    <Text style={font.tiny}>8. kat · ana giriş</Text>
                  </>
                )}
              </View>
            </Card>
          </View>
        );
      })}

      <Button title="Navigasyonu başlat" icon="navigation-variant" onPress={go} style={{ marginTop: 8 }} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 16, gap: 10, paddingBottom: 40 },
  start: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 12, minHeight: 56 },
  via: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 10 },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  num: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
