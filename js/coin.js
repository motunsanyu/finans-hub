console.log('LightweightCharts test:', typeof LightweightCharts, typeof LightweightCharts?.createChart, typeof LightweightCharts?.addCandlestickSeries);

// js/coin.js — Gelişmiş Teknik Analiz & AI Yorum Motoru
const COIN_LIST = [
  { sym: 'BTCUSDT', name: 'Bitcoin', base: 'BTC', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png' },
  { sym: 'ETHUSDT', name: 'Ethereum', base: 'ETH', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png' },
  { sym: 'BNBUSDT', name: 'BNB', base: 'BNB', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png' },
  { sym: 'SOLUSDT', name: 'Solana', base: 'SOL' },
  { sym: 'DOGEUSDT', name: 'Dogecoin', base: 'DOGE' },
  { sym: 'AVAXUSDT', name: 'Avalanche', base: 'AVAX' },
  { sym: 'DEXEUSDT', name: 'DeXe', base: 'DEXE', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5916.png' },
  { sym: 'SUIUSDT', name: 'Sui', base: 'SUI', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/20947.png' },
  { sym: 'PEPEUSDT', name: 'Pepe', base: 'PEPE', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/24478.png' },
  { sym: 'LINKUSDT', name: 'Chainlink', base: 'LINK' },
  { sym: 'RENDERUSDT', name: 'Render', base: 'RENDER', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5632.png' },
  { sym: 'JUPUSDT', name: 'Jupiter', base: 'JUP', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/29210.png' },
  { sym: 'WIFUSDT', name: 'dogwifhat', base: 'WIF', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/28752.png' },
  { sym: 'TWTUSDT', name: 'Trust Wallet Token', base: 'TWT', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5227.png' },
  { sym: 'EGLDUSDT', name: 'MultiversX', base: 'EGLD', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/6892.png' },
];

// ─── 1. GENEL & İLERİ SEVİYE TEKNİK ANALİZ FONKSİYONLARI ────────────
async function fetchKlines(symbol, interval = '1h', limit = 100) {
  try {
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.map(k => ({
      time: Math.floor(k[0] / 1000),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5])
    }));
  } catch { return []; }
}

function calculateEMA(closes, period) { /* Aynı kod */
  if (closes.length < period) return null;
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const k = 2 / (period + 1);
  for (let i = period; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
  return ema;
}

function calculateRSI(closes, period = 14) {
  // En az periyodun 2 katı + 1 kadar veri lazım (sağlıklı hesaplama için)
  if (closes.length < period * 2 + 1) return null;
  
  const changes = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }
  
  // İlk ortalamalar: Basit Hareketli Ortalama (SMA)
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;
  
  // Sonraki değerler: Wilder's Smoothing (Üstel Düzleştirme)
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;
  }
  
  // Sıfıra bölme hatasını engelle
  if (avgLoss === 0 && avgGain === 0) return 50; // Hiç değişim yok
  if (avgLoss === 0) return 100; // Hiç kayıp yok, sürekli yükseliş
  if (avgGain === 0) return 0;   // Hiç kazanç yok, sürekli düşüş
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(closes) { /* Aynı kod */
  const ema12 = calculateEMA(closes, 12), ema26 = calculateEMA(closes, 26);
  if (!ema12 || !ema26) return null;
  return ema12 - ema26;
}

// YENİ: ADX (Average Directional Index) - Trend gücü
function calculateADX(klines, period = 14) {
  if (klines.length < period + 1) return null;
  let trs = [], pdms = [], ndms = [];
  for (let i = 1; i < klines.length; i++) {
    const h = klines[i].high, l = klines[i].low, pc = klines[i-1].close;
    const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    trs.push(tr);
    const up = h - klines[i-1].high, down = klines[i-1].low - l;
    pdms.push(up > down && up > 0 ? up : 0);
    ndms.push(down > up && down > 0 ? down : 0);
  }
  let atr = trs.slice(0, period).reduce((a,b)=>a+b,0)/period;
  let pdm = pdms.slice(0, period).reduce((a,b)=>a+b,0)/period;
  let ndm = ndms.slice(0, period).reduce((a,b)=>a+b,0)/period;
  let dxs = [];
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    pdm = (pdm * (period - 1) + pdms[i]) / period;
    ndm = (ndm * (period - 1) + ndms[i]) / period;
    const pdi = (pdm / atr) * 100, ndi = (ndm / atr) * 100;
    const dx = atr === 0 ? 0 : Math.abs(pdi - ndi) / (pdi + ndi) * 100;
    dxs.push(dx);
  }
  if (dxs.length < period) return null;
  let adx = dxs.slice(0, period).reduce((a,b)=>a+b,0)/period;
  for (let i = period; i < dxs.length; i++) adx = (adx * (period - 1) + dxs[i]) / period;
  return adx;
}

// YENİ: OBV (On-Balance Volume) - Hacim akışı
function calculateOBV(klines) {
  if (klines.length < 2) return null;
  let obv = 0;
  for (let i = 1; i < klines.length; i++) {
    if (klines[i].close > klines[i-1].close) obv += klines[i].volume;
    else if (klines[i].close < klines[i-1].close) obv -= klines[i].volume;
  }
  return obv;
}

// YENİ: Bollinger Bantları (Basit hesaplama)
function calculateBollinger(closes, period = 20, stdDev = 2) {
  if (closes.length < period) return null;
  const sma = closes.slice(-period).reduce((a,b)=>a+b,0)/period;
  const variance = closes.slice(-period).reduce((a,b)=>a+Math.pow(b-sma,2),0)/period;
  const std = Math.sqrt(variance);
  return { upper: sma + stdDev * std, middle: sma, lower: sma - stdDev * std };
}

// YENİ: ATR (Average True Range) - Volatilite
function calculateATR(klines, period = 14) {
  if (klines.length < period + 1) return null;
  let trs = [];
  for (let i = 1; i < klines.length; i++) {
    const h = klines[i].high, l = klines[i].low, pc = klines[i-1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  let atr = trs.slice(0, period).reduce((a,b)=>a+b,0)/period;
  for (let i = period; i < trs.length; i++) atr = (atr * (period - 1) + trs[i]) / period;
  return atr;
}

// YENİ: RSI Uyumsuzluk Tespiti (Diverjans)
function detectRSIDivergence(klines, rsiPeriod = 14) {
  if (klines.length < 25) return null;
  const closes = klines.map(k => k.close);
  const rsiValues = [];
  for (let i = rsiPeriod; i < closes.length; i++) {
    rsiValues.push(calculateRSI(closes.slice(0, i+1), rsiPeriod));
  }
  const recentCloses = closes.slice(-10);
  const recentRSIs = rsiValues.slice(-10);
  const priceMin = Math.min(...recentCloses);
  const priceMax = Math.max(...recentCloses);
  const rsiMin = Math.min(...recentRSIs);
  const rsiMax = Math.max(...recentRSIs);
  if (recentCloses[recentCloses.length-1] > recentCloses[recentCloses.length-2] && priceMin === recentCloses[recentCloses.length-2] && rsiMin === recentRSIs[recentCloses.length-2]) return "Ayı"; // Basitleştirilmiş
  if (recentCloses[recentCloses.length-1] < recentCloses[recentCloses.length-2] && priceMax === recentCloses[recentCloses.length-2] && rsiMax === recentRSIs[recentCloses.length-2]) return "Boğa";
  return null;
}

// ─── 2. GELİŞMİŞ AI YORUM MOTORU (Puanlama Sistemi) ──────────────
function generateAdvancedAIComment(klines, timeframe) {
  if (!klines || klines.length < 30) return { items: ["⏳ Analiz için yeterli veri yok."], statusEmoji: "⚪", statusColor: "var(--text-secondary)" };

  const closes = klines.map(k => k.close);
  const volumes = klines.map(k => k.volume);
  const latestPrice = closes[closes.length-1];
  const items = [];
  let totalScore = 0;

  // --- Klasik Göstergeler (EMA, RSI, MACD) ---
  const ema5 = calculateEMA(closes, 5), ema12 = calculateEMA(closes, 12), ema13 = calculateEMA(closes, 13);
  const rsi14 = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);

  // EMA Sıkışma & Kesişim
  if (ema5 && ema12 && ema13) {
    const spread = ((Math.max(ema5, ema12, ema13) - Math.min(ema5, ema12, ema13)) / Math.min(ema5, ema12, ema13)) * 100;
    if (spread < 1) { items.push("🔵 EMA 5-12-13 sıkıştı (fark %" + spread.toFixed(2) + "). Yakında sert bir kırılım beklenebilir."); totalScore += 0; }
    else items.push("✅ EMA'lar arası fark normal (%" + spread.toFixed(2) + ").");
    if (ema5 > ema12) { items.push("📈 EMA5, EMA12'nin üzerinde (Kısa vadeli pozitif)."); totalScore += 2; }
    else { items.push("📉 EMA5, EMA12'nin altında (Kısa vadeli zayıf)."); totalScore -= 1; }
  }
  // RSI
  if (rsi14) {
    if (rsi14 > 70) { items.push("🔴 RSI aşırı alım bölgesinde (" + rsi14.toFixed(1) + ")."); totalScore -= 2; }
    else if (rsi14 < 30) { items.push("🔵 RSI aşırı satım bölgesinde (" + rsi14.toFixed(1) + ")."); totalScore += 2; }
    else if (rsi14 > 55) { items.push("👍 RSI momentumu olumlu (" + rsi14.toFixed(1) + ")."); totalScore += 1; }
    else { items.push("👎 RSI zayıf momentum (" + rsi14.toFixed(1) + ")."); totalScore -= 1; }
  }
  // MACD
  if (macd !== null) {
    if (macd > 0) { items.push("📊 MACD sıfırın üzerinde, pozitif trend."); totalScore += 1; }
    else { items.push("📉 MACD sıfırın altında, negatif trend."); totalScore -= 1; }
  }

  // --- Pro Göstergeler (ADX, OBV, Bollinger, ATR) ---
  const adx = calculateADX(klines, 14);
  const obv = calculateOBV(klines);
  const bollinger = calculateBollinger(closes, 20, 2);
  const atr = calculateATR(klines, 14);

  // ADX Yorumu
  if (adx !== null) {
    if (adx > 25) { items.push("💪 Trend gücü (ADX) kuvvetli (" + adx.toFixed(1) + " > 25). Sinyaller daha güvenilir."); totalScore += 2; }
    else if (adx < 20) { items.push("😴 ADX çok düşük (" + adx.toFixed(1) + " < 20). Piyasa yatay/sıkışık; sinyaller yanıltıcı olabilir."); totalScore -= 1; }
    else items.push("📏 ADX normal seviyede (" + adx.toFixed(1) + ").");
  }

  // OBV & Hacim Yorumu
  const avgVolume = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
  const lastVolume = volumes[volumes.length - 1];
  if (obv !== null && klines.length > 20) {
    const prevOBV = calculateOBV(klines.slice(0, -5));
    if (latestPrice > closes[closes.length-5] && obv < prevOBV) {
      items.push("⚠️ Fiyat yükseliyor ama OBV düşüyor (Ayı uyumsuzluğu). Dağıtım ihtimali var."); totalScore -= 2;
    } else if (latestPrice < closes[closes.length-5] && obv > prevOBV) {
      items.push("🔍 Fiyat düşüyor ama OBV yükseliyor (Boğa uyumsuzluğu). Toplama ihtimali var."); totalScore += 2;
    }
  }
  if (lastVolume > avgVolume * 1.5) { items.push("🚀 Hacimde anormal artış var!"); totalScore += 2; }

  // Bollinger Yorumu
  if (bollinger) {
    const bandwidth = ((bollinger.upper - bollinger.lower) / bollinger.middle) * 100;
    if (latestPrice > bollinger.upper) { items.push("📈 Fiyat üst Bollinger bandının dışında. Aşırı alım/devam sinyali olabilir."); totalScore -= 1; }
    else if (latestPrice < bollinger.lower) { items.push("📉 Fiyat alt Bollinger bandının dışında. Aşırı satım/devam sinyali olabilir."); totalScore += 1; }
    if (bandwidth < 5) { items.push("📊 Bollinger bantları daralıyor. Volatilite kırılımı yakın."); totalScore += 0; }
  }

  // ATR Yorumu
  if (atr) {
    const atrPercent = (atr / latestPrice) * 100;
    if (atrPercent > 5) { items.push("🌋 Volatilite (ATR) çok yüksek (% " + atrPercent.toFixed(2) + "). Risk yönetimine dikkat edilmeli."); totalScore += 0; }
    else if (atrPercent < 1) { items.push("🛌 Volatilite çok düşük. Piyasa sakin."); totalScore += 0; }
  }

  // RSI Uyumsuzluk Tespiti
  const divergence = detectRSIDivergence(klines);
  if (divergence === "Boğa") { items.push("🐂 Fiyat düşüş yaparken RSI yükseliyor (Boğa uyumsuzluğu). Trend dönüş sinyali olabilir!"); totalScore += 3; }
  else if (divergence === "Ayı") { items.push("🐻 Fiyat yükseliş yaparken RSI düşüyor (Ayı uyumsuzluğu). Dikkatli olunmalı."); totalScore -= 3; }

  // --- Nihai Değerlendirme ---
  let statusEmoji, statusColor;
  if (totalScore >= 5) { statusEmoji = "🟢 GÜÇLÜ ALIM"; statusColor = "var(--up)"; }
  else if (totalScore >= 2) { statusEmoji = "🟢 YÜKSELİŞ BEKLENTİSİ"; statusColor = "var(--up)"; }
  else if (totalScore >= -1) { statusEmoji = "🟡 NÖTR / BELİRSİZ"; statusColor = "var(--brand)"; }
  else if (totalScore >= -4) { statusEmoji = "🔴 ZAYIF GÖRÜNÜM"; statusColor = "var(--down)"; }
  else { statusEmoji = "🔴 STRONG SELL"; statusColor = "var(--down)"; }

  return { items, statusEmoji, statusColor, totalScore };
}

// ─── 3. ARAYÜZ FONKSİYONLARI (Dalgalanmasız listeleme) ───────
window.isFirstCoinLoad = true;

async function fetchCoinPrices() {
  const container = document.getElementById('coinlerList');
  const meta = document.getElementById('coinlerMeta');
  if (!container) return;

  try {
    const symbols = COIN_LIST.map(c => `"${c.sym}"`).join(',');
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbols}]`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const tickers = await res.json();
    const map = {};
    tickers.forEach(t => { map[t.symbol] = t; });

    if (window.isFirstCoinLoad) {
      const iconBase = 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color';
      container.innerHTML = COIN_LIST.map(coin => {
        const d = map[coin.sym];
        if (!d) return '';
        const price = parseFloat(d.lastPrice);
        const chg = parseFloat(d.priceChangePercent);
        const isUp = chg >= 0;
        const pillCls = isUp ? 'up' : 'down';
        const priceStr = price < 0.0001 ? price.toFixed(8)
          : price < 0.01 ? price.toFixed(6)
            : price < 1 ? price.toFixed(4)
              : price < 10 ? price.toFixed(3)
                : price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const iconSrc = coin.logo || `${iconBase}/${coin.base.toLowerCase()}.png`;

        return `<div class="coin-row" id="coin-row-${coin.sym}" style="display:flex; height:auto; min-height:60px; cursor:pointer;" onclick="openCoinDetail('${coin.sym}')">
            <div class="m-left"><img src="${iconSrc}" class="market-icon" style="border-radius:50%;" onerror="this.style.display='none';this.nextSibling.style.display='flex'">
            <div class="coin-letter-icon" style="display:none; width:32px; height:32px; border-radius:50%; background:rgba(255,255,255,0.05); align-items:center; justify-content:center; font-size:12px; font-weight:800; color:var(--text-secondary);">${coin.base[0]}</div>
            <div><div class="m-symbol">${coin.base}<span class="m-pair">/USDT</span></div>
            <div style="font-size:10px;color:var(--text-secondary);margin-top:2px;">${coin.name}</div></div></div>
            <div class="m-middle coin-price" style="font-size:14px;">${priceStr}</div>
            <div class="m-right"><div class="pill ${pillCls} coin-change" style="font-size:12px;">${isUp ? '+' : ''}${chg.toFixed(2)}%</div></div></div>`;
      }).join('');
      window.isFirstCoinLoad = false;
    } else {
      COIN_LIST.forEach(coin => {
        const d = map[coin.sym];
        if (!d) return;
        const row = document.getElementById(`coin-row-${coin.sym}`);
        if (!row) return;
        const price = parseFloat(d.lastPrice);
        const chg = parseFloat(d.priceChangePercent);
        const isUp = chg >= 0;
        const priceStr = price < 0.0001 ? price.toFixed(8) : price < 0.01 ? price.toFixed(6) : price < 1 ? price.toFixed(4) : price < 10 ? price.toFixed(3) : price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const priceEl = row.querySelector('.coin-price');
        const changeEl = row.querySelector('.coin-change');
        if (priceEl) priceEl.textContent = priceStr;
        if (changeEl) { changeEl.textContent = `${isUp ? '+' : ''}${chg.toFixed(2)}%`; changeEl.className = `pill ${isUp ? 'up' : 'down'} coin-change`; }
      });
    }
    if (meta) meta.textContent = `Binance • ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} • 5sn otomatik`;
  } catch (e) {
    container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--down);">Bağlantı hatası. <button onclick="fetchCoinPrices()" style="color:var(--brand);background:none;border:none;font-weight:800;cursor:pointer;">Tekrar dene</button></div>`;
    window.isFirstCoinLoad = true;
  }
}

// EMA serileri için global referanslar
let ema5Series = null;
let ema12Series = null;
let ema13Series = null;
let isEma5Visible = true;
let isEma12Visible = true;
let isEma13Visible = true;

// ─── 4. COIN DETAY MODALI ─────────────────────────────────────
let currentCoinSymbol = '';
let coinChart = null;
let coinCandleSeries = null;

window.openCoinDetail = async function(symbol) {
  currentCoinSymbol = symbol;
  const modal = document.getElementById('coinDetailModal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.getElementById('coinDetailSymbol').textContent = symbol;
  document.getElementById('coinDetailPrice').textContent = '--';
  document.getElementById('coinDetailChange').textContent = '--';
  document.getElementById('cdHigh').textContent = '--';
  document.getElementById('cdLow').textContent = '--';
  document.getElementById('cdVolume').textContent = '--';
  document.getElementById('cdVolumeCoin').textContent = '--';
  document.getElementById('coinDetailUpdate').textContent = '--';
  document.getElementById('coinDetailComment').innerHTML = '<span style="color:var(--text-secondary);">Veriler yükleniyor...</span>';

  const coinInfo = COIN_LIST.find(c => c.sym === symbol);
  document.getElementById('coinDetailIcon').src = coinInfo?.logo || `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbol.replace('USDT','').toLowerCase()}.png`;

  await refreshCoinDetailData();
  await renderCoinChart();
};

async function refreshCoinDetailData() {
  const symbol = currentCoinSymbol;
  if (!symbol) return;
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
    const ticker = await res.json();
    const price = parseFloat(ticker.lastPrice);
    const change = parseFloat(ticker.priceChangePercent);
    const isUp = change >= 0;
    const formattedPrice = price < 0.1 ? price.toFixed(6) : price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('coinDetailPrice').textContent = `$${formattedPrice}`;
    const changeEl = document.getElementById('coinDetailChange');
    changeEl.textContent = `${isUp ? '+' : ''}${change.toFixed(2)}%`;
    changeEl.style.color = isUp ? 'var(--up)' : 'var(--down)';
    document.getElementById('cdHigh').textContent = `$${parseFloat(ticker.highPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
    document.getElementById('cdLow').textContent = `$${parseFloat(ticker.lowPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
    document.getElementById('cdVolume').textContent = `$${(parseFloat(ticker.quoteVolume) / 1e6).toFixed(2)}M`;
    document.getElementById('cdVolumeCoin').textContent = `${(parseFloat(ticker.volume) / 1e6).toFixed(2)}M ${symbol.replace('USDT','')}`;
    document.getElementById('coinDetailUpdate').textContent = `Son güncelleme: ${new Date().toLocaleTimeString('tr-TR')}`;

    const selectedTF = document.querySelector('.tf-btn.active')?.dataset?.tf || '1h';
    const klines = await fetchKlines(symbol, selectedTF, 200);
    const { items, statusEmoji, statusColor } = generateAdvancedAIComment(klines, selectedTF);
    document.getElementById('coinDetailComment').innerHTML = `
      <div style="margin-bottom:12px;">
        <span style="font-weight:800; color:${statusColor}; font-size:15px;">${statusEmoji}</span>
        <span style="font-size:11px; color:var(--text-secondary); margin-left:8px;">${selectedTF}'lık analiz</span>
      </div>
      <ul style="margin:0; padding-left:18px; list-style:none;">
        ${items.map(item => `<li style="margin-bottom:8px; display:flex; align-items:baseline; gap:8px;"><span style="color:var(--brand); font-size:12px;">•</span> <span style="color:var(--text-primary);">${item}</span></li>`).join('')}
      </ul>`;
  } catch (err) { console.error('Coin detay hatası:', err); }
}

async function renderCoinChart() {
  const container = document.getElementById('coinChartContainer');
  if (!container || typeof LightweightCharts === 'undefined') {
    console.warn('⚠️ Grafik container veya kütüphane bulunamadı');
    return;
  }

  // Önceki grafiği temizle
  if (coinChart) {
    try { coinChart.remove(); } catch(e) {}
    coinChart = null;
    coinCandleSeries = null;
  }

  // Modal tam açılana kadar bekle
  await new Promise(resolve => setTimeout(resolve, 200));

  // Container boyut garantisi
  container.style.display = 'block';
  container.style.width = '100%';
  container.style.minHeight = '350px';
  container.style.height = '350px';
  
  // Genişlik 0 ise zorla ata
  if (container.clientWidth === 0) {
    container.style.width = '400px';
  }

  const symbol = currentCoinSymbol;
  const tf = document.querySelector('.tf-btn.active')?.dataset?.tf || '1h';
  const limitSelect = document.getElementById('candleLimitSelect');
  const limit = limitSelect ? parseInt(limitSelect.value) : 200;
  console.log('📊 Kullanılan mum limiti:', limit);
  const klines = await fetchKlines(symbol, tf, limit);

  if (!klines || klines.length < 5) {
    console.warn('⚠️ Yetersiz kline verisi');
    return;
  }

  const sortedData = [...klines].sort((a, b) => a.time - b.time);

  try {
    // createChart her zaman bir chart objesi dönmeli
    coinChart = LightweightCharts.createChart(container, {
      localization: {
        timeFormatter: (timestamp) => {
          const d = new Date(timestamp * 1000);
          return d.toLocaleString('tr-TR', {
            timeZone: 'Europe/Istanbul',
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
        }
      },
      layout: {
        background: { type: 'solid', color: '#0b0e11' },
        textColor: '#848e9c',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.05)' },
        horzLines: { color: 'rgba(255,255,255,0.05)' },
      },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.1)', timeVisible: true },
      width: container.clientWidth || 400,
      height: 350,
    });

    // Mum serisi ekleme
    coinCandleSeries = coinChart.addCandlestickSeries({
      upColor: '#0ecb81',
      downColor: '#f6465d',
      borderDownColor: '#f6465d',
      borderUpColor: '#0ecb81',
      wickDownColor: '#f6465d',
      wickUpColor: '#0ecb81',
    });
    coinCandleSeries.setData(sortedData);
    coinChart.timeScale().fitContent();
    console.log('✅ Mum grafiği başarıyla çizildi');

    // EMA serileri
    try {
      const ema5Data = calculateEMAArray(klines, 5);
      const ema12Data = calculateEMAArray(klines, 12);
      const ema13Data = calculateEMAArray(klines, 13);

      if (ema5Data.length > 0) {
        ema5Series = coinChart.addLineSeries({ color: '#2962FF', lineWidth: 1 });
        ema5Series.setData(ema5Data);
        ema5Series.applyOptions({ visible: isEma5Visible });
      }
      if (ema12Data.length > 0) {
        ema12Series = coinChart.addLineSeries({ color: '#FF9800', lineWidth: 1 });
        ema12Series.setData(ema12Data);
        ema12Series.applyOptions({ visible: isEma12Visible });
      }
      if (ema13Data.length > 0) {
        ema13Series = coinChart.addLineSeries({ color: '#F44336', lineWidth: 1 });
        ema13Series.setData(ema13Data);
        ema13Series.applyOptions({ visible: isEma13Visible });
      }
      console.log('✅ EMA çizgileri eklendi');
    } catch (e) {
      console.warn('EMA çizgileri eklenemedi:', e);
    }

  } catch (e) {
    console.error('❌ Grafik oluşturma hatası:', e);
  }
}

// ─── YENİ: EMA Çizgi Verisi Hesaplayıcı (Grafik için) ───
function calculateEMAArray(klines, period) {
  if (klines.length < period) return [];
  const k = 2 / (period + 1);
  const result = [];
  let ema = klines.slice(0, period).reduce((sum, k) => sum + k.close, 0) / period; // SMA başlangıç
  result.push({ time: klines[period - 1].time, value: ema });

  for (let i = period; i < klines.length; i++) {
    ema = (klines[i].close - ema) * k + ema;
    result.push({ time: klines[i].time, value: ema });
  }
  return result;
}

window.switchCoinTF = function(tf) {
  document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.tf-btn[data-tf="${tf}"]`)?.classList.add('active');
  refreshCoinDetailData();
  renderCoinChart();
};

window.closeCoinDetail = function() {
  document.getElementById('coinDetailModal').style.display = 'none';
  if (coinChart) { coinChart.remove(); coinChart = null; coinCandleSeries = null; }
};

// ─── 6. OTOMATİK LİSTE YENİLEME ──────────────────────────────
let coinRefreshInterval = null;
window.switchMarketTab = function (tab) {
  const piyasa = document.getElementById('piyasaSection');
  const coinler = document.getElementById('coinlerSection');
  const btnP = document.getElementById('btnMarketPiyasa');
  const btnC = document.getElementById('btnMarketCoinler');
  if (!piyasa || !coinler) return;
  if (coinRefreshInterval) { clearInterval(coinRefreshInterval); coinRefreshInterval = null; }
  if (tab === 'coins') {
    piyasa.style.display = 'none'; coinler.style.display = 'block';
    btnP?.classList.remove('active'); btnC?.classList.add('active');
    fetchCoinPrices();
    coinRefreshInterval = setInterval(fetchCoinPrices, 5000);
  } else {
    piyasa.style.display = 'block'; coinler.style.display = 'none';
    btnP?.classList.add('active'); btnC?.classList.remove('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

window.toggleEMA = function(period) {
  const btn = document.getElementById(`ema${period}Toggle`);
  let series, isVisible;

  if (period === '5') {
    series = ema5Series;
    isEma5Visible = !isEma5Visible;
    isVisible = isEma5Visible;
  } else if (period === '12') {
    series = ema12Series;
    isEma12Visible = !isEma12Visible;
    isVisible = isEma12Visible;
  } else if (period === '13') {
    series = ema13Series;
    isEma13Visible = !isEma13Visible;
    isVisible = isEma13Visible;
  }

  if (series) {
    series.applyOptions({ visible: isVisible });
  }
  if (btn) {
    btn.classList.toggle('active', isVisible);
  }
};

window.switchCandleLimit = function() {
  console.log('🔄 Mum sayısı değişti, grafik yeniden çiziliyor...');
  renderCoinChart();
};