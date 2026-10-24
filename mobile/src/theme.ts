// Tasarım tuvalindeki renkler ve ölçüler
export const C = {
  ink: '#0E1726',
  ink2: '#17243A',
  ground: '#F3F5F8',
  card: '#FFFFFF',
  line: '#E2E7EE',
  lineStrong: '#D5DCE5',
  muted: '#5B6778',
  mutedOnDark: '#A9B6C8',
  brand: '#D2500A',
  route: '#0A8FB0',
  routeText: '#075E75',
  ok: '#2A7F35',
  okBg: '#E2F3E5',
  okText: '#1E5F27',
  warnBg: '#FDE7D9',
  warnText: '#8A3300',
} as const;

// Perpa'nın yön renkleri: kırmızı hat, sarı / mavi / yeşil avlu
export const ZONE = {
  KIRMIZI: { color: '#C81E25', fg: '#FFFFFF', tint: '#F4E3E3', label: 'Kırmızı hat' },
  SARI: { color: '#F2B705', fg: '#3A2A00', tint: '#FBF0C8', label: 'Sarı avlu' },
  MAVI: { color: '#1F6FD1', fg: '#FFFFFF', tint: '#DCE8F8', label: 'Mavi avlu' },
  YESIL: { color: '#2A7F35', fg: '#FFFFFF', tint: '#DDEFDF', label: 'Yeşil avlu' },
} as const;
export type ZoneKey = keyof typeof ZONE;

export const R = { sm: 10, md: 14, lg: 18, xl: 22 } as const;

export const font = {
  h1: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.5, color: C.ink },
  h2: { fontSize: 17, fontWeight: '700' as const, color: C.ink },
  body: { fontSize: 15, color: C.ink },
  small: { fontSize: 13, color: C.muted },
  tiny: { fontSize: 11.5, color: C.muted },
};
