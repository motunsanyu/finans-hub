console.log('LightweightCharts test:', typeof LightweightCharts, typeof LightweightCharts?.createChart);

// js/coin.js — Gelişmiş Teknik Analiz & AI Yorum Motoru
const COIN_LIST = [
  { sym: 'BTCUSDT', name: 'Bitcoin', base: 'BTC', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png' },
  { sym: 'ETHUSDT', name: 'Ethereum', base: 'ETH', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png' },
  { sym: 'BNBUSDT', name: 'BNB', base: 'BNB', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png' },
  { sym: 'XRPUSDT', name: 'XRP', base: 'XRP', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/52.png' },
  { sym: 'SOLUSDT', name: 'Solana', base: 'SOL', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png' },
  { sym: 'DOGEUSDT', name: 'Dogecoin', base: 'DOGE', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/74.png' },
  { sym: 'ADAUSDT', name: 'Cardano', base: 'ADA', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/2010.png' },
  { sym: 'TONUSDT', name: 'Toncoin', base: 'TON', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png' },
  { sym: 'AVAXUSDT', name: 'Avalanche', base: 'AVAX', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5805.png' },
  { sym: 'DOTUSDT', name: 'Polkadot', base: 'DOT', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/6636.png' },
  { sym: 'LTCUSDT', name: 'Litecoin', base: 'LTC', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/2.png' },
  { sym: 'UNIUSDT', name: 'Uniswap', base: 'UNI', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/7083.png' },
  { sym: 'ATOMUSDT', name: 'Cosmos', base: 'ATOM', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3794.png' },
  { sym: 'APTUSDT', name: 'Aptos', base: 'APT', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/21794.png' },
  { sym: 'ARBUSDT', name: 'Arbitrum', base: 'ARB', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11841.png' },
  { sym: 'OPUSDT', name: 'Optimism', base: 'OP', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11840.png' },
  { sym: 'MATICUSDT', name: 'Polygon', base: 'MATIC', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3890.png' },
  { sym: 'DEXEUSDT', name: 'DeXe', base: 'DEXE', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5916.png' },
  { sym: 'SUIUSDT', name: 'Sui', base: 'SUI', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/20947.png' },
  { sym: 'PEPEUSDT', name: 'Pepe', base: 'PEPE', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/24478.png' },
  { sym: 'LINKUSDT', name: 'Chainlink', base: 'LINK', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1975.png' },
  { sym: 'RENDERUSDT', name: 'Render', base: 'RENDER', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5632.png' },
  { sym: 'JUPUSDT', name: 'Jupiter', base: 'JUP', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/29210.png' },
  { sym: 'WIFUSDT', name: 'dogwifhat', base: 'WIF', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/28752.png' },
  { sym: 'TWTUSDT', name: 'Trust Wallet Token', base: 'TWT', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5227.png' },
  { sym: 'EGLDUSDT', name: 'MultiversX', base: 'EGLD', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/6892.png' },
];
window.COIN_LIST = COIN_LIST;

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
function calculateSMA(closes, period) {
  if (!closes || closes.length < period) return null;
  return closes.slice(-period).reduce((sum, close) => sum + close, 0) / period;
}

function calculateSuperTrend(klines, period = 10, multiplier = 3) {
  if (!klines || klines.length < period + 1) return null;
  let trend = 1, upperBand = 0, lowerBand = 0, value = null;
  for (let i = period; i < klines.length; i++) {
    const atr = calculateATR(klines.slice(0, i + 1), period);
    if (!atr) continue;
    const hl2 = (klines[i].high + klines[i].low) / 2;
    const upper = hl2 + multiplier * atr;
    const lower = hl2 - multiplier * atr;
    if (i === period) {
      upperBand = upper;
      lowerBand = lower;
    } else {
      const prev = klines[i - 1];
      upperBand = upper < upperBand || prev.close > upperBand ? upper : upperBand;
      lowerBand = lower > lowerBand || prev.close < lowerBand ? lower : lowerBand;
    }
    if (trend === 1 && klines[i].close <= lowerBand) trend = -1;
    else if (trend === -1 && klines[i].close >= upperBand) trend = 1;
    value = trend === 1 ? lowerBand : upperBand;
  }
  return value === null ? null : { time: klines[klines.length - 1].time, trend, upper: upperBand, lower: lowerBand, value };
}

function calculateFibonacciLevels(klines, lookback = 100) {
  if (!klines || klines.length < 20) return null;
  const slice = klines.slice(-lookback);
  const highest = Math.max(...slice.map(k => k.high));
  const lowest = Math.min(...slice.map(k => k.low));
  const diff = highest - lowest;
  if (!isFinite(diff) || diff <= 0) return null;
  return {
    level0: lowest,
    level0_236: lowest + diff * 0.236,
    level0_382: lowest + diff * 0.382,
    level0_5: lowest + diff * 0.5,
    level0_618: lowest + diff * 0.618,
    level0_786: lowest + diff * 0.786,
    level1: highest
  };
}

function calculateMomentum(closes, period = 10) {
  if (!closes || closes.length < period + 1) return null;
  const prev = closes[closes.length - 1 - period];
  return prev ? ((closes[closes.length - 1] - prev) / prev) * 100 : null;
}

function formatCoinUsd(value) {
  if (!Number.isFinite(value)) return '-';
  return `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

function renderFibTargetLine(label, value) {
  return `<div style="display:grid; grid-template-columns:64px 1fr; gap:10px; margin-top:4px;">
    <span style="color:var(--brand);">-&gt; ${label}</span>
    <span style="font-family:monospace;">(${formatCoinUsd(value)})</span>
  </div>`;
}

function getVolumeStats(klines, period = 20) {
  if (!klines || klines.length < period) return null;
  const recent = klines.slice(-period);
  const avgVolume = recent.reduce((sum, k) => sum + k.volume, 0) / period;
  const lastVolume = klines[klines.length - 1].volume;
  return avgVolume ? { avgVolume, lastVolume, ratio: lastVolume / avgVolume } : null;
}

function getVolumeAnomaly(klines) {
  const stats = getVolumeStats(klines, 20);
  if (!stats) return null;
  if (stats.ratio > 2) return `Cok yuksek (${stats.ratio.toFixed(1)}x)`;
  if (stats.ratio > 1.5) return `Yuksek (${stats.ratio.toFixed(1)}x)`;
  if (stats.ratio < 0.5) return `Dusuk (${stats.ratio.toFixed(1)}x)`;
  return `Normal (${stats.ratio.toFixed(1)}x)`;
}

function getLastChangePercent(closes) {
  if (!closes || closes.length < 2 || !closes[closes.length - 2]) return 0;
  return ((closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2]) * 100;
}

function checkBBSqueeze(klines, bollinger, volumeRatioMin = 1.5) {
  if (!klines || klines.length < 20 || !bollinger || !bollinger.middle) return false;
  const closes = klines.map(k => k.close);
  const bandwidth = ((bollinger.upper - bollinger.lower) / bollinger.middle) * 100;
  const volumeStats = getVolumeStats(klines, 20);
  return bandwidth > 0 && bandwidth < 20
    && closes[closes.length - 1] > bollinger.middle
    && volumeStats && volumeStats.ratio > volumeRatioMin
    && Math.abs(getLastChangePercent(closes)) < 9.5;
}

function checkEMASqueeze(klines) {
  if (!klines || klines.length < 50) return false;
  const closes = klines.map(k => k.close);
  const ema5 = calculateEMA(closes, 5);
  const ema8 = calculateEMA(closes, 8);
  const ema13 = calculateEMA(closes, 13);
  const ema20 = calculateEMA(closes, 20);
  const volumeStats = getVolumeStats(klines, 20);
  if (!ema5 || !ema8 || !ema13 || !ema20 || !volumeStats) return false;
  const diff5_8 = Math.abs((ema5 - ema8) / ema8) * 100;
  const diff5_13 = Math.abs((ema5 - ema13) / ema13) * 100;
  const diff5_20 = Math.abs((ema5 - ema20) / ema20) * 100;
  return diff5_8 < 3 && diff5_13 < 3 && diff5_20 < 3
    && ema5 > ema8 && ema5 > ema13 && ema5 > ema20
    && closes[closes.length - 1] > ema5
    && volumeStats.ratio > 2
    && Math.abs(getLastChangePercent(closes)) < 9.5;
}

function checkIchimokuGoldenCross(klines) {
  if (!klines || klines.length < 52) return false;
  const highs = klines.map(k => k.high);
  const lows = klines.map(k => k.low);
  const tenkan = (Math.max(...highs.slice(-9)) + Math.min(...lows.slice(-9))) / 2;
  const kijun = (Math.max(...highs.slice(-26)) + Math.min(...lows.slice(-26))) / 2;
  const volumeStats = getVolumeStats(klines, 20);
  const closes = klines.map(k => k.close);
  return tenkan > kijun && volumeStats && volumeStats.ratio > 1.5 && Math.abs(getLastChangePercent(closes)) < 9.5;
}

function calculateMFI(klines, period = 14) {
  if (!klines || klines.length < period + 1) return null;
  let positiveFlow = 0, negativeFlow = 0;
  for (let i = klines.length - period; i < klines.length; i++) {
    const typical = (klines[i].high + klines[i].low + klines[i].close) / 3;
    const previousTypical = (klines[i - 1].high + klines[i - 1].low + klines[i - 1].close) / 3;
    const rawFlow = typical * klines[i].volume;
    if (typical > previousTypical) positiveFlow += rawFlow;
    else if (typical < previousTypical) negativeFlow += rawFlow;
  }
  if (negativeFlow === 0 && positiveFlow === 0) return 50;
  if (negativeFlow === 0) return 100;
  return 100 - (100 / (1 + positiveFlow / negativeFlow));
}

function checkMFI(klines, volumeRatio = 1.5) {
  const mfi = calculateMFI(klines, 14);
  const volumeStats = getVolumeStats(klines, 20);
  const closes = klines?.map(k => k.close);
  return mfi !== null && volumeStats && closes
    && mfi > 50 && volumeStats.ratio > volumeRatio
    && Math.abs(getLastChangePercent(closes)) < 10;
}

function generateAdvancedAIComment(klines, timeframe) {
  if (!klines || klines.length < 50) {
    return {
      items: ["Analiz icin yeterli veri yok (en az 50 mum gerekli)."],
      statusEmoji: "NOTR",
      statusColor: "var(--text-secondary)",
      totalScore: 0,
      signalSummary: "Yeterli veri yok.",
      fibLevels: null,
      supertrendStatus: "YOK"
    };
  }

  const closes = klines.map(k => k.close);
  const volumes = klines.map(k => k.volume);
  const latestPrice = closes[closes.length - 1];
  const items = [];
  const signals = [];
  let totalScore = 0;

  const sma50 = calculateSMA(closes, 50);
  const sma200 = calculateSMA(closes, 200);
  const ema5 = calculateEMA(closes, 5);
  const ema8 = calculateEMA(closes, 8);
  const ema12 = calculateEMA(closes, 12);
  const ema13 = calculateEMA(closes, 13);
  const ema20 = calculateEMA(closes, 20);
  const ema26 = calculateEMA(closes, 26);
  const ema84 = calculateEMA(closes, 84);
  const rsi14 = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const adx = calculateADX(klines, 14);
  const obv = calculateOBV(klines);
  const bollinger = calculateBollinger(closes, 20, 2);
  const atr = calculateATR(klines, 14);
  const supertrend = calculateSuperTrend(klines, 10, 3);
  const fib = calculateFibonacciLevels(klines, 100);
  const momentum = calculateMomentum(closes, 10);

  if (sma50 && sma200) {
    if (sma50 > sma200) { items.push("SMA50 > SMA200: uzun vadeli trend pozitif."); totalScore += 3; signals.push("AL (Uzun Vade)"); }
    else { items.push("SMA50 < SMA200: uzun vadeli trend zayif."); totalScore -= 2; signals.push("SAT (Uzun Vade)"); }
  }
  if (ema12 && ema26) {
    if (ema12 > ema26) { items.push("EMA12 > EMA26: kisa vadeli momentum pozitif."); totalScore += 2; }
    else { items.push("EMA12 < EMA26: kisa vadeli momentum negatif."); totalScore -= 1; }
  }
  if (ema5 && ema8 && ema13 && ema20) {
    const spread = ((Math.max(ema5, ema8, ema13, ema20) - Math.min(ema5, ema8, ema13, ema20)) / Math.min(ema5, ema8, ema13, ema20)) * 100;
    if (spread < 1) items.push(`EMA 5-8-13-20 birbirine cok yakin (%${spread.toFixed(2)}): kirilim izlenmeli.`);
  }
  if (ema84) {
    if (latestPrice > ema84) { items.push("Fiyat EMA84 uzerinde: orta vade destek korunuyor."); totalScore += 1; }
    else { items.push("Fiyat EMA84 altinda: orta vade direnc baskisi var."); totalScore -= 1; }
  }
  if (rsi14) {
    if (rsi14 > 75) { items.push(`RSI asiri alim bolgesinde (${rsi14.toFixed(1)}): geri cekilme riski var.`); totalScore -= 3; signals.push("SAT (RSI)"); }
    else if (rsi14 < 25) { items.push(`RSI asiri satim bolgesinde (${rsi14.toFixed(1)}): tepki potansiyeli var.`); totalScore += 3; signals.push("AL (RSI)"); }
    else if (rsi14 > 55) { items.push(`RSI guclu momentum gosteriyor (${rsi14.toFixed(1)}).`); totalScore += 1; }
    else if (rsi14 < 45) { items.push(`RSI zayif momentum gosteriyor (${rsi14.toFixed(1)}).`); totalScore -= 1; }
    else items.push(`RSI notr bolgede (${rsi14.toFixed(1)}).`);
  }
  if (macd !== null) {
    if (macd > 0) { items.push("MACD pozitif: momentum yukari yonlu."); totalScore += 1; }
    else { items.push("MACD negatif: momentum asagi yonlu."); totalScore -= 1; }
  }
  if (adx !== null) {
    if (adx > 25) { items.push(`ADX guclu trend gosteriyor (${adx.toFixed(1)}).`); totalScore += 1; }
    else if (adx < 20) { items.push(`ADX dusuk (${adx.toFixed(1)}): piyasa yatay/sikismis olabilir.`); totalScore -= 1; }
    else items.push(`ADX orta seviyede (${adx.toFixed(1)}).`);
  }

  const avgVolume = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
  const lastVolume = volumes[volumes.length - 1];
  if (obv !== null && klines.length > 20) {
    const prevOBV = calculateOBV(klines.slice(0, -5));
    if (latestPrice > closes[closes.length - 5] && obv < prevOBV) { items.push("Fiyat yukselirken OBV dusuyor: negatif hacim uyumsuzlugu."); totalScore -= 2; }
    else if (latestPrice < closes[closes.length - 5] && obv > prevOBV) { items.push("Fiyat duserken OBV yukseliyor: pozitif hacim uyumsuzlugu."); totalScore += 2; }
  }
  const volumeStatus = getVolumeAnomaly(klines);
  if (volumeStatus) items.push(`Hacim durumu: ${volumeStatus}.`);
  if (lastVolume > avgVolume * 1.5) { items.push("Son hacim kisa ortalamanin uzerinde."); totalScore += 1; }
  if (volumeStatus?.includes("Cok yuksek")) totalScore += 1;
  else if (volumeStatus?.includes("Dusuk")) totalScore -= 1;

  if (bollinger) {
    const bandwidth = ((bollinger.upper - bollinger.lower) / bollinger.middle) * 100;
    if (latestPrice > bollinger.upper) { items.push("Fiyat ust Bollinger bandinin uzerinde: asiri alim/devam bolgesi."); totalScore -= 1; }
    else if (latestPrice < bollinger.lower) { items.push("Fiyat alt Bollinger bandinin altinda: asiri satim/tepki bolgesi."); totalScore += 1; }
    if (bandwidth < 5) items.push("Bollinger bantlari daraliyor: volatilite kirilimi izlenmeli.");
  }
  if (atr) {
    const atrPercent = (atr / latestPrice) * 100;
    if (atrPercent > 5) items.push(`ATR volatilitesi cok yuksek (%${atrPercent.toFixed(2)}): risk yonetimi onemli.`);
    else if (atrPercent < 1) items.push(`ATR volatilitesi dusuk (%${atrPercent.toFixed(2)}): sakin piyasa.`);
  }

  const divergence = detectRSIDivergence(klines);
  if (divergence === "Boğa" || divergence === "BoÄŸa") { items.push("RSI pozitif uyumsuzluk: trend donusu ihtimali var."); totalScore += 3; signals.push("AL (RSI Uyumsuzluk)"); }
  else if (divergence === "Ayı" || divergence === "AyÄ±") { items.push("RSI negatif uyumsuzluk: dikkatli olunmali."); totalScore -= 3; signals.push("SAT (RSI Uyumsuzluk)"); }

  if (supertrend) {
    if (supertrend.trend === 1) { items.push("SuperTrend AL sinyali aktif."); totalScore += 2; signals.push("AL (SuperTrend)"); }
    else { items.push("SuperTrend SAT sinyali aktif."); totalScore -= 2; signals.push("SAT (SuperTrend)"); }
  }
  if (fib) {
    if (latestPrice >= fib.level0_618 && latestPrice < fib.level0_786) {
      items.push(`Fiyat Fibonacci<br><span style="color:var(--brand);">-&gt;</span> 0.618-0.786 bolgesinde: kritik direnc alani.`);
    } else if (latestPrice >= fib.level0_382 && latestPrice < fib.level0_5) {
      items.push(`Fiyat Fibonacci<br><span style="color:var(--brand);">-&gt;</span> 0.382-0.5 bolgesinde: orta destek/direnc alani.`);
    } else if (latestPrice < fib.level0_236) {
      items.push(`Fiyat Fibonacci<br><span style="color:var(--brand);">-&gt;</span> 0.236 altinda: derin geri cekilme bolgesi.`);
    }
    items.push(`Fibonacci hedefleri:
      ${renderFibTargetLine('0.382', fib.level0_382)}
      ${renderFibTargetLine('0.618', fib.level0_618)}
      ${renderFibTargetLine('1.0', fib.level1)}
    `);
  }
  if (momentum !== null) {
    if (momentum > 5) { items.push(`Momentum guclu pozitif (%${momentum.toFixed(1)}).`); totalScore += 1; }
    else if (momentum < -5) { items.push(`Momentum negatif (%${momentum.toFixed(1)}).`); totalScore -= 1; }
  }

  const bbSqueezeActive = bollinger && checkBBSqueeze(klines, bollinger, 1.5);
  const emaSqueezeActive = checkEMASqueeze(klines);
  const ichimokuActive = checkIchimokuGoldenCross(klines);
  const mfiValue = calculateMFI(klines, 14);
  const mfiActive = checkMFI(klines, 1.5);
  if (bbSqueezeActive) { items.push("TradingView taramasi: Bollinger squeeze aktif, volatilite kirilimi beklenebilir."); totalScore += 2; signals.push("AL (BB Squeeze)"); }
  if (emaSqueezeActive) { items.push("TradingView taramasi: EMA5-8-13-20 sikismasi ve fiyat EMA5 uzerinde."); totalScore += 2; signals.push("AL (EMA Squeeze)"); }
  if (ichimokuActive) { items.push("TradingView taramasi: Ichimoku Tenkan > Kijun, pozitif kesismeyi destekliyor."); totalScore += 2; signals.push("AL (Ichimoku)"); }
  if (mfiActive) { items.push(`MFI(14) ${mfiValue.toFixed(1)} > 50: alim baskisi mevcut.`); totalScore += 1; signals.push("AL (MFI)"); }
  const activeStrategies = [bbSqueezeActive, emaSqueezeActive, ichimokuActive, mfiActive].filter(Boolean).length;
  if (activeStrategies >= 2) { items.push(`Coklu tarama stratejisi aktif (${activeStrategies}/4): al sinyali gucleniyor.`); totalScore += 2; }

  if (fib && latestPrice > fib.level0_618) items.push("AI notu: fiyat kritik Fibonacci bolgesini test ediyor; kirilimda 1.0 seviyesi izlenebilir.");
  else if (fib && latestPrice < fib.level0_236) items.push("AI notu: fiyat derin geri cekilmede; 0.382 tepki hedefi takip edilebilir.");

  let statusEmoji, statusColor;
  if (totalScore >= 6) { statusEmoji = "GUCLU AL"; statusColor = "var(--up)"; }
  else if (totalScore >= 3) { statusEmoji = "AL YONLU"; statusColor = "var(--up)"; }
  else if (totalScore >= 0) { statusEmoji = "NOTR / BEKLE"; statusColor = "var(--brand)"; }
  else if (totalScore >= -3) { statusEmoji = "SAT YONLU"; statusColor = "var(--down)"; }
  else { statusEmoji = "GUCLU SAT"; statusColor = "var(--down)"; }

  const uniqueSignals = [...new Set(signals)];
  return {
    items,
    statusEmoji,
    statusColor,
    totalScore,
    signalSummary: uniqueSignals.length ? `Sinyaller: ${uniqueSignals.join(', ')}` : "Belirgin al/sat sinyali yok.",
    fibLevels: fib,
    supertrendStatus: supertrend?.trend === 1 ? "AL" : (supertrend?.trend === -1 ? "SAT" : "YOK"),
    scanner: { bbSqueeze: !!bbSqueezeActive, emaSqueeze: !!emaSqueezeActive, ichimoku: !!ichimokuActive, mfi: !!mfiActive }
  };
}

window.generateAdvancedAIComment = generateAdvancedAIComment;

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

// İndikatör serileri için global referanslar
let wma50Series = null;
let ema84Series = null;
let isWma50Visible = true;
let isEma84Visible = true;

// ─── 4. COIN DETAY MODALI ─────────────────────────────────────
let currentCoinSymbol = '';
let coinChart = null;
let coinCandleSeries = null;
let coinDetailInterval = null; // Modal güncelleme zamanlayıcısı

window.openCoinDetail = async function(symbol) {
  currentCoinSymbol = symbol;
  const modal = document.getElementById('coinDetailModal');
  if (!modal) return;

  // Zaman aralığını 1 günlük (1d) olarak ayarla
  document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
  const defaultTfBtn = document.querySelector('.tf-btn[data-tf="1d"]');
  if (defaultTfBtn) defaultTfBtn.classList.add('active');

  // Mum sayısını varsayılan 400 yap
  const limitSelect = document.getElementById('candleLimitSelect');
  if (limitSelect) limitSelect.value = '400';

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

  // Her 5 saniyede bir modal içeriğini güncelle
  coinDetailInterval = setInterval(refreshCoinDetailData, 5000);
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
    const { items, statusEmoji, statusColor, signalSummary, supertrendStatus } = generateAdvancedAIComment(klines, selectedTF);
    document.getElementById('coinDetailComment').innerHTML = `
      <div style="margin-bottom:16px; padding:12px; background:rgba(0,0,0,0.15); border-radius:10px; border-left:4px solid ${statusColor};">
        <span style="font-weight:800; color:${statusColor}; font-size:16px;">${statusEmoji}</span>
        <div style="font-size:11px; color:var(--text-secondary); margin-top:6px;">${signalSummary}</div>
        <div style="margin-top:8px;"><span style="background:rgba(255,255,255,0.06); padding:2px 8px; border-radius:12px; font-size:11px; color:var(--text-secondary);">SuperTrend: ${supertrendStatus || 'YOK'}</span></div>
        <span style="font-size:11px; color:var(--text-secondary); margin-left:8px;">• ${selectedTF}'lık analiz</span>
      </div>
      <ul style="margin:0; padding:0; list-style:none;">
        ${items.map(item => `<li style="margin-bottom:8px; display:flex; align-items:baseline; gap:8px; padding:8px; background:rgba(255,255,255,0.02); border-radius:6px;"><span style="color:var(--brand); font-size:12px;">▸</span> <span style="color:var(--text-primary);">${item}</span></li>`).join('')}
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
      rightPriceScale: { 
        borderColor: 'rgba(255,255,255,0.1)',
        textColor: '#0ecb81'
      },
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

    // WMA 50 ve EMA 84 serileri
    try {
      const wma50Data = calculateWMAArray(klines, 50);
      const ema84Data = calculateEMAArray(klines, 84);

      if (wma50Data.length > 0) {
        wma50Series = coinChart.addLineSeries({ color: '#FF9800', lineWidth: 1 });
        wma50Series.setData(wma50Data);
        wma50Series.applyOptions({ visible: isWma50Visible });
      }
      if (ema84Data.length > 0) {
        ema84Series = coinChart.addLineSeries({ color: '#00BCD4', lineWidth: 1 });
        ema84Series.setData(ema84Data);
        ema84Series.applyOptions({ visible: isEma84Visible });
      }
      console.log('✅ WMA 50 ve EMA 84 çizgileri eklendi');
    } catch (e) {
      console.warn('İndikatör çizgileri eklenemedi:', e);
    }

  } catch (e) {
    console.error('❌ Grafik oluşturma hatası:', e);
  }
}

// ─── YENİ: EMA Çizgi Verisi Hesaplayıcı (Grafik için) ───
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
  // Modal kapanınca zamanlayıcıyı temizle
  clearInterval(coinDetailInterval);
  
  document.getElementById('coinDetailModal').style.display = 'none';
  if (coinChart) { coinChart.remove(); coinChart = null; coinCandleSeries = null; }
};

// ─── 6. OTOMATİK LİSTE YENİLEME ──────────────────────────────

window.toggleIndicator = function(ind) {
  const btn = document.getElementById(`${ind}Toggle`);
  let series, isVisible;

  if (ind === 'wma50') {
    series = wma50Series;
    isWma50Visible = !isWma50Visible;
    isVisible = isWma50Visible;
  } else if (ind === 'ema84') {
    series = ema84Series;
    isEma84Visible = !isEma84Visible;
    isVisible = isEma84Visible;
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
