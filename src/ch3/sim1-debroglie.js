(function () {
  'use strict';

  const C = window.Ch3Platform;
  const X = window.XLab;
  const P = C.PHYSICS;

  window.CH3_SIMS['c3t1'] = function createDeBroglieLab(ctxDom) {
    const { stage, controls, formula, wrap, dot } = ctxDom;

    const PARTICLES = {
      electron: { name: 'Electron (e⁻)', massKg: P.m_e, massMe: 1.0, col: '#22d3ee' },
      proton:   { name: 'Proton (p⁺)',   massKg: P.m_p, massMe: P.m_p / P.m_e, col: '#f472b6' },
      neutron:  { name: 'Neutron (n⁰)',  massKg: P.m_n, massMe: P.m_n / P.m_e, col: '#a5b4fc' },
    };

    const state = {
      mode: 'particle',        // 'particle' | 'radiation'
      playing: true,
      particleKey: 'electron', // 'electron' | 'proton' | 'neutron' | 'custom'
      massMe: 1.0,             // 0.2 .. 3000 m_e
      kineticEv: 50.0,         // 0.5 .. 500 eV
      radLambdaNm: 500,        // 10 .. 1000 nm
      time: 0,
    };

    let built = false;
    let canvasObj = null;
    let ui = {};
    let banner = null;
    let subtabBar = null;

    function getParticleMetrics() {
      const m = state.massMe * P.m_e;
      const K_J = C.evToJ(state.kineticEv);
      const p = Math.sqrt(2 * m * K_J);
      const v = p / m;
      const lambdaM = P.h / p;
      const lambdaNm = lambdaM * 1e9;
      const nuKinetic = K_J / P.h;                  // kinetic energy convention nu_K = K/h
      const nuTotal = (m * P.c * P.c + K_J) / P.h;  // relativistic total energy convention
      const beta = v / P.c;
      return { m, K_J, p, v, lambdaM, lambdaNm, nuKinetic, nuTotal, beta };
    }

    function getRadiationMetrics() {
      const lambdaM = state.radLambdaNm * 1e-9;
      const nu = P.c / lambdaM;
      const E_J = P.h * nu;
      const E_eV = C.jToEv(E_J);
      const p = P.h / lambdaM;
      // Same-energy non-relativistic electron de Broglie wavelength for comparison
      const eSameEnergyNm = (P.h / Math.sqrt(2 * P.m_e * E_J)) * 1e9;
      return { lambdaNm: state.radLambdaNm, lambdaM, nu, E_J, E_eV, p, eSameEnergyNm };
    }

    function syncVelocitySliderRange() {
      if (!ui.velSlider) return;
      const m = state.massMe * P.m_e;
      const vMin = Math.sqrt((2 * C.evToJ(0.5)) / m);
      const vMax = Math.sqrt((2 * C.evToJ(500)) / m);
      const vCur = Math.sqrt((2 * C.evToJ(state.kineticEv)) / m);
      ui.velSlider.input.min = String(vMin);
      ui.velSlider.input.max = String(vMax);
      ui.velSlider.input.step = String((vMax - vMin) / 400);
      ui.velSlider.setValue(vCur);
    }

    function syncControlVisibility() {
      const isP = state.mode === 'particle';
      const setVis = (el, vis) => { if (el) el.style.display = vis ? 'flex' : 'none'; };
      setVis(ui.partWrap, isP);
      setVis(ui.massWrap, isP);
      setVis(ui.keWrap, isP);
      setVis(ui.velWrap, isP);
      setVis(ui.radWrap, !isP);
    }

    function resetSimulation(keepMode) {
      if (!keepMode) state.mode = 'particle';
      state.particleKey = 'electron';
      state.massMe = 1.0;
      state.kineticEv = 50.0;
      state.radLambdaNm = 500;
      state.time = 0;

      if (subtabBar) subtabBar.set(state.mode);
      if (ui.partSelect) ui.partSelect.value = 'electron';
      if (ui.massSlider) ui.massSlider.setValue(Math.log10(state.massMe));
      if (ui.keSlider) ui.keSlider.setValue(state.kineticEv);
      if (ui.radSlider) ui.radSlider.setValue(state.radLambdaNm);
      syncVelocitySliderRange();
      syncControlVisibility();
      updateReadouts();
      updateBanner();
      render();
    }

    function buildDOM() {
      if (built) return;
      built = true;

      stage.innerHTML = '';
      controls.innerHTML = '';
      formula.innerHTML = '';

      const cv = X.el('canvas', 'viz');
      cv.id = 'cv-c3t1';
      cv.setAttribute('aria-label', 'Wave-Particle Duality and de Broglie Wavelength Laboratory');
      stage.append(cv);
      canvasObj = X.setupCanvas(cv);

      subtabBar = C.buildSubtabs(
        wrap,
        [
          { id: 'particle', label: 'A. Particle Mode (Matter Waves)' },
          { id: 'radiation', label: 'B. Radiation Mode (Photons)' },
        ],
        state.mode,
        (m) => {
          state.mode = m;
          syncControlVisibility();
          updateReadouts();
          updateBanner();
          render();
        }
      );

      banner = C.buildBanner(wrap);

      ui.transport = C.buildTransport(controls, {
        onTogglePlay: () => {
          state.playing = !state.playing;
          ui.transport.setPlaying(state.playing);
          if (dot) dot.textContent = state.playing ? 'Live' : 'Paused';
        },
        onReset: () => resetSimulation(true),
        playLabel: 'Pause',
      });
      ui.transport.setPlaying(true);

      // Particle Selector
      ui.partSelect = X.buildSelect(controls, {
        label: 'Particle Preset',
        options: [
          { value: 'electron', label: 'Electron (mₑ = 9.11×10⁻³¹ kg)' },
          { value: 'proton', label: 'Proton (mₚ = 1836.2 mₑ)' },
          { value: 'neutron', label: 'Neutron (mₙ = 1838.7 mₑ)' },
          { value: 'custom', label: 'Custom Mass' },
        ],
        value: state.particleKey,
        onChange: (val) => {
          state.particleKey = val;
          if (PARTICLES[val]) {
            state.massMe = PARTICLES[val].massMe;
            ui.massSlider.setValue(Math.log10(state.massMe));
            syncVelocitySliderRange();
          }
          updateReadouts();
          updateBanner();
          render();
        },
      });
      ui.partWrap = ui.partSelect.closest('.slider-block');

      // Log Mass slider (0.2 m_e to 3000 m_e)
      ui.massSlider = X.buildSlider(controls, {
        label: 'Particle Mass m (log scale)',
        id: 'c3t1-mass',
        min: Math.log10(0.2),
        max: Math.log10(3000),
        step: 0.01,
        value: Math.log10(state.massMe),
        format: (logV) => {
          const me = Math.pow(10, logV);
          const kg = me * P.m_e;
          return `${me < 10 ? me.toFixed(2) : Math.round(me)} mₑ (${X.fmtSci(kg, 2)} kg)`;
        },
        onInput: (logV) => {
          state.massMe = Math.pow(10, logV);
          state.particleKey = 'custom';
          ui.partSelect.value = 'custom';
          syncVelocitySliderRange();
          updateReadouts();
          updateBanner();
          render();
        },
      });
      ui.massWrap = ui.massSlider.input.closest('.slider-block');

      // Kinetic Energy slider
      ui.keSlider = X.buildSlider(controls, {
        label: 'Kinetic Energy K',
        id: 'c3t1-ke',
        min: 0.5,
        max: 500,
        step: 0.5,
        value: state.kineticEv,
        format: (v) => v.toFixed(1) + ' eV',
        onInput: (v) => {
          state.kineticEv = v;
          syncVelocitySliderRange();
          updateReadouts();
          updateBanner();
          render();
        },
      });
      ui.keWrap = ui.keSlider.input.closest('.slider-block');

      // Particle Velocity slider (synchronized with K = 1/2 m v^2)
      const m0 = state.massMe * P.m_e;
      const vMin0 = Math.sqrt((2 * C.evToJ(0.5)) / m0);
      const vMax0 = Math.sqrt((2 * C.evToJ(500)) / m0);
      const vCur0 = Math.sqrt((2 * C.evToJ(state.kineticEv)) / m0);
      ui.velSlider = X.buildSlider(controls, {
        label: 'Particle Speed v (non-rel.)',
        id: 'c3t1-vel',
        min: vMin0,
        max: vMax0,
        step: (vMax0 - vMin0) / 400,
        value: vCur0,
        format: (v) => `${X.fmtSci(v, 2)} m/s`,
        onInput: (v) => {
          const m = state.massMe * P.m_e;
          const K_eV = X.clamp(C.jToEv(0.5 * m * v * v), 0.5, 500);
          state.kineticEv = K_eV;
          ui.keSlider.setValue(K_eV);
          updateReadouts();
          updateBanner();
          render();
        },
      });
      ui.velWrap = ui.velSlider.input.closest('.slider-block');

      // Radiation Wavelength slider
      ui.radSlider = X.buildSlider(controls, {
        label: 'Radiation Wavelength λ',
        id: 'c3t1-rad',
        min: 10,
        max: 1000,
        step: 2,
        value: state.radLambdaNm,
        format: (v) => `${Math.round(v)} nm`,
        onInput: (v) => {
          state.radLambdaNm = v;
          updateReadouts();
          updateBanner();
          render();
        },
      });
      ui.radWrap = ui.radSlider.input.closest('.slider-block');

      ui.readouts = X.buildReadouts(controls, [
        { id: 'lam', label: 'de Broglie λ', primary: true },
        { id: 'mom', label: 'Momentum p' },
        { id: 'en', label: 'Kinetic Energy K' },
        { id: 'freq', label: 'Kinetic Freq ν_K = K/h' },
        { id: 'note', label: 'Model / Regime', wide: true },
      ]);
      ui.readoutLabels = controls.querySelectorAll('.readout .r-label');

      controls.append(X.el('div', 'ctrl-note',
        '<b>Physical Distinction:</b> A matter wave is a quantum probability amplitude wave (not a physical oscillation of the particle body or an EM wave). Frequency uses the non-relativistic kinetic convention <b>ν_K = K/h</b> (distinct from total relativistic ν_tot = (mc²+K)/h).'
      ));

      syncControlVisibility();
    }

    function updateReadouts() {
      if (!ui.readouts) return;
      if (state.mode === 'particle') {
        const pm = getParticleMetrics();
        if (ui.readoutLabels.length >= 5) {
          ui.readoutLabels[0].textContent = 'de Broglie λ';
          ui.readoutLabels[1].textContent = 'Momentum p = √(2mK)';
          ui.readoutLabels[2].textContent = 'Kinetic Energy K';
          ui.readoutLabels[3].textContent = 'Kinetic Freq ν_K = K/h';
          ui.readoutLabels[4].textContent = 'Speed Ratio & Validity';
        }
        const lamStr = pm.lambdaNm >= 0.01 ? pm.lambdaNm.toFixed(4) + ' nm' : (pm.lambdaNm * 1e3).toFixed(3) + ' pm';
        ui.readouts.set('lam', lamStr);
        ui.readouts.set('mom', X.fmtSci(pm.p, 2) + ' kg·m/s');
        ui.readouts.set('en', `${state.kineticEv.toFixed(1)} eV (${X.fmtSci(pm.K_J, 2)} J)`);
        ui.readouts.set('freq', X.fmtSci(pm.nuKinetic, 2) + ' Hz');
        ui.readouts.set('note', `v/c = ${(pm.beta * 100).toFixed(3)}% · Non-relativistic λ = h/√(2mK) valid ✓`);

        formula.innerHTML = `
          <span class="formula active">λ = h/p = h/√(2mK) = <span class="fv">${lamStr}</span></span>
          <span class="formula">p = mv = <span class="fv">${X.fmtSci(pm.p, 2)} kg·m/s</span></span>
          <span class="formula">ν<sub>K</sub> = K/h = <span class="fv">${X.fmtSci(pm.nuKinetic, 2)} Hz</span></span>`;
      } else {
        const rm = getRadiationMetrics();
        if (ui.readoutLabels.length >= 5) {
          ui.readoutLabels[0].textContent = 'Photon Energy E';
          ui.readoutLabels[1].textContent = 'Frequency ν = c/λ';
          ui.readoutLabels[2].textContent = 'Photon Momentum h/λ';
          ui.readoutLabels[3].textContent = 'Equal-E Electron λ';
          ui.readoutLabels[4].textContent = 'EM Band & Comparison';
        }
        const band = rm.lambdaNm < 100 ? 'Extreme UV / Soft X-ray' : rm.lambdaNm < 380 ? 'Ultraviolet' : rm.lambdaNm <= 740 ? 'Visible Light' : 'Near-Infrared';
        ui.readouts.set('lam', `${rm.E_eV.toFixed(2)} eV`);
        ui.readouts.set('mom', X.fmtSci(rm.nu, 2) + ' Hz');
        ui.readouts.set('en', X.fmtSci(rm.p, 2) + ' kg·m/s');
        ui.readouts.set('freq', rm.eSameEnergyNm.toFixed(4) + ' nm');
        ui.readouts.set('note', `${band} · At equal energy, electron λ is ${(rm.lambdaNm / rm.eSameEnergyNm).toFixed(0)}× shorter than photon λ!`);

        formula.innerHTML = `
          <span class="formula active">E = hν = hc/λ = <span class="fv">${rm.E_eV.toFixed(2)} eV</span></span>
          <span class="formula">p<sub>photon</sub> = h/λ = <span class="fv">${X.fmtSci(rm.p, 2)} kg·m/s</span></span>
          <span class="formula">Speed: <span class="fv">c = 2.998×10⁸ m/s</span> (m₀ = 0)</span>`;
      }
    }

    function updateBanner() {
      if (!banner) return;
      if (state.mode === 'particle') {
        const pm = getParticleMetrics();
        const label = PARTICLES[state.particleKey] ? PARTICLES[state.particleKey].name : `Custom (${state.massMe.toFixed(1)} mₑ)`;
        const lamStr = pm.lambdaNm >= 0.01 ? pm.lambdaNm.toFixed(4) + ' nm' : (pm.lambdaNm * 1e3).toFixed(3) + ' pm';
        banner.set(
          'PARTICLE MATTER WAVE',
          'ok',
          `<b>${label}</b> moves along a straight path with momentum p. Its associated probability-amplitude wave has de Broglie wavelength <b>λ = ${lamStr}</b> — higher mass or kinetic energy compresses λ.`
        );
      } else {
        const rm = getRadiationMetrics();
        banner.set(
          'EM RADIATION QUANTA',
          '',
          `Photon at <b>λ = ${Math.round(rm.lambdaNm)} nm</b> carries energy <b>E = hc/λ = ${rm.E_eV.toFixed(2)} eV</b> via oscillating E/B fields at speed c (contrast with massive matter waves having m &gt; 0).`
        );
      }
    }

    /* ============================================================
       CANVAS RENDERING
       ============================================================ */
    function renderParticleMode(ctx, w, h) {
      const narrow = w < 620;
      const pad = narrow ? 14 : 20;
      const pm = getParticleMetrics();
      const pCol = PARTICLES[state.particleKey] ? PARTICLES[state.particleKey].col : '#34d399';

      // Top Stage: Particle + Straight Motion + Associated Matter-Wave Phase Field
      const topY = 36, topH = h * 0.44;
      ctx.fillStyle = 'rgba(6,10,24,0.72)';
      ctx.fillRect(pad, topY, w - pad * 2, topH);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.strokeRect(pad, topY, w - pad * 2, topH);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillText('PARTICLE BEAM & ASSOCIATED DE BROGLIE PROBABILITY WAVEFRONT', pad, 22);

      const bx0 = pad + 18, bx1 = w - pad - 18, bw = bx1 - bx0;
      const midY = topY + topH * 0.52;

      // Map wavelength smoothly to visual pixel spacing so increasing K/m compresses fringes!
      const refNm = 1.2264 / Math.sqrt(50); // 50 eV electron ~0.1734 nm
      const visualLambdaPx = X.clamp(56 * Math.pow(pm.lambdaNm / refNm, 0.35), 14, 150);
      const tAnim = C.prefersReducedMotion() ? 0 : state.time;
      const particleProg = (tAnim * 0.22) % 1;
      const px = bx0 + 36 + particleProg * (bw - 72);
      const wavePhaseShift = tAnim * 4.2;

      // Straight-line trajectory guide (emphasizes particle does NOT wiggle transversely!)
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(bx0, midY); ctx.lineTo(bx1, midY); ctx.stroke();
      ctx.setLineDash([]);

      // Vertical wavefront phase bars localized around particle packet
      const sigmaPx = Math.max(70, bw * 0.22);
      for (let x = bx0; x <= bx1; x += 6) {
        const dx = x - px;
        const env = Math.exp(-(dx * dx) / (2 * sigmaPx * sigmaPx));
        if (env < 0.03) continue;
        const phase = (dx / visualLambdaPx) * Math.PI * 2 - wavePhaseShift;
        const crest = Math.max(0, Math.cos(phase));
        if (crest > 0.15) {
          ctx.strokeStyle = `rgba(34,211,238,${(env * crest * 0.28).toFixed(2)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, midY - topH * 0.34);
          ctx.lineTo(x, midY + topH * 0.34);
          ctx.stroke();
        }
      }

      // Associated probability amplitude curve Re[psi(x)] (explicitly drawn on wave axis, NOT particle body!)
      ctx.beginPath();
      for (let i = 0; i <= 240; i++) {
        const x = bx0 + (i / 240) * bw;
        const dx = x - px;
        const env = Math.exp(-(dx * dx) / (2 * sigmaPx * sigmaPx));
        const y = midY - Math.cos((dx / visualLambdaPx) * Math.PI * 2 - wavePhaseShift) * env * (topH * 0.30);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Straight-moving particle core + momentum vector arrow
      ctx.fillStyle = pCol;
      ctx.beginPath(); ctx.arc(px, midY, 6.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4; ctx.stroke();

      // Momentum vector p arrow
      const arrLen = X.clamp(30 + Math.log10(Math.max(1, state.kineticEv)) * 18, 32, 76);
      ctx.strokeStyle = '#e0b553';
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(px + 9, midY); ctx.lineTo(px + 9 + arrLen, midY); ctx.stroke();
      ctx.fillStyle = '#e0b553';
      ctx.beginPath();
      ctx.moveTo(px + 9 + arrLen + 7, midY);
      ctx.lineTo(px + 9 + arrLen - 1, midY - 4.5);
      ctx.lineTo(px + 9 + arrLen - 1, midY + 4.5);
      ctx.closePath(); ctx.fill();
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('p = mv', px + 14, midY - 9);

      // Wavelength λ caliper bracket near center of packet
      const wX1 = px - visualLambdaPx / 2;
      const wX2 = px + visualLambdaPx / 2;
      const wy = midY + topH * 0.37;
      if (wX1 > bx0 && wX2 < bx1) {
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(wX1, wy - 5); ctx.lineTo(wX1, wy + 5);
        ctx.moveTo(wX1, wy); ctx.lineTo(wX2, wy);
        ctx.moveTo(wX2, wy - 5); ctx.lineTo(wX2, wy + 5);
        ctx.stroke();
        ctx.fillStyle = '#34d399';
        ctx.textAlign = 'center';
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        const lTxt = pm.lambdaNm >= 0.01 ? `λ = ${pm.lambdaNm.toFixed(3)} nm` : `λ = ${(pm.lambdaNm * 1e3).toFixed(2)} pm`;
        ctx.fillText(lTxt, px, wy - 6);
      }

      ctx.fillStyle = '#8f9cb5';
      ctx.font = '9.5px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Particle moves linearly along beam; blue curve shows associated matter-wave probability amplitude Re[ψ]', bx0, topY + 15);

      // Bottom Stage: Graph of de Broglie Wavelength λ vs Kinetic Energy K
      const gx0 = pad + 48, gx1 = w - pad - 18;
      const gy0 = topY + topH + 26, gy1 = h - 32;
      if (gy1 - gy0 < 85) return;

      ctx.fillStyle = 'rgba(6,10,24,0.72)';
      ctx.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.strokeRect(gx0, gy0, gx1 - gx0, gy1 - gy0);

      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 10.5px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('DE BROGLIE WAVELENGTH λ vs. KINETIC ENERGY K  (λ = h / √(2mK))', gx0 + 6, gy0 - 7);

      const KMin = 1, KMax = 500;
      const KX = (K) => gx0 + ((K - KMin) / (KMax - KMin)) * (gx1 - gx0);
      const maxPlotNm = (P.h / Math.sqrt(2 * pm.m * C.evToJ(1))) * 1e9;
      const LY = (nm) => gy1 - 12 - X.clamp(nm / maxPlotNm, 0, 1) * (gy1 - gy0 - 28);

      // Reference Electron curve if viewing heavier particle (normalized to active scale if electron, or dashed electron ref)
      ctx.beginPath();
      for (let i = 0; i <= 160; i++) {
        const K = KMin + (i / 160) * (KMax - KMin);
        const nm = (P.h / Math.sqrt(2 * pm.m * C.evToJ(K))) * 1e9;
        const pxPlot = KX(K), pyPlot = LY(nm);
        if (i === 0) ctx.moveTo(pxPlot, pyPlot); else ctx.lineTo(pxPlot, pyPlot);
      }
      ctx.strokeStyle = pCol;
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // Current (K, lambda) point
      const curX = KX(X.clamp(state.kineticEv, KMin, KMax));
      const curY = LY(pm.lambdaNm);
      ctx.strokeStyle = 'rgba(224,181,83,0.45)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(curX, gy0 + 4); ctx.lineTo(curX, gy1 - 4); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#e0b553';
      ctx.beginPath(); ctx.arc(curX, curY, 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.3; ctx.stroke();

      // Axes ticks
      ctx.fillStyle = '#8f9cb5';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      [1, 100, 200, 300, 400, 500].forEach((k) => ctx.fillText(k + ' eV', KX(k), gy1 + 14));
      ctx.textAlign = 'right';
      ctx.fillText(maxPlotNm >= 0.01 ? maxPlotNm.toFixed(2) + ' nm' : (maxPlotNm * 1e3).toFixed(1) + ' pm', gx0 - 5, gy0 + 18);
      ctx.fillText('0', gx0 - 5, gy1 - 10);
    }

    function renderRadiationMode(ctx, w, h) {
      const narrow = w < 620;
      const pad = narrow ? 14 : 20;
      const rm = getRadiationMetrics();
      const waveCol = C.spectrumColor(rm.lambdaNm, 1);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillText('ELECTROMAGNETIC RADIATION QUANTA (E = hν = hc/λ)', pad, 22);

      // Top box: Propagating EM wave & Photon packets
      const topY = 36, topH = h * 0.48;
      ctx.fillStyle = 'rgba(6,10,24,0.72)';
      ctx.fillRect(pad, topY, w - pad * 2, topH);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.strokeRect(pad, topY, w - pad * 2, topH);

      const x0 = pad + 20, x1 = w - pad - 20, bw = x1 - x0;
      const midY = topY + topH * 0.54;
      const tAnim = C.prefersReducedMotion() ? 0 : state.time;
      const visLam = X.clamp(16 + (rm.lambdaNm / 1000) * 140, 18, 160);

      // Axis
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath(); ctx.moveTo(x0, midY); ctx.lineTo(x1, midY); ctx.stroke();

      // Transverse E-field wave
      ctx.beginPath();
      for (let i = 0; i <= 260; i++) {
        const x = x0 + (i / 260) * bw;
        const env = Math.exp(-Math.pow((i / 260 - 0.5) / 0.34, 2));
        const y = midY - Math.sin((x / visLam) * Math.PI * 2 - tAnim * 6) * env * (topH * 0.34);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = waveCol;
      ctx.lineWidth = 2.6;
      ctx.stroke();

      // Photon energy label
      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 11px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Photon Quantum: λ = ${Math.round(rm.lambdaNm)} nm  ·  E = ${rm.E_eV.toFixed(2)} eV  ·  Speed = c`, (x0 + x1) / 2, topY + 22);

      // Bottom Comparison Card: EM Radiation vs Matter Wave
      const cmpY = topY + topH + 18, cmpH = h - cmpY - 16;
      if (cmpH < 85) return;
      const halfW = (w - pad * 2 - 14) / 2;
      const drawBox = (bx, title, col, lines) => {
        ctx.fillStyle = 'rgba(6,10,24,0.72)';
        ctx.fillRect(bx, cmpY, halfW, cmpH);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(bx, cmpY, halfW, cmpH);
        ctx.fillStyle = col;
        ctx.textAlign = 'left';
        ctx.font = 'bold 10.5px Inter, sans-serif';
        ctx.fillText(title, bx + 12, cmpY + 20);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = (narrow ? '9px' : '10px') + ' Inter, sans-serif';
        lines.forEach((ln, idx) => ctx.fillText(ln, bx + 12, cmpY + 42 + idx * 19));
      };

      drawBox(pad, 'EM RADIATION (PHOTONS)', waveCol, [
        `• Zero rest mass (m₀ = 0), speed c`,
        `• Transverse oscillating E & B fields`,
        `• E = hc/λ = ${rm.E_eV.toFixed(2)} eV`,
        `• Wavelength at E: ${Math.round(rm.lambdaNm)} nm`,
      ]);
      drawBox(pad + halfW + 14, 'MATTER WAVE (e⁻ AT SAME E)', '#22d3ee', [
        `• Non-zero mass (mₑ), speed v < c`,
        `• Probability amplitude ψ (not EM field)`,
        `• λ = h/√(2mₑK) = ${rm.eSameEnergyNm.toFixed(4)} nm`,
        `• Same energy → ${(rm.lambdaNm / rm.eSameEnergyNm).toFixed(0)}× shorter λ!`,
      ]);
    }

    function render() {
      if (!canvasObj) return;
      const { ctx, w, h } = canvasObj;
      ctx.clearRect(0, 0, w, h);
      if (state.mode === 'particle') renderParticleMode(ctx, w, h);
      else renderRadiationMode(ctx, w, h);
    }

    return {
      mount() {
        buildDOM();
        canvasObj = X.setupCanvas(document.getElementById('cv-c3t1'));
        updateReadouts();
        updateBanner();
        render();
      },
      unmount() {},
      tick(dt) {
        if (state.playing) state.time += dt;
        render();
      },
      resize() {
        const cv = document.getElementById('cv-c3t1');
        if (cv) canvasObj = X.setupCanvas(cv);
        render();
      },
      applyPreset(preset) {
        if (preset === 'radiation') {
          state.mode = 'radiation';
        } else {
          state.mode = 'particle';
          if (preset === 'proton') {
            state.particleKey = 'proton';
            state.massMe = PARTICLES.proton.massMe;
            if (ui.partSelect) ui.partSelect.value = 'proton';
            if (ui.massSlider) ui.massSlider.setValue(Math.log10(state.massMe));
          } else {
            state.particleKey = 'electron';
            state.massMe = 1.0;
            if (ui.partSelect) ui.partSelect.value = 'electron';
            if (ui.massSlider) ui.massSlider.setValue(0);
          }
          syncVelocitySliderRange();
        }
        if (subtabBar) subtabBar.set(state.mode);
        syncControlVisibility();
        updateReadouts();
        updateBanner();
        render();
      },
      getParticleMetrics,
      getRadiationMetrics,
      getState: () => state,
    };
  };
})();
