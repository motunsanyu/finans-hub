// js/modules/german.js - Duolingo tarzı tam ekran Almanca Öğrenme Uygulaması

window.GermanModule = (function () {
  let vocabulary = { A1: [], A2: [], B1: [] };
  let currentLevel = 'A1';
  let isDataLoaded = false;
  
  // Lesson State
  let lessonWords = []; // 5 words for current lesson
  let lessonQueue = []; // mix of teaching and testing items
  let currentItemIdx = 0;
  let lives = 5;
  let learnedIds = JSON.parse(localStorage.getItem('german_learned_words')) || [];

  // Supabase instance
  function getSB() {
    return window._supabaseClient || null;
  }

  // ==== DATA FETCHING ====
  async function loadData() {
    if (isDataLoaded) return;
    
    document.getElementById('germanAppContent').innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#ffffff;">
        <div style="font-size:48px; color:#58cc02; margin-bottom:20px;"><i class="fas fa-spinner fa-spin"></i></div>
        <h2 style="color:#afafaf; font-weight:bold;">Kelimeler Yükleniyor...</h2>
      </div>
    `;

    try {
      let sbDataLoaded = false;
      const sb = getSB();
      if (sb) {
        const { data, error } = await sb.from('vocabulary').select('*');
        if (!error && data && data.length > 0) {
          data.forEach(item => {
            if (vocabulary[item.level]) vocabulary[item.level].push(item);
          });
          sbDataLoaded = true;
          console.log("German: Loaded vocabulary from Supabase.");
        } else {
            console.warn("German: Supabase vocabulary missing or empty. Falling back to local txt.");
        }
      }

      if (!sbDataLoaded) {
        const res = await fetch('almanca/Kelimeler.txt');
        const text = await res.text();
        parseKelimelerTxt(text);
      }

      isDataLoaded = true;
      renderHome();
    } catch (err) {
      console.error("German Data Load Error:", err);
      document.getElementById('germanAppContent').innerHTML = `
        <div style="text-align:center; padding:50px;">
           <h2 style="color:#ff4b4b;">Veriler Yüklenemedi</h2>
           <button onclick="window.GermanModule.closeApp()" class="g-btn" style="margin-top:20px;">Geri Dön</button>
        </div>
      `;
    }
  }

  function parseKelimelerTxt(text) {
    const lines = text.split('\n');
    let currentLvl = 'A1';
    let idCounter = 1;

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      if (line.includes('A1 Kelime Listesi')) { currentLvl = 'A1'; continue; }
      if (line.includes('A2 Kelime Listesi')) { currentLvl = 'A2'; continue; }
      if (line.includes('B1 Kelime Listesi')) { currentLvl = 'B1'; continue; }
      if (line.includes('---')) continue;

      const match = line.match(/^\d+\s+(.*?)\s+\((.*?)\)$/);
      let gWord = "", tMeaning = "";
      if (match) {
        gWord = match[1].trim(); tMeaning = match[2].trim();
      } else {
        const parts = line.split('\t');
        if (parts.length >= 2) {
            const wordPart = parts[1].split('(');
            if(wordPart.length > 1) {
                gWord = wordPart[0].trim(); tMeaning = wordPart[1].replace(')','').trim();
            }
        }
      }
      
      if(gWord && tMeaning) {
         vocabulary[currentLvl].push({
            id: 'txt_' + idCounter++,
            german_word: gWord,
            turkish_meaning: tMeaning,
            level: currentLvl
         });
      }
    }
  }

  // ==== TTS & AUDIO ====
  function speak(text) {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function playSound(type) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'correct') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'wrong') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  }

  // ==== EMOJI ASSIGNER ====
  function getEmojiForWord(word) {
      word = word.toLowerCase();
      if(word.includes('haus')) return '🏠';
      if(word.includes('hund')) return '🐕';
      if(word.includes('katze')) return '🐈';
      if(word.includes('auto')) return '🚗';
      if(word.includes('essen')) return '🍽️';
      if(word.includes('trinken')) return '💧';
      if(word.includes('mann') || word.includes('frau')) return '👤';
      if(word.includes('buch')) return '📖';
      if(word.includes('zeit')) return '⏰';
      return '✨';
  }

  // ==== UI SHELL ====
  const STYLES = `
    .g-header { display:flex; justify-content:space-between; align-items:center; padding:12px 20px; border-bottom:2px solid #e5e5e5; background:#fff; position:sticky; top:0; z-index:10; }
    .g-title { font-size:20px; font-weight:800; color:#58cc02; display:flex; align-items:center; gap:8px; }
    .g-btn { background:#58cc02; color:white; border:none; border-bottom:4px solid #46a302; border-radius:12px; padding:10px 20px; font-size:16px; font-weight:bold; cursor:pointer; transition:transform 0.1s, border-width 0.1s; text-align:center; }
    .g-btn:active { transform:translateY(4px); border-bottom-width:0; margin-bottom:4px; }
    .g-btn:disabled { background:#e5e5e5; border-bottom-color:#afafaf; color:#afafaf; cursor:not-allowed; }
    .g-btn.danger { background:#ff4b4b; border-bottom-color:#ea2b2b; }
    
    .g-btn-outline { background:#fff; color:#afafaf; border:2px solid #e5e5e5; border-bottom:4px solid #e5e5e5; border-radius:12px; padding:8px 16px; font-size:14px; font-weight:bold; cursor:pointer; }
    .g-btn-outline:active { transform:translateY(2px); border-bottom-width:2px; }
    
    .g-content { max-width:600px; margin:0 auto; padding:20px; }
    
    /* Lesson specific */
    .g-lesson-container { text-align:center; max-width:600px; margin:20px auto; }
    .g-progress-bar { height:12px; background:#e5e5e5; border-radius:6px; overflow:hidden; margin-bottom:16px; width:100%; }
    .g-progress-fill { height:100%; background:#58cc02; width:0%; transition:width 0.3s ease; }
    .g-lives { display:flex; justify-content:center; gap:4px; margin-bottom:16px; font-size:20px; color:#ff4b4b; }
    
    .g-teach-card { background:#fff; border:2px solid #e5e5e5; border-bottom:4px solid #e5e5e5; border-radius:16px; padding:30px; margin-bottom:24px; }
    .g-emoji-icon { font-size:64px; margin-bottom:16px; }
    .g-teach-word { font-size:32px; font-weight:bold; color:#4b4b4b; margin-bottom:8px; }
    .g-teach-meaning { font-size:20px; color:#afafaf; margin-bottom:24px; }
    .g-audio-btn { background:#1cb0f6; color:#fff; border:none; border-bottom:4px solid #1899d6; border-radius:12px; padding:12px; font-size:24px; cursor:pointer; width:64px; height:64px; display:inline-flex; align-items:center; justify-content:center; }
    .g-audio-btn:active { transform:translateY(4px); border-bottom-width:0; }
    
    .g-question { font-size:24px; font-weight:bold; color:#4b4b4b; margin-bottom:24px; }
    .g-options { display:grid; grid-template-columns:1fr; gap:12px; }
    .g-option { background:#fff; border:2px solid #e5e5e5; border-bottom:4px solid #e5e5e5; border-radius:12px; padding:16px; font-size:18px; font-weight:bold; color:#4b4b4b; cursor:pointer; transition:all 0.1s; text-align:left; }
    .g-option:active { transform:translateY(2px); border-bottom-width:2px; }
    .g-option.correct { background:#d7ffb8; border-color:#58cc02; border-bottom-color:#58cc02; color:#58cc02; }
    .g-option.wrong { background:#ffdfe0; border-color:#ff4b4b; border-bottom-color:#ff4b4b; color:#ea2b2b; }
    
    .g-footer { position:sticky; bottom:0; background:#fff; padding:20px; border-top:2px solid #e5e5e5; display:none; flex-direction:column; gap:12px; }
    .g-feedback-banner { padding:16px; border-radius:12px; font-weight:bold; font-size:18px; display:flex; align-items:center; gap:12px; }
    .g-feedback-correct { background:#d7ffb8; color:#58cc02; }
    .g-feedback-wrong { background:#ffdfe0; color:#ea2b2b; }
    
    .g-home-card { background:#fff; border:2px solid #e5e5e5; border-bottom:4px solid #e5e5e5; border-radius:16px; padding:20px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; }
    .g-home-icon { font-size:40px; }
  `;

  function renderHeader(showClose = true) {
    let styleTag = document.getElementById('germanAppStyles');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'germanAppStyles';
      styleTag.innerHTML = STYLES;
      document.head.appendChild(styleTag);
    }
    
    let closeBtn = showClose ? `<button class="g-btn-outline" onclick="window.GermanModule.closeApp()">Kapat</button>` : '';

    return `
      <div class="g-header">
        <div class="g-title"><img src="https://flagcdn.com/w40/de.png" style="width:24px; height:18px; border-radius:3px;"> Almanca Öğren</div>
        ${closeBtn}
      </div>
    `;
  }

  function openApp() {
    document.getElementById('germanAppScreen').style.display = 'block';
    document.body.style.overflow = 'hidden';
    loadData();
  }

  function closeApp() {
    document.getElementById('germanAppScreen').style.display = 'none';
    document.body.style.overflow = 'auto';
  }

  // ==== HOME SCREEN ====
  function renderHome() {
    // Toplam kelime ve öğrenilen kelime sayısını hesapla
    const allWords = vocabulary[currentLevel] || [];
    const learnedInLevel = allWords.filter(w => learnedIds.includes(w.id)).length;
    const progressPct = allWords.length ? Math.round((learnedInLevel / allWords.length) * 100) : 0;

    const html = `
      ${renderHeader(true)}
      <div class="g-content">
        <div style="text-align:center; margin-bottom:30px;">
          <h2 style="color:#4b4b4b;">Yola Çıkmaya Hazır mısın?</h2>
          <p style="color:#afafaf;">Seviyeni seç ve 5 kelimelik bir derse başla!</p>
        </div>
        
        <div style="display:flex; justify-content:center; margin-bottom:24px;">
           <select id="gLevelSelect" onchange="window.GermanModule.changeLevel(this.value)" style="padding:10px 20px; border-radius:12px; border:2px solid #e5e5e5; font-weight:bold; color:#4b4b4b; outline:none; font-size:16px;">
            <option value="A1" ${currentLevel === 'A1' ? 'selected' : ''}>A1 Seviye</option>
            <option value="A2" ${currentLevel === 'A2' ? 'selected' : ''}>A2 Seviye</option>
            <option value="B1" ${currentLevel === 'B1' ? 'selected' : ''}>B1 Seviye</option>
          </select>
        </div>

        <div class="g-home-card">
          <div style="display:flex; align-items:center; gap:16px;">
             <div class="g-home-icon">📚</div>
             <div>
                <div style="font-size:18px; font-weight:bold; color:#4b4b4b;">Günlük Kelime Dersi</div>
                <div style="color:#afafaf; font-size:14px;">5 yeni kelime öğren</div>
             </div>
          </div>
          <button class="g-btn" onclick="window.GermanModule.startLesson()">Derse Başla</button>
        </div>

        <div style="margin-top:30px; padding:20px; border:2px solid #e5e5e5; border-radius:16px;">
           <h3 style="color:#4b4b4b; margin-top:0;">İlerlemen (${currentLevel})</h3>
           <div class="g-progress-bar" style="height:16px; margin-bottom:8px;"><div class="g-progress-fill" style="width:${progressPct}%"></div></div>
           <div style="color:#afafaf; font-size:14px; text-align:right;">${learnedInLevel} / ${allWords.length} Kelime</div>
        </div>
      </div>
    `;
    document.getElementById('germanAppContent').innerHTML = html;
  }

  function changeLevel(lvl) {
    currentLevel = lvl;
    renderHome();
  }

  // ==== LESSON ENGINE ====
  function startLesson() {
    const allWords = vocabulary[currentLevel] || [];
    // Öğrenilmemiş kelimeleri bul
    let unlearned = allWords.filter(w => !learnedIds.includes(w.id));
    
    // Eğer hepsi öğrenildiyse rastgele tekrar yap
    if(unlearned.length < 5) {
      unlearned = [...allWords].sort(() => 0.5 - Math.random());
    }
    
    // 5 kelime seç
    lessonWords = unlearned.sort(() => 0.5 - Math.random()).slice(0, 5);
    if(lessonWords.length === 0) return;

    // Ders kuyruğunu oluştur
    lessonQueue = [];
    lives = 5;
    currentItemIdx = 0;

    // Önce hepsini öğret, sonra test et
    lessonWords.forEach(w => {
      lessonQueue.push({ type: 'teach', word: w });
    });
    lessonWords.forEach(w => {
      lessonQueue.push({ type: 'test', word: w });
    });

    renderLessonItem();
  }

  function renderLessonItem() {
    if(lives <= 0) {
      renderLessonComplete(false);
      return;
    }
    
    if(currentItemIdx >= lessonQueue.length) {
      // Dersi bitir ve kelimeleri öğrenildi işaretle
      lessonWords.forEach(w => {
        if(!learnedIds.includes(w.id)) learnedIds.push(w.id);
      });
      localStorage.setItem('german_learned_words', JSON.stringify(learnedIds));
      
      // TODO: Supabase user_progress'e ekle (Eğer tablo ve auth hazırsa)
      
      renderLessonComplete(true);
      return;
    }

    const item = lessonQueue[currentItemIdx];
    const progressPct = (currentItemIdx / lessonQueue.length) * 100;
    
    let hearts = '';
    for(let i=0; i<5; i++) {
      hearts += i < lives ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart" style="color:#e5e5e5"></i>';
    }

    let innerHtml = '';
    if(item.type === 'teach') {
       const emoji = getEmojiForWord(item.word.german_word);
       innerHtml = `
         <div class="g-teach-card">
            <div class="g-emoji-icon">${emoji}</div>
            <div class="g-teach-word">${item.word.german_word}</div>
            <div class="g-teach-meaning">${item.word.turkish_meaning}</div>
            <button class="g-audio-btn" onclick="window.GermanModule.speak('${item.word.german_word.replace(/'/g, "\\'")}')"><i class="fas fa-volume-up"></i></button>
         </div>
       `;
       // Öğretirken doğrudan sesi çal
       speak(item.word.german_word);
    } else if(item.type === 'test') {
       // Çoktan seçmeli şıklar üret
       let options = [item.word.turkish_meaning];
       let wrongPool = vocabulary[currentLevel].filter(x => x.turkish_meaning !== item.word.turkish_meaning).sort(() => 0.5 - Math.random());
       for(let i=0; i<3 && wrongPool[i]; i++) {
         options.push(wrongPool[i].turkish_meaning);
       }
       options.sort(() => 0.5 - Math.random());

       innerHtml = `
         <div style="display:flex; align-items:center; gap:12px; margin-bottom:24px;">
            <button class="g-audio-btn" style="width:48px; height:48px; font-size:18px;" onclick="window.GermanModule.speak('${item.word.german_word.replace(/'/g, "\\'")}')"><i class="fas fa-volume-up"></i></button>
            <div class="g-question" style="margin-bottom:0;">"${item.word.german_word}" ne anlama gelir?</div>
         </div>
         <div class="g-options" id="gOptionsArea">
            ${options.map(opt => `
               <button class="g-option" onclick="window.GermanModule.checkAnswer(this, '${opt.replace(/'/g, "\\'")}', '${item.word.turkish_meaning.replace(/'/g, "\\'")}')">${opt}</button>
            `).join('')}
         </div>
       `;
       speak(item.word.german_word);
    }

    const html = `
      ${renderHeader(false)}
      <div class="g-lesson-container">
         <div style="display:flex; align-items:center; gap:16px; margin-bottom:16px;">
            <button class="g-btn-outline" style="border:none; padding:4px;" onclick="window.GermanModule.renderHome()"><i class="fas fa-times" style="font-size:20px;"></i></button>
            <div class="g-progress-bar" style="margin-bottom:0;"><div class="g-progress-fill" style="width:${progressPct}%"></div></div>
            <div class="g-lives">${hearts}</div>
         </div>
         
         ${innerHtml}
      </div>
      
      <div class="g-footer" id="gFooter">
         <div class="g-feedback-banner" id="gFeedbackBanner" style="display:none;"></div>
         <button class="g-btn" id="gFooterBtn" style="width:100%;" onclick="window.GermanModule.nextItem()">Devam Et</button>
      </div>
    `;
    
    document.getElementById('germanAppContent').innerHTML = html;

    if(item.type === 'teach') {
       document.getElementById('gFooter').style.display = 'flex';
    }
  }

  function checkAnswer(btn, selected, correct) {
    const optionsArea = document.getElementById('gOptionsArea');
    if (optionsArea.classList.contains('answered')) return;
    optionsArea.classList.add('answered');
    
    const footer = document.getElementById('gFooter');
    const feedbackBanner = document.getElementById('gFeedbackBanner');
    const footerBtn = document.getElementById('gFooterBtn');
    
    if (selected === correct) {
      btn.classList.add('correct');
      playSound('correct');
      feedbackBanner.className = 'g-feedback-banner g-feedback-correct';
      feedbackBanner.innerHTML = '<i class="fas fa-check-circle" style="font-size:24px;"></i> Harika!';
      footerBtn.style.backgroundColor = '#58cc02';
      footerBtn.style.borderBottomColor = '#46a302';
      footerBtn.style.color = 'white';
    } else {
      btn.classList.add('wrong');
      const btns = optionsArea.querySelectorAll('.g-option');
      btns.forEach(b => {
        if(b.textContent === correct) b.classList.add('correct');
      });
      
      playSound('wrong');
      lives--;
      feedbackBanner.className = 'g-feedback-banner g-feedback-wrong';
      feedbackBanner.innerHTML = `<i class="fas fa-times-circle" style="font-size:24px;"></i> Doğrusu: ${correct}`;
      footerBtn.style.backgroundColor = '#ff4b4b';
      footerBtn.style.borderBottomColor = '#ea2b2b';
      footerBtn.style.color = 'white';
      
      // Eğer yanlış bildiyse, bu soruyu kuyruğun sonuna tekrar ekle (öğrenene kadar çıkmasın)
      const currentItem = lessonQueue[currentItemIdx];
      lessonQueue.push(currentItem);
    }
    
    feedbackBanner.style.display = 'flex';
    footer.style.display = 'flex';
  }

  function nextItem() {
    currentItemIdx++;
    renderLessonItem();
  }

  function renderLessonComplete(isWin) {
    let html = `
      ${renderHeader(false)}
      <div class="g-lesson-container" style="margin-top:60px;">
    `;
    
    if(isWin) {
       playSound('correct');
       html += `
          <div style="font-size:100px; margin-bottom:20px;">🎉</div>
          <h2 style="color:#f49000; font-size:32px; margin-bottom:16px;">Ders Tamamlandı!</h2>
          <p style="color:#afafaf; font-size:18px; margin-bottom:32px;">5 yeni kelime daha öğrendin. Gelişmeye devam et!</p>
       `;
    } else {
       html += `
          <div style="font-size:100px; margin-bottom:20px;">💔</div>
          <h2 style="color:#ff4b4b; font-size:32px; margin-bottom:16px;">Canların Bitti!</h2>
          <p style="color:#afafaf; font-size:18px; margin-bottom:32px;">Pes etme, dinlen ve tekrar dene.</p>
       `;
    }
    
    html += `
         <button class="g-btn" style="width:100%; margin-top:20px;" onclick="window.GermanModule.renderHome()">Ana Sayfaya Dön</button>
      </div>
    `;
    document.getElementById('germanAppContent').innerHTML = html;
  }

  // API Export
  return {
    openApp,
    closeApp,
    renderHome,
    changeLevel,
    speak,
    startLesson,
    checkAnswer,
    nextItem
  };
})();
