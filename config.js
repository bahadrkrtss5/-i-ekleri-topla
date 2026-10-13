// =====================================================
//  ÇİÇEKLER SENİN İÇİN — ayar dosyası
//  Burayı istediğin gibi değiştir: isimler, mesajlar, seviyeler, fotoğraflar.
// =====================================================

export const CONFIG = {
  baslik: 'Çiçekler Senin İçin',
  altBaslik: 'Çiçekleri topla, sevgiline götür 💐',

  // "ad": oyunda karşı tarafa hitap şekli ({alan} yerine bu gelir).
  // Kendi isimlerinizi buraya yazabilirsiniz (ör. ad: 'Elif').
  // "yuz": karakterin yüzü olacak fotoğraf (assets klasöründe, kare kırpılmış yüz).
  erkek: { etiket: 'Erkek', ad: 'Sevgilim', yuz: 'erkek.jpg' },
  kiz:   { etiket: 'Kız',   ad: 'Sevgilim', yuz: 'kiz.jpg' },

  // Dünyada duran fotoğraf çerçevelerinde ve final ekranında görünen fotoğraflar
  fotolar: ['emaar.jpg', 'otobus.jpg'],

  // Tüm mesajlarda {alan} = çiçeği alan kişinin adı, {veren} = çiçeği veren kişinin adı
  seviyeler: [
    {
      ad: 'Bahçede İlk Adım',
      tema: 'gun',        // gun | gunbati | gece
      cicek: 5,           // toplanacak çiçek sayısı
      engel: 4,           // ağaç / kaya / çalı sayısı
      ari: 0,             // arı sayısı (çarpınca çiçek düşürürsün)
      sure: 0,            // saniye, 0 = süresiz
      dunya: 16,          // harita büyüklüğü
      mesaj: 'İlk çiçekler sana, {alan}! 🌸'
    },
    {
      ad: 'Park Yolu',
      tema: 'gun',
      cicek: 7,
      engel: 9,
      ari: 0,
      sure: 0,
      dunya: 18,
      mesaj: 'Hangi yoldan gidersem gideyim sana çıkıyor, {alan} 💐'
    },
    {
      ad: 'Arı Vadisi',
      tema: 'gun',
      cicek: 9,
      engel: 10,
      ari: 2,
      sure: 0,
      dunya: 20,
      mesaj: 'Arılar bile seni kıskanıyor, {alan} 🐝❤️'
    },
    {
      ad: 'Gün Batımı Yolu',
      tema: 'gunbati',
      cicek: 11,
      engel: 12,
      ari: 3,
      sure: 90,
      dunya: 22,
      mesaj: 'Gün batımı seninle daha güzel, {alan} 🌅'
    },
    {
      ad: 'Yıldızlı Gece',
      tema: 'gece',
      cicek: 13,
      engel: 12,
      ari: 4,
      sure: 100,
      dunya: 24,
      mesaj: 'Bu gece yıldızlar bile senin için yanıyor, {alan} ✨'
    }
  ],

  finalMesaj: 'Hepsi seni sevdiğim için. İyi ki varsın {alan}, seni çok seviyorum ❤️'
};
