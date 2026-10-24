// 2D kat planı: bina modeli (src/core/layout.js) üzerinden çizilir; koordinatlar metre, z aşağı.
import { memo, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { CELLS, DB, DIM, GATES, HALL, WELLS, variantOf, type Shop } from './perpa';
import { C, ZONE } from './theme';

export type MapMarker = { x: number; z: number; color: string; label?: string; kind?: 'me' | 'stop' | 'pin' };
type Box = { x0: number; z0: number; x1: number; z1: number };

const BUILDING: Box = { x0: -162, z0: -52, x1: 162, z1: 64 };
const deg = (r: number) => (-r * 180) / Math.PI;

const Base = memo(function Base({ floor, highlight }: { floor: number; highlight?: string | null }) {
  const v = variantOf(floor);
  const shops: Shop[] = DB.floors[floor];
  const octR = DIM.OCT_VOID / Math.cos(Math.PI / 8);
  return (
    <G>
      <Rect x={-160} y={-50} width={320} height={100} fill="#FFFFFF" stroke="#A9B4C2" strokeWidth={0.6} />
      <Rect x={HALL.x0} y={HALL.z0} width={HALL.x1 - HALL.x0} height={HALL.z1 - HALL.z0} fill="#D7E1EC" />
      {v === 'E' ? <Rect x={-6} y={50} width={12} height={12} fill="#D7E1EC" /> : null}
      {/* kırmızı hat halkası (her blok) */}
      {[-85, 85].map(cx => (
        <G key={cx}>
          <Rect x={cx - DIM.HU + DIM.STRIP} y={-DIM.HV + DIM.STRIP} width={2 * (DIM.HU - DIM.STRIP)} height={2 * (DIM.HV - DIM.STRIP)} fill={ZONE.KIRMIZI.tint} />
          <Rect x={cx - DIM.IN_U} y={-DIM.IN_V} width={2 * DIM.IN_U} height={2 * DIM.IN_V} fill="#F3F5F8" />
        </G>
      ))}
      {CELLS.filter(c => !(v === 'G' && c.front)).map(c => (
        <Rect key={c.idx} x={c.cx - DIM.CELL_HU} y={c.cz - DIM.CELL_HV} width={2 * DIM.CELL_HU} height={2 * DIM.CELL_HV} fill={ZONE[c.color as keyof typeof ZONE].tint} />
      ))}
      {v === 'G' ? [-85, 85].map(cx => <Rect key={'g' + cx} x={cx - DIM.HU + 1} y={1} width={2 * DIM.HU - 2} height={DIM.HV - 2} fill="#E3E6EA" />) : null}
      {shops.map(s => {
        const sl = s.slot, on = highlight === `${floor}:${s.si}`;
        return (
          <Rect key={s.si} x={sl.x - sl.w / 2 + 0.25} y={sl.z - sl.d / 2 + 0.25} width={sl.w - 0.5} height={sl.d - 0.5}
            fill={on ? C.brand : ZONE[sl.zone].color} opacity={on ? 1 : s.firm ? 0.85 : 0.45}
            transform={`rotate(${deg(sl.rot)} ${sl.x} ${sl.z})`} />
        );
      })}
      {CELLS.filter(c => !(v === 'G' && c.front)).map(c => (
        <G key={'o' + c.idx}>
          <Polygon points={Array.from({ length: 8 }, (_, k) => { const a = Math.PI / 8 + k * Math.PI / 4; return `${c.cx + octR * Math.cos(a)},${c.cz + octR * Math.sin(a)}`; }).join(' ')} fill="#9AA7B8" />
          <Circle cx={c.cx} cy={c.cz} r={1.6} fill="#FFFFFF" />
        </G>
      ))}
      {WELLS.map(w => <Rect key={w.id} x={w.x0} y={w.z0} width={w.x1 - w.x0} height={w.z1 - w.z0} fill="#9AA7B8" />)}
      {GATES.map(g => {
        const horiz = Math.abs(Math.sin(g.core.rot)) < 0.5, hw = horiz ? g.core.w / 2 : g.core.d / 2, hd = horiz ? g.core.d / 2 : g.core.w / 2;
        return <Rect key={g.n} x={g.core.x - hw} y={g.core.z - hd} width={hw * 2} height={hd * 2} fill="#8B7355" />;
      })}
      <SvgText x={-85} y={-53} fontSize={5} fontWeight="700" fill="#4A5566" textAnchor="middle">B BLOK</SvgText>
      <SvgText x={85} y={-53} fontSize={5} fontWeight="700" fill="#4A5566" textAnchor="middle">A BLOK</SvgText>
    </G>
  );
});

export function FloorMap({ floor, paths = [], markers = [], highlight, focus, height = 260 }: {
  floor: number; paths?: [number, number][][]; markers?: MapMarker[]; highlight?: string | null; focus?: Box | null; height?: number;
}) {
  // görünüm: verilen odak kutusu (rota) ya da tüm kat
  const vb = useMemo(() => {
    const b = focus ?? BUILDING;
    const pad = focus ? 14 : 2;
    let x0 = b.x0 - pad, z0 = b.z0 - pad, w = b.x1 - b.x0 + pad * 2, h = b.z1 - b.z0 + pad * 2;
    const minW = 70; if (w < minW) { x0 -= (minW - w) / 2; w = minW; }
    return `${x0} ${z0} ${w} ${h}`;
  }, [focus]);
  return (
    <View style={{ height, backgroundColor: '#E6EAF0', borderRadius: 16, overflow: 'hidden' }}>
      <Svg width="100%" height="100%" viewBox={vb} preserveAspectRatio="xMidYMid meet" accessibilityLabel={`${floor}. kat planı`}>
        <Base floor={floor} highlight={highlight} />
        {paths.map((p, i) => (
          <G key={i}>
            <Polyline points={p.map(q => q.join(',')).join(' ')} fill="none" stroke="#FFFFFF" strokeWidth={3.2} strokeLinejoin="round" strokeLinecap="round" />
            <Polyline points={p.map(q => q.join(',')).join(' ')} fill="none" stroke={C.route} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
          </G>
        ))}
        {markers.map((m, i) => m.kind === 'me' ? (
          <G key={i}>
            <Circle cx={m.x} cy={m.z} r={4} fill={m.color} opacity={0.25} />
            <Circle cx={m.x} cy={m.z} r={2} fill={m.color} stroke="#FFFFFF" strokeWidth={0.8} />
          </G>
        ) : (
          <G key={i}>
            <Line x1={m.x} y1={m.z} x2={m.x} y2={m.z - 3} stroke={m.color} strokeWidth={0.6} />
            <Circle cx={m.x} cy={m.z - 4.5} r={3.2} fill={m.color} stroke="#FFFFFF" strokeWidth={0.7} />
            {m.label ? <SvgText x={m.x} y={m.z - 3.4} fontSize={3.4} fontWeight="800" fill="#FFFFFF" textAnchor="middle">{m.label}</SvgText> : null}
          </G>
        ))}
      </Svg>
    </View>
  );
}

export function boxOf(points: [number, number][]): Box | null {
  if (!points.length) return null;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of points) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
  return { x0, z0, x1, z1 };
}
