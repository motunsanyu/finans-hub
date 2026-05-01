const STORAGE_KEYS = {
  fuel: "financeApp.fuelRecords",
  days: "financeApp.dayRecords",
  school: "financeApp.schoolRecords",
  financeSnapshot: "financeApp.financeSnapshot",
  debts: "financeApp.debts",
  appPin: "financeApp.pin",
  vault: "financeApp.vault",
  yesterdayDebt: "financeApp.yesterdayDebt",
  lastDailyUpdate: "financeApp.lastDailyUpdate"
};

let state = {
  fuelRecords: readStorage(STORAGE_KEYS.fuel, []),
  dayRecords: readStorage(STORAGE_KEYS.days, []),
  financeSnapshot: readStorage(STORAGE_KEYS.financeSnapshot, {}),
  debts: readStorage(STORAGE_KEYS.debts, { usd: 0, eur: 0, gold: 0, btc: 0, try: 0 }),
  vaultRecords: readStorage(STORAGE_KEYS.vault, []),
  yesterdayDebt: Number(localStorage.getItem(STORAGE_KEYS.yesterdayDebt)) || 0
};


const _rawSchool = readStorage(STORAGE_KEYS.school, []);
if (!Array.isArray(_rawSchool)) {
  state.school = [];
  if (_rawSchool.child1 && _rawSchool.child1.records && _rawSchool.child1.records.length > 0) {
    state.school.push({ id: "child1", name: _rawSchool.child1.name || "Profil 1", records: _rawSchool.child1.records });
  }
  if (_rawSchool.child2 && _rawSchool.child2.records && _rawSchool.child2.records.length > 0) {
    state.school.push({ id: "child2", name: _rawSchool.child2.name || "Profil 2", records: _rawSchool.child2.records });
  }
  writeStorage(STORAGE_KEYS.school, state.school);
} else {
  state.school = _rawSchool;
}

// ═════════════════════════ BAŞLATICILAR ═════════════════════════
function init() {
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

  VaultModule.init();
  FuelModule.init();
  DaysModule.init();
  SchoolModule.init();
  AltinModule.init();
  SuperligModule.init();

  refreshFinanceData();


  // Yakıt fiyatlarını uygulama başında yükle
  setTimeout(() => { if (typeof fetchFuelPrices === 'function') fetchFuelPrices(); }, 1200);

  fireAlarmBanner();


  const now = new Date();
  const hd = document.getElementById("homeDateOnly");
  const hdy = document.getElementById("homeDayOnly");
  if (hd) hd.textContent = now.toLocaleDateString("tr-TR", { day: '2-digit', month: '2-digit', year: 'numeric' });
  if (hdy) hdy.textContent = now.toLocaleDateString("tr-TR", { weekday: 'long' });

  // 🔄 Finans verilerini 30 saniyede bir otomatik yenile
  setInterval(() => {
    console.log("🔄 Finans verileri 30 saniyede bir yenileniyor...");
    refreshFinanceData();
  }, 30000);
}

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
function fireAlarmBanner() {
  let urgent = [];
  const todayMillis = new Date().setHours(0, 0, 0, 0);

  state.dayRecords.forEach(r => {
    const target = new Date(r.end).setHours(0, 0, 0, 0);
    const d = Math.round((target - todayMillis) / (1000 * 60 * 60 * 24));
    if (d === 0) urgent.push(`⏰ BUGÜN SON GÜN: ${r.title}`);
    else if (d > 0 && d <= 5) urgent.push(`⏰ ${r.title} hedefine sadece ${d} gün kaldı!`);
  });
  state.school.forEach(plan => {
    const u = plan.records.filter(x => !x.paid).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    if (u) {
      const target = new Date(u.dueDate).setHours(0, 0, 0, 0);
      const d = Math.round((target - todayMillis) / (1000 * 60 * 60 * 24));
      if (d === 0) urgent.push(`💳 BUGÜN SON GÜN: ${plan.name} Taksiti (${formatCurrency(u.amount)})`);
      else if (d > 0 && d <= 5) urgent.push(`💳 Kritik Taksit: ${plan.name} (${d} Gün Kaldı)`);
    }
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
}

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

// ═════════════════════════ APP LOCK / PIN ═════════════════════════
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
function bindSidebar() {
  const sidebar = document.getElementById("sidebar"); const overlay = document.getElementById("sidebarOverlay");
  document.getElementById("debtUSD").value = state.debts.usd || 0; document.getElementById("debtEUR").value = state.debts.eur || 0;
  document.getElementById("debtGold").value = state.debts.gold || 0; document.getElementById("debtBTC").value = state.debts.btc || 0;
  document.getElementById("debtTRY").value = state.debts.try || 0;
  document.getElementById("menuBtn").onclick = () => { sidebar.classList.add("open"); overlay.classList.add("open"); }
  document.getElementById("closeSidebarBtn").onclick = () => { sidebar.classList.remove("open"); overlay.classList.remove("open"); }
  overlay.onclick = () => { sidebar.classList.remove("open"); overlay.classList.remove("open"); }
  document.getElementById("saveDebtsBtn").onclick = () => {
    state.debts = { usd: Number(document.getElementById("debtUSD").value), eur: Number(document.getElementById("debtEUR").value), gold: Number(document.getElementById("debtGold").value), btc: Number(document.getElementById("debtBTC").value), try: Number(document.getElementById("debtTRY").value) };
    writeStorage(STORAGE_KEYS.debts, state.debts); calcTotalDebt(); sidebar.classList.remove("open"); overlay.classList.remove("open");
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

  const vgd = document.getElementById("vaultGlobalDebt"); if (vgd) { vgd.textContent = formatCurrency(totalTRY); vgd.style.color = totalTRY < 0 ? "var(--down)" : totalTRY > 0 ? "var(--up)" : "var(--text-primary)"; }
}

// ═════════════════════════ PİYASALAR API ═════════════════════════
async function refreshFinanceData() {
  console.log("Finans verileri cekiliyor...");
  const meta = document.getElementById("financeMeta");
  const nextSnapshot = { ...state.financeSnapshot, updatedAt: Date.now() };

  // 1. Kripto Paralar (Binance Hala En Sağlıklısı)
  try {
    const bRes = await fetch("https://api.binance.com/api/v3/ticker/24hr");
    if (bRes.ok) {
      const data = await bRes.json(); const p = {}; data.forEach(i => p[i.symbol] = { p: Number(i.lastPrice), c: Number(i.priceChangePercent) });
      if (p['BTCUSDT']) { nextSnapshot.btcUsd = { price: p['BTCUSDT'].p, change: p['BTCUSDT'].c }; }
      if (p['ETHUSDT']) { nextSnapshot.ethUsd = { price: p['ETHUSDT'].p, change: p['ETHUSDT'].c }; }
      if (p['BNBUSDT']) { nextSnapshot.bnbUsd = { price: p['BNBUSDT'].p, change: p['BNBUSDT'].c }; }
      if (p['XRPUSDT']) { nextSnapshot.xrpUsd = { price: p['XRPUSDT'].p, change: p['XRPUSDT'].c }; }
    }
  } catch (e) { console.warn("Binance Hatasi", e); }

  // 2. DOVIZ.COM MERKEZİ VERİ ÇEKME (USD, EUR, ALTIN, GÜMÜŞ, BRENT, BIST)
  try {
    const dUrl = "https://www.doviz.com";
    const dProxy = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(dUrl)}`;
    const dRes = await fetch(dProxy);
    if (dRes.ok) {
      const html = await dRes.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const parseDoviz = (key) => {
        const s = doc.querySelector(`[data-socket-key="${key}"][data-socket-attr="s"]`)?.textContent.trim();
        const c = doc.querySelector(`[data-socket-key="${key}"][data-socket-attr="c"]`)?.textContent.trim();
        if (!s) return null;
        return { price: parseFlexibleNumber(s), change: parseFlexibleNumber(c) };
      };

      const usd = parseDoviz("USD"); if (usd) nextSnapshot.usdTry = usd;
      const eur = parseDoviz("EUR"); if (eur) nextSnapshot.eurTry = eur;
      const gold = parseDoviz("gram-altin"); if (gold) nextSnapshot.goldTry = gold;
      const silver = parseDoviz("gumus"); if (silver) nextSnapshot.silverTry = silver;
      const brent = parseDoviz("BRENT"); if (brent) nextSnapshot.brent = brent;
      const bist = parseDoviz("XU100"); if (bist) nextSnapshot.bist = bist;
    }
  } catch (e) { console.warn("Doviz Central Error", e); }

  state.financeSnapshot = nextSnapshot; writeStorage(STORAGE_KEYS.financeSnapshot, nextSnapshot);

  // UI Güncelleme
  paintFinanceRow("usdTry", nextSnapshot.usdTry, 4);
  paintFinanceRow("eurTry", nextSnapshot.eurTry, 4);
  paintFinanceRow("btcUsd", nextSnapshot.btcUsd, 2, "$");
  paintFinanceRow("ethUsd", nextSnapshot.ethUsd, 2, "$");
  paintFinanceRow("bnbUsd", nextSnapshot.bnbUsd, 2, "$");
  paintFinanceRow("xrpUsd", nextSnapshot.xrpUsd, 4, "$");
  paintFinanceRow("goldTry", nextSnapshot.goldTry, 2);
  paintFinanceRow("silverTry", nextSnapshot.silverTry, 2);

  // Brent ve BIST Manuel UI (Pill sınıfı Doviz.com'dan geliyor)
  updateExtraRow("brent", nextSnapshot.brent, "$");
  updateExtraRow("bist", nextSnapshot.bist, "");

  calcTotalDebt();
  const dateStr = new Date(nextSnapshot.updatedAt).toLocaleDateString("tr-TR"); const timeStr = new Date(nextSnapshot.updatedAt).toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' }); meta.innerHTML = `Son Güncelleme : ${dateStr} - ${timeStr}`;
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



// ═════════════════════════════════════════════════════════════════
// ═════════════════════════ YARDIMCI FONKSİYONLAR ═════════════════════════
function readStorage(k, f) { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch { return f; } }
function writeStorage(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
function sum(a, f) { return a.reduce((a, r) => a + Number(r[f] || 0), 0); }
function formatCurrency(v, dec = 0, f = "0") { return !Number.isFinite(Number(v)) ? f : new Intl.NumberFormat("tr-TR", { maximumFractionDigits: dec, minimumFractionDigits: dec }).format(v) + " ₺"; }
function formatNumber(v, d = 2, f = "--") { return !Number.isFinite(Number(v)) ? f : new Intl.NumberFormat("tr-TR", { maximumFractionDigits: d, minimumFractionDigits: d }).format(v); }
function formatDate(d) { return d ? new Date(d).toLocaleDateString("tr-TR") : "-"; }
function formatDateShort(d) { if (!d) return "-"; const date = new Date(d); return String(date.getDate()).padStart(2, '0') + "." + String(date.getMonth() + 1).padStart(2, '0'); }
function formatDateShortYY(d) { if (!d) return "-"; const date = new Date(d); return String(date.getDate()).padStart(2, '0') + "." + String(date.getMonth() + 1).padStart(2, '0') + "." + String(date.getFullYear()).slice(-2); }
function setText(i, v) { const e = document.getElementById(i); if (e) e.textContent = v; }



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
  const pinScreen = document.getElementById("pinScreen");
  if (pinScreen) pinScreen.style.display = "flex";
});

// ══════════════════════════════════════════
// COİNLERFİYATLARI (Binance API)


// ══════════════════════════════════════════
// YAKIT FİYATLARI (akaryakit-fiyatlari API)
// ══════════════════════════════════════════
// Global: son çekilen yakıt fiyatları (formdan çağırmak için)
window._lastFuelPrices = { benzin: null, motorin: null, lpg: null, timestamp: null };

window.fetchFuelPrices = async function () {
  const cards = document.getElementById('fuelPriceCards');
  const meta = document.getElementById('fuelPriceMeta');
  if (!cards) return;

  cards.innerHTML = `
      <div class="fuel-price-card benzin"><div class="fpc-icon">⛽</div><div class="fpc-label">Benzin 95</div><div class="fpc-price anim-pulse">●●</div></div>
      <div class="fuel-price-card motorin"><div class="fpc-icon">🚛</div><div class="fpc-label">Motorin</div><div class="fpc-price anim-pulse">●●</div></div>
      <div class="fuel-price-card lpg"><div class="fpc-icon">💨</div><div class="fpc-label">LPG</div><div class="fpc-price anim-pulse">●●</div></div>`;

  const cityEl = document.getElementById('fuelCitySelect');
  const firmEl = document.getElementById('fuelFirmSelect');
  const cityKey = cityEl ? cityEl.value : 'istanbul';
  const firmKey = firmEl ? firmEl.value : 'opet';

  // Doviz.com URL (Daha kararlı veri kaynağı)
  const targetUrl = `https://www.doviz.com/akaryakit-fiyatlari/${cityKey}`;
  // Hızlı ve kararlı proxy: Codetabs
  const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`;

  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error('Proxy Hatası.');

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const rows = Array.from(doc.querySelectorAll('table tr'));

    const labels = {
      'opet': 'opet',
      'petrol-ofisi': 'ofisi',
      'shell': 'shell',
      'bp': 'bp',
      'total': 'total',
      'aytemiz': 'aytemiz'
    };
    const search = labels[firmKey] || 'opet';

    let r = rows.find(tr => tr.textContent.toLowerCase().includes(search));
    if (!r && rows.length > 1) r = rows[1]; // Fallback to first general row

    let benzin = "0.00", motorin = "0.00", lpg = "0.00";
    if (r) {
      const tds = r.querySelectorAll('td');
      if (tds.length >= 4) {
        benzin = tds[1].textContent.replace('₺', '').trim();
        motorin = tds[2].textContent.replace('₺', '').trim();
        lpg = tds[3].textContent.replace('₺', '').trim();
      }
    }

    // Global cache'e kaydet
    window._lastFuelPrices = {
      benzin: parseFloat(benzin.replace(',', '.')) || null,
      motorin: parseFloat(motorin.replace(',', '.')) || null,
      lpg: parseFloat(lpg.replace(',', '.')) || null,
      timestamp: Date.now()
    };

    // Eğer formda yakıt tipi seçiliyse otomatik doldur
    const fuelType = document.getElementById('fuelTypeSelect')?.value;
    const priceInput = document.getElementById('fuelPrice');
    if (fuelType && priceInput) {
      const priceMap = { benzin: window._lastFuelPrices.benzin, motorin: window._lastFuelPrices.motorin, lpg: window._lastFuelPrices.lpg };
      if (priceMap[fuelType]) {
        priceInput.value = priceMap[fuelType].toFixed(2);
        const hint = document.getElementById('fuelPriceHint');
        if (hint) hint.textContent = `✅ ${fuelType === 'benzin' ? 'Benzin 95' : fuelType === 'motorin' ? 'Motorin' : 'LPG'} fiyatı otomatik dolduruldu (${cityKey.toUpperCase()} - ${firmKey.toUpperCase()})`;
      }
    }

    cards.innerHTML = `
          <div class="fuel-price-card benzin"><div class="fpc-icon">⛽</div><div class="fpc-label">Benzin 95</div><div class="fpc-price">${benzin}</div></div>
          <div class="fuel-price-card motorin"><div class="fpc-icon">🚛</div><div class="fpc-label">Motorin</div><div class="fpc-price">${motorin}</div></div>
          <div class="fuel-price-card lpg"><div class="fpc-icon">💨</div><div class="fpc-label">LPG</div><div class="fpc-price">${lpg}</div></div>`;

    const now = new Date().toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' });
    if (meta) meta.textContent = `${cityKey.toUpperCase()} • ${firmKey.toUpperCase()} • ${now}`;

  } catch (error) {
    console.error("Yakit:", error);
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
