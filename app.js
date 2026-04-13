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
    buttons.forEach((btn) => { btn.addEventListener("click", () => { buttons.forEach((x) => x.classList.toggle("active", x === btn)); pages.forEach((page) => page.classList.toggle("active", page.id === btn.dataset.tab)); }); });
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
  function unlockApp() { pinScreen.style.display = "none"; appShell.style.display = "block"; init(); }
  
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
      state.dayRecords.push({ id: crypto.randomUUID(), title:ti, end:en });
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
      
      const c = document.createElement("div"); c.className = "panel"; c.style.display="flex"; c.style.justifyContent="space-between"; c.style.alignItems="center"; c.style.marginBottom="12px"; c.style.borderLeft = `4px solid ${color}`;
      c.innerHTML = `<div><div style="font-size:15px; font-weight:800; color:var(--text-primary);">${r.title}</div><div style="font-size:12px; color:var(--text-secondary);">Hedef: ${formatDate(r.end)}</div></div><div style="text-align:right;"><div style="color:${color}; font-size:16px; font-weight:800;">${daysText}</div><button class="badge unpaid btn-del-day" data-id="${r.id}" style="margin-top:4px;">Sil</button></div>`;
      container.appendChild(c);
    });
  }
  
  // ═════════════════════════ TAKSİT YÖNETİMİ ═════════════════════════
  function bindSchoolInstallments() {
      const unevenToggle = document.getElementById("schoolUnevenToggle");
      const unevenWrap = document.getElementById("schoolUnevenWrap");
      if(unevenToggle) { unevenToggle.addEventListener("change", (e) => { unevenWrap.style.display = e.target.checked ? "flex" : "none"; document.getElementById("unevenNo").required = e.target.checked; document.getElementById("unevenAmount").required = e.target.checked; }); }
  
      const f = document.getElementById("newSchoolForm");
      if(f) {
          f.addEventListener("submit", (e) => {
              e.preventDefault(); 
              const n = document.getElementById("schoolChildName").value; 
              const d = parseVal(document.getElementById("schoolTotalDebt").value); 
              const ct = Number(document.getElementById("schoolInstCount").value); 
              const fd = document.getElementById("schoolFirstDate").value;
              
              const hasUneven = unevenToggle.checked; let uNo = 0, uAmt = 0;
              if(hasUneven) {
                  uNo = Number(document.getElementById("unevenNo").value); uAmt = parseVal(document.getElementById("unevenAmount").value);
                  if (uNo < 1 || uNo > ct) return alert(`Farklı miktar tanımladığınız taksit numarası 1 ile ${ct} (Vade Sayısı) aralığında olmalıdır!`);
                  if (uAmt >= d) return alert(`Farklı taksidin tutarı (₺${uAmt}), toplam borcunuza (₺${d}) eşit veya daha fazla olamaz!`);
              }
              if (!n || d<=0 || ct <= 1 || !fd) return alert("Hatalı giriş! Vade birden büyük olmalıdır.");
              
              let am = d / ct; if (hasUneven) { am = (d - uAmt) / (ct - 1); }
              let [y, m, day] = fd.split('-').map(Number); let todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);
              const newPlan = { id: crypto.randomUUID(), name: n, records: [] };
              
              for(let i=0; i<ct; i++) {
                  let iD = new Date(y, m-1+i, 1); iD.setDate(Math.min(day, new Date(iD.getFullYear(), iD.getMonth()+1, 0).getDate()));
                  let oy=iD.getFullYear(), om=String(iD.getMonth()+1).padStart(2,'0'), od=String(iD.getDate()).padStart(2,'0'); let isPast = iD.getTime() < todayMidnight.getTime();
                  let thisAm = am; if (hasUneven && (i+1) === uNo) thisAm = uAmt;
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
    state.school.forEach(plan => {
      const unpaidRows = plan.records.filter(r=>!r.paid); const childDebt = unpaidRows.reduce((a,r)=>a+Number(r.amount),0); grandDebt += childDebt; maxInst = Math.max(maxInst, unpaidRows.length);
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
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;"><h3 style="font-size:16px; margin-right:8px; word-break:break-word;">${plan.name}</h3><div style="text-align:right;"><div style="font-size:11px; color:var(--text-secondary); margin-bottom:2px;">Kalan Bakiye</div><div style="color:var(--text-primary); font-size:17px; font-weight:800; font-family:'Space Grotesk', monospace;">${formatCurrency(childDebt)}</div></div></div><div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--text-secondary); border-top:1px solid rgba(255,255,255,0.05); padding-top:12px;"><span>Kalan: <strong style="color:var(--text-primary)">${unpaidRows.length} Taksit</strong></span><span style="color:var(--brand); display:flex; align-items:center; gap:4px; font-weight:800;">Liste / Yönet 🔽</span></div></summary>
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
    const tabs = ['standing', 'live'];
    tabs.forEach(t => {
      const btn = document.getElementById("btnLig" + t.charAt(0).toUpperCase() + t.slice(1));
      const sec = document.getElementById("lig" + t.charAt(0).toUpperCase() + t.slice(1) + "Section");
      if (btn) btn.classList.toggle("active", t === tab);
      if (sec) sec.style.display = (t === tab ? "block" : "none");
    });
    if (tab === 'live') fetchLeagueLiveMatches();
  };

  async function fetchLeagueLiveMatches() {
    const list = document.getElementById("ligLiveList");
    list.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-secondary);">Canlı maçlar taranıyor...</div>`;
    try {
      const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/scoreboard");
      if (!res.ok) throw new Error();
      const data = await res.json();
      const liveEvents = (data?.events || [])
        .filter(ev => ev.status?.type?.state === "in")
        .map(ev => normalizeMatch(ev));
      
      if (liveEvents.length === 0) {
        list.innerHTML = `
          <div style="text-align:center; padding:60px 24px; color:var(--text-secondary);">
            <div style="position:relative; display:inline-block; margin-bottom:24px;">
              <img src="./trndyl.jpg" style="width:200px; border-radius:12px; box-shadow:0 15px 35px rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.05);">
              <div style="position:absolute; bottom:-10px; right:-10px; background:var(--brand); color:#000; font-size:10px; font-weight:800; padding:4px 10px; border-radius:4px; letter-spacing:1px;">PROFESYONEL</div>
            </div>
            <div style="font-size:18px; font-weight:800; color:var(--text-primary); margin-bottom:10px; letter-spacing:-0.5px;">Trendyol Süper Lig Canlı</div>
            <div style="font-size:13px; line-height:1.7; max-width:280px; margin:0 auto; opacity:0.6; font-weight:500;">Şu an aktif bir müsabaka bulunmamaktadır. Tüm canlı skorlar ve maç detayları başladığı anda burada olacaktır.</div>
          </div>`;
      } else {
        list.innerHTML = liveEvents.map(ev => `
          <div class="schedule-row" style="border-left: 3px solid var(--down);">
            <div class="schedule-info">
              <div class="sch-team">
                <img src="${ev.homeLogo}" class="sch-logo" onerror="this.src='icon.svg'">
                <div class="sch-name">${ev.home}</div>
              </div>
              <div class="sch-center">
                <div class="sch-score-box live">${ev.hScore} - ${ev.aScore}</div>
                <div class="sch-meta clr-down">LIVE!</div>
              </div>
              <div class="sch-team">
                <img src="${ev.awayLogo}" class="sch-logo" onerror="this.src='icon.svg'">
                <div class="sch-name">${ev.away}</div>
              </div>
            </div>
            ${renderGoals(ev.goals)}
          </div>
        `).join("");
      }
    } catch (e) { list.innerHTML = `<div style="text-align:center; padding:24px; color:var(--down);">Canlı veriler alınamadı.</div>`; }
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
    
    // GOL ATANLAR (Scorers)
    const goalsList = (comps?.details || [])
      .filter(d => d.type?.text === "Goal" || d.scoringPlay)
      .map(d => ({
         player: d.athletesInvolved?.[0]?.shortName || d.athletesInvolved?.[0]?.displayName || "Gol",
         min: d.clock?.displayValue || "",
         teamId: String(d.team?.id)
      }));

    return {
      id:       ev.id,
      home:     home?.team?.displayName || "?",
      homeId:   String(home?.id || ""),
      homeLogo: logoUrl(home?.id),
      away:     away?.team?.displayName || "?",
      awayId:   String(away?.id || ""),
      awayLogo: logoUrl(away?.id),
      hScore:   (home?.score !== undefined && state !== "pre") ? parseInt(home.score) : null,
      aScore:   (away?.score !== undefined && state !== "pre") ? parseInt(away.score) : null,
      date:     dateStr,
      dateFull: dateFull,
      isLive:   state === "in",
      isFinal:  state === "post",
      league:   ev.season?.displayName || "Turkish Super Lig",
      goals:    goalsList
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

  // Geçmiş maçları ayrı endpoint'ten çek (scoreboard boş dönerse)
  async function fetchPastMatches() {
    try {
      const res = await fetch(
        "https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/scoreboard?dates=20250101-20251231&limit=10"
      );
      if (!res.ok) return;
      const data = await res.json();
      const events = (data?.events || [])
        .filter(ev => ev.status?.type?.name === "STATUS_FINAL")
        .slice(0, 8)
        .map(ev => {
          const comps = ev.competitions?.[0];
          const home = comps?.competitors?.find(c => c.homeAway === "home");
          const away = comps?.competitors?.find(c => c.homeAway === "away");
          let dateStr = "";
          try { dateStr = new Date(ev.date).toLocaleDateString("tr-TR", { day:"2-digit", month:"2-digit" }); } catch(e) {}
          return {
            home: home?.team?.displayName || "?",
            away: away?.team?.displayName || "?",
            hScore: home?.score !== undefined ? parseInt(home.score) : null,
            aScore: away?.score !== undefined ? parseInt(away.score) : null,
            date: dateStr,
          };
        });
      renderRecentMatches(events);
    } catch(e) {
      console.warn("Geçmiş maç çekme hatası:", e);
    }
  }

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
        altinVerisiYukle();
        // Otomatik yenileme kur
        if(window._altinInterval) clearInterval(window._altinInterval);
        window._altinInterval = setInterval(altinVerisiYukle, 60000);
    }
  };

  async function altinVerisiYukle() {
    const wrap = document.getElementById('altinTabloWrap');
    const load = document.getElementById('altinYukleniyor');
    const tbody = document.getElementById('altinTbody');
    if(!wrap || !load || !tbody) return;

    load.innerHTML = '<div style="font-size:24px; margin-bottom:12px;">⏳</div><div style="font-size:13px; font-weight:600;">Piyasa verileri okunuyor...</div>';
    load.style.display = 'block';
    wrap.style.display = 'none';

    try {
      // Truncgil CORS açık — doğrudan çek, Worker gerekmez
      const res = await fetch('https://finans.truncgil.com/v4/today.json');
      if (!res.ok) throw new Error("Bağlantı hatası: " + res.status);
      const d = await res.json();

      // Gerçek API anahtarlarını map et (kontrol edildi: 2026-04-13)
      const rows = [
        { ad: '📊 Gram Altın (24 Ayar)', alis: d.GRA?.Buying,     satis: d.GRA?.Selling,     degisim: d.GRA?.Change },
        { ad: '💛 22 Ayar Bilezik',      alis: d.YIA?.Buying,     satis: d.YIA?.Selling,     degisim: d.YIA?.Change },
        { ad: '🪙 Çeyrek Altın',         alis: d.CEYREKALTIN?.Buying, satis: d.CEYREKALTIN?.Selling, degisim: d.CEYREKALTIN?.Change },
        { ad: '🥈 Yarım Altın',          alis: d.YARIMALTIN?.Buying,  satis: d.YARIMALTIN?.Selling,  degisim: d.YARIMALTIN?.Change },
        { ad: '🏅 Tam Altın',            alis: d.TAMALTIN?.Buying,    satis: d.TAMALTIN?.Selling,    degisim: d.TAMALTIN?.Change },
        { ad: '🎖️ Cumhuriyet Altını',    alis: d.CUMHURIYETALTINI?.Buying, satis: d.CUMHURIYETALTINI?.Selling, degisim: d.CUMHURIYETALTINI?.Change },
        { ad: '⭐ Ata Altın',            alis: d.ATAALTIN?.Buying,    satis: d.ATAALTIN?.Selling,    degisim: d.ATAALTIN?.Change },
      ];

      const fmt = (v) => v ? Number(v).toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2}) : '--';
      const fmtChg = (c) => {
        if (c === undefined || c === null) return '';
        const n = Number(c);
        const color = n > 0 ? 'var(--up)' : n < 0 ? 'var(--down)' : 'var(--text-secondary)';
        const arrow = n > 0 ? '▲' : n < 0 ? '▼' : '—';
        return `<span style="color:${color}; font-size:11px; font-weight:700;">${arrow} %${Math.abs(n).toFixed(2)}</span>`;
      };

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

      // Güncelleme zamanı (Robusta Date Parsing)
      let upd = '';
      if (d.Update_Date) {
        // GG-AA-YYYY SS:DD formatını parsela
        try {
          const parts = d.Update_Date.split(' ');
          const dateParts = parts[0].split('.'); // Nokta veya tire gelirse diye
          const timeParts = parts[1].split(':');
          // Sadece saati göster (Kullanıcı için en özeti bu)
          upd = timeParts[0] + ':' + timeParts[1];
        } catch(e) { 
          upd = new Date().toLocaleTimeString('tr-TR', {hour:'2-digit',minute:'2-digit'}); 
        }
      } else {
        upd = new Date().toLocaleTimeString('tr-TR', {hour:'2-digit',minute:'2-digit'});
      }
      
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

  // Modal dışı tıklama
  document.getElementById('altinModal').addEventListener('click', function(e) {
    if (e.target === this) {
      this.style.display = 'none';
      if(window._altinInterval) clearInterval(window._altinInterval);
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    const pinScreen = document.getElementById("pinScreen");
    if (pinScreen) pinScreen.style.display = "flex";
  });
