// js/modules/bist.js - BIST hisse teknik analiz ve grafik modulu

const BistModule = (() => {
  const BIST_LIST = [
    { sym: 'THYAO.IS', name: 'Turk Hava Yollari', base: 'THYAO', logo: 'https://logo.clearbit.com/thy.com' },
    { sym: 'GARAN.IS', name: 'Garanti BBVA', base: 'GARAN', logo: 'https://logo.clearbit.com/garantibbva.com.tr' },
    { sym: 'AKBNK.IS', name: 'Akbank', base: 'AKBNK', logo: 'https://logo.clearbit.com/akbank.com' },
    { sym: 'ISCTR.IS', name: 'Turkiye Is Bankasi', base: 'ISCTR', logo: 'https://logo.clearbit.com/isbank.com.tr' },
    { sym: 'YKBNK.IS', name: 'Yapi Kredi', base: 'YKBNK', logo: 'https://logo.clearbit.com/yapikredi.com.tr' },
    { sym: 'ASELS.IS', name: 'Aselsan', base: 'ASELS', logo: 'https://logo.clearbit.com/aselsan.com.tr' },
    { sym: 'KCHOL.IS', name: 'Koc Holding', base: 'KCHOL', logo: 'https://logo.clearbit.com/koc.com.tr' },
    { sym: 'SAHOL.IS', name: 'Sabanci Holding', base: 'SAHOL', logo: 'https://logo.clearbit.com/sabanci.com' },
    { sym: 'TUPRS.IS', name: 'Tupras', base: 'TUPRS', logo: 'https://logo.clearbit.com/tupras.com.tr' },
    { sym: 'EREGL.IS', name: 'Eregli Demir Celik', base: 'EREGL', logo: 'https://logo.clearbit.com/erdemir.com.tr' },
    { sym: 'BIMAS.IS', name: 'BIM Magazalar', base: 'BIMAS', logo: 'https://logo.clearbit.com/bim.com.tr' },
    { sym: 'SISE.IS', name: 'Sisecam', base: 'SISE', logo: 'https://logo.clearbit.com/sisecam.com.tr' },
    { sym: 'PETKM.IS', name: 'Petkim', base: 'PETKM', logo: 'https://logo.clearbit.com/petkim.com.tr' },
    { sym: 'FROTO.IS', name: 'Ford Otosan', base: 'FROTO', logo: 'https://logo.clearbit.com/fordotosan.com.tr' },
    { sym: 'TOASO.IS', name: 'Tofas', base: 'TOASO', logo: 'https://logo.clearbit.com/tofas.com.tr' }
  ];

  const PROXY_URL = 'https://api.allorigins.win/raw?url=';
  let refreshInterval = null;
  let currentSymbol = '';
  let currentTf = '1d';
  let chart = null;
  let candleSeries = null;

  function formatTry(value, digits = 2) {
    if (!Number.isFinite(value)) return '--';
    return `${value.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits })} TL`;
  }

  function formatVolume(value) {
    if (!Number.isFinite(value)) return '--';
    if (value >= 1000000000) return `${(value / 1000000000).toFixed(2)}B`;
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString('tr-TR');
  }

  function getRange(interval, limit) {
    if (interval === '1wk') return limit > 400 ? '15y' : '10y';
    if (limit > 500) return '5y';
    if (limit > 260) return '2y';
    return '1y';
  }

  async function fetchJson(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (directError) {
      const proxyRes = await fetch(PROXY_URL + encodeURIComponent(url));
      if (!proxyRes.ok) throw directError;
      return proxyRes.json();
    }
  }

  async function fetchYahooKlines(symbol, interval = '1d', limit = 200) {
    const range = getRange(interval, limit);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
    try {
      const data = await fetchJson(url);
      const result = data?.chart?.result?.[0];
      const timestamps = result?.timestamp || [];
      const quote = result?.indicators?.quote?.[0];
      if (!quote || timestamps.length === 0) return [];

      const klines = timestamps.map((time, index) => ({
        time,
        open: quote.open?.[index],
        high: quote.high?.[index],
        low: quote.low?.[index],
        close: quote.close?.[index],
        volume: quote.volume?.[index] || 0
      })).filter(k => Number.isFinite(k.open) && Number.isFinite(k.high) && Number.isFinite(k.low) && Number.isFinite(k.close));

      return klines.slice(-limit);
    } catch (error) {
      console.warn(`Yahoo verisi alinamadi (${symbol}):`, error);
      return [];
    }
  }

  function calculateWMAArray(klines, period) {
    if (klines.length < period) return [];
    const result = [];
    for (let i = period - 1; i < klines.length; i++) {
      let sum = 0;
      let weightSum = 0;
      for (let j = 0; j < period; j++) {
        const weight = period - j;
        sum += klines[i - j].close * weight;
        weightSum += weight;
      }
      result.push({ time: klines[i].time, value: sum / weightSum });
    }
    return result;
  }

  function calculateEMAArray(klines, period) {
    if (klines.length < period) return [];
    const result = [];
    const multiplier = 2 / (period + 1);
    let ema = klines.slice(0, period).reduce((sum, k) => sum + k.close, 0) / period;
    result.push({ time: klines[period - 1].time, value: ema });
    for (let i = period; i < klines.length; i++) {
      ema = (klines[i].close - ema) * multiplier + ema;
      result.push({ time: klines[i].time, value: ema });
    }
    return result;
  }

  function renderLoading() {
    const container = document.getElementById('bistList');
    if (!container) return;
    container.innerHTML = `
      <div style="display:flex; justify-content:center; padding:40px 16px; gap:12px; flex-direction:column; align-items:center; color:var(--text-secondary);">
        <div class="spinner"></div>
        <span style="font-size:13px;">BIST verileri yukleniyor...</span>
      </div>`;
  }

  async function fetchBISTPrices() {
    const container = document.getElementById('bistList');
    const meta = document.getElementById('bistMeta');
    if (!container) return;
    renderLoading();

    const rows = await Promise.allSettled(BIST_LIST.map(async stock => {
      const klines = await fetchYahooKlines(stock.sym, '1d', 10);
      if (klines.length < 2) return '';
      const last = klines[klines.length - 1];
      const prev = klines[klines.length - 2];
      const change = prev.close ? ((last.close - prev.close) / prev.close) * 100 : 0;
      const isUp = change >= 0;
      const pillCls = isUp ? 'up' : 'down';
      return `
        <div class="coin-row" id="bist-row-${stock.base}" style="display:flex; height:auto; min-height:60px; cursor:pointer;" onclick="openBistDetail('${stock.sym}')">
          <div class="m-left">
            <img src="${stock.logo}" class="market-icon" style="border-radius:50%;" onerror="this.style.display='none';this.nextSibling.style.display='flex'">
            <div style="display:none; width:32px; height:32px; border-radius:50%; background:rgba(255,255,255,0.05); align-items:center; justify-content:center; font-size:11px; font-weight:800; color:var(--text-secondary);">${stock.base.slice(0, 2)}</div>
            <div>
              <div class="m-symbol">${stock.base}<span class="m-pair">/BIST</span></div>
              <div style="font-size:10px;color:var(--text-secondary);margin-top:2px;">${stock.name}</div>
            </div>
          </div>
          <div class="m-middle" style="font-size:14px;">${formatTry(last.close)}</div>
          <div class="m-right"><div class="pill ${pillCls}" style="font-size:12px;">${isUp ? '+' : ''}${change.toFixed(2)}%</div></div>
        </div>`;
    }));

    const html = rows.map(r => r.status === 'fulfilled' ? r.value : '').filter(Boolean).join('');
    container.innerHTML = html || `<div style="text-align:center; padding:40px; color:var(--text-secondary);">BIST verisi alinamadi. Daha sonra tekrar deneyin.</div>`;
    if (meta) meta.textContent = `Yahoo Finance - ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} - 60sn otomatik`;
  }

  function renderComment(klines) {
    const commentEl = document.getElementById('bistDetailComment');
    if (!commentEl) return;
    if (typeof generateAdvancedAIComment !== 'function') {
      commentEl.innerHTML = '<span style="color:var(--text-secondary);">AI yorum motoru bulunamadi.</span>';
      return;
    }

    const comment = generateAdvancedAIComment(klines, currentTf);
    commentEl.innerHTML = `
      <div style="margin-bottom:16px; padding:12px; background:rgba(0,0,0,0.15); border-radius:10px; border-left:4px solid ${comment.statusColor};">
        <span style="font-weight:800; color:${comment.statusColor}; font-size:16px;">${comment.statusEmoji}</span>
        <div style="font-size:11px; color:var(--text-secondary); margin-top:6px;">${comment.signalSummary || ''}</div>
        <div style="margin-top:8px;"><span style="background:rgba(255,255,255,0.06); padding:2px 8px; border-radius:12px; font-size:11px; color:var(--text-secondary);">SuperTrend: ${comment.supertrendStatus || 'YOK'}</span></div>
      </div>
      <ul style="margin:0; padding:0; list-style:none;">
        ${comment.items.map(item => `<li style="margin-bottom:8px; display:flex; align-items:baseline; gap:8px; padding:8px; background:rgba(255,255,255,0.02); border-radius:6px;"><span style="color:var(--brand); font-size:12px;">▸</span> <span style="color:var(--text-primary);">${item}</span></li>`).join('')}
      </ul>`;
  }

  async function renderChart(klines) {
    const container = document.getElementById('bistChartContainer');
    if (!container || typeof LightweightCharts === 'undefined') return;

    if (chart) {
      try { chart.remove(); } catch (error) {}
      chart = null;
      candleSeries = null;
    }
    container.innerHTML = '';
    await new Promise(resolve => setTimeout(resolve, 100));
    container.style.display = 'block';
    container.style.width = '100%';
    container.style.height = '350px';

    chart = LightweightCharts.createChart(container, {
      width: container.clientWidth || 400,
      height: 350,
      layout: { background: { color: '#0b0e11' }, textColor: '#eaecef' },
      grid: { vertLines: { color: '#2a2f36' }, horzLines: { color: '#2a2f36' } },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      timeScale: { borderColor: '#2a2f36', timeVisible: currentTf !== '1wk' },
      rightPriceScale: { borderColor: '#2a2f36' }
    });

    candleSeries = chart.addCandlestickSeries({
      upColor: '#0ecb81',
      downColor: '#f6465d',
      borderDownColor: '#f6465d',
      borderUpColor: '#0ecb81',
      wickDownColor: '#f6465d',
      wickUpColor: '#0ecb81'
    });
    candleSeries.setData(klines);

    const wma50 = calculateWMAArray(klines, 50);
    const ema84 = calculateEMAArray(klines, 84);
    if (wma50.length) {
      const series = chart.addLineSeries({ color: '#FF9800', lineWidth: 1 });
      series.setData(wma50);
    }
    if (ema84.length) {
      const series = chart.addLineSeries({ color: '#00BCD4', lineWidth: 1 });
      series.setData(ema84);
    }
    chart.timeScale().fitContent();
  }

  async function refreshDetail() {
    if (!currentSymbol) return;
    const limitSelect = document.getElementById('bistCandleLimitSelect');
    const limit = limitSelect ? parseInt(limitSelect.value, 10) : 400;
    const klines = await fetchYahooKlines(currentSymbol, currentTf, limit);
    const commentEl = document.getElementById('bistDetailComment');
    if (!klines || klines.length < 50) {
      if (commentEl) commentEl.innerHTML = '<span style="color:var(--down);">Analiz icin yeterli veri yok.</span>';
      return;
    }

    const stock = BIST_LIST.find(s => s.sym === currentSymbol);
    const last = klines[klines.length - 1];
    const prev = klines[klines.length - 2];
    const change = prev.close ? ((last.close - prev.close) / prev.close) * 100 : 0;
    document.getElementById('bistDetailSymbol').textContent = `${stock?.base || currentSymbol.replace('.IS', '')}/TL`;
    document.getElementById('bistDetailIcon').textContent = (stock?.base || 'BI').slice(0, 2);
    document.getElementById('bistDetailPrice').textContent = formatTry(last.close);
    const changeEl = document.getElementById('bistDetailChange');
    changeEl.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
    changeEl.style.color = change >= 0 ? 'var(--up)' : 'var(--down)';
    document.getElementById('bdHigh').textContent = formatTry(last.high);
    document.getElementById('bdLow').textContent = formatTry(last.low);
    document.getElementById('bdVolume').textContent = formatVolume(last.volume);
    document.getElementById('bdTimeframe').textContent = currentTf === '1wk' ? '1hf' : '1g';
    document.getElementById('bistDetailUpdate').textContent = `Son guncelleme: ${new Date().toLocaleTimeString('tr-TR')}`;

    renderComment(klines);
    await renderChart(klines);
  }

  async function openDetail(symbol) {
    currentSymbol = symbol;
    currentTf = '1d';
    document.querySelectorAll('[data-bist-tf]').forEach(btn => btn.classList.toggle('active', btn.dataset.bistTf === currentTf));
    const modal = document.getElementById('bistDetailModal');
    if (!modal) return;
    modal.style.display = 'block';
    document.getElementById('bistDetailComment').innerHTML = '<span style="color:var(--text-secondary);">Analiz yukleniyor...</span>';
    const chartContainer = document.getElementById('bistChartContainer');
    if (chartContainer) chartContainer.innerHTML = '<div style="display:flex; justify-content:center; padding:80px 0;"><div class="spinner"></div></div>';
    await refreshDetail();
  }

  function closeDetail() {
    const modal = document.getElementById('bistDetailModal');
    if (modal) modal.style.display = 'none';
    if (chart) {
      try { chart.remove(); } catch (error) {}
      chart = null;
      candleSeries = null;
    }
  }

  function switchTF(tf) {
    currentTf = tf;
    document.querySelectorAll('[data-bist-tf]').forEach(btn => btn.classList.toggle('active', btn.dataset.bistTf === tf));
    refreshDetail();
  }

  function start() {
    fetchBISTPrices();
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(fetchBISTPrices, 60000);
  }

  function stop() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = null;
  }

  return { BIST_LIST, start, stop, fetchBISTPrices, openDetail, closeDetail, switchTF, refreshDetail };
})();

window.BIST_LIST = BistModule.BIST_LIST;
window.BistModule = BistModule;
window.fetchBISTPrices = () => BistModule.fetchBISTPrices();
window.openBistDetail = symbol => BistModule.openDetail(symbol);
window.closeBistDetail = () => BistModule.closeDetail();
window.switchBistTF = tf => BistModule.switchTF(tf);
window.switchBistCandleLimit = () => BistModule.refreshDetail();
