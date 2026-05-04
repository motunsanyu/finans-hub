// js/modules/trade.js - Sanal Alım Satım ve Portföy Yönetimi (Binance Pro UI Entegre)

const TradeModule = (() => {
    const PORTFOLIO_KEY = 'finansHub_tradePortfolio';
    let currentSymbol = 'BTCUSDT';
    let currentPrice = 0;
    let currentChange = 0;
    let priceRefreshInterval = null;
    let portfolio = {};
    let tradeMode = 'buy'; // 'buy' or 'sell'

    function getCoinList() {
        if (window.COIN_LIST && Array.isArray(window.COIN_LIST)) return window.COIN_LIST;
        return [
            { sym: 'BTCUSDT', name: 'Bitcoin', base: 'BTC' },
            { sym: 'ETHUSDT', name: 'Ethereum', base: 'ETH' },
            { sym: 'BNBUSDT', name: 'BNB', base: 'BNB' },
            { sym: 'SOLUSDT', name: 'Solana', base: 'SOL' }
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
            if (priceEl) {
                priceEl.textContent = `$${price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
                priceEl.style.color = tradeMode === 'buy' ? 'var(--up)' : 'var(--down)';
            }
            if (changeEl) {
                changeEl.textContent = `${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%`;
                changeEl.style.color = change >= 0 ? 'var(--up)' : 'var(--down)';
            }
            updateCostPreview();
        }
    }

    function updateCostPreview() {
        const inputMode = document.getElementById('tradeInputMode')?.value;
        const val = parseFloat(document.getElementById('tradeQuantity')?.value);
        const preview = document.getElementById('tradeCostPreview');
        const coinBase = currentSymbol.replace('USDT', '');
        
        if (!preview || isNaN(val) || val <= 0 || currentPrice === 0) {
            if (preview) preview.textContent = `Yaklaşık: 0.00 ${inputMode === 'amount' ? 'USDT' : coinBase}`;
            return;
        }

        if (inputMode === 'amount') {
            const total = val * currentPrice;
            preview.textContent = `Yaklaşık: ${total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} USDT`;
        } else {
            const amount = val / currentPrice;
            preview.textContent = `Yaklaşık: ${amount.toFixed(6)} ${coinBase}`;
        }
    }

    function switchMode(mode) {
        tradeMode = mode;
        const btnBuy = document.getElementById('tradeTabBuy');
        const btnSell = document.getElementById('tradeTabSell');
        const execBtn = document.getElementById('executeTradeBtn');
        const priceEl = document.getElementById('tradeCurrentPrice');

        if (mode === 'buy') {
            btnBuy.style.background = 'var(--up)';
            btnBuy.style.color = 'white';
            btnSell.style.background = 'transparent';
            btnSell.style.color = '#848e9c';
            execBtn.style.background = 'var(--up)';
            execBtn.textContent = 'Satın Al';
            if (priceEl) priceEl.style.color = 'var(--up)';
        } else {
            btnBuy.style.background = 'transparent';
            btnBuy.style.color = '#848e9c';
            btnSell.style.background = 'var(--down)';
            btnSell.style.color = 'white';
            execBtn.style.background = 'var(--down)';
            execBtn.textContent = 'Sat';
            if (priceEl) priceEl.style.color = 'var(--down)';
        }
        updateCostPreview();
    }

    function updateInputLabel() {
        const mode = document.getElementById('tradeInputMode').value;
        const label = document.getElementById('tradeUnitLabel');
        const coinBase = currentSymbol.replace('USDT', '');
        if (label) label.textContent = mode === 'amount' ? coinBase : 'USDT';
        updateCostPreview();
    }

    function loadPortfolio() {
        const stored = localStorage.getItem(PORTFOLIO_KEY);
        portfolio = stored ? JSON.parse(stored) : {};
    }

    function savePortfolio() {
        localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(portfolio));
    }

    async function executeTrade() {
        const inputMode = document.getElementById('tradeInputMode').value;
        const inputVal = parseFloat(document.getElementById('tradeQuantity').value);
        if (isNaN(inputVal) || inputVal <= 0) {
            if (window.showToast) window.showToast('❌ Geçerli bir değer girin', 'error');
            return;
        }

        const { price } = await fetchPriceAndChange(currentSymbol);
        if (!price) return;

        let quantity = 0;
        if (inputMode === 'amount') {
            quantity = inputVal;
        } else {
            quantity = inputVal / price;
        }

        const cost = quantity * price;
        const coinKey = currentSymbol.replace('USDT', '');

        if (tradeMode === 'buy') {
            if (!portfolio[coinKey]) portfolio[coinKey] = { quantity: 0, totalCost: 0 };
            portfolio[coinKey].quantity += quantity;
            portfolio[coinKey].totalCost += cost;
        } else {
            if (!portfolio[coinKey] || portfolio[coinKey].quantity < quantity) {
                if (window.showToast) window.showToast('❌ Yetersiz bakiye!', 'error');
                return;
            }
            const avgCost = portfolio[coinKey].totalCost / portfolio[coinKey].quantity;
            portfolio[coinKey].quantity -= quantity;
            portfolio[coinKey].totalCost -= avgCost * quantity;
            if (portfolio[coinKey].quantity <= 0.000001) delete portfolio[coinKey];
        }

        savePortfolio();
        if (window.showToast) window.showToast(`✅ ${tradeMode === 'buy' ? 'Alım' : 'Satım'} başarılı!`, 'success');
        document.getElementById('tradeQuantity').value = '';
        updateCostPreview();
        if (document.getElementById('portfolioSection')?.style.display === 'block') renderPortfolio();
    }

    function populateCoinSelect() {
        const select = document.getElementById('tradeCoinSelect');
        if (!select) return;
        const coins = getCoinList();
        select.innerHTML = coins.map(coin => `<option value="${coin.sym}">${coin.name} (${coin.sym})</option>`).join('');
        select.onchange = () => {
            currentSymbol = select.value;
            updateInputLabel();
            updateCurrentPrice();
        };
        if (coins.length) {
            currentSymbol = coins[0].sym;
            updateInputLabel();
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
            const { price: livePrice } = await fetchPriceAndChange(symbol);
            if (!livePrice) continue;
            
            const currentValue = data.quantity * livePrice;
            const avgCost = data.totalCost / data.quantity;
            const pnl = currentValue - data.totalCost;
            const pnlPercent = (pnl / data.totalCost) * 100;
            
            totalValue += currentValue;
            totalCost += data.totalCost;
            
            rows += `
                <div class="portfolio-item" style="background:#1e2329; border-radius:16px; padding:16px; border:1px solid #2a2f36; margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <div><strong style="font-size:16px; color:white;">${coinKey}</strong> <span style="font-size:12px; color:#848e9c;">${data.quantity.toFixed(6)}</span></div>
                        <div style="font-weight:800; color:${pnl >= 0 ? 'var(--up)' : 'var(--down)'}">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)</div>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:12px; color:#848e9c;">
                        <span>Maliyet: $${avgCost.toFixed(2)}</span>
                        <span>Güncel: $${livePrice.toFixed(2)}</span>
                        <span>Değer: $${currentValue.toFixed(2)}</span>
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = rows || '<div style="text-align:center; padding:40px; color:#848e9c;">Portföyünüz boş.</div>';
        if (totalValueEl) totalValueEl.textContent = `$${totalValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
        const totalPnl = totalValue - totalCost;
        if (totalPnlEl) {
            totalPnlEl.innerHTML = `K/Z: ${totalPnl >= 0 ? '▲' : '▼'} $${Math.abs(totalPnl).toFixed(2)}`;
            totalPnlEl.style.color = totalPnl >= 0 ? 'var(--up)' : 'var(--down)';
        }
    }

    function initTradeUI() {
        populateCoinSelect();
        if (priceRefreshInterval) clearInterval(priceRefreshInterval);
        priceRefreshInterval = setInterval(() => updateCurrentPrice(), 3000);
        
        const executeBtn = document.getElementById('executeTradeBtn');
        if (executeBtn) executeBtn.onclick = () => executeTrade();
        
        const qtyInput = document.getElementById('tradeQuantity');
        if (qtyInput) qtyInput.oninput = () => updateCostPreview();

        switchMode('buy');
    }

    async function init() {
        loadPortfolio();
    }

    return { init, initTradeUI, renderPortfolio, switchMode, updateInputLabel };
})();
