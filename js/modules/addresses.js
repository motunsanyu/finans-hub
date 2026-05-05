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

  function openInGoogleMaps(lat, lng, address) {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    window.open(url, '_blank');
  }

  function openInAppleMaps(lat, lng, address) {
    const url = `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(address || 'Konum')}`;
    window.open(url, '_blank');
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
          <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
            <button onclick="AddressModule.openInGoogleMaps(${addr.enlem}, ${addr.boylam}, '${escapeHtml(addr.baslik)}')"
              style="display:inline-flex; align-items:center; justify-content:center; gap:10px; padding:10px 18px; 
                     border-radius:48px; font-weight:700; font-size:12px; cursor:pointer; transition:all 0.2s ease;
                     border:1px solid #3c4043; background:#1e2329; color:#eaecef; flex:1; min-width:140px;"
              onmouseover="this.style.background='#2b3139'; this.style.borderColor='#fcd535';"
              onmouseout="this.style.background='#1e2329'; this.style.borderColor='#3c4043';">
              ${GOOGLE_MAPS_SVG}
              Google Haritalar
            </button>
            <button onclick="AddressModule.openInAppleMaps(${addr.enlem}, ${addr.boylam}, '${escapeHtml(addr.baslik)}')"
              style="display:inline-flex; align-items:center; justify-content:center; gap:10px; padding:10px 18px; 
                     border-radius:48px; font-weight:700; font-size:12px; cursor:pointer; transition:all 0.2s ease;
                     border:1px solid #3c4043; background:#1e2329; color:#eaecef; flex:1; min-width:140px;"
              onmouseover="this.style.background='#2b3139'; this.style.borderColor='#fcd535';"
              onmouseout="this.style.background='#1e2329'; this.style.borderColor='#3c4043';">
              ${APPLE_MAPS_SVG}
              Apple Haritalar
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
