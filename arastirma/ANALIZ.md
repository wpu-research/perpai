# PerpAi — Perpa Ticaret Merkezi Yol Bulma Projesi: Ön Analiz

> Tarih: 2026-10-23 · Kaynak: perpa.com.tr (resmi site, firma rehberi, harita), basın haberleri, sektör araştırması.
> Ham veri: `arastirma/veri/`, kat planları: `arastirma/kat-planlari/`, tahliye krokileri: `arastirma/tahliye-krokileri/`.

## 1. Kısa özet

- Perpa sanıldığı gibi "bin küsur" değil, **~4.700 dükkânlı**, **13 katlı**, **A ve B olmak üzere iki bloklu** tek parça bir yapı. 492.000 m² kat alanı var, tamamını yürümek ~38 km tutuyor ve günde 40–50 bin kişi geliyor.
- Basında esnafın bile binayı "4-5 yılda çözdüğü", ziyaretçinin 3 saat kaybolduğu yazıyor. Yani problem gerçek ve herkesçe biliniyor.
- **Resmi sitede hazır, yapılandırılmış veri var:** 2.458 firma kaydı (blok, kat, dükkân no, hat/avlu, giriş katı, sektör) var, her firmanın **kat planı üzerinde piksel koordinatı** tutuluyor ve 13 katın 4429×2000 px izometrik planı mevcut.
- **Eksik olan şey rota.** Bugünkü harita yalnızca tek bir firmayı işaretliyor. Ne "buradan oraya nasıl giderim" sorusuna ne de "şu 6 dükkânı en kısa yoldan gez" ihtiyacına cevap veren bir araç var. Yandex/Google'ın iç mekân navigasyonu da Perpa'yı kapsamıyor.
- Önerim: **v1 GPS'siz ve donanımsız olsun.** Kullanıcı "şu an buradayım" bilgisini kapı numarası, dükkân numarası ya da kolonlara asılacak QR ile verir. Alışveriş listesi çok duraklı en kısa rotaya çevrilir ve rota mevcut izometrik plan üzerine çizilir.

## 2. Perpa'nın temel rakamları

| Metrik | Değer | Kaynak |
|---|---|---|
| Dükkân sayısı | 4.707 (basında "4.500+") | Gazete Birlik, Medyascope |
| Kat | 13 (1–13). Planlarda 0 ve bodrum kat yok | perpa.com.tr kat planları |
| Blok | A Blok + B Blok (yan yana, tek monoblok) | perpa.com.tr |
| Zemin / toplam kat alanı | 44.000 m² / 492.000 m² | Medyascope |
| Günlük ziyaretçi | 40–50 bin (bir kaynakta 50 bin+) | Medyascope, Gazete Birlik |
| Çalışan | 20–25 bin | Medyascope, Gazete Birlik |
| Araç sirkülasyonu | ~14.000 | Gazete Birlik |
| Yıllık ticaret hacmi | ~10 milyar $ | Medyascope (Kooperatif bşk. Atakan Yücel) |
| Doluluk | %98 | Gazete Birlik (B Blok bşk. Hacı Demir) |
| Banka şubesi | 12 | Medyascope |
| Yaş | 40 (1980'lerde Karaköy Perşembe Pazarı'nın taşınmasıyla kuruldu) | Medyascope |

**Yönetim:** Resmi adı *S.S. Karaköy Perşembe Pazarı Tüccarları Toplu İşyeri Yapı Kooperatifi*. Ayrıca A ve B blokların ayrı Kat Malikleri Yöneticilikleri var. Kooperatif yönetim kurulu başkanı Atakan Yücel, B Blok başkanı Hacı Demir. **Ürünün muhatabı bu yapı olacak.**

## 3. Binanın "mantığı": yol bulmanın anahtarı

Planları ve firma verisini birlikte inceleyince bina, kurallı bir koordinat sistemi gibi çalışıyor:

1. **Tripleks dükkânlar.** Katlar üçlü gruplar halinde: **1-2-3, 4-5-6, 7-8-9, 10-11-12**. 13. kat tek başına. Tasarım "alt kat depo (araç yanaşır), orta kat teşhir, üst kat ofis" mantığına dayanıyor. Firmaların %41'i (1.014 kayıt) birden fazla katta kayıtlı, bu nedenle verideki "Giriş Katı" alanı müşterinin hangi kattan gireceğini söylüyor.
2. **Ana katlar 2, 5, 8, 11, 13.** Yaya trafiği bu katlarda. **Araçla çıkılabilen katlar 2, 4, 7 ve 10.** Ziyaretçilerin en çok kullandığı ana giriş **8. katta**.
3. **Hatlar.** Her katta dış çevreyi saran bir **KIRMIZI HAT** var. İç kısımda avlular (ışıklıklar) çevresinde **SARI, MAVİ ve YEŞİL AVLU** bölgeleri yer alıyor. 60 firmalık örneklemin yarısı kırmızı hatta, kalanı avlularda. Planlarda renkler birebir boyanmış.
4. **Dükkân numarası katı ele veriyor.** Her blokta numaralar kata göre artıyor:

   | Kat | A Blok no aralığı | B Blok no aralığı |
   |---|---|---|
   | 1-2-3 | 1–38 | 2–98 |
   | 4–6 | ~49–681 | ~101–819 |
   | 7–9 | ~688–1312 | ~821–1549 |
   | 10–12 | ~1321–1945 | ~1550–2265 |
   | 13 | 1959–2161 | 2272–2570 |

   Dolayısıyla **"B 1450" yazan biri 9. kat B Blok'u arıyor demektir.** Aynı numara iki blokta da bulunabildiği için ürün blok bilgisini her zaman sormalı.
5. **Dikey bağlantılar.** Planlarda numaralı **1–12 arası kapılar/merdiven çekirdekleri**, **13–28 arası avlu asansörleri** (her avluda bir tane), **29–36 arası ara asansör çiftleri**, yürüyen merdivenler (iki bloğu ayıran orta koridorda) ve yangın merdivenleri gösteriliyor. Rota motorunda katlar arası kenarlar bunlar olacak.
6. Planlarda "Carrefour SA girişi", banka, büfe, WC, danışma ve güvenlik noktaları da işaretli. Bunlar ilgi noktası (POI) olarak hazır kullanılabilir.

## 4. Mevcut dijital varlıklar (kullanılabilir veri)

### 4.1 perpa.com.tr firma rehberi
- Listede **2.458 firma** var: B Blok'ta 1.400, A Blok'ta 1.058. Bu, dükkânların yaklaşık **%52'si**. Kalanların kaydı yok.
- Her kayıtta blok, kat, dükkân no, hat/avlu, giriş katı, telefon, e-posta, UAVT adres kodu, sektör(ler) ve ürünler bulunuyor.
- **82 sektör** var ve toplam 6.156 sektör etiketi atanmış (bir firma birden çok sektörde olabiliyor). İlk 10 sektör: Elektrik ekipmanları (463), Bilgi teknolojileri (371), Telekomünikasyon (292), Teknik hırdavat (258), Makina ve ekipmanları (234), İşletme destek hizmetleri (224), Mimarlık ve mühendislik (224), Bilgi-iletişim-medya (187), Aydınlatma (176), Elektrikli ev aletleri (157). Tam liste `veri/sektorler.txt` dosyasında.
- Katlara göre firma yoğunluğu: 1–3. katlarda ~105, 4–12. katlarda 350–425 arası, 13. katta 269. Yani müşteri trafiği 4–13. katlarda toplanıyor.
- **Veri tazeliği sorunu:** 60 firmalık örneklemde kayıtların **%38'i 2014–2016'dan beri güncellenmemiş**, %33'ü 2021'de güncellenmiş. Taşınan ve kapanan firmalar büyük ihtimalle hâlâ listede duruyor.
- `robots.txt` firma, harita ve plan yollarını engellemiyor. Bu analiz için liste sayfaları istekler arasında 1,5 sn beklenerek tarandı (30 istek), ayrıca 60 detay sayfası çekildi.

### 4.2 Harita (`perpa.com.tr/map`)
- Altyapı **Mapplic** (jQuery tabanlı ticari bir harita eklentisi). `GET /map/plan?company_id=X&floor=N` çağrısı JSON döndürüyor: kat görseli + firmanın normalize `x,y` koordinatı.
- **Koordinatlar doğru.** 10. kat örneğinde 15 firmanın noktası plandaki doğru numaralı dükkânın üzerine düşüyor (`veri/koordinat-dogrulama-kat10.jpg`).
- Haritanın yaptığı tek şey işaretlemek. Rota, çoklu seçim, "neredeyim" ya da katlar arası geçiş özelliği yok.
- Kat planları 3D izometrik render olarak sunuluyor (`floor-1.jpg … floor-13.jpg`, 4429×2000). Görsel olarak çok anlaşılır, ancak metrik değiller: perspektif nedeniyle mesafe ölçmeye uygun değiller.

### 4.3 Tahliye krokileri
- 14 adet 2D CAD çıktısı var (YSC, yangın dolabı, acil çıkış işaretli). İnternetteki halleri yalnızca 800 px, ama gerçek metrik geometri bunlarda. **Orijinal DWG dosyaları yönetimden istenirse** yürünebilir koridor grafı doğrudan çıkarılabilir.

### 4.4 Mobil uygulamalar
- Android uygulaması `com.perpaportal.perpa` ("PERPA Ticaret Merkezi Resmi Android Uygulaması"): 5 bin+ indirme, **3,8★ / 78 yorum**, son güncelleme 10 Ağu 2026.
- iOS uygulaması "Perpa Ticaret Merkezi": son sürüm 4 Şub 2026, yalnızca 1 değerlendirme var.
- Basında geçen "bina içi navigasyon sistemi" büyük ihtimalle bu harita ve uygulama ikilisi. **Kullanım düşük; rotalama ve alışveriş listesi yok.**

## 5. Pazar ve rakipler: kimler var?

### 5.1 Doğrudan Perpa'yı kapsayan bir çözüm
- **Yok.** Yandex Haritalar ve Navi'nin iç mekân rotası İstanbul ve Ankara'da 22 AVM'de çalışıyor (Mall of İstanbul, Zorlu, Galataport, Cevahir, Kanyon, Vadistanbul, Forum, Akasya, İstinyePark, ÖzdilekPark, Maltepe Park, Anka Mall, Cepa…). Listede Perpa yok.
- Google ve Apple Haritalar'da da Perpa için iç mekân haritası bulunamadı. *(Bu yalnızca arama sonuçlarına dayanıyor, sahada telefonla kontrol edilmeli.)*

### 5.2 Türkiye'deki iç mekân navigasyon şirketleri
| Şirket | Ne yapıyor | Not |
|---|---|---|
| **Pointr** | İç mekân haritalama, BLE konumlama, analitik. Londra merkezli, Türk kurucular, yazılım ekibinin çoğu İstanbul ve Ankara'da | Reem Mall (Abu Dhabi, 10 kat). Kurumsal ve pahalı. Potansiyel ortak ya da rakip |
| **inMapper** | İnteraktif iç mekân harita platformu | Zorlu Center, Atlaspark, Anatolium Bursa, THY uygulaması |
| **Başarsoft** | Manyetik alan tabanlı, patentli yerli iç mekân navigasyonu | Kurumsal/B2B, GIS geçmişi var |
| **İndoora** | Beacon tabanlı iç mekân navigasyonu (2014) | Bugün aktif olup olmadığı doğrulanamadı |
| **Yandex** | Haritalar ve Navi içinde AVM iç rotası | 22 AVM. Perpa yok |

### 5.3 Yurt dışı platformlar ve SDK'lar
- **Mappedin:** Harita editörü + web/iOS/Android SDK, ücretsiz katman var. **Çok duraklı rota optimizasyonu ve alışveriş listesi senaryosunu doğrudan pazarlıyor.** Altyapı olarak en hızlı seçenek bu.
- **Situm, Navigine, IndoorAtlas (manyetik), Mapsted (donanımsız), Crowd Connected (BLE, 2–3 m), Cisco Spaces (Wi-Fi, 5–8 m), MazeMap (üniversiteler).** Doğruluk rakamları üreticilerin kendi beyanları.
- **Konsept olarak en yakın örnekler:** PLOVITI (Almanya; alışveriş listesinden raflar arası en kısa rota, AVM ve fuar hedefliyor), Albert Heijn + Aisle411 + Philips pilotu, ayrıca Walmart'ın "alışveriş listesinden optimum rota" patenti (US 10572932). Patent market rafı odaklı ama yine de hukuki kontrol yapılmalı.

**Fark yaratacak nokta:** Rakiplerin hepsi genel amaçlı iç mekân haritası satıyor. Perpa'nın kendine özgü ihtiyaçları ise şunlar: (1) **ürün bazlı arama** (müşteri firmayı değil "RJ45 konnektör", "M8 civata", "IP kamera" arar), (2) **çok katlı ve tripleks bir binada katlar arası rota**, (3) **toptancı/esnaf kitlesi**. Genel çözümler bu üçünü birlikte karşılamıyor.

## 6. Ürün konsepti (öneri)

**Kullanıcı akışı:**
1. Kullanıcı listesini girer. Bu serbest metin olabilir ("2 adet 12V adaptör, cat6 kablo, kamera kaydedici"), firma adı olabilir ya da "B 1450" gibi bir dükkân numarası olabilir.
2. Bir LLM ve arama katmanı her kalemi **sektör ve ürün** üzerinden aday dükkânlara eşler. Firmaların "ürünler" alanı ve 82 sektör buna temel oluşturur. Kullanıcı her kalem için dükkânı seçer ya da sistem "en yakın/en uygun" olanı önerir.
3. Kullanıcı başlangıç noktasını belirtir: geldiği kapı (metrobüs / 8. kat ana giriş / otopark katı) ya da en yakın dükkânın numarası. İsterse **kolonlardaki QR kodu** okutur.
4. Sistem **çok duraklı en kısa turu** hesaplar (TSP; 10–15 durak için tam çözüm veya 2-opt yeterli). Katlar arası geçişler asansör, yürüyen merdiven ve merdiven maliyetleriyle hesaba katılır. Tripleks dükkânlarda giriş katı esas alınır. İsteğe bağlı olarak "en son otoparka / çıkışa dön" seçeneği eklenir.
5. Her bacak, **mevcut izometrik kat planının üzerine** çizilir: "Kırmızı hattan sarı avluya geç, 17 nolu asansörle 11. kata çık…". Talimatlar kullanıcının zaten tanıdığı hat, avlu ve kapı numarası diliyle verilir.

**Neden izometrik görsel üzerinde rota?** Firma koordinatları zaten bu görselin piksel uzayında. Her katın koridorları aynı uzayda düğüm-kenar grafı olarak çizilirse (kat başına yaklaşık birkaç yüz düğüm), çizim de rota da doğrudan bu görsel üzerinde yapılabilir. Metrik doğruluk sonradan DWG'den kalibre edilir. Görsel dil Perpa'nın kendi işaretleriyle de birebir uyumlu olur.

**Konumlama yol haritası:**
- **v1:** Donanım yok. Kullanıcı konumunu kapı, dükkân numarası ya da QR ile verir. Monoblok betonda GPS çalışmaz. QR maliyeti neredeyse sıfır, kesinliği ise %100.
- **v2:** Adım sayarlı (PDR) "canlı mavi nokta" ve her QR okutmada konumun yeniden düzeltilmesi.
- **v3:** BLE beacon (avlu ve kapı başına, yaklaşık 200–400 adet) ya da manyetik parmak izi (IndoorAtlas, Başarsoft). Bunun için yönetim onayı ve bütçe gerekir.

**İş modeli seçenekleri:** Perpa yönetimine B2B lisans (resmi uygulamanın yerine geçebilir ya da ona modül olarak eklenebilir), firmalara öne çıkan listeleme, reklam (sitede zaten "reklam alanı" satılıyor) ve veri güncelleme aboneliği. **En güçlü argüman bir veri döngüsü kurmak:** esnaf kendi kaydını QR ve WhatsApp üzerinden güncel tutar, bugünkü "%38'i 10 yıllık" sorunu böylece çözülür.

## 7. Riskler ve açık sorular
- **Veri ve görsel hakları.** Kat planları ve firma rehberi Perpa'ya ait. Prototipte kullanılabilir ama yayına alınmadan önce **yönetimle anlaşma şart**. Firma telefon ve e-postaları KVKK açısından da dikkat gerektirir.
- **Kapsama.** Dükkânların ancak yarısı kayıtlı ve kayıtların bir kısmı eski. Sahada doğrulama ya da esnafın kayıt olmasını sağlayacak bir mekanizma gerekli.
- **Rota grafı emeği.** 13 kat × 2 blok için koridor grafını elle çizmek birkaç günlük iş. DWG elde edilirse süre kısalır.
- **Bina kuralları.** Hangi yürüyen merdiven hangi yöne gidiyor, asansörler hangi saatlerde açık, araç ve yaya ayrımı nasıl? Bunlar sahada öğrenilmeli.
- **Kullanıcı kitlesi.** Ziyaretçilerin önemli bir kısmı toptancı ve teknisyen. Telefonu hızlı kullanıyorlar ama uygulama indirmeyebilirler. **Kurulum gerektirmeyen bir web uygulaması (PWA) ve QR** bu yüzden kritik.

## 8. Önerilen sonraki adımlar
1. **Saha ziyareti (yarım gün):** 8. kat ana girişten başlayıp 3–4 dükkânlık bir liste yürünür. Yürüyen merdiven yönleri ve asansör numaraları fotoğraflanır. Kolonlarda QR için uygun yerler belirlenir.
2. **Prototip (1–2 hafta):** Tüm firma koordinatları çekilir (≈2.458 istek, nazik tarama). 2–3 katın koridor grafı çizilir. Liste girişi, TSP ve izometrik plan üzerinde rota çizimi gösteren bir web demosu hazırlanır.
3. **Yönetim sunumu:** Kooperatif (Atakan Yücel) ve B Blok yönetimi (Hacı Demir) ile görüşülür. Demo + "resmi uygulamanıza rota ve alışveriş listesi modülü" teklifi götürülür. DWG ve veri izni istenir.
4. Altyapı kararı: kendi rota motorumuz mu (önerim bu: veri basit, maliyet sıfır) yoksa Mappedin/Pointr gibi bir SDK mı?

## Kaynaklar
- Perpa resmi site ve firma rehberi: https://www.perpa.com.tr · harita: https://www.perpa.com.tr/map · sektörler: https://www.perpa.com.tr/sector
- Tahliye krokileri: https://www.perpa.com.tr/posts/view/817/acil-durum-plani-katlarin-tahliye-krokileri
- Medyascope, "İstanbul'daki gizli ekonomi: Perpa 40 yaşında" (17.01.2026): https://medyascope.tv/2026/01/17/perpa-40-yasinda-istanbuldaki-gizli-ekonomi/
- Gazete Birlik, "Türkiye ekonomisine yön veren devasa labirent: Perpa": https://www.gazetebirlik.com/turkiye-ekonomisine-yon-veren-devasa-labirent-perpa
- Ekonomi Gazetesi, "Perpa'da kapasite 10 milyar dolar": https://www.ekonomigazetesi.com/kose-yazisi/perpada-kapasite-10-milyar-dolar-gorunuyor-teknoloji-merkezi-yolunda-ilerliyor-42573
- Android uygulaması: https://play.google.com/store/apps/details?id=com.perpaportal.perpa
- Yandex iç mekân AVM rotaları: https://www.chip.com.tr/haber/yandex-maps-ve-naviye-alisveris-merkezlerinin-mekan-ici-rotalari-eklendi_183638.html
- Pointr: https://en.wikipedia.org/wiki/Pointr · https://www.pointr.tech/company
- inMapper: https://webrazzi.com/2019/07/12/inmapper-ic-mekan-harita/
- Başarsoft iç mekân: https://www.capital.com.tr/sirket-panosu/sirket-panosu-haberleri/navigasyonu-kapali-mekana-sokuyor
- İndoora: https://webrazzi.com/2017/07/27/indoora/
- Mappedin perakende/market yol bulma: https://www.mappedin.com/resources/blog/applications-for-retail-wayfinding/
- İç mekân konumlama karşılaştırması: https://www.crowdconnected.com/blog/best-indoor-positioning-systems/
- PLOVITI: https://www.tuhh.de/tuhh/en/research-and-transfer/knowledge-and-technology-transfer/translate-to-alternative-neues-aus-dem-transfer/ploviti-develops-smart-indoor-navigation-app
- Walmart optimum alışveriş rotası patenti: https://patents.justia.com/patent/10572932
