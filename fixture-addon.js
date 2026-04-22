// ══════════════════════════════════════════════════════════════════════
// FİKSTÜR SİSTEMİ - MACKOLIK TARZI HAFTALIK GEÇİŞ
// ══════════════════════════════════════════════════════════════════════

let fixtureData = {
  allWeeks: [],
  currentWeekIndex: 0,
  totalWeeks: 34
};

// Sekmeler arası geçiş - fixture eklendi
window.switchLigMainTab = function(tab) {
  const tabs = ['standing', 'week', 'live', 'fixture'];
  tabs.forEach(t => {
    const btn = document.getElementById("btnLig" + t.charAt(0).toUpperCase() + t.slice(1));
    const sec = document.getElementById("lig" + t.charAt(0).toUpperCase() + t.slice(1) + "Section");
    if (btn) btn.classList.toggle("active", t === tab);
    if (sec) sec.style.display = (t === tab ? "block" : "none");
  });
  
  // Canlı Skor: otomatik yenileme yönetimi
  if (tab === 'live') {
    fetchLeagueLiveMatches();
    const info = document.getElementById('liveRefreshInfo');
    if (info) info.style.display = 'flex';
    if (!window._liveMatchInterval) {
      window._liveMatchInterval = setInterval(() => {
        fetchLeagueLiveMatches();
        const ts = new Date().toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'});
        const upd = document.getElementById('liveLastUpdate');
        if (upd) upd.textContent = `Son güncelleme: ${ts} (otomatik)`;
      }, 60000);
    }
  } else {
    if (window._liveMatchInterval) {
      clearInterval(window._liveMatchInterval);
      window._liveMatchInterval = null;
    }
    const info = document.getElementById('liveRefreshInfo');
    if (info) info.style.display = 'none';
  }
  
  if (tab === 'week') fetchWeeklyMatches();
  if (tab === 'fixture') loadFullFixture();
};

// Tam fikstürü yükle
async function loadFullFixture() {
  const list = document.getElementById("fixtureMatchList");
  if (!list) return;
  
  list.innerHTML = `<div style="text-align:center; padding:32px; color:var(--text-secondary);">
    <div style="font-size:28px; margin-bottom:12px; animation:pulse 1.5s infinite;">⚽</div>
    <div style="font-size:14px; font-weight:700;">Sezon fikstürü hazırlanıyor...</div>
  </div>`;

  try {
    // Tüm sezon verilerini çek (geçmiş + gelecek)
    const startDate = new Date('2024-08-01'); // Sezon başlangıcı
    const endDate = new Date('2025-06-30');   // Sezon bitişi
    
    const ds = startDate.toISOString().split('T')[0].replace(/-/g,'');
    const de = endDate.toISOString().split('T')[0].replace(/-/g,'');
    
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/scoreboard?dates=${ds}-${de}&limit=500`);
    if (!res.ok) throw new Error();
    
    const data = await res.json();
    const allEvents = data?.events || [];
    
    // Haftalara göre grupla
    const weekMap = {};
    allEvents.forEach(ev => {
      const weekNum = ev.week?.number || ev.season?.type?.week?.number || 0;
      if (weekNum > 0) {
        if (!weekMap[weekNum]) weekMap[weekNum] = [];
        weekMap[weekNum].push(ev);
      }
    });
    
    // Hafta listesini oluştur
    fixtureData.allWeeks = [];
    for (let w = 1; w <= fixtureData.totalWeeks; w++) {
      if (weekMap[w]) {
        const sorted = weekMap[w].sort((a,b) => new Date(a.date) - new Date(b.date));
        fixtureData.allWeeks.push({
          weekNumber: w,
          matches: sorted
        });
      } else {
        fixtureData.allWeeks.push({
          weekNumber: w,
          matches: []
        });
      }
    }
    
    // Şu anki haftayı bul
    const currentWeek = data?.week?.number || 1;
    fixtureData.currentWeekIndex = Math.max(0, Math.min(currentWeek - 1, fixtureData.allWeeks.length - 1));
    
    renderFixtureWeek();
    
  } catch (e) {
    list.innerHTML = `<div style="text-align:center; padding:32px; color:var(--down);">
      <div style="font-size:24px; margin-bottom:12px;">📡</div>
      <div style="font-size:13px; font-weight:700;">Fikstür verileri yüklenemedi</div>
      <button onclick="loadFullFixture()" style="margin-top:16px; background:var(--brand); color:#000; border:none; padding:8px 16px; border-radius:8px; font-weight:800; cursor:pointer;">Tekrar Dene</button>
    </div>`;
  }
}

// Hafta değiştir
window.changeFixtureWeek = function(direction) {
  const newIndex = fixtureData.currentWeekIndex + direction;
  if (newIndex >= 0 && newIndex < fixtureData.allWeeks.length) {
    fixtureData.currentWeekIndex = newIndex;
    renderFixtureWeek();
  }
};

// Haftayı render et
function renderFixtureWeek() {
  const weekData = fixtureData.allWeeks[fixtureData.currentWeekIndex];
  if (!weekData) return;
  
  const weekNum = weekData.weekNumber;
  const matches = weekData.matches;
  
  // Başlığı güncelle
  const titleEl = document.getElementById('fixtureWeekTitle');
  const dateEl = document.getElementById('fixtureWeekDate');
  if (titleEl) titleEl.textContent = `${weekNum}. Hafta`;
  
  // Tarih aralığını hesapla
  if (matches.length > 0) {
    const firstDate = new Date(matches[0].date);
    const lastDate = new Date(matches[matches.length - 1].date);
    const dateStr = firstDate.toLocaleDateString('tr-TR', {day:'2-digit', month:'long'}) + 
                   (firstDate.getMonth() !== lastDate.getMonth() ? 
                     ' - ' + lastDate.toLocaleDateString('tr-TR', {day:'2-digit', month:'long'}) : '');
    if (dateEl) dateEl.textContent = dateStr;
  } else {
    if (dateEl) dateEl.textContent = 'Maç programı henüz açıklanmadı';
  }
  
  // Butonları güncelle
  const prevBtn = document.getElementById('fixturePrevBtn');
  const nextBtn = document.getElementById('fixtureNextBtn');
  if (prevBtn) prevBtn.disabled = fixtureData.currentWeekIndex === 0;
  if (nextBtn) nextBtn.disabled = fixtureData.currentWeekIndex === fixtureData.allWeeks.length - 1;
  
  // Maçları render et
  const list = document.getElementById('fixtureMatchList');
  if (!list) return;
  
  if (matches.length === 0) {
    list.innerHTML = `<div style="text-align:center; padding:48px 16px; color:var(--text-secondary);">
      <div style="font-size:32px; margin-bottom:12px;">📅</div>
      <div style="font-size:14px; font-weight:700;">Bu hafta için maç programı bulunmuyor</div>
    </div>`;
    return;
  }
  
  list.innerHTML = renderFullMatchCards(matches);
}

// renderFullMatchCards fonksiyonu zaten app.js'de var, kullanacağız
