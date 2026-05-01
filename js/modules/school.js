// js/modules/school.js — Taksit Yönetimi Modülü

const SchoolModule = (() => {

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
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = document.getElementById("schoolChildName").value.trim();
        const totalDebt = parseVal(document.getElementById("schoolTotalDebt").value);
        const instCount = Number(document.getElementById("schoolInstCount").value);
        const firstDate = document.getElementById("schoolFirstDate").value;

        if (!name || totalDebt <= 0 || instCount <= 1 || !firstDate) return alert("Hatalı giriş! Tüm alanları doldurun ve vade birden büyük olmalıdır.");

        const hasUneven = unevenToggle?.checked || false;
        let unevenNos = [];
        let uAmt = 0;

        if (hasUneven) {
          const uNoRaw = document.getElementById("unevenNo").value.trim();
          uAmt = parseVal(document.getElementById("unevenAmount").value);

          if (!uNoRaw || uAmt <= 0) return alert("Farklı taksit numarası ve tutarı girilmelidir!");

          unevenNos = uNoRaw.split('/').map(s => Number(s.trim())).filter(n => n > 0);

          for (const num of unevenNos) {
            if (num < 1 || num > instCount) return alert(`Farklı taksit numarası (${num}) 1 ile ${instCount} arasında olmalıdır!`);
          }

          const totalUneven = uAmt * unevenNos.length;
          if (totalUneven >= totalDebt) return alert(`Farklı taksitlerin toplamı (₺${totalUneven}), toplam borca (₺${totalDebt}) eşit veya fazla olamaz!`);
        }

        const normalCount = instCount - unevenNos.length;
        const totalUnevenAmount = uAmt * unevenNos.length;
        const am = normalCount > 0 ? (totalDebt - totalUnevenAmount) / normalCount : totalDebt / instCount;

        let [y, m, day] = firstDate.split('-').map(Number);
        let todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
        const newPlan = { id: crypto.randomUUID(), name, totalDebt, records: [] };

        for (let i = 0; i < instCount; i++) {
          let iD = new Date(y, m - 1 + i, 1);
          iD.setDate(Math.min(day, new Date(iD.getFullYear(), iD.getMonth() + 1, 0).getDate()));
          let oy = iD.getFullYear(), om = String(iD.getMonth() + 1).padStart(2, '0'), od = String(iD.getDate()).padStart(2, '0');
          let isPast = iD.getTime() < todayMidnight.getTime();
          let thisAm = unevenNos.includes(i + 1) ? uAmt : am;
          newPlan.records.push({ id: crypto.randomUUID(), no: i + 1, dueDate: `${oy}-${om}-${od}`, amount: thisAm, paid: isPast });
        }

        state.school.push(newPlan); writeStorage(STORAGE_KEYS.school, state.school); render(); form.reset();
        if (unevenToggle) { unevenToggle.checked = false; unevenWrap.style.display = "none"; }
        const det = document.getElementById("newSchoolDetails"); if (det) det.removeAttribute("open");
      });
    }

    document.getElementById('schoolPlansContainer').addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-toggle-school')) {
        const plan = state.school.find(p => p.id === e.target.dataset.planId);
        if (plan) { const r = plan.records.find(i => i.id === e.target.dataset.recId); if (r) { r.paid = !r.paid; writeStorage(STORAGE_KEYS.school, state.school); render(); } }
      }
      if (e.target.classList.contains('delete-plan-btn') && confirm('Bu kişi profilini ve tüm taksitlerini SİLMEK istediğinize emin misiniz?')) {
        state.school = state.school.filter(p => p.id !== e.target.dataset.id); writeStorage(STORAGE_KEYS.school, state.school); render();
      }
    });
  }

  // ─── RENDER ──────────────────────────────────────────────────
  function render() {
    let grandDebt = 0; let maxInst = 0; const container = document.getElementById("schoolPlansContainer"); if (!container) return; container.innerHTML = "";
    const todayMs = new Date().setHours(0, 0, 0, 0);
    const beforeCount = state.school.length;

    let stateChanged = false;
    state.school.forEach(plan => {
      plan.records.forEach(r => {
        if (!r.paid) {
          const dueDateObj = new Date(r.dueDate);
          dueDateObj.setHours(0, 0, 0, 0);
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
      const unpaidRows = plan.records.filter(r => !r.paid);
      const childDebt = unpaidRows.reduce((a, r) => a + Number(r.amount), 0);
      const totalDebt = plan.totalDebt || plan.records.reduce((a, r) => a + Number(r.amount), 0);
      const paidCount = plan.records.filter(r => r.paid).length;
      const progressPct = plan.records.length > 0 ? Math.round((paidCount / plan.records.length) * 100) : 0;
      grandDebt += childDebt;
      maxInst = Math.max(maxInst, unpaidRows.length);
      const article = document.createElement("details"); article.className = "panel"; article.style.marginBottom = "24px"; article.style.padding = "0"; article.style.overflow = "hidden"; article.style.border = "1px solid var(--line)";

      let tbodyHtml = "";
      [...plan.records].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).forEach(r => {
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
    
    // Vault modülünün akıllı seçicisini güncelle
    if (typeof VaultModule !== 'undefined' && VaultModule.updateSmartSelector) {
      VaultModule.updateSmartSelector();
    }
  }

  // ─── BAŞLATMA (INIT) ────────────────────────────────────────
  function init() {
    bindEvents();
    render();
    console.log('✅ Taksit modülü başlatıldı');
  }

  return { init, render };
})();