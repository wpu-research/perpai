# PerpAI — Perpa'da yol bulma (3D demo)

Perpa Ticaret Merkezi'nde alışveriş listesini okutup en kısa rotayı çizen ve rotayı 3D olarak oyun gibi yürüten web demosu.

## Çalıştırma

```bash
cd web && python3 -m http.server 8765
# tarayıcıda: http://127.0.0.1:8765
```

Derleme adımı yok. Three.js `0.169.0` CDN'den (jsdelivr) importmap ile yükleniyor, bu yüzden internet bağlantısı gerekir.

## Akış

1. **Giriş:** Perpa'nın ön cephesinin gerçek fotoğrafı gösterilir (Wikimedia, CC BY-SA). Ardından kamera 3D meydana uçar.
2. **Okutma:** Telefon vizöründe el yazısıyla yazılmış liste okutulur. Her kalem, gerçek firma rehberindeki dükkânlarla eşleştirilir. Dükkân seçimi için iki seçenek var: *Uzman firma* ya da *En yakın*.
3. **Rota:** Bina x-ray görünümünde açılır, katlar dikeyde ayrık gösterilir ve çok duraklı en kısa tur (Held-Karp) çizilir.
4. **Yürüyüş:** Karakter rotayı otomatik yürür. Asansör, yürüyen merdiven ve merdivenle kat değiştirir, dükkânlara girip "alışveriş" yapar.
   - Kamera modları: 3. şahıs, göz hizası, kuş bakışı, serbest.
   - Ekranda mini harita, kat çubuğu ve adım adım tarif bulunur.
   - Kısayollar: boşluk = duraklat, 1–4 = kamera, +/− = hız, R = x-ray.
5. **Halil Rıfat Paşa Görevi:** Sapien'in *Komple Teori — "Perpa'nın Kadim Sırrı"* videosundan esinlenen mizahi senaryo. Görev sırası: 3. kattaki Paşa hayaleti → 5. kattaki ulak → gerçek bir Perpa kırtasiyesi → çıkış.

## QR ile konum

- **Linkle başlama:** `/?q=<kod>` demoyu o noktadan başlatır. Örnek: `/?q=D-A11-1350` A Blok 11. kat No 1350'nin önünden açılır.
- **Kod biçimleri:**
  - `GIRIS` · ana giriş
  - `D-<blok><kat>-<no>` · dükkân kapısı
  - `E<asansör>-<kat>` · avlu asansörü
  - `K<kapı>-<kat>` · kapı/merdiven
  - `Y<kuyu><kat>-A|B` · yürüyen merdiven ucu
- **Oyun içinde okutma:** 📷 QR düğmesi kamerayı açar. Tarayıcı destekliyorsa BarcodeDetector, desteklemiyorsa jsQR kullanılır. Kamera yoksa kod ya da "A 1350" elle yazılabilir. Okutulunca konum düzeltilir ve kalan duraklar o noktadan yeniden planlanır.
- **`qr.html`:** Yazdırılabilir kartlar. Demo seti hazır gelir; kat, tür ve aramayla filtrelenir. Kodlar `js/qr.js` dosyasında üretiliyor; toplam ~4.900 konum var.

## Yapı

| Dosya | Görev |
|---|---|
| `web/js/layout.js` | Bina yerleşimi: A ve B blokları, kırmızı hat, 4×2 avlu (sarı/mavi/yeşil), orta salon, 12 kapı-merdiven, 8 avlu asansörü, 2 yürüyen merdiven boşluğu. 1 m'lik yürünebilir ızgara. Kat varyantları: 1–3 garaj, 8 ana giriş, diğerleri normal. |
| `web/js/nav.js` | Dijkstra mesafe alanları, katlar arası bağlantı seçimi (maliyet modeli), yol yumuşatma, TSP, tarif metni |
| `web/js/data.js` | Firma → dükkân slotu yerleşimi (dükkân numarası kata göre artar), liste ayrıştırma, kural tabanlı ürün→sektör eşleştirme |
| `web/js/world.js` | Three.js sahnesi: dış cephe (cam kemerli kule, meydan, metrobüs), detaylı ve sade katlar, tabela atlasları, x-ray |
| `web/js/actors.js` | Avatar, kalabalık, hayaletler, rota okları, x-ray rota çizgileri |
| `web/js/main.js` | Akış, yürüyüş motoru, kameralar, HUD, mini harita |
| `scripts/build_data.py` | `arastirma/veri` klasöründen `web/data/firms.json` dosyasını üretir |
| `arastirma/ANALIZ.md` | Pazar ve veri analizi |

## Veri ve sınırlar

- 2.457 firma (ad, blok, kat, dükkân no, sektör) perpa.com.tr firma rehberinden alındı. Telefon ve e-posta bilgisi web verisine **konmadı**.
- Bina geometrisi resmi kat planlarının mantığından modellendi ve **ölçekli değil**. Firmalar, gerçek numaralarına en yakın slota yerleştirildi; bu yüzden dükkânın binadaki yeri yaklaşık.
- Ürün eşleştirme, anahtar kelime ve sektör kurallarına dayanıyor; LLM kullanılmıyor.
- Yayına almadan önce Perpa yönetiminden veri ve görsel izni alınmalı (bkz. `arastirma/ANALIZ.md` §7).

## Kaynaklar

- Fotoğraflar: CeeGee ve Sezenkerem, Wikimedia Commons (CC BY-SA 4.0 / 3.0)
- Senaryo ilhamı: Sapien — Komple Teori, https://www.youtube.com/watch?v=eaPLrON3r4E (mizah)
- Firma verisi ve kat planları: https://www.perpa.com.tr
