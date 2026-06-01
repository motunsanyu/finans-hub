// js/modules/addresses.js — Adres Yönetimi Modülü
const AddressModule = (() => {
  const STORAGE_KEY = 'finansHub_addresses';

  // ── YEREL İKON YOLLARI ──────────────────────────────────────────
  const GOOGLE_MAPS_ICON = `<img src="assets/icons/google-maps.png" 
    style="width:58px; height:58px; flex-shrink:0; border-radius:4px; object-fit:contain;" alt="Google">`;

  const APPLE_MAPS_ICON = `<img src="assets/icons/apple-maps.png" 
    style="width:58px; height:58px; flex-shrink:0; border-radius:4px; object-fit:contain;" alt="Apple">`;

  async function getStorageKey() {
    let key = 'finansHub_addresses';
    if (window._supabaseClient) {
      try {
        const { data: { user } } = await window._supabaseClient.auth.getUser();
        if (user && user.id) {
          key += '_' + user.id;
        }
      } catch(e){}
    }
    return key;
  }

  async function loadAddresses() {
    try {
      const key = await getStorageKey();
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (e) { return []; }
  }

  async function saveAddresses(addresses) {
    const key = await getStorageKey();
    localStorage.setItem(key, JSON.stringify(addresses));
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  function formatNominatimAddress(addrObj) {
    if (!addrObj) return '';
    const parts = [];
    if (addrObj.road || addrObj.pedestrian || addrObj.footway) {
      let street = addrObj.road || addrObj.pedestrian || addrObj.footway;
      if (addrObj.house_number) street += ' No:' + addrObj.house_number;
      parts.push(street);
    }
    const district = addrObj.suburb || addrObj.neighbourhood || addrObj.city_district || addrObj.district || addrObj.town || addrObj.village || '';
    const city = addrObj.province || addrObj.state || addrObj.city || addrObj.county || '';

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
  async function addAddress(title, lat, lng, il, ilce, adresTam) {
    const addresses = await loadAddresses();
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
    await saveAddresses(addresses);
    renderAddresses();
  }

  async function editAddress(id) {
    const addresses = await loadAddresses();
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
      window.showCustomConfirm('Bu adresi silmek istediğinize emin misiniz?', async () => {
        let addresses = await loadAddresses();
        addresses = addresses.filter(a => a.id !== id);
        await saveAddresses(addresses);
        renderAddresses();
        if (window.showToast) window.showToast('Adres silindi.', 'success');
      });
    } else {
      if (confirm('Bu adresi silmek istediğinize emin misiniz?')) {
        (async () => {
          let addresses = await loadAddresses();
          addresses = addresses.filter(a => a.id !== id);
          await saveAddresses(addresses);
          renderAddresses();
        })();
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
  async function renderAddresses() {
    const container = document.getElementById('addressesList');
    if (!container) return;

    const addresses = await loadAddresses();
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
          <summary style="list-style:none; outline:none; cursor:pointer; padding:0 16px; height:72px; display:flex; align-items:center; box-sizing:border-box;">
            <div style="display:flex; gap:12px; align-items:center; width:100%;">
              <div style="font-size:20px; flex-shrink:0;">📍</div>
              <div style="flex:1; min-width:0;">
                <div style="font-weight:800; color:#fcd535; font-size:15px; margin-bottom:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                  ${escapeHtml(addr.baslik)}
                </div>
                <div style="font-size:12px; color:#c9d1d9; line-height:1.2; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                  ${escapeHtml(adresGosterim)}
                </div>
              </div>
              <div style="font-size:10px; color:#6b7280;">▼</div>
            </div>
          </summary>

          <div style="padding:0 16px 16px; border-top:1px solid rgba(255,255,255,0.05); background:rgba(0,0,0,0.1);">
            <div style="display:flex; gap:10px; margin-top:15px; margin-bottom:15px;">
              <button onclick="AddressModule.openInGoogleMaps(${addr.enlem}, ${addr.boylam})"
                style="flex:1; display:flex; align-items:center; justify-content:flex-start; gap:4px; height:59px; padding:0 6px; border-radius:10px; border:1px solid rgba(66, 133, 244, 0.5); background:#1e2329; color:#fff; font-size:11px; font-weight:800; cursor:pointer; white-space:nowrap;">
                ${GOOGLE_MAPS_ICON} Google Maps
              </button>
              <button onclick="AddressModule.openInAppleMaps(${addr.enlem}, ${addr.boylam}, '${escapeHtml(addr.baslik)}')"
                style="flex:1; display:flex; align-items:center; justify-content:flex-start; gap:4px; height:59px; padding:0 6px; border-radius:10px; border:1px solid rgba(162, 170, 173, 0.5); background:#1e2329; color:#fff; font-size:11px; font-weight:800; cursor:pointer; white-space:nowrap;">
                ${APPLE_MAPS_ICON} Apple Maps
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

    const saveBtn = document.getElementById('addressModalSave');
    const cancelBtn = document.getElementById('addressModalCancel');
    const newSaveBtn = saveBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    async function doSave() {
      const title = input.value.trim();
      if (!title) {
        if (window.showToast) window.showToast('❌ Lütfen bir başlık girin.', 'error');
        input.focus();
        return;
      }

      const addresses = await loadAddresses();
      if (pendingData.isEdit) {
        const idx = addresses.findIndex(a => a.id === pendingData.editId);
        if (idx !== -1) {
          addresses[idx].baslik = title;
          await saveAddresses(addresses);
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
        await saveAddresses(addresses);
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