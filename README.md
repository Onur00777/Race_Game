# Kırmızı Çizgi

WASD ile sürülen, tek oyunculu bir 3D yarış kariyeri prototipi. Beş sürücü üç farklı pistte yarışır. Her etap şampiyona puanı ve para kazandırır. İlk iki yarışı bitirmek yeni takımların kilidini açar. Takımların performans ve ödül avantajları vardır. Kazancınla garajda motoru, lastikleri ve frenleri geliştirebilirsin.

## Çalıştırma

Node.js 20.19+ veya 22.12+ ve WebGL 2 destekleyen bir tarayıcı gerekir.

```sh
npm ci
npm run dev
```

Terminalde görünen yerel adresi aç. Dağıtıma hazır dosyaları oluşturmak için `npm run build` çalıştır.

## Kontroller

- **W / S** — Gaz / fren ve durduktan sonra geri vites
- **A / D** — Sola / sağa dön
- **Ok tuşları** — WASD alternatifi
- **Space** — El freni
- **R** — Son geçerli konumunda piste dön
- **C** — Kamera mesafesini değiştir
- **Esc** — Duraklat / devam et

## Profil ve kayıt

İlk girişte sürücünün adını, başlangıç takımını ve oyun dilini seç. Türkçe ve İngilizce arasında Profil ekranından geçebilirsin.

Kariyer ve açık yarış aynı tarayıcıda, aynı site adresinde otomatik kaydedilir. Yarışta tur, süre, konum, hız, rakipler ve hasar düzenli olarak kaydedilir. Sekmeyi kapatıp ya da sayfayı yenileyip takvimden **Yarışa devam et** ile kaldığın yerden dönebilirsin. Duraklat menüsünde kaydedip takvime dönme ve mevcut yarışı yeniden başlatma seçenekleri var.

Yeni sezonda takvim ve puanlar sıfırlanır. Kazanç, takım erişimi ve yükseltmeler korunur.

## 3D garaj

- **Parçalar** bölümünden motor, lastik, fren ve aerodinamik yükseltmelerini al.
- **Ayarlar** bölümünden dişli oranını, lastik hamurunu, ön ve arka kamberi ve fren dengesini değiştir.
- **Aerodinamik** bölümünde satın aldığın seviyeye göre arka kanat şeklini, açısını ve rengini seç. Kanat açısı arttıkça yere basma kuvveti artar, son hız biraz düşer.
- **Sponsor ve çıkartmalar** bölümünde sözleşme yapıp çıkartmayı kaputa, kapılara veya arka tampona yerleştir. En az bir çıkartma takılıyken yarış bitirirsen sponsor bonusu alırsın.

Aracı sürükleyerek çevir, kaydırarak yakınlaştır veya ön, yan ve arka görünüm düğmelerini kullan. Yarıda kaydedilmiş bir yarış, başladığı takım ve araç ayarlarıyla devam eder. Garaj değişiklikleri sonraki yarışta uygulanır.

## Çarpışma ve hasar

Rakipler darbenin yönüne ve hızına göre savrulur. Bordürün dışındaki çakıl hızını düşürür. Bariyer veya başka bir araçla sert temas, gövdeyi ezer ve yarış sonuna kadar hızlanmayı ve tutuşu azaltır. Gövde durumunu hız göstergesinin altında görebilirsin. Araba bir sonraki yarışa onarılmış olarak çıkar.

Çarpışma testleri için `npm test` çalıştır.

## Görsel varlıklar

Kloppenheim 06 panoraması ve HDR ışık haritası, Asphalt Track, Leafy Grass ve Gravel Floor 02 dokuları Poly Haven'dan alındı, tarayıcı için boyutları küçültüldü ve CC0 kapsamında dağıtılıyor. [Poly Haven lisansı](https://polyhaven.com/license)

- [Kloppenheim 06](https://polyhaven.com/a/kloppenheim_06)
- [Asphalt Track](https://polyhaven.com/a/asphalt_track)
- [Leafy Grass](https://polyhaven.com/a/leafy_grass)
- [Gravel Floor 02](https://polyhaven.com/a/gravel_floor_02)
