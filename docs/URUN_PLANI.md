# PerpAI — Mobil Uygulama Ürün Planı

> 2026-10-24 · Platform: iOS + Android (Expo / React Native) · Ekran tasarımları: claude.ai'deki "PerpAI Uygulama Tasarımı" tuvali
> Dayanak: `arastirma/ANALIZ.md` (pazar ve veri) + canlı 3D demo https://perpai-web-production.up.railway.app

## 1. Ürün tek cümlede
Perpa'ya gelen kişi alışveriş listesini okutur; PerpAI listeyi gerçek dükkânlarla eşleştirir, katlar arası en kısa turu çizer ve dükkân dükkân yönlendirir. Esnaf kaydını ve ürünlerini güncel tutar, yönetim de binanın nasıl kullanıldığını görür.

## 2. Kullanıcılar ve işleri

| Kullanıcı | Temel iş | Başarı ölçüsü |
|---|---|---|
| **Ziyaretçi** (teknisyen, toptancı, bireysel alıcı) | "Bu 6 parçayı en kısa sürede topla ve çık." | İlk dükkâna ulaşma süresi; listenin bulunma oranı |
| **Esnaf** (~4.700 dükkân) | "Beni arayan müşteri dükkânımı bulsun." | Kayıt doğrulama oranı; rotayla gelen ziyaretçi |
| **Perpa yönetimi** (Kooperatif + A/B Kat Malikleri Yöneticilikleri) | "Bina kullanımını gör, duyuru yap, rehberi güncel tut." | Aktif kullanıcı; güncel kayıt oranı |

## 3. Ekranlar (tuvaldeki tasarımlar)

**Ziyaretçi**
1. **Ana ekran:** Arama (ürün, firma ya da `B 1450`), "Listeni okut" kartı, popüler sektörler (gerçek sayılar), son liste, Paşa Görevi kartı.
2. **Listeyi okut:** Kamera ile kâğıt liste. Ayrıca *Mesaj* (WhatsApp'tan yapıştırma) ve *Sesli* modları var. Algılanan satırlar düzeltilebilir.
3. **Eşleşmeler:** Her kalem için firma, blok, kat, no ve hat/avlu rengi gösterilir. Seçim modu *Uzman firma* ya da *En kısa rota* olabilir; ↻ ile alternatif dükkân seçilir.
4. **Rota özeti:** Kat merdiveni şeması, mesafe, süre, kat sayısı ve durak sırası (yürüyen merdiven ve asansör numarasıyla).
5. **Navigasyon:** 2D kat planında rota çizilir. Üstte dönüş talimatı, sağda kat seçici, altta sıradaki dükkân kartı görünür. "Konumu düzelt" kapıdaki QR'ı okutur, "Buldum" sonraki durağa geçer. 3D görünüme geçilebilir.
6. **Dükkân:** Büyük dükkân numarası ve hat rengi, sektörler, arama ve mesaj butonları. "Listenden bu dükkânda" bölümünde onay kutusu, fiyat alanı ve fiş fotoğrafı var. Ayrıca veri güncelliği notu ve "yanlışsa bildir".
7. **Listelerim:** Aylık Perpa harcaması, ziyaret, alınan ürün ve dükkân sayısı, sektör dağılımı. Listeler *Devam ediyor*, *Planlandı* ve *Tamamlandı* durumlarıyla gösteriliyor.
8. **Liste detayı:** *Alındı* bölümünde dükkân, fiyat ve fiş var. *Alınacak* bölümü rota sırasıyla diziliyor. Harcanan tutar ve bütçe yan yana gösteriliyor. Liste ekip arkadaşıyla paylaşılabiliyor; "Rotaya devam" yarım kalan turu kaldığı duraktan sürdürüyor.
9. **AR yön okları:** Kamera açıkken zemine yön okları ve dönüş oku çizilir. Hedef dükkânın üstünde "No 1000 · 14 m · solda" etiketi durur. Üstte dönüş talimatı, solda konum güveni ("QR ile sabitlendi · 40 sn önce · ±1 m") görünür. 2D haritaya geçiş tek dokunuş.
10. **QR ile konum:** Kapıdaki ya da koridordaki QR okutulunca konum kesinleşir, rota o noktadan yeniden hesaplanır. Örnek: "7. katta sanılıyordun → 11. kattasın; sıradaki dükkân tam karşında, sıra yeniden düzenlendi." QR yoksa dükkân numarası yazılabilir.

**Esnaf**
11. **Dükkânım:** Doğrulama rozeti, kayıt tamamlama adımları, rotayla gelen ziyaretçi sayısı, "sektöründe aranıp eşleşmeyenler" (talep sinyali).
12. **Ürünler:** Barkod veya raf fotoğrafıyla ürün ekleme, stok anahtarı.
13. **Kapı QR'ı:** Yazdırılabilir kart. Ziyaretçi okuttuğunda konumu kesinleşir; esnaf okuttuğunda kaydı doğrulanır (90 günde bir).

**Yönetim (web paneli)**
14. **Genel bakış:** Göstergeler, kat ve bölge yoğunluk ısı haritası, veri kalitesi (gerçek: rehberde %52 kayıt, örneklemde %38 eski kayıt), bulunamayan aramalar ve "esnafa bildir", hedefli duyuru.

## 4. MVP kapsamı (v1)

**Var:**
- Liste okutma (cihaz üstü OCR) ve eşleştirme.
- **Kayıtlı listeler ve harcama takibi:** Ne alındı, ne alınacak, kaça alındı. Fiş fotoğrafı eklenebiliyor, aylık özet ve sektör dağılımı görülüyor, liste tekrar alınabiliyor ve paylaşılabiliyor.
- Rota hesaplama, 2D navigasyon, QR ile konum düzeltme, dükkân kartı.
- Esnaf girişi (telefon + SMS), kapı QR'ı ile doğrulama, ürün ve stok ekleme.
- Yönetim panelinde göstergeler, veri kalitesi ve duyurular.
- Paşa Görevi (tanıtım / ilk kullanım rehberi olarak).

- **AR navigasyon + QR konum ağı** (aşağıda §5.1).

**Yok (v2+):**
- BLE/manyetik "mavi nokta" konum (QR + AR yeterli olursa hiç gerekmeyebilir).
- Ödeme ve rezervasyon.
- Esnaf kampanyaları ve öne çıkarma.
- Çoklu AVM desteği.
- Sesli asistan.

## 5. Teknik mimari

```
 Expo (iOS/Android)                       Yönetim paneli (Next.js)
 ├─ OCR: ML Kit Text Recognition           │
 │   (cihaz üstü, internetsiz)             │
 ├─ Rota motoru: nav.js (aynen taşınır,    │
 │   cihazda ~70 ms)                       │
 ├─ 2D harita: react-native-svg            │
 ├─ 3D görünüm: expo-gl + three            │
 │   (mevcut world.js)                     │
 └─ QR: expo-camera barcode                │
        │  HTTPS                           │
        ▼                                  ▼
   API (Node + Fastify/Hono + Drizzle) ── Postgres   [Railway]
        ├─ /match: kural tabanlı eşleştirme + LLM yedeği (Claude Haiku), önbellekli
        ├─ /shops, /products, /verify (esnaf)
        └─ /events (anonim analitik) → yoğunluk, bulunamayan aramalar
```

- **Çevrimdışı yedek:** Firma verisi (~250 KB) ve bina grafı uygulamaya gömülür. İnternet yoksa eşleştirme cihazdaki kural tablosuyla yapılır, bağlantı gelince sunucu sonucuyla güncellenir. Perpa'nın beton bloklarında mobil veri zayıf olabilir.
- **Eşleştirme (sunucuda):** Önce kural tablosu çalışır (`web/js/data.js`'ten taşınır). Kurala uymayan kalemler LLM'e gider ve sonuç sektör ya da ürün olarak önbelleğe alınır. Esnafın eklediği ürünler zamanla en güçlü sinyal olur.
- **Konum:** QR okutma, AR görsel izleme ve barometre birlikte kullanılır (§5.1). QR yoksa kapı numarası ya da kat seçimiyle devam edilir.
- **Bina grafı:** Şimdilik kat planı mantığından modellendi. Yönetimden alınacak DWG/CAD planlarıyla gerçek ölçüye kalibre edilecek.

### 5.1 AR navigasyon ve QR konum ağı

**Nasıl çalışır?**
1. **QR = konum + yön.** Her QR'ın binadaki yeri biliniyor: blok, kat, x/z koordinatı ve QR'ın baktığı yön. Kamera QR'ı okuduğunda yalnızca "neredesin"i değil, QR'a göre telefonun açısını da öğreniyoruz. QR'ın fiziksel boyutu sabit olduğu için köşelerinden poz hesaplanabiliyor.
2. **AR dünyası binaya hizalanır.** Bu poz, ARKit (iOS) ya da ARCore (Android) dünyasını binanın kat planına oturtur. Rota noktaları artık gerçek koridorda konumlanır; yön okları zemine 2 metrede bir ve dönüş noktalarına çizilir, hedef dükkânın üstüne etiket konur.
3. **İki QR arası görsel izleme.** Telefonun kamera + ivmeölçer takibi (VIO) yürürken konumu tahmin eder. Sapma yaklaşık yürünen yolun %1–2'si kadar. Konum ayrıca koridor grafına "yapıştırılır" (map matching), dükkânın içine kaymaz. Her yeni QR okutmada sapma sıfırlanır.
4. **Kat değişimi.** Barometre 4,5 m'lik kat farkını algılar (~0,5 hPa). Asansör ya da yürüyen merdivenden inince uygulama kat değişimini kendisi fark eder ve "çıkıştaki QR'ı okut" önerir. Her asansör ve merdiven çıkışında QR olacak.
5. **AR desteklemeyen telefonlar** 2D harita + pusula oku ile devam eder.

**Teknoloji:** Expo dev build + ViroReact (`@reactvision/react-viro`, ARKit/ARCore). QR okuma için expo-camera / ML Kit barcode, barometre için `expo-sensors`.

**QR ağı (binaya asılacak).** Bina modelimize göre tahmini sayılar:

| Yer | Kat başına | Toplam (13 kat) |
|---|---|---|
| Avlu asansörü kapıları | 8 | ~104 |
| Yürüyen merdiven uçları | 4 | ~52 |
| Kapı/merdiven çekirdekleri | 12 | ~156 |
| Koridor kavşakları (avlu girişleri, salon geçişleri) | ~38 | ~450 |
| **Yönetimin asacağı toplam** | | **~760** |
| Dükkân kapıları (esnaf kartı) | | ~4.700'e kadar |

- QR'lar 15×15 cm boyutunda, 1,4 m yüksekliğe, kolon ve köşelere asılacak. 1,5 m mesafeden okunabilir.
- **QR adresi:** `https://perpai.app/q/<kod>`. Uygulama yüklüyse uygulama açılır. Yüklü değilse aynı link web demosunu o konumdan başlatır; yani uygulama indirmeden de telefon kamerasıyla okutup yol bulmak mümkün olur.
- Kod tablosu: `qr(code, kind: door|junction|elevator|escalator|gate, block, floor, x, z, heading, shop_id?)`.

### Veri modeli (özet)
- `shop(id, block, floor, entry_floor, no, zone, x, z, door_x, door_z)` (fiziksel dükkân; ~4.700)
- `firm(id, name, sectors[], phone, verified_at, owner_user_id)` ↔ `shop` (n:1)
- `product(id, firm_id, name, barcode, in_stock, price?)`
- `list(id, user_id, title, status: planned|active|done, budget?, created_at, visited_at)`
- `list_item(id, list_id, text, qty, unit, firm_id?, status: todo|bought|skipped, price?, bought_at?, receipt_photo?)`
- `match(list_item_id, firm_id, score, source: rule|llm|product)`
- `price_report(product_key, price, user_id, firm_id, ts)` → Perpa geneli anonim fiyat aralığı
- `event(type, floor, zone, ts, anon_id)` (rota başlatma, varış, bulunamayan arama, QR okutma)

## 6. Yol haritası

| Aşama | Süre | Çıktı |
|---|---|---|
| 0. İzin ve veri | 2 hafta | Perpa yönetimiyle görüşme; DWG planları, veri kullanım izni, pilot kat seçimi |
| 1. Uygulama iskeleti | 3 hafta | Expo projesi, çevrimdışı veri, arama, eşleştirme, rota, 2D harita |
| 2. Okutma ve navigasyon | 3 hafta | ML Kit OCR, navigasyon ekranı, QR ile konum düzeltme, dükkân kartı, listeler ve harcama |
| 2b. AR + QR ağı | 3 hafta | ViroReact AR okları, QR poz hizalama, barometre ile kat algılama; pilot katlara QR asılması |
| 3. Esnaf | 2 hafta | SMS girişi, kapı QR doğrulama, ürün ekleme; 2 katta saha pilotu |
| 4. Yönetim paneli | 2 hafta | Göstergeler, veri kalitesi, duyurular |
| 5. Mağaza yayını | 1–2 hafta | TestFlight / Play iç test → yayın |

Pilot önerisi: **8. kat** (ana giriş) ve **11. kat**. Her iki blokta, iki katın kapılarına QR kartı asılır; 2 hafta boyunca bulma süresi ölçülür.

## 7. İş modeli seçenekleri
1. **Perpa yönetimine lisans:** Resmi uygulamanın yerini alır (bugünkü uygulama: Android'de 3,8★, 78 yorum).
2. **Esnaf aboneliği:** Ürün kataloğu, öne çıkma, talep raporu ("seni arayıp bulamayanlar").
3. **Reklam:** Sitede zaten satılan reklam alanının uygulama karşılığı.

## 8. Kararlar ve açık konular

**Alınan kararlar (2026-10-24)**
- **Ad:** PerpAI.
- **Perpa yönetimi:** Görüşme yapıldı, dönüş **haftaya** bekleniyor. Aşama 0 bu yanıta bağlı; ~760 QR'ın asılması için de yönetim izni gerekecek.
- **Kayıtlı listeler ve harcama takibi:** v1'e alındı (§4).
- **AR navigasyon + QR konum:** v1'e alındı (§5.1).
- **Anonim fiyat ortalaması:** Evet, şu kurallarla:
  - Yalnızca Perpa geneli aralık gösterilir, dükkân bazında fiyat gösterilmez.
  - Son 90 günde en az 5 farklı kişinin girdiği fiyat varsa gösterilir.
  - Tam ortalama yerine orta aralık (P25–P75) verilir, aykırı değerler atılır.
  - Esnaf kendi ürününe "güncel fiyatım" notu ekleyebilir.

**Esnaf doğrulaması (onaylandı).** Üç katmanlı, kademeli doğrulama:
1. **Telefon eşleşmesi (otomatik):** Esnaf SMS ile giriş yapar. Numarası perpa.com.tr rehberindeki firma telefonuyla eşleşirse kayıt anında "doğrulanmış" olur. Rehberde telefon alanı zaten var, bu yüzden en ucuz yol bu.
2. **Kapı QR'ı (fiziksel):** Eşleşme yoksa esnaf, dükkân kapısındaki tek kullanımlık talep kodunu okutur. Kodları yönetim ya da saha ekibi asar. Kodu okutabilen kişi o dükkânın içinde demektir.
3. **Yönetim onayı (istisna):** Kapı kodu yoksa ya da aynı dükkânı iki kişi talep ediyorsa karar yönetim panelinden verilir. Kooperatif ortak kaydı burada referans olarak kullanılır.

Doğrulama 90 günde bir aynı QR'la yenilenir. Yenilenmeyen kayıt "güncel değil" etiketine düşer; rehberdeki 10 yıllık kayıt sorununu bu kapatır.

**Liste verisi ve gizlilik (karar: liste metni sunucuya gidebilir).**
- **Eşleştirme sunucuda yapılır:** Okutulan liste metni API'ye gider ve kural tabanlı eşleştirme + LLM (Claude Haiku) orada çalışır. Böylece eşleştirme kuralları ve firma verisi uygulama güncellemesi beklemeden iyileşir. OCR cihazda kalır; sunucuya fotoğraf değil, metin gider.
- **Listeler sunucuda saklanır:** Telefonda önbelleği tutulur, çevrimdışıyken de açılır. Hesapla eşitlenir, ekip arkadaşıyla paylaşılabilir.
- **Kişisel veri sınırı:** Fiyat ve fişler kişiye özeldir. Esnaf ve yönetim yalnızca anonim, toplu sayıları görür ("bu hafta X kez arandı" gibi). Kullanıcı listesini ve hesabını silebilir. KVKK aydınlatma metni ilk açılışta gösterilir; LLM sağlayıcısına kullanıcı kimliği gönderilmez.

**Açık konular**
- Perpa yönetiminin dönüşü (haftaya): ortaklık mı, lisans mı, bağımsız mı? QR asma izni ve DWG planları.
- QR'ları kim basıp asacak (yönetim, biz, sponsor)? Basım ve saha maliyeti.
