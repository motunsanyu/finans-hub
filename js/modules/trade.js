// js/modules/trade.js - Sanal Alım Satım ve Portföy Yönetimi (Pro İyileştirmeler)

const TradeModule = (() => {
    const PORTFOLIO_KEY = 'finansHub_tradePortfolio';
    const BALANCE_KEY = 'finansHub_tradeBalance';
    
    let currentSymbol = 'BTCUSDT';
    let currentPrice = 0;
    let currentChange = 0;
    let priceRefreshInterval = null;
    let portfolio = {};
    let tradeMode = 'buy'; // 'buy' or 'sell'
    let walletBalance = 1000;

    function getCoinList() {
        if (window.COIN_LIST && Array.isArray(window.COIN_LIST)) return window.COIN_LIST;
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

    function loadData() {
        const storedPort = localStorage.getItem(PORTFOLIO_KEY);
        portfolio = storedPort ? JSON.parse(storedPort) : {};
        const storedBal = localStorage.getItem(BALANCE_KEY);
        walletBalance = storedBal !== null ? parseFloat(storedBal) : 1000;
    }

    function saveData() {
        localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(portfolio));
        localStorage.setItem(BALANCE_KEY, walletBalance.toString());
        updateBalanceUI();
    }

    function updateBalanceUI() {
        const tradeBal = document.getElementById('tradeAvailableBalance');
        const walletBal = document.getElementById('walletCashBalance');
        const label = document.getElementById('tradeAvailableLabel');
        const coinBase = currentSymbol.replace('USDT', '');

        if (tradeMode === 'buy') {
            if (label) label.textContent = 'Cüzdan Bakiyesi:';
            if (tradeBal) tradeBal.textContent = `$${walletBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
        } else {
            const coinQty = portfolio[coinBase]?.quantity || 0;
            if (label) label.textContent = `${coinBase} Bakiyesi:`;
            if (tradeBal) tradeBal.textContent = `${coinQty.toFixed(6)} ${coinBase}`;
        }
        
        if (walletBal) walletBal.textContent = `$${walletBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
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
        
        // Manuel girişte slider'ı güncellemeye çalış
        syncSliderWithInput(val);
    }

    function syncSliderWithInput(val) {
        const inputMode = document.getElementById('tradeInputMode')?.value;
        const slider = document.getElementById('tradePercentSlider');
        if (!slider) return;

        let ratio = 0;
        if (tradeMode === 'buy') {
            const usdtVal = inputMode === 'total' ? val : (val * currentPrice);
            ratio = walletBalance > 0 ? (usdtVal / walletBalance) : 0;
        } else {
            const coinBase = currentSymbol.replace('USDT', '');
            const coinQty = portfolio[coinBase]?.quantity || 0;
            const coinVal = inputMode === 'amount' ? val : (val / currentPrice);
            ratio = coinQty > 0 ? (coinVal / coinQty) : 0;
        }
        
        const percent = Math.min(100, Math.max(0, Math.round(ratio * 100)));
        slider.value = percent;
        updateSliderVisuals(percent);
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
        
        const slider = document.getElementById('tradePercentSlider');
        if (slider) {
            slider.value = 0;
            updateSliderVisuals(0);
        }

        updateBalanceUI();
        updateCostPreview();
    }

    function updateInputLabel() {
        const mode = document.getElementById('tradeInputMode').value;
        const label = document.getElementById('tradeUnitLabel');
        const coinBase = currentSymbol.replace('USDT', '');
        // Varsayılan USDT ise, label coin olmalı (çünkü girdi USDT). 
        // Kullanıcı karışıklığını önlemek için:
        if (label) label.textContent = mode === 'total' ? 'USDT' : coinBase;
        updateCostPreview();
    }

    function onSliderInput(value) {
        const percent = parseInt(value);
        updateSliderVisuals(percent);
        setTradePercent(percent / 100);
    }

    function updateSliderVisuals(percent) {
        const label = document.getElementById('sliderValueLabel');
        if (label) label.textContent = `${percent}%`;

        document.querySelectorAll('.slider-dot').forEach(dot => {
            const dotVal = parseInt(dot.dataset.val);
            if (dotVal <= percent) {
                dot.style.background = 'var(--brand)';
                dot.style.borderColor = 'var(--brand)';
            } else {
                dot.style.background = '#2b3139';
                dot.style.borderColor = '#374151';
            }
        });
    }

    function setTradePercent(ratio) {
        const input = document.getElementById('tradeQuantity');
        const inputMode = document.getElementById('tradeInputMode').value;
        const coinBase = currentSymbol.replace('USDT', '');
        
        if (ratio === 0) {
            input.value = '';
            updateCostPreview();
            return;
        }

        if (tradeMode === 'buy') {
            const targetUSDT = walletBalance * ratio;
            if (inputMode === 'total') {
                input.value = targetUSDT.toFixed(2);
            } else {
                input.value = (targetUSDT / currentPrice).toFixed(6);
            }
        } else {
            const coinQty = portfolio[coinBase]?.quantity || 0;
            const targetQty = coinQty * ratio;
            if (inputMode === 'amount') {
                input.value = targetQty.toFixed(6);
            } else {
                input.value = (targetQty * currentPrice).toFixed(2);
            }
        }
        // slider'ı tekrar sync etmeye gerek yok çünkü slider'dan tetiklendi
        const val = parseFloat(input.value);
        const preview = document.getElementById('tradeCostPreview');
        if (preview && !isNaN(val)) {
            if (inputMode === 'amount') {
                preview.textContent = `Yaklaşık: ${(val * currentPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} USDT`;
            } else {
                preview.textContent = `Yaklaşık: ${(val / currentPrice).toFixed(6)} ${coinBase}`;
            }
        }
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
        let cost = 0;

        if (inputMode === 'amount') {
            quantity = inputVal;
            cost = quantity * price;
        } else {
            cost = inputVal;
            quantity = cost / price;
        }

        const coinKey = currentSymbol.replace('USDT', '');
        let soldOut = false;

        if (tradeMode === 'buy') {
            if (walletBalance < (cost - 0.01)) {
                if (window.showToast) window.showToast('❌ Yetersiz bakiye!', 'error');
                return;
            }
            walletBalance -= cost;
            if (!portfolio[coinKey]) portfolio[coinKey] = { quantity: 0, totalCost: 0 };
            portfolio[coinKey].quantity += quantity;
            portfolio[coinKey].totalCost += cost;
        } else {
            if (!portfolio[coinKey] || portfolio[coinKey].quantity < (quantity - 0.000001)) {
                if (window.showToast) window.showToast('❌ Yetersiz coin bakiyesi!', 'error');
                return;
            }
            walletBalance += cost;
            const avgCost = portfolio[coinKey].totalCost / portfolio[coinKey].quantity;
            portfolio[coinKey].quantity -= quantity;
            portfolio[coinKey].totalCost -= avgCost * quantity;
            
            if (portfolio[coinKey].quantity <= 0.000001) {
                delete portfolio[coinKey];
                soldOut = true;
            }

            // 🏦 KASAYA AKTAR (Vault Integration)
            if (typeof VaultModule !== 'undefined' && VaultModule.addRecord) {
                const usdTryText = document.getElementById('usdTry')?.textContent || "0";
                const usdTryPrice = parseFloat(usdTryText.replace(',', '.')) || 32; // Fallback
                const costTRY = cost * usdTryPrice;
                const today = new Date().toISOString().split('T')[0];
                VaultModule.addRecord('income', `Coin Satışı: ${coinKey}`, costTRY, today);
            }
        }

        saveData();
        if (window.showToast) window.showToast(`✅ ${tradeMode === 'buy' ? 'Alım' : 'Satım'} başarılı!`, 'success');
        
        document.getElementById('tradeQuantity').value = '';
        const slider = document.getElementById('tradePercentSlider');
        if (slider) {
            slider.value = 0;
            updateSliderVisuals(0);
        }
        updateCostPreview();

        // INSTANT UI UPDATE
        if (document.getElementById('portfolioSection')?.style.display === 'block' || document.getElementById('portfolioSection')?.classList.contains('active')) {
            if (soldOut) {
                const itemEl = document.getElementById(`portfolio-item-${coinKey}`);
                if (itemEl) {
                    itemEl.classList.add('exit');
                    setTimeout(() => renderPortfolio(), 400);
                } else {
                    renderPortfolio();
                }
            } else {
                renderPortfolio();
            }
        }
    }

    function addBalance(amount) {
        walletBalance += amount;
        saveData();
        if (window.showToast) window.showToast(`✅ $${amount} bakiye eklendi!`, 'success');
        if (document.getElementById('portfolioSection')?.style.display === 'block') renderPortfolio();
    }

    function resetPortfolio() {
        if (window.showCustomConfirm) {
            window.showCustomConfirm('Tüm portföyünüz ve bakiyeniz sıfırlanacak. Emin misiniz?', () => {
                portfolio = {};
                walletBalance = 1000;
                saveData();
                if (window.showToast) window.showToast('✅ Portföy sıfırlandı, $1000 yüklendi.', 'success');
                if (document.getElementById('portfolioSection')?.style.display === 'block') renderPortfolio();
            });
        } else if (confirm('Tüm portföyünüz ve bakiyeniz sıfırlanacak. Emin misiniz?')) {
            portfolio = {};
            walletBalance = 1000;
            saveData();
            if (document.getElementById('portfolioSection')?.style.display === 'block') renderPortfolio();
        }
    }

    function populateCoinSelect() {
        const select = document.getElementById('tradeCoinSelect');
        if (!select) return;
        const coins = getCoinList();
        select.innerHTML = coins.map(coin => `<option value="${coin.sym}">${coin.base}/USDT</option>`).join('');
        select.onchange = () => {
            currentSymbol = select.value;
            updateInputLabel();
            updateBalanceUI();
            updateCurrentPrice();
        };
        if (coins.length) {
            currentSymbol = coins[0].sym;
            updateInputLabel();
            updateBalanceUI();
            updateCurrentPrice();
        }
    }

    function prepareTrade(symbol, mode) {
        if (window.switchMarketTab) window.switchMarketTab('trade');
        const select = document.getElementById('tradeCoinSelect');
        if (select) {
            select.value = symbol;
            currentSymbol = symbol;
        }
        switchMode(mode);
        updateInputLabel();
        updateBalanceUI();
        updateCurrentPrice();
        document.getElementById('tradeQuantity').value = '';
    }

    async function renderPortfolio() {
        const container = document.getElementById('portfolioList');
        const totalValueEl = document.getElementById('totalPortfolioValue');
        const totalValueTRYEl = document.getElementById('totalPortfolioValueTRY');
        const totalPnlEl = document.getElementById('totalPnl');
        if (!container) return;
        
        loadData();
        updateBalanceUI();

        const portfolioEntries = Object.entries(portfolio);
        if (portfolioEntries.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:40px; color:#848e9c;">Varlığınız bulunmuyor.</div>';
            if (totalValueEl) totalValueEl.textContent = `$${walletBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
            if (totalPnlEl) {
                totalPnlEl.innerHTML = '$0.00 (0.00%)';
                totalPnlEl.style.color = 'var(--text-secondary)';
            }
            return;
        }

        const coins = getCoinList();
        
        // Parallel fetch for all prices
        const pricePromises = portfolioEntries.map(async ([coinKey]) => {
            try {
                const coinInfo = coins.find(c => c.base === coinKey);
                const symbol = coinInfo ? coinInfo.sym : `${coinKey}USDT`;
                const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
                const data = await res.json();
                return { coinKey, price: parseFloat(data.price) || 0 };
            } catch (e) {
                return { coinKey, price: 0 };
            }
        });

        const priceResults = await Promise.all(pricePromises);
        const priceMap = Object.fromEntries(priceResults.map(r => [r.coinKey, r.price]));

        let assetValueUSD = 0;
        let totalCostUSD = 0;
        let rows = '';
        
        for (const [coinKey, data] of portfolioEntries) {
            const livePrice = priceMap[coinKey];
            if (!livePrice) continue;
            
            const currentValue = data.quantity * livePrice;
            const avgCost = data.totalCost / data.quantity;
            const pnl = currentValue - data.totalCost;
            const pnlPercent = (pnl / data.totalCost) * 100;
            
            assetValueUSD += currentValue;
            totalCostUSD += data.totalCost;
            
            const symbol = (coins.find(c => c.base === coinKey))?.sym || `${coinKey}USDT`;
            
            rows += `
                <div class="portfolio-item" id="portfolio-item-${coinKey}" onclick="TradeModule.prepareTrade('${symbol}', 'sell')" style="background:#1e2329; border-radius:16px; padding:16px; border:1px solid #2a2f36; margin-bottom:12px; cursor:pointer;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <div><strong style="font-size:16px; color:white;">${coinKey}/USDT</strong> <span style="font-size:12px; color:#848e9c;">${data.quantity.toFixed(6)}</span></div>
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
        
        container.innerHTML = rows || '<div style="text-align:center; padding:40px; color:#848e9c;">Varlığınız bulunmuyor.</div>';
        const totalWealthUSD = assetValueUSD + walletBalance;
        if (totalValueEl) totalValueEl.textContent = `$${totalWealthUSD.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
        
        const usdTryText = document.getElementById('usdTry')?.textContent || "0";
        const usdTryPrice = parseFloat(usdTryText.replace(',', '.'));
        if (totalValueTRYEl && !isNaN(usdTryPrice)) {
            const wealthTRY = totalWealthUSD * usdTryPrice;
            totalValueTRYEl.textContent = `≈ ${wealthTRY.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`;
        }

        const totalPnl = assetValueUSD - totalCostUSD;
        const totalPnlPercent = totalCostUSD > 0 ? (totalPnl / totalCostUSD) * 100 : 0;
        
        if (totalPnlEl) {
            totalPnlEl.innerHTML = `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)} (${totalPnlPercent.toFixed(2)}%)`;
            totalPnlEl.style.color = totalPnl >= 0 ? 'var(--up)' : 'var(--down)';
        }
    }


    function init() {
        loadData();
    }

    function initTradeUI() {
        populateCoinSelect();
        loadData();
        updateBalanceUI();
        if (priceRefreshInterval) clearInterval(priceRefreshInterval);
        priceRefreshInterval = setInterval(() => updateCurrentPrice(), 3000);
        const executeBtn = document.getElementById('executeTradeBtn');
        if (executeBtn) executeBtn.onclick = () => executeTrade();
        const qtyInput = document.getElementById('tradeQuantity');
        if (qtyInput) qtyInput.oninput = () => updateCostPreview();
        switchMode(tradeMode);
    }

    return { init, initTradeUI, renderPortfolio, switchMode, updateInputLabel, onSliderInput, prepareTrade, addBalance, resetPortfolio };
})();
