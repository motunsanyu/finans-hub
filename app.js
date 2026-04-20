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
    debts: readStorage(STORAGE_KEYS.debts, { usd:0, eur:0, gold:0, btc:0, try:0 }),
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
    
    bindVault();
    bindFuel();
    bindDaysCalculator();
    bindSchoolInstallments();
    bindSuperLig();
    
    refreshFinanceData();
    renderFuelSummary(); renderFuelTable(); renderDayCards(); renderSchool(); renderVault();
    
    // Yakıt fiyatlarını uygulama başında yükle
    setTimeout(() => { if (typeof fetchFuelPrices === 'function') fetchFuelPrices(); }, 1200);
    
    fireAlarmBanner();
  }
  
  // ═════════════════════════ NUMARA MASKELEME ═════════════════════════
  function bindInputMasks() {
      document.querySelectorAll('.num-mask').forEach(inp => {
          inp.addEventListener('input', (e) => {
              let text = e.target.value.replace(/[^0-9,]/g, "");
              if(!text) { e.target.value = ""; return; }
              let parts = text.split(',');
              let intPart = parts[0];
              if(intPart) { intPart = new Intl.NumberFormat('tr-TR').format(parseInt(intPart.replace(/\./g, ''))); }
              e.target.value = parts.length > 1 ? intPart + "," + parts[1].slice(0,2) : intPart;
          });
      });
  }
  function parseVal(str) { return Number(String(str).replace(/\./g, "").replace(",", ".")); }
  
  // ═════════════════════════ ALARM BANNER ═════════════════════════
  function fireAlarmBanner() {
      let urgent = [];
      const todayMillis = new Date().setHours(0,0,0,0);
      
      state.dayRecords.forEach(r => {
          const target = new Date(r.end).setHours(0,0,0,0);
          const d = Math.round((target - todayMillis) / (1000 * 60 * 60 * 24));
          if(d === 0) urgent.push(`⏰ BUGÜN SON GÜN: ${r.title}`);
          else if(d > 0 && d <= 5) urgent.push(`⏰ ${r.title} hedefine sadece ${d} gün kaldı!`);
      });
      state.school.forEach(plan => {
         const u = plan.records.filter(x=>!x.paid).sort((a,b)=>a.dueDate.localeCompare(b.dueDate))[0];
         if(u) {
             const target = new Date(u.dueDate).setHours(0,0,0,0);
             const d = Math.round((target - todayMillis) / (1000 * 60 * 60 * 24));
             if(d === 0) urgent.push(`💳 BUGÜN SON GÜN: ${plan.name} Taksiti (${formatCurrency(u.amount)})`);
             else if(d > 0 && d <= 5) urgent.push(`💳 Kritik Taksit: ${plan.name} (${d} Gün Kaldı)`);
         }
      });
  
      if(urgent.length > 0) {
          const b = document.createElement("div");
          b.style.position="fixed"; b.style.top="10px"; b.style.left="10px"; b.style.right="10px"; b.style.background="linear-gradient(90deg, #b32a2a, #d32f2f)"; 
          b.style.color="#fff"; b.style.padding="16px"; b.style.zIndex="9999"; b.style.borderRadius="12px"; b.style.boxShadow="0 4px 12px rgba(0,0,0,0.5)"; 
          b.style.fontSize="13px"; b.style.fontWeight="700"; b.style.transition="top 0.5s ease-out"; b.style.cursor="pointer";
          b.innerHTML = `<b style="font-size:15px">🚨 FINANS UYARISI</b><br><br>` + urgent.join("<br>");
          b.onclick = () => b.remove();
          document.body.appendChild(b);
          setTimeout(() => { b.style.top="-200px"; setTimeout(()=>b.remove(), 500); }, 6000);
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
  if(!SAVED_PIN) { pinTitle.textContent = "Uygulama İçin Yeni Şifre (PIN) Belirleyin"; pinStage = "setup1";  } else { pinTitle.textContent = "Şifrenizi (PIN) Girin"; }
  function updatePinDots() { for(let i=1; i<=4; i++) { const dot = document.getElementById(`dot${i}`); if(i <= enteredPin.length) dot.classList.add("filled"); else dot.classList.remove("filled"); } }
  window.pressPin = function(num) { if(enteredPin.length < 4) { enteredPin += num; updatePinDots(); } if(enteredPin.length === 4) setTimeout(processPin, 150); };
  window.deletePin = function() { if(enteredPin.length > 0) { enteredPin = enteredPin.slice(0, -1); updatePinDots(); } };
  function processPin() {
      if(pinStage === "setup1") { tempSetupPin = enteredPin; enteredPin = ""; updatePinDots(); pinStage = "setup2"; pinTitle.textContent = "Onaylamak İçin Aynı PIN'i Tekrar Girin"; } 
      else if (pinStage === "setup2") { if(enteredPin === tempSetupPin) { localStorage.setItem(STORAGE_KEYS.appPin, enteredPin); alert("Güvenlik Şifresi Kaydedildi!"); unlockApp(); } else { alert("Şifreler Eşleşmedi. Baştan Alınıyor."); enteredPin = ""; tempSetupPin = ""; updatePinDots(); pinStage = "setup1"; pinTitle.textContent = "Uygulama İçin Yeni Şifre (PIN) Belirleyin"; } } 
      else if (pinStage === "login") { if(enteredPin === SAVED_PIN) unlockApp(); else { alert("Hatalı Şifre!"); enteredPin = ""; updatePinDots(); } }
  }
  function unlockApp() {
      const pinContent = document.getElementById("pinContent");
      const splashLayer = document.getElementById("splashLayer");
      const splashLogo = splashLayer.querySelector(".splash-logo");
      const keypad = document.querySelector(".keypad");
      
      // 1. PIN UI'yı temizle
      if(pinContent) pinContent.style.opacity = "0";
      if(keypad) keypad.style.opacity = "0";
      
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
      if(display) display.textContent = formatCurrency(totalTRY); 
      if(displayUsd) displayUsd.textContent = formatCurrency(totalUSD).replace("₺", "$");

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

      const vgd = document.getElementById("vaultGlobalDebt"); if(vgd) { vgd.textContent = formatCurrency(totalTRY); vgd.style.color = totalTRY < 0 ? "var(--down)" : totalTRY > 0 ? "var(--up)" : "var(--text-primary)"; }
  }
  
  // ═════════════════════════ PİYASALAR API ═════════════════════════
  async function refreshFinanceData() {
    const meta = document.getElementById("financeMeta"); const nextSnapshot = { ...state.financeSnapshot, updatedAt: Date.now() };
    try {
        const bRes = await fetch("https://api.binance.com/api/v3/ticker/24hr");
        if (bRes.ok) {
            const data = await bRes.json(); const p = {}; data.forEach(i => p[i.symbol] = { p: Number(i.lastPrice), c: Number(i.priceChangePercent) });
            if(p['BTCUSDT']) { nextSnapshot.btcUsd = { price: p['BTCUSDT'].p, change: p['BTCUSDT'].c }; }
            if(p['ETHUSDT']) { nextSnapshot.ethUsd = { price: p['ETHUSDT'].p, change: p['ETHUSDT'].c }; }
            if(p['BNBUSDT']) { nextSnapshot.bnbUsd = { price: p['BNBUSDT'].p, change: p['BNBUSDT'].c }; }
            if(p['XRPUSDT']) { nextSnapshot.xrpUsd = { price: p['XRPUSDT'].p, change: p['XRPUSDT'].c }; }
            if(p['USDTTRY']) { nextSnapshot.usdTry = { price: p['USDTTRY'].p, change: p['USDTTRY'].c }; }
            if(p['EURUSDT'] && p['USDTTRY']) { nextSnapshot.eurTry = { price: p['EURUSDT'].p * p['USDTTRY'].p, change: p['EURUSDT'].c }; }
            if(p['EURTRY']) nextSnapshot.eurTry = { price: p['EURTRY'].p, change: p['EURTRY'].c };
            if(p['PAXGUSDT'] && p['USDTTRY']) { const gramTry = (p['PAXGUSDT'].p * p['USDTTRY'].p) / 31.1034768; nextSnapshot.goldTry = { price: gramTry, change: p['PAXGUSDT'].c }; }
        }
    } catch(e) { console.warn("Binance Hatasi", e); }
    if (!nextSnapshot.goldTry) { try { const tRes = await fetch("https://finans.truncgil.com/v3/today.json"); if(tRes.ok) { const t = await tRes.json(); if(t['gram-altin']) { nextSnapshot.goldTry = { price: parseFlexibleNumber(t['gram-altin'].Selling), change: parseFlexibleNumber(t['gram-altin'].Change) }; } } } catch(e) { } }
    state.financeSnapshot = nextSnapshot; writeStorage(STORAGE_KEYS.financeSnapshot, nextSnapshot);
    paintFinanceRow("usdTry", nextSnapshot.usdTry, 4); paintFinanceRow("eurTry", nextSnapshot.eurTry, 4); paintFinanceRow("btcUsd", nextSnapshot.btcUsd, 2, "$"); paintFinanceRow("ethUsd", nextSnapshot.ethUsd, 2, "$"); paintFinanceRow("bnbUsd", nextSnapshot.bnbUsd, 2, "$"); paintFinanceRow("xrpUsd", nextSnapshot.xrpUsd, 4, "$"); paintFinanceRow("goldTry", nextSnapshot.goldTry, 2);
    calcTotalDebt(); 
    const dateStr = new Date(nextSnapshot.updatedAt).toLocaleDateString("tr-TR"); const timeStr = new Date(nextSnapshot.updatedAt).toLocaleTimeString("tr-TR", {hour: '2-digit', minute:'2-digit'}); meta.innerHTML = `Son Güncelleme : ${dateStr} - ${timeStr}`;
  }
  function parseFlexibleNumber(input) { if(!input) return Number.NaN; const raw = String(input).trim().replace(/\s/g, "").replace("%",""); if (!raw) return Number.NaN; if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(raw)) return Number(raw.replace(/\./g, "").replace(",", ".")); return Number(raw.replace(",", ".").replace(/[^0-9.-]/g, "")); }
  function paintFinanceRow(id, obj, decimals, prefix="") {
      if(!obj) return; const priceEl = document.getElementById(id); const chgEl = document.getElementById(id+"Chg");
      if(priceEl) priceEl.textContent = prefix + formatNumber(obj.price, decimals);
      if(chgEl && typeof obj.change === "number") { const c = obj.change; let sign = c > 0 ? "+" : c < 0 ? "" : ""; chgEl.textContent = `${sign}%${Math.abs(c).toFixed(2)}`; chgEl.className = `pill ${c > 0 ? "up" : c < 0 ? "down" : "neutral"}`; }
  }
  
  // ═════════════════════════ KASA / VAULT ═════════════════════════
  function updateVaultSmartSelector() {
      const sel = document.getElementById("vaultSmartSelect");
      if(!sel) return;
      sel.innerHTML = '<option value="">-- El İle (Manuel) Kendim Gireceğim --</option>';
      state.school.forEach(plan => {
          const unpaidRows = plan.records.filter(r => !r.paid).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
          if (unpaidRows.length > 0) {
              const nextPay = unpaidRows[0];
              const alreadyInVault = state.vaultRecords.some(vr => vr.linkedRecId === nextPay.id);
              if (!alreadyInVault) {
                  const opt = document.createElement("option");
                  opt.value = JSON.stringify({ name: plan.name, amount: nextPay.amount, date: nextPay.dueDate, linkedRecId: nextPay.id });
                  opt.textContent = `[Bekleyen] ${plan.name} (${formatCurrency(nextPay.amount)})`;
                  sel.appendChild(opt);
              }
          }
      });
  }

  function bindVault() {
      const smartSel = document.getElementById("vaultSmartSelect");
      if(smartSel) {
          smartSel.addEventListener("change", (e) => {
              if(e.target.value) {
                  const data = JSON.parse(e.target.value);
                  document.getElementById("vaultTitle").value = "Taksit: " + data.name;
                  document.getElementById("vaultAmountInput").value = new Intl.NumberFormat('tr-TR').format(data.amount);
                  document.getElementById("vaultType").value = "expense";
                  document.getElementById("vaultDate").value = data.date;
                  smartSel.dataset.pendingLinkedRecId = data.linkedRecId;
              } else {
                  document.getElementById("vaultTitle").value = "";
                  document.getElementById("vaultAmountInput").value = "";
                  document.getElementById("vaultDate").value = "";
                  smartSel.dataset.pendingLinkedRecId = "";
              }
          });
      }

      const f = document.getElementById("vaultForm");
      if(f) {
          f.addEventListener("submit", (e) => {
              e.preventDefault();
              const date = document.getElementById("vaultDate").value; 
              const title = document.getElementById("vaultTitle").value; 
              const amount = parseVal(document.getElementById("vaultAmountInput").value); 
              const type = document.getElementById("vaultType").value;
              const linkedRecId = smartSel ? smartSel.dataset.pendingLinkedRecId : "";

              if(!date || !title || amount<=0) return;
              state.vaultRecords.push({ id: crypto.randomUUID(), date, title, amount, type, linkedRecId });
              writeStorage(STORAGE_KEYS.vault, state.vaultRecords); 
              
              f.reset(); document.getElementById("newVaultDetails").removeAttribute("open");
              if (smartSel) { smartSel.value = ""; smartSel.dataset.pendingLinkedRecId = ""; }
              
              updateVaultSmartSelector();
              renderVault(); 
          });
      }
  
      document.getElementById("vaultListContainer").addEventListener("click", (e) => {
          if(e.target.classList.contains("vault-del-btn") && confirm("Kasa kaydı silinsin mi?")) { 
              state.vaultRecords = state.vaultRecords.filter(r => r.id !== e.target.dataset.id); 
              writeStorage(STORAGE_KEYS.vault, state.vaultRecords); 
              renderVault(); updateVaultSmartSelector(); 
          }
      });
      document.getElementById("clearAllVaultBtn").addEventListener("click", () => {
           if(confirm("Tüm kasa dökümü SİLİNECEK. Emin misiniz?")) { state.vaultRecords = []; writeStorage(STORAGE_KEYS.vault, state.vaultRecords); renderVault(); updateVaultSmartSelector(); }
      });
  }
  
  function renderVault() {
      let income = 0; let expense = 0; 
      const container = document.getElementById("vaultListContainer"); 
      if(!container) return; container.innerHTML = "";
      
      const groups = {};
      const monthsTr = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
      
      [...state.vaultRecords].sort((a,b) => new Date(b.date)-new Date(a.date)).forEach(r => {
          if(r.type === "income") income += Number(r.amount); else expense += Number(r.amount);
          
          const d = new Date(r.date);
          const gKey = monthsTr[d.getMonth()] + " " + d.getFullYear();
          if(!groups[gKey]) groups[gKey] = { income: 0, expense: 0, recs: [] };
          groups[gKey].recs.push(r);
          if(r.type === "income") groups[gKey].income += Number(r.amount); else groups[gKey].expense += Number(r.amount);
      });
      
      for(const [gName, data] of Object.entries(groups)) {
          const netGroup = data.income - data.expense;
          const det = document.createElement("details");
          det.className = "panel"; det.style.padding = "0"; det.style.overflow = "hidden"; det.style.marginBottom = "16px"; det.style.border = "1px solid rgba(255,255,255,0.05)";
          
          let tbodyHtml = "";
          data.recs.forEach(r => {
              const isInc = r.type==="income";
              tbodyHtml += `<tr>
                 <td style="font-size:10px;">${formatDateShortYY(r.date)}</td>
                 <td style="font-size:12px; word-break:break-word;"><b>${r.title}</b></td>
                 <td style="font-size:11px; text-align:right; font-weight:800; font-family:'Space Grotesk', monospace; color:${isInc ? 'var(--up)' : 'var(--text-primary)'}">${isInc ? '+' : '-'}${formatNumber(r.amount, 0)}</td>
                 <td style="text-align:right; width:20px; padding:8px 0;"><button type="button" class="btn danger-btn vault-del-btn" data-id="${r.id}" style="padding:4px; font-size:10px;">X</button></td>
              </tr>`;
          });
  
          det.innerHTML = `
            <summary style="padding:16px; font-weight:800; display:flex; justify-content:space-between; cursor:pointer; outline:none; background:rgba(0,0,0,0.2); list-style:none;">
               <span>📁 ${gName}</span>
               <span style="color:${netGroup < 0 ? 'var(--down)' : 'var(--up)'}">${netGroup < 0 ? '' : '+'}${formatCurrency(netGroup)}</span>
            </summary>
            <div class="table-wrap" style="border:none; border-radius:0; margin:0;"><table id="vaultTable"><tbody>${tbodyHtml}</tbody></table></div>`;
          container.appendChild(det);
      }
  
      const net = income - expense; const netEl = document.getElementById("vaultNetBalance");
      if(netEl) { netEl.textContent = formatCurrency(net); netEl.style.color = net < 0 ? "var(--down)" : "var(--up)"; }
  }

  // ═════════════════════════ YAKIT SİSTEMİ ═════════════════════════
  function calcSimYakit() {
      const km = sum([...state.fuelRecords], "km"); const amt = sum([...state.fuelRecords], "amount");
      const costPerKm = km > 0 ? (amt / km) : 0;
      let targetKm = Number(document.getElementById("simKm").value) || 0;
      if (document.getElementById("simReturn").checked) targetKm *= 2;
      document.getElementById("simResult").textContent = formatCurrency(targetKm * costPerKm);
  }

  function bindFuel() {
    const simKmInput = document.getElementById("simKm"); const simReturnChk = document.getElementById("simReturn");
    if(simKmInput) simKmInput.addEventListener("input", calcSimYakit);
    if(simReturnChk) simReturnChk.addEventListener("change", calcSimYakit);

    const form = document.getElementById("fuelForm");
    if(form) {
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            const date = document.getElementById("fuelDate").value; const amount = Number(document.getElementById("fuelAmount").value); const km = Number(document.getElementById("fuelKm").value); const price = Number(document.getElementById("fuelPrice").value);
            if (!date || amount <= 0 || km <= 0 || price <= 0) return;
            state.fuelRecords.push({ id: crypto.randomUUID(), date, amount, km, price, liters: amount/price, costPer100: (amount/km)*100, litersPer100: ((amount/price)/km)*100 });
            writeStorage(STORAGE_KEYS.fuel, state.fuelRecords); renderFuelSummary(); renderFuelTable(); form.reset(); document.getElementById("newFuelDetails").removeAttribute("open");
        });
    }
    
    document.getElementById("fuelTable").addEventListener("click", (e) => {
        if(e.target.classList.contains('fuel-del-btn')) { if(confirm('Kayıt silinsin mi?')) { state.fuelRecords = state.fuelRecords.filter(r => r.id !== e.target.dataset.id); writeStorage(STORAGE_KEYS.fuel, state.fuelRecords); renderFuelTable(); renderFuelSummary(); } }
    });
    document.getElementById("clearAllFuelBtn").addEventListener("click", () => {
         if(confirm('Tüm yakıt dökümü silinecek. Arşiv gidiyor. Onaylıyor musun?')) { state.fuelRecords = []; writeStorage(STORAGE_KEYS.fuel, state.fuelRecords); renderFuelTable(); renderFuelSummary(); }
    });
  }
  
  function renderFuelSummary() {
    const km = sum([...state.fuelRecords], "km"); const amt = sum([...state.fuelRecords], "amount"); const lt = sum([...state.fuelRecords], "liters");
    document.getElementById("sumAmount").innerHTML = `${formatNumber(amt, 0)} <span style="font-size:12px; font-weight:400;">TL</span>`;
    document.getElementById("sumKm").innerHTML = `${formatNumber(km, 1)} <span style="font-size:12px; font-weight:400;">KM</span>`;
    document.getElementById("sumLiters").innerHTML = `${formatNumber(lt, 1)} <span style="font-size:12px; font-weight:400;">L</span>`;
    setText("avgCost100", formatCurrency(km>0 ? (amt/km)*100 : 0)); 
    document.getElementById("avgLt100").innerHTML = `${formatNumber(km>0 ? (lt/km)*100 : 0, 2)} <span style="font-size:12px; font-weight:400;">L</span>`;
    calcSimYakit();
  }
  
  function renderFuelTable() {
    const tbody = document.querySelector("#fuelTable tbody"); if(!tbody) return; tbody.innerHTML = "";
    [...state.fuelRecords].sort((a,b) => new Date(b.date)-new Date(a.date)).forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-size:10px;">${formatDateShortYY(r.date)}</td>
        <td style="font-size:11px;"><b>${formatCurrency(r.amount,0,"0")}</b></td>
        <td style="font-size:10px;">${formatNumber(r.km, 0)}</td>
        <td style="font-size:10px;">${formatCurrency(r.price, 2)}</td>
        <td style="font-size:11px; font-weight:800;">${formatCurrency(r.amount / r.km, 2)}</td>
        <td style="text-align:right; padding:8px 0; width:15px;"><button class="btn danger-btn fuel-del-btn" data-id="${r.id}" style="padding:4px; font-size:10px; line-height:1;">X</button></td>
      `;
      tbody.appendChild(tr);
    });
  }
  
  // ═════════════════════════ GÜN HESAPLAYICISI ═════════════════════════
  function bindDaysCalculator() {
    // 24 saat kuralı: Süresi dolan sayaçları 1 gün sonra otomatik temizle
    const nowMillis = new Date().setHours(0,0,0,0);
    const oneDay = 24 * 60 * 60 * 1000;
    const initialCount = state.dayRecords.length;
    
    state.dayRecords = state.dayRecords.filter(r => {
        const target = new Date(r.end).setHours(0,0,0,0);
        return (target + oneDay) > nowMillis;
    });
    
    if(state.dayRecords.length !== initialCount) writeStorage(STORAGE_KEYS.days, state.dayRecords);

    document.getElementById("daysForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const en = document.getElementById("endDate").value, ti = document.getElementById("daysTitle").value;
      if (!en || !ti) return;
      state.dayRecords.push({ id: crypto.randomUUID(), title:ti, end:en, created: Date.now() });
      writeStorage(STORAGE_KEYS.days, state.dayRecords); renderDayCards(); document.getElementById("daysForm").reset();
      const det = document.getElementById("newDayDetails"); if(det) det.removeAttribute("open");
    });
    document.getElementById("daysCards").addEventListener("click", (e) => {
      if(e.target.classList.contains('btn-del-day') && confirm('Sayaç silinsin mi?')) {
          state.dayRecords = state.dayRecords.filter(r => r.id !== e.target.dataset.id);
          writeStorage(STORAGE_KEYS.days, state.dayRecords); renderDayCards();
      }
    });
  }
  
  function renderDayCards() {
    const container = document.getElementById("daysCards"); container.innerHTML = "";
    
    const todayMillis = new Date().setHours(0,0,0,0);
    const activeRecords = state.dayRecords.map(r => {
        const target = new Date(r.end).setHours(0,0,0,0);
        const days = Math.round((target - todayMillis) / (1000 * 60 * 60 * 24));
        return { ...r, days };
    }).sort((a,b) => a.days - b.days);
  
    activeRecords.forEach((r) => {
      const isPast = r.days < 0; 
      const isZero = r.days === 0;
      
      let daysText = "";
      if (isPast) daysText = Math.abs(r.days) + " Gün Geçti";
      else if (isZero) daysText = "Bugün Bitiyor!";
      else daysText = r.days + " Gün Kaldı";
      
      let color = "var(--brand)";
      if (isPast) color = "var(--down)";
      else if (isZero) color = "rgba(252,213,53,1)";
      else if (r.days > 0 && r.days <= 3) color = "#ff9800";
      else if (r.days > 3 && r.days <= 5) color = "var(--up)";
      
      // İlerleme hesaplama: Kaydedildiği günden hedefe kadar ne kadar yol alındı
      let createdDate = r.created ? new Date(r.created).setHours(0,0,0,0) : null;
      let targetMillis = new Date(r.end).setHours(0,0,0,0);
      if (isNaN(targetMillis)) targetMillis = todayMillis + (r.days * 86400000); // Fallback for invalid dates
      
      if (!createdDate || isNaN(createdDate)) {
          // Eski kayıtlarda barın boş görünmemesi için hedef sürenin en az iki katı eski olduğunu varsay
          createdDate = targetMillis - (Math.max(14, r.days * 2) * 86400000); 
      }
      
      const totalSpan = Math.max(1, Math.round((targetMillis - createdDate) / 86400000));
      const elapsed = totalSpan - Math.max(0, r.days);
      const rawPct = isPast ? 100 : Math.min(100, Math.max(0, Math.round((elapsed / totalSpan) * 100)));
      const displayPct = Math.max(5, rawPct); // En az %5 dolu görünsün
      const barColorValue = isPast ? '#ff3b3b' : r.days <= 3 ? '#ff9800' : r.days <= 5 ? '#00e676' : '#fcd535';
      
      const c = document.createElement("div"); c.className = "panel"; c.style.marginBottom="12px"; c.style.padding="16px"; c.style.borderLeft = `4px solid ${color}`;
      c.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;"><div><div style="font-size:15px; font-weight:800; color:var(--text-primary);">${r.title}</div><div style="font-size:12px; color:var(--text-secondary);">Hedef: ${formatDate(r.end)}</div></div><div style="text-align:right;"><div style="color:${color}; font-size:16px; font-weight:800;">${daysText}</div><button class="badge unpaid btn-del-day" data-id="${r.id}" style="margin-top:4px;">Sil</button></div></div>
      <div style="height:6px; background:rgba(255,255,255,0.1); border-radius:3px; overflow:hidden;"><div style="height:100%; width:${displayPct}%; background:${barColorValue}; border-radius:3px; transition:width 0.5s ease-in-out;"></div></div>`;
      container.appendChild(c);
    });
  }
  
  // ═════════════════════════ TAKSİT YÖNETİMİ ═════════════════════════
  function bindSchoolInstallments() {
      const unevenToggle = document.getElementById("schoolUnevenToggle");
      const unevenWrap = document.getElementById("schoolUnevenWrap");
      if(unevenToggle) { 
        unevenToggle.addEventListener("change", (e) => { 
          unevenWrap.style.display = e.target.checked ? "flex" : "none"; 
          // Required alanları toggle et (bug fix)
          document.getElementById("unevenNo").required = e.target.checked; 
          document.getElementById("unevenAmount").required = e.target.checked; 
          // Checkbox kapatılınca alanları temizle
          if(!e.target.checked) {
            document.getElementById("unevenNo").value = '';
            document.getElementById("unevenAmount").value = '';
          }
        }); 
      }
  
      const f = document.getElementById("newSchoolForm");
      if(f) {
          f.addEventListener("submit", (e) => {
              e.preventDefault(); 
              const n = document.getElementById("schoolChildName").value.trim(); 
              const d = parseVal(document.getElementById("schoolTotalDebt").value); 
              const ct = Number(document.getElementById("schoolInstCount").value); 
              const fd = document.getElementById("schoolFirstDate").value;
              
              if (!n || d<=0 || ct <= 1 || !fd) return alert("Hatalı giriş! Tüm alanları doldurun ve vade birden büyük olmalıdır.");

              const hasUneven = unevenToggle.checked; 
              let unevenNos = []; // Birden fazla farklı taksit desteği (5/6/7)
              let uAmt = 0;
              
              if(hasUneven) {
                  const uNoRaw = document.getElementById("unevenNo").value.trim();
                  uAmt = parseVal(document.getElementById("unevenAmount").value);
                  
                  if(!uNoRaw || uAmt <= 0) return alert("Farklı taksit numarası ve tutarı girilmelidir!");
                  
                  // 5/6/7 veya sadece 5 formatini destekle
                  unevenNos = uNoRaw.split('/').map(s => Number(s.trim())).filter(n => n > 0);
                  
                  for(const num of unevenNos) {
                    if (num < 1 || num > ct) return alert(`Farklı taksit numarası (${num}) 1 ile ${ct} arasında olmalıdır!`);
                  }
                  
                  const totalUneven = uAmt * unevenNos.length;
                  if (totalUneven >= d) return alert(`Farklı taksitlerin toplamı (₺${totalUneven}), toplam borca (₺${d}) eşit veya fazla olamaz!`);
              }
              
              // Normal taksit tutarını hesapla
              const normalCount = ct - unevenNos.length;
              const totalUnevenAmount = uAmt * unevenNos.length;
              const am = normalCount > 0 ? (d - totalUnevenAmount) / normalCount : d / ct;
              
              let [y, m, day] = fd.split('-').map(Number); 
              let todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);
              const newPlan = { id: crypto.randomUUID(), name: n, totalDebt: d, records: [] };
              
              for(let i=0; i<ct; i++) {
                  let iD = new Date(y, m-1+i, 1); 
                  iD.setDate(Math.min(day, new Date(iD.getFullYear(), iD.getMonth()+1, 0).getDate()));
                  let oy=iD.getFullYear(), om=String(iD.getMonth()+1).padStart(2,'0'), od=String(iD.getDate()).padStart(2,'0'); 
                  let isPast = iD.getTime() < todayMidnight.getTime();
                  let thisAm = unevenNos.includes(i+1) ? uAmt : am;
                  newPlan.records.push({ id: crypto.randomUUID(), no: i+1, dueDate: `${oy}-${om}-${od}`, amount: thisAm, paid: isPast });
              }
              
              state.school.push(newPlan); writeStorage(STORAGE_KEYS.school, state.school); renderSchool(); f.reset();
              if(unevenToggle) { unevenToggle.checked = false; unevenWrap.style.display = "none"; }
              const det = document.getElementById("newSchoolDetails"); if (det) det.removeAttribute("open");
          });
      }
  
      document.getElementById('schoolPlansContainer').addEventListener('click', (e) => {
          if (e.target.classList.contains('btn-toggle-school')) {
              const plan = state.school.find(p => p.id === e.target.dataset.planId);
              if(plan) { const r = plan.records.find(i => i.id === e.target.dataset.recId); if (r) { r.paid = !r.paid; writeStorage(STORAGE_KEYS.school, state.school); renderSchool(); } }
          }
          if (e.target.classList.contains('delete-plan-btn') && confirm('Bu kişi profilini ve tüm taksitlerini SİLMEK istediğinize emin misiniz?')) {
              state.school = state.school.filter(p => p.id !== e.target.dataset.id); writeStorage(STORAGE_KEYS.school, state.school); renderSchool();
          }
      });
  }
  
  function renderSchool() {
    let grandDebt = 0; let maxInst = 0; const container = document.getElementById("schoolPlansContainer"); if (!container) return; container.innerHTML = "";
    // OTOMATİK TEMİZLİK: Tüm taksitleri ödenmiş ve son vade geçmiş planları sil
    const todayMs = new Date().setHours(0,0,0,0);
    const beforeCount = state.school.length;
    
    let stateChanged = false;
    state.school.forEach(plan => {
      plan.records.forEach(r => {
         if (!r.paid) {
            const dueDateObj = new Date(r.dueDate);
            dueDateObj.setHours(0,0,0,0);
            if (dueDateObj.getTime() < todayMs) {
               r.paid = true;
               stateChanged = true;
            }
         }
      });
    });

    state.school = state.school.filter(plan => {
      const allPaid = plan.records.every(r => r.paid);
      if (!allPaid) return true;
      const lastDue = Math.max(...plan.records.map(r => new Date(r.dueDate).getTime()));
      const dayAfterLast = lastDue + 86400000;
      return todayMs < dayAfterLast;
    });
    if (stateChanged || state.school.length !== beforeCount) writeStorage(STORAGE_KEYS.school, state.school);
    
    state.school.forEach(plan => {
      const unpaidRows = plan.records.filter(r=>!r.paid); 
      const childDebt = unpaidRows.reduce((a,r)=>a+Number(r.amount),0); 
      const totalDebt = plan.totalDebt || plan.records.reduce((a,r)=>a+Number(r.amount),0);
      const paidCount = plan.records.filter(r=>r.paid).length;
      const progressPct = plan.records.length > 0 ? Math.round((paidCount / plan.records.length) * 100) : 0;
      grandDebt += childDebt; 
      maxInst = Math.max(maxInst, unpaidRows.length);
      const article = document.createElement("details"); article.className = "panel"; article.style.marginBottom = "24px"; article.style.padding = "0"; article.style.overflow = "hidden"; article.style.border = "1px solid var(--line)";
      
      let tbodyHtml = "";
      [...plan.records].sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).forEach(r => {
        tbodyHtml += `<tr>
            <td style="color:var(--text-secondary);">${r.no}</td>
            <td><span style="font-size:12px; color:var(--text-secondary);">Vade: ${formatDateShortYY(r.dueDate)}</span><br><b>${formatCurrency(r.amount)}</b></td>
            <td style="text-align:center;">${r.paid ? `<button class="badge paid btn-toggle-school" data-plan-id="${plan.id}" data-rec-id="${r.id}">ÖDENDİ</button>` : `<button class="badge unpaid btn-toggle-school" data-plan-id="${plan.id}" data-rec-id="${r.id}">BEKLİYOR</button>`}</td>
          </tr>`;
      });
  
      article.innerHTML = `<summary style="padding:16px; cursor:pointer; list-style:none; outline:none; display:block;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;"><h3 style="font-size:16px; margin-right:8px; word-break:break-word;">${plan.name}</h3><div style="text-align:right;"><div style="font-size:10px; color:var(--text-secondary); margin-bottom:2px;">Toplam: <span style="color:var(--brand)">${formatCurrency(totalDebt)}</span></div><div style="font-size:10px; color:var(--text-secondary); margin-bottom:4px;">Kalan Borç</div><div style="color:var(--text-primary); font-size:17px; font-weight:800; font-family:'Space Grotesk', monospace;">${formatCurrency(childDebt)}</div></div></div>
            <div style="height:4px; background:rgba(255,255,255,0.05); border-radius:2px; margin-bottom:10px; overflow:hidden;"><div style="height:100%; width:${progressPct}%; background:var(--up); border-radius:2px; transition:width 0.5s;"></div></div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--text-secondary); border-top:1px solid rgba(255,255,255,0.05); padding-top:10px;"><span>Kalan: <strong style="color:var(--text-primary)">${unpaidRows.length} Taksit</strong></span><span style="color:var(--brand); display:flex; align-items:center; gap:4px; font-weight:800;">Liste / Yönet 🔽</span></div></summary>
        <div style="border-top:1px solid var(--line); background: var(--bg-hover);"><div style="padding:12px 16px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size:12px; color:var(--text-secondary);">Taksit Listesi</span><button class="btn danger-btn delete-plan-btn" data-id="${plan.id}" style="padding:4px 10px; font-size:11px;">Tüm Planı Sil</button></div><div class="table-wrap" style="margin:0; border:none; border-radius:0;"><table class="school-table" style="background:var(--bg-primary);"><thead><tr><th>No</th><th>Tutar</th><th style="text-align:center;">Durum</th></tr></thead><tbody>${tbodyHtml}</tbody></table></div></div>`;
      container.appendChild(article);
    });
  
    setText("grandSchoolDebt", formatCurrency(grandDebt)); setText("grandSchoolInstallment", maxInst);
    const vInst = document.getElementById("vaultInstDebt"); if (vInst) vInst.textContent = formatCurrency(grandDebt);
    updateVaultSmartSelector();
  }

  // ═════════════════════════════════════════════════════════════════
  // SÜPER LİG MODÜLÜ — ESPN gizli JSON API
  // Kayıt yok, API key yok, CORS açık, tamamen ücretsiz
  // Kaynak: site.api.espn.com — TUR.1 (Süper Lig kodu)
  // ═════════════════════════════════════════════════════════════════

  // Takıma göre renk rozeti
  const TEAM_COLORS = {
    "Galatasaray":   "#fcd535",
    "Fenerbahçe":    "#1a9c3e",
    "Fenerbahce":    "#1a9c3e",
    "Beşiktaş":      "#cccccc",
    "Besiktas":      "#cccccc",
    "Trabzonspor":   "#8b1a1a",
    "Başakşehir":    "#0057a8",
    "Basaksehir":    "#0057a8",
    "Kasımpaşa":     "#e63946",
    "Kasimpasa":     "#e63946",
    "Sivasspor":     "#c62828",
    "Antalyaspor":   "#e53935",
    "Adana Demirspor": "#1565c0",
    "Samsunspor":    "#e53935",
    "Göztepe":       "#f57c00",
    "Goztepe":       "#f57c00",
    "Konyaspor":     "#2e7d32",
    "Alanyaspor":    "#f9a825",
    "Kayserispor":   "#c62828",
    "Gaziantep FK":  "#6a1b9a",
    "Eyüpspor":      "#0288d1",
    "Eyupspor":      "#0288d1",
    "Bodrum FK":     "#37474f",
    "Rizespor":      "#2e7d32",
  };

  function teamBadgeColor(name) {
    if (!name) return "#848e9c";
    // Tam eşleşme dene
    if (TEAM_COLORS[name]) return TEAM_COLORS[name];
    // Kısmi eşleşme dene
    for (const key of Object.keys(TEAM_COLORS)) {
      if (name.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(name.toLowerCase())) {
        return TEAM_COLORS[key];
      }
    }
    return "#848e9c";
  }

  // Takım adını kısalt (ESPN Türkçe isimleri bazen İngilizce veriyor)
  function shortName(name) {
    if (!name) return "?";
    // ESPN bazı takımları kısa adıyla zaten döndürüyor
    const map = {
      "Istanbul Basaksehir FK": "Başakşehir",
      "Istanbul Basaksehir": "Başakşehir",
      "Besiktas JK": "Beşiktaş",
      "Fenerbahce SK": "Fenerbahçe",
      "Galatasaray SK": "Galatasaray",
      "Trabzonspor AS": "Trabzonspor",
      "Caykur Rizespor": "Rizespor",
      "Adana Demirspor": "Adana D.",
      "Kasimpasa SK": "Kasımpaşa",
    };
    if (map[name]) return map[name];
    // Genel temizleme
    return name
      .replace(" SK", "").replace(" AS", "").replace(" FK", "")
      .replace(" JK", "").replace(" AŞ", "")
      .slice(0, 14);
  }

  // Zone rengi
  function getZoneStyle(rank, total) {
    if (rank <= 2) return "background:rgba(14,203,129,0.08); border-left:3px solid rgba(14,203,129,0.6);";
    if (rank <= 4) return "background:rgba(252,213,53,0.06); border-left:3px solid rgba(252,213,53,0.5);";
    if (rank > total - 4) return "background:rgba(246,70,93,0.06); border-left:3px solid rgba(246,70,93,0.4);";
    return "border-left:3px solid transparent;";
  }

  // Puan tablosunu çiz
  function renderLigTable(entries, total) {
    const container = document.getElementById("ligTableBody");
    if (!container) return;
    if (!entries || entries.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:48px 16px;color:var(--text-secondary);">
        <div style="font-size:32px;margin-bottom:12px;">📡</div>
        <div style="font-size:14px;font-weight:700;">Veri alınamadı. Yenile butonuna basın.</div>
      </div>`;
      return;
    }

    const totalTeams = total || entries.length;

    container.innerHTML = entries.map(row => {
      const rank  = row.rank;
      const name  = shortName(row.name);
      const gp    = row.gp;
      const wins  = row.wins;
      const ties  = row.ties;
      const loss  = row.loss;
      const gf    = row.gf;
      const ga    = row.ga;
      const gd    = gf - ga;
      const pts   = row.pts;
      const gdStr = gd > 0 ? `+${gd}` : `${gd}`;
      const zStyle = getZoneStyle(rank, totalTeams);
      const bColor = teamBadgeColor(row.name);
      const rankColor = rank <= 2 ? "var(--up)" : rank <= 4 ? "var(--brand)" : rank > totalTeams - 4 ? "var(--down)" : "var(--text-secondary)";
      const logo = row.logo || "";

      return `<div class="lig-row" style="${zStyle}" onclick='openTeamDetail(${JSON.stringify(row)})'>
        <div class="lig-col-rank"><span class="lig-rank-num" style="color:${rankColor}">${rank}</span></div>
        <div class="lig-col-team">
          <img src="${logo}" class="lig-logo" loading="lazy" onerror="this.style.display='none'" />
          <div style="display:flex; flex-direction:column;">
            <span class="lig-team-name">${name}</span>
            <div class="form-dots">${(row.form || "").split("").map(f => `<span class="dot-${f.toLowerCase()}"></span>`).join("")}</div>
          </div>
        </div>
        <div class="lig-col-num">${gp}</div>
        <div class="lig-col-num" style="color:var(--up)">${wins}</div>
        <div class="lig-col-num" style="color:var(--text-secondary)">${ties}</div>
        <div class="lig-col-num" style="color:var(--down)">${loss}</div>
        <div class="lig-col-num" style="font-size:11px;color:${gd>0?'var(--up)':gd<0?'var(--down)':'var(--text-secondary)'}">${gdStr}</div>
        <div class="lig-col-pts"><span class="lig-pts">${pts}</span></div>
      </div>`;
    }).join("");

    if (entries.length > 0) {
      setText("ligLeader", shortName(entries[0].name));
    }
  }

  window.switchLigMainTab = function(tab) {
    const tabs = ['standing', 'week', 'live'];
    tabs.forEach(t => {
      const btn = document.getElementById("btnLig" + t.charAt(0).toUpperCase() + t.slice(1));
      const sec = document.getElementById("lig" + t.charAt(0).toUpperCase() + t.slice(1) + "Section");
      if (btn) btn.classList.toggle("active", t === tab);
      if (sec) sec.style.display = (t === tab ? "block" : "none");
    });
    // Canlı Skor: otomatik yenileme yönetimi
    if (tab === 'live') {
      fetchLeagueLiveMatches(); // hemen yüklre
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
  };



  async function fetchWeeklyMatches() {
    const list = document.getElementById("ligWeekList");
    if(!list) return;
    list.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-secondary); font-size:13px;">Haftalık bülten hazırlanıyor...</div>`;
    try {
      // ── AKILLI HAFTA ARALIĞI HESAPLAMA (Cuma - Salı) ──
      const now = new Date();
      const currentDay = now.getDay(); // 0:Paz, 1:Pzt ...
      
      const friday = new Date(now);
      // Bu hafta içindeysek (Pzt-Sal) geçen Cuma'ya git, (Cum-Pzr) bu Cuma'ya git
      const diffToFriday = (currentDay === 0) ? -2 : (currentDay >= 1 && currentDay <= 3) ? (currentDay * -1 - 2) : (5 - currentDay);
      friday.setDate(now.getDate() + diffToFriday);
      
      const tuesday = new Date(friday);
      tuesday.setDate(friday.getDate() + 5); // Cuma'dan başlayıp 5 gün sonrasına (Salı) kadar

      const ds = friday.toISOString().split('T')[0].replace(/-/g,'');
      const de = tuesday.toISOString().split('T')[0].replace(/-/g,'');

      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/scoreboard?dates=${ds}-${de}&limit=50`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const events = data?.events || [];
      const weekNum = data?.week?.number || "";
      
      if (events.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-secondary);">Bu hafta için kayıtlı müsabaka yok.</div>`;
        return;
      }

      // Hafta Başlığı
      let html = weekNum ? `<div style="padding:10px 16px; background:rgba(252,213,53,0.1); border-left:4px solid var(--brand); border-radius:4px; margin-bottom:12px; color:var(--brand); font-weight:800; font-size:13px; text-align:left;">TRENDYOL SÜPER LİG ${weekNum}. HAFTA FİKSTÜRÜ</div>` : '';
      
      html += renderFullMatchCards(events);
      list.innerHTML = html;
    } catch (e) { 
      list.innerHTML = `<div style="text-align:center; padding:24px; color:var(--down);">Haftalık veri bağlantısı kurulamadı.</div>`; 
    }
  }

  function renderFullMatchCards(events) {
    const sorted = [...events].sort((a,b) => new Date(a.date) - new Date(b.date));
    const logoUrl = (id) => id ? `https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/${id}.png&w=64&h=64` : "";

    return sorted.map((ev, idx) => {
      const comp = ev.competitions?.[0];
      const home = comp?.competitors?.find(c => c.homeAway === "home");
      const away = comp?.competitors?.find(c => c.homeAway === "away");
      const state    = ev.status?.type?.state;
      const isFinal  = (state === "post");
      const isLive   = (state === "in");
      const clock    = ev.status?.displayClock || "";
      const homeLogo = logoUrl(home?.team?.id);
      const awayLogo = logoUrl(away?.team?.id);
      const homeId   = String(home?.team?.id || home?.id || "");
      const awayId   = String(away?.team?.id || away?.id || "");

      const d = new Date(ev.date);
      const startTime = d.toLocaleTimeString("tr-TR", {hour:"2-digit", minute:"2-digit"});
      const dateStr   = d.toLocaleDateString("tr-TR", {day:"2-digit", month:"2-digit"});
      const dayStr    = d.toLocaleDateString("tr-TR", {weekday:"short"}).toUpperCase();

      const hWin = isFinal && parseInt(home?.score) > parseInt(away?.score);
      const aWin = isFinal && parseInt(away?.score) > parseInt(home?.score);
      const borderStyle = isLive
        ? "border-left:3px solid var(--down);"
        : isFinal ? "border-left:3px solid rgba(255,255,255,0.06);" : "";

      // ── Parse: Goller ──
      const details = comp?.details || [];
      const goals = details
        .filter(d => d.type?.text === "Goal" || d.scoringPlay)
        .map(d => ({
          player: d.athletesInvolved?.[0]?.shortName || d.athletesInvolved?.[0]?.displayName || "Gol",
          min:    d.clock?.displayValue || "",
          teamId: String(d.team?.id),
          og:     !!(d.type?.text?.toLowerCase().includes("own"))
        }));

      // ── Parse: Kartlar (substitution hariç) ──
      const cards = details
        .filter(d => {
          const t  = (d.type?.text || "").toLowerCase();
          if (t.includes("substitut") || t === "sub in" || t === "sub out") return false;
          return d.yellowCard || d.redCard || t.includes("yellow card") || t.includes("red card");
        })
        .map(d => {
          const t  = (d.type?.text || "").toLowerCase();
          const isRed = d.redCard || d.type?.id === "95" || d.type?.id === "96" || t.includes("red card");
          return {
            player: d.athletesInvolved?.[0]?.shortName || d.athletesInvolved?.[0]?.displayName || "",
            min:    d.clock?.displayValue || "",
            teamId: String(d.team?.id),
            type:   isRed ? "red" : "yellow"
          };
        });

      // ── Parse: Değişiklikler ──
      const subs = details
        .filter(d => {
          const t  = (d.type?.text || "").toLowerCase();
          const id = String(d.type?.id || "");
          return t.includes("substitut") || t === "sub in" || t === "sub out" || id === "92";
        })
        .map(d => ({
          out:    d.athletesInvolved?.[0]?.shortName || d.athletesInvolved?.[0]?.displayName || "",
          inn:    d.athletesInvolved?.[1]?.shortName || d.athletesInvolved?.[1]?.displayName || "",
          min:    d.clock?.displayValue || "",
          teamId: String(d.team?.id)
        }));

      const homeGoals = goals.filter(g => g.teamId === homeId);
      const awayGoals = goals.filter(g => g.teamId === awayId);
      const homeCards = cards.filter(c => c.teamId === homeId);
      const awayCards = cards.filter(c => c.teamId === awayId);
      const homeSubs  = subs.filter(s => s.teamId === homeId);
      const awaySubs  = subs.filter(s => s.teamId === awayId);

      const hasDetail = (isFinal || isLive) && (goals.length > 0 || cards.length > 0 || subs.length > 0);
      const detailId  = `match-detail-${idx}`;

      // ── Olay satırı render ──
      const renderSide = (goalArr, cardArr, subsArr, align) => {
        const isRight = align === "right";
        const items = [];
        goalArr.forEach(g => items.push({ min: g.min, kind: "goal", og: g.og, player: g.player }));
        cardArr.forEach(c => items.push({ min: c.min, kind: "card", ctype: c.type, player: c.player }));
        subsArr.forEach(s => items.push({ min: s.min, kind: "sub", out: s.out, inn: s.inn }));
        items.sort((a,b) => (parseInt(a.min)||0) - (parseInt(b.min)||0));

        if (items.length === 0) {
          return `<div style="font-size:10px;color:rgba(255,255,255,0.12);font-style:italic;${isRight?' text-align:right':''}">—</div>`;
        }

        return items.map(item => {
          let icon, color, label;
          if (item.kind === "goal") {
            icon  = item.og ? "⚽↩" : "⚽";
            color = "#eaecef";
            label = item.player;
          } else if (item.kind === "card") {
            icon  = item.ctype === "red" ? "🟥" : "🟨";
            color = item.ctype === "red" ? "#f6465d" : "#fcd535";
            label = item.player;
          } else {
            icon  = "🔄";
            color = "#848e9c";
            label = item.out ? `${item.out} → ${item.inn}` : item.inn;
          }
          const minStr = item.min
            ? `<span style="font-family:'Space Grotesk',monospace;font-size:10px;font-weight:700;color:${color};opacity:.85;">${item.min}'</span>`
            : "";
          if (isRight) {
            return `<div style="display:flex;align-items:center;justify-content:flex-end;gap:5px;margin-bottom:5px;">
              <span style="font-size:11px;color:#848e9c;white-space:nowrap;">${label}</span>
              ${minStr}
              <span style="font-size:13px;line-height:1;">${icon}</span>
            </div>`;
          } else {
            return `<div style="display:flex;align-items:center;gap:5px;margin-bottom:5px;">
              <span style="font-size:13px;line-height:1;">${icon}</span>
              ${minStr}
              <span style="font-size:11px;color:#848e9c;white-space:nowrap;">${label}</span>
            </div>`;
          }
        }).join("");
      };

      const detailPanel = hasDetail ? `
        <div id="${detailId}" style="display:none;padding:12px 14px 14px;border-top:1px dashed rgba(255,255,255,0.06);background:rgba(0,0,0,0.15);">
          <div style="display:grid;grid-template-columns:1fr 1px 1fr;gap:0;">
            <div style="padding-right:10px;">${renderSide(homeGoals, homeCards, homeSubs, "left")}</div>
            <div style="background:rgba(255,255,255,0.05);"></div>
            <div style="padding-left:10px;">${renderSide(awayGoals, awayCards, awaySubs, "right")}</div>
          </div>
        </div>` : "";

      const cursorStyle = hasDetail ? "cursor:pointer;" : "";
      const clickAttr = hasDetail
        ? `onclick="toggleMatchDetail('${detailId}')"`
        : "";

      // ── Kart HTML ──
      const scoreBox = (isFinal || isLive)
        ? `<div style="font-size:15px;font-weight:900;font-family:'Space Grotesk',monospace;color:${isLive?"var(--down)":"var(--text-primary)"};letter-spacing:1px;white-space:nowrap;">${home?.score ?? 0} – ${away?.score ?? 0}</div>
           ${isLive
             ? `<div style="font-size:8px;color:var(--down);font-weight:900;animation:pulse 1.2s infinite;margin-top:2px;">● ${clock}</div>`
             : `<div style="font-size:8px;color:var(--text-secondary);margin-top:2px;font-weight:700;">MS</div>`
           }`
        : `<div style="font-size:11px;font-weight:800;color:var(--brand);letter-spacing:1px;">VS</div>`;

      return `
        <div style="border-bottom:1px solid rgba(255,255,255,0.04);background:${isLive?"rgba(246,70,93,0.03)":"transparent"};${borderStyle}border-radius:0;">
          <div ${clickAttr} style="display:grid;grid-template-columns:52px 1fr 68px 1fr${hasDetail?" 14px":""};align-items:center;padding:10px 12px;gap:0;${cursorStyle}">

            <div style="font-size:10px;text-align:center;padding-right:8px;border-right:1px solid rgba(255,255,255,0.05);">
              <div style="font-weight:800;color:var(--text-primary);font-size:11px;">${dateStr}</div>
              <div style="color:var(--text-secondary);margin-top:2px;font-size:9px;">${dayStr}</div>
              <div style="color:var(--text-secondary);font-size:9px;">${startTime}</div>
            </div>

            <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;padding:0 8px;min-width:0;overflow:hidden;">
              <span style="font-size:11px;font-weight:${hWin?800:600};color:${hWin?"var(--up)":isLive?"var(--text-primary)":"var(--text-secondary)"};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${shortName(home?.team?.displayName)}</span>
              <img src="${homeLogo}" onerror="this.style.visibility='hidden'" style="width:24px;height:24px;object-fit:contain;flex-shrink:0;">
            </div>

            <div style="text-align:center;background:rgba(255,255,255,0.04);border-radius:8px;padding:7px 4px;border:1px solid rgba(255,255,255,0.04);flex-shrink:0;">
              ${scoreBox}
            </div>

            <div style="display:flex;align-items:center;justify-content:flex-start;gap:6px;padding:0 8px;min-width:0;overflow:hidden;">
              <img src="${awayLogo}" onerror="this.style.visibility='hidden'" style="width:24px;height:24px;object-fit:contain;flex-shrink:0;">
              <span style="font-size:11px;font-weight:${aWin?800:600};color:${aWin?"var(--up)":isLive?"var(--text-primary)":"var(--text-secondary)"};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${shortName(away?.team?.displayName)}</span>
            </div>

            ${hasDetail ? `<div style="text-align:right;color:var(--text-secondary);font-size:12px;opacity:0.5;">▾</div>` : ""}

          </div>
          ${detailPanel}
        </div>
      `;
    }).join("");
  }

  async function fetchLeagueLiveMatches() {
    const list = document.getElementById("ligLiveList");
    if (!list) return;
    list.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-secondary);">Canlı maçlar taranıyor...</div>`;
    try {
      const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/scoreboard");
      if (!res.ok) throw new Error();
      const data = await res.json();
      const allEvents = data?.events || [];
      const liveEvents = allEvents.filter(ev => ev.status?.type?.state === "in");
      
      if (liveEvents.length === 0) {
        list.innerHTML = `
          <div style="text-align:center; padding:60px 24px; color:var(--text-secondary);">
            <div style="position:relative; display:inline-block; margin-bottom:24px;">
              <img src="./trndyl.jpg" style="width:200px; border-radius:12px; box-shadow:0 15px 35px rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.05);">
            </div>
            <div style="font-size:18px; font-weight:800; color:var(--text-primary); margin-bottom:10px; letter-spacing:-0.5px;">Trendyol Süper Lig Canlı</div>
            <div style="font-size:13px; line-height:1.7; max-width:280px; margin:0 auto; opacity:0.6; font-weight:500;">&#350;u an aktif bir müsabaka bulunmamaktadır. Canlı skorlar başladığı anda burada olacak.</div>
          </div>`;
      } else {
        list.innerHTML = renderFullMatchCards(liveEvents);
      }
      const ts = new Date().toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'});
      const upd = document.getElementById('liveLastUpdate');
      if (upd) upd.textContent = `Son güncelleme: ${ts} (her 60sn)`;
    } catch (e) { list.innerHTML = `<div style="text-align:center; padding:24px; color:var(--down);">Canlı veriler alınamadı.</div>`; }
  }

  function renderLiveMatchCard(ev) {
    const clock = ev.clock || "";
    const homeGoals = (ev.goals || []).filter(g => g.teamId === ev.homeId);
    const awayGoals = (ev.goals || []).filter(g => g.teamId === ev.awayId);

    const goalRow = (g) => `
      <div style="display:flex; align-items:center; gap:5px; font-size:11px; color:var(--text-secondary); margin-bottom:3px;">
        <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--brand); flex-shrink:0;"></span>
        <span style="font-family:'Space Grotesk',monospace; font-size:10px; font-weight:700; color:var(--brand);">${g.min}</span>
        <span>${g.player}</span>
      </div>`;

    return `
      <div style="margin:8px 12px; background:var(--bg-secondary); border:1px solid rgba(246,70,93,0.25); border-left:3px solid var(--down); border-radius:14px; padding:16px 14px 14px; position:relative;">

        <!-- Üst satır: takımlar + skor -->
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">

          <!-- Ev sahibi -->
          <div style="display:flex; flex-direction:column; align-items:center; gap:6px; width:82px;">
            <img src="${ev.homeLogo}" onerror="this.style.visibility='hidden'" style="width:40px; height:40px; object-fit:contain;">
            <span style="font-size:11px; font-weight:700; color:var(--text-primary); text-align:center; line-height:1.3;">${ev.home}</span>
          </div>

          <!-- Skor merkez -->
          <div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex:1;">
            <div style="background:var(--bg-primary); border:1px solid rgba(246,70,93,0.3); border-radius:10px; padding:8px 18px; font-size:26px; font-weight:900; font-family:'Space Grotesk',monospace; color:var(--down); letter-spacing:4px; line-height:1;">${ev.hScore} – ${ev.aScore}</div>
            <div style="font-size:9px; font-weight:900; background:var(--down); color:#fff; padding:2px 8px; border-radius:4px; letter-spacing:.06em; animation:blink 1.2s infinite;">LIVE</div>
            <div style="font-size:11px; font-weight:800; color:var(--down); font-family:'Space Grotesk',monospace;">${clock ? clock+"'" : ""}</div>
          </div>

          <!-- Deplasman -->
          <div style="display:flex; flex-direction:column; align-items:center; gap:6px; width:82px;">
            <img src="${ev.awayLogo}" onerror="this.style.visibility='hidden'" style="width:40px; height:40px; object-fit:contain;">
            <span style="font-size:11px; font-weight:700; color:var(--text-primary); text-align:center; line-height:1.3;">${ev.away}</span>
          </div>
        </div>

        <!-- Goller -->
        ${(ev.goals && ev.goals.length > 0) ? `
        <div style="margin-top:12px; padding-top:10px; border-top:1px dashed rgba(255,255,255,0.06); display:grid; grid-template-columns:1fr 1px 1fr; gap:0; align-items:start;">
          <div style="padding-right:10px;">
            ${homeGoals.length > 0 ? homeGoals.map(goalRow).join("") : `<div style="font-size:10px; color:rgba(255,255,255,0.1); font-style:italic;">—</div>`}
          </div>
          <div style="background:rgba(255,255,255,0.05); align-self:stretch;"></div>
          <div style="padding-left:10px; display:flex; flex-direction:column; align-items:flex-end;">
            ${awayGoals.length > 0 ? awayGoals.map(g => `
              <div style="display:flex; align-items:center; gap:5px; font-size:11px; color:var(--text-secondary); margin-bottom:3px; flex-direction:row-reverse; text-align:right;">
                <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--brand); flex-shrink:0;"></span>
                <span style="font-family:'Space Grotesk',monospace; font-size:10px; font-weight:700; color:var(--brand);">${g.min}</span>
                <span>${g.player}</span>
              </div>`).join("") : `<div style="font-size:10px; color:rgba(255,255,255,0.1); font-style:italic; text-align:right;">—</div>`}
          </div>
        </div>` : ""}
      </div>
    `;
  }



  function renderRecentMatches(events) {
    const container = document.getElementById("ligRecentMatches");
    if (!container) return;
    if (!events || events.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text-secondary);font-size:13px;">Son sonuçlar bulunamadı.</div>`;
      return;
    }

    container.innerHTML = events.map(ev => {
      const hWin = ev.hScore !== null && ev.aScore !== null && ev.hScore > ev.aScore;
      const aWin = ev.hScore !== null && ev.aScore !== null && ev.aScore > ev.hScore;
      const draw = ev.hScore !== null && ev.aScore !== null && ev.hScore === ev.aScore;
      const scoreStr = `${ev.hScore} - ${ev.aScore}`;
      
      return `
        <div class="match-row">
          <div class="match-date">${ev.date}</div>
          <div class="match-team" style="color:${hWin?'var(--text-primary)':'var(--text-secondary)'}; font-weight:${hWin?800:600}">${shortName(ev.home)}</div>
          <div class="match-score">${scoreStr}</div>
          <div class="match-team match-team-away" style="color:${aWin?'var(--text-primary)':'var(--text-secondary)'}; font-weight:${aWin?800:600}">${shortName(ev.away)}</div>
        </div>`;
    }).join("");
  }

  // Genel fikstürü çiz
  function renderGeneralFixture(events) {
    const container = document.getElementById("ligUpcomingMatches");
    if (!container) return;
    if (!events || events.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text-secondary);font-size:13px;">Gelecek maç verisi bulunamadı.</div>`;
      return;
    }

    container.innerHTML = events.map(ev => {
      const isL = ev.isLive;
      return `
        <div class="match-row" style="${isL ? 'border:1px solid var(--down)' : ''}">
          <div class="match-date" style="font-size:9px; width:65px;">${ev.dateFull || ev.date}</div>
          <div class="match-team">${shortName(ev.home)}</div>
          <div class="match-score" style="font-size:11px; color:var(--brand);">${isL ? 'CANLI' : 'vs'}</div>
          <div class="match-team match-team-away">${shortName(ev.away)}</div>
        </div>`;
    }).join("");
  }

  function normalizeMatch(ev) {
    const comps = ev.competitions?.[0];
    const home  = comps?.competitors?.find(c => c.homeAway === "home");
    const away  = comps?.competitors?.find(c => c.homeAway === "away");
    let dateStr = "";
    let dateFull = "";
    try {
      const d = new Date(ev.date);
      dateStr = d.toLocaleDateString("tr-TR", { day:"2-digit", month:"2-digit" });
      dateFull = d.toLocaleDateString("tr-TR", { day:"2-digit", month:"2-digit" }) + " " + d.toLocaleTimeString("tr-TR", { hour:"2-digit", minute:"2-digit" });
    } catch(e) {}
    
    const state = ev.status?.type?.state; // pre, in, post
    const logoUrl = (id) => id ? `https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/${id}.png&w=40&h=40` : "";
    
    // GOL, SARI/KIRMIZI KART PARSE
    const details = comps?.details || [];
    const goalsList = details
      .filter(d => d.type?.text === "Goal" || d.scoringPlay)
      .map(d => ({
         player: d.athletesInvolved?.[0]?.shortName || d.athletesInvolved?.[0]?.displayName || "Gol",
         min:    d.clock?.displayValue || "",
         teamId: String(d.team?.id),
         type:   "goal",
         og:     !!(d.type?.text?.toLowerCase().includes("own"))
      }));

    const cardsList = details
      .filter(d => {
        const t = (d.type?.text || "").toLowerCase();
        if (t.includes("substitut") || t === "sub in" || t === "sub out") return false;
        return d.yellowCard || d.redCard || t.includes("yellow") || t.includes("red") || t.includes("kart");
      })
      .map(d => {
        const t = (d.type?.text || "").toLowerCase();
        const isRed = d.redCard || d.type?.id === "95" || d.type?.id === "96" || t.includes("red");
        return {
          player: d.athletesInvolved?.[0]?.shortName || d.athletesInvolved?.[0]?.displayName || "",
          min:    d.clock?.displayValue || "",
          teamId: String(d.team?.id),
          type:   isRed ? "red" : "yellow"
        };
      });

    return {
      id:       ev.id,
      home:     home?.team?.displayName || "?",
      homeId:   String(home?.team?.id || home?.id || ""),
      homeLogo: logoUrl(home?.team?.id || home?.id),
      away:     away?.team?.displayName || "?",
      awayId:   String(away?.team?.id || away?.id || ""),
      awayLogo: logoUrl(away?.team?.id || away?.id),
      hScore:   (home?.score !== undefined && state !== "pre") ? parseInt(home.score) : null,
      aScore:   (away?.score !== undefined && state !== "pre") ? parseInt(away.score) : null,
      date:     dateStr,
      dateFull: dateFull,
      isLive:   state === "in",
      isFinal:  state === "post",
      league:   ev.season?.displayName || "Turkish Super Lig",
      clock:    ev.status?.displayClock || "",
      goals:    goalsList,
      cards:    cardsList
    };
  }

  function renderGoals(goals) {
    if(!goals || goals.length === 0) return "";
    return `
      <div class="sch-goals">
        ${goals.map(g => `
          <div class="sch-goal-item">
            <span class="sch-goal-icon">⚽</span>
            <span><b>${g.min}</b> ${g.player}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  window.switchLigMatches = function(type) {
    document.getElementById("btnPastMatches").classList.toggle("active", type === 'past');
    document.getElementById("btnFutureMatches").classList.toggle("active", type === 'future');
    document.getElementById("ligPastSection").style.display = type === 'past' ? 'block' : 'none';
    document.getElementById("ligFutureSection").style.display = type === 'future' ? 'block' : 'none';
  };

  // ESPN gizli JSON API'den puan tablosu çek
  // site.api.espn.com — CORS açık, kayıt yok, ücretsiz
  async function fetchSuperLigData() {
    setText("ligMeta", "Yükleniyor...");

    try {
      // ── 1. PUAN TABLOSU ──
      const sRes = await fetch(
        "https://site.api.espn.com/apis/v2/sports/soccer/tur.1/standings?season=2025"
      );
      if (!sRes.ok) throw new Error("standings_http_" + sRes.status);

      const sData = await sRes.json();

      // ESPN standings yapısı: children[0].standings.entries[]
      const entries = sData?.children?.[0]?.standings?.entries
                   || sData?.standings?.entries
                   || [];

      if (entries.length === 0) throw new Error("empty_standings");

      // Veriyi normalize et
      const rows = entries.map(e => {
        const stats = {};
        (e.stats || []).forEach(s => { stats[s.name] = s.value; });
        return {
          id:    e.team?.id,
          rank:  Math.round(stats.rank   ?? stats.standing ?? 0),
          name:  e.team?.displayName || e.team?.name || "?",
          logo:  e.team?.logos?.[0]?.href,
          form:  (e.stats || []).find(s => s.name === "form")?.displayValue || "",
          gp:    Math.round(stats.gamesPlayed     ?? stats.played     ?? 0),
          wins:  Math.round(stats.wins            ?? 0),
          ties:  Math.round(stats.ties            ?? stats.draws      ?? 0),
          loss:  Math.round(stats.losses          ?? 0),
          gf:    Math.round(stats.pointsFor       ?? stats.goalsFor   ?? 0),
          ga:    Math.round(stats.pointsAgainst   ?? stats.goalsAgainst ?? 0),
          pts:   Math.round(stats.points          ?? 0),
        };
      }).sort((a, b) => a.rank - b.rank);

      renderLigTable(rows, rows.length);
      setText("ligSezon", "2025-26");

      // ── 2. MAÇLAR (SONUÇLAR VE FİKSTÜR) ──
      const nowScore = new Date();
      const endScore = new Date(); endScore.setDate(nowScore.getDate() + 30);
      const ds = nowScore.toISOString().split('T')[0].replace(/-/g,'');
      const de = endScore.toISOString().split('T')[0].replace(/-/g,'');

      const mRes = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/scoreboard?dates=${ds}-${de}&limit=100`
      );
      if (mRes.ok) {
        const mData = await mRes.json();
        const allEvents = mData?.events || [];
        
        // Biten Maçlar (Results)
        const pastEvents = allEvents
          .filter(ev => ev.status?.type?.state === "post")
          .slice(0, 10)
          .map(ev => normalizeMatch(ev));
        renderRecentMatches(pastEvents);

        // Gelecek Maçlar (Fixture)
        const futureEvents = allEvents
          .filter(ev => ev.status?.type?.state === "pre" || ev.status?.type?.state === "in")
          .slice(0, 15)
          .map(ev => normalizeMatch(ev));
        renderGeneralFixture(futureEvents);
      }

      const now = new Date().toLocaleString("tr-TR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
      setText("ligTimestamp", `Son güncelleme: ${now}`);
      setText("ligMeta", "Trendyol Süper Lig 2025-26");

      // ── 3. HAFTA BİLGİSİ (Round Info Bar) ──
      // ESPN bazen week.number vermeyebilir, o zaman puan tablosundan hesapla
      const TOTAL_WEEKS = 34;
      let weekNum = 0;

      // Önce scoreboard'dan dene
      try {
        const roundRes = await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/scoreboard");
        if (roundRes.ok) {
          const roundData = await roundRes.json();
          weekNum = roundData?.week?.number || roundData?.season?.type?.week?.number || 0;
        }
      } catch(e) {}

      // ESPN hafta vermezse, puan tablosundaki oynanan maç sayısından hesapla
      if (weekNum === 0 && rows.length > 0) {
        weekNum = Math.max(...rows.map(r => r.gp));
      }

      if (weekNum > 0) {
        const remaining = Math.max(0, TOTAL_WEEKS - weekNum);
        const roundBar = document.getElementById("ligRoundBar");
        const roundText = document.getElementById("ligRoundText");
        const remainText = document.getElementById("ligRemainingText");
        if (roundBar && roundText && remainText) {
          roundText.textContent = `${weekNum}. Hafta`;
          remainText.textContent = `${remaining} Hafta Kaldı`;
          roundBar.style.display = "flex";
        }
      }

    } catch (err) {
      console.warn("ESPN API hatası:", err.message);
      showLigError();
    }
  }

  // ── 3. TAKIM DETAY VE SIRADAKİ MAÇLAR ──
  window.openTeamDetail = async function(team) {
    const o = document.getElementById("teamDetailOverlay");
    if (!o) return;
    
    document.getElementById("teamDetailName").textContent = team.name;
    document.getElementById("teamDetailLogo").src = team.logo || "";
    document.getElementById("teamStatPts").textContent = team.pts;
    document.getElementById("teamStatRank").textContent = team.rank + ".";
    document.getElementById("teamStatGBM").textContent = `${team.wins}/${team.ties}/${team.loss}`;
    
    // Varsayılan sekmeyi sıfırla
    switchDetailTab('schedule');
    
    o.classList.add("open");

    // Maçları ve Kadroyu eş zamanlı çek
    fetchTeamSchedule(team.id);
    fetchTeamSquad(team.id);
    checkTeamLiveStatus(team.name);
  };

  window.switchDetailTab = function(tab) {
    document.querySelectorAll('.detail-tab-btn').forEach(b => b.classList.toggle('active', b.getAttribute('onclick').includes(tab)));
    document.querySelectorAll('.detail-tab-content').forEach(c => c.classList.toggle('active', c.id.toLowerCase().includes(tab)));
  };

  async function fetchTeamSchedule(teamId) {
    const list = document.getElementById("teamScheduleList");
    const teamName = document.getElementById("teamDetailName").textContent;
    list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-secondary);">Yükleniyor...</div>`;
    
    try {
      // 30 gün geçmiş, 45 gün gelecek
      const now = new Date();
      const start = new Date(); start.setDate(now.getDate() - 30);
      const end = new Date(); end.setDate(now.getDate() + 45);
      const ds = start.toISOString().split('T')[0].replace(/-/g,'');
      const de = end.toISOString().split('T')[0].replace(/-/g,'');
      
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/scoreboard?dates=${ds}-${de}&limit=100`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      
      const clean = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c');
      const sName = clean(teamName);

      const events = (data?.events || [])
        .filter(ev => {
            const comps = ev.competitions?.[0];
            const hasId = comps?.competitors?.some(c => String(c.id) === String(teamId));
            const hasName = clean(ev.name).includes(sName);
            return hasId || hasName;
        })
        .map(ev => normalizeMatch(ev));

      if (events.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:32px; color:var(--text-secondary);">Maç programı bulunamadı.</div>`;
      } else {
        list.innerHTML = events.map(ev => {
          const isL = ev.isLive;
          const isF = ev.isFinal;
          const scoreStr = (ev.hScore !== null && ev.aScore !== null) ? `${ev.hScore} - ${ev.aScore}` : "vs";
          const metaStr = isL ? "LIVE!" : (isF ? "FT" : ev.dateFull.split(" ")[1]);
          const dateStr = ev.dateFull.split(" ")[0];

          return `
            <div class="schedule-row">
              <div class="schedule-info">
                <div class="sch-team">
                  <img src="${ev.homeLogo}" class="sch-logo" onerror="this.src='icon.svg'">
                  <div class="sch-name">${ev.home}</div>
                </div>
                
                <div class="sch-center">
                  <div class="sch-score-box ${isL ? 'live' : ''}">${scoreStr}</div>
                  <div class="sch-meta ${isL ? 'clr-down' : ''}">${dateStr} ${metaStr}</div>
                </div>

                <div class="sch-team">
                  <img src="${ev.awayLogo}" class="sch-logo" onerror="this.src='icon.svg'">
                  <div class="sch-name">${ev.away}</div>
                </div>
              </div>
              ${renderGoals(ev.goals)}
              <div class="sch-league">${ev.league}</div>
            </div>
          `;
        }).join("");
      }
    } catch (e) { list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--down);">Hata oluştu.</div>`; }
  }

  async function fetchTeamSquad(teamId) {
    const list = document.getElementById("teamSquadList");
    list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-secondary);">Yükleniyor...</div>`;
    try {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/teams/${teamId}/roster`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      // Pozisyonlara göre grupla (Kaleci, Defans, Orta Saha, Forvet)
      const athletes = data?.athletes || [];
      if (athletes.length === 0) { list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-secondary);">Kadro verisi yok.</div>`; return; }
      
      list.innerHTML = athletes.map(a => `
        <div class="squad-item">
          <span class="squad-pos">${a.position?.abbreviation || '??'}</span>
          <span class="squad-name">${a.displayName}</span>
          <span class="squad-num">${a.jersey || '-'}</span>
        </div>
      `).join("");
    } catch (e) { list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--down);">Kadro yüklenemedi.</div>`; }
  }

  async function checkTeamLiveStatus(teamName) {
    const liveInd = document.getElementById("teamDetailLive");
    liveInd.style.display = "none";
    try {
      const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/scoreboard");
      if (!res.ok) return;
      const data = await res.json();
      const isPlaying = (data?.events || []).some(ev => {
        const isLive = ev.status?.type?.name === "STATUS_IN_PROGRESS";
        const hasTeam = ev.name.toLowerCase().includes(teamName.toLowerCase());
        return isLive && hasTeam;
      });
      if (isPlaying) liveInd.style.display = "inline-block";
    } catch (e) {}
  }

  window.closeTeamDetail = function() {
    const o = document.getElementById("teamDetailOverlay");
    if (o) o.classList.remove("open");
  };



  function showLigError() {
    const container = document.getElementById("ligTableBody");
    if (container) {
      container.innerHTML = `<div style="text-align:center;padding:48px 16px;color:var(--text-secondary);">
        <div style="font-size:36px;margin-bottom:12px;">📡</div>
        <div style="font-size:15px;font-weight:800;color:var(--text-primary);margin-bottom:8px;">Bağlantı Hatası</div>
        <div style="font-size:13px;line-height:1.8;">İnternet bağlantınızı kontrol edip<br><strong style="color:var(--brand)">Yenile</strong> butonuna basın.</div>
      </div>`;
    }
    const rm = document.getElementById("ligRecentMatches");
    if (rm) rm.innerHTML = "";
    setText("ligMeta", "Veri alınamadı");
  }

  // Bağla + ilk yükleme
  function bindSuperLig() {
    const btn = document.getElementById("ligRefreshBtn");
    if (btn) {
      btn.addEventListener("click", fetchSuperLigData);
    }
    fetchSuperLigData();
  }

  // ═════════════════════════ YARDIMCI FONKSİYONLAR ═════════════════════════
  function readStorage(k, f) { try { const r=localStorage.getItem(k); return r?JSON.parse(r):f; } catch { return f; } }
  function writeStorage(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
  function sum(a, f) { return a.reduce((a, r)=>a+Number(r[f]||0),0); }
  function formatCurrency(v, dec=0, f="0") { return !Number.isFinite(Number(v)) ? f : new Intl.NumberFormat("tr-TR",{maximumFractionDigits:dec,minimumFractionDigits:dec}).format(v) + " ₺"; }
  function formatNumber(v, d=2, f="--") { return !Number.isFinite(Number(v)) ? f : new Intl.NumberFormat("tr-TR",{maximumFractionDigits:d,minimumFractionDigits:d}).format(v); }
  function formatDate(d) { return d ? new Date(d).toLocaleDateString("tr-TR") : "-"; }
  function formatDateShort(d) { if(!d) return "-"; const date = new Date(d); return String(date.getDate()).padStart(2, '0') + "." + String(date.getMonth() + 1).padStart(2, '0'); }
  function formatDateShortYY(d) { if(!d) return "-"; const date = new Date(d); return String(date.getDate()).padStart(2, '0') + "." + String(date.getMonth() + 1).padStart(2, '0') + "." + String(date.getFullYear()).slice(-2); }
  function setText(i, v) { const e = document.getElementById(i); if (e) e.textContent = v; }

  // ═════════════════════════ CANLI ALTIN BORSASI (Research Integrated) ═════════════════════════
  const ALTIN_TURLERI = [
    { key: 'gram_altin',     ad: '📊 Gram Altın (24 Ayar)' },
    { key: 'bilezik_22',     ad: '💛 22 Ayar Bilezik' },
    { key: 'ceyrek_altin',   ad: '🪙 Çeyrek Altın' },
    { key: 'yarim_altin',    ad: '🥈 Yarım Altın' },
    { key: 'tam_altin',      ad: '🏅 Tam Altın' },
    { key: 'ata_cumhuriyet', ad: '🎖️ Ata/Cumhuriyet' },
    { key: 'altin_ons',      ad: '🌍 Altın (ONS/$)' },
  ];

  window.xauAc = function() {
    const modal = document.getElementById('altinModal');
    if(modal) {
        modal.style.display = 'flex';
        window.altinVerisiYukle();
        // Otomatik yenileme kur
        if(window._altinInterval) clearInterval(window._altinInterval);
        window._altinInterval = setInterval(window.altinVerisiYukle, 60000);
    }
  };

  window.altinVerisiYukle = async function() {
    const wrap = document.getElementById('altinTabloWrap');
    const load = document.getElementById('altinYukleniyor');
    const tbody = document.getElementById('altinTbody');
    if(!wrap || !load || !tbody) return;

    load.innerHTML = '<div style="font-size:32px; margin-bottom:16px; animation: pulse 1.5s infinite;">⏳</div><div style="font-size:15px; font-weight:600;">Piyasa verileri okunuyor...</div>';
    load.style.display = 'block';
    wrap.style.display = 'none';

    try {
      let d;
      try {
        // Öncelikli olarak doğrudan Cloudflare Pages API Route (functions/api/altin.js) çağrılıyor
        const res = await fetch('/api/altin?v=' + Date.now());
        if (!res.ok) throw new Error("Cloudflare CF Route not responding (404)");
        d = await res.json();
        if(d.error) throw new Error(d.error);
      } catch(proxyErr) {
        // Eğer sayfa local çalıştırılmışsa veya Worker yayına girmediyse Fallback CORS Proxy kullanarak doğrudan Altınkaynak API'ye git
        console.warn("Cloudflare worker başarısız, genel proxy deneniyor...");
        const fallbackRes = await fetch('https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent('https://static.altinkaynak.com/public/Gold'));
        if(!fallbackRes.ok) throw new Error("Genel Proxy Bağlantı Hatası");
        const rawJson = await fallbackRes.json();
        d = { veriler: rawJson };
      }

      // Veriler ham Altınkaynak dizisi olarak geliyor
      const v = d.veriler || [];
      const findK = (kod) => v.find(x => x.Kod === kod) || {};

      const rows = [
        { ad: '📊 Gram Altın (24 Ayar)', alis: findK('GA').Alis,     satis: findK('GA').Satis,     degisim: null },
        { ad: '💛 22 Ayar Bilezik',      alis: findK('B').Alis,     satis: findK('B').Satis,     degisim: null },
        { ad: '🪙 Çeyrek Altın',         alis: findK('C').Alis, satis: findK('C').Satis, degisim: null },
        { ad: '🥈 Yarım Altın',          alis: findK('Y').Alis,  satis: findK('Y').Satis,  degisim: null },
        { ad: '🏅 Tam Altın',            alis: findK('T').Alis,    satis: findK('T').Satis,    degisim: null },
        { ad: '🎖️ Ata/Cumhuriyet',    alis: findK('A').Alis, satis: findK('A').Satis, degisim: null },
        { ad: '🌍 Altın (ONS/$)',            alis: findK('XAUUSD').Alis,    satis: findK('XAUUSD').Satis,    degisim: null },
      ];

      window.altinDataRows = rows;
      if (window.calcGold) window.calcGold(); // Güncel veriler yüklendiğinde otomatik hesapla

      const fmt = (val) => val ? val : '--';
      const fmtChg = () => '';

      tbody.innerHTML = '';
      rows.forEach((r, i) => {
        const tr = document.createElement('tr');
        tr.style.cssText = `background:${i%2===0 ? 'rgba(255,255,255,0.02)' : 'transparent'}; border-bottom:1px solid rgba(255,255,255,0.03);`;
        tr.innerHTML = `
          <td style="padding:12px 8px; font-weight:700; color:var(--text-primary); font-size:12px;">${r.ad}</td>
          <td style="padding:12px 8px; text-align:right; color:var(--up); font-family:'Space Grotesk',monospace; font-size:12px; font-weight:700;">${fmt(r.alis)}</td>
          <td style="padding:12px 8px; text-align:right; font-family:'Space Grotesk',monospace; font-size:13px; font-weight:800; color:var(--brand);">${fmt(r.satis)}</td>
          <td style="padding:8px 4px; text-align:right;">${fmtChg(r.degisim)}</td>
        `;
        tbody.appendChild(tr);
      });

      // Güncelleme zamanı - Sunucudan geleni kullan veya lokali bas
      const upd = d.guncelleme || new Date().toLocaleTimeString('tr-TR', {hour:'2-digit',minute:'2-digit'});
      
      const timeEl = document.getElementById('altinGuncelleme');
      if(timeEl) timeEl.textContent = `Son güncelleme: ${upd}`;

      load.style.display = 'none';
      wrap.style.display = 'block';
    } catch (err) {
      console.warn("Altın veri hatası:", err.message);
      load.innerHTML = `<div style="color:var(--down); font-weight:700; padding:20px; text-align:center;">
        <div style="font-size:30px; margin-bottom:12px;">📡</div>
        <div style="font-size:13px;">Veri Bağlantısı Kesildi</div>
        <div style="font-size:10px; opacity:0.6; margin-top:8px;">${err.message}</div>
        <button onclick="altinVerisiYukle()" style="margin-top:16px; background:var(--brand); color:#000; border:none; padding:8px 16px; border-radius:8px; font-weight:800; font-size:11px; cursor:pointer;">🔄 TEKRAR DENE</button>
      </div>`;
    }
  }

  // Altın Hesap Makinesi Logiği
  window.calcGold = function() {
    if(!window.altinDataRows) return;
    const t = document.getElementById("calcGoldType") ? document.getElementById("calcGoldType").value : null;
    const amtInput = document.getElementById("calcGoldAmount");
    const amt = amtInput ? parseFloat(amtInput.value) || 0 : 0;
    
    if(!t) return;

    const typeMap = {
      'GA': '📊 Gram Altın (24 Ayar)',
      'B': '💛 22 Ayar Bilezik',
      'C': '🪙 Çeyrek Altın',
      'Y': '🥈 Yarım Altın',
      'T': '🏅 Tam Altın',
      'A': '🎖️ Ata/Cumhuriyet'
    };
    
    const targetAd = typeMap[t];
    const row = window.altinDataRows.find(r => r.ad === targetAd);
    if(row) {
      // String değerini alıp noktayı(binlik) atıp virgülden sonrasını nokta yapıyporuz (e.g. 15.545,85 -> 15545.85)
      const parseStr = (str) => {
          if (!str) return 0;
          let s = String(str).replace(/\./g, "").replace(",", ".");
          return Number(s);
      };
      
      const a = row.alis ? parseStr(row.alis) * amt : 0;
      const s = row.satis ? parseStr(row.satis) * amt : 0;
      
      const bEl = document.getElementById("calcGoldBuy");
      const sEl = document.getElementById("calcGoldSell");
      if(bEl) bEl.textContent = (a > 0 ? a.toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2}) : "0,00") + " ₺";
      if(sEl) sEl.textContent = (s > 0 ? s.toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2}) : "0,00") + " ₺";
    }
  };

  // Modal dışı tıklama
  document.getElementById('altinModal').addEventListener('click', function(e) {
    if (e.target === this) {
      this.style.display = 'none';
      if(window._altinInterval) clearInterval(window._altinInterval);
    }
  });

  // ══════════════════════════════════════════
  // YARDIMCI GÖRSEL FONKSİYONLAR
  // ══════════════════════════════════════════
  window.toggleMatchDetail = function(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const isNone = el.style.display === 'none';
    
    // Diğerlerini kapat (Opsiyonel: Akordiyon efekti)
    // document.querySelectorAll('[id^="match-detail-"]').forEach(d => d.style.display = 'none');
    
    el.style.display = isNone ? 'block' : 'none';
    
    // Smooth scroll (Eğer açılıyorsa)
    if (isNone) {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    const pinScreen = document.getElementById("pinScreen");
    if (pinScreen) pinScreen.style.display = "flex";
  });

  // ══════════════════════════════════════════
  // MARKET SUB-TABS (Piyasa / Coinler)
  // ══════════════════════════════════════════
  window.switchMarketTab = function(tab) {
    const piyasa  = document.getElementById('piyasaSection');
    const coinler = document.getElementById('coinlerSection');
    const btnP    = document.getElementById('btnMarketPiyasa');
    const btnC    = document.getElementById('btnMarketCoinler');
    if (!piyasa || !coinler) return;
    if (tab === 'coins') {
      piyasa.style.display  = 'none';
      coinler.style.display = 'block';
      btnP?.classList.remove('active');
      btnC?.classList.add('active');
      fetchCoinPrices();
    } else {
      piyasa.style.display  = 'block';
      coinler.style.display = 'none';
      btnP?.classList.add('active');
      btnC?.classList.remove('active');
    }
  };

  // ══════════════════════════════════════════
  // COİNLERFİYATLARI (Binance API)
  // ══════════════════════════════════════════
  const COIN_LIST = [
    { sym: 'SOLUSDT',    name: 'Solana',    base: 'SOL'    },
    { sym: 'DOGEUSDT',   name: 'Dogecoin',  base: 'DOGE'   },
    { sym: 'AVAXUSDT',   name: 'Avalanche', base: 'AVAX'   },
    { sym: 'DEXEUSDT',   name: 'DeXe',      base: 'DEXE',   logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5916.png' },
    { sym: 'SUIUSDT',    name: 'Sui',       base: 'SUI',    logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/20947.png' },
    { sym: 'PEPEUSDT',   name: 'Pepe',      base: 'PEPE',   logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/24478.png' },
    { sym: 'LINKUSDT',   name: 'Chainlink', base: 'LINK'   },
    { sym: 'RENDERUSDT', name: 'Render',    base: 'RENDER', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5632.png' },
    { sym: 'JUPUSDT',    name: 'Jupiter',   base: 'JUP',    logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/29210.png' },
    { sym: 'WIFUSDT',    name: 'dogwifhat', base: 'WIF',    logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/28752.png' },
  ];

  async function fetchCoinPrices() {
    const container = document.getElementById('coinlerList');
    const meta      = document.getElementById('coinlerMeta');
    if (!container) return;
    container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-secondary);">Yükleniyor...</div>`;
    try {
      const symbols = COIN_LIST.map(c => `"${c.sym}"`).join(',');
      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbols}]`);
      if (!res.ok) throw new Error();
      const tickers = await res.json();
      const map = {};
      tickers.forEach(t => { map[t.symbol] = t; });

      const iconBase = 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color';

      container.innerHTML = COIN_LIST.map(coin => {
        const d = map[coin.sym];
        if (!d) return '';
        const price  = parseFloat(d.lastPrice);
        const chg    = parseFloat(d.priceChangePercent);
        const isUp   = chg >= 0;
        const pillCls = isUp ? 'up' : 'down';
        const priceStr = price < 0.0001 ? price.toFixed(8)
                        : price < 0.01  ? price.toFixed(6)
                        : price < 1     ? price.toFixed(4)
                        : price < 10    ? price.toFixed(3)
                                        : price.toFixed(2);
        
        // Eğer coin objesinde logo varsa onu kullan, yoksa standart base ikonunu dene
        const iconSrc = coin.logo || `${iconBase}/${coin.base.toLowerCase()}.png`;

        return `<div class="coin-row">
          <div class="m-left">
            <img src="${iconSrc}" class="market-icon" style="border-radius:50%;" onerror="this.style.display='none';this.nextSibling.style.display='flex'">
            <div class="coin-letter-icon" style="display:none; width:32px; height:32px; border-radius:50%; background:rgba(255,255,255,0.05); align-items:center; justify-content:center; font-size:12px; font-weight:800; color:var(--text-secondary);">${coin.base[0]}</div>
            <div>
              <div class="m-symbol">${coin.base}<span class="m-pair">/USDT</span></div>
              <div style="font-size:10px;color:var(--text-secondary);margin-top:2px;">${coin.name}</div>
            </div>
          </div>
          <div class="m-middle" style="font-size:14px;">${priceStr}</div>
          <div class="m-right">
            <div class="pill ${pillCls}" style="font-size:12px;">${isUp ? '+' : ''}${chg.toFixed(2)}%</div>
          </div>
        </div>`;
      }).join('');

      if (meta) {
        const now = new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
        meta.textContent = `Binance • ${now} • 24s değişim`;
      }
    } catch(e) {
      container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--down);">Bağlantı hatası. <button onclick="fetchCoinPrices()" style="color:var(--brand);background:none;border:none;font-weight:800;cursor:pointer;">Tekrar dene</button></div>`;
    }
  }

  // ══════════════════════════════════════════
  // YAKIT FİYATLARI (akaryakit-fiyatlari API)
  // ══════════════════════════════════════════
  // Şehir ID map (OPET şube kodları)
  const CITY_IDS = { istanbul: 34, ankara: 6, izmir: 35, bursa: 16, antalya: 7 };

  window.fetchFuelPrices = async function() {
    const cards = document.getElementById('fuelPriceCards');
    const meta  = document.getElementById('fuelPriceMeta');
    if (!cards) return;

    // Yükleniyor durumu
    cards.innerHTML = `
      <div class="fuel-price-card benzin"><div class="fpc-icon">⛽</div><div class="fpc-label">Benzin 95</div><div class="fpc-price anim-pulse">●●</div></div>
      <div class="fuel-price-card motorin"><div class="fpc-icon">🚛</div><div class="fpc-label">Motorin</div><div class="fpc-price anim-pulse">●●</div></div>
      <div class="fuel-price-card lpg"><div class="fpc-icon">💨</div><div class="fpc-label">LPG</div><div class="fpc-price anim-pulse">●●</div></div>`;

    const cityEl = document.getElementById('fuelCitySelect');
    const cityId = CITY_IDS[cityEl ? cityEl.value : 'istanbul'] || 34;

    // API deneme listesi (Sırasıyla en sağlam proxy ve API'ler)
    const ENDPOINTS = [
      `https://api.allorigins.win/get?url=${encodeURIComponent(`https://akaryakit-fiyatlari.vercel.app/api/opet/${cityId}`)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(`https://akaryakit-fiyatlari.vercel.app/api/opet/${cityId}`)}`,
      `https://akaryakit-fiyatlari.vercel.app/api/opet/${cityId}`
    ];

    let data = null;
    for (const url of ENDPOINTS) {
      try {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), 8000);
        const res  = await fetch(url, { signal: ctrl.signal });
        clearTimeout(tid);
        
        if (res.ok) { 
            let result = await res.json();
            // AllOrigins içeriği result.contents içinde string olarak döndürür
            if (url.includes('allorigins') && result.contents) {
                data = JSON.parse(result.contents);
            } else {
                data = result;
            }
            if (data) break; 
        }
      } catch (err) { console.warn("Fuel Fetch Error:", url, err); }
    }

    if (!data) {
      cards.innerHTML = `<div style="grid-column:span 3;text-align:center;padding:16px;color:var(--text-secondary);font-size:12px;">Yakıt verileri alınamadı. <button onclick="fetchFuelPrices()" style="color:var(--brand);background:none;border:none;font-weight:800;cursor:pointer;">Tekrar dene</button></div>`;
      return;
    }

    // Veri Ayrıştırma (Genişletilmiş Format Desteği)
    let benzin = null, motorin = null, lpg = null;
    const parse = v => v ? parseFloat(String(v).replace(',', '.')) : null;

    if (data.benzin || data.Benzin || data['95']) {
      benzin  = parse(data.benzin || data.Benzin || data['95']);
      motorin = parse(data.motorin || data.Motorin || data.diesel);
      lpg     = parse(data.lpg || data.LPG || data.autogas);
    } else if (Array.isArray(data)) {
      data.forEach(item => {
        const t = (item.type || item.name || item.fuelType || '').toLowerCase();
        const p = parse(item.price || item.fiyat);
        if (t.includes('95') || t.includes('benzin') || t.includes('gasoline')) benzin = p;
        else if (t.includes('motor') || t.includes('diesel') || t.includes('dizel')) motorin = p;
        else if (t.includes('lpg') || t.includes('otogaz') || t.includes('autogas')) lpg = p;
      });
    }

    // Kartları Doldur (Tema Korunarak)
    cards.innerHTML = `
      <div class="fuel-price-card benzin"><div class="fpc-icon">⛽</div><div class="fpc-label">Benzin 95</div><div class="fpc-price">${benzin ? benzin.toFixed(2) : '--'}</div></div>
      <div class="fuel-price-card motorin"><div class="fpc-icon">🚛</div><div class="fpc-label">Motorin</div><div class="fpc-price">${motorin ? motorin.toFixed(2) : '--'}</div></div>
      <div class="fuel-price-card lpg"><div class="fpc-icon">💨</div><div class="fpc-label">LPG</div><div class="fpc-price">${lpg ? lpg.toFixed(2) : '--'}</div></div>`;
    
    const now = new Date().toLocaleTimeString("tr-TR", {hour:'2-digit', minute:'2-digit'});
    if(meta) meta.textContent = `Güncellendi: ${now} (OPET)`;
  };
      arr.forEach(item => {
        const t = (item.type || item.name || '').toLowerCase();
        const p = parse(item.price || item.fiyat);
        if (t.includes('95') || t.includes('benzin')) benzin = p;
        else if (t.includes('motor') || t.includes('diesel')) motorin = p;
        else if (t.includes('lpg')) lpg = p;
      });
    }

    const fmt = p => p ? p.toFixed(2).replace('.', ',') + ' ₺' : '--';
    cards.innerHTML = `
      <div class="fuel-price-card benzin">
        <div class="fpc-icon">⛽</div>
        <div class="fpc-label">Benzin 95</div>
        <div class="fpc-price">${fmt(benzin)}</div>
      </div>
      <div class="fuel-price-card motorin">
        <div class="fpc-icon">🚛</div>
        <div class="fpc-label">Motorin</div>
        <div class="fpc-price">${fmt(motorin)}</div>
      </div>
      <div class="fuel-price-card lpg">
        <div class="fpc-icon">💨</div>
        <div class="fpc-label">LPG</div>
        <div class="fpc-price">${fmt(lpg)}</div>
      </div>`;

    if (meta) {
      const now = new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
      const cityName = cityEl ? cityEl.options[cityEl.selectedIndex].text : 'İstanbul';
      meta.textContent = `OPET • ${cityName} • ${now}`;
    }
  };

