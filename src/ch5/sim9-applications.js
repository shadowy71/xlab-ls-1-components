(function () {
  'use strict';

  const C = window.Ch5Platform;
  const X = window.XLab;

  window.CH5_SIMS['c5t9'] = function createApplicationsLab(ctxDom) {
    const { stage, controls, formula, wrap, dot } = ctxDom;

    const state = {
      subtab: 'magnet',   // 'magnet' | 'maglev'
      I: 100,             // coil current (A)
      N: 100,             // number of windings
      persistent: true,   // persistent-current mode
      T: 4,               // temperature (K) for maglev
      Tc: 10,             // illustrative Tc (K)
      gap: 10,            // levitation gap (mm)
      maglevMode: 'levitation', // 'levitation' (Meissner) | 'pinning' (flux pinning)
      moving: false,      // train moving
      trainX: 0,          // train position 0..1
      showField: true,
      playing: true,
      time: 0,
    };

    let built = false;
    let canvasObj = null;
    let ui = {};
    let banner = null;
    let subtabBar = null;

    /* ---------- Physics (simplified, labelled) ---------- */
    // Simplified magnet: B = k*N*I (k illustrative, labelled)
    function magnetB(N, I) {
      return 0.0001 * N * I; // T: N=100, I=100A -> 1.0 T
    }
    function coilPower(I, R) { return I * I * R; }
    function isSC(T, Tc) { return T < Tc; }

    function resetSimulation() {
      state.subtab = 'magnet';
      state.I = 100; state.N = 100; state.persistent = true;
      state.T = 4; state.Tc = 10; state.gap = 10;
      state.maglevMode = 'levitation'; state.moving = false; state.trainX = 0;
      if (subtabBar) subtabBar.set('magnet');
      if (ui.iSlider) ui.iSlider.setValue(100);
      if (ui.nSlider) ui.nSlider.setValue(100);
      if (ui.persistToggle) ui.persistToggle.checked = true;
      if (ui.tSlider) ui.tSlider.setValue(4);
      if (ui.tcSlider) ui.tcSlider.setValue(10);
      if (ui.gapSlider) ui.gapSlider.setValue(10);
      if (ui.modeSeg) ui.modeSeg.set('levitation');
      syncControlVisibility();
      updateReadouts(); updateBanner(); render();
    }

    function syncControlVisibility() {
      const isMag = state.subtab === 'magnet';
      if (ui.iWrap) ui.iWrap.style.display = isMag ? 'flex' : 'none';
      if (ui.nWrap) ui.nWrap.style.display = isMag ? 'flex' : 'none';
      if (ui.persistWrap) ui.persistWrap.style.display = isMag ? 'flex' : 'none';
      if (ui.tWrap) ui.tWrap.style.display = isMag ? 'none' : 'flex';
      if (ui.tcWrap) ui.tcWrap.style.display = isMag ? 'none' : 'flex';
      if (ui.gapWrap) ui.gapWrap.style.display = isMag ? 'none' : 'flex';
      if (ui.modeWrap) ui.modeWrap.style.display = isMag ? 'none' : 'flex';
      if (ui.moveWrap) ui.moveWrap.style.display = isMag ? 'none' : 'flex';
    }

    function buildDOM() {
      if (built) return;
      built = true;
      stage.innerHTML = ''; controls.innerHTML = ''; formula.innerHTML = '';

      const cv = X.el('canvas', 'viz');
      cv.id = 'cv-c5t9';
      cv.setAttribute('aria-label', 'Superconducting Applications Laboratory: magnets and maglev');
      stage.append(cv);
      canvasObj = X.setupCanvas(cv);

      subtabBar = C.buildSubtabs(wrap, [
        { id: 'magnet', label: 'Superconducting Magnet' },
        { id: 'maglev', label: 'Maglev Train' },
      ], state.subtab, (id) => {
        state.subtab = id;
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

      ui.iSlider = X.buildSlider(controls, {
        label: 'Coil Current I', id: 'c5t9-I', min: 0, max: 300, step: 5, value: state.I,
        format: (v) => v.toFixed(0) + ' A',
        onInput: (v) => { state.I = v; updateReadouts(); updateBanner(); render(); },
      });
      ui.iWrap = ui.iSlider.input.closest('.slider-block');

      ui.nSlider = X.buildSlider(controls, {
        label: 'Number of Windings N', id: 'c5t9-N', min: 10, max: 300, step: 5, value: state.N,
        format: (v) => v.toFixed(0),
        onInput: (v) => { state.N = v; updateReadouts(); updateBanner(); render(); },
      });
      ui.nWrap = ui.nSlider.input.closest('.slider-block');

      ui.persistToggle = X.buildToggle(controls, {
        label: 'Persistent-current mode (no supply)',
        checked: state.persistent,
        onChange: (on) => { state.persistent = on; updateReadouts(); updateBanner(); render(); },
      });
      ui.persistWrap = ui.persistToggle.closest('.toggle-row');

      ui.tSlider = X.buildSlider(controls, {
        label: 'Temperature T', id: 'c5t9-T', min: 0.5, max: 30, step: 0.5, value: state.T,
        format: (v) => v.toFixed(1) + ' K',
        onInput: (v) => { state.T = v; updateReadouts(); updateBanner(); render(); },
      });
      ui.tWrap = ui.tSlider.input.closest('.slider-block');

      ui.tcSlider = X.buildSlider(controls, {
        label: 'Critical Temperature Tc (illustrative)', id: 'c5t9-Tc', min: 2, max: 30, step: 0.5, value: state.Tc,
        format: (v) => v.toFixed(1) + ' K',
        onInput: (v) => { state.Tc = v; updateReadouts(); updateBanner(); render(); },
      });
      ui.tcWrap = ui.tcSlider.input.closest('.slider-block');

      ui.gapSlider = X.buildSlider(controls, {
        label: 'Levitation Gap', id: 'c5t9-gap', min: 2, max: 30, step: 1, value: state.gap,
        format: (v) => v.toFixed(0) + ' mm',
        onInput: (v) => { state.gap = v; updateReadouts(); updateBanner(); render(); },
      });
      ui.gapWrap = ui.gapSlider.input.closest('.slider-block');

      ui.modeSeg = X.buildSegmented(controls, {
        options: [
          { value: 'levitation', label: 'Levitation' },
          { value: 'pinning', label: 'Flux pinning' },
        ],
        value: state.maglevMode,
        onChange: (v) => { state.maglevMode = v; updateReadouts(); updateBanner(); render(); },
      });
      // Wrap segmented for visibility: find its parent div
      ui.modeWrap = ui.modeSeg ? null : null;
      // Segmented returns {set}; its DOM is last .segmented in controls — capture via query
      const segs = controls.querySelectorAll('.segmented');
      if (segs.length) ui.modeWrap = segs[segs.length - 1];

      ui.moveToggle = X.buildToggle(controls, {
        label: 'Train moving (start/stop)',
        checked: state.moving,
        onChange: (on) => { state.moving = on; },
      });
      ui.moveWrap = ui.moveToggle.closest('.toggle-row');

      ui.fieldToggle = X.buildToggle(controls, {
        label: 'Show magnetic field lines',
        checked: state.showField,
        onChange: (on) => { state.showField = on; render(); },
      });

      ui.readouts = X.buildReadouts(controls, [
        { id: 'B', label: 'Magnetic Field B', primary: true },
        { id: 'I', label: 'Current I' },
        { id: 'N', label: 'Windings N' },
        { id: 'P', label: 'Power Dissipation' },
        { id: 'state', label: 'Operating State', wide: true },
      ]);

      controls.append(X.el('div', 'ctrl-note',
        '<b>Simplified calculations:</b> B ∝ NI (illustrative constant). Real magnets need quench protection & cryogenics. Real maglev uses EMS/EDS/SC arrangements — not every train uses this exact mechanism.'
      ));

      syncControlVisibility();
    }

    function updateReadouts() {
      if (!ui.readouts) return;
      const B = magnetB(state.N, state.I);
      const sc = isSC(state.T, state.Tc);
      ui.readouts.set('B', B.toFixed(2) + ' T');
      ui.readouts.set('I', state.I.toFixed(0) + ' A');
      ui.readouts.set('N', state.N.toFixed(0));
      if (state.subtab === 'magnet') {
        const P = 0;
        ui.readouts.set('P', '≈ 0 W (superconducting coil, ideal)');
        ui.readouts.set('state', state.persistent ? 'Persistent mode — field maintained without supply' : 'Driven mode — supply required');
      } else {
        ui.readouts.set('P', sc ? '≈ 0 W (SC, ideal)' : 'Resistive losses');
        ui.readouts.set('state', sc
          ? (state.maglevMode === 'pinning' ? 'Flux pinning — magnet held in stable position (Type II)' : 'Magnetic levitation — Meissner repulsion')
          : 'Normal — no levitation (T > Tc)');
      }
      formula.innerHTML =
        `<span class="formula active">B ∝ NI → <span class="fv">${B.toFixed(2)} T</span> (simplified)</span>` +
        `<span class="formula">P = I²R ≈ 0 (SC, ideal)</span>` +
        `<span class="formula">Gap = <span class="fv">${state.gap.toFixed(0)} mm</span></span>`;
    }

    function updateBanner() {
      if (!banner) return;
      const B = magnetB(state.N, state.I);
      const sc = isSC(state.T, state.Tc);
      if (state.subtab === 'magnet') {
        banner.set('SUPERCONDUCTING MAGNET · PERSISTENT B', 'ok', `Coil with <b>N = ${state.N}, I = ${state.I} A</b> sustains <b>B ≈ ${B.toFixed(2)} T</b> (simplified B ∝ NI). ${state.persistent ? 'Persistent mode: <b>no resistive loss</b>, no supply needed.' : 'Driven mode: supply maintains current.'} Used in MRI & research magnets.`);
      } else {
        if (!sc) banner.set('NORMAL · NO LEVITATION', 'warn', `T = ${state.T.toFixed(1)} K &gt; Tc = ${state.Tc.toFixed(1)} K: material is normal, <b>no levitation</b>. Cool below Tc.`);
        else if (state.maglevMode === 'pinning') banner.set('FLUX PINNING · STABLE LEVITATION', 'ok', 'Type II superconductor with <b>pinned vortices</b> holds the magnet in a <b>stable</b> position (resists lateral displacement). Distinct from Meissner expulsion.');
        else banner.set('MAGNETIC LEVITATION · MEISSNER', 'ok', 'Superconductor <b>expels flux</b> (Meissner), repelling the magnet — <b>levitation + guidance</b> with no mechanical contact. Real maglev uses varied EMS/EDS/SC arrangements.');
      }
    }

    function renderMagnet(ctx, w, h, pad) {
      const B = magnetB(state.N, state.I);
      ctx.fillStyle = '#edf1f8'; ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillText('Superconducting coil — B ≈ ' + B.toFixed(2) + ' T (simplified B ∝ NI)', pad, 18);
      // Coil: stacked loops (count ∝ N)
      const cx = w / 2, cy = h * 0.44;
      const nLoops = Math.round(4 + (state.N / 300) * 10);
      const coilH = 120, coilW = 200;
      for (let i = 0; i < nLoops; i++) {
        const y = cy - coilH / 2 + (coilH * i) / Math.max(1, nLoops - 1);
        ctx.strokeStyle = 'rgba(34,211,238,0.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(cx, y, coilW / 2, 10, 0, 0, Math.PI * 2); ctx.stroke();
      }
      // Current arrows around coil
      const t = state.time;
      for (let i = 0; i < 8; i++) {
        const ang = t * 1.5 + (i / 8) * Math.PI * 2;
        const x = cx + (coilW / 2) * Math.cos(ang);
        const y = cy + 30 * Math.sin(ang);
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#8f9cb5'; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('N = ' + state.N + ' windings · I = ' + state.I + ' A · ' + (state.persistent ? 'persistent' : 'driven'), cx, cy + coilH / 2 + 20);
      ctx.textAlign = 'left';
      // Field lines through coil (density ∝ B)
      if (state.showField) {
        ctx.strokeStyle = 'rgba(34,211,238,0.45)'; ctx.lineWidth = 1.3;
        const nLines = Math.max(2, Math.round(B * 4));
        for (let i = 0; i < nLines; i++) {
          const x = cx - coilW / 2 + coilW * (i + 0.5) / nLines;
          ctx.beginPath(); ctx.moveTo(x, cy - coilH / 2 - 30); ctx.lineTo(x, cy + coilH / 2 + 30); ctx.stroke();
        }
        ctx.fillStyle = '#22d3ee'; ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText('B field (density ∝ B)', pad + 8, 40);
      }
      // Power bar
      const P = 0;
      ctx.fillStyle = '#8f9cb5'; ctx.font = '10px Inter, sans-serif';
      ctx.fillText('Power: ' + (state.persistent ? '≈ 0 W (persistent, ideal)' : '≈ 0 W (driven superconducting coil, ideal)'), pad, h - 14);
    }

    function renderMaglev(ctx, w, h, pad) {
      const sc = isSC(state.T, state.Tc);
      ctx.fillStyle = '#edf1f8'; ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillText('Maglev — ' + (state.maglevMode === 'pinning' ? 'flux-pinning mode (Type II)' : 'magnetic levitation (Meissner)') + (sc ? '' : ' · NORMAL (T > Tc)'), pad, 18);
      // Guideway
      const gy = h * 0.62;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect(pad + 8, gy, w - 2 * pad - 16, 22, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#8f9cb5'; ctx.font = '10px Inter, sans-serif';
      ctx.fillText('Guideway / magnetic track', pad + 12, gy + 15);
      // Superconductor pads on guideway
      const padW = 90;
      for (let i = 0; i < 3; i++) {
        const px = pad + 30 + i * (w - 2 * pad - 60) / 2;
        ctx.fillStyle = sc ? 'rgba(52,211,153,0.35)' : 'rgba(255,255,255,0.12)';
        ctx.beginPath(); ctx.roundRect(px, gy - 8, padW, 8, 3); ctx.fill();
      }
      // Train body (levitates if SC)
      const trainW = 170, trainH = 44;
      const gapPx = sc ? (state.gap / 30) * 50 : 4;
      const tx = pad + 20 + state.trainX * (w - 2 * pad - 40 - trainW);
      const ty = gy - gapPx - trainH;
      ctx.fillStyle = '#d9669b';
      ctx.beginPath(); ctx.roundRect(tx, ty, trainW, trainH, 8); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 11px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('MAGLEV TRAIN', tx + trainW / 2, ty + trainH / 2 + 4);
      ctx.textAlign = 'left';
      // Magnet system under train
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath(); ctx.roundRect(tx + 20, ty + trainH, trainW - 40, 10, 3); ctx.fill();
      ctx.fillStyle = '#8f9cb5'; ctx.font = '10px Inter, sans-serif';
      ctx.fillText('SC magnet system', tx + 20, ty + trainH + 22);
      // Gap indicator
      ctx.strokeStyle = sc ? '#34d399' : '#e08c3a'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(tx + trainW + 10, gy); ctx.lineTo(tx + trainW + 10, ty + trainH + 10); ctx.stroke();
      ctx.fillStyle = sc ? '#34d399' : '#e08c3a'; ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(state.gap.toFixed(0) + ' mm', tx + trainW + 14, (gy + ty + trainH) / 2);
      // Field lines between train and guideway
      if (state.showField && sc) {
        ctx.strokeStyle = 'rgba(34,211,238,0.5)'; ctx.lineWidth = 1.2;
        for (let i = 0; i < 5; i++) {
          const x = tx + 20 + (trainW - 40) * (i + 0.5) / 5;
          ctx.beginPath();
          if (state.maglevMode === 'pinning') {
            // pinned: lines connect train to guideway (stable)
            ctx.moveTo(x, ty + trainH + 10); ctx.lineTo(x, gy - 8);
          } else {
            // levitation: lines bend away (repulsion)
            ctx.moveTo(x, ty + trainH + 10);
            ctx.quadraticCurveTo(x + 14, (ty + trainH + gy) / 2, x + 18, gy - 8);
          }
          ctx.stroke();
        }
      }
      // T indicator
      ctx.fillStyle = '#edf1f8'; ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText('T = ' + state.T.toFixed(1) + ' K · Tc = ' + state.Tc.toFixed(1) + ' K · ' + (sc ? 'SUPERCONDUCTING' : 'NORMAL'), pad, h - 14);
    }

    function render() {
      if (!canvasObj) return;
      const { ctx, w, h } = canvasObj;
      ctx.clearRect(0, 0, w, h);
      const pad = w < 620 ? 12 : 20;
      if (state.subtab === 'magnet') renderMagnet(ctx, w, h, pad);
      else renderMaglev(ctx, w, h, pad);
    }

    function applyPreset(preset) {
      if (preset === 'magnet') { state.subtab = 'magnet'; }
      else if (preset === 'maglev') { state.subtab = 'maglev'; state.maglevMode = 'levitation'; state.T = 4; state.Tc = 10; }
      else if (preset === 'pinning') { state.subtab = 'maglev'; state.maglevMode = 'pinning'; state.T = 4; state.Tc = 10; }
      else return;
      if (subtabBar) subtabBar.set(state.subtab);
      if (ui.tSlider) ui.tSlider.setValue(state.T);
      if (ui.tcSlider) ui.tcSlider.setValue(state.Tc);
      if (ui.modeSeg) ui.modeSeg.set(state.maglevMode);
      syncControlVisibility();
      updateReadouts(); updateBanner(); render();
    }

    return {
      mount() {
        buildDOM();
        canvasObj = X.setupCanvas(document.getElementById('cv-c5t9'));
        updateReadouts(); updateBanner(); render();
      },
      unmount() {},
      tick(dt) {
        if (state.playing && !C.prefersReducedMotion()) {
          state.time += dt;
          if (state.subtab === 'maglev' && state.moving) {
            state.trainX = (state.trainX + dt * 0.12) % 1;
          }
        }
        render();
      },
      resize() {
        const cv = document.getElementById('cv-c5t9');
        if (cv) canvasObj = X.setupCanvas(cv);
        render();
      },
      applyPreset,
      magnetB, coilPower, isSC,
      getState: () => state,
    };
  };
})();
