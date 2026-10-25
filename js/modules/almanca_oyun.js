// js/modules/almanca_oyun.js - Almanca A1 Kelime Pratiği & Oyun Motoru

(function () {
  'use strict';

  // ── DURUM & VERİ ──────────────────────────────────────────────
  let wordsData = [];
  let currentMode = 'cards'; // 'cards' | 'quiz' | 'artikel' | 'match' | 'vocab'
  let currentFilter = 'all'; // 'all' | 'verb' | 'nomen' | 'adj' | 'diger' | 'fav' | 'unlearned'
  let isExpanded = true;

  // Kart modu
  let activeCardList = [];
  let currentCardIndex = 0;
  let isCardFlipped = false;

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
  let matchPairs = [];
  let matchCompletedCount = 0;

  // Sözlük arama
  let vocabSearchQuery = '';

  // ── YEREL DEPOLAMA (LOCALSTORAGE) ────────────────────────────
  const STORAGE_KEYS = {
    LEARNED: 'almanca_oyun_learned',
    FAVORITES: 'almanca_oyun_favorites',
    DAILY: 'almanca_oyun_daily',
    EXPANDED: 'almanca_oyun_expanded'
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
    localStorage.setItem(STORAGE_KEYS.LEARNED, JSON.stringify(Array.from(set)));
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
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(Array.from(set)));
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
      localStorage.setItem(STORAGE_KEYS.DAILY, JSON.stringify(daily));
      updateWidgetStats();
    }
  }

  // ── SES EFEKTLERİ & TELAFFUZ ──────────────────────────────────
  function speakGerman(text) {
    if (!window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      // Artikelsiz veya parantezsiz temizle
      const cleanText = text.replace(/^(der|die|das)\s+/i, '').replace(/\(.*?\)/g, '').split(',')[0].trim();
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
      return `<span class="almanca-article-badge diger">diğer</span>`;
    }
  }

  // ── FİLTRELEME & KARTLARI HAZIRLAMA ─────────────────────────
  function filterWords(list, filter) {
    const learned = getLearnedSet();
    const favs = getFavoritesSet();

    if (filter === 'verb') return list.filter(w => w.type === 'Verb');
    if (filter === 'nomen') return list.filter(w => w.type === 'Nomen');
    if (filter === 'adj') return list.filter(w => w.type === 'Adjektiv');
    if (filter === 'diger') return list.filter(w => w.type === 'Diğer');
    if (filter === 'fav') return list.filter(w => favs.has(w.id));
    if (filter === 'unlearned') return list.filter(w => !learned.has(w.id));
    return list;
  }

  function prepareCardList() {
    activeCardList = filterWords(wordsData, currentFilter);
    if (activeCardList.length === 0) {
      activeCardList = wordsData;
    }
    currentCardIndex = 0;
    isCardFlipped = false;
  }

  // ── RENDER: WIDGET İSKELETİ ───────────────────────────────────
  function renderWidgetSkeleton() {
    const container = document.getElementById('germanStudyWidget');
    if (!container) return;

    const storedExp = localStorage.getItem(STORAGE_KEYS.EXPANDED);
    if (storedExp !== null) {
      isExpanded = storedExp === 'true';
    }

    container.innerHTML = `
      <div class="almanca-widget-wrap">
        <div class="almanca-widget-header" id="almancaToggleHeader" title="Aç / Kapat">
          <div class="almanca-widget-title-area">
            <div class="almanca-flag-badge">🇩🇪</div>
            <div class="almanca-widget-titles">
              <div class="almanca-widget-title">
                Almanca Çalış & Oyna
                <span class="almanca-level-tag">A1</span>
              </div>
              <div class="almanca-widget-sub">Goethe & Telc A1 Temel 801 Kelime ve Fiil Listesi</div>
            </div>
          </div>
          <div class="almanca-header-actions">
            <button class="almanca-toggle-btn" id="almancaToggleBtn">
              <span id="almancaToggleText">${isExpanded ? 'Gizle' : 'Çalış'}</span>
              <svg id="almancaToggleIcon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transform:${isExpanded ? 'rotate(180deg)' : 'rotate(0)'}; transition: transform 0.2s;">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          </div>
        </div>

        <!-- STATS & DAILY BAR -->
        <div class="almanca-quick-bar">
          <div class="almanca-stats-chips">
            <div class="almanca-stat-chip goal" id="almancaDailyChip">
              🎯 Günlük Hedef: <strong id="almancaDailyCount">0/10</strong>
            </div>
            <div class="almanca-stat-chip streak" id="almancaStreakChip">
              🔥 <strong id="almancaStreakDays">1</strong> Günlük Seri
            </div>
            <div class="almanca-stat-chip learned" id="almancaLearnedChip">
              🧠 <strong id="almancaLearnedCount">0/801</strong> Öğrenildi
            </div>
          </div>
          <div class="almanca-daily-progress-container">
            <div class="almanca-daily-prog-bar">
              <div class="almanca-daily-prog-fill" id="almancaDailyBarFill" style="width: 0%;"></div>
            </div>
          </div>
        </div>

        <!-- EXPANDABLE GAME ARENA -->
        <div class="almanca-expanded-arena" id="almancaArena" style="display: ${isExpanded ? 'block' : 'none'};">
          <!-- Mod Sekmeleri -->
          <div class="almanca-mode-tabs">
            <button class="almanca-mode-tab ${currentMode === 'cards' ? 'active' : ''}" data-mode="cards">
              🃏 Kelime Kartları
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
            <button class="almanca-mode-tab ${currentMode === 'vocab' ? 'active' : ''}" data-mode="vocab">
              📖 Kelime Havuzu
            </button>
          </div>

          <!-- Mod İçeriği -->
          <div id="almancaModeContent"></div>
        </div>
      </div>
    `;

    // Event Dinleyicileri
    const headerToggle = document.getElementById('almancaToggleHeader');
    headerToggle.addEventListener('click', toggleWidgetExpanded);

    document.querySelectorAll('.almanca-mode-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mode = btn.dataset.mode;
        switchMode(mode);
      });
    });

    updateWidgetStats();
    renderCurrentMode();
  }

  function toggleWidgetExpanded() {
    isExpanded = !isExpanded;
    localStorage.setItem(STORAGE_KEYS.EXPANDED, String(isExpanded));
    const arena = document.getElementById('almancaArena');
    const toggleText = document.getElementById('almancaToggleText');
    const toggleIcon = document.getElementById('almancaToggleIcon');
    if (arena) arena.style.display = isExpanded ? 'block' : 'none';
    if (toggleText) toggleText.textContent = isExpanded ? 'Gizle' : 'Çalış';
    if (toggleIcon) toggleIcon.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0)';
  }

  function switchMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.almanca-mode-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    renderCurrentMode();
  }

  function updateWidgetStats() {
    const learned = getLearnedSet();
    const daily = getDailyState();
    const total = wordsData.length || 801;

    const learnedCountEl = document.getElementById('almancaLearnedCount');
    if (learnedCountEl) learnedCountEl.textContent = `${learned.size}/${total}`;

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
    else if (currentMode === 'quiz') renderQuizMode(content);
    else if (currentMode === 'artikel') renderArtikelMode(content);
    else if (currentMode === 'match') renderMatchMode(content);
    else if (currentMode === 'vocab') renderVocabMode(content);
  }

  // ══════════════════════════════════════════════════════════════
  // MOD 1: KELİME KARTLARI (FLASHCARDS)
  // ══════════════════════════════════════════════════════════════
  function renderCardsMode(container) {
    if (activeCardList.length === 0) prepareCardList();
    const item = activeCardList[currentCardIndex] || wordsData[0];
    if (!item) {
      container.innerHTML = '<div style="text-align:center;padding:20px;color:#8b949e;">Kelime bulunamadı.</div>';
      return;
    }

    const learned = getLearnedSet();
    const favs = getFavoritesSet();
    const isLearned = learned.has(item.id);
    const isFav = favs.has(item.id);

    container.innerHTML = `
      <!-- Kategori Filtresi -->
      <div class="almanca-filter-row">
        <button class="almanca-filter-pill ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">Tümü (${wordsData.length})</button>
        <button class="almanca-filter-pill ${currentFilter === 'verb' ? 'active' : ''}" data-filter="verb">Fiiller</button>
        <button class="almanca-filter-pill ${currentFilter === 'nomen' ? 'active' : ''}" data-filter="nomen">İsimler</button>
        <button class="almanca-filter-pill ${currentFilter === 'adj' ? 'active' : ''}" data-filter="adj">Sıfatlar</button>
        <button class="almanca-filter-pill ${currentFilter === 'diger' ? 'active' : ''}" data-filter="diger">Diğer</button>
        <button class="almanca-filter-pill ${currentFilter === 'unlearned' ? 'active' : ''}" data-filter="unlearned">Öğrenilecekler</button>
        <button class="almanca-filter-pill ${currentFilter === 'fav' ? 'active' : ''}" data-filter="fav">⭐ Favoriler</button>
      </div>

      <!-- 3D Kart Sahnesi -->
      <div class="almanca-flashcard-stage">
        <div class="almanca-flashcard ${isCardFlipped ? 'flipped' : ''}" id="almancaCard">
          <!-- ÖN YÜZ -->
          <div class="almanca-card-side almanca-card-front">
            <div class="almanca-card-top">
              ${getBadgeHtml(item)}
              <button class="almanca-card-audio-btn" id="almancaCardAudioBtn" title="Telaffuzu Dinle">
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
              <button class="almanca-card-audio-btn" id="almancaCardAudioBtnBack" title="Telaffuzu Dinle">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
              </button>
            </div>
            <div class="almanca-card-center">
              <div class="almanca-card-meaning">${item.meaning}</div>
              <div class="almanca-card-forms" style="color:#a7f3d0; margin-top:10px;">${item.full}</div>
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
        <button class="almanca-ctrl-btn learned ${isLearned ? 'learned-done' : ''}" id="almancaCardLearned">
          ${isLearned ? '✅ Öğrenildi' : '✓ Öğrendim'}
        </button>
        <button class="almanca-ctrl-btn" id="almancaCardNext">Sonraki ▶</button>
      </div>

      <div class="almanca-card-counter">
        <span>${currentCardIndex + 1} / ${activeCardList.length}</span>
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
    cardEl.addEventListener('click', (e) => {
      if (e.target.closest('.almanca-card-audio-btn')) return;
      isCardFlipped = !isCardFlipped;
      cardEl.classList.toggle('flipped', isCardFlipped);
      playTone('flip');
    });

    // Ses butonları
    const handleSpeak = (e) => {
      e.stopPropagation();
      speakGerman(item.full || item.word);
    };
    document.getElementById('almancaCardAudioBtn').addEventListener('click', handleSpeak);
    document.getElementById('almancaCardAudioBtnBack').addEventListener('click', handleSpeak);

    // Navigasyon
    document.getElementById('almancaCardPrev').addEventListener('click', () => {
      if (currentCardIndex > 0) currentCardIndex--;
      else currentCardIndex = activeCardList.length - 1;
      isCardFlipped = false;
      renderCardsMode(container);
    });

    document.getElementById('almancaCardNext').addEventListener('click', () => {
      if (currentCardIndex < activeCardList.length - 1) currentCardIndex++;
      else currentCardIndex = 0;
      isCardFlipped = false;
      renderCardsMode(container);
    });

    document.getElementById('almancaShuffleBtn').addEventListener('click', () => {
      activeCardList.sort(() => Math.random() - 0.5);
      currentCardIndex = 0;
      isCardFlipped = false;
      renderCardsMode(container);
    });

    // Öğrendim butonu
    document.getElementById('almancaCardLearned').addEventListener('click', () => {
      const set = getLearnedSet();
      if (set.has(item.id)) {
        set.delete(item.id);
      } else {
        set.add(item.id);
        markDailyWord(item.id);
        playTone('correct');
      }
      saveLearnedSet(set);
      renderCardsMode(container);
    });

    // Favori butonu
    document.getElementById('almancaCardFav').addEventListener('click', () => {
      const favs = getFavoritesSet();
      if (favs.has(item.id)) favs.delete(item.id);
      else favs.add(item.id);
      saveFavoritesSet(favs);
      renderCardsMode(container);
    });
  }

  // ══════════════════════════════════════════════════════════════
  // MOD 2: ÇOKTAN SEÇMELİ TEST (QUIZ)
  // ══════════════════════════════════════════════════════════════
  function initQuiz() {
    quizQuestions = [];
    quizCurrentIndex = 0;
    quizScore = 0;
    quizStreak = 0;
    quizAnswered = false;

    // 10 adet rastgele soru seç
    const pool = [...wordsData].sort(() => Math.random() - 0.5);
    const selected = pool.slice(0, 10);

    selected.forEach(correctItem => {
      // 3 yanlış seçenek bul
      const distractors = wordsData
        .filter(w => w.id !== correctItem.id && w.type === correctItem.type)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

      // Yeterli aynı tip bulunamazsa genel havuzdan tamamla
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
    if (quizQuestions.length === 0 || quizCurrentIndex >= quizQuestions.length) {
      initQuiz();
    }

    if (quizCurrentIndex >= quizQuestions.length) {
      // Test Sonu Ekranı
      container.innerHTML = `
        <div class="almanca-quiz-box" style="text-align:center;">
          <div style="font-size:48px; margin-bottom:12px;">🏆</div>
          <h3 style="color:#f0f6fc; margin:0 0 8px;">Test Tamamlandı!</h3>
          <div style="font-size:20px; font-weight:800; color:#3fb950; margin-bottom:16px;">
            Skorun: ${quizScore} / 1000
          </div>
          <p style="color:#8b949e; font-size:13px; margin-bottom:20px;">
            ${quizScore >= 800 ? 'Harika iş başardın! Almanca A1 kelimelerinde çok iyisin. 🌟' : 'Güzel deneme! Kelime kartlarıyla tekrar ederek skorunu yükseltebilirsin.'}
          </p>
          <button class="almanca-ctrl-btn learned" id="almancaQuizRestart" style="margin:0 auto; padding:12px 28px; font-size:15px;">
            Yeniden Başla 🔄
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

        <div class="almanca-quiz-next-row" id="almancaQuizNextRow" style="display:none;">
          <button class="almanca-ctrl-btn learned" id="almancaQuizNextBtn">Sonraki Soru ▶</button>
        </div>
      </div>
    `;

    // Ses
    const audioBtn = document.getElementById('almancaQuizAudioBtn');
    if (audioBtn) {
      audioBtn.addEventListener('click', () => speakGerman(currentQ.correct.full || currentQ.correct.word));
      // Otomatik oku
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
          markDailyWord(currentQ.correct.id);
        } else {
          btn.classList.add('wrong');
          btn.querySelector('.opt-indicator').textContent = '✗';
          quizStreak = 0;
          playTone('wrong');

          // Doğru şıkkı yeşille işaretle
          optBtns.forEach(b => {
            const optIdx = parseInt(b.dataset.idx, 10);
            if (currentQ.options[optIdx].id === currentQ.correct.id) {
              b.classList.add('correct');
              b.querySelector('.opt-indicator').textContent = '✓';
            }
          });
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
  // MOD 3: ARTIKEL AVCISI (der / die / das)
  // ══════════════════════════════════════════════════════════════
  function initArtikelMode() {
    artikelList = wordsData
      .filter(w => w.type === 'Nomen' && (w.article === 'der' || w.article === 'die' || w.article === 'das'))
      .sort(() => Math.random() - 0.5);
    artikelCurrentIndex = 0;
    artikelStreak = 0;
    artikelAnswered = false;
  }

  function renderArtikelMode(container) {
    if (artikelList.length === 0 || artikelCurrentIndex >= artikelList.length) {
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
          <span>Doğru artikeli seç</span>
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

        if (isCorrect) {
          artikelStreak++;
          playTone('correct');
          feedbackEl.innerHTML = `<span style="color:#3fb950;">✓ Harika! <strong>${currentNoun.full}</strong></span>`;
          markDailyWord(currentNoun.id);
        } else {
          artikelStreak = 0;
          playTone('wrong');
          feedbackEl.innerHTML = `<span style="color:#f85149;">✗ Yanlış! Doğrusu: <strong>${currentNoun.full}</strong></span>`;
        }

        speakGerman(currentNoun.full);
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
  // MOD 4: EŞLEŞTİRME OYUNU (MATCH GAME)
  // ══════════════════════════════════════════════════════════════
  function initMatchPairs() {
    matchSelectedDe = null;
    matchSelectedTr = null;
    matchCompletedCount = 0;

    const pool = [...wordsData].sort(() => Math.random() - 0.5).slice(0, 4);
    const deCards = pool.map(w => ({ id: w.id, text: w.word || w.full, fullDe: w.full }));
    const trCards = pool.map(w => ({ id: w.id, text: w.meaning.split(';')[0].split(',')[0].trim() }));

    matchPairs = {
      de: deCards.sort(() => Math.random() - 0.5),
      tr: trCards.sort(() => Math.random() - 0.5),
      matchedIds: new Set()
    };
  }

  function renderMatchMode(container) {
    if (!matchPairs.de || matchPairs.matchedIds.size === 4) {
      initMatchPairs();
    }

    container.innerHTML = `
      <div style="text-align:center; margin-bottom:14px; font-size:13px; color:#8b949e;">
        Almanca kelimeye dokun, ardından Türkçe karşılığını seç!
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

        // İkisi de seçildiyse kontrol et
        if (matchSelectedDe && matchSelectedTr) {
          if (matchSelectedDe.id === matchSelectedTr.id) {
            // Eşleşti!
            playTone('correct');
            matchPairs.matchedIds.add(matchSelectedDe.id);
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
            // Yanlış eşleşme
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
  // MOD 5: SÖZLÜK & HAVUZ (VOCABULARY LIST)
  // ══════════════════════════════════════════════════════════════
  function renderVocabMode(container) {
    const learned = getLearnedSet();
    const favs = getFavoritesSet();

    let filtered = filterWords(wordsData, currentFilter);
    if (vocabSearchQuery.trim()) {
      const q = vocabSearchQuery.trim().toLowerCase();
      filtered = filtered.filter(w =>
        w.full.toLowerCase().includes(q) ||
        w.meaning.toLowerCase().includes(q)
      );
    }

    container.innerHTML = `
      <div style="display:flex; gap:10px; margin-bottom:12px; flex-wrap:wrap;">
        <div style="flex:1; min-width:200px; position:relative;">
          <input type="text" id="almancaVocabSearch" placeholder="Almanca veya Türkçe ara..." value="${vocabSearchQuery}"
            style="width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:8px 12px; font-size:13px; color:#fff; box-sizing:border-box;">
        </div>
      </div>

      <div class="almanca-filter-row">
        <button class="almanca-filter-pill ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">Tümü</button>
        <button class="almanca-filter-pill ${currentFilter === 'verb' ? 'active' : ''}" data-filter="verb">Fiiller</button>
        <button class="almanca-filter-pill ${currentFilter === 'nomen' ? 'active' : ''}" data-filter="nomen">İsimler</button>
        <button class="almanca-filter-pill ${currentFilter === 'adj' ? 'active' : ''}" data-filter="adj">Sıfatlar</button>
        <button class="almanca-filter-pill ${currentFilter === 'fav' ? 'active' : ''}" data-filter="fav">⭐ Favoriler (${favs.size})</button>
        <button class="almanca-filter-pill ${currentFilter === 'unlearned' ? 'active' : ''}" data-filter="unlearned">Öğrenilecekler</button>
      </div>

      <div class="almanca-vocab-list-wrap">
        ${filtered.length === 0 ? '<div style="text-align:center;padding:30px;color:#8b949e;">Sonuç bulunamadı.</div>' :
          filtered.slice(0, 100).map(item => `
            <div class="almanca-vocab-row">
              <div class="almanca-vocab-left">
                <button class="almanca-icon-btn almanca-check-btn ${learned.has(item.id) ? 'checked' : ''}" data-id="${item.id}" title="${learned.has(item.id) ? 'Öğrenildi' : 'Öğrendim olarak işaretle'}">
                  ${learned.has(item.id) ? '✅' : '⚪'}
                </button>
                <div class="almanca-vocab-texts">
                  <div class="almanca-vocab-de">
                    ${getBadgeHtml(item)}
                    <span>${item.full}</span>
                  </div>
                  <div class="almanca-vocab-tr">${item.meaning}</div>
                </div>
              </div>
              <div class="almanca-vocab-actions">
                <button class="almanca-icon-btn speak-btn" data-word="${item.full}" title="Dinle">🔊</button>
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

    // Ses butonları
    container.querySelectorAll('.speak-btn').forEach(btn => {
      btn.addEventListener('click', () => speakGerman(btn.dataset.word));
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
      // JSON dosyasından yükle
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
    toggleExpanded: toggleWidgetExpanded,
    switchMode
  };

})();
