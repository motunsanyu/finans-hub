// js/friends-chat.js — Dalgalanmasız, incremental mesaj güncelleme (Telegram benzeri)

const FriendsChatModule = (() => {
  let currentFriendId = null;
  let currentFriendName = null;
  let chatSubscription = null;
  let currentConversationFriendId = null;
  let isSendingMsg = false;
  let activeSwipeRow = null;
  let selectedMessageId = null;
  let selectedMessageIsMine = false;
  let unreadCount = 0;
  let messagesCache = []; // Yerel mesaj önbelleği (DOM ile senkronize)

  function getSB() { return window._supabaseClient; }

  // ═══ ARKADAŞLIK MANTIĞI (değişmedi) ═══
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

  // ═══ ARKADAŞLAR UI (değişmedi) ═══
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
    try {
      await sendFriendRequest(id);
      if (window.showToast) window.showToast('İstek gönderildi!', 'success');
      const input = document.getElementById('friendSearchInput');
      const resultDiv = document.getElementById('searchResult');
      if (input) input.value = '';
      if (resultDiv) resultDiv.innerHTML = '';
    } catch (e) { if (window.showToast) window.showToast('Hata!', 'error'); }
  };

  window.acceptAndRefresh = async function (id) { await acceptRequest(id); loadPendingRequests(); loadFriendList(); };
  window.rejectAndRefresh = async function (id) { await rejectRequest(id); loadPendingRequests(); };

  window.removeFriend = async function (event, friendId) {
    if (event) event.stopPropagation();
    window.showCustomConfirm('Arkadaşlıktan çıkarmak istediğinize emin misiniz?', async () => {
      try {
        const { data: { user } } = await getSB().auth.getUser();
        await getSB().from('friendships').delete().match({ requester_id: user.id, addressee_id: friendId });
        await getSB().from('friendships').delete().match({ requester_id: friendId, addressee_id: user.id });
        loadFriendList();
        if (window.toggleMessagesModal && document.getElementById('messagesModal')?.style.display === 'flex') {
          loadConversations();
        }
        if (window.showToast) window.showToast('Arkadaşlıktan çıkarıldı.', 'success');
      } catch (e) { if (window.showToast) window.showToast('Bir hata oluştu.', 'error'); }
    });
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
    if (!modal) return;
    const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    modal.style.height = h + 'px';
    modal.style.maxHeight = h + 'px';
    modal.style.overflow = 'hidden';
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
    resetUnreadCount();
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
        const { data: msgs } = await getSB().from('messages').select('id, sender_id, receiver_id, created_at, content, deleted_for_sender, deleted_for_receiver').or(`and(sender_id.eq.${user.id},receiver_id.eq.${f.friendId},deleted_for_sender.eq.false),and(sender_id.eq.${f.friendId},receiver_id.eq.${user.id},deleted_for_receiver.eq.false)`).order('created_at', { ascending: false }).limit(1);
        if (!msgs || msgs.length === 0) continue;
        const lastMsg = msgs[0];
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
                <div style="font-size:13px; color:#6c7883; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(lastMsg.content)}</div>
              </div>
            </div>
          </div>`);
      }
      el.innerHTML = listItems.join('');
      attachSwipeHandlers(el);
    } catch (e) { el.innerHTML = '<p style="text-align:center; padding:20px; color:red;">Hata.</p>'; }
  }

  // ========== INCREMENTAL MESAJ YÖNETİMİ (DALGALANMA YOK) ==========
  function appendMessageToDOM(msg, isMine, scrollToBottom = true) {
    const list = document.getElementById('messageList');
    if (!list) return;
    const msgDate = new Date(msg.created_at);
    const time = msgDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = msgDate.toLocaleDateString('tr-TR');
    const bubbleBg = isMine ? '#2b5278' : '#1e2c3a';

    // Tarih ayracı kontrolü (son mesajın tarihi farklıysa ekle)
    const lastMsgDiv = list.lastElementChild;
    let lastDateStr = null;
    if (lastMsgDiv && lastMsgDiv.classList && lastMsgDiv.classList.contains('message-row')) {
      // Önceki tarih ayracını bul
      const prevDateDiv = lastMsgDiv.previousElementSibling;
      if (prevDateDiv && prevDateDiv.innerHTML?.includes('justify-content:center')) {
        lastDateStr = prevDateDiv.innerText?.trim();
      } else {
        // Ayraç yoksa mesajın kendi tarihini almak zor
      }
    }

    let dateSeparatorHtml = '';
    if (lastDateStr !== dateStr) {
      dateSeparatorHtml = `<div style="display:flex; justify-content:center; margin:16px 0 8px 0;"><span style="background:rgba(255,255,255,0.06); color:#9ca3af; font-size:11px; padding:4px 12px; border-radius:12px;">${dateStr}</span></div>`;
    }

    const messageHtml = dateSeparatorHtml + `<div class="message-row" data-msg-id="${msg.id}" data-is-mine="${isMine}" style="position:relative; display:flex; justify-content:${isMine ? 'flex-end' : 'flex-start'}; margin:6px 0; overflow:hidden;">
      <button class="swipe-delete-btn" type="button" style="position:absolute; right:6px; top:50%; transform:translateY(-50%); width:40px; height:40px; border-radius:50%; background:#ef5350; border:none; color:#fff; display:flex; align-items:center; justify-content:center; opacity:0; pointer-events:none; transition:opacity 0.15s ease; z-index:5;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>
      <div class="message-bubble" style="max-width:82%; background:${bubbleBg}; color:#fff; padding:8px 12px; border-radius:${isMine ? '12px 12px 0 12px' : '0 12px 12px 12px'}; position:relative; transition: transform 0.2s ease; z-index:2;">
        <div style="font-size:15px; line-height:1.4;">${escapeHtml(msg.content)}</div>
        <div style="font-size:10px; color:rgba(255,255,255,0.4); margin-top:4px; text-align:right;">${time}</div>
      </div>
    </div>`;

    list.insertAdjacentHTML('beforeend', messageHtml);
    // Yeni eklenen satıra swipe handler ekle
    const newRow = list.lastElementChild;
    if (newRow && newRow.classList.contains('message-row')) {
      attachSwipeHandlersForSingleRow(newRow);
    }
    if (scrollToBottom) {
      setTimeout(() => { list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' }); }, 50);
    }
  }

  function removeMessageFromDOM(msgId) {
    const msgRow = document.querySelector(`.message-row[data-msg-id="${msgId}"]`);
    if (msgRow) {
      // Tarih ayracını da kontrol et: eğer bu mesajdan önce tarih ayracı varsa ve sonraki mesaj yoksa veya farklı tarihse ayracı da sil
      const prevSibling = msgRow.previousElementSibling;
      if (prevSibling && prevSibling.innerHTML?.includes('justify-content:center') &&
        (!msgRow.nextElementSibling || msgRow.nextElementSibling.classList?.contains('message-row'))) {
        prevSibling.remove();
      }
      msgRow.remove();
    }
  }

  function attachSwipeHandlersForSingleRow(row) {
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
        window.showCustomConfirm('Bu mesajı silmek istediğinize emin misiniz?', () => {
          selectedMessageId = msgId;
          window.deleteMessage('me');
        });
      } else {
        window.showCustomConfirm('Bu sohbeti silmek istediğinize emin misiniz? (Bu işlem yalnızca sizin için gizler)', () => {
          currentConversationFriendId = friendId;
          window.deleteConversation();
        });
      }
      resetAllSwipes(null);
    };
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

  // ========== MESAJLARI İLK YÜKLEME (SADECE BURDA TAM YENİLEME) ==========
  async function loadMessages() {
    const list = document.getElementById('messageList');
    if (!list || !currentFriendId) return;
    list.innerHTML = '<p style="text-align:center; padding:20px; color:var(--text-secondary);">Yükleniyor...</p>';
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
      let html = '';
      for (const msg of visible) {
        const isMine = msg.sender_id === user.id;
        const msgDate = new Date(msg.created_at);
        const time = msgDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        const dateStr = msgDate.toLocaleDateString('tr-TR');
        if (dateStr !== currentDateStr) {
          currentDateStr = dateStr;
          html += `<div style="display:flex; justify-content:center; margin:16px 0 8px 0;"><span style="background:rgba(255,255,255,0.06); color:#9ca3af; font-size:11px; padding:4px 12px; border-radius:12px;">${dateStr}</span></div>`;
        }
        const bubbleBg = isMine ? '#2b5278' : '#1e2c3a';
        html += `<div class="message-row" data-msg-id="${msg.id}" data-is-mine="${isMine}" style="position:relative; display:flex; justify-content:${isMine ? 'flex-end' : 'flex-start'}; margin:6px 0; overflow:hidden;">
          <button class="swipe-delete-btn" type="button" style="position:absolute; right:6px; top:50%; transform:translateY(-50%); width:40px; height:40px; border-radius:50%; background:#ef5350; border:none; color:#fff; display:flex; align-items:center; justify-content:center; opacity:0; pointer-events:none; transition:opacity 0.15s ease; z-index:5;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
          <div class="message-bubble" style="max-width:82%; background:${bubbleBg}; color:#fff; padding:8px 12px; border-radius:${isMine ? '12px 12px 0 12px' : '0 12px 12px 12px'}; position:relative; transition: transform 0.2s ease; z-index:2;">
            <div style="font-size:15px; line-height:1.4;">${escapeHtml(msg.content)}</div>
            <div style="font-size:10px; color:rgba(255,255,255,0.4); margin-top:4px; text-align:right;">${time}</div>
          </div>
        </div>`;
      }
      list.innerHTML = html;
      // Tüm satırlara swipe handler ekle
      document.querySelectorAll('#messageList .message-row').forEach(row => attachSwipeHandlersForSingleRow(row));
      setTimeout(() => { list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' }); }, 50);
    } catch (e) { list.innerHTML = '<p style="text-align:center; padding:20px; color:red;">Hata.</p>'; }
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
        if (avatar) avatar.innerHTML = prof.avatar_url ? `<img src="${prof.avatar_url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : fullName[0].toUpperCase();
        if (statusEl && prof.last_seen) {
          const diffInSec = Math.floor((new Date() - new Date(prof.last_seen)) / 1000);
          if (diffInSec < 60 && diffInSec >= -5) { statusEl.textContent = 'çevrimiçi'; statusEl.style.color = '#6ab2f2'; }
          else { statusEl.textContent = 'son görülme ' + new Date(prof.last_seen).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); }
        }
      }
    } catch (e) { }
    await loadMessages();  // sadece ilk yükleme
    resetUnreadCount();
  };

  window.showConversationsList = function () {
    const panel = document.getElementById('conversationsPanel');
    const area = document.getElementById('chatArea');
    if (panel) { panel.style.display = 'flex'; panel.style.width = '100%'; }
    if (area) area.style.display = 'none';
    currentFriendId = null;
    loadConversations();
    resetUnreadCount();
  };

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
    const { data: { user } } = await getSB().auth.getUser();
    try {
      const { data: msg } = await getSB().from('messages').select('sender_id').eq('id', id).single();
      if (scope === 'me') {
        const field = msg.sender_id === user.id ? 'deleted_for_sender' : 'deleted_for_receiver';
        await getSB().from('messages').update({ [field]: true }).eq('id', id);
        // DOM'dan kaldır
        removeMessageFromDOM(id);
      } else if (scope === 'everyone' && msg.sender_id === user.id) {
        await getSB().from('messages').delete().eq('id', id);
        removeMessageFromDOM(id);
      }
      // Arka planda senkronizasyon için sessizce yeniden yüklemeye gerek yok, optimistic yeterli.
    } catch (e) { console.error('Silme hatası:', e); if (window.showToast) window.showToast('Silme işlemi başarısız oldu.', 'error'); }
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
    await getSB().from('messages').update({ deleted_for_sender: true }).match({ sender_id: user.id, receiver_id: friendId });
    await getSB().from('messages').update({ deleted_for_receiver: true }).match({ sender_id: friendId, receiver_id: user.id });
    loadConversations();
    if (currentFriendId === friendId) {
      window.showConversationsList();
    }
    if (window.showToast) window.showToast('Sohbet silindi.', 'success');
  };

  window.sendMessageFromUi = async function () {
    if (isSendingMsg) return;
    const input = document.getElementById('messageInput');
    const text = input?.value?.trim();
    if (!text || !currentFriendId) return;
    input.value = ''; isSendingMsg = true;
    input.focus();
    try {
      const { data: { user } } = await getSB().auth.getUser();
      const newMsg = {
        sender_id: user.id,
        receiver_id: currentFriendId,
        content: text,
        created_at: new Date().toISOString(),
        deleted_for_sender: false,
        deleted_for_receiver: false
      };
      const { data, error } = await getSB().from('messages').insert(newMsg).select().single();
      if (error) throw error;
      // DOM'a ekle
      appendMessageToDOM(data, true, true); // isMine=true, scroll yap
    } catch (e) {
      input.value = text;
      if (window.showToast) window.showToast('Mesaj gönderilemedi.', 'error');
    } finally {
      isSendingMsg = false;
      setTimeout(() => input.focus(), 50);
    }
  };

  // ═══ BİLDİRİM VE BADGE ═══
  function updateBadgeUI() {
    const badge = document.getElementById('messagesBadge');
    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  function resetUnreadCount() {
    if (unreadCount === 0) return;
    unreadCount = 0;
    updateBadgeUI();
  }

  function incrementUnreadCount() {
    unreadCount++;
    updateBadgeUI();
  }

  async function sendMessage(receiverId, content) {
    const { data: { user } } = await getSB().auth.getUser();
    if (!user) throw new Error('Oturum yok');
    const { error } = await getSB().from('messages').insert({
      sender_id: user.id,
      receiver_id: receiverId,
      content: content,
      created_at: new Date().toISOString(),
      deleted_for_sender: false,
      deleted_for_receiver: false
    });
    if (error) throw error;
  }

  async function getMessageHistory(friendId) {
    const { data: { user } } = await getSB().auth.getUser();
    if (!user) return [];
    const { data, error } = await getSB()
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });
    if (error) return [];
    return data;
  }

  async function acceptRequest(requestId) {
    await getSB().from('friendships').update({ status: 'accepted' }).eq('id', requestId);
  }

  async function rejectRequest(requestId) {
    await getSB().from('friendships').delete().eq('id', requestId);
  }

  // ═══ REALTIME (SADECE YENİ MESAJLARI DOM'A EKLE, TAM YENİLEME YAPMA) ═══
  async function setupRealtimeSubscription() {
    if (chatSubscription) {
      try { await getSB().removeChannel(chatSubscription); } catch (e) { }
    }
    const { data: { user } } = await getSB().auth.getUser();
    if (!user) return;
    chatSubscription = getSB()
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const newMsg = payload.new;
        if (newMsg.sender_id === user.id) return; // kendi mesajımız zaten gönderildi, eklemeyi tekrar yapma

        if (currentFriendId && (newMsg.sender_id === currentFriendId || newMsg.receiver_id === currentFriendId)) {
          // Karşı taraftan gelen mesaj, sohbet açık -> DOM'a ekle
          appendMessageToDOM(newMsg, false, true);
        } else {
          // Farklı bir arkadaştan mesaj -> badge artır
          incrementUnreadCount();
          try {
            const { data: prof } = await getSB().from('profiles').select('display_name, username').eq('id', newMsg.sender_id).single();
            const senderName = prof?.display_name || prof?.username || 'Bir arkadaşınız';
            if (window.showToast) {
              window.showToast(`${senderName} size yeni bir mesaj gönderdi`, 'info');
            }
          } catch (e) { }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, async (payload) => {
        // Silme işaretlemeleri veya güncellemeler için - sadece açık sohbetse ve mesaj silinmişse DOM'dan kaldır
        if (currentFriendId && (payload.new.sender_id === currentFriendId || payload.new.receiver_id === currentFriendId)) {
          const { data: { user: currentUser } } = await getSB().auth.getUser();
          const msg = payload.new;
          const isDeletedForMe = (msg.sender_id === currentUser.id && msg.deleted_for_sender) ||
            (msg.receiver_id === currentUser.id && msg.deleted_for_receiver);
          if (isDeletedForMe) {
            removeMessageFromDOM(msg.id);
          }
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, async (payload) => {
        if (currentFriendId) {
          removeMessageFromDOM(payload.old.id);
        }
      })
      .subscribe();
  }

  async function init() {
    const inp = document.getElementById('messageInput');
    if (inp) {
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.sendMessageFromUi(); } });
    }
    await setupRealtimeSubscription();
    unreadCount = 0;
    updateBadgeUI();
  }

  return {
    init,
    openConversation: window.openConversation,
    openConversationFromFriends: window.openConversationFromFriends,
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