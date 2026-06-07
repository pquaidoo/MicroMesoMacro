(() => {
  const RESPONSE = {
    often:   { label: 'Play Often',    weight: 5, color: '#5ce07a' },
    would:   { label: 'Would Like',    weight: 2, color: '#5cb8e0' },
    eh:      { label: 'Eh',            weight: 0, color: '#7c8098' },
    wouldnt: { label: "Wouldn't Like", weight: 0, color: '#e09a5c' },
    dislike: { label: 'Dislike',       weight: 0, color: '#e05c5c' },
  };

  // Flyout direction (dx, dy) for each action
  const ACTION_DIR = {
    often:   [ 250,    0],
    would:   [   0, -250],
    eh:      [   0,  250],
    wouldnt: [-180,  220],
    dislike: [-250,    0],
  };

  const SWIPE_MAP = { right: 'often', up: 'would', down: 'eh', left: 'dislike' };

  // Default votes loaded from default.txt — index matches GAMES array order
  const DEFAULT_VOTES = [
    'wouldnt', // Chess
    'wouldnt', // Poker
    'wouldnt', // Counter-Strike / VALORANT
    'often',   // League of Legends
    'eh',      // Dota 2
    'wouldnt', // Street Fighter
    'wouldnt', // Tekken
    'wouldnt', // Mortal Kombat
    'wouldnt', // StarCraft II
    'wouldnt', // Tetris
    'would',   // Hearthstone
    'eh',      // Magic: The Gathering
    'dislike', // Among Us
    'wouldnt', // Fortnite
    'wouldnt', // Warzone / PUBG
    'wouldnt', // Apex Legends
    'would',   // Overwatch 2
    'wouldnt', // Rocket League
    'often',   // Minecraft
    'wouldnt', // Civilization VI
    'wouldnt', // Age of Empires II
    'wouldnt', // Escape from Tarkov
    'wouldnt', // FIFA / EA FC
    'wouldnt', // Speedrunning
    'wouldnt', // Diplomacy
    'would',   // Dungeons & Dragons
    'eh',      // Super Smash Bros.
    'wouldnt', // Dance Dance Revolution
    'wouldnt', // osu!
    'would',   // Teamfight Tactics
    'eh',      // XCOM 2
    'eh',      // Rust
    'would',   // Rainbow Six Siege
    'wouldnt', // Halo (multiplayer)
    'wouldnt', // Splatoon
    'wouldnt', // Go (board game)
    'wouldnt', // Backgammon
    'eh',      // Scrabble
    'wouldnt', // Warcraft III
    'wouldnt', // Path of Exile
  ];

  let deck    = [];
  let cursor  = 0;
  let votes   = [];
  let swiping = false;

  const $ = id => document.getElementById(id);
  const screens = { intro: $('screen-intro'), select: $('screen-select'), results: $('screen-results') };

  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  // ── Deck ────────────────────────────────────────────────
  function initDeck() {
    deck    = [...GAMES].sort(() => Math.random() - 0.5);
    cursor  = 0;
    votes   = [];
    swiping = false;
    rebuildStack();
    updateProgress();
  }

  function updateProgress() {
    const pct = deck.length ? cursor / deck.length * 100 : 0;
    $('progress-fill').style.width = pct + '%';
    $('swipe-counter').textContent = `${cursor} / ${deck.length}`;
  }

  // ── Card stack ───────────────────────────────────────────
  const stack = $('card-stack');

  function rebuildStack() {
    stack.innerHTML = '';

    if (cursor >= deck.length) {
      stack.innerHTML = `
        <div class="deck-done">
          <div class="big-icon">🎮</div>
          <p>All done! Ready to see your profile?</p>
          <button class="btn btn-primary" id="btn-see-results"
                  style="width:auto;padding:10px 24px;margin-top:8px;">See Results</button>
        </div>`;
      $('btn-see-results').onclick = showResults;
      return;
    }

    // Append back cards first, front card last.
    // Front card ends up as lastElementChild with the highest z-index.
    const count = Math.min(3, deck.length - cursor);
    for (let offset = count - 1; offset >= 0; offset--) {
      const card = makeCard(deck[cursor + offset]);
      // All positioning done inline — no CSS nth-child dependency
      card.style.cssText += `
        position: absolute;
        top: 0; left: 0;
        width: 100%; height: 100%;
        z-index: ${10 - offset};
      `;
      if (offset > 0) {
        card.style.transform  = `scale(${1 - offset * 0.04}) translateY(${offset * 14}px)`;
        card.style.pointerEvents = 'none';
      }
      stack.appendChild(card);
    }

    attachSwipe(stack.lastElementChild);
  }

  function makeCard(game) {
    const dom = dominantOf(game);
    const cheat = { micro: 'bot / aimbot', meso: 'wallhack / comms', macro: 'coach / solver', mixed: 'many methods' };
    const el = document.createElement('div');
    el.className = 'game-card';
    el.innerHTML = `
      <div class="card-wash"></div>
      <span class="game-card-dom ${dom.cls}">${dom.label}</span>
      <span class="game-card-name">${game.name}</span>
      <div class="card-bars">
        ${mkBar('micro', game.micro)}
        ${mkBar('meso',  game.meso)}
        ${mkBar('macro', game.macro)}
      </div>
      <p class="card-cheat">Cheat = ${cheat[dom.cls]}</p>
    `;
    return el;
  }

  function mkBar(cat, val) {
    return `<div class="card-bar-row">
      <span class="card-bar-label ${cat}">${cat}</span>
      <div class="card-bar-track"><div class="card-bar-fill ${cat}" style="width:${val * 10}%"></div></div>
      <span class="card-bar-num">${val}</span>
    </div>`;
  }

  function dominantOf(game) {
    const max = Math.max(game.micro, game.meso, game.macro);
    if (game.micro === max && game.micro > game.meso && game.micro > game.macro) return { label: 'Micro', cls: 'micro' };
    if (game.meso  === max && game.meso  > game.micro && game.meso  > game.macro) return { label: 'Meso',  cls: 'meso'  };
    if (game.macro === max && game.macro > game.micro && game.macro > game.meso)  return { label: 'Macro', cls: 'macro' };
    return { label: 'Mixed', cls: 'mixed' };
  }

  // ── Commit swipe / vote ──────────────────────────────────
  function castVote(card, action) {
    if (swiping) return;
    swiping = true;

    const [dx, dy] = ACTION_DIR[action];
    flyOut(card, dx, dy, () => {
      votes.push({ game: deck[cursor], action });
      cursor++;
      swiping = false;
      updateProgress();
      rebuildStack();
    });
  }

  function flyOut(card, dx, dy, done) {
    // Determine off-screen target
    const ax = Math.abs(dx), ay = Math.abs(dy);
    let tx, ty;
    if (ax >= ay) {
      tx = dx >= 0 ? 900 : -900;
      ty = ax > 0 ? dy * (900 / ax) : 0;
    } else {
      ty = dy >= 0 ? 900 : -900;
      tx = ay > 0 ? dx * (900 / ay) : 0;
    }

    // Apply transition then set new values.
    // Force a reflow between the two so the browser treats them as separate frames,
    // allowing the CSS transition to actually animate.
    card.style.transition = 'transform 0.35s ease-in, opacity 0.35s ease-in';
    void card.offsetWidth; // reflow
    card.style.transform = `translate(${tx}px,${ty}px) rotate(${(tx * 0.04).toFixed(1)}deg)`;
    card.style.opacity = '0';

    // transitionend fires when animation completes; timeout is a fallback.
    let finished = false;
    const finish = () => { if (!finished) { finished = true; done(); } };
    card.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 500);
  }

  // ── Swipe gesture ────────────────────────────────────────
  function attachSwipe(card) {
    if (!card) return;
    card.style.cursor = 'grab';
    card.style.touchAction = 'none';

    const wash = card.querySelector('.card-wash');
    const THRESHOLD = 85;
    let ox = 0, oy = 0, dragging = false;

    const WASH = {
      right: 'rgba(92,224,122,0.28)', left: 'rgba(224,92,92,0.28)',
      up:    'rgba(92,184,224,0.28)', down: 'rgba(124,128,152,0.22)',
    };

    card.addEventListener('pointerdown', e => {
      if (swiping) return;
      dragging = true;
      ox = e.clientX;
      oy = e.clientY;
      card.setPointerCapture(e.pointerId);
    });

    card.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - ox, dy = e.clientY - oy;
      card.style.transform = `translate(${dx}px,${dy}px) rotate(${(dx * 0.06).toFixed(1)}deg)`;

      const ax = Math.abs(dx), ay = Math.abs(dy);
      let dir = null;
      if (ax > 25 || ay > 25) dir = ax > ay ? (dx > 0 ? 'right' : 'left') : (dy < 0 ? 'up' : 'down');

      setHint(dir);
      if (wash) { wash.style.background = dir ? WASH[dir] : ''; wash.style.opacity = dir ? '1' : '0'; }
    });

    card.addEventListener('pointerup', e => {
      if (!dragging) return;
      dragging = false;
      const dx = e.clientX - ox, dy = e.clientY - oy;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      setHint(null);
      if (wash) wash.style.opacity = '0';

      let dir = null;
      if (ax > ay && ax > THRESHOLD) dir = dx > 0 ? 'right' : 'left';
      else if (ay > ax && ay > THRESHOLD) dir = dy < 0 ? 'up' : 'down';

      if (dir) {
        castVote(card, SWIPE_MAP[dir]);
      } else {
        card.style.transition = 'transform 0.35s cubic-bezier(.25,.46,.45,.94)';
        card.style.transform = '';
        card.addEventListener('transitionend', () => { card.style.transition = ''; }, { once: true });
      }
    });
  }

  function setHint(dir) {
    document.querySelectorAll('.hint').forEach(h => h.style.opacity = '0');
    if (dir) { const h = document.querySelector(`.hint-${dir}`); if (h) h.style.opacity = '1'; }
  }

  // ── Action buttons ───────────────────────────────────────
  document.querySelectorAll('.action-btn[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (swiping || cursor >= deck.length) return;
      const front = stack.lastElementChild;
      if (!front || front.classList.contains('deck-done')) return;
      castVote(front, btn.dataset.action);

      btn.classList.remove('voted');
      void btn.offsetWidth;
      btn.classList.add('voted');
      setTimeout(() => btn.classList.remove('voted'), 300);
    });
  });

  // ── Keyboard ────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (!screens.select.classList.contains('active') || swiping || cursor >= deck.length) return;
    const map = { ArrowRight: 'often', ArrowLeft: 'dislike', ArrowUp: 'would', ArrowDown: 'eh' };
    const action = map[e.key];
    if (!action) return;
    e.preventDefault();
    const front = stack.lastElementChild;
    if (front && !front.classList.contains('deck-done')) castVote(front, action);
  });

  // ── Results ─────────────────────────────────────────────
  $('btn-skip-to-results').addEventListener('click', showResults);

  function showResults() {
    showScreen('results');
    const liked = votes.filter(v => RESPONSE[v.action].weight > 0);
    const selectedGames = liked.map(v => ({ game: v.game, frequency: RESPONSE[v.action].weight }));
    VENN.render($('venn-svg'), selectedGames);
    renderBreakdown(selectedGames, votes);
  }

  function renderBreakdown(selectedGames, allVotes) {
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
    const positiveVotes = allVotes.filter(v => RESPONSE[v.action].weight > 0);

    $('breakdown').innerHTML = `
      <div class="profile-title">${profile.title}</div>
      <p class="profile-desc">${profile.desc}</p>
      <div class="pct-bars">
        ${['micro','meso','macro'].map(cat => `
          <div class="pct-row">
            <span class="pct-label ${cat}">${cat}</span>
            <div class="pct-bar-track"><div class="pct-bar ${cat}" style="width:${pct[cat]}%"></div></div>
            <span class="pct-num">${pct[cat]}%</span>
          </div>`).join('')}
      </div>
      ${positiveVotes.length > 0 ? `
        <div class="game-breakdown">
          <h4>Games you liked</h4>
          ${positiveVotes.map(v => `
            <div class="game-row">
              <span class="gr-name">${v.game.name}</span>
              <span class="gr-vote" style="color:${RESPONSE[v.action].color}">${RESPONSE[v.action].label}</span>
              <span class="gr-bars">
                <span class="gr-bar micro" style="width:${v.game.micro * 8}px"></span>
                <span class="gr-bar meso"  style="width:${v.game.meso  * 8}px"></span>
                <span class="gr-bar macro" style="width:${v.game.macro * 8}px"></span>
              </span>
            </div>`).join('')}
        </div>` : `<p style="color:var(--muted);font-size:0.85rem;">No games liked — swipe right or ⭐ on some next time!</p>`}
    `;
  }

  function buildProfile({ micro, meso, macro }) {
    const t = 38;
    const mi = micro >= t, me = meso >= t, ma = macro >= t;
    if (mi && me && ma) return { title: 'The Complete Player', desc: 'You thrive across all dimensions — mechanics, social reads, and strategic thinking. The rarest breed.' };
    if (mi && me)       return { title: 'The Duelist',         desc: 'Outplaying opponents mechanically while reading their intentions. The battlefield is your stage.' };
    if (mi && ma)       return { title: 'The Optimizer',       desc: 'Flawless execution meets long-term planning. You run the math and then execute it perfectly.' };
    if (me && ma)       return { title: 'The Strategist',      desc: 'Read the room, plan ten steps ahead. Information is power and you know how to use it.' };
    if (mi)             return { title: 'The Technician',      desc: "Pure mechanical mastery. You practice until it's perfect, then you practice more." };
    if (me)             return { title: 'The Mind Reader',     desc: "You win by understanding people — their patterns, their tells, their teams." };
    if (ma)             return { title: 'The Architect',       desc: 'You see the game at 30,000 feet. Resource management, meta, long-term positioning.' };
    return                     { title: 'The Balanced Player', desc: 'A healthy mix across all three pillars. You adapt to whatever the game demands.' };
  }

  // ── Navigation ───────────────────────────────────────────
  $('btn-start').addEventListener('click', () => { initDeck(); showScreen('select'); });

  $('btn-demo').addEventListener('click', () => {
    votes = GAMES.map((game, i) => ({ game, action: DEFAULT_VOTES[i] }));
    cursor = GAMES.length;
    showResults();
  });
  $('btn-restart').addEventListener('click', () => showScreen('intro'));
  $('btn-share-info').addEventListener('click', () => {
    const title = $('breakdown').querySelector('.profile-title')?.textContent || 'My Gamer Profile';
    const text = `My gamer profile: ${title} — find yours at MicroMesoMacro!`;
    if (navigator.share) { navigator.share({ title: 'MicroMesoMacro', text }); }
    else {
      navigator.clipboard?.writeText(text);
      const btn = $('btn-share-info');
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Share Profile', 2000);
    }
  });
})();
