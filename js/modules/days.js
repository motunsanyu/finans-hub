// js/modules/days.js — Gün Sayacı / Geri Sayım Modülü (Supabase Entegrasyonlu)

const DaysModule = (() => {

  let calCurrentDate = new Date();
  const cardColors = [
    '#ff9500', // Turuncu
    '#007aff', // Mavi
    '#34c759', // Yeşil
    '#8e8e93', // Gri
    '#af52de', // Mor
    '#ff2d55'  // Pembe
  ];

  function getSB() {
    return window._supabaseClient;
  }

  // ─── TAKVİM MANTIĞI ──────────────────────────────────────────
  function updateTodayDisplay() {
    const today = new Date();
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const dateStr = today.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const dayStr = days[today.getDay()];
    const el = document.getElementById('calendarTodayDisplay');
    if (el) el.textContent = `${dateStr} - ${dayStr}`;
  }

  function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const monthDisplay = document.getElementById('currentMonthDisplay');
    if (!grid || !monthDisplay) return;

    grid.innerHTML = '';
    const year = calCurrentDate.getFullYear();
    const month = calCurrentDate.getMonth();

    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    monthDisplay.textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    // JS getDay(): 0=Pazar, 1=Pzt... Bizim grid Pzt(1)'den başlasın istiyoruz (P, S, Ç, P, C, C, P)
    // Pazartesi bazlı düzeltme: 0(Pazar) ise 6 olsun, diğerleri 1 eksilsin
    let startOffset = firstDay === 0 ? 6 : firstDay - 1;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    // Önceki aydan kalan günler
    for (let i = startOffset; i > 0; i--) {
      const d = document.createElement('div');
      d.className = 'cal-day other-month';
      d.textContent = prevMonthDays - i + 1;
      grid.appendChild(d);
    }

    // Bu ayın günleri
    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
      const d = document.createElement('div');
      d.className = 'cal-day';
      d.textContent = i;

      if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
        d.classList.add('today');
      }
      grid.appendChild(d);
    }

    // Gelecek aydan günler (Gridi tamamlamak için)
    const totalCells = startOffset + daysInMonth;
    const nextDays = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= nextDays; i++) {
      const d = document.createElement('div');
      d.className = 'cal-day other-month';
      d.textContent = i;
      grid.appendChild(d);
    }
  }

  function toggleCalendar() {
    const body = document.getElementById('calendarBody');
    const icon = document.getElementById('calendarToggleIcon');
    if (!body || !icon) return;

    const isHidden = body.style.display === 'none';
    body.style.display = isHidden ? 'block' : 'none';
    icon.textContent = isHidden ? '▲' : '▼';
    
    if (isHidden) renderCalendar();
  }

  // ─── OLAY BAĞLAMA ───────────────────────────────────────────
  async function bindEvents() {
    // Takvim kontrolleri
    const header = document.getElementById('calendarHeader');
    if (header) header.onclick = toggleCalendar;

    const prevBtn = document.getElementById('prevMonth');
    const nextBtn = document.getElementById('nextMonth');

    if (prevBtn) prevBtn.onclick = (e) => {
      e.stopPropagation();
      calCurrentDate.setMonth(calCurrentDate.getMonth() - 1);
      renderCalendar();
    };

    if (nextBtn) nextBtn.onclick = (e) => {
      e.stopPropagation();
      calCurrentDate.setMonth(calCurrentDate.getMonth() + 1);
      renderCalendar();
    };

    // Form işlemleri
    try {
      const today = new Date().toISOString().split('T')[0];
      await getSB().from('day_records').delete().lt('end_date', today);
    } catch (e) {
      console.warn('Eski kayıtlar temizlenemedi:', e.message);
    }

    document.getElementById("daysForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const endDate = document.getElementById("endDate").value;
      const title = document.getElementById("daysTitle").value;
      if (!endDate || !title) return;

      try {
        const { data: { user } } = await getSB().auth.getUser();
        await getSB().from('day_records').insert({
          user_id: user.id,
          title: title,
          end_date: endDate,
          created_at: new Date().toISOString()
        });

        document.getElementById("daysForm").reset();
        const det = document.getElementById("newDayDetails");
        if (det) det.removeAttribute("open");
        await render();
      } catch (err) {
        console.error('Gün kaydı hatası:', err.message);
        if (window.showToast) window.showToast('Hedef eklenemedi!', 'error');
      }
    });

    document.getElementById("daysCards").addEventListener("click", async (e) => {
      if (e.target.classList.contains('btn-del-day')) {
        const id = e.target.dataset.id;
        window.showCustomConfirm('Sayaç silinsin mi?', async () => {
          try {
            await getSB().from('day_records').delete().eq('id', id);
            await render();
          } catch (err) {
            console.error('Silme hatası:', err.message);
          }
        });
      }
    });
  }

  // ─── RENDER ──────────────────────────────────────────────────
  async function render() {
    const container = document.getElementById("daysCards");
    if (!container) return;
    container.innerHTML = "";

    try {
      const { data: records } = await getSB()
        .from('day_records')
        .select('*')
        .order('end_date', { ascending: true });

      if (!records || records.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-secondary);">Henüz bir hedef eklenmedi.</div>';
        return;
      }

      const todayMillis = new Date().setHours(0, 0, 0, 0);

      const activeRecords = records
        .map(r => ({
          ...r,
          days: Math.round((new Date(r.end_date).setHours(0, 0, 0, 0) - todayMillis) / (1000 * 60 * 60 * 24))
        }))
        .sort((a, b) => a.days - b.days);

      // Update modern widget summary if exists
      updateNextEvent(activeRecords);

      activeRecords.forEach((r, idx) => {
        const isPast = r.days < 0;
        const isZero = r.days === 0;

        let daysText = isPast ? Math.abs(r.days) + " Gün Geçti" : (isZero ? "Bugün Bitiyor!" : r.days + " Gün Kaldı");

        // Renk paleti seçimi (sırasıyla)
        const paletteColor = cardColors[idx % cardColors.length];
        let color = isPast ? "var(--down)" : (isZero ? "rgba(252,213,53,1)" : paletteColor);

        const createdDate = r.created_at ? new Date(r.created_at).setHours(0, 0, 0, 0) : new Date(r.end_date).setHours(0, 0, 0, 0) - 14 * 86400000;
        const targetMillis = new Date(r.end_date).setHours(0, 0, 0, 0);
        const totalSpan = Math.max(1, Math.round((targetMillis - createdDate) / 86400000));
        const elapsed = totalSpan - Math.max(0, r.days);
        const rawPct = isPast ? 100 : Math.min(100, Math.max(0, Math.round((elapsed / totalSpan) * 100)));
        const displayPct = Math.max(5, rawPct);
        
        // Progress bar rengi kartın ana rengiyle uyumlu olsun
        const barColorValue = isPast ? '#ff3b3b' : color;

        const c = document.createElement("div");
        c.className = "panel";
        c.style.marginBottom = "12px";
        c.style.padding = "16px";
        c.style.borderLeft = `4px solid ${color}`;
        c.style.background = `linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)`;
        
        c.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
            <div>
              <div style="font-size:15px; font-weight:800; color:var(--text-primary);">${r.title}</div>
              <div style="font-size:12px; color:var(--text-secondary);">Hedef: ${new Date(r.end_date).toLocaleDateString('tr-TR')}</div>
            </div>
            <div style="text-align:right;">
              <div style="color:${color}; font-size:16px; font-weight:800;">${daysText}</div>
              <button class="badge unpaid btn-del-day" data-id="${r.id}" style="margin-top:4px;">Sil</button>
            </div>
          </div>
          <div style="height:6px; background:rgba(255,255,255,0.05); border-radius:3px; overflow:hidden;">
            <div style="height:100%; width:${displayPct}%; background:${barColorValue}; border-radius:3px; transition:width 0.5s ease-in-out; box-shadow: 0 0 10px ${barColorValue}44;"></div>
          </div>`;
        container.appendChild(c);
      });
    } catch (err) {
      console.error('Render hatası:', err);
      container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--down);">Veriler yüklenemedi.</div>';
    }
  }

  // ─── MODERN WIDGET LOGIC ──────────────────────────────────────
  function updateModernWidget() {
    const widget = document.getElementById('daysModernWidget');
    if (!widget || getComputedStyle(widget).display === 'none') return;
    
    const now = new Date();
    
    // 1. Clock & Date
    const clockEl = document.getElementById('tmwClock');
    const dateEl = document.getElementById('tmwDate');
    if (clockEl) clockEl.textContent = now.toLocaleTimeString('tr-TR', { hour12: false });
    if (dateEl) dateEl.textContent = now.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });

    // 2. Progress Calculations
    // Day Progress
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dayProgress = ((now.getTime() - startOfDay) / 86400000) * 100;
    updateBar('tmwDayBar', 'tmwDayPct', dayProgress);

    // Month Progress
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime();
    const monthProgress = ((now.getTime() - startOfMonth) / (endOfMonth - startOfMonth + 86400000)) * 100;
    updateBar('tmwMonthBar', 'tmwMonthPct', monthProgress);

    // Year Progress
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
    const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59).getTime();
    const yearProgress = ((now.getTime() - startOfYear) / (endOfYear - startOfYear)) * 100;
    updateBar('tmwYearBar', 'tmwYearPct', yearProgress);
  }

  function updateBar(barId, pctId, value) {
    const bar = document.getElementById(barId);
    const pct = document.getElementById(pctId);
    if (bar) bar.style.width = value.toFixed(1) + '%';
    if (pct) pct.textContent = '%' + value.toFixed(1);
  }

  async function updateNextEvent(records) {
    const titleEl = document.getElementById('tmwNextTitle');
    const daysEl = document.getElementById('tmwNextDays');
    if (!titleEl || !daysEl) return;

    if (!records || records.length === 0) {
      titleEl.textContent = "Planlanmış Hedef Yok";
      daysEl.textContent = "0 Gün";
      return;
    }

    const todayMillis = new Date().setHours(0, 0, 0, 0);
    const futureRecords = records
      .map(r => ({
        ...r,
        diff: Math.round((new Date(r.end_date).setHours(0, 0, 0, 0) - todayMillis) / 86400000)
      }))
      .filter(r => r.diff >= 0)
      .sort((a, b) => a.diff - b.diff);

    if (futureRecords.length > 0) {
      const next = futureRecords[0];
      titleEl.textContent = next.title;
      daysEl.textContent = next.diff === 0 ? "Bugün Son Gün!" : next.diff + " Gün Kaldı";
    } else {
      titleEl.textContent = "Yakın Tarihli Hedef Yok";
      daysEl.textContent = "--";
    }
  }

  // ─── BAŞLATMA ───────────────────────────────────────────────
  async function init() {
    updateTodayDisplay();
    await bindEvents();
    await render();
    
    // Modern widget interval (always run, but checks visibility)
    updateModernWidget();
    setInterval(updateModernWidget, 1000);

    console.log('✅ Gün sayacı modülü (Modern & Interactive) başlatıldı');
  }

  return { init, render };
})();