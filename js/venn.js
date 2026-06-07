// Draws the Venn diagram and places game bubbles using barycentric positioning.
// The three circle centers form an equilateral triangle; a game's position =
// weighted average of the three centers by its micro/meso/macro scores.

const VENN = (() => {
  const W = 600, H = 520;
  const R = 145; // circle radius

  // Circle centers — equilateral triangle layout
  // Micro = bottom-left, Meso = top, Macro = bottom-right
  const CENTERS = {
    micro: { x: W * 0.28, y: H * 0.68 },
    meso:  { x: W * 0.50, y: H * 0.20 },
    macro: { x: W * 0.72, y: H * 0.68 },
  };

  const COLORS = {
    micro: '#e05c5c',
    meso:  '#5cb8e0',
    macro: '#5ce07a',
  };

  function gamePosition(game) {
    const total = game.micro + game.meso + game.macro || 1;
    return {
      x: (game.micro * CENTERS.micro.x + game.meso * CENTERS.meso.x + game.macro * CENTERS.macro.x) / total,
      y: (game.micro * CENTERS.micro.y + game.meso * CENTERS.meso.y + game.macro * CENTERS.macro.y) / total,
    };
  }

  function dominantColor(game) {
    const max = Math.max(game.micro, game.meso, game.macro);
    if (game.micro === max) return COLORS.micro;
    if (game.meso === max) return COLORS.meso;
    return COLORS.macro;
  }

  function render(svgEl, selectedGames) {
    svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svgEl.innerHTML = '';

    const ns = 'http://www.w3.org/2000/svg';
    const mk = (tag, attrs) => {
      const el = document.createElementNS(ns, tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      return el;
    };

    // Background
    svgEl.appendChild(mk('rect', { x: 0, y: 0, width: W, height: H, fill: '#0f1117', rx: 12 }));

    // Circles
    const circleOrder = ['micro', 'meso', 'macro'];
    circleOrder.forEach(cat => {
      const c = CENTERS[cat];
      svgEl.appendChild(mk('circle', {
        cx: c.x, cy: c.y, r: R,
        fill: COLORS[cat],
        'fill-opacity': '0.12',
        stroke: COLORS[cat],
        'stroke-width': '2',
        'stroke-opacity': '0.7',
      }));
    });

    // Circle labels
    const labelOffsets = {
      micro: { dx: -R - 10, dy: 20 },
      meso:  { dx: 0,       dy: -R - 14 },
      macro: { dx: R + 10,  dy: 20 },
    };
    circleOrder.forEach(cat => {
      const c = CENTERS[cat];
      const off = labelOffsets[cat];
      const label = mk('text', {
        x: c.x + off.dx,
        y: c.y + off.dy,
        'text-anchor': 'middle',
        fill: COLORS[cat],
        'font-size': '15',
        'font-weight': 'bold',
        'font-family': 'system-ui, sans-serif',
        'letter-spacing': '1',
      });
      label.textContent = cat.toUpperCase();
      svgEl.appendChild(label);
    });

    // Game bubbles
    selectedGames.forEach(sg => {
      const pos = gamePosition(sg.game);
      const freq = sg.frequency; // 1-5
      const bubbleR = 7 + freq * 3;

      const group = mk('g', { class: 'game-bubble' });

      const circle = mk('circle', {
        cx: pos.x,
        cy: pos.y,
        r: bubbleR,
        fill: dominantColor(sg.game),
        'fill-opacity': '0.85',
        stroke: '#fff',
        'stroke-width': '1',
        'stroke-opacity': '0.4',
        style: 'cursor:pointer',
      });

      // Tooltip via <title>
      const title = document.createElementNS(ns, 'title');
      title.textContent = `${sg.game.name}\nMicro ${sg.game.micro} · Meso ${sg.game.meso} · Macro ${sg.game.macro}`;
      circle.appendChild(title);

      group.appendChild(circle);
      svgEl.appendChild(group);
    });

    // Summary bar at bottom
    if (selectedGames.length > 0) {
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

      const barY = H - 36;
      const barX = 40;
      const barW = W - 80;

      svgEl.appendChild(mk('rect', { x: barX, y: barY, width: barW, height: 14, fill: '#1e2130', rx: 7 }));

      let cursor = barX;
      ['micro', 'meso', 'macro'].forEach(cat => {
        const segW = barW * pct[cat] / 100;
        if (segW > 0) {
          svgEl.appendChild(mk('rect', {
            x: cursor, y: barY, width: segW, height: 14,
            fill: COLORS[cat], rx: cursor === barX ? 7 : 0,
          }));
        }
        cursor += segW;
      });

      // Percentage labels
      const labelY = barY - 6;
      cursor = barX;
      ['micro', 'meso', 'macro'].forEach(cat => {
        const segW = barW * pct[cat] / 100;
        if (pct[cat] > 5) {
          const txt = mk('text', {
            x: cursor + segW / 2,
            y: labelY,
            'text-anchor': 'middle',
            fill: COLORS[cat],
            'font-size': '11',
            'font-family': 'system-ui, sans-serif',
          });
          txt.textContent = `${pct[cat]}%`;
          svgEl.appendChild(txt);
        }
        cursor += segW;
      });
    }
  }

  return { render };
})();
