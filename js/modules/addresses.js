// js/modules/addresses.js — Adres Yönetimi Modülü
const AddressModule = (() => {
  const STORAGE_KEY = 'finansHub_addresses';

  // ── SVG İKONLAR (Kullanıcı Tasarımı) ──────────────────────────────
  const GOOGLE_MAPS_SVG = `<svg class="map-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:20px; height:20px; flex-shrink:0;">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335"/>
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="white" stroke-width="0.5"/>
    <circle cx="12" cy="9" r="3" fill="#FBBC05"/>
    <circle cx="12" cy="9" r="1.5" fill="#34A853"/>
  </svg>`;

  const APPLE_MAPS_SVG = `<svg class="map-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:20px; height:20px; flex-shrink:0;">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#555555"/>
    <path d="M12 4C8.686 4 6 6.686 6 10c0 4 6 10 6 10s6-6 6-10c0-3.314-2.686-6-6-6z" fill="#A2AAAD"/>
    <circle cx="12" cy="10" r="2.5" fill="white"/>
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

  function editAddress(id) {
    const addresses = loadAddresses();
    const addr = addresses.find(a => a.id === id);
    if (!addr) return;

    showAddressModal({
      lat: addr.enlem,
      lng: addr.boylam,
      il: addr.il,
      ilce: addr.ilce,
      adresTam: addr.adresTam,
      isEdit: true,
      editId: id,
      existingTitle: addr.baslik
    });
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
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    window.location.href = url;
  }

  function openInAppleMaps(lat, lng, address) {
    const url = `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(address || 'Konum')}`;
    window.location.href = url;
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
      const adresGosterim = addr.adresTam
        ? addr.adresTam
        : (addr.il && addr.ilce)
          ? `${addr.ilce} / ${addr.il}`
          : `${parseFloat(addr.enlem).toFixed(5)}, ${parseFloat(addr.boylam).toFixed(5)}`;

      return `
        <details class="modern-plan-card" style="padding:0; margin-bottom:12px; background:#1e2329; border:1px solid #2a2f36; border-radius:16px; overflow:hidden;">
          <summary style="list-style:none; outline:none; cursor:pointer; padding:16px;">
            <div style="display:flex; gap:12px; align-items:flex-start;">
              <div style="font-size:20px; flex-shrink:0; margin-top:2px;">📍</div>
              <div style="flex:1; min-width:0;">
                <div style="font-weight:800; color:#fcd535; font-size:15px; margin-bottom:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                  ${escapeHtml(addr.baslik)}
                </div>
                <div style="font-size:12px; color:#c9d1d9; line-height:1.4;">
                  ${escapeHtml(adresGosterim)}
                </div>
              </div>
              <div style="font-size:10px; color:#6b7280; margin-top:6px;">▼</div>
            </div>
          </summary>

          <div style="padding:0 16px 16px; border-top:1px solid rgba(255,255,255,0.05); background:rgba(0,0,0,0.1);">
            <div style="display:flex; gap:10px; margin-top:15px; margin-bottom:15px;">
              <button onclick="AddressModule.openInGoogleMaps(${addr.enlem}, ${addr.boylam})"
                style="flex:1; display:flex; align-items:center; justify-content:center; gap:8px; padding:10px; border-radius:10px; border:1px solid #3c4043; background:#1e2329; color:#fff; font-size:11px; font-weight:800; cursor:pointer;">
                ${GOOGLE_MAPS_SVG} Google
              </button>
              <button onclick="AddressModule.openInAppleMaps(${addr.enlem}, ${addr.boylam}, '${escapeHtml(addr.baslik)}')"
                style="flex:1; display:flex; align-items:center; justify-content:center; gap:8px; padding:10px; border-radius:10px; border:1px solid #3c4043; background:#1e2329; color:#fff; font-size:11px; font-weight:800; cursor:pointer;">
                ${APPLE_MAPS_SVG} Apple
              </button>
            </div>

            <div style="display:flex; gap:10px;">
              <button onclick="AddressModule.editAddress('${addr.id}')"
                style="flex:1; background:rgba(252,213,53,0.1); border:1px solid rgba(252,213,53,0.2); color:#fcd535; padding:8px; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer;">✏️ DÜZENLE</button>
              <button onclick="AddressModule.deleteAddress('${addr.id}')"
                style="flex:1; background:rgba(246,70,93,0.1); border:1px solid rgba(246,70,93,0.2); color:#f6465d; padding:8px; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer;">🗑️ SİL</button>
            </div>
          </div>
        </details>`;
    }).join('');
  }

  // ── ADRES BAŞLIĞI MODALI ─────────────────────────────────────────
  function showAddressModal(pendingData) {
    const modal = document.getElementById('addressModal');
    const input = document.getElementById('addressTitleInput');
    const titleEl = modal ? modal.querySelector('h3') : null;
    if (!modal || !input) return;

    input.value = pendingData.existingTitle || '';
    if (titleEl) titleEl.textContent = pendingData.isEdit ? 'Adresi Düzenle' : 'Adres Başlığı Belirle';
    
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

      const addresses = loadAddresses();
      if (pendingData.isEdit) {
        const idx = addresses.findIndex(a => a.id === pendingData.editId);
        if (idx !== -1) {
          addresses[idx].baslik = title;
          saveAddresses(addresses);
        }
      } else {
        addresses.push({
          id: Date.now().toString(),
          baslik: title,
          enlem: pendingData.lat,
          boylam: pendingData.lng,
          il: pendingData.il || '',
          ilce: pendingData.ilce || '',
          adresTam: pendingData.adresTam || '',
          timestamp: new Date().toISOString()
        });
        saveAddresses(addresses);
      }

      renderAddresses();
      modal.style.display = 'none';
      if (window.showToast) window.showToast(pendingData.isEdit ? '✅ Adres güncellendi!' : '✅ Adres kaydedildi!', 'success');
      
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
    editAddress,
    openInGoogleMaps,
    openInAppleMaps,
    renderAddresses,
    showAddressModal,
    addAddress,
    formatNominatimAddress
  };
})();

window.AddressModule = AddressModule;
