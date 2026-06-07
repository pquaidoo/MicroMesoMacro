(() => {
  // State
  let selectedGames = []; // [{ game, frequency }]
  let searchQuery = '';

  const screens = {
    intro:    document.getElementById('screen-intro'),
    select:   document.getElementById('screen-select'),
    results:  document.getElementById('screen-results'),
  };

  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  // --- INTRO ---
  document.getElementById('btn-start').addEventListener('click', () => showScreen('select'));

  // --- GAME SELECTION ---
  const searchInput   = document.getElementById('game-search');
  const gameGrid      = document.getElementById('game-grid');
  const selectedList  = document.getElementById('selected-list');
  const btnResults    = document.getElementById('btn-results');
  const customInput   = document.getElementById('custom-game-input');
  const btnAddCustom  = document.getElementById('btn-add-custom');
  const selectedCount = document.getElementById('selected-count');

  function renderGameGrid() {
    const q = searchQuery.toLowerCase();
    const filtered = GAMES.filter(g => g.name.toLowerCase().includes(q));
    gameGrid.innerHTML = '';

    filtered.forEach(game => {
      const already = selectedGames.find(sg => sg.game.name === game.name);
      const card = document.createElement('div');
      card.className = 'game-card' + (already ? ' selected' : '');

      const dom = dominantLabel(game);
      card.innerHTML = `
        <span class="game-name">${game.name}</span>
        <span class="game-tags">
          <span class="tag micro">Micro ${game.micro}</span>
          <span class="tag meso">Meso ${game.meso}</span>
          <span class="tag macro">Macro ${game.macro}</span>
        </span>
        <span class="game-dom ${dom.cls}">${dom.label}</span>
      `;
      card.addEventListener('click', () => toggleGame(game));
      gameGrid.appendChild(card);
    });
  }

  function dominantLabel(game) {
    const max = Math.max(game.micro, game.meso, game.macro);
    if (game.micro === max && game.micro > game.meso && game.micro > game.macro)
      return { label: 'Micro', cls: 'micro' };
    if (game.meso === max && game.meso > game.micro && game.meso > game.macro)
      return { label: 'Meso', cls: 'meso' };
    if (game.macro === max && game.macro > game.micro && game.macro > game.meso)
      return { label: 'Macro', cls: 'macro' };
    return { label: 'Mixed', cls: 'mixed' };
  }

  function toggleGame(game) {
    const idx = selectedGames.findIndex(sg => sg.game.name === game.name);
    if (idx >= 0) {
      selectedGames.splice(idx, 1);
    } else {
      selectedGames.push({ game, frequency: 3 });
    }
    renderGameGrid();
    renderSelectedList();
    updateResultsBtn();
  }

  function renderSelectedList() {
    selectedList.innerHTML = '';
    selectedCount.textContent = selectedGames.length;
    if (selectedGames.length === 0) {
      selectedList.innerHTML = '<p class="empty-state">No games selected yet.<br>Click a game on the left to add it.</p>';
      return;
    }

    selectedGames.forEach((sg, i) => {
      const item = document.createElement('div');
      item.className = 'selected-item';
      item.innerHTML = `
        <span class="sel-name">${sg.game.name}</span>
        <label class="freq-label">Play frequency
          <input type="range" min="1" max="5" value="${sg.frequency}" class="freq-slider" data-idx="${i}">
          <span class="freq-val">${freqLabel(sg.frequency)}</span>
        </label>
        <button class="btn-remove" data-idx="${i}" title="Remove">✕</button>
      `;
      selectedList.appendChild(item);
    });

    selectedList.querySelectorAll('.freq-slider').forEach(slider => {
      slider.addEventListener('input', e => {
        const idx = +e.target.dataset.idx;
        selectedGames[idx].frequency = +e.target.value;
        e.target.nextElementSibling.textContent = freqLabel(+e.target.value);
      });
    });

    selectedList.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', e => {
        const idx = +e.currentTarget.dataset.idx;
        selectedGames.splice(idx, 1);
        renderGameGrid();
        renderSelectedList();
        updateResultsBtn();
      });
    });
  }

  function freqLabel(v) {
    return ['', 'Rarely', 'Sometimes', 'Often', 'Very Often', 'Main Game'][v] || v;
  }

  function updateResultsBtn() {
    btnResults.disabled = selectedGames.length === 0;
    btnResults.textContent = selectedGames.length === 0
      ? 'Select at least one game'
      : `See My Results (${selectedGames.length} game${selectedGames.length > 1 ? 's' : ''})`;
  }

  searchInput.addEventListener('input', e => {
    searchQuery = e.target.value;
    renderGameGrid();
  });

  // Custom game input (mid-range defaults)
  btnAddCustom.addEventListener('click', () => {
    const name = customInput.value.trim();
    if (!name) return;
    if (selectedGames.find(sg => sg.game.name === name)) {
      customInput.value = '';
      return;
    }
    const custom = { name, micro: 5, meso: 5, macro: 5 };
    GAMES.push(custom);
    selectedGames.push({ game: custom, frequency: 3 });
    customInput.value = '';
    renderGameGrid();
    renderSelectedList();
    updateResultsBtn();
  });

  customInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') btnAddCustom.click();
  });

  // --- RESULTS ---
  const vennSvg    = document.getElementById('venn-svg');
  const breakdownEl = document.getElementById('breakdown');
  const btnRestart = document.getElementById('btn-restart');
  const btnShareInfo = document.getElementById('btn-share-info');

  btnResults.addEventListener('click', () => {
    showScreen('results');
    renderResults();
  });

  function renderResults() {
    VENN.render(vennSvg, selectedGames);
    renderBreakdown();
  }

  function renderBreakdown() {
    const totals = { micro: 0, meso: 0, macro: 0 };
    selectedGames.forEach(sg => {
      totals.micro += sg.game.micro * sg.frequency;
      totals.meso  += sg.game.meso  * sg.frequency;
      totals.macro += sg.game.macro * sg.frequency;
    });
    const sum = totals.micro + totals.meso + totals.macro || 1;
    const pct = {
      micro: Math.round(totals.micro / sum * 100),
      meso:  Math.round(totals.meso  / sum * 100),
      macro: Math.round(totals.macro / sum * 100),
    };

    const profile = buildProfile(pct);

    breakdownEl.innerHTML = `
      <div class="profile-title">${profile.title}</div>
      <p class="profile-desc">${profile.desc}</p>
      <div class="pct-bars">
        <div class="pct-row">
          <span class="pct-label micro">Micro</span>
          <div class="pct-bar-track"><div class="pct-bar micro" style="width:${pct.micro}%"></div></div>
          <span class="pct-num">${pct.micro}%</span>
        </div>
        <div class="pct-row">
          <span class="pct-label meso">Meso</span>
          <div class="pct-bar-track"><div class="pct-bar meso" style="width:${pct.meso}%"></div></div>
          <span class="pct-num">${pct.meso}%</span>
        </div>
        <div class="pct-row">
          <span class="pct-label macro">Macro</span>
          <div class="pct-bar-track"><div class="pct-bar macro" style="width:${pct.macro}%"></div></div>
          <span class="pct-num">${pct.macro}%</span>
        </div>
      </div>
      <div class="game-breakdown">
        <h4>Your Games</h4>
        ${selectedGames.map(sg => `
          <div class="game-row">
            <span class="gr-name">${sg.game.name}</span>
            <span class="gr-freq">${freqLabel(sg.frequency)}</span>
            <span class="gr-bars">
              <span class="gr-bar micro" style="width:${sg.game.micro * 9}px" title="Micro ${sg.game.micro}"></span>
              <span class="gr-bar meso"  style="width:${sg.game.meso  * 9}px" title="Meso ${sg.game.meso}"></span>
              <span class="gr-bar macro" style="width:${sg.game.macro * 9}px" title="Macro ${sg.game.macro}"></span>
            </span>
          </div>
        `).join('')}
      </div>
    `;
  }

  function buildProfile(pct) {
    const { micro, meso, macro } = pct;
    const threshold = 40;
    const isMicro = micro >= threshold;
    const isMeso  = meso  >= threshold;
    const isMacro = macro >= threshold;

    if (isMicro && isMeso && isMacro)
      return { title: 'The Complete Player', desc: 'You thrive across all dimensions — precise mechanics, sharp social reads, and deep strategic thinking. The rarest breed.' };
    if (isMicro && isMeso)
      return { title: 'The Duelist', desc: 'You live in the moment — outplaying opponents mechanically while constantly reading their intentions. The battlefield is your stage.' };
    if (isMicro && isMacro)
      return { title: 'The Optimizer', desc: 'Flawless execution meets long-term planning. You run the math on optimal routes and then execute them to perfection.' };
    if (isMeso && isMacro)
      return { title: 'The Strategist', desc: 'You read the room and plan ten steps ahead. Information is power, and you know exactly how to use it.' };
    if (isMicro)
      return { title: 'The Technician', desc: 'Pure mechanical mastery. You practice until it\'s perfect, and then you practice more. Muscle memory is your superpower.' };
    if (isMeso)
      return { title: 'The Mind Reader', desc: 'You win by understanding people — their patterns, their tells, their teams. The social layer is where you live.' };
    if (isMacro)
      return { title: 'The Architect', desc: 'You see the game at 30,000 feet. Resource allocation, meta analysis, long-term positioning — the big picture is your domain.' };
    return { title: 'The Balanced Player', desc: 'A healthy mix across all three pillars. You adapt to whatever the game demands.' };
  }

  btnRestart.addEventListener('click', () => {
    selectedGames = [];
    searchQuery = '';
    searchInput.value = '';
    renderGameGrid();
    renderSelectedList();
    updateResultsBtn();
    showScreen('intro');
  });

  btnShareInfo.addEventListener('click', () => {
    const text = document.getElementById('breakdown').querySelector('.profile-title')?.textContent || 'My Gamer Profile';
    if (navigator.share) {
      navigator.share({ title: 'MicroMesoMacro', text: `My gamer profile: ${text} — find yours at MicroMesoMacro!` });
    } else {
      navigator.clipboard.writeText(`My gamer profile: ${text} — find yours at MicroMesoMacro!`);
      btnShareInfo.textContent = 'Copied!';
      setTimeout(() => btnShareInfo.textContent = 'Share Profile', 2000);
    }
  });

  // Init
  renderGameGrid();
  updateResultsBtn();
  showScreen('intro');
})();
