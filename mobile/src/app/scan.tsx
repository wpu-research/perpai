// Kâğıt listeyi okutma: fotoğraf telefonda metne çevrilir (ML Kit / Apple Vision), sunucuya yalnız metin gider.
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { extractTextFromImage, isSupported } from 'expo-text-extractor';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { C, font } from '@/theme';
import { Button, Icon } from '@/ui';

// tanınan bloklardan liste satırları: harf içermeyen (fiyat, sayfa no) ve tarih geçen (başlık) satırları at
function linesOf(blocks: string[]): string[] {
  return blocks.join('\n').split('\n').map(l => l.replace(/\s+/g, ' ').trim())
    .filter(l => /[a-zA-ZçğıöşüÇĞİÖŞÜ]{2,}/.test(l) && l.length <= 80 && !/\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b/.test(l));
}

export default function Scan() {
  const [perm, requestPerm] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const read = async (uri: string) => {
    setBusy(true); setErr(null);
    try {
      const lines = linesOf(await extractTextFromImage(uri.replace(/^file:\/\//, '')));
      if (!lines.length) { setErr('Yazı okunamadı. Listeyi düz tutup daha yakından, iyi ışıkta tekrar dene.'); return; }
      router.dismissTo({ pathname: '/list/new', params: { prefill: lines.join('\n'), scanned: String(Date.now()) } });
    } catch {
      setErr('Okuma başarısız oldu. Tekrar dene ya da listeyi elle yaz.');
    } finally { setBusy(false); }
  };

  const shoot = async () => {
    const pic = await cam.current?.takePictureAsync({ quality: 0.8, skipProcessing: false });
    if (pic?.uri) read(pic.uri);
  };
  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!r.canceled && r.assets[0]) read(r.assets[0].uri);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {perm?.granted ? <CameraView ref={cam} style={StyleSheet.absoluteFill} facing="back" /> : null}
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={st.top}>
          <Pressable accessibilityRole="button" accessibilityLabel="Kapat" onPress={() => router.back()} style={st.round}><Icon name="close" color="#FFFFFF" /></Pressable>
          <Text style={st.hint}>Listenin tamamı çerçevede olsun, düz ve iyi ışıkta</Text>
        </View>
        <View style={st.frameWrap} pointerEvents="none"><View style={st.frame} /></View>

        <View style={st.sheet}>
          {!isSupported ? <Text style={font.small}>Bu cihaz yazı tanımayı desteklemiyor; listeyi elle yaz.</Text> : null}
          {!perm?.granted ? (
            <View style={{ gap: 8 }}>
              <Text style={font.h2}>Kamera izni</Text>
              <Text style={font.small}>Listeyi okumak için kamerayı kullanırız. Fotoğraf telefonda kalır, yalnızca okunan yazı eşleştirmeye gider.</Text>
              {perm?.canAskAgain !== false ? <Button title="Kameraya izin ver" icon="camera" onPress={requestPerm} /> : <Text style={font.small}>Ayarlar’dan kamera iznini açabilirsin.</Text>}
            </View>
          ) : null}
          {err ? <Text style={{ color: '#B3261E', fontSize: 13.5 }}>{err}</Text> : null}
          {busy ? (
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', minHeight: 56 }}>
              <ActivityIndicator color={C.brand} /><Text style={font.h2}>Liste okunuyor…</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Button title="Galeriden" icon="image-outline" kind="secondary" onPress={pick} style={{ flex: 1 }} disabled={!isSupported} />
              <Pressable accessibilityRole="button" accessibilityLabel="Fotoğraf çek ve oku" onPress={shoot} disabled={!perm?.granted || !isSupported} style={st.shutter}>
                <View style={st.shutterIn} />
              </Pressable>
              <View style={{ flex: 1 }} />
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  hint: { flex: 1, color: '#FFFFFF', fontWeight: '600', fontSize: 13.5, textShadowColor: '#000', textShadowRadius: 3 },
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: '82%', height: '78%', borderRadius: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)', borderStyle: 'dashed' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 26, gap: 12 },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  shutterIn: { width: 58, height: 58, borderRadius: 29, backgroundColor: C.brand },
});
