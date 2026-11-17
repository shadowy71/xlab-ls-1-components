(function () {
  'use strict';

  const C = window.Ch5Platform;
  const X = window.XLab;

  window.CH5_SIMS['c5t8'] = function createSQUIDLab(ctxDom) {
    const { stage, controls, formula, wrap, dot } = ctxDom;

    const state = {
      mode: 'working',   // 'construction' | 'working'
      phiFlux: 0,        // flux in units of Phi0 (-2..2)
      Ic0: 10,           // single-junction critical current (µA)
      phase: 90,          // common phase γ, degrees
      Ib: 12,            // applied bias current (µA)
      playing: true,
      time: 0,
    };

    let built = false;
    let canvasObj = null;
    let ui = {};
    let banner = null;
    let subtabBar = null;

    /* ---------- Physics ---------- */
    function IcOfFlux(phiUnits, Ic0) {
      // Ic(Phi) = 2 Ic0 |cos(pi Phi/Phi0)|
      return 2 * Ic0 * Math.abs(Math.cos(Math.PI * phiUnits));
    }
    function fluxQuantum() { return C.PHYSICS.phi0; }
    function isSuperconducting(Ib, Ic) { return Ib <= Ic; }

    function resetSimulation() {
      state.mode = 'working'; state.phiFlux = 0; state.Ic0 = 10; state.Ib = 12; state.phase = 90; state.time = 0;
      if (subtabBar) subtabBar.set('working');
      if (ui.fluxSlider) ui.fluxSlider.setValue(0);
      if (ui.ic0Slider) ui.ic0Slider.setValue(10);
      if (ui.ibSlider) ui.ibSlider.setValue(12);
      if (ui.phaseSlider) ui.phaseSlider.setValue(90);
      syncControlVisibility();
      updateReadouts(); updateBanner(); render();
    }

    function syncControlVisibility() {
      const isWork = state.mode === 'working';
      if (ui.fluxWrap) ui.fluxWrap.style.display = isWork ? 'flex' : 'none';
      if (ui.ibWrap) ui.ibWrap.style.display = isWork ? 'flex' : 'none';
    }

    function buildDOM() {
      if (built) return;
      built = true;
      stage.innerHTML = ''; controls.innerHTML = ''; formula.innerHTML = '';

      const cv = X.el('canvas', 'viz');
      cv.id = 'cv-c5t8';
      cv.setAttribute('aria-label', 'DC-SQUID Laboratory: flux-periodic critical current');
      stage.append(cv);
      canvasObj = X.setupCanvas(cv);

      subtabBar = C.buildSubtabs(wrap, [
        { id: 'construction', label: 'Construction' },
        { id: 'working', label: 'Working (Ic vs Φ)' },
      ], state.mode, (id) => {
        state.mode = id;
        syncControlVisibility();
        updateReadouts(); updateBanner(); render();
      });

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

      ui.fluxSlider = X.buildSlider(controls, {
        label: 'External Flux Φ (in Φ₀)', id: 'c5t8-flux', min: -2, max: 2, step: 0.05, value: state.phiFlux,
        format: (v) => v.toFixed(2) + ' Φ₀',
        onInput: (v) => { state.phiFlux = v; updateReadouts(); updateBanner(); render(); },
      });
      ui.fluxWrap = ui.fluxSlider.input.closest('.slider-block');

      ui.ic0Slider = X.buildSlider(controls, {
        label: 'Junction Critical Current Ic₀', id: 'c5t8-Ic0', min: 2, max: 25, step: 0.5, value: state.Ic0,
        format: (v) => v.toFixed(1) + ' µA',
        onInput: (v) => { state.Ic0 = v; updateReadouts(); updateBanner(); render(); },
      });

      ui.ibSlider = X.buildSlider(controls, {
        label: 'Applied Bias Current Ib', id: 'c5t8-Ib', min: 0, max: 40, step: 0.5, value: state.Ib,
        format: (v) => v.toFixed(1) + ' µA',
        onInput: (v) => { state.Ib = v; updateReadouts(); updateBanner(); render(); },
      });
      ui.ibWrap = ui.ibSlider.input.closest('.slider-block');

      ui.phaseSlider = X.buildSlider(controls, { label: 'Common phase γ (degrees)', id: 'c5t8-phase', min: -180, max: 180, step: 1, value: state.phase, format: v => v.toFixed(0) + '°', onInput: v => { state.phase = v; updateReadouts(); render(); } });
      ui.readouts = X.buildReadouts(controls, [
        { id: 'current', label: 'Interference supercurrent' },
        { id: 'Phi', label: 'Flux Φ', primary: true },
        { id: 'Ic', label: 'Effective Ic(Φ)' },
        { id: 'Ib', label: 'Bias Ib' },
        { id: 'V', label: 'Voltage V' },
        { id: 'state', label: 'Device State', wide: true },
      ]);

      controls.append(X.el('div', 'ctrl-note',
        '<b>Ideal symmetric SQUID:</b> Ic(Φ) = 2Ic₀|cos(πΦ/Φ₀)|, Φ₀ = h/2e. Bias just below Ic(Φ): tiny flux change switches V = 0 ↔ V ≠ 0 — the magnetometer readout.'
      ));

      syncControlVisibility();
    }

    function updateReadouts() {
      if (!ui.readouts) return;
      const Ic = IcOfFlux(state.phiFlux, state.Ic0);
      const sc = isSuperconducting(state.Ib, Ic);
      ui.readouts.set('current', (2 * state.Ic0 * Math.sin(state.phase * Math.PI / 180) * Math.cos(Math.PI * state.phiFlux)).toFixed(2) + ' µA (ideal)');
      ui.readouts.set('Phi', state.phiFlux.toFixed(2) + ' Φ₀');
      ui.readouts.set('Ic', Ic.toFixed(2) + ' µA');
      ui.readouts.set('Ib', state.Ib.toFixed(1) + ' µA');
      ui.readouts.set('V', sc ? '0 (superconducting)' : 'Finite (resistive)');
      ui.readouts.set('state', sc ? 'Superconducting (Ib < Ic(Φ))' : 'Resistive (Ib > Ic(Φ)) — flux detected');
      formula.innerHTML =
        `<span class="formula active">Ic(Φ) = 2Ic₀|cos(πΦ/Φ₀)| = <span class="fv">${Ic.toFixed(2)} µA</span></span>` +
        `<span class="formula">Φ₀ = h/2e = <span class="fv">${fluxQuantum().toExponential(3)} Wb</span></span>`;
    }

    function updateBanner() {
      if (!banner) return;
      const Ic = IcOfFlux(state.phiFlux, state.Ic0);
      const sc = isSuperconducting(state.Ib, Ic);
      if (state.mode === 'construction') {
        banner.set('CONSTRUCTION · TWO JUNCTIONS IN A LOOP', '', 'Two Josephson junctions in parallel inside a superconducting loop. Bias current splits between arms; flux through the loop shifts their relative phase. Switch to <b>Working</b> to see Ic(Φ).');
      } else {
        banner.set(sc ? 'WORKING · SUPERCONDUCTING' : 'WORKING · RESISTIVE (FLUX DETECTED)', sc ? 'ok' : 'warn',
          `Φ = <b>${state.phiFlux.toFixed(2)} Φ₀</b> → Ic(Φ) = <b>${Ic.toFixed(2)} µA</b>. Bias Ib = ${state.Ib.toFixed(1)} µA is ${sc ? '<b>below</b> Ic (V = 0)' : '<b>above</b> Ic (V ≠ 0 — the SQUID has detected the flux)'}.`);
      }
    }

    function render() {
      if (!canvasObj) return;
      const { ctx, w, h } = canvasObj;
      ctx.clearRect(0, 0, w, h);
      const narrow = w < 620;
      const pad = narrow ? 12 : 20;

      const stageH = h * 0.54;
      const graphY = stageH + 8, graphH = h - graphY - 10;

      ctx.textAlign = 'left';
      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillText('DC-SQUID — superconducting loop with two Josephson junctions (' + (state.mode === 'construction' ? 'construction' : 'working') + ')', pad, 18);

      // Loop drawing: rectangle loop, J1 top, J2 bottom
      const cx = w / 2, cy = 36 + (stageH - 60) / 2;
      const lw = Math.min(300, w * 0.42), lh = Math.min(110, stageH - 90);
      const x0 = cx - lw / 2, x1 = cx + lw / 2, y0 = cy - lh / 2, y1 = cy + lh / 2;
      ctx.strokeStyle = '#34d399'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(x0, y0, lw, lh, 14); ctx.stroke();
      // Junctions: gaps on top and bottom edges
      ctx.fillStyle = '#0b101e';
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4;
      const jw = 34, jh = 14;
      ctx.beginPath(); ctx.roundRect(cx - jw / 2, y0 - jh / 2, jw, jh, 3); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(cx - jw / 2, y1 - jh / 2, jw, jh, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#edf1f8'; ctx.font = 'bold 10px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('J₁', cx, y0 + 4);
      ctx.fillText('J₂', cx, y1 + 4);
      // Bias current arrows (in at top-left, out at bottom-left)
      ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0 - 34, cy); ctx.lineTo(x0, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1, cy); ctx.lineTo(x1 + 34, cy); ctx.stroke();
      ctx.fillStyle = '#22d3ee'; ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText('Ib in', x0 - 55, cy - 7);
      ctx.fillText('Ib out', x1 + 35, cy - 7);
      // Flux indicator: B field through loop (dots/crosses density ∝ |Phi|)
      const fluxAbs = Math.abs(state.phiFlux);
      ctx.fillStyle = 'rgba(34,211,238,0.8)';
      const nFlux = Math.round(fluxAbs * 8);
      for (let i = 0; i < nFlux; i++) {
        const fx = x0 + lw * ((i * 0.37) % 1);
        const fy = y0 + lh * ((i * 0.53) % 1);
        ctx.beginPath(); ctx.arc(fx, fy, 2.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#22d3ee'; ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText('Φ = ' + state.phiFlux.toFixed(2) + ' Φ₀', cx + lw / 2 + 10, cy);
      ctx.fillText('Φ₀ = h/2e', cx + lw / 2 + 10, cy + 14);
      // Interference note
      ctx.fillStyle = '#8f9cb5'; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('Two paths interfere: relative junction phase = 2πΦ/Φ₀. Constructive at Φ = 0, destructive at Φ = Φ₀/2.', pad, y1 + 26);
      // Current dots in arms (density ∝ Ib)
      const t = state.time;
      const nDots = 6;
      for (let i = 0; i < nDots; i++) {
        const frac = ((t * 0.3 + i / nDots) % 1);
        // top arm (left to right) and bottom arm (right to left) — loop current split
        const tx = x0 + frac * lw, ty = y0;
        const bx = x0 + frac * lw, by = y1;
        ctx.fillStyle = '#34d399';
        ctx.beginPath(); ctx.arc(tx, ty, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI * 2); ctx.fill();
      }

      // Ic vs Phi graph
      const ax = pad + 44, ay = graphY + 16, aw = w - ax - pad - 8, ah = graphH - 30;
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax, ay + ah); ctx.lineTo(ax + aw, ay + ah); ctx.stroke();
      ctx.fillStyle = '#8f9cb5'; ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'left'; ctx.fillText('Ic(Φ) (µA)', ax, ay - 4);
      ctx.textAlign = 'center';
      ctx.fillText('−2Φ₀', ax, ay + ah + 13);
      ctx.fillText('0', ax + aw / 2, ay + ah + 13);
      ctx.fillText('+2Φ₀', ax + aw, ay + ah + 13);
      ctx.textAlign = 'left';
      const IcMax = 2 * state.Ic0;
      const Xg = (pu) => ax + aw * ((pu + 2) / 4);
      const Yg = (Iv) => ay + ah - ah * (Iv / (IcMax * 1.1));
      ctx.strokeStyle = '#34d399'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 160; i++) {
        const pu = -2 + (i / 160) * 4;
        const Iv = IcOfFlux(pu, state.Ic0);
        const px = Xg(pu), py = Yg(Iv);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      // Ib line
      ctx.strokeStyle = '#e08c3a'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(ax, Yg(state.Ib)); ctx.lineTo(ax + aw, Yg(state.Ib)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#e08c3a'; ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText('Ib = ' + state.Ib.toFixed(1) + ' µA', ax + aw - 90, Yg(state.Ib) - 5);
      // Operating point
      const IcNow = IcOfFlux(state.phiFlux, state.Ic0);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(Xg(state.phiFlux), Yg(IcNow), 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#edf1f8';
      ctx.fillText('Φ=' + state.phiFlux.toFixed(2) + 'Φ₀, Ic=' + IcNow.toFixed(2) + ' µA', Xg(state.phiFlux) + 8, Yg(IcNow) - 7);
    }

    function applyPreset(preset) {
      if (preset === 'construction') { state.mode = 'construction'; }
      else if (preset === 'working') { state.mode = 'working'; }
      else if (preset === 'max') { state.mode = 'working'; state.phiFlux = 0; }
      else if (preset === 'min') { state.mode = 'working'; state.phiFlux = 0.5; }
      else return;
      if (subtabBar) subtabBar.set(state.mode);
      if (ui.fluxSlider) ui.fluxSlider.setValue(state.phiFlux);
      syncControlVisibility();
      updateReadouts(); updateBanner(); render();
    }

    return {
      mount() {
        buildDOM();
        canvasObj = X.setupCanvas(document.getElementById('cv-c5t8'));
        updateReadouts(); updateBanner(); render();
      },
      unmount() {},
      tick(dt) {
        if (state.playing && !C.prefersReducedMotion()) state.time += dt;
        render();
      },
      resize() {
        const cv = document.getElementById('cv-c5t8');
        if (cv) canvasObj = X.setupCanvas(cv);
        render();
      },
      applyPreset,
      IcOfFlux, fluxQuantum, isSuperconducting,
      getState: () => state,
    };
  };
})();
