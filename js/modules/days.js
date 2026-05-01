// js/modules/days.js — Gün Sayacı / Geri Sayım Modülü

const DaysModule = (() => {

  // ─── OLAY BAĞLAMA ───────────────────────────────────────────
  function bindEvents() {
    // 24 saat kuralı: Süresi dolan sayaçları 1 gün sonra otomatik temizle
    const nowMillis = new Date().setHours(0, 0, 0, 0);
    const oneDay = 24 * 60 * 60 * 1000;
    const initialCount = state.dayRecords.length;

    state.dayRecords = state.dayRecords.filter(r => {
      const target = new Date(r.end).setHours(0, 0, 0, 0);
      return (target + oneDay) > nowMillis;
    });

    if (state.dayRecords.length !== initialCount) writeStorage(STORAGE_KEYS.days, state.dayRecords);

    document.getElementById("daysForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const en = document.getElementById("endDate").value, ti = document.getElementById("daysTitle").value;
      if (!en || !ti) return;
      state.dayRecords.push({ id: crypto.randomUUID(), title: ti, end: en, created: Date.now() });
      writeStorage(STORAGE_KEYS.days, state.dayRecords); render(); document.getElementById("daysForm").reset();
      const det = document.getElementById("newDayDetails"); if (det) det.removeAttribute("open");
    });

    document.getElementById("daysCards").addEventListener("click", (e) => {
      if (e.target.classList.contains('btn-del-day') && confirm('Sayaç silinsin mi?')) {
        state.dayRecords = state.dayRecords.filter(r => r.id !== e.target.dataset.id);
        writeStorage(STORAGE_KEYS.days, state.dayRecords); render();
      }
    });
  }

  // ─── RENDER ──────────────────────────────────────────────────
  function render() {
    const container = document.getElementById("daysCards"); container.innerHTML = "";

    const todayMillis = new Date().setHours(0, 0, 0, 0);
    const activeRecords = state.dayRecords.map(r => {
      const target = new Date(r.end).setHours(0, 0, 0, 0);
      const days = Math.round((target - todayMillis) / (1000 * 60 * 60 * 24));
      return { ...r, days };
    }).sort((a, b) => a.days - b.days);

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

      let createdDate = r.created ? new Date(r.created).setHours(0, 0, 0, 0) : null;
      let targetMillis = new Date(r.end).setHours(0, 0, 0, 0);
      if (isNaN(targetMillis)) targetMillis = todayMillis + (r.days * 86400000);

      if (!createdDate || isNaN(createdDate)) {
        createdDate = targetMillis - (Math.max(14, r.days * 2) * 86400000);
      }

      const totalSpan = Math.max(1, Math.round((targetMillis - createdDate) / 86400000));
      const elapsed = totalSpan - Math.max(0, r.days);
      const rawPct = isPast ? 100 : Math.min(100, Math.max(0, Math.round((elapsed / totalSpan) * 100)));
      const displayPct = Math.max(5, rawPct);
      const barColorValue = isPast ? '#ff3b3b' : r.days <= 3 ? '#ff9800' : r.days <= 5 ? '#00e676' : '#fcd535';

      const c = document.createElement("div"); c.className = "panel"; c.style.marginBottom = "12px"; c.style.padding = "16px"; c.style.borderLeft = `4px solid ${color}`;
      c.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;"><div><div style="font-size:15px; font-weight:800; color:var(--text-primary);">${r.title}</div><div style="font-size:12px; color:var(--text-secondary);">Hedef: ${formatDate(r.end)}</div></div><div style="text-align:right;"><div style="color:${color}; font-size:16px; font-weight:800;">${daysText}</div><button class="badge unpaid btn-del-day" data-id="${r.id}" style="margin-top:4px;">Sil</button></div></div>
        <div style="height:6px; background:rgba(255,255,255,0.1); border-radius:3px; overflow:hidden;"><div style="height:100%; width:${displayPct}%; background:${barColorValue}; border-radius:3px; transition:width 0.5s ease-in-out;"></div></div>`;
      container.appendChild(c);
    });
  }

  // ─── BAŞLATMA ───────────────────────────────────────────────
  function init() {
    bindEvents();
    render();
    console.log('✅ Gün sayacı modülü başlatıldı');
  }

  return { init, render };
})();