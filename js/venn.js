const VENN = (() => {
  const W = 600, H = 510;
  const R = 148;

  // Centers pulled close together so all three circles significantly overlap.
  // Distance between any two centers ≈ 175px < 2R = 296px → large lens regions.
  const CX = { micro: 210, meso: 300, macro: 390 };
  const CY = { micro: 320, meso: 168, macro: 320 };

  // Category colors
  const COL = { micro: '#e05c5c', meso: '#5cb8e0', macro: '#5ce07a' };

  // Intersection region colors (pairs + all-three)
  const ICOL = {
    micro_meso:  '#b060d8',   // purple
    micro_macro: '#e08a30',   // orange
    meso_macro:  '#30c8b0',   // teal
    all:         '#f0e878',   // yellow-white
  };

  function gamePos(game) {
    const t = game.micro + game.meso + game.macro || 1;
    return {
      x: (game.micro * CX.micro + game.meso * CX.meso + game.macro * CX.macro) / t,
      y: (game.micro * CY.micro + game.meso * CY.meso + game.macro * CY.macro) / t,
    };
  }

  function dominantColor(game) {
    const max = Math.max(game.micro, game.meso, game.macro);
    if (game.micro === max) return COL.micro;
    if (game.meso  === max) return COL.meso;
    return COL.macro;
  }

  function render(svgEl, selectedGames) {
    svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svgEl.innerHTML = '';

    const ns = 'http://www.w3.org/2000/svg';
    const mk = (tag, attrs) => {
      const el = document.createElementNS(ns, tag);
      Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
      return el;
    };

    // ── Background ──
    svgEl.appendChild(mk('rect', { x:0, y:0, width:W, height:H, fill:'#0f1117', rx:12 }));

    // ── Defs: per-circle positive mask (inside) and negative mask (outside) ──
    const defs = mk('defs');
    const circles = [
      ['micro', CX.micro, CY.micro],
      ['meso',  CX.meso,  CY.meso ],
      ['macro', CX.macro, CY.macro],
    ];

    circles.forEach(([cat, cx, cy]) => {
      // Positive mask → white circle = "show only inside this circle"
      const pos = mk('mask', { id: `vp-${cat}` });
      pos.appendChild(mk('circle', { cx, cy, r: R, fill: 'white' }));
      defs.appendChild(pos);

      // Negative mask → white rect minus black circle = "show only OUTSIDE this circle"
      const neg = mk('mask', { id: `vn-${cat}` });
      neg.appendChild(mk('rect', { x:0, y:0, width:W, height:H, fill:'white' }));
      neg.appendChild(mk('circle', { cx, cy, r: R, fill:'black' }));
      defs.appendChild(neg);
    });

    svgEl.appendChild(defs);

    // ── Region painter ──
    // Applies a chain of masks from outermost to innermost.
    // Each mask clips the result of all inner masks.
    // e.g. region('#red', 0.25, 'vp-micro', 'vn-meso', 'vn-macro')
    //   → draws red only where: inside-micro AND outside-meso AND outside-macro
    function region(fill, opacity, ...maskIds) {
      let el = mk('rect', { x:0, y:0, width:W, height:H, fill, 'fill-opacity': String(opacity) });
      for (let i = maskIds.length - 1; i >= 0; i--) {
        const g = mk('g', { mask: `url(#${maskIds[i]})` });
        g.appendChild(el);
        el = g;
      }
      svgEl.appendChild(el);
    }

    const OP = 0.30;

    // 7 Venn regions
    region(COL.micro,        OP, 'vp-micro', 'vn-meso',  'vn-macro');  // only micro
    region(COL.meso,         OP, 'vp-meso',  'vn-micro', 'vn-macro');  // only meso
    region(COL.macro,        OP, 'vp-macro', 'vn-micro', 'vn-meso' );  // only macro
    region(ICOL.micro_meso,  OP, 'vp-micro', 'vp-meso',  'vn-macro');  // micro ∩ meso
    region(ICOL.micro_macro, OP, 'vp-micro', 'vp-macro', 'vn-meso' );  // micro ∩ macro
    region(ICOL.meso_macro,  OP, 'vp-meso',  'vp-macro', 'vn-micro');  // meso ∩ macro
    region(ICOL.all,         OP, 'vp-micro', 'vp-meso',  'vp-macro');  // all three

    // ── Circle outlines ──
    circles.forEach(([cat, cx, cy]) => {
      svgEl.appendChild(mk('circle', {
        cx, cy, r: R,
        fill: 'none',
        stroke: COL[cat],
        'stroke-width': '2.5',
        'stroke-opacity': '0.8',
      }));
    });

    // ── Category labels ──
    const labelPos = {
      micro: { x: CX.micro - R - 8, y: CY.micro + 6,    anchor: 'end'    },
      meso:  { x: CX.meso,          y: CY.meso  - R - 10, anchor: 'middle' },
      macro: { x: CX.macro + R + 8, y: CY.macro + 6,    anchor: 'start'  },
    };
    circles.forEach(([cat]) => {
      const { x, y, anchor } = labelPos[cat];
      const t = mk('text', {
        x, y, 'text-anchor': anchor,
        fill: COL[cat],
        'font-size': '14',
        'font-weight': 'bold',
        'font-family': 'system-ui, sans-serif',
        'letter-spacing': '1',
      });
      t.textContent = cat.toUpperCase();
      svgEl.appendChild(t);
    });

    // ── Intersection labels (small, inside each region) ──
    // Only shown when there are no bubbles, as a guide
    if (selectedGames.length === 0) {
      const hints = [
        { x: (CX.micro + CX.meso) / 2 - 10,  y: (CY.micro + CY.meso) / 2,      text: 'Duelist',    col: ICOL.micro_meso  },
        { x: (CX.micro + CX.macro) / 2,       y: (CY.micro + CY.macro) / 2 + 14, text: 'Optimizer',  col: ICOL.micro_macro },
        { x: (CX.meso  + CX.macro) / 2 + 10,  y: (CY.meso  + CY.macro) / 2,      text: 'Strategist', col: ICOL.meso_macro  },
        { x: (CX.micro + CX.meso + CX.macro) / 3, y: (CY.micro + CY.meso + CY.macro) / 3 + 5, text: 'Complete', col: ICOL.all },
      ];
      hints.forEach(({ x, y, text, col }) => {
        const t = mk('text', {
          x, y,
          'text-anchor': 'middle',
          fill: col,
          'font-size': '9',
          'font-weight': 'bold',
          'font-family': 'system-ui, sans-serif',
          opacity: '0.7',
        });
        t.textContent = text;
        svgEl.appendChild(t);
      });
    }

    // ── Game bubbles (barycentric positioning) ──
    selectedGames.forEach(sg => {
      const pos  = gamePos(sg.game);
      const r    = 6 + sg.frequency * 2.5;
      const col  = dominantColor(sg.game);

      const circle = mk('circle', {
        cx: pos.x, cy: pos.y, r,
        fill: col,
        'fill-opacity': '0.88',
        stroke: '#fff',
        'stroke-width': '1',
        'stroke-opacity': '0.5',
        style: 'cursor:pointer',
      });
      const title = document.createElementNS(ns, 'title');
      title.textContent = `${sg.game.name}\nMicro ${sg.game.micro} · Meso ${sg.game.meso} · Macro ${sg.game.macro}`;
      circle.appendChild(title);
      svgEl.appendChild(circle);
    });

    // ── Summary bar ──
    if (selectedGames.length > 0) {
      const tot = { micro: 0, meso: 0, macro: 0 };
      selectedGames.forEach(sg => {
        tot.micro += sg.game.micro * sg.frequency;
        tot.meso  += sg.game.meso  * sg.frequency;
        tot.macro += sg.game.macro * sg.frequency;
      });
      const sum = tot.micro + tot.meso + tot.macro || 1;
      const pct = { micro: tot.micro / sum, meso: tot.meso / sum, macro: tot.macro / sum };

      const barY = H - 28, barX = 36, barW = W - 72;
      svgEl.appendChild(mk('rect', { x:barX, y:barY, width:barW, height:12, fill:'#1e2130', rx:6 }));

      let cur = barX;
      ['micro', 'meso', 'macro'].forEach(cat => {
        const segW = barW * pct[cat];
        if (segW > 1) {
          svgEl.appendChild(mk('rect', {
            x: cur, y: barY, width: segW, height: 12,
            fill: COL[cat], rx: cur === barX ? 6 : 0,
          }));
          if (pct[cat] > 0.07) {
            const t = mk('text', {
              x: cur + segW / 2, y: barY - 5,
              'text-anchor': 'middle',
              fill: COL[cat],
              'font-size': '11',
              'font-family': 'system-ui, sans-serif',
            });
            t.textContent = `${Math.round(pct[cat] * 100)}%`;
            svgEl.appendChild(t);
          }
        }
        cur += segW;
      });
    }
  }

  return { render };
})();
