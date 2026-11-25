(function () {
  'use strict';

  /* ============================================================
     CHAPTER 3: QUANTUM MECHANICS — CODATA CONSTANTS & HELPERS
     ============================================================ */
  const H = 6.62607015e-34;          // Planck constant (J·s)
  const HBAR = H / (2 * Math.PI);    // Reduced Planck constant ħ (J·s)
  const C_LIGHT = 2.99792458e8;      // Speed of light (m/s)
  const E_CHARGE = 1.602176634e-19;  // Elementary charge (J/eV)
  const M_E = 9.1093837015e-31;      // Electron mass (kg)
  const M_P = 1.67262192369e-27;     // Proton mass (kg)
  const M_N = 1.67492749804e-27;     // Neutron mass (kg)

  const CH3_PHYSICS = {
    h: H,
    hbar: HBAR,
    c: C_LIGHT,
    e: E_CHARGE,
    m_e: M_E,
    m_p: M_P,
    m_n: M_N,
    hc_eV_nm: (H * C_LIGHT / E_CHARGE) * 1e9, // ~1239.842 eV·nm
    hbar2_over_2me_eV_nm2: ((HBAR * HBAR) / (2 * M_E * E_CHARGE)) * 1e18, // ~0.0380998 eV·nm^2
  };

  function evToJ(ev) { return ev * E_CHARGE; }
  function jToEv(j) { return j / E_CHARGE; }
  function nmToEv(nm) { return CH3_PHYSICS.hc_eV_nm / Math.max(nm, 1e-6); }
  function evToNm(ev) { return CH3_PHYSICS.hc_eV_nm / Math.max(ev, 1e-9); }

  function spectrumColor(nm, alpha) {
    const a = alpha === undefined ? 1 : alpha;
    let r = 0, g = 0, b = 0;
    if (nm < 380) {
      r = 0.65; g = 0.35; b = 1.0;
    } else if (nm < 440) {
      r = -(nm - 440) / 60; g = 0; b = 1;
    } else if (nm < 490) {
      r = 0; g = (nm - 440) / 50; b = 1;
    } else if (nm < 510) {
      r = 0; g = 1; b = -(nm - 510) / 20;
    } else if (nm < 580) {
      r = (nm - 510) / 70; g = 1; b = 0;
    } else if (nm < 645) {
      r = 1; g = -(nm - 645) / 65; b = 0;
    } else if (nm <= 740) {
      r = 1; g = 0; b = 0;
    } else {
      r = 0.92; g = 0.25; b = 0.32;
    }
    return `rgba(${Math.round(255 * r)},${Math.round(255 * g)},${Math.round(255 * b)},${a})`;
  }

  function svgEl(tag, attrs) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) {
      for (const k in attrs) node.setAttribute(k, String(attrs[k]));
    }
    return node;
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* ============================================================
     CHAPTER 3 LESSON & SYLLABUS REGISTRY
     ============================================================ */
  const CH3_ICONS = {
    c3t1: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><circle cx="3.5" cy="7" r="1.7"/><path d="M5.5 7c1.1-2.5 2.1-2.5 3.2 0s2.1 2.5 3.3 0"/></svg>',
    c3t2: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 7c1.5 0 2-4 3.2-4s1.5 8 2.6 8 1.5-8 2.6-8 1.5 4 2.6 4"/></svg>',
    c3t3: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M2 11h10"/><path d="M3.5 11c1.6 0 2-7.5 3.5-7.5S8.9 11 10.5 11"/></svg>',
    c3t4: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4v3.5a4 4 0 0 0 8 0V4"/><path d="M7 2.2v10"/></svg>',
    c3t5: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 2.5v9h9v-9"/><path d="M2.5 9c2.2-4.5 6.8-4.5 9 0"/></svg>',
    c3t6: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><rect x="5.3" y="3" width="3.4" height="8"/><path d="M1.5 8.5c1-2.2 2-2.2 3.8 0l3.4 1c1.2.4 2.5.4 3.8-.5"/></svg>',
  };

  const CH3_TOPICS = [
    {
      id: 'c3t1',
      file: 'sim1-debroglie.js',
      name: 'de Broglie Lab',
      lesson: '3.1 Wave–Particle Duality & de Broglie Hypothesis',
      simName: 'Wave–Particle Duality Lab',
      title: '3.1 Wave–Particle Duality & de Broglie Wavelength Laboratory',
      desc: 'Explore matter waves for electrons, protons, and neutrons (λ = h/p = h/√(2mK)), compare kinetic energy vs. wavelength, and contrast with electromagnetic photons (E = hν = hc/λ).',
      canvasTitle: 'Matter-Wave & Radiation Duality Laboratory',
      keyIdea: 'λ = h/p = h/√(2mK)',
    },
    {
      id: 'c3t2',
      file: 'sim2-wave-packet.js',
      name: 'Wave Packet',
      lesson: '3.2 Wave Packet, Phase & Group Velocity',
      simName: 'Wave Packet Explorer',
      title: '3.2 Wave Packet Superposition, Phase Velocity & Group Velocity',
      desc: 'Superpose multiple plane waves to build a localized wave packet, track carrier phase velocity (vp = ω/k) vs. packet group velocity (vg = dω/dk), and test free matter waves (vp = v/2, vg = v).',
      canvasTitle: 'Wave Packet & Dispersion Laboratory',
      keyIdea: 'vp = ω/k · vg = dω/dk',
    },
    {
      id: 'c3t3',
      file: 'sim3-uncertainty.js',
      name: 'Uncertainty',
      lesson: '3.3 Heisenberg Uncertainty Principle',
      simName: 'Uncertainty Laboratory',
      title: '3.3 Heisenberg Uncertainty Principle — Position & Momentum Distributions',
      desc: 'Adjust a Gaussian wave packet’s spatial spread Δx and watch the conjugate momentum distribution Δp respond inversely to satisfy Δx·Δp ≥ ħ/2.',
      canvasTitle: 'Position & Momentum Fourier Uncertainty Lab',
      keyIdea: 'Δx·Δp ≥ ħ/2',
    },
    {
      id: 'c3t4',
      file: 'sim4-wavefunction-schrodinger.js',
      name: 'ψ & Schrödinger',
      lesson: '3.4 Wave Function, Normalization & Schrödinger Equation',
      simName: 'Wave Function & Schrödinger Lab',
      title: '3.4 Wave Function, Normalization & Time-Independent Schrödinger Equation',
      desc: 'Compare probability amplitude ψ(x) with density |ψ(x)|², test normalization ∫|ψ|²dx = 1, inspect well-behaved vs. invalid wavefunctions, and explore −(ħ²/2m)ψ″ + V(x)ψ = Eψ.',
      canvasTitle: 'Wave Function, Normalization & TISE Explorer',
      keyIdea: '∫|ψ|²dx = 1 & Hψ = Eψ',
    },
    {
      id: 'c3t5',
      file: 'sim5-particle-box.js',
      name: 'Particle in Box',
      lesson: '3.5 Particle in Rigid & Non-Rigid Boxes',
      simName: 'Particle in a Box Lab',
      title: '3.5 Particle in a 1D Box — Rigid Infinite Well & Finite Potential Well',
      desc: 'Vary box width L, particle mass m, and quantum number n to observe quantized energies En = n²h²/(8mL²), stationary |ψn|², step-by-step boundary derivation, and barrier penetration in a finite well.',
      canvasTitle: '1D Quantum Potential Well & Energy Ladder',
      keyIdea: 'En = n²h²/(8mL²)',
    },
    {
      id: 'c3t6',
      file: 'sim6-tunnelling.js',
      name: 'Tunnelling',
      lesson: '3.6 Quantum Tunnelling Effect',
      simName: 'Quantum Tunnelling Lab',
      title: '3.6 Quantum Tunnelling Through a Rectangular Potential Barrier',
      desc: 'Tune particle energy E, barrier height V₀, width a, and mass m to observe exponential decay and non-zero transmission for E < V₀, partial reflection resonances for E > V₀, and live T(E) curves.',
      canvasTitle: '1D Rectangular Barrier Scattering & T(E) Lab',
      keyIdea: 'T + R = 1 (E < V₀ & E > V₀)',
    },
  ];

  // Full 8-row syllabus index mapping directly into the 6 integrated laboratories
  const CH3_SYLLABUS_MAP = [
    { num: '3.1', syllabus: 'Wave-particle duality & de Broglie', lab: 'Wave–Particle Duality Lab', topicId: 'c3t1', preset: 'particle', eq: 'λ = h/√(2mK)' },
    { num: '3.2', syllabus: 'Wave packet, phase & group velocity', lab: 'Wave Packet Explorer', topicId: 'c3t2', preset: 'matter', eq: 'vp = ω/k, vg = dω/dk' },
    { num: '3.3', syllabus: 'Heisenberg uncertainty principle', lab: 'Uncertainty Laboratory', topicId: 'c3t3', preset: 'minimum', eq: 'Δx·Δp ≥ ħ/2' },
    { num: '3.4a', syllabus: 'Wave function & normalization', lab: 'Wave Function Lab', topicId: 'c3t4', preset: 'normalization', eq: '∫|ψ(x)|² dx = 1' },
    { num: '3.4b', syllabus: 'Schrödinger time-independent eq.', lab: 'Schrödinger Eq. Explorer', topicId: 'c3t4', preset: 'schrodinger', eq: '−(ħ²/2m)ψ″ + Vψ = Eψ' },
    { num: '3.5a', syllabus: 'Particle in rigid box', lab: 'Particle in a Box Lab', topicId: 'c3t5', preset: 'rigid', eq: 'En = n²h²/(8mL²)' },
    { num: '3.5b', syllabus: 'Particle in non-rigid box', lab: 'Finite Potential Well', topicId: 'c3t5', preset: 'finite', eq: 'Barrier Penetration' },
    { num: '3.6', syllabus: 'Tunnelling effect', lab: 'Quantum Tunnelling Lab', topicId: 'c3t6', preset: 'tunnel', eq: 'R + T = 1' },
  ];

  const CH3_THEORY = {
    c3t1: `<ul>
      <li><b>de Broglie Hypothesis:</b> Every moving particle with momentum p has an associated matter wavelength <b>λ = h/p</b>. For a non-relativistic particle of mass m and kinetic energy K = p²/(2m), <b>λ = h / √(2mK)</b>.</li>
      <li><b>Matter Waves vs. Electromagnetic Waves:</b> Electromagnetic radiation travels at c with zero rest mass and energy <b>E = hν = hc/λ</b> (oscillating electric &amp; magnetic fields). A matter wave is <b>not</b> an electromagnetic wave and is <b>not</b> a physical zig-zag oscillation of the particle; it is a quantum probability amplitude wave whose phase depends on particle energy and momentum.</li>
      <li><b>Associated Frequency Convention:</b> Because kinetic energy K omits rest-mass energy mc², the kinetic phase frequency <b>ν<sub>K</sub> = K/h</b> differs from the relativistic total-energy frequency <b>ν<sub>tot</sub> = (mc² + K)/h</b>. Group velocity v<sub>g</sub> = dω/dk matches particle velocity v in both conventions.</li>
      <li><b>Properties of Matter Waves:</b> Lighter particles and lower kinetic energies produce longer, more easily observable wavelengths (e.g. a 100 eV electron has λ ≈ 0.123 nm, comparable to atomic spacing, enabling electron diffraction).</li>
    </ul>
    <div class="theory-entry-row">
      <span class="theory-entry-label">Try in Lab ↑</span>
      <button type="button" class="btn-lab-launch" data-preset="particle">A. Particle Mode (Electron)</button>
      <button type="button" class="btn-lab-launch" data-preset="proton">Compare Proton Mass</button>
      <button type="button" class="btn-lab-launch" data-preset="radiation">B. Radiation Mode (E = hc/λ)</button>
    </div>`,

    c3t2: `<ul>
      <li><b>Localized Wave Packet:</b> A single monochromatic plane wave extends infinitely and cannot represent a localized particle. Superposing multiple waves across a wave-number spread <b>Δk</b> produces destructive interference outside a finite region and constructive interference inside a localized <b>wave packet</b>.</li>
      <li><b>Phase Velocity vs. Group Velocity:</b> Individual carrier crests advance at the <b>phase velocity v<sub>p</sub> = ω/k</b>, whereas the modulation envelope carrying energy and particle probability moves at the <b>group velocity v<sub>g</sub> = dω/dk</b>.</li>
      <li><b>Free Non-Relativistic Matter Wave:</b> Using kinetic dispersion <b>ω(k) = E/ħ = ħk²/(2m)</b>, we obtain <b>v<sub>g</sub> = dω/dk = ħk/m = v</b> (exact particle speed!) while <b>v<sub>p</sub> = ω/k = ħk/(2m) = v/2</b>.</li>
      <li><b>Model Assumptions:</b> The relation v<sub>p</sub> = v/2 applies specifically to non-relativistic free-particle kinetic dispersion ω = ħk²/(2m). It is <b>not</b> a universal identity for all waves — e.g. electromagnetic waves in vacuum have ω = ck, giving v<sub>p</sub> = v<sub>g</sub> = c.</li>
    </ul>
    <div class="theory-entry-row">
      <span class="theory-entry-label">Try in Lab ↑</span>
      <button type="button" class="btn-lab-launch" data-preset="matter">Free Matter Wave (vp = v/2, vg = v)</button>
      <button type="button" class="btn-lab-launch" data-preset="custom-slow">Custom Dispersion (vp &gt; vg)</button>
      <button type="button" class="btn-lab-launch" data-preset="narrow-packet">Wide Δk → Narrow Packet</button>
    </div>`,

    c3t3: `<ul>
      <li><b>Heisenberg Uncertainty Principle:</b> For any quantum state, the standard deviations of position Δx and momentum Δp satisfy <b>Δx · Δp ≥ ħ/2</b>.</li>
      <li><b>Intrinsic Quantum Property:</b> Uncertainty is <b>not</b> caused by imperfect measuring devices or experimental clumsiness; it is an intrinsic consequence of wave-particle duality and Fourier superposition between position and momentum representations.</li>
      <li><b>Minimum-Uncertainty Gaussian State:</b> A Gaussian wave packet achieves the exact lower bound <b>Δx · Δp = ħ/2</b>. Compressing position uncertainty Δx automatically requires a wider spectrum of wave numbers k = p/ħ, broadening momentum uncertainty Δp.</li>
      <li><b>Visual Comparison:</b> Narrowing Δx creates a sharp position spike alongside a wide momentum distribution; broadening Δx localizes momentum sharply around p₀.</li>
    </ul>
    <div class="theory-entry-row">
      <span class="theory-entry-label">Try in Lab ↑</span>
      <button type="button" class="btn-lab-launch" data-preset="narrow">Narrow Δx (Large Δp)</button>
      <button type="button" class="btn-lab-launch" data-preset="minimum">Balanced Minimum Gaussian</button>
      <button type="button" class="btn-lab-launch" data-preset="broad">Broad Δx (Small Δp)</button>
      <button type="button" class="btn-lab-launch" data-preset="chirped">Compare Non-Minimum State (&gt; ħ/2)</button>
    </div>`,

    c3t4: `<ul>
      <li><b>Wave Function ψ(x) &amp; Probability Density |ψ(x)|²:</b> ψ(x) is the complex probability amplitude (carrying phase and sign), while <b>|ψ(x)|²</b> gives the probability per unit length of finding the particle near x.</li>
      <li><b>Normalization Condition:</b> Since total probability over all space must equal 1, a normalizable wavefunction satisfies <b>∫<sub>−∞</sub><sup>+∞</sup> |ψ(x)|² dx = 1</b>. An unnormalized state ψ<sub>raw</sub> is normalized via N = 1/√(∫|ψ<sub>raw</sub>|²dx).</li>
      <li><b>Well-Behaved Wavefunction Criteria:</b> Physically valid bound wavefunctions must be <b>single-valued</b>, <b>finite</b>, <b>continuous</b>, and <b>normalizable</b>. Their slope dψ/dx is continuous wherever potential V(x) is finite, while a slope jump is permitted at an idealized infinite potential wall (V → ∞).</li>
      <li><b>Time-Independent Schrödinger Equation (TISE):</b> <b>−(ħ²/2m) d²ψ/dx² + V(x)ψ = Eψ</b> balances the kinetic energy operator, potential energy V(x), and total energy E. Where E &gt; V(x), curvature bends ψ toward the axis (oscillatory); where E &lt; V(x), curvature bends away (evanescent decay).</li>
    </ul>
    <div class="theory-entry-row">
      <span class="theory-entry-label">Try in Lab ↑</span>
      <button type="button" class="btn-lab-launch" data-preset="normalization">A. Normalization Lab</button>
      <button type="button" class="btn-lab-launch" data-preset="wellbehaved">B. Well-Behaved Explorer</button>
      <button type="button" class="btn-lab-launch" data-preset="schrodinger">C. Schrödinger TISE Explorer</button>
    </div>
    <div class="ch3-bridge-row">
      <span class="theory-entry-label">Next Bridges →</span>
      <button type="button" class="ch3-bridge-btn" data-jump-topic="c3t5" data-jump-preset="rigid">Particle in a Rigid Box (3.5) →</button>
      <button type="button" class="ch3-bridge-btn" data-jump-topic="c3t6" data-jump-preset="tunnel">Quantum Tunnelling Barrier (3.6) →</button>
    </div>`,

    c3t5: `<ul>
      <li><b>Rigid Box (Infinite Square Well):</b> For V(x) = 0 inside 0 &lt; x &lt; L and V = ∞ outside, boundary conditions <b>ψ(0) = ψ(L) = 0</b> quantize wave numbers k<sub>n</sub> = nπ/L (n = 1, 2, 3, …).</li>
      <li><b>Eigenfunctions &amp; Quantized Energies:</b> Normalized states are <b>ψ<sub>n</sub>(x) = √(2/L) sin(nπx/L)</b> with <b>n − 1</b> internal nodes, and allowed energies <b>E<sub>n</sub> = n²h²/(8mL²) = n²π²ħ²/(2mL²)</b>. Notice E<sub>1</sub> &gt; 0 (zero-point energy) and E<sub>n</sub> ∝ 1/(mL²).</li>
      <li><b>Stationary States:</b> For an energy eigenstate Ψ<sub>n</sub>(x,t) = ψ<sub>n</sub>(x) e<sup>−iE<sub>n</sub>t/ħ</sup>, the complex phase rotates in time, but the probability density <b>|Ψ<sub>n</sub>(x,t)|² = |ψ<sub>n</sub>(x)|²</b> is completely <b>stationary</b>.</li>
      <li><b>Non-Rigid Box (Finite Potential Well — Qualitative):</b> When barrier height V₀ is finite, bound-state wavefunctions do <b>not</b> vanish abruptly at the walls — they decay exponentially into the surrounding barriers, giving non-zero probability outside the well and lowering energy levels compared to an infinite box of the same width.</li>
    </ul>
    <div class="theory-entry-row">
      <span class="theory-entry-label">Try in Lab ↑</span>
      <button type="button" class="btn-lab-launch" data-preset="rigid">A. Rigid Box (Infinite Well)</button>
      <button type="button" class="btn-lab-launch" data-preset="derive">Step-by-Step Derivation</button>
      <button type="button" class="btn-lab-launch" data-preset="compare-levels">Compare Eigenstates n vs n₂</button>
      <button type="button" class="btn-lab-launch" data-preset="finite">B. Finite Potential Well</button>
    </div>`,

    c3t6: `<ul>
      <li><b>Classical vs. Quantum Prediction:</b> Classically, a particle with total energy E &lt; V₀ cannot enter a potential barrier (100% reflection). Quantum mechanically, the wavefunction penetrates into the barrier with decay constant <b>κ = √(2m(V₀ − E))/ħ</b> and emerges on the far side with non-zero transmission probability T.</li>
      <li><b>Exact Rectangular Barrier Equations (width a):</b><br>
        • For <b>E &lt; V₀</b>: <b>T = [1 + V₀² sinh²(κa) / (4E(V₀ − E))]<sup>−1</sup></b><br>
        • For <b>E &gt; V₀</b>: <b>T = [1 + V₀² sin²(qa) / (4E(E − V₀))]<sup>−1</sup></b> with q = √(2m(E − V₀))/ħ, exhibiting partial reflection except at transmission resonances qa = mπ.</li>
      <li><b>Probability Conservation:</b> Reflected and transmitted fractions always satisfy <b>R + T = 1</b>.</li>
      <li><b>Sensitivity:</b> Increasing barrier width a, barrier height V₀, or particle mass m exponentially suppresses tunnelling transmission when E &lt; V₀.</li>
    </ul>
    <div class="theory-entry-row">
      <span class="theory-entry-label">Try in Lab ↑</span>
      <button type="button" class="btn-lab-launch" data-preset="tunnel">Case A: Tunnelling (E &lt; V₀)</button>
      <button type="button" class="btn-lab-launch" data-preset="thick-barrier">Wide Barrier Suppression</button>
      <button type="button" class="btn-lab-launch" data-preset="over-barrier">Case B: Over-Barrier (E &gt; V₀)</button>
      <button type="button" class="btn-lab-launch" data-preset="resonance">Transmission Resonance (T = 1)</button>
    </div>`,
  };

  /* ============================================================
     REUSABLE CHAPTER 3 CONTROL BUILDERS
     ============================================================ */
  function buildTransport(parent, { onTogglePlay, onStep, onReset, playLabel, stepLabel }) {
    const row = window.XLab.el('div', 'transport-row' + (onStep ? '' : ' two'));
    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'ctrl-btn primary';
    playBtn.textContent = playLabel || 'Pause';

    let stepBtn = null;
    if (onStep) {
      stepBtn = document.createElement('button');
      stepBtn.type = 'button';
      stepBtn.className = 'ctrl-btn';
      stepBtn.textContent = stepLabel || 'Step';
      stepBtn.addEventListener('click', onStep);
    }

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'ctrl-btn';
    resetBtn.textContent = 'Reset';
    resetBtn.addEventListener('click', onReset);

    playBtn.addEventListener('click', onTogglePlay);
    row.append(playBtn);
    if (stepBtn) row.append(stepBtn);
    row.append(resetBtn);
    parent.append(row);

    return {
      setPlaying(playing) {
        playBtn.textContent = playing ? 'Pause' : 'Play';
        playBtn.classList.toggle('primary', !playing);
        playBtn.classList.toggle('active', playing);
      },
      playBtn,
      stepBtn,
      resetBtn,
    };
  }

  function buildActionRow(parent, buttons) {
    const row = window.XLab.el('div', 'transport-row' + (buttons.length === 2 ? ' two' : ''));
    if (buttons.length === 1) row.style.gridTemplateColumns = '1fr';
    const refs = {};
    buttons.forEach((b) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ctrl-btn' + (b.primary ? ' primary' : '');
      btn.textContent = b.label;
      btn.addEventListener('click', b.onClick);
      row.append(btn);
      refs[b.id || b.label] = btn;
    });
    parent.append(row);
    return refs;
  }

  function buildBanner(canvasWrap) {
    canvasWrap.querySelectorAll('.sim-banner').forEach((n) => n.remove());
    const banner = window.XLab.el('div', 'sim-banner');
    const mainDiv = window.XLab.el('div', 'sim-banner-main');
    const tag = window.XLab.el('span', 'sim-banner-tag', 'READY');
    const text = window.XLab.el('div', 'sim-banner-text', '');
    mainDiv.append(tag, text);
    banner.append(mainDiv);
    canvasWrap.append(banner);
    return {
      el: banner,
      set(tagLabel, variant, html) {
        tag.textContent = tagLabel;
        tag.className = 'sim-banner-tag' + (variant ? ' ' + variant : '');
        text.innerHTML = html;
      },
    };
  }

  function buildSubtabs(canvasWrap, tabs, activeId, onChange) {
    canvasWrap.querySelectorAll('.ch2-subtabs').forEach((n) => n.remove());
    const bar = window.XLab.el('div', 'ch2-subtabs');
    bar.setAttribute('role', 'tablist');
    const btns = {};
    const activateTab = (id) => {
      Object.keys(btns).forEach((k) => {
        const on = k === id;
        btns[k].classList.toggle('active', on);
        btns[k].setAttribute('aria-selected', on ? 'true' : 'false');
        btns[k].tabIndex = on ? 0 : -1;
      });
    };
    tabs.forEach((t, idx) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ch2-subtab' + (t.id === activeId ? ' active' : '');
      b.textContent = t.label;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', t.id === activeId ? 'true' : 'false');
      b.tabIndex = t.id === activeId ? 0 : -1;
      b.addEventListener('click', () => {
        activateTab(t.id);
        onChange(t.id);
      });
      b.addEventListener('keydown', (e) => {
        let nextIdx = null;
        if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') nextIdx = 0;
        else if (e.key === 'End') nextIdx = tabs.length - 1;
        if (nextIdx !== null) {
          e.preventDefault();
          const targetTab = tabs[nextIdx];
          activateTab(targetTab.id);
          onChange(targetTab.id);
          btns[targetTab.id].focus();
        }
      });
      btns[t.id] = b;
      bar.append(b);
    });
    const stage = canvasWrap.querySelector('.canvas-stage');
    canvasWrap.insertBefore(bar, stage);
    return {
      set(id) {
        activateTab(id);
      },
    };
  }

  /* ============================================================
     LAZY MODULE LOADER & CHAPTER 3 MANAGER
     ============================================================ */
  window.CH3_SIMS = window.CH3_SIMS || {};
  const scriptPromises = {};

  function loadSimModule(topic) {
    if (window.CH3_SIMS[topic.id]) {
      return Promise.resolve(window.CH3_SIMS[topic.id]);
    }
    if (scriptPromises[topic.id]) return scriptPromises[topic.id];
    scriptPromises[topic.id] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'src/ch3/' + topic.file;
      s.async = true;
      s.onload = () => {
        if (window.CH3_SIMS[topic.id]) resolve(window.CH3_SIMS[topic.id]);
        else reject(new Error('Chapter 3 simulation did not register: ' + topic.id));
      };
      s.onerror = () => reject(new Error('Failed to load src/ch3/' + topic.file));
      document.head.appendChild(s);
    });
    return scriptPromises[topic.id];
  }

  const ch3State = {
    built: false,
    visible: false,
    activeTopic: 'c3t1',
    mountedSimId: null,
    mountedInstance: null,
    pendingPreset: null,
    overviewEl: null,
    overviewCards: [],
    panels: {},
    loadToken: 0,
  };

  function jumpToTopicPreset(topicId, preset) {
    if (preset) {
      if (ch3State.mountedSimId === topicId && ch3State.mountedInstance && ch3State.mountedInstance.applyPreset) {
        ch3State.mountedInstance.applyPreset(preset);
      } else {
        ch3State.pendingPreset = { id: topicId, preset };
      }
    }
    switchTopic(topicId);
    const panel = ch3State.panels[topicId];
    if (panel) {
      const ws = panel.querySelector('.workspace');
      if (ws && ws.scrollIntoView) {
        ws.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      }
    }
  }

  function buildChapter3DOM() {
    if (ch3State.built) return;
    ch3State.built = true;

    const mainEl = document.getElementById('main');
    const el = window.XLab.el;

    // Collapsible 8-Topic Syllabus Index linking straight to every Simulation & Sub-lab
    const ov = el('section', 'ch3-overview');
    ov.id = 'ch3Overview';
    ov.setAttribute('aria-label', 'Unit III Quantum Mechanics Syllabus Index');
    const compactDefault = window.innerWidth <= 768;
    if (!compactDefault) ov.classList.add('open');

    const ovHead = document.createElement('button');
    ovHead.type = 'button';
    ovHead.className = 'ch2-overview-head';
    ovHead.setAttribute('aria-expanded', compactDefault ? 'false' : 'true');
    ovHead.innerHTML = `
      <span class="ch2-overview-title">
        <span class="ch2-badge">Unit III · 8 Syllabus Labs</span>
        <span>Quantum Mechanics Virtual Laboratory Index</span>
        <span class="ch2-overview-sub">Open any syllabus experiment directly</span>
      </span>
      <span class="ch2-overview-chev" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 5.25L7 8.75l3.5-3.5"/></svg>
      </span>`;

    const ovBody = el('div', 'ch2-overview-body');
    const ovGrid = el('div', 'ch3-overview-grid');
    CH3_SYLLABUS_MAP.forEach((item) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'ch2-ov-card' + (item.topicId === ch3State.activeTopic ? ' active' : '');
      card.dataset.topicId = item.topicId;
      card.dataset.preset = item.preset || '';
      card.innerHTML = `
        <span class="ch2-ov-num">UNIT ${item.num} · ${item.eq}</span>
        <span class="ch2-ov-name">${item.lab}</span>
        <span class="ch2-ov-lesson">${item.syllabus}</span>`;
      card.addEventListener('click', () => {
        jumpToTopicPreset(item.topicId, item.preset);
      });
      ch3State.overviewCards.push(card);
      ovGrid.append(card);
    });
    ovBody.append(ovGrid);
    ov.append(ovHead, ovBody);
    ov.style.display = 'none';
    mainEl.append(ov);
    ch3State.overviewEl = ov;

    if (!compactDefault) {
      requestAnimationFrame(() => {
        ovBody.style.maxHeight = ovBody.scrollHeight + 'px';
      });
    }
    ovHead.addEventListener('click', () => {
      const isOpen = ov.classList.toggle('open');
      ovHead.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      ovBody.style.maxHeight = isOpen ? ovBody.scrollHeight + 'px' : '0px';
    });

    // Build all 6 Chapter 3 Lesson Panels
    CH3_TOPICS.forEach((t) => {
      const panel = el('section', 'panel ch3-panel');
      panel.id = 'panel-' + t.id;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-label', t.title);
      panel.innerHTML = `
        <div class="panel-head">
          <div class="panel-head-row">
            <div>
              <h2>${t.title}</h2>
              <p>${t.desc}</p>
            </div>
            <div class="panel-head-actions">
              <button type="button" class="ch2-chip-btn primary" data-action="focus-lab">Interactive Lab</button>
              <button type="button" class="ch2-chip-btn" data-action="open-theory">Lesson Theory ↓</button>
            </div>
          </div>
        </div>
        <div class="workspace" id="ws-${t.id}">
          <div class="sim-grid">
            <div class="canvas-wrap" id="wrap-${t.id}">
              <div class="canvas-title">
                <span>${t.canvasTitle}</span>
                <span class="live-dot" id="dot-${t.id}">Live</span>
              </div>
              <div class="canvas-stage" id="stage-${t.id}"></div>
            </div>
            <div class="controls-pane">
              <div class="controls-head"><h3>Controls</h3></div>
              <div class="controls" id="controls-${t.id}"></div>
            </div>
          </div>
          <div class="formula-bar" id="formula-${t.id}"></div>
        </div>
        <div class="accordion" id="accordion-${t.id}">
          <button class="accordion-head" aria-expanded="false">
            <span class="acc-title">
              <span class="acc-icon" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 3.5h4a2 2 0 0 1 2 2v8a1.5 1.5 0 0 0-1.5-1.5h-4.5v-8.5zM13.5 3.5h-4a2 2 0 0 0-2 2v8a1.5 1.5 0 0 1 1.5-1.5h4.5v-8.5z"/></svg></span>
              <span>Theory &amp; Mathematical Notes — ${t.lesson}</span>
            </span>
            <span class="chev" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 5.25L7 8.75l3.5-3.5"/></svg></span>
          </button>
          <div class="accordion-body"><div class="accordion-body-inner">${CH3_THEORY[t.id]}</div></div>
        </div>`;

      mainEl.append(panel);
      ch3State.panels[t.id] = panel;

      const acc = panel.querySelector('.accordion');
      const accHead = acc.querySelector('.accordion-head');
      const accBody = acc.querySelector('.accordion-body');
      accHead.addEventListener('click', () => {
        const open = acc.classList.toggle('open');
        accHead.setAttribute('aria-expanded', open ? 'true' : 'false');
        accBody.style.maxHeight = open ? accBody.scrollHeight + 'px' : '0px';
      });

      panel.querySelector('[data-action="focus-lab"]').addEventListener('click', () => {
        const ws = panel.querySelector('.workspace');
        if (ws && ws.scrollIntoView) ws.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      });
      panel.querySelector('[data-action="open-theory"]').addEventListener('click', () => {
        if (!acc.classList.contains('open')) {
          acc.classList.add('open');
          accHead.setAttribute('aria-expanded', 'true');
          accBody.style.maxHeight = accBody.scrollHeight + 'px';
        }
        if (acc.scrollIntoView) acc.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
      });

      panel.querySelectorAll('.btn-lab-launch').forEach((btn) => {
        btn.addEventListener('click', () => {
          jumpToTopicPreset(t.id, btn.dataset.preset);
        });
      });

      panel.querySelectorAll('[data-jump-topic]').forEach((btn) => {
        btn.addEventListener('click', () => {
          jumpToTopicPreset(btn.dataset.jumpTopic, btn.dataset.jumpPreset);
        });
      });
    });
  }

  function renderPillBar() {
    const pillBar = document.getElementById('pillBar');
    pillBar.innerHTML = '';
    pillBar.setAttribute('aria-label', 'Unit III topics');
    CH3_TOPICS.forEach((t) => {
      const btn = window.XLab.el(
        'button',
        'pill' + (t.id === ch3State.activeTopic ? ' active' : ''),
        `<span class="pill-icon" aria-hidden="true">${CH3_ICONS[t.id]}</span><span>${t.name}</span>`
      );
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', t.id === ch3State.activeTopic ? 'true' : 'false');
      btn.setAttribute('aria-controls', 'panel-' + t.id);
      btn.tabIndex = t.id === ch3State.activeTopic ? 0 : -1;
      btn.dataset.topic = t.id;
      btn.addEventListener('click', () => switchTopic(t.id));
      pillBar.append(btn);
    });
  }

  function unmountCurrentSim() {
    const prevId = ch3State.mountedSimId;
    if (ch3State.mountedInstance && ch3State.mountedInstance.unmount) {
      try {
        ch3State.mountedInstance.unmount();
      } catch (err) {
        console.error(err);
      }
    }
    if (prevId) {
      const wrap = document.getElementById('wrap-' + prevId);
      const stage = document.getElementById('stage-' + prevId);
      const controls = document.getElementById('controls-' + prevId);
      const formula = document.getElementById('formula-' + prevId);
      if (wrap) wrap.querySelectorAll('.ch2-subtabs, .sim-banner, .ch3-deriv-box').forEach((n) => n.remove());
      if (stage) stage.innerHTML = '';
      if (controls) controls.innerHTML = '';
      if (formula) formula.innerHTML = '';
    }
    ch3State.mountedInstance = null;
    ch3State.mountedSimId = null;
  }

  function switchTopic(id) {
    const topic = CH3_TOPICS.find((t) => t.id === id) || CH3_TOPICS[0];
    ch3State.activeTopic = topic.id;

    CH3_TOPICS.forEach((t) => {
      const p = ch3State.panels[t.id];
      if (p) p.classList.toggle('active', ch3State.visible && t.id === topic.id);
    });
    ch3State.overviewCards.forEach((card) => {
      card.classList.toggle('active', card.dataset.topicId === topic.id);
    });

    const pillBar = document.getElementById('pillBar');
    pillBar.querySelectorAll('.pill').forEach((p) => {
      const on = p.dataset.topic === topic.id;
      p.classList.toggle('active', on);
      p.setAttribute('aria-selected', on ? 'true' : 'false');
      p.tabIndex = on ? 0 : -1;
    });
    const activePill = pillBar.querySelector('.pill.active');
    if (activePill && activePill.scrollIntoView) {
      activePill.scrollIntoView({ block: 'nearest', inline: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }

    if (!ch3State.visible) return;

    if (ch3State.mountedSimId !== topic.id) {
      unmountCurrentSim();
      const stage = document.getElementById('stage-' + topic.id);
      const controls = document.getElementById('controls-' + topic.id);
      const formula = document.getElementById('formula-' + topic.id);
      const wrap = document.getElementById('wrap-' + topic.id);
      if (stage) {
        stage.innerHTML = '<div style="height:420px;display:flex;align-items:center;justify-content:center;color:var(--text2);font-size:.86rem;">Loading quantum laboratory...</div>';
      }
      const token = ++ch3State.loadToken;
      loadSimModule(topic)
        .then((factory) => {
          if (!ch3State.visible || ch3State.activeTopic !== topic.id || token !== ch3State.loadToken) return;
          const inst = factory({
            topic,
            panel: ch3State.panels[topic.id],
            wrap,
            stage,
            controls,
            formula,
            dot: document.getElementById('dot-' + topic.id),
          });
          ch3State.mountedSimId = topic.id;
          ch3State.mountedInstance = inst;
          if (inst && inst.mount) inst.mount();
          if (ch3State.pendingPreset && ch3State.pendingPreset.id === topic.id) {
            const pending = ch3State.pendingPreset.preset;
            ch3State.pendingPreset = null;
            if (inst && inst.applyPreset) inst.applyPreset(pending);
          }
          if (inst && inst.resize) requestAnimationFrame(() => inst.resize());
        })
        .catch((err) => {
          console.error(err);
          if (stage) {
            stage.innerHTML = '<div style="height:360px;display:flex;align-items:center;justify-content:center;color:var(--warning);font-size:.86rem;padding:24px;text-align:center;">Unable to load simulation module (' + topic.file + ').</div>';
          }
        });
    } else if (ch3State.mountedInstance && ch3State.mountedInstance.resize) {
      requestAnimationFrame(() => ch3State.mountedInstance.resize());
    }
  }

  function handleKeydown(e) {
    if (!ch3State.visible) return false;
    const idx = CH3_TOPICS.findIndex((t) => t.id === ch3State.activeTopic);
    let next = null;
    if (e.key === 'ArrowRight') next = (idx + 1) % CH3_TOPICS.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + CH3_TOPICS.length) % CH3_TOPICS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = CH3_TOPICS.length - 1;
    if (next !== null) {
      e.preventDefault();
      switchTopic(CH3_TOPICS[next].id);
      const btn = document.querySelector('#pillBar .pill.active');
      if (btn) btn.focus();
      return true;
    }
    return false;
  }

  function mountChapter3() {
    buildChapter3DOM();
    ch3State.visible = true;
    if (ch3State.overviewEl) ch3State.overviewEl.style.display = 'block';
    const ovBody = ch3State.overviewEl && ch3State.overviewEl.querySelector('.ch2-overview-body');
    if (ovBody && ch3State.overviewEl.classList.contains('open')) {
      requestAnimationFrame(() => { ovBody.style.maxHeight = ovBody.scrollHeight + 'px'; });
    }
    renderPillBar();
    switchTopic(ch3State.activeTopic);
  }

  function unmountChapter3() {
    ch3State.visible = false;
    ch3State.loadToken++;
    unmountCurrentSim();
    if (ch3State.overviewEl) ch3State.overviewEl.style.display = 'none';
    CH3_TOPICS.forEach((t) => {
      const p = ch3State.panels[t.id];
      if (p) p.classList.remove('active');
    });
  }

  function tickChapter3(dt) {
    if (!ch3State.visible || !ch3State.mountedInstance) return;
    if (ch3State.mountedInstance.tick) ch3State.mountedInstance.tick(dt);
  }

  function resizeChapter3() {
    if (!ch3State.visible) return;
    const ovBody = ch3State.overviewEl && ch3State.overviewEl.querySelector('.ch2-overview-body');
    if (ovBody && ch3State.overviewEl.classList.contains('open')) {
      ovBody.style.maxHeight = ovBody.scrollHeight + 'px';
    }
    if (ch3State.mountedInstance && ch3State.mountedInstance.resize) {
      ch3State.mountedInstance.resize();
    }
  }

  window.Ch3Platform = {
    PHYSICS: CH3_PHYSICS,
    TOPICS: CH3_TOPICS,
    SYLLABUS_MAP: CH3_SYLLABUS_MAP,
    evToJ,
    jToEv,
    nmToEv,
    evToNm,
    spectrumColor,
    svgEl,
    prefersReducedMotion,
    buildTransport,
    buildActionRow,
    buildBanner,
    buildSubtabs,
    mount: mountChapter3,
    unmount: unmountChapter3,
    tick: tickChapter3,
    resize: resizeChapter3,
    handleKeydown,
    switchTopic,
    jumpToTopicPreset,
    getState: () => ch3State,
  };
})();
