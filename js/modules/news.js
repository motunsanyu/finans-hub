// js/modules/news.js - Türkiye Ekonomi Haberleri Modülü (Gelişmiş Hata Yönetimi ve Proxy Destekli)

const NewsModule = (() => {
    const API_KEY = '12a49b72d238dbdca21ccb74afbd1ec3';
    const BASE_URL = 'https://gnews.io/api/v4/top-headlines';
    const PROXY_URL = 'https://api.codetabs.com/v1/proxy?quest=';
    const containerId = 'newsList';

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
                <span style="font-size:13px;">Haberler yükleniyor...</span>
            </div>
        `;

        // Haberleri daha güncel ve kategori bazlı almak için category=business kullanıyoruz
        // Ayrıca cache-busting için rastgele bir parametre ekliyoruz
        const targetUrl = `${BASE_URL}?category=business&lang=tr&country=tr&max=15&apikey=${API_KEY}&t=${Date.now()}`;
        
        // CORS hatasını aşmak için proxy kullanımı şarttır
        const finalUrl = PROXY_URL + encodeURIComponent(targetUrl);

        try {
            const response = await fetch(finalUrl);
            if (!response.ok) {
                if (response.status === 401) throw new Error('API anahtarı geçersiz.');
                if (response.status === 429) throw new Error('Günlük istek sınırı dolmuş.');
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            if (data.articles && data.articles.length > 0) {
                renderNews(data.articles);
            } else {
                container.innerHTML = `<div style="text-align:center; padding:40px; color:#9ca3af;">⚠️ Şu anda Türkiye ekonomi kategorisinde haber bulunamadı.</div>`;
            }
        } catch (error) {
            console.error('News Fetch Error:', error);
            showError(error.message);
        }
    }

    function init() {
        // Dashboard üzerinden tetiklenecek
    }

    return { init, fetchNews };
})();

window.NewsModule = NewsModule;
