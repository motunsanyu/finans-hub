let borsaDataList = [];
let borsaViewMode = 'list'; // 'list' veya 'grid'

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

/**
 * Hisse için avatar HTML üretir.
 * Logo varsa <img> gösterir, yoksa renkli initials.
 */
function makeAvatar(item, size = 32, fontSize = 12) {
  const colors = ['#E84B4B','#4B8EE8','#4BE8A0','#E8A04B','#A04BE8','#4BE8E8','#E84B9C','#8EE84B'];
  let colorIdx = 0;
  for (let c of item.symbol) colorIdx = (colorIdx + c.charCodeAt(0)) % colors.length;
  const bgColor = colors[colorIdx];
  const initials = item.symbol.substring(0, 2);

  if (item.logo_url) {
    return `<img src="${item.logo_url}" 
      style="width:${size}px; height:${size}px; border-radius:50%; object-fit:contain; background:white; padding:2px;"
      onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
    /><div style="display:none; width:${size}px; height:${size}px; border-radius:50%; background:${bgColor}; align-items:center; justify-content:center; font-size:${fontSize}px; font-weight:800; color:white; flex-shrink:0;">${initials}</div>`;
  }

  return `<div style="width:${size}px; height:${size}px; border-radius:50%; background:${bgColor}; display:flex; align-items:center; justify-content:center; font-size:${fontSize}px; font-weight:800; color:white; flex-shrink:0;">${initials}</div>`;
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

function renderBorsaListView(list, container) {
  const header = document.getElementById('borsaListHeader');
  if (header) header.style.display = 'flex';

  let html = '';
  list.forEach(item => {
    const { pillClass, displayChg } = getChangeInfo(item);
    const priceStr = item.price ? `₺${item.price}` : '--';
    const avatar = makeAvatar(item, 32, 12);
    
    html += `
      <div class="market-row" onclick="window.showBorsaDetail('${item.symbol}')" style="cursor:pointer;">
        <div class="m-left">
          <div style="margin-right:12px; flex-shrink:0; display:flex;">${avatar}</div>
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
    const { displayChg, chgColor } = getChangeInfo(item);
    const priceStr = item.price || '--';
    const avatar = makeAvatar(item, 34, 12);

    html += `
      <div onclick="window.showBorsaDetail('${item.symbol}')"
        style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:10px 8px; cursor:pointer; transition:background 0.15s;"
        onmouseover="this.style.background='rgba(255,255,255,0.1)'"
        onmouseout="this.style.background='rgba(255,255,255,0.05)'">
        <div style="display:flex; margin-bottom:6px;">${avatar}</div>
        <div style="font-size:11px; font-weight:700; color:var(--text-primary); margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.symbol}</div>
        <div style="font-size:11px; font-weight:700; color:${chgColor}; margin-bottom:4px;">${displayChg}</div>
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
  const brand = 'var(--brand)';
  
  if (mode === 'list') {
    if (listBtn) { listBtn.style.background = brand; listBtn.querySelector('svg').setAttribute('stroke', 'black'); }
    if (gridBtn) { gridBtn.style.background = 'transparent'; gridBtn.querySelector('svg').setAttribute('stroke', 'rgba(255,255,255,0.5)'); }
  } else {
    if (gridBtn) { gridBtn.style.background = brand; gridBtn.querySelector('svg').setAttribute('stroke', 'black'); }
    if (listBtn) { listBtn.style.background = 'transparent'; listBtn.querySelector('svg').setAttribute('stroke', 'rgba(255,255,255,0.5)'); }
  }
  
  // Aktif arama filtresi varsa koruyarak render et
  const input = document.getElementById('borsaSearchInput');
  const filter = input ? input.value.toLowerCase() : '';
  if (filter) {
    const filtered = borsaDataList.filter(item => 
      item.symbol.toLowerCase().includes(filter) || 
      (item.name && item.name.toLowerCase().includes(filter))
    );
    renderBorsaList(filtered);
  } else {
    renderBorsaList(borsaDataList);
  }
};

window.filterBorsa = function() {
  const input = document.getElementById('borsaSearchInput');
  if (!input) return;
  const filter = input.value.toLowerCase();
  
  if (!filter) {
    renderBorsaList(borsaDataList);
    return;
  }
  
  const filtered = borsaDataList.filter(item => 
    item.symbol.toLowerCase().includes(filter) || 
    (item.name && item.name.toLowerCase().includes(filter))
  );
  
  renderBorsaList(filtered);
};

window.showBorsaDetail = function(symbol) {
  const item = borsaDataList.find(i => i.symbol === symbol);
  if (!item) return;

  const listSection = document.getElementById('borsaSection');
  const detailSection = document.getElementById('borsaDetailSection');
  
  if (listSection) listSection.style.display = 'none';
  if (detailSection) detailSection.style.display = 'block';

  // Detay sayfasında büyük logo
  const bdLogoEl = document.getElementById('bdLogo');
  if (bdLogoEl) {
    if (item.logo_url) {
      bdLogoEl.innerHTML = `<img src="${item.logo_url}" 
        style="width:64px; height:64px; border-radius:50%; object-fit:contain; background:white; padding:4px;"
        onerror="this.parentElement.innerHTML='<div style=\\'width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:white;\\'>${item.symbol.substring(0,2)}</div>'"
      />`;
    } else {
      const colors = ['#E84B4B','#4B8EE8','#4BE8A0','#E8A04B','#A04BE8','#4BE8E8','#E84B9C','#8EE84B'];
      let ci = 0;
      for (let c of item.symbol) ci = (ci + c.charCodeAt(0)) % colors.length;
      bdLogoEl.innerHTML = `<div style="width:64px; height:64px; border-radius:50%; background:${colors[ci]}; display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:800; color:white;">${item.symbol.substring(0,2)}</div>`;
    }
  }

  document.getElementById('bdSymbol').innerText = item.symbol || '--';
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
