(function () {
  'use strict';

  const C = window.Ch3Platform;
  const X = window.XLab;
  const P = C.PHYSICS;

  window.CH3_SIMS['c3t5'] = function createParticleBoxLab(ctxDom) {
    const { stage, controls, formula, wrap, dot } = ctxDom;
    const svgEl = C.svgEl;

    const DERIV_STEPS = [
      {
        step: 1,
        title: '1. Inside the Box (0 < x < L)',
        text: 'Inside the rigid box V(x) = 0, so the Schrödinger equation becomes d²ψ/dx² = −k²ψ where k = √(2mE)/ħ. The general oscillatory solution is:',
        eq: 'ψ(x) = A sin(kx) + B cos(kx),   E = ħ²k² / (2m)',
      },
      {
        step: 2,
        title: '2. Left Wall Condition ψ(0) = 0',
        text: 'Because potential V = ∞ for x ≤ 0, the particle cannot enter the wall and continuity forces ψ(0) = 0. Evaluating at x = 0 eliminates the cosine term:',
        eq: 'ψ(0) = A sin(0) + B cos(0) = B = 0   ⇒   ψ(x) = A sin(kx)',
      },
      {
        step: 3,
        title: '3. Right Wall Condition ψ(L) = 0',
        text: 'Similarly ψ(L) = 0 forces sin(kL) = 0 (since A = 0 gives the trivial zero state). Only discrete wave numbers fitting half-integer wavelengths inside L survive:',
        eq: 'kₙ L = nπ   ⇒   kₙ = nπ / L   (n = 1, 2, 3, …)',
      },
      {
        step: 4,
        title: '4. Quantized Energy & Normalization',
        text: 'Substituting kₙ = nπ/L into E = ħ²k²/(2m) yields discrete energies Eₙ, and ∫₀ᴸ |ψₙ(x)|² dx = 1 gives A = √(2/L):',
        eq: 'Eₙ = n²π²ħ²/(2mL²) = n²h²/(8mL²),   ψₙ(x) = √(2/L) sin(nπx/L)',
      },
    ];

    const state = {
      mode: 'rigid',           // 'rigid' | 'finite'
      playing: true,
      animatePhase: true,      // animates Re[psi(x,t)] standing phase while |psi|^2 stays stationary
      Lnm: 1.00,               // Box / Well width L (0.25 .. 2.50 nm)
      massMe: 1.0,             // Particle mass in m_e (0.25 .. 10.0)
      n: 1,                    // Primary quantum number (1 .. 6)
      n2: 2,                   // Comparison quantum number (1 .. 6)
      compareLevels: false,    // Overlay n2 on psi and |psi|^2
      showDerivation: true,    // Step-by-step derivation box
      derivStep: 1,            // 1..4
      // Mode B: Finite Potential Well
      v0Ev: 5.0,               // Finite well depth V0 (1.5 .. 10.0 eV)
      finiteEnergyEv: 1.2,     // Adjustable particle energy inside finite well (0.1 .. V0 - 0.1)
      snapToBound: true,       // Toggle: snap to symmetric finite-well bound state n vs explore E qualitatively
      time: 0,
    };

    let built = false;
    let ui = {};
    let banner = null;
    let subtabBar = null;
    let derivBox = null;

    /* ============================================================
       EXACT PHYSICS: RIGID BOX (INFINITE WELL)
       ============================================================ */
    function energyRigidEv(n, Lnm, massMe) {
      const m = massMe * P.m_e;
      const L = Lnm * 1e-9;
      // Both expressions are mathematically identical: n^2 h^2 / (8 m L^2) = n^2 pi^2 hbar^2 / (2 m L^2)
      const E_h = (n * n * P.h * P.h) / (8 * m * L * L);
      const E_hbar = (n * n * Math.PI * Math.PI * P.hbar * P.hbar) / (2 * m * L * L);
      return { E_eV: C.jToEv(E_h), E_J: E_h, E_hbar_eV: C.jToEv(E_hbar) };
    }

    function calcRigidNormIntegral(n, Lnm) {
      const steps = 200;
      const dx = Lnm / steps;
      const normA2 = 2 / Lnm;
      let sum = 0;
      for (let i = 0; i <= steps; i++) {
        const x = i * dx;
        const s = Math.sin((n * Math.PI * x) / Lnm);
        const w = (i === 0 || i === steps) ? 0.5 : 1.0;
        sum += w * normA2 * s * s * dx;
      }
      return sum;
    }

    /* ============================================================
       FINITE WELL BOUND-STATE SOLVER (1D Symmetric Well)
       ============================================================ */
    function solveFiniteBoundStates(Lnm, V0ev, massMe) {
      const mRatio = massMe;
      // z0 = (L/2) * sqrt(2 m V0) / hbar
      const halfL = Lnm * 0.5;
      const twoMOverHbar2 = mRatio / P.hbar2_over_2me_eV_nm2;
      const z0 = halfL * Math.sqrt(Math.max(1e-6, twoMOverHbar2 * V0ev));
      const states = [];
      const maxBranch = Math.floor((2 * z0) / Math.PI) + 1;

      for (let idx = 0; idx < maxBranch; idx++) {
        const nLevel = idx + 1;
        const isEven = (nLevel % 2 === 1); // n=1 even (cos), n=2 odd (sin)
        const lowBound = idx * (Math.PI / 2) + 1e-5;
        const highBound = Math.min(z0 - 1e-5, (idx + 1) * (Math.PI / 2) - 1e-5);
        if (highBound <= lowBound) break;

        const fn = (z) => {
          const root = Math.sqrt(Math.max(0, z0 * z0 - z * z));
          return isEven ? (z * Math.tan(z) - root) : (-z / Math.tan(z) - root);
        };

        let a = lowBound, b = highBound;
        let fa = fn(a), fb = fn(b);
        if (fa * fb > 0) continue;
        for (let iter = 0; iter < 50; iter++) {
          const mid = 0.5 * (a + b);
          const fm = fn(mid);
          if (fa * fm <= 0) { b = mid; fb = fm; } else { a = mid; fa = fm; }
        }
        const zSol = 0.5 * (a + b);
        const E = V0ev * (zSol / z0) * (zSol / z0);
        states.push({ n: nLevel, parity: isEven ? 'even' : 'odd', E, z: zSol });
      }
      return states;
    }

    function evalFiniteQualitative(xCentered, Lnm, V0ev, Eev, massMe, parity) {
      const twoMOverHbar2 = massMe / P.hbar2_over_2me_eV_nm2;
      const k = Math.sqrt(Math.max(0.05, twoMOverHbar2 * Eev));
      const kappa = Math.sqrt(Math.max(0.05, twoMOverHbar2 * Math.max(0.02, V0ev - Eev)));
      const a = Lnm * 0.5;
      if (Math.abs(xCentered) <= a) {
        return parity === 'even' ? Math.cos(k * xCentered) : Math.sin(k * xCentered);
      }
      const wallVal = parity === 'even' ? Math.cos(k * a) : Math.sin(k * a);
      const dist = Math.abs(xCentered) - a;
      return wallVal * (parity === 'odd' && xCentered < 0 ? -1 : 1) * Math.exp(-kappa * dist);
    }

    function syncControlVisibility() {
      const isRigid = state.mode === 'rigid';
      const show = (el, vis) => { if (el) el.style.display = vis ? 'flex' : 'none'; };
      show(ui.nWrap, isRigid);
      show(ui.cmpToggleWrap, isRigid);
      show(ui.n2Wrap, isRigid && state.compareLevels);
      show(ui.phaseToggleWrap, isRigid);
      show(ui.derivToggleWrap, isRigid);

      show(ui.v0Wrap, !isRigid);
      show(ui.snapToggleWrap, !isRigid);
      show(ui.finEWrap, !isRigid && !state.snapToBound);
      show(ui.nFinWrap, !isRigid && state.snapToBound);

      if (derivBox) derivBox.style.display = (isRigid && state.showDerivation) ? 'block' : 'none';
    }

    function resetSimulation(keepMode) {
      if (!keepMode) state.mode = 'rigid';
      state.Lnm = 1.00;
      state.massMe = 1.0;
      state.n = 1;
      state.n2 = 2;
      state.compareLevels = false;
      state.animatePhase = true;
      state.v0Ev = 5.0;
      state.snapToBound = true;
      state.derivStep = 1;
      state.time = 0;

      if (subtabBar) subtabBar.set(state.mode);
      if (ui.LSlider) ui.LSlider.setValue(1.00);
      if (ui.massSlider) ui.massSlider.setValue(1.0);
      if (ui.nSlider) ui.nSlider.setValue(1);
      if (ui.n2Slider) ui.n2Slider.setValue(2);
      if (ui.cmpToggle) ui.cmpToggle.checked = false;
      if (ui.phaseToggle) ui.phaseToggle.checked = true;
      if (ui.v0Slider) ui.v0Slider.setValue(5.0);
      if (ui.snapToggle) ui.snapToggle.checked = true;

      syncControlVisibility();
      syncDerivBox();
      updateReadouts();
      updateBanner();
      render();
    }

    function syncDerivBox() {
      if (!derivBox) return;
      const stepObj = DERIV_STEPS[state.derivStep - 1] || DERIV_STEPS[0];
      derivBox.querySelectorAll('.ch3-step-pill').forEach((btn) => {
        btn.classList.toggle('active', Number(btn.dataset.step) === state.derivStep);
      });
      const body = derivBox.querySelector('.ch3-deriv-body');
      if (body) {
        body.innerHTML = `<div><b>${stepObj.title}:</b> ${stepObj.text}</div><div class="ch3-deriv-eq">${stepObj.eq}</div>`;
      }
    }

    function buildDOM() {
      if (built) return;
      built = true;

      stage.innerHTML = '';
      controls.innerHTML = '';
      formula.innerHTML = '';

      const svg = svgEl('svg', {
        class: 'viz-svg tall',
        viewBox: '0 0 840 530',
        preserveAspectRatio: 'xMidYMid meet',
        role: 'img',
        'aria-label': 'Particle in a 1D Box Wavefunction and Energy Level Simulator',
      });
      const dynLayer = svgEl('g');
      svg.append(dynLayer);
      stage.append(svg);

      subtabBar = C.buildSubtabs(
        wrap,
        [
          { id: 'rigid', label: 'A. Rigid Box (Infinite Well)' },
          { id: 'finite', label: 'B. Non-Rigid Box (Finite Well)' },
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

      // Step-by-Step Boundary Condition Derivation Panel
      derivBox = X.el('div', 'ch3-deriv-box');
      derivBox.innerHTML = `
        <div class="ch3-deriv-head">
          <span class="ch3-deriv-title">Step-by-Step Boundary Condition Derivation</span>
          <div class="ch3-step-pills">
            ${DERIV_STEPS.map((s) => `<button type="button" class="ch3-step-pill" data-step="${s.step}">Step ${s.step}</button>`).join('')}
          </div>
        </div>
        <div class="ch3-deriv-body"></div>`;
      wrap.append(derivBox);
      derivBox.querySelectorAll('.ch3-step-pill').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.derivStep = Number(btn.dataset.step);
          syncDerivBox();
        });
      });
      syncDerivBox();

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

      ui.LSlider = X.buildSlider(controls, {
        label: 'Box / Well Width L',
        id: 'c3t5-L',
        min: 0.30,
        max: 2.50,
        step: 0.05,
        value: state.Lnm,
        format: (v) => v.toFixed(2) + ' nm',
        onInput: (v) => { state.Lnm = v; updateReadouts(); updateBanner(); render(); },
      });

      ui.massSlider = X.buildSlider(controls, {
        label: 'Particle Mass m (in mₑ)',
        id: 'c3t5-mass',
        min: 0.25,
        max: 8.00,
        step: 0.05,
        value: state.massMe,
        format: (v) => `${v.toFixed(2)} mₑ`,
        onInput: (v) => { state.massMe = v; updateReadouts(); updateBanner(); render(); },
      });

      // Rigid Box controls
      ui.nSlider = X.buildSlider(controls, {
        label: 'Quantum Number n',
        id: 'c3t5-n',
        min: 1,
        max: 6,
        step: 1,
        value: state.n,
        format: (v) => `n = ${Math.round(v)} (${Math.round(v) - 1} nodes)`,
        onInput: (v) => { state.n = Math.round(v); updateReadouts(); updateBanner(); render(); },
      });
      ui.nWrap = ui.nSlider.input.closest('.slider-block');

      ui.cmpToggle = X.buildToggle(controls, {
        label: 'Compare second eigenstate n₂',
        checked: state.compareLevels,
        onChange: (on) => { state.compareLevels = on; syncControlVisibility(); updateReadouts(); render(); },
      });
      ui.cmpToggleWrap = ui.cmpToggle.closest('.toggle-row');

      ui.n2Slider = X.buildSlider(controls, {
        label: 'Compare Quantum Number n₂',
        id: 'c3t5-n2',
        min: 1,
        max: 6,
        step: 1,
        value: state.n2,
        format: (v) => `n₂ = ${Math.round(v)}`,
        onInput: (v) => { state.n2 = Math.round(v); updateReadouts(); render(); },
      });
      ui.n2Wrap = ui.n2Slider.input.closest('.slider-block');

      ui.phaseToggle = X.buildToggle(controls, {
        label: 'Show rotating phase Re[Ψ(x,t)] (|ψ|² stationary)',
        checked: state.animatePhase,
        onChange: (on) => { state.animatePhase = on; render(); },
      });
      ui.phaseToggleWrap = ui.phaseToggle.closest('.toggle-row');

      ui.derivToggle = X.buildToggle(controls, {
        label: 'Show boundary condition derivation steps',
        checked: state.showDerivation,
        onChange: (on) => { state.showDerivation = on; syncControlVisibility(); },
      });
      ui.derivToggleWrap = ui.derivToggle.closest('.toggle-row');

      // Finite Well controls
      ui.v0Slider = X.buildSlider(controls, {
        label: 'Finite Well Depth V₀',
        id: 'c3t5-v0',
        min: 1.5,
        max: 10.0,
        step: 0.1,
        value: state.v0Ev,
        format: (v) => v.toFixed(1) + ' eV',
        onInput: (v) => {
          state.v0Ev = v;
          if (state.finiteEnergyEv >= v - 0.15) {
            state.finiteEnergyEv = Math.max(0.2, v - 0.2);
            if (ui.finESlider) ui.finESlider.setValue(state.finiteEnergyEv);
          }
          updateReadouts(); updateBanner(); render();
        },
      });
      ui.v0Wrap = ui.v0Slider.input.closest('.slider-block');

      ui.snapToggle = X.buildToggle(controls, {
        label: 'Snap to bound state n (uncheck for qualitative E)',
        checked: state.snapToBound,
        onChange: (on) => { state.snapToBound = on; syncControlVisibility(); updateReadouts(); updateBanner(); render(); },
      });
      ui.snapToggleWrap = ui.snapToggle.closest('.toggle-row');

      ui.nFinSlider = X.buildSlider(controls, {
        label: 'Bound State Level n (Finite Well)',
        id: 'c3t5-nfin',
        min: 1,
        max: 4,
        step: 1,
        value: state.n,
        format: (v) => `Level ${Math.round(v)}`,
        onInput: (v) => { state.n = Math.round(v); updateReadouts(); updateBanner(); render(); },
      });
      ui.nFinWrap = ui.nFinSlider.input.closest('.slider-block');

      ui.finESlider = X.buildSlider(controls, {
        label: 'Qualitative Particle Energy E (< V₀)',
        id: 'c3t5-fine',
        min: 0.2,
        max: 9.5,
        step: 0.1,
        value: state.finiteEnergyEv,
        format: (v) => v.toFixed(1) + ' eV',
        onInput: (v) => { state.finiteEnergyEv = Math.min(v, state.v0Ev - 0.1); updateReadouts(); updateBanner(); render(); },
      });
      ui.finEWrap = ui.finESlider.input.closest('.slider-block');

      ui.readouts = X.buildReadouts(controls, [
        { id: 'en', label: 'Eigenvalue Eₙ', primary: true },
        { id: 'e1', label: 'Ground State E₁' },
        { id: 'de', label: 'Level Gap |Eₙ₂ − Eₙ|' },
        { id: 'nodes', label: 'Internal Nodes' },
        { id: 'norm', label: 'Normalization ∫|ψ|²dx', wide: true },
      ]);
      ui.readoutLabels = controls.querySelectorAll('.readout .r-label');

      ui.svgRefs = { dynLayer };
      syncControlVisibility();
    }

    function setLabels(l1, l2, l3, l4, l5) {
      if (!ui.readoutLabels || ui.readoutLabels.length < 5) return;
      ui.readoutLabels[0].textContent = l1;
      ui.readoutLabels[1].textContent = l2;
      ui.readoutLabels[2].textContent = l3;
      ui.readoutLabels[3].textContent = l4;
      ui.readoutLabels[4].textContent = l5;
    }

    function updateReadouts() {
      if (!ui.readouts) return;
      if (state.mode === 'rigid') {
        setLabels('Energy Eigenvalue Eₙ', 'Ground State E₁', `Gap |E(n₂=${state.n2}) − E(${state.n})|`, 'Internal Nodes (n − 1)', 'Normalization & Stationarity');
        const En = energyRigidEv(state.n, state.Lnm, state.massMe);
        const E1 = energyRigidEv(1, state.Lnm, state.massMe);
        const En2 = energyRigidEv(state.n2, state.Lnm, state.massMe);
        const dE = Math.abs(En2.E_eV - En.E_eV);
        const normInt = calcRigidNormIntegral(state.n, state.Lnm);

        ui.readouts.set('en', `${En.E_eV.toFixed(3)} eV (${X.fmtSci(En.E_J, 2)} J)`);
        ui.readouts.set('e1', `${E1.E_eV.toFixed(3)} eV`);
        ui.readouts.set('de', `${dE.toFixed(3)} eV`);
        ui.readouts.set('nodes', `${state.n - 1} node${state.n - 1 === 1 ? '' : 's'}`);
        ui.readouts.set('norm', `∫₀ᴸ |ψₙ|²dx = ${normInt.toFixed(4)} ✓ · |ψₙ|² strictly stationary`);

        formula.innerHTML = `
          <span class="formula active">E<sub>${state.n}</sub> = n²h²/(8mL²) = n²π²ħ²/(2mL²) = <span class="fv">${En.E_eV.toFixed(3)} eV</span></span>
          <span class="formula">ψ<sub>${state.n}</sub>(x) = √(2/L) sin(${state.n}πx/L)</span>
          <span class="formula">ψ(0) = ψ(L) = 0</span>`;
      } else {
        const bStates = solveFiniteBoundStates(state.Lnm, state.v0Ev, state.massMe);
        const idx = Math.min(bStates.length - 1, Math.max(0, state.n - 1));
        const activeBound = bStates[idx] || null;
        const E_cur = state.snapToBound
          ? (activeBound ? activeBound.E : state.v0Ev * 0.5)
          : Math.min(state.finiteEnergyEv, state.v0Ev - 0.08);
        const E_rigid_1 = energyRigidEv(activeBound ? activeBound.n : 1, state.Lnm, state.massMe).E_eV;
        const deltaPen = P.hbar / Math.sqrt(2 * state.massMe * P.m_e * C.evToJ(Math.max(0.05, state.v0Ev - E_cur)));
        const deltaPenNm = deltaPen * 1e9;

        setLabels('Well Energy (Finite)', 'Equivalent Rigid Eₙ', 'Penetration Depth δ = 1/κ', 'Bound States Held', 'Qualitative Comparison');
        const clampedNote = (state.snapToBound && activeBound && state.n > bStates.length)
          ? ` (clamped to n=${activeBound.n})`
          : '';
        ui.readouts.set('en', activeBound || !state.snapToBound ? `${E_cur.toFixed(3)} eV${clampedNote}` : 'Unbound');
        ui.readouts.set('e1', `${E_rigid_1.toFixed(3)} eV`);
        ui.readouts.set('de', `${deltaPenNm.toFixed(3)} nm`);
        ui.readouts.set('nodes', `${bStates.length} bound level${bStates.length === 1 ? '' : 's'}`);
        ui.readouts.set('norm', state.snapToBound
          ? `Finite well lowers energy (${E_cur.toFixed(2)} vs ${E_rigid_1.toFixed(2)} eV) & leaks tails into barriers!`
          : 'Qualitative trial energy: lower V₀ or narrow L increases barrier penetration δ.');

        formula.innerHTML = `
          <span class="formula active">Non-Rigid Well (Qualitative): ψ(±L/2) ≠ 0, exponential barrier tails ~ e<sup>−κ|x|</sup></span>
          <span class="formula">Penetration Depth δ = 1/κ ≈ <span class="fv">${deltaPenNm.toFixed(3)} nm</span></span>`;
      }
    }

    function updateBanner() {
      if (!banner) return;
      if (state.mode === 'rigid') {
        const En = energyRigidEv(state.n, state.Lnm, state.massMe);
        banner.set(
          'RIGID BOX · STATIONARY STATE',
          'ok',
          `At <b>n = ${state.n}</b> (L = ${state.Lnm.toFixed(2)} nm, m = ${state.massMe.toFixed(2)} mₑ), <b>Eₙ = ${En.E_eV.toFixed(3)} eV</b> with ${state.n - 1} internal node(s). Notice |ψₙ(x)|² stays <b>stationary</b> even as the complex phase rotates.`
        );
      } else {
        banner.set(
          'FINITE WELL (QUALITATIVE)',
          '',
          `Finite barriers (<b>V₀ = ${state.v0Ev.toFixed(1)} eV</b>) allow the wavefunction and probability density |ψ|² to penetrate into the walls instead of terminating abruptly at 0.`
        );
      }
    }

    /* ============================================================
       SVG RENDERERS
       ============================================================ */
    function renderRigid(g) {
      const En = energyRigidEv(state.n, state.Lnm, state.massMe);
      const tAnim = (state.animatePhase && !C.prefersReducedMotion()) ? state.time : 0;
      const omegaVis = 2.6 * Math.sqrt(En.E_eV); // scaled phase rotation frequency
      const phaseCos = Math.cos(omegaVis * tAnim);

      // Left Container: Rigid Box Wavefunction (top) & Stationary |psi|^2 (bottom)
      g.append(svgEl('rect', { x: 20, y: 18, width: 516, height: 492, rx: 8, fill: 'rgba(6,10,24,0.68)', stroke: 'rgba(255,255,255,0.13)' }));
      const h1 = svgEl('text', { x: 36, y: 40, fill: '#edf1f8', 'font-size': '12', 'font-weight': '600', 'font-family': 'Inter, sans-serif' });
      h1.textContent = `RIGID BOX (V = ∞ outside [0, L = ${state.Lnm.toFixed(2)} nm])`;
      g.append(h1);

      // Scale physical box width cleanly inside [85..475] so changing L visibly widens/narrows the walls!
      const maxSpan = 370;
      const boxPx = 90 + ((state.Lnm - 0.30) / (2.50 - 0.30)) * (maxSpan - 90);
      const bx0 = 280 - boxPx / 2;
      const bx1 = 280 + boxPx / 2;

      // Infinite walls shading
      g.append(svgEl('rect', { x: 42, y: 60, width: bx0 - 42, height: 422, fill: 'rgba(224,181,83,0.10)' }));
      g.append(svgEl('rect', { x: bx1, y: 60, width: 516 - bx1, height: 422, fill: 'rgba(224,181,83,0.10)' }));
      g.append(svgEl('line', { x1: bx0, y1: 58, x2: bx0, y2: 484, stroke: '#e0b553', 'stroke-width': '3' }));
      g.append(svgEl('line', { x1: bx1, y1: 58, x2: bx1, y2: 484, stroke: '#e0b553', 'stroke-width': '3' }));

      const vInfL = svgEl('text', { x: (42 + bx0) / 2, y: 84, 'text-anchor': 'middle', fill: '#e0b553', 'font-size': '11', 'font-family': 'JetBrains Mono, monospace' });
      vInfL.textContent = 'V=∞';
      const vInfR = svgEl('text', { x: (bx1 + 516) / 2, y: 84, 'text-anchor': 'middle', fill: '#e0b553', 'font-size': '11', 'font-family': 'JetBrains Mono, monospace' });
      vInfR.textContent = 'V=∞';
      g.append(vInfL, vInfR);

      // Top Axis: Wavefunction psi_n(x)
      const midPsi = 165, psiPxAmp = 82;
      g.append(svgEl('line', { x1: bx0, y1: midPsi, x2: bx1, y2: midPsi, stroke: 'rgba(255,255,255,0.22)' }));
      const lblPsi = svgEl('text', { x: bx0 + 8, y: 74, fill: '#22d3ee', 'font-size': '11', 'font-weight': '600', 'font-family': 'Inter, sans-serif' });
      lblPsi.textContent = state.animatePhase ? `Re[Ψ_${state.n}(x,t)] = ψ_${state.n}(x) cos(ωt)` : `ψ_${state.n}(x) = √(2/L) sin(${state.n}πx/L)`;
      g.append(lblPsi);

      // Optional comparison level n2 on psi
      if (state.compareLevels) {
        let d2 = '';
        for (let i = 0; i <= 140; i++) {
          const u = i / 140;
          const px = bx0 + u * boxPx;
          const py = midPsi - Math.sin(state.n2 * Math.PI * u) * psiPxAmp;
          d2 += (i === 0 ? `M ${px.toFixed(1)} ${py.toFixed(1)}` : ` L ${px.toFixed(1)} ${py.toFixed(1)}`);
        }
        g.append(svgEl('path', { d: d2, fill: 'none', stroke: 'rgba(244,114,182,0.55)', 'stroke-dasharray': '5 4', 'stroke-width': '2' }));
      }

      // Static envelope +/- psi_n(x) + animated Re[Psi_n(x,t)]
      let dPsiEnv = '', dPsiReal = '';
      for (let i = 0; i <= 160; i++) {
        const u = i / 160;
        const px = bx0 + u * boxPx;
        const s = Math.sin(state.n * Math.PI * u);
        const pyEnv = midPsi - s * psiPxAmp;
        const pyReal = midPsi - s * phaseCos * psiPxAmp;
        dPsiEnv += (i === 0 ? `M ${px.toFixed(1)} ${pyEnv.toFixed(1)}` : ` L ${px.toFixed(1)} ${pyEnv.toFixed(1)}`);
        dPsiReal += (i === 0 ? `M ${px.toFixed(1)} ${pyReal.toFixed(1)}` : ` L ${px.toFixed(1)} ${pyReal.toFixed(1)}`);
      }
      if (state.animatePhase) {
        g.append(svgEl('path', { d: dPsiEnv, fill: 'none', stroke: 'rgba(34,211,238,0.28)', 'stroke-dasharray': '3 3', 'stroke-width': '1.5' }));
      }
      g.append(svgEl('path', { d: dPsiReal, fill: 'none', stroke: '#22d3ee', 'stroke-width': '2.8' }));

      // Boundary condition markers psi(0)=0, psi(L)=0 and internal nodes
      [0, 1].forEach((u) => {
        g.append(svgEl('circle', { cx: bx0 + u * boxPx, cy: midPsi, r: 4.5, fill: '#34d399', stroke: '#0b1020', 'stroke-width': '1.2' }));
      });
      for (let k = 1; k < state.n; k++) {
        const nx = bx0 + (k / state.n) * boxPx;
        g.append(svgEl('circle', { cx: nx, cy: midPsi, r: 4, fill: '#ff5c7a' }));
      }

      // Bottom Axis: Stationary Probability Density |psi_n(x)|^2
      const baseProb = 450, probPxAmp = 128;
      g.append(svgEl('line', { x1: bx0, y1: baseProb, x2: bx1, y2: baseProb, stroke: 'rgba(255,255,255,0.25)' }));
      const lblProb = svgEl('text', { x: bx0 + 8, y: 304, fill: '#f472b6', 'font-size': '11', 'font-weight': '600', 'font-family': 'Inter, sans-serif' });
      lblProb.textContent = `Stationary Probability Density |Ψ_${state.n}(x,t)|² = |ψ_${state.n}(x)|²`;
      g.append(lblProb);

      if (state.compareLevels) {
        let dp2 = '';
        for (let i = 0; i <= 140; i++) {
          const u = i / 140;
          const px = bx0 + u * boxPx;
          const val = Math.pow(Math.sin(state.n2 * Math.PI * u), 2);
          const py = baseProb - val * probPxAmp;
          dp2 += (i === 0 ? `M ${px.toFixed(1)} ${py.toFixed(1)}` : ` L ${px.toFixed(1)} ${py.toFixed(1)}`);
        }
        g.append(svgEl('path', { d: dp2, fill: 'none', stroke: 'rgba(165,180,252,0.7)', 'stroke-dasharray': '5 4', 'stroke-width': '2' }));
      }

      let dp = '';
      for (let i = 0; i <= 160; i++) {
        const u = i / 160;
        const px = bx0 + u * boxPx;
        const val = Math.pow(Math.sin(state.n * Math.PI * u), 2);
        const py = baseProb - val * probPxAmp;
        dp += (i === 0 ? `M ${px.toFixed(1)} ${py.toFixed(1)}` : ` L ${px.toFixed(1)} ${py.toFixed(1)}`);
      }
      const dpArea = dp + ` L ${bx1} ${baseProb} L ${bx0} ${baseProb} Z`;
      g.append(svgEl('path', { d: dpArea, fill: 'rgba(244,114,182,0.24)' }));
      g.append(svgEl('path', { d: dp, fill: 'none', stroke: '#f472b6', 'stroke-width': '2.6' }));

      // x = 0 and x = L labels
      const xl0 = svgEl('text', { x: bx0, y: 472, 'text-anchor': 'middle', fill: '#cbd5e1', 'font-size': '10.5', 'font-family': 'JetBrains Mono, monospace' });
      xl0.textContent = 'x = 0';
      const xl1 = svgEl('text', { x: bx1, y: 472, 'text-anchor': 'middle', fill: '#cbd5e1', 'font-size': '10.5', 'font-family': 'JetBrains Mono, monospace' });
      xl1.textContent = `x = ${state.Lnm.toFixed(2)} nm`;
      g.append(xl0, xl1);

      // Right Container: Quantized Energy-Level Ladder E_n ~ n^2
      g.append(svgEl('rect', { x: 552, y: 18, width: 268, height: 492, rx: 8, fill: 'rgba(6,10,24,0.68)', stroke: 'rgba(255,255,255,0.13)' }));
      const h2 = svgEl('text', { x: 568, y: 40, fill: '#edf1f8', 'font-size': '12', 'font-weight': '600', 'font-family': 'Inter, sans-serif' });
      h2.textContent = 'ENERGY-LEVEL LADDER (Eₙ ∝ n²)';
      g.append(h2);

      const maxLadderE = Math.max(energyRigidEv(6, 0.30, 1.0).E_eV * 0.25, energyRigidEv(6, state.Lnm, state.massMe).E_eV);
      const ladBot = 474, ladTop = 76;
      const EY = (ev) => ladBot - X.clamp(ev / maxLadderE, 0, 1) * (ladBot - ladTop);

      for (let lv = 1; lv <= 6; lv++) {
        const elv = energyRigidEv(lv, state.Lnm, state.massMe).E_eV;
        const yy = EY(elv);
        const isPrimary = lv === state.n;
        const isComp = state.compareLevels && lv === state.n2;
        const col = isPrimary ? '#22d3ee' : isComp ? '#f472b6' : 'rgba(148,163,184,0.45)';
        g.append(svgEl('line', {
          x1: 576, y1: yy, x2: 716, y2: yy,
          stroke: col, 'stroke-width': (isPrimary || isComp) ? '3' : '1.6',
        }));
        const lt = svgEl('text', {
          x: 724, y: yy + 4,
          fill: (isPrimary || isComp) ? col : '#94a3b8',
          'font-size': '10.5',
          'font-weight': (isPrimary || isComp) ? '700' : '500',
          'font-family': 'JetBrains Mono, monospace',
        });
        lt.textContent = `n=${lv}: ${elv < 10 ? elv.toFixed(2) : elv.toFixed(1)} eV`;
        g.append(lt);
      }

      // Transition gap arrow when comparing levels
      if (state.compareLevels && state.n2 !== state.n) {
        const y1 = EY(energyRigidEv(state.n, state.Lnm, state.massMe).E_eV);
        const y2 = EY(energyRigidEv(state.n2, state.Lnm, state.massMe).E_eV);
        g.append(svgEl('line', { x1: 604, y1, x2: 604, y2, stroke: '#34d399', 'stroke-width': '2', 'stroke-dasharray': '3 3' }));
      }
    }

    function renderFinite(g) {
      const bStates = solveFiniteBoundStates(state.Lnm, state.v0Ev, state.massMe);
      const idx = Math.min(bStates.length - 1, Math.max(0, state.n - 1));
      const activeBound = bStates[idx] || null;
      const E_cur = state.snapToBound
        ? (activeBound ? activeBound.E : state.v0Ev * 0.5)
        : Math.min(state.finiteEnergyEv, state.v0Ev - 0.08);
      const parity = activeBound ? activeBound.parity : (state.n % 2 === 1 ? 'even' : 'odd');

      g.append(svgEl('rect', { x: 20, y: 18, width: 800, height: 492, rx: 8, fill: 'rgba(6,10,24,0.68)', stroke: 'rgba(255,255,255,0.13)' }));
      const hdr = svgEl('text', { x: 38, y: 42, fill: '#edf1f8', 'font-size': '12.5', 'font-weight': '600', 'font-family': 'Inter, sans-serif' });
      hdr.textContent = `NON-RIGID BOX / FINITE POTENTIAL WELL (V₀ = ${state.v0Ev.toFixed(1)} eV, L = ${state.Lnm.toFixed(2)} nm) — QUALITATIVE PENETRATION`;
      g.append(hdr);

      const x0 = 60, x1 = 780, pw = x1 - x0;
      const xRange = 2.2; // -2.2 to +2.2 nm
      const PX = (x) => x0 + ((x + xRange) / (2 * xRange)) * pw;
      const halfL = state.Lnm * 0.5;
      const wxL = PX(-halfL), wxR = PX(halfL);

      // Well geometry + energy level on top half (y: 64..265)
      const vBase = 248, vTop = 74, vMax = 10.5;
      const VY = (ev) => vBase - (X.clamp(ev, 0, vMax) / vMax) * (vBase - vTop);
      const yV0 = VY(state.v0Ev);
      const yE = VY(E_cur);

      // Finite potential barrier walls shaded
      g.append(svgEl('rect', { x: x0, y: yV0, width: wxL - x0, height: vBase - yV0, fill: 'rgba(224,181,83,0.12)' }));
      g.append(svgEl('rect', { x: wxR, y: yV0, width: x1 - wxR, height: vBase - yV0, fill: 'rgba(224,181,83,0.12)' }));
      const vPath = `M ${x0} ${yV0} L ${wxL} ${yV0} L ${wxL} ${vBase} L ${wxR} ${vBase} L ${wxR} ${yV0} L ${x1} ${yV0}`;
      g.append(svgEl('path', { d: vPath, fill: 'none', stroke: '#e0b553', 'stroke-width': '2.6' }));

      // Bound levels + active E line
      bStates.forEach((bs) => {
        const yB = VY(bs.E);
        const isSel = activeBound && bs.n === activeBound.n && state.snapToBound;
        g.append(svgEl('line', {
          x1: wxL, y1: yB, x2: wxR, y2: yB,
          stroke: isSel ? '#34d399' : 'rgba(148,163,184,0.45)', 'stroke-width': isSel ? '2.5' : '1.4',
        }));
      });
      g.append(svgEl('line', { x1: x0, y1: yE, x2: x1, y2: yE, stroke: '#34d399', 'stroke-dasharray': '5 4', 'stroke-width': '1.8' }));
      const eTxt = svgEl('text', { x: x1 - 8, y: yE - 6, 'text-anchor': 'end', fill: '#34d399', 'font-size': '10.5', 'font-weight': '600', 'font-family': 'JetBrains Mono, monospace' });
      eTxt.textContent = `E = ${E_cur.toFixed(2)} eV (< V₀)`;
      g.append(eTxt);

      // Wavefunction psi(x) & |psi(x)|^2 with Exponential Penetration Tails into Barrier Regions (y: 282..485)
      const midPsi = 342, baseProb = 472;
      g.append(svgEl('rect', { x: x0, y: 280, width: wxL - x0, height: 204, fill: 'rgba(244,114,182,0.06)' }));
      g.append(svgEl('rect', { x: wxR, y: 280, width: x1 - wxR, height: 204, fill: 'rgba(244,114,182,0.06)' }));
      g.append(svgEl('line', { x1: wxL, y1: 280, x2: wxL, y2: 484, stroke: 'rgba(224,181,83,0.45)', 'stroke-dasharray': '3 3' }));
      g.append(svgEl('line', { x1: wxR, y1: 280, x2: wxR, y2: 484, stroke: 'rgba(224,181,83,0.45)', 'stroke-dasharray': '3 3' }));
      g.append(svgEl('line', { x1: x0, y1: midPsi, x2: x1, y2: midPsi, stroke: 'rgba(255,255,255,0.22)' }));
      g.append(svgEl('line', { x1: x0, y1: baseProb, x2: x1, y2: baseProb, stroke: 'rgba(255,255,255,0.22)' }));

      const rawVals = [];
      let maxAbs = 0.01;
      for (let i = 0; i <= 220; i++) {
        const xv = -xRange + (i / 220) * (2 * xRange);
        const val = evalFiniteQualitative(xv, state.Lnm, state.v0Ev, E_cur, state.massMe, parity);
        rawVals.push({ x: xv, val });
        if (Math.abs(val) > maxAbs) maxAbs = Math.abs(val);
      }

      let dPsi = '', dProb = '';
      rawVals.forEach((p, i) => {
        const normV = p.val / maxAbs;
        const px = PX(p.x);
        const py = midPsi - normV * 46;
        const ppy = baseProb - (normV * normV) * 76;
        dPsi += (i === 0 ? `M ${px.toFixed(1)} ${py.toFixed(1)}` : ` L ${px.toFixed(1)} ${py.toFixed(1)}`);
        dProb += (i === 0 ? `M ${px.toFixed(1)} ${ppy.toFixed(1)}` : ` L ${px.toFixed(1)} ${ppy.toFixed(1)}`);
      });

      const dProbArea = dProb + ` L ${x1} ${baseProb} L ${x0} ${baseProb} Z`;
      g.append(svgEl('path', { d: dPsi, fill: 'none', stroke: '#22d3ee', 'stroke-width': '2.4' }));
      g.append(svgEl('path', { d: dProbArea, fill: 'rgba(244,114,182,0.24)' }));
      g.append(svgEl('path', { d: dProb, fill: 'none', stroke: '#f472b6', 'stroke-width': '2.4' }));

      const notePen = svgEl('text', { x: (x0 + wxL) / 2, y: 392, 'text-anchor': 'middle', fill: '#f472b6', 'font-size': '10', 'font-weight': '600', 'font-family': 'Inter, sans-serif' });
      notePen.textContent = 'Barrier Penetration |ψ|² > 0';
      const notePenR = svgEl('text', { x: (wxR + x1) / 2, y: 392, 'text-anchor': 'middle', fill: '#f472b6', 'font-size': '10', 'font-weight': '600', 'font-family': 'Inter, sans-serif' });
      notePenR.textContent = 'Exponential Tail';
      g.append(notePen, notePenR);
    }

    function render() {
      if (!ui.svgRefs) return;
      const g = ui.svgRefs.dynLayer;
      g.innerHTML = '';
      if (state.mode === 'rigid') renderRigid(g);
      else renderFinite(g);
    }

    return {
      mount() {
        buildDOM();
        updateReadouts();
        updateBanner();
        render();
      },
      unmount() {},
      tick(dt) {
        if (state.playing && state.mode === 'rigid' && state.animatePhase) {
          state.time += dt;
          render();
        }
      },
      resize() { render(); },
      applyPreset(preset) {
        if (preset === 'finite') {
          state.mode = 'finite';
        } else {
          state.mode = 'rigid';
          if (preset === 'derive') {
            state.showDerivation = true;
            if (ui.derivToggle) ui.derivToggle.checked = true;
          } else if (preset === 'compare-levels') {
            state.compareLevels = true;
            if (ui.cmpToggle) ui.cmpToggle.checked = true;
          }
        }
        if (subtabBar) subtabBar.set(state.mode);
        syncControlVisibility();
        syncDerivBox();
        updateReadouts();
        updateBanner();
        render();
      },
      energyRigidEv,
      calcRigidNormIntegral,
      solveFiniteBoundStates,
      getState: () => state,
    };
  };
})();
