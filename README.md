# Race Game

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

Kariyer otomatik olarak aynı tarayıcıda kaydedilir. Yeni sezonda takvim ve puanlar sıfırlanır. Kazanç, takım erişimi ve yükseltmeler korunur.

## Sonraki adımlar

1. Bir arabanın ve Sedir Pisti'nin görsel kalitesini yükselt. Ayrıntılı araç modeli, asfalt ve çevre malzemeleri, pist kenarı objeleri ve çeşitlemeli motor sesi ekle.
2. Sürüşü diferansiyel, lastik kayması, vites oranları ve oyun kumandasıyla derinleştir. Tur zamanı ve hayalet araçla ayarların etkisini ölçülebilir kıl.
3. Kariyeri sıralama turları, takım hedefleri ve sezonlar arası sözleşmelerle genişlet.

İlk sürümde araç ve pistler kodla üretilir. Sürüş modeli arcade ağırlıklıdır.
