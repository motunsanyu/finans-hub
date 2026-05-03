// js/modules/admin.js

let adminUsersCache = [];

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

  listEl.innerHTML = '<div style="text-align:center; padding:40px; color:#708499;">Yükleniyor...</div>';
  
  try {
    const { data: users, error } = await sb
      .from('profiles')
      .select('*');

    if (error) throw error;

    adminUsersCache = users || [];
    if (statsEl) statsEl.textContent = `Kayıtlı Kullanıcı: ${adminUsersCache.length}`;
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

  // Ana yöneticiyi (muzafnot@gmail.com) en üste sabitle
  const sortedUsers = [...users].sort((a, b) => {
    if (a.email === 'muzafnot@gmail.com') return -1;
    if (b.email === 'muzafnot@gmail.com') return 1;
    return 0;
  });

  const currentUserId = window.currentUser?.id;

  const html = sortedUsers.map(u => {
    const isMe = u.id === currentUserId;
    const name = u.display_name || u.username || 'İsimsiz';
    const email = u.email || 'E-posta yok';
    const initial = name.charAt(0).toUpperCase();
    
    // Avatar
    const avatarHtml = u.avatar_url 
      ? `<img src="${u.avatar_url}" style="width:100%;height:100%;object-fit:cover;">` 
      : `<span style="font-weight:700; color:#fff;">${initial}</span>`;

    // Status Badges
    const adminBadge = u.is_admin ? `<span style="background:#fbbf24; color:#000; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:800; margin-left:8px;">YÖNETİCİ</span>` : '';
    const bannedBadge = u.is_banned ? `<span style="background:#ef5350; color:#fff; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:800; margin-left:8px;">ENGELLİ</span>` : '';

    // Action Buttons
    let actions = '';
    if (!isMe) {
      if (u.is_banned) {
        actions += `<button onclick="toggleUserBan('${u.id}', false)" style="background:#2b5278; border:none; color:#fff; padding:8px 12px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer;">Kaldır</button>`;
      } else {
        actions += `<button onclick="toggleUserBan('${u.id}', true)" style="background:rgba(239, 83, 80, 0.1); border:1px solid rgba(239, 83, 80, 0.3); color:#ef5350; padding:8px 12px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer;">Engelle</button>`;
      }
      actions += `<button onclick="deleteUserProfile('${u.id}')" style="background:#ef5350; border:none; color:#fff; padding:8px 12px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer;">Sil</button>`;
    } else {
      actions += `<span style="font-size:12px; color:#708499; font-weight:600; padding-right:8px;">Siz</span>`;
    }

    return `
      <div style="background:#17212b; border-radius:16px; padding:16px; display:flex; align-items:center; gap:16px; border:1px solid #232e3c; transition:transform 0.2s;">
        <div style="width:48px; height:48px; border-radius:50%; background:#2b5278; display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0;">
          ${avatarHtml}
        </div>
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; gap:4px;">
            <div style="color:#fff; font-weight:800; font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${name}</div>
            ${adminBadge}
            ${bannedBadge}
          </div>
          <div style="color:#708499; font-size:12px; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">@${u.username || 'anonim'}</div>
          <div style="color:#8b9eb3; font-size:11px; margin-top:4px;">${email}</div>
        </div>
        <div style="display:flex; gap:8px; flex-shrink:0; align-items:center;">
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
    });
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
