// js/modules/days.js — Gün Sayacı / Geri Sayım Modülü (Supabase Entegrasyonlu)

const DaysModule = (() => {

  function getSB() {
    return window._supabaseClient;
  }

  // ─── OLAY BAĞLAMA ───────────────────────────────────────────
  async function bindEvents() {
    // 24 saat kuralı: Süresi dolan sayaçları 1 gün sonra otomatik temizle
    try {
      const today = new Date().toISOString().split('T')[0];
      // Bugünden önce bitmiş ve üzerinden 1 gün geçmiş hedefleri sil
      await getSB()
        .from('day_records')
        .delete()
        .lt('end_date', today);
    } catch (e) {
      console.warn('Eski gün kayıtları temizlenemedi:', e.message);
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
        console.error('Gün kaydı eklenemedi:', err.message);
        alert('Hedef eklenirken hata oluştu!');
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

      for (const r of activeRecords) {
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

        const createdDate = r.created_at ? new Date(r.created_at).setHours(0, 0, 0, 0) : new Date(r.end_date).setHours(0, 0, 0, 0) - 14 * 86400000;
        const targetMillis = new Date(r.end_date).setHours(0, 0, 0, 0);
        const totalSpan = Math.max(1, Math.round((targetMillis - createdDate) / 86400000));
        const elapsed = totalSpan - Math.max(0, r.days);
        const rawPct = isPast ? 100 : Math.min(100, Math.max(0, Math.round((elapsed / totalSpan) * 100)));
        const displayPct = Math.max(5, rawPct);
        const barColorValue = isPast ? '#ff3b3b' : r.days <= 3 ? '#ff9800' : r.days <= 5 ? '#00e676' : '#fcd535';

        const c = document.createElement("div");
        c.className = "panel";
        c.style.marginBottom = "12px";
        c.style.padding = "16px";
        c.style.borderLeft = `4px solid ${color}`;
        c.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
            <div>
              <div style="font-size:15px; font-weight:800; color:var(--text-primary);">${r.title}</div>
              <div style="font-size:12px; color:var(--text-secondary);">Hedef: ${formatDate(r.end_date)}</div>
            </div>
            <div style="text-align:right;">
              <div style="color:${color}; font-size:16px; font-weight:800;">${daysText}</div>
              <button class="badge unpaid btn-del-day" data-id="${r.id}" style="margin-top:4px;">Sil</button>
            </div>
          </div>
          <div style="height:6px; background:rgba(255,255,255,0.1); border-radius:3px; overflow:hidden;">
            <div style="height:100%; width:${displayPct}%; background:${barColorValue}; border-radius:3px; transition:width 0.5s ease-in-out;"></div>
          </div>`;
        container.appendChild(c);
      }
    } catch (err) {
      console.error('Gün sayacı render hatası:', err.message);
      container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--down);">Veriler yüklenemedi.</div>';
    }
  }

  // ─── BAŞLATMA ───────────────────────────────────────────────
  async function init() {
    await bindEvents();
    await render();
    console.log('✅ Gün sayacı modülü (Supabase) başlatıldı');
  }

  return { init, render };
})();