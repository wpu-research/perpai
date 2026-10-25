import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PRESETS } from '@/perpa';
import { useStore } from '@/store';
import { C, font } from '@/theme';
import { Button, Segmented } from '@/ui';

type Preset = { title: string; text: string };

export default function NewList() {
  const { prefill, scanned } = useLocalSearchParams<{ prefill?: string; scanned?: string }>();
  const createList = useStore(s => s.createList);
  const [title, setTitle] = useState('');
  const [text, setText] = useState(prefill ?? '');
  // okutmadan dönüldü: okunan satırları mevcut metnin sonuna ekle
  const [prevScan, setPrevScan] = useState(scanned);
  if (scanned !== prevScan) { setPrevScan(scanned); if (prefill) setText(t => (t.trim() ? `${t.trim()}\n${prefill}` : prefill)); }
  const [pick, setPick] = useState<'uzman' | 'yakin'>('uzman');
  const lines = text.split(/\n|,|;/).filter(l => l.trim().length > 1).length;

  const create = () => {
    const id = createList(text, title, pick);
    router.replace(`/list/${id}`);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={st.wrap} keyboardShouldPersistTaps="handled">
        <Text style={st.label}>Liste adı</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="ör. Güvenlik kamerası kurulumu" placeholderTextColor={C.muted} style={st.input} accessibilityLabel="Liste adı" />

        <Text style={st.label}>Hazır listeler</Text>
        <View style={st.chips}>
          {(Object.values(PRESETS) as Preset[]).map(p => (
            <Pressable key={p.title} accessibilityRole="button" onPress={() => { setText(p.text); if (!title) setTitle(p.title); }}
              style={[st.chip, text === p.text && st.chipOn]}>
              <Text style={st.chipText}>{p.title}</Text>
            </Pressable>
          ))}
        </View>

        <Button title="Kâğıt listeyi kamerayla okut" icon="text-recognition" kind="dark" onPress={() => router.push('/scan')} />
        {scanned ? <Text style={font.tiny}>Okunan satırları kontrol et; yanlış okunanı düzelt, gereksiz satırı sil.</Text> : null}

        <Text style={st.label}>Ürünler</Text>
        <TextInput value={text} onChangeText={setText} multiline textAlignVertical="top" accessibilityLabel="Ürünler"
          placeholder={'Her satıra bir ürün:\n4 adet IP kamera\n100 m Cat6 kablo\nB 1450 (dükkân no)'} placeholderTextColor={C.muted} style={[st.input, st.area]} />
        <Text style={font.tiny}>Ürün, firma adı ya da dükkân numarası yazabilirsin. Miktarı başa yaz: “4 adet”, “100 m”.</Text>

        <Text style={st.label}>Dükkân seçimi</Text>
        <Segmented value={pick} onChange={setPick} options={[{ v: 'uzman', label: 'Uzman firma' }, { v: 'yakin', label: 'En kısa rota' }]} />


        <Button title={lines ? `Dükkânları bul · ${lines} ürün` : 'Dükkânları bul'} icon="store-search-outline" onPress={create} disabled={!lines} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 20, gap: 10, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '700', color: C.muted, marginTop: 6 },
  input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.card, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.ink },
  area: { minHeight: 170 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.card, justifyContent: 'center' },
  chipOn: { borderColor: C.brand, backgroundColor: '#FDE7D9' },
  chipText: { fontSize: 13, fontWeight: '600', color: C.ink },
});
