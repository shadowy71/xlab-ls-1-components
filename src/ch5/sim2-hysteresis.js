(function () {
  'use strict';

  const C = window.Ch5Platform;
  const X = window.XLab;

  window.CH5_SIMS['c5t2'] = function createHysteresisLab(ctxDom) {
    const { stage, controls, formula, wrap, dot } = ctxDom;

    // Simplified phenomenological tanh-branch model (labelled, not measured data)
    // M(H) on rising branch:  Ms*tanh((H-Hc)/Hs); falling: Ms*tanh((H+Hc)/Hs)
    // B = mu0*(H+M). H in A/m, M in A/m, B in T.
    const MATERIALS = {
      soft: { name: 'Soft magnet', Ms: 800000, Hc: 40, Hs: 120, col: '#22d3ee' },
      hard: { name: 'Hard magnet', Ms: 900000, Hc: 450, Hs: 260, col: '#f472b6' },
    };
    const MU0 = C.PHYSICS.mu0;

    const state = {
      material: 'soft',
      Hmax: 1200,      // sweep amplitude (A/m)
      speed: 1.0,      // sweep speed multiplier
      H: 1200,         // current applied field (A/m)
      dir: -1,         // sweep direction: -1 falling (+ to -), +1 rising
      playing: true,
      auto: true,      // auto sweep on/off
      time: 0,
      trace: [],       // traced loop points {H,B}
      cycles: 0,
    };

    let built = false;
    let canvasObj = null;
    let ui = {};
    let banner = null;

    /* ---------- Physics ---------- */
    function params() { return MATERIALS[state.material]; }
    function Mbranch(H, p, rising) {
      // rising: H increasing; falling: H decreasing
      const shift = rising ? -p.Hc : p.Hc;
      return p.Ms * Math.tanh((H + shift) / p.Hs);
    }
    function BofH(H, p, rising) {
      return MU0 * (H + Mbranch(H, p, rising));
    }
    function saturationB(p) { return MU0 * (p.Ms + 1500); } // approx at large H
    function remanenceB(p) { return MU0 * p.Ms * Math.tanh(p.Hc / p.Hs); } // |B| at H=0
    function coercivity(p) { return p.Hc; }
    // Loop area = ∮ H dB over closed loop (J/m^3 per cycle), numeric integration
    function loopArea(p, Hmax) {
      const N = 400;
      let area = 0;
      let prevH = Hmax, prevB = BofH(Hmax, p, false);
      // falling branch: +Hmax -> -Hmax
      for (let i = 1; i <= N; i++) {
        const H = Hmax - (2 * Hmax * i) / N;
        const B = BofH(H, p, false);
        area += 0.5 * (prevH + H) * (B - prevB);
        prevH = H; prevB = B;
      }
      // rising branch: -Hmax -> +Hmax
      for (let i = 1; i <= N; i++) {
        const H = -Hmax + (2 * Hmax * i) / N;
        const B = BofH(H, p, true);
        area += 0.5 * (prevH + H) * (B - prevB);
        prevH = H; prevB = B;
      }
      return Math.abs(area);
    }

    function resetSimulation() {
      state.material = 'soft';
      state.Hmax = 1200; state.speed = 1.0;
      state.H = 1200; state.dir = -1; state.auto = true; state.playing = true;
      state.trace = []; state.cycles = 0; state.time = 0;
      if (ui.matSeg) ui.matSeg.set('soft');
      if (ui.hmaxSlider) ui.hmaxSlider.setValue(1200);
      if (ui.speedSlider) ui.speedSlider.setValue(1.0);
      if (ui.transport) ui.transport.setPlaying(true);
      if (dot) dot.textContent = 'Live';
      updateReadouts(); updateBanner(); render();
    }

    function buildDOM() {
      if (built) return;
      built = true;
      stage.innerHTML = ''; controls.innerHTML = ''; formula.innerHTML = '';

      const cv = X.el('canvas', 'viz');
      cv.id = 'cv-c5t2';
      cv.setAttribute('aria-label', 'Magnetic Hysteresis Laboratory: B-H loop tracing');
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

      ui.matSeg = X.buildSegmented(controls, {
        options: [
          { value: 'soft', label: 'Soft magnet' },
          { value: 'hard', label: 'Hard magnet' },
        ],
        value: state.material,
        onChange: (v) => {
          state.material = v; state.trace = []; state.H = state.Hmax; state.dir = -1;
          updateReadouts(); updateBanner(); render();
        },
      });

      ui.hmaxSlider = X.buildSlider(controls, {
        label: 'Field Amplitude Hmax', id: 'c5t2-Hmax', min: 1200, max: 2000, step: 50, value: state.Hmax,
        format: (v) => v.toFixed(0) + ' A/m',
        onInput: (v) => { state.Hmax = v; updateReadouts(); updateBanner(); render(); },
      });

      ui.speedSlider = X.buildSlider(controls, {
        label: 'Sweep Speed', id: 'c5t2-speed', min: 0.2, max: 3, step: 0.1, value: state.speed,
        format: (v) => v.toFixed(1) + '×',
        onInput: (v) => { state.speed = v; },
      });

      C.buildActionRow(controls, [
        { id: 'inc', label: 'H + (increase)', onClick: () => { state.auto = false; if (ui.autoToggle) ui.autoToggle.checked = false; state.H = Math.min(state.Hmax, state.H + 150); state.dir = 1; pushTrace(); updateReadouts(); updateBanner(); render(); } },
        { id: 'dec', label: 'H − (decrease)', onClick: () => { state.auto = false; if (ui.autoToggle) ui.autoToggle.checked = false; state.H = Math.max(-state.Hmax, state.H - 150); state.dir = -1; pushTrace(); updateReadouts(); updateBanner(); render(); } },
        { id: 'rev', label: 'Reverse field', onClick: () => { state.dir = -state.dir; pushTrace(); updateReadouts(); updateBanner(); render(); } },
        { id: 'cycle', label: 'Run full cycle', primary: true, onClick: () => { state.H = state.Hmax; state.dir = -1; state.auto = true; if (ui.autoToggle) ui.autoToggle.checked = true; state.playing = true; if (ui.transport) ui.transport.setPlaying(true); state.trace = []; updateReadouts(); updateBanner(); render(); } },
      ]);

      ui.autoToggle = X.buildToggle(controls, {
        label: 'Auto sweep (triangular H)',
        checked: state.auto,
        onChange: (on) => { state.auto = on; },
      });

      ui.readouts = X.buildReadouts(controls, [
        { id: 'H', label: 'Applied H', primary: true },
        { id: 'B', label: 'Flux Density B' },
        { id: 'Bs', label: 'Saturation Bs' },
        { id: 'Br', label: 'Remanence Br' },
        { id: 'Hc', label: 'Coercivity Hc' },
        { id: 'area', label: 'Loop Area ∮H dB', wide: true },
        { id: 'loss', label: 'Energy Loss / Volume / Cycle' },
      ]);

      controls.append(X.el('div', 'ctrl-note',
        '<b>Simplified model:</b> tanh-branch hysteresis M = Ms·tanh((H±Hc)/Hs), B = μ₀(H+M). Loop area = energy loss per unit volume per cycle. Parameters are illustrative, not measured material data.'
      ));
    }

    function pushTrace() {
      const p = params();
      const B = BofH(state.H, p, state.dir > 0);
      state.trace.push({ H: state.H, B });
      if (state.trace.length > 1200) state.trace.shift();
    }

    function updateReadouts() {
      if (!ui.readouts) return;
      const p = params();
      const B = BofH(state.H, p, state.dir > 0);
      const area = loopArea(p, state.Hmax);
      ui.readouts.set('H', state.H.toFixed(0) + ' A/m');
      ui.readouts.set('B', B.toFixed(3) + ' T');
      ui.readouts.set('Bs', saturationB(p).toFixed(3) + ' T');
      ui.readouts.set('Br', '±' + remanenceB(p).toFixed(3) + ' T');
      ui.readouts.set('Hc', p.Hc.toFixed(0) + ' A/m');
      ui.readouts.set('area', area.toFixed(1) + ' J/m³');
      ui.readouts.set('loss', area.toFixed(1) + ' J/m³/cycle');
      formula.innerHTML =
        `<span class="formula active">B = μ₀(H + M) → <span class="fv">${B.toFixed(3)} T</span></span>` +
        `<span class="formula">Br = <span class="fv">${remanenceB(p).toFixed(3)} T</span></span>` +
        `<span class="formula">Hc = <span class="fv">${p.Hc.toFixed(0)} A/m</span></span>` +
        `<span class="formula">Loss = ∮H dB = <span class="fv">${area.toFixed(1)} J/m³/cycle</span></span>`;
    }

    function updateBanner() {
      if (!banner) return;
      const p = params();
      if (state.material === 'soft') {
        banner.set('SOFT MAGNET · NARROW LOOP', 'ok', `Low coercivity <b>Hc = ${p.Hc} A/m</b>, narrow loop, low loss. Easy to magnetize and demagnetize — ideal for transformer cores where loss per cycle must be small.`);
      } else {
        banner.set('HARD MAGNET · WIDE LOOP', '', `High coercivity <b>Hc = ${p.Hc} A/m</b>, wide loop, strong remanence. Retains magnetization — a permanent magnet. Higher loss per cycle.`);
      }
    }

    function render() {
      if (!canvasObj) return;
      const { ctx, w, h } = canvasObj;
      ctx.clearRect(0, 0, w, h);
      const narrow = w < 620;
      const pad = narrow ? 12 : 20;
      const p = params();
      const other = MATERIALS[state.material === 'soft' ? 'hard' : 'soft'];

      // Layout: B-H graph top (~62%), domain strip bottom
      const graphH = h * 0.62;
      const ax = pad + 46, ay = 30, aw = w - ax - pad - 10, ah = graphH - 52;
      const Hlim = 2000, Blim = 1.35;
      const Xg = (H) => ax + aw * ((H + Hlim) / (2 * Hlim));
      const Yg = (B) => ay + ah - ah * ((B + Blim) / (2 * Blim));

      ctx.textAlign = 'left';
      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillText('B–H hysteresis loop — ' + p.name + ' (solid) vs ' + other.name + ' (ghost)', pad, 18);

      // Grid + axes
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const gx = ax + aw * i / 4;
        ctx.beginPath(); ctx.moveTo(gx, ay); ctx.lineTo(gx, ay + ah); ctx.stroke();
        const gy = ay + ah * i / 4;
        ctx.beginPath(); ctx.moveTo(ax, gy); ctx.lineTo(ax + aw, gy); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath(); ctx.moveTo(ax, ay + ah / 2); ctx.lineTo(ax + aw, ay + ah / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ax + aw / 2, ay); ctx.lineTo(ax + aw / 2, ay + ah); ctx.stroke();
      ctx.fillStyle = '#8f9cb5'; ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('−2000', Xg(-2000), ay + ah + 13);
      ctx.fillText('0', Xg(0), ay + ah + 13);
      ctx.fillText('+2000 A/m → H', Xg(2000), ay + ah + 13);
      ctx.textAlign = 'right';
      ctx.fillText('+1.35 T', ax - 5, Yg(1.35) + 3);
      ctx.fillText('0', ax - 5, Yg(0) + 3);
      ctx.fillText('−1.35 T', ax - 5, Yg(-1.35) + 3);
      ctx.textAlign = 'left';
      ctx.fillText('B (T) ↑', ax, ay - 6);

      // Ghost loop (other material, full)
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath();
      for (let i = 0; i <= 160; i++) {
        const H = Hlim - (2 * Hlim * i) / 160;
        const B = BofH(H, other, false);
        const px = Xg(H), py = Yg(B);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i <= 160; i++) {
        const H = -Hlim + (2 * Hlim * i) / 160;
        const B = BofH(H, other, true);
        const px = Xg(H), py = Yg(B);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Full loop (current material, faint)
      ctx.strokeStyle = p.col; ctx.globalAlpha = 0.22; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i <= 160; i++) {
        const H = Hlim - (2 * Hlim * i) / 160;
        const B = BofH(H, p, false);
        const px = Xg(H), py = Yg(B);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i <= 160; i++) {
        const H = -Hlim + (2 * Hlim * i) / 160;
        const B = BofH(H, p, true);
        const px = Xg(H), py = Yg(B);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Traced loop (bright, real-time)
      if (state.trace.length > 1) {
        ctx.strokeStyle = p.col; ctx.lineWidth = 2.2;
        ctx.beginPath();
        state.trace.forEach((pt, i) => {
          const px = Xg(pt.H), py = Yg(pt.B);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.stroke();
      }

      // Markers: Br, Hc, Bs
      const Br = remanenceB(p);
      ctx.fillStyle = '#e0b553';
      ctx.beginPath(); ctx.arc(Xg(0), Yg(Br), 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(Xg(0), Yg(-Br), 4, 0, Math.PI * 2); ctx.fill();
      ctx.font = '10px JetBrains Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText('Br', Xg(0) + 7, Yg(Br) + 3);
      ctx.fillStyle = '#34d399';
      ctx.beginPath(); ctx.arc(Xg(-p.Hc), Yg(0), 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(Xg(p.Hc), Yg(0), 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillText('Hc', Xg(p.Hc) + 7, Yg(0) - 6);
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath(); ctx.arc(Xg(state.Hmax), Yg(BofH(state.Hmax, p, false)), 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillText('Bs', Xg(state.Hmax) - 26, Yg(BofH(state.Hmax, p, false)) - 7);

      // Current point
      const Bc = BofH(state.H, p, state.dir > 0);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(Xg(state.H), Yg(Bc), 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = p.col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(Xg(state.H), Yg(Bc), 8, 0, Math.PI * 2); ctx.stroke();

      // --- Domain strip (bottom): alignment = M/Ms ---
      const dy = graphH + 14, dh = h - dy - 10;
      const M = Mbranch(state.H, p, state.dir > 0);
      const frac = M / p.Ms; // -1..1
      ctx.fillStyle = '#edf1f8'; ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText('Magnetic domains — alignment M/Ms = ' + frac.toFixed(2) + ' (H = ' + state.H.toFixed(0) + ' A/m)', pad, dy + 12);
      const bx = pad + 8, bw = w - 2 * pad - 16, by = dy + 20, bh = dh - 26;
      ctx.fillStyle = 'rgba(34,211,238,0.05)';
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 6); ctx.fill(); ctx.stroke();
      // Domain arrows: fraction aligned with +x proportional to frac
      const nDom = 24;
      for (let i = 0; i < nDom; i++) {
        const x = bx + 16 + (bw - 32) * (i / (nDom - 1));
        const y = by + bh / 2;
        const aligned = (i / nDom) < (frac + 1) / 2;
        const ang = aligned ? 0 : Math.PI;
        const dx = Math.cos(ang) * 7, dyy = Math.sin(ang) * 7;
        ctx.strokeStyle = aligned ? p.col : 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(x - dx, y - dyy); ctx.lineTo(x + dx, y + dyy); ctx.stroke();
      }
      ctx.fillStyle = '#8f9cb5'; ctx.font = '10px Inter, sans-serif';
      ctx.fillText('Domains rotate/grow with H — loop area = heat per volume per cycle', bx + 4, by + bh - 5);
    }

    function applyPreset(preset) {
      if (preset === 'soft' || preset === 'hard') {
        state.material = preset; state.trace = []; state.H = state.Hmax; state.dir = -1;
        if (ui.matSeg) ui.matSeg.set(preset);
      } else if (preset === 'cycle') {
        state.H = state.Hmax; state.dir = -1; state.auto = true; state.playing = true;
        state.trace = [];
        if (ui.transport) ui.transport.setPlaying(true);
        if (ui.autoToggle) ui.autoToggle.checked = true;
      } else return;
      updateReadouts(); updateBanner(); render();
    }

    return {
      mount() {
        buildDOM();
        canvasObj = X.setupCanvas(document.getElementById('cv-c5t2'));
        updateReadouts(); updateBanner(); render();
      },
      unmount() {},
      tick(dt) {
        if (state.playing && state.auto) {
          const rate = 900 * state.speed; // A/m per second
          state.H += state.dir * rate * dt;
          if (state.H >= state.Hmax) { state.H = state.Hmax; state.dir = -1; }
          if (state.H <= -state.Hmax) { state.H = -state.Hmax; state.dir = 1; state.cycles++; }
          pushTrace();
          updateReadouts();
        }
        render();
      },
      resize() {
        const cv = document.getElementById('cv-c5t2');
        if (cv) canvasObj = X.setupCanvas(cv);
        render();
      },
      applyPreset,
      Mbranch, BofH, loopArea, remanenceB, coercivity,
      getState: () => state,
    };
  };
})();
