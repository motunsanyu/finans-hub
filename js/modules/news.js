// js/modules/news.js - Türkiye Ekonomi Haberleri Modülü (Gelişmiş Hata Yönetimi ve Çoklu Kaynak Desteği)

const NewsModule = (() => {
    // GNews API (eski kaynak)
    const GN_API_KEY = '12a49b72d238dbdca21ccb74afbd1ec3';
    const GN_BASE_URL = 'https://gnews.io/api/v4/top-headlines';

    // NewsData.io API (yeni kaynak)
    const ND_API_KEY = 'pub_d5bdbdb66b3946bc9f9d6b0f5f01388d';
    const ND_BASE_URL = 'https://newsdata.io/api/1/news';

    // Proxy servisleri (SSL hatalarını önlemek için alternatifler)
    const PROXY_GNEWS = 'https://api.codetabs.com/v1/proxy?quest=';
    const PROXY_NEWSDATA = 'https://api.allorigins.win/raw?url=';
    
    // CollectAPI (yeni kaynak 3)
    const CA_API_KEY = 'apikey 1Ms0EMTXiR26BbyjPKI5tU:1EqlmyGJzXlJe2wM43V7Rb';
    const CA_BASE_URL = 'https://api.collectapi.com/news/getNews';
    const PROXY_COLLECT = 'https://api.codetabs.com/v1/proxy?quest='; // Opsiyonel proxy

    const containerId = 'newsList';
    const CACHE_KEY = 'finansHub.newsCache.v1';
    const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 3;
    let isFetching = false;

    function getCachedNews() {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const cache = JSON.parse(raw);
            if (!cache || !Array.isArray(cache.articles) || cache.articles.length === 0) return null;
            return cache;
        } catch (error) {
            console.warn('Haber cache okunamadi:', error);
            return null;
        }
    }

    function saveCachedNews(articles) {
        if (!articles || articles.length === 0) return;
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                savedAt: new Date().toISOString(),
                articles
            }));
        } catch (error) {
            console.warn('Haber cache kaydedilemedi:', error);
        }
    }

    function isCacheFresh(cache) {
        if (!cache?.savedAt) return false;
        const savedTime = new Date(cache.savedAt).getTime();
        return Number.isFinite(savedTime) && Date.now() - savedTime < CACHE_MAX_AGE_MS;
    }

    function getCacheLabel(cache) {
        if (!cache?.savedAt) return 'Son kayitli haberler';
        try {
            const staleText = isCacheFresh(cache) ? '' : ' (eski kayit)';
            return `Son kayitli haberler - ${new Date(cache.savedAt).toLocaleString('tr-TR', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            })}${staleText}`;
        } catch (error) {
            return 'Son kayitli haberler';
        }
    }

    // Yardımcı fonksiyonlar
    function formatDate(dateString) {
        if (!dateString) return 'Tarih belirsiz';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Geçersiz tarih';
            return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch (e) { return 'Tarih hatası'; }
    }

    function sanitizeText(text) {
        if (!text) return '';
        return text.replace(/[&<>]/g, function (m) {
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

    async function fetchJsonWithTimeout(url, label, timeoutMs = 9000, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { ...options, signal: controller.signal });
            if (!res.ok) throw new Error(`${label} (${res.status})`);
            return await res.json();
        } finally {
            clearTimeout(timeoutId);
        }
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

    // CollectAPI'den gelen veriyi ortak formata dönüştür
    function convertCollectItem(item) {
        return {
            title: item.name || 'Başlıksız',
            url: item.url || '#',
            publishedAt: null, // CollectAPI genellikle tarih dönmez veya farklı döner
            description: item.description || '',
            source: { name: item.source || 'CollectAPI' }
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

    function renderNews(articles, meta = {}) {
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

        let html = meta.notice ? `
            <div style="font-size:12px; color:#9ca3af; padding:10px 12px; background:rgba(255,255,255,0.04); border:1px solid #2a2f36; border-radius:14px; margin-bottom:4px;">
                ${sanitizeText(meta.notice)}
            </div>
        ` : '';
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

        const cached = getCachedNews();
        if (cached?.articles?.length) {
            renderNews(cached.articles, {
                notice: `${getCacheLabel(cached)} gosteriliyor. Yeni haberler alinamadi: ${errorMessage}`
            });
            return;
        }

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

        // ─── 1. ADIM: Supabase'den Sözcü haberlerini dene ──────────────────
        try {
            const sb = window._supabaseClient || (typeof getSB === 'function' ? getSB() : null);
            if (sb) {
                const { data, error } = await sb
                    .from('market_snapshots')
                    .select('news, fetched_at')
                    .order('fetched_at', { ascending: false })
                    .limit(1)
                    .single();

                if (!error && data && data.news && data.news.length > 0) {
                    // Supabase'den gelen Sözcü haberlerini render et
                    const fetchedAt = data.fetched_at ? new Date(data.fetched_at) : null;
                    const timeStr = fetchedAt
                        ? fetchedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                        : '';

                    let html = timeStr ? `<div style="font-size:12px; color:#9ca3af; padding:10px 12px; background:rgba(255,255,255,0.04); border:1px solid #2a2f36; border-radius:14px; margin-bottom:12px;">
                        📰 Piyasa Haberleri • Son güncelleme: ${timeStr}
                    </div>` : '';

                    data.news.forEach(item => {
                        const safeTitle = sanitizeText(item.title || 'Başlıksız');
                        const safeDesc = sanitizeText(item.description || '');
                        const link = item.link || '#';
                        const shortDesc = safeDesc.length > 150 ? safeDesc.substring(0, 150) + '...' : safeDesc;

                        // onclick yerine data-href kullanıyoruz — tırnak/özel karakter sorununu önler
                        const sourceName = item.source || 'Sözcü';
                        const isHaberturk = sourceName.includes('Habertürk') || sourceName.includes('Habertrk');
                        const badgeBg = isHaberturk ? 'rgba(229,57,53,0.12)' : 'rgba(252,213,53,0.12)';
                        const badgeColor = isHaberturk ? '#e53935' : '#fcd535';
                        const displaySource = isHaberturk ? 'Habertürk' : 'Sözcü';

                        html += `
                            <div class="news-card sozcu-card" data-href="${link}"
                                 style="background:#1e2329; border-radius:20px; overflow:hidden; border:1px solid #2a2f36; cursor:pointer; transition:transform 0.2s, box-shadow 0.2s; margin-bottom:16px;">
                                ${item.image ? `<img src="${item.image}" alt="" loading="lazy" style="width:100%; height:180px; object-fit:cover; display:block;" onerror="this.style.display='none'"/>` : ''}
                                <div style="padding:16px;">
                                    <div style="display:flex; gap:8px; align-items:center; margin-bottom:10px;">
                                        <span style="background:${badgeBg}; color:${badgeColor}; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:600;">${displaySource}</span>
                                    </div>
                                    <div style="font-size:15px; font-weight:700; color:white; line-height:1.4; margin-bottom:8px;">${safeTitle}</div>
                                    ${shortDesc ? `<div style="font-size:13px; color:#b0b8c5; line-height:1.45;">${shortDesc}</div>` : ''}
                                </div>
                            </div>
                        `;
                    });

                    container.innerHTML = html;

                    // data-href tıklama dinleyicisi — onclick string interpolasyonuna gerek yok
                    container.querySelectorAll('.sozcu-card[data-href]').forEach(card => {
                        card.addEventListener('mouseover', () => { card.style.transform = 'translateY(-2px)'; card.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)'; });
                        card.addEventListener('mouseout', () => { card.style.transform = ''; card.style.boxShadow = ''; });
                        card.addEventListener('click', () => { window.location.href = card.dataset.href; });
                    });

                    console.log(`✅ Supabase: ${data.news.length} Sözcü haberi yüklendi.`);
                    return; // Supabase başarılı, eski API'lere gerek yok
                }
            }
        } catch (sbErr) {
            console.warn('Supabase haber çekme başarısız, eski kaynaklara düşülüyor:', sbErr);
        }

        // ─── 2. ADIM: Supabase boşsa eski API kaynaklarına fallback ────────
        const cached = getCachedNews();
        if (cached?.articles?.length) {
            renderNews(cached.articles, {
                notice: `${getCacheLabel(cached)} gösteriliyor. Yeni haberler arka planda kontrol ediliyor...`
            });
        }
        if (isFetching) return;
        isFetching = true;

        // GNews URL (Codetabs ile)
        const gnUrl = `${GN_BASE_URL}?category=business&lang=tr&country=tr&max=15&apikey=${GN_API_KEY}&t=${Date.now()}`;
        const gnFinalUrl = PROXY_GNEWS + encodeURIComponent(gnUrl);

        // NewsData.io URL (Allorigins ile)
        const ndUrl = `${ND_BASE_URL}?apikey=${ND_API_KEY}&country=tr&category=business&language=tr&size=10`;
        const ndFinalUrl = PROXY_NEWSDATA + encodeURIComponent(ndUrl);

            // CollectAPI URL (Ekonomi haberi çekiyoruz)
            const caUrl = `${CA_BASE_URL}?country=tr&tag=economy`;

            try {
                const [gnResponse, ndResponse, caResponse] = await Promise.allSettled([
                    fetchJsonWithTimeout(gnFinalUrl, 'GNews Proxy'),
                    fetchJsonWithTimeout(ndFinalUrl, 'NewsData Proxy'),
                    fetchJsonWithTimeout(caUrl, 'CollectAPI', 9000, {
                        headers: {
                            'authorization': CA_API_KEY,
                            'content-type': 'application/json'
                        }
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

            // CollectAPI başarılı mı?
            if (caResponse.status === 'fulfilled' && caResponse.value && caResponse.value.result) {
                const caArticles = caResponse.value.result.map(convertCollectItem);
                allArticles.push(...caArticles);
                console.log(`✅ CollectAPI: ${caArticles.length} haber yüklendi.`);
            } else {
                const errorInfo = caResponse.status === 'rejected' ? caResponse.reason : 'Sonuç bulunamadı';
                console.warn('⚠️ CollectAPI hatası:', errorInfo);
            }

            if (allArticles.length === 0) {

                if (cached?.articles?.length) {
                    renderNews(cached.articles, {
                        notice: `${getCacheLabel(cached)} gösteriliyor. Haber kaynaklarına şu anda ulaşılamıyor.`
                    });
                    isFetching = false;
                    return;
                }
                // Hiç haber gelmediyse
                container.innerHTML = `<div style="text-align:center; padding:40px; color:#9ca3af;">⚠️ Şu anda hiçbir kaynaktan haber alınamıyor. Lütfen daha sonra tekrar deneyin.</div>`;
                isFetching = false;
                return;
            }

            // Tekrarları temizle ve tarihe göre sırala
            const uniqueArticles = deduplicateByTitle(allArticles);
            const sortedArticles = sortByDate(uniqueArticles);

            // En fazla 20 haberi göster (isteğe bağlı)
            const finalArticles = sortedArticles.slice(0, 20);
            saveCachedNews(finalArticles);
            renderNews(finalArticles);

            console.log(`📊 Toplam ${allArticles.length} haber, ${uniqueArticles.length} tekil haber, ${finalArticles.length} gösteriliyor.`);
        } catch (error) {
            console.error('Genel hata:', error);
            showError('Ağ bağlantısı veya genel bir hata oluştu.');
        }
        isFetching = false;
    }

    function init() {
        // Dashboard üzerinden tetiklenecek
    }

    return { init, fetchNews };
})();

window.NewsModule = NewsModule;
