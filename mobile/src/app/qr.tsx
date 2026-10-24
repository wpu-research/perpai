import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { parseScanned, toPlace, type QRPlace } from '@/perpa';
import { useStore } from '@/store';
import { C, font } from '@/theme';
import { Button, Icon } from '@/ui';

export default function QRScreen() {
  const { list } = useLocalSearchParams<{ list?: string }>();
  const [perm, requestPerm] = useCameraPermissions();
  const setLocation = useStore(s => s.setLocation);
  const setList = useStore(s => s.setList);
  const [manual, setManual] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [found, setFound] = useState<QRPlace | null>(null);
  const handled = useRef(false);

  const accept = (text: string) => {
    if (handled.current) return;
    const q = parseScanned(text) as QRPlace | null;
    if (!q) { setErr(`"${text.slice(0, 50)}" bir PerpAI konumu değil.`); return; }
    handled.current = true;
    const p = toPlace(q);
    setLocation(p);
    if (list) setList(list, { here: p });
    setFound(q);
    setTimeout(() => router.back(), 1100);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {perm?.granted ? (
        <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={found ? undefined : ({ data }) => accept(data)} />
      ) : null}
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={st.top}>
          <Pressable accessibilityRole="button" accessibilityLabel="Kapat" onPress={() => router.back()} style={st.close}><Icon name="close" color="#FFFFFF" /></Pressable>
          <Text style={st.hint}>Kapıdaki ya da koridordaki QR’ı çerçeveye al</Text>
        </View>
        <View style={st.frameWrap} pointerEvents="none"><View style={[st.frame, found && { borderColor: '#3DDC84' }]} /></View>
      </SafeAreaView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={st.sheet}>
          {found ? (
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <View style={st.ok}><Icon name="check" size={24} color={C.okText} /></View>
              <View style={{ flex: 1 }}>
                <Text style={font.h2}>Konumun bulundu</Text>
                <Text style={font.small}>{found.label}{found.sub ? ` · ${found.sub}` : ''}</Text>
              </View>
            </View>
          ) : (
            <>
              {!perm?.granted ? (
                <View style={{ gap: 8 }}>
                  <Text style={font.h2}>Kamera izni</Text>
                  <Text style={font.small}>QR’ı okuyup Perpa’da nerede olduğunu bulmak için kamerayı kullanırız. Görüntü kaydedilmez.</Text>
                  {perm?.canAskAgain !== false ? <Button title="Kameraya izin ver" icon="camera" onPress={requestPerm} /> : <Text style={font.small}>Ayarlar’dan kamera iznini açabilirsin.</Text>}
                </View>
              ) : <Text style={font.h2}>QR okut, konumunu bul</Text>}
              <View style={st.manual}>
                <TextInput value={manual} onChangeText={t => { setManual(t); setErr(null); }} placeholder="Kod ya da dükkân no (A 1350, E19-11)" placeholderTextColor={C.muted}
                  autoCapitalize="characters" autoCorrect={false} style={st.input} accessibilityLabel="QR kodu ya da dükkân numarası" onSubmitEditing={() => manual.trim() && accept(manual)} />
                <Button title="Git" small onPress={() => manual.trim() && accept(manual)} disabled={!manual.trim()} />
              </View>
              {err ? <Text style={{ color: '#B3261E', fontSize: 13 }}>{err}</Text> : null}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  hint: { flex: 1, color: '#FFFFFF', fontWeight: '600', fontSize: 13.5 },
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 240, height: 240, borderRadius: 24, borderWidth: 3, borderColor: '#FFFFFF' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 34, gap: 12 },
  ok: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.okBg, alignItems: 'center', justifyContent: 'center' },
  manual: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: C.lineStrong, paddingHorizontal: 12, fontSize: 15, color: C.ink },
});
