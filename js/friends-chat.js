// js/friends-chat.js — Tam Donanımlı Düzeltilmiş Sürüm

const FriendsChatModule = (() => {
  let currentFriendId = null;
  let currentFriendName = null;
  let chatSubscription = null;
  let currentConversationFriendId = null;
  let isSendingMsg = false;
  let activeSwipeRow = null;
  let selectedMessageId = null;
  let selectedMessageIsMine = false;

  function getSB() { return window._supabaseClient; }

  // ═══ ARKADAŞLIK MANTIĞI ═══
  async function searchUser(username) {
    const { data } = await getSB().from('profiles').select('id, username, display_name, avatar_url').eq('username', username).maybeSingle();
    return data;
  }

  async function sendFriendRequest(addresseeId) {
    const { data: { user } } = await getSB().auth.getUser();
    if (!user) return;
    await getSB().from('friendships').insert({ requester_id: user.id, addressee_id: addresseeId, status: 'pending' });
  }

  async function getPendingRequests() {
    const { data: { user } } = await getSB().auth.getUser();
    if (!user) return [];
    const { data } = await getSB().from('friendships').select('id, requester_id').eq('addressee_id', user.id).eq('status', 'pending');
    if (!data) return [];
    const list = [];
    for (const req of data) {
      const { data: prof } = await getSB().from('profiles').select('username, display_name').eq('id', req.requester_id).single();
      list.push({ id: req.id, requester_id: req.requester_id, profiles: prof });
    }
    return list;
  }

  async function getFriends() {
    const { data: { user } } = await getSB().auth.getUser();
    if (!user) return [];
    const { data } = await getSB().from('friendships').select('id, requester_id, addressee_id').or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`).eq('status', 'accepted');
    if (!data) return [];
    const list = [];
    for (const f of data) {
      const friendId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
      const { data: prof } = await getSB().from('profiles').select('username, display_name').eq('id', friendId).single();
      list.push({ friendshipId: f.id, friendId, friendName: prof?.display_name || prof?.username || 'Bilinmeyen' });
    }
    return list;
  }

  // ═══ ARKADAŞLAR UI FONKSİYONLARI ═══
  async function loadPendingRequests() {
    const el = document.getElementById('pendingRequests');
    if (!el) return;
    try {
      const requests = await getPendingRequests();
      if (!requests.length) { el.innerHTML = '<div class="requests-empty">Bekleyen istek yok.</div>'; return; }
      el.innerHTML = requests.map(r => {
        const name = r.profiles?.display_name || r.profiles?.username || 'Bilinmeyen';
        return `
          <div class="friend-card" style="cursor:default; padding:10px; margin-bottom:8px; background:#17212b; border-radius:12px; display:flex; align-items:center; gap:10px;">
            <div style="width:40px; height:40px; border-radius:50%; background:#2b5278; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800;">${name[0].toUpperCase()}</div>
            <div style="flex:1;">
              <div style="font-size:14px; font-weight:700; color:#fff;">${name}</div>
              <div style="font-size:11px; color:#708499;">Sana istek gönderdi</div>
            </div>
            <div style="display:flex; gap:6px;">
              <button onclick="FriendsChatModule.acceptAndRefresh('${r.id}')" style="background:#2481cc; border:none; color:#fff; padding:6px 10px; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer;">Onayla</button>
              <button onclick="FriendsChatModule.rejectAndRefresh('${r.id}')" style="background:#232e3c; border:none; color:#ef5350; padding:6px 10px; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer;">Reddet</button>
            </div>
          </div>`;
      }).join('');
    } catch (e) { el.innerHTML = '<div class="requests-empty" style="color:red;">Yüklenemedi.</div>'; }
  }

  async function loadFriendList() {
    const el = document.getElementById('friendList');
    if (!el) return;
    try {
      const data = await getFriends();
      if (!data || data.length === 0) { el.innerHTML = '<div class="requests-empty">Henüz arkadaşınız yok.</div>'; return; }
      const listItems = [];
      for (const f of data) {
        const { data: prof } = await getSB().from('profiles').select('username, display_name, last_seen, avatar_url').eq('id', f.friendId).maybeSingle();
        if (!prof) continue;
        const name = prof.display_name || prof.username || f.friendName;
        const avatar = prof.avatar_url ? `<img src="${prof.avatar_url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : name[0].toUpperCase();
        listItems.push(`
          <div style="display:flex; align-items:center; margin-bottom:8px; background:#17212b; padding:10px; border-radius:12px; gap:10px;">
            <div onclick="window.openConversationFromFriends('${f.friendId}','${name}')" style="flex:1; display:flex; align-items:center; gap:10px; cursor:pointer;">
              <div style="width:44px; height:44px; border-radius:50%; background:#2b5278; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:900; overflow:hidden;">${avatar}</div>
              <div style="flex:1;">
                <div style="font-size:14px; font-weight:700; color:#fff;">${name}</div>
                <div style="font-size:11px; color:#708499;">Sohbeti açmak için tıkla</div>
              </div>
            </div>
            <button onclick="window.removeFriend(event, '${f.friendId}')" style="background:none; border:none; color:#ef5350; cursor:pointer; padding:8px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>`);
      }
      el.innerHTML = listItems.join('');
    } catch (e) { el.innerHTML = '<div class="requests-empty" style="color:red;">Hata.</div>'; }
  }

  window.searchAndAddFriend = async function () {
    const input = document.getElementById('friendSearchInput');
    const resultDiv = document.getElementById('searchResult');
    if (!input || !resultDiv) return;
    const username = input.value.trim();
    if (!username) { resultDiv.innerHTML = ''; return; }
    try {
      resultDiv.innerHTML = '<div style="padding:10px; color:#708499; font-size:12px;">Aranıyor...</div>';
      const user = await searchUser(username);
      if (!user) { resultDiv.innerHTML = '<div style="padding:10px; color:#ef5350; font-size:12px;">Bulunamadı.</div>'; return; }
      resultDiv.innerHTML = `
        <div style="margin-top:10px; padding:10px; background:#17212b; border-radius:12px; display:flex; align-items:center; gap:10px;">
          <div style="width:40px; height:40px; border-radius:50%; background:#2b5278; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800;">${(user.display_name || user.username)[0].toUpperCase()}</div>
          <div style="flex:1;">
            <div style="color:#fff; font-weight:700;">${user.display_name || user.username}</div>
            <div style="color:#708499; font-size:11px;">@${user.username}</div>
          </div>
          <button onclick="FriendsChatModule.sendRequestAndRefresh('${user.id}')" style="background:#2481cc; color:#fff; border:none; padding:8px 12px; border-radius:8px; font-weight:700; cursor:pointer;">Ekle</button>
        </div>`;
    } catch (e) { resultDiv.innerHTML = '<div style="padding:10px; color:#ef5350;">Hata.</div>'; }
  };

  window.sendRequestAndRefresh = async function (id) {
    try { await sendFriendRequest(id); if (window.showToast) window.showToast('İstek gönderildi!', 'success'); input.value = ''; resultDiv.innerHTML = ''; }
    catch (e) { if (window.showToast) window.showToast('Hata!', 'error'); }
  };

  window.acceptAndRefresh = async function (id) { await acceptRequest(id); loadPendingRequests(); loadFriendList(); };
  window.rejectAndRefresh = async function (id) { await rejectRequest(id); loadPendingRequests(); };

  window.removeFriend = async function (event, friendId) {
    if (event) event.stopPropagation();
    if (confirm('Arkadaşlıktan çıkar?')) {
      try {
        const { data: { user } } = await getSB().auth.getUser();
        await getSB().from('friendships').delete().match({ requester_id: user.id, addressee_id: friendId });
        await getSB().from('friendships').delete().match({ requester_id: friendId, addressee_id: user.id });
        loadFriendList();
      } catch (e) { }
    }
  };

  // ═══ MODALLAR VE MESAJLAŞMA ═══
  window.toggleFriendsModal = function () {
    const modal = document.getElementById('friendsModal');
    if (!modal) return;
    const isOpen = modal.style.display === 'flex' || modal.style.display === 'block';
    modal.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) { loadPendingRequests(); loadFriendList(); if (typeof window.toggleSidebar === 'function') window.toggleSidebar(false); }
  };

  function lockChatLayout() {
    const modal = document.getElementById('messagesModal');
    const shell = modal?.firstElementChild;
    const area = document.getElementById('chatArea');
    const header = document.getElementById('messageHeader');
    const list = document.getElementById('messageList');
    if (!modal) return;

    const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.width = '100vw';
    modal.style.height = h + 'px';
    modal.style.maxHeight = h + 'px';
    modal.style.overflow = 'hidden';
    modal.style.background = '#0e1621';

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    if (shell) {
      shell.style.height = '100%';
      shell.style.maxHeight = '100%';
      shell.style.overflow = 'hidden';
    }

    if (area) {
      area.style.display = area.style.display === 'none' ? 'none' : 'flex';
      area.style.height = '100%';
      area.style.maxHeight = '100%';
      area.style.overflow = 'hidden';
      area.style.flexDirection = 'column';
      area.style.position = 'relative';
    }
    if (header) {
      header.style.flexShrink = '0';
      header.style.position = 'sticky';
      header.style.top = '0';
      header.style.left = '0';
      header.style.right = '0';
      header.style.zIndex = '50';
      header.style.background = '#17212b';
    }
    if (list) {
      list.style.flex = '1 1 auto';
      list.style.minHeight = '0';
      list.style.overflowY = 'auto';
      list.style.overscrollBehavior = 'contain';
      list.style.webkitOverflowScrolling = 'touch';
    }
  }

  function openMessagesModal() {
    const modal = document.getElementById('messagesModal');
    if (!modal) return;
    modal.style.display = 'flex';
    lockChatLayout();
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
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      currentFriendId = null;
    }
    else { openMessagesModal(); }
  };

  window.openConversationFromFriends = function (friendId, friendName) {
    const friendsModal = document.getElementById('friendsModal');
    if (friendsModal) friendsModal.style.display = 'none';
    openMessagesModal();
    setTimeout(() => { window.openConversation(friendId, friendName); }, 50);
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
        const { data: msgs } = await getSB().from('messages').select('id, sender_id, receiver_id, deleted_for_sender, deleted_for_receiver').or(`and(sender_id.eq.${user.id},receiver_id.eq.${f.friendId},deleted_for_sender.eq.false),and(sender_id.eq.${f.friendId},receiver_id.eq.${user.id},deleted_for_receiver.eq.false)`).limit(1);
        if (!msgs || msgs.length === 0) continue;
        const { data: prof } = await getSB().from('profiles').select('last_seen, avatar_url').eq('id', f.friendId).maybeSingle();
        let statusText = 'çevrimdışı';
        let statusColor = '#6c7883';
        if (prof?.last_seen) {
          const lastSeenDate = new Date(prof.last_seen);
          const diffInSec = Math.floor((new Date() - lastSeenDate) / 1000);
          if (diffInSec < 60 && diffInSec >= -5) { statusText = 'çevrimiçi'; statusColor = '#6ab2f2'; }
          else { statusText = lastSeenDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); }
        }
        const avatarContent = prof?.avatar_url ? `<img src="${prof.avatar_url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : (f.friendName || '?')[0].toUpperCase();
        listItems.push(`
          <div class="conversation-row" data-friend-id="${f.friendId}" style="display:flex; align-items:center; gap:12px; padding:12px 16px; cursor:pointer; border-bottom:1px solid #17212b; position:relative; overflow:hidden;" onclick="FriendsChatModule.openConversation('${f.friendId}','${f.friendName}')">
            <button class="swipe-delete-btn" type="button" style="position:absolute; right:6px; top:50%; transform:translateY(-50%); width:40px; height:40px; border-radius:50%; background:#ef5350; border:none; color:#fff; display:flex; align-items:center; justify-content:center; opacity:0; pointer-events:none; transition:opacity 0.15s ease; z-index:5;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
            <div class="conv-content-wrapper" style="display:flex; align-items:center; gap:12px; flex:1; transition: transform 0.2s ease; z-index:2;">
              <div style="width:52px;height:52px;border-radius:50%;background:#2b5278;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:#fff;flex-shrink:0;overflow:hidden;">${avatarContent}</div>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <div style="font-weight:700; font-size:15px; color:#fff;">${f.friendName}</div>
                  <div style="font-size:11px; color:${statusColor};">${statusText}</div>
                </div>
                <div style="font-size:13px; color:#6c7883;">Sohbeti aç...</div>
              </div>
            </div>
          </div>`);
      }
      el.innerHTML = listItems.join('');
      attachSwipeHandlers(el);
    } catch (e) { el.innerHTML = '<p style="text-align:center; padding:20px; color:red;">Hata.</p>'; }
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
    lockChatLayout();
    if (avatar) avatar.innerHTML = (friendName || '?')[0].toUpperCase();
    if (nameEl) nameEl.textContent = friendName;
    if (statusEl) { statusEl.textContent = 'yükleniyor...'; statusEl.style.color = '#6c7883'; }
    try {
      const { data: prof } = await getSB().from('profiles').select('display_name, username, last_seen, avatar_url').eq('id', friendId).maybeSingle();
      if (prof) {
        const fullName = prof.display_name || prof.username || friendName;
        if (nameEl) nameEl.textContent = fullName;
        if (avatar) avatar.innerHTML = prof.avatar_url ? `<img src="${prof.avatar_url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : fullName[0].toUpperCase();
        if (statusEl && prof.last_seen) {
          const diffInSec = Math.floor((new Date() - new Date(prof.last_seen)) / 1000);
          if (diffInSec < 60 && diffInSec >= -5) { statusEl.textContent = 'çevrimiçi'; statusEl.style.color = '#6ab2f2'; }
          else { statusEl.textContent = 'son görülme ' + new Date(prof.last_seen).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); }
        }
      }
    } catch (e) { }
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
      if (!visible.length) { list.innerHTML = '<p style="text-align:center; padding:40px 20px; color:var(--text-secondary);">Henüz mesaj yok.</p>'; return; }
      let currentDateStr = null;
      list.innerHTML = visible.map(msg => {
        const isMine = msg.sender_id === user.id;
        const msgDate = new Date(msg.created_at);
        const time = msgDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        let dateSeparatorHtml = '';
        const dateStr = msgDate.toLocaleDateString('tr-TR');
        if (dateStr !== currentDateStr) { currentDateStr = dateStr; dateSeparatorHtml = `<div style="display:flex; justify-content:center; margin:16px 0 8px 0;"><span style="background:rgba(255,255,255,0.06); color:#9ca3af; font-size:11px; padding:4px 12px; border-radius:12px;">${dateStr}</span></div>`; }
        const bubbleBg = isMine ? '#2b5278' : '#1e2c3a';
        return dateSeparatorHtml + `<div class="message-row" data-msg-id="${msg.id}" data-is-mine="${isMine}" style="position:relative; display:flex; justify-content:${isMine ? 'flex-end' : 'flex-start'}; margin:6px 0; overflow:hidden;">
          <button class="swipe-delete-btn" type="button" style="position:absolute; right:6px; top:50%; transform:translateY(-50%); width:40px; height:40px; border-radius:50%; background:#ef5350; border:none; color:#fff; display:flex; align-items:center; justify-content:center; opacity:0; pointer-events:none; transition:opacity 0.15s ease; z-index:5;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
          <div class="message-bubble" style="max-width:82%; background:${bubbleBg}; color:#fff; padding:8px 12px; border-radius:${isMine ? '12px 12px 0 12px' : '0 12px 12px 12px'}; position:relative; transition: transform 0.2s ease; z-index:2;">
            <div style="font-size:15px; line-height:1.4;">${msg.content}</div>
            <div style="font-size:10px; color:rgba(255,255,255,0.4); margin-top:4px; text-align:right;">${time}</div>
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
      if (!bubble || !btn) return;
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
        try { row.setPointerCapture(e.pointerId); } catch (err) { }
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
        btn.style.opacity = String(Math.min(1, Math.abs(currentTranslate) / 60));
        if (e.cancelable) e.preventDefault();
      };
      const onUp = (e) => {
        clearTimeout(pressTimer); row.style.touchAction = 'pan-y';
        if (!dragging) return; dragging = false;
        bubble.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
        if (isHorizontal && Math.abs(currentTranslate) > 50) {
          bubble.style.transform = 'translateX(-80px)';
          btn.style.opacity = '1'; btn.style.pointerEvents = 'auto';
          activeSwipeRow = row;
        } else {
          bubble.style.transform = 'translateX(0)';
          btn.style.opacity = '0'; btn.style.pointerEvents = 'none';
          if (activeSwipeRow === row) activeSwipeRow = null;
        }
        try { row.releasePointerCapture(e.pointerId); } catch (err) { }
      };
      row.addEventListener('pointerdown', onDown);
      row.addEventListener('pointermove', onMove);
      row.addEventListener('pointerup', onUp);
      row.addEventListener('pointercancel', onUp);
      btn.onclick = (ev) => {
        ev.stopPropagation(); ev.preventDefault();
        if (isMsg) {
          selectedMessageId = msgId;
          selectedMessageIsMine = isMine;
          window.deleteMessage('me');
        }
        else { currentConversationFriendId = friendId; window.deleteConversation(); }
        resetAllSwipes(null);
      };
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
    if (msgMenu && msgMenu.style.display === 'block' && !msgMenu.contains(e.target)) { msgMenu.style.display = 'none'; selectedMessageId = null; }
    const convMenu = document.getElementById('conversationActionMenu');
    if (convMenu && convMenu.style.display === 'block' && !convMenu.contains(e.target)) { convMenu.style.display = 'none'; currentConversationFriendId = null; }
    if (activeSwipeRow && !activeSwipeRow.contains(e.target)) resetAllSwipes(null);
  });

  window.closeMessageMenu = () => { const m = document.getElementById('messageActionMenu'); if (m) m.style.display = 'none'; selectedMessageId = null; };

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
      setTimeout(() => {
        loadMessages();
        loadConversations();
      }, 50);
    } catch (e) { }
  };

  function showConversationMenu(x, y, friendId) {
    const menu = document.getElementById('conversationActionMenu');
    if (!menu) return;
    currentConversationFriendId = friendId;
    menu.style.display = 'block';
    if (x + 180 > window.innerWidth) x -= 180;
    menu.style.left = x + 'px'; menu.style.top = y + 'px';
  }

  window.closeConversationMenu = () => { const m = document.getElementById('conversationActionMenu'); if (m) m.style.display = 'none'; currentConversationFriendId = null; };

  window.deleteConversation = async function () {
    if (!currentConversationFriendId) return;
    const friendId = currentConversationFriendId;
    window.closeConversationMenu();
    const { data: { user } } = await getSB().auth.getUser();
    if (confirm("Sohbeti gizlemek istediğinize emin misiniz?")) {
      await getSB().from('messages').update({ deleted_for_sender: true }).match({ sender_id: user.id, receiver_id: friendId });
      await getSB().from('messages').update({ deleted_for_receiver: true }).match({ sender_id: friendId, receiver_id: user.id });
      setTimeout(() => {
        if (currentFriendId === friendId) window.showConversationsList();
        loadConversations();
      }, 50);
    }
  };

  window.sendMessageFromUi = async function () {
    if (isSendingMsg) return;
    const input = document.getElementById('messageInput');
    const text = input?.value?.trim();
    if (!text || !currentFriendId) return;
    input.value = '';
    input.focus({ preventScroll: true });
    isSendingMsg = true;
    try { await sendMessage(currentFriendId, text); await loadMessages(); }
    catch (e) { input.value = text; }
    finally {
      isSendingMsg = false;
      input.focus({ preventScroll: true });
      setTimeout(() => input.focus({ preventScroll: true }), 30);
      setTimeout(() => input.focus({ preventScroll: true }), 120);
    }
  };

  async function init() {
    const inp = document.getElementById('messageInput');
    if (inp) {
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.sendMessageFromUi(); } });
    }

    // Mobilde gönder butonu focus alınca klavye kapanmasın.
    document.querySelectorAll('button[onclick*="sendMessageFromUi"]').forEach(btn => {
      btn.addEventListener('mousedown', e => e.preventDefault());
      btn.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
      btn.addEventListener('click', e => {
        e.preventDefault();
        window.sendMessageFromUi();
      });
    });

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        const modal = document.getElementById('messagesModal');
        if (modal && modal.style.display === 'flex') lockChatLayout();
      });
    }

    const { data: { user } } = await getSB().auth.getUser();
    if (user && !chatSubscription) {
      const handleMessageRealtime = (payload) => {
        const row = payload.new || payload.old;
        if (!row) return;

        // DELETE eventinde Supabase bazen sadece primary key döndürür.
        // Bu durumda sender/receiver kontrolü yapılamaz; açık sohbeti doğrudan yenile.
        if (payload.eventType === 'DELETE') {
          if (currentFriendId) loadMessages();
          loadConversations();
          return;
        }

        const belongsToCurrentChat = currentFriendId && (
          (row.sender_id === user.id && row.receiver_id === currentFriendId) ||
          (row.sender_id === currentFriendId && row.receiver_id === user.id)
        );

        // Silme/güncelleme/gönderme olayları açık sohbet veya konuşma listesini anlık yenilesin.
        if (belongsToCurrentChat) {
          loadMessages();
          loadConversations();
        } else if (row.receiver_id === user.id) {
          loadConversations();
          if (window.showToast && payload.eventType === 'INSERT') window.showToast('Yeni bir mesajın var!', 'success');
        }
      };

      chatSubscription = getSB()
        .channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, handleMessageRealtime)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, handleMessageRealtime)
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, handleMessageRealtime)
        .subscribe();
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
    deleteConversation: window.deleteConversation,
    removeFriend: window.removeFriend
  };
})();