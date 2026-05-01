/**
 * Formation.js  –  Finans Hub / Süper Lig Takım Dizilişi Modülü (SVG)
 * ─────────────────────────────────────────────────────────────
 * Kullanım:
 *   Formation.render(containerId, espnTeamId)
 *   Formation.renderStatic(containerId, '4-2-3-1', players)
 */

const Formation = (() => {

  // ─── 1. FORMASYON KOORDİNAT HARİTALARI ───────────────────────────────────
  const FORMATIONS = {
    '4-2-3-1': {
      label: '4-2-3-1',
      rows: [
        { y: 0.06, positions: [{ x: 0.50, role: 'GK' }] },
        { y: 0.22, positions: [{ x: 0.12, role: 'LB' }, { x: 0.37, role: 'CB' }, { x: 0.63, role: 'CB' }, { x: 0.88, role: 'RB' }] },
        { y: 0.45, positions: [{ x: 0.33, role: 'DM' }, { x: 0.67, role: 'DM' }] },
        { y: 0.65, positions: [{ x: 0.15, role: 'LM' }, { x: 0.50, role: 'CAM' }, { x: 0.85, role: 'RM' }] },
        { y: 0.83, positions: [{ x: 0.50, role: 'ST' }] },
      ]
    },
    '4-3-3': {
      label: '4-3-3',
      rows: [
        { y: 0.06, positions: [{ x: 0.50, role: 'GK' }] },
        { y: 0.22, positions: [{ x: 0.12, role: 'LB' }, { x: 0.37, role: 'CB' }, { x: 0.63, role: 'CB' }, { x: 0.88, role: 'RB' }] },
        { y: 0.48, positions: [{ x: 0.22, role: 'CM' }, { x: 0.50, role: 'CM' }, { x: 0.78, role: 'CM' }] },
        { y: 0.80, positions: [{ x: 0.15, role: 'LW' }, { x: 0.50, role: 'ST' }, { x: 0.85, role: 'RW' }] },
      ]
    },
    '4-4-2': {
      label: '4-4-2',
      rows: [
        { y: 0.06, positions: [{ x: 0.50, role: 'GK' }] },
        { y: 0.22, positions: [{ x: 0.12, role: 'LB' }, { x: 0.37, role: 'CB' }, { x: 0.63, role: 'CB' }, { x: 0.88, role: 'RB' }] },
        { y: 0.50, positions: [{ x: 0.12, role: 'LM' }, { x: 0.37, role: 'CM' }, { x: 0.63, role: 'CM' }, { x: 0.88, role: 'RM' }] },
        { y: 0.80, positions: [{ x: 0.35, role: 'ST' }, { x: 0.65, role: 'ST' }] },
      ]
    },
    '4-1-4-1': {
      label: '4-1-4-1',
      rows: [
        { y: 0.06, positions: [{ x: 0.50, role: 'GK' }] },
        { y: 0.22, positions: [{ x: 0.12, role: 'LB' }, { x: 0.37, role: 'CB' }, { x: 0.63, role: 'CB' }, { x: 0.88, role: 'RB' }] },
        { y: 0.40, positions: [{ x: 0.50, role: 'DM' }] },
        { y: 0.60, positions: [{ x: 0.12, role: 'LM' }, { x: 0.37, role: 'CM' }, { x: 0.63, role: 'CM' }, { x: 0.88, role: 'RM' }] },
        { y: 0.82, positions: [{ x: 0.50, role: 'ST' }] },
      ]
    },
    '4-5-1': {
      label: '4-5-1',
      rows: [
        { y: 0.06, positions: [{ x: 0.50, role: 'GK' }] },
        { y: 0.22, positions: [{ x: 0.12, role: 'LB' }, { x: 0.37, role: 'CB' }, { x: 0.63, role: 'CB' }, { x: 0.88, role: 'RB' }] },
        { y: 0.52, positions: [{ x: 0.10, role: 'LM' }, { x: 0.28, role: 'CM' }, { x: 0.50, role: 'CM' }, { x: 0.72, role: 'CM' }, { x: 0.90, role: 'RM' }] },
        { y: 0.82, positions: [{ x: 0.50, role: 'ST' }] },
      ]
    },
    '4-4-1-1': {
      label: '4-4-1-1',
      rows: [
        { y: 0.06, positions: [{ x: 0.50, role: 'GK' }] },
        { y: 0.22, positions: [{ x: 0.12, role: 'LB' }, { x: 0.37, role: 'CB' }, { x: 0.63, role: 'CB' }, { x: 0.88, role: 'RB' }] },
        { y: 0.47, positions: [{ x: 0.12, role: 'LM' }, { x: 0.37, role: 'CM' }, { x: 0.63, role: 'CM' }, { x: 0.88, role: 'RM' }] },
        { y: 0.67, positions: [{ x: 0.50, role: 'SS' }] },
        { y: 0.83, positions: [{ x: 0.50, role: 'ST' }] },
      ]
    },
    '4-3-2-1': {
      label: '4-3-2-1',
      rows: [
        { y: 0.06, positions: [{ x: 0.50, role: 'GK' }] },
        { y: 0.22, positions: [{ x: 0.12, role: 'LB' }, { x: 0.37, role: 'CB' }, { x: 0.63, role: 'CB' }, { x: 0.88, role: 'RB' }] },
        { y: 0.43, positions: [{ x: 0.25, role: 'CM' }, { x: 0.50, role: 'CM' }, { x: 0.75, role: 'CM' }] },
        { y: 0.63, positions: [{ x: 0.35, role: 'AM' }, { x: 0.65, role: 'AM' }] },
        { y: 0.83, positions: [{ x: 0.50, role: 'ST' }] },
      ]
    },
    '4-3-1-2': {
      label: '4-3-1-2',
      rows: [
        { y: 0.06, positions: [{ x: 0.50, role: 'GK' }] },
        { y: 0.22, positions: [{ x: 0.12, role: 'LB' }, { x: 0.37, role: 'CB' }, { x: 0.63, role: 'CB' }, { x: 0.88, role: 'RB' }] },
        { y: 0.43, positions: [{ x: 0.25, role: 'CM' }, { x: 0.50, role: 'CM' }, { x: 0.75, role: 'CM' }] },
        { y: 0.63, positions: [{ x: 0.50, role: 'AM' }] },
        { y: 0.83, positions: [{ x: 0.35, role: 'ST' }, { x: 0.65, role: 'ST' }] },
      ]
    },
    '4-2-2-2': {
      label: '4-2-2-2',
      rows: [
        { y: 0.06, positions: [{ x: 0.50, role: 'GK' }] },
        { y: 0.22, positions: [{ x: 0.12, role: 'LB' }, { x: 0.37, role: 'CB' }, { x: 0.63, role: 'CB' }, { x: 0.88, role: 'RB' }] },
        { y: 0.43, positions: [{ x: 0.33, role: 'DM' }, { x: 0.67, role: 'DM' }] },
        { y: 0.63, positions: [{ x: 0.33, role: 'AM' }, { x: 0.67, role: 'AM' }] },
        { y: 0.83, positions: [{ x: 0.35, role: 'ST' }, { x: 0.65, role: 'ST' }] },
      ]
    },
    '3-4-3': {
      label: '3-4-3',
      rows: [
        { y: 0.06, positions: [{ x: 0.50, role: 'GK' }] },
        { y: 0.22, positions: [{ x: 0.25, role: 'CB' }, { x: 0.50, role: 'CB' }, { x: 0.75, role: 'CB' }] },
        { y: 0.48, positions: [{ x: 0.12, role: 'LM' }, { x: 0.38, role: 'CM' }, { x: 0.62, role: 'CM' }, { x: 0.88, role: 'RM' }] },
        { y: 0.80, positions: [{ x: 0.18, role: 'LW' }, { x: 0.50, role: 'ST' }, { x: 0.82, role: 'RW' }] },
      ]
    },
    '3-5-2': {
      label: '3-5-2',
      rows: [
        { y: 0.06, positions: [{ x: 0.50, role: 'GK' }] },
        { y: 0.22, positions: [{ x: 0.25, role: 'CB' }, { x: 0.50, role: 'CB' }, { x: 0.75, role: 'CB' }] },
        { y: 0.50, positions: [{ x: 0.10, role: 'LWB' }, { x: 0.30, role: 'CM' }, { x: 0.50, role: 'CM' }, { x: 0.70, role: 'CM' }, { x: 0.90, role: 'RWB' }] },
        { y: 0.80, positions: [{ x: 0.35, role: 'ST' }, { x: 0.65, role: 'ST' }] },
      ]
    },
    '3-4-2-1': {
      label: '3-4-2-1',
      rows: [
        { y: 0.06, positions: [{ x: 0.50, role: 'GK' }] },
        { y: 0.22, positions: [{ x: 0.25, role: 'CB' }, { x: 0.50, role: 'CB' }, { x: 0.75, role: 'CB' }] },
        { y: 0.45, positions: [{ x: 0.12, role: 'LWB' }, { x: 0.37, role: 'CM' }, { x: 0.63, role: 'CM' }, { x: 0.88, role: 'RWB' }] },
        { y: 0.65, positions: [{ x: 0.35, role: 'AM' }, { x: 0.65, role: 'AM' }] },
        { y: 0.83, positions: [{ x: 0.50, role: 'ST' }] },
      ]
    },
    '3-4-1-2': {
      label: '3-4-1-2',
      rows: [
        { y: 0.06, positions: [{ x: 0.50, role: 'GK' }] },
        { y: 0.22, positions: [{ x: 0.25, role: 'CB' }, { x: 0.50, role: 'CB' }, { x: 0.75, role: 'CB' }] },
        { y: 0.45, positions: [{ x: 0.12, role: 'LWB' }, { x: 0.37, role: 'CM' }, { x: 0.63, role: 'CM' }, { x: 0.88, role: 'RWB' }] },
        { y: 0.63, positions: [{ x: 0.50, role: 'AM' }] },
        { y: 0.82, positions: [{ x: 0.35, role: 'ST' }, { x: 0.65, role: 'ST' }] },
      ]
    },
    '5-3-2': {
      label: '5-3-2',
      rows: [
        { y: 0.06, positions: [{ x: 0.50, role: 'GK' }] },
        { y: 0.20, positions: [{ x: 0.10, role: 'LWB' }, { x: 0.28, role: 'CB' }, { x: 0.50, role: 'CB' }, { x: 0.72, role: 'CB' }, { x: 0.90, role: 'RWB' }] },
        { y: 0.50, positions: [{ x: 0.25, role: 'CM' }, { x: 0.50, role: 'CM' }, { x: 0.75, role: 'CM' }] },
        { y: 0.80, positions: [{ x: 0.35, role: 'ST' }, { x: 0.65, role: 'ST' }] },
      ]
    },
    '5-4-1': {
      label: '5-4-1',
      rows: [
        { y: 0.06, positions: [{ x: 0.50, role: 'GK' }] },
        { y: 0.20, positions: [{ x: 0.10, role: 'LWB' }, { x: 0.28, role: 'CB' }, { x: 0.50, role: 'CB' }, { x: 0.72, role: 'CB' }, { x: 0.90, role: 'RWB' }] },
        { y: 0.50, positions: [{ x: 0.12, role: 'LM' }, { x: 0.37, role: 'CM' }, { x: 0.63, role: 'CM' }, { x: 0.88, role: 'RM' }] },
        { y: 0.82, positions: [{ x: 0.50, role: 'ST' }] },
      ]
    },
  };

  const FORMATION_ALIASES = {
    '4-4-2(+)': '4-4-2',
    '4-3-3(+)': '4-3-3',
    '3-5-2-1': '3-5-2',
  };

  function normalizeFormationKey(raw) {
    if (!raw) return null;
    let s = String(raw).trim();
    if (/^\d{3,5}$/.test(s)) {
      s = s.split('').join('-');
    }
    s = s.replace(/\s+/g, '');
    if (FORMATION_ALIASES[s]) return FORMATION_ALIASES[s];
    return s;
  }

  function getFormation(rawKey) {
    if (!rawKey) return null;
    if (FORMATIONS[rawKey]) return FORMATIONS[rawKey];
    const key = normalizeFormationKey(rawKey);
    if (FORMATIONS[key]) return FORMATIONS[key];
    return null;
  }

  // ─── 2. TAKIM RENK EŞLEME ─────────────────────────────────────────────────
  function getTeamColorsAndLogo(teamName) {
    const normalized = (teamName || '')
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c');

    // Renk haritası
    const colorMap = {
      'galatasaray':            { primary: '#FFCC00', secondary: '#FF0000' },
      'fenerbahce':             { primary: '#FFFF00', secondary: '#000080' },
      'besiktas':               { primary: '#000000', secondary: '#FFFFFF' },
      'trabzonspor':            { primary: '#800000', secondary: '#0000FF' },
      'basaksehir':             { primary: '#FF6600', secondary: '#000080' },
      'goztepe':                { primary: '#FFFF00', secondary: '#FF0000' },
      'samsunspor':             { primary: '#FF0000', secondary: '#FFFFFF' },
      'konyaspor':              { primary: '#008000', secondary: '#FFFFFF' },
      'caykur rizespor':       { primary: '#008000', secondary: '#0000FF' },
      'gaziantep':              { primary: '#FF0000', secondary: '#000000' },
      'kocaelispor':            { primary: '#008000', secondary: '#000000' },
      'alanyaspor':             { primary: '#FF6600', secondary: '#008000' },
      'kasimpasa':              { primary: '#000080', secondary: '#FFFFFF' },
      'antalyaspor':            { primary: '#FF0000', secondary: '#FFFFFF' },
      'eyupspor':               { primary: '#800080', secondary: '#FFFF00' },
      'kayserispor':            { primary: '#FFFF00', secondary: '#FF0000' },
      'genclerbirligi':         { primary: '#FF0000', secondary: '#000000' },
      'karagumruk':             { primary: '#FF0000', secondary: '#000000' },
      'fatih karagumruk':       { primary: '#FF0000', secondary: '#000000' },
    };

    // Takım adını parçalara ayır ve her birini anahtar olarak kontrol et
    const parts = normalized.split(/\s+/); // Boşluklara göre böl
    for (const part of parts) {
      if (colorMap[part]) {
        return { primary: colorMap[part].primary, secondary: colorMap[part].secondary, logo: '' };
      }
    }

    // Parça bazında eşleşmezse, bütün olarak tekrar dene (boşluksuz hali)
    const joined = parts.join('');
    for (const [key, colors] of Object.entries(colorMap)) {
      if (joined.includes(key)) {
        return { primary: colors.primary, secondary: colors.secondary, logo: '' };
      }
    }

    // Varsayılan
    return { primary: '#003366', secondary: '#fbca03', logo: '' };
  }

  // ─── 3. ESPN API İLE KADRO VE FORMASYON ÇEKİMİ ──────────────────────────
  const _cache = {};
  const CACHE_TTL = 10 * 60 * 1000;

  async function fetchLineup(teamId) {
    const now = Date.now();
    if (_cache[teamId] && (now - _cache[teamId].ts) < CACHE_TTL) return _cache[teamId];

    let formation = null, players = [];
    try {
      const sbRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/scoreboard`);
      const sbData = await sbRes.json();
      const events = sbData?.events || [];
      let eventId = null;
      for (const ev of events) {
        const comps = ev.competitions?.[0];
        if (comps?.competitors?.some(c => String(c.id) === String(teamId))) { eventId = ev.id; break; }
      }
      if (eventId) {
        const sumRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/summary?event=${eventId}`);
        const sumData = await sumRes.json();
        const rosters = sumData?.rosters || [];
        const teamRoster = rosters.find(r => String(r.team?.id) === String(teamId));
        if (teamRoster) {
          formation = teamRoster?.formation || null;
          players = (teamRoster?.roster || []).map(p => ({
            id: p.athlete?.id,
            name: p.athlete?.shortName || p.athlete?.displayName || '?',
            number: p.athlete?.jersey || '',
            position: p.position?.abbreviation || '',
            formationPlace: p.formationPlace ?? null,
            starter: p.starter ?? false,
          }));
        }
      }
    } catch (e) { console.warn('[Formation] fetch error:', e); }
    const result = { formation, players, ts: now };
    _cache[teamId] = result;
    return result;
  }

  // ─── 4. SVG SAHA OLUŞTURUCU ──────────────────────────────────────────────
  function buildPitchSVG(formationData, players, teamColors, opts = {}) {
    const W = opts.width || 320;
    const H = opts.height || 450;
    const dark = opts.dark !== false;

    const bgColor   = dark ? '#1a2e1a' : '#2d8a2d';
    const lineColor = dark ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.6)';
    const stripA    = dark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)';
    const stripB    = dark ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.06)';

    const px = v => (v * W).toFixed(1);
    const py = v => ((1 - v) * H).toFixed(1);

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="formation-pitch" style="width:100%; height:auto; display:block; border-radius:8px; overflow:hidden;">`;

    // Arka plan
    svg += `<rect width="${W}" height="${H}" fill="${bgColor}"/>`;
    // Şerit deseni
    const stripes = 8;
    for (let i = 0; i < stripes; i++) {
      const x = i * (W / stripes);
      svg += `<rect x="${x.toFixed(1)}" y="0" width="${(W/stripes).toFixed(1)}" height="${H}" fill="${i % 2 === 0 ? stripA : stripB}"/>`;
    }

    const lw = 1.2, lc = lineColor;
    // Dış çizgiler
    svg += `<rect x="4" y="4" width="${W-8}" height="${H-8}" fill="none" stroke="${lc}" stroke-width="${lw}"/>`;
    // Orta çizgi ve daire
    svg += `<line x1="4" y1="${H/2}" x2="${W-4}" y2="${H/2}" stroke="${lc}" stroke-width="${lw}"/>`;
    const cr = W * 0.12;
    svg += `<circle cx="${W/2}" cy="${H/2}" r="${cr}" fill="none" stroke="${lc}" stroke-width="${lw}"/>`;
    svg += `<circle cx="${W/2}" cy="${H/2}" r="2.5" fill="${lc}"/>`;
    // Ceza sahaları
    const paW = W * 0.6, paH = H * 0.16, paX = (W - paW) / 2;
    svg += `<rect x="${paX.toFixed(1)}" y="${(H - paH - 4).toFixed(1)}" width="${paW.toFixed(1)}" height="${paH.toFixed(1)}" fill="none" stroke="${lc}" stroke-width="${lw}"/>`;
    svg += `<rect x="${paX.toFixed(1)}" y="4" width="${paW.toFixed(1)}" height="${paH.toFixed(1)}" fill="none" stroke="${lc}" stroke-width="${lw}"/>`;
    // Altıpaslar
    const gaW = W * 0.28, gaH = H * 0.055, gaX = (W - gaW) / 2;
    svg += `<rect x="${gaX.toFixed(1)}" y="${(H - gaH - 4).toFixed(1)}" width="${gaW.toFixed(1)}" height="${gaH.toFixed(1)}" fill="none" stroke="${lc}" stroke-width="1.8"/>`;
    svg += `<rect x="${gaX.toFixed(1)}" y="4" width="${gaW.toFixed(1)}" height="${gaH.toFixed(1)}" fill="none" stroke="${lc}" stroke-width="1.8"/>`;
    // Penaltı noktaları
    const pDot = H * 0.12;
    svg += `<circle cx="${W/2}" cy="${(H - pDot).toFixed(1)}" r="2" fill="${lc}"/>`;
    svg += `<circle cx="${W/2}" cy="${pDot.toFixed(1)}" r="2" fill="${lc}"/>`;

    // ── Oyuncular ──
    const starters = players.filter(p => p.starter).slice(0, 11);
    const finalStarters = starters.length >= 11 ? starters.slice(0, 11) : players.slice(0, 11);

    let playerIndex = 0;
    const dotR = W * 0.055;
    const fontSize = dotR * 0.7;
    const nameSize = Math.max(7, W * 0.028);

    const mainColor = teamColors?.primary || '#1a5c2a';

    for (const row of rows) {
      for (const pos of row.positions) {
        const p = finalStarters[playerIndex] || null;
        const cx = parseFloat(px(pos.x));
        const cy = parseFloat(py(row.y));

        const isGK = pos.role === 'GK';
        const fillColor = isGK ? '#f5c518' : mainColor;
        const strokeColor = isGK ? '#c8a000' : 'rgba(255,255,255,0.6)';
        const textColor = '#fff';

        // Daire
        svg += `<circle cx="${cx}" cy="${cy}" r="${dotR}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5" class="player-dot"/>`;

        // Numara
        const label = p?.number || '';
        if (label) {
          svg += `<text x="${cx}" y="${cy + fontSize * 0.35}" text-anchor="middle" font-size="${fontSize}" font-weight="bold" fill="${textColor}" font-family="system-ui,sans-serif">${label}</text>`;
        }

        // İsim (soyad)
        if (p?.name) {
          const shortName = p.name.split(' ').pop();
          svg += `<text x="${cx}" y="${cy + dotR + nameSize * 1.2}" text-anchor="middle" font-size="${nameSize}" fill="rgba(255,255,255,0.9)" font-family="system-ui,sans-serif" font-weight="500">${shortName}</text>`;
        }

        playerIndex++;
        if (playerIndex >= finalStarters.length) break;
      }
      if (playerIndex >= finalStarters.length) break;
    }

    // Formasyon etiketi
    svg += `<text x="${W/2}" y="${H - 6}" text-anchor="middle" font-size="${nameSize}" fill="rgba(255,255,255,0.45)" font-family="system-ui,sans-serif">${formationData.label}</text>`;

    svg += `</svg>`;
    return svg;
  }

  // ─── 5. ANA RENDER FONKSİYONLARI ─────────────────────────────────────────
  async function render(container, teamId, opts = {}) {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-secondary);">Diziliş yükleniyor…</div>';

    try {
      const { formation: rawFormation, players } = await fetchLineup(teamId);
      const formKey = rawFormation || '4-2-3-1';
      const formData = getFormation(formKey) || getFormation('4-2-3-1');

      const teamName = document.getElementById("teamDetailName")?.textContent || '';
      const teamColors = getTeamColorsAndLogo(teamName);
      el.innerHTML = buildPitchSVG(formData, players, teamColors, opts);

    } catch (e) {
      el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--down);">Diziliş alınamadı.</div>';
    }
  }

  return { render };
})();
