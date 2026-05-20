// js/modules/menu.js

const MenuModule = (() => {
  let masterItems = [];
  let currentDailyMenu = null;

  async function init() {
    console.log("🍱 Günlük Menü Modülü Başlatılıyor...");
    
    // Eğer müşteri görünümündeysek
    if (window.isPublicMenuMode) {
      return; // auth.js zaten yönlendirecektir
    }
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
          <div style="font-size:32px; margin-bottom:12px; class="anim-pulse">🍲</div>
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

      // Menüyü kategorilerine göre grupla
      const categories = {
        'Çorbalar': [],
        'Yemekler': [],
        'Salatalar': [],
        'Tatlılar': [],
        'İçecekler': []
      };

      data.items.forEach(item => {
        const cat = item.category || 'Diğer';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(item);
      });

      // UI Çizimi
      let html = '';
      
      const order = ['Çorbalar', 'Yemekler', 'Salatalar', 'Tatlılar', 'İçecekler'];
      
      order.forEach(catName => {
        const list = categories[catName] || [];
        if (list.length === 0) return;

        html += `
          <div style="margin-bottom:36px; animation: fadeInUp 0.4s ease-out;">
            <div style="display:flex; align-items:center; justify-content:center; gap:12px; margin-bottom:20px;">
              <div style="height:1px; flex:1; background:linear-gradient(90deg, transparent, rgba(92, 76, 56, 0.2), transparent);"></div>
              <h3 style="font-family:'Playfair Display', serif; font-size:22px; font-weight:800; color:#5c4c38; letter-spacing:1px; text-transform:uppercase;">${catName}</h3>
              <div style="height:1px; flex:1; background:linear-gradient(90deg, transparent, rgba(92, 76, 56, 0.2), transparent);"></div>
            </div>
            <div style="display:flex; flex-direction:column; gap:16px;">
        `;

        list.forEach(food => {
          const imgHtml = food.image_url 
            ? `<div style="width:70px; height:70px; border-radius:12px; overflow:hidden; border:2px solid #fff; box-shadow:0 4px 12px rgba(0,0,0,0.06); flex-shrink:0;">
                 <img src="${food.image_url}" style="width:100%; height:100%; object-fit:cover;">
               </div>`
            : `<div style="width:70px; height:70px; border-radius:12px; background:#f0e8db; display:flex; align-items:center; justify-content:center; font-size:24px; flex-shrink:0; border:2px dashed rgba(92,76,56,0.15); color:rgba(92,76,56,0.4)">🍲</div>`;

          const priceHtml = food.price 
            ? `<div style="font-family:'Playfair Display', serif; font-weight:900; font-size:18px; color:#c2410c; background:rgba(194, 65, 12, 0.05); padding:6px 12px; border-radius:30px; border:1px solid rgba(194, 65, 12, 0.1); white-space:nowrap;">
                 ${food.price} ₺
               </div>`
            : '';

          html += `
            <div style="display:flex; align-items:center; gap:16px; background:#fff; padding:12px 16px; border-radius:18px; box-shadow:0 6px 18px rgba(92,76,56,0.04); border:1px solid rgba(92,76,56,0.03); transition: transform 0.2s;">
              ${imgHtml}
              <div style="flex:1; min-width:0;">
                <h4 style="font-weight:700; font-size:16px; color:#2e251a; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${food.name}</h4>
                <p style="font-size:12px; color:#7f6d53; margin:4px 0 0; text-transform:uppercase; font-weight:600; letter-spacing:0.5px;">${catName}</p>
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
  // MANAGEMENT MODAL (ADMIN & EDITOR)
  // ==========================================
  async function openEditorModal() {
    const modal = document.getElementById('dailyMenuModal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Tabları ilkle
    switchTab('builder');
    
    // Verileri çek
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

  // Master yemek ekle
  async function addMasterItem(e) {
    e.preventDefault();
    const sb = window._supabaseClient;
    
    const nameInput = document.getElementById('newFoodName');
    const catSelect = document.getElementById('newFoodCategory');
    const fileInput = document.getElementById('newFoodImage');
    
    const name = nameInput?.value?.trim();
    const category = catSelect?.value;
    const file = fileInput?.files[0];

    if (!name || !category) {
      if (window.showToast) window.showToast('Lütfen yemek adını ve kategoriyi girin.', 'error');
      return;
    }

    try {
      if (window.showToast) window.showToast('Yemek kaydediliyor...', 'default');
      
      let imageUrl = null;
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { error: uploadError } = await sb.storage.from('menu-items').upload(fileName, file);
        if (uploadError) throw uploadError;
        
        const { data: urlData } = sb.storage.from('menu-items').getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }

      const { error } = await sb.from('menu_items').insert({
        name,
        category,
        image_url: imageUrl
      });

      if (error) throw error;

      if (window.showToast) window.showToast('Yemek başarıyla eklendi!', 'success');
      
      // Reset form
      nameInput.value = '';
      fileInput.value = '';
      
      loadMasterItems();
    } catch (e) {
      console.error(e);
      if (window.showToast) window.showToast('Yemek eklenirken hata oluştu.', 'error');
    }
  }
  window.addMasterFoodItem = addMasterItem;

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
      
      return `
        <div style="background:#17212b; border:1px solid #232e3c; border-radius:12px; padding:12px; display:flex; align-items:center; gap:12px;">
          ${img}
          <div style="flex:1; min-width:0;">
            <div style="font-weight:700; color:#fff; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.name}</div>
            <div style="color:#708499; font-size:11px; margin-top:2px;">${item.category}</div>
          </div>
          <button onclick="deleteMasterFoodItem(${item.id})" style="background:none; border:none; color:#ef5350; font-size:18px; cursor:pointer; padding:6px; transition:transform 0.1s;">✕</button>
        </div>
      `;
    }).join('');
  }

  // Günlük menü için yemek seçim listesi çizimi
  function renderBuilderItemsList() {
    const container = document.getElementById('builderFoodList');
    if (!container) return;

    if (masterItems.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:20px; color:#708499;">Lütfen önce yemek listesine yemek ekleyin.</div>';
      return;
    }

    // Kategorilerine göre ayır
    const categorized = {};
    masterItems.forEach(item => {
      if (!categorized[item.category]) categorized[item.category] = [];
      categorized[item.category].push(item);
    });

    let html = '';
    const cats = ['Çorbalar', 'Yemekler', 'Salatalar', 'Tatlılar', 'İçecekler'];
    
    cats.forEach(cat => {
      const items = categorized[cat] || [];
      if (items.length === 0) return;

      html += `
        <div style="margin-bottom:20px;">
          <div style="color:#fbbf24; font-size:12px; font-weight:800; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:6px; margin-bottom:10px; text-transform:uppercase; letter-spacing:0.5px;">${cat}</div>
          <div style="display:flex; flex-direction:column; gap:10px;">
      `;

      items.forEach(item => {
        // Zaten menüde mi?
        const activeInMenu = currentDailyMenu?.items?.find(i => i.id === item.id);
        const checkedAttr = activeInMenu ? 'checked' : '';
        const priceVal = activeInMenu?.price || '';

        html += `
          <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.02); padding:10px 14px; border-radius:10px; border:1px solid rgba(255,255,255,0.03);">
            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; flex:1; min-width:0; margin:0;">
              <input type="checkbox" class="menu-builder-check" data-id="${item.id}" ${checkedAttr} style="width:18px; height:18px; cursor:pointer; accent-color:#fbbf24;">
              <span style="color:#fff; font-weight:600; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.name}</span>
            </label>
            <div style="display:flex; align-items:center; gap:8px;">
              <input type="text" placeholder="Fiyat (TL)" class="menu-builder-price" data-id="${item.id}" value="${priceVal}" style="width:80px; padding:6px 10px; border-radius:6px; background:#0e1621; border:1px solid #232e3c; color:#fff; font-size:13px; text-align:right; font-weight:700;">
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

    // Seçili yemekleri derle
    const selectedItems = [];
    const checkBoxes = document.querySelectorAll('.menu-builder-check:checked');
    
    checkBoxes.forEach(cb => {
      const id = parseInt(cb.dataset.id);
      const master = masterItems.find(i => i.id === id);
      if (master) {
        const priceInput = document.querySelector(`.menu-builder-price[data-id="${id}"]`);
        const price = parseFloat(priceInput?.value?.replace(',', '.')) || 0;
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

      // Upsert
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
    if (!canvas || !qrContainer) return;

    // QR Kodu Çiz
    const publicUrl = window.location.origin + window.location.pathname + '?menu=true';
    qrContainer.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; gap:12px;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(publicUrl)}" style="border-radius:16px; border: 4px solid white; box-shadow: 0 4px 20px rgba(0,0,0,0.4); max-width:200px; width:100%; display:block;">
        <a href="https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(publicUrl)}" download="menü-qr-kodu.png" target="_blank" class="btn primary" style="padding: 8px 16px; font-size:12px; font-weight:800; border-radius:8px; text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
          📥 QR Kodu İndir (Büyük)
        </a>
      </div>
    `;

    // Canvas Çizim Süreci
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Yükleniyor Göstergesi
    ctx.fillStyle = '#17212b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
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

      // Canvas boyutunu görselin orijinal boyutlarına eşitle (1080x1920)
      canvas.width = bgImg.naturalWidth || 1080;
      canvas.height = bgImg.naturalHeight || 1920;

      // Arka planı çiz
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
        ctx.font = 'bold 36px sans-serif';
        ctx.fillText('BUGÜN İÇİN HENÜZ MENÜ KAYDEDİLMEMİŞ', canvas.width / 2, 700);
        ctx.fillStyle = '#888';
        ctx.font = '28px sans-serif';
        ctx.fillText('Lütfen "Günlük Menü Oluştur" sekmesinden yemek seçip kaydedin.', canvas.width / 2, 760);
        return;
      }

      // Kategorilerine göre ayır
      const soups = data.items.filter(i => i.category === 'Çorbalar');
      const dishes = data.items.filter(i => i.category === 'Yemekler' || i.category === 'Salatalar' || i.category === 'Tatlılar');

      // 2. ÇORBALARI YAZDIR (Çorbalar başlığının altına)
      // Çorbalar başlığı şablonda ortalama Y=540'dadır. Yazmaya Y=595'den başlayacağız.
      ctx.textAlign = 'center';
      ctx.fillStyle = '#1e2329'; // Şık koyu füme/antrasit renk tonu

      let soupY = 595;
      soups.forEach(soup => {
        ctx.font = "bold 34px sans-serif";
        ctx.fillText(soup.name, canvas.width / 2, soupY);
        soupY += 50; // satır aralığı
      });

      // 3. YEMEKLERİ YAZDIR (Yemekler başlığının altına)
      // Yemekler başlığı şablonda ortalama Y=790'dadır. Yazmaya Y=850'den başlayacağız.
      let dishY = 850;
      dishes.forEach(dish => {
        ctx.font = "bold 34px sans-serif";
        ctx.fillText(dish.name, canvas.width / 2, dishY);
        dishY += 50; // satır aralığı
      });

      // 4. FOTOĞRAFLARI YERLEŞTİR (En alt sol ve en alt sağ kutular)
      // Görselde image_url olan ilk iki yemeği al
      const photosToDraw = data.items.filter(i => i.image_url).slice(0, 2);
      
      // Pozisyonlar (filled_template referansı ile tam uyumlu):
      // Sol Pozisyon: X=35, Y=1455, Genişlik=475, Yükseklik=340, Radius=36
      // Sağ Pozisyon: X=570, Y=1455, Genişlik=475, Yükseklik=340, Radius=36
      if (photosToDraw[0]) {
        await drawRoundedImageHelper(ctx, photosToDraw[0].image_url, 35, 1455, 475, 340, 36);
      }
      if (photosToDraw[1]) {
        await drawRoundedImageHelper(ctx, photosToDraw[1].image_url, 570, 1455, 475, 340, 36);
      }

    } catch (e) {
      console.error("Canvas çizim hatası:", e);
      ctx.fillStyle = '#ef5350';
      ctx.font = '24px sans-serif';
      ctx.fillText('Canvas yüklenirken bir hata oluştu: ' + e.message, canvas.width / 2, canvas.height / 2 + 100);
    }
  }

  // Rounded image çizici yardımı
  async function drawRoundedImageHelper(ctx, url, x, y, width, height, radius) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // CORS hatasını engellemek için kritik
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
      
      // Resmi orantılı sığdırma (cover gibi)
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

// Sayfa yüklendiğinde ilkle
document.addEventListener("DOMContentLoaded", () => {
  MenuModule.init();
});
