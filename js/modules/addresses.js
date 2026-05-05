// js/modules/addresses.js — Adres Yönetimi Modülü
const AddressModule = (() => {
  const STORAGE_KEY = 'finansHub_addresses';

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

  // Kayıtlı adres ekle
  function addAddress(title, lat, lng, il, ilce) {
    const addresses = loadAddresses();
    addresses.push({
      id: Date.now().toString(),
      baslik: title,
      enlem: lat,
      boylam: lng,
      il: il || '',
      ilce: ilce || '',
      timestamp: new Date().toISOString()
    });
    saveAddresses(addresses);
    renderAddresses();
  }

  // Adres sil
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

  // Google Maps'te aç
  function openInMaps(lat, lng) {
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
  }

  // Adres listesini render et
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
      const adresMetni = (addr.il && addr.ilce)
        ? `${addr.ilce} / ${addr.il}`
        : `${parseFloat(addr.enlem).toFixed(5)}, ${parseFloat(addr.boylam).toFixed(5)}`;
      const tarih = new Date(addr.timestamp).toLocaleDateString('tr-TR', { day:'2-digit', month:'long', year:'numeric' });

      return `
        <div onclick="AddressModule.openInMaps(${addr.enlem}, ${addr.boylam})"
          style="background:#1e2329; border-radius:16px; padding:16px; margin-bottom:12px;
                 border:1px solid #2a2f36; cursor:pointer; position:relative;
                 transition:border-color 0.2s, transform 0.15s;"
          onmouseover="this.style.borderColor='rgba(252,213,53,0.35)'; this.style.transform='translateY(-1px)'"
          onmouseout="this.style.borderColor='#2a2f36'; this.style.transform='translateY(0)'">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
              <div style="width:36px; height:36px; border-radius:10px; background:rgba(252,213,53,0.12);
                          border:1px solid rgba(252,213,53,0.25); display:flex; align-items:center;
                          justify-content:center; font-size:18px; flex-shrink:0;">📌</div>
              <div style="min-width:0;">
                <div style="font-weight:800; color:#fcd535; font-size:15px;
                            overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                  ${escapeHtml(addr.baslik)}
                </div>
                <div style="font-size:12px; color:#b0b8c5; margin-top:3px;
                            overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                  📍 ${escapeHtml(adresMetni)}
                </div>
                <div style="font-size:10px; color:#6b7280; margin-top:4px;">🗓️ ${tarih}</div>
              </div>
            </div>
            <button onclick="event.stopPropagation(); AddressModule.deleteAddress('${addr.id}')"
              style="background:rgba(246,70,93,0.1); border:1px solid rgba(246,70,93,0.2);
                     color:#f6465d; padding:6px 10px; border-radius:8px; cursor:pointer;
                     font-size:14px; flex-shrink:0; margin-left:8px; transition:background 0.2s;"
              onmouseover="this.style.background='rgba(246,70,93,0.25)'"
              onmouseout="this.style.background='rgba(246,70,93,0.1)'">🗑️</button>
          </div>
          <div style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.05);
                      font-size:11px; color:#4da6ff; font-weight:600; display:flex; align-items:center; gap:6px;">
            🗺️ Google Maps'te Aç
          </div>
        </div>`;
    }).join('');
  }

  // Adres Başlığı Modalını Göster (Kaydet butonundan tetiklenir)
  function showAddressModal(pendingData) {
    const modal = document.getElementById('addressModal');
    const input = document.getElementById('addressTitleInput');
    if (!modal || !input) return;

    input.value = '';
    modal.style.display = 'flex';
    setTimeout(() => input.focus(), 200);

    // Eski handler'ları temizle (clone ile)
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
      addAddress(title, pendingData.lat, pendingData.lng, pendingData.il, pendingData.ilce);
      modal.style.display = 'none';
      if (window.showToast) window.showToast('✅ Adres kaydedildi!', 'success');
      // Kaydet butonunu gizle
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

  // Dışarıya açık API
  return { init, deleteAddress, openInMaps, renderAddresses, showAddressModal, addAddress };
})();

window.AddressModule = AddressModule;
