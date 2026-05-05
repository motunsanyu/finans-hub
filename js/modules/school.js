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

  // Tm planlar ekrana bas (k kartlar, durum rozetleri)
  function renderPlans() {
    const container = document.getElementById('schoolPlansContainer');
    if (!container) return;

    if (schoolPlans.length === 0) {
      container.innerHTML = `
        <div style="background:var(--bg-secondary); padding:20px; border-radius:12px; border:1px solid var(--line); text-align:center; color:#848e9c; margin:16px;">
          <div style="font-size:32px; margin-bottom:10px;">📋</div>
          <div style="font-size:14px; font-weight:700;">Henz taksit plan eklenmemi.</div>
        </div>`;
      return;
    }

    // Kaytl Taksitler blmn bir details iine alalm
    let html = `
      <details class="panel" open
        style="background:var(--bg-secondary); padding:16px; border-radius:12px; margin:16px; border:1px dashed var(--brand); cursor: pointer;">
        <summary style="font-size:15px; font-weight:800; list-style:none; display:flex; justify-content:space-between; align-items:center; outline:none;">
          <span style="display:flex; align-items:center; gap:8px;"><span style="font-size:18px;">📄</span> Kaytl Taksit Planlar</span>
          <span style="font-size:12px; color:var(--brand)">Genilet/Gizle 🔽</span>
        </summary>
        <div style="margin-top:16px; cursor: default;">
    `;

    schoolPlans.forEach((plan, idx) => {
      const totalDebt = plan.totalDebt;
      const installmentCount = plan.installmentCount;
      const baseAmount = totalDebt / installmentCount;
      const firstDate = new Date(plan.firstDate);
      const card = plan.cardId ? loadCreditCards().find(c => c.id === plan.cardId) : null;
      const paymentType = plan.paymentType === 'card' ? `💳 ${card ? card.name : 'Kredi Kartı'}` : '💵 Nakit';

      let totalPaid = 0;
      let remainingDebt = 0;

      // Taksit listesini oluştur
      let installmentsHtml = '<div style="margin-top:8px;">';
      for (let i = 0; i < installmentCount; i++) {
        const dueDate = new Date(firstDate);
        dueDate.setMonth(firstDate.getMonth() + i);
        const amount = (i === installmentCount - 1 && plan.lastAmount) ? plan.lastAmount : baseAmount;
        const status = getInstallmentStatus(dueDate, plan.cardId);
        
        if (status === 'Ödendi') {
          totalPaid += amount;
        } else {
          remainingDebt += amount;
        }

        const statusColor = status === 'Ödendi' ? 'var(--up)' : 'var(--down)';
        installmentsHtml += `
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); padding:8px 0;">
            <span style="font-size:13px;">${dueDate.toLocaleDateString('tr-TR')}</span>
            <span style="font-weight:700;">${formatCurrency(amount)}</span>
            <span style="color:${statusColor}; background:rgba(0,0,0,0.2); padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600;">${status}</span>
          </div>
        `;
      }
      installmentsHtml += '</div>';

      html += `
        <div class="school-plan-card" style="background:#1e2329; border-radius:16px; margin-bottom:16px; overflow:hidden; border:1px solid #2a2f36; box-shadow:0 4px 12px rgba(0,0,0,0.2);">
          <div style="padding:16px; background:linear-gradient(135deg, #2b3139 0%, #1e2329 100%);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <h3 style="margin:0; font-size:17px; font-weight:800;">${escapeHtml(plan.name)}</h3>
                <div style="font-size:11px; color:#9ca3af; margin-top:4px;">${paymentType} • ${installmentCount} taksit</div>
              </div>
              <div style="display:flex; gap:8px; align-items:center;">
                <button class="edit-plan-btn" data-index="${idx}" style="background:rgba(252,213,53,0.15); border:1px solid rgba(252,213,53,0.3); color:#fcd535; padding:6px 12px; border-radius:20px; font-size:11px; font-weight:700; cursor:pointer;">✏️ Düzenle</button>
                <button class="delete-plan-btn" data-index="${idx}" style="background:rgba(239,68,68,0.2); border:none; color:#ef5350; padding:6px 12px; border-radius:20px; font-size:11px; font-weight:700; cursor:pointer;">🗑️ Sil</button>
              </div>
            </div>
            
            <div style="margin-top:16px; display:flex; gap:12px; border-top:1px solid rgba(255,255,255,0.05); padding-top:12px;">
              <div style="flex:1;">
                <div style="font-size:10px; color:#848e9c; text-transform:uppercase; letter-spacing:0.5px;">Toplam Borç</div>
                <div style="font-weight:800; color:#fff; font-size:15px; margin-top:2px;">${formatCurrency(totalDebt)}</div>
              </div>
              <div style="flex:1; border-left:1px solid rgba(255,255,255,0.1); padding-left:12px;">
                <div style="font-size:10px; color:#848e9c; text-transform:uppercase; letter-spacing:0.5px;">Kalan Borç</div>
                <div style="font-weight:800; color:#fcd535; font-size:15px; margin-top:2px;">${formatCurrency(remainingDebt)}</div>
              </div>
            </div>
          </div>
          
          <details style="padding:0;">
            <summary style="padding:12px 16px; font-weight:700; font-size:12px; cursor:pointer; list-style:none; display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.05); color:#9ca3af;">
              <span>📅 Taksit Detayları (${installmentCount} ay)</span>
              <span style="font-size:10px; color:var(--brand);">Aç/Kapat 🔽</span>
            </summary>
            <div style="padding:0 16px 16px;">
              ${installmentsHtml}
            </div>
          </details>
        </div>
      `;
    });

    html += `</div></details>`;
    container.innerHTML = html;

    // Silme butonlarna olay bala
    document.querySelectorAll('.delete-plan-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        if (!isNaN(idx)) deletePlan(idx);
      });
    });
    // Dzenleme butonlarna olay bala
    document.querySelectorAll('.edit-plan-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        if (!isNaN(idx)) editPlan(idx);
      });
    });
  }

  function updateGrandTotal() {
    let total = 0;
    let totalInstallments = 0;
    schoolPlans.forEach(plan => {
      total += plan.totalDebt;
      totalInstallments += plan.installmentCount;
    });
    const el = document.getElementById('grandSchoolDebt');
    if (el) el.textContent = formatCurrency(total);
    const installEl = document.getElementById('grandSchoolInstallment');
    if (installEl) installEl.textContent = totalInstallments;
  }

  // ────────── 3. FORM İŞLEMLERİ ──────────
  // Yeni taksit planı ekleme formunu işle
  function initForm() {
    const form = document.getElementById('newSchoolForm');
    if (!form) return;

    // Form submit işlemi (mevcut submit dinleyicisini kaldırmak için)
    const oldSubmit = form.onsubmit;
    form.onsubmit = null;

    form.addEventListener('submit', (e) => {
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

      // 📌 Vade tarihi düzeltmesi: input date değerini yerel tarih olarak yorumla
      const [year, month, day] = firstDate.split('-');
      const correctedDate = new Date(year, month - 1, day);
      // Geçmiş tarih artık kabul ediliyor (geçmişe yönelik taksit girilebilir)

      const unevenToggle = document.getElementById('schoolUnevenToggle').checked;
      let lastAmount = null;
      if (unevenToggle) {
        let unevenNo = document.getElementById('unevenNo').value;
        let unevenAmount = parseVal(document.getElementById('unevenAmount').value);
        if (unevenNo && !isNaN(unevenAmount) && unevenAmount > 0) {
          lastAmount = unevenAmount;
          // Farklı taksit varsa toplam borcu kontrol et
          if (lastAmount > totalDebt) {
            if (window.showToast) window.showToast('Son taksit tutarı toplam borçtan büyük olamaz.', 'error');
            return;
          }
        } else {
          if (window.showToast) window.showToast('Düzensiz taksit için geçerli taksit no ve tutar girin.', 'error');
          return;
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
      // Düzensiz taksit panelini gizle
      document.getElementById('schoolUnevenWrap').style.display = 'none';
      document.getElementById('schoolUnevenToggle').checked = false;
    });
  }

  // ────────── 4. KREDİ KARTI EKLEME FORMU ──────────
  function initCardForm() {
    const addCardBtn = document.getElementById('addCreditCardBtn');
    const cardNameInput = document.getElementById('newCardName');
    const cardDayInput = document.getElementById('newCardDay');
    if (addCardBtn && cardNameInput && cardDayInput) {
      // Eski dinleyiciyi kaldır
      addCardBtn.replaceWith(addCardBtn.cloneNode(true));
      const newBtn = document.getElementById('addCreditCardBtn');
      if (newBtn) {
        newBtn.addEventListener('click', () => {
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
        });
      }
    }
  }

  // ────────── 5. ARAYZ ENJEKSYONU (Kredi Kart Ynetim Paneli) ──────────
  function injectCreditCardUI() {
    const container = document.getElementById('schoolCreditCardPanel');
    if (container) {
      // Panel zaten varsa sadece listeyi tazele
      renderCreditCardList();
      initCardForm();
      return;
    }
    const schoolSection = document.getElementById('school');
    if (!schoolSection) return;
    const firstWidget = schoolSection.querySelector('.total-debt-widget');
    if (!firstWidget) return;

    const panelHtml = `
            <details id="schoolCreditCardPanel" 
              style="background:var(--bg-secondary); padding:16px; border-radius:12px; margin:16px; border:1px dashed var(--brand); cursor: pointer;">
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
                          <button id="addCreditCardBtn" style="background:#fcd535; color:#000; border:none; padding:15px; border-radius:10px; font-weight:800; cursor:pointer; font-size:14px; margin-top:8px; transition:all 0.1s active;">KARTI KAYDET</button>
                      </div>
                </div>
            </details>
        `;
    firstWidget.insertAdjacentHTML('afterend', panelHtml);

    renderCreditCardList();
    initCardForm();
  }

  // ────────── 6. TAKSİT FORMUNU GÜNCELLE (Ödeme tipi radio + Kart dropdown) ──────────
  function updateSchoolForm() {
    const form = document.getElementById('newSchoolForm');
    if (!form) return;
    // Zaten eklenmiş mi kontrol et
    const paymentHtml = `
            <label style="margin-top:8px;">Ödeme Şekli</label>
            <input type="hidden" id="schoolPaymentTypeInput" value="cash">
            <div style="display:flex; gap:12px; margin-bottom:16px;">
                <button type="button" id="payTypeCash" class="pay-type-btn active" style="flex:1; display:flex; flex-direction:column; align-items:center; gap:8px; padding:16px; border-radius:12px; border:2px solid #2a2f36; background:#1e2329; color:#9ca3af; cursor:pointer; transition:all 0.2s ease;">
                  <span style="font-size:24px;">💵</span>
                  <span style="font-weight:700; font-size:13px;">NAKİT</span>
                </button>
                <button type="button" id="payTypeCard" class="pay-type-btn" style="flex:1; display:flex; flex-direction:column; align-items:center; gap:8px; padding:16px; border-radius:12px; border:2px solid #2a2f36; background:#1e2329; color:#9ca3af; cursor:pointer; transition:all 0.2s ease;">
                  <span style="font-size:24px;">💳</span>
                  <span style="font-weight:700; font-size:13px;">KREDİ KARTI</span>
                </button>
            </div>
            <style>
              .pay-type-btn.active { border-color: #fcd535 !important; background: rgba(252,213,53,0.1) !important; color: #fcd535 !important; }
              .pay-type-btn:active { transform: scale(0.95); }
            </style>
            <div id="cardSelectGroup" style="display:none; margin-bottom:12px;">
                <label>Kredi Kartı Seç
                    <select id="schoolCardSelect" class="input-modern" style="width:100%; padding:14px; background:#2b3139; color:#fff; border-radius:10px; border:1px solid rgba(255,255,255,0.1); outline:none;"></select>
                </label>
            </div>
        `;
    firstLabel.insertAdjacentHTML('afterend', paymentHtml);

    renderCreditCardSelect();

    const btnCash = document.getElementById('payTypeCash');
    const btnCard = document.getElementById('payTypeCard');
    const hiddenInput = document.getElementById('schoolPaymentTypeInput');
    const cardGroup = document.getElementById('cardSelectGroup');

    function setPaymentType(type) {
      hiddenInput.value = type;
      if (type === 'card') {
        btnCard.classList.add('active');
        btnCash.classList.remove('active');
        cardGroup.style.display = 'block';
        renderCreditCardSelect();
      } else {
        btnCash.classList.add('active');
        btnCard.classList.remove('active');
        cardGroup.style.display = 'none';
      }
    }

    if (btnCash && btnCard) {
      btnCash.onclick = () => setPaymentType('cash');
      btnCard.onclick = () => setPaymentType('card');
    }

    initForm(); // Form submit dinleyicisini yeniden bağla
  }

  // ────────── 7. BAŞLATMA ──────────
  function init() {
    loadPlans();
    injectCreditCardUI();   // Kredi kartı yönetim panelini ekle
    updateSchoolForm();      // Taksit formuna ödeme tipi seçeneklerini ekle
    // Geçmiş tarih girilmesine izin ver (min kısıtlaması yok)
  }

  // ────────── 7b. PLAN DÜZENLEME ──────────
  function editPlan(index) {
    const plan = schoolPlans[index];
    if (!plan) return;

    // Formu aç
    const details = document.getElementById('newSchoolDetails');
    if (details) details.open = true;

    // Form alanlarını doldur
    document.getElementById('schoolChildName').value = plan.name;
    document.getElementById('schoolTotalDebt').value = plan.totalDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2 });
    document.getElementById('schoolInstCount').value = plan.installmentCount;

    // Tarihi YYYY-MM-DD formatına çevir
    const d = new Date(plan.firstDate);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    document.getElementById('schoolFirstDate').value = `${yyyy}-${mm}-${dd}`;

    // Ödeme tipini seç
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
      const cardSel = document.getElementById('schoolCardSelect');
      if (cardSel && plan.cardId) cardSel.value = plan.cardId;
    } else {
      if (btnCash) btnCash.classList.add('active');
      if (btnCard) btnCard.classList.remove('active');
      if (cardGroup) cardGroup.style.display = 'none';
    }

    // Mevcut planı sil (yeni kaydet üstine yazacak)
    schoolPlans.splice(index, 1);
    savePlans();

    if (window.showToast) window.showToast('✏️ Plan düzenleme modülü açıldı. Değiştirip kaydedin.', 'default');
    // Forma scroll
    const detailsEl = document.getElementById('newSchoolDetails');
    if (detailsEl) detailsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ────────── 8. YARDIMCI FONKSİYONLAR ──────────
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