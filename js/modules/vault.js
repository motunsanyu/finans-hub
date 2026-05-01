// js/modules/vault.js — Kasa (Vault) Modülü

const VaultModule = (() => {

  // ─── AKILLI SEÇİCİ ──────────────────────────────────────────
  function updateSmartSelector() {
    if (!state || !state.school) return; // güvence
    const sel = document.getElementById("vaultSmartSelect");
    if (!sel) return;
    sel.innerHTML = '<option value="">-- El İle (Manuel) Kendim Gireceğim --</option>';
    state.school.forEach(plan => {
      const unpaidRows = plan.records.filter(r => !r.paid).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
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

  // ─── OLAY BAĞLAMA ───────────────────────────────────────────
  function bindEvents() {
    const smartSel = document.getElementById("vaultSmartSelect");
    if (smartSel) {
      smartSel.addEventListener("change", (e) => {
        if (e.target.value) {
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

    const form = document.getElementById("vaultForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const date = document.getElementById("vaultDate").value;
        const title = document.getElementById("vaultTitle").value;
        const amount = parseVal(document.getElementById("vaultAmountInput").value);
        const type = document.getElementById("vaultType").value;
        const linkedRecId = smartSel ? smartSel.dataset.pendingLinkedRecId : "";

        if (!date || !title || amount <= 0) return;
        state.vaultRecords.push({ id: crypto.randomUUID(), date, title, amount, type, linkedRecId });
        writeStorage(STORAGE_KEYS.vault, state.vaultRecords);

        form.reset(); document.getElementById("newVaultDetails").removeAttribute("open");
        if (smartSel) { smartSel.value = ""; smartSel.dataset.pendingLinkedRecId = ""; }

        updateSmartSelector();
        render();
      });
    }

    document.getElementById("vaultListContainer").addEventListener("click", (e) => {
      if (e.target.classList.contains("vault-del-btn") && confirm("Kasa kaydı silinsin mi?")) {
        state.vaultRecords = state.vaultRecords.filter(r => r.id !== e.target.dataset.id);
        writeStorage(STORAGE_KEYS.vault, state.vaultRecords);
        render(); updateSmartSelector();
      }
    });

    document.getElementById("clearAllVaultBtn").addEventListener("click", () => {
      if (confirm("Tüm kasa dökümü SİLİNECEK. Emin misiniz?")) {
        state.vaultRecords = [];
        writeStorage(STORAGE_KEYS.vault, state.vaultRecords);
        render(); updateSmartSelector();
      }
    });
  }

  // ─── RENDER ──────────────────────────────────────────────────
  function render() {
    let income = 0; let expense = 0;
    const container = document.getElementById("vaultListContainer");
    if (!container) return; container.innerHTML = "";

    const groups = {};
    const monthsTr = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

    [...state.vaultRecords].sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(r => {
      if (r.type === "income") income += Number(r.amount); else expense += Number(r.amount);

      const d = new Date(r.date);
      const gKey = monthsTr[d.getMonth()] + " " + d.getFullYear();
      if (!groups[gKey]) groups[gKey] = { income: 0, expense: 0, recs: [] };
      groups[gKey].recs.push(r);
      if (r.type === "income") groups[gKey].income += Number(r.amount); else groups[gKey].expense += Number(r.amount);
    });

    for (const [gName, data] of Object.entries(groups)) {
      const netGroup = data.income - data.expense;
      const det = document.createElement("details");
      det.className = "panel"; det.style.padding = "0"; det.style.overflow = "hidden"; det.style.marginBottom = "16px"; det.style.border = "1px solid rgba(255,255,255,0.05)";

      let tbodyHtml = "";
      data.recs.forEach(r => {
        const isInc = r.type === "income";
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
    if (netEl) { netEl.textContent = formatCurrency(net); netEl.style.color = net < 0 ? "var(--down)" : "var(--up)"; }
  }

  // ─── BAŞLATMA (INIT) ────────────────────────────────────────
  function init() {
    bindEvents();
    updateSmartSelector();
    render();
    console.log('✅ Kasa modülü başlatıldı');
  }

  return { init, render, updateSmartSelector };
})();