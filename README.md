# Netlify Finans App

Bu proje Netlify'de calismak uzere hazirlandi.

## Deploy

1. Bu klasoru (`netlify-finans-app`) GitHub'a push et.
2. Netlify'de **Add new site -> Import from Git** sec.
3. Build command bos birak.
4. Publish directory olarak repo kokunu kullan.
5. Deploy et.

## Finans Veri Mimarisi

- Finans verileri once `/.netlify/functions/finance` endpoint'inden cekilir.
- Bu sayede CORS sorunu yasansa bile veriler sunucu tarafinda toplanir.
- Fonksiyon gecici olarak erisilemezse tarayici fallback'i devreye girer.

## Moduller

- Ana Sayfa: USD, EUR, Gram Altin, BTC, BIST100
- Yakit: Kayit, 100 km maliyet, L/100km, tablo, ozet
- Gun Hesaplayici: Tarih arasi gun farki + gecmis kayit kartlari
- Okul Taksitleri: 2 cocuk ayri takip, odendi/odenmedi, kalan borc

## Notlar

- Dark mode / light mode secenegi vardir.
- Tum kullanici kayitlari `localStorage` uzerinde saklanir.
- Tarayici verisi silinirse kayitlar da silinir.
