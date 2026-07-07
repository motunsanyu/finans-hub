# Render Yeni Hesap ve Kurulum Rehberi

Render.com'daki 5 GB ücretsiz bant genişliği kotanızı doldurduğunuz için mevcut sunucunuz durduruldu. Ücretsiz olarak devam etmek için tamamen yeni bir e-posta adresiyle yeni bir Render hesabı açabilir ve projenizi oraya taşıyabilirsiniz. 

İşte bunu adım adım nasıl yapacağınız:

## 1. Hazırlık Aşaması
1. Mevcut Github hesabınızda projenizin arka uç (backend) kodlarının (`git_server` klasörünün) yüklü olduğundan emin olun.
2. Render'a kayıt olmak için daha önce kullanmadığınız **yeni bir e-posta adresi** hazırlayın (örneğin yeni bir Gmail adresi açabilirsiniz).

## 2. Yeni Render Hesabı Oluşturma
1. Tarayıcınızdan **[Render.com](https://render.com/)** adresine gidin.
2. Sağ üstten **"Get Started"** veya **"Sign Up"** butonuna tıklayın.
3. Kayıt ekranında **Github ile Giriş Yap (Continue with GitHub)** seçeneğini kullanırsanız işiniz daha kolay olur. (Eğer Render, eski hesabınızın bağlı olduğu Github'ı sorun yaparsa, yeni e-postanızla doğrudan "Email" seçeneği üzerinden de kayıt olabilirsiniz.)
4. E-posta onay işlemlerini tamamlayıp yeni hesabınızın paneline (Dashboard) giriş yapın.

## 3. Yeni Web Servisi (Web Service) Başlatma
1. Render panelinizde sağ üstteki **"New"** butonuna tıklayın ve açılan menüden **"Web Service"** seçeneğini seçin.
2. Gelen ekranda **"Build and deploy from a Git repository"** seçeneğine tıklayın.
3. Github hesabınızı bağlayın (Connect GitHub). 
4. Açılan listeden finans projenizin arka uç dosyalarını içeren repoyu seçin ve **Connect** deyin.

## 4. Proje Ayarlarını Yapılandırma
Reponuzu seçtikten sonra kurulum ayarları sayfası açılacaktır. Aşağıdaki gibi doldurun:
- **Name:** Projenize bir isim verin (örneğin: `finans-backend-yeni`)
- **Region:** Size en yakın olanı (örneğin Frankfurt) seçin.
- **Branch:** `main` veya `master` (hangisini kullanıyorsanız).
- **Environment:** Arka ucunuz Python ise `Python 3`, Node.js ise `Node` seçin.
- **Build Command:** 
  - Python için: `pip install -r requirements.txt`
  - Node.js için: `npm install`
- **Start Command:** 
  - Python için: `gunicorn app:app` veya `python app.py` (projenize göre)
  - Node.js için: `node index.js` veya `npm start`
- **Instance Type:** `Free` (Ücretsiz) seçeneğini işaretleyin.

Aşağı inip **"Create Web Service"** butonuna tıklayın.

## 5. Yeni URL'yi Alma
1. Kaydet dedikten sonra Render uygulamanızı oluşturmaya (Build) başlayacaktır. Bu işlem 2-3 dakika sürebilir.
2. Ekranda "Live" veya "Build Successful" yazısını gördüğünüzde işlem tamamdır.
3. Sayfanın en sol üstünde projenizin yeni adresi yazacaktır. Örneğin: `https://finans-backend-yeni.onrender.com`
4. Bu yeni adresi (URL'yi) kopyalayın.

## 6. Ön Yüzde (Frontend) URL'yi Güncelleme
Eski Render uygulamanızın URL'si kapandığı için JavaScript dosyalarınızda hata alıyorsunuz. Son adımda bu linki yenisiyle değiştireceğiz:
1. Finans projenizin klasörüne gelin (`c:\Users\muzaf\OneDrive\Belgeler\finans-app`).
2. Kod düzenleyicinizde (VS Code vb.) arama (Search) kısmına girin.
3. Eski Render URL'nizi (örneğin `https://borsa-telegram.onrender.com`) aratın.
4. Çıkan tüm sonuçlarda (özellikle `borsa.js`, `coin.js`, `altin.js` gibi modüllerde) eski URL'yi silip yerine kopyaladığınız **yeni URL'yi** yapıştırın.
5. Dosyaları kaydedin ve sayfayı yenileyin. 

Tebrikler! Verileriniz artık yeni Render hesabınız üzerinden sorunsuzca çekilmeye başlanacaktır. Kotanız sıfırlandığı için tekrar 5 GB limitiniz oldu.
