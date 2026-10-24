# PerpAI mobil (Expo SDK 58)

Perpa'da alışveriş listesi → dükkân eşleştirme → en kısa rota → adım adım navigasyon → harcama takibi.

## Çalıştırma

Node 22 gerekir (`nvm use 22`).

```bash
npm install
npx expo start          # telefonda Expo Go ile QR'ı okut
npx expo start --web    # tarayıcıda dene (kamera yerine kod elle girilir)
```

## Yapı

| Yer | Ne |
|---|---|
| `src/app/(tabs)/` | Ana sayfa, Listelerim, Harita sekmeleri |
| `src/app/list/` | Yeni liste, liste detayı (alındı / alınacak / atlanan, fiyat) |
| `src/app/route/[id]` | Rota özeti (mesafe, kat, süre, durak sırası) |
| `src/app/navigate/[id]` | Adım adım navigasyon, 2D kat planı, "Vardım" → fiyat girişi |
| `src/app/qr.tsx` | Kamerayla QR okutma / elle kod; konum ve rota güncellenir |
| `src/app/q/[code]` | Derin link `perpai://q/<kod>` |
| `src/core/` | **Otomatik kopya** — `web/js` modülleri + firma verisi (`npm run sync-core`) |
| `src/perpa.ts` | Çekirdeğe tipli giriş |
| `src/store.ts` | Listeler, harcama, konum (zustand + AsyncStorage) |
| `src/route.ts` | Listeden durak, tur ve tarif |
| `src/FloorMap.tsx` | react-native-svg kat planı |

## Henüz yok

- Kâğıt listeyi kamerayla okutma (OCR) ve AR okları: geliştirme derlemesi gerektiriyor (ML Kit, ViroReact).
- Sunucu: listeler şimdilik telefonda; eşleştirme cihazda kural tabanlı.

Kontroller: `npm run typecheck` · `npx expo lint` · `npx expo-doctor`
