const VENN = (() => {
  const W = 600, H = 510, R = 148;
  const NS = 'http://www.w3.org/2000/svg';

  const C = { micro: [210, 320], meso: [300, 168], macro: [390, 320] };
  const COL = { micro: '#e05c5c', meso: '#5cb8e0', macro: '#5ce07a' };
  const ICOL = {
    micro_meso:  '#b060d8',
    micro_macro: '#e08a30',
    meso_macro:  '#30c8b0',
    all:         '#f0e060',
  };
  const OP = 0.55;

  function svgEl(tag, attrs, text) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function hex2rgba(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function gamePos(game) {
    const g = thresh(game);
    const t = g.micro + g.meso + g.macro || 1;
    return {
      x: (g.micro * C.micro[0] + g.meso * C.meso[0] + g.macro * C.macro[0]) / t,
      y: (g.micro * C.micro[1] + g.meso * C.meso[1] + g.macro * C.macro[1]) / t,
    };
  }

  function dominantColor(game) {
    const max = Math.max(game.micro, game.meso, game.macro);
    if (game.micro === max) return COL.micro;
    if (game.meso  === max) return COL.meso;
    return COL.macro;
  }

  function render(svgRoot, selectedGames) {
    svgRoot.innerHTML = '';
    svgRoot.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const [mi, me, ma] = [C.micro, C.meso, C.macro];
    const defs = svgEl('defs', {});

    // ── Clip paths (one per circle) ──────────────────────────────────────────
    [['venn-c-mi', mi], ['venn-c-me', me], ['venn-c-ma', ma]].forEach(([id, [cx, cy]]) => {
      const cp = svgEl('clipPath', { id });
      cp.appendChild(svgEl('circle', { cx, cy, r: R }));
      defs.appendChild(cp);
    });

    // ── Exclusion masks ───────────────────────────────────────────────────────
    // Each mask shows everything (white rect) then blacks out the excluded circles.
    // Used for region fills AND bubble containment.
    const EXCL = {
      'me-ma': [me, ma],
      'mi-ma': [mi, ma],
      'mi-me': [mi, me],
      'ma':    [ma],
      'me':    [me],
      'mi':    [mi],
    };
    Object.entries(EXCL).forEach(([key, circles]) => {
      const mask = svgEl('mask', { id: `venn-x-${key}` });
      mask.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: 'white' }));
      circles.forEach(([cx, cy]) => {
        mask.appendChild(svgEl('circle', { cx, cy, r: R, fill: 'black' }));
      });
      defs.appendChild(mask);
    });

    svgRoot.appendChild(defs);

    // ── Background ───────────────────────────────────────────────────────────
    svgRoot.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: '#0f1117' }));

    // ── 7 Venn regions ───────────────────────────────────────────────────────
    // Wrap a colored rect in nested clip-path groups, optionally with an exclusion mask.
    function region(color, clipKeys, exclKey) {
      let inner = svgEl('rect', {
        x: 0, y: 0, width: W, height: H,
        fill: color,
        ...(exclKey ? { mask: `url(#venn-x-${exclKey})` } : {}),
      });
      for (let i = clipKeys.length - 1; i >= 0; i--) {
        const g = svgEl('g', { 'clip-path': `url(#venn-c-${clipKeys[i]})` });
        g.appendChild(inner);
        inner = g;
      }
      return inner;
    }

    svgRoot.appendChild(region(hex2rgba(COL.micro,        OP), ['mi'],           'me-ma'));
    svgRoot.appendChild(region(hex2rgba(COL.meso,         OP), ['me'],           'mi-ma'));
    svgRoot.appendChild(region(hex2rgba(COL.macro,        OP), ['ma'],           'mi-me'));
    svgRoot.appendChild(region(hex2rgba(ICOL.micro_meso,  OP), ['mi', 'me'],     'ma'));
    svgRoot.appendChild(region(hex2rgba(ICOL.micro_macro, OP), ['mi', 'ma'],     'me'));
    svgRoot.appendChild(region(hex2rgba(ICOL.meso_macro,  OP), ['me', 'ma'],     'mi'));
    svgRoot.appendChild(region(hex2rgba(ICOL.all,         OP), ['mi', 'me', 'ma'], null));

    // ── Circle outlines ───────────────────────────────────────────────────────
    [[COL.micro, mi], [COL.meso, me], [COL.macro, ma]].forEach(([col, [cx, cy]]) => {
      svgRoot.appendChild(svgEl('circle', {
        cx, cy, r: R,
        fill: 'none', stroke: col, 'stroke-width': 2.5, opacity: 0.85,
      }));
    });

    // ── Category labels ───────────────────────────────────────────────────────
    const lf = { style: 'font: bold 14px system-ui, sans-serif' };
    svgRoot.appendChild(svgEl('text', { x: C.micro[0] - R - 8, y: C.micro[1] + 5,   fill: COL.micro,  'text-anchor': 'end',    ...lf }, 'MICRO'));
    svgRoot.appendChild(svgEl('text', { x: C.meso[0],          y: C.meso[1] - R - 10, fill: COL.meso,  'text-anchor': 'middle', ...lf }, 'MESO'));
    svgRoot.appendChild(svgEl('text', { x: C.macro[0] + R + 8, y: C.macro[1] + 5,  fill: COL.macro, 'text-anchor': 'start',  ...lf }, 'MACRO'));

    // ── Game bubbles (drawn last = always on top of all regions) ─────────────
    const tooltip = document.getElementById('venn-tooltip');

    selectedGames.forEach(sg => {
      const pos  = gamePos(sg.game);
      const r    = 6 + sg.frequency * 2.5;
      const g    = thresh(sg.game);

      // Build exclusion mask key from whichever categories are absent
      const absent = [];
      if (g.micro === 0) absent.push('mi');
      if (g.meso  === 0) absent.push('me');
      if (g.macro === 0) absent.push('ma');
      const exclKey = absent.length ? absent.join('-') : null;

      const circle = svgEl('circle', {
        cx: pos.x.toFixed(1), cy: pos.y.toFixed(1), r: r.toFixed(1),
        fill: dominantColor(sg.game),
        stroke: 'white', 'stroke-width': 1, 'stroke-opacity': 0.5,
        opacity: 0.9,
        style: 'cursor: pointer',
      });

      // Wrap in a <g> with the exclusion mask so the bubble can't bleed into
      // circles it doesn't belong to, no matter how large it gets.
      const node = exclKey
        ? (() => {
            const grp = svgEl('g', { mask: `url(#venn-x-${exclKey})` });
            grp.appendChild(circle);
            return grp;
          })()
        : circle;

      if (tooltip) {
        node.addEventListener('mouseenter', e => {
          tooltip.textContent = sg.game.name;
          tooltip.classList.add('visible');
          tooltip.style.left = (e.clientX + 12) + 'px';
          tooltip.style.top  = (e.clientY - 28) + 'px';
        });
        node.addEventListener('mousemove', e => {
          tooltip.style.left = (e.clientX + 12) + 'px';
          tooltip.style.top  = (e.clientY - 28) + 'px';
        });
        node.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
      }

      svgRoot.appendChild(node);
    });

    // ── Summary bar ──────────────────────────────────────────────────────────
    if (selectedGames.length > 0) {
      const tot = { micro: 0, meso: 0, macro: 0 };
      selectedGames.forEach(sg => {
        const g = thresh(sg.game);
        tot.micro += g.micro * sg.frequency;
        tot.meso  += g.meso  * sg.frequency;
        tot.macro += g.macro * sg.frequency;
      });
      const sum  = tot.micro + tot.meso + tot.macro || 1;
      const pct  = { micro: tot.micro / sum, meso: tot.meso / sum, macro: tot.macro / sum };
      const barY = H - 26, barX = 36, barW = W - 72, barH = 12;
      const bf   = { style: 'font: 11px system-ui, sans-serif' };

      svgRoot.appendChild(svgEl('rect', { x: barX, y: barY, width: barW, height: barH, fill: '#1e2130' }));

      let cur = barX;
      ['micro', 'meso', 'macro'].forEach(cat => {
        const segW = barW * pct[cat];
        if (segW > 1) {
          svgRoot.appendChild(svgEl('rect', {
            x: cur.toFixed(1), y: barY, width: segW.toFixed(1), height: barH, fill: COL[cat],
          }));
          if (pct[cat] > 0.07) {
            svgRoot.appendChild(svgEl('text', {
              x: (cur + segW / 2).toFixed(1), y: barY - 5,
              fill: COL[cat], 'text-anchor': 'middle', ...bf,
            }, `${Math.round(pct[cat] * 100)}%`));
          }
        }
        cur += segW;
      });
    }
  }

  return { render };
})();
