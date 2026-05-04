// js/modules/news.js - GNews.io API Ekonomi Haberleri Modülü (Proxy Destekli)

const NewsModule = (() => {
    const API_KEY = '12a49b72d238dbdca21ccb74afbd1ec3';
    const BASE_URL = 'https://gnews.io/api/v4/top-headlines';
    const PROXY_URL = 'https://api.codetabs.com/v1/proxy?quest=';
    const containerId = 'newsList';

    function formatDate(dateString) {
        if (!dateString) return 'Tarih belirsiz';
        try {
            const date = new Date(dateString);
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

    function renderNews(articles) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!articles || articles.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:40px; color:#848e9c;">Henüz haber bulunamadı.</div>`;
            return;
        }

        let html = '';
        articles.forEach(item => {
            const title = item.title || 'Başlıksız';
            const link = item.url || '#';
            const pubDate = formatDate(item.publishedAt);
            const sourceName = item.source?.name || 'Kaynak';
            let description = item.description || '';
            description = description.length > 100 ? description.substring(0, 100) + '...' : description;

            html += `
                <div class="news-card" onclick="window.open('${link}', '_blank')" style="background:#1e2329; border-radius:16px; padding:16px; border:1px solid #2a2f36; cursor:pointer; transition:0.2s; margin-bottom:12px;">
                    <div style="font-size:15px; font-weight:700; color:white; line-height:1.4; margin-bottom:8px;">${sanitizeText(title)}</div>
                    <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
                        <span style="background:rgba(252,213,53,0.1); color:var(--brand); padding:2px 8px; border-radius:4px; font-size:10px; font-weight:700;">${sanitizeText(sourceName)}</span>
                        <span style="color:#848e9c; font-size:10px;">${sanitizeText(pubDate)}</span>
                    </div>
                    <div style="font-size:13px; color:#848e9c; line-height:1.4;">${sanitizeText(description)}</div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    async function fetchNews() {
        const container = document.getElementById(containerId);
        if (container) container.innerHTML = `<div style="text-align:center; padding:40px;"><div class="spinner" style="margin: 0 auto 10px;"></div><span style="color:#848e9c; font-size:13px;">Haberler çekiliyor...</span></div>`;

        const query = 'ekonomi';
        const targetUrl = `${BASE_URL}?lang=tr&country=tr&max=15&apikey=${API_KEY}&q=${encodeURIComponent(query)}`;
        
        // CORS hatasını aşmak için proxy kullanıyoruz
        const finalUrl = PROXY_URL + encodeURIComponent(targetUrl);

        try {
            const response = await fetch(finalUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            renderNews(data.articles);
        } catch (error) {
            console.error('News Error:', error);
            if (container) container.innerHTML = `<div style="text-align:center; padding:40px; color:#ef5350; font-size:13px;">Haberler yüklenemedi. Lütfen daha sonra tekrar deneyin.<br><small style="opacity:0.6;">${error.message}</small></div>`;
        }
    }

    function init() {}

    return { init, fetchNews };
})();

window.NewsModule = NewsModule;
