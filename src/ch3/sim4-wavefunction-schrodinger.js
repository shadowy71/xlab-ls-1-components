(function () {
  'use strict';

  const C = window.Ch3Platform;
  const X = window.XLab;
  const P = C.PHYSICS;

  window.CH3_SIMS['c3t4'] = function createWaveFunctionLab(ctxDom) {
    const { stage, controls, formula, wrap, dot } = ctxDom;
    const svgEl = C.svgEl;

    // 2*m_e / hbar^2 in eV^-1 * nm^-2 (~26.2468)
    const TWO_M_OVER_HBAR2 = 1 / P.hbar2_over_2me_eV_nm2;

    const state = {
      tab: 'normalization',    // 'normalization' | 'wellbehaved' | 'schrodinger'
      // Tab A: Normalization
      shape: 'gaussian',       // 'gaussian' | 'superpos' | 'boxmode'
      ampScale: 1.45,          // raw amplitude multiplier A
      x1: -0.8,                // interval start (nm)
      x2: 0.8,                 // interval end (nm)
      // Tab B: Well-behaved explorer
      wbCase: 'valid',         // 'valid' | 'multivalued' | 'divergent' | 'discontinuous' | 'wallkink' | 'nonnorm'
      // Tab C: TISE Explorer
      potType: 'step',         // 'step' | 'well' | 'harmonic'
      energyEv: 2.4,           // E (eV)
      v0Ev: 3.5,               // V0 (eV)
      probeX: 0.0,             // inspection position x0 (nm)
    };

    let built = false;
    let ui = {};
    let banner = null;
    let subtabBar = null;

    /* ============================================================
       TAB A: EXACT NUMERICAL NORMALIZATION & CDF
       ============================================================ */
    const X_DOM = 4.0; // [-4, +4] nm
    function evalBaseShape(x) {
      if (state.shape === 'gaussian') {
        // Pre-normalized unit Gaussian (sigma = 0.75 nm): integral of |psi|^2 over R is 1
        const s = 0.75;
        return Math.pow(1 / (2 * Math.PI * s * s), 0.25) * Math.exp(-(x * x) / (4 * s * s));
      }
      if (state.shape === 'superpos') {
        // Smooth antisymmetric/asymmetric two-lobe real wavefunction
        const g1 = Math.exp(-Math.pow((x + 1.05) / 0.65, 2));
        const g2 = Math.exp(-Math.pow((x - 1.05) / 0.65, 2));
        return 0.75 * (g1 - 0.85 * g2);
      }
      // Box-like cosine/sine packet inside [-3, 3] nm
      if (Math.abs(x) >= 3.0) return 0;
      return Math.sqrt(2 / 6.0) * Math.sin((2 * Math.PI * (x + 3.0)) / 6.0);
    }

    function calcNormMetrics() {
      const N = 400;
      const dx = (2 * X_DOM) / N;
      const a = Math.min(state.x1, state.x2);
      const b = Math.max(state.x1, state.x2);
      let totalInt = 0;
      let intervalInt = 0;
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const x = -X_DOM + i * dx;
        const psi = state.ampScale * evalBaseShape(x);
        const prob = psi * psi;
        const w = (i === 0 || i === N) ? 0.5 : 1.0;
        totalInt += w * prob * dx;
        if (x >= a && x <= b) intervalInt += w * prob * dx;
        if (i % 2 === 0) pts.push({ x, psi, prob });
      }
      const normFactor = 1 / Math.sqrt(Math.max(totalInt, 1e-12));
      const isNormalized = Math.abs(totalInt - 1.0) <= 0.015;
      const intervalProbNorm = intervalInt / Math.max(totalInt, 1e-12);
      return { totalInt, intervalInt, intervalProbNorm, normFactor, isNormalized, pts, a, b };
    }

    /* ============================================================
       TAB C: 1D TIME-INDEPENDENT SCHRODINGER RK4 INTEGRATOR
       ============================================================ */
    function evalPotential(x) {
      if (state.potType === 'step') {
        // Smooth high-slope step at x = 0 so RK4 handles cleanly
        const sig = 1 / (1 + Math.exp(-x / 0.04));
        return state.v0Ev * sig;
      }
      if (state.potType === 'well') {
        // Finite well centered at [-0.9, +0.9] nm: 0 inside, V0 outside
        const sL = 1 / (1 + Math.exp((x + 0.9) / 0.04));
        const sR = 1 / (1 + Math.exp(-(x - 0.9) / 0.04));
        return state.v0Ev * Math.min(1, sL + sR);
      }
      // Harmonic-like parabolic bowl V(x) = V0 * (x / 1.8)^2 capped gently
      return Math.min(state.v0Ev * 2.2, state.v0Ev * Math.pow(x / 1.6, 2));
    }

    function solveTISE() {
      const xmin = -2.4, xmax = 2.4;
      const N = 260;
      const h = (xmax - xmin) / N;
      const V = (x) => evalPotential(x);

      // Integrate from x = xmin (or from right/center depending on potential so evanescent tails don't blow up)
      // For step/well/harmonic, start near x = -2.4 with gentle amplitude
      let y = 0.0;
      let dy = 2.5;
      if (state.potType === 'well' || state.potType === 'harmonic') {
        // Start from center x=0 and integrate outward symmetrically (even parity trial) for clean qualitative & quantitative behavior
        const halfN = 130;
        const leftPts = [];
        const rightPts = [];
        let yr = 1.0, dyr = 0.0;
        rightPts.push({ x: 0, psi: yr, V: V(0) });
        for (let i = 1; i <= halfN; i++) {
          const x = (i - 1) * h;
          const k2 = (xx, yy) => -TWO_M_OVER_HBAR2 * (state.energyEv - V(xx)) * yy;
          const k1y = dyr, k1d = k2(x, yr);
          const k2y = dyr + 0.5 * h * k1d, k2d = k2(x + 0.5 * h, yr + 0.5 * h * k1y);
          const k3y = dyr + 0.5 * h * k2d, k3d = k2(x + 0.5 * h, yr + 0.5 * h * k2y);
          const k4y = dyr + h * k3d, k4d = k2(x + h, yr + h * k3y);
          yr += (h / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
          dyr += (h / 6) * (k1d + 2 * k2d + 2 * k3d + k4d);
          if (!Number.isFinite(yr) || Math.abs(yr) > 1e6) {
            yr = Math.sign(yr || 1) * 1e6;
            dyr = 0;
          }
          rightPts.push({ x: i * h, psi: yr, V: V(i * h) });
        }
        for (let i = halfN; i >= 1; i--) {
          leftPts.push({ x: -rightPts[i].x, psi: rightPts[i].psi, V: V(-rightPts[i].x) });
        }
        const pts = leftPts.concat(rightPts);
        const coreMax = Math.max(0.5, ...pts.filter((p) => Math.abs(p.x) <= 1.0).map((p) => Math.abs(p.psi)));
        pts.forEach((p) => { p.psi /= coreMax; });
        return pts;
      }

      // Potential Step: backward integration from right decaying tail into left oscillatory region
      // avoids exponential blowup of the forbidden growing mode without clamping inside the barrier!
      const pts = new Array(N + 1);
      const E = state.energyEv, V0 = state.v0Ev;
      if (E < V0) {
        const kappa = Math.sqrt(TWO_M_OVER_HBAR2 * (V0 - E));
        y = 1.0;
        dy = -kappa * y;
      } else {
        y = 0.65;
        dy = 0.0;
      }
      pts[N] = { x: xmax, psi: y, V: V(xmax) };
      for (let i = N - 1; i >= 0; i--) {
        const x = (i + 1) * h + xmin;
        const step = -h;
        const k2 = (xx, yy) => -TWO_M_OVER_HBAR2 * (E - V(xx)) * yy;
        const k1y = dy, k1d = k2(x, y);
        const k2y = dy + 0.5 * step * k1d, k2d = k2(x + 0.5 * step, y + 0.5 * step * k1y);
        const k3y = dy + 0.5 * step * k2d, k3d = k2(x + 0.5 * step, y + 0.5 * step * k2y);
        const k4y = dy + step * k3d, k4d = k2(x + step, y + step * k3y);
        y += (step / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
        dy += (step / 6) * (k1d + 2 * k2d + 2 * k3d + k4d);
        if (!Number.isFinite(y) || Math.abs(y) > 1e100) {
          y = Math.sign(y || 1) * 1e100;
          dy = 0;
        }
        pts[i] = { x: xmin + i * h, psi: y, V: V(xmin + i * h) };
      }
      // Normalize against the oscillatory zone (x <= 0.1 nm) so incoming waves stay unit-scale
      const oscPts = pts.filter((p) => p.x <= 0.1);
      const maxAbs = Math.max(1e-6, ...oscPts.map((p) => Math.abs(p.psi)));
      pts.forEach((p) => { p.psi /= maxAbs; });
      return pts;
    }

    function syncControlVisibility() {
      const t = state.tab;
      const show = (el, vis) => { if (el) el.style.display = vis ? 'flex' : 'none'; };
      show(ui.shapeWrap, t === 'normalization');
      show(ui.ampWrap, t === 'normalization');
      show(ui.normRow, t === 'normalization');
      show(ui.x1Wrap, t === 'normalization');
      show(ui.x2Wrap, t === 'normalization');

      show(ui.wbWrap, t === 'wellbehaved');

      show(ui.potWrap, t === 'schrodinger');
      show(ui.eWrap, t === 'schrodinger');
      show(ui.v0Wrap, t === 'schrodinger');
      show(ui.probeWrap, t === 'schrodinger');
      if (ui.bridgeRow) ui.bridgeRow.style.display = t === 'schrodinger' ? 'grid' : 'none';
    }

    function resetSimulation() {
      state.shape = 'gaussian';
      state.ampScale = 1.45;
      state.x1 = -0.8;
      state.x2 = 0.8;
      state.wbCase = 'valid';
      state.potType = 'step';
      state.energyEv = 2.4;
      state.v0Ev = 3.5;
      state.probeX = 0.0;

      if (ui.shapeSeg) ui.shapeSeg.set('gaussian');
      if (ui.ampSlider) ui.ampSlider.setValue(1.45);
      if (ui.x1Slider) ui.x1Slider.setValue(-0.8);
      if (ui.x2Slider) ui.x2Slider.setValue(0.8);
      if (ui.wbSelect) ui.wbSelect.value = 'valid';
      if (ui.potSeg) ui.potSeg.set('step');
      if (ui.eSlider) ui.eSlider.setValue(2.4);
      if (ui.v0Slider) ui.v0Slider.setValue(3.5);
      if (ui.probeSlider) ui.probeSlider.setValue(0.0);

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

      const svg = svgEl('svg', {
        class: 'viz-svg tall',
        viewBox: '0 0 820 520',
        preserveAspectRatio: 'xMidYMid meet',
        role: 'img',
        'aria-label': 'Wave Function, Normalization and Schrodinger Equation Laboratory',
      });
      const dynLayer = svgEl('g');
      svg.append(dynLayer);
      stage.append(svg);

      subtabBar = C.buildSubtabs(
        wrap,
        [
          { id: 'normalization', label: 'A. Normalization & |ψ|²' },
          { id: 'wellbehaved', label: 'B. Well-Behaved ψ(x)' },
          { id: 'schrodinger', label: 'C. Schrödinger Equation' },
        ],
        state.tab,
        (t) => {
          state.tab = t;
          syncControlVisibility();
          updateReadouts();
          updateBanner();
          render();
        }
      );

      banner = C.buildBanner(wrap);
      if (dot) dot.textContent = 'Interactive';

      C.buildActionRow(controls, [
        { id: 'reset', label: 'Reset Lab', onClick: resetSimulation },
      ]);

      // Tab A controls
      const shapeWrap = X.el('div', 'slider-block');
      shapeWrap.append(X.el('label', 'control-label', 'Sample Wavefunction'));
      controls.append(shapeWrap);
      ui.shapeWrap = shapeWrap;
      ui.shapeSeg = X.buildSegmented(shapeWrap, {
        options: [
          { value: 'gaussian', label: 'Gaussian' },
          { value: 'superpos', label: 'Double Lobe' },
          { value: 'boxmode', label: 'Box Mode' },
        ],
        value: state.shape,
        onChange: (s) => { state.shape = s; updateReadouts(); updateBanner(); render(); },
      });

      ui.ampSlider = X.buildSlider(controls, {
        label: 'Wavefunction Amplitude Scale A',
        id: 'c3t4-amp',
        min: 0.25,
        max: 2.40,
        step: 0.01,
        value: state.ampScale,
        format: (v) => v.toFixed(2),
        onInput: (v) => { state.ampScale = v; updateReadouts(); updateBanner(); render(); },
      });
      ui.ampWrap = ui.ampSlider.input.closest('.slider-block');

      const normBtns = C.buildActionRow(controls, [
        {
          id: 'normalize',
          label: 'Normalize ψ(x) → ∫|ψ|²dx = 1',
          primary: true,
          onClick: () => {
            const m = calcNormMetrics();
            state.ampScale = X.clamp(state.ampScale * m.normFactor, 0.25, 2.40);
            ui.ampSlider.setValue(state.ampScale);
            updateReadouts();
            updateBanner();
            render();
          },
        },
      ]);
      ui.normRow = normBtns.normalize.parentElement;

      ui.x1Slider = X.buildSlider(controls, {
        label: 'Probability Interval Start x₁',
        id: 'c3t4-x1',
        min: -3.5,
        max: 3.5,
        step: 0.1,
        value: state.x1,
        format: (v) => v.toFixed(1) + ' nm',
        onInput: (v) => { state.x1 = v; updateReadouts(); render(); },
      });
      ui.x1Wrap = ui.x1Slider.input.closest('.slider-block');

      ui.x2Slider = X.buildSlider(controls, {
        label: 'Probability Interval End x₂',
        id: 'c3t4-x2',
        min: -3.5,
        max: 3.5,
        step: 0.1,
        value: state.x2,
        format: (v) => v.toFixed(1) + ' nm',
        onInput: (v) => { state.x2 = v; updateReadouts(); render(); },
      });
      ui.x2Wrap = ui.x2Slider.input.closest('.slider-block');

      // Tab B controls
      ui.wbSelect = X.buildSelect(controls, {
        label: 'Wavefunction Validity Example',
        options: [
          { value: 'valid', label: '1. Valid Smooth Bound State (Acceptable ✓)' },
          { value: 'multivalued', label: '2. Multi-Valued Loop (Invalid ✗)' },
          { value: 'divergent', label: '3. Infinite Spike at x=0 (Invalid ✗)' },
          { value: 'discontinuous', label: '4. Discontinuous Jump in ψ (Invalid ✗)' },
          { value: 'wallkink', label: '5. Slope Kink: Finite vs. Infinite Wall' },
          { value: 'nonnorm', label: '6. Unbounded Growth (Non-Normalizable ✗)' },
        ],
        value: state.wbCase,
        onChange: (v) => { state.wbCase = v; updateReadouts(); updateBanner(); render(); },
      });
      ui.wbWrap = ui.wbSelect.closest('.slider-block');

      // Tab C controls
      const potWrap = X.el('div', 'slider-block');
      potWrap.append(X.el('label', 'control-label', 'Potential Energy Profile V(x)'));
      controls.append(potWrap);
      ui.potWrap = potWrap;
      ui.potSeg = X.buildSegmented(potWrap, {
        options: [
          { value: 'step', label: 'Step Barrier' },
          { value: 'well', label: 'Square Well' },
          { value: 'harmonic', label: 'Parabolic Bowl' },
        ],
        value: state.potType,
        onChange: (p) => { state.potType = p; updateReadouts(); updateBanner(); render(); },
      });

      ui.eSlider = X.buildSlider(controls, {
        label: 'Total Energy E',
        id: 'c3t4-energy',
        min: 0.4,
        max: 6.0,
        step: 0.1,
        value: state.energyEv,
        format: (v) => v.toFixed(1) + ' eV',
        onInput: (v) => { state.energyEv = v; updateReadouts(); updateBanner(); render(); },
      });
      ui.eWrap = ui.eSlider.input.closest('.slider-block');

      ui.v0Slider = X.buildSlider(controls, {
        label: 'Potential Barrier / Depth V₀',
        id: 'c3t4-v0',
        min: 0.5,
        max: 6.0,
        step: 0.1,
        value: state.v0Ev,
        format: (v) => v.toFixed(1) + ' eV',
        onInput: (v) => { state.v0Ev = v; updateReadouts(); updateBanner(); render(); },
      });
      ui.v0Wrap = ui.v0Slider.input.closest('.slider-block');

      ui.probeSlider = X.buildSlider(controls, {
        label: 'Inspect Curvature at x₀',
        id: 'c3t4-probe',
        min: -2.0,
        max: 2.0,
        step: 0.1,
        value: state.probeX,
        format: (v) => v.toFixed(1) + ' nm',
        onInput: (v) => { state.probeX = v; updateReadouts(); render(); },
      });
      ui.probeWrap = ui.probeSlider.input.closest('.slider-block');

      const bridgeRefs = C.buildActionRow(controls, [
        { id: 'box', label: 'Open Particle in Box →', onClick: () => C.jumpToTopicPreset('c3t5', 'rigid') },
        { id: 'tunnel', label: 'Open Tunnelling →', onClick: () => C.jumpToTopicPreset('c3t6', 'tunnel') },
      ]);
      ui.bridgeRow = bridgeRefs.box.parentElement;

      ui.readouts = X.buildReadouts(controls, [
        { id: 'r1', label: 'Integral ∫|ψ|²dx', primary: true },
        { id: 'r2', label: 'Norm Factor N' },
        { id: 'r3', label: 'P(x₁ ≤ x ≤ x₂)' },
        { id: 'r4', label: 'Status', wide: true },
      ]);
      ui.readoutLabels = controls.querySelectorAll('.readout .r-label');

      ui.svgRefs = { dynLayer };
      syncControlVisibility();
    }

    function setLabels(l1, l2, l3, l4) {
      if (!ui.readoutLabels || ui.readoutLabels.length < 4) return;
      ui.readoutLabels[0].textContent = l1;
      ui.readoutLabels[1].textContent = l2;
      ui.readoutLabels[2].textContent = l3;
      ui.readoutLabels[3].textContent = l4;
    }

    function updateReadouts() {
      if (!ui.readouts) return;
      if (state.tab === 'normalization') {
        const m = calcNormMetrics();
        setLabels('Total Integral ∫|ψ|²dx', 'Required Factor N', `Interval P(${m.a.toFixed(1)}..${m.b.toFixed(1)})`, 'Normalization Status');
        ui.readouts.set('r1', m.totalInt.toFixed(4));
        ui.readouts.set('r2', m.normFactor.toFixed(4));
        ui.readouts.set('r3', `${(m.intervalInt * 100).toFixed(1)}% (${(m.intervalProbNorm * 100).toFixed(1)}% of total)`);
        ui.readouts.set('r4', m.isNormalized ? 'Normalized: ∫|ψ|²dx = 1.00 ✓' : `Unnormalized (click Normalize or scale by ${m.normFactor.toFixed(3)})`);

        formula.innerHTML = `
          <span class="formula ${m.isNormalized ? 'active' : ''}">∫|ψ(x)|² dx = <span class="fv">${m.totalInt.toFixed(4)}</span> (Target = 1)</span>
          <span class="formula">P(x₁ ≤ x ≤ x₂) = <span class="fv">${m.intervalInt.toFixed(4)}</span></span>
          <span class="formula">ψ = amplitude · |ψ|² = probability density</span>`;
      } else if (state.tab === 'wellbehaved') {
        setLabels('Property Tested', 'Single/Finite/Cont.', 'Derivative dψ/dx', 'Physical Verdict');
        const info = {
          valid: ['All conditions', 'Yes ✓', 'Continuous everywhere ✓', 'Valid physical wavefunction ✓'],
          multivalued: ['Single-valuedness', 'Fails (3 values at x) ✗', 'Undefined', 'Rejected: ambiguous probability density ✗'],
          divergent: ['Finiteness', 'Blows up to ∞ ✗', 'Diverges ✗', 'Rejected: infinite probability density ✗'],
          discontinuous: ['Continuity of ψ', 'Jump at x = 0 ✗', 'Undefined spike ✗', 'Rejected: invalid for finite V(x) ✗'],
          wallkink: ['Boundary derivative', 'Continuous ψ ✓', 'Continuous at finite V; jump OK at V=∞', 'Finite kink Invalid ✗; Infinite wall Valid ✓'],
          nonnorm: ['Normalizability', 'Diverges as |x| → ∞ ✗', 'Unbounded', 'Rejected: ∫|ψ|²dx = ∞ ✗'],
        }[state.wbCase];
        ui.readouts.set('r1', info[0]);
        ui.readouts.set('r2', info[1]);
        ui.readouts.set('r3', info[2]);
        ui.readouts.set('r4', info[3]);

        formula.innerHTML = `
          <span class="formula active">Well-Behaved Criteria: Single-valued · Finite · Continuous · Normalizable</span>
          <span class="formula">dψ/dx continuous for finite V(x); kink allowed at V = ∞</span>`;
      } else {
        setLabels('Potential V(x₀)', 'Kinetic K = E − V(x₀)', 'Curvature Sign ψ″/ψ', 'Region Behavior');
        const Vx = evalPotential(state.probeX);
        const K = state.energyEv - Vx;
        ui.readouts.set('r1', Vx.toFixed(2) + ' eV');
        ui.readouts.set('r2', `${K >= 0 ? '+' : ''}${K.toFixed(2)} eV`);
        ui.readouts.set('r3', K > 0.02 ? 'Negative (oscillatory)' : K < -0.02 ? 'Positive (exponential)' : 'Zero inflection');
        ui.readouts.set('r4', K >= 0 ? 'Classically Allowed (E > V): oscillatory wave' : 'Classically Forbidden (E < V): exponential penetration');

        formula.innerHTML = `
          <span class="formula active">−(ħ²/2m) d²ψ/dx² + V(x)ψ = Eψ</span>
          <span class="formula">At x₀ = ${state.probeX.toFixed(1)} nm: <span class="fv">E − V = ${K.toFixed(2)} eV</span></span>`;
      }
    }

    function updateBanner() {
      if (!banner) return;
      if (state.tab === 'normalization') {
        const m = calcNormMetrics();
        banner.set(
          m.isNormalized ? 'NORMALIZED ✓' : 'NOT NORMALIZED',
          m.isNormalized ? 'ok' : 'warn',
          m.isNormalized
            ? 'Area under <b>|ψ(x)|²</b> equals <b>1.00</b>! Note that ψ(x) can go negative (probability amplitude), whereas |ψ(x)|² is always ≥ 0 (probability density).'
            : `Integral ∫|ψ(x)|²dx = <b>${m.totalInt.toFixed(3)} ≠ 1</b>. Multiply ψ by normalization factor <b>N = ${m.normFactor.toFixed(3)}</b> or click the Normalize button.`
        );
      } else if (state.tab === 'wellbehaved') {
        const desc = {
          valid: '<b>Valid Bound Wavefunction:</b> Single-valued, finite, smooth everywhere, and decays cleanly so ∫|ψ|²dx = 1.',
          multivalued: '<b>Invalid (Multi-Valued):</b> A single x cannot have multiple probability densities |ψ(x)|².',
          divergent: '<b>Invalid (Infinite):</b> Wavefunction diverges to ±∞; probability density must remain finite.',
          discontinuous: '<b>Invalid (Discontinuous ψ):</b> Abrupt jump in ψ implies infinite momentum/kinetic energy for finite V(x).',
          wallkink: '<b>Slope Continuity Nuance:</b> dψ/dx must be continuous across finite steps (left ✗), but a sharp kink IS valid at an idealized infinite wall V = ∞ (right ✓).',
          nonnorm: '<b>Invalid (Non-Normalizable):</b> Amplitude grows toward |x| → ∞ so ∫|ψ|²dx diverges instead of equaling 1.',
        }[state.wbCase];
        banner.set(state.wbCase === 'valid' ? 'ACCEPTABLE ψ' : 'CRITERIA CHECK', state.wbCase === 'valid' ? 'ok' : 'warn', desc);
      } else {
        const K = state.energyEv - evalPotential(state.probeX);
        banner.set(
          'TISE CURVATURE SOLVER',
          K >= 0 ? 'ok' : '',
          'Where <b>E &gt; V(x)</b>, ψ″ bends ψ toward the axis (oscillatory waves). Where <b>E &lt; V(x)</b>, ψ″ bends away (exponentially decaying tails — bridging into <b>Box</b> &amp; <b>Tunnelling</b>).'
        );
      }
    }

    /* ============================================================
       SVG RENDERERS
       ============================================================ */
    function renderNormalization(g) {
      const m = calcNormMetrics();
      const x0 = 64, x1 = 772, pw = x1 - x0;
      const PX = (x) => x0 + ((x + X_DOM) / (2 * X_DOM)) * pw;

      // Top box: Probability Amplitude psi(x)
      g.append(svgEl('rect', { x: 24, y: 18, width: 772, height: 228, rx: 8, fill: 'rgba(6,10,24,0.68)', stroke: 'rgba(255,255,255,0.13)' }));
      const t1 = svgEl('text', { x: 40, y: 40, fill: '#edf1f8', 'font-size': '12.5', 'font-weight': '600', 'font-family': 'Inter, sans-serif' });
      t1.textContent = '1. WAVE FUNCTION ψ(x)  — Probability Amplitude (can be + or −)';
      g.append(t1);

      const mid1 = 140, ampScale1 = 68;
      g.append(svgEl('line', { x1: x0, y1: mid1, x2: x1, y2: mid1, stroke: 'rgba(255,255,255,0.22)' }));
      let dPsi = '';
      m.pts.forEach((p, idx) => {
        const py = X.clamp(mid1 - p.psi * ampScale1, 52, 234);
        dPsi += (idx === 0 ? `M ${PX(p.x).toFixed(1)} ${py.toFixed(1)}` : ` L ${PX(p.x).toFixed(1)} ${py.toFixed(1)}`);
      });
      g.append(svgEl('path', { d: dPsi, fill: 'none', stroke: '#22d3ee', 'stroke-width': '2.6' }));

      // Bottom box: Probability Density |psi(x)|^2 & Cumulative Shaded Area
      g.append(svgEl('rect', { x: 24, y: 262, width: 772, height: 238, rx: 8, fill: 'rgba(6,10,24,0.68)', stroke: 'rgba(255,255,255,0.13)' }));
      const t2 = svgEl('text', { x: 40, y: 284, fill: '#edf1f8', 'font-size': '12.5', 'font-weight': '600', 'font-family': 'Inter, sans-serif' });
      t2.textContent = '2. PROBABILITY DENSITY |ψ(x)|²  — Always ≥ 0 (Area = ∫|ψ|²dx)';
      g.append(t2);

      const base2 = 468, probScale = 85;
      g.append(svgEl('line', { x1: x0, y1: base2, x2: x1, y2: base2, stroke: 'rgba(255,255,255,0.22)' }));

      // Shaded interval [x1, x2]
      let dFillInt = '';
      const intPts = m.pts.filter((p) => p.x >= m.a - 0.02 && p.x <= m.b + 0.02);
      if (intPts.length >= 2) {
        intPts.forEach((p, idx) => {
          const py = X.clamp(base2 - p.prob * probScale, 296, base2);
          dFillInt += (idx === 0 ? `M ${PX(p.x).toFixed(1)} ${py.toFixed(1)}` : ` L ${PX(p.x).toFixed(1)} ${py.toFixed(1)}`);
        });
        dFillInt += ` L ${PX(intPts[intPts.length - 1].x).toFixed(1)} ${base2} L ${PX(intPts[0].x).toFixed(1)} ${base2} Z`;
        g.append(svgEl('path', { d: dFillInt, fill: 'rgba(52,211,153,0.34)' }));
      }

      let dProb = '';
      m.pts.forEach((p, idx) => {
        const py = X.clamp(base2 - p.prob * probScale, 296, base2);
        dProb += (idx === 0 ? `M ${PX(p.x).toFixed(1)} ${py.toFixed(1)}` : ` L ${PX(p.x).toFixed(1)} ${py.toFixed(1)}`);
      });
      const dProbArea = dProb + ` L ${x1} ${base2} L ${x0} ${base2} Z`;
      g.append(svgEl('path', { d: dProbArea, fill: 'rgba(244,114,182,0.14)' }));
      g.append(svgEl('path', { d: dProb, fill: 'none', stroke: '#f472b6', 'stroke-width': '2.6' }));

      // Interval boundary lines
      [m.a, m.b].forEach((xv) => {
        g.append(svgEl('line', { x1: PX(xv), y1: 300, x2: PX(xv), y2: base2, stroke: '#34d399', 'stroke-dasharray': '4 3', 'stroke-width': '1.5' }));
      });
      const intLbl = svgEl('text', { x: PX((m.a + m.b) / 2), y: 318, 'text-anchor': 'middle', fill: '#34d399', 'font-size': '11', 'font-weight': '600', 'font-family': 'JetBrains Mono, monospace' });
      intLbl.textContent = `P(${m.a.toFixed(1)}..${m.b.toFixed(1)}) = ${(m.intervalInt * 100).toFixed(1)}%`;
      g.append(intLbl);

      [-3, -2, -1, 0, 1, 2, 3].forEach((xv) => {
        const tx = svgEl('text', { x: PX(xv), y: base2 + 16, 'text-anchor': 'middle', fill: '#8f9cb5', 'font-size': '10', 'font-family': 'JetBrains Mono, monospace' });
        tx.textContent = xv + ' nm';
        g.append(tx);
      });
    }

    function renderWellBehaved(g) {
      g.append(svgEl('rect', { x: 24, y: 20, width: 772, height: 480, rx: 8, fill: 'rgba(6,10,24,0.68)', stroke: 'rgba(255,255,255,0.13)' }));
      const hdr = svgEl('text', { x: 44, y: 48, fill: '#edf1f8', 'font-size': '13', 'font-weight': '600', 'font-family': 'Inter, sans-serif' });
      hdr.textContent = 'WELL-BEHAVED WAVEFUNCTION CRITERIA EXPLORER';
      g.append(hdr);

      if (state.wbCase === 'wallkink') {
        // Side-by-side comparison: Finite Wall kink (Invalid) vs Infinite Wall kink (Valid!)
        const drawHalf = (bx, title, col, isInf) => {
          g.append(svgEl('rect', { x: bx, y: 74, width: 356, height: 394, rx: 6, fill: 'rgba(15,23,42,0.55)', stroke: col }));
          const t = svgEl('text', { x: bx + 16, y: 100, fill: col, 'font-size': '12', 'font-weight': '700', 'font-family': 'Inter, sans-serif' });
          t.textContent = title;
          g.append(t);

          const mid = 290, wallX = bx + 220;
          g.append(svgEl('line', { x1: bx + 20, y1: mid, x2: bx + 336, y2: mid, stroke: 'rgba(255,255,255,0.22)' }));
          // Potential wall graphic
          if (isInf) {
            g.append(svgEl('line', { x1: wallX, y1: 120, x2: wallX, y2: 410, stroke: '#e0b553', 'stroke-width': '3' }));
            g.append(svgEl('rect', { x: wallX, y: 120, width: 116, height: 290, fill: 'rgba(224,181,83,0.10)' }));
            const vl = svgEl('text', { x: wallX + 58, y: 145, 'text-anchor': 'middle', fill: '#e0b553', 'font-size': '11', 'font-family': 'JetBrains Mono, monospace' });
            vl.textContent = 'V = ∞';
            g.append(vl);
            // Valid sin hitting 0 cleanly with sharp kink into psi=0 outside
            let d = `M ${bx + 26} ${mid}`;
            for (let i = 0; i <= 60; i++) {
              const u = i / 60;
              const px = bx + 26 + u * (wallX - (bx + 26));
              const py = mid - Math.sin(u * Math.PI) * 110;
              d += ` L ${px.toFixed(1)} ${py.toFixed(1)}`;
            }
            d += ` L ${bx + 332} ${mid}`;
            g.append(svgEl('path', { d, fill: 'none', stroke: '#34d399', 'stroke-width': '2.8' }));
            g.append(svgEl('circle', { cx: wallX, cy: mid, r: 5, fill: '#34d399' }));
          } else {
            g.append(svgEl('rect', { x: wallX, y: 185, width: 116, height: 225, fill: 'rgba(244,114,182,0.10)', stroke: 'rgba(244,114,182,0.45)' }));
            const vl = svgEl('text', { x: wallX + 58, y: 205, 'text-anchor': 'middle', fill: '#f472b6', 'font-size': '11', 'font-family': 'JetBrains Mono, monospace' });
            vl.textContent = 'Finite V₀ < ∞';
            g.append(vl);
            // Sharp kink at finite wall -> INVALID!
            const d = `M ${bx + 26} ${mid} Q ${bx + 125} ${mid - 160} ${wallX} ${mid - 64} L ${bx + 332} ${mid - 4}`;
            g.append(svgEl('path', { d, fill: 'none', stroke: '#ff5c7a', 'stroke-width': '2.8' }));
            g.append(svgEl('circle', { cx: wallX, cy: mid - 64, r: 5.5, fill: '#ff5c7a' }));
          }
          const sub = svgEl('text', { x: bx + 178, y: 444, 'text-anchor': 'middle', fill: '#cbd5e1', 'font-size': '10.5', 'font-family': 'Inter, sans-serif' });
          sub.textContent = isInf ? 'Slope jump permitted because V = ∞ outside' : 'Kink in dψ/dx forbidden when V(x) is finite';
          g.append(sub);
        };
        drawHalf(44, 'FINITE WALL: SLOPE KINK (INVALID ✗)', '#ff5c7a', false);
        drawHalf(420, 'INFINITE WALL: SLOPE KINK (VALID ✓)', '#34d399', true);
        return;
      }

      const mid = 275, x0 = 90, x1 = 730, cx = 410;
      g.append(svgEl('line', { x1: x0, y1: mid, x2: x1, y2: mid, stroke: 'rgba(255,255,255,0.22)' }));
      g.append(svgEl('line', { x1: cx, y1: 85, x2: cx, y2: 455, stroke: 'rgba(255,255,255,0.12)', 'stroke-dasharray': '4 4' }));

      if (state.wbCase === 'valid') {
        let d = '';
        for (let i = 0; i <= 180; i++) {
          const x = -3 + (i / 180) * 6;
          const psi = Math.cos(1.4 * x) * Math.exp(-0.28 * x * x);
          const px = x0 + (i / 180) * (x1 - x0);
          const py = mid - psi * 140;
          d += (i === 0 ? `M ${px.toFixed(1)} ${py.toFixed(1)}` : ` L ${px.toFixed(1)} ${py.toFixed(1)}`);
        }
        g.append(svgEl('path', { d, fill: 'none', stroke: '#34d399', 'stroke-width': '3' }));
      } else if (state.wbCase === 'multivalued') {
        const d = `M ${x0 + 40} ${mid + 20} C ${cx + 140} ${mid - 160}, ${cx - 130} ${mid + 120}, ${x1 - 40} ${mid - 35}`;
        g.append(svgEl('path', { d, fill: 'none', stroke: '#ff5c7a', 'stroke-width': '3' }));
        g.append(svgEl('line', { x1: cx + 10, y1: 110, x2: cx + 10, y2: 430, stroke: '#e0b553', 'stroke-dasharray': '4 3' }));
        const note = svgEl('text', { x: cx + 18, y: 128, fill: '#e0b553', 'font-size': '11', 'font-family': 'Inter, sans-serif' });
        note.textContent = '3 values at same x!';
        g.append(note);
      } else if (state.wbCase === 'divergent') {
        let dL = '', dR = '';
        for (let i = 0; i <= 85; i++) {
          const x = -3 + (i / 85) * 2.82;
          const psi = Math.min(1.45, 0.22 / Math.abs(x));
          const px = cx + (x / 3) * (cx - x0);
          const py = mid - psi * 125;
          dL += (i === 0 ? `M ${px.toFixed(1)} ${py.toFixed(1)}` : ` L ${px.toFixed(1)} ${py.toFixed(1)}`);
        }
        for (let i = 0; i <= 85; i++) {
          const x = 0.18 + (i / 85) * 2.82;
          const psi = Math.min(1.45, 0.22 / Math.abs(x));
          const px = cx + (x / 3) * (cx - x0);
          const py = mid - psi * 125;
          dR += (i === 0 ? `M ${px.toFixed(1)} ${py.toFixed(1)}` : ` L ${px.toFixed(1)} ${py.toFixed(1)}`);
        }
        g.append(svgEl('path', { d: dL, fill: 'none', stroke: '#ff5c7a', 'stroke-width': '3' }));
        g.append(svgEl('path', { d: dR, fill: 'none', stroke: '#ff5c7a', 'stroke-width': '3' }));
      } else if (state.wbCase === 'discontinuous') {
        const d1 = `M ${x0} ${mid + 10} Q ${x0 + 180} ${mid - 110} ${cx} ${mid - 90}`;
        const d2 = `M ${cx} ${mid + 75} Q ${cx + 150} ${mid + 40} ${x1} ${mid - 5}`;
        g.append(svgEl('path', { d: d1, fill: 'none', stroke: '#ff5c7a', 'stroke-width': '3' }));
        g.append(svgEl('path', { d: d2, fill: 'none', stroke: '#ff5c7a', 'stroke-width': '3' }));
        g.append(svgEl('circle', { cx, cy: mid - 90, r: 5, fill: '#ff5c7a' }));
        g.append(svgEl('circle', { cx, cy: mid + 75, r: 5, fill: 'none', stroke: '#ff5c7a', 'stroke-width': '2.5' }));
      } else {
        // Non-normalizable exponential growth
        let d = '';
        for (let i = 0; i <= 150; i++) {
          const u = i / 150;
          const x = -2.2 + u * 4.4;
          const psi = 0.14 * Math.exp(0.95 * Math.abs(x));
          const px = x0 + u * (x1 - x0);
          const py = mid - Math.min(1.4, psi) * 120;
          d += (i === 0 ? `M ${px.toFixed(1)} ${py.toFixed(1)}` : ` L ${px.toFixed(1)} ${py.toFixed(1)}`);
        }
        g.append(svgEl('path', { d, fill: 'none', stroke: '#ff5c7a', 'stroke-width': '3' }));
      }
    }

    function renderSchrodinger(g) {
      const pts = solveTISE();
      const x0 = 64, x1 = 772, pw = x1 - x0;
      const PX = (x) => x0 + ((x + 2.4) / 4.8) * pw;

      // Top Panel: Potential Energy V(x) & Total Energy E (y: 20..240)
      g.append(svgEl('rect', { x: 24, y: 18, width: 772, height: 222, rx: 8, fill: 'rgba(6,10,24,0.68)', stroke: 'rgba(255,255,255,0.13)' }));
      const t1 = svgEl('text', { x: 40, y: 40, fill: '#edf1f8', 'font-size': '12.5', 'font-weight': '600', 'font-family': 'Inter, sans-serif' });
      t1.textContent = '1. POTENTIAL ENERGY V(x) vs. TOTAL ENERGY E  (TISE: −(ħ²/2m)ψ″ + Vψ = Eψ)';
      g.append(t1);

      const vBase = 216, vTop = 58, vMax = 7.0;
      const VY = (ev) => vBase - (X.clamp(ev, 0, vMax) / vMax) * (vBase - vTop);

      // Shade classically forbidden regions (V > E)
      let inForb = false, forbStart = x0;
      pts.forEach((p, idx) => {
        const px = PX(p.x);
        if (p.V > state.energyEv && !inForb) { inForb = true; forbStart = px; }
        else if ((p.V <= state.energyEv || idx === pts.length - 1) && inForb) {
          inForb = false;
          g.append(svgEl('rect', { x: forbStart, y: vTop, width: Math.max(2, px - forbStart), height: vBase - vTop, fill: 'rgba(244,114,182,0.10)' }));
        }
      });

      // V(x) curve
      let dV = '';
      pts.forEach((p, idx) => {
        dV += (idx === 0 ? `M ${PX(p.x).toFixed(1)} ${VY(p.V).toFixed(1)}` : ` L ${PX(p.x).toFixed(1)} ${VY(p.V).toFixed(1)}`);
      });
      g.append(svgEl('path', { d: dV, fill: 'none', stroke: '#e0b553', 'stroke-width': '2.6' }));

      // Total energy E line
      const yE = VY(state.energyEv);
      g.append(svgEl('line', { x1: x0, y1: yE, x2: x1, y2: yE, stroke: '#34d399', 'stroke-dasharray': '6 4', 'stroke-width': '2' }));
      const eLbl = svgEl('text', { x: x1 - 6, y: yE - 6, 'text-anchor': 'end', fill: '#34d399', 'font-size': '10.5', 'font-weight': '600', 'font-family': 'JetBrains Mono, monospace' });
      eLbl.textContent = `E = ${state.energyEv.toFixed(1)} eV`;
      g.append(eLbl);

      // Bottom Panel: Numerically Integrated Wavefunction Solution psi(x) (y: 258..498)
      g.append(svgEl('rect', { x: 24, y: 258, width: 772, height: 242, rx: 8, fill: 'rgba(6,10,24,0.68)', stroke: 'rgba(255,255,255,0.13)' }));
      const t2 = svgEl('text', { x: 40, y: 280, fill: '#edf1f8', 'font-size': '12.5', 'font-weight': '600', 'font-family': 'Inter, sans-serif' });
      t2.textContent = '2. CONSISTENT TISE SOLUTION ψ(x) — Oscillatory when E > V(x), Exponential when E < V(x)';
      g.append(t2);

      const mid2 = 382, psiAmp = 76;
      g.append(svgEl('line', { x1: x0, y1: mid2, x2: x1, y2: mid2, stroke: 'rgba(255,255,255,0.22)' }));

      let dSol = '';
      pts.forEach((p, idx) => {
        const py = X.clamp(mid2 - p.psi * psiAmp, 294, 474);
        dSol += (idx === 0 ? `M ${PX(p.x).toFixed(1)} ${py.toFixed(1)}` : ` L ${PX(p.x).toFixed(1)} ${py.toFixed(1)}`);
      });
      g.append(svgEl('path', { d: dSol, fill: 'none', stroke: '#22d3ee', 'stroke-width': '2.6' }));

      // Probe cursor x0 across both plots
      const px0 = PX(state.probeX);
      g.append(svgEl('line', { x1: px0, y1: vTop, x2: px0, y2: 476, stroke: 'rgba(255,255,255,0.45)', 'stroke-dasharray': '3 3' }));

      [-2, -1, 0, 1, 2].forEach((xv) => {
        const tx = svgEl('text', { x: PX(xv), y: 492, 'text-anchor': 'middle', fill: '#8f9cb5', 'font-size': '10', 'font-family': 'JetBrains Mono, monospace' });
        tx.textContent = xv + ' nm';
        g.append(tx);
      });
    }

    function render() {
      if (!ui.svgRefs) return;
      const g = ui.svgRefs.dynLayer;
      g.innerHTML = '';
      if (state.tab === 'normalization') renderNormalization(g);
      else if (state.tab === 'wellbehaved') renderWellBehaved(g);
      else renderSchrodinger(g);
    }

    return {
      mount() {
        buildDOM();
        updateReadouts();
        updateBanner();
        render();
      },
      unmount() {},
      tick() {},
      resize() { render(); },
      applyPreset(preset) {
        if (preset === 'wellbehaved' || preset === 'schrodinger' || preset === 'normalization') {
          state.tab = preset;
        }
        if (subtabBar) subtabBar.set(state.tab);
        syncControlVisibility();
        updateReadouts();
        updateBanner();
        render();
      },
      calcNormMetrics,
      solveTISE,
      getState: () => state,
    };
  };
})();
