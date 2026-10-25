# Perpa saha testi (PerpAI 0.5)

Amaç: kamerayla yürümenin gerçek binada ne kadar isabetli olduğunu ölçmek. Ölçülecekler:
- adım boyu,
- pusula yönü,
- sesli komutların zamanlaması,
- QR'da konum sapması.

Süre yaklaşık 1,5 saat.

## Hazırlık
1. Telefona son APK'yı kur (`PerpAI-0.5.0.apk`). Kamera iznini ver.
2. Telefonda Türkçe ses paketinin kurulu olduğunu kontrol et: Ayarlar › Erişilebilirlik › Metin okuma çıktısı.
3. `web/qr.html` sayfasından şu QR kartlarını A4'e bas:
   - `GIRIS`
   - `E19-8`
   - `YK8-A`
   - `D-A7-1000`
   - `D-A11-1350`
   - `D-B5-125`
   - `D-B8-953`

   Asmana gerek yok: ilgili dükkânın kapısında ya da asansörün önünde kartı elinde tut ve kameraya göster.
4. Kulaklık takarsan sesli komutları kalabalıkta daha rahat duyarsın.

## Test 1: Adım boyu (10 dk)
1. 8. kat ana girişte "Kamerayla yürü"yü aç.
2. Sağ üstteki kırmızı **kayıt** düğmesine bas.
3. `GIRIS` kartını kameraya göster.
4. Rotayı izleyerek 8. kattaki bir dükkâna yürü (ör. `D-B8-953`, ~140 m).
5. Kapıda o dükkânın kartını göster.

Uygulama iki QR arasındaki yolu attığın adım sayısına böler ve adım boyunu kendisi ayarlar. Ekranın altındaki "Adım … m" değeri değişir. Testi aynı yoldan bir kez daha tekrarla.

## Test 2: Yön oku (15 dk)
1. Girişte "Yönü ayarla"ya dokunmadan önce `GIRIS` kartını kameraya göster. Bu, yönü kendiliğinden ayarlar.
2. Yürürken ok her köşede doğru tarafı gösteriyor mu, not al. Telefonu dik tut, kamera önüne baksın.
3. Bilerek ters yöne dön: 3 saniye içinde "Ters yöne bakıyorsunuz" uyarısı gelmeli.
4. Okun saptığı yerleri yaz: hangi kat, hangi koridor. Demir doğrama ve yürüyen merdivenlerin yakınında pusula sapabilir.

## Test 3: Tam liste (45 dk)
1. Hazır "Güvenlik kamerası kurulumu" listesini oluştur.
2. Rotayı çiz → Navigasyonu başlat → Kamerayla yürü.
3. Kaydı açık tut. Her durakta "Alışverişe geç" de, fiyat girmeden kaydet ve sonraki durağa kamerayla devam et.
4. Kat değişimlerinde ("Yürüyen merdivenle 7. kata inin") bindiğin yeri ve vardığında "kata vardım"ı not al.
5. Her dükkân kapısında, varsa o dükkânın QR kartını göster. Bu, konum sapmasını ölçer.

## Bitince
- Kayıt düğmesine tekrar bas: kayıt sunucuya gider ("Test kaydı gönderildi").
- Notlarını bana yaz:
  - okun yanlış gösterdiği yerler,
  - geç ya da erken gelen sesli komutlar,
  - kafa karıştıran cümleler,
  - bulunamayan dükkânlar.
- Kayıtları ben Railway günlüğünden (`railway logs --service perpai-api`, `TRACE` satırları) okuyup şunları çıkaracağım:
  - adım boyu,
  - QR'daki ortalama konum sapması (metre),
  - ters yön uyarılarının sayısı,
  - elle ±5 m düzeltme sayısı.

## Kayıtta ne var, ne yok
- **Kayıtta olanlar:**
  - zaman,
  - adım olayları,
  - saniyede bir pusula yönü ve rota üzerindeki ilerleme,
  - okunan QR kodu ve tahmini konumun ondan sapması,
  - yön ayarı ve ±5 m düzeltmeleri.
- **Kayıtta olmayanlar:** kamera görüntüsü, ses, GPS, kişisel bilgi.
- Kayıt yalnızca kırmızı düğmeye basınca başlar.
