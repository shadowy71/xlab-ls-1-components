(function () {
  'use strict';

  const C = window.Ch5Platform;
  const X = window.XLab;

  window.CH5_SIMS['c5t4'] = function createDemagnetizationLab(ctxDom) {
    const { stage, controls, formula, wrap, dot } = ctxDom;

    const COLS = 10, ROWS = 6;
    const seeds = [];
    for (let i = 0; i < COLS * ROWS; i++) seeds.push({ ph: Math.random() * Math.PI * 2, j: Math.random() });

    const state = {
      stage: 'A',          // 'A' isothermal magnetization | 'B' adiabatic demagnetization
      B: 1.5,              // applied field (T, illustrative)
      B0: 1.5,             // initial field for stage B
      T0: 2.0,             // initial temperature (K)
      T: 2.0,              // current temperature (K)
      isolation: 0.9,      // 0 = perfect reservoir contact, 1 = perfect isolation
      progress: 0,         // demagnetization progress 0..1 (stage B)
      playing: false,
      time: 0,
    };

    let built = false;
    let canvasObj = null;
    let ui = {};
    let banner = null;

    /* ---------- Physics (conceptual thermodynamic model) ---------- */
    // Alignment: tanh(mu B / kT) in illustrative units
    function alignment(B, T) {
      const x = 1.2 * B / Math.max(T, 0.05);
      return Math.tanh(x);
    }
    // Adiabatic: T ∝ B at constant S (ideal paramagnet). With imperfect isolation,
    // heat leaks in, so T falls less: T = T0 * [(1-iso) + iso*(B/B0)]
    function adiabaticT(B, B0, T0, iso) {
      const frac = B0 > 0 ? B / B0 : 1;
      return T0 * ((1 - iso) + iso * frac);
    }
    // Entropy (arb.): S ∝ f(T/B) — higher T/B = more disorder = higher S.
    // Illustrative: S = S0 * (T/(T+0.5*B)) + const. Used only for graph shape.
    function entropy(T, B) {
      return T / (T + 0.6 * B + 1e-9);
    }

    function currentB() {
      if (state.stage === 'A') return state.B;
      return state.B0 * (1 - 0.95 * state.progress);
    }
    function currentT() {
      if (state.stage === 'A') return state.T0; // reservoir holds T
      return adiabaticT(currentB(), state.B0, state.T0, state.isolation);
    }

    function resetSimulation() {
      state.stage = 'A'; state.B = 1.5; state.B0 = 1.5; state.T0 = 2.0;
      state.isolation = 0.9; state.progress = 0; state.playing = false; state.time = 0;
      if (ui.stageSeg) ui.stageSeg.set('A');
      if (ui.bSlider) ui.bSlider.setValue(1.5);
      if (ui.t0Slider) ui.t0Slider.setValue(2.0);
      if (ui.isoSlider) ui.isoSlider.setValue(0.9);
      if (ui.progSlider) ui.progSlider.setValue(0);
      if (ui.transport) ui.transport.setPlaying(false);
      if (dot) dot.textContent = 'Paused';
      updateReadouts(); updateBanner(); render();
    }

    function buildDOM() {
      if (built) return;
      built = true;
      stage.innerHTML = ''; controls.innerHTML = ''; formula.innerHTML = '';

      const cv = X.el('canvas', 'viz');
      cv.id = 'cv-c5t4';
      cv.setAttribute('aria-label', 'Adiabatic Demagnetization Laboratory: magnetic cooling');
      stage.append(cv);
      canvasObj = X.setupCanvas(cv);
      banner = C.buildBanner(wrap);

      ui.transport = C.buildTransport(controls, {
        onTogglePlay: () => {
          state.playing = !state.playing;
          ui.transport.setPlaying(state.playing);
          if (dot) dot.textContent = state.playing ? 'Live' : 'Paused';
        },
        onReset: resetSimulation,
        playLabel: 'Pause',
      });
      ui.transport.setPlaying(false);

      ui.stageSeg = X.buildSegmented(controls, {
        options: [
          { value: 'A', label: 'Stage A: Magnetize' },
          { value: 'B', label: 'Stage B: Demagnetize' },
        ],
        value: state.stage,
        onChange: (v) => {
          state.stage = v;
          if (v === 'B') { state.B0 = state.B; state.progress = 0; if (ui.progSlider) ui.progSlider.setValue(0); }
          updateReadouts(); updateBanner(); render();
        },
      });

      ui.bSlider = X.buildSlider(controls, {
        label: 'Applied Field B', id: 'c5t4-B', min: 0, max: 2, step: 0.05, value: state.B,
        format: (v) => v.toFixed(2) + ' T',
        onInput: (v) => { state.B = v; if (state.stage === 'A') { /* B0 follows */ } updateReadouts(); updateBanner(); render(); },
      });

      ui.t0Slider = X.buildSlider(controls, {
        label: 'Initial Temperature T₀', id: 'c5t4-T0', min: 0.5, max: 5, step: 0.1, value: state.T0,
        format: (v) => v.toFixed(1) + ' K',
        onInput: (v) => { state.T0 = v; updateReadouts(); updateBanner(); render(); },
      });

      ui.isoSlider = X.buildSlider(controls, {
        label: 'Thermal Isolation (1 = perfect)', id: 'c5t4-iso', min: 0, max: 1, step: 0.05, value: state.isolation,
        format: (v) => v.toFixed(2),
        onInput: (v) => { state.isolation = v; updateReadouts(); updateBanner(); render(); },
      });

      ui.progSlider = X.buildSlider(controls, {
        label: 'Demagnetization Progress (Stage B)', id: 'c5t4-prog', min: 0, max: 1, step: 0.02, value: state.progress,
        format: (v) => (v * 100).toFixed(0) + '%',
        onInput: (v) => { state.progress = v; updateReadouts(); updateBanner(); render(); },
      });

      C.buildActionRow(controls, [
        { id: 'stageA', label: 'Stage A preset', onClick: () => applyPreset('stageA') },
        { id: 'stageB', label: 'Stage B preset', primary: true, onClick: () => applyPreset('stageB') },
      ]);

      ui.readouts = X.buildReadouts(controls, [
        { id: 'B', label: 'Field B', primary: true },
        { id: 'T', label: 'Temperature T' },
        { id: 'align', label: 'Dipole Alignment' },
        { id: 'S', label: 'Entropy S (arb.)' },
        { id: 'stage', label: 'Stage', wide: true },
      ]);

      controls.append(X.el('div', 'ctrl-note',
        '<b>Conceptual model:</b> alignment ∝ tanh(μB/kT); adiabatic T ∝ B at constant S. <b>Magnetocaloric effect (statement only):</b> a temperature change on applying/removing B under suitable conditions — no separate magnetocaloric simulation per syllabus scope.'
      ));
    }

    function updateReadouts() {
      if (!ui.readouts) return;
      const B = currentB(), T = currentT();
      const a = alignment(B, T);
      const S = entropy(T, B);
      ui.readouts.set('B', B.toFixed(2) + ' T');
      ui.readouts.set('T', T.toFixed(2) + ' K');
      ui.readouts.set('align', a.toFixed(3));
      ui.readouts.set('S', S.toFixed(3) + ' arb.');
      ui.readouts.set('stage', state.stage === 'A'
        ? 'A: Isothermal magnetization (T ≈ const, heat → reservoir)'
        : 'B: Adiabatic demagnetization (S ≈ const, T falls as B falls)');
      formula.innerHTML =
        `<span class="formula active">⟨cosθ⟩ ≈ tanh(μB/kT) = <span class="fv">${a.toFixed(3)}</span></span>` +
        `<span class="formula">Adiabatic: T ∝ B (S = const)</span>` +
        `<span class="formula">T = <span class="fv">${T.toFixed(2)} K</span></span>`;
    }

    function updateBanner() {
      if (!banner) return;
      const B = currentB(), T = currentT();
      if (state.stage === 'A') {
        banner.set('STAGE A · ISOTHERMAL MAGNETIZATION', 'ok', `Field <b>B = ${B.toFixed(2)} T</b> aligns dipoles while the reservoir holds <b>T = ${T.toFixed(2)} K</b>. Magnetic entropy falls; heat flows <b>to the reservoir</b>.`);
      } else {
        const drop = state.T0 - T;
        banner.set('STAGE B · ADIABATIC DEMAGNETIZATION', drop > 0.05 ? 'ok' : '', `Isolated (isolation = ${state.isolation.toFixed(2)}), B reduced to <b>${B.toFixed(2)} T</b>. Dipoles disorder and T falls to <b>${T.toFixed(2)} K</b> (ΔT = −${drop.toFixed(2)} K).`);
      }
    }

    function drawArrow(ctx, x, y, angle, len, col) {
      const dx = Math.cos(angle) * len, dy = Math.sin(angle) * len;
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x - dx * 0.5, y - dy * 0.5); ctx.lineTo(x + dx * 0.5, y + dy * 0.5); ctx.stroke();
      const hx = x + dx * 0.5, hy = y + dy * 0.5, ha = Math.atan2(dy, dx);
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx - 5 * Math.cos(ha - 0.45), hy - 5 * Math.sin(ha - 0.45));
      ctx.lineTo(hx - 5 * Math.cos(ha + 0.45), hy - 5 * Math.sin(ha + 0.45));
      ctx.closePath(); ctx.fill();
    }

    function render() {
      if (!canvasObj) return;
      const { ctx, w, h } = canvasObj;
      ctx.clearRect(0, 0, w, h);
      const narrow = w < 620;
      const pad = narrow ? 12 : 20;
      const B = currentB(), T = currentT();
      const a = alignment(B, T);

      const stageH = h * 0.56;
      const graphY = stageH + 8, graphH = h - graphY - 10;

      ctx.textAlign = 'left';
      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillText('Paramagnetic dipoles — ' + (state.stage === 'A' ? 'Stage A: isothermal magnetization' : 'Stage B: adiabatic demagnetization'), pad, 18);

      // Sample + reservoir
      const sx = pad + 8, sy = 30, sw = w - 2 * pad - 16, sh = stageH - 44;
      ctx.fillStyle = 'rgba(34,211,238,0.05)';
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(sx, sy, sw, sh, 8); ctx.fill(); ctx.stroke();

      // Reservoir label + heat flow indicator
      const iso = state.isolation;
      ctx.fillStyle = '#8f9cb5'; ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText('Thermal reservoir (T₀ = ' + state.T0.toFixed(1) + ' K) · isolation = ' + iso.toFixed(2), sx + 8, sy + 13);
      // Heat arrows: Stage A: heat out; Stage B: little heat (isolated)
      const heatOut = state.stage === 'A' ? a : (1 - iso) * 0.3;
      ctx.strokeStyle = 'rgba(224,140,58,0.8)'; ctx.lineWidth = 1.4;
      const nHeat = Math.round(heatOut * 5);
      for (let i = 0; i < nHeat; i++) {
        const hx = sx + sw * (0.15 + 0.7 * i / Math.max(1, nHeat));
        ctx.beginPath(); ctx.moveTo(hx, sy + sh - 6); ctx.lineTo(hx, sy + sh + 2); ctx.stroke();
      }
      if (nHeat > 0) {
        ctx.fillStyle = '#e08c3a'; ctx.font = '10px Inter, sans-serif';
        ctx.fillText('heat → reservoir', sx + sw - 110, sy + sh + 12);
      }

      // Field lines
      if (B > 0.02) {
        ctx.strokeStyle = 'rgba(34,211,238,0.30)'; ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          const ly = sy + sh * (i + 0.5) / 4;
          ctx.beginPath(); ctx.moveTo(sx + 6, ly); ctx.lineTo(sx + sw - 22, ly); ctx.stroke();
        }
        ctx.fillStyle = '#22d3ee'; ctx.font = '10px JetBrains Mono, monospace'; ctx.textAlign = 'right';
        ctx.fillText('B = ' + B.toFixed(2) + ' T', sx + sw - 6, sy + 13);
        ctx.textAlign = 'left';
      }

      // Dipoles: spread ∝ (1-a)
      const gx0 = sx + 26, gx1 = sx + sw - 26, gy0 = sy + 24, gy1 = sy + sh - 22;
      const spread = (1 - a) * Math.PI * 2;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const idx = r * COLS + c;
          const x = gx0 + (gx1 - gx0) * (c / (COLS - 1));
          const y = gy0 + (gy1 - gy0) * (r / (ROWS - 1));
          const s = seeds[idx];
          const jit = (state.playing && !C.prefersReducedMotion()) ? Math.sin(state.time * 2.6 + s.ph) * 0.2 * (1 - a) : 0;
          const ang = (s.j - 0.5) * spread + jit;
          drawArrow(ctx, x, y, ang, 10, '#22d3ee');
        }
      }
      // Temperature indicator bar
      const tFrac = Math.max(0, Math.min(1, T / 5));
      ctx.fillStyle = '#8f9cb5'; ctx.font = '10px Inter, sans-serif';
      ctx.fillText('T = ' + T.toFixed(2) + ' K', sx + 8, sy + sh - 6);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.roundRect(sx + sw - 120, sy + sh - 14, 110, 8, 4); ctx.fill();
      ctx.fillStyle = '#e08c3a';
      ctx.beginPath(); ctx.roundRect(sx + sw - 120, sy + sh - 14, 110 * tFrac, 8, 4); ctx.fill();

      // --- Entropy graph: S vs T for B_high and B_low ---
      const ax = pad + 44, ay = graphY + 16, aw = w - ax - pad - 8, ah = graphH - 30;
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax, ay + ah); ctx.lineTo(ax + aw, ay + ah); ctx.stroke();
      ctx.fillStyle = '#8f9cb5'; ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'right'; ctx.fillText('S', ax - 5, ay + 8);
      ctx.fillText('0', ax - 5, ay + ah);
      ctx.textAlign = 'center';
      ctx.fillText('0 K', ax, ay + ah + 13);
      ctx.fillText('5 K → T', ax + aw, ay + ah + 13);
      ctx.textAlign = 'left';
      ctx.fillText('Entropy S(T) — qualitative (arb.)', ax, ay - 4);

      const Xg = (Tv) => ax + aw * (Tv / 5);
      const Yg = (Sv) => ay + ah - ah * Math.max(0, Math.min(1, Sv));
      // Two curves: B high (1.5T) and B low (0.1T)
      const drawCurve = (Bv, col, dash) => {
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash(dash || []);
        ctx.beginPath();
        for (let i = 0; i <= 80; i++) {
          const Tv = (i / 80) * 5;
          const Sv = entropy(Tv, Bv);
          const px = Xg(Tv), py = Yg(Sv);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke(); ctx.setLineDash([]);
      };
      drawCurve(1.5, '#22d3ee');
      drawCurve(0.1, '#f472b6');
      ctx.fillStyle = '#22d3ee'; ctx.font = '10px Inter, sans-serif';
      ctx.fillText('B = 1.5 T', ax + aw - 60, Yg(entropy(4.5, 1.5)) - 6);
      ctx.fillStyle = '#f472b6';
      ctx.fillText('B ≈ 0', ax + aw - 50, Yg(entropy(4.5, 0.1)) - 6);
      // Operating point + adiabatic arrow (S const, T drops)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(Xg(T), Yg(entropy(T, B)), 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#edf1f8'; ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText('now: T=' + T.toFixed(2) + 'K, B=' + B.toFixed(2) + 'T', Xg(T) + 8, Yg(entropy(T, B)) - 7);
    }

    function applyPreset(preset) {
      if (preset === 'stageA') {
        state.stage = 'A'; state.B = 1.5; state.progress = 0;
        if (ui.stageSeg) ui.stageSeg.set('A');
        if (ui.bSlider) ui.bSlider.setValue(1.5);
        if (ui.progSlider) ui.progSlider.setValue(0);
      } else if (preset === 'stageB') {
        state.stage = 'B'; state.B0 = 1.5; state.B = 1.5; state.progress = 0.6;
        if (ui.stageSeg) ui.stageSeg.set('B');
        if (ui.bSlider) ui.bSlider.setValue(1.5);
        if (ui.progSlider) ui.progSlider.setValue(0.6);
      } else return;
      updateReadouts(); updateBanner(); render();
    }

    return {
      mount() {
        buildDOM();
        canvasObj = X.setupCanvas(document.getElementById('cv-c5t4'));
        updateReadouts(); updateBanner(); render();
      },
      unmount() {},
      tick(dt) {
        if (state.playing) {
          if (!C.prefersReducedMotion()) state.time += dt;
          if (state.stage === 'B') {
            state.progress = Math.min(1, state.progress + dt * 0.15);
            if (ui.progSlider) ui.progSlider.setValue(state.progress);
            updateReadouts(); updateBanner();
          }
        }
        render();
      },
      resize() {
        const cv = document.getElementById('cv-c5t4');
        if (cv) canvasObj = X.setupCanvas(cv);
        render();
      },
      applyPreset,
      alignment, adiabaticT, entropy,
      getState: () => state,
    };
  };
})();
