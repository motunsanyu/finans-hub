// js/modules/menu.js — Tüm düzeltmeler uygulandı

const MenuModule = (() => {
  let masterItems = [];
  let currentDailyMenu = null;
  let customTemplateSrc = null; // localStorage'da saklanan şablon data-url
  let customCanvasImages = { left: null, right: null };
  // Canvas Y koordinat ofsetleri (D-pad ile ayarlanabilir)
  let canvasYOffsets = { soups: 0, dishes: 0 };
  let canvasFontSizes = { soups: 22, dishes: 22 };

  let restaurantProfile = {
    name: '',
    logo_url: '',
    phones: [],
    instagram: ''
  };

  // Seçili yemek id'leri (JS ile yönetiliyor, checkbox hack yok)
  let selectedFoodIds = new Set();

  // ──────────────────────────────────────────
  // INIT
  // ──────────────────────────────────────────
  async function init() {
    // Şablon localStorage'dan yükle
    const savedTpl = localStorage.getItem('menu_custom_template');
    if (savedTpl) customTemplateSrc = savedTpl;

    await loadProfileSettings();

    if (window.isPublicMenuMode) {
      showPublicMenu();
    }
  }

  // ──────────────────────────────────────────
  // PROFILE
  // ──────────────────────────────────────────
  async function loadProfileSettings() {
    try {
      const sb = window._supabaseClient;
      const { data } = await sb
        .from('restaurant_settings')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();

      if (data) {
        restaurantProfile = {
          name: data.name || restaurantProfile.name,
          logo_url: data.logo_url || restaurantProfile.logo_url,
          phones: Array.isArray(data.phones) ? data.phones : restaurantProfile.phones,
          instagram: data.instagram || restaurantProfile.instagram
        };
      } else {
        const local = localStorage.getItem('restaurant_profile_settings');
        if (local) restaurantProfile = JSON.parse(local);
      }
    } catch {
      const local = localStorage.getItem('restaurant_profile_settings');
      if (local) try { restaurantProfile = JSON.parse(local); } catch {}
    }

    updatePublicUIBranding();
    renderProfileTabInputs();
  }

  function updatePublicUIBranding() {
    const headerTitle = document.querySelector('#publicMenuScreen h1');
    if (headerTitle) {
      headerTitle.textContent = restaurantProfile.name || 'İŞLETME ADI';
    }
    const headerSub = document.querySelector('#publicMenuScreen p');
    if (headerSub) {
      headerSub.textContent = 'GÜNÜN MENÜSÜ';
    }

    // Logo — sadece QR müşteri sayfası
    const logoArea = document.getElementById('publicLogoArea');
    if (logoArea) {
      if (restaurantProfile.logo_url) {
        logoArea.innerHTML = `<img src="${restaurantProfile.logo_url}" style="width:72px; height:72px; border-radius:50%; object-fit:cover; border:2.5px solid #c2410c; box-shadow:0 4px 16px rgba(0,0,0,0.1); margin-bottom:4px;">`;
      } else {
        logoArea.innerHTML = `<div style="font-size:32px; margin-bottom:8px;">🥗</div>`;
      }
    }

    // İletişim footer
    const footerEl = document.getElementById('publicContactFooter');
    if (footerEl) {
      footerEl.innerHTML = `
        <div style="font-size:13px; color:#5c4c38; font-weight:800; display:flex; align-items:center; justify-content:center; gap:6px; margin-bottom:10px;">
          📞 ${restaurantProfile.phones.length > 0 ? restaurantProfile.phones.join('  -  ') : 'Telefon Eklenmemiş'}
        </div>
        <div style="font-size:12px; color:#7f6d53; font-weight:700; display:flex; align-items:center; justify-content:center; gap:6px; margin-bottom:16px;">
          📸 ${restaurantProfile.instagram || '@instagram'}
        </div>
        <p style="font-size:11px; color:#a19079; margin:0; font-style:italic;">Afiyet Olsun!</p>
      `;
    }
  }

  function renderProfileTabInputs() {
    const nameEl = document.getElementById('profileRestName');
    const instaEl = document.getElementById('profileInstagram');
    const container = document.getElementById('profilePhoneContainer');
    const logoLabel = document.getElementById('logo-upload-name');

    if (nameEl) nameEl.value = restaurantProfile.name;
    if (instaEl) instaEl.value = restaurantProfile.instagram;
    if (logoLabel && restaurantProfile.logo_url) {
      logoLabel.textContent = 'Mevcut Logo Yüklü (Değiştirmek için tıklayın)';
    }

    if (container) {
      container.innerHTML = '';
      const phones = restaurantProfile.phones.length > 0
        ? restaurantProfile.phones
        : [''];
      phones.forEach((p, i) => addPhoneInputField(p, i > 0));
    }
  }

  function addPhoneInputField(value = '', canDelete = true) {
    const container = document.getElementById('profilePhoneContainer');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'phone-input-row';
    row.style.cssText = 'display:flex; gap:8px;';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'menu-input-field phone-number-entry';
    input.placeholder = 'Örn: 0 545 282 97 34';
    input.value = value;
    input.style.flex = '1';
    row.appendChild(input);

    if (canDelete) {
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = '✕';
      del.style.cssText = 'background:#ef5350; color:#fff; border:none; border-radius:10px; padding:0 14px; font-weight:800; cursor:pointer;';
      del.onclick = () => row.remove();
      row.appendChild(del);
    }
    container.appendChild(row);
  }
  window.addPhoneInput = () => addPhoneInputField('', true);

  async function saveRestaurantProfile(e) {
    e.preventDefault();
    const sb = window._supabaseClient;

    const name = document.getElementById('profileRestName')?.value?.trim();
    const instagram = document.getElementById('profileInstagram')?.value?.trim();
    const logoFile = document.getElementById('profileLogoFile')?.files[0];

    const phones = [...document.querySelectorAll('.phone-number-entry')]
      .map(el => el.value.trim())
      .filter(Boolean);

    if (!name) {
      if (window.showToast) window.showToast('Lütfen işletme adını girin.', 'error');
      return;
    }

    try {
      if (window.showToast) window.showToast('Kaydediliyor...', 'default');

      let logoUrl = restaurantProfile.logo_url;
      if (logoFile) {
        const compressed = await compressImage(logoFile, 400, 400);
        const fileName = `logo-${Date.now()}.jpg`;
        const { error: upErr } = await sb.storage.from('menu-items').upload(fileName, compressed);
        if (upErr) throw upErr;
        const { data: urlData } = sb.storage.from('menu-items').getPublicUrl(fileName);
        logoUrl = urlData.publicUrl;
      }

      const profile = { name, logo_url: logoUrl, phones, instagram };

      try {
        await sb.from('restaurant_settings').upsert(
          { id: 'default', ...profile },
          { onConflict: 'id' }
        );
      } catch (dbErr) {
        console.warn('DB kayıt hatası, localStorage fallback:', dbErr);
      }

      localStorage.setItem('restaurant_profile_settings', JSON.stringify(profile));
      restaurantProfile = profile;

      if (window.showToast) window.showToast('Ayarlar kaydedildi!', 'success');
      updatePublicUIBranding();
      switchTab('builder');
    } catch (err) {
      console.error(err);
      if (window.showToast) window.showToast('Hata: ' + err.message, 'error');
    }
  }
  window.saveRestaurantProfile = saveRestaurantProfile;

  // ──────────────────────────────────────────
  // TEMPLATE UPLOAD
  // ──────────────────────────────────────────
  window.handleTemplateUpload = function(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      customTemplateSrc = e.target.result;
      localStorage.setItem('menu_custom_template', customTemplateSrc);
      const statusEl = document.getElementById('templateUploadStatus');
      if (statusEl) statusEl.textContent = `Yeni şablon yüklendi: ${file.name}`;
      if (window.showToast) window.showToast('Şablon güncellendi!', 'success');
      renderShareTab(); // Canvas'ı yenile
    };
    reader.readAsDataURL(file);
  };

  window.resetTemplate = function() {
    customTemplateSrc = null;
    localStorage.removeItem('menu_custom_template');
    const statusEl = document.getElementById('templateUploadStatus');
    if (statusEl) statusEl.textContent = 'Varsayılan şablon: menu_template.jpg';
    if (window.showToast) window.showToast('Şablon sıfırlandı.', 'success');
    renderShareTab();
  };

  // ──────────────────────────────────────────
  // IMAGE COMPRESSION
  // ──────────────────────────────────────────
  function compressImage(file, maxW = 800, maxH = 800) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (evt) => {
        const img = new Image();
        img.src = evt.target.result;
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > h) {
            if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
          } else {
            if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          canvas.toBlob((blob) => {
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
              type: 'image/jpeg',
              lastModified: Date.now()
            }));
          }, 'image/jpeg', 0.75);
        };
      };
    });
  }

  // ──────────────────────────────────────────
  // PUBLIC MENU (QR GÖRÜNÜMÜ)
  // ──────────────────────────────────────────
  async function showPublicMenu() {
    const root = document.getElementById('publicMenuScreen');
    if (!root) return;
    root.style.display = 'block';

    const listEl = document.getElementById('publicMenuList');
    if (listEl) {
      listEl.innerHTML = `<div style="text-align:center;padding:60px 0;color:#7f6d53;"><div style="font-size:32px;margin-bottom:12px;">🍲</div><div style="font-weight:700;font-size:16px;">Hazırlanıyor...</div></div>`;
    }

    try {
      const sb = window._supabaseClient;
      const todayStr = new Date().toISOString().split('T')[0];

      const { data, error } = await sb
        .from('daily_menus')
        .select('*')
        .eq('menu_date', todayStr)
        .maybeSingle();

      if (error) throw error;

      if (!data?.items?.length) {
        if (listEl) listEl.innerHTML = `<div style="text-align:center;padding:80px 20px;color:#7f6d53;"><div style="font-size:40px;margin-bottom:16px;">🍳</div><h3 style="font-family:'Playfair Display',serif;font-size:22px;color:#5c4c38;">Bugün Menü Yok</h3><p style="font-size:14px;opacity:0.8;max-width:300px;margin:0 auto;line-height:1.5;">Bugünün menüsü henüz hazırlanmamış.</p></div>`;
        return;
      }

      // Menüyü grupla
      const groups = { 'Çorbalar': [], 'Yemekler': [], 'Pilavlar - Makarnalar': [] };

      data.items.forEach(item => {
        const cat = item.category === 'Çorbalar' ? 'Çorbalar' : (item.category === 'Pilavlar - Makarnalar' ? 'Pilavlar - Makarnalar' : 'Yemekler');
        groups[cat].push(item);
      });

      // UI Çizimi
      let html = '';
      const order = ['Çorbalar', 'Yemekler', 'Pilavlar - Makarnalar'];
      
      order.forEach(catName => {
        const list = groups[catName] || [];
        if (!list.length) return;

        html += `<div style="margin-bottom:28px;">
          <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:16px;">
            <div style="height:1px;flex:1;background:linear-gradient(90deg,transparent,rgba(92,76,56,0.2),transparent);"></div>
            <h3 style="font-family:'Space Grotesk','Playfair Display',serif;font-size:20px;font-weight:800;color:#5c4c38;letter-spacing:1px;text-transform:uppercase;">${catName}</h3>
            <div style="height:1px;flex:1;background:linear-gradient(90deg,transparent,rgba(92,76,56,0.2),transparent);"></div>
          </div>
          <div style="display:flex;flex-direction:column;gap:12px;">`;

        list.forEach(food => {
          const img = food.image_url
            ? `<div style="width:56px;height:56px;border-radius:10px;overflow:hidden;border:1.5px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.06);flex-shrink:0;"><img src="${food.image_url}" style="width:100%;height:100%;object-fit:cover;"></div>`
            : `<div style="width:56px;height:56px;border-radius:10px;background:#f0e8db;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">🍲</div>`;

          const price = food.price
            ? `<div style="font-weight:800;font-size:15px;color:#c2410c;background:rgba(194,65,12,0.07);padding:4px 10px;border-radius:30px;border:1px solid rgba(194,65,12,0.12);white-space:nowrap;">${food.price} ₺</div>`
            : '';

          html += `<div style="display:flex;align-items:center;gap:12px;background:#fff;padding:10px 14px;border-radius:14px;box-shadow:0 4px 12px rgba(92,76,56,0.04);border:1px solid rgba(92,76,56,0.04);">
            ${img}
            <div style="flex:1;min-width:0;">
              <h4 style="font-weight:700;font-size:15px;color:#2e251a;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${food.name}</h4>
              <p style="font-size:11px;color:#7f6d53;margin:2px 0 0;text-transform:uppercase;font-weight:600;letter-spacing:0.5px;">${catName}</p>
            </div>
            ${price}
          </div>`;
        });

        html += `</div></div>`;
      });

      if (listEl) listEl.innerHTML = html;

    } catch (err) {
      console.error(err);
      if (listEl) listEl.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#ef5350;"><div style="font-size:32px;margin-bottom:12px;">⚠️</div><div style="font-weight:700;">Menü yüklenemedi</div><div style="font-size:12px;margin-top:8px;opacity:0.8;">${err.message}</div></div>`;
    }
  }

  // ──────────────────────────────────────────
  // MODAL OPEN/CLOSE
  // ──────────────────────────────────────────
  window.toggleDailyMenuModal = function() {
    const modal = document.getElementById('dailyMenuModal');
    if (!modal) return;
    const isOpen = modal.style.display === 'flex';
    if (isOpen) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
      window.editingFoodItemId = null;
      const btn = document.querySelector('#tabContent-adder form button[type="submit"]');
      if (btn) btn.textContent = '➕ Yemek Listesine Ekle';
    } else {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      switchTab('builder');
      loadMasterItems();
      const today = new Date().toISOString().split('T')[0];
      const dateInput = document.getElementById('menuBuilderDate');
      if (dateInput) { dateInput.value = today; }
      loadDailyMenuForDate(today);
    }
  };

  function switchTab(tabId) {
    document.querySelectorAll('.menu-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.menu-tab-content').forEach(el => {
      el.style.display = el.id === `tabContent-${tabId}` ? 'block' : 'none';
    });
    if (tabId === 'exporter') renderShareTab();
  }
  window.switchMenuTab = switchTab;

  // ──────────────────────────────────────────
  // MASTER ITEMS
  // ──────────────────────────────────────────
  async function loadMasterItems() {
    const sb = window._supabaseClient;
    try {
      const { data, error } = await sb
        .from('menu_items')
        .select('*')
        .order('name');
      if (error) throw error;
      masterItems = data || [];
      renderMasterItemsList();
      renderBuilderItemsList();
    } catch (err) {
      console.error(err);
      if (window.showToast) window.showToast('Yemek listesi yüklenemedi: ' + err.message, 'error');
    }
  }

  async function addMasterItem(e) {
    e.preventDefault();
    const sb = window._supabaseClient;

    const name = document.getElementById('newFoodName')?.value?.trim();
    const category = document.getElementById('newFoodCategory')?.value;
    const priceRaw = document.getElementById('newFoodPrice')?.value?.replace(',', '.');
    const price = parseFloat(priceRaw) || 0;
    const file = document.getElementById('newFoodImage')?.files[0];
    const editingId = window.editingFoodItemId;

    if (!name || !category) {
      if (window.showToast) window.showToast('Yemek adı ve kategori zorunludur.', 'error');
      return;
    }

    try {
      if (window.showToast) window.showToast('Kaydediliyor...', 'default');

      let imageUrl = null;

      if (file) {
        const compressed = await compressImage(file);
        const ext = compressed.name.split('.').pop();
        const fileName = `food-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: upErr } = await sb.storage
          .from('menu-items')
          .upload(fileName, compressed);

        if (upErr) {
          console.error('Görsel yükleme hatası:', upErr);
          if (window.showToast) window.showToast('Görsel yüklenemedi: ' + upErr.message, 'error');
          // Görsel olmadan devam et
        } else {
          const { data: urlData } = sb.storage.from('menu-items').getPublicUrl(fileName);
          imageUrl = urlData.publicUrl;
        }
      }

      if (editingId) {
        // Güncelleme
        const payload = { name, category, price };
        if (imageUrl) payload.image_url = imageUrl;

        const { error } = await sb
          .from('menu_items')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;
        if (window.showToast) window.showToast('Yemek güncellendi!', 'success');
        window.editingFoodItemId = null;
        const btn = document.querySelector('#tabContent-adder form button[type="submit"]');
        if (btn) btn.textContent = '➕ Yemek Listesine Ekle';
      } else {
        // Yeni ekleme — price kolonunu önce dene, yoksa graceful geç
        let insertPayload = { name, category };
        if (imageUrl) insertPayload.image_url = imageUrl;

        // price kolonu var mı?
        try {
          const { error } = await sb.from('menu_items').insert({ ...insertPayload, price });
          if (error && error.code === 'PGRST204') {
            // price kolonu yok, onsuz dene
            const { error: e2 } = await sb.from('menu_items').insert(insertPayload);
            if (e2) throw e2;
            if (window.showToast) window.showToast('Yemek eklendi (fiyat kolonu eksik — SQL çalıştırın).', 'success');
          } else if (error) {
            throw error;
          } else {
            if (window.showToast) window.showToast('Yemek eklendi!', 'success');
          }
        } catch (insertErr) {
          throw insertErr;
        }
      }

      // Formu sıfırla
      document.getElementById('newFoodName').value = '';
      document.getElementById('newFoodPrice').value = '';
      document.getElementById('newFoodImage').value = '';
      const fileLabel = document.getElementById('file-upload-name');
      if (fileLabel) fileLabel.textContent = 'Görsel Yüklemek İçin Tıklayın';

      loadMasterItems();
      switchTab('list');

    } catch (err) {
      console.error(err);
      if (window.showToast) window.showToast('Hata: ' + err.message, 'error');
    }
  }
  window.addMasterFoodItem = addMasterItem;

  window.editMasterFoodItem = function(id) {
    const item = masterItems.find(i => i.id === id);
    if (!item) return;
    window.editingFoodItemId = id;

    const nameEl = document.getElementById('newFoodName');
    const catEl = document.getElementById('newFoodCategory');
    const priceEl = document.getElementById('newFoodPrice');
    const fileLabel = document.getElementById('file-upload-name');

    if (nameEl) nameEl.value = item.name;
    if (catEl) catEl.value = item.category;
    if (priceEl) priceEl.value = item.price || '';
    if (fileLabel) fileLabel.textContent = item.image_url ? 'Mevcut Görsel Korunuyor' : 'Görsel Yüklemek İçin Tıklayın';

    const btn = document.querySelector('#tabContent-adder form button[type="submit"]');
    if (btn) btn.textContent = '✏️ Yemeği Güncelle';
    switchTab('adder');
  };

  window.deleteMasterFoodItem = function(id) {
    const doDelete = async () => {
      const sb = window._supabaseClient;
      try {
        const { error } = await sb.from('menu_items').delete().eq('id', id);
        if (error) throw error;
        if (window.showToast) window.showToast('Yemek silindi.', 'success');
        loadMasterItems();
      } catch (err) {
        if (window.showToast) window.showToast('Silinemedi: ' + err.message, 'error');
      }
    };
    if (window.showCustomConfirm) {
      window.showCustomConfirm('Bu yemeği kalıcı olarak silmek istiyor musunuz?', doDelete);
    } else if (confirm('Silmek istiyor musunuz?')) {
      doDelete();
    }
  };

  window.deleteAllFoods = function() {
    const doDeleteAll = async () => {
      const sb = window._supabaseClient;
      try {
        const { error } = await sb.from('menu_items').delete().neq('id', -1);
        if (error) throw error;
        
        const todayStr = new Date().toLocaleDateString('tr-TR');
        await sb.from('daily_menus').update({ items: [] }).eq('menu_date', todayStr);
        
        selectedFoodIds.clear();
        
        if (window.showToast) window.showToast('Tüm yemekler silindi.', 'success');
        loadMasterItems();
      } catch (err) {
        if (window.showToast) window.showToast('Silinemedi: ' + err.message, 'error');
      }
    };
    if (window.showCustomConfirm) {
      window.showCustomConfirm('Tüm yemekleri silmek istediğinize emin misiniz? (Günlük menü de temizlenir) Bu işlem geri alınamaz!', doDeleteAll);
    } else if (confirm('Tüm yemekleri silmek istediğinize emin misiniz? (Günlük menü de temizlenir) Bu işlem geri alınamaz!')) {
      doDeleteAll();
    }
  };

  function renderMasterItemsList() {
    const container = document.getElementById('menuFoodListGrid');
    if (!container) return;

    if (!masterItems.length) {
      container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#708499;">Kayıtlı yemek yok.</div>';
      return;
    }

    container.innerHTML = masterItems.map(item => {
      const img = item.image_url
        ? `<img src="${item.image_url}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;">`
        : `<div style="width:40px;height:40px;border-radius:8px;background:#242f3d;display:flex;align-items:center;justify-content:center;font-size:20px;border:1px dashed rgba(255,255,255,0.08);">🍲</div>`;

      const priceTag = item.price
        ? `<span style="color:#fbbf24;font-size:12px;font-weight:800;background:rgba(251,191,36,0.08);padding:2px 6px;border-radius:6px;">${item.price} ₺</span>`
        : `<span style="color:#708499;font-size:11px;">—</span>`;

      return `
        <div style="background:#17212b;border:1px solid #232e3c;border-radius:12px;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="display:flex;align-items:center;gap:12px;min-width:0;flex:1;">
            ${img}
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;color:#fff;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.name}</div>
              <div style="display:flex;flex-direction:column;gap:2px;">
                <span style="color:#708499;font-size:11px;">${item.category}</span>
                ${priceTag}
              </div>
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0;">
            <button onclick="editMasterFoodItem(${item.id})" style="background:none;border:none;color:#fbbf24;font-size:16px;cursor:pointer;padding:6px;" title="Düzenle">✏️</button>
            <button onclick="deleteMasterFoodItem(${item.id})" style="background:none;border:none;color:#ef5350;font-size:18px;cursor:pointer;padding:6px;" title="Sil">✕</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // ──────────────────────────────────────────
  // BUILDER — Günlük menü checkbox listesi
  // ──────────────────────────────────────────
  function renderBuilderItemsList() {
    const container = document.getElementById('builderFoodList');
    if (!container) return;

    if (!masterItems.length) {
      container.innerHTML = '<div style="text-align:center;padding:20px;color:#708499;">Önce Yemek Ekle sekmesinden yemek ekleyin.</div>';
      return;
    }

    const groups = { 'Çorbalar': [], 'Yemekler': [], 'Pilavlar - Makarnalar': [] };
    masterItems.forEach(item => {
      const cat = item.category === 'Çorbalar' ? 'Çorbalar' : (item.category === 'Pilavlar - Makarnalar' ? 'Pilavlar - Makarnalar' : 'Yemekler');
      groups[cat].push(item);
    });

    let html = '';
    ['Çorbalar', 'Yemekler', 'Pilavlar - Makarnalar'].forEach(cat => {
      const list = groups[cat] || [];
      if (!list.length) return;

      html += `
        <div style="margin-bottom:8px;">
          <div style="color:#10b981;font-size:11px;font-weight:800;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:6px;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">${cat}</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
      `;

      list.forEach(item => {
        const isActive = selectedFoodIds.has(item.id);
        const savedItem = currentDailyMenu?.items?.find(i => i.id === item.id);
        const priceVal = savedItem?.price ?? (item.price ?? 0);

        html += `
          <div id="builder-row-${item.id}" 
            class="menu-builder-row"
            data-id="${item.id}"
            style="display:flex;align-items:center;justify-content:space-between;background:${isActive ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.02)'};padding:10px 14px;border-radius:10px;border:1px solid ${isActive ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.04)'};cursor:pointer;transition:all 0.15s;-webkit-tap-highlight-color:transparent;"
            onclick="window.toggleFoodSelection(${item.id})">
            <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">
              <div id="check-${item.id}" style="width:22px;height:22px;border-radius:5px;border:2px solid ${isActive ? '#fbbf24' : '#3a4b5c'};background:${isActive ? '#fbbf24' : 'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.15s;">
                ${isActive ? '<span style="color:#000;font-size:13px;font-weight:900;">✓</span>' : ''}
              </div>
              <span style="color:#fff;font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.name}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;" onclick="event.stopPropagation()">
              <input type="number" 
                id="price-${item.id}"
                class="menu-builder-price"
                data-id="${item.id}"
                value="${priceVal}"
                onclick="event.stopPropagation()"
                style="width:70px;padding:6px 8px;border-radius:6px;background:#0e1621;border:1px solid #232e3c;color:#fbbf24;font-size:13px;text-align:right;font-weight:800;-moz-appearance:textfield;"
                placeholder="0">
              <span style="color:#708499;font-weight:700;font-size:13px;">₺</span>
            </div>
          </div>
        `;
      });

      html += `</div></div>`;
    });

    container.innerHTML = html;
  }

  // Yemek seçim toggle (pure JS, checkbox yok)
  window.toggleFoodSelection = function(id) {
    if (selectedFoodIds.has(id)) {
      selectedFoodIds.delete(id);
    } else {
      selectedFoodIds.add(id);
    }

    const row = document.getElementById(`builder-row-${id}`);
    const check = document.getElementById(`check-${id}`);
    const isNowActive = selectedFoodIds.has(id);

    if (row) {
      row.style.background = isNowActive ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.02)';
      row.style.borderColor = isNowActive ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.04)';
    }
    if (check) {
      check.style.background = isNowActive ? '#fbbf24' : 'transparent';
      check.style.borderColor = isNowActive ? '#fbbf24' : '#3a4b5c';
      check.innerHTML = isNowActive ? '<span style="color:#000;font-size:13px;font-weight:900;">✓</span>' : '';
    }
  };

  // ──────────────────────────────────────────
  // DAILY MENU LOAD / SAVE / CLEAR
  // ──────────────────────────────────────────
  async function loadDailyMenuForDate(dateStr) {
    if (!dateStr) return;
    const sb = window._supabaseClient;
    try {
      const { data, error } = await sb
        .from('daily_menus')
        .select('*')
        .eq('menu_date', dateStr)
        .maybeSingle();

      if (error) throw error;

      currentDailyMenu = data || { menu_date: dateStr, items: [] };

      // Seçili id'leri kayıttan yükle
      selectedFoodIds = new Set((currentDailyMenu.items || []).map(i => i.id));

      renderBuilderItemsList();
    } catch (err) {
      console.error(err);
      if (window.showToast) window.showToast('Menü yüklenemedi.', 'error');
    }
  }
  window.loadDailyMenuForDate = loadDailyMenuForDate;

  async function saveDailyMenu() {
    const sb = window._supabaseClient;
    const dateStr = document.getElementById('menuBuilderDate')?.value;

    if (!dateStr) {
      if (window.showToast) window.showToast('Lütfen tarih seçin.', 'error');
      return;
    }

    const items = [];
    selectedFoodIds.forEach(id => {
      const master = masterItems.find(i => i.id === id);
      if (master) {
        const priceEl = document.getElementById(`price-${id}`);
        const price = parseFloat(priceEl?.value?.replace(',', '.')) || master.price || 0;
        items.push({ ...master, price });
      }
    });

    try {
      if (window.showToast) window.showToast('Menü kaydediliyor...', 'default');

      const { data: { user } } = await sb.auth.getUser();
      const { error } = await sb.from('daily_menus').upsert(
        { menu_date: dateStr, items, created_by: user?.id || null },
        { onConflict: 'menu_date' }
      );
      if (error) throw error;

      if (window.showToast) window.showToast('Menü kaydedildi!', 'success');
      // Seçimleri otomatik temizle
      selectedFoodIds.clear();
      currentDailyMenu = { menu_date: dateStr, items };
      renderBuilderItemsList();
    } catch (err) {
      console.error(err);
      if (window.showToast) window.showToast('Kayıt hatası: ' + err.message, 'error');
    }
  }
  window.saveDailyMenu = saveDailyMenu;

  window.clearDailyMenu = function() {
    selectedFoodIds.clear();
    // Tüm satırları pasif görünüme döndür
    document.querySelectorAll('.menu-builder-row').forEach(row => {
      const id = parseInt(row.dataset.id);
      row.style.background = 'rgba(255,255,255,0.02)';
      row.style.borderColor = 'rgba(255,255,255,0.04)';
      const check = document.getElementById(`check-${id}`);
      if (check) {
        check.style.background = 'transparent';
        check.style.borderColor = '#3a4b5c';
        check.innerHTML = '';
      }
      const priceEl = document.getElementById(`price-${id}`);
      if (priceEl) {
        const master = masterItems.find(i => i.id === id);
        if (priceEl) priceEl.value = master?.price || '';
      }
    });
    if (window.showToast) window.showToast('Seçimler temizlendi.', 'success');
  };

  // ──────────────────────────────────────────
  // CANVAS / SHARE TAB
  // ──────────────────────────────────────────
  async function renderShareTab() {
    const canvas = document.getElementById('menuCanvas');
    const qrContainer = document.getElementById('menuQrContainer');
    if (!canvas) return;

    // QR kodu üret
    if (qrContainer) {
      const publicUrl = window.location.origin + window.location.pathname + '?menu=true';
      qrContainer.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(publicUrl)}"
            style="border-radius:16px;border:4px solid white;box-shadow:0 4px 20px rgba(0,0,0,0.4);max-width:180px;width:100%;">
          <a href="https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(publicUrl)}"
            download="menu-qr-kodu.png" target="_blank"
            style="padding:8px 16px;font-size:12px;font-weight:800;border-radius:8px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;background:#10b981;color:#fff;">
            📥 QR İndir (Büyük)
          </a>
        </div>
      `;
    }

    // Canvas çiz
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f5f0e6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    try {
      // Şablonu yükle (custom veya varsayılan)
      const bgImg = new Image();
      if (customTemplateSrc) {
        bgImg.src = customTemplateSrc;
      } else {
        bgImg.src = 'assets/menu_template.jpg?' + Date.now();
      }

      await new Promise((res, rej) => {
        bgImg.onload = res;
        bgImg.onerror = rej;
      });

      canvas.width = bgImg.naturalWidth || 576;
      canvas.height = bgImg.naturalHeight || 1024;
      ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

      // Alt bölge görselleri
      function drawRoundedImage(context, img, x, y, width, height, radius) {
        context.save();
        context.beginPath();
        context.moveTo(x + radius, y);
        context.lineTo(x + width - radius, y);
        context.quadraticCurveTo(x + width, y, x + width, y + radius);
        context.lineTo(x + width, y + height - radius);
        context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        context.lineTo(x + radius, y + height);
        context.quadraticCurveTo(x, y + height, x, y + height - radius);
        context.lineTo(x, y + radius);
        context.quadraticCurveTo(x, y, x + radius, y);
        context.closePath();
        context.clip();
        
        const imgRatio = img.width / img.height;
        const boxRatio = width / height;
        let sWidth, sHeight, sX, sY;
        if (imgRatio > boxRatio) {
          sHeight = img.height;
          sWidth = img.height * boxRatio;
          sY = 0;
          sX = (img.width - sWidth) / 2;
        } else {
          sWidth = img.width;
          sHeight = img.width / boxRatio;
          sX = 0;
          sY = (img.height - sHeight) / 2;
        }
        context.drawImage(img, sX, sY, sWidth, sHeight, x, y, width, height);
        context.restore();
      }

      if (customCanvasImages.left) {
        drawRoundedImage(ctx, customCanvasImages.left, 24, 820, 240, 180, 15);
      }
      if (customCanvasImages.right) {
        drawRoundedImage(ctx, customCanvasImages.right, 312, 820, 240, 180, 15);
      }

      // Bugünün menüsünü veritabanından çek
      const todayStr = new Date().toISOString().split('T')[0];
      const sb = window._supabaseClient;
      const { data } = await sb
        .from('daily_menus')
        .select('*')
        .eq('menu_date', todayStr)
        .maybeSingle();

      if (!data?.items?.length) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Bugün için menü kaydedilmemiş.', canvas.width / 2, canvas.height / 2);
        return;
      }

      const soups = data.items.filter(i => i.category === 'Çorbalar');
      const meals = data.items.filter(i => i.category === 'Yemekler');
      const pilavs = data.items.filter(i => i.category === 'Pilavlar - Makarnalar');
      
      // Pilavlar yemeklerin hemen sonuna yazılır
      const dishes = [...meals, ...pilavs];

      // ── Ağaçören şablonuna göre koordinatlar (D-pad ile ayarlanabilir) ──
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const baseSoupsY = 380 + canvasYOffsets.soups;
      const baseDishesY = 520 + canvasYOffsets.dishes;
      const lineH = 34;

      // Çorbalar
      let yPos = baseSoupsY;
      soups.forEach(item => {
        ctx.fillStyle = '#2e1b0e';
        const fs = canvasFontSizes.soups || 22;
        ctx.font = `bold ${Math.min(fs, 600 / item.name.length * (fs/10))}px 'Georgia', serif`;
        ctx.fillText(item.name, canvas.width / 2, yPos);
        yPos += lineH;
      });

      // Yemekler ve Pilavlar
      yPos = Math.max(yPos + 10, baseDishesY);
      dishes.forEach(item => {
        ctx.fillStyle = '#2e1b0e';
        const fs = canvasFontSizes.dishes || 22;
        ctx.font = `bold ${Math.min(fs, 600 / item.name.length * (fs/10))}px 'Georgia', serif`;
        ctx.fillText(item.name, canvas.width / 2, yPos);
        yPos += lineH;
      });

    } catch (err) {
      console.error('Canvas hatası:', err);
      ctx.fillStyle = '#ef5350';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Şablon yüklenemedi: ' + err.message, canvas.width / 2, canvas.height / 2);
    }
  }

  window.redrawCanvasWithCustomSelections = () => renderShareTab();

  // D-pad Y offset kontrolleri
  window.adjustCanvasY = function(section, delta) {
    canvasYOffsets[section] = (canvasYOffsets[section] || 0) + delta;
    // Gösterge güncelle
    const el = document.getElementById(`canvasY_${section}_val`);
    if (el) el.textContent = (canvasYOffsets[section] > 0 ? '+' : '') + canvasYOffsets[section] + 'px';
    renderShareTab();
  };

  window.resetCanvasY = function(section) {
    canvasYOffsets[section] = 0;
    const el = document.getElementById(`canvasY_${section}_val`);
    if (el) el.textContent = '0px';
    renderShareTab();
  };

  window.adjustCanvasFontSize = function(section, delta) {
    canvasFontSizes[section] = (canvasFontSizes[section] || 26) + delta;
    if (canvasFontSizes[section] < 12) canvasFontSizes[section] = 12; // min size
    if (canvasFontSizes[section] > 72) canvasFontSizes[section] = 72; // max size
    renderShareTab();
  };

  window.resetCanvasFontSize = function(section) {
    canvasFontSizes[section] = 22;
    renderShareTab();
  };

  function downloadMenuImage() {
    const canvas = document.getElementById('menuCanvas');
    if (!canvas) return;
    try {
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `Gunluk_Menu_${new Date().toISOString().split('T')[0]}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      if (window.showToast) window.showToast('İndirilemiyor (CORS hatası olabilir).', 'error');
    }
  }
  window.downloadMenuImage = downloadMenuImage;

  window.handleImageSelect = function(input, previewId, labelId) {
    const file = input.files[0];
    if (!file) return;
    document.getElementById(labelId).textContent = file.name;
    const preview = document.getElementById(previewId);
    if (preview) {
      const reader = new FileReader();
      reader.onload = (e) => {
        preview.src = e.target.result;
        preview.style.display = 'block';
        const icon = document.getElementById(previewId.replace('Preview', 'Icon'));
        if (icon) icon.style.display = 'none';
      };
      reader.readAsDataURL(file);
    }
    if (window.showToast) window.showToast('Görsel seçildi!', 'success');
  };


  window.handleCanvasImg = function(input, side) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        customCanvasImages[side] = img;
        const previewId = side === 'left' ? 'canvasImgLeftPreview' : 'canvasImgRightPreview';
        const previewEl = document.getElementById(previewId);
        if (previewEl) {
          previewEl.src = e.target.result;
          previewEl.style.display = 'block';
        }
        if (window.showToast) window.showToast('Görsel tuvale eklendi!', 'success');
        renderShareTab();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  // ──────────────────────────────────────────
  // PUBLIC EXPORT
  // ──────────────────────────────────────────
  return { init, showPublicMenu, openEditorModal: window.toggleDailyMenuModal };
})();

document.addEventListener('DOMContentLoaded', () => MenuModule.init());
