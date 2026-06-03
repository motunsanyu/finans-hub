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

  function getInstallmentAmount(plan, index) {
    const unevenData = plan.unevenData;
    const lastAmount = plan.lastAmount;

    let totalUneven = 0;
    let unevenCount = 0;

    if (unevenData) {
      totalUneven = unevenData.indices.length * unevenData.amount;
      unevenCount = unevenData.indices.length;
    } else if (lastAmount) {
      totalUneven = lastAmount;
      unevenCount = 1;
    }

    const normalCount = plan.installmentCount - unevenCount;
    const baseAmount = normalCount > 0 ? (plan.totalDebt - totalUneven) / normalCount : 0;

    if (unevenData && unevenData.indices.includes(index)) {
      return unevenData.amount;
    }
    if (lastAmount && index === plan.installmentCount - 1) {
      return lastAmount;
    }
    return baseAmount;
  }

  function renderPlans() {
    const container = document.getElementById('schoolPlansContainer');
    if (!container) return;

    if (schoolPlans.length === 0) {
      container.innerHTML = `
        <div style="background:var(--binance-card); padding:40px; border-radius:16px; border:1px solid var(--binance-border); text-align:center; color:var(--binance-text-gray); margin:16px;">
          <div style="font-size:32px; margin-bottom:10px;">📋</div>
          <div style="font-size:14px; font-weight:700;">Henüz taksit planı bulunmuyor.</div>
        </div>`;
      return;
    }

    let html = '';
    let needsSave = false;

    schoolPlans.forEach((plan, idx) => {
      const totalDebt = plan.totalDebt;
      const installmentCount = plan.installmentCount;
      const unevenData = plan.unevenData; // { indices: [], amount: 0 }
      const lastAmount = plan.lastAmount; // Legacy support

      const firstDate = new Date(plan.firstDate);
      const card = plan.cardId ? loadCreditCards().find(c => c.id === plan.cardId) : null;
      const paymentType = plan.paymentType === 'card' ? `💳 ${card ? card.name : 'Kart'}` : '💵 Nakit';

      let remainingDebt = 0;
      let paidCount = 0;
      let installmentsHtml = '';

      const borderColors = ['#26a69a', '#ffa726', '#8d6e63', '#66bb6a']; // Daha mat fintech renkleri
      const borderColor = borderColors[idx % borderColors.length];

      if (!plan.recordedInstallments) plan.recordedInstallments = [];

      for (let i = 0; i < installmentCount; i++) {
        const dueDate = new Date(firstDate);
        dueDate.setMonth(firstDate.getMonth() + i);
        
        const amount = getInstallmentAmount(plan, i);

        const status = getInstallmentStatus(dueDate, plan.cardId);
        const installmentId = `${plan.id || idx}_${i}`;

        if (status === 'Ödendi') {
          paidCount++;
          // 🏦 KASA ENTEGRASYONU
          if (!plan.recordedInstallments.includes(installmentId)) {
            
          }
        } else {
          remainingDebt += amount;
        }

        installmentsHtml += `
          <div class="installment-row">
            <div>
              <div style="color:#fff; font-weight:700; font-size:13px;">${i + 1}. Taksit</div>
              <div style="color:var(--binance-text-gray); font-size:11px;">${dueDate.toLocaleDateString('tr-TR')}</div>
            </div>
            <div style="text-align:right;">
              <div style="color:#fff; font-weight:800; font-size:14px;">${formatCurrency(amount)}</div>
              <span class="status-badge ${status === 'Ödendi' ? 'status-paid' : 'status-waiting'}">${status.toUpperCase()}</span>
            </div>
          </div>`;
      }

      const progressPercent = (paidCount / installmentCount) * 100;

      html += `
        <div class="modern-plan-card" style="border-left: 4px solid ${borderColor};">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
            <div>
              <h3 style="color:#fff; margin:0; font-size:16px; font-weight:800;">${escapeHtml(plan.name)}</h3>
              <span style="color:var(--binance-text-gray); font-size:11px;">${paymentType}</span>
            </div>
            <div style="text-align:right;">
              <div class="remaining-label">Kalan / Toplam</div>
              <div class="remaining-amount" style="color:${borderColor}">
                ${formatCurrency(remainingDebt)} <span style="font-size:12px; color:var(--binance-text-gray); font-weight:500;">/ ${formatCurrency(totalDebt)}</span>
              </div>
            </div>
          </div>

          <div class="progress-container" style="margin-bottom:8px;">
            <div class="progress-bar" style="width: ${progressPercent}%; background:${borderColor}"></div>
          </div>
          
          <div style="display:flex; justify-content:flex-end; font-size:11px; color:var(--binance-text-gray); margin-bottom:10px; font-weight:700;">
            <span>${paidCount} / ${installmentCount} Taksit Tamamlandı</span>
          </div>

          <details style="border-top: 1px solid rgba(255,255,255,0.05); padding-top:10px;">
            <summary style="color:var(--binance-yellow); font-size:12px; font-weight:800; cursor:pointer; list-style:none; outline:none; display:flex; justify-content:space-between; align-items:center;">
              <span>📊 Detaylar ve İşlemler</span>
              <span style="font-size:10px;">▼</span>
            </summary>
            <div style="margin-top:15px; display:flex; gap:8px; margin-bottom:15px;">
              <button class="edit-plan-btn" data-index="${idx}" style="flex:1; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#fff; padding:8px; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer;">✏️ DÜZENLE</button>
              <button class="delete-plan-btn" data-index="${idx}" style="flex:1; background:rgba(246,70,93,0.1); border:1px solid rgba(246,70,93,0.2); color:#f6465d; padding:8px; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer;">🗑️ SİL</button>
            </div>
            ${installmentsHtml}
          </details>
        </div>`;
    });

    container.innerHTML = html;

    if (needsSave) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(schoolPlans));
    }

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
      const installmentCount = plan.installmentCount;
      const firstDate = new Date(plan.firstDate);

      for (let i = 0; i < installmentCount; i++) {
        const dueDate = new Date(firstDate);
        dueDate.setMonth(firstDate.getMonth() + i);
        const amount = getInstallmentAmount(plan, i);
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
      let unevenData = null; // { indices: [], amount: 0 }
      if (unevenWrap && unevenWrap.style.display === 'flex') {
        const unevenNoStr = document.getElementById('unevenNo').value.trim();
        const unevenAmount = parseVal(document.getElementById('unevenAmount').value);
        if (!isNaN(unevenAmount) && unevenAmount > 0) {
          // 12 veya 5/6/7 gibi girişleri yakala
          const indices = unevenNoStr.split(/[\/\s,]+/)
            .map(s => parseInt(s.trim()) - 1)
            .filter(n => !isNaN(n) && n >= 0 && n < instCount);
          
          if (indices.length > 0) {
            unevenData = { indices, amount: unevenAmount };
          } else {
            // Eğer numara girilmediyse varsayılan son taksit
            unevenData = { indices: [instCount - 1], amount: unevenAmount };
          }
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
        unevenData: unevenData || null,
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
    const paddedContainer = schoolSection.querySelector('div[style*="padding: 0 16px"]');
    if (!paddedContainer) return;

    if (document.getElementById('schoolCreditCardPanel')) return;

    const panelHtml = `
            <details id="schoolCreditCardPanel" 
              style="background:var(--bg-secondary); padding:16px; border-radius:12px; margin:0 0 16px 0; border:1px solid var(--binance-border); cursor: pointer;">
                <summary style="font-size:15px; font-weight:800; list-style:none; display:flex; align-items:center; gap:8px; outline:none; cursor:pointer;">
                  <span style="font-size:18px;">💳</span> Kredi Kartlarım
                  <span style="font-size:12px; color:var(--brand); margin-left:auto;">Genişlet/Gizle 🔽</span>
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
    paddedContainer.insertAdjacentHTML('afterbegin', panelHtml);

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

    const unevenBtn = document.getElementById('schoolUnevenBtn');
    const unevenWrap = document.getElementById('schoolUnevenWrap');
    const unevenNoInput = document.getElementById('unevenNo');
    const unevenAmountInput = document.getElementById('unevenAmount');

    if (plan.unevenData) {
      if (unevenWrap) unevenWrap.style.display = 'flex';
      if (unevenBtn) {
        unevenBtn.style.borderColor = '#fcd535';
        unevenBtn.style.color = '#fcd535';
        unevenBtn.textContent = '✅ Farklı Tutar Belirleniyor...';
      }
      if (unevenNoInput) unevenNoInput.value = plan.unevenData.indices.map(i => i + 1).join('/');
      if (unevenAmountInput) unevenAmountInput.value = plan.unevenData.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 });
    } else if (plan.lastAmount) {
      if (unevenWrap) unevenWrap.style.display = 'flex';
      if (unevenBtn) {
        unevenBtn.style.borderColor = '#fcd535';
        unevenBtn.style.color = '#fcd535';
        unevenBtn.textContent = '✅ Farklı Tutar Belirleniyor...';
      }
      if (unevenNoInput) unevenNoInput.value = plan.installmentCount;
      if (unevenAmountInput) unevenAmountInput.value = plan.lastAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 });
    } else {
      if (unevenWrap) unevenWrap.style.display = 'none';
      if (unevenBtn) {
        unevenBtn.style.borderColor = 'rgba(255,255,255,0.1)';
        unevenBtn.style.color = '#848e9c';
        unevenBtn.textContent = '📎 Farklı Taksit Tutarı Belirle';
      }
      if (unevenNoInput) unevenNoInput.value = '';
      if (unevenAmountInput) unevenAmountInput.value = '';
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

  function refresh() {
    loadPlans();
    renderCreditCardSelect();
    renderCreditCardList();
  }

  return { init, refresh };
})();
