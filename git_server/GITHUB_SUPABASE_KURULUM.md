# GitHub Actions ile 10 Dakikada Bir Piyasa Verisi Cekme ve Supabase'e Yazma

Bu rehber, bu projedeki `www.doviz.com` veri cekme kodunu GitHub uzerinde otomatik calistirip verileri Supabase tablosuna yazmak icindir.

Sistem su sekilde calisir:

1. GitHub Actions her 10 dakikada bir otomatik calisir.
2. GitHub gecici bir Ubuntu makinesi acar.
3. Projedeki Python kodunu indirir.
4. `github_market_cron.py` dosyasini calistirir.
5. Kod `www.doviz.com` uzerinden su verileri ceker:
   - Dolar
   - Euro
   - Gram altin
   - BIST100
   - Bitcoin
   - Brent petrol
6. Veriler Supabase uzerindeki `market_snapshots` tablosuna yazilir.
7. Web siteniz Supabase tablosundan en guncel kaydi okuyarak veriyi gosterir.

## 1. Projede Eklenen Dosyalar

Bu is icin projeye su dosyalar eklendi:

```text
github_market_cron.py
requirements.txt
supabase_market_snapshots.sql
.github/workflows/market_cron.yml
```

### `github_market_cron.py`

Bu dosya asil Python botudur.

Yaptigi isler:

1. `market.py` icindeki `fetch_market_snapshot()` fonksiyonunu kullanir.
2. `www.doviz.com` uzerinden piyasa verilerini ceker.
3. Veriyi Supabase REST API ile `market_snapshots` tablosuna ekler.

### `requirements.txt`

GitHub Actions calisirken yuklenecek Python paketlerini belirtir.

Su an sadece sunu yukler:

```text
requests>=2.31.0
```

### `supabase_market_snapshots.sql`

Supabase'de tabloyu olusturmak icin calistirilacak SQL dosyasidir.

Bu dosya:

1. `market_snapshots` tablosunu olusturur.
2. `fetched_at` alanina index ekler.
3. Row Level Security ayarini acar.
4. Web sitesinin tabloyu okuyabilmesi icin public select policy ekler.

### `.github/workflows/market_cron.yml`

GitHub Actions zamanlayici dosyasidir.

Bu dosya GitHub'a sunu soyler:

1. Her 10 dakikada bir calis.
2. Python 3.11 kur.
3. Gerekli kutuphaneleri yukle.
4. `github_market_cron.py` dosyasini calistir.

## 2. Supabase'de Tablo Olusturma

Once Supabase projenize girin.

1. Supabase panelini acin.
2. Sol menuden `SQL Editor` bolumune girin.
3. `New query` butonuna basin.
4. Bu projedeki `supabase_market_snapshots.sql` dosyasinin tamamini kopyalayin.
5. SQL Editor alanina yapistirin.
6. `Run` butonuna basin.

Basarili olursa Supabase'de su tablo olusur:

```text
market_snapshots
```

Tablo alanlari:

```text
id
fetched_at
source
usd_try
usd_try_change
usd_status
eur_try
eur_try_change
eur_status
gram_gold_try
gram_gold_change
gold_status
bist100
bist100_change
bist_status
bitcoin
bitcoin_change
btc_status
brent
brent_change
brent_status
created_at
```

## 3. GitHub Repository Olusturma

GitHub'da bir repository olusturun.

Onerilen ayar:

```text
Visibility: Private
```

Private repository kullanmak daha guvenlidir. Kodunuz ve proje yapiniz herkese acik olmaz.

Repository olusturduktan sonra bu proje dosyalarini GitHub'a yukleyin.

Yuklenmesi gereken onemli dosyalar:

```text
market.py
github_market_cron.py
requirements.txt
supabase_market_snapshots.sql
.github/workflows/market_cron.yml
```

Bu dosyalar olmadan GitHub Actions calismaz.

## 4. GitHub Secrets Ayarlari

Supabase bilgilerinizi koda yazmayacagiz. GitHub Secrets icine guvenli sekilde ekleyecegiz.

GitHub repository sayfanizda:

1. `Settings` bolumune girin.
2. Sol menuden `Secrets and variables` bolumunu acin.
3. `Actions` secenegine tiklayin.
4. `New repository secret` butonuna basin.

Iki adet secret ekleyin.

### Secret 1

Name:

```text
SUPABASE_URL
```

Value:

```text
https://proje-id.supabase.co
```

Bu bilgiyi Supabase panelinde su bolumden bulabilirsiniz:

```text
Project Settings > API > Project URL
```

### Secret 2

Name:

```text
SUPABASE_KEY
```

Value:

```text
Supabase service_role key veya anon key
```

Onerilen:

```text
service_role key
```

Bu bilgiyi Supabase panelinde su bolumden bulabilirsiniz:

```text
Project Settings > API > Project API keys
```

Not: `service_role` key kesinlikle web sitesi frontend koduna konulmaz. Sadece GitHub Secrets icinde durmalidir.

## 5. GitHub Actions Dosyasini Kontrol Etme

Projede su dosyanin oldugundan emin olun:

```text
.github/workflows/market_cron.yml
```

Icerigi su mantikla calisir:

```yaml
on:
  schedule:
    - cron: "*/10 * * * *"
  workflow_dispatch:
```

Bu ayar sunu ifade eder:

```text
Her 10 dakikada bir otomatik calis.
Ayrica GitHub uzerinden manuel calistirma butonu da olsun.
```

GitHub cron zamanlari UTC'ye gore calisir. Fakat burada her 10 dakika calistigi icin saat farki onemli degildir.

## 6. Manuel Test Etme

GitHub'a dosyalari yukledikten sonra ilk testi manuel yapin.

1. GitHub repository sayfasina girin.
2. Ust menuden `Actions` sekmesine girin.
3. Solda `10 Dakikalik Piyasa Veri Botu` workflow'unu secin.
4. `Run workflow` butonuna basin.
5. Tekrar `Run workflow` diyerek calistirin.

Calisma basarili olursa yesil tik gorursunuz.

Hata olursa workflow detayina girip hangi adimda hata verdigine bakin.

En sik hatalar:

```text
SUPABASE_URL eksik
SUPABASE_KEY eksik
Supabase tablo adi yanlis
market_snapshots tablosu olusturulmamis
Supabase RLS/policy ayari eksik
www.doviz.com gecici olarak cevap vermiyor
```

## 7. Supabase'de Verinin Geldigini Kontrol Etme

Supabase panelinde:

1. `Table Editor` bolumune girin.
2. `market_snapshots` tablosunu secin.
3. Yeni satir gelip gelmedigini kontrol edin.

Basarili bir kayitta su alanlarda deger gorursunuz:

```text
usd_try
eur_try
gram_gold_try
bist100
bitcoin
brent
fetched_at
```

Her 10 dakikada bir yeni satir eklenir.

## 8. Web Sitesinde En Guncel Veriyi Okuma

Web siteniz Supabase'den en son kaydi okumali.

Mantik su:

```text
market_snapshots tablosundan fetched_at alanina gore en yeni 1 kaydi getir.
```

JavaScript/Supabase ornegi:

```js
const { data, error } = await supabase
  .from("market_snapshots")
  .select("*")
  .order("fetched_at", { ascending: false })
  .limit(1)
  .single();
```

Sonra alanlari sitede kullanabilirsiniz:

```js
data.usd_try
data.eur_try
data.gram_gold_try
data.bist100
data.bitcoin
data.brent
```

Degisim oranlari icin:

```js
data.usd_try_change
data.eur_try_change
data.gram_gold_change
data.bist100_change
data.bitcoin_change
data.brent_change
```

## 9. Web Sitesinde Kullanilacak Supabase Key

Web sitesinde kesinlikle `service_role` key kullanmayin.

Frontend icin:

```text
anon public key
```

kullanilmalidir.

Guvenli yapi su sekilde olmalidir:

```text
GitHub Actions:
  SUPABASE_KEY = service_role key

Web sitesi:
  SUPABASE_KEY = anon public key
```

Tabloda public read policy oldugu icin web sitesi `anon key` ile veriyi okuyabilir.

## 10. Otomatik Calisma Mantigi

Workflow su cron ayariyla calisir:

```text
*/10 * * * *
```

Anlami:

```text
Her saatin 0, 10, 20, 30, 40 ve 50. dakikasinda calis.
```

Ornek:

```text
10:00
10:10
10:20
10:30
10:40
10:50
```

GitHub Actions bazen yogunluga gore birkac dakika gec baslatabilir. Bu normaldir.

## 11. Dosyalari GitHub'a Yukleme Sirasi

Onerilen sira:

1. Supabase'de `supabase_market_snapshots.sql` dosyasini calistirin.
2. GitHub'da private repository olusturun.
3. Proje dosyalarini repository'ye yukleyin.
4. GitHub Secrets alanina `SUPABASE_URL` ekleyin.
5. GitHub Secrets alanina `SUPABASE_KEY` ekleyin.
6. GitHub Actions sekmesinden workflow'u manuel calistirin.
7. Supabase `market_snapshots` tablosunda veri gelip gelmedigini kontrol edin.
8. Web sitenizde en son kaydi okuyun.

## 12. Hata Ayiklama

### GitHub Actions kirmizi hata verirse

Actions sayfasina girin ve hata veren calismayi acin.

Su adimlara tek tek bakin:

```text
Depoyu klonla
Python kurulumu
Kutuphaneleri yukle
Piyasa verisini Supabase'e yaz
```

Genelde hata son adimda olur.

### `SUPABASE_URL environment variable is required`

GitHub secret eksiktir.

Cozum:

```text
Settings > Secrets and variables > Actions
```

bolumunden `SUPABASE_URL` ekleyin.

### `SUPABASE_KEY environment variable is required`

GitHub secret eksiktir.

Cozum:

```text
Settings > Secrets and variables > Actions
```

bolumunden `SUPABASE_KEY` ekleyin.

### `Supabase insert failed`

Muhtemel nedenler:

1. Tablo olusturulmamistir.
2. Tablo adi yanlistir.
3. Supabase key yanlistir.
4. Supabase URL yanlistir.
5. RLS/policy ayarlari uygun degildir.

Once `supabase_market_snapshots.sql` dosyasini tekrar kontrol edin.

### `doviz.com baglanti hatasi`

Bu durumda `www.doviz.com` gecici olarak cevap vermemis olabilir.

Cozum:

1. Bir sonraki otomatik calismayi bekleyin.
2. GitHub Actions uzerinden manuel tekrar calistirin.

## 13. Guvenlik Notlari

1. `service_role` key'i asla web sitesi koduna koymayin.
2. `service_role` key'i sadece GitHub Secrets icinde saklayin.
3. Repository private olursa daha guvenlidir.
4. Supabase tablosunda sadece okuma iznini public acin.
5. Yazma islemini sadece GitHub Actions yapsin.

## 14. Son Kontrol Listesi

Asagidaki maddelerin hepsi tamamlaninca sistem hazir olur:

```text
[ ] Supabase projesi hazir
[ ] supabase_market_snapshots.sql calistirildi
[ ] market_snapshots tablosu olustu
[ ] GitHub repository olusturuldu
[ ] Proje dosyalari GitHub'a yuklendi
[ ] .github/workflows/market_cron.yml GitHub'da gorunuyor
[ ] SUPABASE_URL secret olarak eklendi
[ ] SUPABASE_KEY secret olarak eklendi
[ ] Actions sekmesinden workflow manuel calistirildi
[ ] Workflow yesil tik ile basarili oldu
[ ] Supabase market_snapshots tablosuna veri geldi
[ ] Web sitesi en guncel satiri okuyabiliyor
```

## 15. Bu Projede Kullanilacak Ana Dosya

GitHub Actions'in calistiracagi ana dosya:

```text
github_market_cron.py
```

Bu dosyayi elle calistirma komutu:

```bash
python github_market_cron.py
```

Fakat yerelde calistirmak icin once su ortam degiskenleri tanimli olmalidir:

```text
SUPABASE_URL
SUPABASE_KEY
```

GitHub uzerinde bu degiskenleri GitHub Secrets otomatik olarak saglar.

## 16. Ozet

Bu kurulumdan sonra herhangi bir sunucu kiralamaniza gerek kalmaz.

GitHub Actions:

```text
Her 10 dakikada bir calisir.
Veriyi ceker.
Supabase'e yazar.
Kapanir.
```

Supabase:

```text
Veriyi saklar.
Web sitenize API uzerinden sunar.
```

Web sitesi:

```text
market_snapshots tablosundan en guncel kaydi okur.
Kullaniciya dolar, euro, altin, BIST100, bitcoin ve brent petrol verilerini gosterir.
```
