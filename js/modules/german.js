// js/modules/german.js - Duolingo tarzı tam ekran Almanca Öğrenme Uygulaması

window.GermanModule = (function () {
  let vocabulary = { A1: [], A2: [], B1: [] };
  let grammarTopics = [];
  let currentLevel = 'A1';
  let isDataLoaded = false;
  
  // Quiz State
  let quizQuestions = [];
  let currentQIdx = 0;
  let lives = 5;
  let score = 0;

  // Supabase instance (global app.js'den)
  function getSB() {
    return window._supabaseClient || null;
  }

  // ==== DATA FETCHING ====
  async function loadData() {
    if (isDataLoaded) return;
    
    document.getElementById('germanAppContent').innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#ffffff;">
        <div style="font-size:48px; color:#58cc02; margin-bottom:20px;"><i class="fas fa-spinner fa-spin"></i></div>
        <h2 style="color:#afafaf; font-weight:bold;">Almanca Verileri Yükleniyor...</h2>
      </div>
    `;

    try {
      // 1. Try Supabase first
      let sbDataLoaded = false;
      const sb = getSB();
      if (sb) {
        const { data, error } = await sb.from('vocabulary').select('*');
        if (!error && data && data.length > 0) {
          data.forEach(item => {
            if (vocabulary[item.level]) {
              vocabulary[item.level].push(item);
            }
          });
          sbDataLoaded = true;
          console.log("German: Loaded vocabulary from Supabase.");
        }
      }

      // 2. Fallback to Local Text File
      if (!sbDataLoaded) {
        console.log("German: Falling back to Kelimeler.txt");
        const res = await fetch('almanca/Kelimeler.txt');
        const text = await res.text();
        parseKelimelerTxt(text);
      }

      // 3. Load Grammar
      const gramRes = await fetch('almanca/gramer1.txt');
      const gramText = await gramRes.text();
      parseGrammarTxt(gramText);

      isDataLoaded = true;
      renderMainMenu();
    } catch (err) {
      console.error("German Data Load Error:", err);
      document.getElementById('germanAppContent').innerHTML = `
        <div style="text-align:center; padding:50px;">
           <h2 style="color:#ff4b4b;">Veriler Yüklenemedi</h2>
           <button onclick="window.GermanModule.closeApp()" style="margin-top:20px; padding:10px 20px; border-radius:12px; background:#e5e5e5; border:none; cursor:pointer;">Geri Dön</button>
        </div>
      `;
    }
  }

  function parseKelimelerTxt(text) {
    const lines = text.split('\n');
    let currentLvl = 'A1';

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      if (line.includes('A1 Kelime Listesi')) { currentLvl = 'A1'; continue; }
      if (line.includes('A2 Kelime Listesi')) { currentLvl = 'A2'; continue; }
      if (line.includes('B1 Kelime Listesi')) { currentLvl = 'B1'; continue; }
      if (line.includes('---')) continue;

      // Match pattern: "1  ab (-den itibaren)"
      const match = line.match(/^\d+\s+(.*?)\s+\((.*?)\)$/);
      if (match) {
        vocabulary[currentLvl].push({
          german_word: match[1].trim(),
          turkish_meaning: match[2].trim(),
          level: currentLvl
        });
      } else {
        // Fallback split by tab or space if no parentheses
        const parts = line.split('\t');
        if (parts.length >= 2) {
            const wordPart = parts[1].split('(');
            if(wordPart.length > 1) {
                vocabulary[currentLvl].push({
                    german_word: wordPart[0].trim(),
                    turkish_meaning: wordPart[1].replace(')','').trim(),
                    level: currentLvl
                });
            }
        }
      }
    }
  }

  function parseGrammarTxt(text) {
    const lines = text.split('\n');
    let currentTopic = null;
    
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      
      // Assume lines starting with a number and a dot are topics (e.g. "1. Fiil Nedir?")
      if (/^\d+\./.test(line)) {
        if (currentTopic) grammarTopics.push(currentTopic);
        currentTopic = { title: line, content: [] };
      } else if (currentTopic) {
        currentTopic.content.push(line);
      }
    }
    if (currentTopic) grammarTopics.push(currentTopic);
  }

  // ==== TTS ====
  function speak(text) {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  // ==== AUDIO FEEDBACK ====
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
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
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

  // ==== UI RENDERING ====
  function openApp() {
    document.getElementById('germanAppScreen').style.display = 'block';
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    loadData();
  }

  function closeApp() {
    document.getElementById('germanAppScreen').style.display = 'none';
    document.body.style.overflow = 'auto';
  }

  const STYLES = `
    .g-header { display:flex; justify-content:space-between; align-items:center; padding:16px 24px; border-bottom:2px solid #e5e5e5; background:#fff; position:sticky; top:0; z-index:10; }
    .g-title { font-size:24px; font-weight:800; color:#58cc02; display:flex; align-items:center; gap:8px; }
    .g-btn { background:#58cc02; color:white; border:none; border-bottom:4px solid #46a302; border-radius:16px; padding:12px 24px; font-size:16px; font-weight:bold; cursor:pointer; transition:transform 0.1s, border-width 0.1s; }
    .g-btn:active { transform:translateY(4px); border-bottom-width:0; margin-bottom:4px; }
    .g-btn-outline { background:#fff; color:#afafaf; border:2px solid #e5e5e5; border-bottom:4px solid #e5e5e5; border-radius:16px; padding:10px 20px; font-size:16px; font-weight:bold; cursor:pointer; }
    .g-btn-outline:active { transform:translateY(2px); border-bottom-width:2px; }
    .g-btn-outline.active { border-color:#84d8ff; color:#1cb0f6; background:#ddf4ff; border-bottom-color:#1cb0f6; }
    
    .g-content { max-width:800px; margin:0 auto; padding:24px; }
    .g-nav { display:flex; gap:12px; margin-bottom:24px; overflow-x:auto; padding-bottom:8px; }
    
    /* Vocabulary Cards */
    .g-cards-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:20px; }
    .g-card { background:#fff; border:2px solid #e5e5e5; border-bottom:4px solid #e5e5e5; border-radius:16px; padding:20px; text-align:center; cursor:pointer; position:relative; min-height:140px; display:flex; flex-direction:column; justify-content:center; align-items:center; }
    .g-card:hover { border-color:#84d8ff; }
    .g-card-word { font-size:20px; font-weight:bold; color:#4b4b4b; }
    .g-card-meaning { font-size:16px; color:#afafaf; margin-top:8px; display:none; }
    .g-card.revealed .g-card-meaning { display:block; }
    .g-card-audio { position:absolute; top:12px; right:12px; color:#1cb0f6; font-size:20px; background:none; border:none; cursor:pointer; }
    
    /* Grammar Accordion */
    .g-accordion { border:2px solid #e5e5e5; border-radius:16px; margin-bottom:12px; overflow:hidden; }
    .g-acc-header { padding:16px; background:#fff; font-weight:bold; color:#4b4b4b; cursor:pointer; display:flex; justify-content:space-between; border-bottom:2px solid transparent; }
    .g-acc-content { padding:16px; background:#f7f7f7; display:none; font-size:15px; color:#6b6b6b; line-height:1.6; }
    .g-accordion.open .g-acc-header { border-bottom-color:#e5e5e5; }
    .g-accordion.open .g-acc-content { display:block; }
    
    /* Quiz Area */
    .g-quiz-container { text-align:center; max-width:600px; margin:40px auto; }
    .g-progress-bar { height:16px; background:#e5e5e5; border-radius:8px; overflow:hidden; margin-bottom:24px; }
    .g-progress-fill { height:100%; background:#58cc02; width:0%; transition:width 0.3s ease; }
    .g-lives { display:flex; justify-content:center; gap:8px; margin-bottom:24px; font-size:24px; color:#ff4b4b; }
    .g-question { font-size:24px; font-weight:bold; color:#4b4b4b; margin-bottom:32px; }
    .g-options { display:flex; flex-direction:column; gap:12px; }
    .g-option { background:#fff; border:2px solid #e5e5e5; border-bottom:4px solid #e5e5e5; border-radius:16px; padding:16px; font-size:18px; font-weight:bold; color:#4b4b4b; cursor:pointer; transition:all 0.1s; }
    .g-option:active { transform:translateY(2px); border-bottom-width:2px; }
    .g-option.correct { background:#d7ffb8; border-color:#58cc02; border-bottom-color:#58cc02; color:#58cc02; }
    .g-option.wrong { background:#ffdfe0; border-color:#ff4b4b; border-bottom-color:#ff4b4b; color:#ea2b2b; }
    
    .g-quiz-footer { display:flex; justify-content:space-between; align-items:center; margin-top:32px; padding-top:24px; border-top:2px solid #e5e5e5; }
    
    .g-game-over { text-align:center; margin-top:60px; }
  `;

  function renderHeader() {
    let styleTag = document.getElementById('germanAppStyles');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'germanAppStyles';
      styleTag.innerHTML = STYLES;
      document.head.appendChild(styleTag);
    }

    return `
      <div class="g-header">
        <div class="g-title"><img src="https://flagcdn.com/w40/de.png" style="border-radius:4px; margin-right:8px; width:32px; height:24px; object-fit:cover;"> Almanca Öğren</div>
        <button class="g-btn-outline" onclick="window.GermanModule.closeApp()">Kapat</button>
      </div>
    `;
  }

  function renderMainMenu() {
    const html = `
      ${renderHeader()}
      <div class="g-content">
        <div class="g-nav">
          <button class="g-btn-outline active" id="gNavCards" onclick="window.GermanModule.showTab('cards')">Kelime Kartları</button>
          <button class="g-btn-outline" id="gNavQuiz" onclick="window.GermanModule.showTab('quiz')">Alıştırmalar</button>
          <button class="g-btn-outline" id="gNavGrammar" onclick="window.GermanModule.showTab('grammar')">Gramer Rehberi</button>
          
          <select id="gLevelSelect" onchange="window.GermanModule.changeLevel(this.value)" style="margin-left:auto; padding:8px 16px; border-radius:12px; border:2px solid #e5e5e5; font-weight:bold; color:#4b4b4b; outline:none;">
            <option value="A1" ${currentLevel === 'A1' ? 'selected' : ''}>A1 Seviye</option>
            <option value="A2" ${currentLevel === 'A2' ? 'selected' : ''}>A2 Seviye</option>
            <option value="B1" ${currentLevel === 'B1' ? 'selected' : ''}>B1 Seviye</option>
          </select>
        </div>
        
        <div id="gTabContent"></div>
      </div>
    `;
    document.getElementById('germanAppContent').innerHTML = html;
    showTab('cards');
  }

  function showTab(tab) {
    document.querySelectorAll('.g-nav .g-btn-outline').forEach(btn => btn.classList.remove('active'));
    
    let content = '';
    if (tab === 'cards') {
      document.getElementById('gNavCards').classList.add('active');
      content = renderCards();
    } else if (tab === 'quiz') {
      document.getElementById('gNavQuiz').classList.add('active');
      content = renderQuizIntro();
    } else if (tab === 'grammar') {
      document.getElementById('gNavGrammar').classList.add('active');
      content = renderGrammar();
    }
    
    document.getElementById('gTabContent').innerHTML = content;
  }

  function changeLevel(level) {
    currentLevel = level;
    // Yeniden aktif tabı renderla
    const activeTab = document.querySelector('.g-nav .g-btn-outline.active').id.replace('gNav', '').toLowerCase();
    showTab(activeTab);
  }

  // ==== CARDS ====
  function renderCards() {
    const words = vocabulary[currentLevel] || [];
    if (words.length === 0) return `<div style="text-align:center; padding:40px; color:#afafaf;">Bu seviye için kelime bulunamadı.</div>`;
    
    let html = `<div style="margin-bottom:16px;"><input type="text" id="gSearch" placeholder="Kelime ara..." onkeyup="window.GermanModule.filterCards(this.value)" style="width:100%; padding:14px 20px; border-radius:16px; border:2px solid #e5e5e5; font-size:16px; outline:none;"></div>`;
    
    html += `<div class="g-cards-grid" id="gCardsGrid">`;
    // İlk 100'ü göster, performans için
    words.slice(0, 100).forEach((w, i) => {
      html += `
        <div class="g-card" onclick="this.classList.toggle('revealed')">
          <button class="g-card-audio" onclick="event.stopPropagation(); window.GermanModule.speak('${w.german_word.replace(/'/g, "\\'")}')"><i class="fas fa-volume-up"></i></button>
          <div class="g-card-word">${w.german_word}</div>
          <div class="g-card-meaning">${w.turkish_meaning}</div>
        </div>
      `;
    });
    html += `</div>`;
    return html;
  }

  function filterCards(query) {
    query = query.toLowerCase();
    const words = vocabulary[currentLevel] || [];
    const filtered = words.filter(w => w.german_word.toLowerCase().includes(query) || w.turkish_meaning.toLowerCase().includes(query));
    
    let html = '';
    filtered.slice(0, 100).forEach((w, i) => {
      html += `
        <div class="g-card" onclick="this.classList.toggle('revealed')">
          <button class="g-card-audio" onclick="event.stopPropagation(); window.GermanModule.speak('${w.german_word.replace(/'/g, "\\'")}')"><i class="fas fa-volume-up"></i></button>
          <div class="g-card-word">${w.german_word}</div>
          <div class="g-card-meaning">${w.turkish_meaning}</div>
        </div>
      `;
    });
    document.getElementById('gCardsGrid').innerHTML = html;
  }

  // ==== GRAMMAR ====
  function renderGrammar() {
    if (grammarTopics.length === 0) return `<div style="text-align:center; padding:40px; color:#afafaf;">Gramer bilgisi bulunamadı.</div>`;
    
    let html = `<div style="display:flex; flex-direction:column;">`;
    grammarTopics.forEach((topic, i) => {
      html += `
        <div class="g-accordion" onclick="this.classList.toggle('open')">
          <div class="g-acc-header">
            <span>${topic.title}</span>
            <i class="fas fa-chevron-down"></i>
          </div>
          <div class="g-acc-content">
            ${topic.content.map(l => `<p style="margin-bottom:8px;">${l}</p>`).join('')}
          </div>
        </div>
      `;
    });
    html += `</div>`;
    return html;
  }

  // ==== QUIZ ====
  function renderQuizIntro() {
    return `
      <div style="text-align:center; padding:60px 20px;">
        <div style="font-size:64px; margin-bottom:24px;">🦉</div>
        <h2 style="color:#4b4b4b; font-size:28px; margin-bottom:16px;">Pratik Yapma Zamanı!</h2>
        <p style="color:#afafaf; font-size:16px; margin-bottom:32px;">Öğrendiğin kelimeleri test et. 5 canın var, dikkatli ol!</p>
        <button class="g-btn" onclick="window.GermanModule.startQuiz()" style="font-size:20px; padding:16px 48px;">Başla</button>
      </div>
    `;
  }

  function startQuiz() {
    const words = vocabulary[currentLevel] || [];
    if (words.length < 4) {
      document.getElementById('gTabContent').innerHTML = `<div style="text-align:center; padding:40px;">Yeterli kelime yok.</div>`;
      return;
    }
    
    // Rastgele 10 soru hazırla
    quizQuestions = [];
    lives = 5;
    score = 0;
    currentQIdx = 0;
    
    // Karıştır
    const shuffled = [...words].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 10);
    
    selected.forEach(w => {
      // Çoktan seçmeli seçenekler oluştur (1 doğru, 3 yanlış)
      let options = [w.turkish_meaning];
      let wrongPool = [...words].filter(x => x.turkish_meaning !== w.turkish_meaning).sort(() => 0.5 - Math.random());
      for(let i=0; i<3; i++) {
        if(wrongPool[i]) options.push(wrongPool[i].turkish_meaning);
      }
      options.sort(() => 0.5 - Math.random());
      
      quizQuestions.push({
        word: w.german_word,
        answer: w.turkish_meaning,
        options: options
      });
    });
    
    renderQuizQuestion();
  }

  function renderQuizQuestion() {
    if (lives <= 0) {
      renderGameOver(false);
      return;
    }
    if (currentQIdx >= quizQuestions.length) {
      renderGameOver(true);
      return;
    }
    
    const q = quizQuestions[currentQIdx];
    const progress = (currentQIdx / quizQuestions.length) * 100;
    
    let hearts = '';
    for(let i=0; i<5; i++) {
      hearts += i < lives ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart" style="color:#e5e5e5"></i>';
    }
    
    let html = `
      <div class="g-quiz-container">
        <div class="g-progress-bar"><div class="g-progress-fill" style="width:${progress}%"></div></div>
        <div class="g-lives">${hearts}</div>
        
        <div style="display:flex; align-items:center; justify-content:center; gap:16px; margin-bottom:32px;">
           <button class="g-card-audio" style="position:static;" onclick="window.GermanModule.speak('${q.word.replace(/'/g, "\\'")}')"><i class="fas fa-volume-up" style="font-size:28px;"></i></button>
           <div class="g-question" style="margin-bottom:0;">"${q.word}" ne demek?</div>
        </div>
        
        <div class="g-options" id="gOptionsArea">
          ${q.options.map(opt => `
            <button class="g-option" onclick="window.GermanModule.checkAnswer(this, '${opt.replace(/'/g, "\\'")}', '${q.answer.replace(/'/g, "\\'")}')">${opt}</button>
          `).join('')}
        </div>
        
        <div class="g-quiz-footer" id="gQuizFooter" style="display:none;">
          <div id="gQuizFeedback" style="font-size:20px; font-weight:bold;"></div>
          <button class="g-btn" id="gQuizNextBtn" onclick="window.GermanModule.nextQuestion()">Devam Et</button>
        </div>
      </div>
    `;
    
    document.getElementById('gTabContent').innerHTML = html;
    speak(q.word);
  }

  function checkAnswer(btn, selected, correct) {
    // Sadece bir kere cevaplanabilir
    const optionsArea = document.getElementById('gOptionsArea');
    if (optionsArea.classList.contains('answered')) return;
    optionsArea.classList.add('answered');
    
    const footer = document.getElementById('gQuizFooter');
    const feedback = document.getElementById('gQuizFeedback');
    
    if (selected === correct) {
      btn.classList.add('correct');
      playSound('correct');
      feedback.innerHTML = '<span style="color:#58cc02;"><i class="fas fa-check-circle"></i> Doğru!</span>';
      score++;
    } else {
      btn.classList.add('wrong');
      // Doğru olanı da göster
      const btns = optionsArea.querySelectorAll('.g-option');
      btns.forEach(b => {
        if(b.textContent === correct) b.classList.add('correct');
      });
      
      playSound('wrong');
      feedback.innerHTML = `<span style="color:#ff4b4b;"><i class="fas fa-times-circle"></i> Yanlış. Doğrusu: ${correct}</span>`;
      lives--;
    }
    
    footer.style.display = 'flex';
  }

  function nextQuestion() {
    currentQIdx++;
    renderQuizQuestion();
  }

  function renderGameOver(isWin) {
    let html = `<div class="g-game-over">`;
    if (isWin) {
      playSound('correct');
      html += `
        <div style="font-size:80px; margin-bottom:20px;">🏆</div>
        <h2 style="color:#58cc02; font-size:32px; margin-bottom:16px;">Tebrikler!</h2>
        <p style="color:#afafaf; font-size:18px; margin-bottom:32px;">Testi başarıyla tamamladın. Skor: ${score}/10</p>
      `;
    } else {
      html += `
        <div style="font-size:80px; margin-bottom:20px;">💔</div>
        <h2 style="color:#ff4b4b; font-size:32px; margin-bottom:16px;">Canların Bitti!</h2>
        <p style="color:#afafaf; font-size:18px; margin-bottom:32px;">Pes etme, tekrar dene.</p>
      `;
    }
    html += `<button class="g-btn" onclick="window.GermanModule.showTab('quiz')">Geri Dön</button></div>`;
    document.getElementById('gTabContent').innerHTML = html;
  }

  // API Export
  return {
    openApp,
    closeApp,
    showTab,
    changeLevel,
    filterCards,
    speak,
    startQuiz,
    checkAnswer,
    nextQuestion
  };
})();
