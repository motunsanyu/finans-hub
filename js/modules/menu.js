// js/modules/menu.js

const MenuModule = (() => {
  let masterItems = [];
  let currentDailyMenu = null;
  
  // Restaurant Profile default configuration
  let restaurantProfile = {
    name: 'AĞAÇÖREN EV YEMEKLERİ',
    logo_url: '',
    phones: ['0 545 282 97 34', '0 530 583 41 62'],
    instagram: '@agacorenevyemekleri'
  };

  async function init() {
    console.log("🍱 Günlük Menü Modülü Başlatılıyor...");
    
    // Yükleniyor durumunda veya müşteri bypass modundaysak
    if (window.isPublicMenuMode) {
      await loadProfileSettings(); // Önce profil/iletişim bilgilerini çek
      showPublicMenu();
      return;
    }

    // Admin durumunda profili yükle
    await loadProfileSettings();
  }

  // ==========================================
  // PROFILE SETTINGS DATA LAYER
  // ==========================================
  async function loadProfileSettings() {
    try {
      const sb = window._supabaseClient;
      
      // SQL tablosundan ayarları çekmeyi dene
      const { data, error } = await sb
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
        // Tablo henüz yoksa localStorage fallback kullan
        const localData = localStorage.getItem('restaurant_profile_settings');
        if (localData) {
          restaurantProfile = JSON.parse(localData);
        }
      }
    } catch (err) {
      console.warn("Profil ayarları veritabanından çekilemedi, local/default kullanılıyor:", err);
      const localData = localStorage.getItem('restaurant_profile_settings');
      if (localData) {
        restaurantProfile = JSON.parse(localData);
      }
    }

    // UI'daki İletişim Footer ve Header kısımlarını dinamik güncelle
    updatePublicUIBranding();
    renderProfileTabInputs();
  }

  function updatePublicUIBranding() {
    // QR Kamu Görünümü Başlığı
    const headerTitle = document.querySelector('#publicMenuScreen h1');
    if (headerTitle) {
      headerTitle.textContent = restaurantProfile.name.split(' ')[0] || restaurantProfile.name;
    }
    const headerSub = document.querySelector('#publicMenuScreen p');
    if (headerSub) {
      headerSub.textContent = restaurantProfile.name.includes(' ') 
        ? restaurantProfile.name.substring(restaurantProfile.name.indexOf(' ') + 1) + ' • GÜNÜN MENÜSÜ'
        : 'Ev Yemekleri • Günün Menüsü';
    }

    // QR Kamu Görünümü Logosu
    const headerDiv = document.querySelector('#publicMenuScreen style + div > div');
    if (headerDiv && restaurantProfile.logo_url) {
      const logoIcon = headerDiv.querySelector('div:first-child');
      if (logoIcon) {
        logoIcon.innerHTML = `<img src="${restaurantProfile.logo_url}" style="width:64px; height:64px; border-radius:50%; object-fit:cover; border: 2px solid #c2410c; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">`;
      }
    }

    // Kamu Görünümü İletişim Alanı
    const footerDiv = document.querySelector('#publicMenuScreen style + div > div + div + div');
    if (footerDiv) {
      const phonesHtml = restaurantProfile.phones.join(' - ');
      footerDiv.innerHTML = `
        <div style="font-size:13px; color:#5c4c38; font-weight:800; display:flex; align-items:center; justify-content:center; gap:6px; margin-bottom:10px;">
          📞 ${phonesHtml}
        </div>
        <div style="font-size:12px; color:#7f6d53; font-weight:700; display:flex; align-items:center; justify-content:center; gap:6px; margin-bottom:16px;">
          📸 ${restaurantProfile.instagram}
        </div>
        <p style="font-size:11px; color:#a19079; margin:0; font-style:italic;">Afiyet Olsun!</p>
      `;
    }
  }

  function renderProfileTabInputs() {
    const restNameInput = document.getElementById('profileRestName');
    const instaInput = document.getElementById('profileInstagram');
    const phoneContainer = document.getElementById('profilePhoneContainer');

    if (restNameInput) restNameInput.value = restaurantProfile.name;
    if (instaInput) instaInput.value = restaurantProfile.instagram;

    // Logo yükleme etiketini güncelle
    const logoLabel = document.getElementById('logo-upload-name');
    if (logoLabel && restaurantProfile.logo_url) {
      logoLabel.textContent = 'Mevcut Logo Yüklü (Değiştirmek İçin Tıklayın)';
    }

    if (phoneContainer) {
      phoneContainer.innerHTML = '';
      restaurantProfile.phones.forEach((phone, idx) => {
        addPhoneInputField(phone, idx > 0);
      });
      if (restaurantProfile.phones.length === 0) {
        addPhoneInputField('', false);
      }
    }
  }

  function addPhoneInputField(value = '', canDelete = true) {
    const container = document.getElementById('profilePhoneContainer');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'phone-input-row';
    div.style.display = 'flex';
    div.style.gap = '8px';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'menu-input-field phone-number-entry';
    input.placeholder = 'Örn: 0 545 282 97 34';
    input.value = value;
    input.style.flex = '1';

    div.appendChild(input);

    if (canDelete) {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.onclick = () => div.remove();
      delBtn.style.background = '#ef5350';
      delBtn.style.color = '#fff';
      delBtn.style.border = 'none';
      delBtn.style.borderRadius = '10px';
      delBtn.style.padding = '0 16px';
      delBtn.style.cursor = 'pointer';
      delBtn.style.fontWeight = '800';
      delBtn.textContent = '✕';
      div.appendChild(delBtn);
    }

    container.appendChild(div);
  }
  window.addPhoneInput = () => addPhoneInputField('', true);

  // İşletme ayarlarını kaydet
  async function saveRestaurantProfile(e) {
    e.preventDefault();
    const sb = window._supabaseClient;

    const restName = document.getElementById('profileRestName')?.value?.trim();
    const instagram = document.getElementById('profileInstagram')?.value?.trim();
    const logoFile = document.getElementById('profileLogoFile')?.files[0];

    const phoneEntries = document.querySelectorAll('.phone-number-entry');
    const phones = [];
    phoneEntries.forEach(input => {
      const val = input.value.trim();
      if (val) phones.push(val);
    });

    if (!restName) {
      if (window.showToast) window.showToast('Lütfen işletme adını girin.', 'error');
      return;
    }

    try {
      if (window.showToast) window.showToast('Ayarlar kaydediliyor...', 'default');

      let logoUrl = restaurantProfile.logo_url;
      if (logoFile) {
        // Logoyu sıkıştır
        const compressedLogo = await compressImageHelper(logoFile, 400, 400);
        const fileName = `logo-${Date.now()}.png`;

        const { error: uploadError } = await sb.storage.from('menu-items').upload(fileName, compressedLogo);
        if (uploadError) throw uploadError;

        const { data: urlData } = sb.storage.from('menu-items').getPublicUrl(fileName);
        logoUrl = urlData.publicUrl;
      }

      const profileData = {
        name: restName,
        logo_url: logoUrl,
        phones,
        instagram
      };

      // Supabase'e kaydet (upsert)
      try {
        const { error } = await sb
          .from('restaurant_settings')
          .upsert({
            id: 'default',
            name: restName,
            logo_url: logoUrl,
            phones,
            instagram
          }, { onConflict: 'id' });
        
        if (error) throw error;
      } catch (dbErr) {
        console.warn("Veritabanı kaydı başarısız oldu, localStorage'a yedekleniyor:", dbErr);
      }

      // LocalStorage yedekle
      localStorage.setItem('restaurant_profile_settings', JSON.stringify(profileData));
      restaurantProfile = profileData;

      if (window.showToast) window.showToast('Ayarlar başarıyla kaydedildi!', 'success');
      
      updatePublicUIBranding();
      switchTab('builder'); // Günlük menü sekmesine dön
    } catch (err) {
      console.error(err);
      if (window.showToast) window.showToast('Ayarlar kaydedilirken hata oluştu.', 'error');
    }
  }
  window.saveRestaurantProfile = saveRestaurantProfile;

  // Client-side image compression helper (Canvas-based)
  function compressImageHelper(file, maxWidth = 800, maxHeight = 800) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
              type: 'image/jpeg',
              lastModified: Date.now()
            }));
          }, 'image/jpeg', 0.75); // 75% quality compressed JPG
        };
      };
    });
  }

  // ==========================================
  // CUSTOMER VIEW (ŞİFRESİZ KAMU GÖRÜNÜMÜ)
  // ==========================================
  async function showPublicMenu() {
    const root = document.getElementById('publicMenuScreen');
    if (!root) return;

    root.style.display = 'block';
    
    const listContainer = document.getElementById('publicMenuList');
    if (listContainer) {
      listContainer.innerHTML = `
        <div style="text-align:center; padding:60px 0; color: #7f6d53;">
          <div style="font-size:32px; margin-bottom:12px;" class="anim-pulse">🍲</div>
          <div style="font-weight:700; font-size:16px;">Bugünün Lezzetleri Hazırlanıyor...</div>
        </div>
      `;
    }

    try {
      const sb = window._supabaseClient;
      const todayStr = new Date().toISOString().split('T')[0];

      // Bugünün menüsünü çek
      const { data, error } = await sb
        .from('daily_menus')
        .select('*')
        .eq('menu_date', todayStr)
        .maybeSingle();

      if (error) throw error;

      if (!data || !data.items || data.items.length === 0) {
        if (listContainer) {
          listContainer.innerHTML = `
            <div style="text-align:center; padding:80px 20px; color: #7f6d53;">
              <div style="font-size:40px; margin-bottom:16px;">🍳</div>
              <h3 style="font-family:'Playfair Display', serif; font-size:22px; color:#5c4c38; margin-bottom:8px;">Menü Bulunamadı</h3>
              <p style="font-size:14px; opacity:0.8; max-width:300px; margin:0 auto; line-height:1.5;">Görünüşe göre bugün için henüz bir günlük menü hazırlanmamış. Lütfen daha sonra tekrar kontrol edin.</p>
            </div>
          `;
        }
        return;
      }

      // Menüyü Çorbalar ve Yemekler olarak grupla (Kural: Sadece bu ikisi bulunacak)
      const categories = {
        'Çorbalar': [],
        'Yemekler': []
      };

      data.items.forEach(item => {
        const cat = item.category === 'Çorbalar' ? 'Çorbalar' : 'Yemekler';
        categories[cat].push(item);
      });

      // UI Çizimi
      let html = '';
      const order = ['Çorbalar', 'Yemekler'];
      
      order.forEach(catName => {
        const list = categories[catName] || [];
        if (list.length === 0) return;

        html += `
          <div style="margin-bottom:28px; animation: fadeInUp 0.4s ease-out;">
            <div style="display:flex; align-items:center; justify-content:center; gap:12px; margin-bottom:16px;">
              <div style="height:1px; flex:1; background:linear-gradient(90deg, transparent, rgba(92, 76, 56, 0.2), transparent);"></div>
              <h3 style="font-family:'Space Grotesk', 'Playfair Display', serif; font-size:20px; font-weight:800; color:#5c4c38; letter-spacing:1px; text-transform:uppercase;">${catName}</h3>
              <div style="height:1px; flex:1; background:linear-gradient(90deg, transparent, rgba(92, 76, 56, 0.2), transparent);"></div>
            </div>
            <div style="display:flex; flex-direction:column; gap:12px;">
        `;

        list.forEach(food => {
          const imgHtml = food.image_url 
            ? `<div style="width:56px; height:56px; border-radius:10px; overflow:hidden; border:1.5px solid #fff; box-shadow:0 3px 8px rgba(0,0,0,0.06); flex-shrink:0;">
                 <img src="${food.image_url}" style="width:100%; height:100%; object-fit:cover;">
               </div>`
            : `<div style="width:56px; height:56px; border-radius:10px; background:#f0e8db; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; border:1.5px dashed rgba(92,76,56,0.15); color:rgba(92,76,56,0.4)">🍲</div>`;

          const priceHtml = food.price 
            ? `<div style="font-family:'Space Grotesk', serif; font-weight:800; font-size:15px; color:#c2410c; background:rgba(194, 65, 12, 0.05); padding:4px 10px; border-radius:30px; border:1px solid rgba(194, 65, 12, 0.1); white-space:nowrap;">
                 ${food.price} ₺
               </div>`
            : '';

          html += `
            <div style="display:flex; align-items:center; gap:12px; background:#fff; padding:10px 14px; border-radius:14px; box-shadow:0 4px 12px rgba(92,76,56,0.03); border:1px solid rgba(92,76,56,0.02);">
              ${imgHtml}
              <div style="flex:1; min-width:0;">
                <h4 style="font-weight:700; font-size:15px; color:#2e251a; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${food.name}</h4>
                <p style="font-size:11px; color:#7f6d53; margin:2px 0 0; text-transform:uppercase; font-weight:600; letter-spacing:0.5px;">${catName}</p>
              </div>
              ${priceHtml}
            </div>
          `;
        });

        html += `
            </div>
          </div>
        `;
      });

      if (listContainer) {
        listContainer.innerHTML = html;
      }

    } catch (e) {
      console.error(e);
      if (listContainer) {
        listContainer.innerHTML = `
          <div style="text-align:center; padding:60px 20px; color:#ef5350;">
            <div style="font-size:32px; margin-bottom:12px;">⚠️</div>
            <div style="font-weight:700;">Menü yüklenirken hata oluştu.</div>
            <div style="font-size:12px; opacity:0.8; margin-top:8px;">${e.message}</div>
          </div>
        `;
      }
    }
  }

  // ==========================================
  // MANAGEMENT PANEL
  // ==========================================
  async function openEditorModal() {
    const modal = document.getElementById('dailyMenuModal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    switchTab('builder');
    
    await loadProfileSettings();
    loadMasterItems();
    loadDailyMenuForDate(new Date().toISOString().split('T')[0]);
  }

  window.toggleDailyMenuModal = function() {
    const modal = document.getElementById('dailyMenuModal');
    if (!modal) return;
    const isOpen = modal.style.display === 'flex';
    if (isOpen) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
      
      window.editingFoodItemId = null;
      const submitBtn = document.querySelector('#tabContent-adder form button[type="submit"]');
      if (submitBtn) submitBtn.textContent = '➕ Yemek Listesine Ekle';
    } else {
      openEditorModal();
    }
  };

  function switchTab(tabId) {
    document.querySelectorAll('.menu-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.menu-tab-content').forEach(content => {
      content.style.display = content.id === `tabContent-${tabId}` ? 'block' : 'none';
    });

    if (tabId === 'exporter') {
      renderShareTab();
    }
  }
  window.switchMenuTab = switchTab;

  // Master yemekleri yükle
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
    } catch (e) {
      console.error(e);
      if (window.showToast) window.showToast('Yemek listesi yüklenemedi.', 'error');
    }
  }

  // Master yemek ekle veya güncelle
  async function addMasterItem(e) {
    e.preventDefault();
    const sb = window._supabaseClient;
    
    const nameInput = document.getElementById('newFoodName');
    const catSelect = document.getElementById('newFoodCategory');
    const priceInput = document.getElementById('newFoodPrice');
    const fileInput = document.getElementById('newFoodImage');
    const fileLabel = document.getElementById('file-upload-name');
    
    const name = nameInput?.value?.trim();
    const category = catSelect?.value;
    const price = parseFloat(priceInput?.value?.replace(',', '.')) || 0;
    const file = fileInput?.files[0];
    const editingId = window.editingFoodItemId;

    if (!name || !category) {
      if (window.showToast) window.showToast('Lütfen yemek adını ve kategoriyi girin.', 'error');
      return;
    }

    try {
      if (window.showToast) window.showToast('Yemek kaydediliyor...', 'default');
      
      let imageUrl = null;
      if (file) {
        const compressedFile = await compressImageHelper(file);
        const fileExt = compressedFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { error: uploadError } = await sb.storage.from('menu-items').upload(fileName, compressedFile);
        if (uploadError) throw uploadError;
        
        const { data: urlData } = sb.storage.from('menu-items').getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }

      if (editingId) {
        // UPDATE MODE
        const payload = { name, category, price };
        if (imageUrl) {
          payload.image_url = imageUrl;
        }

        const { error } = await sb
          .from('menu_items')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;
        if (window.showToast) window.showToast('Yemek başarıyla güncellendi!', 'success');

        window.editingFoodItemId = null;
        const submitBtn = document.querySelector('#tabContent-adder form button[type="submit"]');
        if (submitBtn) submitBtn.textContent = '➕ Yemek Listesine Ekle';
      } else {
        // INSERT MODE
        const { error } = await sb.from('menu_items').insert({
          name,
          category,
          price,
          image_url: imageUrl
        });

        if (error) throw error;
        if (window.showToast) window.showToast('Yemek başarıyla eklendi!', 'success');
      }
      
      // Reset form
      nameInput.value = '';
      priceInput.value = '';
      fileInput.value = '';
      if (fileLabel) fileLabel.textContent = 'Görsel Yüklemek İçin Tıklayın';
      
      loadMasterItems();
      switchTab('list'); // Yemek listesine dön
    } catch (e) {
      console.error(e);
      if (window.showToast) window.showToast('İşlem sırasında hata oluştu.', 'error');
    }
  }
  window.addMasterFoodItem = addMasterItem;

  // Master yemek düzenle (Prefill and switch tab)
  window.editMasterFoodItem = function(id) {
    const item = masterItems.find(i => i.id === id);
    if (!item) return;

    window.editingFoodItemId = id;
    
    const nameInput = document.getElementById('newFoodName');
    const catSelect = document.getElementById('newFoodCategory');
    const priceInput = document.getElementById('newFoodPrice');
    const fileLabel = document.getElementById('file-upload-name');
    
    if (nameInput) nameInput.value = item.name;
    if (catSelect) catSelect.value = item.category;
    if (priceInput) priceInput.value = item.price || '';
    if (fileLabel) {
      fileLabel.textContent = item.image_url ? 'Mevcut Görsel Korunuyor' : 'Görsel Yüklemek İçin Tıklayın';
    }

    const submitBtn = document.querySelector('#tabContent-adder form button[type="submit"]');
    if (submitBtn) submitBtn.textContent = '✏️ Yemeği Güncelle';

    switchTab('adder');
  };

  // Master yemek sil
  async function deleteMasterItem(id) {
    const sb = window._supabaseClient;
    
    const proceed = () => {
      executeDeleteMasterItem(sb, id);
    };

    if (window.showCustomConfirm) {
      window.showCustomConfirm('Bu yemeği kalıcı olarak silmek istediğinizden emin misiniz?', proceed);
    } else if (confirm('Bu yemeği kalıcı olarak silmek istediğinizden emin misiniz?')) {
      proceed();
    }
  }
  window.deleteMasterFoodItem = deleteMasterItem;

  async function executeDeleteMasterItem(sb, id) {
    try {
      const { error } = await sb.from('menu_items').delete().eq('id', id);
      if (error) throw error;
      if (window.showToast) window.showToast('Yemek başarıyla silindi.', 'success');
      loadMasterItems();
    } catch (e) {
      console.error(e);
      if (window.showToast) window.showToast('Yemek silinirken hata oluştu.', 'error');
    }
  }

  // Yemek listesi datagrid çizimi
  function renderMasterItemsList() {
    const container = document.getElementById('menuFoodListGrid');
    if (!container) return;

    if (masterItems.length === 0) {
      container.innerHTML = '<div style="grid-column:span 12; text-align:center; padding:40px; color:#708499;">Kayıtlı yemek bulunamadı.</div>';
      return;
    }

    container.innerHTML = masterItems.map(item => {
      const img = item.image_url 
        ? `<img src="${item.image_url}" style="width:40px; height:40px; border-radius:8px; object-fit:cover;">`
        : `<div style="width:40px; height:40px; border-radius:8px; background:#242f3d; display:flex; align-items:center; justify-content:center; font-size:20px; border:1px dashed rgba(255,255,255,0.1)">🍲</div>`;
      
      const priceDisplay = item.price ? `<span style="color:#fbbf24; font-size:12px; font-weight:800; background:rgba(251,191,36,0.1); padding:2px 6px; border-radius:6px; margin-top:2px; display:inline-block;">${item.price} ₺</span>` : '<span style="color:#708499; font-size:11px;">Fiyat girmediniz</span>';

      return `
        <div style="background:#17212b; border:1px solid #232e3c; border-radius:12px; padding:12px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
          <div style="display:flex; align-items:center; gap:12px; min-width:0; flex:1;">
            ${img}
            <div style="flex:1; min-width:0;">
              <div style="font-weight:700; color:#fff; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.name}</div>
              <div style="display:flex; flex-direction:column; gap:1px;">
                <span style="color:#708499; font-size:11px;">${item.category}</span>
                ${priceDisplay}
              </div>
            </div>
          </div>
          <div style="display:flex; gap:8px; flex-shrink:0;">
            <button onclick="editMasterFoodItem(${item.id})" style="background:none; border:none; color:#fbbf24; font-size:15px; cursor:pointer; padding:6px; transition:transform 0.1s;" title="Düzenle">✏️</button>
            <button onclick="deleteMasterFoodItem(${item.id})" style="background:none; border:none; color:#ef5350; font-size:18px; cursor:pointer; padding:6px; transition:transform 0.1s;" title="Sil">✕</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Günlük menü için yemek seçim listesi çizimi (Tik Kutusundaki Hatalar Çözüldü & Renk Kodlaması)
  function renderBuilderItemsList() {
    const container = document.getElementById('builderFoodList');
    if (!container) return;

    if (masterItems.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:20px; color:#708499;">Lütfen önce yemek listesine yemek ekleyin.</div>';
      return;
    }

    const categorized = {};
    masterItems.forEach(item => {
      if (!categorized[item.category]) categorized[item.category] = [];
      categorized[item.category].push(item);
    });

    let html = '';
    const cats = ['Çorbalar', 'Yemekler'];
    
    cats.forEach(cat => {
      const items = categorized[cat] || [];
      if (items.length === 0) return;

      html += `
        <div style="margin-bottom:12px;">
          <div style="color:#10b981; font-size:12px; font-weight:800; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:6px; margin-bottom:10px; text-transform:uppercase; letter-spacing:0.5px;">${cat}</div>
          <div style="display:flex; flex-direction:column; gap:8px;">
      `;

      items.forEach(item => {
        // Zaten günlük menüde seçilmiş mi?
        const activeInMenu = currentDailyMenu?.items?.find(i => i.id === item.id);
        const checkedAttr = activeInMenu ? 'checked' : '';
        
        // Fiyat alanı: Eğer günlük menüde özel bir fiyat kaydedildiyse onu, yoksa Master fiyatını prefill et!
        const priceVal = activeInMenu?.price || item.price || 0;

        // Seçilmiş ise sarı parıltılı border ve arka plan
        const rowBg = activeInMenu ? 'rgba(251, 191, 36, 0.08)' : 'rgba(255,255,255,0.02)';
        const rowBorder = activeInMenu ? 'rgba(251, 191, 36, 0.3)' : 'rgba(255,255,255,0.03)';

        html += `
          <div class="menu-builder-row" style="display:flex; align-items:center; justify-content:space-between; background:${rowBg}; padding:10px 14px; border-radius:10px; border:1px solid ${rowBorder}; transition: all 0.2s;">
            <label style="display:flex; align-items:center; gap:12px; cursor:pointer; flex:1; min-width:0; margin:0; user-select:none;">
              <input type="checkbox" class="menu-builder-check" data-id="${item.id}" ${checkedAttr} 
                style="width:20px; height:20px; cursor:pointer; accent-color:#fbbf24; border: 1.5px solid #708499; border-radius: 4px; display:inline-block;"
                onchange="
                  const row = this.closest('.menu-builder-row');
                  if (this.checked) {
                    row.style.background = 'rgba(251, 191, 36, 0.08)';
                    row.style.borderColor = 'rgba(251, 191, 36, 0.3)';
                  } else {
                    row.style.background = 'rgba(255,255,255,0.02)';
                    row.style.borderColor = 'rgba(255,255,255,0.03)';
                  }
                ">
              <span style="color:#fff; font-weight:600; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.name}</span>
            </label>
            <div style="display:flex; align-items:center; gap:8px;">
              <input type="number" placeholder="Fiyat" class="menu-builder-price" data-id="${item.id}" value="${priceVal}" style="width:75px; padding:6px 8px; border-radius:6px; background:#0e1621; border:1px solid #232e3c; color:#fbbf24; font-size:13px; text-align:right; font-weight:800;">
              <span style="color:#708499; font-weight:700; font-size:13px;">₺</span>
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // Tarihe göre günlük menüyü çek
  async function loadDailyMenuForDate(dateStr) {
    const sb = window._supabaseClient;
    try {
      const { data, error } = await sb
        .from('daily_menus')
        .select('*')
        .eq('menu_date', dateStr)
        .maybeSingle();

      if (error) throw error;
      currentDailyMenu = data || { menu_date: dateStr, items: [] };
      
      renderBuilderItemsList();
    } catch (e) {
      console.error(e);
    }
  }
  window.loadDailyMenuForDate = loadDailyMenuForDate;

  // Günlük menüyü kaydet
  async function saveDailyMenu() {
    const sb = window._supabaseClient;
    const dateInput = document.getElementById('menuBuilderDate');
    const dateStr = dateInput?.value;

    if (!dateStr) {
      if (window.showToast) window.showToast('Lütfen geçerli bir tarih seçin.', 'error');
      return;
    }

    const selectedItems = [];
    const checkBoxes = document.querySelectorAll('.menu-builder-check:checked');
    
    checkBoxes.forEach(cb => {
      const id = parseInt(cb.dataset.id);
      const master = masterItems.find(i => i.id === id);
      if (master) {
        const priceInput = document.querySelector(`.menu-builder-price[data-id="${id}"]`);
        const price = parseFloat(priceInput?.value?.replace(',', '.')) || master.price || 0;
        selectedItems.push({
          ...master,
          price
        });
      }
    });

    try {
      if (window.showToast) window.showToast('Günün menüsü kaydediliyor...', 'default');
      
      const { data: { user } } = await sb.auth.getUser();

      const menuPayload = {
        menu_date: dateStr,
        items: selectedItems,
        created_by: user?.id || null
      };

      const { error } = await sb
        .from('daily_menus')
        .upsert(menuPayload, { onConflict: 'menu_date' });

      if (error) throw error;

      if (window.showToast) window.showToast('Günün menüsü başarıyla kaydedildi!', 'success');
      
      loadDailyMenuForDate(dateStr);
    } catch (e) {
      console.error(e);
      if (window.showToast) window.showToast('Günün menüsü kaydedilirken hata oluştu.', 'error');
    }
  }
  window.saveDailyMenu = saveDailyMenu;


  // ==========================================
  // CANVAS IMAGE GENERATOR & SOCIAL SHARE
  // ==========================================
  async function renderShareTab() {
    const canvas = document.getElementById('menuCanvas');
    const qrContainer = document.getElementById('menuQrContainer');
    const leftSelect = document.getElementById('canvasLeftSelect');
    const rightSelect = document.getElementById('canvasRightSelect');

    if (!canvas || !qrContainer) return;

    // QR Kodu Çiz
    const publicUrl = window.location.origin + window.location.pathname + '?menu=true';
    qrContainer.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; gap:12px;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(publicUrl)}" style="border-radius:16px; border: 4px solid white; box-shadow: 0 4px 20px rgba(0,0,0,0.4); max-width:180px; width:100%; display:block;">
        <a href="https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(publicUrl)}" download="menü-qr-kodu.png" target="_blank" class="btn primary" style="padding: 8px 16px; font-size:12px; font-weight:800; border-radius:8px; text-decoration:none; display:inline-flex; align-items:center; gap:6px; background:#10b981; color:#fff;">
          📥 QR Kodu İndir (Büyük)
        </a>
      </div>
    `;

    // Canvas Çizim Süreci
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#17212b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎨 Menü Görseli Hazırlanıyor...', canvas.width / 2, canvas.height / 2);

    try {
      // 1. Boş Şablon Arka Planını Yükle
      const bgImg = new Image();
      bgImg.src = 'assets/menu_template.jpg';
      await new Promise((resolve, reject) => {
        bgImg.onload = resolve;
        bgImg.onerror = reject;
      });

      canvas.width = bgImg.naturalWidth || 576;
      canvas.height = bgImg.naturalHeight || 1024;
      ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

      // Verileri al
      const todayStr = new Date().toISOString().split('T')[0];
      const sb = window._supabaseClient;
      const { data } = await sb
        .from('daily_menus')
        .select('*')
        .eq('menu_date', todayStr)
        .maybeSingle();

      if (!data || !data.items || data.items.length === 0) {
        ctx.fillStyle = '#ff6b6b';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText('HENÜZ GÜNLÜK MENÜ KAYDEDİLMEMİŞ', canvas.width / 2, 380);
        ctx.fillStyle = '#888';
        ctx.font = '13px sans-serif';
        ctx.fillText('Lütfen "Günlük Menü" sekmesinden yemek seçip kaydedin.', canvas.width / 2, 420);
        return;
      }

      // Dropdownları doldur (İlk kez doldurma)
      const resimliYemekler = data.items.filter(i => i.image_url);
      
      if (leftSelect && rightSelect && leftSelect.options.length <= 2) {
        // Dropdown sıfırla ama ilk iki seçeneği koru (auto, none)
        leftSelect.innerHTML = `<option value="auto">Otomatik (Resimli İlk Yemek)</option><option value="none">Boş Kalsın</option>`;
        rightSelect.innerHTML = `<option value="auto">Otomatik (Resimli İkinci Yemek)</option><option value="none">Boş Kalsın</option>`;
        
        resimliYemekler.forEach(item => {
          const opt1 = document.createElement('option');
          opt1.value = item.image_url;
          opt1.textContent = item.name;
          leftSelect.appendChild(opt1);

          const opt2 = document.createElement('option');
          opt2.value = item.image_url;
          opt2.textContent = item.name;
          rightSelect.appendChild(opt2);
        });
      }

      // Kategorilerine göre ayır
      const soups = data.items.filter(i => i.category === 'Çorbalar');
      const dishes = data.items.filter(i => i.category === 'Yemekler' || i.category === 'Salatalar' || i.category === 'Tatlılar' || i.category === 'İçecekler');

      // 2. ÇORBALARI YAZDIR (Notepad başlığının altına)
      ctx.textAlign = 'center';
      ctx.fillStyle = '#1e2329';
      ctx.textBaseline = 'middle';

      let soupY = 320;
      soups.forEach(soup => {
        ctx.font = "bold 20px sans-serif";
        ctx.fillText(soup.name, canvas.width / 2, soupY);
        soupY += 30;
      });

      // 3. YEMEKLERİ YAZDIR (Yemekler başlığının altına)
      let dishY = 465;
      dishes.forEach(dish => {
        ctx.font = "bold 20px sans-serif";
        ctx.fillText(dish.name, canvas.width / 2, dishY);
        dishY += 30;
      });

      // 4. ŞABLONDAN SEÇİLEN FOTOĞRAFLARI YERLEŞTİR (En alt sol ve en alt sağ kutular)
      let leftImgUrl = leftSelect ? leftSelect.value : 'auto';
      let rightImgUrl = rightSelect ? rightSelect.value : 'auto';

      if (leftImgUrl === 'auto') {
        leftImgUrl = resimliYemekler[0]?.image_url || 'none';
      }
      if (rightImgUrl === 'auto') {
        rightImgUrl = resimliYemekler[1]?.image_url || 'none';
      }

      if (leftImgUrl !== 'none') {
        await drawRoundedImageHelper(ctx, leftImgUrl, 18, 776, 253, 181, 19);
      }
      if (rightImgUrl !== 'none') {
        await drawRoundedImageHelper(ctx, rightImgUrl, 304, 776, 253, 181, 19);
      }

      // 5. İŞLETME LOGOSUNU EN ÜSTE ÇİZ (Notepad en üst dairesel alan)
      if (restaurantProfile.logo_url) {
        await drawCircularLogoHelper(ctx, restaurantProfile.logo_url, canvas.width / 2, 140, 34);
      }

      // 6. EN ALT GRİ ALANA İLETİŞİM BİLGİLERİNİ ÇİZ
      ctx.fillStyle = '#000000';
      ctx.font = "bold 15px sans-serif";
      
      const phoneText = restaurantProfile.phones.join('  -  ');
      ctx.fillText("📞  " + phoneText, canvas.width / 2, 960);
      ctx.fillText("📸  " + restaurantProfile.instagram, canvas.width / 2, 995);

    } catch (e) {
      console.error("Canvas çizim hatası:", e);
      ctx.fillStyle = '#ef5350';
      ctx.font = '16px sans-serif';
      ctx.fillText('Canvas yüklenirken bir hata oluştu: ' + e.message, canvas.width / 2, canvas.height / 2 + 100);
    }
  }

  // Dışarıdan tetiklenebilecek canvas yenileme tetikleyicisi
  window.redrawCanvasWithCustomSelections = function() {
    renderShareTab();
  };

  // Dairesel logo çizimi
  async function drawCircularLogoHelper(ctx, url, cx, cy, radius) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
      ctx.restore();

      // Dışına ince dairesel çerçeve ekle
      ctx.save();
      ctx.strokeStyle = '#c2410c';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2, true);
      ctx.stroke();
      ctx.restore();
    } catch (err) {
      console.warn("Logo çizilemedi:", err);
    }
  }

  // Rounded image çizici yardımı
  async function drawRoundedImageHelper(ctx, url, x, y, width, height, radius) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.clip();
      
      const imgRatio = img.width / img.height;
      const targetRatio = width / height;
      let sx, sy, sWidth, sHeight;
      
      if (imgRatio > targetRatio) {
        sHeight = img.height;
        sWidth = img.height * targetRatio;
        sx = (img.width - sWidth) / 2;
        sy = 0;
      } else {
        sWidth = img.width;
        sHeight = img.width / targetRatio;
        sx = 0;
        sy = (img.height - sHeight) / 2;
      }
      
      ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, width, height);
      ctx.restore();
    } catch (err) {
      console.warn("Resim yüklenemedi, atlanıyor:", url, err);
    }
  }

  // Canvas'ı resim olarak indir
  function downloadMenuImage() {
    const canvas = document.getElementById('menuCanvas');
    if (!canvas) return;

    try {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `Gunluk_Menu_${new Date().toISOString().split('T')[0]}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error(e);
      if (window.showToast) window.showToast('Görsel indirilemedi. Güvenlik/CORS kısıtlaması olabilir.', 'error');
    }
  }
  window.downloadMenuImage = downloadMenuImage;

  return {
    init,
    showPublicMenu,
    openEditorModal
  };
})();

document.addEventListener("DOMContentLoaded", () => {
  MenuModule.init();
});
