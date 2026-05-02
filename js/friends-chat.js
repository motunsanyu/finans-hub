// js/friends-chat.js — Düzeltilmiş Sürüm

const FriendsChatModule = (() => {
  let currentFriendId = null;
  let currentFriendName = null;
  let chatSubscription = null;
  let currentConversationFriendId = null; // sohbet silmek için seçili arkadaş
  let isSendingMsg = false; // mesaj gönderim kilidi

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
    const isOpen = modal.style.display === 'block';
    modal.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
      loadPendingRequests();
      loadFriendList();
      // Sidebar'ı kapat
      if (typeof toggleSidebar === 'function') toggleSidebar(false);
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
      if(window.showToast) window.showToast('Arkadaşlık isteği gönderildi!', 'success');
      else alert('Arkadaşlık isteği gönderildi!');
      const inp = document.getElementById('friendSearchInput');
      const res = document.getElementById('searchResult');
      if (inp) inp.value = '';
      if (res) res.innerHTML = '';
    } catch (e) { 
      if(window.showToast) window.showToast('Hata: ' + e.message, 'error');
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
        
        // Supabase'in karmaşık OR/AND mantığı bazen RLS veya sözdizimi nedeniyle takılabiliyor.
        // Hata payını SIFIRA indirmek için ihtimalleri ayrı ayrı siliyoruz:
        
        // İhtimal 1: Ben istek yollamışsam
        await getSB().from('friendships')
          .delete()
          .match({ requester_id: user.id, addressee_id: friendId });

        // İhtimal 2: O bana istek yollamışsa
        await getSB().from('friendships')
          .delete()
          .match({ requester_id: friendId, addressee_id: user.id });
        
        if(window.showToast) window.showToast('Kişi arkadaşlıktan çıkarıldı.', 'success');
        
        // Modalın içini temizleyip baştan yükleyelim (Önbelleği aşmak için)
        const el = document.getElementById('friendList');
        if (el) el.innerHTML = '<div style="text-align:center; padding:30px; color:#708499; font-style:italic;">Güncelleniyor...</div>';
        
        // Yenileme
        setTimeout(() => loadFriendList(), 300);
      } catch (e) {
        if(window.showToast) window.showToast('Hata: ' + e.message, 'error');
        console.error(e);
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
            statusText = new Date(prof.last_seen).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'});
          }
        }

        const name = prof.display_name || prof.username || f.friendName;
        const avatarContent = prof.avatar_url 
          ? `<img src="${prof.avatar_url}" style="width:100%; height:100%; object-fit:cover;">` 
          : name[0].toUpperCase();

        listItems.push(`
          <div style="display:flex; align-items:center; margin: 0 12px 8px;">
            <!-- Sohbet Açma Alanı (Kartın kendisi) -->
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
            
            <!-- Silme İkonu (Kartın Dışında, Bağımsız) -->
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

  // Arkadaşlar modalından mesaj modalına geç
  window.openConversationFromFriends = function (friendId, friendName) {
    // Önce arkadaşlar modalını kapat
    const friendsModal = document.getElementById('friendsModal');
    if (friendsModal) friendsModal.style.display = 'none';
    // Mesajlar modalını aç ve doğrudan sohbete git
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
    
    // Mobil Klavye Düzeltmesi: Ekranın itilmesini önlemek için yüksekliği sabitle
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
    if (typeof toggleSidebar === 'function') toggleSidebar(false);
  }

  window.toggleMessagesModal = function () {
    const modal = document.getElementById('messagesModal');
    if (!modal) return;
    if (modal.style.display === 'flex') {
      modal.style.display = 'none';
      document.body.style.overflow = ''; // Arka plan kaydırmasını geri aç
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
        // PRO MANTIK DÜZELTİLDİ: Sadece SİLİNMEMİŞ mesajı olanları bul
        // Hem gönderen hem alan tarafındaki silinme durumlarını kontrol ediyoruz
        const { data: msgs } = await getSB()
          .from('messages')
          .select('id, sender_id, receiver_id, deleted_for_sender, deleted_for_receiver')
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${f.friendId},deleted_for_sender.eq.false),and(sender_id.eq.${f.friendId},receiver_id.eq.${user.id},deleted_for_receiver.eq.false)`)
          .limit(1);

        if (!msgs || msgs.length === 0) continue; // Görünür mesaj yoksa listede gösterme

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
            statusText = lastSeenDate.toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'});
          }
        }

        const avatarContent = prof?.avatar_url 
          ? `<img src="${prof.avatar_url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`
          : (f.friendName || '?')[0].toUpperCase();

        listItems.push(`
          <div class="conversation-row" 
            style="display:flex; align-items:center; gap:12px; padding:12px 16px; cursor:pointer; transition: all 0.15s ease; border-bottom:1px solid #17212b; user-select:none; -webkit-touch-callout:none; touch-action: pan-y;"
            onmouseover="this.style.background='#17212b'" onmouseout="this.style.background='transparent'"
            data-friend-id="${f.friendId}"
            onclick="FriendsChatModule.openConversation('${f.friendId}','${f.friendName}')"
            ontouchstart="FriendsChatModule.handleConvTouchStart(event, '${f.friendId}')"
            ontouchmove="FriendsChatModule.handleTouchMove(event)"
            ontouchend="FriendsChatModule.handleConvTouchEnd(event, '${f.friendId}')"
          >
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
          </div>`);
      }
      el.innerHTML = listItems.join('');
    } catch (e) {
      el.innerHTML = '<p style="text-align:center; padding:20px; color:red;">Yükleme hatası.</p>';
      console.error(e);
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

    if (panel) { panel.style.display = 'none'; }
    if (area) { area.style.display = 'flex'; }

    // Avatar ve ismi geçici olarak ayarla
    if (avatar) { avatar.innerHTML = (friendName || '?')[0].toUpperCase(); }
    if (nameEl) { nameEl.textContent = friendName; }
    if (statusEl) { statusEl.textContent = 'yükleniyor...'; statusEl.style.color = '#6c7883'; }

    // Profil verilerini çekip canlı durumu ve resmi güncelle (60sn kuralı)
    try {
      const { data: prof, error } = await getSB().from('profiles').select('display_name, username, last_seen, avatar_url').eq('id', friendId).maybeSingle();
      
      if (prof) {
        const fullName = prof.display_name || prof.username || friendName;
        if (nameEl) nameEl.textContent = fullName;
        if (avatar) {
          avatar.innerHTML = prof.avatar_url 
            ? `<img src="${prof.avatar_url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` 
            : fullName[0].toUpperCase();
        }

        if (statusEl) {
          if (prof.last_seen) {
            const diffInSec = Math.floor((new Date() - new Date(prof.last_seen)) / 1000);
            if (diffInSec < 60 && diffInSec >= -5) {
              statusEl.textContent = 'çevrimiçi';
              statusEl.style.color = '#6ab2f2';
            } else {
              statusEl.textContent = 'son görülme ' + new Date(prof.last_seen).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'});
              statusEl.style.color = '#6c7883';
            }
          } else {
            statusEl.textContent = 'çevrimdışı';
            statusEl.style.color = '#6c7883';
          }
        }
      } else {
        if (statusEl) { statusEl.textContent = 'çevrimdışı'; statusEl.style.color = '#6c7883'; }
      }
    } catch (e) {
      console.error('Header profile fetch error:', e);
      if (statusEl) { statusEl.textContent = 'çevrimdışı'; statusEl.style.color = '#6c7883'; }
    }

    await loadMessages();

    setTimeout(() => {
      const inp = document.getElementById('messageInput');
      if (inp) inp.focus();
    }, 100);
  };

  window.showConversationsList = function () {
    const panel = document.getElementById('conversationsPanel');
    const area = document.getElementById('chatArea');
    const nameEl = document.getElementById('chatHeaderName');

    if (panel) { panel.style.display = 'flex'; panel.style.width = '100%'; }
    if (area) area.style.display = 'none';
    if (nameEl) nameEl.textContent = 'Bir konuşma seçin';

    currentFriendId = null;
    loadConversations();
  };

  let selectedMessageId = null;
  let selectedMessageIsMine = false;

  async function loadMessages() {
    const list = document.getElementById('messageList');
    if (!list || !currentFriendId) return;

    // Sadece ilk açılışta (liste boşken) yükleniyor yazsın. 
    // Böylece mesaj geldiğinde/gittiğinde ekran silinip "dalgalanma" yapmaz!
    if (list.innerHTML.trim() === '' || list.children.length === 0) {
      list.innerHTML = '<p style="text-align:center; padding:20px; color:var(--text-secondary);">Yükleniyor...</p>';
    }
    try {
      const messages = await getMessageHistory(currentFriendId);
      const { data: { user } } = await getSB().auth.getUser();

      const visible = messages.filter(msg => {
        if (msg.sender_id === user.id && msg.deleted_for_sender) return false;
        if (msg.receiver_id === user.id && msg.deleted_for_receiver) return false;
        return true;
      });

      if (!visible.length) {
        list.innerHTML = '<p style="text-align:center; padding:40px 20px; color:var(--text-secondary);">Henüz mesaj yok.<br><small>İlk mesajı sen gönder! 👋</small></p>';
        return;
      }

      let currentDateStr = null;

      list.innerHTML = visible.map(msg => {
        const isMine = msg.sender_id === user.id;
        const msgDate = new Date(msg.created_at);
        const time = msgDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        
        // --- TARİH AYRACI MANTIĞI ---
        let dateSeparatorHtml = '';
        const dateStr = msgDate.toLocaleDateString('tr-TR');
        if (dateStr !== currentDateStr) {
           currentDateStr = dateStr;
           const today = new Date().toLocaleDateString('tr-TR');
           const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('tr-TR');
           
           let displayDate = dateStr;
           if (dateStr === today) displayDate = 'Bugün';
           else if (dateStr === yesterday) displayDate = 'Dün';
           else displayDate = msgDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });

           dateSeparatorHtml = `
             <div style="display:flex; justify-content:center; margin:16px 0 8px 0; animation: fadeIn 0.2s ease;">
               <span style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.05); color:#9ca3af; font-size:11px; padding:4px 12px; border-radius:12px; font-weight:600; letter-spacing:0.5px; box-shadow:0 1px 2px rgba(0,0,0,0.2);">
                 ${displayDate}
               </span>
             </div>
           `;
        }
        
        // Telegram Dark Balon Stilleri
        const bubbleBg = isMine ? '#2b5278' : '#182533';
        const textColor = '#fff';
        const borderRadius = isMine ? '12px 12px 0px 12px' : '0px 12px 12px 12px';

        return dateSeparatorHtml + `<div
          data-msg-id="${msg.id}"
          data-is-mine="${isMine}"
          style="display:flex; justify-content:${isMine ? 'flex-end' : 'flex-start'}; margin:6px 0; animation: fadeIn 0.2s ease; user-select:none; -webkit-touch-callout:none; touch-action: pan-y;"
          oncontextmenu="FriendsChatModule.showMessageMenu(event, '${msg.id}', ${isMine}); return false;"
          ontouchstart="FriendsChatModule.handleTouchStart(event, '${msg.id}', ${isMine})"
          ontouchmove="FriendsChatModule.handleTouchMove(event)"
          ontouchend="FriendsChatModule.handleTouchEnd(event, '${msg.id}', ${isMine})"
        >
          <div class="message-bubble" 
            style="max-width:82%; background:${bubbleBg}; color:${textColor}; padding:8px 12px; border-radius:${borderRadius}; position:relative; box-shadow:0 1px 2px rgba(0,0,0,0.2); transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1); cursor:pointer; transform-origin: center;">
            <div style="font-size:15px; line-height:1.45; word-break:break-word;">${msg.content}</div>
            <div style="font-size:10px; color:rgba(255,255,255,0.5); margin-top:4px; text-align:right; font-weight:500;">${time}</div>
          </div>
        </div>`;
      }).join('');

      // Yumuşak ve anında kaydırma (Smooth Scroll)
      setTimeout(() => {
        list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
        
        // Ek: Mesaj listesi yüklendikten sonra input focus'unu koru
        const msgInput = document.getElementById('messageInput');
        if (msgInput && document.activeElement !== msgInput && currentFriendId) {
            msgInput.focus({ preventScroll: true });
        }
      }, 50);
    } catch (e) {
      list.innerHTML = '<p style="text-align:center; padding:20px; color:red;">Mesajlar yüklenemedi.</p>';
      console.error('loadMessages hatası:', e);
    }
  }

  // ═══ MESAJ SİLME ═══
  let touchTimer = null;

  function showMessageMenu(event, msgId, isMine) {
    if (event) {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      if (typeof event.stopPropagation === 'function') event.stopPropagation();
    }
    
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

    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    return false;
  }

  let touchStartX = 0;
  let touchStartY = 0;
  let isSwipeAction = false;

  function handleTouchStart(event, msgId, isMine) {
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
    isSwipeAction = false;

    // Basma efekti (Küçülme)
    const bubble = event.currentTarget.querySelector('.message-bubble');
    if (bubble) bubble.style.transform = 'scale(0.96)';

    touchTimer = setTimeout(() => {
      if (!isSwipeAction) {
        const touch = event.touches[0];
        const fakeEvent = { clientX: touch.clientX, clientY: touch.clientY, stopPropagation: () => {} };
        showMessageMenu(fakeEvent, msgId, isMine);
      }
    }, 600);
  }

  function handleTouchMove(event) {
    const moveX = event.touches[0].clientX;
    const moveY = event.touches[0].clientY;
    const diffX = touchStartX - moveX;
    const diffY = Math.abs(touchStartY - moveY);
    
    // Eğer yatay kaydırma dikeyden fazlaysa ve 20px'den fazlaysa swipe moduna geç
    if (Math.abs(diffX) > 20 && Math.abs(diffX) > diffY) {
      isSwipeAction = true;
      clearTimeout(touchTimer);
      // Sayfanın dikeyde kaymasını engelle ki swipe düzgün çalışsın
      if (event.cancelable) event.preventDefault();
    }
  }

  function handleTouchEnd(event, msgId, isMine) {
    clearTimeout(touchTimer);
    
    // Basma efektini geri al
    const bubble = event.currentTarget.querySelector('.message-bubble');
    if (bubble) bubble.style.transform = 'scale(1)';

    const touchEndX = event.changedTouches[0].clientX;
    const diffX = touchStartX - touchEndX;

    // Sola kaydırma (Swipe Left) gerçekleştiyse menüyü aç
    if (isSwipeAction && diffX > 60) {
      const touch = event.changedTouches[0];
      const fakeEvent = { clientX: touch.clientX, clientY: touch.clientY, stopPropagation: () => {} };
      showMessageMenu(fakeEvent, msgId, isMine);
    }
  }

  // --- MENÜLERİ KAPATMA (Global Click) ---
  document.addEventListener('click', (e) => {
    // Mesaj Menüsü
    const msgMenu = document.getElementById('messageActionMenu');
    if (msgMenu && msgMenu.style.display === 'block' && !msgMenu.contains(e.target)) {
      msgMenu.style.display = 'none';
      selectedMessageId = null;
    }
    // Sohbet Menüsü
    const convMenu = document.getElementById('conversationActionMenu');
    if (convMenu && convMenu.style.display === 'block' && !convMenu.contains(e.target)) {
      convMenu.style.display = 'none';
      currentConversationFriendId = null;
    }
  });

  window.closeMessageMenu = function () {
    const menu = document.getElementById('messageActionMenu');
    if (menu) menu.style.display = 'none';
    selectedMessageId = null;
  };

  window.deleteMessage = async function (scope) {
    if (!selectedMessageId) return;
    const menu = document.getElementById('messageActionMenu');
    if (menu) menu.style.display = 'none';
    
    const id = selectedMessageId;
    selectedMessageId = null;

    try {
      const { data: { user } } = await getSB().auth.getUser();
      
      // Mesajın sahibini kontrol et
      const { data: msg, error: fetchError } = await getSB().from('messages').select('sender_id').eq('id', id).single();
      if (fetchError) throw fetchError;

      let updateError;
      if (scope === 'me') {
        const field = msg.sender_id === user.id ? 'deleted_for_sender' : 'deleted_for_receiver';
        const { error } = await getSB().from('messages').update({ [field]: true }).eq('id', id);
        updateError = error;
      } else if (scope === 'everyone') {
        if (msg.sender_id !== user.id) {
           if (window.showToast) window.showToast('Sadece kendi mesajlarını herkesten silebilirsin.', 'error');
           return;
        }
        const { error } = await getSB().from('messages').update({ deleted_for_sender: true, deleted_for_receiver: true }).eq('id', id);
        updateError = error;
      }

      if (updateError) throw updateError;

      if (window.showToast) window.showToast('Mesaj silindi.', 'success');
      await loadMessages();
    } catch (e) {
      console.error("Silme hatası detay:", e);
      if (window.showToast) window.showToast('Silme hatası: ' + (e.message || 'Yetki sorunu'), 'error');
    }
  };

  // ═══ SOHBET SİLME (Long Press & Swipe) ═══
  let convTouchTimer = null;
  let convStartX = 0;
  let convStartY = 0;
  let isConvSwipe = false;

  function handleConvTouchStart(e, friendId) {
    convStartX = e.touches[0].clientX;
    convStartY = e.touches[0].clientY;
    isConvSwipe = false;
    window.closeConversationMenu();

    // Basma efekti
    const row = e.currentTarget;
    if (row) row.style.transform = 'scale(0.97)';

    convTouchTimer = setTimeout(() => {
        if (!isConvSwipe) {
          const touch = e.touches[0];
          showConversationMenu(touch.clientX, touch.clientY, friendId);
        }
    }, 600);
  }

  function handleConvTouchMove(e) {
    const moveX = e.touches[0].clientX;
    const moveY = e.touches[0].clientY;
    const diffX = convStartX - moveX;
    const diffY = Math.abs(convStartY - moveY);

    if (Math.abs(diffX) > 20 && Math.abs(diffX) > diffY) {
      isConvSwipe = true;
      clearTimeout(convTouchTimer);
      if (e.cancelable) e.preventDefault();
    }
  }

  function handleConvTouchEnd(e, friendId) {
    clearTimeout(convTouchTimer);
    
    // Basma efektini geri al
    const row = e.currentTarget;
    if (row) row.style.transform = 'scale(1)';

    const endX = e.changedTouches[0].clientX;
    const diffX = convStartX - endX;

    if (isConvSwipe && diffX > 60) {
      const touch = e.changedTouches[0];
      showConversationMenu(touch.clientX, touch.clientY, friendId);
    }
  }

  function showConversationMenu(x, y, friendId) {
    const menu = document.getElementById('conversationActionMenu');
    if (!menu) return;
    currentConversationFriendId = friendId;
    menu.style.display = 'block';
    if (x + 180 > window.innerWidth) x -= 180;
    if (y + 100 > window.innerHeight) y -= 100;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
  }

  window.closeConversationMenu = function() {
    const menu = document.getElementById('conversationActionMenu');
    if (menu) menu.style.display = 'none';
    currentConversationFriendId = null;
  };

  window.deleteConversation = async function() {
    if (!currentConversationFriendId) return;
    const friendId = currentConversationFriendId;
    window.closeConversationMenu();

    const { data: { user } } = await getSB().auth.getUser();
    if (!user) return;

    const confirmMsg = "Bu sohbeti silmek istediğinize emin misiniz? (Sadece sizin görünümünüzden gizlenir)";
    if (window.showCustomConfirm) {
        window.showCustomConfirm(confirmMsg, async () => {
            await performConversationDelete(user.id, friendId);
        });
    } else if (confirm(confirmMsg)) {
        await performConversationDelete(user.id, friendId);
    }
  };

  async function performConversationDelete(userId, friendId) {
    try {
        const sb = getSB();
        await sb.from('messages').update({ deleted_for_sender: true }).match({ sender_id: userId, receiver_id: friendId });
        await sb.from('messages').update({ deleted_for_receiver: true }).match({ sender_id: friendId, receiver_id: userId });

        if (currentFriendId === friendId) window.showConversationsList();
        await loadConversations();
        if (window.showToast) window.showToast('Sohbet silindi.', 'success');
    } catch (e) {
        if (window.showToast) window.showToast('Silme hatası: ' + e.message, 'error');
    }
  }

  window.sendMessageFromUi = async function () {
    if (isSendingMsg) return;
    const input = document.getElementById('messageInput');
    const text = input?.value?.trim();
    if (!text || !currentFriendId) return;

    input.value = '';
    input.focus();
    setTimeout(() => { input.focus({ preventScroll: true }); }, 30);

    isSendingMsg = true;
    try {
      await sendMessage(currentFriendId, text);
      await loadMessages();
    } catch (e) {
      alert('Mesaj gönderilemedi: ' + e.message);
      input.value = text;
    } finally {
      isSendingMsg = false;
      setTimeout(() => { input.focus({ preventScroll: true }); }, 100);
    }
  };

  // Enter tuşu ile mesaj gönderme
  document.addEventListener('DOMContentLoaded', () => {
    const inp = document.getElementById('messageInput');
    if (inp) {
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          window.sendMessageFromUi();
        }
      });
    }
  });

  async function init() {
    try {
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
          const modal = document.getElementById('messagesModal');
          if (modal && modal.style.display === 'flex') {
            modal.style.height = window.visualViewport.height + 'px';
            window.scrollTo(0, 0);
          }
        });
      }
      const { data: { user } } = await getSB().auth.getUser();
      if (user && !chatSubscription) {
        chatSubscription = getSB()
          .channel('public:messages')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            const msg = payload.new;
            if (currentFriendId && (msg.sender_id === currentFriendId || msg.receiver_id === currentFriendId)) {
               loadMessages();
            } else if (msg.receiver_id === user.id && window.showToast) {
               window.showToast('Yeni bir mesajın var!', 'success');
            }
          })
          .subscribe();
      }
    } catch(e) { console.warn("Realtime başlatılamadı:", e); }
    console.log('✅ Sohbet modülü hazır.');
  }

  return {
    init,
    openConversation,
    openConversationFromFriends,
    showMessageMenu,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    toggleFriendsModal: window.toggleFriendsModal,
    toggleMessagesModal: window.toggleMessagesModal,
    sendRequestAndRefresh: window.sendRequestAndRefresh,
    acceptAndRefresh: window.acceptAndRefresh,
    rejectAndRefresh: window.rejectAndRefresh,
    showConversationsList: window.showConversationsList,
    handleConvTouchStart,
    handleConvTouchMove,
    handleConvTouchEnd,
    closeConversationMenu: window.closeConversationMenu,
    deleteConversation: window.deleteConversation
  };
})();