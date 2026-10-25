// Kamerayla yürüme: kamera görüntüsü üstünde telefonun yönüne göre dönen yön oku, adım sayarak ilerleme,
// Türkçe sesli komutlar; görüşe giren QR konumu ve yönü düzeltir.
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { Accelerometer, DeviceMotion } from 'expo-sensors';
import * as Speech from 'expo-speech';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { FloorMap } from '@/FloorMap';
import * as G from '@/guide';
import { API_BASE, parseScanned, planRoute, shopName, toPlace, type Place, type QRPlace } from '@/perpa';
import { planFor, rideIcon, startOf } from '@/route';
import { useList, useStore } from '@/store';
import { C } from '@/theme';
import { Button, Icon, type IconName } from '@/ui';


const clock = () => Date.now();

export default function ARWalk() {
  useKeepAwake();
  const { id } = useLocalSearchParams<{ id: string }>();
  const list = useList(id);
  const location = useStore(s => s.location);
  const calib = useStore(s => s.calib);
  const stride = useStore(s => s.stride);
  const { setCalib, setLocation, setList, setStride } = useStore();
  const [perm, requestPerm] = useCameraPermissions();

  const here = list ? startOf(list, location) : null;
  const plan = useMemo(() => (list && here ? planFor(list, here) : null), [list, here]);
  const leg = plan?.legs[0] ?? null;
  const stop = leg && plan && leg.toStop != null ? plan.stops[leg.toStop] : null;
  const phases = useMemo(() => (leg ? G.phasesOf(leg) : []), [leg]);

  // bacak değişince (QR, durak tamamlandı) baştan
  const legKey = `${leg?.toStop}|${here?.x}|${here?.z}|${here?.floor}`;
  const [prevLeg, setPrevLeg] = useState(legKey);
  const [pi, setPi] = useState(0);
  const [s, setS] = useState(0);
  if (legKey !== prevLeg) { setPrevLeg(legKey); setPi(0); setS(0); }

  const phase = phases[Math.min(pi, phases.length - 1)] ?? null;
  const walk = phase?.kind === 'walk' ? phase : null;
  const lastWalk = [...phases].reverse().find((p): p is G.WalkPhase => p.kind === 'walk') ?? null;
  const isFinal = !!walk && walk === lastWalk && pi === phases.length - 1;
  const remaining = walk ? walk.length - s : 0;
  const arrived = isFinal && remaining <= 1.5;
  // yürüyüş bitince (son değilse) sıradaki evreye geç
  if (walk && !isFinal && remaining <= 1) { setPi(pi + 1); setS(0); }

  // hedef dükkân solda mı sağda mı (son yürüyüşün bitiş yönüne göre)
  const destSide = useMemo(() => {
    if (!stop || !lastWalk) return null;
    const p = G.pointAt(lastWalk, lastWalk.length);
    return G.side(p.h, stop.shop.slot.x - p.x, stop.shop.slot.z - p.z) === 'left' ? 'solunuzda' : 'sağınızda';
  }, [stop, lastWalk]);
  const destName = stop ? `No ${stop.shop.no}, ${shopName(stop.shop)}` : 'Ana giriş';

  // --- sensörler: pusula (kamera yönü) ve adım
  const [compass, setCompass] = useState(0);
  const compassRef = useRef(0);
  useEffect(() => {
    DeviceMotion.setUpdateInterval(80);
    let sx = 0, sy = 1, lastSet = 0;
    const sub = DeviceMotion.addListener(({ rotation }) => {
      if (!rotation) return;
      const h = G.cameraHeading(rotation.alpha, rotation.beta, rotation.gamma) * Math.PI / 180;
      sx = sx * 0.8 + Math.sin(h) * 0.2; sy = sy * 0.8 + Math.cos(h) * 0.2; // açısal alçak geçiren süzgeç
      compassRef.current = ((Math.atan2(sx, sy) * 180 / Math.PI) + 360) % 360;
      const now = Date.now();
      if (now - lastSet > 100) { lastSet = now; setCompass(compassRef.current); }
    });
    return () => sub.remove();
  }, []);

  // --- saha testi kaydı (kullanıcı açar; kapanınca sunucuya gider)
  const [rec, setRec] = useState(false);
  const events = useRef<object[]>([]);
  const recRef = useRef(false);
  const t0 = useRef(0);
  const log = (type: string, data: object) => {
    if (!recRef.current) return;
    events.current.push({ t: clock() - t0.current, type, ...data });
  };
  const upload = () => {
    const ev = events.current; events.current = [];
    if (!ev.length) return;
    fetch(API_BASE + '/api/trace', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ app: '0.5.0', events: ev }) }).catch(() => {});
  };
  const toggleRec = () => {
    if (recRef.current) { recRef.current = false; setRec(false); upload(); setToast('Test kaydı gönderildi'); setTimeout(() => setToast(null), 2500); return; }
    events.current = []; t0.current = clock(); recRef.current = true; setRec(true);
    log('start', { stride, calib, here: here && { x: here.x, z: here.z, floor: here.floor, code: here.code }, target: stop?.key ?? 'cikis' });
  };
  useEffect(() => () => { if (recRef.current) { recRef.current = false; upload(); } }, []);
  // pusula ve ilerleme örneği, saniyede bir
  const sample = useRef({ compass: 0, s: 0, pi: 0 });
  useEffect(() => { sample.current = { compass: Math.round(compass), s: Math.round(s * 10) / 10, pi }; }, [compass, s, pi]);
  useEffect(() => {
    if (!rec) return;
    const iv = setInterval(() => log('pose', sample.current), 1000);
    return () => clearInterval(iv);
  }, [rec]);

  const walkRef = useRef<{ walk: G.WalkPhase | null; arrived: boolean; stride: number }>({ walk: null, arrived: false, stride: 0.7 });
  useEffect(() => { walkRef.current = { walk, arrived, stride }; }, [walk, arrived, stride]);
  const stepsSinceQR = useRef(0);
  useEffect(() => {
    Accelerometer.setUpdateInterval(40);
    const det = new G.StepDetector(() => {
      const { walk: w, arrived: a, stride: m } = walkRef.current;
      stepsSinceQR.current++;
      log('step', {});
      if (w && !a) setS(v => Math.min(w.length, v + m));
    });
    const sub = Accelerometer.addListener(({ x, y, z }) => det.push(x, y, z));
    return () => sub.remove();
  }, []);

  // --- ses: Türkçe sesi açıkça seç; telefonda yoksa kullanıcıya söyle
  const [muted, setMuted] = useState(false);
  const [noTurkish, setNoTurkish] = useState(false);
  const voice = useRef<string | undefined>(undefined);
  useEffect(() => {
    Speech.getAvailableVoicesAsync().then(vs => {
      const tr = vs.filter(v => v.language.toLowerCase().replace('_', '-').startsWith('tr'));
      voice.current = (tr.find(v => v.quality === Speech.VoiceQuality.Enhanced) ?? tr[0])?.identifier;
      if (vs.length && !tr.length) setNoTurkish(true);
    }).catch(() => {});
    return () => { Speech.stop(); };
  }, []);
  const speak = (text: string) => { Speech.stop(); Speech.speak(text, { language: 'tr-TR', voice: voice.current }); };
  const said = useRef(new Set<string>());
  const say = (key: string, text: string) => {
    if (said.current.has(key)) return;
    said.current.add(key);
    if (!muted) speak(text);
  };

  useEffect(() => {
    if (!phase) return;
    const k = `${legKey}|${pi}`;
    if (phase.kind === 'ride') { say(k, `${phase.text}. Vardığınızda ekrandaki düğmeye dokunun.`); return; }
    const t = G.nextTurn(phase, s);
    if (s < 1) {
      if (t) say(k, `${G.roundM(t.at - s)} metre ilerleyin, sonra ${G.DIR_TEXT[t.dir]}.`);
      else if (isFinal) say(k, `${G.roundM(phase.length)} metre ilerleyin. ${destName} ${destSide ?? 'ileride'}.`);
      else say(k, `${G.roundM(phase.length)} metre ilerleyin.`);
    }
    if (t && t.at - s <= 6) {
      const after = G.nextTurn(phase, t.at);
      const tail = after ? `, sonra ${G.roundM(after.at - t.at)} metre düz` : isFinal ? `, hedef ${G.roundM(phase.length - t.at)} metre ileride` : '';
      const txt = G.DIR_TEXT[t.dir];
      say(`${k}|t${t.at}`, `${txt.charAt(0).toLocaleUpperCase('tr-TR')}${txt.slice(1)}${tail}.`);
    }
    if (isFinal && remaining <= 8 && remaining > 1.5) say(`${k}|near`, `Hedef yaklaşıyor, ${destSide ?? 'ileride'}.`);
    if (arrived) say(`${k}|arr`, stop ? `Vardınız. ${destName} ${destSide}.` : 'Ana girişe vardınız.');
  });

  // --- ok açısı
  const aim = walk ? G.aimAt(walk, s) : 0;
  const upcoming = walk ? G.nextTurn(walk, s) : null;
  const rel = calib != null ? G.relative(aim, compass, calib) : (upcoming && upcoming.at - s <= 10 ? G.DIR_ANGLE[upcoming.dir] : 0);

  // ters yön uyarısı
  const wrongSince = useRef<number | null>(null);
  const lastWarn = useRef(0);
  useEffect(() => {
    if (calib == null || !walk || arrived || Math.abs(rel) < 120) { wrongSince.current = null; return; }
    const now = Date.now();
    wrongSince.current ??= now;
    if (now - wrongSince.current > 3000 && now - lastWarn.current > 15000 && !muted) {
      lastWarn.current = now; speak('Ters yöne bakıyorsunuz, arkanızı dönün.');
    }
  });

  // --- kamerada QR: konumu ve yönü düzelt
  const lastQR = useRef({ code: '', at: 0 });
  const lastPlace = useRef<Place | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const onQR = (data: string) => {
    const q = parseScanned(data) as QRPlace | null;
    if (!q || !list) return;
    const now = Date.now();
    if (q.code === lastQR.current.code && now - lastQR.current.at < 15000) return;
    lastQR.current = { code: q.code, at: now };
    const p = toPlace(q);
    // tahmini konumun QR'dan sapması (saha testi için)
    const guess = walk ? G.pointAt(walk, s) : null;
    const err = guess && walk && walk.floor === q.floor ? Math.round(Math.hypot(guess.x - q.x, guess.z - q.z) * 10) / 10 : null;
    // adım boyunu öğren: aynı kattaki iki QR arasında yürünen yol / atılan adım
    const prevQR = lastPlace.current, n = stepsSinceQR.current;
    if (prevQR && prevQR.floor === q.floor && n >= 20) {
      const leg = (planRoute(prevQR, [], false, p) as { legs: { segments: { type: string; length?: number }[] }[] }).legs[0];
      const d = leg.segments.reduce((a, g) => a + (g.type === 'walk' ? g.length ?? 0 : 0), 0);
      const m = d / n;
      if (d >= 15 && m > 0.45 && m < 0.95) setStride(Math.round((stride * 0.5 + m * 0.5) * 100) / 100);
      log('stride', { d: Math.round(d), n, m: Math.round(m * 100) / 100 });
    }
    lastPlace.current = p; stepsSinceQR.current = 0;
    log('qr', { code: q.code, err, compass: Math.round(compassRef.current) });
    setLocation(p);
    setList(list.id, { here: p });
    setCalib(G.calibrate(q.heading, compassRef.current)); // QR'a bakarken telefonun yönü = QR'ın yönü
    setToast(`Konum: ${q.label}`);
    setTimeout(() => setToast(null), 2500);
    if (!muted) speak('Konumunuz güncellendi.');
  };

  if (!list || !plan || !leg || !phase) return null;

  const me = walk ? G.pointAt(walk, s) : null;
  const mapFloor = walk ? walk.floor : phase.kind === 'ride' ? phase.to : leg.fromFloor;
  const instr = phase.kind === 'ride' ? phase.text
    : arrived ? (stop ? `Vardınız · ${destSide}` : 'Ana girişe vardınız')
      : upcoming ? `${G.roundM(upcoming.at - s)} m sonra ${G.DIR_TEXT[upcoming.dir]}`
        : isFinal ? `${G.roundM(remaining)} m · hedef ${destSide ?? 'ileride'}` : `${G.roundM(remaining)} m düz ilerleyin`;

  const finish = () => {
    log('arrive', { s: Math.round(s) });
    if (stop) router.dismissTo({ pathname: '/navigate/[id]', params: { id: list.id, arrived: '1' } });
    else { setList(list.id, { status: 'done', here: null }); router.dismissTo({ pathname: '/list/[id]', params: { id: list.id } }); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {perm?.granted ? (
        <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => onQR(data)} />
      ) : null}
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* üst: komut */}
        <View style={st.top}>
          <Pressable accessibilityRole="button" accessibilityLabel="Kapat" onPress={() => router.back()} style={st.round}><Icon name="close" color="#FFFFFF" /></Pressable>
          <View style={st.instr}>
            <Text style={st.instrText} numberOfLines={2}>{instr}</Text>
            <Text style={st.instrSub} numberOfLines={1}>{stop ? destName : 'Çıkış'} · {mapFloor}. kat</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={rec ? 'Test kaydını bitir ve gönder' : 'Test kaydını başlat'} onPress={toggleRec} style={[st.round, rec && { backgroundColor: '#C62828' }]}>
            <Icon name={rec ? 'stop' : 'record-rec'} color="#FFFFFF" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={muted ? 'Sesi aç' : 'Sesi kapat'} onPress={() => { setMuted(m => !m); Speech.stop(); }} style={st.round}>
            <Icon name={muted ? 'volume-off' : 'volume-high'} color="#FFFFFF" />
          </Pressable>
        </View>

        {!perm?.granted ? (
          <View style={st.permBox}>
            <Text style={st.permText}>Yön oklarını yolun üstünde görmek ve QR’ları yakalamak için kamera gerekiyor. Görüntü kaydedilmez.</Text>
            {perm?.canAskAgain !== false ? <Button title="Kameraya izin ver" icon="camera" onPress={requestPerm} /> : <Text style={st.permText}>Ayarlar’dan kamera iznini açabilirsin.</Text>}
          </View>
        ) : null}

        {calib == null && walk ? (
          <View style={st.calibBox}>
            <Text style={st.calibText}>Ok yönü için: telefonu rotadaki yöne tutup “Yönü ayarla”ya dokun ya da yakındaki bir QR’ı kameraya göster.</Text>
          </View>
        ) : null}
        {noTurkish && !muted ? (
          <View style={st.calibBox}>
            <Text style={st.calibText}>Telefonunda Türkçe ses yok. Ayarlar › Erişilebilirlik › Metin okuma çıktısı’ndan Türkçe ses paketini indir.</Text>
          </View>
        ) : null}
        {toast ? <View style={st.toast}><Icon name="check-circle" color="#3DDC84" /><Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{toast}</Text></View> : null}

        {/* orta: ok ya da biniş */}
        <View style={st.center} pointerEvents="none">
          {phase.kind === 'ride' ? (
            <View style={st.rideBox}>
              <Icon name={rideIcon(phase.mode) as IconName} size={72} color="#FFFFFF" />
              <Text style={st.rideText}>{phase.to}. kat</Text>
            </View>
          ) : arrived ? (
            <View style={st.rideBox}><Icon name="flag-checkered" size={72} color="#FFFFFF" /></View>
          ) : (
            <FloorArrow angle={rel} dim={calib == null} />
          )}
        </View>

        {/* alt: harita + kontroller */}
        <View style={st.bottom}>
          <View style={st.mapWrap}>
            <FloorMap floor={mapFloor} height={150} paths={walk ? [walk.pts] : []}
              markers={me ? [{ x: me.x, z: me.z, color: C.route, kind: 'me' }] : []}
              focus={me ? { x0: me.x - 22, x1: me.x + 22, z0: me.z - 22, z1: me.z + 22 } : null} />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            {phase.kind === 'ride' ? (
              <Button title={`${phase.to}. kata vardım`} icon="check" onPress={() => { log('ride', { to: phase.to }); setPi(p => p + 1); setS(0); }} />
            ) : arrived ? (
              <Button title={stop ? 'Alışverişe geç' : 'Listeyi kapat'} icon="check" onPress={finish} />
            ) : (
              <>
                <View style={st.progress}><View style={[st.progressFill, { width: `${walk ? Math.min(100, (s / walk.length) * 100) : 0}%` }]} /></View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Pressable accessibilityRole="button" accessibilityLabel="5 metre geri" onPress={() => { log('nudge', { d: -5 }); setS(v => Math.max(0, v - 5)); }} style={st.chip}><Text style={st.chipText}>−5 m</Text></Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="5 metre ileri" onPress={() => { log('nudge', { d: 5 }); setS(v => Math.min(walk?.length ?? 0, v + 5)); }} style={st.chip}><Text style={st.chipText}>+5 m</Text></Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Yönü ayarla" onPress={() => { if (!walk) return; log('calib', { compass: Math.round(compassRef.current) }); setCalib(G.calibrate(G.aimAt(walk, s), compassRef.current)); }} style={[st.chip, { flex: 1 }]}>
                    <Text style={st.chipText}>Yönü ayarla</Text>
                  </Pressable>
                </View>
              </>
            )}
            <Text style={st.hint}>{rec ? '● Test kaydı açık · ' : ''}Adım {stride.toFixed(2)} m · QR görünce konum düzelir</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

// zemine yatırılmış, telefona göre dönen ok
function FloorArrow({ angle, dim }: { angle: number; dim: boolean }) {
  return (
    <View style={{ opacity: dim ? 0.75 : 1, transform: [{ perspective: 700 }, { rotateX: '58deg' }, { rotateZ: `${angle}deg` }] }}>
      <Svg width={200} height={280} viewBox="0 0 100 140">
        <Defs>
          <LinearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#4FE3FF" />
            <Stop offset="1" stopColor={C.route} stopOpacity="0.55" />
          </LinearGradient>
        </Defs>
        <Path d="M50 4 L94 54 L66 54 L66 136 L34 136 L34 54 L6 54 Z" fill="url(#g)" stroke="#FFFFFF" strokeWidth={3} strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

const glass = 'rgba(14,23,38,0.72)';
const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingTop: 6 },
  round: { width: 46, height: 46, borderRadius: 23, backgroundColor: glass, alignItems: 'center', justifyContent: 'center' },
  instr: { flex: 1, backgroundColor: glass, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  instrText: { color: '#FFFFFF', fontSize: 19, fontWeight: '800' },
  instrSub: { color: '#C9D3E0', fontSize: 12.5, marginTop: 2 },
  permBox: { margin: 16, padding: 16, borderRadius: 18, backgroundColor: glass, gap: 10 },
  permText: { color: '#FFFFFF', fontSize: 14 },
  calibBox: { marginHorizontal: 16, marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: 'rgba(242,183,5,0.92)' },
  calibText: { color: '#1B1B1B', fontSize: 13.5, fontWeight: '600' },
  toast: { alignSelf: 'center', marginTop: 10, flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: glass, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rideBox: { alignItems: 'center', gap: 6, backgroundColor: glass, padding: 24, borderRadius: 28 },
  rideText: { color: '#FFFFFF', fontSize: 26, fontWeight: '800' },
  bottom: { flexDirection: 'row', gap: 10, padding: 12, alignItems: 'flex-end' },
  mapWrap: { width: 150, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)' },
  progress: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: '#4FE3FF' },
  chip: { minHeight: 44, paddingHorizontal: 12, borderRadius: 14, backgroundColor: glass, alignItems: 'center', justifyContent: 'center' },
  chipText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13.5 },
  hint: { color: '#FFFFFF', fontSize: 11.5, opacity: 0.85, textShadowColor: '#000', textShadowRadius: 3 },
});
