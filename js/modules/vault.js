// js/modules/vault.js — Kasa (Vault) Modülü (Supabase Entegrasyonlu)

const VaultModule = (() => {

  // Supabase client'a kısayol
  function getSB() {
    return window._supabaseClient;
  }

  // ═══════════════ AKILLI SEÇİCİ (Taksit Bağlantısı) ═══════════════
  async function updateSmartSelector() {
    const sel = document.getElementById("vaultSmartSelect");
    if (!sel) return;

    sel.innerHTML = '<option value="">-- (Manuel) Giriş --</option>';

    try {
      // Supabase'den aktif taksit planlarını çek
      const { data: plans } = await getSB()
        .from('school_plans')
        .select('id, name');

      if (!plans) return;

      for (const plan of plans) {
        // Her plan için ödenmemiş kayıtları al
        const { data: records } = await getSB()
          .from('school_records')
          .select('*')
          .eq('plan_id', plan.id)
          .eq('paid', false)
          .order('due_date', { ascending: true })
          .limit(1);

        if (records && records.length > 0) {
          const nextPay = records[0];

          // Bu taksit zaten kasaya eklenmiş mi?
          const { data: alreadyInVault } = await getSB()
            .from('vault_records')
            .select('id')
            .eq('linked_rec_id', nextPay.id);

          if (!alreadyInVault || alreadyInVault.length === 0) {
            const opt = document.createElement("option");
            opt.value = JSON.stringify({
              name: plan.name,
              amount: nextPay.amount,
              date: nextPay.due_date,
              linkedRecId: nextPay.id
            });
            opt.textContent = `[Bekleyen] ${plan.name} (₺${Number(nextPay.amount).toLocaleString('tr-TR')})`;
            sel.appendChild(opt);
          }
        }
      }
    } catch (e) {
      console.warn('Akıllı seçici güncellenemedi:', e.message);
    }
  }

  // ═══════════════ OLAY BAĞLAMA ═══════════════
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
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const date = document.getElementById("vaultDate").value;
        const title = document.getElementById("vaultTitle").value;
        const amount = parseVal(document.getElementById("vaultAmountInput").value);
        const type = document.getElementById("vaultType").value;
        const linkedRecId = smartSel ? smartSel.dataset.pendingLinkedRecId : "";

        if (!date || !title || amount <= 0) return;

        try {
          await getSB().from('vault_records').insert({
            user_id: (await getSB().auth.getUser()).data.user.id,
            date: date,
            title: title,
            amount: amount,
            type: type,
            linked_rec_id: linkedRecId || null
          });

          form.reset();
          document.getElementById("newVaultDetails").removeAttribute("open");
          if (smartSel) { smartSel.value = ""; smartSel.dataset.pendingLinkedRecId = ""; }

          await updateSmartSelector();
          await render();
        } catch (err) {
          console.error('Kasa kaydı eklenemedi:', err.message);
          alert('Kayıt eklenirken bir hata oluştu!');
        }
      });
    }

    document.getElementById("vaultListContainer").addEventListener("click", async (e) => {
      if (e.target.classList.contains("vault-del-btn") && confirm("Kasa kaydı silinsin mi?")) {
        const id = e.target.dataset.id;
        try {
          await getSB().from('vault_records').delete().eq('id', id);
          await render();
          await updateSmartSelector();
        } catch (err) {
          console.error('Silme hatası:', err.message);
        }
      }
    });

    document.getElementById("clearAllVaultBtn").addEventListener("click", async () => {
      if (confirm("Tüm kasa dökümü SİLİNECEK. Emin misiniz?")) {
        try {
          const { data: { user } } = await getSB().auth.getUser();
          await getSB().from('vault_records').delete().eq('user_id', user.id);
          await render();
          await updateSmartSelector();
        } catch (err) {
          console.error('Toplu silme hatası:', err.message);
        }
      }
    });
  }

  // ═══════════════ RENDER ═══════════════
  async function render() {
    let income = 0;
    let expense = 0;
    const container = document.getElementById("vaultListContainer");
    if (!container) return;
    container.innerHTML = "";

    try {
      const { data: records } = await getSB()
        .from('vault_records')
        .select('*')
        .order('date', { ascending: false });

      if (!records || records.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-secondary);">Henüz kasa kaydı bulunmuyor.</div>';
        document.getElementById("vaultNetBalance").textContent = '₺0';
        return;
      }

      const groups = {};
      const monthsTr = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

      for (const r of records) {
        if (r.type === "income") income += Number(r.amount);
        else expense += Number(r.amount);

        const d = new Date(r.date);
        const gKey = monthsTr[d.getMonth()] + " " + d.getFullYear();
        if (!groups[gKey]) groups[gKey] = { income: 0, expense: 0, recs: [] };
        groups[gKey].recs.push(r);
        if (r.type === "income") groups[gKey].income += Number(r.amount);
        else groups[gKey].expense += Number(r.amount);
      }

      for (const [gName, data] of Object.entries(groups)) {
        const netGroup = data.income - data.expense;
        const det = document.createElement("details");
        det.className = "panel";
        det.style.padding = "0";
        det.style.overflow = "hidden";
        det.style.marginBottom = "16px";
        det.style.border = "1px solid rgba(255,255,255,0.05)";

        let tbodyHtml = "";
        for (const r of data.recs) {
          const isInc = r.type === "income";
          tbodyHtml += `<tr>
            <td style="font-size:10px;">${formatDateShortYY(r.date)}</td>
            <td style="font-size:12px; word-break:break-word;"><b>${r.title}</b></td>
            <td style="font-size:11px; text-align:right; font-weight:800; font-family:'Space Grotesk', monospace; color:${isInc ? 'var(--up)' : 'var(--text-primary)'}">${isInc ? '+' : '-'}${formatNumber(r.amount, 0)}</td>
            <td style="text-align:right; width:20px; padding:8px 0;"><button type="button" class="btn danger-btn vault-del-btn" data-id="${r.id}" style="padding:4px; font-size:10px;">X</button></td>
          </tr>`;
        }

        det.innerHTML = `
          <summary style="padding:16px; font-weight:800; display:flex; justify-content:space-between; cursor:pointer; outline:none; background:rgba(0,0,0,0.2); list-style:none;">
            <span>📁 ${gName}</span>
            <span style="color:${netGroup < 0 ? 'var(--down)' : 'var(--up)'}">${netGroup < 0 ? '' : '+'}${formatCurrency(netGroup)}</span>
          </summary>
          <div class="table-wrap" style="border:none; border-radius:0; margin:0;"><table><tbody>${tbodyHtml}</tbody></table></div>`;
        container.appendChild(det);
      }

      const net = income - expense;
      const netEl = document.getElementById("vaultNetBalance");
      if (netEl) {
        netEl.textContent = formatCurrency(net);
        netEl.style.color = net < 0 ? "var(--down)" : "var(--up)";
      }
    } catch (err) {
      console.error('Kasa render hatası:', err.message);
      container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--down);">Veriler yüklenemedi.</div>';
    }
  }

  // ═══════════════ BAŞLATMA ═══════════════
  async function init() {
    bindEvents();
    await updateSmartSelector();
    await render();
    console.log('✅ Kasa modülü (Supabase) başlatıldı');
  }

  return { init, render, updateSmartSelector };
})();