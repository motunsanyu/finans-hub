// js/modules/school.js — Taksit Yönetimi (Gelişmiş Kredi Kartı Desteği, Pro Görünüm)

const SchoolModule = (() => {
  // Storage anahtarları
  const STORAGE_KEY = 'finansApp_schoolRecords';
  const CARDS_STORAGE_KEY = 'finansApp_creditCards';

  let schoolPlans = [];          // Tüm taksit planları

  // ────────── 1. KREDİ KARTI YÖNETİMİ ──────────
  function loadCreditCards() {
    const data = localStorage.getItem(CARDS_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  function saveCreditCards(cards) {
    localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(cards));
  }

  function addCreditCard(name, day) {
    const cards = loadCreditCards();
    const newId = Date.now().toString();
    cards.push({ id: newId, name, day: parseInt(day), createdAt: new Date().toISOString() });
    saveCreditCards(cards);
    renderCreditCardSelect();     // Açılır menüyü güncelle
    renderCreditCardList();       // Kart listesini güncelle
    return newId;
  }

  function deleteCreditCard(id) {
    if (typeof window.showCustomConfirm === 'function') {
      window.showCustomConfirm('Bu kredi kartını silmek istediğinize emin misiniz?', () => {
        let cards = loadCreditCards();
        cards = cards.filter(c => c.id !== id);
        saveCreditCards(cards);
        renderCreditCardSelect();
        renderCreditCardList();
        if (window.showToast) window.showToast('Kart silindi.', 'success');
      });
    } else {
      if (confirm('Kredi kartını sil?')) {
        let cards = loadCreditCards();
        cards = cards.filter(c => c.id !== id);
        saveCreditCards(cards);
        renderCreditCardSelect();
        renderCreditCardList();
      }
    }
  }

  // Kart seçimini doldur (taksit formundaki dropdown)
  function renderCreditCardSelect() {
    const select = document.getElementById('schoolCardSelect');
    if (!select) return;
    const cards = loadCreditCards();
    if (cards.length === 0) {
      select.innerHTML = '<option value="">Önce kart ekleyin</option>';
      select.disabled = true;
    } else {
      select.disabled = false;
      select.innerHTML = '<option value="">-- Kart Seçin --</option>' +
        cards.map(card => `<option value="${card.id}" data-day="${card.day}">${escapeHtml(card.name)} (Kesim: ${card.day})</option>`).join('');
    }
  }

  // Kart listesini göster (yönetim paneli)
  function renderCreditCardList() {
    const container = document.getElementById('creditCardList');
    if (!container) return;
    const cards = loadCreditCards();
    if (cards.length === 0) {
      container.innerHTML = '<div class="info-message" style="padding:12px;">Henüz kart eklenmemiş.</div>';
      return;
    }
    let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
    cards.forEach(card => {
      html += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#1e2329; padding:10px 16px; border-radius:12px;">
                    <div><strong>💳 ${escapeHtml(card.name)}</strong> <span style="color:#9ca3af; font-size:12px;">Kesim: ${card.day}</span></div>
                    <button class="delete-card-btn" data-id="${card.id}" style="background:none; border:none; color:#ef5350; cursor:pointer; padding:6px;">🗑️</button>
                </div>
            `;
    });
    html += '</div>';
    container.innerHTML = html;
    // Silme butonlarına olay bağla
    document.querySelectorAll('.delete-card-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        deleteCreditCard(id);
      });
    });
  }

  // ────────── 2. TAKSİT PLANI YÖNETİMİ ──────────
  function loadPlans() {
    const data = localStorage.getItem(STORAGE_KEY);
    schoolPlans = data ? JSON.parse(data) : [];
    renderPlans();
    updateGrandTotal();
  }

  function savePlans() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schoolPlans));
    renderPlans();
    updateGrandTotal();
  }

  function addPlan(plan) {
    schoolPlans.push(plan);
    savePlans();
  }

  function deletePlan(index) {
    if (typeof window.showCustomConfirm === 'function') {
      window.showCustomConfirm('Bu taksit planını silmek istediğinize emin misiniz?', () => {
        schoolPlans.splice(index, 1);
        savePlans();
        if (window.showToast) window.showToast('Plan silindi.', 'success');
      });
    } else {
      if (confirm('Sil?')) {
        schoolPlans.splice(index, 1);
        savePlans();
      }
    }
  }

  // Taksitlerin ödeme durumunu hesapla (📌 Gelişmiş: Kredi kartı kesim tarihine göre)
  function getInstallmentStatus(dueDate, cardId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    // Nakit: tarih geçmişse ödendi
    if (!cardId) {
      return due < today ? 'Ödendi' : 'Bekleniyor';
    }

    // Kredi kartı mantığı: Hesap kesim tarihine göre
    const cards = loadCreditCards();
    const card = cards.find(c => c.id === cardId);
    if (!card) return 'Bekleniyor';

    const cutoffDay = card.day;          // Hesap kesim günü (1-31)
    const dueDay = due.getDate();
    const dueMonth = due.getMonth();
    const dueYear = due.getFullYear();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Geçmiş yıl/ay kontrolü
    if (dueYear < currentYear) return 'Ödendi';
    if (dueYear === currentYear && dueMonth < currentMonth) return 'Ödendi';

    // Aynı ay içinde: Kesim tarihinden önceyse ve bugün kesim tarihinden sonraysa ödendi
    if (dueYear === currentYear && dueMonth === currentMonth) {
      if (dueDay <= cutoffDay && currentDay >= cutoffDay) return 'Ödendi';
    }

    return 'Bekleniyor';
  }

  // Tüm planları ekrana bas (Yeni Kutu Tasarımı)
  function renderPlans() {
    const container = document.getElementById('schoolPlansContainer');
    if (!container) return;

    if (schoolPlans.length === 0) {
      container.innerHTML = `
        <div style="background:var(--bg-secondary); padding:24px; border-radius:12px; border:1px solid var(--line); text-align:center; color:#848e9c; margin:16px;">
          <div style="font-size:32px; margin-bottom:10px;">📋</div>
          <div style="font-size:14px; font-weight:700;">Henüz taksit planı eklenmemiş.</div>
        </div>`;
      return;
    }

    let html = '';
    schoolPlans.forEach((plan, idx) => {
      const totalDebt = plan.totalDebt;
      const installmentCount = plan.installmentCount;
      const baseAmount = totalDebt / installmentCount;
      const firstDate = new Date(plan.firstDate);
      const card = plan.cardId ? loadCreditCards().find(c => c.id === plan.cardId) : null;
      const paymentType = plan.paymentType === 'card' ? `💳 ${card ? card.name : 'Kart'}` : '💵 Nakit';

      let totalPaid = 0;
      let remainingDebt = 0;
      let paidCount = 0;
      let waitingCount = 0;

      // Taksit listesini ve matematiksel hesaplamaları yap
      let installmentsHtml = '<div style="margin-top:16px; border-top:1px solid rgba(255,255,255,0.05); padding-top:16px;">';
      for (let i = 0; i < installmentCount; i++) {
        const dueDate = new Date(firstDate);
        dueDate.setMonth(firstDate.getMonth() + i);
        const amount = (i === installmentCount - 1 && plan.lastAmount) ? plan.lastAmount : baseAmount;
        const status = getInstallmentStatus(dueDate, plan.cardId);
        
        if (status === 'Ödendi') {
          totalPaid += amount;
          paidCount++;
        } else {
          remainingDebt += amount;
          waitingCount++;
        }

        const statusColor = status === 'Ödendi' ? '#00c087' : 'var(--down)'; // Ödendi = Yeşil
        installmentsHtml += `
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); padding:10px 0;">
            <div style="display:flex; flex-direction:column;">
              <span style="font-size:13px; font-weight:700; color:#fff;">${i + 1}. Taksit</span>
              <span style="font-size:11px; color:#848e9c;">${dueDate.toLocaleDateString('tr-TR')}</span>
            </div>
            <div style="text-align:right;">
              <div style="font-weight:800; font-size:14px; color:#fff;">${formatCurrency(amount)}</div>
              <div style="font-size:11px; font-weight:800; color:${statusColor};">${status.toUpperCase()}</div>
            </div>
          </div>
        `;
      }
      installmentsHtml += '</div>';

      const borderColors = ['#00f5ff', '#ff9f00', '#8b4513', '#006400'];
      const borderColor = borderColors[idx % borderColors.length];

      // Plan Kartı (Details/Summary yapısı)
      html += `
        <details class="school-plan-details" style="background:var(--bg-secondary); border-radius:12px; margin:0 0 16px 0; border:1px dashed ${borderColor}; overflow:hidden; cursor:pointer; box-shadow:0 4px 15px rgba(0,0,0,0.1);">
          <summary style="padding:14px 16px; list-style:none; outline:none; display:block;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div style="flex:1;">
                <h3 style="margin:0; font-size:15px; font-weight:800; color:#fff; letter-spacing:0.3px;">${escapeHtml(plan.name)}</h3>
                <div style="font-size:10px; color:#848e9c; margin-top:2px;">${paymentType}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:9px; color:#848e9c; text-transform:uppercase; letter-spacing:0.5px;">Kalan Borç</div>
                <div style="font-weight:900; color:${borderColor}; font-size:15px;">${formatCurrency(remainingDebt)}</div>
              </div>
            </div>

            <div style="display:flex; gap:8px; margin-top:10px; border-top:1px solid rgba(255,255,255,0.05); padding-top:10px;">
               <div style="flex:1; background:rgba(255,255,255,0.02); padding:6px; border-radius:6px; text-align:center; border:1px solid rgba(255,255,255,0.03);">
                  <div style="font-size:8px; color:#848e9c; text-transform:uppercase;">Toplam</div>
                  <div style="font-size:11px; font-weight:700; color:rgba(255,255,255,0.7);">${formatCurrency(totalDebt)}</div>
               </div>
               <div style="flex:1; background:rgba(255,255,255,0.02); padding:6px; border-radius:6px; text-align:center; border:1px solid rgba(255,255,255,0.03);">
                  <div style="font-size:8px; color:#848e9c; text-transform:uppercase;">Kalan Taksit</div>
                  <div style="font-size:11px; font-weight:700; color:rgba(255,255,255,0.7);">${waitingCount} / ${installmentCount}</div>
               </div>
               <div style="width:24px; display:flex; align-items:center; justify-content:center; color:#848e9c; font-size:10px;">▼</div>
            </div>
          </summary>

          <div style="padding:0 16px 16px; cursor: default;">
            <div style="display:flex; gap:10px; margin-bottom:12px; padding-top:4px;">
              <button class="edit-plan-btn" data-index="${idx}" style="flex:1; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#fff; padding:7px; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; transition:all 0.1s active; outline:none;">✏️ DÜZENLE</button>
              <button class="delete-plan-btn" data-index="${idx}" style="flex:1; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); color:#ef5350; padding:7px; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; transition:all 0.1s active; outline:none;">🗑️ SİL</button>
            </div>
            ${installmentsHtml}
          </div>
        </details>
      `;
    });

    container.innerHTML = html;

    // Silme ve Düzenleme olaylarını bağla
    container.querySelectorAll('.delete-plan-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        if (!isNaN(idx)) deletePlan(idx);
      });
    });
    container.querySelectorAll('.edit-plan-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        if (!isNaN(idx)) editPlan(idx);
      });
    });
  }

  function updateGrandTotal() {
    let grandRemainingDebt = 0;
    let grandTotalWaitingCount = 0;

    schoolPlans.forEach(plan => {
      const totalDebt = plan.totalDebt;
      const installmentCount = plan.installmentCount;
      const baseAmount = totalDebt / installmentCount;
      const firstDate = new Date(plan.firstDate);

      for (let i = 0; i < installmentCount; i++) {
        const dueDate = new Date(firstDate);
        dueDate.setMonth(firstDate.getMonth() + i);
        const amount = (i === installmentCount - 1 && plan.lastAmount) ? plan.lastAmount : baseAmount;
        const status = getInstallmentStatus(dueDate, plan.cardId);
        
        if (status !== 'Ödendi') {
          grandRemainingDebt += amount;
          grandTotalWaitingCount++;
        }
      }
    });

    const el = document.getElementById('grandSchoolDebt');
    if (el) el.textContent = formatCurrency(grandRemainingDebt); // Üstteki toplam kalan borcu gösterir
    const installEl = document.getElementById('grandSchoolInstallment');
    if (installEl) installEl.textContent = grandTotalWaitingCount; // Üstteki toplam kalan taksit sayısını gösterir
  }

  // ────────── 3. FORM İŞLEMLERİ ──────────
  // Yeni taksit planı ekleme formunu işle
  function initForm() {
    const form = document.getElementById('newSchoolForm');
    if (!form) return;

    // Form submit işlemi
    form.onsubmit = (e) => {
      e.preventDefault();
      const name = document.getElementById('schoolChildName').value.trim();
      let totalDebt = parseVal(document.getElementById('schoolTotalDebt').value);
      const instCount = parseInt(document.getElementById('schoolInstCount').value);
      let firstDate = document.getElementById('schoolFirstDate').value;
      const paymentType = document.getElementById('schoolPaymentTypeInput').value;
      let cardId = null;

      if (paymentType === 'card') {
        const cardSelect = document.getElementById('schoolCardSelect');
        cardId = cardSelect.value;
        if (!cardId) {
          if (window.showToast) window.showToast('Lütfen bir kart seçin.', 'error');
          return;
        }
      }

      if (!name || isNaN(totalDebt) || totalDebt <= 0 || !instCount || !firstDate || !paymentType) {
        if (window.showToast) window.showToast('Tüm alanları doldurun.', 'error');
        return;
      }

      const [year, month, day] = firstDate.split('-');
      const correctedDate = new Date(year, month - 1, day);

      const unevenWrap = document.getElementById('schoolUnevenWrap');
      let lastAmount = null;
      if (unevenWrap && unevenWrap.style.display === 'flex') {
        let unevenAmount = parseVal(document.getElementById('unevenAmount').value);
        if (!isNaN(unevenAmount) && unevenAmount > 0) {
          lastAmount = unevenAmount;
        }
      }

      const newPlan = {
        id: Date.now(),
        name,
        totalDebt,
        installmentCount: instCount,
        firstDate: correctedDate.toISOString(),
        paymentType,
        cardId,
        lastAmount: lastAmount || null,
        createdAt: new Date().toISOString()
      };
      addPlan(newPlan);
      form.reset();
      if (window.showToast) window.showToast('Taksit planı eklendi.', 'success');
      if (unevenWrap) unevenWrap.style.display = 'none';
      const unevenBtn = document.getElementById('schoolUnevenBtn');
      if (unevenBtn) {
        unevenBtn.style.borderColor = 'rgba(255,255,255,0.1)';
        unevenBtn.style.color = '#848e9c';
        unevenBtn.textContent = '📎 Farklı Taksit Tutarı Belirle';
      }
    };

    // Farklı taksit butonu olayını bağla (Checkbox yerine Buton)
    const unevenBtn = document.getElementById('schoolUnevenBtn');
    const unevenWrap = document.getElementById('schoolUnevenWrap');
    if (unevenBtn && unevenWrap) {
      unevenBtn.onclick = () => {
        const isHidden = unevenWrap.style.display === 'none' || unevenWrap.style.display === '';
        if (isHidden) {
          unevenWrap.style.display = 'flex';
          unevenBtn.style.borderColor = '#fcd535';
          unevenBtn.style.color = '#fcd535';
          unevenBtn.textContent = '✅ Farklı Tutar Belirleniyor...';
        } else {
          unevenWrap.style.display = 'none';
          unevenBtn.style.borderColor = 'rgba(255,255,255,0.1)';
          unevenBtn.style.color = '#848e9c';
          unevenBtn.textContent = '📎 Farklı Taksit Tutarı Belirle';
        }
      };
    }
  }

  // ────────── 4. KREDİ KARTI EKLEME FORMU ──────────
  function initCardForm() {
    const addCardBtn = document.getElementById('addCreditCardBtn');
    const cardNameInput = document.getElementById('newCardName');
    const cardDayInput = document.getElementById('newCardDay');
    if (addCardBtn && cardNameInput && cardDayInput) {
      addCardBtn.onclick = () => {
        const name = cardNameInput.value.trim();
        const day = parseInt(cardDayInput.value);
        if (!name || isNaN(day) || day < 1 || day > 31) {
          if (window.showToast) window.showToast('Geçerli kart adı ve kesim günü (1-31) girin.', 'error');
          return;
        }
        addCreditCard(name, day);
        cardNameInput.value = '';
        cardDayInput.value = '';
        if (window.showToast) window.showToast('Kart eklendi.', 'success');
      };
    }
  }

  // ────────── 5. ARAYÜZ ENJEKSİYONU (Kredi Kartı Yönetim Paneli) ──────────
  function injectCreditCardUI() {
    const schoolSection = document.getElementById('school');
    if (!schoolSection) return;
    const firstWidget = schoolSection.querySelector('.total-debt-widget');
    if (!firstWidget) return;

    if (document.getElementById('schoolCreditCardPanel')) return;

    const panelHtml = `
            <details id="schoolCreditCardPanel" 
              style="background:var(--bg-secondary); padding:16px; border-radius:12px; margin:0 16px 16px; border:1px dashed var(--brand); cursor: pointer;">
                <summary style="font-size:15px; font-weight:800; list-style:none; display:flex; justify-content:space-between; align-items:center; outline:none;">
                  <span style="display:flex; align-items:center; gap:8px;"><span style="font-size:18px;">💳</span> Kredi Kartlarım</span>
                  <span style="font-size:12px; color:var(--brand)">Genişlet/Gizle 🔽</span>
                </summary>
                <div style="padding:16px 0 0; cursor: default;">
                  <div id="creditCardList" style="margin-bottom:16px;"></div>
                  <div id="cardFormPanel" style="padding:16px; background:#0b0e11; border-radius:12px; border:1px solid rgba(255,255,255,0.05);">
                      <div style="font-size:11px; color:#848e9c; margin-bottom:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">+ Yeni Kart Ekle</div>
                      <div style="display:flex; flex-direction: column; gap:12px;">
                          <div style="display:flex; flex-direction:column; gap:6px;">
                            <label style="font-size:11px; color:#9ca3af; margin-left:4px;">Kredi Kartı Adı</label>
                            <input type="text" id="newCardName" placeholder="Örn: Bonus, World, Axess" style="width:100%; padding:14px; border-radius:10px; background:#1e2329; border:1px solid rgba(255,255,255,0.1); color:#fff; outline:none;">
                          </div>
                          <div style="display:flex; flex-direction:column; gap:6px;">
                            <label style="font-size:11px; color:#9ca3af; margin-left:4px;">Hesap Kesim Günü (1-31)</label>
                            <input type="number" id="newCardDay" placeholder="Örn: 15" style="width:100%; padding:14px; border-radius:10px; background:#1e2329; border:1px solid rgba(255,255,255,0.1); color:#fff; outline:none;">
                          </div>
                          <button id="addCreditCardBtn" style="background:#fcd535; color:#000; border:none; padding:15px; border-radius:10px; font-weight:800; cursor:pointer; font-size:14px; margin-top:8px;">KARTI KAYDET</button>
                      </div>
                  </div>
                </div>
            </details>
        `;
    firstWidget.insertAdjacentHTML('afterend', panelHtml);

    renderCreditCardList();
    initCardForm();
  }

  // ────────── 6. TAKSİT FORMUNU GÜNCELLE ──────────
  function updateSchoolForm() {
    const form = document.getElementById('newSchoolForm');
    if (!form) return;

    if (document.getElementById('schoolPaymentTypeInput')) return;

    const firstLabel = form.querySelector('label');
    if (!firstLabel) return;

    const paymentHtml = `
            <div style="margin-top:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
              <label style="font-size:11px; color:#848e9c; font-weight:800; letter-spacing:0.5px;">ÖDEME ŞEKLİ</label>
              <input type="hidden" id="schoolPaymentTypeInput" value="cash">
              <div style="display:flex; background:#0b0e11; padding:3px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                  <button type="button" id="payTypeCash" class="pay-type-btn active" style="display:flex; align-items:center; gap:6px; padding:6px 14px; border-radius:6px; border:none; background:transparent; color:#848e9c; cursor:pointer; transition:all 0.2s ease; outline:none;">
                    <span style="font-size:14px;">💵</span>
                    <span style="font-weight:700; font-size:11px;">NAKİT</span>
                  </button>
                  <button type="button" id="payTypeCard" class="pay-type-btn" style="display:flex; align-items:center; gap:6px; padding:6px 14px; border-radius:6px; border:none; background:transparent; color:#848e9c; cursor:pointer; transition:all 0.2s ease; outline:none;">
                    <span style="font-size:14px;">💳</span>
                    <span style="font-weight:700; font-size:11px;">KART</span>
                  </button>
              </div>
            </div>
            <style>
              .pay-type-btn.active { background: #2b3139 !important; color: #fcd535 !important; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
              .pay-type-btn:not(.active):hover { color: #fff; }
            </style>
            <div id="cardSelectGroup" style="display:none; margin-bottom:12px; animation: fadeIn 0.3s ease;">
                <label style="font-size:11px; color:#848e9c; font-weight:800; letter-spacing:0.5px;">KREDİ KARTI SEÇ</label>
                <select id="schoolCardSelect" class="input-modern" style="width:100%; padding:10px; background:#1e2329; color:#fff; border-radius:8px; border:1px solid rgba(255,255,255,0.1); outline:none; margin-top:6px; font-size:13px;"></select>
            </div>
        `;
    firstLabel.insertAdjacentHTML('afterend', paymentHtml);

    renderCreditCardSelect();

    const btnCash = document.getElementById('payTypeCash');
    const btnCard = document.getElementById('payTypeCard');
    const hiddenInput = document.getElementById('schoolPaymentTypeInput');
    const cardGroup = document.getElementById('cardSelectGroup');

    function setPaymentType(type) {
      if (!hiddenInput) return;
      hiddenInput.value = type;
      if (type === 'card') {
        if (btnCard) btnCard.classList.add('active');
        if (btnCash) btnCash.classList.remove('active');
        if (cardGroup) cardGroup.style.display = 'block';
        renderCreditCardSelect();
      } else {
        if (btnCash) btnCash.classList.add('active');
        if (btnCard) btnCard.classList.remove('active');
        if (cardGroup) cardGroup.style.display = 'none';
      }
    }

    if (btnCash) btnCash.onclick = () => setPaymentType('cash');
    if (btnCard) btnCard.onclick = () => setPaymentType('card');

    initForm();
  }

  // ────────── 7. BAŞLATMA ──────────
  function init() {
    loadPlans();
    injectCreditCardUI();
    updateSchoolForm();
  }

  // ────────── 7b. PLAN DÜZENLEME ──────────
  function editPlan(index) {
    const plan = schoolPlans[index];
    if (!plan) return;

    const details = document.getElementById('newSchoolDetails');
    if (details) details.open = true;

    document.getElementById('schoolChildName').value = plan.name;
    document.getElementById('schoolTotalDebt').value = plan.totalDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2 });
    document.getElementById('schoolInstCount').value = plan.installmentCount;

    const d = new Date(plan.firstDate);
    document.getElementById('schoolFirstDate').value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const type = plan.paymentType || 'cash';
    const btnCash = document.getElementById('payTypeCash');
    const btnCard = document.getElementById('payTypeCard');
    const hiddenInput = document.getElementById('schoolPaymentTypeInput');
    const cardGroup = document.getElementById('cardSelectGroup');

    if (hiddenInput) hiddenInput.value = type;
    if (type === 'card') {
      if (btnCard) btnCard.classList.add('active');
      if (btnCash) btnCash.classList.remove('active');
      if (cardGroup) cardGroup.style.display = 'block';
      renderCreditCardSelect();
      setTimeout(() => {
        const cardSel = document.getElementById('schoolCardSelect');
        if (cardSel && plan.cardId) cardSel.value = plan.cardId;
      }, 50);
    } else {
      if (btnCash) btnCash.classList.add('active');
      if (btnCard) btnCard.classList.remove('active');
      if (cardGroup) cardGroup.style.display = 'none';
    }

    schoolPlans.splice(index, 1);
    savePlans();

    if (window.showToast) window.showToast('✏️ Plan düzenleme modülü açıldı.', 'default');
    const detailsEl = document.getElementById('newSchoolDetails');
    if (detailsEl) detailsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + ' ₺';
  }

  function parseVal(str) {
    if (!str) return 0;
    return Number(String(str).replace(/\./g, '').replace(',', '.'));
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
  }

  return { init };
})();