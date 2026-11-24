# Kırmızı Çizgi

WASD ile sürülen, tek oyunculu bir 3D yarış kariyeri. Beş sürücü, sprintlerden 15 turluk dayanıklılık yarışına uzanan altı pistte yarışır. Her etap şampiyona puanı ve para kazandırır. İlk iki yarışı bitirmek yeni takım transferlerinin kilidini açar.

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
- **T** — Çekiş kontrolü takılıysa kapalı, düşük, orta ve yüksek mod arasında geçiş yap
- **P** — Sonraki pit stop için lastik ve onarım seç
- **Esc** — Duraklat / devam et

Duraklat menüsünden ideal çizgiyi açıp kapatabilir ve görüntü kalitesini değiştirebilirsin. Ultra, ekran oranına ve donanıma bağlı olarak 3840×2160 piksele kadar görüntü üretir. Yüksek ve Ultra, WebGL desteğine göre MSAA veya SMAA ile kenar yumuşatma ve HDR bloom kullanır.

## Profil ve kayıt

İlk girişte sürücünün adını, başlangıç takımını ve oyun dilini seç. Türkçe ve İngilizce arasında Profil ekranından geçebilirsin.

Kariyer ve açık yarış aynı tarayıcıda, aynı site adresinde otomatik kaydedilir. Kayıt turu, konumu, rakipleri, zorluğu, gövde durumunu, lastik izlerini, hava ve lastik durumunu, aktif pit servisini ve yarış kontrolü kararlarını içerir. Sekmeyi kapatıp ya da sayfayı yenileyip takvimden **Yarışa devam et** ile kaldığın yerden dönebilirsin. Duraklat menüsünden takvime dönebilir, aracı yarışa başladığı duruma döndürerek yarışı yeniden başlatabilir veya yarıştan çekilebilirsin.

Yeni sezonda takvim ve puanlar sıfırlanır. Kazanç, takım erişimi ve yükseltmeler korunur.

## 3D garaj

- **Parçalar** bölümünden motor, lastik, fren ve aerodinamik yükseltmelerini al.
- **Ayarlar** bölümünden dişli oranını, lastik hamurunu, ön ve arka kamberi ve fren dengesini değiştir.
- **Aerodinamik** bölümünde satın aldığın seviyeye göre arka kanat şeklini, açısını ve rengini seç. Kanat açısı arttıkça yere basma kuvveti artar, son hız biraz düşer.
- **Sponsor ve çıkartmalar** bölümünde sözleşme yapıp çıkartmayı kaputa, kapılara veya arka tampona yerleştir. En az bir çıkartma takılıyken yarış bitirirsen sponsor bonusu alırsın.
- **Servis** bölümünde gövde durumunu, dört bölgenin hasarını ve onarım bedelini gör. Hasarlı bölgeyi seçerek kamerayı o tarafa çevirebilirsin. Araç %0 durumdaysa ve kasadaki para onarıma yetmiyorsa, kalan tutarı gelecek yarış ödüllerinden ödeyebilirsin.
- **Elektronik** bölümünde kalkış kontrolü, çekiş kontrolü, ABS ve aktif diferansiyel için üçer seviye var. Kalkışta gazı tutarak LC devrini sabitle. TC patinajda torku, ABS kilitlenmede her tekerin basıncını ayarlar. HUD, müdahaleleri gösterir.

Aracı sürükleyerek çevir, kaydırarak yakınlaştır veya ön, yan ve arka görünüm düğmelerini kullan. Yarıda kaydedilmiş bir yarış, başladığı takım ve araç ayarlarıyla devam eder. Garaj değişiklikleri sonraki yarışta uygulanır.

Garajda **Geniş görünüm**, stüdyoyu pencereye yayar. **Ultra**, donanım ve ekran oranı elverdiğinde 4K’ya kadar çıkar. Stüdyo, otomobil boyasında yumuşak kutu ışıklarının HDR yansımalarını kullanır.

Özel gövde için doku ve verileri içinde olan bir `.glb` dosyasını `public/models/` dizinine koy ve aynı dizindeki `car.json` dosyasının `model` alanına dosya adını yaz. Gövdeyi `Body` düğümünde grupla. Model metre cinsinden, araç önü +Z, yukarısı +Y ve zemin Y=0 olacak şekilde ortalanmalı. Referans genişlik 1,98 m, uzunluk 4,28 m. Teker merkezleri X=±0,828 m, Y=0,365 m ve Z=−1,29/+1,34 m. İsteğe bağlı `Cabin` kendi malzemeleriyle gelir. `WingMount`, `FrontMount` ve `RearMount` düğümleri uç konumları hizalar. Teker, fren, kanat, hasar ve çıkartmalar oyun tarafından uygulanır. Geçersiz modelde yerleşik gövde yüklenir.

Parça kartının üzerine gelerek veya klavyeyle odaklanarak sonraki seviyeyi önizle. Yeşil çubuk iyileşmeyi, turuncu çubuk kaybı gösterir. Yükseltmeler kanat ve difüzör, lastik ve diskler veya egzoz üzerinde görünür. Ses açıkken yükseltilmiş motorun tonu değişir. Yeterli hızda gazı bırakmak egzoz patlamasını tetikler.

## Yarış takvimi

Sedir Pisti iki turluk bir gün batımı sprinti, Körfez Virajları dört turluk bir gece yarışı, Zirve Grand Prix altı turluk bir dayanıklılık yarışı ve Marmara GP dört turluk bir öğle yarışı. Sezon, 10 turluk Kuzey 10 ve 15 turluk Boğaz 15 ile tamamlanır. Takvim sonraki yarışın haritasını, tur sayısını, hava tahminini ve ödül havuzunu gösterir.

Yarışa başlamadan önce **Kolay (1,00×)**, **Orta (1,25×)**, **Zor (1,60×)** veya **Efsane (2,25×)** seç. Ödül çarpanı sıralama ödülüne uygulanır. Zor ve Efsane rakipler düzlükte hava koridorunu kullanır. Efsane rakipler viraj girişinde fren basıncını kademeli bırakır ve bir rakip arkadan yaklaştığında iç hattı kapatmaya çalışır. Rakiplerin performansı aracın fiziğine ve pistteki trafiğe bağlıdır.

## Lastik stratejisi ve yarış kontrolü

- Takvimde kırmızı **Yumuşak**, sarı **Orta**, beyaz **Sert** ve mavi **Yağmur** lastikleri arasından seç. Yumuşak lastik yüksek tutuş karşılığında hızlı aşınır. Yağmur lastiği ıslakta avantajlıdır, kuruda ısınıp hızla aşınır. Her tekerin ömrü mesafe, viraj yükü, fren ve patinajla değişir.
- **P** ile pit planını seç. Ayrılan girişte mavi çizgiyi takip et ve garajların önündeki sarı servis alanında tamamen dur. 80 km/sa sınırı giriş çizgisinde otomatik devreye girer. Beyaz çizgiyi izleyerek pit çıkışından piste birleş. Lastik değişimi patlağı onarır. Gövde onarımını da seçersen süspansiyon ve aerodinamik parçalar onarılır, servis daha uzun sürer.
- **Sarı bayrakta** olay bölgesinde 80 km/sa sınırı ve geçiş yasağı var. İhlal 3 sn ceza getirir. **Kırmızı bayrakta** süre durur. Lastik değiştirebilir, en fazla 18 puan gövde hasarını onarabilir ve kalan turlar için durarak yeniden başlayabilirsin.

## Çarpışma ve hasar

Sert fren, el freni ve yüksek yanal kayma her teker için ayrı lastik izi, duman ve lastik sesi üretebilir. Rakipler de aynı kayma ve temas modelini kullanır.

Çarpışma hasarı darbenin hızına, açısına ve gövde bölgesine göre değişir. Gövde %70’e kadar tam performans sağlar. %69–40 aralığında son hız, tutuş ve yere basma kuvveti düşer. %39 ve altında motor gücü azalır, asimetrik hasar aracı yana çekebilir. %35’in altında kaput duman çıkarır. %0, ödülsüz ve puansız mekanik arızadır (DNF). Hasar onarılana kadar sonraki yarışa taşınır.

Hız göstergesinin yanındaki araç şemasından gövde bölgelerini, dört tekerin durumunu ve motor sıcaklığını inceleyebilirsin. Teker kartları ayrı ayrı ömür ve sıcaklık gösterir. Islak yüzey lastikleri soğutur, yüksek yük ve patinaj ısıtır. Motor 110°C’yi aştığında kaputtan buhar çıkar ve güç kademeli düşer.

Sert bir köşe darbesi süspansiyonu bozabilir, lastiği patlatabilir veya tekeri koparabilir. Patlakla düşük hızda pite dönebilirsin. Tekerin kopması mekanik DNF’dir. Arka kanat koptuğunda kanadın yere basma kuvveti kaybolur.

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
