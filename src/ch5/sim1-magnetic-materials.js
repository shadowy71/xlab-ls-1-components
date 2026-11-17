(function () {
  'use strict';

  const C = window.Ch5Platform;
  const X = window.XLab;

  window.CH5_SIMS['c5t1'] = function createMagneticMaterialsLab(ctxDom) {
    const { stage, controls, formula, wrap, dot } = ctxDom;

    const MATERIALS = {
      dia:   { name: 'Diamagnetic',          chi: 'χ < 0 (small)',    col: '#94a3b8' },
      para:  { name: 'Paramagnetic',         chi: 'χ > 0, χ ∝ 1/T',   col: '#22d3ee' },
      ferro: { name: 'Ferromagnetic',        chi: 'Spontaneous M',    col: '#f472b6' },
      afm:   { name: 'Antiferromagnetic',    chi: 'M ≈ 0, L ≠ 0',     col: '#a5b4fc' },
      ferri: { name: 'Ferrimagnetic',        chi: 'M ≠ 0 (unequal)',  col: '#34d399' },
    };

    const COLS = 10, ROWS = 7;
    // Fixed per-dipole seeds for stable jitter (no re-randomization per frame)
    const seeds = [];
    for (let i = 0; i < COLS * ROWS; i++) {
      seeds.push({ ph: Math.random() * Math.PI * 2, j: Math.random() });
    }

    const state = {
      material: 'ferro',
      B: 0.6,        // applied field (T, illustrative scale)
      T: 300,        // temperature (K)
      Tc: 600,       // Curie temperature (K, illustrative, adjustable)
      TN: 500,       // Néel temperature (K, illustrative, adjustable)
      playing: true,
      showField: true,
      time: 0,
    };

    let built = false;
    let canvasObj = null;
    let ui = {};
    let banner = null;

    /* ---------- Physics (separated from rendering) ---------- */
    // Spontaneous order parameter (illustrative mean-field form)
    function orderParameter(T, Tcrit) {
      if (T >= Tcrit) return 0;
      return Math.sqrt(Math.max(0, 1 - T / Tcrit));
    }
    // Paramagnetic alignment factor: tanh(mu B / kT) in illustrative units
    function paraAlignment(B, T) {
      const x = 0.5 * B * (300 / Math.max(T, 20));
      return Math.tanh(x);
    }
    function staggeredOrder(T, TN) {
      return orderParameter(T, TN);
    }
    // Net magnetization in arbitrary units (-1..1), illustrative model
    function netMagnetization(mat, B, T, Tc, TN) {
      if (mat === 'dia') return -0.06 * B;
      if (mat === 'para') return 0.35 * paraAlignment(B, T);
      if (mat === 'ferro') {
        const m = orderParameter(T, Tc);
        if (m > 0) return m * (0.55 + 0.45 * Math.tanh(3 * B));
        return 0.35 * paraAlignment(B, T); // above Tc: paramagnetic-like
      }
      if (mat === 'afm') {
        // Net M ~ 0 (small canting only); order lives in staggered L
        return 0.04 * paraAlignment(B, T);
      }
      if (mat === 'ferri') {
        const m = orderParameter(T, Tc);
        if (m > 0) return 0.45 * m * (0.55 + 0.45 * Math.tanh(3 * B));
        return 0.35 * paraAlignment(B, T);
      }
      return 0;
    }
    function stateLabel(mat, T, Tc, TN) {
      if (mat === 'ferro' || mat === 'ferri') {
        return T < Tc ? 'Spontaneous order (T < Tc)' : 'Paramagnetic (T > Tc)';
      }
      if (mat === 'afm') {
        return T < TN ? 'Antiparallel order (T < TN)' : 'Paramagnetic (T > TN)';
      }
      if (mat === 'para') return 'Paramagnetic (disordered, field-aligned)';
      return 'Diamagnetic (induced opposition)';
    }

    function dipoleAngle(idx, row, col) {
      const mat = state.material;
      const B = state.B, T = state.T;
      const s = seeds[idx];
      const t = state.time;
      const jitter = (state.playing && !C.prefersReducedMotion()) ? Math.sin(t * 2.6 + s.ph) : 0;
      const rnd = s.j; // 0..1 fixed

      if (mat === 'dia') {
        // Induced moment opposes B (points left, opposite field)
        return Math.PI + jitter * 0.08;
      }
      if (mat === 'para') {
        const a = paraAlignment(B, T);
        const spread = (1 - a) * 2.6; // thermal disorder
        return (rnd - 0.5) * spread + jitter * 0.25 * (1 - a);
      }
      if (mat === 'ferro') {
        const m = orderParameter(T, state.Tc);
        if (m <= 0) {
          const a = paraAlignment(B, T);
          const spread = (1 - a) * 2.6;
          return (rnd - 0.5) * spread + jitter * 0.25 * (1 - a);
        }
        // 4 domains (2x2 blocks) with different base orientations
        const dom = (row < Math.ceil(ROWS / 2) ? 0 : 1) * 2 + (col < Math.ceil(COLS / 2) ? 0 : 1);
        const bases = [0, Math.PI / 2, -Math.PI / 2, Math.PI];
        const f = m * (0.25 + 0.75 * Math.tanh(2.2 * B)); // field rotates domains toward B
        return bases[dom] * (1 - f) + jitter * 0.06 * (1 - f);
      }
      if (mat === 'afm') {
        const L = staggeredOrder(T, state.TN);
        if (L <= 0) {
          const a = paraAlignment(B, T);
          const spread = (1 - a) * 2.6;
          return (rnd - 0.5) * spread + jitter * 0.25 * (1 - a);
        }
        // Checkerboard antiparallel + slight canting toward B
        const base = ((row + col) % 2 === 0) ? 0 : Math.PI;
        const cant = 0.12 * Math.tanh(2 * B) * (base === 0 ? 1 : -1) * -1;
        return base + cant + jitter * 0.05;
      }
      // ferri: two sublattices, unequal moments
      const m = orderParameter(T, state.Tc);
      if (m <= 0) {
        const a = paraAlignment(B, T);
        const spread = (1 - a) * 2.6;
        return (rnd - 0.5) * spread + jitter * 0.25 * (1 - a);
      }
      const base = ((row + col) % 2 === 0) ? 0 : Math.PI;
      const f = m * (0.2 + 0.8 * Math.tanh(2.2 * B));
      return base * (1 - f) + jitter * 0.05;
    }

    function dipoleLength(idx, row, col) {
      const mat = state.material;
      const B = state.B;
      if (mat === 'dia') return 4 + 5 * B; // weak induced
      if (mat === 'ferri') return ((row + col) % 2 === 0) ? 11 : 7; // unequal sublattices
      if (mat === 'para') return 6 + 5 * paraAlignment(B, state.T);
      return 10;
    }

    /* ---------- UI ---------- */
    function resetSimulation() {
      state.material = 'ferro';
      state.B = 0.6; state.T = 300; state.Tc = 600; state.TN = 500;
      state.time = 0;
      if (ui.matSelect) ui.matSelect.value = 'ferro';
      if (ui.bSlider) ui.bSlider.setValue(0.6);
      if (ui.tSlider) ui.tSlider.setValue(300);
      if (ui.tcSlider) ui.tcSlider.setValue(600);
      if (ui.tnSlider) ui.tnSlider.setValue(500);
      syncTcVisibility();
      updateReadouts(); updateBanner(); render();
    }

    function syncTcVisibility() {
      const isFerroLike = state.material === 'ferro' || state.material === 'ferri';
      const isAfm = state.material === 'afm';
      if (ui.tcWrap) ui.tcWrap.style.display = isFerroLike ? 'flex' : 'none';
      if (ui.tnWrap) ui.tnWrap.style.display = isAfm ? 'flex' : 'none';
    }

    function buildDOM() {
      if (built) return;
      built = true;
      stage.innerHTML = ''; controls.innerHTML = ''; formula.innerHTML = '';

      const cv = X.el('canvas', 'viz');
      cv.id = 'cv-c5t1';
      cv.setAttribute('aria-label', 'Magnetic Materials Explorer: dipole response and temperature transitions');
      stage.append(cv);
      canvasObj = X.setupCanvas(cv);
      banner = C.buildBanner(wrap);

      ui.transport = C.buildTransport(controls, {
        onTogglePlay: () => {
          state.playing = !state.playing;
          ui.transport.setPlaying(state.playing);
          if (dot) dot.textContent = state.playing ? 'Live' : 'Paused';
          render();
        },
        onReset: resetSimulation,
        playLabel: 'Pause',
      });
      ui.transport.setPlaying(true);

      ui.matSelect = X.buildSelect(controls, {
        label: 'Material Category',
        options: [
          { value: 'dia', label: 'Diamagnetic' },
          { value: 'para', label: 'Paramagnetic' },
          { value: 'ferro', label: 'Ferromagnetic' },
          { value: 'afm', label: 'Antiferromagnetic' },
          { value: 'ferri', label: 'Ferrimagnetic' },
        ],
        value: state.material,
        onChange: (v) => { state.material = v; syncTcVisibility(); updateReadouts(); updateBanner(); render(); },
      });

      ui.bSlider = X.buildSlider(controls, {
        label: 'Applied Field B', id: 'c5t1-B', min: 0, max: 2, step: 0.05, value: state.B,
        format: (v) => v.toFixed(2) + ' T',
        onInput: (v) => { state.B = v; updateReadouts(); updateBanner(); render(); },
      });

      ui.tSlider = X.buildSlider(controls, {
        label: 'Temperature T', id: 'c5t1-T', min: 10, max: 1000, step: 10, value: state.T,
        format: (v) => v.toFixed(0) + ' K',
        onInput: (v) => { state.T = v; updateReadouts(); updateBanner(); render(); },
      });

      ui.tcSlider = X.buildSlider(controls, {
        label: 'Curie Temperature Tc (illustrative)', id: 'c5t1-Tc', min: 100, max: 1000, step: 10, value: state.Tc,
        format: (v) => v.toFixed(0) + ' K',
        onInput: (v) => { state.Tc = v; updateReadouts(); updateBanner(); render(); },
      });
      ui.tcWrap = ui.tcSlider.input.closest('.slider-block');

      ui.tnSlider = X.buildSlider(controls, {
        label: 'Néel Temperature TN (illustrative)', id: 'c5t1-TN', min: 100, max: 1000, step: 10, value: state.TN,
        format: (v) => v.toFixed(0) + ' K',
        onInput: (v) => { state.TN = v; updateReadouts(); updateBanner(); render(); },
      });
      ui.tnWrap = ui.tnSlider.input.closest('.slider-block');

      ui.fieldToggle = X.buildToggle(controls, {
        label: 'Show external field lines',
        checked: state.showField,
        onChange: (on) => { state.showField = on; render(); },
      });

      ui.readouts = X.buildReadouts(controls, [
        { id: 'mat', label: 'Material', primary: true },
        { id: 'M', label: 'Net Magnetization M (arb.)' },
        { id: 'state', label: 'Magnetic State', wide: true },
        { id: 'align', label: 'Alignment / Order' },
        { id: 'chi', label: 'Susceptibility χ' },
      ]);

      controls.append(X.el('div', 'ctrl-note',
        '<b>Illustrative model:</b> dipoles show qualitative response; M(T) uses order ∝ √(1−T/Tc) below Tc/TN and Curie-law χ ∝ 1/T above. Tc/TN are adjustable teaching parameters, not measured data for a named material.'
      ));

      syncTcVisibility();
    }

    function updateReadouts() {
      if (!ui.readouts) return;
      const M = netMagnetization(state.material, state.B, state.T, state.Tc, state.TN);
      ui.readouts.set('mat', MATERIALS[state.material].name);
      ui.readouts.set('M', (M >= 0 ? '+' : '') + M.toFixed(3) + ' arb.');
      ui.readouts.set('state', stateLabel(state.material, state.T, state.Tc, state.TN));
      let align = '';
      if (state.material === 'afm') {
        align = 'L = ' + staggeredOrder(state.T, state.TN).toFixed(3) + ' (staggered)';
      } else if (state.material === 'ferro' || state.material === 'ferri') {
        align = 'Order = ' + orderParameter(state.T, state.Tc).toFixed(3);
      } else if (state.material === 'para') {
        align = '⟨cosθ⟩ ≈ ' + paraAlignment(state.B, state.T).toFixed(3);
      } else {
        align = 'Induced ∝ −B';
      }
      ui.readouts.set('align', align);
      ui.readouts.set('chi', MATERIALS[state.material].chi);
      formula.innerHTML =
        `<span class="formula active">M = χH &nbsp;→&nbsp; <span class="fv">${M.toFixed(3)} arb.</span></span>` +
        `<span class="formula">Order ∝ √(1 − T/Tc) for T &lt; Tc</span>` +
        `<span class="formula">χ<sub>para</sub> ∝ 1/T (Curie law)</span>`;
    }

    function updateBanner() {
      if (!banner) return;
      const m = state.material;
      if (m === 'dia') banner.set('DIAMAGNETIC · WEAK REPULSION', '', 'Induced moments point <b>opposite</b> to B (arrows left). The sample is weakly <b>repelled</b> from the field — χ &lt; 0, small and (nearly) temperature-independent.');
      else if (m === 'para') banner.set('PARAMAGNETIC · WEAK ATTRACTION', 'ok', 'Moments <b>tend to align</b> with B but thermal agitation randomizes them. Alignment ⟨cosθ⟩ ≈ tanh(μB/kT) grows with B and falls with T — weak <b>attraction</b>.');
      else if (m === 'ferro') {
        if (state.T < state.Tc) banner.set('FERROMAGNETIC · T < Tc — SPONTANEOUS ORDER', 'ok', `Below <b>Tc = ${state.Tc} K</b> domains are spontaneously ordered (M ≠ 0 even at B = 0). Increasing B rotates/grows favourably aligned domains.`);
        else banner.set('FERROMAGNETIC · T > Tc — ORDER LOST', 'warn', `Above <b>Tc = ${state.Tc} K</b> spontaneous order is gone; the material behaves <b>paramagnetically</b> (weak, field-induced alignment only).`);
      } else if (m === 'afm') {
        if (state.T < state.TN) banner.set('ANTIFERROMAGNETIC · T < TN — ORDERED, M ≈ 0', 'ok', `Below <b>TN = ${state.TN} K</b> neighbours are <b>antiparallel</b> (checkerboard). Net M ≈ 0 does <b>not</b> mean disorder — the staggered order L is finite.`);
        else banner.set('ANTIFERROMAGNETIC · T > TN — ORDER LOST', 'warn', `Above <b>TN = ${state.TN} K</b> antiparallel order is lost; the material behaves <b>paramagnetically</b>.`);
      } else {
        if (state.T < state.Tc) banner.set('FERRIMAGNETIC · UNEQUAL SUBLATTICES', 'ok', 'Opposing sublattices (long vs short arrows) do not cancel: <b>net M ≠ 0</b>. Below Tc the sublattice order is spontaneous.');
        else banner.set('FERRIMAGNETIC · T > Tc — ORDER LOST', 'warn', `Above <b>Tc = ${state.Tc} K</b> sublattice order is lost; paramagnetic-like response.`);
      }
    }

    function drawArrow(ctx, x, y, angle, len, col) {
      const dx = Math.cos(angle) * len, dy = Math.sin(angle) * len;
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x - dx * 0.5, y - dy * 0.5); ctx.lineTo(x + dx * 0.5, y + dy * 0.5); ctx.stroke();
      const hx = x + dx * 0.5, hy = y + dy * 0.5;
      const ha = Math.atan2(dy, dx);
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

      // Layout: top dipole stage (~58%), bottom M(T) graph
      const stageH = h * 0.58;
      const graphY = stageH + 8, graphH = h - graphY - 10;

      ctx.textAlign = 'left';
      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillText(MATERIALS[state.material].name + ' — dipole response to B', pad, 18);

      // Sample box
      const sx = pad + 8, sy = 30, sw = w - 2 * pad - 16, sh = stageH - 44;
      ctx.fillStyle = 'rgba(34,211,238,0.05)';
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(sx, sy, sw, sh, 8); ctx.fill(); ctx.stroke();

      // External field lines (horizontal, density ∝ B)
      if (state.showField && state.B > 0.02) {
        ctx.strokeStyle = 'rgba(34,211,238,0.35)';
        ctx.lineWidth = 1;
        const nLines = 5;
        for (let i = 0; i < nLines; i++) {
          const ly = sy + sh * (i + 0.5) / nLines;
          ctx.beginPath(); ctx.moveTo(sx + 6, ly); ctx.lineTo(sx + sw - 22, ly); ctx.stroke();
          ctx.fillStyle = 'rgba(34,211,238,0.5)';
          ctx.beginPath();
          ctx.moveTo(sx + sw - 14, ly); ctx.lineTo(sx + sw - 22, ly - 3.5); ctx.lineTo(sx + sw - 22, ly + 3.5);
          ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = '#22d3ee';
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.textAlign = 'right';
        ctx.fillText('B = ' + state.B.toFixed(2) + ' T →', sx + sw - 6, sy + 13);
        ctx.textAlign = 'left';
      }

      // Dipole grid
      const gx0 = sx + 26, gx1 = sx + sw - 26, gy0 = sy + 22, gy1 = sy + sh - 18;
      const col = MATERIALS[state.material].col;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const idx = r * COLS + c;
          const x = gx0 + (gx1 - gx0) * (COLS === 1 ? 0.5 : c / (COLS - 1));
          const y = gy0 + (gy1 - gy0) * (ROWS === 1 ? 0.5 : r / (ROWS - 1));
          const ang = dipoleAngle(idx, r, c);
          const len = dipoleLength(idx, r, c);
          // Ferrimagnetic: colour sublattices differently
          let dc = col;
          if (state.material === 'ferri') dc = ((r + c) % 2 === 0) ? '#34d399' : '#fbbf24';
          if (state.material === 'afm') dc = ((r + c) % 2 === 0) ? '#a5b4fc' : '#f472b6';
          drawArrow(ctx, x, y, ang, len, dc);
        }
      }
      if (state.material === 'ferri') {
        ctx.fillStyle = '#8f9cb5'; ctx.font = '10px Inter, sans-serif';
        ctx.fillText('Sublattice A (long)  Sublattice B (short)', sx + 8, sy + sh - 6);
      }
      if (state.material === 'afm') {
        ctx.fillStyle = '#8f9cb5'; ctx.font = '10px Inter, sans-serif';
        ctx.fillText('Antiparallel neighbours — ordered, net M ≈ 0', sx + 8, sy + sh - 6);
      }

      // --- M(T) / order-parameter graph ---
      const ax = pad + 44, ay = graphY + 16, aw = w - ax - pad - 8, ah = graphH - 30;
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax, ay + ah); ctx.lineTo(ax + aw, ay + ah); ctx.stroke();
      ctx.fillStyle = '#8f9cb5'; ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'right'; ctx.fillText('1.0', ax - 5, ay + 8);
      ctx.fillText('0', ax - 5, ay + ah);
      ctx.textAlign = 'center';
      ctx.fillText('0 K', ax, ay + ah + 13);
      ctx.fillText('1000 K', ax + aw, ay + ah + 13);
      ctx.textAlign = 'left';
      const yLabel = state.material === 'afm' ? 'Staggered order L(T)' : (state.material === 'para' || state.material === 'dia' ? 'χ(T) (arb.)' : 'Order M(T) (arb.)');
      ctx.fillText(yLabel, ax, ay - 4);

      const Tmax = 1000;
      const Xg = (T) => ax + aw * (T / Tmax);
      const Yg = (v) => ay + ah - ah * Math.max(0, Math.min(1, v));

      // Curve
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const T = (i / 120) * Tmax;
        let v;
        if (state.material === 'ferro' || state.material === 'ferri') v = orderParameter(T, state.Tc);
        else if (state.material === 'afm') v = staggeredOrder(T, state.TN);
        else if (state.material === 'para') v = 300 / Math.max(T, 50) * 0.35; // Curie law shape
        else v = 0.06; // dia: ~constant small
        const px = Xg(T), py = Yg(v);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Transition marker (Tc or TN)
      const Tcrit = state.material === 'afm' ? state.TN : state.Tc;
      const showCrit = ['ferro', 'afm', 'ferri'].includes(state.material);
      if (showCrit) {
        ctx.strokeStyle = '#e0b553'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(Xg(Tcrit), ay); ctx.lineTo(Xg(Tcrit), ay + ah); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#e0b553'; ctx.font = '10px JetBrains Mono, monospace'; ctx.textAlign = 'center';
        ctx.fillText((state.material === 'afm' ? 'TN' : 'Tc') + ' = ' + Tcrit + ' K', Xg(Tcrit), ay + ah + 13);
        ctx.textAlign = 'left';
      }
      // Operating point
      let vNow;
      if (state.material === 'ferro' || state.material === 'ferri') vNow = orderParameter(state.T, state.Tc);
      else if (state.material === 'afm') vNow = staggeredOrder(state.T, state.TN);
      else if (state.material === 'para') vNow = 300 / Math.max(state.T, 50) * 0.35;
      else vNow = 0.06;
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath(); ctx.arc(Xg(state.T), Yg(vNow), 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#edf1f8'; ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText('T = ' + state.T + ' K', Xg(state.T) + 8, Yg(vNow) - 6);
    }

    function applyPreset(preset) {
      if (preset === 'diamagnetic') { state.material = 'dia'; state.B = 1.2; }
      else if (preset === 'paramagnetic') { state.material = 'para'; state.B = 1.0; state.T = 300; }
      else if (preset === 'ferromagnetic') { state.material = 'ferro'; state.B = 0.6; state.T = 300; }
      else if (preset === 'antiferromagnetic') { state.material = 'afm'; state.B = 0.6; state.T = 300; }
      else if (preset === 'ferrimagnetic') { state.material = 'ferri'; state.B = 0.6; state.T = 300; }
      else if (preset === 'ferro-below') { state.material = 'ferro'; state.T = 300; state.Tc = 600; state.B = 0.4; }
      else if (preset === 'ferro-above') { state.material = 'ferro'; state.T = 850; state.Tc = 600; state.B = 0.8; }
      else if (preset === 'afm-below') { state.material = 'afm'; state.T = 250; state.TN = 500; state.B = 0.4; }
      else if (preset === 'afm-above') { state.material = 'afm'; state.T = 800; state.TN = 500; state.B = 0.8; }
      else return;
      if (ui.matSelect) ui.matSelect.value = state.material;
      if (ui.bSlider) ui.bSlider.setValue(state.B);
      if (ui.tSlider) ui.tSlider.setValue(state.T);
      if (ui.tcSlider) ui.tcSlider.setValue(state.Tc);
      if (ui.tnSlider) ui.tnSlider.setValue(state.TN);
      syncTcVisibility();
      updateReadouts(); updateBanner(); render();
    }

    return {
      mount() {
        buildDOM();
        canvasObj = X.setupCanvas(document.getElementById('cv-c5t1'));
        updateReadouts(); updateBanner(); render();
      },
      unmount() {},
      tick(dt) {
        if (state.playing && !C.prefersReducedMotion()) state.time += dt;
        render();
      },
      resize() {
        const cv = document.getElementById('cv-c5t1');
        if (cv) canvasObj = X.setupCanvas(cv);
        render();
      },
      applyPreset,
      orderParameter,
      paraAlignment,
      staggeredOrder,
      netMagnetization,
      getState: () => state,
    };
  };
})();
