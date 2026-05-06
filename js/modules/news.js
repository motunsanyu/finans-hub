// js/modules/news.js - Türkiye Ekonomi Haberleri Modülü (Gelişmiş Hata Yönetimi ve Çoklu Kaynak Desteği)

const NewsModule = (() => {
    // GNews API (eski kaynak)
    const GN_API_KEY = '12a49b72d238dbdca21ccb74afbd1ec3';
    const GN_BASE_URL = 'https://gnews.io/api/v4/top-headlines';
    
    // NewsData.io API (yeni kaynak)
    const ND_API_KEY = 'pub_d5bdbdb66b3946bc9f9d6b0f5f01388d';
    const ND_BASE_URL = 'https://newsdata.io/api/1/news';
    
    const PROXY_URL = 'https://api.codetabs.com/v1/proxy?quest=';
    const containerId = 'newsList';

    // Yardımcı fonksiyonlar
    function formatDate(dateString) {
        if (!dateString) return 'Tarih belirsiz';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Geçersiz tarih';
            return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch(e) { return 'Tarih hatası'; }
    }

    function sanitizeText(text) {
        if (!text) return '';
        return text.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    function stripHtml(html) {
        if (!html) return '';
        return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // NewsData.io'dan gelen veriyi ortak formata dönüştür
    function convertNewsDataItem(item) {
        return {
            title: item.title || 'Başlıksız',
            url: item.link || '#',
            publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null,
            description: item.description || '',
            source: { name: item.source_name || item.source_id || 'NewsData.io' }
        };
    }

    // GNews'ten gelen veri zaten uygun formatta, sadece gerekli alanları al
    function convertGNewsItem(item) {
        return {
            title: item.title || 'Başlıksız',
            url: item.url || '#',
            publishedAt: item.publishedAt || null,
            description: item.description || '',
            source: { name: item.source?.name || 'GNews' }
        };
    }

    // Haberleri tarihe göre sırala (en yeni önce)
    function sortByDate(articles) {
        return articles.sort((a, b) => {
            const dateA = a.publishedAt ? new Date(a.publishedAt) : 0;
            const dateB = b.publishedAt ? new Date(b.publishedAt) : 0;
            return dateB - dateA;
        });
    }

    // Aynı başlığa sahip haberleri temizle (basit deduplication)
    function deduplicateByTitle(articles) {
        const seen = new Set();
        return articles.filter(article => {
            const title = article.title?.trim().toLowerCase();
            if (!title || seen.has(title)) return false;
            seen.add(title);
            return true;
        });
    }

    function renderNews(articles) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!articles || articles.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:40px; background:#1e2329; border-radius:24px; color:#9ca3af;">
                    📭 Şu anda haber bulunamadı. Lütfen daha sonra tekrar deneyin.
                </div>
            `;
            return;
        }

        let html = '';
        articles.forEach(item => {
            const title = item.title || 'Başlıksız';
            const link = item.url || '#';
            const pubDate = item.publishedAt ? formatDate(item.publishedAt) : '';
            let description = item.description ? stripHtml(item.description) : '';
            description = description.length > 120 ? description.substring(0, 120) + '...' : description;
            const sourceName = item.source?.name || 'Kaynak';

            html += `
                <div class="news-card" onclick="window.open('${link}', '_blank')" style="background:#1e2329; border-radius:20px; padding:18px; border:1px solid #2a2f36; cursor:pointer; transition:0.2s; margin-bottom:16px;">
                    <div style="font-size:16px; font-weight:700; color:white; line-height:1.4; margin-bottom:10px;">${sanitizeText(title)}</div>
                    <div style="display:flex; gap:12px; align-items:center; margin-bottom:10px; font-size:11px; font-weight:600;">
                        <span style="background:rgba(252,213,53,0.12); color:#fcd535; padding:4px 10px; border-radius:20px;">${sanitizeText(sourceName)}</span>
                        <span style="color:#9ca3af;">${sanitizeText(pubDate)}</span>
                    </div>
                    <div style="font-size:13px; color:#b0b8c5; line-height:1.45;">${sanitizeText(description)}</div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    function showError(errorMessage) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = `
            <div style="background:rgba(239,68,68,0.1); border-left:3px solid #ef4444; padding:20px; border-radius:16px; text-align:center; color:#fca5a5;">
                <div style="font-size:24px; margin-bottom:12px;">⚠️</div>
                <div style="font-size:13px; margin-bottom:12px;">Haberler yüklenirken bir sorun oluştu:<br><strong>${sanitizeText(errorMessage)}</strong></div>
                <button onclick="NewsModule.fetchNews()" style="background:#fcd535; color:#0b0e11; border:none; padding:8px 20px; border-radius:30px; font-weight:700; font-size:13px; cursor:pointer;">🔄 TEKRAR DENE</button>
            </div>
        `;
    }

    async function fetchNews() {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div style="display:flex; justify-content:center; padding:60px 20px; gap:12px; flex-direction:column; align-items:center; color:#9ca3af;">
                <div class="spinner"></div>
                <span style="font-size:13px;">Haberler yükleniyor (2 kaynak)...</span>
            </div>
        `;

        // GNews URL (category=business, lang=tr, country=tr)
        const gnUrl = `${GN_BASE_URL}?category=business&lang=tr&country=tr&max=15&apikey=${GN_API_KEY}&t=${Date.now()}`;
        const gnFinalUrl = PROXY_URL + encodeURIComponent(gnUrl);

        // NewsData.io URL (country=tr, category=business, language=tr, size=15)
        // 'time' parametresi bazı proxy'lerde sorun çıkarabildiği için kaldırıldı
        const ndUrl = `${ND_BASE_URL}?apikey=${ND_API_KEY}&country=tr&category=business&language=tr&size=15`;
        const ndFinalUrl = PROXY_URL + encodeURIComponent(ndUrl);

        try {
            // Her iki kaynağa da istek gönder, biri başarısız olursa diğeri çalışsın
            const [gnResponse, ndResponse] = await Promise.allSettled([
                fetch(gnFinalUrl).then(async res => {
                    if (!res.ok) throw new Error(`GNews HTTP ${res.status}`);
                    return res.json();
                }),
                fetch(ndFinalUrl).then(async res => {
                    if (!res.ok) throw new Error(`NewsData HTTP ${res.status}`);
                    return res.json();
                })
            ]);

            let allArticles = [];

            // GNews başarılı mı?
            if (gnResponse.status === 'fulfilled' && gnResponse.value && gnResponse.value.articles) {
                const gnArticles = gnResponse.value.articles.map(convertGNewsItem);
                allArticles.push(...gnArticles);
                console.log(`✅ GNews: ${gnArticles.length} haber yüklendi.`);
            } else {
                console.warn('⚠️ GNews hatası:', gnResponse.status === 'rejected' ? gnResponse.reason : 'Veri yapısı uyumsuz');
            }

            // NewsData.io başarılı mı?
            if (ndResponse.status === 'fulfilled' && ndResponse.value && ndResponse.value.results) {
                const ndArticles = ndResponse.value.results.map(convertNewsDataItem);
                allArticles.push(...ndArticles);
                console.log(`✅ NewsData.io: ${ndArticles.length} haber yüklendi.`);
            } else {
                const errorInfo = ndResponse.status === 'rejected' ? ndResponse.reason : (ndResponse.value?.message || 'Sonuç bulunamadı');
                console.warn('⚠️ NewsData.io hatası:', errorInfo);
            }

            if (allArticles.length === 0) {
                // Hiç haber gelmediyse
                container.innerHTML = `<div style="text-align:center; padding:40px; color:#9ca3af;">⚠️ Şu anda her iki kaynaktan da haber alınamıyor. Lütfen daha sonra tekrar deneyin.</div>`;
                return;
            }

            // Tekrarları temizle ve tarihe göre sırala
            const uniqueArticles = deduplicateByTitle(allArticles);
            const sortedArticles = sortByDate(uniqueArticles);
            
            // En fazla 20 haberi göster (isteğe bağlı)
            const finalArticles = sortedArticles.slice(0, 20);
            renderNews(finalArticles);
            
            console.log(`📊 Toplam ${allArticles.length} haber, ${uniqueArticles.length} tekil haber, ${finalArticles.length} gösteriliyor.`);
        } catch (error) {
            console.error('Genel hata:', error);
            showError('Ağ bağlantısı veya genel bir hata oluştu.');
        }
    }

    function init() {
        // Dashboard üzerinden tetiklenecek
    }

    return { init, fetchNews };
})();

window.NewsModule = NewsModule;
