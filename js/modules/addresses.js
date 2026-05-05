// js/modules/addresses.js — Adres Yönetimi Modülü
const AddressModule = (() => {
  const STORAGE_KEY = 'finansHub_addresses';

  // ── SVG İKONLAR ──────────────────────────────────────────────────
  const GOOGLE_MAPS_SVG = `<svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 4C16.27 4 10 10.27 10 18c0 10.5 14 26 14 26s14-15.5 14-26c0-7.73-6.27-14-14-14z" fill="#EA4335"/>
    <path d="M24 4C16.27 4 10 10.27 10 18c0 2.3.5 4.47 1.38 6.43L24 4z" fill="#1A73E8"/>
    <path d="M24 4v14l6.62 8.43C33.5 22.47 34 20.3 34 18c0-7.73-6.27-14-14-14z" fill="#FBBC04"/>
    <path d="M10 18c0 7.73 6 16.34 10.62 21.57L24 32l3.38 7.57C32 34.34 38 25.73 38 18H10z" fill="#34A853"/>
    <circle cx="24" cy="18" r="5" fill="#fff"/>
  </svg>`;

  const APPLE_MAPS_SVG = `<svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="11" fill="url(#appleGrad)"/>
    <defs>
      <linearGradient id="appleGrad" x1="0" y1="0" x2="0" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#6ECC6E"/>
        <stop offset="1" stop-color="#3A9A3A"/>
      </linearGradient>
    </defs>
    <rect x="8" y="20" width="14" height="20" rx="2" fill="#fff" opacity="0.5"/>
    <rect x="26" y="8" width="14" height="32" rx="2" fill="#5BB8F5"/>
    <rect x="8" y="8" width="14" height="10" rx="2" fill="#F5A623" opacity="0.9"/>
    <circle cx="24" cy="30" r="6" fill="white"/>
    <path d="M24 25 L24 30 L27 28" stroke="#3A9A3A" stroke-width="2" stroke-linecap="round" fill="none"/>
  </svg>`;

  // ── YARDIMCI FONKSİYONLAR ────────────────────────────────────────
  function loadAddresses() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) { return []; }
  }

  function saveAddresses(addresses) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(addresses));
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  // Nominatim address objesini kısa/net formata çevir
  // Çıktı: "Kabil Caddesi No:31 Çankaya / Ankara"
  function formatNominatimAddress(addrObj) {
    if (!addrObj) return '';
    const parts = [];

    // Sokak/Cadde + Numara
    if (addrObj.road || addrObj.pedestrian || addrObj.footway) {
      let street = addrObj.road || addrObj.pedestrian || addrObj.footway;
      if (addrObj.house_number) street += ' No:' + addrObj.house_number;
      parts.push(street);
    }

    // İlçe/Mahalle
    const district = addrObj.suburb
      || addrObj.neighbourhood
      || addrObj.city_district
      || addrObj.district
      || addrObj.town
      || addrObj.village
      || '';

    // Şehir/İl
    const city = addrObj.province
      || addrObj.state
      || addrObj.city
      || addrObj.county
      || '';

    if (district && city) {
      parts.push(district + ' / ' + city);
    } else if (city) {
      parts.push(city);
    } else if (district) {
      parts.push(district);
    }

    return parts.join(', ') || '';
  }

  // ── CRUD FONKSİYONLARI ───────────────────────────────────────────
  function addAddress(title, lat, lng, il, ilce, adresTam) {
    const addresses = loadAddresses();
    addresses.push({
      id: Date.now().toString(),
      baslik: title,
      enlem: lat,
      boylam: lng,
      il: il || '',
      ilce: ilce || '',
      adresTam: adresTam || '',
      timestamp: new Date().toISOString()
    });
    saveAddresses(addresses);
    renderAddresses();
  }

  function deleteAddress(id) {
    if (typeof window.showCustomConfirm === 'function') {
      window.showCustomConfirm('Bu adresi silmek istediğinize emin misiniz?', () => {
        let addresses = loadAddresses().filter(a => a.id !== id);
        saveAddresses(addresses);
        renderAddresses();
        if (window.showToast) window.showToast('Adres silindi.', 'success');
      });
    } else {
      if (confirm('Bu adresi silmek istediğinize emin misiniz?')) {
        let addresses = loadAddresses().filter(a => a.id !== id);
        saveAddresses(addresses);
        renderAddresses();
      }
    }
  }

  function openInGoogleMaps(lat, lng) {
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
  }

  function openInAppleMaps(lat, lng) {
    window.open(`https://maps.apple.com/?q=${lat},${lng}&ll=${lat},${lng}`, '_blank');
  }

  // ── RENDER ───────────────────────────────────────────────────────
  function renderAddresses() {
    const container = document.getElementById('addressesList');
    if (!container) return;

    const addresses = loadAddresses();
    if (addresses.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:48px 16px; color:#848e9c;">
          <div style="font-size:40px; margin-bottom:12px;">📍</div>
          <div style="font-size:14px; font-weight:700; color:#b0b8c5; margin-bottom:6px;">Kayıtlı adres yok</div>
          <div style="font-size:12px;">Navigasyon sekmesinden konum kaydedebilirsiniz.</div>
        </div>`;
      return;
    }

    container.innerHTML = addresses.map(addr => {
      // Gösterilecek adres metni: tam adres varsa onu kullan, yoksa ilçe/il, yoksa koordinat
      const adresGosterim = addr.adresTam
        ? addr.adresTam
        : (addr.il && addr.ilce)
          ? `${addr.ilce} / ${addr.il}`
          : `${parseFloat(addr.enlem).toFixed(5)}, ${parseFloat(addr.boylam).toFixed(5)}`;

      const tarih = new Date(addr.timestamp).toLocaleDateString('tr-TR', {
        day: '2-digit', month: 'long', year: 'numeric'
      });

      return `
        <div style="background:#1e2329; border-radius:16px; padding:16px; margin-bottom:12px;
                    border:1px solid #2a2f36; position:relative;
                    transition:border-color 0.2s;"
          onmouseover="this.style.borderColor='rgba(252,213,53,0.3)'"
          onmouseout="this.style.borderColor='#2a2f36'">

          <!-- Başlık + Sil -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
            <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
              <div style="width:36px; height:36px; border-radius:10px; background:rgba(252,213,53,0.12);
                          border:1px solid rgba(252,213,53,0.25); display:flex; align-items:center;
                          justify-content:center; font-size:18px; flex-shrink:0;">📌</div>
              <div style="min-width:0;">
                <div style="font-weight:800; color:#fcd535; font-size:15px;
                            overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                  ${escapeHtml(addr.baslik)}
                </div>
                <div style="font-size:11px; color:#6b7280; margin-top:2px;">🗓️ ${tarih}</div>
              </div>
            </div>
            <button onclick="AddressModule.deleteAddress('${addr.id}')"
              style="background:rgba(246,70,93,0.1); border:1px solid rgba(246,70,93,0.2);
                     color:#f6465d; padding:5px 9px; border-radius:8px; cursor:pointer;
                     font-size:14px; flex-shrink:0; margin-left:8px;"
              onmouseover="this.style.background='rgba(246,70,93,0.25)'"
              onmouseout="this.style.background='rgba(246,70,93,0.1)'">🗑️</button>
          </div>

          <!-- Adres Metni -->
          <div style="font-size:13px; color:#c9d1d9; margin-bottom:12px; line-height:1.5;
                      padding:10px; background:rgba(255,255,255,0.03); border-radius:10px;
                      border:1px solid rgba(255,255,255,0.06);">
            📍 ${escapeHtml(adresGosterim)}
          </div>

          <!-- Harita Butonları -->
          <div style="display:flex; gap:8px;">
            <button onclick="AddressModule.openInGoogleMaps(${addr.enlem}, ${addr.boylam})"
              style="flex:1; display:flex; align-items:center; justify-content:center; gap:7px;
                     padding:10px; border-radius:12px; cursor:pointer; font-size:12px; font-weight:700;
                     background:rgba(66,133,244,0.1); border:1px solid rgba(66,133,244,0.25); color:#4da6ff;"
              onmouseover="this.style.background='rgba(66,133,244,0.2)'"
              onmouseout="this.style.background='rgba(66,133,244,0.1)'">
              ${GOOGLE_MAPS_SVG}
              Google Maps
            </button>
            <button onclick="AddressModule.openInAppleMaps(${addr.enlem}, ${addr.boylam})"
              style="flex:1; display:flex; align-items:center; justify-content:center; gap:7px;
                     padding:10px; border-radius:12px; cursor:pointer; font-size:12px; font-weight:700;
                     background:rgba(52,199,89,0.1); border:1px solid rgba(52,199,89,0.25); color:#34c759;"
              onmouseover="this.style.background='rgba(52,199,89,0.2)'"
              onmouseout="this.style.background='rgba(52,199,89,0.1)'">
              ${APPLE_MAPS_SVG}
              Apple Maps
            </button>
          </div>
        </div>`;
    }).join('');
  }

  // ── ADRES BAŞLIĞI MODALI ─────────────────────────────────────────
  function showAddressModal(pendingData) {
    const modal = document.getElementById('addressModal');
    const input = document.getElementById('addressTitleInput');
    if (!modal || !input) return;

    input.value = '';
    modal.style.display = 'flex';
    setTimeout(() => input.focus(), 200);

    // Eski handler'ları temizle
    const saveBtn = document.getElementById('addressModalSave');
    const cancelBtn = document.getElementById('addressModalCancel');
    const newSaveBtn = saveBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    function doSave() {
      const title = input.value.trim();
      if (!title) {
        if (window.showToast) window.showToast('❌ Lütfen bir başlık girin.', 'error');
        input.focus();
        return;
      }
      addAddress(
        title,
        pendingData.lat,
        pendingData.lng,
        pendingData.il,
        pendingData.ilce,
        pendingData.adresTam || ''
      );
      modal.style.display = 'none';
      if (window.showToast) window.showToast('✅ Adres kaydedildi!', 'success');
      const saveAddrBtn = document.getElementById('saveAddressBtn');
      if (saveAddrBtn) saveAddrBtn.style.display = 'none';
    }

    document.getElementById('addressModalSave').addEventListener('click', doSave);
    document.getElementById('addressModalCancel').addEventListener('click', () => { modal.style.display = 'none'; });
    input.onkeydown = (e) => { if (e.key === 'Enter') doSave(); };
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
  }

  function init() {
    renderAddresses();
    console.log('✅ Adres modülü başlatıldı');
  }

  return {
    init,
    deleteAddress,
    openInGoogleMaps,
    openInAppleMaps,
    renderAddresses,
    showAddressModal,
    addAddress,
    formatNominatimAddress
  };
})();

window.AddressModule = AddressModule;
