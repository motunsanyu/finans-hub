// js/modules/almanca_oyun.js - Almanca A1 Kelime Pratiği & Oyun Motoru (Gelişmiş Cümle & Örnek Modülü)

(function () {
  'use strict';

  // ── DURUM & VERİ ──────────────────────────────────────────────
  let wordsData = [];
  let currentMode = 'cards'; // 'cards' | 'sentence' | 'quiz' | 'artikel' | 'match' | 'learned' | 'vocab'
  let currentFilter = 'all'; // 'all' | 'verb' | 'nomen' | 'adj' | 'adverb' | 'zeit' | 'frage' | 'examples' | 'fav'

  // Öğrenilenler Modu Filtreleri
  let learnedFilter = 'all';
  let learnedSearchQuery = '';

  // Kart modu
  let activeCardList = [];
  let currentCardIndex = 0;
  let isCardFlipped = false;

  // Cümle Pratiği (Boşluk Doldurma) modu
  let sentenceQuestions = [];
  let sentenceCurrentIndex = 0;
  let sentenceScore = 0;
  let sentenceStreak = 0;
  let sentenceAnswered = false;

  // Test / Quiz modu
  let quizQuestions = [];
  let quizCurrentIndex = 0;
  let quizScore = 0;
  let quizStreak = 0;
  let quizDirection = 'de_tr'; // 'de_tr' (Almanca -> Türkçe) veya 'tr_de' (Türkçe -> Almanca)
  let quizAnswered = false;

  // Artikel modu
  let artikelList = [];
  let artikelCurrentIndex = 0;
  let artikelStreak = 0;
  let artikelAnswered = false;

  // Eşleştirme modu
  let matchSelectedDe = null;
  let matchSelectedTr = null;
  let matchPairs = { de: [], tr: [], matchedIds: new Set() };

  // Sözlük arama
  let vocabSearchQuery = '';

  // ── YEREL DEPOLAMA (LOCALSTORAGE) ────────────────────────────
  const STORAGE_KEYS = {
    LEARNED: 'almanca_oyun_learned',
    FAVORITES: 'almanca_oyun_favorites',
    DAILY: 'almanca_oyun_daily'
  };

  function getLearnedSet() {
    try {
      const arr = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEARNED)) || [];
      return new Set(arr);
    } catch (e) {
      return new Set();
    }
  }

  function saveLearnedSet(set) {
    try {
      localStorage.setItem(STORAGE_KEYS.LEARNED, JSON.stringify(Array.from(set)));
    } catch (e) {}
    updateWidgetStats();
  }

  function getFavoritesSet() {
    try {
      const arr = JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITES)) || [];
      return new Set(arr);
    } catch (e) {
      return new Set();
    }
  }

  function saveFavoritesSet(set) {
    try {
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(Array.from(set)));
    } catch (e) {}
  }

  function getDailyState() {
    const today = new Date().toISOString().slice(0, 10);
    let state = { date: today, completedIds: [], streak: 1, lastCompletedDate: '' };
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.DAILY));
      if (stored) {
        if (stored.date === today) {
          state = stored;
        } else {
          // Yeni gün: Dün tamamlandıysa seri devam eder
          const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
          const streak = (stored.lastCompletedDate === yesterday) ? (stored.streak || 1) : 1;
          state = {
            date: today,
            completedIds: [],
            streak: streak,
            lastCompletedDate: stored.lastCompletedDate || ''
          };
          localStorage.setItem(STORAGE_KEYS.DAILY, JSON.stringify(state));
        }
      }
    } catch (e) {}
    return state;
  }

  function markDailyWord(id) {
    const daily = getDailyState();
    if (!daily.completedIds.includes(id)) {
      daily.completedIds.push(id);
      if (daily.completedIds.length >= 10 && daily.lastCompletedDate !== daily.date) {
        daily.lastCompletedDate = daily.date;
        daily.streak = (daily.streak || 0) + 1;
        triggerCelebration();
      }
      try {
        localStorage.setItem(STORAGE_KEYS.DAILY, JSON.stringify(daily));
      } catch (e) {}
      updateWidgetStats();
    }
  }

  function getDailySentence() {
    const list = wordsData.filter(w => w.example_de && w.example_tr);
    if (!list.length) return null;
    const today = new Date().toISOString().slice(0, 10);
    let hash = 0;
    for (let i = 0; i < today.length; i++) {
      hash = (hash * 31 + today.charCodeAt(i)) % list.length;
    }
    return list[hash] || list[0];
  }

  // ── SES EFEKTLERİ & TELAFFUZ ──────────────────────────────────
  function speakGerman(text) {
    if (!window.speechSynthesis || !text) return;
    try {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/^(der|die|das)\s+/i, '').replace(/\(.*?\)/g, '').split(';')[0].trim();
      const utterance = new SpeechSynthesisUtterance(cleanText || text);
      utterance.lang = 'de-DE';
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('TTS Hatası:', e);
    }
  }

  function playTone(type) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'correct') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.08); // A5
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
        gain.gain.linearRampToValueAtTime(0, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === 'wrong') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.25);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.25, now + 0.03);
        gain.gain.linearRampToValueAtTime(0, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'flip') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.06);
        osc.start(now);
        osc.stop(now + 0.06);
      }
    } catch (e) {}
  }

  function triggerCelebration() {
    playTone('correct');
    const toast = document.getElementById('toastContainer');
    if (toast) {
      const msg = document.createElement('div');
      msg.className = 'toast show';
      msg.style.background = '#238636';
      msg.style.color = '#fff';
      msg.style.fontWeight = 'bold';
      msg.innerHTML = '🎉 Harika! Günlük 10 kelimelik Almanca hedefini tamamladın!';
      toast.appendChild(msg);
      setTimeout(() => msg.remove(), 4000);
    }
  }

  // ── YARDIMCI ROZET & TÜR BELİRLEME ───────────────────────────
  function getBadgeHtml(item) {
    if (item.type === 'Nomen') {
      const art = item.article ? item.article.toLowerCase() : 'nomen';
      return `<span class="almanca-article-badge ${art}">${art}</span>`;
    } else if (item.type === 'Verb') {
      return `<span class="almanca-article-badge verb">fiil</span>`;
    } else if (item.type === 'Adjektiv') {
      return `<span class="almanca-article-badge adj">sıfat</span>`;
    } else {
      return `<span class="almanca-article-badge diger">${item.category ? item.category.split('&')[0].trim().toLowerCase() : 'diğer'}</span>`;
    }
  }

  // ── FİLTRELEME & KARTLARI HAZIRLAMA ─────────────────────────
  function filterWords(list, filter) {
    const favs = getFavoritesSet();

    if (filter === 'verb') return list.filter(w => w.type === 'Verb' || w.category === 'Fiiller');
    if (filter === 'nomen') return list.filter(w => w.type === 'Nomen' || w.category === 'İsimler');
    if (filter === 'adj') return list.filter(w => w.type === 'Adjektiv' || w.category === 'Sıfatlar');
    if (filter === 'adverb') return list.filter(w => w.category === 'Zarflar & Konum');
    if (filter === 'zeit') return list.filter(w => w.category === 'Zaman & Günlük Yaşam');
    if (filter === 'frage') return list.filter(w => w.category === 'Soru & Bağlaç');
    if (filter === 'examples') return list.filter(w => !!w.example_de);
    if (filter === 'fav') return list.filter(w => favs.has(w.id));
    return list;
  }

  // Öğrenilen kelimeler çalışma modlarında tekrar gösterilmez!
  function prepareCardList() {
    const learned = getLearnedSet();
    const baseList = filterWords(wordsData, currentFilter);
    // Öğrenilmiş olanları aktif çalışma listesinden hariç tut
    activeCardList = baseList.filter(w => !learned.has(w.id));
    if (currentCardIndex >= activeCardList.length) {
      currentCardIndex = Math.max(0, activeCardList.length - 1);
    }
    isCardFlipped = false;
  }

  // ── RENDER: WIDGET İSKELETİ & AÇILIR PENCERE (MODAL) ─────────────
  function renderWidgetSkeleton() {
    // 1. Notlar sayfasının altındaki tetikleyici buton dinleyicisi
    const bottomBtn = document.getElementById('almancaBottomOpenBtn');
    if (bottomBtn) {
      bottomBtn.onclick = openModal;
    }

    // 2. Modal içi içerik alanı (index.html içindeki statik modal konteyneri)
    const innerContainer = document.getElementById('almancaModalInnerContent');
    if (!innerContainer) return;

    const daily = getDailyState();
    const todaySentence = getDailySentence();
    const learned = getLearnedSet();
    const totalWords = wordsData.length || 903;

    innerContainer.innerHTML = `
      <!-- MODAL HEADER -->
      <div class="almanca-modal-header">
        <div class="almanca-modal-header-left">
          <div class="almanca-flag-badge">🇩🇪</div>
          <div>
            <div class="almanca-modal-title" id="almancaModalTitle">
              Almanca Çalışma Alanı
              <span class="almanca-level-tag">A1 Cümleli</span>
            </div>
            <div class="almanca-modal-sub">Düzenli Kelime & Örnek Cümle Listesi (${totalWords} Kelime)</div>
          </div>
        </div>
        <button class="almanca-modal-close-btn" id="almancaModalCloseBtn" type="button" title="Pencereyi Kapat">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- MODAL SCROLL İÇERİĞİ -->
      <div class="almanca-modal-scroll">
        <!-- STATS & DAILY BAR -->
        <div class="almanca-quick-bar">
          <div class="almanca-stats-chips">
            <div class="almanca-stat-chip goal" id="almancaDailyChip" title="Bugünkü 10 kelimelik hedef">
              🎯 Günlük Hedef: <strong id="almancaDailyCount">${Math.min(daily.completedIds.length, 10)}/10</strong>
            </div>
            <div class="almanca-stat-chip streak" id="almancaStreakChip" title="Düzenli çalışma serisi">
              🔥 <strong id="almancaStreakDays">${daily.streak || 1}</strong> Günlük Seri
            </div>
            <div class="almanca-stat-chip learned" id="almancaLearnedChip" title="Öğrenilen toplam kelime">
              🧠 <strong id="almancaLearnedCount">${learned.size}/${totalWords}</strong> Öğrenildi
            </div>
          </div>
          <div class="almanca-daily-progress-container">
            <div class="almanca-daily-prog-bar">
              <div class="almanca-daily-prog-fill" id="almancaDailyBarFill" style="width: ${Math.min(100, Math.round((daily.completedIds.length / 10) * 100))}%;"></div>
            </div>
          </div>
        </div>

        <!-- GÜNÜN CÜMLESİ BANNERI -->
        ${todaySentence ? `
          <div class="almanca-daily-sentence-card">
            <div class="almanca-daily-sentence-badge">💡 GÜNÜN CÜMLESİ (${todaySentence.category || 'A1 Pratik'})</div>
            <div class="almanca-daily-sentence-de">
              <span>💬 ${todaySentence.example_de}</span>
              <button class="almanca-mini-audio-btn" id="almancaDailySentAudio" title="Cümleyi Dinle">🔊</button>
            </div>
            <div class="almanca-daily-sentence-tr">${todaySentence.example_tr}</div>
          </div>
        ` : ''}

        <!-- MOD SEKMELERİ -->
        <div class="almanca-mode-tabs">
          <button class="almanca-mode-tab ${currentMode === 'cards' ? 'active' : ''}" data-mode="cards">
            🃏 Kelime Kartları
          </button>
          <button class="almanca-mode-tab ${currentMode === 'sentence' ? 'active' : ''}" data-mode="sentence">
            ✍️ Cümle Pratiği
          </button>
          <button class="almanca-mode-tab ${currentMode === 'quiz' ? 'active' : ''}" data-mode="quiz">
            ❓ 4 Şıklı Test
          </button>
          <button class="almanca-mode-tab ${currentMode === 'artikel' ? 'active' : ''}" data-mode="artikel">
            🎯 der / die / das
          </button>
          <button class="almanca-mode-tab ${currentMode === 'match' ? 'active' : ''}" data-mode="match">
            ⚡ Eşleştirme
          </button>
          <button class="almanca-mode-tab ${currentMode === 'learned' ? 'active' : ''}" data-mode="learned" style="border-color:rgba(63,185,80,0.4); color:#3fb950;">
            🏆 Öğrendiklerim (<span id="almancaLearnedTabCount">${learned.size}</span>)
          </button>
          <button class="almanca-mode-tab ${currentMode === 'vocab' ? 'active' : ''}" data-mode="vocab">
            📖 Kelime & Cümle Havuzu
          </button>
        </div>

        <!-- MOD İÇERİĞİ -->
        <div id="almancaModeContent"></div>
      </div>
    `;

    // 3. Olay Dinleyicileri
    const closeBtn = document.getElementById('almancaModalCloseBtn');
    if (closeBtn) closeBtn.onclick = closeModal;

    const backdrop = document.getElementById('almancaModalBackdrop');
    if (backdrop) backdrop.onclick = closeModal;

    const dailyAudio = document.getElementById('almancaDailySentAudio');
    if (dailyAudio && todaySentence) {
      dailyAudio.onclick = (e) => {
        e.stopPropagation();
        speakGerman(todaySentence.example_de);
      };
    }

    innerContainer.querySelectorAll('.almanca-mode-tab').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const mode = btn.dataset.mode;
        switchMode(mode);
      };
    });

    updateWidgetStats();
    renderCurrentMode();
  }

  // ── MODAL AÇMA / KAPATMA ─────────────────────────────────────
  function openModal() {
    const modal = document.getElementById('almancaModalOverlay');
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.classList.add('almanca-modal-open');
    updateWidgetStats();
    prepareCardList();
    renderCurrentMode();
  }

  function closeModal() {
    const modal = document.getElementById('almancaModalOverlay');
    if (!modal) return;
    modal.style.display = 'none';
    document.body.classList.remove('almanca-modal-open');
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
  }

  // ESC tuşuyla kapatma
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('almancaModalOverlay');
      if (modal && modal.style.display !== 'none') {
        closeModal();
      }
    }
  });

  function switchMode(mode) {
    currentMode = mode;
    const modal = document.getElementById('almancaModalOverlay');
    if (modal) {
      modal.querySelectorAll('.almanca-mode-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
      });
    }
    renderCurrentMode();
  }

  function updateWidgetStats() {
    const learned = getLearnedSet();
    const daily = getDailyState();
    const total = wordsData.length || 903;
    const unlearnedCount = Math.max(0, total - learned.size);

    // Alt Buton Sayaçları (Notlar sayfasının altındaki)
    const compactDaily = document.getElementById('almancaCompactDaily');
    if (compactDaily) compactDaily.textContent = `🎯 ${Math.min(daily.completedIds.length, 10)}/10`;

    const compactStreak = document.getElementById('almancaCompactStreak');
    if (compactStreak) compactStreak.textContent = `🔥 ${daily.streak || 1} Gün`;

    const btnSubText = document.getElementById('almancaBtnSubText');
    if (btnSubText) {
      btnSubText.textContent = `${unlearnedCount} Çalışılacak · ${learned.size} Öğrenildi`;
    }

    // Modal İçi Sayaçlar
    const learnedCountEl = document.getElementById('almancaLearnedCount');
    if (learnedCountEl) learnedCountEl.textContent = `${learned.size}/${total}`;

    const learnedTabCount = document.getElementById('almancaLearnedTabCount');
    if (learnedTabCount) learnedTabCount.textContent = `${learned.size}`;

    const dailyCountEl = document.getElementById('almancaDailyCount');
    if (dailyCountEl) dailyCountEl.textContent = `${Math.min(daily.completedIds.length, 10)}/10`;

    const streakEl = document.getElementById('almancaStreakDays');
    if (streakEl) streakEl.textContent = `${daily.streak || 1}`;

    const barFill = document.getElementById('almancaDailyBarFill');
    if (barFill) {
      const pct = Math.min(100, Math.round((daily.completedIds.length / 10) * 100));
      barFill.style.width = `${pct}%`;
    }
  }

  // ── MODLARI YÖNETME ──────────────────────────────────────────
  function renderCurrentMode() {
    const content = document.getElementById('almancaModeContent');
    if (!content) return;

    if (currentMode === 'cards') renderCardsMode(content);
    else if (currentMode === 'sentence') renderSentenceMode(content);
    else if (currentMode === 'quiz') renderQuizMode(content);
    else if (currentMode === 'artikel') renderArtikelMode(content);
    else if (currentMode === 'match') renderMatchMode(content);
    else if (currentMode === 'learned') renderLearnedMode(content);
    else if (currentMode === 'vocab') renderVocabMode(content);
  }

  // ══════════════════════════════════════════════════════════════
  // MOD 1: KELİME KARTLARI (FLASHCARDS)
  // Öğrenilen kelimeler listeden çıkarılır!
  // ══════════════════════════════════════════════════════════════
  function renderCardsMode(container) {
    if (activeCardList.length === 0) prepareCardList();

    // Filtre çubuğu HTML'i
    const filterRowHtml = `
      <div class="almanca-filter-row">
        <button class="almanca-filter-pill ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">Tümü</button>
        <button class="almanca-filter-pill ${currentFilter === 'verb' ? 'active' : ''}" data-filter="verb">Fiiller</button>
        <button class="almanca-filter-pill ${currentFilter === 'nomen' ? 'active' : ''}" data-filter="nomen">İsimler</button>
        <button class="almanca-filter-pill ${currentFilter === 'adj' ? 'active' : ''}" data-filter="adj">Sıfatlar</button>
        <button class="almanca-filter-pill ${currentFilter === 'adverb' ? 'active' : ''}" data-filter="adverb">Zarflar & Yer</button>
        <button class="almanca-filter-pill ${currentFilter === 'zeit' ? 'active' : ''}" data-filter="zeit">Zaman</button>
        <button class="almanca-filter-pill ${currentFilter === 'frage' ? 'active' : ''}" data-filter="frage">Soru & Bağlaç</button>
        <button class="almanca-filter-pill ${currentFilter === 'examples' ? 'active' : ''}" data-filter="examples">💬 Cümleliler</button>
        <button class="almanca-filter-pill ${currentFilter === 'fav' ? 'active' : ''}" data-filter="fav">⭐ Favoriler</button>
      </div>
    `;

    // Eğer bu filtredeki tüm kelimeler öğrenildiyse tebrik ekranı göster
    if (activeCardList.length === 0) {
      const learned = getLearnedSet();
      container.innerHTML = `
        ${filterRowHtml}
        <div style="text-align:center; padding:45px 20px; background:rgba(255,255,255,0.02); border:1px dashed rgba(63,185,80,0.3); border-radius:18px; margin-top:14px;">
          <div style="font-size:52px; margin-bottom:12px;">🎉</div>
          <h3 style="color:#f0f6fc; margin:0 0 8px; font-size:18px;">Harika! Bu Gruptaki Tüm Kelimeleri Öğrendin!</h3>
          <p style="color:#8b949e; font-size:13.5px; max-width:440px; margin:0 auto 20px; line-height:1.5;">
            Öğrendiğin <strong>${learned.size}</strong> kelime <em>"🏆 Öğrendiklerim"</em> alanına aktarıldı. Dilediğin zaman oradan tekrar edebilir ya da tekrar çalışma havuzuna alabilirsin.
          </p>
          <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
            <button class="almanca-ctrl-btn learned" id="almancaGoToLearnedBtn" style="padding:10px 22px; font-size:13px;">
              🏆 Öğrendiklerime Git
            </button>
            <button class="almanca-ctrl-btn" id="almancaResetCardFilterBtn" style="padding:10px 22px; font-size:13px;">
              🔄 Başka Kategori Seç
            </button>
          </div>
        </div>
      `;

      // Filtre butonları
      container.querySelectorAll('.almanca-filter-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          currentFilter = btn.dataset.filter;
          prepareCardList();
          renderCardsMode(container);
        });
      });

      const goBtn = document.getElementById('almancaGoToLearnedBtn');
      if (goBtn) goBtn.addEventListener('click', () => switchMode('learned'));

      const rstBtn = document.getElementById('almancaResetCardFilterBtn');
      if (rstBtn) rstBtn.addEventListener('click', () => {
        currentFilter = 'all';
        prepareCardList();
        renderCardsMode(container);
      });
      return;
    }

    const item = activeCardList[currentCardIndex] || activeCardList[0];
    const favs = getFavoritesSet();
    const isFav = favs.has(item.id);

    container.innerHTML = `
      ${filterRowHtml}

      <!-- 3D Kart Sahnesi -->
      <div class="almanca-flashcard-stage">
        <div class="almanca-flashcard ${isCardFlipped ? 'flipped' : ''}" id="almancaCard">
          <!-- ÖN YÜZ -->
          <div class="almanca-card-side almanca-card-front">
            <div class="almanca-card-top">
              ${getBadgeHtml(item)}
              <button class="almanca-card-audio-btn" id="almancaCardAudioBtn" title="Kelime Telaffuzunu Dinle">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
              </button>
            </div>
            <div class="almanca-card-center">
              <div class="almanca-card-word">${item.word || item.full}</div>
              ${item.plural ? `<div class="almanca-card-forms">Çoğul: ${item.plural}</div>` : ''}
              ${item.forms ? `<div class="almanca-card-forms">${item.forms}</div>` : ''}

              ${item.example_de ? `
                <div class="almanca-card-example-box">
                  <div class="almanca-card-example-de">
                    <span>💬 ${item.example_de}</span>
                    <button class="almanca-mini-audio-btn almanca-speak-sentence" data-sentence="${item.example_de.replace(/"/g, '&quot;')}" title="Cümleyi Dinle">🔊</button>
                  </div>
                  <div class="almanca-card-example-tr">${item.example_tr}</div>
                </div>
              ` : ''}
            </div>
            <div class="almanca-card-bot">
              <span>Almanca</span>
              <div class="almanca-flip-hint">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
                Anlamı için dokun
              </div>
            </div>
          </div>

          <!-- ARKA YÜZ -->
          <div class="almanca-card-side almanca-card-back">
            <div class="almanca-card-top">
              ${getBadgeHtml(item)}
              <button class="almanca-card-audio-btn" id="almancaCardAudioBtnBack" title="Kelime Telaffuzunu Dinle">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
              </button>
            </div>
            <div class="almanca-card-center">
              <div class="almanca-card-meaning">${item.meaning}</div>
              <div class="almanca-card-forms" style="color:#a7f3d0; margin-top:6px;">${item.full}</div>

              ${item.example_de ? `
                <div class="almanca-card-example-box">
                  <div class="almanca-card-example-de">
                    <span>💬 ${item.example_de}</span>
                    <button class="almanca-mini-audio-btn almanca-speak-sentence" data-sentence="${item.example_de.replace(/"/g, '&quot;')}" title="Cümleyi Dinle">🔊</button>
                  </div>
                  <div class="almanca-card-example-tr">${item.example_tr}</div>
                </div>
              ` : ''}
            </div>
            <div class="almanca-card-bot">
              <span>Türkçe Karşılığı</span>
              <div class="almanca-flip-hint">Çevirmek için dokun</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Kontrol Butonları -->
      <div class="almanca-card-controls">
        <button class="almanca-ctrl-btn" id="almancaCardPrev">◀ Önceki</button>
        <button class="almanca-ctrl-btn fav ${isFav ? 'active' : ''}" id="almancaCardFav">
          ${isFav ? '⭐ Favori' : '☆ Favoriye Ekle'}
        </button>
        <button class="almanca-ctrl-btn learned" id="almancaCardLearned" title="Bu kelimeyi öğrendiklerim alanına aktar ve listeden çıkar">
          ✓ Öğrendim (Aktar)
        </button>
        <button class="almanca-ctrl-btn" id="almancaCardNext">Sonraki ▶</button>
      </div>

      <div class="almanca-card-counter">
        <span>Kalan Çalışılacak: ${currentCardIndex + 1} / ${activeCardList.length}</span>
        <button id="almancaShuffleBtn" style="background:none;border:none;color:#58a6ff;font-size:12px;font-weight:600;cursor:pointer;margin-left:12px;">🔀 Karıştır</button>
      </div>
    `;

    // Filtre butonları
    container.querySelectorAll('.almanca-filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        currentFilter = btn.dataset.filter;
        prepareCardList();
        renderCardsMode(container);
      });
    });

    // Kart çevirme
    const cardEl = document.getElementById('almancaCard');
    if (cardEl) {
      cardEl.addEventListener('click', (e) => {
        if (e.target.closest('.almanca-card-audio-btn') || e.target.closest('.almanca-mini-audio-btn')) return;
        isCardFlipped = !isCardFlipped;
        cardEl.classList.toggle('flipped', isCardFlipped);
        playTone('flip');
      });
    }

    // Kelime ses butonları
    const handleSpeak = (e) => {
      e.stopPropagation();
      speakGerman(item.full || item.word);
    };
    const audioBtnFront = document.getElementById('almancaCardAudioBtn');
    if (audioBtnFront) audioBtnFront.addEventListener('click', handleSpeak);

    const audioBtnBack = document.getElementById('almancaCardAudioBtnBack');
    if (audioBtnBack) audioBtnBack.addEventListener('click', handleSpeak);

    // Cümle ses butonları
    container.querySelectorAll('.almanca-speak-sentence').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        speakGerman(btn.dataset.sentence);
      });
    });

    // Navigasyon
    const prevBtn = document.getElementById('almancaCardPrev');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentCardIndex > 0) currentCardIndex--;
        else currentCardIndex = activeCardList.length - 1;
        isCardFlipped = false;
        renderCardsMode(container);
      });
    }

    const nextBtn = document.getElementById('almancaCardNext');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (currentCardIndex < activeCardList.length - 1) currentCardIndex++;
        else currentCardIndex = 0;
        isCardFlipped = false;
        renderCardsMode(container);
      });
    }

    const shufBtn = document.getElementById('almancaShuffleBtn');
    if (shufBtn) {
      shufBtn.addEventListener('click', () => {
        activeCardList.sort(() => Math.random() - 0.5);
        currentCardIndex = 0;
        isCardFlipped = false;
        renderCardsMode(container);
      });
    }

    // Öğrendim butonu: Kelimeyi öğrenilenlere aktar ve aktif çalışma listesinden ÇIKAR
    const learnedBtn = document.getElementById('almancaCardLearned');
    if (learnedBtn) {
      learnedBtn.addEventListener('click', () => {
        const set = getLearnedSet();
        set.add(item.id);
        markDailyWord(item.id);
        playTone('correct');
        saveLearnedSet(set);

        // Aktif listeden çıkar
        activeCardList.splice(currentCardIndex, 1);
        if (currentCardIndex >= activeCardList.length) {
          currentCardIndex = Math.max(0, activeCardList.length - 1);
        }
        isCardFlipped = false;
        renderCardsMode(container);
      });
    }

    // Favori butonu
    const favBtn = document.getElementById('almancaCardFav');
    if (favBtn) {
      favBtn.addEventListener('click', () => {
        const favs = getFavoritesSet();
        if (favs.has(item.id)) favs.delete(item.id);
        else favs.add(item.id);
        saveFavoritesSet(favs);
        renderCardsMode(container);
      });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // MOD 2: CÜMLE PRATİĞİ (BOŞLUK DOLDURMA / LÜCKENTEXT)
  // Sadece henüz öğrenilmemiş cümleler sorulur!
  // ══════════════════════════════════════════════════════════════
  function initSentenceMode() {
    sentenceQuestions = [];
    sentenceCurrentIndex = 0;
    sentenceScore = 0;
    sentenceStreak = 0;
    sentenceAnswered = false;

    const learned = getLearnedSet();
    // Henüz öğrenilmemiş, blank_sentence ve blank_answer olan cümleler
    const pool = wordsData
      .filter(w => w.blank_sentence && w.blank_answer && !learned.has(w.id))
      .sort(() => Math.random() - 0.5);

    const selected = pool.slice(0, 10);
    selected.forEach(correctItem => {
      // Çeldiriciler
      const distractors = wordsData
        .filter(w => w.id !== correctItem.id && w.blank_answer && w.blank_answer.toLowerCase() !== correctItem.blank_answer.toLowerCase() && w.category === correctItem.category)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

      if (distractors.length < 3) {
        const others = wordsData
          .filter(w => w.id !== correctItem.id && w.blank_answer && w.blank_answer.toLowerCase() !== correctItem.blank_answer.toLowerCase() && !distractors.some(d => d.id === w.id))
          .sort(() => Math.random() - 0.5)
          .slice(0, 3 - distractors.length);
        distractors.push(...others);
      }

      const options = [correctItem.blank_answer, ...distractors.map(d => d.blank_answer)].sort(() => Math.random() - 0.5);
      sentenceQuestions.push({
        item: correctItem,
        correctAnswer: correctItem.blank_answer,
        options: options
      });
    });
  }

  function renderSentenceMode(container) {
    if (sentenceQuestions.length === 0 && sentenceCurrentIndex === 0) {
      initSentenceMode();
    }

    // Hiç soru yoksa (tüm cümleler öğrenilmişse)
    if (sentenceQuestions.length === 0) {
      container.innerHTML = `
        <div class="almanca-sentence-box" style="text-align:center; padding:40px 20px;">
          <div style="font-size:48px; margin-bottom:12px;">🌟</div>
          <h3 style="color:#f0f6fc; margin:0 0 8px;">Tüm Cümleleri Öğrendin!</h3>
          <p style="color:#8b949e; font-size:13px; margin-bottom:20px;">
            Cümle pratiğindeki tüm kelimeler öğrenildi alanına aktarıldı.
          </p>
          <button class="almanca-ctrl-btn learned" id="almancaSentGoLearned" style="margin:0 auto; padding:12px 28px;">
            🏆 Öğrendiklerimi İncele
          </button>
        </div>
      `;
      const goBtn = document.getElementById('almancaSentGoLearned');
      if (goBtn) goBtn.addEventListener('click', () => switchMode('learned'));
      return;
    }

    if (sentenceCurrentIndex >= sentenceQuestions.length) {
      // Cümle Turu Sonu
      container.innerHTML = `
        <div class="almanca-sentence-box" style="text-align:center;">
          <div style="font-size:48px; margin-bottom:12px;">🌟</div>
          <h3 style="color:#f0f6fc; margin:0 0 8px;">Cümle Pratiği Tamamlandı!</h3>
          <div style="font-size:20px; font-weight:800; color:#3fb950; margin-bottom:16px;">
            Skorun: ${sentenceScore} / ${(sentenceQuestions.length * 100)}
          </div>
          <p style="color:#8b949e; font-size:13px; margin-bottom:20px;">
            ${sentenceScore >= 800 ? 'Muhteşem! Almanca cümle yapılarını ve kelimelerin bağlamdaki kullanımını kavradın!' : 'Tebrikler! Cümleleri dinleyerek ve tekrar pratik yaparak hızlanabilirsin.'}
          </p>
          <button class="almanca-ctrl-btn learned" id="almancaSentenceRestart" style="margin:0 auto; padding:12px 28px; font-size:15px;">
            Yeni Cümlelere Başla 🔄
          </button>
        </div>
      `;
      document.getElementById('almancaSentenceRestart').addEventListener('click', () => {
        initSentenceMode();
        renderSentenceMode(container);
      });
      return;
    }

    const currentQ = sentenceQuestions[sentenceCurrentIndex];
    const sentenceWithBlank = currentQ.item.blank_sentence.replace('_____', '<span class="almanca-blank-slot" id="almancaSentenceSlot">_____</span>');

    container.innerHTML = `
      <div class="almanca-sentence-box">
        <div class="almanca-quiz-header">
          <span>Cümle ${sentenceCurrentIndex + 1} / ${sentenceQuestions.length}</span>
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="color:#f0883e; font-weight:700;">🔥 Seri: ${sentenceStreak}</span>
            <span class="almanca-quiz-score-badge">Puan: ${sentenceScore}</span>
          </div>
        </div>

        <div class="almanca-quiz-question-card">
          <div class="almanca-quiz-q-label">Cümleyi Doğru Kelimeyle Tamamla</div>
          <div style="font-size:20px; font-weight:800; color:#f0f6fc; margin:8px 0; line-height:1.4;">
            ${sentenceWithBlank}
            <button class="almanca-mini-audio-btn" id="almancaSentenceAudioBtn" style="margin-left:8px; vertical-align:middle;" title="Tüm Cümleyi Dinle">🔊</button>
          </div>
          <div style="font-size:13.5px; color:#58a6ff; font-weight:600; margin-top:8px;">
            🇹🇷 "${currentQ.item.example_tr}"
          </div>
          <div style="font-size:11px; color:#8b949e; margin-top:4px;">
            Hedef Kelime: <strong>${currentQ.item.word}</strong> (${currentQ.item.meaning})
          </div>
        </div>

        <div class="almanca-quiz-options">
          ${currentQ.options.map((opt) => `
            <button class="almanca-quiz-opt almanca-sentence-opt" data-opt="${opt.replace(/"/g, '&quot;')}">
              <span>${opt}</span>
              <span class="opt-indicator"></span>
            </button>
          `).join('')}
        </div>

        <div class="almanca-quiz-next-row" id="almancaSentenceNextRow" style="display:none;">
          <button class="almanca-ctrl-btn learned" id="almancaSentenceNextBtn">Sonraki Cümle ▶</button>
        </div>
      </div>
    `;

    // Cümleyi dinleme butonu
    const audioBtn = document.getElementById('almancaSentenceAudioBtn');
    if (audioBtn) {
      audioBtn.addEventListener('click', () => speakGerman(currentQ.item.example_de));
    }

    // Seçenek butonları
    const optBtns = container.querySelectorAll('.almanca-sentence-opt');
    const slotEl = document.getElementById('almancaSentenceSlot');

    optBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (sentenceAnswered) return;
        sentenceAnswered = true;

        const picked = btn.dataset.opt;
        const isCorrect = picked.toLowerCase() === currentQ.correctAnswer.toLowerCase();

        if (isCorrect) {
          btn.classList.add('correct');
          btn.querySelector('.opt-indicator').textContent = '✓';
          slotEl.textContent = currentQ.correctAnswer;
          slotEl.classList.add('filled');

          sentenceScore += 100 + (sentenceStreak * 15);
          sentenceStreak++;
          playTone('correct');

          // Doğru bilinen kelime öğrenilenlere aktarılır
          const set = getLearnedSet();
          set.add(currentQ.item.id);
          saveLearnedSet(set);
          markDailyWord(currentQ.item.id);

          speakGerman(currentQ.item.example_de);
        } else {
          btn.classList.add('wrong');
          btn.querySelector('.opt-indicator').textContent = '✗';
          slotEl.textContent = currentQ.correctAnswer;
          slotEl.classList.add('filled');
          sentenceStreak = 0;
          playTone('wrong');

          optBtns.forEach(b => {
            if (b.dataset.opt.toLowerCase() === currentQ.correctAnswer.toLowerCase()) {
              b.classList.add('correct');
              b.querySelector('.opt-indicator').textContent = '✓';
            }
          });
          speakGerman(currentQ.item.example_de);
        }

        optBtns.forEach(b => b.disabled = true);
        document.getElementById('almancaSentenceNextRow').style.display = 'flex';
      });
    });

    document.getElementById('almancaSentenceNextBtn').addEventListener('click', () => {
      sentenceAnswered = false;
      sentenceCurrentIndex++;
      renderSentenceMode(container);
    });
  }

  // ══════════════════════════════════════════════════════════════
  // MOD 3: ÇOKTAN SEÇMELİ TEST (QUIZ)
  // Sadece henüz öğrenilmemiş kelimeler test edilir!
  // ══════════════════════════════════════════════════════════════
  function initQuiz() {
    quizQuestions = [];
    quizCurrentIndex = 0;
    quizScore = 0;
    quizStreak = 0;
    quizAnswered = false;

    const learned = getLearnedSet();
    const pool = wordsData.filter(w => !learned.has(w.id)).sort(() => Math.random() - 0.5);
    const selected = pool.slice(0, 10);

    selected.forEach(correctItem => {
      const distractors = wordsData
        .filter(w => w.id !== correctItem.id && w.type === correctItem.type)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

      if (distractors.length < 3) {
        const others = wordsData
          .filter(w => w.id !== correctItem.id && !distractors.some(d => d.id === w.id))
          .sort(() => Math.random() - 0.5)
          .slice(0, 3 - distractors.length);
        distractors.push(...others);
      }

      const options = [correctItem, ...distractors].sort(() => Math.random() - 0.5);
      quizQuestions.push({
        correct: correctItem,
        options: options
      });
    });
  }

  function renderQuizMode(container) {
    if (quizQuestions.length === 0 && quizCurrentIndex === 0) {
      initQuiz();
    }

    if (quizQuestions.length === 0) {
      container.innerHTML = `
        <div class="almanca-quiz-box" style="text-align:center; padding:40px 20px;">
          <div style="font-size:48px; margin-bottom:12px;">🏆</div>
          <h3 style="color:#f0f6fc; margin:0 0 8px;">Tüm Kelimeler Öğrenildi!</h3>
          <p style="color:#8b949e; font-size:13px; margin-bottom:20px;">
            Test havuzundaki tüm kelimeleri başarıyla öğrendin.
          </p>
          <button class="almanca-ctrl-btn learned" id="almancaQuizGoLearned" style="margin:0 auto; padding:12px 28px;">
            🏆 Öğrendiklerimi Görüntüle
          </button>
        </div>
      `;
      const goBtn = document.getElementById('almancaQuizGoLearned');
      if (goBtn) goBtn.addEventListener('click', () => switchMode('learned'));
      return;
    }

    if (quizCurrentIndex >= quizQuestions.length) {
      // Test Sonu Ekranı
      container.innerHTML = `
        <div class="almanca-quiz-box" style="text-align:center;">
          <div style="font-size:48px; margin-bottom:12px;">🏆</div>
          <h3 style="color:#f0f6fc; margin:0 0 8px;">Test Tamamlandı!</h3>
          <div style="font-size:20px; font-weight:800; color:#3fb950; margin-bottom:16px;">
            Skorun: ${quizScore} / ${(quizQuestions.length * 100)}
          </div>
          <p style="color:#8b949e; font-size:13px; margin-bottom:20px;">
            ${quizScore >= 800 ? 'Harika iş başardın! Almanca A1 kelimelerinde çok iyisin. 🌟' : 'Güzel deneme! Kelime kartlarıyla ve örnek cümlelerle tekrar ederek skorunu yükseltebilirsin.'}
          </p>
          <button class="almanca-ctrl-btn learned" id="almancaQuizRestart" style="margin:0 auto; padding:12px 28px; font-size:15px;">
            Yeni Teste Başla 🔄
          </button>
        </div>
      `;
      document.getElementById('almancaQuizRestart').addEventListener('click', () => {
        initQuiz();
        renderQuizMode(container);
      });
      return;
    }

    const currentQ = quizQuestions[quizCurrentIndex];
    const isDeToTr = quizDirection === 'de_tr';

    container.innerHTML = `
      <div class="almanca-quiz-box">
        <div class="almanca-quiz-header">
          <span>Soru ${quizCurrentIndex + 1} / ${quizQuestions.length}</span>
          <div style="display:flex; align-items:center; gap:10px;">
            <button id="almancaQuizDirToggle" style="background:none;border:none;color:#58a6ff;font-size:12px;font-weight:600;cursor:pointer;">
              ${isDeToTr ? 'Almanca ➔ Türkçe' : 'Türkçe ➔ Almanca'} ⇄
            </button>
            <span class="almanca-quiz-score-badge">Puan: ${quizScore}</span>
          </div>
        </div>

        <div class="almanca-quiz-question-card">
          <div class="almanca-quiz-q-label">
            ${isDeToTr ? 'Bu Almanca ifadenin Türkçe anlamı nedir?' : 'Bu Türkçe ifadenin Almanca karşılığı nedir?'}
          </div>
          <div class="almanca-quiz-q-word">
            ${isDeToTr ? (currentQ.correct.word || currentQ.correct.full) : currentQ.correct.meaning}
            ${isDeToTr ? `
              <button class="almanca-card-audio-btn" id="almancaQuizAudioBtn" style="width:30px;height:30px;font-size:13px;" title="Dinle">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                </svg>
              </button>` : ''}
          </div>
          ${isDeToTr && currentQ.correct.plural ? `<div class="almanca-quiz-q-sub">Çoğul: ${currentQ.correct.plural}</div>` : ''}
          ${isDeToTr && currentQ.correct.forms ? `<div class="almanca-quiz-q-sub">${currentQ.correct.forms}</div>` : ''}
        </div>

        <div class="almanca-quiz-options">
          ${currentQ.options.map((opt, idx) => `
            <button class="almanca-quiz-opt" data-idx="${idx}">
              <span>${isDeToTr ? opt.meaning : (opt.full || opt.word)}</span>
              <span class="opt-indicator"></span>
            </button>
          `).join('')}
        </div>

        <div id="almancaQuizExampleBox"></div>

        <div class="almanca-quiz-next-row" id="almancaQuizNextRow" style="display:none;">
          <button class="almanca-ctrl-btn learned" id="almancaQuizNextBtn">Sonraki Soru ▶</button>
        </div>
      </div>
    `;

    // Ses
    const audioBtn = document.getElementById('almancaQuizAudioBtn');
    if (audioBtn) {
      audioBtn.addEventListener('click', () => speakGerman(currentQ.correct.full || currentQ.correct.word));
      speakGerman(currentQ.correct.full || currentQ.correct.word);
    }

    // Yön değiştirme
    document.getElementById('almancaQuizDirToggle').addEventListener('click', () => {
      quizDirection = quizDirection === 'de_tr' ? 'tr_de' : 'de_tr';
      renderQuizMode(container);
    });

    // Şık seçimi
    const optBtns = container.querySelectorAll('.almanca-quiz-opt');
    optBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (quizAnswered) return;
        quizAnswered = true;

        const idx = parseInt(btn.dataset.idx, 10);
        const chosen = currentQ.options[idx];
        const isCorrect = chosen.id === currentQ.correct.id;

        if (isCorrect) {
          btn.classList.add('correct');
          btn.querySelector('.opt-indicator').textContent = '✓';
          quizScore += 100 + (quizStreak * 10);
          quizStreak++;
          playTone('correct');

          // Doğru bilinen kelimeyi öğrenilenlere ekle
          const set = getLearnedSet();
          set.add(currentQ.correct.id);
          saveLearnedSet(set);
          markDailyWord(currentQ.correct.id);
        } else {
          btn.classList.add('wrong');
          btn.querySelector('.opt-indicator').textContent = '✗';
          quizStreak = 0;
          playTone('wrong');

          optBtns.forEach(b => {
            const optIdx = parseInt(b.dataset.idx, 10);
            if (currentQ.options[optIdx].id === currentQ.correct.id) {
              b.classList.add('correct');
              b.querySelector('.opt-indicator').textContent = '✓';
            }
          });
        }

        // Örnek cümle ipucu kutusu göster
        if (currentQ.correct.example_de) {
          const exBox = document.getElementById('almancaQuizExampleBox');
          exBox.innerHTML = `
            <div class="almanca-quiz-example-reveal">
              <div style="font-size:10px; font-weight:800; color:#58a6ff; margin-bottom:3px; text-transform:uppercase;">💡 Örnek Cümle:</div>
              <div style="font-size:13.5px; color:#f0f6fc; font-weight:700; display:flex; align-items:center; justify-content:space-between; gap:8px;">
                <span>💬 ${currentQ.correct.example_de}</span>
                <button class="almanca-mini-audio-btn" id="almancaQuizExAudio" title="Cümleyi Dinle">🔊</button>
              </div>
              <div style="font-size:12px; color:#8b949e; margin-top:2px; font-style:italic;">${currentQ.correct.example_tr}</div>
            </div>
          `;
          const exAudio = document.getElementById('almancaQuizExAudio');
          if (exAudio) {
            exAudio.addEventListener('click', () => speakGerman(currentQ.correct.example_de));
          }
        }

        optBtns.forEach(b => b.disabled = true);
        document.getElementById('almancaQuizNextRow').style.display = 'flex';
      });
    });

    const nextBtn = document.getElementById('almancaQuizNextBtn');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        quizAnswered = false;
        quizCurrentIndex++;
        renderQuizMode(container);
      });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // MOD 4: ARTIKEL AVCISI (der / die / das)
  // Sadece öğrenilmemiş isimler sorulur!
  // ══════════════════════════════════════════════════════════════
  function initArtikelMode() {
    const learned = getLearnedSet();
    artikelList = wordsData
      .filter(w => w.type === 'Nomen' && (w.article === 'der' || w.article === 'die' || w.article === 'das') && !learned.has(w.id))
      .sort(() => Math.random() - 0.5);
    artikelCurrentIndex = 0;
    artikelStreak = 0;
    artikelAnswered = false;
  }

  function renderArtikelMode(container) {
    if (artikelList.length === 0 && artikelCurrentIndex === 0) {
      initArtikelMode();
    }

    if (artikelList.length === 0) {
      container.innerHTML = `
        <div class="almanca-artikel-box" style="text-align:center; padding:40px 20px;">
          <div style="font-size:48px; margin-bottom:12px;">🎯</div>
          <h3 style="color:#f0f6fc; margin:0 0 8px;">Tüm İsimlerin Artikellerini Öğrendin!</h3>
          <p style="color:#8b949e; font-size:13px; margin-bottom:20px;">
            der / die / das modundaki tüm isimler öğrenilenlere aktarıldı.
          </p>
          <button class="almanca-ctrl-btn learned" id="almancaArtGoLearned" style="margin:0 auto; padding:12px 28px;">
            🏆 Öğrendiklerimi Görüntüle
          </button>
        </div>
      `;
      const goBtn = document.getElementById('almancaArtGoLearned');
      if (goBtn) goBtn.addEventListener('click', () => switchMode('learned'));
      return;
    }

    if (artikelCurrentIndex >= artikelList.length) {
      initArtikelMode();
    }

    const currentNoun = artikelList[artikelCurrentIndex];
    if (!currentNoun) {
      container.innerHTML = '<div>İsim bulunamadı.</div>';
      return;
    }

    container.innerHTML = `
      <div class="almanca-artikel-box">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; font-size:13px; color:#8b949e;">
          <span>Kalan İsim: ${artikelCurrentIndex + 1} / ${artikelList.length}</span>
          <span style="color:#f0883e; font-weight:700;">🔥 Seri: ${artikelStreak}</span>
        </div>

        <div class="almanca-artikel-target">
          <div class="almanca-artikel-noun">${currentNoun.word}</div>
          <div class="almanca-artikel-meaning">${currentNoun.meaning}</div>
          ${currentNoun.plural ? `<div style="font-size:12px; color:#6e7681; margin-top:6px;">Çoğul: ${currentNoun.plural}</div>` : ''}
        </div>

        <div class="almanca-artikel-buttons">
          <button class="almanca-art-btn der" data-art="der">der</button>
          <button class="almanca-art-btn die" data-art="die">die</button>
          <button class="almanca-art-btn das" data-art="das">das</button>
        </div>

        <div class="almanca-artikel-feedback" id="almancaArtFeedback"></div>

        <div id="almancaArtNextRow" style="margin-top:16px; display:none; justify-content:center;">
          <button class="almanca-ctrl-btn learned" id="almancaArtNextBtn">Sonraki Kelime ▶</button>
        </div>
      </div>
    `;

    const feedbackEl = document.getElementById('almancaArtFeedback');
    const nextRow = document.getElementById('almancaArtNextRow');

    container.querySelectorAll('.almanca-art-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (artikelAnswered) return;
        artikelAnswered = true;

        const picked = btn.dataset.art;
        const correctArt = currentNoun.article.toLowerCase();
        const isCorrect = picked === correctArt;

        let exampleSnippet = '';
        if (currentNoun.example_de) {
          exampleSnippet = `
            <div style="margin-top:8px; padding:8px 10px; background:rgba(0,0,0,0.25); border-radius:10px; text-align:left;">
              <div style="font-size:12.5px; color:#f0f6fc; font-weight:700; display:flex; justify-content:space-between; align-items:center;">
                <span>💬 ${currentNoun.example_de}</span>
                <button class="almanca-mini-audio-btn" id="almancaArtSentAudio">🔊</button>
              </div>
              <div style="font-size:11.5px; color:#8b949e; font-style:italic;">${currentNoun.example_tr}</div>
            </div>
          `;
        }

        if (isCorrect) {
          artikelStreak++;
          playTone('correct');
          feedbackEl.innerHTML = `<span style="color:#3fb950;">✓ Harika! <strong>${currentNoun.full}</strong></span>` + exampleSnippet;

          // Doğru bilinen ismi öğrenilenlere aktar
          const set = getLearnedSet();
          set.add(currentNoun.id);
          saveLearnedSet(set);
          markDailyWord(currentNoun.id);
        } else {
          artikelStreak = 0;
          playTone('wrong');
          feedbackEl.innerHTML = `<span style="color:#f85149;">✗ Yanlış! Doğrusu: <strong>${currentNoun.full}</strong></span>` + exampleSnippet;
        }

        speakGerman(currentNoun.full);

        const artSentBtn = document.getElementById('almancaArtSentAudio');
        if (artSentBtn && currentNoun.example_de) {
          artSentBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            speakGerman(currentNoun.example_de);
          });
        }

        container.querySelectorAll('.almanca-art-btn').forEach(b => b.disabled = true);
        nextRow.style.display = 'flex';
      });
    });

    document.getElementById('almancaArtNextBtn').addEventListener('click', () => {
      artikelAnswered = false;
      artikelCurrentIndex++;
      renderArtikelMode(container);
    });
  }

  // ══════════════════════════════════════════════════════════════
  // MOD 5: EŞLEŞTİRME OYUNU (MATCH GAME)
  // Sadece öğrenilmemiş kelimeler eşleştirilir!
  // ══════════════════════════════════════════════════════════════
  function initMatchPairs() {
    matchSelectedDe = null;
    matchSelectedTr = null;

    const learned = getLearnedSet();
    let pool = wordsData.filter(w => !learned.has(w.id)).sort(() => Math.random() - 0.5).slice(0, 4);

    if (pool.length < 4) {
      // Yeterli öğrenilmemiş kelime yoksa tüm listeden tamamla
      pool = [...wordsData].sort(() => Math.random() - 0.5).slice(0, 4);
    }

    const deCards = pool.map(w => ({ id: w.id, text: w.word || w.full, fullDe: w.full }));
    const trCards = pool.map(w => ({ id: w.id, text: w.meaning.split(';')[0].split(',')[0].trim() }));

    matchPairs = {
      de: deCards.sort(() => Math.random() - 0.5),
      tr: trCards.sort(() => Math.random() - 0.5),
      matchedIds: new Set()
    };
  }

  function renderMatchMode(container) {
    if (!matchPairs.de || matchPairs.de.length === 0 || matchPairs.matchedIds.size === 4) {
      initMatchPairs();
    }

    container.innerHTML = `
      <div style="text-align:center; margin-bottom:14px; font-size:13px; color:#8b949e;">
        Almanca kelimeye dokun, ardından Türkçe karşılığını seç! Doğru eşleşenler <strong>Öğrendiklerim</strong> alanına aktarılır.
      </div>
      <div class="almanca-match-grid">
        <div class="almanca-match-col" id="almancaMatchDeCol">
          ${matchPairs.de.map(item => `
            <div class="almanca-match-tile ${matchPairs.matchedIds.has(item.id) ? 'matched' : ''}" data-type="de" data-id="${item.id}" data-speak="${item.fullDe}">
              ${item.text}
            </div>
          `).join('')}
        </div>
        <div class="almanca-match-col" id="almancaMatchTrCol">
          ${matchPairs.tr.map(item => `
            <div class="almanca-match-tile ${matchPairs.matchedIds.has(item.id) ? 'matched' : ''}" data-type="tr" data-id="${item.id}">
              ${item.text}
            </div>
          `).join('')}
        </div>
      </div>
      <div style="text-align:center; margin-top:16px;">
        <button id="almancaMatchResetBtn" style="background:none; border:none; color:#58a6ff; font-size:13px; font-weight:600; cursor:pointer;">
          Yeni 4 Kelime Getir ↻
        </button>
      </div>
    `;

    document.getElementById('almancaMatchResetBtn').addEventListener('click', () => {
      initMatchPairs();
      renderMatchMode(container);
    });

    const tiles = container.querySelectorAll('.almanca-match-tile:not(.matched)');
    tiles.forEach(tile => {
      tile.addEventListener('click', () => {
        const type = tile.dataset.type;
        const id = parseInt(tile.dataset.id, 10);

        if (type === 'de') {
          container.querySelectorAll('.almanca-match-tile[data-type="de"]').forEach(t => t.classList.remove('selected'));
          tile.classList.add('selected');
          matchSelectedDe = { id, el: tile, speakText: tile.dataset.speak };
          speakGerman(tile.dataset.speak);
        } else {
          container.querySelectorAll('.almanca-match-tile[data-type="tr"]').forEach(t => t.classList.remove('selected'));
          tile.classList.add('selected');
          matchSelectedTr = { id, el: tile };
        }

        if (matchSelectedDe && matchSelectedTr) {
          if (matchSelectedDe.id === matchSelectedTr.id) {
            playTone('correct');
            matchPairs.matchedIds.add(matchSelectedDe.id);

            // Doğru eşleşen kelime öğrenilenlere aktarılır
            const set = getLearnedSet();
            set.add(matchSelectedDe.id);
            saveLearnedSet(set);
            markDailyWord(matchSelectedDe.id);

            matchSelectedDe.el.classList.remove('selected');
            matchSelectedTr.el.classList.remove('selected');
            matchSelectedDe.el.classList.add('matched');
            matchSelectedTr.el.classList.add('matched');

            matchSelectedDe = null;
            matchSelectedTr = null;

            if (matchPairs.matchedIds.size === 4) {
              setTimeout(() => {
                triggerCelebration();
                initMatchPairs();
                renderMatchMode(container);
              }, 600);
            }
          } else {
            playTone('wrong');
            const dEl = matchSelectedDe.el;
            const tEl = matchSelectedTr.el;
            setTimeout(() => {
              dEl.classList.remove('selected');
              tEl.classList.remove('selected');
            }, 400);
            matchSelectedDe = null;
            matchSelectedTr = null;
          }
        }
      });
    });
  }

  // ══════════════════════════════════════════════════════════════
  // MOD 6: YENİ! 🏆 ÖĞRENDİKLERİM HAVUZU (LEARNED WORDS & UNLEARN)
  // Öğrenilen tüm kelimeler burada toplanır, istenirse geri alınabilir
  // ══════════════════════════════════════════════════════════════
  function renderLearnedMode(container) {
    const learned = getLearnedSet();
    const favs = getFavoritesSet();
    const total = wordsData.length || 903;
    const learnedList = wordsData.filter(w => learned.has(w.id));
    const pct = total > 0 ? Math.round((learnedList.length / total) * 100) : 0;

    let filtered = [...learnedList];
    if (learnedFilter === 'verb') filtered = filtered.filter(w => w.type === 'Verb' || w.category === 'Fiiller');
    else if (learnedFilter === 'nomen') filtered = filtered.filter(w => w.type === 'Nomen' || w.category === 'İsimler');
    else if (learnedFilter === 'adj') filtered = filtered.filter(w => w.type === 'Adjektiv' || w.category === 'Sıfatlar');
    else if (learnedFilter === 'fav') filtered = filtered.filter(w => favs.has(w.id));

    if (learnedSearchQuery.trim()) {
      const q = learnedSearchQuery.trim().toLowerCase();
      filtered = filtered.filter(w =>
        w.full.toLowerCase().includes(q) ||
        w.meaning.toLowerCase().includes(q) ||
        (w.example_de && w.example_de.toLowerCase().includes(q)) ||
        (w.example_tr && w.example_tr.toLowerCase().includes(q))
      );
    }

    container.innerHTML = `
      <!-- Learned Header / Stats -->
      <div class="almanca-learned-header">
        <div class="almanca-learned-header-top">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:22px;">🏆</span>
            <div>
              <div style="color:#f0f6fc; font-weight:800; font-size:14.5px;">Öğrendiğim Kelimeler (${learnedList.length})</div>
              <div style="color:#8b949e; font-size:12px;">Bu kelimeler çalışma modlarında tekrar çıkmaz. İstersen tekrar çalışmaya alabilirsin.</div>
            </div>
          </div>
          ${learnedList.length > 0 ? `
            <button class="almanca-learned-reset-btn" id="almancaLearnedResetAllBtn" title="Tüm öğrendiklerimi çalışma alanına geri aktar">
              🗑️ Tümünü Sıfırla
            </button>
          ` : ''}
        </div>

        <div class="almanca-daily-progress-container" style="margin-top:12px;">
          <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px; font-weight:700;">
            <span style="color:#3fb950;">A1 Başarı Oranı: %${pct}</span>
            <span style="color:#8b949e;">${learnedList.length} / ${total} Kelime</span>
          </div>
          <div class="almanca-daily-prog-bar">
            <div class="almanca-daily-prog-fill" style="width: ${pct}%; background:#3fb950;"></div>
          </div>
        </div>
      </div>

      <!-- Arama ve Filtreler -->
      <div style="display:flex; gap:10px; margin-bottom:12px; flex-wrap:wrap;">
        <div style="flex:1; min-width:200px; position:relative;">
          <input type="text" id="almancaLearnedSearch" placeholder="Öğrendiklerin arasında ara..." value="${learnedSearchQuery}"
            style="width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:8px 12px; font-size:13px; color:#fff; box-sizing:border-box;">
        </div>
      </div>

      <div class="almanca-filter-row">
        <button class="almanca-filter-pill ${learnedFilter === 'all' ? 'active' : ''}" data-lfilter="all">Tümü (${learnedList.length})</button>
        <button class="almanca-filter-pill ${learnedFilter === 'verb' ? 'active' : ''}" data-lfilter="verb">Fiiller</button>
        <button class="almanca-filter-pill ${learnedFilter === 'nomen' ? 'active' : ''}" data-lfilter="nomen">İsimler</button>
        <button class="almanca-filter-pill ${learnedFilter === 'adj' ? 'active' : ''}" data-lfilter="adj">Sıfatlar</button>
        <button class="almanca-filter-pill ${learnedFilter === 'fav' ? 'active' : ''}" data-lfilter="fav">⭐ Favoriler</button>
      </div>

      <!-- Liste -->
      <div class="almanca-learned-list-wrap">
        ${filtered.length === 0 ? `
          <div style="text-align:center; padding:40px 16px; color:#8b949e;">
            ${learnedList.length === 0 ?
              'Henüz öğrenilen kelime bulunmuyor. Kelime kartlarında <strong>"✓ Öğrendim"</strong> butonuna basarak veya test ve oyunları çözerek kelimeleri buraya aktarabilirsin! 🚀' :
              'Filtrenize veya aramanıza uygun öğrenilmiş kelime bulunamadı.'}
          </div>
        ` : filtered.map(item => `
          <div class="almanca-learned-card" id="learned-card-${item.id}">
            <div class="almanca-learned-card-top">
              <div class="almanca-learned-word-title">
                ${getBadgeHtml(item)}
                <span style="margin-left:6px;">${item.full}</span>
              </div>
              <div class="almanca-learned-actions">
                <button class="almanca-icon-btn speak-btn" data-word="${item.full}" title="Kelimeyi Dinle">🔊</button>
                <button class="almanca-unlearn-btn" data-id="${item.id}" title="Bu kelimeyi tekrar aktif çalışma ve test modlarına ekle">
                  ↺ Tekrar Çalışmaya Al
                </button>
              </div>
            </div>
            <div class="almanca-learned-meaning">${item.meaning}</div>
            ${item.plural ? `<div style="font-size:11.5px; color:#8b949e; margin-top:2px;">Çoğul: ${item.plural}</div>` : ''}
            ${item.forms ? `<div style="font-size:11.5px; color:#8b949e; margin-top:2px;">${item.forms}</div>` : ''}
            ${item.example_de ? `
              <div class="almanca-learned-example">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="color:#f0f6fc; font-weight:600;">💬 ${item.example_de}</span>
                  <button class="almanca-mini-audio-btn almanca-speak-learned-sentence" data-sentence="${item.example_de.replace(/"/g, '&quot;')}" title="Cümleyi Dinle">🔊</button>
                </div>
                <div style="color:#8b949e; font-style:italic; margin-top:2px;">${item.example_tr}</div>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;

    // Arama dinleyicisi
    const searchInput = document.getElementById('almancaLearnedSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        learnedSearchQuery = e.target.value;
        renderLearnedMode(container);
      });
    }

    // Filtre butonları
    container.querySelectorAll('.almanca-filter-pill[data-lfilter]').forEach(btn => {
      btn.addEventListener('click', () => {
        learnedFilter = btn.dataset.lfilter;
        renderLearnedMode(container);
      });
    });

    // Kelime ses butonları
    container.querySelectorAll('.speak-btn').forEach(btn => {
      btn.addEventListener('click', () => speakGerman(btn.dataset.word));
    });

    // Cümle ses butonları
    container.querySelectorAll('.almanca-speak-learned-sentence').forEach(btn => {
      btn.addEventListener('click', () => speakGerman(btn.dataset.sentence));
    });

    // Tekrar Çalışmaya Al (Unlearn) Butonu
    container.querySelectorAll('.almanca-unlearn-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id, 10);
        const set = getLearnedSet();
        set.delete(id);
        saveLearnedSet(set);
        prepareCardList();
        renderLearnedMode(container);
      });
    });

    // Tümünü Sıfırla Butonu
    const resetAllBtn = document.getElementById('almancaLearnedResetAllBtn');
    if (resetAllBtn) {
      resetAllBtn.addEventListener('click', () => {
        if (confirm('Tüm öğrenilen kelimeleri sıfırlayıp tekrar çalışma alanına aktarmak istediğine emin misin?')) {
          saveLearnedSet(new Set());
          prepareCardList();
          renderLearnedMode(container);
        }
      });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // MOD 7: SÖZLÜK & CÜMLE HAVUZU (VOCABULARY & SENTENCE LIST)
  // ══════════════════════════════════════════════════════════════
  function renderVocabMode(container) {
    const learned = getLearnedSet();
    const favs = getFavoritesSet();

    let filtered = filterWords(wordsData, currentFilter);
    if (vocabSearchQuery.trim()) {
      const q = vocabSearchQuery.trim().toLowerCase();
      filtered = filtered.filter(w =>
        w.full.toLowerCase().includes(q) ||
        w.meaning.toLowerCase().includes(q) ||
        (w.example_de && w.example_de.toLowerCase().includes(q)) ||
        (w.example_tr && w.example_tr.toLowerCase().includes(q))
      );
    }

    container.innerHTML = `
      <div style="display:flex; gap:10px; margin-bottom:12px; flex-wrap:wrap;">
        <div style="flex:1; min-width:200px; position:relative;">
          <input type="text" id="almancaVocabSearch" placeholder="Almanca, Türkçe veya örnek cümle ara..." value="${vocabSearchQuery}"
            style="width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:8px 12px; font-size:13px; color:#fff; box-sizing:border-box;">
        </div>
      </div>

      <div class="almanca-filter-row">
        <button class="almanca-filter-pill ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">Tümü (${wordsData.length})</button>
        <button class="almanca-filter-pill ${currentFilter === 'examples' ? 'active' : ''}" data-filter="examples">💬 Örnek Cümleliler</button>
        <button class="almanca-filter-pill ${currentFilter === 'verb' ? 'active' : ''}" data-filter="verb">Fiiller</button>
        <button class="almanca-filter-pill ${currentFilter === 'nomen' ? 'active' : ''}" data-filter="nomen">İsimler</button>
        <button class="almanca-filter-pill ${currentFilter === 'adj' ? 'active' : ''}" data-filter="adj">Sıfatlar</button>
        <button class="almanca-filter-pill ${currentFilter === 'adverb' ? 'active' : ''}" data-filter="adverb">Zarflar & Konum</button>
        <button class="almanca-filter-pill ${currentFilter === 'zeit' ? 'active' : ''}" data-filter="zeit">Zaman & Günlük</button>
        <button class="almanca-filter-pill ${currentFilter === 'frage' ? 'active' : ''}" data-filter="frage">Soru & Bağlaç</button>
        <button class="almanca-filter-pill ${currentFilter === 'fav' ? 'active' : ''}" data-filter="fav">⭐ Favoriler (${favs.size})</button>
      </div>

      <div class="almanca-vocab-list-wrap">
        ${filtered.length === 0 ? '<div style="text-align:center;padding:30px;color:#8b949e;">Sonuç bulunamadı.</div>' :
          filtered.slice(0, 100).map(item => `
            <div class="almanca-vocab-row">
              <div class="almanca-vocab-left">
                <button class="almanca-icon-btn almanca-check-btn ${learned.has(item.id) ? 'checked' : ''}" data-id="${item.id}" title="${learned.has(item.id) ? 'Öğrenildi (Öğrendiklerim alanında)' : 'Öğrendim olarak işaretle'}">
                  ${learned.has(item.id) ? '✅' : '⚪'}
                </button>
                <div class="almanca-vocab-texts">
                  <div class="almanca-vocab-de">
                    ${getBadgeHtml(item)}
                    <span>${item.full}</span>
                  </div>
                  <div class="almanca-vocab-tr">${item.meaning}</div>
                  ${item.example_de ? `
                    <div class="almanca-vocab-example">
                      <span>💬 <em>${item.example_de}</em> — <span style="color:#8b949e;">${item.example_tr}</span></span>
                      <button class="almanca-mini-audio-btn almanca-speak-vocab-sentence" data-sentence="${item.example_de.replace(/"/g, '&quot;')}" title="Cümleyi Dinle">🔊</button>
                    </div>
                  ` : ''}
                </div>
              </div>
              <div class="almanca-vocab-actions">
                <button class="almanca-icon-btn speak-btn" data-word="${item.full}" title="Kelimeyi Dinle">🔊</button>
                <button class="almanca-icon-btn fav-btn ${favs.has(item.id) ? 'active' : ''}" data-id="${item.id}" title="Favori">
                  ${favs.has(item.id) ? '⭐' : '☆'}
                </button>
              </div>
            </div>
          `).join('')}
      </div>
      <div style="font-size:11px; color:#6e7681; margin-top:8px; text-align:right;">
        ${filtered.length} kelime listeleniyor (İlk 100 gösteriliyor)
      </div>
    `;

    // Arama dinleyicisi
    const searchInput = document.getElementById('almancaVocabSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        vocabSearchQuery = e.target.value;
        renderVocabMode(container);
      });
    }

    // Filtre butonları
    container.querySelectorAll('.almanca-filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        currentFilter = btn.dataset.filter;
        renderVocabMode(container);
      });
    });

    // Kelime ses butonları
    container.querySelectorAll('.speak-btn').forEach(btn => {
      btn.addEventListener('click', () => speakGerman(btn.dataset.word));
    });

    // Cümle ses butonları
    container.querySelectorAll('.almanca-speak-vocab-sentence').forEach(btn => {
      btn.addEventListener('click', () => speakGerman(btn.dataset.sentence));
    });

    // Öğrenildi butonları
    container.querySelectorAll('.almanca-check-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id, 10);
        const set = getLearnedSet();
        if (set.has(id)) set.delete(id);
        else {
          set.add(id);
          markDailyWord(id);
          playTone('correct');
        }
        saveLearnedSet(set);
        prepareCardList();
        renderVocabMode(container);
      });
    });

    // Favori butonları
    container.querySelectorAll('.fav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id, 10);
        const set = getFavoritesSet();
        if (set.has(id)) set.delete(id);
        else set.add(id);
        saveFavoritesSet(set);
        renderVocabMode(container);
      });
    });
  }

  // ── BAŞLATMA (INIT) ──────────────────────────────────────────
  function init() {
    if (window.ALMANCA_A1_DATA && window.ALMANCA_A1_DATA.length > 0) {
      wordsData = window.ALMANCA_A1_DATA;
      renderWidgetSkeleton();
    } else {
      fetch('almanca/a1_kelimeler.json')
        .then(res => res.json())
        .then(data => {
          wordsData = data;
          window.ALMANCA_A1_DATA = data;
          renderWidgetSkeleton();
        })
        .catch(err => {
          console.warn('Almanca A1 JSON yüklenemedi:', err);
        });
    }
  }

  // Sayfa yüklendiğinde ve sekme açıldığında başlat
  function setupEvents() {
    init();
    const notesTabBtn = document.querySelector('.tab-btn[data-tab="notes"]');
    if (notesTabBtn) {
      notesTabBtn.addEventListener('click', () => {
        closeModal(); // Notlar sekmesine her tıklandığında varsayılan olarak kapalı tut
        updateWidgetStats();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupEvents);
  } else {
    setupEvents();
  }

  // Global API
  window.AlmancaOyun = {
    init,
    updateStats: updateWidgetStats,
    speak: speakGerman,
    openModal,
    closeModal,
    switchMode
  };

})();
