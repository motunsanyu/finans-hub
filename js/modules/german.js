// js/modules/german.js - Duolingo tarzı Almanca Öğrenme Uygulaması (v3)

window.GermanModule = (function () {
  let vocabulary = { A1: [], A2: [], B1: [] };
  let currentLevel = 'A1';
  let isDataLoaded = false;

  // Lesson state
  let lessonQueue = [];
  let currentItemIdx = 0;
  let lives = 5;
  let learnedIds = JSON.parse(localStorage.getItem('german_learned_words')) || [];

  // Grammar data
  let grammarTopics = [];    // { title, subtitle, tableRows: [{de,tr}], level }
  let grammarSentences = []; // { id, topic, level, german, turkish }

  // ── Supabase ─────────────────────────────────────────────────────────────────
  function getSB() { return window._supabaseClient || null; }

  // ── LOADING ──────────────────────────────────────────────────────────────────
  async function loadData() {
    if (isDataLoaded) return;

    document.getElementById('germanAppContent').innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  height:100vh;background:var(--g-bg);">
        <div style="font-size:52px;margin-bottom:16px;">🇩🇪</div>
        <h2 style="color:var(--g-text-muted);font-weight:700;margin:0;">Yükleniyor…</h2>
      </div>`;

    try {
      // — Vocabulary (Supabase önce, fallback txt) —
      let sbLoaded = false;
      const sb = getSB();
      if (sb) {
        const { data, error } = await sb.from('vocabulary').select('*');
        if (!error && data && data.length > 0) {
          data.forEach(item => {
            if (vocabulary[item.level]) vocabulary[item.level].push(item);
          });
          sbLoaded = true;
        }
      }
      if (!sbLoaded) {
        const res = await fetch('almanca/Kelimeler.txt');
        parseKelimelerTxt(await res.text());
      }

      // — Grammar (gramerA1B2.txt) —
      const gramRes = await fetch('almanca/gramerA1B2.txt');
      parseGrammarA1B2(await gramRes.text());

      isDataLoaded = true;
      renderHome();
    } catch (err) {
      console.error('German load error:', err);
      document.getElementById('germanAppContent').innerHTML = `
        <div style="text-align:center;padding:60px;">
          <div style="font-size:64px;">😵</div>
          <h2 style="color:#ff4b4b;">Veriler Yüklenemedi</h2>
          <button class="g-btn" onclick="window.GermanModule.closeApp()">Geri Dön</button>
        </div>`;
    }
  }

  // ── PARSERS ───────────────────────────────────────────────────────────────────

  function parseKelimelerTxt(text) {
    const lines = text.split('\n');
    let lvl = 'A1';
    let id = 1;
    for (let raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (line.includes('A1 Kelime')) { lvl = 'A1'; continue; }
      if (line.includes('A2 Kelime')) { lvl = 'A2'; continue; }
      if (line.includes('B1 Kelime') || line.includes('B1 Kelimeler')) { lvl = 'B1'; continue; }
      if (line.includes('---') || line.includes('Almanca Kelime')) continue;

      let gWord = '', tMeaning = '';
      if (lvl === 'A1') {
        const m = line.match(/^\d+\s+(.*?)\s+\((.*?)\)$/);
        if (m) { gWord = m[1].trim(); tMeaning = m[2].trim(); }
        else {
          const parts = line.split('\t');
          if (parts.length >= 2) {
            const wp = parts[1].split('(');
            if (wp.length > 1) { gWord = wp[0].trim(); tMeaning = wp[1].replace(')', '').trim(); }
          }
        }
      } else {
        const ds = line.split(/ – | - /);
        if (ds.length >= 2) {
          gWord = ds[0].trim();
          const rest = ds.slice(1).join(' - ').trim();
          const parts = rest.split(/\t+/);
          tMeaning = parts[parts.length - 1].trim();
        }
      }
      if (gWord && tMeaning) {
        vocabulary[lvl].push({ id: 'txt_' + id++, german_word: gWord, turkish_meaning: tMeaning, level: lvl });
      }
    }
  }

  /**
   * gramerA1B2.txt Ayrıştırıcısı
   * – Bölüm başlıkları:   "A1 - sein ve haben"
   * – Tab tabloları:       "ich\t\tbin\t\thabe"  (satır içi tab var)
   * – Cümleler:            "Ich bin müde. (Yorgunum.)"
   * Aynı cümleyi birden fazla bölümde buluyor, mükerrer kayıtları siler.
   */
  function parseGrammarA1B2(text) {
    const lines = text.split('\n').map(l => l.replace(/\r$/, ''));

    // ── 1. Sabit (hardcoded) Tablo: Şahıs Zamirleri + Sein/Haben ───────────────
    grammarTopics.push({
      id: 'topic_pronouns',
      title: 'Şahıs Zamirleri',
      subtitle: 'Personalpronomen – Almanca zamirlerin listesi',
      level: 'A1',
      tableHeaders: ['Zamir', 'Türkçe'],
      tableRows: [
        ['ich', 'ben'],
        ['du', 'sen'],
        ['er', 'o (erkek)'],
        ['sie', 'o (kadın)'],
        ['es', 'o (cansız/nötr)'],
        ['wir', 'biz'],
        ['ihr', 'siz'],
        ['sie / Sie', 'onlar / Siz (resmi)'],
      ]
    });

    grammarTopics.push({
      id: 'topic_sein_haben',
      title: 'sein & haben Çekimleri',
      subtitle: 'En önemli iki yardımcı fiilin çekim tablosu',
      level: 'A1',
      tableHeaders: ['Şahıs', 'sein\nolmak', 'haben\nsahip olmak'],
      tableRows: [
        ['ich',          'bin',   'habe'],
        ['du',           'bist',  'hast'],
        ['er / sie / es','ist',   'hat'],
        ['wir',          'sind',  'haben'],
        ['ihr',          'seid',  'habt'],
        ['sie / Sie',    'sind',  'haben'],
      ]
    });

    // ── 2. Cümle Listesi ──────────────────────────────────────────────────────
    const seenSentences = new Set();
    let currentTopicTitle = 'Genel';
    let currentLevel = 'A1';
    let sid = 1;

    // Seviye & bölüm başlığı tanıma
    const LEVEL_RE  = /^(A1|A2|B1|B2)\s*[-–]\s*(.+)/;
    const SECTION_RE = /^\d+\.\s+/;
    const SENT_RE   = /^(.+?)\.\s*\((.+?)\)\s*$/;     // German. (Turkish.)
    // Ayrıca "German - Turkish" veya "German: Turkish" kalıpları:
    const SENT_DASH  = /^(.{5,})\s+-\s+(.+?)\.\s*$/;

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      // Seviye başlığı (🟢 A1 Seviyesi...)
      const lvlEmoji = line.match(/[🟢🟡🔵🔴]?\s*(A1|A2|B1|B2)\s*Seviyesi/);
      if (lvlEmoji) { currentLevel = lvlEmoji[1]; continue; }

      // "A1 - sein ve haben" tipi başlık
      const lvlMatch = line.match(LEVEL_RE);
      if (lvlMatch) {
        currentLevel = lvlMatch[1];
        currentTopicTitle = lvlMatch[2].trim();
        continue;
      }
      if (SECTION_RE.test(line)) { currentTopicTitle = line.replace(SECTION_RE,'').trim(); continue; }

      // Cümle: "Ich bin müde. (Yorgunum.)"
      const sm = line.match(SENT_RE);
      if (sm) {
        const german  = sm[1].trim().replace(/^[-–]\s*/, '');
        const turkish = sm[2].trim();
        if (german.length > 4 && !seenSentences.has(german)) {
          seenSentences.add(german);
          grammarSentences.push({
            id: 'gram_' + sid++,
            topic: currentTopicTitle,
            level: currentLevel,
            german,
            turkish
          });
        }
        continue;
      }
    }
  }

  // ── TTS ──────────────────────────────────────────────────────────────────────
  function speak(text) {
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE';
    u.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  // ── SOUND FX ─────────────────────────────────────────────────────────────────
  function playSound(type) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    if (type === 'correct') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.35);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
    }
  }

  // ── EMOJI HELPER ──────────────────────────────────────────────────────────────
  function getEmoji(word, meaning) {
    word = (word || '').toLowerCase();
    meaning = (meaning || '').toLowerCase();
    const nums = { 'sıfır':'0','bir':'1','iki':'2','üç':'3','dört':'4','beş':'5',
      'altı':'6','yedi':'7','sekiz':'8','dokuz':'9','on':'10','yirmi':'20',
      'otuz':'30','kırk':'40','elli':'50','yüz':'100','bin':'1.000' };
    if (nums[meaning]) return nums[meaning];
    if (word.includes('haus') || meaning.includes('ev')) return '🏠';
    if (word.includes('hund') || meaning.includes('köpek')) return '🐕';
    if (word.includes('katze') || meaning.includes('kedi')) return '🐈';
    if (word.includes('auto') || meaning.includes('araba')) return '🚗';
    if (word.includes('essen') || meaning.includes('yemek')) return '🍽️';
    if (word.includes('trinken') || meaning.includes('içmek')) return '💧';
    if (word.includes('buch') || meaning.includes('kitap')) return '📖';
    if (word.includes('schule') || meaning.includes('okul')) return '🏫';
    if (meaning.includes('ağız') || meaning.includes('dudak')) return '👄';
    if (meaning.includes('göz')) return '👁️';
    if (meaning.includes('kulak')) return '👂';
    return '';
  }

  // ── CSS / THEME ────────────────────────────────────────────────────────────────
  const STYLES = `
    :root {
      --g-bg:          #e7e7e7;
      --g-surface:     #f8f8f8;
      --g-border:      #d1d5db;
      --g-border-bot:  #a3a3a3;
      --g-text:        #2f3033;
      --g-text-muted:  #6b7280;
      --g-green:       #4b5563;
      --g-green-dark:  #2f343b;
      --g-blue:        #64748b;
      --g-blue-dark:   #475569;
      --g-red:         #ff4b4b;
      --g-red-dark:    #ea2b2b;
      --g-yellow:      #ffc800;
      --g-yellow-dark: #e6ae00;
      --g-correct-bg:  #d7ffb8;
      --g-wrong-bg:    #ffdfe0;
      --g-header-bg:   #dedede;
      --g-table-head:  #3f3f46;
      --g-table-alt:   #eeeeee;
    }

    .g-wrap  { height:100%; display:flex; flex-direction:column; background:var(--g-bg); overflow:hidden; }

    /* Header */
    .g-header {
      display:flex; justify-content:space-between; align-items:center;
      padding:12px 20px; border-bottom:2px solid var(--g-border);
      background:var(--g-header-bg); flex-shrink:0;
    }
    .g-title { font-size:18px; font-weight:800; color:var(--g-text); display:flex; align-items:center; gap:8px; }

    /* Scrollable body */
    .g-body { flex:1; overflow-y:auto; padding:20px; }

    /* Lesson body (centered, no extra padding) */
    .g-lesson-body { flex:1; overflow-y:auto; }

    /* Content container */
    .g-content { max-width:560px; margin:0 auto; }

    /* Buttons */
    .g-btn {
      background:var(--g-green); color:#fff;
      border:none; border-bottom:4px solid var(--g-green-dark);
      border-radius:14px; padding:12px 24px;
      font-size:15px; font-weight:800; cursor:pointer;
      transition:transform .1s, border-width .1s;
    }
    .g-btn:active { transform:translateY(3px); border-bottom-width:1px; }
    .g-btn:disabled { background:var(--g-border); border-bottom-color:var(--g-border-bot); color:var(--g-text-muted); cursor:not-allowed; }
    .g-btn.blue  { background:var(--g-blue);   border-bottom-color:var(--g-blue-dark); }
    .g-btn.red   { background:var(--g-red);    border-bottom-color:var(--g-red-dark); }
    .g-btn.ghost { background:var(--g-surface); color:var(--g-text-muted); border:2px solid var(--g-border); border-bottom:4px solid var(--g-border-bot); }
    .g-btn.ghost:active { transform:translateY(2px); border-bottom-width:2px; }

    /* Progress bar */
    .g-prog-bar { height:14px; background:var(--g-border); border-radius:7px; overflow:hidden; }
    .g-prog-fill { height:100%; background:var(--g-green); transition:width .4s ease; }

    /* Lives badge */
    .g-lives { display:flex; align-items:center; gap:5px; background:#ffe0e0;
      border-radius:20px; padding:4px 12px; font-size:15px; font-weight:800; color:var(--g-red); }

    /* Cards */
    .g-card {
      background:var(--g-surface);
      border:2px solid var(--g-border);
      border-radius:20px;
      padding:28px 24px;
      box-shadow:0 4px 0 var(--g-border-bot);
      margin-bottom:20px;
      overflow:hidden;
    }

    /* Teach word card */
    .g-teach-emoji  { font-size:72px; text-align:center; margin-bottom:12px; line-height:1; }
    .g-teach-word   { font-size:30px; font-weight:800; color:var(--g-text); text-align:center; margin-bottom:8px; line-height:1.4; }
    .g-teach-meaning{ font-size:20px; color:var(--g-blue); font-weight:700; text-align:center;
      border-top:2px dashed var(--g-border); padding-top:14px; margin-top:14px; }
    .g-audio-btn {
      background:var(--g-blue); color:#fff; border:none; border-bottom:3px solid var(--g-blue-dark);
      border-radius:50%; width:52px; height:52px; font-size:22px; cursor:pointer;
      display:inline-flex; align-items:center; justify-content:center; margin-top:14px;
    }
    .g-audio-btn:active { transform:translateY(2px); border-bottom-width:1px; }

    /* Speech bubble */
    .g-bubble {
      background:var(--g-surface);
      border:2px solid var(--g-border);
      border-radius:20px;
      padding:22px 20px;
      box-shadow:0 4px 0 var(--g-border-bot);
      margin-bottom:16px;
      position:relative;
    }
    .g-bubble-tail {
      position:absolute; bottom:-12px; right:64px;
      width:20px; height:20px;
      background:var(--g-surface);
      border-right:2px solid var(--g-border);
      border-bottom:2px solid var(--g-border);
      transform:rotate(45deg);
    }
    .g-bubble-german  { font-size:24px; font-weight:800; color:var(--g-text); line-height:1.4; margin-bottom:8px; }
    .g-bubble-turkish { font-size:17px; color:var(--g-text-muted); }
    .g-avatar { font-size:72px; text-align:right; padding-right:48px; margin-bottom:12px; }

    /* Quiz options */
    .g-options { display:grid; grid-template-columns:1fr; gap:12px; }
    .g-option {
      background:var(--g-surface);
      border:2px solid var(--g-border);
      border-bottom:4px solid var(--g-border-bot);
      border-radius:14px; padding:14px 18px;
      font-size:17px; font-weight:700; color:var(--g-text);
      cursor:pointer; transition:all .1s; text-align:left;
    }
    .g-option:hover   { border-color:#aaa; }
    .g-option:active  { transform:translateY(2px); border-bottom-width:2px; }
    .g-option.correct { background:var(--g-correct-bg); border-color:var(--g-green); color:var(--g-green); }
    .g-option.wrong   { background:var(--g-wrong-bg);   border-color:var(--g-red);   color:var(--g-red); }

    /* Feedback footer */
    .g-footer {
      flex-shrink:0; background:var(--g-header-bg);
      padding:16px 20px; border-top:2px solid var(--g-border);
      display:flex; flex-direction:column; gap:10px;
    }
    .g-feedback { padding:14px 18px; border-radius:14px; font-size:16px; font-weight:700; display:flex; align-items:center; gap:10px; }
    .g-feedback.ok  { background:var(--g-correct-bg); color:var(--g-green); }
    .g-feedback.bad { background:var(--g-wrong-bg);   color:var(--g-red); }

    /* Home cards */
    .g-home-card {
      background:var(--g-surface);
      border:2px solid var(--g-border);
      border-bottom:4px solid var(--g-border-bot);
      border-radius:18px; padding:18px 20px;
      margin-bottom:14px;
      display:flex; justify-content:space-between; align-items:center;
      box-shadow:0 2px 0 var(--g-border-bot);
    }
    .g-home-icon { font-size:38px; }

    /* Grammar table */
    .g-table-wrap { width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch; border-radius:12px; margin-top:14px; }
    .g-table { width:100%; border-collapse:collapse; table-layout:fixed; }
    .g-table th { background:var(--g-table-head); color:#fff; padding:10px 14px; font-size:14px; text-align:left; }
    .g-table td { padding:10px 14px; font-size:15px; border-bottom:1px solid var(--g-border); color:var(--g-text); overflow-wrap:anywhere; }
    .g-table tr:nth-child(even) td { background:var(--g-table-alt); }
    .g-table td:first-child { font-weight:700; color:var(--g-blue); }

    /* Repeat badge */
    .g-repeat-badge {
      display:inline-block; background:#fff3cd; color:#856404;
      border:1px solid #ffc107; border-radius:20px;
      font-size:11px; font-weight:700; padding:2px 10px; margin-bottom:8px;
    }

    /* Progress section */
    .g-progress-section {
      background:var(--g-surface);
      border:2px solid var(--g-border);
      border-radius:18px; padding:18px 20px;
      box-shadow:0 2px 0 var(--g-border-bot);
    }

    .g-level-pill {
      display:inline-block; border-radius:30px; padding:3px 14px;
      font-size:13px; font-weight:800; margin-right:6px; cursor:pointer;
      border:2px solid transparent;
    }
    .g-level-pill.active { background:var(--g-green); color:#fff; border-color:var(--g-green-dark); }
    .g-level-pill.inactive { background:var(--g-surface); color:var(--g-text-muted); border-color:var(--g-border); }

    @media (max-width: 480px) {
      .g-body { padding:14px; }
      .g-card { padding:20px 14px; }
      .g-home-card { padding:15px 14px; gap:12px; }
      .g-table th { padding:9px 8px; font-size:12px; line-height:1.25; }
      .g-table td { padding:9px 8px; font-size:13px; line-height:1.3; }
    }
  `;

  function injectStyles() {
    if (document.getElementById('g-styles')) return;
    const s = document.createElement('style');
    s.id = 'g-styles';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  // ── OPEN / CLOSE ─────────────────────────────────────────────────────────────
  function openApp() {
    document.getElementById('germanAppScreen').style.display = 'block';
    document.body.style.overflow = 'hidden';
    injectStyles();
    loadData();
  }

  function closeApp() {
    document.getElementById('germanAppScreen').style.display = 'none';
    document.body.style.overflow = 'auto';
  }

  // ── HEADER ────────────────────────────────────────────────────────────────────
  function headerHTML(showClose = true) {
    return `<div class="g-header">
      <div class="g-title"><img src="https://flagcdn.com/w40/de.png" style="width:22px;height:16px;border-radius:3px;"> Almanca Öğren</div>
      ${showClose ? `<button class="g-btn ghost" style="font-size:13px;padding:6px 14px;" onclick="window.GermanModule.closeApp()">Kapat</button>` : ''}
    </div>`;
  }

  // ── HOME ──────────────────────────────────────────────────────────────────────
  function renderHome() {
    const allWords = vocabulary[currentLevel] || [];
    const learnedCount = allWords.filter(w => learnedIds.includes(w.id)).length;
    const pct = allWords.length ? Math.round(learnedCount / allWords.length * 100) : 0;

    const levelPills = ['A1','A2','B1'].map(l => `
      <span class="g-level-pill ${l === currentLevel ? 'active' : 'inactive'}"
            onclick="window.GermanModule.changeLevel('${l}')">${l}</span>`).join('');

    const gramCount = grammarSentences.length;

    document.getElementById('germanAppContent').innerHTML = `
      <div class="g-wrap">
        ${headerHTML(true)}
        <div class="g-body">
          <div class="g-content">

            <div style="text-align:center;margin:10px 0 22px;">
              <h2 style="color:var(--g-text);margin:0 0 6px;">Yola Çıkmaya Hazır mısın?</h2>
              <p style="color:var(--g-text-muted);margin:0;font-size:14px;">Seviyeni seç, 5 kelimelik bir derse başla!</p>
              <div style="margin-top:14px;">${levelPills}</div>
            </div>

            <div class="g-home-card">
              <div style="display:flex;align-items:center;gap:14px;">
                <div class="g-home-icon">📚</div>
                <div>
                  <div style="font-size:17px;font-weight:800;color:var(--g-text);">Kelime Dersi</div>
                  <div style="color:var(--g-text-muted);font-size:13px;">5 yeni + tekrar soruları</div>
                </div>
              </div>
              <button class="g-btn" onclick="window.GermanModule.startLesson()">Başla</button>
            </div>

            <div class="g-home-card">
              <div style="display:flex;align-items:center;gap:14px;">
                <div class="g-home-icon">🗣️</div>
                <div>
                  <div style="font-size:17px;font-weight:800;color:var(--g-text);">Cümle Pratiği</div>
                  <div style="color:var(--g-text-muted);font-size:13px;">${gramCount} cümle + boşluk doldurma</div>
                </div>
              </div>
              <button class="g-btn blue" onclick="window.GermanModule.startGrammarLesson()">Başla</button>
            </div>

            <div class="g-home-card">
              <div style="display:flex;align-items:center;gap:14px;">
                <div class="g-home-icon">📊</div>
                <div>
                  <div style="font-size:17px;font-weight:800;color:var(--g-text);">Gramer Tabloları</div>
                  <div style="color:var(--g-text-muted);font-size:13px;">Şahıs zamirleri, sein & haben</div>
                </div>
              </div>
              <button class="g-btn" style="background:#9b59b6;border-bottom-color:#7d3c98;"
                      onclick="window.GermanModule.startGrammarTables()">Gör</button>
            </div>

            <div class="g-home-card">
              <div style="display:flex;align-items:center;gap:14px;">
                <div class="g-home-icon">🗺️</div>
                <div>
                  <div style="font-size:17px;font-weight:800;color:var(--g-text);">A1 Konuları</div>
                  <div style="color:var(--g-text-muted);font-size:13px;">Dosyadan alınan konu anlatımları</div>
                </div>
              </div>
              <button class="g-btn ghost" onclick="window.GermanModule.showTopicGuide()">Aç</button>
            </div>

            <div class="g-progress-section">
              <h3 style="color:var(--g-text);margin:0 0 10px;font-size:15px;">
                İlerlemen — <span style="color:var(--g-green);">${currentLevel}</span>
              </h3>
              <div class="g-prog-bar" style="margin-bottom:6px;">
                <div class="g-prog-fill" style="width:${pct}%"></div>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--g-text-muted);">
                <span>${learnedCount} öğrenildi</span>
                <span>${allWords.length - learnedCount} kaldı</span>
              </div>
            </div>

          </div>
        </div>
      </div>`;
  }

  function changeLevel(lvl) {
    currentLevel = lvl;
    renderHome();
  }

  // ── GRAMMAR TABLES (Standalone browse) ────────────────────────────────────────
  let _gramTopicIdx = 0;

  function startGrammarTables() {
    _gramTopicIdx = 0;
    renderGramTable();
  }

  function renderGramTable() {
    const t = grammarTopics[_gramTopicIdx];
    if (!t) { renderHome(); return; }
    const thCells = t.tableHeaders.map(h => {
      const parts = String(h).split('\n');
      return `<th>${parts[0]}${parts[1] ? `<span style="display:block;font-size:11px;font-weight:700;opacity:.9;margin-top:2px;">${parts[1]}</span>` : ''}</th>`;
    }).join('');
    const rows = t.tableRows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
    const pct = Math.round((_gramTopicIdx + 1) / grammarTopics.length * 100);

    document.getElementById('germanAppContent').innerHTML = `
      <div class="g-wrap">
        ${headerHTML(false)}
        <div class="g-body">
          <div class="g-content">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
              <button class="g-btn ghost" style="font-size:13px;padding:6px 14px;"
                      onclick="window.GermanModule.renderHome()">❌</button>
              <div class="g-prog-bar" style="flex:1;margin:0;">
                <div class="g-prog-fill" style="width:${pct}%"></div>
              </div>
              <span style="font-size:13px;color:var(--g-text-muted);">${_gramTopicIdx + 1} / ${grammarTopics.length}</span>
            </div>

            <div class="g-card">
              <div style="font-size:12px;font-weight:700;color:var(--g-blue);margin-bottom:6px;
                          text-transform:uppercase;letter-spacing:.5px;">${t.level || 'A1'}</div>
              <div style="font-size:22px;font-weight:800;color:var(--g-text);margin-bottom:4px;">${t.title}</div>
              <div style="font-size:14px;color:var(--g-text-muted);margin-bottom:16px;">${t.subtitle}</div>
              <div class="g-table-wrap">
                <table class="g-table">
                  <thead><tr>${thCells}</tr></thead>
                  <tbody>${rows}</tbody>
                </table>
              </div>
            </div>

            <div style="display:flex;gap:12px;margin-top:4px;">
              ${_gramTopicIdx > 0
                ? `<button class="g-btn ghost" style="flex:1;" onclick="window.GermanModule.gramTableNav(-1)">← Önceki</button>`
                : ''}
              ${_gramTopicIdx < grammarTopics.length - 1
                ? `<button class="g-btn" style="flex:1;" onclick="window.GermanModule.gramTableNav(1)">Sonraki →</button>`
                : `<button class="g-btn" style="flex:1;" onclick="window.GermanModule.renderHome()">Ana Sayfaya Dön</button>`}
            </div>
          </div>
        </div>
      </div>`;
  }

  function gramTableNav(dir) {
    _gramTopicIdx += dir;
    renderGramTable();
  }

  // ── LESSON ENGINE ─────────────────────────────────────────────────────────────
  function buildLessonQueue(words5, isRepeat) {
    const queue = [];
    // Önce 5 kelimeyi öğret
    words5.forEach(w => queue.push({ type: 'teach', word: w, repeat: false }));
    // Sonra test et
    words5.forEach(w => queue.push({ type: 'test', word: w, repeat: false }));
    // Tekrar soruları (öğrenilmiş kelimelerden 2 adet)
    if (isRepeat && isRepeat.length > 0) {
      isRepeat.forEach(w => queue.push({ type: 'test', word: w, repeat: true }));
    }
    return queue;
  }

  function startLesson() {
    const allWords = vocabulary[currentLevel] || [];
    let unlearned = allWords.filter(w => !learnedIds.includes(w.id));
    if (unlearned.length < 5) unlearned = [...allWords].sort(() => .5 - Math.random());
    const words5 = unlearned.sort(() => .5 - Math.random()).slice(0, 5);
    if (!words5.length) return;

    // Tekrar soruları: öğrenilmiş kelimelerden rastgele 2 tane
    const learned = allWords.filter(w => learnedIds.includes(w.id)).sort(() => .5 - Math.random()).slice(0, 2);

    lessonQueue = buildLessonQueue(words5, learned);
    currentItemIdx = 0;
    lives = 5;
    renderLessonItem(words5);
  }

  let _currentLessonWords5 = []; // teach aşamasının kelimelerini sakla

  function startGrammarLesson() {
    let pool = grammarSentences.filter(s => s.level === currentLevel);
    if (pool.length === 0) pool = grammarSentences; // fallback
    const sentences5 = [...pool].sort(() => .5 - Math.random()).slice(0, 5);
    if (!sentences5.length) return;

    lessonQueue = [];
    // 1) Önce tüm cümleleri öğret
    sentences5.forEach(s => lessonQueue.push({ type: 'teach_sentence', sentence: s }));
    // 2) Ara geçiş ekranı
    lessonQueue.push({ type: 'test_divider', sentences: sentences5 });
    // 3) Sonra tüm boşluk doldurma testleri
    sentences5.forEach(s => lessonQueue.push({ type: 'test_sentence', sentence: s }));

    currentItemIdx = 0;
    lives = 5;
    _currentLessonWords5 = [];
    renderLessonItem([]);
  }

  // ── RENDER LESSON ITEM ────────────────────────────────────────────────────────
  function renderLessonItem(words5) {
    if (words5) _currentLessonWords5 = words5;

    if (lives <= 0) { renderComplete(false); return; }
    if (currentItemIdx >= lessonQueue.length) {
      // Mark words as learned
      _currentLessonWords5.forEach(w => { if (!learnedIds.includes(w.id)) learnedIds.push(w.id); });
      localStorage.setItem('german_learned_words', JSON.stringify(learnedIds));
      renderComplete(true);
      return;
    }

    const item = lessonQueue[currentItemIdx];
    const pct  = Math.round(currentItemIdx / lessonQueue.length * 100);

    let innerHtml = '';

    // ── Teach word ──
    if (item.type === 'teach') {
      const emoji = getEmoji(item.word.german_word, item.word.turkish_meaning);
      const emojiHtml = emoji ? `<div class="g-teach-emoji">${emoji}</div>` : '';
      const formatted = item.word.german_word.split(',').map(w => w.trim()).join('<br>');
      speak(item.word.german_word);
      innerHtml = `
        <div class="g-card" style="text-align:center;">
          ${emojiHtml}
          <div class="g-teach-word">${formatted}</div>
          <div class="g-teach-meaning">${item.word.turkish_meaning}</div>
          <button class="g-audio-btn" onclick="window.GermanModule.speak('${item.word.german_word.replace(/'/g,"\\'")}')">🔊</button>
        </div>`;

    // ── Test word ──
    } else if (item.type === 'test') {
      const pool = vocabulary[currentLevel].filter(x => x.turkish_meaning !== item.word.turkish_meaning);
      const opts = [item.word.turkish_meaning,
        ...pool.sort(() => .5 - Math.random()).slice(0,3).map(x => x.turkish_meaning)
      ].sort(() => .5 - Math.random());
      const repeatBadge = item.repeat ? `<div class="g-repeat-badge">🔁 Tekrar</div>` : '';
      speak(item.word.german_word);
      innerHtml = `
        ${repeatBadge}
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
          <button class="g-audio-btn" style="width:44px;height:44px;font-size:18px;"
                  onclick="window.GermanModule.speak('${item.word.german_word.replace(/'/g,"\\'")}')">🔊</button>
          <div style="font-size:20px;font-weight:800;color:var(--g-text);">
            "${item.word.german_word.split(',')[0].trim()}" ne demek?
          </div>
        </div>
        <div class="g-options" id="gOptionsArea">
          ${opts.map(o => `<button class="g-option"
              onclick="window.GermanModule.checkAnswer(this,'${o.replace(/'/g,"\\'")}','${item.word.turkish_meaning.replace(/'/g,"\\'")}')">
              ${o}</button>`).join('')}
        </div>`;

    // ── Teach sentence ──
    } else if (item.type === 'teach_sentence') {
      speak(item.sentence.german);
      innerHtml = `
        <div class="g-bubble">
          <div class="g-bubble-tail"></div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <img src="https://flagcdn.com/w40/de.png" style="width:20px;border-radius:3px;">
            <span style="font-size:12px;font-weight:700;color:var(--g-blue);text-transform:uppercase;letter-spacing:.5px;">
              ${item.sentence.topic}
            </span>
            <button onclick="window.GermanModule.speak('${item.sentence.german.replace(/'/g,"\\'")}')"
                    style="background:none;border:none;color:var(--g-blue);font-size:20px;cursor:pointer;margin-left:auto;">🔊</button>
          </div>
          <div class="g-bubble-german">${item.sentence.german}</div>
          <div class="g-bubble-turkish">${item.sentence.turkish}</div>
        </div>
        <div class="g-avatar">👩‍🏫</div>`;

    // ── Divider — "Kendini Dene" geçiş ekranı ──
    } else if (item.type === 'test_divider') {
      const sentenceList = item.sentences.map((s, i) =>
        `<div style="padding:11px 16px;border-bottom:1px solid var(--g-border);">
           <div style="font-size:14px;font-weight:700;color:var(--g-text);">${i+1}. ${s.german}</div>
           <div style="font-size:13px;color:var(--g-text-muted);margin-top:2px;">${s.turkish}</div>
         </div>`
      ).join('');
      innerHtml = `
        <div style="text-align:center;margin-bottom:24px;">
          <div style="font-size:72px;margin-bottom:12px;">🧠</div>
          <h2 style="font-size:22px;font-weight:800;color:var(--g-text);margin:0 0 8px;">Kendini Dene!</h2>
          <p style="color:var(--g-text-muted);font-size:15px;margin:0 0 20px;line-height:1.5;">
            Öğrendiğin ${item.sentences.length} cümle için<br>boşluk doldurma soruları geliyor.
          </p>
        </div>
        <div class="g-card" style="padding:0;overflow:hidden;">
          <div style="padding:12px 16px;background:var(--g-green);">
            <span style="color:#fff;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">📋 Öğrenilen Cümleler</span>
          </div>
          ${sentenceList}
        </div>`;

    // ── Test sentence (fill-in-the-blank) ──
    } else if (item.type === 'test_sentence') {
      const words = item.sentence.german.split(/\s+/);
      const candidates = words.filter(w => w.replace(/[.,?!]/g,'').length > 3);
      const blank = candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : words[Math.floor(words.length / 2)];
      const cleanBlank = blank.replace(/[.,?!]/g,'');
      const blanked = item.sentence.german.replace(blank,
        `<span style="background:var(--g-blue);color:transparent;border-radius:4px;padding:0 10px;letter-spacing:2px;">____</span>`);

      const otherWords = grammarSentences
        .map(s => s.german.split(/\s+/).filter(w => w.replace(/[.,?!]/g,'').length > 3))
        .flat().filter(w => w.replace(/[.,?!]/g,'') !== cleanBlank)
        .sort(() => .5 - Math.random()).slice(0, 3)
        .map(w => w.replace(/[.,?!]/g,''));
      const opts = [cleanBlank, ...otherWords].sort(() => .5 - Math.random());

      innerHtml = `
        <div class="g-bubble">
          <div class="g-bubble-tail"></div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <span style="font-size:12px;font-weight:700;color:var(--g-text-muted);text-transform:uppercase;letter-spacing:.5px;">Boşluğu Doldur</span>
            <button onclick="window.GermanModule.speak('${item.sentence.german.replace(/'/g,"\\'")}')"
                    style="background:none;border:none;color:var(--g-blue);font-size:20px;cursor:pointer;margin-left:auto;">🔊</button>
          </div>
          <div class="g-bubble-german" style="line-height:1.7;">${blanked}</div>
          <div class="g-bubble-turkish">${item.sentence.turkish}</div>
        </div>
        <div class="g-avatar">🤔</div>
        <div class="g-options" id="gOptionsArea">
          ${opts.map(o => `<button class="g-option"
              onclick="window.GermanModule.checkAnswer(this,'${o.replace(/'/g,"\\'")}','${cleanBlank.replace(/'/g,"\\'")}')">
              ${o}</button>`).join('')}
        </div>`;
    }

    const showFooter = item.type === 'teach' || item.type === 'teach_sentence' || item.type === 'test_divider';


    document.getElementById('germanAppContent').innerHTML = `
      <div class="g-wrap">
        ${headerHTML(false)}
        <div class="g-lesson-body" style="padding:16px 20px;overflow-y:auto;">
          <div class="g-content">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
              <button class="g-btn ghost" style="padding:6px 12px;font-size:16px;"
                      onclick="window.GermanModule.renderHome()">❌</button>
              <div class="g-prog-bar" style="flex:1;">
                <div class="g-prog-fill" style="width:${pct}%"></div>
              </div>
              <div class="g-lives">❤️ ${lives}</div>
            </div>
            ${innerHtml}
          </div>
        </div>
        <div class="g-footer" id="gFooter" style="${showFooter ? 'display:flex;' : 'display:none;'}">
          <div class="g-feedback" id="gFeedback" style="display:none;"></div>
          <button class="g-btn" id="gContinueBtn" style="width:100%;"
                  onclick="window.GermanModule.nextItem()">Devam Et</button>
        </div>
      </div>`;

    if (!showFooter) {
      document.getElementById('gFooter').style.display = 'none';
    }
  }

  // ── CHECK ANSWER ──────────────────────────────────────────────────────────────
  function checkAnswer(btn, selected, correct) {
    const area = document.getElementById('gOptionsArea');
    if (!area || area.dataset.answered) return;
    area.dataset.answered = '1';

    const footer    = document.getElementById('gFooter');
    const feedback  = document.getElementById('gFeedback');
    const continueBtn = document.getElementById('gContinueBtn');

    if (selected === correct) {
      btn.classList.add('correct');
      playSound('correct');
      feedback.className = 'g-feedback ok';
      feedback.innerHTML = '✅ Harika!';
      continueBtn.style.background = 'var(--g-green)';
      continueBtn.style.borderBottomColor = 'var(--g-green-dark)';
    } else {
      btn.classList.add('wrong');
      area.querySelectorAll('.g-option').forEach(b => { if (b.textContent.trim() === correct) b.classList.add('correct'); });
      playSound('wrong');
      lives--;
      feedback.className = 'g-feedback bad';
      feedback.innerHTML = `❌ Doğrusu: <strong>${correct}</strong>`;
      continueBtn.style.background = 'var(--g-red)';
      continueBtn.style.borderBottomColor = 'var(--g-red-dark)';
      // Push failed item to end of queue
      lessonQueue.push(lessonQueue[currentItemIdx]);
    }

    feedback.style.display = 'flex';
    footer.style.display = 'flex';
  }

  function nextItem() {
    currentItemIdx++;
    renderLessonItem(null);
  }

  // ── COMPLETE SCREEN ───────────────────────────────────────────────────────────
  function renderComplete(win) {
    if (win) playSound('correct');
    document.getElementById('germanAppContent').innerHTML = `
      <div class="g-wrap">
        ${headerHTML(false)}
        <div class="g-body" style="display:flex;align-items:center;justify-content:center;">
          <div class="g-content" style="text-align:center;">
            <div style="font-size:96px;margin-bottom:16px;">${win ? '🎉' : '💔'}</div>
            <h2 style="font-size:28px;color:${win ? 'var(--g-yellow)' : 'var(--g-red)'};margin:0 0 12px;">
              ${win ? 'Ders Tamamlandı!' : 'Canların Bitti!'}
            </h2>
            <p style="color:var(--g-text-muted);font-size:16px;margin:0 0 32px;">
              ${win ? 'Harika iş çıkardın! Öğrenmeye devam et.' : 'Pek etme, dinlen ve tekrar dene. 💪'}
            </p>
            <button class="g-btn" style="width:100%;padding:16px;" onclick="window.GermanModule.renderHome()">
              Ana Sayfaya Dön
            </button>
          </div>
        </div>
      </div>`;
  }

  // ── TOPIC GUIDE DATA ──────────────────────────────────────────────────────────
  const CURRICULUM = [
    {
      level: 'A1', color: '#58cc02', bg: '#f0fff0',
      sections: [
        { title: 'A1 Çekirdek Gramer', topics: ['Selamlaşma ve vedalaşma kalıpları', 'Alfabe ve telaffuz', 'Kişi zamirleri', 'Sayılar', 'Nominativ, Akkusativ ve Dativ ile tanışma', 'Düzenli ve düzensiz fiil çekimleri', 'Modal fiillere giriş', 'Emir cümleleri'] },
        { title: 'A1 Cümle & Günlük Konular', topics: ['Artikeller: der, die, das / ein, eine / kein', 'İyelik sıfatları: mein, dein, sein', 'Sıfat, zarf ve temel edatlar', 'Präsens ve geçmiş zamana giriş', 'Olumsuz cümleler', 'Ja/Nein soruları ve W-Fragen', 'Aile, ev, yiyecek, günler, aylar, renkler'] },
        { title: '👋 Tanışma & Selamlaşma', topics: ['Merhaba / Güle güle (Hallo / Tschüss)', 'Nasılsın? (Wie geht es dir?)', 'Adın ne? (Wie heißt du?)', 'Nereli­sin? (Woher kommst du?)', 'Kendini tanıtma'] },
        { title: '🔤 Temel Dil Bilgisi', topics: ['Şahıs zamirleri (ich, du, er/sie/es…)', 'sein çekimi (bin, bist, ist…)', 'haben çekimi (habe, hast, hat…)', 'Düzenli fiil çekimleri (-en eki)', 'Artikeller: der / die / das', 'Belirtisiz artikel: ein / eine', 'Tekil ve çoğul isimler'] },
        { title: '🔢 Sayılar & Zaman', topics: ['Sayılar 1–100', 'Saat sorma ve söyleme', 'Haftanın günleri', 'Aylar ve mevsimler', 'Tarih ifade etme'] },
        { title: '🏠 Günlük Hayat', topics: ['Renkler', 'Vücut bölümleri', 'Aile üyeleri', 'Ev ve eşyalar', 'Yiyecek ve içecekler', 'Alışveriş (Was kostet das?)'] },
        { title: '📐 Cümle Yapısı', topics: ['Temel cümle düzeni (SVO)', 'Olumsuz cümle (nicht / kein)', 'Soru cümleleri (W-Fragen)', 'İyelik zamirleri (mein, dein…)', 'Ayrılabilen fiiller (aufstehen vb.)'] },
      ]
    },
    {
      level: 'A2', color: '#1cb0f6', bg: '#f0f8ff',
      sections: [
        { title: 'A2 Gramer Genişletme', topics: ['Perfekt ve Präteritum', 'Modal fiillerin geçmiş zamanı', 'Reflexive ve reziproke fiiller', 'Wechselpräpositionen', 'Lokale ve temporale Präpositionen', 'Nominativ, Akkusativ, Dativ kullanımı'] },
        { title: 'A2 Bağlaçlar & Kelime Yapımı', topics: ['Komparativ ve Superlativ', 'Position 0 ve Position 1 bağlaçları', 'Nebensätze: weil, dass, wenn', 'Yer ve yön zarfları', 'Partikeln: ja, doch, mal, denn', 'Komposita ve -chen, -lein, -ung gibi eklerle kelime türetme'] },
        { title: '🏡 Günlük Rutinler', topics: ['Sabah rutini (aufwachen, frühstücken…)', 'Sıklık zarfları (immer, oft, manchmal)', 'İş ve okul hayatı', 'Hobiler ve boş zaman'] },
        { title: '🗺️ Yön & Ulaşım', topics: ['Yön tarifi (links, rechts, geradeaus)', 'Toplu taşıma (Bus, Bahn, U-Bahn)', 'Bilet alma diyalogları', 'Şehirde yerler (Bahnhof, Post, Apotheke)'] },
        { title: '🛒 Alışveriş & Yemek', topics: ['Mağazada alışveriş diyaloğu', 'Restoranda sipariş verme', 'Fiyat sormak ve pazarlık', 'Yiyecek-içecek isimleri ve miktarlar'] },
        { title: '🏥 Sağlık & Vücut', topics: ['Vücut organları', 'Hastalık ve şikayetler', 'Doktorda diyalog', 'Eczanede ilaç alma'] },
        { title: '📚 Dil Bilgisi – A2', topics: ['Perfekt (geçmiş zaman – konuşma dili)', 'Präteritum (sein ve haben geçmişi)', 'Modal fiiller (können, müssen, wollen, dürfen, sollen, mögen)', 'Weil ve denn bağlaçları', 'Dativ durumu (Yönelme hali)', 'Akkusativ durumu (Belirtme hali)', 'Komparativ ve Superlativ (büyük, en büyük)'] },
      ]
    },
    {
      level: 'B1', color: '#ff9500', bg: '#fffaf0',
      sections: [
        { title: 'B1 Yapılar', topics: ['Präteritum ve Plusquamperfekt', 'Reflexivpronomen im Dativ', 'Trennbare ve untrennbare Verben', 'Verben mit Präpositionen', 'Präpositionaladverbien', 'Konjunktiv II formları ve kullanımı', 'Passiv temel ve geçmiş zaman'] },
        { title: 'B1 Yan Cümleler & Çekimler', topics: ['Futur I ve werden kullanımları', 'lassen fiili', 'Positions- ve Direktionsverben', 'Genitiv ve n-Deklination', 'Infinitiv mit/ohne zu', 'Relativsätze', 'Temporale Nebensätze', 'Finalsätze', 'Doppelkonnektoren', 'Adjektivdeklination'] },
        { title: '✈️ Seyahat & Konaklama', topics: ['Otel rezervasyonu', 'Havaalanı ve sınır kapısı', 'Turistik geziler planlama', 'Sorun bildirme (şikayet)'] },
        { title: '💼 İş & Eğitim', topics: ['CV ve iş başvurusu', 'İş görüşmesi diyaloğu', 'Meslekler ve görevler', 'Okul sistemi ve eğitim'] },
        { title: '📰 Medya & Toplum', topics: ['Haber okuma ve yorumlama', 'İnternet ve sosyal medya', 'Çevre ve sürdürülebilirlik', 'Kültür ve sanat'] },
        { title: '💬 Görüş Bildirme', topics: ['Fikir belirtme (Ich bin der Meinung…)', 'Karşı çıkma ve tartışma', 'Öneri yapma (Ich schlage vor…)', 'Olumlu/olumsuz değerlendirme'] },
        { title: '📚 Dil Bilgisi – B1', topics: ['Yan cümleler: weil, dass, wenn, obwohl', 'Relativsätze (bağıl yan cümleler)', 'Konjunktiv II – kibar istekler (würde, könnte)', 'Passiv yapı (Edilgen cümle)', 'Plusquamperfekt (geçmişin geçmişi)', 'Futur I (werden + infinitiv)'] },
      ]
    },
    {
      level: 'B2', color: '#ff4b4b', bg: '#fff5f5',
      sections: [
        { title: 'B2 İleri Gramer', topics: ['Konnektoren: als, bevor, bis, seitdem, während, wenn', 'sobald ve solange', 'Verben und Ergänzungen', 'Geçmiş ve gelecek zaman kipleri', 'Futur mit werden', 'Angaben im Satz', 'nicht ve olumsuzluk kelimeleri'] },
        { title: 'B2 Stil & Karmaşık Cümle', topics: ['Passiv Präteritum', 'Konjunktiv II der Vergangenheit', 'Konjunktiv II + Modalverben', 'einander zamirleri', 'Weiterführende Nebensätze', 'Genitiv edatları', 'je ... desto/umso', 'Nomen-Verb-Verbindungen', 'Sonuç bağlaçları', 'Relativsätze im Genitiv', 'Konjunktiv I ile dolaylı anlatım'] },
        { title: '🎓 Akademik & Profesyonel', topics: ['Akademik metin okuma/yazma', 'Sunum yapma (Vortrag halten)', 'Resmi yazışmalar ve e-posta', 'Özet çıkarma ve parafraz'] },
        { title: '⚖️ Tartışma & Eleştiri', topics: ['Avantaj-dezavantaj analizi', 'Etik ve felsefi tartışmalar', 'Medya eleştirisi', 'Politika ve ekonomi dili'] },
        { title: '🤝 Sosyal & Kültürel', topics: ['Almanca konuşulan ülke kültürleri', 'Deyimler ve kalıp ifadeler (Redewendungen)', 'Edebi metinler ve şiir', 'Mizah ve ironi anlama'] },
        { title: '📚 Dil Bilgisi – B2', topics: ['Konjunktiv I (dolaylı anlatım)', 'İleri seviye Passiv yapıları', 'Partizipial yapılar', 'Genişletilmiş attribut (Erweiterte Attribute)', 'Futur II (gelecekte tamamlanmış)', 'Sezgisel fiil kullanımı ve stil'] },
      ]
    }
  ];

  async function showTopicGuide() {
    let modal = document.getElementById('gTopicModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'gTopicModal';
      document.getElementById('germanAppScreen').appendChild(modal);
    }

    modal.innerHTML = `
      <div style="position:fixed;inset:0;background:var(--g-bg);z-index:9999;display:flex;flex-direction:column;">
        ${headerHTML(false)}
        <div class="g-body">
          <div class="g-content">
            <div class="g-card" style="text-align:center;">
              <div style="font-size:42px;margin-bottom:10px;">📘</div>
              <div style="font-size:20px;font-weight:800;color:var(--g-text);">A1 Konuları yükleniyor...</div>
            </div>
          </div>
        </div>
      </div>`;

    try {
      const res = await fetch('almanca/A1 Konuları.txt');
      if (!res.ok) throw new Error('A1 Konuları.txt okunamadı');
      const guide = parseA1GuideText(await res.text());
      renderA1TopicList(guide);
    } catch (err) {
      console.error(err);
      modal.innerHTML = `
        <div style="position:fixed;inset:0;background:var(--g-bg);z-index:9999;display:flex;flex-direction:column;">
          ${headerHTML(false)}
          <div class="g-body">
            <div class="g-content">
              <div class="g-card">
                <h2 style="color:var(--g-red);margin:0 0 8px;">A1 Konuları açılamadı</h2>
                <p style="color:var(--g-text-muted);line-height:1.5;margin:0 0 18px;">${err.message}</p>
                <button class="g-btn ghost" onclick="window.GermanModule.closeTopicGuide()">Geri Dön</button>
              </div>
            </div>
          </div>
        </div>`;
    }
  }

  function parseA1GuideText(text) {
    const parts = text.replace(/\r/g, '').split(/\n-{20,}\n/g);
    const intro = parts.shift() || '';
    const topics = [];
    let current = null;

    intro.split('\n').forEach(raw => {
      const line = raw.trim();
      if (!line) return;
      const main = line.match(/^(\d+)\s*-?\s*(.+)$/);
      if (main) {
        const body = main[2].trim();
        const colon = body.indexOf(':');
        current = {
          number: Number(main[1]),
          title: (colon >= 0 ? body.slice(0, colon) : body).trim(),
          summary: (colon >= 0 ? body.slice(colon + 1) : '').trim(),
          bullets: []
        };
        topics.push(current);
        return;
      }
      if (current && /^[-•]/.test(line)) {
        current.bullets.push(line.replace(/^[-•]\s*/, '').trim());
      }
    });

    const detailChunks = parts.map(chunk => chunk.trim()).filter(Boolean).map(chunk => {
      const lines = chunk.split('\n').map(l => l.trim()).filter(Boolean);
      return {
        title: (lines[0] || '').replace(/^[-•]\s*/, '').replace(/:$/, '').trim(),
        text: chunk
      };
    });

    let activeTopic = null;
    detailChunks.forEach(chunk => {
      const match = findBestA1Topic(topics, chunk.title);
      if (match) activeTopic = match;
      if (activeTopic) {
        activeTopic.details = activeTopic.details || [];
        activeTopic.details.push(chunk);
      }
    });

    return { topics };
  }

  function normalizeA1Text(value) {
    return (value || '')
      .toLocaleLowerCase('tr-TR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ı/g, 'i')
      .replace(/[^a-z0-9ğüşöçıäöüß\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function findBestA1Topic(topics, heading) {
    const h = normalizeA1Text(heading);
    if (!h) return null;
    let best = null;
    let bestScore = 0;
    const generic = new Set(['almanca', 'konusu', 'konulari', 'ornek', 'ornekler', 'fiiller', 'fiil', 'cumleleri']);
    topics.forEach(topic => {
      const t = normalizeA1Text(topic.title);
      const words = t.split(' ').filter(w => w.length > 3 && !generic.has(w));
      let score = h.includes(t) ? 100 : 0;
      words.forEach((word, idx) => {
        if (h.includes(word) || (h.length >= 3 && word.includes(h))) score += idx === 0 ? 24 : 12;
      });
      if (score > bestScore) {
        bestScore = score;
        best = topic;
      }
    });
    return bestScore >= 12 ? best : null;
  }

  function escapeHTML(value) {
    return String(value || '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function formatHeaderLabel(value) {
    const safe = escapeHTML(value).replace(/\s*\(([^)]+)\)/g, '<span style="display:block;font-size:11px;font-weight:700;opacity:.9;margin-top:2px;">$1</span>');
    return safe
      .replace('Almanca İfade', 'Almanca')
      .replace('Türkçe Anlamı', 'Türkçe')
      .replace('Almanca Yazılışı', 'Almanca');
  }

  function splitGermanTurkish(value) {
    const m = String(value || '').match(/^(.*?)\s*\((.*?)\)\s*$/);
    return m ? { german: m[1].trim(), turkish: m[2].trim() } : { german: String(value || '').trim(), turkish: '' };
  }

  function formatTableCell(value) {
    return escapeHTML(value).replace(/\s*\(([^)]+)\)/g, '<span style="display:block;font-size:12px;color:var(--g-text-muted);line-height:1.25;margin-top:2px;">$1</span>');
  }

  function shortMeaning(value) {
    return String(value || '').split(',')[0].trim();
  }

  function renderExampleCards(examples) {
    if (!examples.length) return '';
    return `
      <div style="font-size:16px;font-weight:900;color:var(--g-text);margin:18px 0 10px;">Örnek Cümleler</div>
      <div style="display:grid;gap:10px;margin-bottom:18px;">
        ${examples.map(item => {
          const parsed = splitGermanTurkish(item);
          return `<div style="background:#f3f4f6;border:1px solid var(--g-border);border-left:4px solid #52525b;border-radius:12px;padding:10px 12px;">
            <div style="font-size:14px;font-weight:800;color:var(--g-text);line-height:1.45;">${escapeHTML(parsed.german)}</div>
            ${parsed.turkish ? `<div style="font-size:13px;color:var(--g-text-muted);line-height:1.45;margin-top:3px;">${escapeHTML(parsed.turkish)}</div>` : ''}
          </div>`;
        }).join('')}
      </div>`;
  }

  function renderA1Table(tableRows) {
    if (!tableRows.length) return '';
    let head = tableRows[0];
    let body = tableRows.slice(1);
    const headText = normalizeA1Text(head.join(' '));
    let examples = [];

    const render = (headers, rows) => `
      <div class="g-table-wrap" style="margin:12px 0 18px;">
        <table class="g-table">
          <thead><tr>${headers.map(c => `<th>${formatHeaderLabel(c)}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(row => `<tr>${headers.map((_, i) => `<td>${formatTableCell(row[i] || '')}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>`;

    if (headText.includes('kullanim durumu') && head.length >= 3) {
      return render(['Almanca İfade', 'Türkçe Anlamı'], body.map(row => [row[0], row[1]]));
    }

    if (headText.includes('turkce okunusu') && head.length >= 3) {
      return render(['Rakam', 'Almanca Yazılışı'], body.map(row => [row[0], row[1]]));
    }

    if (headText.includes('sira no') && headText.includes('almanca fiil')) {
      examples = body.map(row => row[2]).filter(Boolean);
      const rows = body.map(row => [row[1]]).filter(row => row[0]);
      return render(['Fiil'], rows) + renderExampleCards(examples);
    }

    if (headText.includes('sahis zamirleri') && headText.includes('fiil kok')) {
      return render(['Zamir', 'Fiil Kökü', 'Ek'], body.map(row => row.length === 2 ? [row[0], '', row[1]] : [row[0], row[1] || '', row[2] || '']));
    }

    if (headText.includes('mussen') && headText.includes('konnen')) {
      const verbs = head.length === 7 ? head : head.slice(1);
      const leftHeaders = ['Zamir', verbs[0], verbs[1], verbs[2]];
      const rightHeaders = ['Zamir', verbs[3], verbs[4], verbs[5], verbs[6]];
      return render(leftHeaders, body.map(row => [row[0], row[1], row[2], row[3]]))
        + render(rightHeaders, body.map(row => [row[0], row[4], row[5], row[6], row[7]]));
    }

    if (headText.includes('on ek') && headText.includes('trennbare')) {
      return render(['Ön Ek', 'Örnek', 'Anlam'], body.map(row => [row[0], row[1], shortMeaning(row[2])]));
    }

    if (headText.includes('prafixler') && headText.includes('pozisyon')) {
      const rows = body.map(row => {
        const verb = row[0] || '';
        const sentence = row.slice(1).filter(Boolean).join(' ');
        examples.push(sentence);
        return [verb.replace('|', ''), shortMeaning((verb.match(/\((.*?)\)/) || [])[1] || '')];
      });
      return render(['Fiil', 'Anlam'], rows) + renderExampleCards(examples);
    }

    if (body.length && head.length === 3 && !/sira|almanca|turkce|zamir|prafix|on ek|rakam/i.test(headText)) {
      const rows = tableRows.map(row => [row[0], row[1]]);
      examples = tableRows.map(row => row[2]).filter(Boolean);
      return render(['Sıfat', 'Anlam'], rows) + renderExampleCards(examples);
    }

    if (head.length > 3) {
      const first = head[0] || 'Konu';
      const second = head.find(h => /anlam|turkce|fiil|ornek|cumle/i.test(normalizeA1Text(h))) || head[1] || 'Açıklama';
      const secondIdx = head.indexOf(second);
      examples = body.map(row => row.slice(2).filter(Boolean).join(' ')).filter(Boolean);
      return render([first, second], body.map(row => [row[0], row[secondIdx]])) + renderExampleCards(examples);
    }

    return render(head, body);
  }

  function formatA1DetailText(text, topic) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let html = '';
    let tableRows = [];

    function flushTable() {
      if (tableRows.length < 2) {
        tableRows.forEach(row => {
          html += `<p style="font-size:14px;line-height:1.6;color:var(--g-text);margin:0 0 10px;">${escapeHTML(row.join(' - '))}</p>`;
        });
      } else {
        html += renderA1Table(tableRows, topic);
      }
      tableRows = [];
    }

    lines.forEach((line, idx) => {
      const cols = line.split(/\t+/).map(c => c.trim()).filter(Boolean);
      if (cols.length >= 2) {
        tableRows.push(cols);
        return;
      }
      flushTable();

      if (idx === 0 || line.endsWith(':')) {
        html += `<h3 style="font-size:${idx === 0 ? '22px' : '17px'};font-weight:800;color:var(--g-text);margin:${idx === 0 ? '0' : '18px'} 0 10px;line-height:1.25;">${escapeHTML(line.replace(/:$/, ''))}</h3>`;
      } else if (/^[-•]/.test(line)) {
        html += `<div style="display:flex;gap:8px;align-items:flex-start;font-size:14px;line-height:1.55;color:var(--g-text);margin:0 0 8px;"><span style="color:var(--g-text-muted);font-weight:900;">•</span><span>${escapeHTML(line.replace(/^[-•]\s*/, ''))}</span></div>`;
      } else {
        html += `<p style="font-size:14px;line-height:1.6;color:var(--g-text);margin:0 0 10px;">${escapeHTML(line)}</p>`;
      }
    });
    flushTable();
    return html;
  }

  function renderA1TopicList(guide) {
    const modal = document.getElementById('gTopicModal');
    const cards = guide.topics.map((topic, idx) => `
      <button onclick="window.GermanModule._openA1Topic(${idx})" style="
        width:100%;display:block;text-align:left;border:1px solid ${idx % 2 === 0 ? '#4b5563' : '#d1d5db'};
        border-bottom:4px solid ${idx % 2 === 0 ? '#2f343b' : '#a3a3a3'};
        background:${idx % 2 === 0 ? '#3f3f46' : '#f8f8f8'};
        border-radius:12px;padding:16px;margin-bottom:12px;cursor:pointer;color:${idx % 2 === 0 ? '#fff' : 'var(--g-text)'};box-shadow:0 8px 18px rgba(0,0,0,0.06);">
        <div style="display:flex;gap:13px;align-items:flex-start;">
          <span style="flex-shrink:0;width:32px;height:32px;border-radius:9px;background:${idx % 2 === 0 ? '#f8f8f8' : '#3f3f46'};color:${idx % 2 === 0 ? '#2f3033' : '#fff'};display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;">${topic.number}</span>
          <span style="min-width:0;">
            <span style="display:block;font-size:16px;font-weight:900;line-height:1.25;margin-bottom:4px;">${escapeHTML(topic.title)}</span>
            <span style="display:block;font-size:13px;color:${idx % 2 === 0 ? '#d4d4d8' : 'var(--g-text-muted)'};line-height:1.4;">${escapeHTML(topic.summary || topic.bullets.join(' • ') || 'Detaylı anlatımı aç')}</span>
          </span>
        </div>
      </button>`).join('');

    window.GermanModule._openA1Topic = idx => renderA1TopicDetail(guide, idx);

    modal.innerHTML = `
      <div style="position:fixed;inset:0;background:var(--g-bg);z-index:9999;display:flex;flex-direction:column;">
        <div class="g-header">
          <div class="g-title"><img src="https://flagcdn.com/w40/de.png" style="width:22px;height:16px;border-radius:3px;"> A1 Konuları</div>
          <button class="g-btn ghost" style="font-size:13px;padding:6px 14px;" onclick="window.GermanModule.closeTopicGuide()">Kapat</button>
        </div>
        <div class="g-body">
          <div class="g-content">
            <div style="margin:4px 0 18px;padding:18px 16px;border:1px solid var(--g-border);border-bottom:4px solid var(--g-border-bot);border-radius:14px;background:#f8f8f8;">
              <div style="font-size:12px;font-weight:900;color:var(--g-text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Almanca A1</div>
              <h2 style="color:var(--g-text);margin:0 0 6px;font-size:24px;line-height:1.2;">Konu Listesi</h2>
              <p style="color:var(--g-text-muted);margin:0;font-size:14px;line-height:1.45;">${guide.topics.length} başlık, dosyadaki sıraya göre hazırlanmıştır.</p>
            </div>
            ${cards}
          </div>
        </div>
      </div>`;
  }

  function renderA1TopicDetail(guide, idx) {
    const topic = guide.topics[idx];
    const detailBlocks = topic.details?.length
      ? topic.details.map(block => formatA1DetailText(block.text, topic)).join('')
      : `<p style="font-size:14px;line-height:1.6;color:var(--g-text);margin:0 0 12px;">${escapeHTML(topic.summary)}</p>${topic.bullets.map(b => `<div style="display:flex;gap:8px;margin-bottom:8px;"><span style="color:var(--g-text-muted);font-weight:900;">•</span><span>${escapeHTML(b)}</span></div>`).join('')}`;

    document.getElementById('gTopicModal').innerHTML = `
      <div style="position:fixed;inset:0;background:var(--g-bg);z-index:9999;display:flex;flex-direction:column;">
        <div class="g-header">
          <div class="g-title"><img src="https://flagcdn.com/w40/de.png" style="width:22px;height:16px;border-radius:3px;"> A1 Konuları</div>
          <button class="g-btn ghost" style="font-size:13px;padding:6px 14px;" onclick="window.GermanModule._backA1Topics()">Liste</button>
        </div>
        <div class="g-body">
          <div class="g-content">
            <button class="g-btn ghost" style="font-size:13px;padding:7px 14px;margin-bottom:14px;" onclick="window.GermanModule._backA1Topics()">← Konulara Dön</button>
            <div class="g-card">
              <div style="font-size:12px;font-weight:900;color:var(--g-text-muted);text-transform:uppercase;margin-bottom:6px;">A1 • Konu ${topic.number}</div>
              <h2 style="font-size:24px;line-height:1.25;color:var(--g-text);margin:0 0 10px;">${escapeHTML(topic.title)}</h2>
              ${topic.summary ? `<p style="font-size:14px;line-height:1.55;color:var(--g-text-muted);margin:0;">${escapeHTML(topic.summary)}</p>` : ''}
            </div>
            <div class="g-card">${detailBlocks}</div>
          </div>
        </div>
      </div>`;

    window.GermanModule._backA1Topics = () => renderA1TopicList(guide);
  }

  function closeTopicGuide() {
    const modal = document.getElementById('gTopicModal');
    if (modal) modal.innerHTML = '';
  }

  // ── PUBLIC API ────────────────────────────────────────────────────────────────
  return {
    openApp, closeApp, renderHome, changeLevel,
    speak, startLesson, startGrammarLesson, startGrammarTables,
    renderGramTable, gramTableNav,
    showTopicGuide, closeTopicGuide,
    checkAnswer, nextItem
  };
})();
