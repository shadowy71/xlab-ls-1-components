(function () {
  'use strict';

  const C = window.Ch3Platform;
  const X = window.XLab;
  const P = C.PHYSICS;

  window.CH3_SIMS['c3t6'] = function createTunnellingLab(ctxDom) {
    const { stage, controls, formula, wrap, dot } = ctxDom;

    const TWO_ME_OVER_HBAR2 = 1 / P.hbar2_over_2me_eV_nm2; // ~26.2468 eV^-1 nm^-2

    // Complex arithmetic helpers: [re, im]
    const cAdd = (a, b) => [a[0] + b[0], a[1] + b[1]];
    const cSub = (a, b) => [a[0] - b[0], a[1] - b[1]];
    const cMul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
    const cDiv = (a, b) => {
      const d = b[0] * b[0] + b[1] * b[1] + 1e-30;
      return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
    };
    const cScale = (a, s) => [a[0] * s, a[1] * s];
    const cAbs2 = (a) => a[0] * a[0] + a[1] * a[1];
    const cExpI = (theta) => [Math.cos(theta), Math.sin(theta)];

    const state = {
      playing: true,
      energyEv: 2.20,          // Particle energy E (0.20 .. 12.0 eV)
      v0Ev: 4.50,              // Barrier height V0 (0.50 .. 10.0 eV)
      widthNm: 0.40,           // Barrier width a (0.10 .. 1.60 nm)
      massMe: 1.00,            // Particle mass in m_e (0.20 .. 5.00)
      showProbDensity: true,   // Overlay |psi(x)|^2 shading
      time: 0,
    };

    let built = false;
    let canvasObj = null;
    let ui = {};
    let banner = null;

    function calcTransmission(E, V0, aNm, massMe) {
      const m = massMe * P.m_e;
      const E_J = C.evToJ(E);
      const V0_J = C.evToJ(V0);
      const a = aNm * 1e-9;
      const k = Math.sqrt(2 * m * E_J) / P.hbar;
      const diff = V0_J - E_J;

      let T = 0;
      let kappaOrQ = 0;
      let regime = 'tunnel'; // 'tunnel' | 'over' | 'edge'

      if (Math.abs(V0 - E) < 1e-4) {
        regime = 'edge';
        T = 1 / (1 + (m * V0_J * a * a) / (2 * P.hbar * P.hbar));
      } else if (E < V0) {
        regime = 'tunnel';
        const kappa = Math.sqrt(2 * m * diff) / P.hbar;
        kappaOrQ = kappa;
        const ka = kappa * a;
        if (ka > 25) {
          // Overflow-safe exact asymptotic: sinh(ka) ~ 0.5 * exp(ka)
          const pref = (16 * E * (V0 - E)) / (V0 * V0);
          T = pref * Math.exp(-2 * ka);
        } else {
          const sh = Math.sinh(ka);
          const denom = 1 + (V0 * V0 * sh * sh) / (4 * E * (V0 - E));
          T = 1 / denom;
        }
      } else {
        regime = 'over';
        const q = Math.sqrt(2 * m * (E_J - V0_J)) / P.hbar;
        kappaOrQ = q;
        const sn = Math.sin(q * a);
        const denom = 1 + (V0 * V0 * sn * sn) / (4 * E * (E - V0));
        T = 1 / denom;
      }

      T = X.clamp(T, 0, 1);
      const R = 1 - T;
      return { T, R, regime, kappaOrQ, k };
    }

    // Exact overflow-safe complex scattering state matching psi and psi' at x=0 and x=a
    function buildScatteringCoefficients() {
      const E = state.energyEv;
      const V0 = state.v0Ev;
      const a = state.widthNm;
      const factor = state.massMe * TWO_ME_OVER_HBAR2;
      const k = Math.sqrt(factor * E);

      if (Math.abs(E - V0) < 1e-4) {
        // psi2(x) = 1 + i k (x - a)
        const psi0 = [1, -k * a];
        const dpsi0OverIk = [1, 0];
        const Ainc = cScale(cAdd(psi0, dpsi0OverIk), 0.5);
        const Bref = cScale(cSub(psi0, dpsi0OverIk), 0.5);
        const t = cDiv([1, 0], Ainc);
        const r = cDiv(Bref, Ainc);
        return { mode: 'edge', k, a, Ainc, r, t };
      }

      if (E < V0) {
        const kappa = Math.sqrt(factor * (V0 - E));
        const e2 = Math.exp(-2 * kappa * a);
        const cPlus = [1, k / kappa];   // 1 + ik/kappa
        const cMinus = [1, -k / kappa]; // 1 - ik/kappa
        const psi0 = cScale(cAdd(cScale(cPlus, e2), cMinus), 0.5);
        // dpsi/dx / (ik) = [ kappa*cPlus*e2 - kappa*cMinus ] / (2 i k)
        const numD = cSub(cScale(cPlus, kappa * e2), cScale(cMinus, kappa));
        const dpsi0OverIk = cDiv(numD, [0, 2 * k]);
        const Ainc = cScale(cAdd(psi0, dpsi0OverIk), 0.5);
        const Bref = cScale(cSub(psi0, dpsi0OverIk), 0.5);
        const e1 = Math.exp(-kappa * a);
        const t = cDiv([e1, 0], Ainc);
        const r = cDiv(Bref, Ainc);
        return { mode: 'tunnel', k, kappa, a, cPlus, cMinus, Ainc, r, t };
      }

      // E > V0
      const q = Math.sqrt(factor * (E - V0));
      const cosQa = Math.cos(q * a);
      const sinQa = Math.sin(q * a);
      const D = [0, k / q]; // i k / q
      const psi0 = cSub([cosQa, 0], cScale(D, sinQa));
      const dpsi0 = cAdd([q * sinQa, 0], cScale(D, q * cosQa));
      const dpsi0OverIk = cDiv(dpsi0, [0, k]);
      const Ainc = cScale(cAdd(psi0, dpsi0OverIk), 0.5);
      const Bref = cScale(cSub(psi0, dpsi0OverIk), 0.5);
      const t = cDiv([1, 0], Ainc);
      const r = cDiv(Bref, Ainc);
      return { mode: 'over', k, q, a, D, Ainc, r, t };
    }

    function evalScatteringPsi(xNm, coeff) {
      if (xNm < 0) {
        const inc = cExpI(coeff.k * xNm);
        const ref = cMul(coeff.r, cExpI(-coeff.k * xNm));
        return cAdd(inc, ref);
      }
      if (xNm > coeff.a) {
        return cMul(coeff.t, cExpI(coeff.k * (xNm - coeff.a)));
      }
      if (coeff.mode === 'edge') {
        return cDiv([1, coeff.k * (xNm - coeff.a)], coeff.Ainc);
      }
      if (coeff.mode === 'tunnel') {
        const eR = Math.exp(-coeff.kappa * (2 * coeff.a - xNm));
        const eL = Math.exp(-coeff.kappa * xNm);
        const hatPsi = cScale(cAdd(cScale(coeff.cPlus, eR), cScale(coeff.cMinus, eL)), 0.5);
        return cDiv(hatPsi, coeff.Ainc);
      }
      const d = coeff.a - xNm;
      const psi2 = cSub([Math.cos(coeff.q * d), 0], cScale(coeff.D, Math.sin(coeff.q * d)));
      return cDiv(psi2, coeff.Ainc);
    }

    function resetSimulation() {
      state.energyEv = 2.20;
      state.v0Ev = 4.50;
      state.widthNm = 0.40;
      state.massMe = 1.00;
      state.showProbDensity = true;
      state.time = 0;

      if (ui.eSlider) ui.eSlider.setValue(2.20);
      if (ui.v0Slider) ui.v0Slider.setValue(4.50);
      if (ui.aSlider) ui.aSlider.setValue(0.40);
      if (ui.mSlider) ui.mSlider.setValue(1.00);
      if (ui.probToggle) ui.probToggle.checked = true;

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
      cv.id = 'cv-c3t6';
      cv.setAttribute('aria-label', 'Quantum Tunnelling Rectangular Potential Barrier Simulator');
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
        { id: 'tunnel', label: 'Tunnel (E < V₀)', primary: true, onClick: () => applyPreset('tunnel') },
        { id: 'over', label: 'Over-Barrier (E > V₀)', onClick: () => applyPreset('over-barrier') },
      ]);

      ui.eSlider = X.buildSlider(controls, {
        label: 'Particle Energy E',
        id: 'c3t6-E',
        min: 0.20,
        max: 11.0,
        step: 0.05,
        value: state.energyEv,
        format: (v) => v.toFixed(2) + ' eV',
        onInput: (v) => { state.energyEv = v; updateReadouts(); updateBanner(); render(); },
      });

      ui.v0Slider = X.buildSlider(controls, {
        label: 'Barrier Height V₀',
        id: 'c3t6-v0',
        min: 0.50,
        max: 10.0,
        step: 0.05,
        value: state.v0Ev,
        format: (v) => v.toFixed(2) + ' eV',
        onInput: (v) => { state.v0Ev = v; updateReadouts(); updateBanner(); render(); },
      });

      ui.aSlider = X.buildSlider(controls, {
        label: 'Barrier Width a',
        id: 'c3t6-a',
        min: 0.10,
        max: 1.60,
        step: 0.02,
        value: state.widthNm,
        format: (v) => v.toFixed(2) + ' nm',
        onInput: (v) => { state.widthNm = v; updateReadouts(); updateBanner(); render(); },
      });

      ui.mSlider = X.buildSlider(controls, {
        label: 'Particle Mass m (in mₑ)',
        id: 'c3t6-m',
        min: 0.20,
        max: 5.00,
        step: 0.05,
        value: state.massMe,
        format: (v) => v.toFixed(2) + ' mₑ',
        onInput: (v) => { state.massMe = v; updateReadouts(); updateBanner(); render(); },
      });

      ui.probToggle = X.buildToggle(controls, {
        label: 'Show probability density |ψ(x)|² envelope',
        checked: state.showProbDensity,
        onChange: (on) => { state.showProbDensity = on; render(); },
      });

      ui.readouts = X.buildReadouts(controls, [
        { id: 'T', label: 'Transmission Prob T', primary: true },
        { id: 'R', label: 'Reflection Prob R = 1 − T' },
        { id: 'sum', label: 'Conservation R + T' },
        { id: 'kq', label: 'Decay κ / Barrier Wave q' },
        { id: 'regime', label: 'Classical vs. Quantum', wide: true },
      ]);
      ui.readoutLabels = controls.querySelectorAll('.readout .r-label');

      controls.append(X.el('div', 'ctrl-note',
        '<b>Model Note:</b> Wavefunction displays the exact steady-state complex plane-wave scattering solution ψ(x)e<sup>−iEt/ħ</sup> matched at x = 0 and x = a (so |t|² = T and |r|² = R), rather than a finite localized pulse.'
      ));
    }

    function updateReadouts() {
      if (!ui.readouts) return;
      const res = calcTransmission(state.energyEv, state.v0Ev, state.widthNm, state.massMe);
      const tPct = res.T * 100;
      const rPct = res.R * 100;
      const tFmt = tPct >= 0.1 ? tPct.toFixed(2) + '%' : (tPct >= 1e-4 ? tPct.toFixed(4) + '%' : X.fmtSci(res.T, 2));
      const rFmt = rPct >= 0.1 ? rPct.toFixed(2) + '%' : rPct.toFixed(4) + '%';

      ui.readouts.set('T', `${res.T >= 0.001 ? res.T.toFixed(4) : X.fmtSci(res.T, 2)} (${tFmt})`);
      ui.readouts.set('R', `${res.R.toFixed(4)} (${rFmt})`);
      ui.readouts.set('sum', `${(res.R + res.T).toFixed(4)} = 1 ✓`);

      if (ui.readoutLabels && ui.readoutLabels.length >= 4) {
        ui.readoutLabels[3].textContent = res.regime === 'tunnel' ? 'Barrier Decay Constant κ' : 'Barrier Wave Number q';
      }
      const kqNm = res.kappaOrQ * 1e-9;
      ui.readouts.set('kq', res.regime === 'edge' ? 'E = V₀ limit' : `${kqNm.toFixed(2)} nm⁻¹`);
      ui.readouts.set('regime', res.regime === 'tunnel'
        ? 'E < V₀: Classical predicts T = 0; Quantum T > 0 (Tunnelling!)'
        : (res.T > 0.995
          ? 'E > V₀: Transmission resonance (qa ≈ mπ → T ≈ 1)!'
          : 'E > V₀: Classical predicts T = 1; Quantum partial reflection R > 0!'));

      formula.innerHTML = res.regime === 'tunnel'
        ? `<span class="formula active">T = [1 + V₀² sinh²(κa) / (4E(V₀−E))]⁻¹ = <span class="fv">${res.T >= 0.001 ? res.T.toFixed(4) : X.fmtSci(res.T, 2)}</span></span>
           <span class="formula">κ = √(2m(V₀−E))/ħ = <span class="fv">${kqNm.toFixed(2)} nm⁻¹</span></span>
           <span class="formula">R + T = <span class="fv">1.000</span></span>`
        : `<span class="formula active">T = [1 + V₀² sin²(qa) / (4E(E−V₀))]⁻¹ = <span class="fv">${res.T.toFixed(4)}</span></span>
           <span class="formula">q = √(2m(E−V₀))/ħ = <span class="fv">${kqNm.toFixed(2)} nm⁻¹</span></span>
           <span class="formula">R + T = <span class="fv">1.000</span></span>`;
    }

    function updateBanner() {
      if (!banner) return;
      const res = calcTransmission(state.energyEv, state.v0Ev, state.widthNm, state.massMe);
      if (res.regime === 'tunnel') {
        banner.set(
          'CASE A · TUNNELLING (E < V₀)',
          res.T > 0.01 ? 'ok' : '',
          `Particle energy <b>E (${state.energyEv.toFixed(2)} eV) &lt; V₀ (${state.v0Ev.toFixed(2)} eV)</b>. Classically impossible, yet ψ decays inside the barrier (e<sup>−κx</sup>) and transmits <b>T = ${(res.T * 100).toFixed(2)}%</b>.`
        );
      } else {
        banner.set(
          'CASE B · OVER-BARRIER (E > V₀)',
          'ok',
          `Particle energy <b>E (${state.energyEv.toFixed(2)} eV) &gt; V₀ (${state.v0Ev.toFixed(2)} eV)</b>. Quantum wave interference inside the barrier gives <b>T = ${(res.T * 100).toFixed(2)}%</b> and partial reflection <b>R = ${(res.R * 100).toFixed(2)}%</b>.`
        );
      }
    }

    function render() {
      if (!canvasObj) return;
      const { ctx, w, h } = canvasObj;
      ctx.clearRect(0, 0, w, h);

      const narrow = w < 620;
      const pad = narrow ? 14 : 20;
      const res = calcTransmission(state.energyEv, state.v0Ev, state.widthNm, state.massMe);
      const coeff = buildScatteringCoefficients();

      // Top Stage (~58%): Barrier & Scattering Wavefunction psi(x,t)
      const topY = 34;
      const topH = h * 0.52;
      const gx0 = pad + 34, gx1 = w - pad - 16, gw = gx1 - gx0;

      ctx.textAlign = 'left';
      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillText('1D RECTANGULAR POTENTIAL BARRIER & CONSISTENT SCATTERING WAVE ψ(x,t)', pad, 20);

      ctx.fillStyle = 'rgba(6,10,24,0.74)';
      ctx.fillRect(gx0, topY, gw, topH);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.strokeRect(gx0, topY, gw, topH);

      // Spatial domain [-1.8, +3.2] nm with barrier [0, a] centered cleanly around mid-left
      const xMin = -1.6, xMax = 2.8;
      const PX = (x) => gx0 + ((x - xMin) / (xMax - xMin)) * gw;
      const bX0 = PX(0);
      const bX1 = PX(state.widthNm);

      // Energy vertical axis scale for barrier & E line
      const eBase = topY + topH - 22;
      const eTop = topY + 24;
      const eMaxPlot = 12.0;
      const EY = (ev) => eBase - X.clamp(ev / eMaxPlot, 0, 1) * (eBase - eTop);

      // Draw Rectangular Potential Barrier V(x)
      const yV0 = EY(state.v0Ev);
      ctx.fillStyle = 'rgba(224,181,83,0.16)';
      ctx.fillRect(bX0, yV0, Math.max(4, bX1 - bX0), eBase - yV0);
      ctx.strokeStyle = '#e0b553';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(gx0, eBase);
      ctx.lineTo(bX0, eBase);
      ctx.lineTo(bX0, yV0);
      ctx.lineTo(bX1, yV0);
      ctx.lineTo(bX1, eBase);
      ctx.lineTo(gx1, eBase);
      ctx.stroke();

      // Particle Energy line E
      const yE = EY(state.energyEv);
      ctx.strokeStyle = 'rgba(52,211,153,0.65)';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(gx0, yE); ctx.lineTo(gx1, yE); ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#e0b553';
      ctx.font = 'bold 9.5px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`V₀=${state.v0Ev.toFixed(1)} eV`, (bX0 + bX1) / 2, Math.max(topY + 14, yV0 - 6));

      ctx.fillStyle = '#34d399';
      ctx.textAlign = 'right';
      ctx.fillText(`E=${state.energyEv.toFixed(2)} eV`, gx1 - 8, yE - 5);

      // Wavefunction axis centered around yE (or mid-height so waves don't clip!)
      const waveCenter = topY + topH * 0.56;
      const waveAmp = topH * 0.19;
      const tAnim = C.prefersReducedMotion() ? 0 : state.time;
      const phaseFactor = cExpI(-tAnim * (1.8 + state.energyEv * 0.65));

      // Compute exact scattering psi across xMin..xMax
      const samples = 260;
      const pts = [];
      for (let i = 0; i <= samples; i++) {
        const xv = xMin + (i / samples) * (xMax - xMin);
        const psiC = evalScatteringPsi(xv, coeff);
        const psiTime = cMul(psiC, phaseFactor);
        const prob = cAbs2(psiC);
        pts.push({ x: xv, re: psiTime[0], prob });
      }

      // Probability density envelope |psi(x)|^2 shading
      if (state.showProbDensity) {
        ctx.beginPath();
        pts.forEach((p, i) => {
          const px = PX(p.x);
          const py = eBase - Math.min(4.0, p.prob) * (topH * 0.21);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.lineTo(gx1, eBase);
        ctx.lineTo(gx0, eBase);
        ctx.closePath();
        ctx.fillStyle = 'rgba(244,114,182,0.16)';
        ctx.fill();

        ctx.beginPath();
        pts.forEach((p, i) => {
          const px = PX(p.x);
          const py = eBase - Math.min(4.0, p.prob) * (topH * 0.21);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.strokeStyle = 'rgba(244,114,182,0.65)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Re[psi(x,t)] wave line
      ctx.beginPath();
      pts.forEach((p, i) => {
        const px = PX(p.x);
        const py = X.clamp(waveCenter - p.re * waveAmp, topY + 8, eBase - 2);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // Region annotations: Incident+Reflected | Barrier | Transmitted
      ctx.font = 'bold 9.5px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#22d3ee';
      ctx.fillText(`Incident + Reflected (R=${(res.R * 100).toFixed(1)}%)`, gx0 + 8, topY + 15);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#34d399';
      ctx.fillText(`Transmitted (T=${(res.T * 100).toFixed(2)}%)`, gx1 - 8, topY + 15);

      // Bottom Stage: Graph of Transmission Probability T(E) vs Particle Energy E
      const gY0 = topY + topH + 28;
      const gY1 = h - 28;
      if (gY1 - gY0 < 80) return;

      ctx.fillStyle = 'rgba(6,10,24,0.74)';
      ctx.fillRect(gx0, gY0, gw, gY1 - gY0);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.strokeRect(gx0, gY0, gw, gY1 - gY0);

      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 10.5px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('TRANSMISSION PROBABILITY T(E) vs. PARTICLE ENERGY E', gx0 + 6, gY0 - 7);

      const EMaxPlot = 11.5;
      const TEX = (ev) => gx0 + 10 + (ev / EMaxPlot) * (gw - 20);
      const TEY = (tVal) => gY1 - 12 - X.clamp(tVal, 0, 1) * (gY1 - gY0 - 28);

      // Classical V0 vertical threshold line
      if (state.v0Ev <= EMaxPlot) {
        const vx = TEX(state.v0Ev);
        ctx.strokeStyle = 'rgba(224,181,83,0.55)';
        ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(vx, gY0 + 6); ctx.lineTo(vx, gY1 - 6); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#e0b553';
        ctx.font = '8.5px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`E = V₀ (${state.v0Ev.toFixed(1)} eV)`, vx, gY0 + 16);
      }

      // Curve T(E)
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const ev = 0.05 + (i / 200) * (EMaxPlot - 0.05);
        const tr = calcTransmission(ev, state.v0Ev, state.widthNm, state.massMe).T;
        const px = TEX(ev), py = TEY(tr);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // Current operating dot (E, T)
      const cxDot = TEX(state.energyEv), cyDot = TEY(res.T);
      ctx.fillStyle = '#f472b6';
      ctx.beginPath(); ctx.arc(cxDot, cyDot, 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4; ctx.stroke();

      // Axis labels
      ctx.fillStyle = '#8f9cb5';
      ctx.font = '8.5px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      [0, 2, 4, 6, 8, 10].forEach((ev) => ctx.fillText(ev + ' eV', TEX(ev), gY1 + 13));
      ctx.textAlign = 'right';
      ctx.fillText('1.0', gx0 - 5, TEY(1.0) + 3);
      ctx.fillText('0.5', gx0 - 5, TEY(0.5) + 3);
      ctx.fillText('0.0', gx0 - 5, TEY(0.0) + 3);
    }

    function applyPreset(preset) {
      if (preset === 'thick-barrier') {
        state.energyEv = 2.20;
        state.v0Ev = 4.50;
        state.widthNm = 0.90;
      } else if (preset === 'over-barrier') {
        state.energyEv = 6.20;
        state.v0Ev = 4.50;
        state.widthNm = 0.40;
      } else if (preset === 'resonance') {
        // Compute exact first resonance E = V0 + (pi^2 hbar^2) / (2 m a^2)
        state.v0Ev = 4.00;
        state.widthNm = 0.50;
        state.massMe = 1.00;
        const dE = (Math.PI * Math.PI) / (TWO_ME_OVER_HBAR2 * state.widthNm * state.widthNm); // ~1.504 eV
        state.energyEv = Number((state.v0Ev + dE).toFixed(2));
      } else {
        state.energyEv = 2.20;
        state.v0Ev = 4.50;
        state.widthNm = 0.40;
      }
      if (ui.eSlider) ui.eSlider.setValue(state.energyEv);
      if (ui.v0Slider) ui.v0Slider.setValue(state.v0Ev);
      if (ui.aSlider) ui.aSlider.setValue(state.widthNm);
      if (ui.mSlider) ui.mSlider.setValue(state.massMe);
      updateReadouts();
      updateBanner();
      render();
    }

    return {
      mount() {
        buildDOM();
        canvasObj = X.setupCanvas(document.getElementById('cv-c3t6'));
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
        const cv = document.getElementById('cv-c3t6');
        if (cv) canvasObj = X.setupCanvas(cv);
        render();
      },
      applyPreset,
      calcTransmission,
      evalScatteringPsi,
      buildScatteringCoefficients,
      getState: () => state,
    };
  };
})();
