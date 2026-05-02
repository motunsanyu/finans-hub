// js/modules/school.js — Taksit Yönetimi Modülü (Supabase Entegrasyonlu)

const SchoolModule = (() => {

  function getSB() {
    return window._supabaseClient;
  }

  // ─── OLAY BAĞLAMA ───────────────────────────────────────────
  function bindEvents() {
    const unevenToggle = document.getElementById("schoolUnevenToggle");
    const unevenWrap = document.getElementById("schoolUnevenWrap");
    if (unevenToggle) {
      unevenToggle.addEventListener("change", (e) => {
        unevenWrap.style.display = e.target.checked ? "flex" : "none";
        document.getElementById("unevenNo").required = e.target.checked;
        document.getElementById("unevenAmount").required = e.target.checked;
        if (!e.target.checked) {
          document.getElementById("unevenNo").value = '';
          document.getElementById("unevenAmount").value = '';
        }
      });
    }

    const form = document.getElementById("newSchoolForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("schoolChildName").value.trim();
        const totalDebt = parseVal(document.getElementById("schoolTotalDebt").value);
        const instCount = Number(document.getElementById("schoolInstCount").value);
        const firstDate = document.getElementById("schoolFirstDate").value;

        if (!name || totalDebt <= 0 || instCount <= 1 || !firstDate) return alert("Hatalı giriş!");

        const hasUneven = unevenToggle?.checked || false;
        let unevenNos = [];
        let uAmt = 0;

        if (hasUneven) {
          const uNoRaw = document.getElementById("unevenNo").value.trim();
          uAmt = parseVal(document.getElementById("unevenAmount").value);
          if (!uNoRaw || uAmt <= 0) return alert("Farklı taksit bilgisi gerekli!");
          unevenNos = uNoRaw.split('/').map(s => Number(s.trim())).filter(n => n > 0);
          const totalUneven = uAmt * unevenNos.length;
          if (totalUneven >= totalDebt) return alert("Taksit toplamı ana borca eşit veya büyük olamaz!");
        }

        const normalCount = instCount - unevenNos.length;
        const totalUnevenAmount = uAmt * unevenNos.length;
        const am = normalCount > 0 ? (totalDebt - totalUnevenAmount) / normalCount : totalDebt / instCount;

        let [y, m, day] = firstDate.split('-').map(Number);
        const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);

        try {
          const { data: { user } } = await getSB().auth.getUser();

          // Planı oluştur
          const { data: plan } = await getSB()
            .from('school_plans')
            .insert({ user_id: user.id, name, total_debt: totalDebt })
            .select('id')
            .single();

          if (!plan) throw new Error('Plan oluşturulamadı');

          // Taksitleri oluştur
          const records = [];
          for (let i = 0; i < instCount; i++) {
            let iD = new Date(y, m - 1 + i, 1);
            iD.setDate(Math.min(day, new Date(iD.getFullYear(), iD.getMonth() + 1, 0).getDate()));
            const dueDate = iD.toISOString().split('T')[0];
            const isPast = new Date(dueDate) < todayMidnight;
            const thisAm = unevenNos.includes(i + 1) ? uAmt : am;
            records.push({
              plan_id: plan.id,
              no: i + 1,
              due_date: dueDate,
              amount: thisAm,
              paid: isPast
            });
          }

          await getSB().from('school_records').insert(records);

          form.reset();
          if (unevenToggle) { unevenToggle.checked = false; unevenWrap.style.display = "none"; }
          const det = document.getElementById("newSchoolDetails"); if (det) det.removeAttribute("open");
          await render();
        } catch (err) {
          console.error('Taksit ekleme hatası:', err.message);
          alert('Plan eklenirken hata oluştu!');
        }
      });
    }

    document.getElementById('schoolPlansContainer').addEventListener('click', async (e) => {
      if (e.target.classList.contains('btn-toggle-school')) {
        const recId = e.target.dataset.recId;
        try {
          const { data: rec } = await getSB()
            .from('school_records')
            .select('paid')
            .eq('id', recId)
            .single();

          if (rec) {
            await getSB()
              .from('school_records')
              .update({ paid: !rec.paid })
              .eq('id', recId);
            await render();
          }
        } catch (err) {
          console.error('Durum güncellenemedi:', err.message);
        }
      }

      if (e.target.classList.contains('delete-plan-btn') && confirm('Bu planı tümüyle silmek istediğinize emin misiniz?')) {
        const planId = e.target.dataset.id;
        try {
          await getSB().from('school_plans').delete().eq('id', planId);
          await render();
        } catch (err) {
          console.error('Plan silinemedi:', err.message);
        }
      }
    });
  }

  // ─── RENDER ──────────────────────────────────────────────────
  async function render() {
    const container = document.getElementById("schoolPlansContainer");
    if (!container) return;
    container.innerHTML = "";

    try {
      // Önce süresi geçenleri otomatik öde
      const today = new Date().toISOString().split('T')[0];
      await getSB()
        .from('school_records')
        .update({ paid: true })
        .eq('paid', false)
        .lt('due_date', today);

      // Planları çek
      const { data: plans } = await getSB()
        .from('school_plans')
        .select('*');

      if (!plans || plans.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:32px; color:var(--text-secondary);">Henüz bir taksit planı yok.</div>';
        setText("grandSchoolDebt", formatCurrency(0));
        setText("grandSchoolInstallment", 0);
        return;
      }

      let grandDebt = 0;
      let maxInst = 0;

      for (const plan of plans) {
        const { data: records } = await getSB()
          .from('school_records')
          .select('*')
          .eq('plan_id', plan.id)
          .order('no', { ascending: true });

        if (!Array.isArray(records) || records.length === 0) continue;

        const unpaidRows = records.filter(r => !r.paid);
        const childDebt = unpaidRows.reduce((a, r) => a + Number(r.amount), 0);
        const totalDebt = plan.total_debt;
        const paidCount = records.filter(r => r.paid).length;
        const progressPct = records.length > 0 ? Math.round((paidCount / records.length) * 100) : 0;
        grandDebt += childDebt;
        maxInst = Math.max(maxInst, unpaidRows.length);

        const article = document.createElement("details");
        article.className = "panel";
        article.style.marginBottom = "24px";
        article.style.padding = "0";
        article.style.overflow = "hidden";
        article.style.border = "1px solid var(--line)";

        let tbodyHtml = "";
        for (const r of records) {
          tbodyHtml += `<tr>
            <td style="color:var(--text-secondary);">${r.no}</td>
            <td><span style="font-size:12px; color:var(--text-secondary);">Vade: ${formatDateShortYY(r.due_date)}</span><br><b>${formatCurrency(r.amount)}</b></td>
            <td style="text-align:center;">${r.paid ? `<button class="badge paid btn-toggle-school" data-rec-id="${r.id}">ÖDENDİ</button>` : `<button class="badge unpaid btn-toggle-school" data-rec-id="${r.id}">BEKLİYOR</button>`}</td>
          </tr>`;
        }

        article.innerHTML = `
          <summary style="padding:16px; cursor:pointer; list-style:none; outline:none; display:block;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
              <h3 style="font-size:16px; margin-right:8px; word-break:break-word;">${plan.name}</h3>
              <div style="text-align:right;">
                <div style="font-size:10px; color:var(--text-secondary); margin-bottom:2px;">Toplam: <span style="color:var(--brand)">${formatCurrency(totalDebt)}</span></div>
                <div style="font-size:10px; color:var(--text-secondary); margin-bottom:4px;">Kalan Borç</div>
                <div style="color:var(--text-primary); font-size:17px; font-weight:800; font-family:'Space Grotesk', monospace;">${formatCurrency(childDebt)}</div>
              </div>
            </div>
            <div style="height:4px; background:rgba(255,255,255,0.05); border-radius:2px; margin-bottom:10px; overflow:hidden;">
              <div style="height:100%; width:${progressPct}%; background:var(--up); border-radius:2px; transition:width 0.5s;"></div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--text-secondary); border-top:1px solid rgba(255,255,255,0.05); padding-top:10px;">
              <span>Kalan: <strong style="color:var(--text-primary)">${unpaidRows.length} Taksit</strong></span>
              <span style="color:var(--brand); display:flex; align-items:center; gap:4px; font-weight:800;">Liste / Yönet 🔽</span>
            </div>
          </summary>
          <div style="border-top:1px solid var(--line); background: var(--bg-hover);">
            <div style="padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:12px; color:var(--text-secondary);">Taksit Listesi</span>
              <button class="btn danger-btn delete-plan-btn" data-id="${plan.id}" style="padding:4px 10px; font-size:11px;">Tüm Planı Sil</button>
            </div>
            <div class="table-wrap" style="margin:0; border:none; border-radius:0;">
              <table class="school-table" style="background:var(--bg-primary);">
                <thead><tr><th>No</th><th>Tutar</th><th style="text-align:center;">Durum</th></tr></thead>
                <tbody>${tbodyHtml}</tbody>
              </table>
            </div>
          </div>`;
        container.appendChild(article);
      }

      setText("grandSchoolDebt", formatCurrency(grandDebt));
      setText("grandSchoolInstallment", maxInst);

      const vInst = document.getElementById("vaultInstDebt");
      if (vInst) vInst.textContent = formatCurrency(grandDebt);

      if (typeof VaultModule !== 'undefined' && VaultModule.updateSmartSelector) {
        await VaultModule.updateSmartSelector();
      }
    } catch (err) {
      console.error('Taksit render hatası:', err.message);
      container.innerHTML = '<div style="text-align:center; padding:32px; color:var(--down);">Veriler yüklenemedi.</div>';
    }
  }

  // ─── BAŞLATMA ───────────────────────────────────────────────
  async function init() {
    bindEvents();
    await render();
    console.log('✅ Taksit modülü (Supabase) başlatıldı');
  }

  return { init, render };
})();