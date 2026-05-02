// js/auth.js - Supabase authentication module

(function () {
  const SUPABASE_URL = 'https://jvyunzdhpeqpzpftdpzb.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_x0bKV30QT19RTBcI5z3pcQ_34UR9bEN';

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('Supabase JS client is not loaded. Load the CDN before js/auth.js.');
    return;
  }

  const sb = window._supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window._supabaseClient = sb;
  window.currentUser = null;

  function getDisplayName(user, prof = null) {
    return prof?.username || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Kullanıcı';
  }

  async function updateSidebarProfile(user) {
    // Profili veritabanından çek
    const { data: prof } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    
    const displayName = getDisplayName(user, prof);
    const sidebarProfileName = document.getElementById('sidebarProfileName');
    const sidebarProfileEmail = document.getElementById('sidebarProfileEmail');

    if (sidebarProfileName) sidebarProfileName.textContent = displayName;
    if (sidebarProfileEmail) sidebarProfileEmail.textContent = user?.email || '';
    
    // Profil sekmesini de güncelle
    const profName = document.getElementById('profileNameDisplay');
    const profEmail = document.getElementById('profileEmailDisplay');
    const profAvatarBig = document.getElementById('profileAvatarBig');
    const profInput = document.getElementById('newUsernameInput');

    if (profName) profName.textContent = displayName;
    if (profEmail) profEmail.textContent = user?.email || '';
    
    // Avatar URL önceliği: Profil Tablosu > Google Metadata > Auth
    const avatarUrl = prof?.avatar_url || user?.user_metadata?.avatar_url || user?.avatar_url;

    if (profAvatarBig) {
      if (avatarUrl) {
        profAvatarBig.innerHTML = `<img src="${avatarUrl}" style="width:100%; height:100%; object-fit:cover;">`;
      } else {
        profAvatarBig.textContent = displayName[0].toUpperCase();
      }
    }

    if (profInput && !profInput.value && prof?.username) {
       profInput.value = prof.username;
    }

    updateSidebarAvatar(user, prof);
  }

  function updateSidebarAvatar(user, prof = null) {
    const avatarDiv = document.getElementById('sidebarAvatar');
    const defaultAvatar = document.getElementById('defaultAvatar');
    const avatarImage = document.getElementById('avatarImage');

    if (!avatarDiv || !defaultAvatar || !avatarImage) return;

    const avatarUrl = prof?.avatar_url || user?.user_metadata?.avatar_url || user?.avatar_url;
 
    if (avatarUrl) {
      avatarImage.src = avatarUrl;
      avatarImage.style.display = 'block';
      defaultAvatar.style.display = 'none';
    } else {
      avatarImage.removeAttribute('src');
      avatarImage.style.display = 'none';
      defaultAvatar.style.display = 'block';
    }

    // Profil sekmesindeki büyük avatarı da güncelle
    const profAvatarBig = document.getElementById('profileAvatarBig');
    if (profAvatarBig) {
      if (avatarUrl) {
        profAvatarBig.innerHTML = `<img src="${avatarUrl}" style="width:100%; height:100%; object-fit:cover;">`;
      } else {
        const displayName = getDisplayName(user);
        profAvatarBig.textContent = displayName[0].toUpperCase();
      }
    }
  }

  // js/auth.js içindeki checkAuthState fonksiyonunu şu şekilde değiştir:

  async function checkAuthState() {
    const authScreen = document.getElementById('authScreen');
    const appShell = document.getElementById('appShell');
    const sidebarProfileName = document.getElementById('sidebarProfileName');
    const sidebarProfileEmail = document.getElementById('sidebarProfileEmail');

    // Önce oturum var mı diye bakalım
    const { data: { session } } = await sb.auth.getSession();

    if (session) {
      // Oturum varsa kullanıcı bilgilerini alabiliriz
      const { data: { user } } = await sb.auth.getUser();

      if (user) {
        window.currentUser = user;
        updateSidebarProfile(user);
      }

      if (authScreen) authScreen.style.display = 'none';
      if (appShell) appShell.style.display = 'block';
      if (typeof FriendsChatModule !== 'undefined') FriendsChatModule.init();
      if (typeof initApp === 'function') initApp();
      return true;
    } else {
      // Oturum yoksa direkt giriş ekranına yönlendir
      if (appShell) appShell.style.display = 'none';
      if (authScreen) authScreen.style.display = 'flex';
      return false;
    }

  }

  async function signInWithEmail(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signUpWithEmail(email, password, fullName = '') {
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName }
      }
    });
    if (error) throw error;
    return data;
  }

  async function signInWithGoogle() {
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          prompt: 'select_account'   // Her seferinde hesap seçim ekranını zorla
        }
      }
    });
    if (error) throw error;
  }

  async function signOut() {
    const { error } = await sb.auth.signOut();
    if (error) throw error;
    window.currentUser = null;
    window.location.reload();
  }

  async function resetPassword(email) {
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '?reset=true'
    });
    if (error) throw error;
    alert('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.');
  }
  // ═══ ARKADAŞLIK İŞLEMLERİ ═══

  // Kullanıcı adına göre arama
  window.searchUser = async function (username) {
    const sb = window._supabaseClient;
    const { data, error } = await sb
      .from('profiles')
      .select('id, username, display_name')
      .eq('username', username)
      .single();
    return data;
  };

  // Arkadaşlık isteği gönder
  window.sendFriendRequest = async function (addresseeId) {
    const sb = window._supabaseClient;
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb.from('friendships').insert({
      requester_id: user.id,
      addressee_id: addresseeId
    });
    if (error) throw error;
    return true;
  };

  // Gelen istekleri listele
  window.getPendingRequests = async function () {
    const sb = window._supabaseClient;
    const { data: { user } } = await sb.auth.getUser();
    const { data } = await sb
      .from('friendships')
      .select('id, requester_id, profiles!friendships_requester_id_fkey(username, display_name)')
      .eq('addressee_id', user.id)
      .eq('status', 'pending');
    return data;
  };

  // Arkadaş listesi
  window.getFriends = async function () {
    const sb = window._supabaseClient;
    const { data: { user } } = await sb.auth.getUser();
    const { data } = await sb
      .from('friendships')
      .select('id, requester_id, addressee_id, profiles!friendships_requester_id_fkey(username), profiles!friendships_addressee_id_fkey(username)')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq('status', 'accepted');
    return data;
  };

  // İsteği kabul et
  window.acceptRequest = async function (friendshipId) {
    const sb = window._supabaseClient;
    await sb.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
  };

  // İsteği reddet
  window.rejectRequest = async function (friendshipId) {
    const sb = window._supabaseClient;
    await sb.from('friendships').delete().eq('id', friendshipId);
  };

  // ═══ MESAJLAŞMA ═══

  // Mesaj gönder
  window.sendMessage = async function (receiverId, content) {
    const sb = window._supabaseClient;
    const { data: { user } } = await sb.auth.getUser();
    await sb.from('messages').insert({
      sender_id: user.id,
      receiver_id: receiverId,
      content
    });
  };

  // Belirli bir arkadaşla mesaj geçmişi
  window.getMessageHistory = async function (friendId) {
    const sb = window._supabaseClient;
    const { data: { user } } = await sb.auth.getUser();
    const { data } = await sb
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });
    return data;
  };

  // Realtime mesaj dinleyici (örnek: yeni mesaj geldiğinde bildirim)
  // DÜZELTİLMİŞ HALİ
  window.subscribeToMessages = async function (callback) {
    const sb = window._supabaseClient;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    sb
      .channel('messages-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        callback
      )
      .subscribe();
  };
  // Kullanıcı adı belirleme penceresi
  window.promptUsername = async function () {
    const username = prompt('Kullanıcı adınızı girin (boşluksuz, benzersiz):');
    if (!username) return;

    try {
      const success = await setUsername(username.trim());
      if (success) {
        alert('Kullanıcı adınız başarıyla kaydedildi!');
        document.getElementById('sidebarProfileName').textContent = username;
      }
    } catch (err) {
      alert('Hata: ' + err.message);
    }
  };

  // Kullanıcı adı güncelleme (veritabanı)
  window.setUsername = async function (username) {
    const sb = window._supabaseClient;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;

    // Benzersizlik kontrolü
    const { data: existing, error } = await sb
      .from('profiles')
      .select('id')
      .eq('username', username)
      .neq('id', user.id)
      .maybeSingle();  // ← .single() yerine .maybeSingle()

    if (error) {
      console.error('Kontrol hatası:', error.message);
      return false;
    }

    if (existing) {
      alert('Bu kullanıcı adı zaten alınmış!');
      return false;
    }

    await sb.from('profiles').upsert({ id: user.id, username });
    return true;
  };

  // 📸 Profil Resmi Yükleme
  window.uploadProfilePicture = async function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const sb = window._supabaseClient;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // 1. Storage'a yükle (Not: 'avatars' bucket'ı public olmalıdır)
      const { error: uploadError } = await sb.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Public URL al
      const { data: { publicUrl } } = sb.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 3. Profili ve Auth Metadata'yı güncelle
      await sb.from('profiles').upsert({ id: user.id, avatar_url: publicUrl });
      await sb.auth.updateUser({ data: { avatar_url: publicUrl } });

      alert('Profil fotoğrafı güncellendi!');
      window.location.reload(); // Değişiklikleri her yerde görmek için en temizi
    } catch (err) {
      alert('Yükleme hatası: ' + err.message);
      console.error(err);
    }
  };

  function switchToSignUp() {
    const loginPanel = document.getElementById('loginPanel');
    const signUpForm = document.getElementById('signUpForm');
    if (loginPanel) loginPanel.style.display = 'none';
    if (signUpForm) signUpForm.style.display = 'block';
  }

  function switchToLogin() {
    const loginPanel = document.getElementById('loginPanel');
    const signUpForm = document.getElementById('signUpForm');
    if (signUpForm) signUpForm.style.display = 'none';
    if (loginPanel) loginPanel.style.display = 'block';
  }

  async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;

    try {
      await signInWithEmail(email, password);
      await checkAuthState();
    } catch (error) {
      alert('Giriş hatası: ' + (error.message || 'Bilinmeyen hata'));
    }

    return false;
  }

  async function handleSignUp(event) {
    event.preventDefault();
    const fullName = document.getElementById('signUpName')?.value.trim();
    const email = document.getElementById('signUpEmail')?.value.trim();
    const password = document.getElementById('signUpPassword')?.value;

    try {
      await signUpWithEmail(email, password, fullName);
      alert('Kayıt başarılı. E-posta doğrulaması gerekiyorsa gelen kutunuzu kontrol edin.');
      switchToLogin();
    } catch (error) {
      alert('Kayıt hatası: ' + (error.message || 'Bilinmeyen hata'));
    }

    return false;
  }

  async function handleForgotPassword() {
    const emailInput = document.getElementById('loginEmail');
    const email = emailInput?.value.trim() || prompt('Şifre sıfırlama için e-posta adresinizi yazın:');
    if (!email) return false;

    try {
      await resetPassword(email);
    } catch (error) {
      alert('Şifre sıfırlama hatası: ' + (error.message || 'Bilinmeyen hata'));
    }

    return false;
  }

  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      checkAuthState();
    } else if (event === 'SIGNED_OUT') {
      const authScreen = document.getElementById('authScreen');
      const appShell = document.getElementById('appShell');
      if (authScreen) authScreen.style.display = 'flex';
      if (appShell) appShell.style.display = 'none';
    }
  });

  async function updateUsernameFromProfile() {
    const input = document.getElementById('newUsernameInput');
    const username = input?.value?.trim();
    if (!username) { 
      if (window.showToast) window.showToast('Lütfen bir kullanıcı adı girin.', 'error');
      else alert('Lütfen bir kullanıcı adı girin.'); 
      return; 
    }
    
    const sb = window._supabaseClient;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    try {
      // Profiles tablosunu güncelle
      const { error } = await sb.from('profiles').upsert({ id: user.id, username });
      if (error) throw error;

      if (window.showToast) window.showToast('Kullanıcı adınız güncellendi!', 'success');
      else alert('Kullanıcı adınız güncellendi!');
      
      // UI'ı anında güncelle
      const sidebarName = document.getElementById('sidebarProfileName');
      const profileName = document.getElementById('profileNameDisplay');
      if (sidebarName) sidebarName.textContent = username;
      if (profileName) profileName.textContent = username;
    } catch (err) {
      if (window.showToast) window.showToast('Hata: ' + err.message, 'error');
      else alert('Hata: ' + err.message);
    }
  }

  window.confirmDeleteAccount = async function() {
    if (!confirm("HESABINIZI SİLMEK ÜZERESİNİZ!\n\nBu işlem geri alınamaz. Tüm mesajlarınız ve profil verileriniz silinecektir. Devam etmek istiyor musunuz?")) return;
    
    const sb = window._supabaseClient;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    try {
      const { error: profileError } = await sb.from('profiles').delete().eq('id', user.id);
      if (profileError) throw profileError;

      alert('Hesabınız başarıyla silindi. Güle güle!');
      await signOut();
    } catch (err) {
      alert('Hata: ' + err.message);
    }
  };

  window.updateUsernameFromProfile = updateUsernameFromProfile;
  window.checkAuthState = checkAuthState;
  window.signInWithEmail = signInWithEmail;
  window.signUpWithEmail = signUpWithEmail;
  window.signInWithGoogle = signInWithGoogle;
  window.signOut = signOut;
  window.resetPassword = resetPassword;
  window.switchToSignUp = switchToSignUp;
  window.switchToLogin = switchToLogin;
  window.handleLogin = handleLogin;
  window.handleSignUp = handleSignUp;
  window.handleForgotPassword = handleForgotPassword;
})();
