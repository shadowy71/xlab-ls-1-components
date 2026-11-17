(function () {
  'use strict';

  const C = window.Ch5Platform;
  const X = window.XLab;

  window.CH5_SIMS['c5t3'] = function createGMRLab(ctxDom) {
    const { stage, controls, formula, wrap, dot } = ctxDom;

    const state = {
      thetaDeg: 0,     // relative angle between FM layers (0..180)
      RP: 10,          // parallel resistance (ohm, illustrative)
      RAP: 15,         // antiparallel resistance (ohm, illustrative)
      playing: true,
      time: 0,
      electrons: [],   // {x,y,spin(+1/-1),vx}
    };

    let built = false;
    let canvasObj = null;
    let ui = {};
    let banner = null;

    /* ---------- Physics ---------- */
    function resistance(thetaDeg, RP, RAP) {
      const th = thetaDeg * Math.PI / 180;
      return RP + (RAP - RP) * (1 - Math.cos(th)) / 2;
    }
    function magnetoresistance(RP, RAP) {
      return RP === 0 ? 0 : (RAP - RP) / RP;
    }
    function stateLabel(thetaDeg) {
      if (thetaDeg < 15) return 'Parallel — low R';
      if (thetaDeg > 165) return 'Antiparallel — high R';
      return 'Intermediate angle';
    }

    function initElectrons(w) {
      state.electrons = [];
      for (let i = 0; i < 26; i++) {
        state.electrons.push({
          x: Math.random() * w,
          y: Math.random(),
          spin: Math.random() < 0.5 ? 1 : -1,
          vx: 40 + Math.random() * 50,
        });
      }
    }

    function resetSimulation() {
      state.thetaDeg = 0; state.RP = 10; state.RAP = 15; state.time = 0;
      if (ui.thetaSlider) ui.thetaSlider.setValue(0);
      if (ui.rpSlider) ui.rpSlider.setValue(10);
      if (ui.rapSlider) ui.rapSlider.setValue(15);
      updateReadouts(); updateBanner(); render();
    }

    function buildDOM() {
      if (built) return;
      built = true;
      stage.innerHTML = ''; controls.innerHTML = ''; formula.innerHTML = '';

      const cv = X.el('canvas', 'viz');
      cv.id = 'cv-c5t3';
      cv.setAttribute('aria-label', 'GMR Spin-Valve Laboratory: resistance versus magnetization angle');
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

      C.buildActionRow(controls, [
        { id: 'par', label: 'Parallel (0°)', primary: true, onClick: () => applyPreset('parallel') },
        { id: 'anti', label: 'Antiparallel (180°)', onClick: () => applyPreset('antiparallel') },
        { id: 'perp', label: 'Perpendicular (90°)', onClick: () => applyPreset('perpendicular') },
      ]);

      ui.thetaSlider = X.buildSlider(controls, {
        label: 'Relative Angle θ (FM₂ vs FM₁)', id: 'c5t3-theta', min: 0, max: 180, step: 1, value: state.thetaDeg,
        format: (v) => v.toFixed(0) + '°',
        onInput: (v) => { state.thetaDeg = v; updateReadouts(); updateBanner(); render(); },
      });

      ui.rpSlider = X.buildSlider(controls, {
        label: 'Parallel Resistance RP (illustrative)', id: 'c5t3-RP', min: 2, max: 30, step: 0.5, value: state.RP,
        format: (v) => v.toFixed(1) + ' Ω',
        onInput: (v) => { state.RP = v; updateReadouts(); updateBanner(); render(); },
      });

      ui.rapSlider = X.buildSlider(controls, {
        label: 'Antiparallel Resistance RAP (illustrative)', id: 'c5t3-RAP', min: 2, max: 40, step: 0.5, value: state.RAP,
        format: (v) => v.toFixed(1) + ' Ω',
        onInput: (v) => { state.RAP = v; updateReadouts(); updateBanner(); render(); },
      });

      ui.readouts = X.buildReadouts(controls, [
        { id: 'R', label: 'Resistance R(θ)', primary: true },
        { id: 'theta', label: 'Angle θ' },
        { id: 'MR', label: 'Magnetoresistance (RAP−RP)/RP' },
        { id: 'state', label: 'Configuration', wide: true },
      ]);

      controls.append(X.el('div', 'ctrl-note',
        '<b>Phenomenological model:</b> R(θ) = RP + (RAP−RP)(1−cosθ)/2 interpolates the parallel/antiparallel limits. It is <b>not</b> a full microscopic transport calculation. RP/RAP are illustrative teaching values.'
      ));
    }

    function updateReadouts() {
      if (!ui.readouts) return;
      const R = resistance(state.thetaDeg, state.RP, state.RAP);
      const mr = magnetoresistance(state.RP, state.RAP);
      ui.readouts.set('R', R.toFixed(2) + ' Ω');
      ui.readouts.set('theta', state.thetaDeg.toFixed(0) + '°');
      ui.readouts.set('MR', (mr * 100).toFixed(1) + '%');
      ui.readouts.set('state', stateLabel(state.thetaDeg) + ' · R = ' + R.toFixed(2) + ' Ω');
      formula.innerHTML =
        `<span class="formula active">R(θ) = RP + (RAP−RP)(1−cosθ)/2 = <span class="fv">${R.toFixed(2)} Ω</span></span>` +
        `<span class="formula">RP = <span class="fv">${state.RP.toFixed(1)} Ω</span></span>` +
        `<span class="formula">RAP = <span class="fv">${state.RAP.toFixed(1)} Ω</span></span>`;
    }

    function updateBanner() {
      if (!banner) return;
      const R = resistance(state.thetaDeg, state.RP, state.RAP);
      if (state.thetaDeg < 15) banner.set('PARALLEL · LOW RESISTANCE', 'ok', `Both layers magnetized the same way: majority-spin electrons pass FM₁ <b>and</b> FM₂. Resistance is low (<b>R = ${R.toFixed(2)} Ω</b>).`);
      else if (state.thetaDeg > 165) banner.set('ANTIPARALLEL · HIGH RESISTANCE', 'warn', `Layers oppose each other: electrons polarized by FM₁ are <b>scattered</b> by FM₂. Resistance is high (<b>R = ${R.toFixed(2)} Ω</b>).`);
      else banner.set('INTERMEDIATE ANGLE', '', `At θ = ${state.thetaDeg.toFixed(0)}° the resistance interpolates: <b>R = ${R.toFixed(2)} Ω</b> between RP and RAP.`);
    }

    function drawMagnetArrow(ctx, x, y, angle, len, col) {
      const dx = Math.cos(angle) * len, dy = Math.sin(angle) * len;
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x + dx, y + dy); ctx.stroke();
      const ha = Math.atan2(dy, dx);
      ctx.beginPath();
      ctx.moveTo(x + dx, y + dy);
      ctx.lineTo(x + dx - 7 * Math.cos(ha - 0.45), y + dy - 7 * Math.sin(ha - 0.45));
      ctx.lineTo(x + dx - 7 * Math.cos(ha + 0.45), y + dy - 7 * Math.sin(ha + 0.45));
      ctx.closePath(); ctx.fill();
    }

    function render() {
      if (!canvasObj) return;
      const { ctx, w, h } = canvasObj;
      ctx.clearRect(0, 0, w, h);
      const narrow = w < 620;
      const pad = narrow ? 12 : 20;

      const stageH = h * 0.58;
      const graphY = stageH + 8, graphH = h - graphY - 10;

      ctx.textAlign = 'left';
      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillText('Spin valve: FM₁ / NM spacer / FM₂ — current flows left → right', pad, 18);

      // Layer geometry (vertical layers, current horizontal)
      const ly = 36, lh = stageH - 70;
      const totalW = w - 2 * pad - 40;
      const fm1W = totalW * 0.28, nmW = totalW * 0.16, fm2W = totalW * 0.28;
      const lx = pad + 20;
      const fm1X = lx, nmX = fm1X + fm1W, fm2X = nmX + nmW;
      const th = state.thetaDeg * Math.PI / 180;

      // FM1
      ctx.fillStyle = 'rgba(244,114,182,0.16)';
      ctx.strokeStyle = 'rgba(244,114,182,0.6)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect(fm1X, ly, fm1W, lh, 6); ctx.fill(); ctx.stroke();
      // NM
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.roundRect(nmX, ly, nmW, lh, 4); ctx.fill(); ctx.stroke();
      // FM2
      ctx.fillStyle = 'rgba(34,211,238,0.14)';
      ctx.strokeStyle = 'rgba(34,211,238,0.6)';
      ctx.beginPath(); ctx.roundRect(fm2X, ly, fm2W, lh, 6); ctx.fill(); ctx.stroke();

      ctx.fillStyle = '#edf1f8'; ctx.font = 'bold 10.5px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('FM₁ (fixed)', fm1X + fm1W / 2, ly + 14);
      ctx.fillText('NM spacer', nmX + nmW / 2, ly + 14);
      ctx.fillText('FM₂ (rotated θ)', fm2X + fm2W / 2, ly + 14);
      ctx.textAlign = 'left';

      // Magnetization arrows: FM1 horizontal (0), FM2 at angle th (in plane)
      const cy = ly + lh / 2;
      drawMagnetArrow(ctx, fm1X + fm1W / 2, cy, 0, 26, '#f472b6');
      // FM2 arrow rotated: use angle th from horizontal, drawn in plane
      drawMagnetArrow(ctx, fm2X + fm2W / 2, cy, th, 26, '#22d3ee');
      ctx.fillStyle = '#8f9cb5'; ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText('M₁ →', fm1X + 6, ly + lh - 8);
      ctx.fillText('M₂ at θ = ' + state.thetaDeg.toFixed(0) + '°', fm2X + 6, ly + lh - 8);

      // Electrons: spin-up (cyan) and spin-down (pink) moving left->right
      // Transmission: spin matching FM2 passes; mismatched scatter (jitter + reflect chance)
      const R = resistance(state.thetaDeg, state.RP, state.RAP);
      const passProb = 1 - (R - state.RP) / Math.max(1e-9, (state.RAP - state.RP)); // 1 at parallel, 0 at antiparallel
      if (state.electrons.length === 0) initElectrons(w);
      const eTop = ly + 24, eBot = ly + lh - 24;
      state.electrons.forEach((e) => {
        // map e.x (0..w) into stage coords
        const ex = lx + (e.x % totalW);
        const ey = eTop + e.y * (eBot - eTop);
        const col = e.spin > 0 ? '#22d3ee' : '#f472b6';
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(ex, ey, 3.2, 0, Math.PI * 2); ctx.fill();
        // spin arrow (up/down)
        ctx.strokeStyle = col; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex, ey - e.spin * 6); ctx.stroke();
        // scattering indicator in FM2 if mismatched & antiparallel-ish
        const inFM2 = ex > fm2X && ex < fm2X + fm2W;
        if (inFM2 && passProb < 0.5 && e.spin < 0) {
          ctx.strokeStyle = 'rgba(224,140,58,0.7)';
          ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + 6, ey - 6); ctx.stroke();
        }
      });
      ctx.fillStyle = '#8f9cb5'; ctx.font = '10px Inter, sans-serif';
      ctx.fillText('● spin-up (cyan)  ● spin-down (pink) — spin arrows ↑/↓. Transmission falls as θ → 180°.', pad, ly + lh + 14);

      // --- R(θ) graph ---
      const ax = pad + 44, ay = graphY + 16, aw = w - ax - pad - 8, ah = graphH - 30;
      const Rmin = Math.min(state.RP, state.RAP) * 0.9, Rmax = Math.max(state.RP, state.RAP) * 1.1;
      const Xg = (deg) => ax + aw * (deg / 180);
      const Yg = (Rv) => ay + ah - ah * ((Rv - Rmin) / (Rmax - Rmin));
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax, ay + ah); ctx.lineTo(ax + aw, ay + ah); ctx.stroke();
      ctx.fillStyle = '#8f9cb5'; ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(Rmax.toFixed(1), ax - 5, Yg(Rmax) + 3);
      ctx.fillText(Rmin.toFixed(1), ax - 5, Yg(Rmin) + 3);
      ctx.textAlign = 'center';
      ctx.fillText('0° (P)', Xg(0), ay + ah + 13);
      ctx.fillText('90°', Xg(90), ay + ah + 13);
      ctx.fillText('180° (AP)', Xg(180), ay + ah + 13);
      ctx.textAlign = 'left';
      ctx.fillText('R(θ) (Ω)', ax, ay - 4);
      ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const deg = (i / 120) * 180;
        const Rv = resistance(deg, state.RP, state.RAP);
        const px = Xg(deg), py = Yg(Rv);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(Xg(state.thetaDeg), Yg(R), 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#edf1f8'; ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText('θ = ' + state.thetaDeg.toFixed(0) + '°, R = ' + R.toFixed(2) + ' Ω', Xg(state.thetaDeg) + 8, Yg(R) - 7);
    }

    function applyPreset(preset) {
      if (preset === 'parallel') state.thetaDeg = 0;
      else if (preset === 'antiparallel') state.thetaDeg = 180;
      else if (preset === 'perpendicular') state.thetaDeg = 90;
      else return;
      if (ui.thetaSlider) ui.thetaSlider.setValue(state.thetaDeg);
      updateReadouts(); updateBanner(); render();
    }

    return {
      mount() {
        buildDOM();
        canvasObj = X.setupCanvas(document.getElementById('cv-c5t3'));
        initElectrons(canvasObj.w);
        updateReadouts(); updateBanner(); render();
      },
      unmount() {},
      tick(dt) {
        if (state.playing && !C.prefersReducedMotion()) {
          state.time += dt;
          const w = canvasObj ? canvasObj.w : 600;
          state.electrons.forEach((e) => {
            e.x += e.vx * dt;
            if (e.x > w) { e.x = 0; e.y = Math.random(); e.spin = Math.random() < 0.5 ? 1 : -1; }
          });
        }
        render();
      },
      resize() {
        const cv = document.getElementById('cv-c5t3');
        if (cv) canvasObj = X.setupCanvas(cv);
        render();
      },
      applyPreset,
      resistance,
      magnetoresistance,
      getState: () => state,
    };
  };
})();
