// js/modules/menu.js — Tüm düzeltmeler uygulandı

const MenuModule = (() => {
  let masterItems = [];
  let currentDailyMenu = null;
  let customTemplateSrc = null; // Aktif özel şablon data-url veya asset şablon src
  let activeTemplateKey = 'default';
  let templateSlots = {
    slot1: null,
    slot2: null,
    slot3: null
  };
  const ASSET_TEMPLATES = {
    default: { name: 'Varsayılan Şablon', src: 'assets/menu_template.jpg' },
    template1: { name: 'Menü Şablonu 1', src: 'assets/menu_template1.jpg' },
    template2: { name: 'Menü Şablonu 2', src: 'assets/menu_template2.jpg', preset: { y: { soups: -10, dishes: 0 } } }
  };
  let customCanvasImages = { left: null, right: null };
  let canvasYOffsets = { soups: -70, dishes: -60 };
  let canvasFontSizes = { soups: 28, dishes: 28 };
  
  // Görsel konum ve boyut ayarları
  let imgOffsetsX = { left: 0, right: 0 };
  let imgOffsetsY = { left: 0, right: 0 };
  let imgSizes = { left: 240, right: 240 };

  let restaurantProfile = {
    name: '',
    logo_url: '',
    phones: [],
    instagram: ''
  };

  const TEMPLATE_SLOTS_KEY = 'menu_template_slots_v2';
  const ACTIVE_TEMPLATE_KEY = 'menu_active_template_key';
  const TEMPLATE_TEXT_SETTINGS_KEY = 'menu_template_text_settings_v2';
  const DESIGN_CANVAS_WIDTH = 576;
  const DESIGN_CANVAS_HEIGHT = 1024;
  const DEFAULT_CANVAS_Y_OFFSETS = { soups: -70, dishes: -60 };
  const DEFAULT_CANVAS_FONT_SIZES = { soups: 28, dishes: 28 };

  function getLocalIsoDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Seçili yemek id'leri (JS ile yönetiliyor, checkbox hack yok)
  let selectedFoodIds = new Set();
  let selectedCanvasImageIds = [];

  function loadTemplateState() {
    try {
      const savedSlots = JSON.parse(localStorage.getItem(TEMPLATE_SLOTS_KEY) || '{}');
      templateSlots = { ...templateSlots, ...savedSlots };
    } catch {}

    const legacyTemplate = localStorage.getItem('menu_custom_template');
    if (legacyTemplate && !templateSlots.slot1) {
      templateSlots.slot1 = { name: 'Eski özel şablon', src: legacyTemplate };
      localStorage.setItem(TEMPLATE_SLOTS_KEY, JSON.stringify(templateSlots));
      localStorage.removeItem('menu_custom_template');
    }

    activeTemplateKey = localStorage.getItem(ACTIVE_TEMPLATE_KEY) || 'default';
    if (activeTemplateKey !== 'default' && !templateSlots[activeTemplateKey] && !ASSET_TEMPLATES[activeTemplateKey]) {
      activeTemplateKey = 'default';
    }
    customTemplateSrc = activeTemplateKey === 'default'
      ? null
      : (templateSlots[activeTemplateKey]?.src || ASSET_TEMPLATES[activeTemplateKey]?.src || null);
    loadTemplateTextSettings();
  }

  function saveTemplateSlots() {
    localStorage.setItem(TEMPLATE_SLOTS_KEY, JSON.stringify(templateSlots));
  }

  function getTemplateTextSettings() {
    try {
      return JSON.parse(localStorage.getItem(TEMPLATE_TEXT_SETTINGS_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveTemplateTextSettings() {
    const all = getTemplateTextSettings();
    all[activeTemplateKey] = {
      y: { ...canvasYOffsets },
      font: { ...canvasFontSizes }
    };
    localStorage.setItem(TEMPLATE_TEXT_SETTINGS_KEY, JSON.stringify(all));
  }

  function loadTemplateTextSettings() {
    const all = getTemplateTextSettings();
    const current = all[activeTemplateKey] || {};
    const preset = ASSET_TEMPLATES[activeTemplateKey]?.preset || {};
    canvasYOffsets = { ...DEFAULT_CANVAS_Y_OFFSETS, ...(preset.y || {}), ...(current.y || {}) };
    canvasFontSizes = { ...DEFAULT_CANVAS_FONT_SIZES, ...(preset.font || {}), ...(current.font || {}) };
    updateCanvasTextControlLabels();
  }

  function updateCanvasTextControlLabels() {
    ['soups', 'dishes'].forEach(section => {
      const yEl = document.getElementById(`canvasY_${section}_val`);
      if (yEl) yEl.textContent = (canvasYOffsets[section] > 0 ? '+' : '') + canvasYOffsets[section] + 'px';
    });
  }

  function getTemplateName(templateKey) {
    if (templateKey === 'default') return 'menu_template.jpg';
    if (ASSET_TEMPLATES[templateKey]) return ASSET_TEMPLATES[templateKey].name;
    return templateSlots[templateKey]?.name || 'Özel Şablon';
  }

  function updateTemplateSelectorUI() {
    const select = document.getElementById('templateSelect');
    if (select) {
      const customOptionId = 'templateSelectCustomOption';
      const existingCustomOpt = select.querySelector(`#${customOptionId}`);
      if (activeTemplateKey.startsWith('slot') && templateSlots[activeTemplateKey]) {
        if (!existingCustomOpt) {
          const opt = document.createElement('option');
          opt.id = customOptionId;
          select.appendChild(opt);
        }
        const currentOpt = select.querySelector(`#${customOptionId}`);
        if (currentOpt) {
          currentOpt.value = activeTemplateKey;
          currentOpt.textContent = `Özel Şablon - ${templateSlots[activeTemplateKey].name}`;
        }
      } else if (existingCustomOpt) {
        existingCustomOpt.remove();
      }

      if (activeTemplateKey.startsWith('slot') && !templateSlots[activeTemplateKey]) {
        activeTemplateKey = 'default';
        customTemplateSrc = null;
      }
      select.value = activeTemplateKey;
    }

    const statusEl = document.getElementById('templateUploadStatus');
    if (statusEl) {
      statusEl.textContent = `Mevcut şablon: ${getTemplateName(activeTemplateKey)}`;
    }

    const deleteBtn = document.getElementById('templateDeleteButton');
    if (deleteBtn) {
      deleteBtn.style.display = (activeTemplateKey.startsWith('slot') && templateSlots[activeTemplateKey]) ? 'inline-flex' : 'none';
    }
  }

  function getUploadTargetSlot() {
    if (activeTemplateKey && activeTemplateKey.startsWith('slot')) {
      return activeTemplateKey;
    }
    return ['slot1', 'slot2', 'slot3'].find(slot => !templateSlots[slot]) || 'slot1';
  }

  // ──────────────────────────────────────────
  // INIT
  // ──────────────────────────────────────────
  async function init() {
    loadTemplateState();

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
      headerTitle.innerHTML = `<div style="font-size:26px; font-weight:700; color:#c2410c; line-height:1.2;">Ağaçören Ev Yemekleri</div>`;
    }
    const headerSub = document.querySelector('#publicMenuScreen p');
    if (headerSub) {
      headerSub.textContent = 'Günün Menüsü';
    }
    const dateEl = document.getElementById('publicMenuDate');
    if (dateEl) {
      const today = new Date();
      const datePart = today.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const dayPart = today.toLocaleDateString('tr-TR', { weekday: 'long' });
      dateEl.textContent = `${datePart} - ${dayPart.charAt(0).toUpperCase()}${dayPart.slice(1)}`;
    }

    // Logo — sadece QR müşteri sayfası
    const logoArea = document.getElementById('publicLogoArea');
    if (logoArea) {
      if (restaurantProfile.logo_url) {
        logoArea.innerHTML = `<img src="${restaurantProfile.logo_url}" style="width:96px; height:96px; border-radius:50%; object-fit:cover; border:2.5px solid #c2410c; box-shadow:0 4px 16px rgba(0,0,0,0.15); margin-bottom:4px;">`;
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
        <a href="https://www.instagram.com/agacorenevyemekleri?igsh=MW44YTZyZzJjOWx5eQ==" target="_blank" rel="noopener noreferrer" style="font-size:15px; color:#c2410c; font-weight:800; display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:16px; text-decoration:none;">
          <img src="assets/instagram.png" style="width:24px; height:24px; border-radius:6px; object-fit:contain;">
          @agacorenevyemekleri
        </a>
        <p style="font-size:11px; color:#a19079; margin:0; font-style:italic;">Afiyet Olsun!</p>
      `;
    }
  }

  function renderProfileTabInputs() {
    const nameEl = document.getElementById('profileRestName');
    const instaEl = document.getElementById('profileInstagram');
    const container = document.getElementById('profilePhoneContainer');
    const logoLabel = document.getElementById('logo-upload-name');
    const logoPreview = document.getElementById('profileLogoPreview');
    const logoIcon = document.getElementById('profileLogoIcon');

    if (nameEl) nameEl.value = restaurantProfile.name;
    if (instaEl) instaEl.value = restaurantProfile.instagram;
    if (logoLabel && restaurantProfile.logo_url) {
      logoLabel.textContent = 'Mevcut Logo Yüklü (Değiştirmek için tıklayın)';
    }
    if (logoPreview && restaurantProfile.logo_url) {
      logoPreview.src = restaurantProfile.logo_url;
      logoPreview.style.display = 'block';
      if (logoIcon) logoIcon.style.display = 'none';
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
      const targetSlot = getUploadTargetSlot();
      templateSlots[targetSlot] = {
        name: file.name,
        src: e.target.result
      };
      activeTemplateKey = targetSlot;
      customTemplateSrc = e.target.result;
      saveTemplateSlots();
      localStorage.setItem(ACTIVE_TEMPLATE_KEY, activeTemplateKey);
      loadTemplateTextSettings();
      updateTemplateSelectorUI();
      if (window.showToast) window.showToast('Şablon güncellendi!', 'success');
      renderShareTab();
    };
    reader.readAsDataURL(file);
  };

  window.selectTemplate = function(templateKey) {
    activeTemplateKey = templateKey || 'default';
    customTemplateSrc = activeTemplateKey === 'default'
      ? null
      : (templateSlots[activeTemplateKey]?.src || ASSET_TEMPLATES[activeTemplateKey]?.src || null);
    localStorage.setItem(ACTIVE_TEMPLATE_KEY, activeTemplateKey);
    loadTemplateTextSettings();
    updateTemplateSelectorUI();
    renderShareTab();
  };

  window.resetTemplate = function() {
    activeTemplateKey = 'default';
    customTemplateSrc = null;
    localStorage.setItem(ACTIVE_TEMPLATE_KEY, activeTemplateKey);
    loadTemplateTextSettings();
    updateTemplateSelectorUI();
    if (window.showToast) window.showToast('Varsayılan şablon seçildi.', 'success');
    renderShareTab();
  };

  window.deleteSelectedTemplate = function() {
    if (!activeTemplateKey.startsWith('slot') || !templateSlots[activeTemplateKey]) {
      if (window.showToast) window.showToast('Silinebilecek bir özel şablon seçili değil.', 'error');
      return;
    }
    const proceed = () => {
      templateSlots[activeTemplateKey] = null;
      saveTemplateSlots();
      activeTemplateKey = 'default';
      customTemplateSrc = null;
      localStorage.setItem(ACTIVE_TEMPLATE_KEY, activeTemplateKey);
      loadTemplateTextSettings();
      updateTemplateSelectorUI();
      renderShareTab();
      if (window.showToast) window.showToast('Özel şablon silindi.', 'success');
    };
    if (window.showCustomConfirm) {
      window.showCustomConfirm('Seçili özel şablonu silmek istediğinize emin misiniz?', proceed, { okText: 'Sil', okColor: '#ef5350' });
    } else if (confirm('Seçili özel şablonu silmek istediğinize emin misiniz?')) {
      proceed();
    }
  };

  // ──────────────────────────────────────────
  // IMAGE COMPRESSION
  // ──────────────────────────────────────────
  // Basit toast helper: eğer global toast yoksa console'a düşsün
  function toast(msg, type = 'default') {
    if (window.showToast) {
      try { window.showToast(msg, type); } catch (e) { console.log('[toast error]', e); }
    } else {
      console.log('[toast]', type, msg);
    }
  }

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
      const todayStr = getLocalIsoDate();

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
            ? `<div style="width:72px;height:72px;border-radius:10px;overflow:hidden;border:1.5px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.06);flex-shrink:0;"><img src="${food.image_url}" style="width:100%;height:100%;object-fit:cover;"></div>`
            : `<div style="width:72px;height:72px;border-radius:10px;background:#f0e8db;display:flex;align-items:center;justify-content:center;font-size:32px;flex-shrink:0;">🍲</div>`;

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
  window.toggleDailyMenuModal = async function() {
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
      if (window.showToast) window.showToast('Günün Menüsü İçin Tarihi Seçin', 'default');
      switchTab('builder');
      loadMasterItems();
      const today = getLocalIsoDate();
      const dateInput = document.getElementById('menuBuilderDate');
      if (dateInput) { dateInput.value = today; }
      selectedFoodIds.clear();
      selectedCanvasImageIds = [];
      currentDailyMenu = { menu_date: today, items: [] };
      await loadDailyMenuForDate(today);
    }
  };

  function switchTab(tabId) {
    document.querySelectorAll('.menu-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.menu-tab-content').forEach(el => {
      el.style.display = el.id === `tabContent-${tabId}` ? 'flex' : 'none';
      if (el.style.display === 'flex') {
        el.style.flexDirection = 'column';
      }
    });
    if (tabId === 'exporter') {
      updateTemplateSelectorUI();
      loadTemplateTextSettings();
      renderShareTab();
    }
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

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadFoodImage(file) {
    const sb = window._supabaseClient;
    console.debug('uploadFoodImage start', file && file.name, file && file.size);
    const compressed = await compressImage(file);
    const ext = compressed.name.split('.').pop();
    const fileName = `food-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    try {
      const { error: upErr } = await sb.storage.from('menu-items').upload(fileName, compressed);
      console.debug('upload result', { upErr });
      if (upErr) throw upErr;
      const { data: urlData, error: urlErr } = sb.storage.from('menu-items').getPublicUrl(fileName);
      console.debug('getPublicUrl', { urlData, urlErr });
      if (urlErr || !urlData?.publicUrl) throw urlErr || new Error('Public URL alınamadı');
      return urlData.publicUrl;
    } catch (err) {
      console.warn('Storage upload failed, fallback to data URL:', err);
      // Eğer depolama yapılamıyorsa bile görseli doğrudan base64 URL olarak kaydetmeyi dene
      if (file.size <= 2_500_000) {
        return await readFileAsDataURL(file);
      }
      throw err;
    }
  }

  async function addMasterItem(e) {
    e.preventDefault();
    const sb = window._supabaseClient;

    const name = document.getElementById('newFoodName')?.value?.trim();
    const category = document.getElementById('newFoodCategory')?.value;
    const priceRaw = document.getElementById('newFoodPrice')?.value?.replace(',', '.');
    const price = parseFloat(priceRaw) || 0;
    let file = document.getElementById('newFoodImage')?.files[0];
    // Eğer input.files boş geliyorsa (bazı tarayıcı durumları) önceki seçimi fallback olarak kullan
    if (!file && window._lastSelectedMasterFoodImage) {
      file = window._lastSelectedMasterFoodImage;
    }
    const editingId = window.editingFoodItemId;

    if (!name || !category) {
      toast('Yemek adı ve kategori zorunludur.', 'error');
      return;
    }

    try {
      toast('Kaydediliyor...', 'default');

      let imageUrl = null;

      if (file) {
        try {
          imageUrl = await uploadFoodImage(file);
        } catch (uploadErr) {
          console.error('Görsel yükleme hatası:', uploadErr);
          toast('Görsel yüklenemedi: ' + uploadErr.message, 'error');
          imageUrl = null;
        }
      }

      if (editingId) {
        // Güncelleme
        let payload = { name, category, price };
        if (imageUrl) payload.image_url = imageUrl;

        console.debug('update payload', { editingId, payload });

        try {
          const { error } = await sb
            .from('menu_items')
            .update(payload)
            .eq('id', editingId);

          if (error) {
            console.debug('update error', error);
            // Eğer price kolonu yoksa, price olmadan tekrar dene
            const msg = (error.message || '').toLowerCase();
            if (error.code === 'PGRST204' || /column .* does not exist/.test(msg) || /column .*unknown/.test(msg)) {
              const payload2 = { name, category };
              if (imageUrl) payload2.image_url = imageUrl;
              console.debug('retrying update without price', { editingId, payload2 });
              const { error: e2 } = await sb.from('menu_items').update(payload2).eq('id', editingId);
              if (e2) throw e2;
            } else {
              throw error;
            }
          }
        } catch (upErr) {
          console.error('Güncelleme başarısız:', upErr);
          toast('Güncelleme hatası: ' + (upErr.message || upErr), 'error');
          throw upErr;
        }

        toast('Yemek güncellendi!', 'success');
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
      const fileInput = document.getElementById('newFoodImage');
      if (fileInput) fileInput.value = '';
      // Fallback olarak saklanan dosyayı temizle
      if (window._lastSelectedMasterFoodImage) window._lastSelectedMasterFoodImage = null;
      const fileLabel = document.getElementById('file-upload-name');
      if (fileLabel) fileLabel.textContent = 'Görsel Yüklemek İçin Tıklayın';
      const previewEl = document.getElementById('newFoodImagePreview');
      if (previewEl) {
        previewEl.src = '';
        previewEl.style.display = 'none';
      }
      const iconEl = document.getElementById('newFoodImageIcon');
      if (iconEl) iconEl.style.display = 'block';

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
    const fileInput = document.getElementById('newFoodImage');
    if (fileInput) fileInput.value = '';
    // Önceki seçimi temizle ki aynı dosya tekrar seçildiğinde onchange tetiklensin
    if (window._lastSelectedMasterFoodImage) window._lastSelectedMasterFoodImage = null;
    if (fileLabel) fileLabel.textContent = item.image_url ? 'Mevcut Görsel Korunuyor — yeni görsel seçebilirsiniz' : 'Görsel Yüklemek İçin Tıklayın';

    const previewEl = document.getElementById('newFoodImagePreview');
    const iconEl = document.getElementById('newFoodImageIcon');
    if (item.image_url && previewEl) {
      previewEl.src = item.image_url;
      previewEl.style.display = 'block';
      if (iconEl) iconEl.style.display = 'none';
    } else if (previewEl) {
      previewEl.src = '';
      previewEl.style.display = 'none';
      if (iconEl) iconEl.style.display = 'block';
    }

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

    // Kategorilere göre gruplama
    const groups = { 'Çorbalar': [], 'Yemekler': [], 'Pilavlar - Makarnalar': [] };
    masterItems.forEach(item => {
      const cat = item.category === 'Çorbalar' ? 'Çorbalar' : (item.category === 'Pilavlar - Makarnalar' ? 'Pilavlar - Makarnalar' : 'Yemekler');
      groups[cat].push(item);
    });

    let html = '';
    ['Çorbalar', 'Yemekler', 'Pilavlar - Makarnalar'].forEach(cat => {
      const list = groups[cat] || [];
      if (!list.length) return;

      // Kategori başlığı — alt çizgili ve altında hemen yemekler başlasın
      html += `<div style="grid-column:1/-1;padding:8px 0;margin:0;color:#10b981;font-size:13px;font-weight:800;text-align:center;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(16,185,129,0.2);">${cat}</div>`;

      // Kategori içinde yemekler
      html += list.map((item, idx) => {
        const img = item.image_url
          ? `<img src="${item.image_url}" style="width:56px;height:56px;border-radius:8px;object-fit:cover;">`
          : `<div style="width:56px;height:56px;border-radius:8px;background:#242f3d;display:flex;align-items:center;justify-content:center;font-size:28px;border:1px dashed rgba(255,255,255,0.08);">🍲</div>`;

        const priceTag = item.price
          ? `<span style="color:#fbbf24;font-size:12px;font-weight:800;background:rgba(251,191,36,0.08);padding:2px 6px;border-radius:6px;">${item.price} ₺</span>`
          : `<span style="color:#708499;font-size:11px;">—</span>`;

        return `
          <div style="height:112px;box-sizing:border-box;background:#17212b;border:1px solid #232e3c;border-radius:12px;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
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
    });

    container.innerHTML = html;
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
        const canvasSlot = selectedCanvasImageIds.indexOf(item.id) + 1;
        const imagePickHtml = canvasSlot
          ? `<span style="color:#000;font-size:11px;font-weight:900;">${canvasSlot}</span>`
          : '<span style="color:#708499;font-size:13px;">📷</span>';
        const imagePickTitle = item.image_url ? 'QR canvas görseli seç' : 'Bu yemeğin görseli yok';

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
              <button type="button" id="canvas-pick-${item.id}" title="${imagePickTitle}" onclick="event.stopPropagation(); window.toggleCanvasImageSelection(${item.id})" style="width:28px;height:28px;border-radius:7px;border:1px solid ${canvasSlot ? '#10b981' : '#3a4b5c'};background:${canvasSlot ? '#10b981' : 'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;padding:0;">
                ${imagePickHtml}
              </button>
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
      selectedCanvasImageIds = selectedCanvasImageIds.filter(selectedId => selectedId !== id);
    } else {
      selectedFoodIds.add(id);
    }

    renderBuilderItemsList();
  };

  window.toggleCanvasImageSelection = function(id) {
    const item = masterItems.find(i => i.id === id);
    if (!item?.image_url) {
      if (window.showToast) window.showToast('Bu yemeğin görseli yok. Önce Yemek Listesi sekmesinden görsel ekleyin.', 'error');
      return;
    }
    if (!selectedFoodIds.has(id)) {
      if (window.showToast) window.showToast('Önce yemeği günlük menüye ekleyin.', 'error');
      return;
    }

    if (selectedCanvasImageIds.includes(id)) {
      selectedCanvasImageIds = selectedCanvasImageIds.filter(selectedId => selectedId !== id);
    } else {
      if (selectedCanvasImageIds.length >= 2) {
        if (window.showToast) window.showToast('QR canvas için en fazla 2 yemek görseli seçilebilir.', 'error');
        return;
      }
      selectedCanvasImageIds.push(id);
    }

    renderBuilderItemsList();
  };

  // ──────────────────────────────────────────
  // DAILY MENU LOAD / SAVE / CLEAR
  // ──────────────────────────────────────────
  async function loadDailyMenuForDate(dateStr) {
    if (!dateStr) return;
    const sb = window._supabaseClient;
    const dateInput = document.getElementById('menuBuilderDate');
    if (dateInput) dateInput.value = dateStr;

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
      selectedCanvasImageIds = (currentDailyMenu.items || [])
        .filter(i => i.canvas_image_slot)
        .sort((a, b) => a.canvas_image_slot - b.canvas_image_slot)
        .map(i => i.id);

      renderBuilderItemsList();
      if (window.renderShareTab) window.renderShareTab();
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
        const canvasSlotIndex = selectedCanvasImageIds.indexOf(id);
        const itemPayload = { ...master, price };
        if (canvasSlotIndex !== -1) itemPayload.canvas_image_slot = canvasSlotIndex + 1;
        items.push(itemPayload);
      }
    });

    try {
      if (window.showToast) window.showToast('Menü kaydediliyor...', 'default');

      const { data: authData, error: authError } = await sb.auth.getUser();
      if (authError) throw authError;
      const userId = authData?.user?.id || null;
      const { error } = await sb.from('daily_menus').upsert(
        { menu_date: dateStr, items, created_by: userId },
        { onConflict: 'menu_date' }
      );
      if (error) throw error;

      let formattedDateText = dateStr;
      try {
        const d = new Date(dateStr);
        if (!isNaN(d)) {
          const formattedDate = d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
          const dayName = d.toLocaleDateString('tr-TR', { weekday: 'long' });
          formattedDateText = `${formattedDate} ${dayName}`;
        }
      } catch (e) {}

      if (window.showToast) window.showToast(`${formattedDateText} Günü Menüsü Oluşturuldu`, 'success');
      currentDailyMenu = { menu_date: dateStr, items };
      renderBuilderItemsList();
      setTimeout(() => switchTab('exporter'), 900);

    } catch (err) {
      console.error(err);
      if (window.showToast) window.showToast('Kayıt hatası: ' + err.message, 'error');
    }
  }
  window.saveDailyMenu = saveDailyMenu;

  window.resetShareMenu = function() {
    activeTemplateKey = 'default';
    customTemplateSrc = null;
    localStorage.setItem(ACTIVE_TEMPLATE_KEY, activeTemplateKey);
    customCanvasImages = { left: null, right: null };
    
    // Preview'leri temizle
    const pL = document.getElementById('canvasImgLeftPreview');
    const pR = document.getElementById('canvasImgRightPreview');
    if (pL) { pL.src = ''; pL.style.display = 'none'; }
    if (pR) { pR.src = ''; pR.style.display = 'none'; }
    
    updateTemplateSelectorUI();
    
    // Konum ve Boyutları Sıfırla
    if (window.resetImg) {
      window.resetImg('left');
      window.resetImg('right');
    }
    if (window.resetCanvasY) {
      window.resetCanvasY('soups');
      window.resetCanvasY('dishes');
    }
    if (window.resetCanvasFontSize) {
      window.resetCanvasFontSize('soups');
      window.resetCanvasFontSize('dishes');
    }
    
    renderShareTab();
  };

  window.clearDailyMenu = function() {
    selectedFoodIds.clear();
    selectedCanvasImageIds = [];
    const dateStr = document.getElementById('menuBuilderDate')?.value;
    currentDailyMenu = { menu_date: dateStr || '', items: [] };
    renderBuilderItemsList();
    if (window.showToast) window.showToast('Seçimler temizlendi.', 'success');
  };

  // ──────────────────────────────────────────
  // CANVAS / SHARE TAB
  // ──────────────────────────────────────────
  async function renderShareTab() {
    const canvas = document.getElementById('menuCanvas');
    const qrContainer = document.getElementById('menuQrContainer');
    if (!canvas) return;

    updateCanvasImageSelectionUI();

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
      const scaleX = canvas.width / DESIGN_CANVAS_WIDTH;
      const scaleY = canvas.height / DESIGN_CANVAS_HEIGHT;
      const scale = Math.min(scaleX, scaleY);

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

      function loadCanvasImage(url) {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = url;
        });
      }

      if (customCanvasImages.left) {
        let sizeL = (imgSizes.left || 240) * scaleX;
        let xL = (24 + (imgOffsetsX.left || 0)) * scaleX;
        let yL = (820 + (imgOffsetsY.left || 0)) * scaleY;
        // keep aspect ratio, original height was 180 for 240 width (3:4 ratio roughly, exactly 4:3 is 240x180)
        let hL = ((imgSizes.left || 240) * (180/240)) * scaleY;
        drawRoundedImage(ctx, customCanvasImages.left, xL, yL, sizeL, hL, 15 * scale);
      }
      if (customCanvasImages.right) {
        let sizeR = (imgSizes.right || 240) * scaleX;
        let xR = (312 + (imgOffsetsX.right || 0)) * scaleX;
        let yR = (820 + (imgOffsetsY.right || 0)) * scaleY;
        let hR = ((imgSizes.right || 240) * (180/240)) * scaleY;
        drawRoundedImage(ctx, customCanvasImages.right, xR, yR, sizeR, hR, 15 * scale);
      }

      // Bugünün menüsünü veritabanından çek
      const selectedDate = document.getElementById('menuBuilderDate')?.value || getLocalIsoDate();
      const sb = window._supabaseClient;
      const { data } = await sb
        .from('daily_menus')
        .select('*')
        .eq('menu_date', selectedDate)
        .maybeSingle();

      if (!data?.items?.length) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.font = `bold ${16 * scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`${selectedDate} için menü kaydedilmemiş.`, canvas.width / 2, canvas.height / 2);
        return;
      }

      const savedCanvasItems = (data.items || [])
        .filter(i => i.canvas_image_slot && i.image_url)
        .sort((a, b) => a.canvas_image_slot - b.canvas_image_slot)
        .slice(0, 2);

      if (!customCanvasImages.left && savedCanvasItems[0]?.image_url) {
        try {
          const autoLeft = await loadCanvasImage(savedCanvasItems[0].image_url);
          let sizeL = (imgSizes.left || 240) * scaleX;
          let xL = (24 + (imgOffsetsX.left || 0)) * scaleX;
          let yL = (820 + (imgOffsetsY.left || 0)) * scaleY;
          let hL = ((imgSizes.left || 240) * (180/240)) * scaleY;
          drawRoundedImage(ctx, autoLeft, xL, yL, sizeL, hL, 15 * scale);
        } catch {}
      }
      if (!customCanvasImages.right && savedCanvasItems[1]?.image_url) {
        try {
          const autoRight = await loadCanvasImage(savedCanvasItems[1].image_url);
          let sizeR = (imgSizes.right || 240) * scaleX;
          let xR = (312 + (imgOffsetsX.right || 0)) * scaleX;
          let yR = (820 + (imgOffsetsY.right || 0)) * scaleY;
          let hR = ((imgSizes.right || 240) * (180/240)) * scaleY;
          drawRoundedImage(ctx, autoRight, xR, yR, sizeR, hR, 15 * scale);
        } catch {}
      }

      const soups = data.items.filter(i => i.category === 'Çorbalar');
      const meals = data.items.filter(i => i.category === 'Yemekler');
      const pilavs = data.items.filter(i => i.category === 'Pilavlar - Makarnalar');
      
      // Pilavlar yemeklerin hemen sonuna yazılır
      const dishes = [...meals, ...pilavs];

      // ── Ağaçören şablonuna göre koordinatlar (D-pad ile ayarlanabilir) ──
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const baseSoupsY = (380 + canvasYOffsets.soups) * scaleY;
      const baseDishesY = (520 + canvasYOffsets.dishes) * scaleY;
      const lineH = 34 * scaleY;

      // Çorbalar
      let yPos = baseSoupsY;
      soups.forEach(item => {
        ctx.fillStyle = '#2e1b0e';
        const fs = (canvasFontSizes.soups || 22) * scale;
        ctx.font = `bold ${Math.min(fs, (600 * scaleX) / item.name.length * (fs/10))}px 'Georgia', serif`;
        ctx.fillText(item.name, canvas.width / 2, yPos);
        yPos += lineH;
      });

      // Yemekler ve Pilavlar
      yPos = Math.max(yPos + 10, baseDishesY);
      dishes.forEach(item => {
        ctx.fillStyle = '#2e1b0e';
        const fs = (canvasFontSizes.dishes || 22) * scale;
        ctx.font = `bold ${Math.min(fs, (600 * scaleX) / item.name.length * (fs/10))}px 'Georgia', serif`;
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
    saveTemplateTextSettings();
    renderShareTab();
  };

  window.resetCanvasY = function(section) {
    canvasYOffsets[section] = DEFAULT_CANVAS_Y_OFFSETS[section];
    const el = document.getElementById(`canvasY_${section}_val`);
    if (el) el.textContent = canvasYOffsets[section] + 'px';
    saveTemplateTextSettings();
    renderShareTab();
  };

  window.adjustCanvasFontSize = function(section, delta) {
    canvasFontSizes[section] = (canvasFontSizes[section] || 28) + delta;
    if (canvasFontSizes[section] < 12) canvasFontSizes[section] = 12; // min size
    if (canvasFontSizes[section] > 72) canvasFontSizes[section] = 72; // max size
    saveTemplateTextSettings();
    renderShareTab();
  };

  window.resetCanvasFontSize = function(section) {
    canvasFontSizes[section] = DEFAULT_CANVAS_FONT_SIZES[section];
    saveTemplateTextSettings();
    renderShareTab();
  };

  // Görsel (Sol/Sağ) Ayarları
  window.adjustImgPos = function(side, axis, delta) {
    if (axis === 'x') imgOffsetsX[side] = (imgOffsetsX[side] || 0) + delta;
    if (axis === 'y') imgOffsetsY[side] = (imgOffsetsY[side] || 0) + delta;
    
    const elX = document.getElementById(`img_${side}_x_val`);
    const elY = document.getElementById(`img_${side}_y_val`);
    if (elX) elX.textContent = imgOffsetsX[side] + 'px';
    if (elY) elY.textContent = imgOffsetsY[side] + 'px';
    
    renderShareTab();
  };

  window.adjustImgSize = function(side, delta) {
    imgSizes[side] = (imgSizes[side] || 240) + delta;
    if (imgSizes[side] < 50) imgSizes[side] = 50; // min size
    if (imgSizes[side] > 500) imgSizes[side] = 500; // max size
    
    const el = document.getElementById(`img_${side}_size_val`);
    if (el) el.textContent = imgSizes[side] + 'px';
    
    renderShareTab();
  };

  window.resetImg = function(side) {
    imgOffsetsX[side] = 0;
    imgOffsetsY[side] = 0;
    imgSizes[side] = 240;
    
    const elX = document.getElementById(`img_${side}_x_val`);
    const elY = document.getElementById(`img_${side}_y_val`);
    const elS = document.getElementById(`img_${side}_size_val`);
    if (elX) elX.textContent = '0px';
    if (elY) elY.textContent = '0px';
    if (elS) elS.textContent = '240px';
    
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
    // Son seçilen dosyayı global olarak sakla; bazı durumlarda input.files okunamayabiliyor
    window._lastSelectedMasterFoodImage = file;
    document.getElementById(labelId).textContent = file.name;
    const preview = document.getElementById(previewId);
    if (preview) {
      const reader = new FileReader();
      reader.onload = (e) => {
        preview.src = e.target.result;
        preview.style.display = 'block';
        const icon = document.getElementById(previewId.replace('Preview', 'Icon'));
        if (icon) icon.style.display = 'none';
        updateCanvasImageSelectionUI();
      };
      reader.readAsDataURL(file);
    }
    toast('Görsel seçildi!', 'success');
  };


  let activeCanvasImageSide = 'left';

  function updateCanvasImageSelectionUI() {
    const leftCard = document.getElementById('canvasImgLeftCard');
    const rightCard = document.getElementById('canvasImgRightCard');
    const label = document.getElementById('selectedCanvasImageLabel');
    const xVal = document.getElementById('selected_img_x_val');
    const yVal = document.getElementById('selected_img_y_val');
    const sizeVal = document.getElementById('selected_img_size_val');
    const leftBtn = document.getElementById('canvasImageLeftSelector');
    const rightBtn = document.getElementById('canvasImageRightSelector');

    if (leftCard) leftCard.style.borderColor = activeCanvasImageSide === 'left' ? '#10b981' : '#232e3c';
    if (rightCard) rightCard.style.borderColor = activeCanvasImageSide === 'right' ? '#10b981' : '#232e3c';
    if (leftBtn) leftBtn.style.background = activeCanvasImageSide === 'left' ? '#10b981' : '#2b3a4a';
    if (rightBtn) rightBtn.style.background = activeCanvasImageSide === 'right' ? '#10b981' : '#2b3a4a';
    if (label) label.textContent = activeCanvasImageSide === 'left' ? '1. Görsel Sol' : '2. Görsel Sağ';
    if (xVal) xVal.textContent = (imgOffsetsX[activeCanvasImageSide] || 0) + 'px';
    if (yVal) yVal.textContent = (imgOffsetsY[activeCanvasImageSide] || 0) + 'px';
    if (sizeVal) sizeVal.textContent = (imgSizes[activeCanvasImageSide] || 240) + 'px';
  }

  window.selectCanvasImageSide = function(side) {
    activeCanvasImageSide = side === 'right' ? 'right' : 'left';
    updateCanvasImageSelectionUI();
  };

  window.adjustSelectedCanvasImgPos = function(axis, delta) {
    window.adjustImgPos(activeCanvasImageSide, axis, delta);
    updateCanvasImageSelectionUI();
  };

  window.adjustSelectedCanvasImgSize = function(delta) {
    window.adjustImgSize(activeCanvasImageSide, delta);
    updateCanvasImageSelectionUI();
  };

  window.resetSelectedImg = function() {
    window.resetImg(activeCanvasImageSide);
    updateCanvasImageSelectionUI();
  };

  window.openCanvasImageModal = function(side) {
    activeCanvasImageSide = side;
    const modal = document.getElementById('canvasImageModal');
    const listContainer = document.getElementById('canvasImageModalList');
    const uploadBtn = document.getElementById('canvasImageModalUploadBtn');

    if (!modal || !listContainer) {
      alert('Görsel seçim paneli bulunamadı. Sayfayı yenileyin.');
      return;
    }

    // Upload butonu
    if (uploadBtn) {
      uploadBtn.onclick = function() {
        const fileInputId = side === 'left' ? 'canvasImgLeft' : 'canvasImgRight';
        const fi = document.getElementById(fileInputId);
        if (fi) fi.click();
        modal.style.display = 'none';
      };
    }

    // Önce zaten yüklenmiş masterItems kullan (hızlı, ağ gerektirmez)
    let allFoods = [];
    if (masterItems && masterItems.length > 0) {
      allFoods = masterItems.filter(function(i) { return i.image_url && i.image_url.trim() !== ''; });
    }

    // Bugünkü menü ID'leri
    var todayIds = [];
    if (currentDailyMenu && currentDailyMenu.items) {
      todayIds = currentDailyMenu.items.map(function(i) { return i.id; });
    } else {
      todayIds = Array.from(selectedFoodIds);
    }

    // Listeyi oluştur
    function buildList(foods) {
      if (!foods || foods.length === 0) {
        listContainer.innerHTML = [
          '<div style="color:#708499; text-align:center; padding:30px;">',
          '<div style="font-size:32px; margin-bottom:10px;">🍽️</div>',
          '<div style="font-weight:700; margin-bottom:6px;">Kayıtlı görsel bulunamadı</div>',
          '<div style="font-size:11px;">Yemek Listesi\'nden yemeklere görsel ekleyin,<br>ya da aşağıdaki butonla yeni görsel yükleyin.</div>',
          '</div>'
        ].join('');
        return;
      }

      var todayFoods = foods.filter(function(i) { return todayIds.includes(i.id); });
      var otherFoods = foods.filter(function(i) { return !todayIds.includes(i.id); });
      var displayItems = todayFoods.concat(otherFoods);

      listContainer.innerHTML = displayItems.map(function(item) {
        var safeUrl = (item.image_url || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        var isToday = todayIds.includes(item.id);
        var badge = isToday ? '<span style="background:#10b981;color:#fff;font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px;margin-left:6px;">BUGÜN</span>' : '';
        return [
          '<div onclick="window.selectCanvasImageFromURL(\'' + safeUrl + '\')"',
          ' style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-bottom:1px solid #1a2433;cursor:pointer;transition:background 0.15s;"',
          ' onmouseover="this.style.background=\'#1e2d3d\'"',
          ' onmouseout="this.style.background=\'transparent\'">',
          '<img src="' + item.image_url + '"',
          ' style="width:56px;height:56px;border-radius:10px;object-fit:cover;border:1px solid #374151;flex-shrink:0;"',
          ' onerror="this.style.display=\'none\'">',
          '<div style="flex:1;min-width:0;">',
          '<div style="color:#fff;font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + item.name + badge + '</div>',
          '<div style="color:#708499;font-size:11px;margin-top:2px;">' + (item.category || '') + '</div>',
          '</div>',
          '<div style="color:#10b981;font-size:18px;flex-shrink:0;">›</div>',
          '</div>'
        ].join('');
      }).join('');
    }

    if (allFoods.length > 0) {
      // masterItems yüklüyse direk göster
      buildList(allFoods);
      modal.style.display = 'flex';
    } else {
      // masterItems boşsa Supabase'den çek
      listContainer.innerHTML = '<div style="color:#708499;text-align:center;padding:30px;font-size:13px;">⏳ Yükleniyor...</div>';
      modal.style.display = 'flex';
      var sb = window._supabaseClient;
      if (!sb) {
        listContainer.innerHTML = '<div style="color:#ef5350;text-align:center;padding:20px;">Bağlantı kurulamadı. Galeriden yükleyin.</div>';
        return;
      }
      sb.from('menu_items').select('id, name, image_url, category').order('name').then(function(result) {
        if (result.error) {
          listContainer.innerHTML = '<div style="color:#ef5350;text-align:center;padding:20px;">❌ ' + result.error.message + '</div>';
          return;
        }
        var foods = (result.data || []).filter(function(i) { return i.image_url && i.image_url.trim() !== ''; });
        buildList(foods);
      });
    }
  };

  window.selectCanvasImageFromURL = function(url) {
    const side = activeCanvasImageSide;
    const modal = document.getElementById('canvasImageModal');

    // Modalı hemen kapat
    if (modal) modal.style.display = 'none';

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      customCanvasImages[side] = img;
      // Önizleme güncelle
      const previewId = side === 'left' ? 'canvasImgLeftPreview' : 'canvasImgRightPreview';
      const previewEl = document.getElementById(previewId);
      if (previewEl) {
        previewEl.src = url;
        previewEl.style.display = 'block';
      }
      // Canvas butonunu güncelle
      const btnLeft = document.getElementById('canvasImgLeftCard');
      const btnRight = document.getElementById('canvasImgRightCard');
      if (side === 'left' && btnLeft) btnLeft.style.borderColor = '#10b981';
      if (side === 'right' && btnRight) btnRight.style.borderColor = '#10b981';

      toast('Görsel eklendi! ✓', 'success');
      renderShareTab();
    };
    img.onerror = () => {
      toast('Görsel yüklenemedi. Farklı bir görsel deneyin.', 'error');
    };
    img.src = url;
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
        toast('Görsel tuvale eklendi!', 'success');
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
