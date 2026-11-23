# Kırmızı Çizgi

WASD ile sürülen, tek oyunculu bir 3D yarış kariyeri. Beş sürücü dört farklı pistte yarışır. Her etap şampiyona puanı ve para kazandırır. İlk iki yarışı bitirmek yeni takım transferlerinin kilidini açar.

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
- **L** — Hıza ve yaklaşan viraja göre renk değiştiren ideal çizgiyi aç veya kapat
- **Esc** — Duraklat / devam et

Duraklat menüsünden ideal çizgiyi açıp kapatabilir ve görüntü kalitesini değiştirebilirsin. Ultra, ekran oranına ve donanıma bağlı olarak 3840×2160 piksele kadar görüntü üretir. Yüksek ve Ultra, WebGL desteğine göre MSAA veya SMAA ile kenar yumuşatma ve HDR bloom kullanır.

## Profil ve kayıt

İlk girişte sürücünün adını, başlangıç takımını ve oyun dilini seç. Türkçe ve İngilizce arasında Profil ekranından geçebilirsin.

Kariyer ve açık yarış aynı tarayıcıda, aynı site adresinde otomatik kaydedilir. Yarışta tur, süre, konum, hız, rakipler, zorluk, lastik izleri ve hasar kaydedilir. Sekmeyi kapatıp ya da sayfayı yenileyip takvimden **Yarışa devam et** ile kaldığın yerden dönebilirsin. Duraklat menüsünden takvime dönebilir, hasarı koruyarak yarışı yeniden başlatabilir veya yarıştan çekilebilirsin.

Yeni sezonda takvim ve puanlar sıfırlanır. Kazanç, takım erişimi ve yükseltmeler korunur.

## 3D garaj

- **Parçalar** bölümünden motor, lastik, fren ve aerodinamik yükseltmelerini al.
- **Ayarlar** bölümünden dişli oranını, lastik hamurunu, ön ve arka kamberi ve fren dengesini değiştir.
- **Aerodinamik** bölümünde satın aldığın seviyeye göre arka kanat şeklini, açısını ve rengini seç. Kanat açısı arttıkça yere basma kuvveti artar, son hız biraz düşer.
- **Sponsor ve çıkartmalar** bölümünde sözleşme yapıp çıkartmayı kaputa, kapılara veya arka tampona yerleştir. En az bir çıkartma takılıyken yarış bitirirsen sponsor bonusu alırsın.
- **Servis** bölümünde gövde durumunu, dört bölgenin hasarını ve onarım bedelini gör. Hasarlı bölgeyi seçerek kamerayı o tarafa çevirebilirsin. Araç %0 durumdaysa ve kasadaki para onarıma yetmiyorsa, kalan tutarı gelecek yarış ödüllerinden ödeyebilirsin.

Aracı sürükleyerek çevir, kaydırarak yakınlaştır veya ön, yan ve arka görünüm düğmelerini kullan. Yarıda kaydedilmiş bir yarış, başladığı takım ve araç ayarlarıyla devam eder. Garaj değişiklikleri sonraki yarışta uygulanır.

Parça kartının üzerine gelerek veya klavyeyle odaklanarak sonraki seviyeyi önizle. Yeşil çubuk iyileşmeyi, turuncu çubuk kaybı gösterir. Yükseltmeler kanat ve difüzör, lastik ve diskler veya egzoz üzerinde görünür. Ses açıkken yükseltilmiş motorun tonu değişir. Yeterli hızda gazı bırakmak egzoz patlamasını tetikler.

## Yarış takvimi

Sedir Pisti iki turluk bir gün batımı sprinti, Körfez Virajları dört turluk bir gece yarışı, Zirve Grand Prix altı turluk bir dayanıklılık yarışı ve Marmara GP dört turluk bir öğle yarışı. Takvim, sonraki yarışın haritasını, tur sayısını, hava durumunu ve toplam ödül havuzunu gösterir.

Yarışa başlamadan önce **Kolay (1,00×)**, **Orta (1,25×)**, **Zor (1,60×)** veya **Efsane (2,25×)** seç. Ödül çarpanı sıralama ödülüne uygulanır. Zor ve Efsane rakipler düzlükte hava koridorunu kullanır. Efsane rakipler viraj girişinde fren basıncını kademeli bırakır ve bir rakip arkadan yaklaştığında iç hattı kapatmaya çalışır. Rakiplerin performansı aracın fiziğine ve pistteki trafiğe bağlıdır.

## Çarpışma ve hasar

Sert fren, el freni ve yüksek yanal kayma her teker için ayrı lastik izi, duman ve lastik sesi üretebilir. Rakipler de aynı kayma ve temas modelini kullanır.

Çarpışma hasarı darbenin hızına, açısına ve gövde bölgesine göre değişir. Gövde %70’e kadar tam performans sağlar. %69–40 aralığında son hız, tutuş ve yere basma kuvveti düşer. %39 ve altında motor gücü azalır, asimetrik hasar aracı yana çekebilir. %35’in altında kaput duman çıkarır. %0, ödülsüz ve puansız mekanik arızadır (DNF). Hasar onarılana kadar sonraki yarışa taşınır.

Fizik, kariyer ve kayıt testleri için `npm test` çalıştır.

## Görsel varlıklar

Panoramalar, HDR haritaları ve zemin dokuları Poly Haven'dan alındı, tarayıcı için boyutları küçültüldü ve CC0 kapsamında dağıtılıyor. [Poly Haven lisansı](https://polyhaven.com/license)

- [Kloppenheim 06](https://polyhaven.com/a/kloppenheim_06)
- [Kloppenheim 02](https://polyhaven.com/a/kloppenheim_02)
- [Suburban Field 01](https://polyhaven.com/a/suburban_field_01)
- [Kloppenheim 05](https://polyhaven.com/a/kloppenheim_05)
- [Asphalt Track](https://polyhaven.com/a/asphalt_track)
- [Leafy Grass](https://polyhaven.com/a/leafy_grass)
- [Gravel Floor 02](https://polyhaven.com/a/gravel_floor_02)

Rajdhani ve Plus Jakarta Sans yerel WOFF2 dosyaları olarak sunulur. KC Telemetry, Rajdhani Bold’dan türetilmiş eş genişlikli bir rakam setidir. SIL Open Font License metinleri `public/fonts/` klasöründedir.
