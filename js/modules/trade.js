// js/modules/trade.js - Sanal Alım Satım ve Portföy Yönetimi (Tam Entegre)

const TradeModule = (() => {
    const PORTFOLIO_KEY = 'finansHub_tradePortfolio';
    let currentSymbol = 'BTCUSDT';
    let currentPrice = 0;
    let currentChange = 0;
    let priceRefreshInterval = null;
    let portfolio = {};

    // coin.js'deki COIN_LIST'ten faydalan
    function getCoinList() {
        if (window.COIN_LIST && Array.isArray(window.COIN_LIST)) return window.COIN_LIST;
        // fallback
        return [
            { sym: 'BTCUSDT', name: 'Bitcoin', base: 'BTC' },
            { sym: 'ETHUSDT', name: 'Ethereum', base: 'ETH' },
            { sym: 'BNBUSDT', name: 'BNB', base: 'BNB' },
            { sym: 'SOLUSDT', name: 'Solana', base: 'SOL' },
            { sym: 'DOGEUSDT', name: 'Dogecoin', base: 'DOGE' },
            { sym: 'AVAXUSDT', name: 'Avalanche', base: 'AVAX' }
        ];
    }

    async function fetchPriceAndChange(symbol) {
        try {
            const [tickerRes, changeRes] = await Promise.all([
                fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`),
                fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`)
            ]);
            const priceData = await tickerRes.json();
            const changeData = await changeRes.json();
            return {
                price: parseFloat(priceData.price),
                change: parseFloat(changeData.priceChangePercent)
            };
        } catch(e) {
            console.warn('Fiyat çekme hatası:', e);
            return { price: 0, change: 0 };
        }
    }

    async function updateCurrentPrice() {
        const { price, change } = await fetchPriceAndChange(currentSymbol);
        if (price) {
            currentPrice = price;
            currentChange = change;
            const priceEl = document.getElementById('tradeCurrentPrice');
            const changeEl = document.getElementById('tradePriceChange');
            const costPreview = document.getElementById('tradeCostPreview');
            if (priceEl) priceEl.textContent = `$${price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
            if (changeEl) {
                changeEl.textContent = `${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%`;
                changeEl.style.color = change >= 0 ? 'var(--up)' : 'var(--down)';
            }
            // Miktar girilmişse toplam tutarı güncelle
            const qty = parseFloat(document.getElementById('tradeQuantity')?.value);
            if (!isNaN(qty) && qty > 0 && costPreview) {
                const total = qty * currentPrice;
                costPreview.textContent = `Toplam: $${total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
            } else if (costPreview) {
                costPreview.textContent = `Toplam: $0.00`;
            }
        }
    }

    function loadPortfolio() {
        const stored = localStorage.getItem(PORTFOLIO_KEY);
        portfolio = stored ? JSON.parse(stored) : {};
    }

    function savePortfolio() {
        localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(portfolio));
    }

    async function executeTrade(type, symbol, quantity) {
        if (quantity <= 0) return false;
        const coinKey = symbol.replace('USDT', '');
        const { price } = await fetchPriceAndChange(symbol);
        if (!price) return false;
        const cost = quantity * price;
        
        if (type === 'buy') {
            if (!portfolio[coinKey]) {
                portfolio[coinKey] = { quantity: 0, totalCost: 0 };
            }
            portfolio[coinKey].quantity += quantity;
            portfolio[coinKey].totalCost += cost;
        } else if (type === 'sell') {
            if (!portfolio[coinKey] || portfolio[coinKey].quantity < quantity) return false;
            const avgCost = portfolio[coinKey].totalCost / portfolio[coinKey].quantity;
            portfolio[coinKey].quantity -= quantity;
            portfolio[coinKey].totalCost -= avgCost * quantity;
            if (portfolio[coinKey].quantity <= 0.000001) delete portfolio[coinKey];
        }
        savePortfolio();
        return true;
    }

    function populateCoinSelect() {
        const select = document.getElementById('tradeCoinSelect');
        if (!select) return;
        const coins = getCoinList();
        select.innerHTML = coins.map(coin => `<option value="${coin.sym}">${coin.name} (${coin.sym})</option>`).join('');
        select.onchange = async () => {
            currentSymbol = select.value;
            await updateCurrentPrice();
            // Portföyde bu coine ait bilgi varsa işlem tipini otomatik değiştirebiliriz (isteğe bağlı)
            const qtyInput = document.getElementById('tradeQuantity');
            if (qtyInput) qtyInput.value = '';
            document.getElementById('tradeCostPreview').textContent = 'Toplam: $0.00';
        };
        if (coins.length) {
            currentSymbol = coins[0].sym;
            updateCurrentPrice();
        }
    }

    async function renderPortfolio() {
        const container = document.getElementById('portfolioList');
        const totalValueEl = document.getElementById('totalPortfolioValue');
        const totalPnlEl = document.getElementById('totalPnl');
        if (!container) return;
        
        loadPortfolio();
        let totalValue = 0;
        let totalCost = 0;
        const coins = getCoinList();
        let rows = '';
        
        for (const [coinKey, data] of Object.entries(portfolio)) {
            const coinInfo = coins.find(c => c.base === coinKey);
            const symbol = coinInfo ? coinInfo.sym : `${coinKey}USDT`;
            const { price: currentPrice } = await fetchPriceAndChange(symbol);
            if (!currentPrice) continue;
            const currentValue = data.quantity * currentPrice;
            const avgCost = data.totalCost / data.quantity;
            const pnl = currentValue - data.totalCost;
            const pnlPercent = (pnl / data.totalCost) * 100;
            totalValue += currentValue;
            totalCost += data.totalCost;
            
            rows += `
                <div class="portfolio-item" style="background:#1e2329; border-radius:16px; padding:16px; border:1px solid #2a2f36;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <div><strong style="font-size:16px;">${coinKey}</strong> <span style="font-size:12px; color:var(--text-secondary);">${data.quantity.toFixed(6)} adet</span></div>
                        <div style="font-weight:800; color:${pnl >= 0 ? 'var(--up)' : 'var(--down)'}">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)</div>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:13px; gap:12px; flex-wrap:wrap;">
                        <span>Ort. Maliyet: <strong>$${avgCost.toFixed(4)}</strong></span>
                        <span>Güncel: <strong>$${currentPrice.toFixed(4)}</strong></span>
                        <span>Değer: <strong>$${currentValue.toFixed(2)}</strong></span>
                    </div>
                </div>
            `;
        }
        
        if (rows === '') {
            rows = '<div class="info-message" style="background:#1e2329; border-radius:16px; padding:40px; text-align:center;">📭 Henüz işlem yapılmamış. İşlemler sekmesinden alım yapabilirsiniz.</div>';
        }
        container.innerHTML = rows;
        
        if (totalValueEl) totalValueEl.textContent = `$${totalValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
        const totalPnl = totalValue - totalCost;
        if (totalPnlEl) {
            totalPnlEl.innerHTML = `K/Z: ${totalPnl >= 0 ? '▲' : '▼'} $${Math.abs(totalPnl).toFixed(2)}`;
            totalPnlEl.style.color = totalPnl >= 0 ? 'var(--up)' : 'var(--down)';
        }
    }

    window.submitTrade = async function() {
        const type = document.querySelector('input[name="tradeType"]:checked')?.value;
        const quantity = parseFloat(document.getElementById('tradeQuantity')?.value);
        if (!type || isNaN(quantity) || quantity <= 0) {
            if (window.showToast) window.showToast('❌ Geçerli miktar girin', 'error');
            return;
        }
        const success = await executeTrade(type, currentSymbol, quantity);
        if (success) {
            if (window.showToast) window.showToast(`✅ ${type === 'buy' ? 'Alım' : 'Satım'} işlemi başarılı!`, 'success');
            await renderPortfolio();
            await updateCurrentPrice();
            document.getElementById('tradeQuantity').value = '';
            document.getElementById('tradeCostPreview').textContent = 'Toplam: $0.00';
        } else {
            if (window.showToast) window.showToast('❌ İşlem başarısız (yetersiz bakiye veya hata)', 'error');
        }
    };

    function initTradeUI() {
        populateCoinSelect();
        if (priceRefreshInterval) clearInterval(priceRefreshInterval);
        priceRefreshInterval = setInterval(() => updateCurrentPrice(), 3000);
        const executeBtn = document.getElementById('executeTradeBtn');
        if (executeBtn) executeBtn.onclick = () => window.submitTrade();
        // Miktar değişince toplamı güncelle
        const qtyInput = document.getElementById('tradeQuantity');
        if (qtyInput) {
            qtyInput.oninput = () => {
                const qty = parseFloat(qtyInput.value);
                if (!isNaN(qty) && qty > 0) {
                    const total = qty * currentPrice;
                    const preview = document.getElementById('tradeCostPreview');
                    if (preview) preview.textContent = `Toplam: $${total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
                } else {
                    const preview = document.getElementById('tradeCostPreview');
                    if (preview) preview.textContent = `Toplam: $0.00`;
                }
            };
        }
    }

    async function init() {
        loadPortfolio();
        console.log('Trade modülü başlatıldı');
    }

    return { init, initTradeUI, renderPortfolio };
})();

