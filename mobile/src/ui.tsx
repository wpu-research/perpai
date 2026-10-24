// Ortak arayüz parçaları
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { C, R, ZONE, type ZoneKey } from './theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
export const Icon = ({ name, size = 20, color = C.ink }: { name: IconName; size?: number; color?: string }) =>
  <MaterialCommunityIcons name={name} size={size} color={color} />;

type BtnKind = 'primary' | 'secondary' | 'dark' | 'ghost' | 'onDark';
export function Button({ title, onPress, kind = 'primary', icon, style, disabled, small }: {
  title: string; onPress?: () => void; kind?: BtnKind; icon?: IconName; style?: StyleProp<ViewStyle>; disabled?: boolean; small?: boolean;
}) {
  const bg = { primary: C.brand, secondary: C.card, dark: C.ink, ghost: 'transparent', onDark: 'transparent' }[kind];
  const fg = kind === 'secondary' || kind === 'ghost' ? C.ink : '#FFFFFF';
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled}
      style={({ pressed }) => [s.btn, small && s.btnSmall, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        kind === 'secondary' && s.btnBorder, kind === 'onDark' && s.btnOnDark, style]}>
      {icon ? <Icon name={icon} size={small ? 16 : 19} color={fg} /> : null}
      <Text style={[s.btnText, small && { fontSize: 13 }, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function ZoneChip({ zone, short }: { zone: ZoneKey; short?: boolean }) {
  const z = ZONE[zone];
  return (
    <View style={[s.chip, { backgroundColor: z.color }]}>
      <Text style={[s.chipText, { color: z.fg }]}>{short ? z.label.split(' ')[0] : z.label}</Text>
    </View>
  );
}

export const Card = ({ children, style, dark }: { children: ReactNode; style?: StyleProp<ViewStyle>; dark?: boolean }) =>
  <View style={[s.card, dark && s.cardDark, style]}>{children}</View>;

export function Stat({ value, label, dark }: { value: string; label: string; dark?: boolean }) {
  return (
    <View style={[s.stat, dark && { backgroundColor: C.ink2 }]}>
      <Text style={[s.statV, dark && { color: '#FFFFFF' }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={[s.statL, dark && { color: C.mutedOnDark }]}>{label}</Text>
    </View>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={s.seg}>
      {options.map(o => (
        <Pressable key={o.v} accessibilityRole="button" accessibilityState={{ selected: o.v === value }} onPress={() => onChange(o.v)}
          style={[s.segBtn, o.v === value && s.segOn]}>
          <Text style={[s.segText, o.v === value && { color: C.ink, fontWeight: '700' }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const Progress = ({ value, color = C.ok }: { value: number; color?: string }) => (
  <View style={s.prog}><View style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, height: '100%', backgroundColor: color }} /></View>
);

const s = StyleSheet.create({
  btn: { minHeight: 52, borderRadius: 16, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnSmall: { minHeight: 44, borderRadius: 12, paddingHorizontal: 12 },
  btnBorder: { borderWidth: 1, borderColor: C.lineStrong },
  btnOnDark: { borderWidth: 1, borderColor: '#3A4A60' },
  btnText: { fontSize: 15, fontWeight: '700' },
  chip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' },
  chipText: { fontSize: 11, fontWeight: '700' },
  card: { backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: 14 },
  cardDark: { backgroundColor: C.ink, borderColor: C.ink },
  stat: { flex: 1, backgroundColor: C.ground, borderRadius: 12, padding: 10 },
  statV: { fontSize: 19, fontWeight: '800', color: C.ink },
  statL: { fontSize: 11.5, color: C.muted, marginTop: 2 },
  seg: { flexDirection: 'row', backgroundColor: '#E4E9EF', borderRadius: 12, padding: 3 },
  segBtn: { flex: 1, minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: C.card, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segText: { fontSize: 13, fontWeight: '600', color: '#4A5566' },
  prog: { height: 6, borderRadius: 3, backgroundColor: C.line, overflow: 'hidden' },
});
