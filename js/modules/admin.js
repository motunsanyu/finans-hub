// js/modules/admin.js

let adminUsersCache = [];

function hasValidCoordinate(lat, lng) {
  const nLat = Number(lat);
  const nLng = Number(lng);
  const isNullIsland = Math.abs(nLat) < 0.0001 && Math.abs(nLng) < 0.0001;
  return Number.isFinite(nLat) && Number.isFinite(nLng) &&
    nLat >= -90 && nLat <= 90 && nLng >= -180 && nLng <= 180 &&
    !isNullIsland;
}

function hasShowableLocation(user) {
  return Boolean(user?.last_seen) && hasValidCoordinate(user?.last_lat, user?.last_lng);
}

function getLocationPrecision(city) {
  const label = String(city || '').toLowerCase();
  const isDevice = label.includes('cihaz konumu') || label.includes('cihaz gps');
  const isLowConfidenceIp = label.includes('gsm') || label.includes('vpn') || label.includes('ip tahmini');

  if (isDevice) return { delta: 0.02, zoom: 14 };
  if (isLowConfidenceIp) return { delta: 0.6, zoom: 9 };
  return { delta: 0.12, zoom: 11 };
}

window.toggleAdminModal = function() {
  const modal = document.getElementById('adminModal');
  if (!modal) return;
  const isOpen = modal.style.display === 'flex';
  if (isOpen) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  } else {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    if (typeof window.toggleSidebar === 'function') window.toggleSidebar(false);
    loadAdminUsers();
  }
};

async function loadAdminUsers() {
  const sb = window._supabaseClient;
  const listEl = document.getElementById('adminUserList');
  const statsEl = document.getElementById('adminStats');
  if (!sb || !listEl) return;

  if (adminUsersCache && adminUsersCache.length > 0) {
    renderAdminUsers(adminUsersCache);
  } else {
    listEl.innerHTML = '<div style="text-align:center; padding:40px; color:#708499;">Yükleniyor...</div>';
  }
  try {
    const { data: users, error } = await sb
      .from('profiles')
      .select('*');

    if (error) throw error;

    adminUsersCache = users || [];
    if (statsEl) {
      const pendingCount = adminUsersCache.filter(u => u.is_approved === false && !u.is_banned).length;
      statsEl.textContent = `Kayıtlı Kullanıcı: ${adminUsersCache.length} | Onay bekleyen: ${pendingCount}`;
    }
    renderAdminUsers(adminUsersCache);
  } catch (e) {
    console.error('Yönetici paneli yükleme hatası:', e);
    listEl.innerHTML = '<div style="text-align:center; padding:40px; color:#ef5350;">Veriler yüklenirken hata oluştu. Yetkiniz olduğundan emin olun.</div>';
  }
}

function renderAdminUsers(users) {
  const listEl = document.getElementById('adminUserList');
  if (!listEl) return;

  if (users.length === 0) {
    listEl.innerHTML = '<div style="text-align:center; padding:40px; color:#708499;">Kullanıcı bulunamadı.</div>';
    return;
  }

  // Ana yöneticiyi (muzafnot@gmail.com) en üste sabitle, sonra diğer adminleri
  const sortedUsers = [...users].sort((a, b) => {
    const emailA = (a.email || '').toLowerCase();
    const emailB = (b.email || '').toLowerCase();
    const target = 'muzafnot@gmail.com';

    if (emailA === target) return -1;
    if (emailB === target) return 1;

    // Diğer adminleri ikinci sırada tut
    if (a.is_admin && !b.is_admin) return -1;
    if (!a.is_admin && b.is_admin) return 1;

    const pendingA = a.is_approved === false && !a.is_banned;
    const pendingB = b.is_approved === false && !b.is_banned;
    if (pendingA && !pendingB) return -1;
    if (!pendingA && pendingB) return 1;

    // Normal alfabetik sıralama
    const nameA = a.username || a.display_name || '';
    const nameB = b.username || b.display_name || '';
    return nameA.localeCompare(nameB);
  });

  const currentUserId = window.currentUser?.id;

  // Konum verisini güvenli şekilde sakla — onclick'te tırnak sorunu olmadan erişilir
  window._adminLocData = {};
  users.forEach(u => {
    if (hasShowableLocation(u)) {
      window._adminLocData[u.id] = {
        lat: Number(u.last_lat),
        lng: Number(u.last_lng),
        name: u.username || u.display_name || 'Kullanıcı',
        city: (u.last_city || '') + (u.last_country ? ', ' + u.last_country : ''),
        time: u.last_location_time || ''
      };
    }
  });

  const html = sortedUsers.map(u => {
    const isMe = u.id === currentUserId;
    const name = u.username || u.display_name || 'İsimsiz';
    const email = u.email || 'E-posta yok';
    const initial = name.charAt(0).toUpperCase();
    // Son görülme tarihi formatlama
    let dateStr = 'Belirsiz';
    if (u.last_seen) {
      const diffSec = Math.floor((new Date() - new Date(u.last_seen)) / 1000);
      if (diffSec < 90) {
        dateStr = '<span style="color:#4ade80;">Çevrimiçi</span>';
      } else if (diffSec < 3600) {
        dateStr = `${Math.floor(diffSec / 60)} dk önce`;
      } else {
        dateStr = new Date(u.last_seen).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      }
    }

    // Avatar
    const avatarHtml = u.avatar_url 
      ? `<img src="${u.avatar_url}" style="width:100%;height:100%;object-fit:cover;">` 
      : `<span style="font-weight:700; color:#fff;">${initial}</span>`;

    // Status Badges
    const adminBadge = u.is_admin ? `<span style="background:#fbbf24; color:#000; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:800;">YÖNETİCİ</span>` : '';
    const bannedBadge = u.is_banned ? `<span style="background:#ef5350; color:#fff; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:800;">ENGELLİ</span>` : '';
    const menuEditorBadge = u.is_menu_editor ? `<span style="background:#10b981; color:#fff; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:800;">MENÜ EDİTÖRÜ</span>` : '';
    const approvalBadge = (u.is_approved === false && !u.is_banned)
      ? `<span style="background:#f59e0b; color:#111827; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:800;">ONAY BEKLİYOR</span>`
      : (u.is_approved === true ? `<span style="background:#2563eb; color:#fff; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:800;">ONAYLI</span>` : '');

    const statusBadges = [adminBadge, approvalBadge, menuEditorBadge, bannedBadge].filter(Boolean).join('');

    // Action Buttons
    let actions = '';
    if (!isMe) {
      if (u.is_approved === false) {
        actions += `<button onclick="event.stopPropagation(); approveUser('${u.id}')" style="flex:1; height:44px; box-sizing:border-box; display:flex; align-items:center; justify-content:center; text-align:center; line-height:1.1; background:#10b981; border:none; color:#fff; padding:8px 14px; border-radius:8px; font-size:12px; font-weight:800; cursor:pointer;">Onayla</button>`;
        actions += `<button onclick="event.stopPropagation(); rejectUserApproval('${u.id}')" style="flex:1; height:44px; box-sizing:border-box; display:flex; align-items:center; justify-content:center; text-align:center; line-height:1.1; background:rgba(239, 83, 80, 0.1); border:1px solid rgba(239, 83, 80, 0.3); color:#ef5350; padding:8px 14px; border-radius:8px; font-size:12px; font-weight:800; cursor:pointer;">Reddet</button>`;
      } else if (u.is_approved === true) {
        actions += `<button onclick="event.stopPropagation(); revokeUserApproval('${u.id}')" style="flex:1; height:44px; box-sizing:border-box; display:flex; align-items:center; justify-content:center; text-align:center; line-height:1.1; background:rgba(245, 158, 11, 0.1); border:1px solid rgba(245, 158, 11, 0.35); color:#f59e0b; padding:8px 14px; border-radius:8px; font-size:12px; font-weight:800; cursor:pointer;">Onayı Kaldır</button>`;
      }
      // Menü yetkisi butonu
      if (u.is_menu_editor) {
        actions += `<button onclick="event.stopPropagation(); toggleMenuEditorPermission('${u.id}', true)" style="flex:1; height:44px; box-sizing:border-box; display:flex; align-items:center; justify-content:center; text-align:center; line-height:1.1; background:rgba(16, 185, 129, 0.1); border:1px solid rgba(16, 185, 129, 0.3); color:#10b981; padding:8px 14px; border-radius:8px; font-size:12px; font-weight:800; cursor:pointer;">Yetki Al</button>`;
      } else {
        actions += `<button onclick="event.stopPropagation(); toggleMenuEditorPermission('${u.id}', false)" style="flex:1; height:44px; box-sizing:border-box; display:flex; align-items:center; justify-content:center; text-align:center; line-height:1.1; background:rgba(255, 255, 255, 0.05); border:1px solid rgba(255, 255, 255, 0.1); color:#fff; padding:8px 14px; border-radius:8px; font-size:12px; font-weight:800; cursor:pointer;">Yetki Ver</button>`;
      }
      
      if (u.is_banned) {
        actions += `<button onclick="event.stopPropagation(); toggleUserBan('${u.id}', false)" style="flex:1; height:44px; box-sizing:border-box; display:flex; align-items:center; justify-content:center; text-align:center; line-height:1.1; background:#2b5278; border:none; color:#fff; padding:8px 14px; border-radius:8px; font-size:12px; font-weight:800; cursor:pointer;">Engeli Kaldır</button>`;
      } else {
        actions += `<button onclick="event.stopPropagation(); toggleUserBan('${u.id}', true)" style="flex:1; height:44px; box-sizing:border-box; display:flex; align-items:center; justify-content:center; text-align:center; line-height:1.1; background:rgba(239, 83, 80, 0.1); border:1px solid rgba(239, 83, 80, 0.3); color:#ef5350; padding:8px 14px; border-radius:8px; font-size:12px; font-weight:800; cursor:pointer;">Engelle</button>`;
      }
      actions += `<button onclick="event.stopPropagation(); deleteUserProfile('${u.id}')" style="flex:1; height:44px; box-sizing:border-box; display:flex; align-items:center; justify-content:center; text-align:center; line-height:1.1; background:#ef5350; border:none; color:#fff; padding:8px 14px; border-radius:8px; font-size:12px; font-weight:800; cursor:pointer;">Kullanıcıyı Sil</button>`;
      // Konum butonu — actions paneline eklenir, tırnak sorunu yok
      if (hasShowableLocation(u)) {
        actions += `<button onclick="event.stopPropagation(); window.showUserLocationById('${u.id}')" style="flex:1; height:44px; box-sizing:border-box; display:flex; align-items:center; justify-content:center; text-align:center; line-height:1.1; background:rgba(59,130,246,0.15); border:1px solid rgba(59,130,246,0.3); color:#60a5fa; padding:8px 14px; border-radius:8px; font-size:12px; font-weight:800; cursor:pointer;">📍 Konum</button>`;
      }
    } else {
      actions += `<span style="font-size:13px; color:#708499; font-weight:800; width:100%; text-align:center; padding:8px 0;">✨ Kendi Hesabınız (Yönetici)</span>`;
      actions += `<button onclick="event.stopPropagation(); window.showAllUsersLocations()" style="flex:1; height:44px; box-sizing:border-box; display:flex; align-items:center; justify-content:center; text-align:center; line-height:1.1; background:rgba(99,102,241,0.15); border:1px solid rgba(99,102,241,0.35); color:#a5b4fc; padding:8px 14px; border-radius:8px; font-size:12px; font-weight:800; cursor:pointer;">🗺️ Tüm Konumlar</button>`;
    }

    return `
      <div style="background:#17212b; border-radius:16px; border:1px solid #232e3c; overflow:hidden; transition:all 0.2s;">
        <!-- Tıklanabilir Üst Bilgi Kartı -->
        <div onclick="const panel=document.getElementById('actionsPanel-${u.id}'); const chevron=document.getElementById('chevron-${u.id}'); if(panel.style.display==='none'){ panel.style.display='flex'; chevron.textContent='▲'; } else { panel.style.display='none'; chevron.textContent='▼'; }" 
          style="padding:16px; display:flex; align-items:center; gap:14px; cursor:pointer; user-select:none;"
          onmouseover="this.style.background='rgba(255,255,255,0.01)'"
          onmouseout="this.style.background='transparent'">
          
          <div style="width:48px; height:48px; border-radius:50%; background:#2b5278; display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0; border:1.5px solid #232e3c;">
            ${avatarHtml}
          </div>
          
          <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:8px;">
            <div style="display:grid; grid-template-columns:minmax(0, 1fr) auto; align-items:center; gap:8px; width:100%;">
              <span style="color:#fff; font-weight:800; font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${name}</span>
              <div style="display:flex; align-items:center; justify-content:flex-end; gap:6px; flex-wrap:wrap; white-space:nowrap; flex-shrink:0; width:100%; text-align:right;">
                ${statusBadges}
              </div>
            </div>
            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; width:100%;">
              <div style="color:#708499; font-size:12px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${email}</div>
              <div id="chevron-${u.id}" style="color:#708499; font-size:16px; font-weight:bold; padding:4px; flex-shrink:0;">▼</div>
            </div>
            <div style="color:#8b9eb3; font-size:11px; font-weight:600;">Son Görülme: ${dateStr}</div>
          </div>
        </div>

        <!-- Açılır İşlem Bölümü -->
        <div id="actionsPanel-${u.id}" style="display:none; background:#0e1621; border-top:1px solid #232e3c; padding:14px; gap:8px; flex-direction:row; flex-wrap:wrap; justify-content:space-between; align-items:center;">
          ${actions}
        </div>
      </div>
    `;
  }).join('');

  listEl.innerHTML = html;
}

// Arama Kutusu Etkileşimi
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('adminSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        renderAdminUsers(adminUsersCache);
        return;
      }
      const filtered = adminUsersCache.filter(u => {
        return (u.username && u.username.toLowerCase().includes(q)) ||
               (u.display_name && u.display_name.toLowerCase().includes(q)) ||
               (u.email && u.email.toLowerCase().includes(q));
      });
      renderAdminUsers(filtered);
    });
  }
});

window.toggleUserBan = async function(userId, banStatus) {
  const sb = window._supabaseClient;
  const actionText = banStatus ? 'engellemek' : 'engelini kaldırmak';
  
  if (window.showCustomConfirm) {
    window.showCustomConfirm(`Bu kullanıcının ${actionText} istediğinize emin misiniz?`, async () => {
      executeToggleBan(sb, userId, banStatus);
    }, { okText: 'Evet', okColor: banStatus ? '#ef5350' : '#2b5278' });
  } else {
    if (confirm(`Bu kullanıcının ${actionText} istediğinize emin misiniz?`)) {
      executeToggleBan(sb, userId, banStatus);
    }
  }
};

async function executeToggleBan(sb, userId, banStatus) {
  try {
    const { error } = await sb.from('profiles').update({ is_banned: banStatus }).eq('id', userId);
    if (error) throw error;
    if (window.showToast) window.showToast(`Kullanıcı ${banStatus ? 'engellendi' : 'engeli kaldırıldı'}.`, 'success');
    loadAdminUsers();
  } catch (e) {
    console.error(e);
    if (window.showToast) window.showToast('İşlem başarısız.', 'error');
  }
}

window.approveUser = async function(userId) {
  const sb = window._supabaseClient;
  try {
    const { error } = await sb
      .from('profiles')
      .update({ is_approved: true, is_banned: false })
      .eq('id', userId);
    if (error) throw error;
    if (window.showToast) window.showToast('Kullanıcı onaylandı.', 'success');
    loadAdminUsers();
  } catch (e) {
    console.error(e);
    if (window.showToast) window.showToast('Onay işlemi başarısız.', 'error');
  }
};

window.revokeUserApproval = async function(userId) {
  const sb = window._supabaseClient;
  const run = async () => {
    try {
      const { error } = await sb.from('profiles').update({ is_approved: false }).eq('id', userId);
      if (error) throw error;
      if (window.showToast) window.showToast('Kullanıcı onayı kaldırıldı.', 'success');
      loadAdminUsers();
    } catch (e) {
      console.error(e);
      if (window.showToast) window.showToast('İşlem başarısız.', 'error');
    }
  };

  if (window.showCustomConfirm) {
    window.showCustomConfirm('Bu kullanıcının onayını kaldırmak istediğinize emin misiniz?', run, { okText: 'Evet', okColor: '#f59e0b' });
  } else if (confirm('Bu kullanıcının onayını kaldırmak istediğinize emin misiniz?')) {
    run();
  }
};

window.rejectUserApproval = async function(userId) {
  const sb = window._supabaseClient;
  const run = async () => {
    try {
      const { error } = await sb
        .from('profiles')
        .update({ is_approved: false, is_banned: true })
        .eq('id', userId);
      if (error) throw error;
      if (window.showToast) window.showToast('Başvuru reddedildi ve kullanıcı engellendi.', 'success');
      loadAdminUsers();
    } catch (e) {
      console.error(e);
      if (window.showToast) window.showToast('Reddetme işlemi başarısız.', 'error');
    }
  };

  if (window.showCustomConfirm) {
    window.showCustomConfirm('Bu başvuruyu reddetmek ve kullanıcıyı engellemek istediğinize emin misiniz?', run, { okText: 'Evet', okColor: '#ef5350' });
  } else if (confirm('Bu başvuruyu reddetmek ve kullanıcıyı engellemek istediğinize emin misiniz?')) {
    run();
  }
};

window.deleteUserProfile = async function(userId) {
  const sb = window._supabaseClient;
  
  if (window.showCustomConfirm) {
    window.showCustomConfirm('Bu kullanıcının profilini SİLMEK istediğinize emin misiniz? (Bu işlem geri alınamaz!)', async () => {
      executeDeleteUser(sb, userId);
    });
  } else {
    if (confirm('Bu kullanıcının profilini SİLMEK istediğinize emin misiniz? (Bu işlem geri alınamaz!)')) {
      executeDeleteUser(sb, userId);
    }
  }
};

async function executeDeleteUser(sb, userId) {
  try {
    const { error } = await sb.from('profiles').delete().eq('id', userId);
    if (error) throw error;
    if (window.showToast) window.showToast('Kullanıcı profili silindi.', 'success');
    loadAdminUsers();
  } catch (e) {
    console.error(e);
    if (window.showToast) window.showToast('Silme işlemi başarısız. (Auth tabloları silinmemiş olabilir)', 'error');
  }
}

// ─── KONUM HARİTASI MODALI (TAM EKRAN) ─────────────────────────────────────
window.showUserLocation = function(lat, lng, name, city, locationTime) {
  const existing = document.getElementById('locationMapModal');
  if (existing) existing.remove();

  lat = parseFloat(lat);
  lng = parseFloat(lng);
  if (!hasValidCoordinate(lat, lng)) {
    if (window.showToast) window.showToast('Konum koordinatları geçersiz.', 'warning');
    return;
  }

  let timeStr = '';
  if (locationTime) {
    try {
      timeStr = new Date(locationTime).toLocaleDateString('tr-TR', {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch(_) {}
  }

  // IP tabanli konum sokak hassasiyetinde degildir; GSM/VPN icin daha genis zoom kullan.
  const precision = getLocationPrecision(city);
  const delta = precision.delta;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
  const gmapsUrl = `https://www.google.com/maps?q=${lat},${lng}&z=${precision.zoom}`;

  const modal = document.createElement('div');
  modal.id = 'locationMapModal';
  modal.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:200000',
    'display:flex', 'flex-direction:column',
    'background:#0e1621'
  ].join(';');

  modal.innerHTML = `
    <!-- Başlık Barı -->
    <div style="
      flex-shrink:0;
      display:flex; align-items:center; justify-content:space-between;
      padding:14px 20px;
      background:linear-gradient(135deg,#1a2a3a 0%,#17212b 100%);
      border-bottom:1px solid #232e3c;
    ">
      <div style="display:flex; align-items:center; gap:12px; min-width:0;">
        <div style="
          width:40px; height:40px; border-radius:50%;
          background:linear-gradient(135deg,#2563eb,#1d4ed8);
          display:flex; align-items:center; justify-content:center;
          font-size:18px; flex-shrink:0;
        ">📍</div>
        <div style="min-width:0;">
          <div style="color:#fff; font-weight:800; font-size:16px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${name}</div>
          <div style="color:#60a5fa; font-size:12px; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${city || 'Yaklaşık IP konumu'}${timeStr ? ' &nbsp;·&nbsp; ' + timeStr : ''}
          </div>
        </div>
      </div>
      <button onclick="document.getElementById('locationMapModal').remove()" style="
        flex-shrink:0; margin-left:12px;
        width:36px; height:36px; border-radius:10px;
        background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12);
        color:#fff; font-size:20px; cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        transition:background 0.15s;
      " onmouseover="this.style.background='rgba(255,255,255,0.15)'"
         onmouseout="this.style.background='rgba(255,255,255,0.08)'">✕</button>
    </div>

    <!-- Harita (kalan tüm alan) -->
    <div style="flex:1; position:relative; overflow:hidden;">
      <iframe
        src="${mapSrc}"
        style="width:100%; height:100%; border:none; display:block;"
        loading="lazy"
      ></iframe>
    </div>

    <!-- Alt Bilgi Barı -->
    <div style="
      flex-shrink:0;
      display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;
      padding:12px 20px;
      background:#17212b; border-top:1px solid #232e3c;
    ">
      <span style="color:#708499; font-size:12px; font-family:monospace;">
        🌐 ${lat.toFixed(5)}, ${lng.toFixed(5)}
      </span>
      <div style="display:flex; gap:8px;">
        <a href="${gmapsUrl}" target="_blank" rel="noopener noreferrer" style="
          background:#2563eb; color:#fff;
          border-radius:8px; padding:8px 16px;
          font-size:13px; font-weight:800; text-decoration:none;
          display:flex; align-items:center; gap:6px;
        ">🗺 Google Maps'te Aç</a>
      </div>
    </div>
  `;

  // ESC tuşuyla kapat
  const onKey = (e) => { if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);

  document.body.appendChild(modal);
};

// ID ile konum göster — onclick içinde tırnak sorunu yaşatmaz
window.showUserLocationById = function(userId) {
  const d = window._adminLocData && window._adminLocData[userId];
  if (!d) {
    if (window.showToast) window.showToast('Bu kullanıcı için konum verisi bulunamadı.', 'warning');
    return;
  }
  window.showUserLocation(d.lat, d.lng, d.name, d.city, d.time);
};

window.toggleMenuEditorPermission = async function(userId, currentStatus) {
  const sb = window._supabaseClient;
  const newStatus = !currentStatus;
  const message = newStatus
    ? 'Bu kullanıcıya menü yetkisi vermek istediğinize emin misiniz?'
    : 'Bu kullanıcının menü yetkisini kaldırmak istediğinize emin misiniz?';
  const run = async () => {
    try {
      const { error } = await sb.from('profiles').update({ is_menu_editor: newStatus }).eq('id', userId);
      if (error) throw error;
      if (window.showToast) window.showToast(`Menü yetkisi ${newStatus ? 'verildi' : 'kaldırıldı'}.`, 'success');
      loadAdminUsers();
    } catch (e) {
      console.error(e);
      if (window.showToast) window.showToast('İşlem başarısız.', 'error');
    }
  };

  if (window.showCustomConfirm) {
    window.showCustomConfirm(message, run, { okText: 'Evet', okColor: newStatus ? '#10b981' : '#f59e0b' });
  } else if (confirm(message)) {
    run();
  }
};

// ─── TÜM KULLANICILARIN KONUMLARI — TEK HARİTA ─────────────────────────────
window.showAllUsersLocations = function() {
  const locData = window._adminLocData || {};
  const entries = Object.values(locData);

  if (entries.length === 0) {
    if (window.showToast) window.showToast('Gösterilecek konum verisi bulunamadı.', 'warning');
    return;
  }

  const existing = document.getElementById('allLocationsMapModal');
  if (existing) existing.remove();

  // ── 1. Yakınlık gruplandırması (0.3 derece ≈ ~30 km eşiği) ──────────────
  const THRESHOLD = 0.3;
  const used = new Array(entries.length).fill(false);
  const groups = [];

  for (let i = 0; i < entries.length; i++) {
    if (used[i]) continue;
    const group = [entries[i]];
    used[i] = true;
    for (let j = i + 1; j < entries.length; j++) {
      if (used[j]) continue;
      const dLat = Math.abs(entries[i].lat - entries[j].lat);
      const dLng = Math.abs(entries[i].lng - entries[j].lng);
      if (dLat < THRESHOLD && dLng < THRESHOLD) {
        group.push(entries[j]);
        used[j] = true;
      }
    }
    // Grup merkezi
    const cLat = group.reduce((s, e) => s + e.lat, 0) / group.length;
    const cLng = group.reduce((s, e) => s + e.lng, 0) / group.length;
    groups.push({ lat: cLat, lng: cLng, members: group });
  }

  // ── 2. GSM/VPN tespiti (city alanındaki etiket auth.js'de yazılmış) ──────
  const markerColors = ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316'];
  let colorIdx = 0;
  const entryColors = {};
  entries.forEach(e => {
    entryColors[e.name] = markerColors[colorIdx % markerColors.length];
    colorIdx++;
  });

  function isGsmEntry(e) {
    return /gsm|vpn|proxy|sapabilir/i.test(e.city || '');
  }

  // ── 3. Her grup için marker JS kodu üret ─────────────────────────────────
  const markerJs = groups.map((g) => {
    const members = g.members;
    const hasGsm = members.some(isGsmEntry);

    // İsim balonları HTML — her üye için alt alta
    const bubblesHtml = members.map(m => {
      const c = entryColors[m.name] || '#60a5fa';
      const warn = isGsmEntry(m) ? '⚠️ ' : '';
      const safeName = (m.name || 'Kullanıcı')
        .replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      return `<div style="display:flex;align-items:center;gap:4px;background:rgba(15,20,30,0.88);` +
             `border:1px solid ${c};color:#fff;font-size:10px;font-weight:700;` +
             `padding:3px 7px;border-radius:12px;white-space:nowrap;margin-bottom:3px;` +
             `box-shadow:0 1px 4px rgba(0,0,0,0.4);">` +
             `<span style="width:7px;height:7px;border-radius:50%;background:${c};flex-shrink:0;"></span>` +
             `${warn}${safeName}` +
             `</div>`;
    }).join('');

    // Merkez pin rengi — grup tek kişilik ise kişi rengi, değilse mor
    const pinColor = members.length === 1
      ? (entryColors[members[0].name] || '#6366f1')
      : '#6366f1';

    const popupRows = members.map(m => {
      const warn = isGsmEntry(m) ? '<span style="color:#f59e0b;">⚠️ GSM/IP tahmini</span>' : '';
      const safeName = (m.name || '').replace(/'/g, "\\'").replace(/</g, '&lt;');
      const safeCity = (m.city || '').replace(/'/g, "\\'").replace(/</g, '&lt;');
      return `<div style="margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #eee;">` +
             `<b>${safeName}</b> ${warn}<br>` +
             `<span style="font-size:10px;color:#666;">${safeCity}</span></div>`;
    }).join('');

    return `
      (function(){
        var pinSvg = '<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'24\\' height=\\'32\\' viewBox=\\'0 0 24 32\\'>' +
          '<ellipse cx=\\'12\\' cy=\\'30\\' rx=\\'5\\' ry=\\'2\\' fill=\\'rgba(0,0,0,0.2)\\'/>' +
          '<path d=\\'M12 0C6.5 0 2 4.5 2 10c0 7.5 10 20 10 20S22 17.5 22 10C22 4.5 17.5 0 12 0z\\' fill=\\'${pinColor}\\'/>' +
          '<circle cx=\\'12\\' cy=\\'10\\' r=\\'4\\' fill=\\'white\\' opacity=\\'0.9\\'/>' +
          '</svg>';

        var icon = L.divIcon({
          className: '',
          html: '<div style="position:relative; width:24px; height:32px;">' +
                  '<div style="position:absolute; bottom:0; left:0; width:24px; height:32px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">' +
                    pinSvg +
                  '</div>' +
                  '<div style="position:absolute; bottom:0; left:30px; display:flex; flex-direction:column; justify-content:flex-end; pointer-events:none;">' +
                    '${bubblesHtml.replace(/\n/g, '').replace(/'/g, "\\'")}' +
                  '</div>' +
                '</div>',
          iconSize: [24, 32],
          iconAnchor: [12, 32],
          popupAnchor: [0, -32]
        });

        L.marker([${g.lat}, ${g.lng}], {icon: icon})
         .addTo(map)
         .bindPopup('<div style="min-width:160px;">${popupRows.replace(/\n/g,'').replace(/'/g,"\\'")}' +
                    '<div style="font-size:9px;color:#999;margin-top:4px;">📡 IP/GPS tabanlı konum</div></div>');
      })();
    `;
  }).join('\n');

  // ── 4. Harita merkezi ────────────────────────────────────────────────────
  const avgLat = entries.reduce((s, e) => s + e.lat, 0) / entries.length;
  const avgLng = entries.reduce((s, e) => s + e.lng, 0) / entries.length;
  const gsmCount = entries.filter(isGsmEntry).length;

  const iframeContent = `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
    <style>
      html,body,#map{margin:0;padding:0;width:100%;height:100%;}
      .leaflet-popup-content-wrapper{border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.2);}
    </style>
  </head><body>
    <div id="map"></div>
    <script>
      var map = L.map('map').setView([${avgLat}, ${avgLng}], 6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
        attribution:'&copy; OpenStreetMap katkıcıları'
      }).addTo(map);
      ${markerJs}
    <\/script>
  </body></html>`;

  // ── 5. Modal HTML ─────────────────────────────────────────────────────────
  const legendItems = entries.map(e => {
    const c = entryColors[e.name] || '#60a5fa';
    const warn = isGsmEntry(e) ? ' ⚠️' : '';
    return `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:#cbd5e1;">
      <span style="width:9px;height:9px;border-radius:50%;background:${c};flex-shrink:0;display:inline-block;"></span>
      ${e.name || 'Kullanıcı'}${warn}
    </span>`;
  }).join('');

  const gsmWarning = gsmCount > 0
    ? `<div style="font-size:10px;color:#f59e0b;display:flex;align-items:center;gap:5px;margin-top:4px;">
        ⚠️ ${gsmCount} kullanıcı GSM/IP tabanlı — gerçek konumdan sapma olabilir (örn. operatör İstanbul kayıtlı ise Antalya'daki kişi İstanbul görünebilir)
       </div>`
    : '';

  const modal = document.createElement('div');
  modal.id = 'allLocationsMapModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:200001;display:flex;flex-direction:column;background:#0e1621;';

  modal.innerHTML = `
    <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;
                padding:14px 20px;background:linear-gradient(135deg,#1a2a3a,#17212b);
                border-bottom:1px solid #232e3c;">
      <div style="display:flex;align-items:center;gap:12px;min-width:0;">
        <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#4f46e5);
                    display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">🗺️</div>
        <div style="min-width:0;">
          <div style="color:#fff;font-weight:800;font-size:16px;">Tüm Kullanıcı Konumları</div>
          <div style="color:#a5b4fc;font-size:11px;margin-top:2px;">
            ${entries.length} kullanıcı · ${groups.length} konum noktası
          </div>
        </div>
      </div>
      <button onclick="document.getElementById('allLocationsMapModal').remove()"
              style="flex-shrink:0;width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,0.08);
                     border:1px solid rgba(255,255,255,0.12);color:#fff;font-size:20px;cursor:pointer;
                     display:flex;align-items:center;justify-content:center;"
              onmouseover="this.style.background='rgba(255,255,255,0.15)'"
              onmouseout="this.style.background='rgba(255,255,255,0.08)'">✕</button>
    </div>
    <div style="flex:1;position:relative;overflow:hidden;">
      <iframe id="allLocMapFrame" style="width:100%;height:100%;border:none;display:block;"></iframe>
    </div>
    <div style="flex-shrink:0;padding:10px 20px;background:#17212b;border-top:1px solid #232e3c;">
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
        ${legendItems}
      </div>
      ${gsmWarning}
    </div>
  `;

  const onKey = (ev) => { if (ev.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
  document.body.appendChild(modal);

  const frame = document.getElementById('allLocMapFrame');
  const doc = frame.contentDocument || frame.contentWindow.document;
  doc.open();
  doc.write(iframeContent);
  doc.close();
};

window.fetchAndShowReleaseNotes = async function() {
  const modal = document.getElementById('updateSummaryModal');
  const content = document.getElementById('releaseNotesContent');
  const title = document.getElementById('releaseNotesTitle');
  if (!modal || !content || !title) return;

  modal.style.display = 'flex';
  content.innerHTML = '<div style="text-align:center; padding:20px;">Sürüm notları yükleniyor...</div>';
  title.innerHTML = 'Sürüm Notları';

  try {
    const res = await fetch('./release_notes.json?v=' + Date.now());
    if (!res.ok) throw new Error('Dosya bulunamadı.');
    const notes = await res.json();
    
    if (notes && notes.length > 0) {
      let html = '';
      notes.forEach((note, index) => {
        if (index === 0) {
          title.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:8px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
            Sürüm Notları (${note.version})
          `;
        }
        
        html += `
          <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <div style="font-size:16px; font-weight:bold; color:#10b981; margin-bottom:4px;">Güncelleme Sürümü: ${note.version}</div>
            <div style="font-size:12px; color:#9ca3af; margin-bottom:2px;">${note.date}</div>
            <div style="font-size:12px; color:#9ca3af; margin-bottom:12px;">${note.day}</div>
            <div style="font-size:14px; color:#e5e7eb; font-weight:600; margin-bottom:12px;">${note.summary}</div>
            <ul style="padding-left:20px; margin:0; display:flex; flex-direction:column; gap:12px;">
              ${note.items.map(item => `<li>${item}</li>`).join('')}
            </ul>
          </div>
        `;
      });
      content.innerHTML = html;
    } else {
      content.innerHTML = '<div style="text-align:center; padding:20px;">Sürüm notu bulunamadı.</div>';
    }
  } catch (error) {
    console.error(error);
    content.innerHTML = '<div style="text-align:center; padding:20px; color:#ef5350;">Sürüm notları yüklenirken bir hata oluştu.</div>';
  }
};
