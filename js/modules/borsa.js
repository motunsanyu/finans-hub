let borsaDataList = [];
let borsaViewMode = 'list'; // 'list' veya 'grid'

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
    
    html += `
      <div class="market-row" onclick="window.showBorsaDetail('${item.symbol}')" style="cursor:pointer;">
        <div class="m-left">
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
    const triangleClass = chgVal > 0 ? 'css-yukari' : (chgVal < 0 ? 'css-asagi' : 'css-notr');

    html += `
      <div onclick="window.showBorsaDetail('${item.symbol}')"
        style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:10px 8px 10px 10px; cursor:pointer; transition:background 0.15s;"
        onmouseover="this.style.background='rgba(255,255,255,0.1)'"
        onmouseout="this.style.background='rgba(255,255,255,0.05)'">
        <div style="margin-bottom:7px;">${avatar}</div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
          <div style="font-size:12px; font-weight:800; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; letter-spacing:0.3px;">${item.symbol}</div>
          <div style="font-size:13px; font-weight:800; color:var(--text-primary);">${priceStr}</div>
        </div>
        <div style="font-size:11px; font-weight:700; color:${chgColor}; display:flex; align-items:center;">
          <div class="${triangleClass}"></div>%${cleanChgStr}
        </div>
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
  
  const input = document.getElementById('borsaSearchInput');
  const filter = input ? input.value.toLowerCase() : '';
  const listToRender = filter
    ? borsaDataList.filter(item => item.symbol.toLowerCase().includes(filter) || (item.name && item.name.toLowerCase().includes(filter)))
    : borsaDataList;
  renderBorsaList(listToRender);
};

window.filterBorsa = function() {
  const input = document.getElementById('borsaSearchInput');
  if (!input) return;
  const filter = input.value.toLowerCase();
  
  const filtered = filter
    ? borsaDataList.filter(item => item.symbol.toLowerCase().includes(filter) || (item.name && item.name.toLowerCase().includes(filter)))
    : borsaDataList;
  
  renderBorsaList(filtered);
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
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.closeBorsaDetail = function() {
  const listSection = document.getElementById('borsaSection');
  const detailSection = document.getElementById('borsaDetailSection');
  
  if (detailSection) detailSection.style.display = 'none';
  if (listSection) listSection.style.display = 'block';
};

window.fetchBorsaData = fetchBorsaData;
