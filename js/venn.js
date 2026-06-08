const VENN = (() => {
  const W = 600, H = 510;
  const R = 148;

  // Circle centers — triangle with ~175px sides, so all three overlap significantly
  const C = {
    micro: [210, 320],
    meso:  [300, 168],
    macro: [390, 320],
  };

  const COL = { micro: '#e05c5c', meso: '#5cb8e0', macro: '#5ce07a' };

  // Colors for the 3 pairwise overlaps and the center (all-three)
  const ICOL = {
    micro_meso:  '#b060d8',  // purple
    micro_macro: '#e08a30',  // orange
    meso_macro:  '#30c8b0',  // teal
    all:         '#f0e060',  // yellow
  };

  function toRgba(hex, a) {
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

  // Fill only the area that is INSIDE every circle in `inside`
  // and OUTSIDE every circle in `outside`.
  // Uses canvas save/restore so clips don't leak.
  function fillRegion(ctx, color, inside, outside) {
    ctx.save();

    // Positive clips: intersect down to inside each listed circle
    inside.forEach(([cx, cy]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();
    });

    // Negative clips: cut away each listed circle using even-odd rule
    // (a full-canvas rect plus the circle path, clipped evenodd = everything outside the circle)
    outside.forEach(([cx, cy]) => {
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip('evenodd');
    });

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function render(canvasEl, selectedGames) {
    canvasEl.width  = W;
    canvasEl.height = H;
    const ctx = canvasEl.getContext('2d');

    const [mi, me, ma] = [C.micro, C.meso, C.macro];
    const OP = 0.55;

    // ── Background ──
    ctx.fillStyle = '#0f1117';
    ctx.fillRect(0, 0, W, H);

    // ── 7 Venn regions ──
    fillRegion(ctx, toRgba(COL.micro,        OP), [mi],       [me, ma]);
    fillRegion(ctx, toRgba(COL.meso,         OP), [me],       [mi, ma]);
    fillRegion(ctx, toRgba(COL.macro,        OP), [ma],       [mi, me]);
    fillRegion(ctx, toRgba(ICOL.micro_meso,  OP), [mi, me],   [ma]    );
    fillRegion(ctx, toRgba(ICOL.micro_macro, OP), [mi, ma],   [me]    );
    fillRegion(ctx, toRgba(ICOL.meso_macro,  OP), [me, ma],   [mi]    );
    fillRegion(ctx, toRgba(ICOL.all,         OP), [mi, me, ma], []    );

    // ── Circle outlines ──
    [[COL.micro, mi], [COL.meso, me], [COL.macro, ma]].forEach(([col, [cx, cy]]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.85;
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    // ── Category labels ──
    ctx.font = 'bold 14px system-ui, sans-serif';

    ctx.fillStyle = COL.micro;
    ctx.textAlign = 'right';
    ctx.fillText('MICRO', C.micro[0] - R - 8, C.micro[1] + 5);

    ctx.fillStyle = COL.meso;
    ctx.textAlign = 'center';
    ctx.fillText('MESO', C.meso[0], C.meso[1] - R - 10);

    ctx.fillStyle = COL.macro;
    ctx.textAlign = 'left';
    ctx.fillText('MACRO', C.macro[0] + R + 8, C.macro[1] + 5);

    // ── Game bubbles ──
    selectedGames.forEach(sg => {
      const pos = gamePos(sg.game);
      const r   = 6 + sg.frequency * 2.5;

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = dominantColor(sg.game);
      ctx.globalAlpha = 0.9;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // ── Summary bar ──
    if (selectedGames.length > 0) {
      const tot = { micro: 0, meso: 0, macro: 0 };
      selectedGames.forEach(sg => {
        const g = thresh(sg.game);
        tot.micro += g.micro * sg.frequency;
        tot.meso  += g.meso  * sg.frequency;
        tot.macro += g.macro * sg.frequency;
      });
      const sum = tot.micro + tot.meso + tot.macro || 1;
      const pct = { micro: tot.micro / sum, meso: tot.meso / sum, macro: tot.macro / sum };

      const barY = H - 26, barX = 36, barW = W - 72, barH = 12;

      ctx.fillStyle = '#1e2130';
      ctx.fillRect(barX, barY, barW, barH);

      let cur = barX;
      ['micro', 'meso', 'macro'].forEach(cat => {
        const segW = barW * pct[cat];
        if (segW > 1) {
          ctx.fillStyle = COL[cat];
          ctx.fillRect(cur, barY, segW, barH);

          if (pct[cat] > 0.07) {
            ctx.fillStyle = COL[cat];
            ctx.font = '11px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${Math.round(pct[cat] * 100)}%`, cur + segW / 2, barY - 5);
          }
        }
        cur += segW;
      });
    }
  }

  return { render };
})();
