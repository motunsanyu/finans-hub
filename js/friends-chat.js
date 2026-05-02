// js/friends-chat.js — Tam Yeniden Yazılmış, WhatsApp/Telegram Kalitesinde
// Özellikler: Sabit header, swipe silme, mesaj baloncuğu silme, herkesten silme,
//             realtime, online durum, bildirim badge, emoji, klavye düzeltmesi
// Düzeltmeler: is_read kaldırıldı, lock sorunu giderildi, z-index düzeltildi

const FriendsChatModule = (() => {
  // ═══ STATE ═══
  let currentFriendId = null;
  let currentFriendName = null;
  let chatSubscription = null;
  let isSendingMsg = false;
  let activeSwipeRow = null;
  let selectedMessageId = null;
  let selectedMessageIsMine = false;
  let unreadCount = 0;
  let currentUserId = null;
  let currentUserSession = null; // session bilgisini de tut
  let typingTimer = null;
  let isAtBottom = true;
  let appShellElement = null;     // appShell referansı

  function getSB() { return window._supabaseClient; }

  // ═══ YARDIMCI FONKSİYONLAR ═══
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatTime(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Bugün';
    if (d.toDateString() === yesterday.toDateString()) return 'Dün';
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function getOnlineStatus(lastSeen) {
    if (!lastSeen) return { text: 'çevrimdışı', color: '#6c7883', online: false };
    const diffSec = Math.floor((new Date() - new Date(lastSeen)) / 1000);
    if (diffSec < 90) return { text: 'çevrimiçi', color: '#4ade80', online: true };
    if (diffSec < 3600) return { text: `${Math.floor(diffSec / 60)} dk önce`, color: '#6c7883', online: false };
    return {
      text: 'son görülme ' + new Date(lastSeen).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      color: '#6c7883', online: false
    };
  }

  function makeAvatarHtml(name, avatarUrl, size = 44, fontSize = 18) {
    const initial = (name || '?')[0].toUpperCase();
    const colors = ['#2b5278', '#1a4a6b', '#3a6b8a', '#1e3a5f', '#2d6a9f'];
    const colorIdx = initial.charCodeAt(0) % colors.length;
    if (avatarUrl) {
      return `<img src="${avatarUrl}" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:50%;" onerror="this.parentElement.innerHTML='${initial}';this.parentElement.style.background='${colors[colorIdx]}';">`;
    }
    return `<span style="font-size:${fontSize}px;font-weight:900;color:#fff;">${initial}</span>`;
  }

  // ═══ ARKADAŞLIK İŞLEMLERİ ═══
  async function searchUser(username) {
    const { data } = await getSB().from('profiles')
      .select('id, username, display_name, avatar_url')
      .eq('username', username).maybeSingle();
    return data;
  }

  async function sendFriendRequest(addresseeId) {
    if (!currentUserId) return;
    // Duplicate kontrolü
    const { data: existing } = await getSB().from('friendships')
      .select('id').or(
        `and(requester_id.eq.${currentUserId},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${currentUserId})`
      ).maybeSingle();
    if (existing) {
      if (window.showToast) window.showToast('Bu kullanıcıyla zaten bağlantınız var.', 'error');
      return;
    }
    const { error } = await getSB().from('friendships')
      .insert({ requester_id: currentUserId, addressee_id: addresseeId, status: 'pending' });
    if (error) throw error;
  }

  async function getPendingRequests() {
    if (!currentUserId) return [];
    const { data } = await getSB().from('friendships')
      .select('id, requester_id').eq('addressee_id', currentUserId).eq('status', 'pending');
    if (!data) return [];
    const list = [];
    for (const req of data) {
      const { data: prof } = await getSB().from('profiles')
        .select('username, display_name, avatar_url').eq('id', req.requester_id).single();
      list.push({ id: req.id, requester_id: req.requester_id, profiles: prof });
    }
    return list;
  }

  async function acceptRequest(requestId) {
    await getSB().from('friendships').update({ status: 'accepted' }).eq('id', requestId);
  }

  async function rejectRequest(requestId) {
    await getSB().from('friendships').delete().eq('id', requestId);
  }

  async function getFriends() {
    if (!currentUserId) return [];
    const { data } = await getSB().from('friendships')
      .select('id, requester_id, addressee_id')
      .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`)
      .eq('status', 'accepted');
    if (!data) return [];
    const list = [];
    for (const f of data) {
      const friendId = f.requester_id === currentUserId ? f.addressee_id : f.requester_id;
      const { data: prof } = await getSB().from('profiles')
        .select('id, username, display_name, avatar_url, last_seen').eq('id', friendId).single();
      list.push({
        friendshipId: f.id,
        friendId,
        friendName: prof?.display_name || prof?.username || 'Bilinmeyen',
        profile: prof
      });
    }
    return list;
  }

  // ═══ MESAJLAŞMA İŞLEMLERİ ═══
  async function sendMessage(receiverId, content) {
    if (!currentUserId) throw new Error('Oturum yok');
    const { error } = await getSB().from('messages').insert({
      sender_id: currentUserId,
      receiver_id: receiverId,
      content,
      created_at: new Date().toISOString(),
      deleted_for_sender: false,
      deleted_for_receiver: false
    });
    if (error) throw error;
  }

  async function getMessageHistory(friendId) {
    if (!currentUserId) return [];
    const { data, error } = await getSB().from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUserId})`)
      .order('created_at', { ascending: true });
    if (error) return [];
    return data;
  }

  // ═══ BADGE YÖNETİMİ ═══
  function updateBadgeUI() {
    const badge = document.getElementById('messagesBadge');
    if (!badge) return;
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }

  function resetUnreadCount() {
    unreadCount = 0;
    updateBadgeUI();
    hideNewMessageBanner();
  }

  function incrementUnreadCount() {
    unreadCount++;
    updateBadgeUI();
  }

  // ═══ YENİ MESAJ BANNER (koyu yeşil, beyaz yazı) ═══
  function showNewMessageBanner(senderName, preview) {
    let banner = document.getElementById('newMsgBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'newMsgBanner';
      banner.style.cssText = [
        'position:fixed', 'top:0', 'left:0', 'right:0',
        'background:#1a6b3a', 'color:#fff',
        'display:flex', 'align-items:center', 'gap:10px',
        'padding:12px 16px', 'z-index:10005',
        'cursor:pointer', 'box-shadow:0 2px 12px rgba(0,0,0,0.4)',
        'transform:translateY(-100%)',
        'transition:transform 0.3s cubic-bezier(0.25,1,0.5,1)',
        'font-family:\'Space Grotesk\',sans-serif'
      ].join(';');
      banner.innerHTML = `
        <div style="width:36px;height:36px;border-radius:50%;background:#155a2e;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px;">💬</div>
        <div style="flex:1;min-width:0;">
          <div id="newMsgBannerName" style="font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
          <div id="newMsgBannerPreview" style="font-size:12px;color:rgba(255,255,255,0.75);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
        </div>
        <button onclick="hideBannerAndOpen()" style="background:rgba(255,255,255,0.15);border:none;color:#fff;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap;flex-shrink:0;">Aç</button>`;
      banner.onclick = function(e) { if (!e.target.closest('button')) window.hideBannerAndOpen(); };
      document.body.appendChild(banner);
    }
    const nameEl = document.getElementById('newMsgBannerName');
    const prevEl = document.getElementById('newMsgBannerPreview');
    if (nameEl) nameEl.textContent = senderName;
    if (prevEl) prevEl.textContent = preview || 'Yeni mesajınız var';
    // Animasyonlu göster
    requestAnimationFrame(() => {
      banner.style.transform = 'translateY(0)';
    });
    // 5 saniye sonra otomatik gizle
    clearTimeout(banner._hideTimer);
    banner._hideTimer = setTimeout(() => hideNewMessageBanner(), 5000);
  }

  function hideNewMessageBanner() {
    const banner = document.getElementById('newMsgBanner');
    if (banner) banner.style.transform = 'translateY(-100%)';
  }

  window.hideBannerAndOpen = function() {
    hideNewMessageBanner();
    window.toggleMessagesModal();
  };

  // ═══ ARKADAŞLAR MODAL UI ═══
  async function loadPendingRequests() {
    const el = document.getElementById('pendingRequests');
    const wrapper = document.getElementById('pendingRequestsWrapper');
    if (!el) return;
    try {
      const requests = await getPendingRequests();
      
      // Badge güncelle
      const badge = document.getElementById('friendsBadge');
      if (badge) {
        if (requests.length > 0) {
          badge.style.display = 'inline-flex';
          badge.textContent = requests.length;
        } else {
          badge.style.display = 'none';
        }
      }

      if (!requests.length) {
        el.innerHTML = '';
        if (wrapper) wrapper.style.display = 'none';
        return;
      }
      if (wrapper) wrapper.style.display = 'block';
      el.innerHTML = requests.map(r => {
        const name = r.profiles?.display_name || r.profiles?.username || 'Bilinmeyen';
        const avatarHtml = makeAvatarHtml(name, r.profiles?.avatar_url, 40, 16);
        return `
          <div style="display:flex;align-items:center;padding:10px;margin-bottom:8px;background:#17212b;border-radius:12px;gap:10px;">
            <div style="width:40px;height:40px;border-radius:50%;background:#2b5278;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">${avatarHtml}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:14px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(name)}</div>
              <div style="font-size:11px;color:#708499;">Sana istek gönderdi</div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0;">
              <button onclick="FriendsChatModule.acceptAndRefresh('${r.id}')"
                style="background:#2481cc;border:none;color:#fff;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">✓ Onayla</button>
              <button onclick="FriendsChatModule.rejectAndRefresh('${r.id}')"
                style="background:#232e3c;border:none;color:#ef5350;padding:6px 10px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">✕</button>
            </div>
          </div>`;
      }).join('');
    } catch (e) {
      el.innerHTML = '<div class="requests-empty" style="color:#ef5350;">Yüklenemedi.</div>';
    }
  }

  async function loadFriendList() {
    const el = document.getElementById('friendList');
    if (!el) return;
    try {
      const data = await getFriends();
      if (!data || !data.length) {
        el.innerHTML = '<div class="requests-empty">Henüz arkadaşınız yok.</div>';
        return;
      }
      el.innerHTML = data.map(f => {
        const name = f.friendName;
        const prof = f.profile;
        const status = getOnlineStatus(prof?.last_seen);
        const avatarHtml = makeAvatarHtml(name, prof?.avatar_url, 44, 18);
        return `
          <div style="display:flex;align-items:center;margin-bottom:4px;background:#17212b;padding:10px 12px;border-radius:12px;gap:10px;position:relative;">
            <div onclick="window.openConversationFromFriends('${f.friendId}','${escapeHtml(name)}')"
              style="flex:1;display:flex;align-items:center;gap:10px;cursor:pointer;min-width:0;">
              <div style="position:relative;flex-shrink:0;">
                <div style="width:44px;height:44px;border-radius:50%;background:#2b5278;display:flex;align-items:center;justify-content:center;overflow:hidden;">${avatarHtml}</div>
                ${status.online ? `<div style="position:absolute;bottom:1px;right:1px;width:11px;height:11px;background:#4ade80;border-radius:50%;border:2px solid #17212b;"></div>` : ''}
              </div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:14px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(name)}</div>
                <div style="font-size:11px;color:${status.color};">${status.text}</div>
              </div>
            </div>
            <button onclick="window.removeFriend(event,'${f.friendId}')"
              style="background:none;border:none;color:#ef5350;cursor:pointer;padding:8px;border-radius:8px;flex-shrink:0;transition:background 0.15s;"
              onmouseover="this.style.background='rgba(239,83,80,0.1)'" onmouseout="this.style.background='none'">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6l-1 14H6L5 6"></path>
                <path d="M10 11v6M14 11v6M9 6V4h6v2"></path>
              </svg>
            </button>
          </div>`;
      }).join('');
    } catch (e) {
      el.innerHTML = '<div class="requests-empty" style="color:#ef5350;">Hata oluştu.</div>';
    }
  }

  // ═══ GLOBAL WINDOW FONKSİYONLARI (Arkadaş İşlemleri) ═══
  window.searchAndAddFriend = async function () {
    const input = document.getElementById('friendSearchInput');
    const resultDiv = document.getElementById('searchResult');
    if (!input || !resultDiv) return;
    const username = input.value.trim();
    if (!username) { resultDiv.innerHTML = ''; return; }
    try {
      resultDiv.innerHTML = '<div style="padding:10px;color:#708499;font-size:12px;">Aranıyor...</div>';
      const user = await searchUser(username);
      if (!user) {
        resultDiv.innerHTML = '<div style="padding:10px;color:#ef5350;font-size:12px;">Kullanıcı bulunamadı.</div>';
        return;
      }
      const name = user.display_name || user.username;
      const avatarHtml = makeAvatarHtml(name, user.avatar_url, 40, 16);
      resultDiv.innerHTML = `
        <div style="margin-top:10px;padding:12px;background:#17212b;border-radius:12px;display:flex;align-items:center;gap:10px;">
          <div style="width:40px;height:40px;border-radius:50%;background:#2b5278;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">${avatarHtml}</div>
          <div style="flex:1;min-width:0;">
            <div style="color:#fff;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(name)}</div>
            <div style="color:#708499;font-size:11px;">@${escapeHtml(user.username)}</div>
          </div>
          <button onclick="FriendsChatModule.sendRequestAndRefresh('${user.id}')"
            style="background:#2481cc;color:#fff;border:none;padding:8px 14px;border-radius:8px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;">Ekle</button>
        </div>`;
    } catch (e) {
      resultDiv.innerHTML = '<div style="padding:10px;color:#ef5350;">Hata oluştu.</div>';
    }
  };

  window.sendRequestAndRefresh = async function (id) {
    try {
      await sendFriendRequest(id);
      if (window.showToast) window.showToast('Arkadaşlık isteği gönderildi!', 'success');
      const input = document.getElementById('friendSearchInput');
      const resultDiv = document.getElementById('searchResult');
      if (input) input.value = '';
      if (resultDiv) resultDiv.innerHTML = '';
    } catch (e) {
      if (window.showToast) window.showToast('Hata oluştu!', 'error');
    }
  };

  window.acceptAndRefresh = async function (id) {
    try {
      await acceptRequest(id);
      if (window.showToast) window.showToast('Arkadaşlık isteği kabul edildi!', 'success');
      loadPendingRequests();
      loadFriendList();
    } catch (e) {
      if (window.showToast) window.showToast('Hata oluştu!', 'error');
    }
  };

  window.rejectAndRefresh = async function (id) {
    try {
      await rejectRequest(id);
      loadPendingRequests();
    } catch (e) { }
  };

  window.removeFriend = async function (event, friendId) {
    if (event) event.stopPropagation();
    
    const executeDelete = async () => {
      try {
        await getSB().from('friendships').delete()
          .or(`and(requester_id.eq.${currentUserId},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${currentUserId})`);
        loadFriendList();
        if (window.showToast) window.showToast('Arkadaşlıktan çıkarıldı.', 'success');
      } catch (e) {
        if (window.showToast) window.showToast('Hata oluştu.', 'error');
      }
    };

    if (window.showCustomConfirm) {
      window.showCustomConfirm('Bu kişiyi arkadaş listesinden çıkarmak istiyor musunuz?', executeDelete);
    } else {
      if (confirm('Bu kişiyi arkadaş listesinden çıkarmak istiyor musunuz?')) {
        executeDelete();
      }
    }
  };

  // ═══ MODAL AÇMA/KAPAMA ═══
  // Not: appShell'i tamamen gizlemek (display:none) iç içe HTML yapısı nedeniyle
  // bazen modallerin de görünmez olmasına yol açabiliyor. Z-kaymasını önlemek için 
  // sadece ana içerik (<main>) ve alt navigasyonu (.bottom-nav) gizleyeceğiz.
  function toggleAppShell(show) {
    const mainEl = document.querySelector('main');
    const navEl = document.querySelector('.bottom-nav');
    if (mainEl) mainEl.style.display = show ? '' : 'none';
    if (navEl) navEl.style.display = show ? 'flex' : 'none';
  }

  window.toggleFriendsModal = function () {
    const modal = document.getElementById('friendsModal');
    if (!modal) return;
    const isOpen = modal.style.display === 'flex';
    if (isOpen) {
      modal.style.display = 'none';
    } else {
      modal.style.display = 'flex'; // flex şart: justify-content:flex-end çalışsın
      loadPendingRequests();
      loadFriendList();
      if (typeof window.toggleSidebar === 'function') window.toggleSidebar(false);
    }
  };

  function openMessagesModal() {
    const modal = document.getElementById('messagesModal');
    if (!modal) return;
    modal.style.display = 'flex';
    // Tam ekran modal: altında app içeriği görünmesin (Z kayması önlemi)
    toggleAppShell(false);
    document.body.style.overflow = 'hidden';
    // iOS'ta klavye açılınca modal yüksekliğini ayarla
    if (window.visualViewport) {
      modal.style.height = window.visualViewport.height + 'px';
    } else {
      modal.style.height = '100%';
    }
    const panel = document.getElementById('conversationsPanel');
    const area = document.getElementById('chatArea');
    if (panel) { panel.style.display = 'flex'; panel.style.width = '100%'; }
    if (area) area.style.display = 'none';
    loadConversations();
    if (typeof window.toggleSidebar === 'function') window.toggleSidebar(false);
    resetUnreadCount();
  }

  window.toggleMessagesModal = function () {
    const modal = document.getElementById('messagesModal');
    if (!modal) return;
    if (modal.style.display === 'flex') {
      modal.style.display = 'none';
      modal.style.height = '';
      document.body.style.overflow = '';
      toggleAppShell(true);
      currentFriendId = null;
      currentFriendName = null;
    } else {
      openMessagesModal();
    }
  };

  window.openConversationFromFriends = function (friendId, friendName) {
    const friendsModal = document.getElementById('friendsModal');
    if (friendsModal) friendsModal.style.display = 'none';
    openMessagesModal();
    setTimeout(() => window.openConversation(friendId, friendName), 80);
  };

  // ═══ KONUŞMA LİSTESİ ═══
  async function loadConversations() {
    const el = document.getElementById('conversationList');
    if (!el) return;
    el.innerHTML = `<div style="display:flex;flex-direction:column;gap:2px;padding:8px 0;">
      ${[1, 2, 3].map(() => `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;">
          <div style="width:52px;height:52px;border-radius:50%;background:#17212b;flex-shrink:0;"></div>
          <div style="flex:1;display:flex;flex-direction:column;gap:8px;">
            <div style="height:14px;background:#17212b;border-radius:4px;width:60%;"></div>
            <div style="height:12px;background:#17212b;border-radius:4px;width:80%;"></div>
          </div>
        </div>`).join('')}
    </div>`;

    try {
      if (!currentUserId) return;
      const friends = await getFriends();
      const conversationsWithMsg = [];

      for (const f of friends) {
        // Son mesajı getir - içeriği de dahil et
        const { data: msgs } = await getSB().from('messages')
          .select('id, sender_id, receiver_id, content, created_at, deleted_for_sender, deleted_for_receiver')
          .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${f.friendId}),and(sender_id.eq.${f.friendId},receiver_id.eq.${currentUserId})`)
          .order('created_at', { ascending: false })
          .limit(10);

        // Filtreleme: kullanıcı için görünür olan son mesajı bul
        let lastVisibleMsg = null;
        if (msgs && msgs.length > 0) {
          for (const m of msgs) {
            if (m.sender_id === currentUserId && m.deleted_for_sender) continue;
            if (m.receiver_id === currentUserId && m.deleted_for_receiver) continue;
            lastVisibleMsg = m;
            break;
          }
        }

        // Okunmamış mesaj sayısı (bana gönderilmiş, son okumadan sonraki mesajlar)
        const lastReadStr = localStorage.getItem(`lastRead_${currentUserId}_${f.friendId}`);
        const lastRead = lastReadStr ? new Date(lastReadStr).toISOString() : new Date(0).toISOString();
        const { count: unreadMsgCount } = await getSB().from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('sender_id', f.friendId)
          .eq('receiver_id', currentUserId)
          .eq('deleted_for_receiver', false)
          .gt('created_at', lastRead);

        conversationsWithMsg.push({
          friend: f,
          lastMsg: lastVisibleMsg,
          unread: unreadMsgCount || 0,
          lastMsgTime: lastVisibleMsg ? new Date(lastVisibleMsg.created_at) : new Date(0)
        });
      }

      conversationsWithMsg.sort((a, b) => b.lastMsgTime - a.lastMsgTime);
      const withMsg = conversationsWithMsg.filter(c => c.lastMsg);
      const withoutMsg = conversationsWithMsg.filter(c => !c.lastMsg);
      const sorted = [...withMsg, ...withoutMsg];

      if (!sorted.length) {
        el.innerHTML = `<div style="text-align:center;padding:60px 20px;">
          <div style="font-size:48px;margin-bottom:16px;">💬</div>
          <div style="color:#708499;font-size:15px;font-weight:700;">Henüz mesajınız yok</div>
          <div style="color:#4a5568;font-size:13px;margin-top:8px;">Arkadaşlarınıza mesaj gönderin</div>
        </div>`;
        return;
      }

      el.innerHTML = sorted.map(({ friend: f, lastMsg, unread }) => {
        const status = getOnlineStatus(f.profile?.last_seen);
        const avatarHtml = makeAvatarHtml(f.friendName, f.profile?.avatar_url, 52, 20);
        let lastMsgText = lastMsg ? escapeHtml(lastMsg.content) : 'Sohbet başlatın';
        if (lastMsg && lastMsg.sender_id === currentUserId) lastMsgText = '✓ ' + lastMsgText;
        const timeStr = lastMsg ? formatTime(lastMsg.created_at) : '';

        return `
          <div class="conversation-row" data-friend-id="${f.friendId}"
            style="position:relative;overflow:hidden;border-bottom:1px solid rgba(255,255,255,0.03);">
            <div class="swipe-delete-bg" style="position:absolute;right:0;top:0;bottom:0;width:80px;background:#ef5350;display:flex;align-items:center;justify-content:center;z-index:1;">
              <div style="display:flex;flex-direction:column;align-items:center;gap:4px;color:#fff;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6l-1 14H6L5 6"></path>
                  <path d="M10 11v6M14 11v6M9 6V4h6v2"></path>
                </svg>
                <span style="font-size:10px;font-weight:700;">Sil</span>
              </div>
            </div>
            <div class="conv-content-wrapper"
              onclick="window.openConversation('${f.friendId}','${escapeHtml(f.friendName)}')"
              style="display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;background:#0e1621;position:relative;z-index:2;transition:transform 0.25s cubic-bezier(0.4,0,0.2,1);">
              <div style="position:relative;flex-shrink:0;">
                <div style="width:52px;height:52px;border-radius:50%;background:#2b5278;display:flex;align-items:center;justify-content:center;overflow:hidden;">${avatarHtml}</div>
                ${status.online ? `<div style="position:absolute;bottom:1px;right:1px;width:13px;height:13px;background:#4ade80;border-radius:50%;border:2.5px solid #0e1621;"></div>` : ''}
              </div>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                  <div style="font-weight:700;font-size:15px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60%;">${escapeHtml(f.friendName)}</div>
                  <div style="font-size:11px;color:${unread > 0 ? '#4ade80' : '#6c7883'};flex-shrink:0;">${timeStr}</div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <div style="font-size:13px;color:${unread > 0 ? '#a8b4c0' : '#6c7883'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80%;${unread > 0 ? 'font-weight:600;' : ''}">${lastMsgText}</div>
                  ${unread > 0 ? `<div style="min-width:20px;height:20px;border-radius:10px;background:#2481cc;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 5px;flex-shrink:0;">${unread > 99 ? '99+' : unread}</div>` : ''}
                </div>
              </div>
            </div>
          </div>`;
      }).join('');

      attachSwipeHandlers(el);

    } catch (e) {
      console.error('Konuşmalar yüklenemedi:', e);
      el.innerHTML = '<div style="text-align:center;padding:40px;color:#ef5350;">Yüklenemedi. Lütfen tekrar deneyin.</div>';
    }
  }

  // ═══ SOHBET AÇMA ═══
  window.openConversation = async function (friendId, friendName) {
    currentFriendId = friendId;
    currentFriendName = friendName;

    const panel = document.getElementById('conversationsPanel');
    const area = document.getElementById('chatArea');

    if (panel) panel.style.display = 'none';
    if (area) { area.style.display = 'flex'; area.style.flexDirection = 'column'; }

    updateChatHeader({ display_name: friendName }, null);

    try {
      const { data: prof } = await getSB().from('profiles')
        .select('display_name, username, last_seen, avatar_url').eq('id', friendId).maybeSingle();
      if (prof) updateChatHeader(prof, friendId);
    } catch (e) { }

    localStorage.setItem(`lastRead_${currentUserId}_${friendId}`, new Date().toISOString());
    await loadMessages();
    
    // Okunmamış mesajları tamamen yeniden hesapla
    recalcTotalUnread();

    setTimeout(() => {
      const input = document.getElementById('messageInput');
      if (input) input.focus();
    }, 150);
  };

  function updateChatHeader(prof, friendId) {
    const nameEl = document.getElementById('chatHeaderName');
    const statusEl = document.getElementById('chatHeaderStatus');
    const avatarEl = document.getElementById('chatHeaderAvatar');
    const avatarDot = document.getElementById('chatHeaderOnlineDot');

    const name = prof?.display_name || prof?.username || currentFriendName || '?';
    const status = getOnlineStatus(prof?.last_seen);

    if (nameEl) nameEl.textContent = name;
    if (statusEl) {
      statusEl.textContent = status.text;
      statusEl.style.color = status.color;
    }
    if (avatarEl) {
      avatarEl.innerHTML = makeAvatarHtml(name, prof?.avatar_url, 40, 16);
    }
    if (avatarDot) {
      avatarDot.style.display = status.online ? 'block' : 'none';
    }
  }

  window.showConversationsList = function () {
    const panel = document.getElementById('conversationsPanel');
    const area = document.getElementById('chatArea');
    if (panel) { panel.style.display = 'flex'; panel.style.width = '100%'; }
    if (area) area.style.display = 'none';
    currentFriendId = null;
    currentFriendName = null;
    loadConversations();
  };

  // ═══ MESAJLARI YÜKLE ═══
  async function loadMessages() {
    const list = document.getElementById('messageList');
    if (!list || !currentFriendId) return;

    const wasAtBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;

    list.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px;padding:8px;">
      ${[1, 2, 3, 4, 5].map(i => `
        <div style="display:flex;justify-content:${i % 2 === 0 ? 'flex-end' : 'flex-start'};">
          <div style="width:${60 + (i * 15)}px;height:36px;background:#17212b;border-radius:12px;"></div>
        </div>`).join('')}
    </div>`;

    try {
      if (!currentUserId) return;
      const messages = await getMessageHistory(currentFriendId);
      const visible = messages.filter(msg => {
        if (msg.sender_id === currentUserId && msg.deleted_for_sender) return false;
        if (msg.receiver_id === currentUserId && msg.deleted_for_receiver) return false;
        return true;
      });

      if (!visible.length) {
        list.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:40px 20px;gap:16px;">
            <div style="font-size:64px;opacity:0.3;">💬</div>
            <div style="color:#6c7883;font-size:15px;font-weight:700;text-align:center;">Henüz mesaj yok</div>
            <div style="color:#4a5568;font-size:13px;text-align:center;">İlk mesajı gönder!</div>
          </div>`;
        return;
      }

      let currentDateStr = null;
      const rows = visible.map(msg => {
        const isMine = msg.sender_id === currentUserId;
        const time = formatTime(msg.created_at);
        const dateStr = formatDate(msg.created_at);
        let dateHtml = '';
        if (dateStr !== currentDateStr) {
          currentDateStr = dateStr;
          dateHtml = `
            <div style="display:flex;justify-content:center;margin:12px 0 4px;">
              <span style="background:rgba(255,255,255,0.06);color:#9ca3af;font-size:11px;font-weight:700;padding:4px 14px;border-radius:12px;backdrop-filter:blur(8px);">${dateStr}</span>
            </div>`;
        }

        const bubbleBg = isMine
          ? 'linear-gradient(135deg,#2b5278,#1a3d5c)'
          : '#1e2c3a';
        const borderRadius = isMine ? '14px 14px 2px 14px' : '14px 14px 14px 2px';

        return dateHtml + `
          <div class="message-row" data-msg-id="${msg.id}" data-is-mine="${isMine}"
            style="display:flex;justify-content:${isMine ? 'flex-end' : 'flex-start'};margin:2px 0;position:relative;">
            <div class="message-bubble"
              style="max-width:78%;background:${bubbleBg};color:#fff;padding:9px 12px 7px;border-radius:${borderRadius};
                     position:relative;word-break:break-word;box-shadow:0 1px 4px rgba(0,0,0,0.3);
                     transition:transform 0.25s cubic-bezier(0.4,0,0.2,1);">
              <div style="font-size:15px;line-height:1.45;letter-spacing:0.01em;">${escapeHtml(msg.content)}</div>
              <div style="display:flex;align-items:center;justify-content:flex-end;gap:4px;margin-top:4px;">
                <span style="font-size:10px;color:rgba(255,255,255,0.38);">${time}</span>
                ${isMine ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>` : ''}
              </div>
            </div>
          </div>`;
      }).join('');

      list.innerHTML = rows;
      attachMessageSwipeHandlers(list);

      if (wasAtBottom || !currentFriendId) {
        requestAnimationFrame(() => {
          list.scrollTop = list.scrollHeight;
        });
      }

    } catch (e) {
      console.error('Mesajlar yüklenemedi:', e);
      list.innerHTML = '<div style="text-align:center;padding:40px;color:#ef5350;">Mesajlar yüklenemedi.</div>';
    }
  }

  // ═══ MESAJ GÖNDER ═══
  // NOT: loadMessages() çağrılmıyor — tüm listeyi yeniden render edince
  // "dalgalanma" (flicker) oluyor. Bunun yerine optimistik mesaj anında
  // ekranda kalır, sadece "gönderildi" stiline geçirilir. Realtime
  // subscription zaten karşı tarafın mesajlarını günceller.
  window.sendMessageFromUi = async function () {
    if (isSendingMsg) return;
    const input = document.getElementById('messageInput');
    const text = input?.value?.trim();
    if (!text || !currentFriendId) return;

    input.value = '';
    isSendingMsg = true;
    adjustTextareaHeight(input);

    const tempId = 'temp_' + Date.now();
    appendOptimisticMessage(tempId, text);

    try {
      await sendMessage(currentFriendId, text);
      // Başarı: optimistik mesajı "gönderildi" stiline geçir
      const tempEl = document.querySelector(`[data-msg-id="${tempId}"]`);
      if (tempEl) {
        tempEl.style.opacity = '1';
        // Çift tik (gönderildi) ikonu güncelle
        const svg = tempEl.querySelector('svg polyline');
        if (svg) svg.closest('svg').setAttribute('stroke', 'rgba(255,255,255,0.65)');
      }
    } catch (e) {
      const tempEl = document.querySelector(`[data-msg-id="${tempId}"]`);
      if (tempEl) {
        // Hata: mesajı kırmızıya çevir
        const bubble = tempEl.querySelector('.message-bubble');
        if (bubble) bubble.style.background = 'linear-gradient(135deg,#5c1a1a,#3c0d0d)';
        tempEl.title = 'Gönderilemedi — tekrar dokunun';
      }
      input.value = text;
      adjustTextareaHeight(input);
      if (window.showToast) window.showToast('Mesaj gönderilemedi.', 'error');
    } finally {
      isSendingMsg = false;
      input.focus();
    }
  };

  function appendOptimisticMessage(tempId, text) {
    const list = document.getElementById('messageList');
    if (!list) return;

    if (list.querySelector('[style*="flex-direction:column"]') && !list.querySelector('.message-row')) {
      list.innerHTML = '';
    }

    const time = formatTime(new Date().toISOString());
    const div = document.createElement('div');
    div.className = 'message-row';
    div.dataset.msgId = tempId;
    div.dataset.isMine = 'true';
    div.style.cssText = 'display:flex;justify-content:flex-end;margin:2px 0;position:relative;opacity:0.7;';
    div.innerHTML = `
      <div class="message-bubble"
        style="max-width:78%;background:linear-gradient(135deg,#2b5278,#1a3d5c);color:#fff;padding:9px 12px 7px;
               border-radius:14px 14px 2px 14px;word-break:break-word;box-shadow:0 1px 4px rgba(0,0,0,0.3);">
        <div style="font-size:15px;line-height:1.45;">${escapeHtml(text)}</div>
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:4px;margin-top:4px;">
          <span style="font-size:10px;color:rgba(255,255,255,0.38);">${time}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
      </div>`;
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
  }

  // ═══ MESAJ SİLME ═══
  function showMessageContextMenu(event, msgId, isMine) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    selectedMessageId = msgId;
    selectedMessageIsMine = isMine;

    const menu = document.getElementById('messageActionMenu');
    if (!menu) return;

    const everyoneBtn = document.getElementById('btnDeleteEveryone');
    if (everyoneBtn) everyoneBtn.style.display = isMine ? 'flex' : 'none';

    menu.style.display = 'block';

    let x = event?.clientX ?? window.innerWidth / 2;
    let y = event?.clientY ?? window.innerHeight / 2;

    if (!event?.clientX && event?.touches) {
      x = event.touches[0].clientX;
      y = event.touches[0].clientY;
    }

    menu.style.left = '0';
    menu.style.top = '0';
    menu.style.visibility = 'hidden';
    requestAnimationFrame(() => {
      const mW = menu.offsetWidth;
      const mH = menu.offsetHeight;
      x = Math.min(x, window.innerWidth - mW - 8);
      y = Math.min(y, window.innerHeight - mH - 8);
      x = Math.max(8, x);
      y = Math.max(8, y);
      menu.style.left = x + 'px';
      menu.style.top = y + 'px';
      menu.style.visibility = 'visible';
    });
  }

  window.closeMessageMenu = function () {
    const m = document.getElementById('messageActionMenu');
    if (m) m.style.display = 'none';
    selectedMessageId = null;
  };

  window.deleteMessage = async function (scope) {
    if (!selectedMessageId) return;
    const id = selectedMessageId;
    selectedMessageId = null;
    window.closeMessageMenu();

    const msgEl = document.querySelector(`.message-row[data-msg-id="${id}"]`);
    if (msgEl) msgEl.style.opacity = '0.3';

    try {
      const { data: msg } = await getSB().from('messages').select('sender_id').eq('id', id).single();

      if (scope === 'me') {
        const field = msg.sender_id === currentUserId ? 'deleted_for_sender' : 'deleted_for_receiver';
        await getSB().from('messages').update({ [field]: true }).eq('id', id);
        if (msgEl) msgEl.remove();
      } else if (scope === 'everyone' && msg.sender_id === currentUserId) {
        await getSB().from('messages').delete().eq('id', id);
        if (msgEl) msgEl.remove();
      }

      const list = document.getElementById('messageList');
      if (list && !list.querySelector('.message-row')) {
        list.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:40px 20px;gap:16px;">
            <div style="font-size:64px;opacity:0.3;">💬</div>
            <div style="color:#6c7883;font-size:15px;font-weight:700;text-align:center;">Henüz mesaj yok</div>
          </div>`;
      }

      loadConversations();

    } catch (e) {
      console.error('Silme hatası:', e);
      if (msgEl) msgEl.style.opacity = '1';
      if (window.showToast) window.showToast('Silme başarısız oldu.', 'error');
    }
  };

  // ═══ SOHBET (KONUŞMA) SİLME ═══
  window.deleteConversation = async function (friendId) {
    const fId = friendId || window._pendingDeleteFriendId;
    if (!fId) return;
    window._pendingDeleteFriendId = null;

    const executeDelete = async () => {
      try {
        await getSB().from('messages')
          .update({ deleted_for_sender: true })
          .match({ sender_id: currentUserId, receiver_id: fId });
        await getSB().from('messages')
          .update({ deleted_for_receiver: true })
          .match({ sender_id: fId, receiver_id: currentUserId });

        if (window.showToast) window.showToast('Sohbet silindi.', 'success');
        loadConversations();

        if (currentFriendId === fId) window.showConversationsList();
      } catch (e) {
        if (window.showToast) window.showToast('Sohbet silinemedi.', 'error');
      }
    };

    if (window.showCustomConfirm) {
      window.showCustomConfirm('Bu sohbeti silmek istediğinize emin misiniz?<br><span style="font-size:12px;color:#708499;">(Yalnızca sizin için silinir)</span>', executeDelete);
    } else {
      if (confirm('Bu sohbeti silmek istediğinize emin misiniz?\n(Yalnızca sizin için silinir)')) {
        executeDelete();
      }
    }
  };

  // ═══ SWIPE HANDLERLERİ (Konuşma Listesi) ═══
  function attachSwipeHandlers(container) {
    const rows = container.querySelectorAll('.conversation-row');
    rows.forEach(row => {
      const wrapper = row.querySelector('.conv-content-wrapper');
      if (!wrapper) return;

      const friendId = row.dataset.friendId;
      let startX = 0, startY = 0, dragging = false, isHorizontal = null;
      let currentX = 0;
      const SWIPE_THRESHOLD = 60;
      const MAX_SWIPE = 80;

      const resetRow = (animate = true) => {
        wrapper.style.transition = animate ? 'transform 0.25s cubic-bezier(0.4,0,0.2,1)' : 'none';
        wrapper.style.transform = 'translateX(0)';
        currentX = 0;
      };

      const onDown = (e) => {
        if (activeSwipeRow && activeSwipeRow !== row) {
          const prevWrapper = activeSwipeRow.querySelector('.conv-content-wrapper');
          if (prevWrapper) { prevWrapper.style.transition = 'transform 0.25s'; prevWrapper.style.transform = 'translateX(0)'; }
          activeSwipeRow = null;
        }
        startX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
        startY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
        dragging = true;
        isHorizontal = null;
        wrapper.style.transition = 'none';
      };

      const onMove = (e) => {
        if (!dragging) return;
        const cx = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
        const cy = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
        const dx = startX - cx;
        const dy = Math.abs(startY - cy);

        if (isHorizontal === null) {
          if (Math.abs(dx) < 6 && dy < 6) return;
          isHorizontal = Math.abs(dx) > dy;
        }
        if (!isHorizontal) return;
        if (e.cancelable) e.preventDefault();

        const tx = Math.max(-MAX_SWIPE, Math.min(0, -dx + (currentX < 0 ? currentX : 0)));
        wrapper.style.transform = `translateX(${tx}px)`;
      };

      const onUp = (e) => {
        if (!dragging) return;
        dragging = false;
        const cx = e.clientX ?? e.changedTouches?.[0]?.clientX ?? 0;
        const dx = startX - cx;
        const finalTx = parseFloat(wrapper.style.transform?.match(/-?\d+(\.\d+)?/)?.[0] ?? 0);

        wrapper.style.transition = 'transform 0.25s cubic-bezier(0.4,0,0.2,1)';
        if (Math.abs(finalTx) > SWIPE_THRESHOLD) {
          wrapper.style.transform = `translateX(-${MAX_SWIPE}px)`;
          currentX = -MAX_SWIPE;
          activeSwipeRow = row;
        } else {
          resetRow();
          activeSwipeRow = null;
        }
      };

      const bg = row.querySelector('.swipe-delete-bg');
      if (bg) {
        bg.addEventListener('click', (e) => {
          e.stopPropagation();
          resetRow();
          activeSwipeRow = null;
          window._pendingDeleteFriendId = friendId;
          window.deleteConversation(friendId);
        });
      }

      row.addEventListener('mousedown', onDown);
      row.addEventListener('mousemove', onMove);
      row.addEventListener('mouseup', onUp);
      row.addEventListener('touchstart', onDown, { passive: true });
      row.addEventListener('touchmove', onMove, { passive: false });
      row.addEventListener('touchend', onUp);
    });
  }

  // ═══ MESAJ BALONCUĞU SWIPE (Uzun basma ile menü) ═══
  function attachMessageSwipeHandlers(container) {
    const rows = container.querySelectorAll('.message-row');
    rows.forEach(row => {
      const bubble = row.querySelector('.message-bubble');
      if (!bubble) return;

      const msgId = row.dataset.msgId;
      const isMine = row.dataset.isMine === 'true';

      if (msgId.startsWith('temp_')) return;

      let pressTimer = null;
      let hasMoved = false;
      let startX = 0, startY = 0;

      const onStart = (e) => {
        hasMoved = false;
        startX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
        startY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
        pressTimer = setTimeout(() => {
          if (!hasMoved) {
            if (navigator.vibrate) navigator.vibrate(30);
            showMessageContextMenu(e, msgId, isMine);
          }
        }, 500);
      };

      const onMove = (e) => {
        const cx = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
        const cy = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
        if (Math.abs(cx - startX) > 8 || Math.abs(cy - startY) > 8) {
          hasMoved = true;
          clearTimeout(pressTimer);
        }
      };

      const onEnd = () => {
        clearTimeout(pressTimer);
      };

      bubble.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showMessageContextMenu(e, msgId, isMine);
      });

      bubble.addEventListener('mousedown', onStart);
      bubble.addEventListener('mousemove', onMove);
      bubble.addEventListener('mouseup', onEnd);
      bubble.addEventListener('touchstart', onStart, { passive: true });
      bubble.addEventListener('touchmove', onMove, { passive: true });
      bubble.addEventListener('touchend', onEnd);
    });
  }

  document.addEventListener('click', (e) => {
    const msgMenu = document.getElementById('messageActionMenu');
    if (msgMenu && msgMenu.style.display === 'block' && !msgMenu.contains(e.target)) {
      msgMenu.style.display = 'none';
      selectedMessageId = null;
    }

    if (activeSwipeRow && !activeSwipeRow.contains(e.target)) {
      const wrapper = activeSwipeRow.querySelector('.conv-content-wrapper');
      if (wrapper) { wrapper.style.transition = 'transform 0.25s'; wrapper.style.transform = 'translateX(0)'; }
      activeSwipeRow = null;
    }
  });

  // ═══ TEXTAREA OTOMATİK YÜKSELTİ ═══
  function adjustTextareaHeight(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  // ═══ KLAVYE AÇILINCA LAYOUT (iOS için) ═══
  function setupKeyboardHandler() {
    const input = document.getElementById('messageInput');
    if (!input) return;

    input.addEventListener('input', () => adjustTextareaHeight(input));
    input.addEventListener('focus', () => {
      setTimeout(() => {
        const list = document.getElementById('messageList');
        if (list) list.scrollTop = list.scrollHeight;
      }, 400);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        window.sendMessageFromUi();
      }
    });

    if (window.visualViewport) {
      const adjustViewport = () => {
        const modal = document.getElementById('messagesModal');
        if (!modal || modal.style.display !== 'flex') return;
        modal.style.height = window.visualViewport.height + 'px';
        modal.style.top = window.visualViewport.offsetTop + 'px';
        window.scrollTo(0, 0); // Kendi viewport'umuzu yönettiğimiz için tarayıcı scrollunu sıfırla
      };
      window.visualViewport.addEventListener('resize', adjustViewport);
      window.visualViewport.addEventListener('scroll', adjustViewport);
    }
  }

  // ═══ REALTIME SUBSCRIPTION ═══
  async function setupRealtimeSubscription() {
    if (chatSubscription) {
      try { await getSB().removeChannel(chatSubscription); } catch (e) { }
    }

    if (!currentUserId) return;

    chatSubscription = getSB()
      .channel(`messages:${currentUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const msg = payload.new;
        if (msg.sender_id === currentUserId) return;

        if (currentFriendId && msg.sender_id === currentFriendId) {
          // Aktif sohbetteyiz: sessizce mesajları güncelle (scroll korunur)
          localStorage.setItem(`lastRead_${currentUserId}_${currentFriendId}`, new Date().toISOString());
          await loadMessages();
        } else {
          // Farklı bir yerden mesaj geldi
          incrementUnreadCount();
          const modal = document.getElementById('messagesModal');
          if (modal?.style.display === 'flex') {
            // Mesajlar ekranı açıksa konuşma listesini yenile
            const panel = document.getElementById('conversationsPanel');
            if (panel?.style.display !== 'none') loadConversations();
          }
          // Gönderen bilgisini al ve banner göster
          try {
            const { data: prof } = await getSB().from('profiles')
              .select('display_name, username').eq('id', msg.sender_id).single();
            const senderName = prof?.display_name || prof?.username || 'Biri';
            const preview = msg.content ? msg.content.slice(0, 60) + (msg.content.length > 60 ? '...' : '') : 'Yeni mesaj';
            // Koyu yeşil bildirim banner'ı göster
            showNewMessageBanner(senderName, preview);
          } catch (e) { }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, async (payload) => {
        if (!currentFriendId) return;
        const msg = payload.new;
        if (msg.sender_id === currentFriendId || msg.receiver_id === currentFriendId) {
          await loadMessages();
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, async (payload) => {
        if (currentFriendId) await loadMessages();
      })
      .subscribe();

    // Arkadaşlık istekleri için ayrı bir kanal (eğer Supabase'de realtime açık değilse mesajları bozmasın)
    getSB().channel(`friendships:${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, async (payload) => {
        // Arkadaşlık isteklerinde değişiklik olunca listeleri yenile
        loadPendingRequests();
        const modal = document.getElementById('friendsModal');
        if (modal?.style.display === 'flex') {
          loadFriendList();
        }
      })
      .subscribe();
  }

  // ═══ SESSION YENİLEME (init'te bir kez) ═══
  async function refreshSession() {
    try {
      const { data: { session }, error } = await getSB().auth.getSession();
      if (error || !session) {
        console.warn('Oturum bulunamadı, arkadaş modülü devre dışı');
        return false;
      }
      currentUserId = session.user.id;
      currentUserSession = session;
      return true;
    } catch (e) {
      console.error('Session alınamadı:', e);
      return false;
    }
  }

  // ═══ INIT ═══
  let _initializedForUserId = null;
  async function init() {
    const ok = await refreshSession();
    if (!ok) return;
    // Aynı kullanıcı için tekrar init edilmesin (çift çağrı koruması)
    if (_initializedForUserId === currentUserId) return;
    _initializedForUserId = currentUserId;
    setupKeyboardHandler();
    await setupRealtimeSubscription();

    // Başlangıçta okunmamış mesaj sayısını al
    await recalcTotalUnread();

    // Başlangıçta arkadaş isteklerini yükle (badge için)
    loadPendingRequests();
  }

  // Okunmamışları localStorage bazlı yeniden hesapla
  async function recalcTotalUnread() {
    if (!currentUserId) return;
    try {
      const { data: incomingMsgs } = await getSB().from('messages')
        .select('sender_id, created_at')
        .eq('receiver_id', currentUserId)
        .eq('deleted_for_receiver', false);
      
      let realUnread = 0;
      if (incomingMsgs) {
        incomingMsgs.forEach(m => {
          const lrStr = localStorage.getItem(`lastRead_${currentUserId}_${m.sender_id}`);
          const lr = lrStr ? new Date(lrStr) : new Date(0);
          if (new Date(m.created_at) > lr) realUnread++;
        });
      }
      unreadCount = realUnread;
      updateBadgeUI();
    } catch (e) { }
  }

  // ═══ PUBLIC API ═══
  return {
    init,
    openConversation: (...args) => window.openConversation(...args),
    openConversationFromFriends: (...args) => window.openConversationFromFriends(...args),
    toggleFriendsModal: window.toggleFriendsModal,
    toggleMessagesModal: window.toggleMessagesModal,
    sendRequestAndRefresh: window.sendRequestAndRefresh,
    acceptAndRefresh: window.acceptAndRefresh,
    rejectAndRefresh: window.rejectAndRefresh,
    loadConversations,
    deleteConversation: window.deleteConversation,
    removeFriend: window.removeFriend
  };
})();

// NOT: FriendsChatModule.init() çağrısı auth.js ve app.js üzerinden yapılıyor.
// Oturum doğrulandıktan sonra init edilmeli; sayfa yüklenince direkt init etmek
// oturum henüz hazır olmadığından currentUserId null kalır.
// Bu nedenle buradaki otomatik init kaldırıldı.