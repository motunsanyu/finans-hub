let borsaDataList = [];
let borsaViewMode = 'list'; // 'list' veya 'grid'
let borsaFavorites = JSON.parse(localStorage.getItem('borsaFavorites') || '[]');
let borsaFavMode = false;
let borsaSortMode = 'none'; // 'desc' (artanlar), 'asc' (düşenler), 'none'
let borsaNames = {}; // Hisse adlari

// Hisse tam adlarini ceker
async function fetchBorsaNames() {
  if (Object.keys(borsaNames).length > 0) return;
  try {
    const res = await fetch('./tradingview_hisse_adlari.txt');
    if (!res.ok) return;
    const text = await res.text();
    text.split('\n').forEach(line => {
      const parts = line.split(' - ');
      if (parts.length >= 2) {
        borsaNames[parts[0].trim()] = parts.slice(1).join(' - ').trim();
      }
    });
  } catch (err) {
    console.error("Hisse adlari yuklenemedi:", err);
  }
}

// Her sembol icin tutarli gradient renk paleti uretir
function getSymbolColors(symbol) {
  const palettes = [
    { bg: '#E84B4B', light: '#FF7070' },
    { bg: '#4B8EE8', light: '#70AAFF' },
    { bg: '#00C896', light: '#2EEDB0' },
    { bg: '#E8904B', light: '#FFAE70' },
    { bg: '#9B4BE8', light: '#BF70FF' },
    { bg: '#E84B9C', light: '#FF70C0' },
    { bg: '#4BCCE8', light: '#70E4FF' },
    { bg: '#8CC63F', light: '#AADD60' },
    { bg: '#E8C44B', light: '#FFE070' },
    { bg: '#E85D4B', light: '#FF7D70' },
    { bg: '#4B6AE8', light: '#7090FF' },
    { bg: '#C8484B', light: '#E87070' },
  ];
  let idx = 0;
  for (let c of symbol) idx = (idx * 31 + c.charCodeAt(0)) & 0xffffff;
  return palettes[Math.abs(idx) % palettes.length];
}

function makeAvatar(symbol, size = 32, fontSize = 13) {
  const { bg, light } = getSymbolColors(symbol);
  const letters = symbol.length >= 2 ? symbol.substring(0, 2) : symbol;
  const id = `grad-${symbol}-${size}`;
  const svgGrad = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="border-radius:50%; flex-shrink:0;">
    <defs>
      <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${light}"/>
        <stop offset="100%" stop-color="${bg}"/>
      </linearGradient>
    </defs>
    <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="url(#${id})"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" 
      font-family="'Inter','Segoe UI',sans-serif" font-size="${fontSize}" 
      font-weight="800" fill="white" letter-spacing="-0.5">${letters}</text>
  </svg>`;
  
  return `<img src="./bist_logo/${symbol}.svg" 
      style="width:${size}px; height:${size}px; border-radius:50%; object-fit:contain; background:white; padding:2px; flex-shrink:0;"
      onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
    /><div style="display:none; width:${size}px; height:${size}px; flex-shrink:0;">${svgGrad}</div>`;
}

async function fetchBorsaData() {
  const container = document.getElementById('borsaList');
  if (!container) return;
  
  if (borsaDataList.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:40px 16px; color:var(--text-secondary); font-size:13px;">Yükleniyor...</div>`;
  }
  
  fetchBorsaNames(); // Paralelde isimleri yukle
  
  if (!window._supabaseClient) {
    container.innerHTML = `<div style="text-align:center; padding:40px 16px; color:var(--down); font-size:13px;">Supabase bağlantısı kurulamadı.</div>`;
    return;
  }
  
  try {
    const { data, error } = await window._supabaseClient
      .from('borsa_data')
      .select('*')
      .order('symbol', { ascending: true });
      
    if (error) throw error;
    
    borsaDataList = data || [];
    renderBorsaList(borsaDataList);
    
    const metaEl = document.getElementById('borsaMeta');
    if (metaEl) {
      metaEl.innerText = `Son güncelleme: ${new Date().toLocaleTimeString('tr-TR')} (Veritabanından)`;
    }
  } catch (err) {
    console.error("Borsa verisi çekme hatası:", err);
    container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--down);">Bağlantı hatası. <button onclick="fetchBorsaData()" style="color:var(--brand);background:none;border:none;font-weight:800;cursor:pointer;">Tekrar dene</button></div>`;
  }
}

function getChangeInfo(item) {
  const chgStr = item.change_percentage || '0';
  let chgVal = 0;
  let cleanChg = chgStr.replace('%', '').replace(',', '.').trim();
  if (cleanChg) chgVal = parseFloat(cleanChg);
  const pillClass = chgVal > 0 ? 'up' : (chgVal < 0 ? 'down' : 'neutral');
  const displayChg = chgVal > 0 ? `+${chgStr}` : chgStr;
  const chgColor = chgVal > 0 ? 'var(--up)' : (chgVal < 0 ? 'var(--down)' : 'var(--text-secondary)');
  return { chgStr, chgVal, pillClass, displayChg, chgColor };
}

function renderBorsaList(list) {
  const container = document.getElementById('borsaList');
  if (!container) return;
  
  if (list.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:40px 16px; color:var(--text-secondary); font-size:13px;">Hisse bulunamadı.</div>`;
    return;
  }
  
  if (borsaViewMode === 'grid') {
    renderBorsaGrid(list, container);
  } else {
    renderBorsaListView(list, container);
  }
}

function renderBorsaListView(list, container) {
  const header = document.getElementById('borsaListHeader');
  if (header) header.style.display = 'flex';

  let html = '';
  list.forEach(item => {
    const { pillClass, displayChg } = getChangeInfo(item);
    const priceStr = item.price ? `₺${item.price}` : '--';
    const avatar = makeAvatar(item.symbol, 34, 13);
    const isFav = borsaFavorites.includes(item.symbol);
    const favColor = isFav ? 'var(--brand)' : 'rgba(255,255,255,0.2)';
    const favFill = isFav ? 'var(--brand)' : 'none';
    
    html += `
      <div class="market-row" onclick="window.showBorsaDetail('${item.symbol}')" style="cursor:pointer; position:relative;">
        <div class="m-left">
          <button onclick="window.toggleFavorite(event, '${item.symbol}')" style="background:none; border:none; padding:0 8px 0 0; cursor:pointer; display:flex; align-items:center;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="${favFill}" stroke="${favColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          </button>
          <div style="margin-right:12px;">${avatar}</div>
          <div class="m-symbol">${item.symbol}</div>
        </div>
        <div class="m-middle" style="font-weight:700;">${priceStr}</div>
        <div class="m-right">
          <div class="pill ${pillClass}">${displayChg}</div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

function renderBorsaGrid(list, container) {
  const header = document.getElementById('borsaListHeader');
  if (header) header.style.display = 'none';

  let html = '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; padding:4px 12px 16px;">';
  list.forEach(item => {
    const { displayChg, chgColor, chgVal, chgStr } = getChangeInfo(item);
    const priceStr = item.price || '--';
    const avatar = makeAvatar(item.symbol, 36, 13);
    
    const cleanChgStr = chgStr.replace('-', '').replace('+', '');
    
    const triUp = `<div style="width:0; height:0; border-left:4px solid transparent; border-right:4px solid transparent; border-bottom:6px solid var(--up); display:inline-block; margin-right:4px; vertical-align:middle;"></div>`;
    const triDown = `<div style="width:0; height:0; border-left:4px solid transparent; border-right:4px solid transparent; border-top:6px solid var(--down); display:inline-block; margin-right:4px; vertical-align:middle;"></div>`;
    const triNeu = `<div style="width:6px; height:2px; background-color:var(--text-secondary); display:inline-block; margin-right:4px; vertical-align:middle;"></div>`;
    const triangleHtml = chgVal > 0 ? triUp : (chgVal < 0 ? triDown : triNeu);

    const isFav = borsaFavorites.includes(item.symbol);
    const favColor = isFav ? 'var(--brand)' : 'rgba(255,255,255,0.2)';
    const favFill = isFav ? 'var(--brand)' : 'none';

    html += `
      <div onclick="window.showBorsaDetail('${item.symbol}')"
        style="position:relative; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:10px 8px 10px 10px; cursor:pointer; transition:background 0.15s;"
        onmouseover="this.style.background='rgba(255,255,255,0.1)'"
        onmouseout="this.style.background='rgba(255,255,255,0.05)'">
        <button onclick="window.toggleFavorite(event, '${item.symbol}')" style="position:absolute; top:8px; right:8px; background:none; border:none; padding:4px; cursor:pointer; z-index:2; display:flex;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="${favFill}" stroke="${favColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        </button>
        <div style="margin-bottom:7px;">${avatar}</div>
        <div style="font-size:11px; font-weight:800; color:var(--text-primary); margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; letter-spacing:0.3px; padding-right:16px;">${item.symbol}</div>
        <div style="font-size:11px; font-weight:700; color:${chgColor}; margin-bottom:5px; display:flex; align-items:center;">
          ${triangleHtml}%${cleanChgStr}
        </div>
        <div style="font-size:12px; font-weight:800; color:var(--text-primary);">${priceStr}</div>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;
}

window.setBorsaView = function(mode) {
  borsaViewMode = mode;
  
  const listBtn = document.getElementById('borsaListViewBtn');
  const gridBtn = document.getElementById('borsaGridViewBtn');
  
  if (mode === 'list') {
    if (listBtn) { listBtn.style.background = 'var(--brand)'; listBtn.querySelector('svg').setAttribute('stroke', 'black'); }
    if (gridBtn) { gridBtn.style.background = 'transparent'; gridBtn.querySelector('svg').setAttribute('stroke', 'rgba(255,255,255,0.5)'); }
  } else {
    if (gridBtn) { gridBtn.style.background = 'var(--brand)'; gridBtn.querySelector('svg').setAttribute('stroke', 'black'); }
    if (listBtn) { listBtn.style.background = 'transparent'; listBtn.querySelector('svg').setAttribute('stroke', 'rgba(255,255,255,0.5)'); }
  }
  
  window.filterBorsa();
};

window.clearBorsaSearch = function() {
  const input = document.getElementById('borsaSearchInput');
  if (input) {
    input.value = '';
    window.filterBorsa();
  }
};

window.toggleBorsaFavMode = function() {
  borsaFavMode = !borsaFavMode;
  const btn = document.getElementById('borsaFavToggleBtn');
  if (btn) {
    if (borsaFavMode) {
      btn.style.background = 'var(--brand)';
      btn.style.color = 'black';
      btn.querySelector('svg').setAttribute('stroke', 'black');
    } else {
      btn.style.background = 'rgba(255,255,255,0.06)';
      btn.style.color = 'var(--text-secondary)';
      btn.querySelector('svg').setAttribute('stroke', 'currentColor');
    }
  }
  window.filterBorsa();
};

window.toggleBorsaSort = function() {
  if (borsaSortMode === 'none') borsaSortMode = 'desc';
  else if (borsaSortMode === 'desc') borsaSortMode = 'asc';
  else borsaSortMode = 'none';
  
  const btn = document.getElementById('borsaSortToggleBtn');
  if (btn) {
    if (borsaSortMode === 'desc') {
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg> En Çok Artanlar`;
      btn.style.color = 'var(--up)';
    } else if (borsaSortMode === 'asc') {
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg> En Çok Düşenler`;
      btn.style.color = 'var(--down)';
    } else {
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg> Sırala: Varsayılan`;
      btn.style.color = 'var(--text-secondary)';
    }
  }
  window.filterBorsa();
};

window.toggleFavorite = function(event, symbol) {
  event.stopPropagation();
  const idx = borsaFavorites.indexOf(symbol);
  if (idx > -1) {
    borsaFavorites.splice(idx, 1);
  } else {
    borsaFavorites.push(symbol);
  }
  localStorage.setItem('borsaFavorites', JSON.stringify(borsaFavorites));
  window.filterBorsa();
};

window.filterBorsa = function() {
  const input = document.getElementById('borsaSearchInput');
  const clearBtn = document.getElementById('borsaSearchClearBtn');
  const filterText = input ? input.value.toLowerCase() : '';
  
  if (clearBtn) {
    clearBtn.style.display = filterText ? 'block' : 'none';
  }
  
  let list = [...borsaDataList];
  
  if (filterText) {
    list = list.filter(item => 
      item.symbol.toLowerCase().includes(filterText) || 
      (borsaNames[item.symbol] && borsaNames[item.symbol].toLowerCase().includes(filterText))
    );
  }
  
  if (borsaFavMode) {
    list = list.filter(item => borsaFavorites.includes(item.symbol));
  }
  
  if (borsaSortMode !== 'none') {
    list.sort((a, b) => {
      const aVal = getChangeInfo(a).chgVal;
      const bVal = getChangeInfo(b).chgVal;
      if (borsaSortMode === 'desc') return bVal - aVal;
      return aVal - bVal;
    });
  }
  
  renderBorsaList(list);
};

window.showBorsaDetail = function(symbol) {
  const item = borsaDataList.find(i => i.symbol === symbol);
  if (!item) return;

  const listSection = document.getElementById('borsaSection');
  const detailSection = document.getElementById('borsaDetailSection');
  
  if (listSection) listSection.style.display = 'none';
  if (detailSection) detailSection.style.display = 'block';

  // Detay sayfasinda buyuk avatar
  const bdLogoEl = document.getElementById('bdLogo');
  if (bdLogoEl) {
    bdLogoEl.innerHTML = makeAvatar(symbol, 72, 26);
  }

  document.getElementById('bdSymbol').innerText = symbol || '--';
  
  const bdFullNameEl = document.getElementById('bdFullName');
  if (bdFullNameEl) {
    bdFullNameEl.innerText = borsaNames[symbol] || 'Hisse Senedi';
  }
  
  document.getElementById('bdPrice').innerText = item.price ? `₺${item.price}` : '--';
  
  const { chgVal, chgStr } = getChangeInfo(item);
  const bdChange = document.getElementById('bdChange');
  bdChange.innerText = chgVal > 0 ? `+${chgStr}` : chgStr;
  bdChange.className = 'pill ' + (chgVal > 0 ? 'up' : (chgVal < 0 ? 'down' : 'neutral'));
  
  document.getElementById('bdLow').innerText = item.low ? `₺${item.low}` : '--';
  document.getElementById('bdHigh').innerText = item.high ? `₺${item.high}` : '--';
  document.getElementById('bdAof').innerText = item.aof ? `₺${item.aof}` : '--';
  document.getElementById('bdTime').innerText = item.time || '--';
  document.getElementById('bdVolLot').innerText = item.volume_lot || '--';
  document.getElementById('bdVolTl').innerText = item.volume_tl ? `₺${item.volume_tl}` : '--';
  
  // TradingView grafiğini yükle
  renderBorsaTradingViewChart(symbol);
  
  // Akıllı önerileri oluştur
  renderBorsaAIAnalysis(item, chgVal);
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

let borsaChart = null;
let borsaCandleSeries = null;

async function renderBorsaTradingViewChart(symbol) {
  const container = document.getElementById('bdTradingViewChart');
  if (!container) return;
  
  container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-secondary);">Grafik verileri yükleniyor...</div>';
  
  // Kriptoda olduğu gibi kendi grafiğimizi çizmek için Yahoo Finance'den geçmiş verileri çekiyoruz
  const yahooSymbol = `${symbol}.IS`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=6mo`;
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  
  try {
    const res = await fetch(proxyUrl);
    const data = await res.json();
    const result = data.chart?.result?.[0];
    
    if (!result || !result.timestamp) {
      throw new Error("Veri bulunamadı");
    }
    
    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];
    
    const klines = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (quotes.open[i] !== null) {
        klines.push({
          time: timestamps[i], // LightweightCharts saniye cinsinden timestamp kabul eder (1d için)
          open: quotes.open[i],
          high: quotes.high[i],
          low: quotes.low[i],
          close: quotes.close[i]
        });
      }
    }
    
    if (klines.length === 0) throw new Error("Mum verisi yok");
    
    container.innerHTML = '';
    
    // Container boyutlarını ayarla
    container.style.width = '100%';
    container.style.height = '400px';
    
    borsaChart = LightweightCharts.createChart(container, {
      localization: {
        timeFormatter: (timestamp) => {
          const d = new Date(timestamp * 1000);
          return d.toLocaleDateString('tr-TR');
        }
      },
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#848e9c',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      rightPriceScale: { 
        borderColor: 'rgba(255,255,255,0.1)',
        textColor: 'var(--text-primary)'
      },
      timeScale: { borderColor: 'rgba(255,255,255,0.1)' },
      width: container.clientWidth || 400,
      height: 400,
    });
    
    borsaCandleSeries = borsaChart.addCandlestickSeries({
      upColor: '#00b050',
      downColor: '#ff0000',
      borderDownColor: '#ff0000',
      borderUpColor: '#00b050',
      wickDownColor: '#ff0000',
      wickUpColor: '#00b050',
    });
    
    borsaCandleSeries.setData(klines);
    borsaChart.timeScale().fitContent();
    
  } catch (err) {
    console.error("Hisse grafiği çizilemedi:", err);
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:180px; background:rgba(255,255,255,0.02); border:1px dashed rgba(255,255,255,0.1); border-radius:8px; text-align:center; padding:20px;">
        <div style="font-size:24px; margin-bottom:12px;">🚫📊</div>
        <div style="font-size:13px; color:var(--text-secondary); margin-bottom:16px;">Borsa grafiği yüklenirken bir hata oluştu.<br>Veri kaynağı geçici olarak yanıt vermiyor olabilir.</div>
        <a href="https://tr.tradingview.com/chart/?symbol=BIST:${symbol}" target="_blank" style="background:var(--brand); color:black; font-weight:800; font-size:13px; padding:10px 20px; border-radius:8px; text-decoration:none; display:inline-block;">TradingView'de Aç</a>
      </div>
    `;
  }
}

function renderBorsaAIAnalysis(item, chgVal) {
  const el = document.getElementById('bdAIAnalysis');
  if (!el) return;
  
  const price = parseFloat(String(item.price).replace(',', '.')) || 0;
  const high = parseFloat(String(item.high).replace(',', '.')) || 0;
  const low = parseFloat(String(item.low).replace(',', '.')) || 0;
  const aof = parseFloat(String(item.aof).replace(',', '.')) || 0;
  const volLot = item.volume_lot || '0';
  const volTl = item.volume_tl || '0';
  const symbol = item.symbol;
  const fullName = borsaNames[symbol] || symbol;
  
  const suggestions = [];
  let overallSignal = 'NOTR';
  let signalColor = 'var(--text-secondary)';
  let signalEmoji = '⚖️';
  
  // Değişim analizi
  if (chgVal > 3) {
    suggestions.push(`📈 <b>${symbol}</b> bugün <b style="color:var(--up)">%${Math.abs(chgVal).toFixed(2)}</b> yükselişte. Güçlü alıcı baskısı gözleniyor.`);
    overallSignal = 'GÜÇLÜ YÜKSELİŞ'; signalColor = 'var(--up)'; signalEmoji = '🚀';
  } else if (chgVal > 0) {
    suggestions.push(`📈 <b>${symbol}</b> bugün <b style="color:var(--up)">%${Math.abs(chgVal).toFixed(2)}</b> artıda. Olumlu bir seyir izliyor.`);
    overallSignal = 'YÜKSELİŞ'; signalColor = 'var(--up)'; signalEmoji = '✅';
  } else if (chgVal < -3) {
    suggestions.push(`📉 <b>${symbol}</b> bugün <b style="color:var(--down)">%${Math.abs(chgVal).toFixed(2)}</b> düşüşte. Sert satış baskısı var.`);
    overallSignal = 'GÜÇLÜ DÜŞÜŞ'; signalColor = 'var(--down)'; signalEmoji = '🔻';
  } else if (chgVal < 0) {
    suggestions.push(`📉 <b>${symbol}</b> bugün <b style="color:var(--down)">%${Math.abs(chgVal).toFixed(2)}</b> düşüşte. Satıcılar baskın konumda.`);
    overallSignal = 'DÜŞÜŞ'; signalColor = 'var(--down)'; signalEmoji = '⚠️';
  } else {
    suggestions.push(`➖ <b>${symbol}</b> bugün yatay bir seyir izliyor. Piyasa yön arıyor.`);
  }
  
  // High/Low analizi
  if (price > 0 && high > 0 && low > 0 && high !== low) {
    const range = high - low;
    const posInRange = ((price - low) / range) * 100;
    
    if (posInRange > 85) {
      suggestions.push(`🔝 Fiyat günün zirve bölgesinde (%${posInRange.toFixed(0)}). Alıcılar kontrolü elinde tutuyor.`);
    } else if (posInRange > 60) {
      suggestions.push(`📊 Fiyat gün içi bandının üst yarısında (%${posInRange.toFixed(0)}). Olumlu bir görünüm sergileniyor.`);
    } else if (posInRange < 15) {
      suggestions.push(`⚡ Fiyat günün dip bölgesinde (%${posInRange.toFixed(0)}). Potansiyel dip seviyeleri test ediliyor.`);
    } else if (posInRange < 40) {
      suggestions.push(`📊 Fiyat gün içi bandının alt yarısında (%${posInRange.toFixed(0)}). Baskı devam edebilir.`);
    } else {
      suggestions.push(`📊 Fiyat gün içi bandının ortasında seyrediyor. Taraflar dengede.`);
    }
    
    if (range > 0) {
      const rangePercent = (range / low) * 100;
      if (rangePercent > 5) {
        suggestions.push(`📐 Bugünkü gün içi hareket aralığı %${rangePercent.toFixed(2)} — oldukça volatil bir gün.`);
      } else if (rangePercent < 1) {
        suggestions.push(`📐 Bugünkü gün içi hareket aralığı %${rangePercent.toFixed(2)} — sıkışık bir görünüm.`);
      }
    }
  }
  
  // AOF analizi
  if (price > 0 && aof > 0) {
    const aofDiff = ((price - aof) / aof) * 100;
    if (aofDiff > 1) {
      suggestions.push(`💰 Fiyat, ağırlıklı ortalama fiyatın (AOF: ₺${item.aof}) <b style="color:var(--up)">%${aofDiff.toFixed(2)}</b> üzerinde — kısa vadede kâr realizasyonu gelebilir.`);
    } else if (aofDiff < -1) {
      suggestions.push(`💰 Fiyat, ağırlıklı ortalama fiyatın (AOF: ₺${item.aof}) <b style="color:var(--down)">%${Math.abs(aofDiff).toFixed(2)}</b> altında — AOF'a doğru toparlanma potansiyeli var.`);
    } else {
      suggestions.push(`💰 Fiyat, ağırlıklı ortalama fiyata (AOF: ₺${item.aof}) yakın seyrediyor — denge bölgesinde.`);
    }
  }
  
  // Son güncelleme
  if (item.time) {
    suggestions.push(`🕐 Son veri güncellemesi: <b>${item.time}</b>`);
  }
  
  el.innerHTML = `
    <div style="margin-bottom:14px; padding:12px; background:rgba(0,0,0,0.15); border-radius:10px; border-left:4px solid ${signalColor};">
      <span style="font-weight:800; color:${signalColor}; font-size:16px;">${signalEmoji} ${overallSignal}</span>
      <div style="font-size:11px; color:var(--text-secondary); margin-top:6px;">${fullName}</div>
    </div>
    <ul style="margin:0; padding:0; list-style:none;">
      ${suggestions.map(s => `<li style="margin-bottom:8px; display:flex; align-items:baseline; gap:8px; padding:8px; background:rgba(255,255,255,0.02); border-radius:6px;"><span style="color:var(--text-primary); font-size:12px;">${s}</span></li>`).join('')}
    </ul>`;
}

window.closeBorsaDetail = function() {
  const listSection = document.getElementById('borsaSection');
  const detailSection = document.getElementById('borsaDetailSection');
  
  // TradingView widget temizle
  const chartContainer = document.getElementById('bdTradingViewChart');
  if (chartContainer) chartContainer.innerHTML = '';
  
  if (detailSection) detailSection.style.display = 'none';
  if (listSection) listSection.style.display = 'block';
};

window.fetchBorsaData = fetchBorsaData;
