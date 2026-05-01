// js/modules/altin.js — Altın Borsası Modülü

const AltinModule = (() => {

  // Altın hesaplama kayıtları
  let goldSavedRecords = readStorage("financeApp.goldSaved", []);

  // ─── MODAL AÇMA ─────────────────────────────────────────────
  window.xauAc = function () {
    const modal = document.getElementById('altinModal');
    if (modal) {
      modal.style.display = 'flex';
      window.altinVerisiYukle();
      renderGoldSaved();
      if (window._altinInterval) clearInterval(window._altinInterval);
      window._altinInterval = setInterval(window.altinVerisiYukle, 60000);
    }
  };

  // ─── VERİ YÜKLEME ──────────────────────────────────────────
  window.altinVerisiYukle = async function () {
    const wrap = document.getElementById('altinTabloWrap');
    const load = document.getElementById('altinYukleniyor');
    const tbody = document.getElementById('altinTbody');
    if (!wrap || !load || !tbody) return;

    load.innerHTML = '<div style="font-size:32px; margin-bottom:16px; animation: pulse 1.5s infinite;">⏳</div><div style="font-size:15px; font-weight:600;">Piyasa verileri okunuyor...</div>';
    load.style.display = 'block';
    wrap.style.display = 'none';

    try {
      let d;
      try {
        const res = await fetch('/api/altin?v=' + Date.now());
        if (!res.ok) throw new Error("Cloudflare CF Route not responding (404)");
        d = await res.json();
        if (d.error) throw new Error(d.error);
      } catch (proxyErr) {
        console.warn("Cloudflare worker başarısız, genel proxy deneniyor...");
        const fallbackRes = await fetch('https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent('https://static.altinkaynak.com/public/Gold'));
        if (!fallbackRes.ok) throw new Error("Genel Proxy Bağlantı Hatası");
        const rawJson = await fallbackRes.json();
        d = { veriler: rawJson };
      }

      const v = d.veriler || [];
      const findK = (kod) => v.find(x => x.Kod === kod) || {};

      const rows = [
        { ad: 'Gram Altın (24 Ayar)', alis: findK('GA').Alis, satis: findK('GA').Satis, degisim: null },
        { ad: '22 Ayar Bilezik', alis: findK('B').Alis, satis: findK('B').Satis, degisim: null },
        { ad: 'Çeyrek Altın', alis: findK('C').Alis, satis: findK('C').Satis, degisim: null },
        { ad: 'Yarım Altın', alis: findK('Y').Alis, satis: findK('Y').Satis, degisim: null },
        { ad: 'Tam Altın', alis: findK('T').Alis, satis: findK('T').Satis, degisim: null },
        { ad: 'Ata/Cumhuriyet', alis: findK('A').Alis, satis: findK('A').Satis, degisim: null },
        { ad: 'Altın (ONS/$)', alis: findK('XAUUSD').Alis, satis: findK('XAUUSD').Satis, degisim: null },
      ];

      window.altinDataRows = rows;
      if (window.calcGold) window.calcGold();

      const fmt = (val) => val ? val : '--';

      tbody.innerHTML = '';
      rows.forEach((r, i) => {
        const tr = document.createElement('tr');
        tr.style.cssText = `background:${i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'}; border-bottom:1px solid rgba(255,255,255,0.03);`;
        tr.innerHTML = `
            <td style="padding:12px 8px; font-weight:700; color:var(--text-primary); font-size:12px;">${r.ad}</td>
            <td style="padding:12px 8px; text-align:right; color:var(--text-primary); font-family:'Space Grotesk',monospace; font-size:12px; font-weight:700;">${fmt(r.alis)}</td>
            <td style="padding:12px 8px; text-align:right; font-family:'Space Grotesk',monospace; font-size:13px; font-weight:800; color:var(--brand);">${fmt(r.satis)}</td>`;
        tbody.appendChild(tr);
      });

      const upd = d.guncelleme || new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const timeEl = document.getElementById('altinGuncelleme');
      if (timeEl) timeEl.textContent = `Son güncelleme: ${upd}`;

      load.style.display = 'none';
      wrap.style.display = 'block';
    } catch (err) {
      console.warn("Altın veri hatası:", err.message);
      load.innerHTML = `<div style="color:var(--down); font-weight:700; padding:20px; text-align:center;">
          <div style="font-size:30px; margin-bottom:12px;">📡</div>
          <div style="font-size:13px;">Veri Bağlantısı Kesildi</div>
          <div style="font-size:10px; opacity:0.6; margin-top:8px;">${err.message}</div>
          <button onclick="altinVerisiYukle()" style="margin-top:16px; background:var(--brand); color:#000; border:none; padding:8px 16px; border-radius:8px; font-weight:800; font-size:11px; cursor:pointer;">🔄 TEKRAR DENE</button></div>`;
    }
  };

  // ─── HESAPLAMA ──────────────────────────────────────────────
  window.calcGold = function () {
    if (!window.altinDataRows) return;
    const t = document.getElementById("calcGoldType") ? document.getElementById("calcGoldType").value : null;
    const amtInput = document.getElementById("calcGoldAmount");
    const amt = amtInput ? parseFloat(amtInput.value) || 0 : 0;

    if (!t) return;

    const typeMap = {
      'GA': 'Gram Altın (24 Ayar)', 'B': '22 Ayar Bilezik', 'C': 'Çeyrek Altın',
      'Y': 'Yarım Altın', 'T': 'Tam Altın', 'A': 'Ata/Cumhuriyet'
    };

    const targetAd = typeMap[t];
    const row = window.altinDataRows.find(r => r.ad === targetAd);
    if (row) {
      const parseStr = (str) => {
        if (!str) return 0;
        let s = String(str).replace(/\./g, "").replace(",", ".");
        return Number(s);
      };

      const a = row.alis ? parseStr(row.alis) * amt : 0;
      const s = row.satis ? parseStr(row.satis) * amt : 0;

      const bEl = document.getElementById("calcGoldBuy");
      const sEl = document.getElementById("calcGoldSell");
      if (bEl) bEl.textContent = (a > 0 ? a.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0,00") + " ₺";
      if (sEl) sEl.textContent = (s > 0 ? s.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0,00") + " ₺";
    }
  };

  // ─── KAYDETME ───────────────────────────────────────────────
  window.saveGoldCalculation = function () {
    const t = document.getElementById("calcGoldType") ? document.getElementById("calcGoldType").value : null;
    const amtInput = document.getElementById("calcGoldAmount");
    const amt = amtInput ? parseFloat(amtInput.value) || 0 : 0;

    if (!t || amt <= 0) return;

    const typeMap = {
      'GA': 'Gram Altın (24 Ayar)', 'B': '22 Ayar Bilezik', 'C': 'Çeyrek Altın',
      'Y': 'Yarım Altın', 'T': 'Tam Altın', 'A': 'Ata/Cumhuriyet'
    };

    const targetAd = typeMap[t];
    const row = window.altinDataRows.find(r => r.ad === targetAd);
    if (row) {
      const parseStr = (str) => {
        if (!str) return 0;
        let s = String(str).replace(/\./g, "").replace(",", ".");
        return Number(s);
      };
      const sRate = parseStr(row.satis);
      const total = sRate * amt;

      if (total > 0) {
        const d = new Date();
        const dateStr = d.toLocaleDateString('tr-TR') + " " + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        goldSavedRecords.unshift({
          type: targetAd, amount: amt,
          rate: sRate.toLocaleString('tr-TR', { minimumFractionDigits: 2 }),
          total: total.toLocaleString('tr-TR', { minimumFractionDigits: 2 }),
          date: dateStr
        });
        writeStorage("financeApp.goldSaved", goldSavedRecords);
        renderGoldSaved();
      }
    }
  };

  // ─── KAYIT RENDER ───────────────────────────────────────────
  function renderGoldSaved() {
    const list = document.getElementById("goldSavedList");
    if (!list) return;
    list.innerHTML = "";
    if (goldSavedRecords.length === 0) {
      list.innerHTML = `<div style="text-align:center; color:var(--text-secondary); font-size:11px; padding:8px;">Kayıt bulunmuyor.</div>`;
      return;
    }
    goldSavedRecords.forEach((r, idx) => {
      list.innerHTML += `
              <div style="background:var(--bg-secondary); padding:12px; border-radius:8px; border:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="font-size:12px; font-weight:700; color:var(--text-primary);">${r.amount} gr ${r.type}</div>
                  <div style="font-size:10px; color:var(--text-secondary); margin-top:4px;">Kur: ${r.rate} ₺ • ${r.date}</div>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:14px; font-weight:800; color:var(--brand);">${r.total} ₺</div>
                  <button onclick="AltinModule.deleteGoldSaved(${idx})" style="background:none; border:none; color:var(--down); font-size:11px; font-weight:800; cursor:pointer; margin-top:6px;">SİL</button>
                </div>
              </div>`;
    });
  }

  // ─── SİLME ──────────────────────────────────────────────────
  function deleteGoldSaved(idx) {
    goldSavedRecords.splice(idx, 1);
    writeStorage("financeApp.goldSaved", goldSavedRecords);
    renderGoldSaved();
  }

  // ─── MODAL KAPATMA OLAYI ───────────────────────────────────
  function bindModalClose() {
    const altinModal = document.getElementById('altinModal');
    if (altinModal) {
      altinModal.addEventListener('click', function (e) {
        if (e.target === this) {
          this.style.display = 'none';
          if (window._altinInterval) clearInterval(window._altinInterval);
        }
      });
    }
  }

  // ─── BAŞLATMA ───────────────────────────────────────────────
  function init() {
    window.renderGoldSaved = renderGoldSaved; // global erişim için
    bindModalClose();
    console.log('✅ Altın modülü başlatıldı');
  }

  return { init, deleteGoldSaved };
})();