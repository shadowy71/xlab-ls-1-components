(function () {
  'use strict';

  const C = window.Ch5Platform;
  const X = window.XLab;

  window.CH5_SIMS['c5t6'] = function createBCSLab(ctxDom) {
    const { stage, controls, formula, wrap, dot } = ctxDom;

    const state = {
      T: 4,            // temperature (K)
      Tc: 10,          // critical temperature (K, illustrative)
      V: 0.6,          // effective interaction strength (0..1, illustrative)
      showPairs: true,
      playing: true,
      speed: 1.0,
      time: 0,
    };

    let built = false;
    let canvasObj = null;
    let ui = {};
    let banner = null;

    /* ---------- Physics ---------- */
    // BCS gap: Delta(T) = Delta0 * tanh(1.74*sqrt(Tc/T - 1)), Delta0 = 1.76 kB Tc
    function gap(T, Tc) {
      if (T >= Tc) return 0;
      const D0 = 1.76 * C.PHYSICS.kB * Tc; // Joules
      const f = Math.tanh(1.74 * Math.sqrt(Tc / Math.max(T, 0.01) - 1));
      return D0 * f;
    }
    function gapMeV(T, Tc) {
      return gap(T, Tc) / C.PHYSICS.e * 1000; // meV
    }
    // Pair fraction (illustrative): grows below Tc, scaled by interaction V
    function pairFraction(T, Tc, V) {
      if (T >= Tc) return 0;
      const base = 1 - Math.pow(T / Tc, 2);
      return Math.max(0, Math.min(1, base * (0.4 + 0.6 * V)));
    }
    function isSC(T, Tc) { return T < Tc; }

    function resetSimulation() {
      state.T = 4; state.Tc = 10; state.V = 0.6; state.showPairs = true;
      state.speed = 1.0; state.time = 0;
      if (ui.tSlider) ui.tSlider.setValue(4);
      if (ui.tcSlider) ui.tcSlider.setValue(10);
      if (ui.vSlider) ui.vSlider.setValue(0.6);
      if (ui.speedSlider) ui.speedSlider.setValue(1.0);
      if (ui.pairToggle) ui.pairToggle.checked = true;
      updateReadouts(); updateBanner(); render();
    }

    function buildDOM() {
      if (built) return;
      built = true;
      stage.innerHTML = ''; controls.innerHTML = ''; formula.innerHTML = '';

      const cv = X.el('canvas', 'viz');
      cv.id = 'cv-c5t6';
      cv.setAttribute('aria-label', 'BCS Theory and Cooper Pair Explorer');
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
      ui.transport.setPlaying(true);

      ui.tSlider = X.buildSlider(controls, {
        label: 'Temperature T', id: 'c5t6-T', min: 0.5, max: 20, step: 0.5, value: state.T,
        format: (v) => v.toFixed(1) + ' K',
        onInput: (v) => { state.T = v; updateReadouts(); updateBanner(); render(); },
      });

      ui.tcSlider = X.buildSlider(controls, {
        label: 'Critical Temperature Tc (illustrative)', id: 'c5t6-Tc', min: 2, max: 20, step: 0.5, value: state.Tc,
        format: (v) => v.toFixed(1) + ' K',
        onInput: (v) => { state.Tc = v; updateReadouts(); updateBanner(); render(); },
      });

      ui.vSlider = X.buildSlider(controls, {
        label: 'Effective Interaction V (phonon-mediated)', id: 'c5t6-V', min: 0, max: 1, step: 0.05, value: state.V,
        format: (v) => v.toFixed(2),
        onInput: (v) => { state.V = v; updateReadouts(); updateBanner(); render(); },
      });

      ui.speedSlider = X.buildSlider(controls, {
        label: 'Simulation Speed', id: 'c5t6-speed', min: 0.2, max: 3, step: 0.1, value: state.speed,
        format: (v) => v.toFixed(1) + '×',
        onInput: (v) => { state.speed = v; },
      });

      ui.pairToggle = X.buildToggle(controls, {
        label: 'Show Cooper-pair pairing',
        checked: state.showPairs,
        onChange: (on) => { state.showPairs = on; render(); },
      });

      ui.readouts = X.buildReadouts(controls, [
        { id: 'T', label: 'Temperature T', primary: true },
        { id: 'Tc', label: 'Critical Tc' },
        { id: 'gap', label: 'Energy Gap Δ(T)' },
        { id: 'pair', label: 'Pair Fraction' },
        { id: 'state', label: 'State', wide: true },
      ]);

      controls.append(X.el('div', 'ctrl-note',
        '<b>Simplified BCS visualization:</b> phonon-mediated effective attraction (not direct magnetic attraction). Conventional BCS model — does not fully explain every high-Tc superconductor.'
      ));
    }

    function updateReadouts() {
      if (!ui.readouts) return;
      const sc = isSC(state.T, state.Tc);
      const d = gapMeV(state.T, state.Tc);
      const pf = pairFraction(state.T, state.Tc, state.V);
      ui.readouts.set('T', state.T.toFixed(1) + ' K');
      ui.readouts.set('Tc', state.Tc.toFixed(1) + ' K');
      ui.readouts.set('gap', sc ? d.toFixed(3) + ' meV' : '0 (closed)');
      ui.readouts.set('pair', (pf * 100).toFixed(0) + '%');
      ui.readouts.set('state', sc ? 'Superconducting condensate (pairs)' : 'Normal metal (no pairs)');
      formula.innerHTML =
        `<span class="formula active">Δ(0) = 1.76 k<sub>B</sub>Tc = <span class="fv">${(1.76 * C.PHYSICS.kB * state.Tc / C.PHYSICS.e * 1000).toFixed(3)} meV</span></span>` +
        `<span class="formula">Δ(T) = Δ(0)·tanh[1.74√(Tc/T−1)]</span>` +
        `<span class="formula">Δ(T) = <span class="fv">${sc ? d.toFixed(3) + ' meV' : '0'}</span></span>`;
    }

    function updateBanner() {
      if (!banner) return;
      const sc = isSC(state.T, state.Tc);
      if (sc) {
        banner.set('SUPERCONDUCTING · T < Tc', 'ok', `Below <b>Tc = ${state.Tc.toFixed(1)} K</b>: phonon-mediated attraction binds Cooper pairs; gap <b>Δ = ${gapMeV(state.T, state.Tc).toFixed(3)} meV</b>. Pairs condense and carry current without resistance.`);
      } else {
        banner.set('NORMAL · T > Tc', 'warn', `Above <b>Tc = ${state.Tc.toFixed(1)} K</b>: thermal energy exceeds pairing; gap closed, no condensate. Cool below Tc to form pairs.`);
      }
    }

    function render() {
      if (!canvasObj) return;
      const { ctx, w, h } = canvasObj;
      ctx.clearRect(0, 0, w, h);
      const narrow = w < 620;
      const pad = narrow ? 12 : 20;
      const sc = isSC(state.T, state.Tc);
      const pf = pairFraction(state.T, state.Tc, state.V);
      const t = state.time;

      const stageH = h * 0.56;
      const graphY = stageH + 8, graphH = h - graphY - 10;

      ctx.textAlign = 'left';
      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillText('Crystal lattice, phonons & Cooper pairs — ' + (sc ? 'T < Tc: pairing' : 'T > Tc: normal'), pad, 18);

      // Lattice: grid of ions with phonon displacement
      const lx = pad + 10, ly = 30, lw = w - 2 * pad - 20, lh = stageH - 44;
      ctx.fillStyle = 'rgba(34,211,238,0.04)';
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(lx, ly, lw, lh, 8); ctx.fill(); ctx.stroke();

      const cols = 9, rows = 5;
      const ions = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = lx + 24 + (lw - 48) * (c / (cols - 1));
          const y = ly + 22 + (lh - 44) * (r / (rows - 1));
          // Phonon displacement: wave travelling, amplitude ∝ V
          const disp = state.playing && !C.prefersReducedMotion()
            ? Math.sin(t * 3 * state.speed + (c + r) * 0.7) * 3 * (0.3 + state.V)
            : 0;
          ions.push({ x: x + disp, y, c, r });
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.beginPath(); ctx.arc(x + disp, y, 3, 0, Math.PI * 2); ctx.fill();
        }
      }
      // Lattice bonds (faint)
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols - 1; c++) {
          const a = ions[r * cols + c], b = ions[r * cols + c + 1];
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }

      // Electrons: free (normal) or paired (SC)
      const nE = 10;
      const pairedCount = Math.round(nE * pf);
      for (let i = 0; i < nE; i++) {
        const phase = (i / nE + t * 0.06 * state.speed) % 1;
        const x = lx + 16 + phase * (lw - 32);
        const y = ly + 20 + (lh - 40) * ((i * 0.37) % 1);
        const isPaired = state.showPairs && sc && i < pairedCount;
        if (isPaired) {
          // Pair: two electrons with opposite momenta (arrows opposite), close together
          ctx.fillStyle = '#34d399';
          ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x + 10, y, 3.4, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#34d399'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x - 1, y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + 15, y); ctx.lineTo(x + 20, y); ctx.stroke();
          // dashed link
          ctx.setLineDash([2, 3]);
          ctx.beginPath(); ctx.moveTo(x + 3, y); ctx.lineTo(x + 7, y); ctx.stroke();
          ctx.setLineDash([]);
        } else {
          ctx.fillStyle = '#22d3ee';
          ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 7, y); ctx.stroke();
        }
      }
      ctx.fillStyle = '#8f9cb5'; ctx.font = '10px Inter, sans-serif';
      ctx.fillText(sc
        ? 'Green pairs: opposite momenta (k, −k), singlet — phonon-mediated attraction (not magnetic).'
        : 'Cyan electrons: unpaired, scattered by lattice — normal metal.', lx + 6, ly + lh - 6);

      // --- Energy gap diagram: E vs k ---
      const ax = pad + 44, ay = graphY + 16, aw = w - ax - pad - 8, ah = graphH - 30;
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax, ay + ah); ctx.lineTo(ax + aw, ay + ah); ctx.stroke();
      ctx.fillStyle = '#8f9cb5'; ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'left'; ctx.fillText('E (meV)', ax, ay - 4);
      ctx.textAlign = 'center'; ctx.fillText('k → (Fermi level at centre)', ax + aw / 2, ay + ah + 13);
      ctx.textAlign = 'left';
      const d = gapMeV(state.T, state.Tc);
      const dMax = 1.76 * C.PHYSICS.kB * state.Tc / C.PHYSICS.e * 1000;
      const midY = ay + ah / 2;
      const gapPx = ah * 0.45 * (dMax > 0 ? d / dMax : 0);
      // Upper/lower branches
      ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ax, midY - gapPx); ctx.lineTo(ax + aw, midY - gapPx); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ax, midY + gapPx); ctx.lineTo(ax + aw, midY + gapPx); ctx.stroke();
      // Fermi level dashed
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(ax, midY); ctx.lineTo(ax + aw, midY); ctx.stroke();
      ctx.setLineDash([]);
      // Gap bracket
      if (sc && d > 0.001) {
        ctx.strokeStyle = '#34d399'; ctx.lineWidth = 1.4;
        const bx = ax + aw - 30;
        ctx.beginPath(); ctx.moveTo(bx, midY - gapPx); ctx.lineTo(bx, midY + gapPx); ctx.stroke();
        ctx.fillStyle = '#34d399'; ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText('2Δ', bx + 5, midY + 3);
        ctx.fillText('Δ = ' + d.toFixed(3) + ' meV', ax + 6, ay + 12);
      } else {
        ctx.fillStyle = '#8f9cb5'; ctx.font = '10px Inter, sans-serif';
        ctx.fillText('Gap closed (Δ = 0) — normal state', ax + 6, ay + 12);
      }
      ctx.fillStyle = '#8f9cb5'; ctx.font = '10px Inter, sans-serif';
      ctx.fillText('Gap closes as T → Tc. Δ(0) = 1.76 kBTc (BCS weak coupling).', ax, ay + ah - 4);
    }

    function applyPreset(preset) {
      if (preset === 'below') { state.T = 4; state.Tc = 10; }
      else if (preset === 'near') { state.T = 9; state.Tc = 10; }
      else if (preset === 'above') { state.T = 14; state.Tc = 10; }
      else return;
      if (ui.tSlider) ui.tSlider.setValue(state.T);
      if (ui.tcSlider) ui.tcSlider.setValue(state.Tc);
      updateReadouts(); updateBanner(); render();
    }

    return {
      mount() {
        buildDOM();
        canvasObj = X.setupCanvas(document.getElementById('cv-c5t6'));
        updateReadouts(); updateBanner(); render();
      },
      unmount() {},
      tick(dt) {
        if (state.playing && !C.prefersReducedMotion()) state.time += dt;
        render();
      },
      resize() {
        const cv = document.getElementById('cv-c5t6');
        if (cv) canvasObj = X.setupCanvas(cv);
        render();
      },
      applyPreset,
      gap, gapMeV, pairFraction,
      getState: () => state,
    };
  };
})();
