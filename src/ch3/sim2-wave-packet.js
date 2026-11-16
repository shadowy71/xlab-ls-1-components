(function () {
  'use strict';

  const C = window.Ch3Platform;
  const X = window.XLab;
  const P = C.PHYSICS;

  window.CH3_SIMS['c3t2'] = function createWavePacketLab(ctxDom) {
    const { stage, controls, formula, wrap, dot } = ctxDom;

    // Scaled simulation unit system: x in nm, k in rad/nm, scaled time tau in fs-like visual units
    // Real electron SI values are computed identically alongside visual propagation
    const X_MIN = -8.0;
    const X_MAX = 8.0;
    const X_INIT = -4.5;

    const state = {
      model: 'matter',        // 'matter' | 'custom'
      playing: true,
      k0: 4.5,                // central wave number (rad/nm), lambda0 = 2*pi/k0
      omegaScale: 1.0,        // custom mode omega_0 multiplier (rad/unit-t)
      vgRatio: 0.65,          // custom mode vg / vp ratio (0.3..1.8)
      nWaves: 11,             // 3..25 component waves
      deltaK: 1.6,            // spread Δk (rad/nm)
      speed: 1.0,             // playback speed multiplier
      showComponents: true,
      time: 0,
    };

    let built = false;
    let canvasObj = null;
    let ui = {};
    let banner = null;

    function getPhysics() {
      const k0 = state.k0; // rad/nm
      const lambda0Nm = (2 * Math.PI) / k0;
      const k0SI = k0 * 1e9; // rad/m

      // Real free-electron values at wave number k0:
      // E = hbar^2 k^2 / (2 m_e), vg = hbar k / m_e, vp = hbar k / (2 m_e) = vg / 2
      const vgElectron = (P.hbar * k0SI) / P.m_e;
      const vpElectron = vgElectron / 2;
      const omega0Electron = (P.hbar * k0SI * k0SI) / (2 * P.m_e);
      const energyEv = C.jToEv(P.hbar * omega0Electron);

      // Visual normalized propagation velocities (nm / s_sim) calibrated cleanly so transit takes ~6s
      const visScale = 0.25 / Math.max(0.4, (P.hbar * 4.5e9) / P.m_e * 1e-6); // ~1.0 when k0=4.5
      let vpVis, vgVis, omega0Vis;
      if (state.model === 'matter') {
        // Exact quadratic dispersion omega_vis(k) = alpha * k^2 => vp = alpha*k0, vg = 2*alpha*k0 = 2*vp
        const alpha = 0.22;
        omega0Vis = alpha * k0 * k0;
        vpVis = alpha * k0;
        vgVis = 2 * alpha * k0;
      } else {
        vpVis = state.omegaScale * (0.22 * 4.5);
        omega0Vis = vpVis * k0;
        vgVis = vpVis * state.vgRatio;
      }

      const maxV = Math.max(Math.abs(vpVis), Math.abs(vgVis), 0.3);
      const cycleDuration = 10.5 / maxV;

      // Wave packet spatial width estimate (approx FWHM of sinc/Gaussian envelope ~ 2*pi / deltaK)
      const approxDxNm = (2 * Math.PI) / Math.max(state.deltaK, 0.05);

      return {
        k0, lambda0Nm, k0SI,
        vgElectron, vpElectron, omega0Electron, energyEv,
        vpVis, vgVis, omega0Vis, cycleDuration, approxDxNm,
      };
    }

    function omegaVisAt(k, phys) {
      if (state.model === 'matter') {
        const alpha = 0.22;
        return alpha * k * k;
      }
      return phys.omega0Vis + phys.vgVis * (k - phys.k0);
    }

    function buildComponents(phys) {
      const N = Math.round(state.nWaves);
      const comps = [];
      for (let j = 0; j < N; j++) {
        const u = N > 1 ? (j / (N - 1) - 0.5) : 0;
        const kj = Math.max(0.3, phys.k0 + u * state.deltaK);
        const wj = omegaVisAt(kj, phys);
        comps.push({ k: kj, omega: wj });
      }
      return comps;
    }

    function syncControlVisibility() {
      const isCustom = state.model === 'custom';
      if (ui.omegaWrap) ui.omegaWrap.style.display = isCustom ? 'flex' : 'none';
      if (ui.vgWrap) ui.vgWrap.style.display = isCustom ? 'flex' : 'none';
    }

    function resetSimulation(keepModel) {
      if (!keepModel) state.model = 'matter';
      state.k0 = 4.5;
      state.omegaScale = 1.0;
      state.vgRatio = 0.65;
      state.nWaves = 11;
      state.deltaK = 1.6;
      state.speed = 1.0;
      state.time = 0;

      if (ui.modelSeg) ui.modelSeg.set(state.model);
      if (ui.k0Slider) ui.k0Slider.setValue(state.k0);
      if (ui.lamSlider) ui.lamSlider.setValue((2 * Math.PI) / state.k0);
      if (ui.omegaSlider) ui.omegaSlider.setValue(state.omegaScale);
      if (ui.vgSlider) ui.vgSlider.setValue(state.vgRatio);
      if (ui.nSlider) ui.nSlider.setValue(state.nWaves);
      if (ui.dkSlider) ui.dkSlider.setValue(state.deltaK);
      if (ui.spdSeg) ui.spdSeg.set(1.0);

      syncControlVisibility();
      updateReadouts();
      updateBanner();
      render();
    }

    function stepOnce() {
      state.playing = false;
      if (ui.transport) ui.transport.setPlaying(false);
      if (dot) dot.textContent = 'Paused';
      const phys = getPhysics();
      state.time = (state.time + 0.16 * state.speed) % phys.cycleDuration;
      render();
      updateReadouts();
    }

    function buildDOM() {
      if (built) return;
      built = true;

      stage.innerHTML = '';
      controls.innerHTML = '';
      formula.innerHTML = '';

      const cv = X.el('canvas', 'viz');
      cv.id = 'cv-c3t2';
      cv.setAttribute('aria-label', 'Wave Packet Superposition, Phase Velocity and Group Velocity Laboratory');
      stage.append(cv);
      canvasObj = X.setupCanvas(cv);

      banner = C.buildBanner(wrap);

      const modWrap = X.el('div', 'slider-block');
      modWrap.append(X.el('label', 'control-label', 'Dispersion Relation Model'));
      controls.append(modWrap);
      ui.modelSeg = X.buildSegmented(modWrap, {
        options: [
          { value: 'matter', label: 'Matter Wave (ω = ħk²/2m)' },
          { value: 'custom', label: 'Custom Dispersion ω(k)' },
        ],
        value: state.model,
        onChange: (m) => {
          state.model = m;
          state.time = 0;
          syncControlVisibility();
          updateReadouts();
          updateBanner();
          render();
        },
      });

      ui.transport = C.buildTransport(controls, {
        onTogglePlay: () => {
          state.playing = !state.playing;
          ui.transport.setPlaying(state.playing);
          if (dot) dot.textContent = state.playing ? 'Live' : 'Paused';
        },
        onStep: stepOnce,
        onReset: () => resetSimulation(true),
        playLabel: 'Pause',
        stepLabel: 'Step →',
      });
      ui.transport.setPlaying(true);

      ui.k0Slider = X.buildSlider(controls, {
        label: 'Central Wave Number k₀',
        id: 'c3t2-k0',
        min: 2.0,
        max: 9.0,
        step: 0.1,
        value: state.k0,
        format: (v) => v.toFixed(1) + ' nm⁻¹',
        onInput: (v) => {
          state.k0 = v;
          ui.lamSlider.setValue((2 * Math.PI) / v);
          updateReadouts();
          updateBanner();
          render();
        },
      });

      ui.lamSlider = X.buildSlider(controls, {
        label: 'Central Wavelength λ₀ = 2π/k₀',
        id: 'c3t2-lam',
        min: (2 * Math.PI) / 9.0,
        max: (2 * Math.PI) / 2.0,
        step: 0.02,
        value: (2 * Math.PI) / state.k0,
        format: (v) => v.toFixed(2) + ' nm',
        onInput: (v) => {
          state.k0 = X.clamp((2 * Math.PI) / v, 2.0, 9.0);
          ui.k0Slider.setValue(state.k0);
          updateReadouts();
          updateBanner();
          render();
        },
      });

      ui.omegaSlider = X.buildSlider(controls, {
        label: 'Carrier Frequency ω₀ (Phase Speed)',
        id: 'c3t2-omega',
        min: 0.3,
        max: 2.0,
        step: 0.05,
        value: state.omegaScale,
        format: (v) => v.toFixed(2) + '× ω_ref',
        onInput: (v) => {
          state.omegaScale = v;
          updateReadouts();
          updateBanner();
          render();
        },
      });
      ui.omegaWrap = ui.omegaSlider.input.closest('.slider-block');

      ui.vgSlider = X.buildSlider(controls, {
        label: 'Group / Phase Ratio (vg / vp)',
        id: 'c3t2-vg',
        min: 0.25,
        max: 2.0,
        step: 0.05,
        value: state.vgRatio,
        format: (v) => v.toFixed(2) + '×',
        onInput: (v) => {
          state.vgRatio = v;
          updateReadouts();
          updateBanner();
          render();
        },
      });
      ui.vgWrap = ui.vgSlider.input.closest('.slider-block');

      ui.nSlider = X.buildSlider(controls, {
        label: 'Number of Component Waves N',
        id: 'c3t2-n',
        min: 3,
        max: 25,
        step: 2,
        value: state.nWaves,
        format: (v) => Math.round(v) + ' waves',
        onInput: (v) => {
          state.nWaves = Math.round(v);
          updateReadouts();
          render();
        },
      });

      ui.dkSlider = X.buildSlider(controls, {
        label: 'Wave-Number Spread Δk',
        id: 'c3t2-dk',
        min: 0.2,
        max: 3.4,
        step: 0.1,
        value: state.deltaK,
        format: (v) => v.toFixed(1) + ' nm⁻¹',
        onInput: (v) => {
          state.deltaK = v;
          updateReadouts();
          updateBanner();
          render();
        },
      });

      const spdWrap = X.el('div', 'slider-block');
      spdWrap.append(X.el('label', 'control-label', 'Simulation Speed'));
      controls.append(spdWrap);
      ui.spdSeg = X.buildSegmented(spdWrap, {
        options: [
          { value: 0.5, label: '0.5×' },
          { value: 1.0, label: '1×' },
          { value: 2.0, label: '2×' },
        ],
        value: state.speed,
        onChange: (s) => { state.speed = s; },
      });

      ui.compToggle = X.buildToggle(controls, {
        label: 'Show sample component waves',
        checked: state.showComponents,
        onChange: (on) => { state.showComponents = on; render(); },
      });

      ui.readouts = X.buildReadouts(controls, [
        { id: 'vp', label: 'Phase Velocity vp = ω/k', primary: true },
        { id: 'vg', label: 'Group Velocity vg = dω/dk' },
        { id: 'dx', label: 'Packet Width ~ 2π/Δk' },
        { id: 'lam', label: 'Central λ₀ & Energy' },
        { id: 'rel', label: 'Velocity Relation', wide: true },
      ]);

      controls.append(X.el('div', 'ctrl-note',
        '<b>Model Assumption:</b> In the free non-relativistic matter-wave model, kinetic dispersion <b>ω = ħk²/(2m)</b> gives <b>vp = v/2</b> and <b>vg = v</b>. This depends on the energy convention and dispersion law — it is <b>not</b> a universal identity for all waves.'
      ));

      syncControlVisibility();
    }

    function updateReadouts() {
      if (!ui.readouts) return;
      const phys = getPhysics();
      if (state.model === 'matter') {
        ui.readouts.set('vp', `${X.fmtSci(phys.vpElectron, 2)} m/s (= v/2)`);
        ui.readouts.set('vg', `${X.fmtSci(phys.vgElectron, 2)} m/s (= v)`);
        ui.readouts.set('dx', `≈ ${phys.approxDxNm.toFixed(2)} nm`);
        ui.readouts.set('lam', `${phys.lambda0Nm.toFixed(2)} nm · ${phys.energyEv.toFixed(2)} eV`);
        ui.readouts.set('rel', 'ω = ħk²/(2m) → Group envelope travels at v, carrier crests lag at v/2');

        formula.innerHTML = `
          <span class="formula active">v<sub>g</sub> = dω/dk = ħk₀/m = v (<span class="fv">${X.fmtSci(phys.vgElectron, 2)} m/s</span>)</span>
          <span class="formula">v<sub>p</sub> = ω/k = ħk₀/(2m) = v/2 (<span class="fv">${X.fmtSci(phys.vpElectron, 2)} m/s</span>)</span>
          <span class="formula">Δx · Δk ≈ 2π (Δk = <span class="fv">${state.deltaK.toFixed(1)} nm⁻¹</span>)</span>`;
      } else {
        ui.readouts.set('vp', `${phys.vpVis.toFixed(2)} units/s`);
        ui.readouts.set('vg', `${phys.vgVis.toFixed(2)} units/s`);
        ui.readouts.set('dx', `≈ ${phys.approxDxNm.toFixed(2)} nm`);
        ui.readouts.set('lam', `λ₀ = ${phys.lambda0Nm.toFixed(2)} nm (k₀ = ${phys.k0.toFixed(1)})`);
        const cmp = Math.abs(state.vgRatio - 1) < 0.06
          ? 'Non-dispersive (vg ≈ vp): carrier locked to envelope'
          : (state.vgRatio > 1 ? 'Anomalous dispersion (vg > vp): crests move backward inside envelope' : 'Normal dispersion (vg < vp): crests overtake packet front');
        ui.readouts.set('rel', cmp);

        formula.innerHTML = `
          <span class="formula active">v<sub>p</sub> = ω/k = <span class="fv">${phys.vpVis.toFixed(2)}</span> · v<sub>g</sub> = dω/dk = <span class="fv">${phys.vgVis.toFixed(2)}</span></span>
          <span class="formula">v<sub>g</sub>/v<sub>p</sub> = <span class="fv">${state.vgRatio.toFixed(2)}</span> · Components N = <span class="fv">${state.nWaves}</span></span>`;
      }
    }

    function updateBanner() {
      if (!banner) return;
      if (state.model === 'matter') {
        banner.set(
          'FREE MATTER WAVE',
          'ok',
          `Yellow marker tracks packet envelope (<b>vg = v</b>); cyan diamond tracks a carrier crest (<b>vp = v/2</b>). Wider <b>Δk = ${state.deltaK.toFixed(1)} nm⁻¹</b> yields a tighter localized packet.`
        );
      } else {
        banner.set(
          'CUSTOM DISPERSION',
          '',
          `Superposing <b>${state.nWaves} waves</b> across Δk = ${state.deltaK.toFixed(1)} nm⁻¹ with vg/vp = <b>${state.vgRatio.toFixed(2)}</b>. Watch carrier crests slide relative to the envelope.`
        );
      }
    }

    function render() {
      if (!canvasObj) return;
      const { ctx, w, h } = canvasObj;
      ctx.clearRect(0, 0, w, h);

      const narrow = w < 620;
      const pad = narrow ? 14 : 20;
      const phys = getPhysics();
      const comps = buildComponents(phys);
      const tAnim = C.prefersReducedMotion() ? 0 : (state.time % phys.cycleDuration);

      // Top section: Optional component waves + Main Superposed Wave Packet
      const compH = state.showComponents ? h * 0.16 : 0;
      const mainY = 34 + (state.showComponents ? compH + 16 : 0);
      const dispH = h * 0.25;
      const mainH = Math.max(120, h - mainY - dispH - 40);

      const gx0 = pad + 26, gx1 = w - pad - 16, gw = gx1 - gx0;
      const PX = (x) => gx0 + ((x - X_MIN) / (X_MAX - X_MIN)) * gw;

      ctx.textAlign = 'left';
      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillText('WAVE PACKET SUPERPOSITION: PHASE MARKER (vp) vs. ENVELOPE MARKER (vg)', pad, 20);

      // Component waves strip
      if (state.showComponents && compH > 40) {
        const cy0 = 32;
        ctx.fillStyle = 'rgba(6,10,24,0.68)';
        ctx.fillRect(gx0, cy0, gw, compH);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.strokeRect(gx0, cy0, gw, compH);

        ctx.fillStyle = '#8f9cb5';
        ctx.font = '9px Inter, sans-serif';
        ctx.fillText(`Sample Component Waves (N = ${comps.length}, Δk = ${state.deltaK.toFixed(1)} nm⁻¹)`, gx0 + 8, cy0 + 13);

        const sampleIdx = [0, Math.floor(comps.length / 2), comps.length - 1];
        const sCols = ['rgba(96,165,250,0.65)', 'rgba(52,211,153,0.75)', 'rgba(244,114,182,0.65)'];
        const cMid = cy0 + compH * 0.60;
        const cAmp = compH * 0.28;
        sampleIdx.forEach((ci, sIdx) => {
          const c = comps[ci];
          ctx.beginPath();
          for (let i = 0; i <= 180; i++) {
            const xv = X_MIN + (i / 180) * (X_MAX - X_MIN);
            const yv = cMid - Math.cos(c.k * (xv - X_INIT) - c.omega * tAnim) * cAmp;
            const px = PX(xv);
            if (i === 0) ctx.moveTo(px, yv); else ctx.lineTo(px, yv);
          }
          ctx.strokeStyle = sCols[sIdx];
          ctx.lineWidth = 1.3;
          ctx.stroke();
        });
      }

      // Main Resultant Wave Packet Plot
      ctx.fillStyle = 'rgba(6,10,24,0.76)';
      ctx.fillRect(gx0, mainY, gw, mainH);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.strokeRect(gx0, mainY, gw, mainH);

      const mMid = mainY + mainH * 0.54;
      const mAmp = mainH * 0.36;

      // Axis line
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath(); ctx.moveTo(gx0, mMid); ctx.lineTo(gx1, mMid); ctx.stroke();

      // Resultant superposition wave psi(x,t)
      const samples = 360;
      ctx.beginPath();
      for (let i = 0; i <= samples; i++) {
        const xv = X_MIN + (i / samples) * (X_MAX - X_MIN);
        let sum = 0;
        for (let j = 0; j < comps.length; j++) {
          sum += Math.cos(comps[j].k * (xv - X_INIT) - comps[j].omega * tAnim);
        }
        const psi = sum / comps.length;
        const px = PX(xv);
        const py = mMid - psi * mAmp;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2.1;
      ctx.stroke();

      // Exact analytic envelope of N equally spaced waves: sin(N * dPhi / 2) / (N * sin(dPhi / 2))
      const xg = X_INIT + phys.vgVis * tAnim;
      const xp = X_INIT + phys.vpVis * tAnim;
      const N = comps.length;
      const dkStep = N > 1 ? state.deltaK / (N - 1) : 0;

      [-1, 1].forEach((sgn) => {
        ctx.beginPath();
        for (let i = 0; i <= samples; i++) {
          const xv = X_MIN + (i / samples) * (X_MAX - X_MIN);
          const dx = xv - xg;
          let env = 1;
          if (N > 1 && dkStep > 0) {
            const halfArg = 0.5 * dkStep * dx;
            const denom = N * Math.sin(halfArg);
            env = Math.abs(denom) < 1e-6 ? 1 : Math.abs(Math.sin(N * halfArg) / denom);
          }
          const px = PX(xv);
          const py = mMid - sgn * env * mAmp;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = 'rgba(224,181,83,0.75)';
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // Marker 1: Group Velocity (Envelope Peak)
      if (xg >= X_MIN && xg <= X_MAX) {
        const pgx = PX(xg);
        ctx.strokeStyle = '#e0b553';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(pgx, mainY + 14); ctx.lineTo(pgx, mainY + mainH - 12); ctx.stroke();
        ctx.fillStyle = '#e0b553';
        ctx.beginPath(); ctx.arc(pgx, mMid - mAmp, 5.5, 0, Math.PI * 2); ctx.fill();
        ctx.font = 'bold 9.5px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(state.model === 'matter' ? 'Envelope (vg = v)' : 'Envelope (vg)', pgx, mainY + 13);
      }

      // Marker 2: Phase Velocity (Carrier Crest)
      if (xp >= X_MIN && xp <= X_MAX) {
        const ppx = PX(xp);
        ctx.fillStyle = '#22d3ee';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(ppx, mMid - 7);
        ctx.lineTo(ppx + 6, mMid);
        ctx.lineTo(ppx, mMid + 7);
        ctx.lineTo(ppx - 6, mMid);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.font = 'bold 9.5px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(state.model === 'matter' ? 'Phase (vp = v/2)' : 'Phase (vp)', ppx, mainY + mainH - 8);
      }

      // Position axis ticks
      ctx.fillStyle = '#8f9cb5';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      [-6, -3, 0, 3, 6].forEach((xv) => ctx.fillText(xv + ' nm', PX(xv), mainY + mainH + 13));

      // Bottom Dispersion & Spectrum Inset
      const dY = mainY + mainH + 24;
      const dH = h - dY - 12;
      if (dH < 65) return;

      const halfW = (gw - 16) / 2;
      // Left: Dispersion omega(k) showing secant vp vs tangent vg
      ctx.fillStyle = 'rgba(6,10,24,0.72)';
      ctx.fillRect(gx0, dY, halfW, dH);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.strokeRect(gx0, dY, halfW, dH);

      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 9.5px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('DISPERSION ω(k): SECANT vp vs TANGENT vg', gx0 + 8, dY + 15);

      const kMinP = 0, kMaxP = 10;
      const wMaxP = 22;
      const DKX = (k) => gx0 + 18 + (k / kMaxP) * (halfW - 30);
      const DWY = (om) => dY + dH - 12 - X.clamp(om / wMaxP, 0, 1) * (dH - 34);

      ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const kv = (i / 80) * kMaxP;
        const wv = omegaVisAt(kv, phys);
        const px = DKX(kv), py = DWY(wv);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Secant from (0,0) to (k0, w0) -> slope = vp
      const kx0 = DKX(phys.k0), wy0 = DWY(phys.omega0Vis);
      ctx.strokeStyle = '#22d3ee';
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(DKX(0), DWY(0)); ctx.lineTo(kx0, wy0); ctx.stroke();
      ctx.setLineDash([]);

      // Tangent at k0 -> slope = vg
      const dkTan = 1.6;
      ctx.strokeStyle = '#e0b553';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(DKX(phys.k0 - dkTan), DWY(phys.omega0Vis - phys.vgVis * dkTan));
      ctx.lineTo(DKX(phys.k0 + dkTan), DWY(phys.omega0Vis + phys.vgVis * dkTan));
      ctx.stroke();

      ctx.fillStyle = '#e0b553';
      ctx.beginPath(); ctx.arc(kx0, wy0, 4.2, 0, Math.PI * 2); ctx.fill();

      // Right: Spectral k-space distribution
      const rx0 = gx0 + halfW + 16;
      ctx.fillStyle = 'rgba(6,10,24,0.72)';
      ctx.fillRect(rx0, dY, halfW, dH);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.strokeRect(rx0, dY, halfW, dH);
      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 9.5px Inter, sans-serif';
      ctx.fillText('WAVE-NUMBER SPECTRUM A(k)', rx0 + 8, dY + 15);

      const KAX = (k) => rx0 + 18 + (k / 11) * (halfW - 30);
      const baseK = dY + dH - 14;
      comps.forEach((c) => {
        const kx = KAX(c.k);
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(kx, baseK); ctx.lineTo(kx, dY + 30); ctx.stroke();
      });
      ctx.fillStyle = '#8f9cb5';
      ctx.font = '8.5px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Δk = ${state.deltaK.toFixed(1)} nm⁻¹ → Δx ≈ ${phys.approxDxNm.toFixed(2)} nm`, rx0 + halfW / 2, dY + dH - 3);
    }

    return {
      mount() {
        buildDOM();
        canvasObj = X.setupCanvas(document.getElementById('cv-c3t2'));
        updateReadouts();
        updateBanner();
        render();
      },
      unmount() {},
      tick(dt) {
        if (state.playing) {
          const phys = getPhysics();
          state.time = (state.time + dt * state.speed) % phys.cycleDuration;
        }
        render();
      },
      resize() {
        const cv = document.getElementById('cv-c3t2');
        if (cv) canvasObj = X.setupCanvas(cv);
        render();
      },
      applyPreset(preset) {
        if (preset === 'custom-slow') {
          state.model = 'custom';
          state.omegaScale = 1.3;
          state.vgRatio = 0.45;
        } else if (preset === 'narrow-packet') {
          state.model = 'matter';
          state.deltaK = 3.2;
          state.nWaves = 19;
          if (ui.dkSlider) ui.dkSlider.setValue(3.2);
          if (ui.nSlider) ui.nSlider.setValue(19);
        } else {
          state.model = 'matter';
        }
        state.time = 0;
        if (ui.modelSeg) ui.modelSeg.set(state.model);
        if (ui.omegaSlider) ui.omegaSlider.setValue(state.omegaScale);
        if (ui.vgSlider) ui.vgSlider.setValue(state.vgRatio);
        syncControlVisibility();
        updateReadouts();
        updateBanner();
        render();
      },
      getPhysics,
      getState: () => state,
    };
  };
})();
