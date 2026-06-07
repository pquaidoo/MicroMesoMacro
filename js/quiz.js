(() => {
  // Response definitions: weight drives how much this game counts in the final profile
  const RESPONSE = {
    often:   { label: 'Play Often',    weight: 5, color: '#5ce07a', wash: 'rgba(92,224,122,0.25)'  },
    would:   { label: 'Would Like',    weight: 2, color: '#5cb8e0', wash: 'rgba(92,184,224,0.25)'  },
    eh:      { label: 'Eh',            weight: 0, color: '#7c8098', wash: 'rgba(124,128,152,0.18)' },
    wouldnt: { label: "Wouldn't Like", weight: 0, color: '#e09a5c', wash: 'rgba(224,154,92,0.2)'   },
    dislike: { label: 'Dislike',       weight: 0, color: '#e05c5c', wash: 'rgba(224,92,92,0.25)'   },
  };

  // Swipe direction → action mapping
  const SWIPE_MAP = { right: 'often', up: 'would', down: 'eh', left: 'dislike' };

  // State
  let deck = [];        // shuffled GAMES copy
  let cursor = 0;       // index of current top card
  let votes = [];       // [{ game, action }]

  // DOM refs
  const screens      = {
    intro:   document.getElementById('screen-intro'),
    select:  document.getElementById('screen-select'),
    results: document.getElementById('screen-results'),
  };
  const cardStack    = document.getElementById('card-stack');
  const progressFill = document.getElementById('progress-fill');
  const swipeCounter = document.getElementById('swipe-counter');
  const vennSvg      = document.getElementById('venn-svg');
  const breakdownEl  = document.getElementById('breakdown');

  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  // ── Init deck ──
  function initDeck() {
    // Shuffle GAMES
    deck = [...GAMES].sort(() => Math.random() - 0.5);
    cursor = 0;
    votes = [];
    renderStack();
    updateProgress();
  }

  // ── Render top 3 cards in the stack ──
  function renderStack() {
    cardStack.innerHTML = '';

    if (cursor >= deck.length) {
      // All cards swiped
      cardStack.innerHTML = `
        <div class="deck-done">
          <span class="big-icon">🎮</span>
          <p>All done! Ready to see your profile?</p>
          <button class="btn btn-primary" id="btn-done-inline" style="width:auto;padding:10px 24px;margin-top:8px;">
            See Results
          </button>
        </div>`;
      document.getElementById('btn-done-inline').addEventListener('click', showResults);
      return;
    }

    for (let i = Math.min(cursor + 2, deck.length - 1); i >= cursor; i--) {
      const wrap = buildCardWrap(deck[i], i === cursor);
      cardStack.prepend(wrap);
    }

    // Attach swipe to the new front card
    attachSwipe(cardStack.firstElementChild);
  }

  function buildCardWrap(game, isFront) {
    const dom = dominantInfo(game);
    const cheats = {
      micro: 'bot / aimbot',
      meso:  'wallhack / comms',
      macro: 'coach / solver',
      mixed: 'depends on the layer',
    };

    const wrap = document.createElement('div');
    wrap.className = 'game-card-wrap';

    wrap.innerHTML = `
      <div class="game-card">
        <div class="card-wash"></div>
        <span class="game-card-dom ${dom.cls}">${dom.label}</span>
        <span class="game-card-name">${game.name}</span>
        <div class="card-bars">
          ${bar('micro', game.micro)}
          ${bar('meso',  game.meso)}
          ${bar('macro', game.macro)}
        </div>
        <p class="card-cheat">Cheat = ${cheats[dom.cls]}</p>
      </div>
    `;
    return wrap;
  }

  function bar(cat, val) {
    return `
      <div class="card-bar-row">
        <span class="card-bar-label ${cat}">${cat}</span>
        <div class="card-bar-track">
          <div class="card-bar-fill ${cat}" style="width:${val * 10}%"></div>
        </div>
        <span class="card-bar-num">${val}</span>
      </div>`;
  }

  function dominantInfo(game) {
    const max = Math.max(game.micro, game.meso, game.macro);
    if (game.micro === max && game.micro > game.meso && game.micro > game.macro)
      return { label: 'Micro', cls: 'micro' };
    if (game.meso === max && game.meso > game.micro && game.meso > game.macro)
      return { label: 'Meso', cls: 'meso' };
    if (game.macro === max && game.macro > game.micro && game.macro > game.meso)
      return { label: 'Macro', cls: 'macro' };
    return { label: 'Mixed', cls: 'mixed' };
  }

  // ── Progress ──
  function updateProgress() {
    const pct = deck.length ? (cursor / deck.length) * 100 : 0;
    progressFill.style.width = pct + '%';
    swipeCounter.textContent = `${cursor} / ${deck.length}`;
  }

  // ── Commit a vote ──
  function castVote(action) {
    if (cursor >= deck.length) return;
    votes.push({ game: deck[cursor], action });
    cursor++;
    updateProgress();
    renderStack();
    // Pulse the action button
    const btn = document.querySelector(`.action-btn.${action}`);
    if (btn) {
      btn.classList.remove('voted');
      void btn.offsetWidth; // reflow to restart animation
      btn.classList.add('voted');
      setTimeout(() => btn.classList.remove('voted'), 300);
    }
  }

  // ── Swipe gesture (pointer events — works for mouse + touch) ──
  function attachSwipe(wrap) {
    if (!wrap) return;
    const card = wrap.querySelector('.game-card');
    const wash = wrap.querySelector('.card-wash');
    const THRESHOLD = 90; // px to commit

    let startX = 0, startY = 0, dragging = false;

    // Show/hide directional hint labels
    function setHint(dir) {
      document.querySelectorAll('.hint').forEach(h => h.style.opacity = '0');
      if (dir) {
        const el = document.querySelector(`.hint-${dir}`);
        if (el) el.style.opacity = '1';
      }
    }

    function applyWash(action) {
      if (!action) { wash.style.opacity = '0'; wash.style.background = ''; return; }
      wash.style.background = RESPONSE[action].wash;
      wash.style.opacity = '1';
    }

    wrap.addEventListener('pointerdown', e => {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      wrap.setPointerCapture(e.pointerId);
      wrap.style.transition = 'none';
    });

    wrap.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const rotate = dx * 0.07;
      wrap.style.transform = `translate(${dx}px, ${dy}px) rotate(${rotate}deg)`;

      // Dominant axis
      const adx = Math.abs(dx), ady = Math.abs(dy);
      let dir = null;
      if (adx > 20 || ady > 20) {
        if (adx > ady) dir = dx > 0 ? 'right' : 'left';
        else            dir = dy < 0 ? 'up'    : 'down';
      }
      setHint(dir);
      applyWash(dir ? SWIPE_MAP[dir] : null);
    });

    wrap.addEventListener('pointerup', e => {
      if (!dragging) return;
      dragging = false;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      setHint(null);
      applyWash(null);

      let dir = null;
      if (adx > ady && adx > THRESHOLD) dir = dx > 0 ? 'right' : 'left';
      else if (ady > adx && ady > THRESHOLD) dir = dy < 0 ? 'up' : 'down';

      if (dir) {
        flyOut(wrap, dx, dy, () => castVote(SWIPE_MAP[dir]));
      } else {
        // Spring back
        wrap.classList.add('snapping');
        wrap.style.transform = '';
        wrap.addEventListener('transitionend', () => wrap.classList.remove('snapping'), { once: true });
      }
    });
  }

  function flyOut(wrap, dx, dy, callback) {
    wrap.classList.add('flying');
    const adx = Math.abs(dx), ady = Math.abs(dy);
    let tx, ty;
    if (adx > ady) { tx = dx > 0 ? 800 : -800; ty = dy * (800 / adx); }
    else            { ty = dy > 0 ? 800 : -800; tx = dx * (800 / ady); }
    wrap.style.transform = `translate(${tx}px, ${ty}px) rotate(${tx * 0.05}deg)`;
    wrap.style.opacity = '0';
    wrap.addEventListener('transitionend', callback, { once: true });
  }

  // ── Action button row ──
  document.querySelectorAll('.action-btn[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (cursor >= deck.length) return;
      const wrap = cardStack.firstElementChild;
      if (wrap && wrap.classList.contains('game-card-wrap')) {
        flyOut(wrap, btn.dataset.action === 'dislike' ? -200 :
                     btn.dataset.action === 'often'   ?  200 : 0,
               btn.dataset.action === 'would' ? -200 :
               btn.dataset.action === 'eh'    ?  200 : 0,
               () => castVote(btn.dataset.action));
      } else {
        castVote(btn.dataset.action);
      }
    });
  });

  // ── Keyboard shortcuts ──
  document.addEventListener('keydown', e => {
    if (!screens.select.classList.contains('active')) return;
    if (cursor >= deck.length) return;
    const map = { ArrowRight: 'often', ArrowLeft: 'dislike', ArrowUp: 'would', ArrowDown: 'eh' };
    const action = map[e.key];
    if (action) {
      e.preventDefault();
      const wrap = cardStack.firstElementChild;
      const dirs = { often: [200, 0], dislike: [-200, 0], would: [0, -200], eh: [0, 200] };
      const [dx, dy] = dirs[action];
      if (wrap && wrap.classList.contains('game-card-wrap')) {
        flyOut(wrap, dx, dy, () => castVote(action));
      } else {
        castVote(action);
      }
    }
  });

  // ── Skip to results ──
  document.getElementById('btn-skip-to-results').addEventListener('click', showResults);

  // ── Results ──
  function showResults() {
    showScreen('results');
    const liked = votes.filter(v => RESPONSE[v.action].weight > 0);
    const selectedGames = liked.map(v => ({ game: v.game, frequency: RESPONSE[v.action].weight }));
    VENN.render(vennSvg, selectedGames);
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
    const gameRows = positiveVotes.map(v => `
      <div class="game-row">
        <span class="gr-name">${v.game.name}</span>
        <span class="gr-vote" style="color:${RESPONSE[v.action].color}">${RESPONSE[v.action].label}</span>
        <span class="gr-bars">
          <span class="gr-bar micro" style="width:${v.game.micro * 8}px"></span>
          <span class="gr-bar meso"  style="width:${v.game.meso  * 8}px"></span>
          <span class="gr-bar macro" style="width:${v.game.macro * 8}px"></span>
        </span>
      </div>`).join('');

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
      ${positiveVotes.length > 0
        ? `<div class="game-breakdown"><h4>Games you liked</h4>${gameRows}</div>`
        : `<p style="color:var(--muted);font-size:0.85rem;">No games liked yet — try swiping right on a few!</p>`
      }
    `;
  }

  function buildProfile(pct) {
    const { micro, meso, macro } = pct;
    const t = 38;
    const isMi = micro >= t, iMe = meso >= t, iMa = macro >= t;
    if (isMi && iMe && iMa)  return { title: 'The Complete Player',  desc: 'You thrive across all dimensions — precise mechanics, sharp social reads, and deep strategic thinking. The rarest breed.' };
    if (isMi && iMe)         return { title: 'The Duelist',          desc: 'You live in the moment — outplaying opponents mechanically while constantly reading their intentions.' };
    if (isMi && iMa)         return { title: 'The Optimizer',        desc: 'Flawless execution meets long-term planning. You run the math on optimal routes and then execute them to perfection.' };
    if (iMe && iMa)          return { title: 'The Strategist',       desc: 'You read the room and plan ten steps ahead. Information is power, and you know exactly how to use it.' };
    if (isMi)                return { title: 'The Technician',       desc: "Pure mechanical mastery. You practice until it's perfect, then you practice more. Muscle memory is your superpower." };
    if (iMe)                 return { title: 'The Mind Reader',      desc: "You win by understanding people — their patterns, their tells, their teams. The social layer is where you live." };
    if (iMa)                 return { title: 'The Architect',        desc: 'You see the game at 30,000 feet. Resource management, meta analysis, long-term positioning — the big picture is yours.' };
    return                          { title: 'The Balanced Player',  desc: 'A healthy mix across all three pillars. You adapt to whatever the game demands.' };
  }

  // ── Navigation ──
  document.getElementById('btn-start').addEventListener('click', () => {
    initDeck();
    showScreen('select');
  });

  document.getElementById('btn-restart').addEventListener('click', () => {
    showScreen('intro');
  });

  document.getElementById('btn-share-info').addEventListener('click', () => {
    const title = breakdownEl.querySelector('.profile-title')?.textContent || 'My Gamer Profile';
    const text = `My gamer profile: ${title} — find yours at MicroMesoMacro!`;
    if (navigator.share) {
      navigator.share({ title: 'MicroMesoMacro', text });
    } else {
      navigator.clipboard?.writeText(text);
      const btn = document.getElementById('btn-share-info');
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Share Profile', 2000);
    }
  });
})();
