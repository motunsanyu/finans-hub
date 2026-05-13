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

  // ═══════════════ ADD RECORD (Public) ═══════════════
  async function addRecord(type, title, amount, date, linkedRecId = null) {
    if (!date || !title || amount <= 0) return false;

    try {
      const { data: { user } } = await getSB().auth.getUser();
      if (!user) throw new Error('Oturum açık değil');

      await getSB().from('vault_records').insert({
        user_id: user.id,
        date: date,
        title: title,
        amount: amount,
        type: type,
        linked_rec_id: linkedRecId || null
      });

      await updateSmartSelector();
      await render();
      return true;
    } catch (err) {
      console.error('Kasa kaydı eklenemedi:', err.message);
      if (window.showToast) window.showToast('Kayıt eklenirken bir hata oluştu!', 'error');
      return false;
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

        const success = await addRecord(type, title, amount, date, linkedRecId);
        if (success) {
          form.reset();
          document.getElementById("newVaultDetails").removeAttribute("open");
          if (smartSel) { smartSel.value = ""; smartSel.dataset.pendingLinkedRecId = ""; }
        }
      });
    }

    document.getElementById("vaultListContainer").addEventListener("click", async (e) => {
      if (e.target.classList.contains("vault-del-btn")) {
        const id = e.target.dataset.id;
        window.showCustomConfirm("Kasa kaydı silinsin mi?", async () => {
          try {
            await getSB().from('vault_records').delete().eq('id', id);
            await render();
            await updateSmartSelector();
          } catch (err) {
            console.error('Silme hatası:', err.message);
          }
        });
      }
    });

    document.getElementById("clearAllVaultBtn").addEventListener("click", async () => {
      window.showCustomConfirm("Tüm kasa dökümü SİLİNECEK. Emin misiniz?", async () => {
        try {
          const { data: { user } } = await getSB().auth.getUser();
          await getSB().from('vault_records').delete().eq('user_id', user.id);
          await render();
          await updateSmartSelector();
        } catch (err) {
          console.error('Toplu silme hatası:', err.message);
        }
      });
    });
  }

  async function deleteMonth(monthName) {
    window.showCustomConfirm(`${monthName} ayına ait TÜM kayıtlar silinecek. Emin misiniz?`, async () => {
      try {
        const { data: { user } } = await getSB().auth.getUser();
        if (!user) return;

        // Ay adından ay indexini ve yılı bul
        const monthsTr = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
        const parts = monthName.split(" ");
        const mIdx = monthsTr.indexOf(parts[0]);
        const year = parseInt(parts[1]);

        if (mIdx === -1 || isNaN(year)) throw new Error("Geçersiz ay formatı");

        const startDate = new Date(year, mIdx, 1).toISOString().split('T')[0];
        const endDate = new Date(year, mIdx + 1, 0).toISOString().split('T')[0];

        await getSB()
          .from('vault_records')
          .delete()
          .eq('user_id', user.id)
          .gte('date', startDate)
          .lte('date', endDate);

        if (window.showToast) window.showToast(`${monthName} dökümü temizlendi.`, 'success');
        await render();
        await updateSmartSelector();
      } catch (err) {
        console.error('Ay silme hatası:', err.message);
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
          <summary style="padding:16px; font-weight:800; display:flex; justify-content:space-between; align-items:center; cursor:pointer; outline:none; background:rgba(0,0,0,0.2); list-style:none;">
            <div style="display:flex; align-items:center; gap:12px;">
              <span>📁 ${gName}</span>
              <button type="button" class="month-clear-btn" data-month="${gName}" style="background:rgba(239,83,80,0.1); border:none; color:#ef5350; padding:2px 6px; border-radius:4px; font-size:9px; font-weight:800; cursor:pointer;">TEMİZLE</button>
            </div>
            <span style="color:${netGroup < 0 ? 'var(--down)' : 'var(--up)'}">${netGroup < 0 ? '' : '+'}${formatCurrency(netGroup)}</span>
          </summary>
          <div class="table-wrap" style="border:none; border-radius:0; margin:0;"><table><tbody>${tbodyHtml}</tbody></table></div>`;
        container.appendChild(det);
      }

      // Ay silme butonlarına olay bağla
      container.querySelectorAll('.month-clear-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          deleteMonth(btn.dataset.month);
        });
      });

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

  // ═══════════════ DÜZENLİ İŞLEMLER (Maaş vb.) ═══════════════
  const REC_STORAGE_KEY = 'finansApp_vaultRecurring';
  let recurringTemplates = [];

  function loadRecurring() {
    const data = localStorage.getItem(REC_STORAGE_KEY);
    recurringTemplates = data ? JSON.parse(data) : [];
  }

  function saveRecurring() {
    localStorage.setItem(REC_STORAGE_KEY, JSON.stringify(recurringTemplates));
    renderRecurring();
  }

  async function processRecurring() {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonthYear = `${today.getMonth() + 1}-${today.getFullYear()}`;
    let changed = false;

    for (const rec of recurringTemplates) {
      if (!rec.processedMonths) rec.processedMonths = [];
      
      // Bugün belirtilen günden büyük veya eşitse VE bu ay henüz işlenmemişse
      if (currentDay >= rec.day && !rec.processedMonths.includes(currentMonthYear)) {
        const recordDate = new Date(today.getFullYear(), today.getMonth(), rec.day).toISOString().split('T')[0];
        const success = await addRecord(rec.type, `🔄 Otomatik: ${rec.title}`, rec.amount, recordDate);
        
        if (success) {
          rec.processedMonths.push(currentMonthYear);
          changed = true;
          if (window.showToast) window.showToast(`✅ Otomatik işlem: ${rec.title} kasaya eklendi.`, 'success');
        }
      }
    }

    if (changed) saveRecurring();
  }

  function renderRecurring() {
    const container = document.getElementById('recurringListContainer');
    if (!container) return;

    if (recurringTemplates.length === 0) {
      container.innerHTML = '<div style="font-size:12px; color:var(--text-secondary); text-align:center; padding:12px;">Henüz düzenli işlem tanımlanmadı.</div>';
      return;
    }

    container.innerHTML = recurringTemplates.map((rec, idx) => `
      <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:13px; font-weight:800; color:white;">${rec.title}</div>
          <div style="font-size:11px; color:var(--text-secondary);">Her ayın ${rec.day}. günü • ${rec.type === 'income' ? 'Gelir' : 'Gider'}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:14px; font-weight:800; color:${rec.type === 'income' ? 'var(--up)' : 'var(--text-primary)'}; font-family:'Space Grotesk', monospace;">₺${formatNumber(rec.amount, 0)}</div>
          <div style="display:flex; gap:6px; justify-content:flex-end; margin-top:4px;">
            <button onclick="VaultModule.editRecurring(${idx})" style="background:none; border:none; color:var(--brand); font-size:10px; font-weight:800; cursor:pointer;">DÜZENLE</button>
            <button onclick="VaultModule.deleteRecurring(${idx})" style="background:none; border:none; color:#ef5350; font-size:10px; font-weight:800; cursor:pointer;">SİL</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  function addRecurring() {
    const title = document.getElementById('recTitle').value.trim();
    const amount = parseVal(document.getElementById('recAmount').value);
    const day = parseInt(document.getElementById('recDay').value);
    const type = document.getElementById('recType').value;

    if (!title || isNaN(amount) || amount <= 0 || isNaN(day) || day < 1 || day > 31) {
      if (window.showToast) window.showToast('Lütfen geçerli bilgiler girin.', 'error');
      return;
    }

    recurringTemplates.push({
      title, amount, day, type,
      processedMonths: [],
      createdAt: new Date().toISOString()
    });

    saveRecurring();
    processRecurring();
    
    document.getElementById('recTitle').value = '';
    document.getElementById('recAmount').value = '';
    document.getElementById('recDay').value = '';
    if (window.showToast) window.showToast('✅ Düzenli işlem kaydedildi.', 'success');
  }

  function deleteRecurring(idx) {
    window.showCustomConfirm('Bu düzenli işlemi silmek istediğinize emin misiniz? Gelecek aylar için otomatik kayıt yapılmayacak.', () => {
      recurringTemplates.splice(idx, 1);
      saveRecurring();
    });
  }

  function editRecurring(idx) {
    const rec = recurringTemplates[idx];
    document.getElementById('recTitle').value = rec.title;
    document.getElementById('recAmount').value = formatNumber(rec.amount, 0);
    document.getElementById('recDay').value = rec.day;
    document.getElementById('recType').value = rec.type;
    
    // Eski kaydı sil (güncelleme yerine silip tekrar ekle mantığı)
    recurringTemplates.splice(idx, 1);
    saveRecurring();
    
    document.getElementById('recurringVaultPanel').open = true;
    document.getElementById('recTitle').focus();
    if (window.showToast) window.showToast('📝 Düzenleme moduna geçildi.', 'info');
  }

  // ═══════════════ BAŞLATMA ═══════════════
  async function init() {
    loadRecurring();
    bindEvents();
    
    // Düzenli işlem butonunu bağla
    const addRecBtn = document.getElementById('addRecurringBtn');
    if (addRecBtn) addRecBtn.onclick = addRecurring;

    await updateSmartSelector();
    await render();
    renderRecurring();
    await processRecurring();
    
    console.log('✅ Kasa modülü (Otomatik Ödeme Entegrasyonlu) başlatıldı');
  }

  return { init, render, updateSmartSelector, addRecord, deleteRecurring, editRecurring };
})();