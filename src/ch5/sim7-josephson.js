(function () {
  'use strict';

  const C = window.Ch5Platform;
  const X = window.XLab;

  window.CH5_SIMS['c5t7'] = function createJosephsonLab(ctxDom) {
    const { stage, controls, formula, wrap, dot } = ctxDom;

    const state = {
      mode: 'dc',      // 'dc' | 'ac'
      phiDeg: 45,      // phase difference (deg) for DC
      Ic: 10,          // critical current (µA, illustrative)
      V: 10,           // applied voltage (µV) for AC
      playing: true,
      time: 0,
      history: [],     // I(t) history for AC
    };

    let built = false;
    let canvasObj = null;
    let ui = {};
    let banner = null;
    let subtabBar = null;

    /* ---------- Physics ---------- */
    function dcCurrent(phiDeg, Ic) {
      return Ic * Math.sin(phiDeg * Math.PI / 180);
    }
    function josephsonFreq(VuV) {
      // f = 2eV/h ; V in µV -> Hz
      return C.PHYSICS.josephsonFreqPerVolt * VuV * 1e-6;
    }
    function acCurrent(t, Ic, VuV) {
      const f = josephsonFreq(VuV);
      return Ic * Math.sin(2 * Math.PI * f * t);
    }

    function resetSimulation() {
      state.mode = 'dc'; state.phiDeg = 45; state.Ic = 10; state.V = 10;
      state.time = 0; state.history = [];
      if (subtabBar) subtabBar.set('dc');
      if (ui.phiSlider) ui.phiSlider.setValue(45);
      if (ui.icSlider) ui.icSlider.setValue(10);
      if (ui.vSlider) ui.vSlider.setValue(10);
      syncControlVisibility();
      updateReadouts(); updateBanner(); render();
    }

    function syncControlVisibility() {
      const isDC = state.mode === 'dc';
      if (ui.phiWrap) ui.phiWrap.style.display = isDC ? 'flex' : 'none';
      if (ui.vWrap) ui.vWrap.style.display = isDC ? 'none' : 'flex';
    }

    function buildDOM() {
      if (built) return;
      built = true;
      stage.innerHTML = ''; controls.innerHTML = ''; formula.innerHTML = '';

      const cv = X.el('canvas', 'viz');
      cv.id = 'cv-c5t7';
      cv.setAttribute('aria-label', 'Josephson Effect Laboratory: DC and AC Josephson effects');
      stage.append(cv);
      canvasObj = X.setupCanvas(cv);

      subtabBar = C.buildSubtabs(wrap, [
        { id: 'dc', label: 'DC Josephson (V = 0)' },
        { id: 'ac', label: 'AC Josephson (V ≠ 0)' },
      ], state.mode, (id) => {
        state.mode = id;
        state.history = [];
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

      ui.phiSlider = X.buildSlider(controls, {
        label: 'Phase Difference φ', id: 'c5t7-phi', min: -180, max: 180, step: 1, value: state.phiDeg,
        format: (v) => v.toFixed(0) + '°',
        onInput: (v) => { state.phiDeg = v; updateReadouts(); updateBanner(); render(); },
      });
      ui.phiWrap = ui.phiSlider.input.closest('.slider-block');

      ui.icSlider = X.buildSlider(controls, {
        label: 'Critical Current Ic', id: 'c5t7-Ic', min: 1, max: 30, step: 0.5, value: state.Ic,
        format: (v) => v.toFixed(1) + ' µA',
        onInput: (v) => { state.Ic = v; updateReadouts(); updateBanner(); render(); },
      });

      ui.vSlider = X.buildSlider(controls, {
        label: 'Applied Voltage V', id: 'c5t7-V', min: 1, max: 50, step: 1, value: state.V,
        format: (v) => v.toFixed(0) + ' µV',
        onInput: (v) => { state.V = v; updateReadouts(); updateBanner(); render(); },
      });
      ui.vWrap = ui.vSlider.input.closest('.slider-block');

      ui.readouts = X.buildReadouts(controls, [
        { id: 'I', label: 'Supercurrent I', primary: true },
        { id: 'phi', label: 'Phase φ' },
        { id: 'Ic', label: 'Critical Ic' },
        { id: 'V', label: 'Voltage V' },
        { id: 'f', label: 'Josephson Frequency f', wide: true },
      ]);

      controls.append(X.el('div', 'ctrl-note',
        '<b>DC:</b> V = 0, steady I = Ic sinφ. <b>AC:</b> V ≠ 0, I(t) oscillates at f = 2eV/h (≈ 483.6 GHz/mV). Same junction, two regimes.'
      ));

      syncControlVisibility();
    }

    function updateReadouts() {
      if (!ui.readouts) return;
      let I, fTxt;
      if (state.mode === 'dc') {
        I = dcCurrent(state.phiDeg, state.Ic);
        fTxt = '— (DC, V = 0)';
        ui.readouts.set('V', '0 µV');
      } else {
        I = acCurrent(state.time * 1e-9, state.Ic, state.V);
        const f = josephsonFreq(state.V);
        fTxt = (f / 1e9).toFixed(3) + ' GHz';
        ui.readouts.set('V', state.V.toFixed(0) + ' µV');
      }
      ui.readouts.set('I', I.toFixed(2) + ' µA');
      ui.readouts.set('phi', state.mode === 'dc' ? state.phiDeg.toFixed(0) + '°' : 'evolving (dφ/dt = 2eV/ħ)');
      ui.readouts.set('Ic', state.Ic.toFixed(1) + ' µA');
      ui.readouts.set('f', fTxt);
      formula.innerHTML =
        `<span class="formula active">I = Ic sinφ = <span class="fv">${I.toFixed(2)} µA</span></span>` +
        `<span class="formula">f = 2eV/h = <span class="fv">${state.mode === 'ac' ? (josephsonFreq(state.V) / 1e9).toFixed(3) + ' GHz' : '—'}</span></span>`;
    }

    function updateBanner() {
      if (!banner) return;
      if (state.mode === 'dc') {
        const I = dcCurrent(state.phiDeg, state.Ic);
        banner.set('DC JOSEPHSON · V = 0', 'ok', `Phase <b>φ = ${state.phiDeg.toFixed(0)}°</b> gives steady supercurrent <b>I = ${I.toFixed(2)} µA</b> with <b>no voltage</b> (ideal). Change φ to trace I = Ic sinφ.`);
      } else {
        const f = josephsonFreq(state.V);
        banner.set('AC JOSEPHSON · V ≠ 0', '', `Voltage <b>V = ${state.V.toFixed(0)} µV</b> drives oscillation at <b>f = 2eV/h = ${(f / 1e9).toFixed(3)} GHz</b>. Adjust V and watch the frequency scale linearly.`);
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
      ctx.fillText('Josephson junction — SC | insulator | SC (' + (state.mode === 'dc' ? 'DC mode' : 'AC mode') + ')', pad, 18);

      // Junction geometry
      const jy = 34, jh = stageH - 52;
      const totalW = w - 2 * pad - 30;
      const scW = totalW * 0.38, barW = totalW * 0.10;
      const jx = pad + 15;
      const sc1X = jx, barX = sc1X + scW, sc2X = barX + barW;
      ctx.fillStyle = 'rgba(52,211,153,0.14)';
      ctx.strokeStyle = 'rgba(52,211,153,0.6)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect(sc1X, jy, scW, jh, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.roundRect(barX, jy, barW, jh, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(52,211,153,0.14)';
      ctx.strokeStyle = 'rgba(52,211,153,0.6)';
      ctx.beginPath(); ctx.roundRect(sc2X, jy, scW, jh, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#edf1f8'; ctx.font = 'bold 10.5px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Superconductor 1', sc1X + scW / 2, jy + 14);
      ctx.fillText('Insulator', barX + barW / 2, jy + 14);
      ctx.fillText('Superconductor 2', sc2X + scW / 2, jy + 14);
      ctx.textAlign = 'left';

      // Cooper pairs tunnelling: rate ∝ |I|
      const I = state.mode === 'dc' ? dcCurrent(state.phiDeg, state.Ic) : acCurrent(state.time * 1e-9, state.Ic, state.V);
      const rate = Math.abs(I) / Math.max(state.Ic, 1e-9); // 0..1
      const t = state.time;
      const nPairs = Math.round(rate * 8);
      for (let i = 0; i < nPairs; i++) {
        const frac = ((t * 0.4 * (I >= 0 ? 1 : -1) + i / Math.max(1, nPairs)) % 1 + 1) % 1;
        const px = sc1X + 10 + frac * (scW + barW + scW - 20);
        const py = jy + 26 + (jh - 52) * ((i * 0.41) % 1);
        ctx.fillStyle = '#34d399';
        ctx.beginPath(); ctx.arc(px, py, 3.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + 8, py, 3.2, 0, Math.PI * 2); ctx.fill();
      }
      // Phase arrows
      const cy = jy + jh / 2;
      ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sc1X + scW / 2 - 14, cy); ctx.lineTo(sc1X + scW / 2 + 14, cy); ctx.stroke();
      ctx.fillStyle = '#22d3ee'; ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText('phase φ₁', sc1X + 6, jy + jh - 8);
      const phi2 = state.mode === 'dc' ? state.phiDeg : ((state.time * 1e-9 * josephsonFreq(state.V) * 360) % 360);
      ctx.fillText('phase φ₂ = φ₁ + ' + (state.mode === 'dc' ? state.phiDeg.toFixed(0) + '°' : 'evolving'), sc2X + 6, jy + jh - 8);
      ctx.fillStyle = '#8f9cb5'; ctx.font = '10px Inter, sans-serif';
      ctx.fillText('Cooper-pair tunnelling rate ∝ |I| = ' + Math.abs(I).toFixed(2) + ' µA', pad, jy + jh + 14);

      // Graph: DC -> I vs phi; AC -> I vs t
      const ax = pad + 44, ay = graphY + 16, aw = w - ax - pad - 8, ah = graphH - 30;
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax, ay + ah); ctx.lineTo(ax + aw, ay + ah); ctx.stroke();
      ctx.fillStyle = '#8f9cb5'; ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      if (state.mode === 'dc') {
        ctx.fillText('I (µA) vs φ', ax, ay - 4);
        const Xg = (deg) => ax + aw * ((deg + 180) / 360);
        const Yg = (Iv) => ay + ah / 2 - ah * 0.45 * (Iv / state.Ic);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath(); ctx.moveTo(ax, ay + ah / 2); ctx.lineTo(ax + aw, ay + ah / 2); ctx.stroke();
        ctx.strokeStyle = '#34d399'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= 160; i++) {
          const deg = -180 + (i / 160) * 360;
          const Iv = dcCurrent(deg, state.Ic);
          const px = Xg(deg), py = Yg(Iv);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(Xg(state.phiDeg), Yg(I), 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#edf1f8'; ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText('φ=' + state.phiDeg.toFixed(0) + '°, I=' + I.toFixed(2) + ' µA', Xg(state.phiDeg) + 8, Yg(I) - 7);
        ctx.fillStyle = '#8f9cb5'; ctx.textAlign = 'center';
        ctx.fillText('−180°', Xg(-180), ay + ah + 13);
        ctx.fillText('0°', Xg(0), ay + ah + 13);
        ctx.fillText('+180°', Xg(180), ay + ah + 13);
        ctx.textAlign = 'left';
      } else {
        ctx.fillText('I (µA) vs t — 0 to 2 ns (animation slowed)', ax, ay - 4);
        const f = josephsonFreq(state.V);
        const tWin = 2e-9; // fixed 2 ns window shows changing frequency
        const Xg = (tv) => ax + aw * (tv / tWin);
        const Yg = (Iv) => ay + ah / 2 - ah * 0.45 * (Iv / state.Ic);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath(); ctx.moveTo(ax, ay + ah / 2); ctx.lineTo(ax + aw, ay + ah / 2); ctx.stroke();
        ctx.strokeStyle = '#34d399'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= 600; i++) {
          const tv = (i / 600) * tWin;
          const Iv = acCurrent(tv, state.Ic, state.V);
          const px = Xg(tv), py = Yg(Iv);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        const tNow = ((state.time * 1e-9) % tWin);
        ctx.beginPath(); ctx.arc(Xg(tNow), Yg(acCurrent(tNow, state.Ic, state.V)), 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#edf1f8'; ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText('f = ' + (f / 1e9).toFixed(3) + ' GHz, V = ' + state.V.toFixed(0) + ' µV', ax + 6, ay + 12);
      }
    }

    function applyPreset(preset) {
      if (preset === 'dc') { state.mode = 'dc'; state.phiDeg = 45; }
      else if (preset === 'ac') { state.mode = 'ac'; state.V = 10; state.history = []; }
      else return;
      if (subtabBar) subtabBar.set(state.mode);
      if (ui.phiSlider) ui.phiSlider.setValue(state.phiDeg);
      if (ui.vSlider) ui.vSlider.setValue(state.V);
      syncControlVisibility();
      updateReadouts(); updateBanner(); render();
    }

    return {
      mount() {
        buildDOM();
        canvasObj = X.setupCanvas(document.getElementById('cv-c5t7'));
        updateReadouts(); updateBanner(); render();
      },
      unmount() {},
      tick(dt) {
        if (state.playing && !C.prefersReducedMotion()) state.time += dt;
        updateReadouts();
        render();
      },
      resize() {
        const cv = document.getElementById('cv-c5t7');
        if (cv) canvasObj = X.setupCanvas(cv);
        render();
      },
      applyPreset,
      dcCurrent, josephsonFreq, acCurrent,
      getState: () => state,
    };
  };
})();
