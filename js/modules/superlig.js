// js/modules/superlig.js — Süper Lig Modülü (ESPN API)

const SuperligModule = (() => {

  // Takıma göre renk rozeti
  const TEAM_COLORS = {
    "Galatasaray": "#fcd535",
    "Fenerbahçe": "#1a9c3e",
    "Fenerbahce": "#1a9c3e",
    "Beşiktaş": "#cccccc",
    "Besiktas": "#cccccc",
    "Trabzonspor": "#8b1a1a",
    "Başakşehir": "#0057a8",
    "Basaksehir": "#0057a8",
    "Kasımpaşa": "#e63946",
    "Kasimpasa": "#e63946",
    "Sivasspor": "#c62828",
    "Antalyaspor": "#e53935",
    "Adana Demirspor": "#1565c0",
    "Samsunspor": "#e53935",
    "Göztepe": "#f57c00",
    "Goztepe": "#f57c00",
    "Konyaspor": "#2e7d32",
    "Alanyaspor": "#f9a825",
    "Kayserispor": "#c62828",
    "Gaziantep FK": "#6a1b9a",
    "Eyüpspor": "#0288d1",
    "Eyupspor": "#0288d1",
    "Bodrum FK": "#37474f",
    "Rizespor": "#2e7d32",
  };

  function teamBadgeColor(name) {
    if (!name) return "#848e9c";
    if (TEAM_COLORS[name]) return TEAM_COLORS[name];
    for (const key of Object.keys(TEAM_COLORS)) {
      if (name.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(name.toLowerCase())) {
        return TEAM_COLORS[key];
      }
    }
    return "#848e9c";
  }

  function shortName(name) {
    if (!name) return "?";
    const map = {
      "Istanbul Basaksehir FK": "Başakşehir",
      "Istanbul Basaksehir": "Başakşehir",
      "Besiktas JK": "Beşiktaş",
      "Fenerbahce SK": "Fenerbahçe",
      "Galatasaray SK": "Galatasaray",
      "Trabzonspor AS": "Trabzonspor",
      "Caykur Rizespor": "Rizespor",
      "Adana Demirspor": "Adana D.",
      "Kasimpasa SK": "Kasımpaşa",
    };
    if (map[name]) return map[name];
    return name
      .replace(" SK", "").replace(" AS", "").replace(" FK", "")
      .replace(" JK", "").replace(" AŞ", "")
      .slice(0, 14);
  }

  function getZoneStyle(rank, total) {
    if (rank <= 2) return "background:rgba(14,203,129,0.08); border-left:3px solid rgba(14,203,129,0.6);";
    if (rank <= 4) return "background:rgba(252,213,53,0.06); border-left:3px solid rgba(252,213,53,0.5);";
    if (rank > total - 4) return "background:rgba(246,70,93,0.06); border-left:3px solid rgba(246,70,93,0.4);";
    return "border-left:3px solid transparent;";
  }

  function renderLigTable(entries, total) {
    const container = document.getElementById("ligTableBody");
    if (!container) return;
    if (!entries || entries.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:48px 16px;color:var(--text-secondary);">
          <div style="font-size:32px;margin-bottom:12px;">📡</div>
          <div style="font-size:14px;font-weight:700;">Veri alınamadı. Yenile butonuna basın.</div>
        </div>`;
      return;
    }

    const totalTeams = total || entries.length;

    container.innerHTML = entries.map(row => {
      const rank = row.rank;
      const name = shortName(row.name);
      const gp = row.gp;
      const wins = row.wins;
      const ties = row.ties;
      const loss = row.loss;
      const gf = row.gf;
      const ga = row.ga;
      const gd = gf - ga;
      const pts = row.pts;
      const gdStr = gd > 0 ? `+${gd}` : `${gd}`;
      const zStyle = getZoneStyle(rank, totalTeams);
      const bColor = teamBadgeColor(row.name);
      const rankColor = rank <= 2 ? "var(--up)" : rank <= 4 ? "var(--brand)" : rank > totalTeams - 4 ? "var(--down)" : "var(--text-secondary)";
      const logo = row.logo || "";

      return `<div class="lig-row" style="${zStyle}" onclick='openTeamDetail(${JSON.stringify(row)})'>
          <div class="lig-col-rank"><span class="lig-rank-num" style="color:${rankColor}">${rank}</span></div>
          <div class="lig-col-team">
            <img src="${logo}" class="lig-logo" loading="lazy" onerror="this.style.display='none'" />
            <div style="display:flex; flex-direction:column;">
              <span class="lig-team-name">${name}</span>
              <div class="form-dots">${(row.form || "").split("").map(f => `<span class="dot-${f.toLowerCase()}"></span>`).join("")}</div>
            </div>
          </div>
          <div class="lig-col-num">${gp}</div>
          <div class="lig-col-num" style="color:var(--up)">${wins}</div>
          <div class="lig-col-num" style="color:var(--text-secondary)">${ties}</div>
          <div class="lig-col-num" style="color:var(--down)">${loss}</div>
          <div class="lig-col-num" style="font-size:11px;color:${gd > 0 ? 'var(--up)' : gd < 0 ? 'var(--down)' : 'var(--text-secondary)'}">${gdStr}</div>
          <div class="lig-col-pts"><span class="lig-pts">${pts}</span></div>
        </div>`;
    }).join("");

    if (entries.length > 0) {
      setText("ligLeader", shortName(entries[0].name));
    }
  }

  window._currentLigSubTab = 'standing';
  window.switchLigMainTab = function (tab) {
    window._currentLigSubTab = tab;
    const tabs = ['standing', 'week', 'live'];
    tabs.forEach(t => {
      const btn = document.getElementById("btnLig" + t.charAt(0).toUpperCase() + t.slice(1));
      const sec = document.getElementById("lig" + t.charAt(0).toUpperCase() + t.slice(1) + "Section");
      if (btn) btn.classList.toggle("active", t === tab);
      if (sec) sec.style.display = (t === tab ? "block" : "none");
    });

    if (window._liveMatchInterval) {
      clearInterval(window._liveMatchInterval);
      window._liveMatchInterval = null;
    }

    if (tab === 'live') {
      fetchLeagueLiveMatches();
      window._liveMatchInterval = setInterval(() => {
        fetchLeagueLiveMatches();
      }, 30000);
    }

    if (tab === 'week') {
      fetchWeeklyMatches();
      window._liveMatchInterval = setInterval(() => {
        refreshWeeklyScores();
      }, 30000);
    }
  };

  window.openMatchDetails = window.openMatchDetails || {};

  function isHalftimeStatus(ev) {
    const statusType = ev.status?.type || {};
    const normalizeStatus = (value) => String(value || "").toLowerCase().replace(/[-_]/g, " ").trim();
    const id = String(statusType.id || "");
    const shortDetail = normalizeStatus(statusType.shortDetail);
    const description = normalizeStatus(statusType.description);
    const name = normalizeStatus(statusType.name);
    const detail = normalizeStatus(statusType.detail || ev.status?.detail);
    const displayClock = normalizeStatus(ev.status?.displayClock);

    return id === "23" ||
      shortDetail === "ht" ||
      detail === "ht" ||
      displayClock === "ht" ||
      description === "halftime" ||
      description === "half time" ||
      name === "status halftime" ||
      name === "status half time" ||
      name === "halftime" ||
      name === "half time" ||
      detail === "halftime" ||
      detail === "half time";
  }

  function renderFullMatchCards(events) {
    const sorted = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));
    const logoUrl = (id) => id ? `https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/${id}.png&w=64&h=64` : "";

    return sorted.map((ev, idx) => {
      const comp = ev.competitions?.[0];
      const home = comp?.competitors?.find(c => c.homeAway === "home");
      const away = comp?.competitors?.find(c => c.homeAway === "away");
      const state = ev.status?.type?.state;
      const isFinal = (state === "post");
      const isLive = (state === "in");
      const isHalftime = isHalftimeStatus(ev);
      const isActive = isLive || isHalftime;
      const clock = ev.status?.displayClock || "";
      const homeLogo = logoUrl(home?.team?.id);
      const awayLogo = logoUrl(away?.team?.id);
      const homeId = String(home?.team?.id || home?.id || "");
      const awayId = String(away?.team?.id || away?.id || "");

      const d = new Date(ev.date);
      const startTime = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
      const dateStr = d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" });
      const dayStr = d.toLocaleDateString("tr-TR", { weekday: "short" }).toUpperCase();

      const hWin = isFinal && parseInt(home?.score) > parseInt(away?.score);
      const aWin = isFinal && parseInt(away?.score) > parseInt(home?.score);

      let borderColor = "transparent";
      let statusColor = "var(--text-secondary)";
      // Devre arasi ESPN'de bazen state="in" olarak gelmeye devam ediyor.
      // Bu yuzden isHalftime kontrolu isLive'dan once yapilmali.
      if (isHalftime) { borderColor = "var(--down)"; statusColor = "var(--brand)"; }
      else if (isLive) { borderColor = "var(--up)"; statusColor = "var(--up)"; }
      else if (isFinal) { borderColor = "var(--down)"; statusColor = "var(--text-secondary)"; }

      const details = comp?.details || [];
      const goals = details
        .filter(d => d.type?.text === "Goal" || d.scoringPlay)
        .map(d => ({
          player: d.athletesInvolved?.[0]?.shortName || d.athletesInvolved?.[0]?.displayName || "Gol",
          min: d.clock?.displayValue || "",
          teamId: String(d.team?.id),
          og: !!(d.type?.text?.toLowerCase().includes("own"))
        }));

      const cards = details
        .filter(d => {
          const t = (d.type?.text || "").toLowerCase();
          if (t.includes("substitut") || t === "sub in" || t === "sub out") return false;
          return d.yellowCard || d.redCard || t.includes("yellow card") || t.includes("red card");
        })
        .map(d => {
          const t = (d.type?.text || "").toLowerCase();
          const isRed = d.redCard || d.type?.id === "95" || d.type?.id === "96" || t.includes("red card");
          return {
            player: d.athletesInvolved?.[0]?.shortName || d.athletesInvolved?.[0]?.displayName || "",
            min: d.clock?.displayValue || "",
            teamId: String(d.team?.id),
            type: isRed ? "red" : "yellow"
          };
        });

      const subs = details
        .filter(d => {
          const t = (d.type?.text || "").toLowerCase();
          const id = String(d.type?.id || "");
          return t.includes("substitut") || t === "sub in" || t === "sub out" || id === "92";
        })
        .map(d => ({
          out: d.athletesInvolved?.[0]?.shortName || d.athletesInvolved?.[0]?.displayName || "",
          inn: d.athletesInvolved?.[1]?.shortName || d.athletesInvolved?.[1]?.displayName || "",
          min: d.clock?.displayValue || "",
          teamId: String(d.team?.id)
        }));

      const homeGoals = goals.filter(g => g.teamId === homeId);
      const awayGoals = goals.filter(g => g.teamId === awayId);
      const homeCards = cards.filter(c => c.teamId === homeId);
      const awayCards = cards.filter(c => c.teamId === awayId);
      const homeSubs = subs.filter(s => s.teamId === homeId);
      const awaySubs = subs.filter(s => s.teamId === awayId);

      const hasDetail = (isFinal || isActive);
      const currentTab = window._currentLigSubTab || 'live';
      const detailId = `mdetail-${currentTab}-${ev.id}`;
      if (!window.openMatchDetails[currentTab]) window.openMatchDetails[currentTab] = {};
      const isDetailOpen = window.openMatchDetails[currentTab][ev.id] || false;

      const renderSide = (goalArr, cardArr, subsArr, align) => {
        const isRight = align === "right";
        const items = [];
        goalArr.forEach(g => items.push({ min: g.min, kind: "goal", og: g.og, player: g.player }));
        cardArr.forEach(c => items.push({ min: c.min, kind: "card", ctype: c.type, player: c.player }));
        subsArr.forEach(s => items.push({ min: s.min, kind: "sub", out: s.out, inn: s.inn }));
        items.sort((a, b) => (parseInt(a.min) || 0) - (parseInt(b.min) || 0));

        if (items.length === 0) {
          return `<div style="font-size:10px;color:rgba(255,255,255,0.12);font-style:italic;${isRight ? ' text-align:right' : ''}">—</div>`;
        }

        return items.map(item => {
          let icon, color, label;
          if (item.kind === "goal") {
            icon = item.og ? "⚽↩" : "⚽";
            color = "#eaecef";
            label = item.player;
          } else if (item.kind === "card") {
            icon = item.ctype === "red" ? "🟥" : "🟨";
            color = item.ctype === "red" ? "#f6465d" : "#fcd535";
            label = item.player;
          } else {
            icon = "🔄";
            color = "#848e9c";
            label = item.out ? `${item.out} → ${item.inn}` : item.inn;
          }
          const minStr = item.min
            ? `<span style="font-family:'Space Grotesk',monospace;font-size:10px;font-weight:700;color:${color};opacity:.85;">${item.min}'</span>`
            : "";
          if (isRight) {
            return `<div style="display:flex;align-items:center;justify-content:flex-end;gap:5px;margin-bottom:5px;">
                <span style="font-size:11px;color:#848e9c;white-space:nowrap;">${label}</span>
                ${minStr}
                <span style="font-size:13px;line-height:1;">${icon}</span>
              </div>`;
          } else {
            return `<div style="display:flex;align-items:center;gap:5px;margin-bottom:5px;">
                <span style="font-size:13px;line-height:1;">${icon}</span>
                ${minStr}
                <span style="font-size:11px;color:#848e9c;white-space:nowrap;">${label}</span>
              </div>`;
          }
        }).join("");
      };

      const detailPanel = hasDetail ? `
           <details id="${detailId}" ${isDetailOpen ? 'open' : ''} style="padding:12px 14px 14px;border-top:1px dashed rgba(255,255,255,0.06);background:rgba(0,0,0,0.15);">
             <summary style="position:absolute;opacity:0;width:0;height:0;overflow:hidden;"></summary>
             <div style="display:grid;grid-template-columns:1fr 1px 1fr;gap:0;">
               <div style="padding-right:10px;">${renderSide(homeGoals, homeCards, homeSubs, "left")}</div>
               <div style="background:rgba(255,255,255,0.05);"></div>
               <div style="padding-left:10px;">${renderSide(awayGoals, awayCards, awaySubs, "right")}</div>
             </div>
             <div id="stats-placeholder-${currentTab}-${ev.id}" style="margin-top:12px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.08);"></div>
           </details>` : "";
      const cursorStyle = hasDetail ? "cursor:pointer;" : "";
      const clickAttr = hasDetail
        ? `onmousedown="event.stopPropagation(); var st = window._currentLigSubTab||'live'; if(!window.openMatchDetails[st]) window.openMatchDetails[st]={}; window.openMatchDetails[st]['${ev.id}'] = !window.openMatchDetails[st]['${ev.id}']; var el=document.getElementById('mdetail-'+st+'-${ev.id}'); if(el)el.open=window.openMatchDetails[st]['${ev.id}']; if(window.openMatchDetails[st]['${ev.id}']) setTimeout(() => window.loadMatchStatsInline('${ev.id}', '${currentTab}'), 100);"`
        : "";

      const scoreBox = (isFinal || isActive)
        ? `<div style="font-size:15px;font-weight:900;font-family:'Space Grotesk',monospace;color:${statusColor};letter-spacing:1px;white-space:nowrap;">${home?.score ?? 0} – ${away?.score ?? 0}</div>
             ${isHalftime
          ? `<div style="font-size:8px;color:var(--brand);font-weight:900;margin-top:2px;">DEVRE ARASI</div>`
          : isLive
            ? `<div style="font-size:8px;color:var(--up);font-weight:900;animation:pulse 1.2s infinite;margin-top:2px;">● ${clock}</div>`
            : `<div style="font-size:8px;color:var(--text-secondary);margin-top:2px;font-weight:700;">MS</div>`
        }`
        : `<div style="font-size:11px;font-weight:800;color:var(--brand);letter-spacing:1px;">VS</div>`;

      return `
          <div class="${isActive ? 'match-card-active' : ''}" 
           style="--active-border: ${borderColor}; 
                  border-bottom:1px solid rgba(255,255,255,0.04);
                  background:${isActive ? "rgba(14,203,129,0.03)" : isFinal ? "rgba(246,70,93,0.03)" : "transparent"};
                  border-radius:0;">
            <div ${clickAttr} style="display:grid;grid-template-columns:52px 1fr 68px 1fr${hasDetail ? " 14px" : ""};align-items:center;padding:10px 12px;gap:0;${cursorStyle}">

              <div style="font-size:10px;text-align:center;padding-right:8px;border-right:1px solid rgba(255,255,255,0.05);">
                <div style="font-weight:800;color:var(--text-primary);font-size:11px;">${dateStr}</div>
                <div style="color:var(--text-secondary);margin-top:2px;font-size:9px;">${dayStr}</div>
                <div style="color:var(--text-secondary);font-size:9px;">${startTime}</div>
              </div>

              <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;padding:0 8px;min-width:0;overflow:hidden;">
                <span style="font-size:11px;font-weight:${hWin ? 800 : 600};color:${hWin ? "var(--up)" : isActive ? "var(--text-primary)" : "var(--text-secondary)"};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${shortName(home?.team?.displayName)}</span>
                <img src="${homeLogo}" onerror="this.style.visibility='hidden'" style="width:24px;height:24px;object-fit:contain;flex-shrink:0;">
              </div>

              <div style="text-align:center;background:rgba(255,255,255,0.04);border-radius:8px;padding:7px 4px;border:1px solid rgba(255,255,255,0.04);flex-shrink:0;">
                ${scoreBox}
              </div>

              <div style="display:flex;align-items:center;justify-content:flex-start;gap:6px;padding:0 8px;min-width:0;overflow:hidden;">
                <img src="${awayLogo}" onerror="this.style.visibility='hidden'" style="width:24px;height:24px;object-fit:contain;flex-shrink:0;">
                <span style="font-size:11px;font-weight:${aWin ? 800 : 600};color:${aWin ? "var(--up)" : isActive ? "var(--text-primary)" : "var(--text-secondary)"};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${shortName(away?.team?.displayName)}</span>
              </div>

              ${hasDetail ? `<div style="text-align:right;color:var(--text-secondary);font-size:12px;opacity:0.5;">▾</div>` : ""}
            </div>
            ${detailPanel}
          </div>
        `;
    }).join("");
  }

  async function fetchLeagueLiveMatches() {
    const list = document.getElementById("ligLiveList");
    if (!list) return;
    list.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-secondary);">Canlı maçlar taranıyor...</div>`;
    try {
      const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/scoreboard");
      if (!res.ok) throw new Error();
      const data = await res.json();
      const allEvents = data?.events || [];
      const liveEvents = allEvents.filter(ev => {
        const state = ev.status?.type?.state;
        const isHalftime = isHalftimeStatus(ev);
        return state === "in" || isHalftime;
      });

      if (liveEvents.length === 0) {
        const todayStr = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const todayMatches = allEvents.filter(ev => {
          const matchDate = new Date(ev.date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
          return matchDate === todayStr && ev.status?.type?.state === 'pre';
        });

        let upcomingHTML = '';
        if (todayMatches.length > 0) {
          const matchCards = todayMatches.map(ev => {
            const comp = ev.competitions?.[0];
            const home = comp?.competitors?.find(c => c.homeAway === 'home');
            const away = comp?.competitors?.find(c => c.homeAway === 'away');
            const time = new Date(ev.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            const homeLogo = home?.team?.id ? `https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/${home.team.id}.png&w=64&h=64` : '';
            const awayLogo = away?.team?.id ? `https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/${away.team.id}.png&w=64&h=64` : '';
            return `
          <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.03); border-radius:12px; padding:10px 8px; margin:0 8px 8px; border:1px solid rgba(255,255,255,0.05);">
            <div style="display:flex; align-items:center; gap:6px; flex:1; justify-content:flex-end; min-width:0;">
              <span style="font-size:12px; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:80px;">${shortName(home?.team?.displayName)}</span>
              <img src="${homeLogo}" style="width:24px; height:24px; object-fit:contain; flex-shrink:0;" onerror="this.style.display='none'">
            </div>
            <div style="text-align:center; margin:0 8px; flex-shrink:0; min-width:40px;">
              <div style="font-size:11px; color:var(--brand); font-weight:800;">VS</div>
              <div style="font-size:10px; color:var(--text-secondary);">${time}</div>
            </div>
            <div style="display:flex; align-items:center; gap:6px; flex:1; justify-content:flex-start; min-width:0;">
              <img src="${awayLogo}" style="width:24px; height:24px; object-fit:contain; flex-shrink:0;" onerror="this.style.display='none'">
              <span style="font-size:12px; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:80px;">${shortName(away?.team?.displayName)}</span>
            </div>
          </div>`;
          }).join('');
          upcomingHTML = `
      <div style="text-align:center; padding:0 8px; margin-top:24px;">
        <div style="font-size:15px; font-weight:800; color:var(--brand); margin-bottom:4px;">
          Bugünün Maçları
        </div>
        <div style="font-size:11px; color:var(--text-secondary); margin-bottom:16px;">
          ${todayStr}
        </div>
        ${matchCards}
      </div>`;
        }

        list.innerHTML = `
      <div style="text-align:center; padding:40px 24px; color:var(--text-secondary);">
        <svg width="200" height="120" viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" style="border-radius:12px; box-shadow:0 15px 35px rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.05); background:#1e3b2f; margin-bottom:16px;">
          <rect x="10" y="10" width="180" height="100" rx="4" fill="#2e5a3b" stroke="#3d7a4f" stroke-width="2" />
          <line x1="100" y1="10" x2="100" y2="110" stroke="#3d7a4f" stroke-width="2" />
          <circle cx="100" cy="60" r="20" fill="none" stroke="#3d7a4f" stroke-width="2" />
          <rect x="10" y="30" width="24" height="60" fill="none" stroke="#3d7a4f" stroke-width="2" />
          <rect x="166" y="30" width="24" height="60" fill="none" stroke="#3d7a4f" stroke-width="2" />
          <circle cx="100" cy="60" r="4" fill="var(--brand)" />
          <circle cx="100" cy="60" r="6" fill="var(--brand)" opacity="0.3">
            <animate attributeName="r" values="6; 20; 6" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5; 0; 0.5" dur="2s" repeatCount="indefinite" />
          </circle>
        </svg>
        <div style="font-size:16px; font-weight:800; color:var(--text-primary); margin-bottom:8px;">Türkiye Süper Ligi</div>
        <div style="font-size:13px; opacity:0.6;">Şu an aktif bir müsabaka bulunmamaktadır.</div>
        ${upcomingHTML}
      </div>`;
      } else {
        list.innerHTML = renderFullMatchCards(liveEvents);
        // Acik detaylari ve istatistikleri yeniden yukle
        setTimeout(() => {
          const openMatches = window.openMatchDetails['live'] || {};
          Object.keys(openMatches).forEach(eventId => {
            if (openMatches[eventId]) {
              const detailEl = document.getElementById(`mdetail-live-${eventId}`);
              if (detailEl) detailEl.open = true;
              if (typeof window.loadMatchStatsInline === 'function') {
                const placeholder = document.getElementById(`stats-placeholder-live-${eventId}`);
                if (placeholder) delete placeholder.dataset.loaded;
                window.loadMatchStatsInline(eventId, 'live');
              }
            }
          });
        }, 200);
      }
      const ts = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const upd = document.getElementById('liveLastUpdate');
      if (upd) upd.textContent = `Son Güncelleme: ${ts} (her 60sn)`;
    } catch (e) { list.innerHTML = `<div style="text-align:center; padding:24px; color:var(--down);">Canlı veriler alınamadı.</div>`; }
  }

  function renderLiveMatchCard(ev) {
    const clock = ev.clock || "";
    const homeGoals = (ev.goals || []).filter(g => g.teamId === ev.homeId);
    const awayGoals = (ev.goals || []).filter(g => g.teamId === ev.awayId);

    const goalRow = (g) => `
        <div style="display:flex; align-items:center; gap:5px; font-size:11px; color:var(--text-secondary); margin-bottom:3px;">
          <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--brand); flex-shrink:0;"></span>
          <span style="font-family:'Space Grotesk',monospace; font-size:10px; font-weight:700; color:var(--brand);">${g.min}</span>
          <span>${g.player}</span>
        </div>`;

    return `
        <div style="margin:8px 12px; background:var(--bg-secondary); border:1px solid rgba(246,70,93,0.25); border-left:3px solid var(--down); border-radius:14px; padding:16px 14px 14px; position:relative;">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
            <div style="display:flex; flex-direction:column; align-items:center; gap:6px; width:82px;">
              <img src="${ev.homeLogo}" onerror="this.style.visibility='hidden'" style="width:40px; height:40px; object-fit:contain;">
              <span style="font-size:11px; font-weight:700; color:var(--text-primary); text-align:center; line-height:1.3;">${ev.home}</span>
            </div>
            <div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex:1;">
              <div style="background:var(--bg-primary); border:1px solid rgba(246,70,93,0.3); border-radius:10px; padding:8px 18px; font-size:26px; font-weight:900; font-family:'Space Grotesk',monospace; color:var(--down); letter-spacing:4px; line-height:1;">${ev.hScore} – ${ev.aScore}</div>
              <div style="font-size:9px; font-weight:900; background:var(--up); color:#000; padding:2px 8px; border-radius:4px; letter-spacing:.06em; animation:blink 1.2s infinite;">LIVE</div>
              <div style="font-size:11px; font-weight:800; color:var(--down); font-family:'Space Grotesk',monospace;">${clock ? clock + "'" : ""}</div>
            </div>
            <div style="display:flex; flex-direction:column; align-items:center; gap:6px; width:82px;">
              <img src="${ev.awayLogo}" onerror="this.style.visibility='hidden'" style="width:40px; height:40px; object-fit:contain;">
              <span style="font-size:11px; font-weight:700; color:var(--text-primary); text-align:center; line-height:1.3;">${ev.away}</span>
            </div>
          </div>
          ${(ev.goals && ev.goals.length > 0) ? `
          <div style="margin-top:12px; padding-top:10px; border-top:1px dashed rgba(255,255,255,0.06); display:grid; grid-template-columns:1fr 1px 1fr; gap:0; align-items:start;">
            <div style="padding-right:10px;">
              ${homeGoals.length > 0 ? homeGoals.map(goalRow).join("") : `<div style="font-size:10px; color:rgba(255,255,255,0.1); font-style:italic;">—</div>`}
            </div>
            <div style="background:rgba(255,255,255,0.05); align-self:stretch;"></div>
            <div style="padding-left:10px; display:flex; flex-direction:column; align-items:flex-end;">
              ${awayGoals.length > 0 ? awayGoals.map(g => `
                <div style="display:flex; align-items:center; gap:5px; font-size:11px; color:var(--text-secondary); margin-bottom:3px; flex-direction:row-reverse; text-align:right;">
                  <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--brand); flex-shrink:0;"></span>
                  <span style="font-family:'Space Grotesk',monospace; font-size:10px; font-weight:700; color:var(--brand);">${g.min}</span>
                  <span>${g.player}</span>
                </div>`).join("") : `<div style="font-size:10px; color:rgba(255,255,255,0.1); font-style:italic; text-align:right;">—</div>`}
            </div>
          </div>` : ""}
        </div>
      `;
  }

  function renderRecentMatches(events) {
    const container = document.getElementById("ligRecentMatches");
    if (!container) return;
    if (!events || events.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text-secondary);font-size:13px;">Son sonuçlar bulunamadı.</div>`;
      return;
    }
    container.innerHTML = events.map(ev => {
      const hWin = ev.hScore !== null && ev.aScore !== null && ev.hScore > ev.aScore;
      const aWin = ev.hScore !== null && ev.aScore !== null && ev.aScore > ev.hScore;
      const scoreStr = `${ev.hScore} - ${ev.aScore}`;
      return `
          <div class="match-row">
            <div class="match-date">${ev.date}</div>
            <div class="match-team" style="color:${hWin ? 'var(--text-primary)' : 'var(--text-secondary)'}; font-weight:${hWin ? 800 : 600}">${shortName(ev.home)}</div>
            <div class="match-score">${scoreStr}</div>
            <div class="match-team match-team-away" style="color:${aWin ? 'var(--text-primary)' : 'var(--text-secondary)'}; font-weight:${aWin ? 800 : 600}">${shortName(ev.away)}</div>
          </div>`;
    }).join("");
  }

  function renderGeneralFixture(events) {
    const container = document.getElementById("ligUpcomingMatches");
    if (!container) return;
    if (!events || events.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text-secondary);font-size:13px;">Gelecek maç verisi bulunamadı.</div>`;
      return;
    }
    container.innerHTML = events.map(ev => {
      const isL = ev.isLive;
      return `
          <div class="match-row" style="${isL ? 'border:1px solid var(--down)' : ''}">
            <div class="match-date" style="font-size:9px; width:65px;">${ev.dateFull || ev.date}</div>
            <div class="match-team">${shortName(ev.home)}</div>
            <div class="match-score" style="font-size:11px; color:var(--brand);">${isL ? 'CANLI' : 'vs'}</div>
            <div class="match-team match-team-away">${shortName(ev.away)}</div>
          </div>`;
    }).join("");
  }

  function normalizeMatch(ev) {
    const comps = ev.competitions?.[0];
    const home = comps?.competitors?.find(c => c.homeAway === "home");
    const away = comps?.competitors?.find(c => c.homeAway === "away");
    let dateStr = "";
    let dateFull = "";
    try {
      const d = new Date(ev.date);
      dateStr = d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" });
      dateFull = d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    } catch (e) { }
    const state = ev.status?.type?.state;
    const logoUrl = (id) => id ? `https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/${id}.png&w=40&h=40` : "";
    const details = comps?.details || [];
    const goalsList = details
      .filter(d => d.type?.text === "Goal" || d.scoringPlay)
      .map(d => ({
        player: d.athletesInvolved?.[0]?.shortName || d.athletesInvolved?.[0]?.displayName || "Gol",
        min: d.clock?.displayValue || "",
        teamId: String(d.team?.id),
        type: "goal",
        og: !!(d.type?.text?.toLowerCase().includes("own"))
      }));
    const cardsList = details
      .filter(d => {
        const t = (d.type?.text || "").toLowerCase();
        if (t.includes("substitut") || t === "sub in" || t === "sub out") return false;
        return d.yellowCard || d.redCard || t.includes("yellow") || t.includes("red") || t.includes("kart");
      })
      .map(d => {
        const t = (d.type?.text || "").toLowerCase();
        const isRed = d.redCard || d.type?.id === "95" || d.type?.id === "96" || t.includes("red");
        return {
          player: d.athletesInvolved?.[0]?.shortName || d.athletesInvolved?.[0]?.displayName || "",
          min: d.clock?.displayValue || "",
          teamId: String(d.team?.id),
          type: isRed ? "red" : "yellow"
        };
      });
    return {
      id: ev.id,
      home: home?.team?.displayName || "?",
      homeId: String(home?.team?.id || home?.id || ""),
      homeLogo: logoUrl(home?.team?.id || home?.id),
      away: away?.team?.displayName || "?",
      awayId: String(away?.team?.id || away?.id || ""),
      awayLogo: logoUrl(away?.team?.id || away?.id),
      hScore: (home?.score !== undefined && state !== "pre") ? parseInt(home.score) : null,
      aScore: (away?.score !== undefined && state !== "pre") ? parseInt(away.score) : null,
      date: dateStr,
      dateFull: dateFull,
      isLive: state === "in",
      isFinal: state === "post",
      league: ev.season?.displayName || "Turkish Super Lig",
      clock: ev.status?.displayClock || "",
      goals: goalsList,
      cards: cardsList
    };
  }

  function renderGoals(goals) {
    if (!goals || goals.length === 0) return "";
    return `
        <div class="sch-goals">
          ${goals.map(g => `
            <div class="sch-goal-item">
              <span class="sch-goal-icon">⚽</span>
              <span><b>${g.min}</b> ${g.player}</span>
            </div>
          `).join("")}
        </div>
      `;
  }

  function renderTeamDetailGoals(ev) {
    const goals = ev.goals || [];
    if (goals.length === 0) return "";
    const homeGoals = goals.filter(g => g.teamId === ev.homeId);
    const awayGoals = goals.filter(g => g.teamId === ev.awayId);
    const goalRow = (g, isRight) => `
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px; justify-content:${isRight ? "flex-end" : "flex-start"}; text-align:${isRight ? "right" : "left"}; flex-direction:${isRight ? "row-reverse" : "row"};">
          <span class="sch-goal-icon">⚽</span>
          <span><b>${g.min}</b> ${g.player}</span>
        </div>
      `;
    const emptySide = (isRight) => `
        <div style="font-size:10px; color:rgba(255,255,255,0.12); font-style:italic; text-align:${isRight ? "right" : "left"};">—</div>
      `;
    return `
        <div class="sch-goals" style="display:grid; grid-template-columns:1fr 1px 1fr; gap:0; align-items:start;">
          <div style="padding-right:10px;">
            ${homeGoals.length > 0 ? homeGoals.map(g => goalRow(g, false)).join("") : emptySide(false)}
          </div>
          <div style="background:rgba(255,255,255,0.05); align-self:stretch;"></div>
          <div style="padding-left:10px; display:flex; flex-direction:column; align-items:flex-end;">
            ${awayGoals.length > 0 ? awayGoals.map(g => goalRow(g, true)).join("") : emptySide(true)}
          </div>
        </div>
      `;
  }

  window.switchLigMatches = function (type) {
    document.getElementById("btnPastMatches").classList.toggle("active", type === 'past');
    document.getElementById("btnFutureMatches").classList.toggle("active", type === 'future');
    document.getElementById("ligPastSection").style.display = type === 'past' ? 'block' : 'none';
    document.getElementById("ligFutureSection").style.display = type === 'future' ? 'block' : 'none';
  };

  function getCurrentSuperLigSeasonStartYear() {
    const now = new Date();
    const month = now.getMonth() + 1;
    return month >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  }

  let currentLigWeek = 1;
  let weeklyFixtureData = { allWeeks: [], currentWeekIndex: 0, totalWeeks: 34, isLoading: false };

  window.changeWeeklyWeek = function (direction) {
    const newIndex = weeklyFixtureData.currentWeekIndex + direction;
    if (newIndex >= 0 && newIndex < weeklyFixtureData.allWeeks.length) {
      weeklyFixtureData.currentWeekIndex = newIndex;
      renderWeeklyWeek();
    }
  };

  async function fetchWeeklyMatches() {
    console.log('📅 Haftalık maç verisi fetchWeeklyMatches() çağrıldı – Yeni veri çekilecek');
    const weekList = document.getElementById("ligWeekList");
    if (!weekList) return;
    weeklyFixtureData.isLoading = true;
    weekList.innerHTML = `<div style="text-align:center; padding:32px; color:var(--text-secondary);">📡<br>Fikstür yükleniyor...</div>`;
    try {
      console.log('⏳ Fikstür API isteği gönderiliyor...');
      const startYear = getCurrentSuperLigSeasonStartYear();
      const startDate = new Date(startYear, 7, 1);
      const endDate = new Date(startYear + 1, 4, 31);
      const ds = startDate.toISOString().split('T')[0].replace(/-/g, '');
      const de = endDate.toISOString().split('T')[0].replace(/-/g, '');
      const apiUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/scoreboard?dates=${ds}-${de}&limit=500`;
      const res = await fetch(apiUrl);
      console.log('✅ Fikstür API cevabı alındı, maçlar gruplandırılıyor...');
      if (!res.ok) throw new Error("API Hatası");
      const data = await res.json();
      const allEvents = data?.events || [];
      const weekMap = {};
      allEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
      let manualWeek = 1;
      let matchCount = 0;
      allEvents.forEach(ev => {
        let weekNum = ev.week?.number || (ev.season?.type?.week?.number);
        if (!weekNum) {
          weekNum = manualWeek;
          matchCount++;
          if (matchCount >= 9) {
            manualWeek++;
            matchCount = 0;
          }
        }
        if (weekNum > 0) {
          if (!weekMap[weekNum]) weekMap[weekNum] = [];
          weekMap[weekNum].push(ev);
        }
      });
      weeklyFixtureData.allWeeks = [];
      for (let w = 1; w <= weeklyFixtureData.totalWeeks; w++) {
        const matches = weekMap[w] ? weekMap[w] : [];
        weeklyFixtureData.allWeeks.push({ weekNumber: w, matches: matches });
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let calculatedWeek = currentLigWeek;
      for (let w = 1; w <= weeklyFixtureData.totalWeeks; w++) {
        const matches = weekMap[w];
        if (matches && matches.length > 0) {
          const firstMatchDate = new Date(matches[0].date);
          firstMatchDate.setHours(0, 0, 0, 0);
          if (today.getTime() >= firstMatchDate.getTime()) {
            calculatedWeek = w;
          }
        }
      }
      let targetWeek = calculatedWeek;
      if (targetWeek !== currentLigWeek && targetWeek > 0) {
        currentLigWeek = targetWeek;
        const roundText = document.getElementById("ligRoundText");
        const remainText = document.getElementById("ligRemainingText");
        if (roundText && remainText) {
          const remaining = Math.max(0, weeklyFixtureData.totalWeeks - targetWeek);
          roundText.textContent = `${targetWeek}. Hafta`;
          remainText.textContent = `${remaining} Hafta Kaldı`;
        }
      }
      if (targetWeek === 1 && data?.week?.number && data.week.number > 1) {
        targetWeek = data.week.number;
      }
      weeklyFixtureData.currentWeekIndex = Math.max(0, Math.min(targetWeek - 1, weeklyFixtureData.allWeeks.length - 1));
      renderWeeklyWeek();
    } catch (e) {
      console.error("Fikstür Hatası:", e);
      console.log('❌ Fikstür çekme hatası:', e.message);
      weekList.innerHTML = `<div style="text-align:center; padding:24px; color:var(--down);">
              Veri çekilemedi. 
              <button onclick="fetchWeeklyMatches()" style="color:var(--brand);background:none;border:none;font-weight:800;cursor:pointer;margin-top:8px;">
                  🔄 Tekrar Dene
              </button>
          </div>`;
    } finally {
      weeklyFixtureData.isLoading = false;
    }
  }

  function renderWeeklyWeek() {
    const weekData = weeklyFixtureData.allWeeks[weeklyFixtureData.currentWeekIndex];
    if (!weekData) return;
    const weekNum = weekData.weekNumber;
    const matches = weekData.matches;
    const titleEl = document.getElementById('fixtureWeekTitle');
    const dateEl = document.getElementById('fixtureWeekDate');
    if (titleEl) titleEl.textContent = `${weekNum}. Hafta`;
    if (dateEl) {
      if (matches.length > 0) {
        const d = new Date(matches[0].date);
        dateEl.textContent = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
      } else {
        dateEl.textContent = "Program açıklanmadı";
      }
    }
    const prevBtn = document.getElementById('fixturePrevBtn');
    const nextBtn = document.getElementById('fixtureNextBtn');
    if (prevBtn) prevBtn.disabled = weeklyFixtureData.currentWeekIndex === 0;
    if (nextBtn) nextBtn.disabled = weeklyFixtureData.currentWeekIndex >= weeklyFixtureData.allWeeks.length - 1;
    const weekList = document.getElementById("ligWeekList");
    if (matches.length > 0) {
      weekList.innerHTML = renderFullMatchCards(matches);
      // Acik detaylari ve istatistikleri yeniden yukle
      setTimeout(() => {
        const openMatches = window.openMatchDetails['week'] || {};
        Object.keys(openMatches).forEach(eventId => {
          if (openMatches[eventId]) {
            const detailEl = document.getElementById(`mdetail-week-${eventId}`);
            if (detailEl) detailEl.open = true;
            if (typeof window.loadMatchStatsInline === 'function') {
              const placeholder = document.getElementById(`stats-placeholder-week-${eventId}`);
              if (placeholder) delete placeholder.dataset.loaded;
              window.loadMatchStatsInline(eventId, 'week');
            }
          }
        });
      }, 200);
    } else {
      weekList.innerHTML = `<div style="text-align:center; padding:48px 16px; color:var(--text-secondary);">📅<br>Bu hafta için maç programı açıklanmamış.</div>`;
    }
  }

  async function refreshWeeklyScores() {
    const weekData = weeklyFixtureData.allWeeks[weeklyFixtureData.currentWeekIndex];
    if (!weekData || !weekData.matches || weekData.matches.length === 0) return;
    try {
      const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/scoreboard");
      if (!res.ok) return;
      const data = await res.json();
      const liveEvents = data?.events || [];
      const liveMap = {};
      liveEvents.forEach(ev => { liveMap[ev.id] = ev; });
      let updated = false;
      weekData.matches.forEach((match, idx) => {
        if (liveMap[match.id]) {
          weekData.matches[idx] = liveMap[match.id];
          updated = true;
        }
      });
      if (updated) renderWeeklyWeek();
    } catch (e) { }
  }

  function formatSeasonLabel(startYear) {
    return `${startYear}-${String(startYear + 1).slice(-2)}`;
  }

  function getSelectedSeasonStartYear() {
    const el = document.getElementById("ligSeasonSelect");
    if (!el || el.value === "auto") return getCurrentSuperLigSeasonStartYear();
    const value = parseInt(el.value, 10);
    return Number.isFinite(value) ? value : getCurrentSuperLigSeasonStartYear();
  }

  function populateLigSeasonOptions() {
    const el = document.getElementById("ligSeasonSelect");
    if (!el) return;
    const current = getCurrentSuperLigSeasonStartYear();
    const years = [current - 1, current];
    el.innerHTML = [`<option value="auto">Otomatik</option>`]
      .concat(years.map(year => `<option value="${year}">${formatSeasonLabel(year)}</option>`))
      .join("");
  }

  function getSeasonDateRange(startYear) {
    const start = new Date(Date.UTC(startYear, 6, 1));
    const end = new Date(Date.UTC(startYear + 1, 5, 30));
    return { start, end };
  }

  function toScoreboardDate(date) {
    return date.toISOString().slice(0, 10).replace(/-/g, "");
  }

  function buildSeasonMonthRanges(startYear) {
    const ranges = [];
    const { start, end } = getSeasonDateRange(startYear);
    const cursor = new Date(start);
    while (cursor <= end) {
      const monthStart = new Date(cursor);
      const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
      if (monthEnd > end) monthEnd.setTime(end.getTime());
      ranges.push(`${toScoreboardDate(monthStart)}-${toScoreboardDate(monthEnd)}`);
      cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
    }
    return ranges;
  }

  async function fetchSeasonScoreboardEvents(startYear) {
    const ranges = buildSeasonMonthRanges(startYear);
    const payloads = await Promise.all(
      ranges.map(range =>
        fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/scoreboard?dates=${range}&limit=100`)
          .then(res => res.ok ? res.json() : null)
          .catch(() => null)
      )
    );
    const events = payloads.flatMap(data => data?.events || []);
    return Array.from(new Map(events.map(ev => [String(ev.id || ev.uid || ev.date || Math.random()), ev])).values());
  }

  async function fetchSuperLigData() {
    setText("ligMeta", "Yükleniyor...");
    try {
      const selectedSeason = getSelectedSeasonStartYear();
      const seasonLabel = formatSeasonLabel(selectedSeason);

      const sRes = await fetch(`https://site.api.espn.com/apis/v2/sports/soccer/tur.1/standings?season=${selectedSeason}`);
      if (!sRes.ok) throw new Error("standings_http_" + sRes.status);
      const sData = await sRes.json();
      const entries = sData?.children?.[0]?.standings?.entries || sData?.standings?.entries || [];
      if (entries.length === 0) throw new Error("empty_standings");

      const rows = entries.map(e => {
        const stats = {};
        (e.stats || []).forEach(s => { stats[s.name] = s.value; });
        return {
          id: e.team?.id,
          rank: Math.round(stats.rank ?? stats.standing ?? 0),
          name: e.team?.displayName || e.team?.name || "?",
          logo: e.team?.logos?.[0]?.href,
          form: (e.stats || []).find(s => s.name === "form")?.displayValue || "",
          gp: Math.round(stats.gamesPlayed ?? stats.played ?? 0),
          wins: Math.round(stats.wins ?? 0),
          ties: Math.round(stats.ties ?? stats.draws ?? 0),
          loss: Math.round(stats.losses ?? 0),
          gf: Math.round(stats.pointsFor ?? stats.goalsFor ?? 0),
          ga: Math.round(stats.pointsAgainst ?? stats.goalsAgainst ?? 0),
          pts: Math.round(stats.points ?? 0),
        };
      }).sort((a, b) => a.rank - b.rank);

      renderLigTable(rows, rows.length);
      setText("ligSezon", seasonLabel);

      const allEvents = await fetchSeasonScoreboardEvents(selectedSeason);
      if (allEvents.length > 0) {
        const normalizedEvents = allEvents.map(ev => normalizeMatch(ev)).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const pastEvents = normalizedEvents.filter(ev => ev.isFinal).slice(-10).reverse();
        const futureEvents = normalizedEvents.filter(ev => !ev.isFinal).slice(0, 10)
        renderRecentMatches(pastEvents);
        renderGeneralFixture(futureEvents);
      }

      const now = new Date().toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      setText("ligTimestamp", `Son Güncelleme: ${now}`);
      setText("ligMeta", `Türkiye Süper Ligi ${seasonLabel}`);

      const TOTAL_WEEKS = 34;
      let weekNum = 0;
      if (allEvents && allEvents.length > 0) {
        const weekMap = {};
        let manualWeek = 1;
        let matchCount = 0;
        const sortedEvents = [...allEvents].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        sortedEvents.forEach(ev => {
          let wNum = ev.week?.number || ev.season?.type?.week?.number;
          if (!wNum) {
            wNum = manualWeek;
            matchCount++;
            if (matchCount >= 9) {
              manualWeek++;
              matchCount = 0;
            }
          }
          if (wNum > 0) {
            if (!weekMap[wNum]) weekMap[wNum] = [];
            weekMap[wNum].push(ev);
          }
        });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let calculatedWeek = 0;
        for (let w = 1; w <= TOTAL_WEEKS; w++) {
          if (weekMap[w] && weekMap[w].length > 0) {
            const firstMatchDate = new Date(weekMap[w][0].date);
            firstMatchDate.setHours(0, 0, 0, 0);
            if (today.getTime() >= firstMatchDate.getTime()) {
              calculatedWeek = w;
            }
          }
        }
        if (calculatedWeek > 0) {
          weekNum = calculatedWeek;
        }
      }
      if (weekNum === 0 && rows.length > 0) {
        weekNum = Math.max(...rows.map(r => r.gp));
      }
      if (weekNum > 0) {
        const remaining = Math.max(0, TOTAL_WEEKS - weekNum);
        const roundBar = document.getElementById("ligRoundBar");
        const roundText = document.getElementById("ligRoundText");
        const remainText = document.getElementById("ligRemainingText");
        if (roundBar && roundText && remainText) {
          roundText.textContent = `${weekNum}. Hafta`;
          remainText.textContent = `${remaining} Hafta Kaldı`;
          roundBar.style.display = "flex";
          currentLigWeek = weekNum;
        }
      } else {
        const roundBar = document.getElementById("ligRoundBar");
        if (roundBar) roundBar.style.display = "none";
      }
    } catch (err) {
      console.warn("ESPN API hatası:", err.message);
      showLigError();
    }
  }

  // ── TAKIM DETAY VE SAHA ─────────────────────────────────────
  window.openTeamDetail = async function (team) {
    const o = document.getElementById("teamDetailOverlay");
    if (!o) return;
    document.getElementById("teamDetailName").textContent = team.name;
    document.getElementById("teamDetailLogo").src = team.logo || "";
    document.getElementById("teamStatPts").textContent = team.pts;
    document.getElementById("teamStatRank").textContent = team.rank + ".";
    document.getElementById("teamStatGBM").textContent = `${team.wins}/${team.ties}/${team.loss}`;
    switchDetailTab('schedule');
    o.classList.add("open");
    try {
      const lastMatch = await getLastMatchForTeam(team.id);
      if (lastMatch) {
        await updateLastMatchCardFromEvent(lastMatch, team.id, "4-2-3-1");
      }
    } catch (e) { console.warn("Maç kartı yüklenemedi", e); }
    fetchTeamSchedule(team.id);
    fetchTeamSquad(team.id);
    fetchTeamLineup(team.id);
    checkTeamLiveStatus(team.name);
  };

  async function fetchTeamLineup(teamId) {
    const list = document.getElementById("teamLineupList");
    if (!list) return;
    list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-secondary);">İlk 11 aranıyor...</div>`;
    try {
      const teamName = document.getElementById("teamDetailName").textContent;
      const clean = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c');
      const sName = clean(teamName);
      const nowD = new Date();
      const start = new Date(); start.setDate(nowD.getDate() - 30);
      const end = new Date(); end.setDate(nowD.getDate() + 2);
      const ds = start.toISOString().split('T')[0].replace(/-/g, '');
      const de = end.toISOString().split('T')[0].replace(/-/g, '');
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/scoreboard?dates=${ds}-${de}&limit=100`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const teamEvents = (data?.events || []).filter(ev => {
        const comps = ev.competitions?.[0];
        const hasId = comps?.competitors?.some(c => String(c.team?.id || c.id) === String(teamId));
        const hasName = clean(ev.name).includes(sName);
        return hasId || hasName;
      });
      teamEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const now = new Date().getTime();
      const candidateEvents = teamEvents.filter(ev => new Date(ev.date).getTime() <= now + 7200000);
      const nearestMatch = candidateEvents[0];
      if (!nearestMatch) {
        list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-secondary);">Yakın tarihli maç bulunamadı.</div>`;
        return;
      }
      let targetEvent = nearestMatch;
      let teamRoster = null;
      for (const ev of candidateEvents) {
        try {
          const summaryRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/summary?event=${ev.id}`);
          if (!summaryRes.ok) continue;
          const summaryData = await summaryRes.json();
          const rosters = summaryData.rosters || [];
          const roster = rosters.find(r => String(r.team?.id) === String(teamId));
          if (roster && roster.roster && roster.roster.length > 0) {
            targetEvent = ev;
            teamRoster = roster;
            break;
          }
        } catch (e) { }
      }

      if (!teamRoster) {
        list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-secondary);">Bu maç için kadro verisi henüz açıklanmamış.</div>`;
        return;
      }
      const starters = teamRoster.roster.filter(p => p.starter);
      const subs = teamRoster.roster.filter(p => !p.starter);
      const activeTeamName = document.getElementById("teamDetailName")?.textContent || "Takım";
      const formation = teamRoster.formation || '4-4-2';

      renderModernPitch(formation, starters, activeTeamName);

      const formationText = document.getElementById("teamFormationText");
      if (formationText) formationText.textContent = `Diziliş: ${formation}`;

      const renderPlayer = (p) => {
        const pos = p.position?.abbreviation || '';
        return `
        <div style="display:flex; justify-content:space-between; padding:10px 8px; border-bottom:1px solid rgba(255,255,255,0.03); align-items:center;">
          <div style="display:flex; gap:12px; align-items:center;">
             <span style="width:26px; text-align:center; font-size:12px; font-weight:800; color:var(--brand); background:rgba(252,213,53,0.1); padding:4px; border-radius:6px; font-family:'Space Grotesk', sans-serif;">${p.jersey || '-'}</span>
             <span style="font-weight:700; color:var(--text-primary); font-size:14px;">${p.athlete?.displayName || 'Bilinmiyor'}</span>
          </div>
          <span style="font-size:11px; color:var(--text-secondary); font-weight:600; padding:2px 6px; background:rgba(255,255,255,0.05); border-radius:4px;">${pos}</span>
        </div>`;
      };

      list.innerHTML = `
      <div style="padding:8px; font-size:13px; font-weight:800; color:var(--brand); text-transform:uppercase; border-bottom:1px solid rgba(252,213,53,0.2); margin-bottom:4px;">İlk 11</div>
      ${starters.length > 0 ? starters.map(renderPlayer).join("") : '<div style="font-size:12px; color:var(--text-secondary); padding:8px;">Veri yok</div>'}
      <div style="padding:8px; font-size:13px; font-weight:800; color:var(--text-secondary); text-transform:uppercase; border-bottom:1px solid rgba(255,255,255,0.1); margin-top:16px; margin-bottom:4px;">Yedekler</div>
      ${subs.length > 0 ? subs.map(renderPlayer).join("") : '<div style="font-size:12px; color:var(--text-secondary); padding:8px;">Veri yok</div>'}
    `;
    } catch (e) {
      console.error(e);
      list.innerHTML = `<div style="text-align:center; padding:15px; color:var(--down);">Diziliş yüklenemedi.</div>`;
    }
  }

  function parsePosition(abbr) {
    const code = String(abbr || '').toUpperCase().trim();
    let role = 'UNKNOWN';
    let side = null;
    if (code === 'G' || code === 'GK') { role = 'GK'; }
    else if (/^(RB|RWB)/.test(code)) { role = 'DF'; side = 'R'; }
    else if (/^(LB|LWB)/.test(code)) { role = 'DF'; side = 'L'; }
    else if (code === 'CB' || code === 'CD') { role = 'DF'; side = null; }
    else if (code === 'CD-L' || code === 'LCB') { role = 'DF'; side = 'L'; }
    else if (code === 'CD-R' || code === 'RCB') { role = 'DF'; side = 'R'; }
    else if (code === 'LM' || code === 'LWB') { role = 'MF'; side = 'L'; }
    else if (code === 'RM' || code === 'RWB') { role = 'MF'; side = 'R'; }
    else if (code === 'CM' || code === 'DM' || code === 'CDM') { role = 'MF'; side = null; }
    else if (code === 'AM') { role = 'AM'; side = null; }
    else if (code === 'AM-L' || code === 'LW') { role = 'FW'; side = 'L'; }
    else if (code === 'AM-R' || code === 'RW') { role = 'FW'; side = 'R'; }
    else if (code === 'F' || code === 'FW' || code === 'ST' || code === 'CF') { role = 'FW'; side = null; }
    else if (code === 'LW' || code === 'LWF') { role = 'FW'; side = 'L'; }
    else if (code === 'RW' || code === 'RWF') { role = 'FW'; side = 'R'; }
    return { role, side };
  }

  function getFormationTemplate(formation) {
    const key = String(formation).replace(/\s/g, '');
    const templates = {
      '4-2-3-1': [
        { role: 'GK', side: null },
        { role: 'DF', side: 'R' }, { role: 'DF', side: 'R' }, { role: 'DF', side: 'L' }, { role: 'DF', side: 'L' },
        { role: 'MF', side: 'R' }, { role: 'MF', side: 'L' },
        { role: 'AM', side: null },
        { role: 'FW', side: 'L' }, { role: 'FW', side: 'R' },
        { role: 'FW', side: null }
      ],
      '4-4-2': [
        { role: 'GK', side: null },
        { role: 'DF', side: 'R' }, { role: 'DF', side: 'R' }, { role: 'DF', side: 'L' }, { role: 'DF', side: 'L' },
        { role: 'MF', side: 'R' }, { role: 'MF', side: 'L' }, { role: 'MF', side: 'L' }, { role: 'MF', side: 'R' },
        { role: 'FW', side: null }, { role: 'FW', side: null }
      ],
      '4-3-3': [
        { role: 'GK', side: null },
        { role: 'DF', side: 'R' }, { role: 'DF', side: 'R' }, { role: 'DF', side: 'L' }, { role: 'DF', side: 'L' },
        { role: 'MF', side: 'R' }, { role: 'MF', side: null }, { role: 'MF', side: 'L' },
        { role: 'FW', side: 'R' }, { role: 'FW', side: null }, { role: 'FW', side: 'L' }
      ],
      '4-1-4-1': [
        { role: 'GK', side: null },
        { role: 'DF', side: 'R' }, { role: 'DF', side: 'R' }, { role: 'DF', side: 'L' }, { role: 'DF', side: 'L' },
        { role: 'MF', side: null },
        { role: 'MF', side: 'R' }, { role: 'MF', side: 'L' }, { role: 'MF', side: 'L' }, { role: 'MF', side: 'R' },
        { role: 'FW', side: null }
      ],
      '3-4-3': [
        { role: 'GK', side: null },
        { role: 'DF', side: 'R' }, { role: 'DF', side: null }, { role: 'DF', side: 'L' },
        { role: 'MF', side: 'R' }, { role: 'MF', side: null }, { role: 'MF', side: null }, { role: 'MF', side: 'L' },
        { role: 'FW', side: 'R' }, { role: 'FW', side: null }, { role: 'FW', side: 'L' }
      ],
      '3-4-2-1': [
        { role: 'GK', side: null },
        { role: 'DF', side: 'R' }, { role: 'DF', side: null }, { role: 'DF', side: 'L' },
        { role: 'MF', side: 'R' }, { role: 'MF', side: null }, { role: 'MF', side: null }, { role: 'MF', side: 'L' },
        { role: 'AM', side: 'R' }, { role: 'AM', side: 'L' },
        { role: 'FW', side: null }
      ],
      '3-4-1-2': [
        { role: 'GK', side: null },
        { role: 'DF', side: 'R' }, { role: 'DF', side: null }, { role: 'DF', side: 'L' },
        { role: 'MF', side: 'R' }, { role: 'MF', side: null }, { role: 'MF', side: null }, { role: 'MF', side: 'L' },
        { role: 'AM', side: null },
        { role: 'FW', side: 'L' }, { role: 'FW', side: 'R' }
      ],
      '3-5-2': [
        { role: 'GK', side: null },
        { role: 'DF', side: 'R' }, { role: 'DF', side: null }, { role: 'DF', side: 'L' },
        { role: 'MF', side: 'R' }, { role: 'MF', side: null }, { role: 'MF', side: null }, { role: 'MF', side: null }, { role: 'MF', side: 'L' },
        { role: 'FW', side: 'L' }, { role: 'FW', side: 'R' }
      ],
    };
    return templates[key] || templates['4-4-2'];
  }

  function getSpecificRole(player) {
    const code = String(player.position?.abbreviation || '').toUpperCase().trim();
    if (code === 'G' || code === 'GK') return 'GK';
    if (code === 'LB' || code === 'LWB') return 'LB';
    if (code === 'RB' || code === 'RWB') return 'RB';
    if (code === 'CD-L' || code === 'LCB') return 'LCB';
    if (code === 'CD-R' || code === 'RCB') return 'RCB';
    if (code === 'CB' || code === 'CD') return 'CB';
    if (code === 'DM' || code === 'CDM') return 'DM';
    if (code === 'CM-L' || code === 'LCM') return 'LCM';
    if (code === 'CM-R' || code === 'RCM') return 'RCM';
    if (code === 'CM') return 'CM';
    if (code === 'LM') return 'LM';
    if (code === 'RM') return 'RM';
    if (code === 'AM' || code === 'CAM') return 'CAM';
    if (code === 'AM-L' || code === 'LAM') return 'LAM';
    if (code === 'AM-R' || code === 'RAM') return 'RAM';
    if (code === 'F' || code === 'ST' || code === 'CF' || code === 'FW' || code === 'FWD') return 'ST';
    if (code === 'CF-L' || code === 'LST') return 'LST';
    if (code === 'CF-R' || code === 'RST') return 'RST';
    if (code === 'LW' || code === 'LWF') return 'LW';
    if (code === 'RW' || code === 'RWF') return 'RW';
    if (code.startsWith('D')) return 'CB';
    if (code.startsWith('M')) return 'CM';
    if (code.startsWith('F') || code.startsWith('S')) return 'ST';
    return 'CM';
  }

  function slotGroup(slotRole) {
    if (slotRole === 'GK') return 'GK';
    if (['LB', 'RB', 'LCB', 'RCB', 'CB', 'LWB', 'RWB'].includes(slotRole)) return 'DF';
    if (['DM'].includes(slotRole)) return 'DM';
    if (['LM', 'RM', 'LCM', 'RCM', 'CM'].includes(slotRole)) return 'MF';
    if (['CAM', 'LAM', 'RAM'].includes(slotRole)) return 'AM';
    if (['ST', 'LST', 'RST', 'LW', 'RW'].includes(slotRole)) return 'FW';
    return 'MF';
  }

  function playerGroup(player) {
    const r = getSpecificRole(player);
    if (r === 'GK') return 'GK';
    if (['LB', 'RB', 'LCB', 'RCB', 'CB'].includes(r)) return 'DF';
    if (r === 'DM') return 'DM';
    if (['LM', 'RM', 'LCM', 'RCM', 'CM'].includes(r)) return 'MF';
    if (['CAM', 'LAM', 'RAM'].includes(r)) return 'AM';
    if (['ST', 'LST', 'RST', 'LW', 'RW'].includes(r)) return 'FW';
    return 'MF';
  }

  function renderModernPitch(formation, starters, teamName) {
    const container = document.getElementById("teamFormationContainer");
    if (!container) return;
    const teamStyle = getTeamColorsAndLogo(teamName);
    document.documentElement.style.setProperty('--club-primary', teamStyle.primary);
    document.documentElement.style.setProperty('--club-secondary', teamStyle.secondary);
    const slots = getFormationPositions(formation);
    const assigned = new Array(slots.length).fill(null);
    const usedPlayers = new Set();

    starters.forEach(player => {
      const role = getSpecificRole(player);
      const slotIndex = slots.findIndex((slot, idx) => slot.role === role && !assigned[idx]);
      if (slotIndex !== -1) {
        assigned[slotIndex] = player;
        usedPlayers.add(player);
      }
    });

    const groupOrder = ['GK', 'DF', 'DM', 'MF', 'AM', 'FW'];
    groupOrder.forEach(group => {
      const emptySlots = slots
        .map((slot, idx) => ({ slot, idx }))
        .filter(({ slot, idx }) => slotGroup(slot.role) === group && !assigned[idx]);
      const availablePlayers = starters.filter(p => !usedPlayers.has(p) && playerGroup(p) === group);
      const fallbackGroups = { 'DM': ['MF', 'DF'], 'MF': ['DM', 'AM'], 'AM': ['MF', 'FW'], 'FW': ['AM'], };
      emptySlots.forEach(({ slot, idx }) => {
        if (assigned[idx]) return;
        let player = availablePlayers.find(p => !usedPlayers.has(p));
        if (!player && fallbackGroups[group]) {
          for (const fg of fallbackGroups[group]) {
            player = starters.find(p => !usedPlayers.has(p) && playerGroup(p) === fg);
            if (player) break;
          }
        }
        if (player) {
          assigned[idx] = player;
          usedPlayers.add(player);
          const pi = availablePlayers.indexOf(player);
          if (pi !== -1) availablePlayers.splice(pi, 1);
        }
      });
    });

    const leftovers = starters.filter(p => !usedPlayers.has(p));
    let leftoverIdx = 0;
    for (let i = 0; i < slots.length; i++) {
      if (!assigned[i] && leftoverIdx < leftovers.length) {
        assigned[i] = leftovers[leftoverIdx++];
      }
    }

    let playersHtml = '';
    slots.forEach((slot, i) => {
      const player = assigned[i];
      if (!player) return;
      const jersey = player.jersey || '?';
      const name = (player.athlete?.displayName || player.name || 'Oyuncu').substring(0, 14);
      const isGK = slot.role === 'GK';
      playersHtml += `<div class="player ${isGK ? 'goalkeeper' : ''}" style="top:${slot.y}%; left:${slot.x}%;">
        <div class="player-icon"><div class="jersey-number">${jersey}</div></div>
        <div class="player-name">${name}</div>
      </div>`;
    });

    container.innerHTML = `
      <div class="pitch-container">
          <div class="pitch-line center-line"></div>
          <div class="pitch-line center-circle"></div>
          <div class="pitch-line penalty-box top-box"></div>
          <div class="pitch-line penalty-box bottom-box"></div>
          <div class="pitch-line six-yard-box top-box"></div>
          <div class="pitch-line six-yard-box bottom-box"></div>
          ${playersHtml}
      </div>`;
  }

  function getFormationPositions(formation) {
    const key = String(formation).trim();
    const map = {
      "4-4-2": [
        { role: 'GK', x: 50, y: 88 },
        { role: 'RB', x: 88, y: 70 }, { role: 'RCB', x: 62, y: 72 }, { role: 'LCB', x: 38, y: 72 }, { role: 'LB', x: 12, y: 70 },
        { role: 'RM', x: 85, y: 45 }, { role: 'RCM', x: 62, y: 48 }, { role: 'LCM', x: 38, y: 48 }, { role: 'LM', x: 15, y: 45 },
        { role: 'RST', x: 65, y: 20 }, { role: 'LST', x: 35, y: 20 }
      ],
      "4-2-3-1": [
        { role: 'GK', x: 50, y: 88 },
        { role: 'RB', x: 88, y: 72 }, { role: 'RCB', x: 63, y: 75 }, { role: 'LCB', x: 37, y: 75 }, { role: 'LB', x: 12, y: 72 },
        { role: 'RCM', x: 67, y: 55 }, { role: 'LCM', x: 33, y: 55 },
        { role: 'RM', x: 85, y: 35 }, { role: 'CAM', x: 50, y: 38 }, { role: 'LM', x: 15, y: 35 },
        { role: 'ST', x: 50, y: 15 }
      ],
      "4-3-3": [
        { role: 'GK', x: 50, y: 88 },
        { role: 'RB', x: 88, y: 72 }, { role: 'RCB', x: 63, y: 75 }, { role: 'LCB', x: 37, y: 75 }, { role: 'LB', x: 12, y: 72 },
        { role: 'RCM', x: 75, y: 52 }, { role: 'CM', x: 50, y: 55 }, { role: 'LCM', x: 25, y: 52 },
        { role: 'RW', x: 85, y: 22 }, { role: 'ST', x: 50, y: 18 }, { role: 'LW', x: 15, y: 22 }
      ],
      "3-4-3": [
        { role: 'GK', x: 50, y: 88 },
        { role: 'RCB', x: 75, y: 75 }, { role: 'CB', x: 50, y: 78 }, { role: 'LCB', x: 25, y: 75 },
        { role: 'RM', x: 85, y: 52 }, { role: 'RCM', x: 62, y: 55 }, { role: 'LCM', x: 38, y: 55 }, { role: 'LM', x: 15, y: 52 },
        { role: 'RW', x: 85, y: 22 }, { role: 'ST', x: 50, y: 18 }, { role: 'LW', x: 15, y: 22 }
      ],
      "3-4-2-1": [
        { role: 'GK', x: 50, y: 88 },
        { role: 'RCB', x: 75, y: 75 }, { role: 'CB', x: 50, y: 78 }, { role: 'LCB', x: 25, y: 75 },
        { role: 'RM', x: 85, y: 55 }, { role: 'RCM', x: 62, y: 58 }, { role: 'LCM', x: 38, y: 58 }, { role: 'LM', x: 15, y: 55 },
        { role: 'RAM', x: 67, y: 35 }, { role: 'LAM', x: 33, y: 35 },
        { role: 'ST', x: 50, y: 15 }
      ],
      "3-4-1-2": [
        { role: 'GK', x: 50, y: 88 },
        { role: 'RCB', x: 75, y: 75 }, { role: 'CB', x: 50, y: 78 }, { role: 'LCB', x: 25, y: 75 },
        { role: 'RM', x: 85, y: 55 }, { role: 'RCM', x: 62, y: 58 }, { role: 'LCM', x: 38, y: 58 }, { role: 'LM', x: 15, y: 55 },
        { role: 'CAM', x: 50, y: 38 },
        { role: 'RST', x: 67, y: 18 }, { role: 'LST', x: 33, y: 18 }
      ],
      "3-5-2": [
        { role: 'GK', x: 50, y: 88 },
        { role: 'RCB', x: 75, y: 75 }, { role: 'CB', x: 50, y: 78 }, { role: 'LCB', x: 25, y: 75 },
        { role: 'RWB', x: 88, y: 45 }, { role: 'RCM', x: 67, y: 52 }, { role: 'CM', x: 50, y: 55 }, { role: 'LCM', x: 33, y: 52 }, { role: 'LWB', x: 12, y: 45 },
        { role: 'RST', x: 65, y: 22 }, { role: 'LST', x: 35, y: 22 }
      ],
      "5-3-2": [
        { role: 'GK', x: 50, y: 88 },
        { role: 'RWB', x: 90, y: 70 }, { role: 'RCB', x: 70, y: 75 }, { role: 'CB', x: 50, y: 78 }, { role: 'LCB', x: 30, y: 75 }, { role: 'LWB', x: 10, y: 70 },
        { role: 'RCM', x: 75, y: 50 }, { role: 'CM', x: 50, y: 52 }, { role: 'LCM', x: 25, y: 50 },
        { role: 'RST', x: 65, y: 22 }, { role: 'LST', x: 35, y: 22 }
      ],
      "5-4-1": [
        { role: 'GK', x: 50, y: 88 },
        { role: 'RWB', x: 90, y: 70 }, { role: 'RCB', x: 70, y: 75 }, { role: 'CB', x: 50, y: 78 }, { role: 'LCB', x: 30, y: 75 }, { role: 'LWB', x: 10, y: 70 },
        { role: 'RM', x: 85, y: 45 }, { role: 'RCM', x: 62, y: 48 }, { role: 'LCM', x: 38, y: 48 }, { role: 'LM', x: 15, y: 45 },
        { role: 'ST', x: 50, y: 20 }
      ],
      "4-1-4-1": [
        { role: 'GK', x: 50, y: 88 },
        { role: 'RB', x: 85, y: 76 }, { role: 'RCB', x: 62, y: 76 }, { role: 'LCB', x: 38, y: 76 }, { role: 'LB', x: 15, y: 76 },
        { role: 'DM', x: 50, y: 60 },
        { role: 'RM', x: 85, y: 46 }, { role: 'RCM', x: 62, y: 46 }, { role: 'LCM', x: 38, y: 46 }, { role: 'LM', x: 15, y: 46 },
        { role: 'ST', x: 50, y: 22 }
      ]
    };
    const raw = key.replace(/\D/g, "");
    if (!map[key] && raw) {
      if (raw === "442") return map["4-4-2"];
      if (raw === "4231") return map["4-2-3-1"];
      if (raw === "433") return map["4-3-3"];
      if (raw === "343") return map["3-4-3"];
      if (raw === "3421") return map["3-4-2-1"];
      if (raw === "3412") return map["3-4-1-2"];
      if (raw === "352") return map["3-5-2"];
      if (raw === "532") return map["5-3-2"];
      if (raw === "541") return map["5-4-1"];
      if (raw === "4141") return map["4-1-4-1"];
    }
    return map[key] || map["4-4-2"];
  }

  function getTeamColorsAndLogo(teamName) {
    const normalized = (teamName || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c');
    const colorMap = {
      'galatasaray': { primary: '#FFCC00', secondary: '#FF0000' },
      'fenerbahce': { primary: '#FFFF00', secondary: '#000080' },
      'trabzonspor': { primary: '#800000', secondary: '#0000FF' },
      'besiktas': { primary: '#000000', secondary: '#FFFFFF' },
      'basaksehir': { primary: '#FF6600', secondary: '#000080' },
      'goztepe': { primary: '#FFFF00', secondary: '#FF0000' },
      'samsunspor': { primary: '#FF0000', secondary: '#FFFFFF' },
      'konyaspor': { primary: '#008000', secondary: '#FFFFFF' },
      'rize': { primary: '#008000', secondary: '#0000FF' },
      'gaziantep': { primary: '#FF0000', secondary: '#000000' },
      'kocaelispor': { primary: '#008000', secondary: '#000000' },
      'alanyaspor': { primary: '#FF6600', secondary: '#008000' },
      'kasimpasa': { primary: '#000080', secondary: '#FFFFFF' },
      'genclerbirligi': { primary: '#FF0000', secondary: '#000000' },
      'eyupspor': { primary: '#800080', secondary: '#FFFF00' },
      'antalyaspor': { primary: '#FF0000', secondary: '#FFFFFF' },
      'kayserispor': { primary: '#FFFF00', secondary: '#FF0000' },
      'karagumruk': { primary: '#FF0000', secondary: '#000000' },
      'fatih': { primary: '#FF0000', secondary: '#000000' },
    };
    if (colorMap[normalized]) return { primary: colorMap[normalized].primary, secondary: colorMap[normalized].secondary, logo: '' };
    const parts = normalized.split(/\s+/);
    for (const part of parts) {
      if (colorMap[part]) return { primary: colorMap[part].primary, secondary: colorMap[part].secondary, logo: '' };
    }
    const joined = parts.join('');
    if (colorMap[joined]) return { primary: colorMap[joined].primary, secondary: colorMap[joined].secondary, logo: '' };
    return { primary: '#003366', secondary: '#fbca03', logo: '' };
  }

  function resolveTeamLogo(name, espnLogo) {
    if (espnLogo) return espnLogo;
    const colors = getTeamColorsAndLogo(name);
    return colors.logo || "";
  }

  async function getLastMatchForTeam(teamId) {
    try {
      const now = new Date();
      const start = new Date(); start.setDate(now.getDate() - 45);
      const end = new Date(); end.setDate(now.getDate() + 2);
      const ds = start.toISOString().split('T')[0].replace(/-/g, '');
      const de = end.toISOString().split('T')[0].replace(/-/g, '');
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/scoreboard?dates=${ds}-${de}&limit=50`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error();
      const data = await resp.json();
      const events = data.events || [];
      const teamMatches = events.filter(ev => {
        const comps = ev.competitions?.[0];
        return comps?.competitors?.some(c => String(c.team?.id || c.id) === String(teamId));
      });
      if (teamMatches.length === 0) return null;
      const activeStates = ["in", "post"];
      const relevantMatches = teamMatches.filter(ev => activeStates.includes(ev.status?.type?.state));
      if (relevantMatches.length === 0) return null;
      relevantMatches.sort((a, b) => new Date(b.date) - new Date(a.date));
      return relevantMatches[0];
    } catch (e) { console.error("getLastMatchForTeam hatası:", e); return null; }
  }

  async function updateLastMatchCardFromEvent(ev, teamId, defaultFormation = "4-4-2") {
    const container = document.getElementById("detailTabLineup");
    if (!container) return;
    const oldCard = document.getElementById("teamLastMatchCard");
    if (oldCard) oldCard.remove();
    const evObj = normalizeMatch(ev);
    const isL = evObj.isLive;
    const isF = evObj.isFinal;
    const scoreStr = (evObj.hScore !== null && evObj.aScore !== null) ? `${evObj.hScore} - ${evObj.aScore}` : "vs";
    const metaStr = isL ? "CANLI" : (isF ? "MS" : evObj.dateFull.split(" ")[1]);
    const card = document.createElement("div");
    card.id = "teamLastMatchCard";
    card.style.cssText = "padding:16px; background:rgba(255,255,255,0.02); border-radius:12px; margin-bottom:16px; border:1px solid rgba(255,255,255,0.05);";
    card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <div style="display:flex; flex:1; align-items:center; justify-content:flex-end; gap:8px;">
                  <span style="font-weight:700; font-size:13px; color:var(--text-primary); text-align:right;">${evObj.home}</span>
                  <img src="${evObj.homeLogo}" style="width:28px; height:28px; object-fit:contain;" onerror="this.src='icon.svg'">
              </div>
              <div style="padding:6px 12px; background:rgba(0,0,0,0.3); border-radius:8px; text-align:center; margin:0 12px; min-width:60px;">
                  <div style="font-weight:800; font-size:16px; font-family:'Space Grotesk', monospace; color:var(--text-primary);">${scoreStr}</div>
                  <div style="font-size:10px; color:var(--text-secondary); margin-top:2px; font-weight:800;">${metaStr}</div>
              </div>
              <div style="display:flex; flex:1; align-items:center; justify-content:flex-start; gap:8px;">
                  <img src="${evObj.awayLogo}" style="width:28px; height:28px; object-fit:contain;" onerror="this.src='icon.svg'">
                  <span style="font-weight:700; font-size:13px; color:var(--text-primary); text-align:left;">${evObj.away}</span>
              </div>
          </div>
          <div style="border-top:1px solid rgba(255,255,255,0.05); padding-top:12px; margin-top:6px; text-align:center; display:flex; flex-direction:column; gap:6px;">
              <div style="font-size:11px; color:var(--text-secondary); font-weight:600; opacity:0.8;">📅 ${evObj.dateFull}</div>
              <div id="teamFormationText" style="font-size:12px; color:rgba(255,255,255,0.5); font-weight:800; text-transform:uppercase; letter-spacing:0.8px;">Diziliş: ${defaultFormation}</div>
          </div>
      `;
    container.insertBefore(card, container.firstChild);
  }

  async function fetchLastMatch(teamId) {
    try {
      const now = new Date();
      const start = new Date(); start.setDate(now.getDate() - 45);
      const end = new Date(); end.setDate(now.getDate() + 1);
      const ds = start.toISOString().split('T')[0].replace(/-/g, '');
      const de = end.toISOString().split('T')[0].replace(/-/g, '');
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/scoreboard?dates=${ds}-${de}&limit=50`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error();
      const data = await resp.json();
      const events = data.events || [];
      const teamMatches = events.filter(ev => {
        const comps = ev.competitions?.[0];
        const competitors = comps?.competitors || [];
        const hasTeam = competitors.some(c => String(c.id) === String(teamId));
        const isPost = ev.status?.type?.state === "post";
        return hasTeam && isPost;
      });
      if (teamMatches.length === 0) return null;
      teamMatches.sort((a, b) => new Date(b.date) - new Date(a.date));
      const last = teamMatches[0];
      const comp = last.competitions[0];
      const home = comp.competitors.find(c => c.homeAway === "home");
      const away = comp.competitors.find(c => c.homeAway === "away");
      const homeScore = parseInt(home.score);
      const awayScore = parseInt(away.score);
      const isHome = (String(home.team.id) === String(teamId));
      let resultText = "";
      if (isHome) {
        if (homeScore > awayScore) resultText = "Galibiyet";
        else if (homeScore < awayScore) resultText = "Mağlubiyet";
        else resultText = "Beraberlik";
      } else {
        if (awayScore > homeScore) resultText = "Galibiyet";
        else if (awayScore < homeScore) resultText = "Mağlubiyet";
        else resultText = "Beraberlik";
      }
      const opponent = isHome ? away.team.displayName : home.team.displayName;
      const matchDate = new Date(last.date).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
      return { opponent, score: `${homeScore} - ${awayScore}`, result: resultText, date: matchDate };
    } catch (err) { return null; }
  }

  window.switchDetailTab = function (tab) {
    document.querySelectorAll('.detail-tab-btn').forEach(btn => {
      const btnTab = btn.getAttribute('onclick')?.match(/switchDetailTab\('(\w+)'\)/)?.[1];
      if (btnTab === tab) btn.classList.add('active');
      else btn.classList.remove('active');
    });
    document.querySelectorAll('.detail-tab-content').forEach(content => {
      if (content.id === `detailTab${tab.charAt(0).toUpperCase() + tab.slice(1)}`) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
    const isLineup = (tab === 'lineup');
    const matchCard = document.getElementById('teamLastMatchCard');
    const pitch = document.getElementById('teamFormationContainer');
    const lineupList = document.getElementById('teamLineupList');
    if (matchCard) matchCard.style.display = isLineup ? 'block' : 'none';
    if (pitch) pitch.style.display = isLineup ? 'block' : 'none';
    if (lineupList) lineupList.style.display = isLineup ? 'block' : 'none';
  };

  async function fetchTeamSchedule(teamId) {
    const list = document.getElementById("teamScheduleList");
    const teamName = document.getElementById("teamDetailName").textContent;
    list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-secondary);">Yükleniyor...</div>`;
    try {
      const now = new Date();
      const start = new Date(); start.setDate(now.getDate() - 30);
      const end = new Date(); end.setDate(now.getDate() + 45);
      const ds = start.toISOString().split('T')[0].replace(/-/g, '');
      const de = end.toISOString().split('T')[0].replace(/-/g, '');
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/scoreboard?dates=${ds}-${de}&limit=100`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const clean = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c');
      const sName = clean(teamName);
      const events = (data?.events || [])
        .filter(ev => {
          const comps = ev.competitions?.[0];
          const hasId = comps?.competitors?.some(c => String(c.id) === String(teamId));
          const hasName = clean(ev.name).includes(sName);
          return hasId || hasName;
        })
        .map(ev => normalizeMatch(ev));
      if (events.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:32px; color:var(--text-secondary);">Maç programı bulunamadı.</div>`;
      } else {
        list.innerHTML = events.map(ev => {
          const isL = ev.isLive;
          const isF = ev.isFinal;
          const scoreStr = (ev.hScore !== null && ev.aScore !== null) ? `${ev.hScore} - ${ev.aScore}` : "vs";
          const metaStr = isL ? "LIVE!" : (isF ? "FT" : ev.dateFull.split(" ")[1]);
          const dateStr = ev.dateFull.split(" ")[0];
          return `
              <div class="schedule-row">
                <div class="schedule-info">
                  <div class="sch-team">
                    <img src="${ev.homeLogo}" class="sch-logo" onerror="this.src='icon.svg'">
                    <div class="sch-name">${ev.home}</div>
                  </div>
                  <div class="sch-center">
                    <div class="sch-score-box ${isL ? 'live' : ''}" style="${isL ? 'border:2px solid rgba(14,203,129,0.6); box-shadow:0 0 12px rgba(14,203,129,0.2);' : ''}">${scoreStr}</div>
                    <div class="sch-meta ${isL ? 'clr-up' : ''}" style="${isL ? 'font-weight:900;' : ''}">${dateStr} ${metaStr}</div>
                  </div>
                  <div class="sch-team">
                    <img src="${ev.awayLogo}" class="sch-logo" onerror="this.src='icon.svg'">
                    <div class="sch-name">${ev.away}</div>
                  </div>
                </div>
                ${renderTeamDetailGoals(ev)}
                <div class="sch-league">${ev.league}</div>
              </div>
            `;
        }).join("");
      }
    } catch (e) { list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--down);">Hata oluştu.</div>`; }
  }

  async function fetchTeamSquad(teamId) {
    const list = document.getElementById("teamSquadList");
    list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-secondary);">Yükleniyor...</div>`;
    try {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/teams/${teamId}/roster`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const athletes = data?.athletes || [];
      if (athletes.length === 0) { list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-secondary);">Kadro verisi yok.</div>`; return; }
      const posColors = {
        'GK': 'rgba(255,215,0,0.08)', 'DF': 'rgba(30,144,255,0.08)', 'DEF': 'rgba(30,144,255,0.08)',
        'MF': 'rgba(50,205,50,0.08)', 'MID': 'rgba(50,205,50,0.08)', 'FW': 'rgba(220,20,60,0.08)',
        'FWD': 'rgba(220,20,60,0.08)', 'ST': 'rgba(220,20,60,0.08)',
      };
      const order = { 'GK': 1, 'DF': 2, 'DEF': 2, 'MF': 3, 'MID': 3, 'FW': 4, 'FWD': 4, 'ST': 4 };
      athletes.sort((a, b) => {
        const oa = order[a.position?.abbreviation] || 99;
        const ob = order[b.position?.abbreviation] || 99;
        return oa - ob;
      });
      let currentGroup = '';
      let html = '';
      athletes.forEach(a => {
        const pos = a.position?.abbreviation || '??';
        const groupLabel = pos === 'GK' ? 'Kaleciler' : (pos.startsWith('D') || pos === 'DEF') ? 'Defans' : (pos.startsWith('M') || pos === 'MID') ? 'Orta Saha' : (pos.startsWith('F') || pos === 'ST') ? 'Forvet' : 'Diğer';
        const posBg = posColors[pos] || 'rgba(255,255,255,0.02)';
        if (groupLabel !== currentGroup) {
          currentGroup = groupLabel;
          html += `<div style="padding:8px; font-size:12px; font-weight:800; color:var(--brand); text-transform:uppercase; border-bottom:1px solid rgba(252,213,53,0.15); margin-top:8px;">${groupLabel}</div>`;
        }
        html += `
          <div class="squad-item" style="background:${posBg}; padding:8px; border-bottom:1px solid rgba(255,255,255,0.03); display:flex; justify-content:space-between; align-items:center;">
            <span class="squad-pos" style="font-size:11px; color:var(--text-secondary); font-weight:600; padding:2px 6px; background:rgba(255,255,255,0.05); border-radius:4px;">${pos}</span>
            <span class="squad-name" style="font-weight:700; color:var(--text-primary); font-size:13px;">${a.displayName}</span>
            <span class="squad-num" style="font-size:12px; font-weight:800; color:var(--brand); background:rgba(252,213,53,0.1); padding:4px 8px; border-radius:6px; min-width:24px; text-align:center;">${a.jersey || '-'}</span>
          </div>`;
      });
      list.innerHTML = html;
    } catch (e) { list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--down);">Kadro yüklenemedi.</div>`; }
  }

  async function checkTeamLiveStatus(teamName) {
    const liveInd = document.getElementById("teamDetailLive");
    liveInd.style.display = "none";
    try {
      const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/scoreboard");
      if (!res.ok) return;
      const data = await res.json();
      const isPlaying = (data?.events || []).some(ev => {
        const isLive = ev.status?.type?.name === "STATUS_IN_PROGRESS";
        const hasTeam = ev.name.toLowerCase().includes(teamName.toLowerCase());
        return isLive && hasTeam;
      });
      if (isPlaying) liveInd.style.display = "inline-block";
    } catch (e) { }
  }

  window.closeTeamDetail = function () {
    const o = document.getElementById("teamDetailOverlay");
    if (o) o.classList.remove("open");
  };

  function showLigError() {
    const container = document.getElementById("ligTableBody");
    if (container) {
      container.innerHTML = `<div style="text-align:center;padding:48px 16px;color:var(--text-secondary);">
          <div style="font-size:36px;margin-bottom:12px;">📡</div>
          <div style="font-size:15px;font-weight:800;color:var(--text-primary);margin-bottom:8px;">Bağlantı Hatası</div>
          <div style="font-size:13px;line-height:1.8;">İnternet bağlantınızı kontrol edip<br><strong style="color:var(--brand)">Yenile</strong> butonuna basın.</div>
        </div>`;
    }
    const rm = document.getElementById("ligRecentMatches");
    if (rm) rm.innerHTML = "";
    setText("ligMeta", "Veri alınamadı");
  }

  function bindSuperLig() {
    const btn = document.getElementById("ligRefreshBtn");
    const seasonSelect = document.getElementById("ligSeasonSelect");
    populateLigSeasonOptions();
    if (btn) { btn.addEventListener("click", fetchSuperLigData); }
    if (seasonSelect) { seasonSelect.addEventListener("change", fetchSuperLigData); }
    fetchSuperLigData();
  }

  function init() {
    bindSuperLig();
    console.log('✅ Süper Lig modülü başlatıldı');
  }

  // ─── MAÇ İSTATİSTİKLERİ (ESPN Summary API) ───────────────────
  // --- YENI: Otomatik Istatistik Yukleme ve Gorsellestirme -----
  async function fetchMatchStats(eventId) {
    try {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/tur.1/summary?event=${eventId}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data?.boxscore?.teams || [];
    } catch (e) {
      console.error('Mac istatistikleri alinamadi:', e);
      return null;
    }
  }

  function renderStatsHTML(teams) {
    const t1 = teams[0];
    const t2 = teams[1];

    const statsToShow = [
      { key: 'possessionPct', label: 'Topa Sahip Olma', format: 'pct' },
      { key: 'totalShots', label: 'Toplam Sut', format: 'num' },
      { key: 'shotsOnTarget', label: 'Isabetli Sut', format: 'num' },
      { key: 'foulsCommitted', label: 'Fauller', format: 'num' },
      { key: 'yellowCards', label: 'Sari Kartlar', format: 'num' },
      { key: 'redCards', label: 'Kirmizi Kartlar', format: 'num' },
      { key: 'wonCorners', label: 'Kornerler', format: 'num' },
      { key: 'saves', label: 'Kurtarislar', format: 'num' },
    ];

    let html = '';

    statsToShow.forEach(stat => {
      const s1 = (t1.statistics || []).find(s => s.name === stat.key);
      const s2 = (t2.statistics || []).find(s => s.name === stat.key);

      const v1 = s1 ? parseFloat(s1.displayValue) : 0;
      const v2 = s2 ? parseFloat(s2.displayValue) : 0;

      const total = v1 + v2;
      const p1 = total > 0 ? (v1 / total) * 100 : 50;
      const p2 = total > 0 ? (v2 / total) * 100 : 50;

      // Renk mantığı: Eşitlikte ve v1 > v2'de ev sahibi yeşil.
      // Deplasmanın yeşil olması için v2 > v1 olmalı.
      const leftColor = (v1 >= v2) ? 'var(--up)' : 'rgba(255, 255, 255, 0.25)';
      const rightColor = (v2 > v1) ? 'var(--up)' : 'rgba(255, 255, 255, 0.25)';

      let leftVal, rightVal;
      if (stat.format === 'pct') {
        leftVal = `${v1}%`;
        rightVal = `${v2}%`;
      } else {
        leftVal = v1;
        rightVal = v2;
      }

      html += `
        <div style="margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-secondary); margin-bottom:3px;">
            <span style="font-weight:700;">${leftVal}</span>
            <span style="text-transform:uppercase; font-weight:800; letter-spacing:0.5px;">${stat.label}</span>
            <span style="font-weight:700;">${rightVal}</span>
          </div>
          <div style="display:flex; height:5px; border-radius:3px; overflow:hidden; background:rgba(255,255,255,0.05);">
            <div style="width:${p1}%; background:${leftColor}; transition:width 0.4s ease;"></div>
            <div style="width:${p2}%; background:${rightColor};"></div>
          </div>
        </div>
      `;
    });

    return html;
  }

  window.loadMatchStatsInline = async function (eventId, tab) {
    const placeholderId = tab
      ? `stats-placeholder-${tab}-${eventId}`
      : `stats-placeholder-${eventId}`;
    const placeholder = document.getElementById(placeholderId);
    if (!placeholder) return;

    // Zaten yuklendiyse bir daha ugrasma
    if (placeholder.dataset.loaded === 'true') return;

    placeholder.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-secondary);font-size:11px;">Istatistikler yukleniyor...</div>';

    const teams = await fetchMatchStats(eventId);

    if (!teams || teams.length < 2) {
      placeholder.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-secondary);font-size:11px;">Istatistik verisi bulunamadi.</div>';
      placeholder.dataset.loaded = 'true';
      return;
    }

    placeholder.innerHTML = renderStatsHTML(teams);
    placeholder.dataset.loaded = 'true';
  };

  return { init };
})();
