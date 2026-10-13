# 🌸 Çiçekler Senin İçin

Çiçekleri toplayıp sevgiline götürdüğün, seviye seviye ilerleyen 3D mini oyun.
Kız oynarsa karakterin yüzü **kızın**, erkek oynarsa **erkeğin** fotoğrafı olur; çiçekleri diğerine götürür.

- 5 seviye: bahçe → park → arılı vadi → gün batımı (süreli) → yıldızlı gece (süreli)
- Arılara çarparsan bir çiçeği düşürürsün 🐝
- Dünyadaki çerçevelerde ve final ekranında fotoğraflarınız görünür
- Telefon ve bilgisayarda çalışır (ekrana basılı tutup sürükle / WASD / ok tuşları)

## GitHub'a koyma (GitHub Pages)

1. GitHub'da yeni bir repo aç (ör. `cicekler`).
2. Bu klasördeki **tüm dosyaları** (`index.html`, `game.js`, `config.js`, ``) repoya yükle.
3. Repo → **Settings → Pages → Branch: `main` / `(root)` → Save**.
4. Birkaç dakika sonra `https://KULLANICI_ADIN.github.io/cicekler/` adresinde oyun hazır. Linki sevgiline gönder 💕

> Not: Fotoğraflar herkese açık repoda herkese açık olur. Özel kalsın istiyorsan repoyu **private** yap (GitHub Pages için ücretli plan gerekebilir) ya da linki sadece sevgilinle paylaş ve repoyu public yapmadan önce düşün.

## Bilgisayarda deneme

Dosyayı çift tıklayıp açmak **çalışmaz** (tarayıcı kısıtı). Klasörde:

```bash
python3 -m http.server 8000
```

sonra `http://localhost:8000` adresini aç.

## Kişiselleştirme

Hepsi `config.js` içinde:

- `ad`: Karşı tarafa hitap ("Sevgilim" yerine gerçek isim yazabilirsin)
- Seviye mesajları, çiçek / engel / arı sayıları, süre, harita büyüklüğü
- `finalMesaj`: Son sürpriz mesajı
- Yüz fotoğrafları: `erkek.jpg` ve `kiz.jpg` — aynı adla kendi **kare kırpılmış yüz** fotoğraflarını koyarsan karakterin yüzü değişir
- Çerçevedeki / final ekranındaki fotoğraflar: `emaar.jpg`, `otobus.jpg` (`fotolar` listesi)

Oyun Three.js'i internetten (jsDelivr CDN) yükler, kurulum gerekmez.
