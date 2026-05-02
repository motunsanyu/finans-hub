// js/friends-chat.js — Düzeltilmiş Sürüm
 
const FriendsChatModule = (() => {
  let currentFriendId = null;
  let currentFriendName = null;
  let chatSubscription = null;
  let currentConversationFriendId = null; // sohbet silmek için seçili arkadaş
  let isSendingMsg = false; // mesaj gönderim kilidi
  let activeSwipeRow = null; // Aktif kaydırılmış satır takibi
 
  function getSB() { return window._supabaseClient; }
 
  // ═══ ARKADAŞLIK ═══
  async function searchUser(username) {
    const { data } = await getSB()
      .from('profiles')
      .select('id, username, display_name')
      .eq('username', username)
      .maybeSingle();
    return data;
  }
 
  async function sendFriendRequest(addresseeId) {
    const { data: { user } } = await getSB().auth.getUser();
    await getSB().from('friendships').insert({ requester_id: user.id, addressee_id: addresseeId });
  }
 
  async function getPendingRequests() {
    const { data: { user } } = await getSB().auth.getUser();
    const { data } = await getSB()
      .from('friendships')
      .select('id, requester_id')
      .eq('addressee_id', user.id)
      .eq('status', 'pending');
    if (!data) return [];
    const list = [];
    for (const req of data) {
      const { data: prof } = await getSB()
        .from('profiles')
        .select('username, display_name')
        .eq('id', req.requester_id)
        .single();
      list.push({ id: req.id, requester_id: req.requester_id, profiles: prof });
    }
    return list;
  }
 
  async function getFriends() {
    const { data: { user } } = await getSB().auth.getUser();
    const { data } = await getSB()
      .from('friendships')
      .select('id, requester_id, addressee_id')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq('status', 'accepted');
    if (!data) return [];
    const list = [];
    for (const f of data) {
      const friendId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
      const { data: prof } = await getSB()
        .from('profiles')
        .select('username, display_name')
        .eq('id', friendId)
        .single();
      list.push({
        friendshipId: f.id,
        friendId,
        friendName: prof?.display_name || prof?.username || 'Bilinmeyen'
      });
    }
    return list;
  }
 
  async function acceptRequest(id) {
    await getSB().from('friendships').update({ status: 'accepted' }).eq('id', id);
  }
  async function rejectRequest(id) {
    await getSB().from('friendships').delete().eq('id', id);
  }
 
  async function sendMessage(receiverId, content) {
    const { data: { user } } = await getSB().auth.getUser();
    await getSB().from('messages').insert({ sender_id: user.id, receiver_id: receiverId, content });
  }
 
  async function getMessageHistory(friendId) {
    const { data: { user } } = await getSB().auth.getUser();
    // Doğru Supabase sözdizimi: (A ve B) VEYA (B ve A)
    const { data } = await getSB()
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });
    return data || [];
  }
 
  // ═══ ARKADAŞLAR MODAL ═══
  window.toggleFriendsModal = function () {
    const modal = document.getElementById('friendsModal');
    if (!modal) return;
    const isOpen = modal.style.display === 'flex' || modal.style.display === 'block';
    modal.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
      loadPendingRequests();
      loadFriendList();
      if (typeof window.toggleSidebar === 'function') window.toggleSidebar(false);
    }
  };
 
  window.toggleMessagesModal = function () {
    const modal = document.getElementById('messagesModal');
    if (!modal) return;
    const isOpen = modal.style.display === 'flex' || modal.style.display === 'block';
    modal.style.display = isOpen ? 'none' : 'flex';
    if (!isOpen) {
      loadConversations();
      if (typeof window.toggleSidebar === 'function') window.toggleSidebar(false);
    }
  };
 
  window.searchAndAddFriend = async function () {
    const input = document.getElementById('friendSearchInput');
    const resultDiv = document.getElementById('searchResult');
    if (!input || !resultDiv) return;
 
    const username = input.value.trim();
    if (!username) { resultDiv.innerHTML = ''; return; }
 
    try {
      resultDiv.innerHTML = '<div style="padding:10px 20px; color:#708499; font-size:13px;">Aranıyor...</div>';
      const user = await searchUser(username);
 
      if (!user) {
        resultDiv.innerHTML = '<div style="padding:10px 20px; color:#ef5350; font-size:13px;">Kullanıcı bulunamadı.</div>';
        return;
      }
 
      const avatar = user.avatar_url
        ? `<img src="${user.avatar_url}" style="width:100%; height:100%; object-fit:cover;">`
        : (user.display_name || user.username)[0].toUpperCase();
 
      resultDiv.innerHTML = `
        <div class="friend-card" style="margin-top:10px; cursor:default;">
          <div class="friend-avatar">${avatar}</div>
          <div class="friend-info">
            <span class="friend-name">${user.display_name || user.username}</span>
            <span class="friend-status" style="color:#708499;">@${user.username}</span>
          </div>
          <div style="display:flex; gap:8px;">
            <button onclick="FriendsChatModule.sendRequestAndRefresh('${user.id}')" 
              style="background:#2481cc; border:none; color:#fff; padding:8px 16px; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer;">Ekle</button>
          </div>
        </div>`;
    } catch (e) {
      resultDiv.innerHTML = '<div style="padding:10px 20px; color:#ef5350; font-size:13px;">Arama sırasında hata oluştu.</div>';
    }
  };
 
  window.sendRequestAndRefresh = async function (addresseeId) {
    try {
      await sendFriendRequest(addresseeId);
      if (window.showToast) window.showToast('Arkadaşlık isteği gönderildi!', 'success');
      else alert('Arkadaşlık isteği gönderildi!');
      const inp = document.getElementById('friendSearchInput');
      const res = document.getElementById('searchResult');
      if (inp) inp.value = '';
      if (res) res.innerHTML = '';
    } catch (e) {
      if (window.showToast) window.showToast('Hata: ' + e.message, 'error');
      else alert('Hata: ' + e.message);
    }
  };
 
  async function loadPendingRequests() {
    const el = document.getElementById('pendingRequests');
    if (!el) return;
    try {
      const requests = await getPendingRequests();
      if (!requests.length) {
        el.innerHTML = '<div class="requests-empty">Bekleyen istek yok.</div>';
        return;
      }
      el.innerHTML = requests.map(r => {
        const name = r.profiles?.display_name || r.profiles?.username || 'Bilinmeyen';
        const avatar = name[0].toUpperCase();
        return `
          <div class="friend-card" style="cursor:default;">
            <div class="friend-avatar">${avatar}</div>
            <div class="friend-info">
              <span class="friend-name">${name}</span>
              <span class="friend-status offline">Sana istek gönderdi</span>
            </div>
            <div style="display:flex; gap:8px;">
              <button onclick="FriendsChatModule.acceptAndRefresh('${r.id}')" 
                style="background:#2481cc; border:none; color:#fff; padding:6px 12px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer;">Onayla</button>
              <button onclick="FriendsChatModule.rejectAndRefresh('${r.id}')" 
                style="background:#232e3c; border:none; color:#ef5350; padding:6px 12px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer;">Reddet</button>
            </div>
          </div>`;
      }).join('');
    } catch (e) {
      el.innerHTML = '<div class="requests-empty" style="color:red;">Yüklenemedi.</div>';
    }
  }
 
  window.acceptAndRefresh = async function (id) {
    await acceptRequest(id);
    loadPendingRequests();
    loadFriendList();
  };
  window.rejectAndRefresh = async function (id) {
    await rejectRequest(id);
    loadPendingRequests();
  };
 
  window.removeFriend = async function (event, friendId) {
    if (event) event.stopPropagation();
 
    if (window.showCustomConfirm) {
      window.showCustomConfirm('Bu kişiyi arkadaş listenizden çıkarmak istediğinize emin misiniz?', executeDelete);
    } else {
      if (confirm('Bu kişiyi arkadaş listenizden çıkarmak istediğinize emin misiniz?')) executeDelete();
    }
 
    async function executeDelete() {
      try {
        const { data: { user } } = await getSB().auth.getUser();
        await getSB().from('friendships').delete().match({ requester_id: user.id, addressee_id: friendId });
        await getSB().from('friendships').delete().match({ requester_id: friendId, addressee_id: user.id });
 
        if (window.showToast) window.showToast('Kişi arkadaşlıktan çıkarıldı.', 'success');
        const el = document.getElementById('friendList');
        if (el) el.innerHTML = '<div style="text-align:center; padding:30px; color:#708499; font-style:italic;">Güncelleniyor...</div>';
        setTimeout(() => loadFriendList(), 300);
      } catch (e) {
        if (window.showToast) window.showToast('Hata: ' + e.message, 'error');
      }
    }
  };
 
  async function loadFriendList() {
    const el = document.getElementById('friendList');
    if (!el) return;
    try {
      const data = await getFriends();
      if (!data || data.length === 0) {
        el.innerHTML = '<div class="requests-empty">Henüz arkadaşınız yok.</div>';
        return;
      }
 
      const listItems = [];
      for (const f of data) {
        const fId = f.friendId;
        const { data: prof } = await getSB().from('profiles').select('username, display_name, last_seen, avatar_url').eq('id', fId).maybeSingle();
        if (!prof) continue;
 
        let statusText = 'çevrimdışı';
        let statusClass = 'offline';
        if (prof.last_seen) {
          const diffInSec = Math.floor((new Date() - new Date(prof.last_seen)) / 1000);
          if (diffInSec < 60 && diffInSec >= -5) {
            statusText = 'çevrimiçi';
            statusClass = 'online';
          } else {
            statusText = new Date(prof.last_seen).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
          }
        }
 
        const name = prof.display_name || prof.username || f.friendName;
        const avatarContent = prof.avatar_url
          ? `<img src="${prof.avatar_url}" style="width:100%; height:100%; object-fit:cover;">`
          : name[0].toUpperCase();
 
        listItems.push(`
          <div style="display:flex; align-items:center; margin: 0 12px 8px;">
            <div class="friend-card" onclick="window.openConversationFromFriends('${fId}','${name}')" style="flex:1; margin:0; cursor:pointer;">
              <div class="friend-avatar">${avatarContent}</div>
              <div class="friend-info">
                <span class="friend-name">${name}</span>
                <span class="friend-status ${statusClass}">${statusText}</span>
              </div>
              <div class="friend-action">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2481cc" stroke-width="2.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
            </div>
            <button onclick="window.removeFriend(event, '${fId}')" style="background:none; border:none; color:#ef5350; cursor:pointer; padding:12px; margin-left:4px; display:flex; align-items:center; justify-content:center; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'" title="Arkadaşlıktan Çıkar">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>`);
      }
      el.innerHTML = listItems.join('');
    } catch (e) {
      el.innerHTML = '<div class="requests-empty" style="color:red;">Yüklenemedi.</div>';
    }
  }
 
  window.openConversationFromFriends = function (friendId, friendName) {
    const friendsModal = document.getElementById('friendsModal');
    if (friendsModal) friendsModal.style.display = 'none';
    openMessagesModal();
    setTimeout(() => {
      openConversation(friendId, friendName);
    }, 50);
  };
 
  function openMessagesModal() {
    const modal = document.getElementById('messagesModal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    if (window.visualViewport) modal.style.height = window.visualViewport.height + 'px';
    else modal.style.height = '100%';
 
    const panel = document.getElementById('conversationsPanel');
    const area = document.getElementById('chatArea');
    if (panel) { panel.style.display = 'flex'; panel.style.width = '100%'; }
    if (area) area.style.display = 'none';
 
    loadConversations();
    if (typeof window.toggleSidebar === 'function') window.toggleSidebar(false);
  }
 
  window.toggleMessagesModal = function () {
    const modal = document.getElementById('messagesModal');
    if (!modal) return;
    if (modal.style.display === 'flex') {
      modal.style.display = 'none';
      document.body.style.overflow = '';
      currentFriendId = null;
    } else {
      openMessagesModal();
    }
  };
 
  async function loadConversations() {
    const el = document.getElementById('conversationList');
    if (!el) return;
    el.innerHTML = '<p style="text-align:center; padding:20px; color:var(--text-secondary);">Yükleniyor...</p>';
    try {
      const friends = await getFriends();
      const { data: { user } } = await getSB().auth.getUser();
      const listItems = [];
      for (const f of friends) {
        const { data: msgs } = await getSB()
          .from('messages')
          .select('id, sender_id, receiver_id, deleted_for_sender, deleted_for_receiver')
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${f.friendId},deleted_for_sender.eq.false),and(sender_id.eq.${f.friendId},receiver_id.eq.${user.id},deleted_for_receiver.eq.false)`)
          .limit(1);
        if (!msgs || msgs.length === 0) continue;
        const { data: prof } = await getSB().from('profiles').select('last_seen, avatar_url').eq('id', f.friendId).maybeSingle();
        let statusText = 'çevrimdışı';
        let statusColor = '#6c7883';
        if (prof?.last_seen) {
          const lastSeenDate = new Date(prof.last_seen);
          const diffInSec = Math.floor((new Date() - lastSeenDate) / 1000);
          if (diffInSec < 60 && diffInSec >= -5) {
            statusText = 'çevrimiçi';
            statusColor = '#6ab2f2';
          } else {
            statusText = lastSeenDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
          }
        }
        const avatarContent = prof?.avatar_url
          ? `<img src="${prof.avatar_url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`
          : (f.friendName || '?')[0].toUpperCase();
 
        listItems.push(`
          <div class="conversation-row" 
            style="display:flex; align-items:center; gap:12px; padding:12px 16px; cursor:pointer; transition: all 0.15s ease; border-bottom:1px solid #17212b; user-select:none; -webkit-touch-callout:none; touch-action: pan-y; position:relative; overflow:hidden;"
            onmouseover="this.style.background='#17212b'" onmouseout="this.style.background='transparent'"
            data-friend-id="${f.friendId}"
            data-row-type="conv"
            onclick="FriendsChatModule.openConversation('${f.friendId}','${f.friendName}')"
          >
            <button class="swipe-delete-btn" type="button" 
              style="position:absolute; right:6px; top:50%; transform:translateY(-50%); width:40px; height:40px; border-radius:50%; background:#ef5350; border:none; color:#fff; display:flex; align-items:center; justify-content:center; opacity:0; pointer-events:none; transition:opacity 0.15s ease; box-shadow:0 2px 6px rgba(0,0,0,0.3); cursor:pointer; z-index:3;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
            <div class="conv-content-wrapper" style="display:flex; align-items:center; gap:12px; flex:1; transition: transform 0.2s ease; z-index:2;">
              <div class="conv-avatar-box" style="width:52px;height:52px;border-radius:50%;background:#2b5278;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:#fff;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.2); overflow:hidden; transition: transform 0.15s ease;">
                ${avatarContent}
              </div>
              <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <div style="font-weight:700; font-size:15px; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${f.friendName}</div>
                  <div style="font-size:11px; color:${statusColor}; font-weight:600;">${statusText}</div>
                </div>
                <div style="font-size:13px; color:#6c7883; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Sohbeti açmak için tıkla...</div>
              </div>
            </div>
          </div>`);
      }
      el.innerHTML = listItems.join('');
      attachSwipeHandlers(el);
    } catch (e) {
      el.innerHTML = '<p style="text-align:center; padding:20px; color:red;">Yükleme hatası.</p>';
    }
  }
 
  window.openConversation = async function (friendId, friendName) {
    currentFriendId = friendId;
    currentFriendName = friendName;
    const panel = document.getElementById('conversationsPanel');
    const area = document.getElementById('chatArea');
    const avatar = document.getElementById('chatHeaderAvatar');
    const nameEl = document.getElementById('chatHeaderName');
    const statusEl = document.getElementById('chatHeaderStatus');
    if (panel) panel.style.display = 'none';
    if (area) area.style.display = 'flex';
    if (avatar) avatar.innerHTML = (friendName || '?')[0].toUpperCase();
    if (nameEl) nameEl.textContent = friendName;
    if (statusEl) { statusEl.textContent = 'yükleniyor...'; statusEl.style.color = '#6c7883'; }
    try {
      const { data: prof } = await getSB().from('profiles').select('display_name, username, last_seen, avatar_url').eq('id', friendId).maybeSingle();
      if (prof) {
        const fullName = prof.display_name || prof.username || friendName;
        if (nameEl) nameEl.textContent = fullName;
        if (avatar) {
          avatar.innerHTML = prof.avatar_url
            ? `<img src="${prof.avatar_url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`
            : fullName[0].toUpperCase();
        }
        if (statusEl && prof.last_seen) {
          const diffInSec = Math.floor((new Date() - new Date(prof.last_seen)) / 1000);
          if (diffInSec < 60 && diffInSec >= -5) {
            statusEl.textContent = 'çevrimiçi';
            statusEl.style.color = '#6ab2f2';
          } else {
            statusEl.textContent = 'son görülme ' + new Date(prof.last_seen).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
          }
        }
      }
    } catch (e) {}
    await loadMessages();
  };
 
  window.showConversationsList = function () {
    const panel = document.getElementById('conversationsPanel');
    const area = document.getElementById('chatArea');
    if (panel) { panel.style.display = 'flex'; panel.style.width = '100%'; }
    if (area) area.style.display = 'none';
    currentFriendId = null;
    loadConversations();
  };
 
  let selectedMessageId = null;
  let selectedMessageIsMine = false;
 
  async function loadMessages() {
    const list = document.getElementById('messageList');
    if (!list || !currentFriendId) return;
    if (list.innerHTML.trim() === '') list.innerHTML = '<p style="text-align:center; padding:20px; color:var(--text-secondary);">Yükleniyor...</p>';
    try {
      const messages = await getMessageHistory(currentFriendId);
      const { data: { user } } = await getSB().auth.getUser();
      const visible = messages.filter(msg => {
        if (msg.sender_id === user.id && msg.deleted_for_sender) return false;
        if (msg.receiver_id === user.id && msg.deleted_for_receiver) return false;
        return true;
      });
      if (!visible.length) {
        list.innerHTML = '<p style="text-align:center; padding:40px 20px; color:var(--text-secondary);">Henüz mesaj yok.</p>';
        return;
      }
      let currentDateStr = null;
      list.innerHTML = visible.map(msg => {
        const isMine = msg.sender_id === user.id;
        const msgDate = new Date(msg.created_at);
        const time = msgDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        let dateSeparatorHtml = '';
        const dateStr = msgDate.toLocaleDateString('tr-TR');
        if (dateStr !== currentDateStr) {
          currentDateStr = dateStr;
          dateSeparatorHtml = `<div style="display:flex; justify-content:center; margin:16px 0 8px 0;"><span style="background:rgba(255,255,255,0.06); color:#9ca3af; font-size:11px; padding:4px 12px; border-radius:12px;">${dateStr}</span></div>`;
        }
        const bubbleBg = isMine ? '#2b5278' : '#1e2c3a';
        return dateSeparatorHtml + `<div class="message-row" data-msg-id="${msg.id}" data-is-mine="${isMine}" style="position:relative; display:flex; justify-content:${isMine ? 'flex-end' : 'flex-start'}; margin:6px 0; overflow:hidden;">
          <button class="swipe-delete-btn" type="button" style="position:absolute; right:6px; top:50%; transform:translateY(-50%); width:40px; height:40px; border-radius:50%; background:#ef5350; border:none; color:#fff; display:flex; align-items:center; justify-content:center; opacity:0; pointer-events:none; transition:opacity 0.15s ease; cursor:pointer; z-index:3;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
          <div class="message-bubble" style="max-width:82%; background:${bubbleBg}; color:#fff; padding:8px 12px; border-radius:${isMine ? '12px 12px 0 12px' : '0 12px 12px 12px'}; position:relative; transition: transform 0.2s ease; z-index:2;">
            <div style="font-size:15px;">${msg.content}</div>
            <div style="font-size:10px; color:rgba(255,255,255,0.5); margin-top:4px; text-align:right;">${time}</div>
          </div>
        </div>`;
      }).join('');
      attachSwipeHandlers(list);
      setTimeout(() => { list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' }); }, 50);
    } catch (e) { list.innerHTML = '<p style="text-align:center; padding:20px; color:red;">Hata.</p>'; }
  }
 
  function showMessageMenu(event, msgId, isMine) {
    if (event) { event.preventDefault?.(); event.stopPropagation?.(); }
    selectedMessageId = msgId;
    selectedMessageIsMine = isMine;
    const menu = document.getElementById('messageActionMenu');
    if (!menu) return;
    const everyoneBtn = document.getElementById('btnDeleteEveryone');
    if (everyoneBtn) everyoneBtn.style.display = isMine ? 'block' : 'none';
    menu.style.display = 'block';
    let x = (event.clientX || (event.touches ? event.touches[0].clientX : 0));
    let y = (event.clientY || (event.touches ? event.touches[0].clientY : 0));
    if (x + 200 > window.innerWidth) x -= 200;
    if (y + 120 > window.innerHeight) y -= 120;
    menu.style.left = x + 'px'; menu.style.top = y + 'px';
  }
 
  function attachSwipeHandlers(container) {
    const rows = container.querySelectorAll('.message-row, .conversation-row');
    rows.forEach(row => {
      const isMsg = row.classList.contains('message-row');
      const bubble = isMsg ? row.querySelector('.message-bubble') : row.querySelector('.conv-content-wrapper');
      const btn = row.querySelector('.swipe-delete-btn');
      const msgId = row.dataset.msgId;
      const friendId = row.dataset.friendId;
      const isMine = row.dataset.isMine === 'true';
      if (!bubble) return;
      let startX = 0, startY = 0, dragging = false, isHorizontal = false, pressTimer = null, currentTranslate = 0;
      const onDown = (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        startX = e.clientX; startY = e.clientY; dragging = true; isHorizontal = false; currentTranslate = 0;
        if (activeSwipeRow && activeSwipeRow !== row) resetAllSwipes(row);
        bubble.style.transition = 'none';
        clearTimeout(pressTimer);
        pressTimer = setTimeout(() => {
          if (!isHorizontal && dragging) {
            if (isMsg) showMessageMenu(e, msgId, isMine);
            else showConversationMenu(e.clientX, e.clientY, friendId);
            dragging = false;
          }
        }, 600);
        try { row.setPointerCapture(e.pointerId); } catch (err) {}
      };
      const onMove = (e) => {
        if (!dragging) return;
        const diffX = startX - e.clientX, diffY = Math.abs(startY - e.clientY);
        if (!isHorizontal && (Math.abs(diffX) > 10 && Math.abs(diffX) > diffY)) {
          isHorizontal = true; clearTimeout(pressTimer); row.style.touchAction = 'none';
        }
        if (!isHorizontal) return;
        currentTranslate = Math.max(-90, Math.min(0, -diffX));
        bubble.style.transform = `translateX(${currentTranslate}px)`;
        if (btn) btn.style.opacity = String(Math.min(1, Math.abs(currentTranslate) / 60));
        if (e.cancelable) e.preventDefault();
      };
      const onUp = (e) => {
        clearTimeout(pressTimer); row.style.touchAction = 'pan-y';
        if (!dragging) return; dragging = false;
        bubble.style.transition = 'transform 0.25s ease';
        if (isHorizontal && Math.abs(currentTranslate) > 50) {
          bubble.style.transform = 'translateX(-80px)';
          if (btn) { btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'; }
          activeSwipeRow = row;
        } else {
          bubble.style.transform = 'translateX(0)';
          if (btn) { btn.style.opacity = '0'; btn.style.pointerEvents = 'none'; }
          if (activeSwipeRow === row) activeSwipeRow = null;
        }
        try { row.releasePointerCapture(e.pointerId); } catch (err) {}
      };
      row.addEventListener('pointerdown', onDown);
      row.addEventListener('pointermove', onMove);
      row.addEventListener('pointerup', onUp);
      row.addEventListener('pointercancel', onUp);
      if (btn) {
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation(); ev.preventDefault();
          if (isMsg) {
            if (confirm('Sil?')) { selectedMessageId = msgId; window.deleteMessage('me'); }
          } else {
            currentConversationFriendId = friendId; window.deleteConversation();
          }
          resetAllSwipes(null);
        });
      }
    });
  }
 
  function resetAllSwipes(exceptRow) {
    document.querySelectorAll('.message-row, .conversation-row').forEach(row => {
      if (row === exceptRow) return;
      const isMsg = row.classList.contains('message-row');
      const bub = isMsg ? row.querySelector('.message-bubble') : row.querySelector('.conv-content-wrapper');
      const btn = row.querySelector('.swipe-delete-btn');
      if (bub) bub.style.transform = 'translateX(0)';
      if (btn) { btn.style.opacity = '0'; btn.style.pointerEvents = 'none'; }
    });
    if (!exceptRow) activeSwipeRow = null;
  }
 
  document.addEventListener('click', (e) => {
    const msgMenu = document.getElementById('messageActionMenu');
    if (msgMenu && msgMenu.style.display === 'block' && !msgMenu.contains(e.target)) {
      msgMenu.style.display = 'none'; selectedMessageId = null;
    }
    const convMenu = document.getElementById('conversationActionMenu');
    if (convMenu && convMenu.style.display === 'block' && !convMenu.contains(e.target)) {
      convMenu.style.display = 'none'; currentConversationFriendId = null;
    }
    if (activeSwipeRow && !activeSwipeRow.contains(e.target)) resetAllSwipes(null);
  });
 
  window.closeMessageMenu = () => { document.getElementById('messageActionMenu').style.display = 'none'; selectedMessageId = null; };
 
  window.deleteMessage = async function (scope) {
    if (!selectedMessageId) return;
    const id = selectedMessageId; selectedMessageId = null;
    window.closeMessageMenu();
    try {
      const { data: { user } } = await getSB().auth.getUser();
      const { data: msg } = await getSB().from('messages').select('sender_id').eq('id', id).single();
      if (scope === 'me') {
        const field = msg.sender_id === user.id ? 'deleted_for_sender' : 'deleted_for_receiver';
        await getSB().from('messages').update({ [field]: true }).eq('id', id);
      } else if (scope === 'everyone' && msg.sender_id === user.id) {
        await getSB().from('messages').delete().eq('id', id);
      }
      loadMessages();
    } catch (e) {}
  };
 
  function showConversationMenu(x, y, friendId) {
    const menu = document.getElementById('conversationActionMenu');
    if (!menu) return;
    currentConversationFriendId = friendId;
    menu.style.display = 'block';
    menu.style.left = x + 'px'; menu.style.top = y + 'px';
  }
 
  window.closeConversationMenu = () => { document.getElementById('conversationActionMenu').style.display = 'none'; currentConversationFriendId = null; };
 
  window.deleteConversation = async function () {
    if (!currentConversationFriendId) return;
    const friendId = currentConversationFriendId;
    window.closeConversationMenu();
    const { data: { user } } = await getSB().auth.getUser();
    if (confirm("Sil?")) {
      await getSB().from('messages').update({ deleted_for_sender: true }).match({ sender_id: user.id, receiver_id: friendId });
      await getSB().from('messages').update({ deleted_for_receiver: true }).match({ sender_id: friendId, receiver_id: user.id });
      loadConversations();
    }
  };
 
  window.sendMessageFromUi = async function () {
    if (isSendingMsg) return;
    const input = document.getElementById('messageInput');
    const text = input?.value?.trim();
    if (!text || !currentFriendId) return;
    input.value = ''; isSendingMsg = true;
    try {
      await sendMessage(currentFriendId, text);
      await loadMessages();
    } catch (e) { input.value = text; }
    finally { isSendingMsg = false; input.focus(); }
  };
 
  async function init() {
    const { data: { user } } = await getSB().auth.getUser();
    if (user && !chatSubscription) {
      chatSubscription = getSB().channel('public:messages').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        if (currentFriendId && (payload.new.sender_id === currentFriendId || payload.new.receiver_id === currentFriendId)) loadMessages();
      }).subscribe();
    }
  }
 
  return {
    init, openConversation, openConversationFromFriends,
    toggleFriendsModal: window.toggleFriendsModal,
    toggleMessagesModal: window.toggleMessagesModal,
    sendRequestAndRefresh: window.sendRequestAndRefresh,
    acceptAndRefresh: window.acceptAndRefresh,
    rejectAndRefresh: window.rejectAndRefresh,
    loadConversations,
    closeConversationMenu: window.closeConversationMenu,
    deleteConversation: window.deleteConversation
  };
})();