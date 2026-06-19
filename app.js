let state = {
  financeSnapshot: readStorage(STORAGE_KEYS.financeSnapshot, {}),
  debts: readStorage(STORAGE_KEYS.debts, { usd: 0, eur: 0, gold: 0, btc: 0, try: 0 }),

  yesterdayDebt: Number(localStorage.getItem(STORAGE_KEYS.yesterdayDebt)) || 0
};

// ═════════════════════════ CORS PROXY YARDIMCISI ═════════════════════════
// codetabs.com bazı domainleri engelliyor; bu yüzden birden fazla proxy
// ile fallback zinciri oluşturuyoruz. İlk başarılı olan kullanılır.
async function fetchWithProxy(targetUrl) {
  const encoded = encodeURIComponent(targetUrl);
  const proxies = [
    `/api/proxy?url=${encoded}`,
    `https://api.allorigins.win/raw?url=${encoded}`,
    `https://corsproxy.io/?${encoded}`,
  ];

  for (const proxyUrl of proxies) {
    try {
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 200) return text; // Boş/hata sayfası değilse döndür
      }
    } catch (_) {
      // Bu proxy başarısız, sıradakini dene
    }
  }
  console.warn('[fetchWithProxy] Tüm proxy\'ler başarısız:', targetUrl);
  return null;
}

// ═════════════════════════ BAŞLATICILAR ═════════════════════════
async function initializeSystem() {
  // Service Worker Kaydı (PWA için)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('SW Kayıt Başarılı:', reg.scope))
        .catch(err => console.log('SW Kayıt Hatası:', err));
    });
  }

  bindInputMasks();
  bindTabs();
  bindSidebar();

  document.getElementById("refreshFinanceBtn").addEventListener("click", refreshFinanceData);
  if (typeof FuelModule !== 'undefined') FuelModule.init();
  if (typeof DaysModule !== 'undefined') DaysModule.init();
  if (typeof SchoolModule !== 'undefined') SchoolModule.init();
  if (typeof AltinModule !== 'undefined') AltinModule.init();
  if (typeof TradeModule !== 'undefined') TradeModule.init();
  if (typeof SuperligModule !== 'undefined') SuperligModule.init();
  if (typeof FriendsChatModule !== 'undefined') FriendsChatModule.init();
  if (typeof AddressModule !== 'undefined') AddressModule.init();

  // Her gece yarısı sistemi otomatik yenile (Geri sayımlar ve günlük işler için)
  checkDailyRollover(false);
  scheduleMidnightRefresh();

  try {
    const { data: { user } } = await getSB().auth.getUser();
    if (user) {
      const { data, error } = await getSB()
        .from('finance_snapshots')
        .select('data')
        .eq('user_id', user.id)
        .maybeSingle(); // .single() yerine .maybeSingle()

      if (error) {
        console.warn('Piyasa verisi yüklenemedi, varsayılan kullanılıyor.');
      }
      state.financeSnapshot = data?.data || {}; // Boşsa boş nesne kullan
      if (data) {
        state.financeSnapshot = data.data;
      }
    }
  } catch (e) { console.warn('Piyasa verisi Supabase’den alınamadı:', e.message); }

  refreshFinanceData();


  // Yakıt fiyatlarını uygulama başında yükle
  setTimeout(() => { if (typeof fetchFuelPrices === 'function') fetchFuelPrices(); }, 1200);

  //fireAlarmBanner();


  const now = new Date();
  const hd = document.getElementById("homeDateOnly");
  const hdy = document.getElementById("homeDayOnly");
  if (hd) hd.textContent = now.toLocaleDateString("tr-TR", { day: '2-digit', month: '2-digit', year: 'numeric' });
  if (hdy) hdy.textContent = now.toLocaleDateString("tr-TR", { weekday: 'long' });

  // 🐙 GitHub'dan en son commit (push) bilgisini çek
  fetchLastCommit();

  // 🔄 Finans verilerini 30 saniyede bir otomatik yenile
  window.updateLastSeen = function() {
    if (window._supabaseClient) {
      window._supabaseClient.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          window._supabaseClient.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id).then();
        }
      });
    }
  };

  // Uygulama başlarken hemen son görülmeyi güncelle
  window.updateLastSeen();

  setInterval(() => {
    console.log("🔄 Finans verileri 30 saniyede bir yenileniyor...");
    refreshFinanceData();
    window.updateLastSeen();
  }, 30000);

  // 🛡️ Yasal uyarıyı ilk kez göster (LocalStorage kontrolü)
  const legalAccepted = localStorage.getItem('legalDisclaimerAccepted');
  if (!legalAccepted) {
    setTimeout(() => {
      const modal = document.getElementById('disclaimerModal');
      if (modal) modal.style.display = 'flex';
    }, 800);
  }
}

let midnightRefreshTimer = null;

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function refreshDailyModules() {
  if (typeof DaysModule !== 'undefined' && typeof DaysModule.refresh === 'function') {
    DaysModule.refresh();
  }
  if (typeof SchoolModule !== 'undefined' && typeof SchoolModule.refresh === 'function') {
    SchoolModule.refresh();
  }
}

function checkDailyRollover(forceReload = false) {
  const todayKey = getLocalDateKey();
  const lastKey = localStorage.getItem('financeApp.lastDailyRefreshDate');

  if (!lastKey) {
    localStorage.setItem('financeApp.lastDailyRefreshDate', todayKey);
    return false;
  }

  if (lastKey !== todayKey) {
    localStorage.setItem('financeApp.lastDailyRefreshDate', todayKey);
    console.log(`[Sistem] Gun degisti (${lastKey} -> ${todayKey}). Gunluk veriler yenileniyor...`);
    refreshDailyModules();

    if (forceReload) {
      window.location.reload();
    }
    return true;
  }

  if (forceReload) {
    refreshDailyModules();
  }

  return false;
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    checkDailyRollover(true);
    scheduleMidnightRefresh();
  }
});

window.addEventListener('focus', () => {
  checkDailyRollover(true);
  scheduleMidnightRefresh();
});

window.addEventListener('pageshow', () => {
  checkDailyRollover(true);
  scheduleMidnightRefresh();
});

async function fetchLastCommit() {
  const el = document.getElementById('lastCommitInfo');
  if (!el) return;
  
  // 1. Önce hafızadaki (cache) versiyonu göster
  const cachedVersion = localStorage.getItem('githubLastCommit');
  if (cachedVersion) {
    el.innerHTML = cachedVersion;
  }
  
  try {
    // 2. Arka planda GitHub API ile son durumu çek (motunsanyu/finans-hub reposu için)
    const response = await fetch('https://api.github.com/repos/motunsanyu/finans-hub/commits?per_page=1');
    if (!response.ok) throw new Error();
    const data = await response.json();
    if (data && data.length > 0) {
      let msg = data[0].commit.message;
      // Sadece ilk satırı al (eğer çok satırlıysa)
      msg = msg.split('\n')[0];
      // Eğer mesajda " - " varsa ve sonrası tarih/saat gibiyse temizle (kullanıcının manuel eklediği tarihleri silmek için)
      if (msg.includes(' - ')) {
          const parts = msg.split(' - ');
          // Eğer son parça tarih veya saat formatına benziyorsa (içinde / veya : varsa) kırp
          if (parts[parts.length-1].includes('/') || parts[parts.length-1].includes(':')) {
              msg = parts.slice(0, -1).join(' - ');
          }
      }
      // Karakter sınırla
      if (msg.length > 30) msg = msg.substring(0, 27) + '...';
      
      const d = new Date(data[0].commit.author.date);
      const dateStr = d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit' });
      const timeStr = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      
      const newHtml = `<div style="text-transform:uppercase; margin-bottom:2px;">${msg}</div><div style="font-size:9px; opacity:0.7;">${dateStr} - ${timeStr}</div>`;
      
      // 3. Ekranda güncelle ve hafızaya kaydet
      el.innerHTML = newHtml;
      localStorage.setItem('githubLastCommit', newHtml);
    }
  } catch (e) {
    // 4. Hata olursa ve hafızada da bir şey yoksa varsayılanı yazdır
    if (!cachedVersion) {
      el.textContent = 'VERSİYON: 1.1 PRO';
    }
  }
}

let appInitialized = false;
function startApp() {
  if (appInitialized) return;
  appInitialized = true;
  if (typeof initializeSystem === 'function') initializeSystem();
}

window.toggleSidebar = function (forceOpen) {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  if (!sidebar || !overlay) return;

  const shouldOpen = typeof forceOpen === 'boolean'
    ? forceOpen
    : sidebar.classList.contains('translate-x-full');

  sidebar.classList.toggle('translate-x-full', !shouldOpen);
  sidebar.classList.toggle('translate-x-0', shouldOpen);
  overlay.classList.toggle('hidden', !shouldOpen);
};

// ═════════════════════════ NUMARA MASKELEME ═════════════════════════
function bindInputMasks() {
  document.querySelectorAll('.num-mask').forEach(inp => {
    inp.addEventListener('input', (e) => {
      let text = e.target.value.replace(/[^0-9,]/g, "");
      if (!text) { e.target.value = ""; return; }
      let parts = text.split(',');
      let intPart = parts[0];
      if (intPart) { intPart = new Intl.NumberFormat('tr-TR').format(parseInt(intPart.replace(/\./g, ''))); }
      e.target.value = parts.length > 1 ? intPart + "," + parts[1].slice(0, 2) : intPart;
    });
  });
}
function parseVal(str) { return Number(String(str).replace(/\./g, "").replace(",", ".")); }

// ═════════════════════════ ALARM BANNER ═════════════════════════
/*function fireAlarmBanner() {
  let urgent = [];
  const todayMillis = new Date().setHours(0, 0, 0, 0);

  state.dayRecords.forEach(r => {
    const target = new Date(r.end).setHours(0, 0, 0, 0);
    const d = Math.round((target - todayMillis) / (1000 * 60 * 60 * 24));
    if (d === 0) urgent.push(`⏰ BUGÜN SON GÜN: ${r.title}`);
    else if (d > 0 && d <= 5) urgent.push(`⏰ ${r.title} hedefine sadece ${d} gün kaldı!`);
  });


  if (urgent.length > 0) {
    const b = document.createElement("div");
    b.style.position = "fixed"; b.style.top = "10px"; b.style.left = "10px"; b.style.right = "10px"; b.style.background = "linear-gradient(90deg, #b32a2a, #d32f2f)";
    b.style.color = "#fff"; b.style.padding = "16px"; b.style.zIndex = "9999"; b.style.borderRadius = "12px"; b.style.boxShadow = "0 4px 12px rgba(0,0,0,0.5)";
    b.style.fontSize = "13px"; b.style.fontWeight = "700"; b.style.transition = "top 0.5s ease-out"; b.style.cursor = "pointer";
    b.innerHTML = `<b style="font-size:15px">🚨 FINANS UYARISI</b><br><br>` + urgent.join("<br>");
    b.onclick = () => b.remove();
    document.body.appendChild(b);
    setTimeout(() => { b.style.top = "-200px"; setTimeout(() => b.remove(), 500); }, 6000);
  }
}*/

function bindTabs() {
  const buttons = document.querySelectorAll(".tab-btn"); const pages = document.querySelectorAll(".tab-page");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((x) => x.classList.toggle("active", x === btn));
      pages.forEach((page) => page.classList.toggle("active", page.id === btn.dataset.tab));
      if (typeof applyThemeScope === 'function') applyThemeScope();
    });
  });
}

// ═════════════════════════ INTRO ANIMATION ═════════════════════════
window.runIntroAnimation = function (callback) {
  const splashLayer = document.getElementById('splashLayer');
  const splashLogo = splashLayer.querySelector('.splash-logo-svg');
  const splashText = splashLayer.querySelector('.splash-text');
  const explosion = splashLayer.querySelector('.explosion-overlay');

  if (!splashLayer || !splashLogo || !splashText || !explosion) {
    if (callback) callback();
    return;
  }

  splashLayer.style.display = 'flex';
  splashLayer.style.opacity = '1';

  // Start sequence
  splashLogo.classList.add('anim-logo-entry');
  splashText.classList.add('anim-text-entry');

  // Zoom and Explode
  setTimeout(() => {
    splashLogo.classList.remove('anim-logo-entry');
    splashLogo.classList.add('anim-logo-explode');

    setTimeout(() => {
      explosion.classList.add('anim-explosion');
      if (callback) callback();

      setTimeout(() => {
        splashLayer.style.opacity = '0';
        setTimeout(() => {
          splashLayer.style.display = 'none';
          // Clean up
          splashLogo.classList.remove('anim-logo-explode');
          splashText.classList.remove('anim-text-entry');
          explosion.classList.remove('anim-explosion');
        }, 600);
      }, 300);
    }, 400); // Explosion point
  }, 2200); // View time
};

// ═════════════════════════ APP LOCK / PIN ═════════════════════════
/*
let enteredPin = ""; let pinStage = "login"; let tempSetupPin = "";
const SAVED_PIN = localStorage.getItem(STORAGE_KEYS.appPin);
const pinScreen = document.getElementById("pinScreen"); const appShell = document.getElementById("appShell"); const pinTitle = document.getElementById("pinTitle");
if (!SAVED_PIN) { pinTitle.textContent = "Uygulama İçin Yeni Şifre (PIN) Belirleyin"; pinStage = "setup1"; } else { pinTitle.textContent = "Şifrenizi (PIN) Girin"; }
function updatePinDots() { for (let i = 1; i <= 4; i++) { const dot = document.getElementById(`dot${i}`); if (i <= enteredPin.length) dot.classList.add("filled"); else dot.classList.remove("filled"); } }
window.pressPin = function (num) { if (enteredPin.length < 4) { enteredPin += num; updatePinDots(); } if (enteredPin.length === 4) setTimeout(processPin, 150); };
window.deletePin = function () { if (enteredPin.length > 0) { enteredPin = enteredPin.slice(0, -1); updatePinDots(); } };
function processPin() {
  if (pinStage === "setup1") { tempSetupPin = enteredPin; enteredPin = ""; updatePinDots(); pinStage = "setup2"; pinTitle.textContent = "Onaylamak İçin Aynı PIN'i Tekrar Girin"; }
  else if (pinStage === "setup2") { if (enteredPin === tempSetupPin) { localStorage.setItem(STORAGE_KEYS.appPin, enteredPin); alert("Güvenlik Şifresi Kaydedildi!"); unlockApp(); } else { alert("Şifreler Eşleşmedi. Baştan Alınıyor."); enteredPin = ""; tempSetupPin = ""; updatePinDots(); pinStage = "setup1"; pinTitle.textContent = "Uygulama İçin Yeni Şifre (PIN) Belirleyin"; } }
  else if (pinStage === "login") { if (enteredPin === SAVED_PIN) unlockApp(); else { alert("Hatalı Şifre!"); enteredPin = ""; updatePinDots(); } }
}
function unlockApp() {
  const pinContent = document.getElementById("pinContent");
  const splashLayer = document.getElementById("splashLayer");
  const splashLogo = splashLayer.querySelector(".splash-logo");
  const keypad = document.querySelector(".keypad");

  // 1. PIN UI'yı temizle
  if (pinContent) pinContent.style.opacity = "0";
  if (keypad) keypad.style.opacity = "0";

  // 2. Splash Ekranını Başlat
  setTimeout(() => {
    splashLayer.style.display = "flex";
    splashLogo.classList.add("anim-logo-in");

    // Arka planda uygulamayı hazırla (Kullanıcı animasyonu izlerken biz yükleyelim)
    appShell.style.opacity = "0";
    appShell.style.display = "block";
    init();

    // 3. Final: Ana Sayfaya Geçiş
    setTimeout(() => {
      pinScreen.classList.add("fade-out");
      appShell.style.transition = "opacity 0.8s ease";
      appShell.style.opacity = "1";

      setTimeout(() => {
        pinScreen.style.display = "none";
      }, 500);
    }, 1200); // Animasyon süresi (1.2sn)
  }, 300);
}

// ═════════════════════════ SIDEBAR VE TOPLAM BORÇ ═════════════════════════
*/
function bindSidebar() {
  const positionsPanel = document.getElementById("positionsPanel");
  const positionsOverlay = document.getElementById("positionsOverlay");
  const menuBtn = document.getElementById("menuBtn");
  const closePositionsBtn = document.getElementById("closePositionsBtn");
  const saveDebtsBtn = document.getElementById("saveDebtsBtn");

  const debtUSD = document.getElementById("debtUSD");
  const debtEUR = document.getElementById("debtEUR");
  const debtGold = document.getElementById("debtGold");
  const debtBTC = document.getElementById("debtBTC");
  const debtTRY = document.getElementById("debtTRY");

  if (debtUSD) debtUSD.value = state.debts.usd || 0;
  if (debtEUR) debtEUR.value = state.debts.eur || 0;
  if (debtGold) debtGold.value = state.debts.gold || 0;
  if (debtBTC) debtBTC.value = state.debts.btc || 0;
  if (debtTRY) debtTRY.value = state.debts.try || 0;

  if (menuBtn) menuBtn.onclick = () => toggleSidebar();

  window.openPositions = function () {
    if (typeof toggleSidebar === 'function') toggleSidebar(false);
    if (positionsPanel) positionsPanel.classList.add("open");
    if (positionsOverlay) positionsOverlay.classList.add("open");
  };

  window.openProfile = function () {
    alert("Profil ekranı yakında eklenecek.");
  };

  const closePositions = () => {
    if (positionsPanel) positionsPanel.classList.remove("open");
    if (positionsOverlay) positionsOverlay.classList.remove("open");
  };

  if (closePositionsBtn) closePositionsBtn.onclick = closePositions;
  if (positionsOverlay) positionsOverlay.onclick = closePositions;

  if (saveDebtsBtn) saveDebtsBtn.onclick = () => {
    state.debts = {
      usd: Number(debtUSD?.value || 0),
      eur: Number(debtEUR?.value || 0),
      gold: Number(debtGold?.value || 0),
      btc: Number(debtBTC?.value || 0),
      try: Number(debtTRY?.value || 0)
    };
    writeStorage(STORAGE_KEYS.debts, state.debts);
    calcTotalDebt();
    closePositions();
  };
}

function calcTotalDebt() {
  const snap = state.financeSnapshot; if (!snap) return;
  const u = snap.usdTry?.price || 0; const e = snap.eurTry?.price || 0; const g = snap.goldTry?.price || 0; const b = (snap.btcUsd?.price || 0) * u;
  const d = state.debts; const totalTRY = (d.usd * u) + (d.eur * e) + (d.gold * g) + (d.btc * b) + d.try; const totalUSD = u > 0 ? (totalTRY / u) : 0;

  const display = document.getElementById("totalDebtDisplay");
  const displayUsd = document.getElementById("totalDebtUsdDisplay");
  if (display) display.textContent = formatCurrency(totalTRY);
  if (displayUsd) displayUsd.textContent = formatCurrency(totalUSD).replace("₺", "$");

  // Trend Kontrolü
  const trendBox = document.getElementById("debtTrend");
  const trendArrow = document.getElementById("trendArrow");
  const trendValue = document.getElementById("trendValue");

  if (trendBox && state.yesterdayDebt > 0) {
    const diff = totalTRY - state.yesterdayDebt;
    const isUp = diff > 0.1;
    const isDown = diff < -0.1;

    if (isUp || isDown) {
      trendBox.style.display = "flex";
      trendBox.style.color = isUp ? "var(--down)" : "var(--up)";
      trendArrow.textContent = isUp ? "▲" : "▼";
      trendValue.textContent = formatCurrency(Math.abs(diff)).replace("₺", "");
    } else {
      trendBox.style.display = "none";
    }
  }

  // Günlük Güncelleme Kontrolü (Günde 1 kez dünkü borcu kaydet)
  const today = new Date().toLocaleDateString("tr-TR");
  const lastUpdate = localStorage.getItem(STORAGE_KEYS.lastDailyUpdate);
  if (lastUpdate !== today && totalTRY > 0) {
    localStorage.setItem(STORAGE_KEYS.yesterdayDebt, totalTRY);
    localStorage.setItem(STORAGE_KEYS.lastDailyUpdate, today);
    state.yesterdayDebt = totalTRY;
  }

   const vgd = document.getElementById("vgd");
   if (vgd) { vgd.textContent = formatCurrency(totalTRY); vgd.style.color = totalTRY < 0 ? "var(--down)" : totalTRY > 0 ? "var(--up)" : "var(--text-primary)"; }
}

// ═════════════════════════ PİYASALAR API ═════════════════════════
async function refreshFinanceData() {
  console.log("Finans verileri Supabase'den cekiliyor...");
  const meta = document.getElementById("financeMeta");
  let nextSnapshot = { ...state.financeSnapshot, updatedAt: Date.now() };

  try {
    // Supabase market_snapshots tablosundan en güncel veriyi çekiyoruz
    const { data, error } = await getSB()
      .from('market_snapshots')
      .select('*')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      throw error;
    }

    if (data) {
      // Supabase verisini state.financeSnapshot yapısına dönüştür
      nextSnapshot.usdTry = { price: data.usd_try, change: parseFloat((data.usd_try_change || '0').replace('%', '').replace(',', '.')) || 0 };
      nextSnapshot.eurTry = { price: data.eur_try, change: parseFloat((data.eur_try_change || '0').replace('%', '').replace(',', '.')) || 0 };
      nextSnapshot.goldTry = { price: data.gram_gold_try, change: parseFloat((data.gram_gold_change || '0').replace('%', '').replace(',', '.')) || 0 };
      if (data.silver_try) {
        nextSnapshot.silverTry = { price: data.silver_try, change: parseFloat((data.silver_try_change || '0').replace('%', '').replace(',', '.')) || 0 };
      }
      nextSnapshot.bist = { price: data.bist100, change: parseFloat((data.bist100_change || '0').replace('%', '').replace(',', '.')) || 0 };
      nextSnapshot.brent = { price: data.brent, change: parseFloat((data.brent_change || '0').replace('%', '').replace(',', '.')) || 0 };
      
      // fetched_at verisini güncelleme zamanı olarak ayarla
      if (data.fetched_at) {
        nextSnapshot.updatedAt = new Date(data.fetched_at).getTime();
      }
    }
  } catch (e) { 
    console.warn("Supabase'den piyasa verileri çekilemedi:", e); 
  }

  state.financeSnapshot = nextSnapshot;

  try {
    const { data: { user } } = await getSB().auth.getUser();
    if (user) {
      await getSB().from('finance_snapshots').upsert({
        user_id: user.id,
        data: nextSnapshot,
        updated_at: new Date().toISOString()
      });
    }
  } catch (e) { console.warn('Piyasa verisi yedeklenemedi:', e.message); }

  writeStorage(STORAGE_KEYS.financeSnapshot, nextSnapshot);

  // UI Güncelleme (Supabase tablosundaki ana veriler)
  paintFinanceRow("usdTry", nextSnapshot.usdTry, 4);
  paintFinanceRow("eurTry", nextSnapshot.eurTry, 4);
  paintFinanceRow("goldTry", nextSnapshot.goldTry, 2);
  paintFinanceRow("silverTry", nextSnapshot.silverTry, 2);

  // Brent ve BIST
  updateExtraRow("brent", nextSnapshot.brent, "$");
  updateExtraRow("bist", nextSnapshot.bist, "");

  calcTotalDebt();
  const dateObj = new Date(nextSnapshot.updatedAt);
  const dateStr = dateObj.toLocaleDateString("tr-TR"); 
  const timeStr = dateObj.toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' }); 
  if (meta) meta.innerHTML = `Son Güncelleme : ${dateStr} - ${timeStr}`;
  console.log("Finans verileri guncellendi.");
}

function updateExtraRow(id, obj, prefix) {
  if (!obj) return;
  const pEl = document.getElementById(id + 'Price');
  const cEl = document.getElementById(id + 'Chg');
  if (pEl) pEl.textContent = prefix + formatNumber(obj.price, 2);
  if (cEl) {
    cEl.textContent = (obj.change > 0 ? "+" : "") + obj.change.toFixed(2) + "%";
    cEl.className = `pill ${obj.change > 0 ? "up" : obj.change < 0 ? "down" : "neutral"}`;
  }
}
function parseFlexibleNumber(input) { if (!input) return Number.NaN; const raw = String(input).trim().replace(/\s/g, "").replace("%", ""); if (!raw) return Number.NaN; if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(raw)) return Number(raw.replace(/\./g, "").replace(",", ".")); return Number(raw.replace(",", ".").replace(/[^0-9.-]/g, "")); }
function paintFinanceRow(id, obj, decimals, prefix = "") {
  if (!obj) return; const priceEl = document.getElementById(id); const chgEl = document.getElementById(id + "Chg");
  if (priceEl) priceEl.textContent = prefix + formatNumber(obj.price, decimals);
  if (chgEl && typeof obj.change === "number") { const c = obj.change; let sign = c > 0 ? "+" : c < 0 ? "" : ""; chgEl.textContent = `${sign}%${Math.abs(c).toFixed(2)}`; chgEl.className = `pill ${c > 0 ? "up" : c < 0 ? "down" : "neutral"}`; }
}



// ══════════════════════════════════════════
// YARDIMCI GÖRSEL FONKSİYONLAR
// ══════════════════════════════════════════
window.toggleMatchDetail = function (id) {
  const el = document.getElementById(id);
  if (!el) return;
  const isNone = el.style.display === 'none';
  el.style.display = isNone ? 'block' : 'none';
  if (isNone) {
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  if (typeof checkAuthState === 'function') checkAuthState();
});

// ══════════════════════════════════════════
// COİNLERFİYATLARI (Binance API)


// ══════════════════════════════════════════
// YAKIT FİYATLARI (Supabase fuel_prices tablosu)
// ══════════════════════════════════════════
// Global: son çekilen yakıt fiyatları (formdan çağırmak için)
window._lastFuelPrices = { benzin: null, motorin: null, lpg: null, timestamp: null };

window.fetchFuelPrices = async function () {
  const cards = document.getElementById('fuelPriceCards');
  const meta = document.getElementById('fuelPriceMeta');
  if (!cards) return;

  // Yükleniyor animasyonu
  cards.innerHTML = `
      <div class="fuel-price-card benzin"><div class="fpc-icon">⛽</div><div class="fpc-label">Benzin 95</div><div class="fpc-price anim-pulse">●●</div></div>
      <div class="fuel-price-card motorin"><div class="fpc-icon">🚛</div><div class="fpc-label">Motorin</div><div class="fpc-price anim-pulse">●●</div></div>
      <div class="fuel-price-card lpg"><div class="fpc-icon">💨</div><div class="fpc-label">LPG</div><div class="fpc-price anim-pulse">●●</div></div>`;

  try {
    const sb = window._supabaseClient;
    if (!sb) throw new Error('Supabase client yok');

    // fuel_prices tablosundan en son kaydı çek (.single() 406 verebileceğinden dizi alıyoruz)
    const { data: rows, error } = await sb
      .from('fuel_prices')
      .select('fetched_at, prices')
      .order('fetched_at', { ascending: false })
      .limit(1);

    if (error) throw new Error('Supabase hatası: ' + error.message);
    const data = rows && rows.length > 0 ? rows[0] : null;

    if (!data || !data.prices) {
      throw new Error('Yakıt verisi bulunamadı');
    }

    // prices artık { "konya-selcuklu": [...], "ankara-cankaya": [...] } şeklinde dict
    const cityEl3 = document.getElementById('fuelCitySelect');
    const cityKey = cityEl3 ? cityEl3.value : 'konya-selcuklu';
    const cityPrices = (data.prices[cityKey] || data.prices[Object.keys(data.prices)[0]] || []);

    if (!cityPrices || cityPrices.length === 0) {
      throw new Error('Seçili şehir için veri bulunamadı');
    }

    const firmEl = document.getElementById('fuelFirmSelect');
    const firmKey = firmEl ? firmEl.value.toLowerCase() : '';

    // Seçili markayı bul (yoksa benzin fiyatı olan ilk markayı al)
    let selectedBrand = cityPrices.find(p => p.marka && p.marka.toLowerCase() === firmKey)
      || cityPrices.find(p => p.benzin !== null)
      || cityPrices[0];

    const benzin  = selectedBrand?.benzin  ?? null;
    const motorin = selectedBrand?.motorin ?? null;
    const lpg     = selectedBrand?.lpg     ?? null;

    const fmt = (v) => v !== null && v !== undefined ? Number(v).toFixed(2).replace('.', ',') + ' ₺' : '--';

    // Global cache'e kaydet (form otomatik dolumu için)
    window._lastFuelPrices = { benzin, motorin, lpg, timestamp: Date.now() };

    // Eğer formda yakıt tipi seçiliyse otomatik doldur
    const fuelType   = document.getElementById('fuelTypeSelect')?.value;
    const priceInput = document.getElementById('fuelPrice');
    if (fuelType && priceInput) {
      const priceMap = { benzin, motorin, lpg };
      if (priceMap[fuelType] !== null) {
        priceInput.value = Number(priceMap[fuelType]).toFixed(2);
        const hint = document.getElementById('fuelPriceHint');
        if (hint) hint.textContent = `✅ ${fuelType === 'benzin' ? 'Benzin 95' : fuelType === 'motorin' ? 'Motorin' : 'LPG'} fiyatı otomatik dolduruldu (${selectedBrand?.marka || 'doviz.com'})`;
      }
    }

    cards.innerHTML = `
          <div class="fuel-price-card benzin"><div class="fpc-icon">⛽</div><div class="fpc-label">Benzin 95</div><div class="fpc-price">${fmt(benzin)}</div></div>
          <div class="fuel-price-card motorin"><div class="fpc-icon">🚛</div><div class="fpc-label">Motorin</div><div class="fpc-price">${fmt(motorin)}</div></div>
          <div class="fuel-price-card lpg"><div class="fpc-icon">💨</div><div class="fpc-label">LPG</div><div class="fpc-price">${fmt(lpg)}</div></div>`;

    const updatedAt = data.fetched_at
      ? new Date(data.fetched_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      : '';
    const cityEl2 = document.getElementById('fuelCitySelect');
    const cityLabel = cityEl2 ? cityEl2.options[cityEl2.selectedIndex]?.text : '';
    if (meta) meta.textContent = `${selectedBrand?.marka || 'Piyasa'} • ${cityLabel} • doviz.com • ${updatedAt}`;

  } catch (error) {
    console.error('Yakıt:', error);
    cards.innerHTML = `<div style="grid-column:span 3;text-align:center;padding:16px;color:var(--text-secondary);font-size:12px;">Yükleme Başarısız. <button onclick="fetchFuelPrices()" style="color:var(--brand);background:none;border:none;font-weight:800;cursor:pointer;">Tekrar Dene</button></div>`;
  }
};

// "Güncel Fiyatı Çek" butonu - formdaki yakıt tipine göre fiyatı doldurur
window.fillFuelPriceFromWidget = function () {
  const fuelType = document.getElementById('fuelTypeSelect')?.value || 'benzin';
  const prices = window._lastFuelPrices || {};
  const priceMap = { benzin: prices.benzin, motorin: prices.motorin, lpg: prices.lpg };
  const price = priceMap[fuelType];
  const priceInput = document.getElementById('fuelPrice');
  const hint = document.getElementById('fuelPriceHint');

  if (price && priceInput) {
    priceInput.value = price.toFixed(2);
    if (hint) hint.textContent = `✅ ${fuelType === 'benzin' ? 'Benzin 95' : fuelType === 'motorin' ? 'Motorin' : 'LPG'} fiyatı dolduruldu`;
  } else {
    // Fiyatlar henüz çekilmemişse otomatik çek
    if (hint) hint.textContent = '⏳ Fiyatlar çekiliyor, lütfen bekleyin...';
    fetchFuelPrices().then(() => {
      // fetchFuelPrices içinde otomatik dolum zaten yapılıyor
    });
  }
};

// 🚀 TÜM ALT MENÜ BUTONLARINA (Kasa, Yakıt, Taksit, Zaman, Lig, Piyasa) SCROLL-TO-TOP
function bindScrollToTopToAllTabButtons() {
  // Sadece henüz bu özellik eklenmemiş (.tab-btn) butonlarını seç
  const buttons = document.querySelectorAll('.tab-btn:not([data-scroll-added])');

  buttons.forEach(btn => {
    btn.setAttribute('data-scroll-added', 'true');

    btn.addEventListener('click', () => {
      // Sekme değişiminin (DOM güncellemesinin) tamamlanması için kısa bir süre bekle
      setTimeout(() => {
        const scrollOpts = { top: 0, behavior: 'smooth' };

        // 1. Standart Kaydırma Alanları
        window.scrollTo(scrollOpts);
        document.documentElement.scrollTo(scrollOpts);
        document.body.scrollTo(scrollOpts);

        // 2. Aktif Sekme İçeriği (Eğer sayfa içi kaydırma varsa)
        const activePage = document.querySelector('.tab-page.active');
        if (activePage) {
          activePage.scrollTo(scrollOpts);
        }

        console.log(`📜 Sayfa Başına Kaydırıldı: ${btn.textContent.trim()}`);
      }, 50);
    });
  });
}

// İlk yüklemede çalıştır
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindScrollToTopToAllTabButtons);
} else {
  bindScrollToTopToAllTabButtons();
}

// Dinamik olarak eklenen veya yenilenen butonları izle
const globalScrollObserver = new MutationObserver(() => {
  bindScrollToTopToAllTabButtons();
});
globalScrollObserver.observe(document.body, { childList: true, subtree: true });

// ═════════════════════════ YASAL UYARI FONKSİYONLARI ═════════════════════════
// İlk kabulde çağrılır: localStorage'a kaydeder ve kapatır
window.acceptDisclaimer = function () {
  localStorage.setItem('legalDisclaimerAccepted', 'true');
  const modal = document.getElementById('disclaimerModal');
  if (modal) modal.style.display = 'none';
  if (window.showToast) window.showToast('Yasal şartları kabul ettiniz.', 'success');
};

// Menüden manuel açma/kapatma (kayıt yapmaz)
window.toggleDisclaimerModal = function () {
  const modal = document.getElementById('disclaimerModal');
  if (!modal) return;
  const isVisible = modal.style.display === 'flex';
  modal.style.display = isVisible ? 'none' : 'flex';
  // Eğer açılıyorsa ve sidebar açıksa sidebar'ı kapat (daha temiz görünüm)
  if (!isVisible && typeof window.toggleSidebar === 'function') window.toggleSidebar(false);
};


// ========== TOAST BİLDİRİM STİLİ (FLU KOYU YEŞİL ZEMİN, BEYAZ YAZI) ==========
window.showToast = function(msg, type = 'default') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast-msg';
  toast.textContent = msg;

  // Tip bazlı renk
  const bgMap = {
    'error':   'rgba(180,30,30,0.92)',
    'success': 'rgba(15,100,50,0.92)',
    'default': 'rgba(0,60,30,0.92)'
  };
  toast.style.background = bgMap[type] || bgMap['default'];
  toast.style.backdropFilter = 'blur(16px)';
  toast.style.webkitBackdropFilter = 'blur(16px)';
  toast.style.color = '#fff';
  toast.style.borderRadius = '30px';
  toast.style.padding = '12px 24px';
  toast.style.fontWeight = '700';
  toast.style.fontSize = '14px';
  toast.style.boxShadow = '0 8px 32px rgba(0,0,0,0.35)';
  toast.style.border = '1px solid rgba(255,255,255,0.12)';
  toast.style.marginBottom = '10px';
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(-16px) scale(0.95)';
  toast.style.transition = 'opacity 0.28s ease, transform 0.28s cubic-bezier(0.175,0.885,0.32,1.275)';
  // Tıklayınca hemen kapat
  toast.onclick = () => dismissToast(toast);
  toast.style.cursor = 'pointer';

  container.appendChild(toast);

  // Giriş animasyonu (bir sonraki frame)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0) scale(1)';
    });
  });

  // 5 saniye sonra otomatik kapat
  const timer = setTimeout(() => dismissToast(toast), 5000);
  toast._dismissTimer = timer;

  function dismissToast(el) {
    clearTimeout(el._dismissTimer);
    el.style.opacity = '0';
    el.style.transform = 'translateY(-16px) scale(0.95)';
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
  }
};

// ========== PROFİL FOTOĞRAFI YÜKLEME, KULLANICI ADI GÜNCELLEME, HESAP SİLME ==========
window.uploadProfilePicture = async function(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    window.showToast('Lütfen geçerli bir resim dosyası seçin.', 'error');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    window.showToast('Dosya boyutu 2MB\'ı geçemez.', 'error');
    return;
  }
  try {
    const { data: { user } } = await getSB().auth.getUser();
    if (!user) throw new Error('Oturum açık değil');
    
    window.showToast('Fotoğraf yükleniyor...', 'default');
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    const { error: uploadError } = await getSB().storage.from('avatars').upload(fileName, file);
    if (uploadError) throw uploadError;
    
    const { data: urlData } = getSB().storage.from('avatars').getPublicUrl(fileName);
    const avatarUrl = urlData.publicUrl;
    
    const { error: updateError } = await getSB().from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id);
    if (updateError) throw updateError;
    
    // UI güncelleme
    const avatarBig = document.getElementById('profileAvatarBig');
    const avatarSide = document.getElementById('sidebarAvatar');
    const avatarImage = document.getElementById('avatarImage');
    const defaultAvatar = document.getElementById('defaultAvatar');
    
    if (avatarBig) avatarBig.innerHTML = `<img src="${avatarUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
    if (avatarSide && avatarImage) {
      avatarImage.src = avatarUrl;
      avatarImage.style.display = 'block';
      if (defaultAvatar) defaultAvatar.style.display = 'none';
    }
    window.showToast('Profil fotoğrafı güncellendi!', 'success');
  } catch (error) {
    console.error('Avatar yükleme hatası:', error);
    window.showToast('Fotoğraf yüklenirken hata oluştu.', 'error');
  }
};

window.updateUsernameFromProfile = async function() {
  const input = document.getElementById('newUsernameInput');
  const newUsername = input?.value?.trim();
  if (!newUsername) {
    window.showToast('Lütfen bir kullanıcı adı girin.', 'error');
    return;
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(newUsername)) {
    window.showToast('Kullanıcı adı 3-20 karakter olmalı ve sadece harf, rakam, alt çizgi içerebilir.', 'error');
    return;
  }
  try {
    const { data: { user } } = await getSB().auth.getUser();
    if (!user) throw new Error('Oturum açık değil');
    
    const { data: existing } = await getSB().from('profiles').select('id').eq('username', newUsername).neq('id', user.id).maybeSingle();
    if (existing) {
      window.showToast('Bu kullanıcı adı zaten kullanılıyor.', 'error');
      return;
    }
    
    const { error } = await getSB().from('profiles').update({ username: newUsername }).eq('id', user.id);
    if (error) throw error;
    
    const profileName = document.getElementById('profileNameDisplay');
    const sidebarName = document.getElementById('sidebarProfileName');
    if (profileName) profileName.textContent = newUsername;
    if (sidebarName) sidebarName.textContent = newUsername;
    
    window.showToast('Kullanıcı adı güncellendi!', 'success');
    input.value = '';
  } catch (error) {
    console.error('Kullanıcı adı güncelleme hatası:', error);
    window.showToast('Güncelleme başarısız.', 'error');
  }
};

window.confirmDeleteAccount = function() {
  if (typeof window.showCustomConfirm === 'function') {
    window.showCustomConfirm('Hesabınızı kalıcı olarak silmek üzeresiniz. Bu işlem geri alınamaz. Devam etmek istediğinize emin misiniz?', async () => {
      try {
        const { data: { user } } = await getSB().auth.getUser();
        if (!user) throw new Error('Oturum açık değil');
        
        window.showToast('Hesabınız siliniyor...', 'default');
        
        await getSB().from('profiles').delete().eq('id', user.id);
        await getSB().from('friendships').delete().or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
        await getSB().from('messages').delete().or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
        await getSB().from('finance_snapshots').delete().eq('user_id', user.id);
        
        // Auth silme işlemi genellikle admin yetkisi gerektirir, 
        // Client-side'da auth.admin mevcut olmayabilir. 
        // Eğer mevcut değilse sadece çıkış yapıp verileri silmek bir yöntemdir.
        const { error } = await getSB().auth.signOut();
        if (error) throw error;
        
        localStorage.clear();
        window.location.reload();
      } catch (error) {
        console.error('Hesap silme hatası:', error);
        window.showToast('Hata oluştu. Lütfen tekrar deneyin.', 'error');
      }
    });
  } else {
    if (confirm('Hesabınızı silmek istediğinize emin misiniz?')) {
      // Benzer silme mantığı...
    }
  }
};
// === PİYASA / COİN / İŞLEM / PORTFÖY ALT SEKMELERİ ===
let coinRefreshInterval = null;

window.switchMarketTab = function (tab) {
  const sections = {
    'market': { id: 'piyasaSection', btn: 'btnMarketPiyasa' },
    'coins': { id: 'coinlerSection', btn: 'btnMarketCoinler' },
    'borsa': { id: 'borsaSection', btn: 'btnMarketBorsa' },
    'news': { id: 'newsSection', btn: 'btnMarketNews' }
  };

  // Tüm butonları ve seksiyonları temizle
  Object.values(sections).forEach(s => {
    const secEl = document.getElementById(s.id);
    const btnEl = document.getElementById(s.btn);
    if (secEl) secEl.style.display = 'none';
    if (btnEl) btnEl.classList.remove('active');
  });

  // borsaDetailSection açıksa onu da gizle
  const borsaDetailSec = document.getElementById('borsaDetailSection');
  if (borsaDetailSec) borsaDetailSec.style.display = 'none';

  // Seçili olanı göster
  const target = sections[tab];
  if (target) {
    const secEl = document.getElementById(target.id);
    const btnEl = document.getElementById(target.btn);
    if (secEl) secEl.style.display = 'block';
    if (btnEl) btnEl.classList.add('active');

    // Modül bazlı özel tetiklemeler
    if (tab === 'coins') {
      if (typeof fetchCoinPrices === 'function') fetchCoinPrices();
      if (coinRefreshInterval) clearInterval(coinRefreshInterval);
      coinRefreshInterval = setInterval(fetchCoinPrices, 5000);
    } else {
      if (coinRefreshInterval) { clearInterval(coinRefreshInterval); coinRefreshInterval = null; }
    }

    // 'trade' and 'portfolio' tabs removed; no-op for those modules here
    if (tab === 'news' && typeof NewsModule !== 'undefined') NewsModule.fetchNews();
    if (tab === 'borsa' && typeof fetchBorsaData === 'function') fetchBorsaData();
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

// ═════════════════════════ GECE YARISI OTOMATİK YENİLEME ═════════════════════════
function legacyScheduleMidnightRefreshOld() {
  const now = new Date();
  const nextMidnight = new Date();
  
  // Gece 00:00'ı (bir sonraki günü) ayarla
  nextMidnight.setHours(24, 0, 0, 0);
  
  // Gece yarısına kalan süre (artı işi sağlama almak için 1 saniye)
  const timeUntilMidnight = nextMidnight.getTime() - now.getTime() + 1000;
  
  console.log(`[Sistem] Uygulama ${Math.floor(timeUntilMidnight/1000/60)} dakika sonra gece yarısı otomatik yenilenecek.`);
  
  setTimeout(() => {
    console.log("[Sistem] Gece yarısı oldu! Günlük verilerin güncellenmesi için sayfa yenileniyor...");
    window.location.reload();
  }, timeUntilMidnight);
}

function scheduleMidnightRefresh() {
  if (midnightRefreshTimer) clearTimeout(midnightRefreshTimer);

  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setHours(24, 0, 1, 0);
  const delay = Math.max(1000, nextRun.getTime() - now.getTime());

  console.log(`[Sistem] Gunluk yenileme ${Math.ceil(delay / 60000)} dakika sonra kontrol edilecek.`);

  midnightRefreshTimer = setTimeout(() => {
    checkDailyRollover(true);
    scheduleMidnightRefresh();
  }, delay);
}

// ==========================================
// NOTLAR (NOTES) UYGULAMASI LOGIC
// ==========================================

let notesData = [];
let autoSaveTimeout = null;

async function loadNotes() {
  if (!window._supabaseClient) return;
  try {
    const { data: { user } } = await window._supabaseClient.auth.getUser();
    if (!user) return;
    
    const { data, error } = await window._supabaseClient
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
      
    if (error) throw error;
    notesData = data || [];
    renderNotesList(notesData);
  } catch (err) {
    console.error("Notlar yüklenirken hata:", err.message);
  }
}

function renderNotesList(notes) {
  const container = document.getElementById('notesListContainer');
  const emptyState = document.getElementById('notesEmptyState');
  
  // Clear list except empty state
  Array.from(container.children).forEach(child => {
    if (child.id !== 'notesEmptyState') child.remove();
  });
  
  if (!notes || notes.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  
  emptyState.style.display = 'none';
  
  notes.forEach(note => {
    const dateObj = new Date(note.updated_at);
    const dateStr = dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    
    const previewText = note.content ? note.content.substring(0, 40).replace(/\n/g, ' ') + '...' : 'Ek metin yok';
    const displayTitle = note.title || 'Yeni Not';
    
    const el = document.createElement('div');
    el.className = 'note-item';
    el.onclick = () => openNoteEditor(note.id);
    el.innerHTML = `
      <div class="note-item-title">${displayTitle}</div>
      <div class="note-item-meta">
        <span class="note-item-date">${dateStr}</span>
        <span class="note-item-preview">${previewText}</span>
      </div>
    `;
    container.appendChild(el);
  });
}

function filterNotes() {
  const q = document.getElementById('notesSearchInput').value.toLowerCase();
  const filtered = notesData.filter(n => 
    (n.title && n.title.toLowerCase().includes(q)) || 
    (n.content && n.content.toLowerCase().includes(q))
  );
  renderNotesList(filtered);
}

function getNoteDisplayDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) + ', ' + 
         d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

async function openNewNote() {
  if (!window._supabaseClient) return;
  const { data: { user } } = await window._supabaseClient.auth.getUser();
  if (!user) return;
  
  const newNote = {
    id: crypto.randomUUID(),
    user_id: user.id,
    title: '',
    content: '',
    updated_at: new Date().toISOString()
  };
  
  // Prepend to UI list immediately
  notesData.unshift(newNote);
  
  // Create in DB
  try {
    await window._supabaseClient.from('notes').insert([newNote]);
  } catch(e) { console.error("Not oluşturma hatası:", e); }
  
  openNoteEditor(newNote.id);
}

function openNoteEditor(noteId) {
  const note = notesData.find(n => n.id === noteId);
  if(!note) return;
  
  document.getElementById('currentNoteId').value = note.id;
  document.getElementById('notesEditorLastUpdated').textContent = getNoteDisplayDate(note.updated_at);
  
  const textarea = document.getElementById('notesEditorTextarea');
  const fullText = (note.title ? note.title + '\n' : '') + (note.content || '');
  textarea.value = fullText.trim();
  
  document.getElementById('notesListView').style.display = 'none';
  document.getElementById('notesEditorView').style.display = 'flex';
  
  setTimeout(() => textarea.focus(), 100);
}

function closeNoteEditor() {
  saveCurrentNoteNow();
  document.getElementById('notesEditorView').style.display = 'none';
  document.getElementById('notesListView').style.display = 'flex';
  renderNotesList(notesData);
}

function autoSaveNote() {
  if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => {
    saveCurrentNoteNow();
  }, 1000);
}

async function saveCurrentNoteNow() {
  const noteId = document.getElementById('currentNoteId').value;
  if (!noteId) return;
  
  const rawText = document.getElementById('notesEditorTextarea').value;
  const lines = rawText.split('\n');
  const title = lines[0] || '';
  const content = lines.slice(1).join('\n') || '';
  
  const noteIndex = notesData.findIndex(n => n.id === noteId);
  if (noteIndex > -1) {
    if(notesData[noteIndex].title === title && notesData[noteIndex].content === content) return;
    
    notesData[noteIndex].title = title;
    notesData[noteIndex].content = content;
    notesData[noteIndex].updated_at = new Date().toISOString();
    document.getElementById('notesEditorLastUpdated').textContent = getNoteDisplayDate(notesData[noteIndex].updated_at);
  }
  
  if (window._supabaseClient) {
    try {
      await window._supabaseClient.from('notes')
        .update({ title, content, updated_at: new Date().toISOString() })
        .eq('id', noteId);
    } catch(e) { console.error("Not kaydetme hatası:", e); }
  }
}

async function promptDeleteNote() {
  const noteId = document.getElementById('currentNoteId').value;
  if (!noteId) return;
  
  if (confirm("Bu notu kalıcı olarak silmek istediğinize emin misiniz?")) {
    notesData = notesData.filter(n => n.id !== noteId);
    
    if (window._supabaseClient) {
      try {
        await window._supabaseClient.from('notes').delete().eq('id', noteId);
      } catch(e) { console.error("Not silme hatası:", e); }
    }
    
    document.getElementById('notesEditorView').style.display = 'none';
    document.getElementById('notesListView').style.display = 'flex';
    renderNotesList(notesData);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const notesTabBtn = document.querySelector('.tab-btn[data-tab="notes"]');
  if (notesTabBtn) {
    notesTabBtn.addEventListener('click', () => {
      if (notesData.length === 0) {
        loadNotes();
      }
    });
  }
});

// ═════════════════════════ HABERLER MODÜLÜ ═════════════════════════
window.NewsModule = {
  _loaded: false,

  async fetchNews() {
    const listEl = document.getElementById('newsList');
    if (!listEl) return;

    // Daha önce yüklendiyse tekrar çekme (10dk önce yüklendiyse)
    if (this._loaded && this._lastFetch && (Date.now() - this._lastFetch) < 10 * 60 * 1000) return;

    listEl.innerHTML = '<div style="text-align:center;padding:40px;color:#848e9c;">Haberler yükleniyor...</div>';

    try {
      const { data, error } = await getSB()
        .from('market_snapshots')
        .select('news, fetched_at')
        .order('fetched_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data || !data.news || data.news.length === 0) {
        listEl.innerHTML = '<div style="text-align:center;padding:40px;color:#848e9c;">Henüz haber verisi yok.<br>Bot bir sonraki çalışmada haberleri yükleyecek.</div>';
        return;
      }

      const news = data.news;
      const fetchedAt = data.fetched_at ? new Date(data.fetched_at) : null;
      const timeStr = fetchedAt ? fetchedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';

      let html = '';
      news.forEach(item => {
        const safeTitle = (item.title || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const safeDesc = (item.description || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const safeImg = (item.image || '').replace(/'/g, "\\'");
        const safeLink = (item.link || '#').replace(/'/g, "\\'");

        html += `
          <div onclick="openNewsModal('${safeTitle}', '${safeImg}', '${safeDesc}', '${safeLink}')"
               style="background:var(--bg-secondary); border-radius:12px; overflow:hidden; cursor:pointer;
                      border:1px solid rgba(255,255,255,0.06); transition:transform 0.2s, box-shadow 0.2s;
                      display:flex; flex-direction:column;"
               onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 24px rgba(0,0,0,0.3)';"
               onmouseout="this.style.transform=''; this.style.boxShadow='';">
            ${item.image ? `<img src="${item.image}" alt="" loading="lazy"
                               style="width:100%; height:180px; object-fit:cover; display:block;" />` : ''}
            <div style="padding:14px 16px;">
              <p style="color:white; font-size:14px; font-weight:700; margin:0 0 8px; line-height:1.4;">${item.title || ''}</p>
              ${item.description ? `<p style="color:#9ca3af; font-size:12px; margin:0; line-height:1.5;
                                             display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
                ${item.description}</p>` : ''}
            </div>
          </div>`;
      });

      listEl.innerHTML = html;
      if (timeStr) {
        listEl.insertAdjacentHTML('beforeend', `<p style="text-align:center;color:#4b5563;font-size:11px;margin-top:8px;">Son güncelleme: ${timeStr}</p>`);
      }

      this._loaded = true;
      this._lastFetch = Date.now();

    } catch (e) {
      console.error('Haberler yüklenemedi:', e);
      listEl.innerHTML = '<div style="text-align:center;padding:40px;color:#848e9c;">Haberler yüklenirken hata oluştu.</div>';
    }
  }
};

// Handle mobile keyboard opening
(function() {
  if (window.visualViewport) {
    const initialHeight = window.visualViewport.height;
    window.visualViewport.addEventListener('resize', () => {
      // If height shrinks by more than 100px, assume keyboard is open
      if (window.visualViewport.height < initialHeight - 100) {
        document.body.classList.add('keyboard-open');
      } else {
        document.body.classList.remove('keyboard-open');
      }
    });
  } else {
    // Fallback for browsers without visualViewport
    document.addEventListener('focusin', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        document.body.classList.add('keyboard-open');
      }
    });
    document.addEventListener('focusout', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        document.body.classList.remove('keyboard-open');
      }
    });
  }
})();
