let borsaDataList = [];

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

function renderBorsaList(list) {
  const container = document.getElementById('borsaList');
  if (!container) return;
  
  if (list.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:40px 16px; color:var(--text-secondary); font-size:13px;">Hisse bulunamadı.</div>`;
    return;
  }
  
  let html = '';
  list.forEach(item => {
    const chgStr = item.change_percentage || '0';
    let chgVal = 0;
    
    // Değişim yüzdesini sayıya çevir (Örn: "%1,25" -> 1.25, "%-0,5" -> -0.5)
    let cleanChg = chgStr.replace('%', '').replace(',', '.').trim();
    if (cleanChg) chgVal = parseFloat(cleanChg);
    
    let isUp = chgVal > 0;
    let isDown = chgVal < 0;
    
    let pillClass = 'neutral';
    if (isUp) pillClass = 'up';
    if (isDown) pillClass = 'down';
    
    const displayChg = isUp ? `+${chgStr}` : chgStr;
    const priceStr = item.price ? `₺${item.price}` : '--';
    
    html += `
      <div class="market-row" onclick="window.showBorsaDetail('${item.symbol}')" style="cursor: pointer;">
        <div class="m-left">
          <div style="width:32px; height:32px; border-radius:50%; background:var(--bg-secondary); display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:800; margin-right:12px; color:var(--text-primary);">${item.symbol.substring(0, 2)}</div>
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

  // UI elements
  const listSection = document.getElementById('borsaSection');
  const detailSection = document.getElementById('borsaDetailSection');
  
  if (listSection) listSection.style.display = 'none';
  if (detailSection) detailSection.style.display = 'block';

  // Populate data
  document.getElementById('bdSymbol').innerText = item.symbol || '--';
  document.getElementById('bdPrice').innerText = item.price ? `₺${item.price}` : '--';
  
  const chgStr = item.change_percentage || '0';
  let chgVal = 0;
  let cleanChg = chgStr.replace('%', '').replace(',', '.').trim();
  if (cleanChg) chgVal = parseFloat(cleanChg);
  
  const bdChange = document.getElementById('bdChange');
  bdChange.innerText = chgVal > 0 ? `+${chgStr}` : chgStr;
  bdChange.className = 'pill ' + (chgVal > 0 ? 'up' : (chgVal < 0 ? 'down' : 'neutral'));
  
  document.getElementById('bdLow').innerText = item.low ? `₺${item.low}` : '--';
  document.getElementById('bdHigh').innerText = item.high ? `₺${item.high}` : '--';
  document.getElementById('bdAof').innerText = item.aof ? `₺${item.aof}` : '--';
  document.getElementById('bdTime').innerText = item.time || '--';
  document.getElementById('bdVolLot').innerText = item.volume_lot || '--';
  document.getElementById('bdVolTl').innerText = item.volume_tl ? `₺${item.volume_tl}` : '--';
  
  const mynetBtn = document.getElementById('bdMynetBtn');
  if (mynetBtn) {
    mynetBtn.onclick = () => window.open(item.detail_link, '_blank');
  }
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.closeBorsaDetail = function() {
  const listSection = document.getElementById('borsaSection');
  const detailSection = document.getElementById('borsaDetailSection');
  
  if (detailSection) detailSection.style.display = 'none';
  if (listSection) listSection.style.display = 'block';
};

window.fetchBorsaData = fetchBorsaData;
