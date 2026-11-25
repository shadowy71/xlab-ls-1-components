(function () {
  'use strict';

  /* ============================================================
     CHAPTER 5 (UNIT V): MAGNETISM & SUPERCONDUCTIVITY
     CODATA CONSTANTS & HELPERS
     ============================================================ */
  const H = 6.62607015e-34;          // Planck constant (J·s)
  const HBAR = H / (2 * Math.PI);    // Reduced Planck constant ħ (J·s)
  const C_LIGHT = 2.99792458e8;      // Speed of light (m/s)
  const E_CHARGE = 1.602176634e-19;  // Elementary charge (C)
  const K_B = 1.380649e-23;          // Boltzmann constant (J/K)
  const MU0 = 4 * Math.PI * 1e-7;    // Vacuum permeability (H/m)
  const PHI0 = H / (2 * E_CHARGE);   // Flux quantum h/2e ≈ 2.0678e-15 Wb

  const CH5_PHYSICS = {
    h: H,
    hbar: HBAR,
    c: C_LIGHT,
    e: E_CHARGE,
    kB: K_B,
    mu0: MU0,
    phi0: PHI0,
    josephsonFreqPerVolt: (2 * E_CHARGE) / H, // f = 2eV/h  [Hz/V] ≈ 4.836e14
  };

  function evToJ(ev) { return ev * E_CHARGE; }
  function jToEv(j) { return j / E_CHARGE; }

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
     CHAPTER 5 LESSON & SYLLABUS REGISTRY
     ============================================================ */
  const CH5_ICONS = {
    c5t1: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M7 1.5v11M7 1.5L4.5 4M7 1.5L9.5 4M7 12.5L4.5 10M7 12.5l2.5-2.5"/></svg>',
    c5t2: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12V2M2 12h10"/><path d="M3 10.5c2.5 0 2.5-7 5-7s2.5 7 3 7"/></svg>',
    c5t3: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="10" height="2.4"/><rect x="2" y="8.6" width="10" height="2.4"/><path d="M4 4.2h3M4 9.8h3"/></svg>',
    c5t4: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M7 1.5v11M2.5 4l9 6M11.5 4l-9 6"/></svg>',
    c5t5: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M7 1.5L12 4v3c0 3-2.2 4.6-5 5.5C4.2 11.6 2 10 2 7V4l5-2.5z"/></svg>',
    c5t6: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><circle cx="4" cy="7" r="1.6"/><circle cx="10" cy="7" r="1.6"/><path d="M5.6 7h2.8M4 4.5v5M10 4.5v5"/></svg>',
    c5t7: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="4" height="8"/><rect x="8" y="3" width="4" height="8"/><path d="M6 7h2"/></svg>',
    c5t8: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="4.5"/><path d="M7 2.5v9"/></svg>',
    c5t9: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M2 11h10M3 11V7h8v4M5 7V5h4v2"/></svg>',
  };

  const CH5_TOPICS = [
    {
      id: 'c5t1',
      file: 'sim1-magnetic-materials.js',
      name: 'Magnetic Materials',
      lesson: '5.1 Classification of Magnetic Materials & Curie/Néel Transitions',
      simName: 'Magnetic Materials Explorer',
      title: '5.1 Magnetic Materials Explorer — Dia / Para / Ferro / Antiferro / Ferrimagnetic & Temperature Transitions',
      desc: 'Classify five magnetic material types by their dipole response to an applied field, then sweep temperature through the Curie (Tc) and Néel (TN) transitions and watch spontaneous order disappear.',
      canvasTitle: 'Magnetic Dipole & Order-Parameter Laboratory',
      keyIdea: 'M = χH · Tc / TN order',
    },
    {
      id: 'c5t2',
      file: 'sim2-hysteresis.js',
      name: 'Hysteresis',
      lesson: '5.2 Magnetic Hysteresis Loop',
      simName: 'Hysteresis Laboratory',
      title: '5.2 Magnetic Hysteresis Laboratory — B–H Loop, Remanence, Coercivity & Energy Loss',
      desc: 'Sweep the applied field H through a full cycle and trace the B–H hysteresis loop in real time. Compare soft and hard magnets and measure loop area as energy dissipated per unit volume per cycle.',
      canvasTitle: 'B–H Hysteresis Loop & Domain Laboratory',
      keyIdea: '∮H dB = energy loss / volume / cycle',
    },
    {
      id: 'c5t3',
      file: 'sim3-gmr.js',
      name: 'GMR',
      lesson: '5.3 Giant Magnetoresistance (GMR)',
      simName: 'GMR Laboratory',
      title: '5.3 Giant Magnetoresistance Laboratory — Spin-Valve R(θ) = RP + (RAP−RP)(1−cosθ)/2',
      desc: 'Rotate one ferromagnetic layer relative to the other in an FM/NM/FM spin valve and watch the resistance change between the low parallel state and high antiparallel state.',
      canvasTitle: 'GMR Spin-Valve & Resistance Laboratory',
      keyIdea: 'R(θ) = RP + (RAP−RP)(1−cosθ)/2',
    },
    {
      id: 'c5t4',
      file: 'sim4-demagnetization.js',
      name: 'Demagnetization',
      lesson: '5.4 Adiabatic Demagnetization & Magnetocaloric Effect',
      simName: 'Adiabatic Demagnetization Lab',
      title: '5.4 Adiabatic Demagnetization Laboratory — Magnetic Cooling by Field Removal',
      desc: 'Magnetize a paramagnet isothermally, thermally isolate it, then remove the field adiabatically and watch the dipoles disorder as the temperature falls. Includes the syllabus magnetocaloric statement.',
      canvasTitle: 'Magnetic Cooling & Entropy Laboratory',
      keyIdea: 'Adiabatic: S = const, T falls as B falls',
    },
    {
      id: 'c5t5',
      file: 'sim5-superconductivity.js',
      name: 'Superconductivity',
      lesson: '5.5 Superconductivity, Meissner Effect & Critical Fields',
      simName: 'Superconductivity Lab',
      title: '5.5 Superconductivity & Meissner Effect Laboratory — Tc, Persistent Current, Flux Expulsion, Type I/II, Isotope Effect',
      desc: 'Cool a sample through Tc to zero resistance, sustain a persistent current, expel magnetic flux in the Meissner state, map Type I/II critical fields, and test the isotope relation Tc ∝ M^(−α).',
      canvasTitle: 'Superconductivity, Meissner & Critical-Field Laboratory',
      keyIdea: 'R = 0 below Tc · B = 0 inside (Meissner)',
    },
    {
      id: 'c5t6',
      file: 'sim6-bcs.js',
      name: 'BCS & Cooper Pairs',
      lesson: '5.6 BCS Theory & Cooper Pair Formation',
      simName: 'Cooper Pair Explorer',
      title: '5.6 BCS Theory & Cooper Pair Explorer — Phonon-Mediated Pairing & Energy Gap Δ(T)',
      desc: 'Watch an electron distort the lattice, a second electron feel the phonon-mediated attraction, and Cooper pairs condense below Tc. Track the BCS gap Δ(T) closing at Tc.',
      canvasTitle: 'Lattice, Phonon & Cooper-Pair Laboratory',
      keyIdea: 'Δ(0) = 1.76 kB Tc (BCS, conventional)',
    },
    {
      id: 'c5t7',
      file: 'sim7-josephson.js',
      name: 'Josephson',
      lesson: '5.7 Josephson Effect',
      simName: 'Josephson Junction Lab',
      title: '5.7 Josephson Effect Laboratory — DC I = Ic sinφ & AC f = 2eV/h',
      desc: 'Tune the phase difference φ across a Josephson junction for the DC supercurrent, then apply a voltage and watch the AC Josephson oscillation at f = 2eV/h.',
      canvasTitle: 'Josephson Junction: DC & AC Laboratory',
      keyIdea: 'I = Ic sinφ · f = 2eV/h',
    },
    {
      id: 'c5t8',
      file: 'sim8-squid.js',
      name: 'DC-SQUID',
      lesson: '5.8 DC-SQUID',
      simName: 'DC-SQUID Laboratory',
      title: '5.8 DC-SQUID Laboratory — Flux-Periodic Ic(Φ) = 2Ic0|cos(πΦ/Φ0)|, Φ0 = h/2e',
      desc: 'Build a superconducting loop with two Josephson junctions, then sweep magnetic flux and watch the critical current modulate periodically with period Φ0 = h/2e by interference of the two paths.',
      canvasTitle: 'DC-SQUID Construction & Flux-Interference Laboratory',
      keyIdea: 'Ic(Φ) = 2Ic0|cos(πΦ/Φ0)|',
    },
    {
      id: 'c5t9',
      file: 'sim9-applications.js',
      name: 'Applications',
      lesson: '5.9 Superconducting Magnets & Maglev Trains',
      simName: 'Applications Laboratory',
      title: '5.9 Superconducting Applications Laboratory — Persistent Magnets & Magnetic Levitation Trains',
      desc: 'Wind a superconducting coil into a persistent magnet, then levitate and guide a maglev train — including the flux-pinning mode where a Type II superconductor holds a magnet in stable position.',
      canvasTitle: 'Superconducting Magnets & Maglev Laboratory',
      keyIdea: 'Persistent B · levitation & guidance',
    },
  ];

  // Full 15-row syllabus index mapping directly into the 9 integrated laboratories
  const CH5_SYLLABUS_MAP = [
    { num: '5.1', syllabus: 'Classification of magnetic materials', lab: 'Magnetic Materials Explorer', topicId: 'c5t1', preset: 'diamagnetic', eq: 'Dia/Para/Ferro/Anti/Ferri' },
    { num: '5.2', syllabus: 'Curie & Néel temperatures', lab: 'Temperature Transition Lab', topicId: 'c5t1', preset: 'ferro-above', eq: 'Tc / TN order parameter' },
    { num: '5.3', syllabus: 'Magnetic hysteresis loop', lab: 'Hysteresis Laboratory', topicId: 'c5t2', preset: 'soft', eq: '∮H dB = loss' },
    { num: '5.4', syllabus: 'Giant magnetoresistance', lab: 'GMR Laboratory', topicId: 'c5t3', preset: 'parallel', eq: 'R(θ) spin valve' },
    { num: '5.5', syllabus: 'Magnetocaloric effect (statement)', lab: 'Magnetocaloric Note', topicId: 'c5t4', preset: 'stageA', eq: 'ΔT on B change' },
    { num: '5.6', syllabus: 'Adiabatic demagnetization', lab: 'Demagnetization Lab', topicId: 'c5t4', preset: 'stageB', eq: 'S = const cooling' },
    { num: '5.7', syllabus: 'Superconductivity & critical temperature', lab: 'Superconductivity Lab', topicId: 'c5t5', preset: 'transition', eq: 'R = 0 below Tc' },
    { num: '5.8', syllabus: 'Properties of superconductors', lab: 'Meissner / Persistent Lab', topicId: 'c5t5', preset: 'meissner', eq: 'Meissner B = 0' },
    { num: '5.9', syllabus: 'BCS theory', lab: 'Cooper Pair Explorer', topicId: 'c5t6', preset: 'below', eq: 'Δ(T) gap' },
    { num: '5.10', syllabus: 'Type I & II superconductors', lab: 'Critical-Field Lab', topicId: 'c5t5', preset: 'critical-type2', eq: 'Hc1 / Hc2 mixed state' },
    { num: '5.11', syllabus: 'Low Tc & high Tc superconductors', lab: 'Superconductor Comparison', topicId: 'c5t5', preset: 'comparison', eq: 'Illustrative Tc classes' },
    { num: '5.12', syllabus: 'Josephson effect', lab: 'Josephson Junction Lab', topicId: 'c5t7', preset: 'dc', eq: 'I = Ic sinφ' },
    { num: '5.13', syllabus: 'DC-SQUID', lab: 'DC-SQUID Lab', topicId: 'c5t8', preset: 'working', eq: 'Ic(Φ) period Φ0' },
    { num: '5.14', syllabus: 'Superconducting magnets', lab: 'Applications Lab', topicId: 'c5t9', preset: 'magnet', eq: 'Persistent B ∝ NI' },
    { num: '5.15', syllabus: 'Maglev trains', lab: 'Applications Lab', topicId: 'c5t9', preset: 'maglev', eq: 'Levitation & guidance' },
  ];

  const CH5_THEORY = {
    c5t1: `<ul>
      <li><b>Five magnetic classes:</b> <b>Diamagnetic</b> (induced moments oppose B, weak repulsion, χ &lt; 0 small), <b>Paramagnetic</b> (moments align with B against thermal agitation, weak attraction, χ &gt; 0, Curie law χ ∝ 1/T), <b>Ferromagnetic</b> (spontaneous domain order, strong M, hysteresis), <b>Antiferromagnetic</b> (antiparallel order with M ≈ 0 — ordered but net-zero, not disordered), <b>Ferrimagnetic</b> (opposing sublattices of unequal moment, net M ≠ 0).</li>
      <li><b>Curie temperature Tc:</b> below Tc a ferromagnet has spontaneous long-range order (M ≠ 0 at H = 0); above Tc the order is lost and it behaves paramagnetically.</li>
      <li><b>Néel temperature TN:</b> below TN an antiferromagnet has antiparallel long-range order (staggered order parameter L ≠ 0, net M ≈ 0); above TN the antiparallel order is lost and it behaves paramagnetically.</li>
      <li><b>Model note:</b> dipole patterns and M(T) curves are <b>illustrative phenomenological models</b> (order parameter ∝ √(1−T/Tc) below the transition, Curie-law susceptibility above). Tc/TN values are adjustable teaching parameters, not measured data for a named material.</li>
    </ul>
    <div class="theory-entry-row">
      <span class="theory-entry-label">Try in Lab ↑</span>
      <button type="button" class="btn-lab-launch" data-preset="diamagnetic">Diamagnetic (repulsion)</button>
      <button type="button" class="btn-lab-launch" data-preset="paramagnetic">Paramagnetic (alignment)</button>
      <button type="button" class="btn-lab-launch" data-preset="ferromagnetic">Ferromagnetic domains</button>
      <button type="button" class="btn-lab-launch" data-preset="antiferromagnetic">Antiferromagnetic order</button>
      <button type="button" class="btn-lab-launch" data-preset="ferrimagnetic">Ferrimagnetic sublattices</button>
      <button type="button" class="btn-lab-launch" data-preset="ferro-above">Above Tc → paramagnetic</button>
      <button type="button" class="btn-lab-launch" data-preset="afm-above">Above TN → paramagnetic</button>
    </div>`,

    c5t2: `<ul>
      <li><b>B–H loop:</b> B = μ₀(H + M). Sweeping H from +saturation to −saturation and back traces a closed loop because domain magnetization lags the field.</li>
      <li><b>Key points:</b> saturation flux density <b>Bs</b> (B at large |H|), remanence <b>Br</b> (B at H = 0 on the descending branch), coercivity <b>Hc</b> (H needed to bring B to zero).</li>
      <li><b>Energy loss:</b> the loop area <b>∮H dB</b> is the energy dissipated as heat per unit volume per complete cycle (J/m³/cycle). Narrow loop → low loss; wide loop → high loss.</li>
      <li><b>Soft vs hard:</b> soft magnets (low Hc, narrow loop, easy to magnetize/demagnetize, e.g. transformer cores) vs hard magnets (high Hc, wide loop, strong remanence, permanent magnets). The lab uses a <b>simplified tanh-branch phenomenological model</b>, not measured data.</li>
    </ul>
    <div class="theory-entry-row">
      <span class="theory-entry-label">Try in Lab ↑</span>
      <button type="button" class="btn-lab-launch" data-preset="soft">Soft magnet (narrow loop)</button>
      <button type="button" class="btn-lab-launch" data-preset="hard">Hard magnet (wide loop)</button>
      <button type="button" class="btn-lab-launch" data-preset="cycle">Run full cycle</button>
    </div>`,

    c5t3: `<ul>
      <li><b>Spin valve:</b> FM₁ / NM spacer / FM₂. Conduction electrons are spin-polarized by FM₁; whether they pass FM₂ depends on the relative magnetization angle θ.</li>
      <li><b>Parallel (θ = 0°):</b> low resistance <b>RP</b> (majority spins pass both layers). <b>Antiparallel (θ = 180°):</b> high resistance <b>RAP</b> (spins polarized by FM₁ are scattered by FM₂).</li>
      <li><b>Phenomenological law:</b> <b>R(θ) = RP + (RAP − RP)(1 − cosθ)/2</b>. This interpolates the two limits; it is <b>not</b> a full microscopic transport calculation.</li>
      <li><b>Why it matters:</b> GMR read heads detect the tiny stray field of a recorded bit as a resistance change; the same physics underlies magnetic sensors and position encoders.</li>
    </ul>
    <div class="theory-entry-row">
      <span class="theory-entry-label">Try in Lab ↑</span>
      <button type="button" class="btn-lab-launch" data-preset="parallel">Parallel (low R)</button>
      <button type="button" class="btn-lab-launch" data-preset="antiparallel">Antiparallel (high R)</button>
      <button type="button" class="btn-lab-launch" data-preset="perpendicular">Perpendicular (θ = 90°)</button>
    </div>`,

    c5t4: `<ul>
      <li><b>Stage A — Isothermal magnetization:</b> apply B while the sample stays in thermal contact with a reservoir. Dipoles align, magnetic entropy falls, and the released heat flows to the reservoir at (nearly) constant T.</li>
      <li><b>Stage B — Adiabatic demagnetization:</b> thermally isolate the sample (S ≈ const), then reduce B. Dipoles disorder, magnetic entropy rises back, and the sample cools — for an ideal paramagnet T ∝ B at constant S.</li>
      <li><b>Magnetocaloric effect (syllabus statement only):</b> the magnetocaloric effect is a temperature change associated with applying or removing a magnetic field under suitable thermodynamic conditions (adiabatic ΔT or isothermal ΔS). No separate magnetocaloric simulation is provided, per the syllabus scope.</li>
      <li><b>Model note:</b> conceptual thermodynamic model (alignment ∝ tanh(μB/kT), T ∝ B at constant S) unless a validated material-specific model is used.</li>
    </ul>
    <div class="theory-entry-row">
      <span class="theory-entry-label">Try in Lab ↑</span>
      <button type="button" class="btn-lab-launch" data-preset="stageA">Stage A: Isothermal magnetization</button>
      <button type="button" class="btn-lab-launch" data-preset="stageB">Stage B: Adiabatic demagnetization</button>
    </div>`,

    c5t5: `<ul>
      <li><b>Zero resistance:</b> below Tc the ideal resistance is zero; a current in a closed superconducting ring persists without applied voltage (persistent current). Practical devices still have joints, flux motion and measurement limits — the lab shows the ideal model and labels it as such.</li>
      <li><b>Meissner effect ≠ zero resistance:</b> a superconductor cooled in a field <b>expels</b> flux from its bulk (B ≈ 0 inside). Flux pinning is different: in Type II materials vortices are trapped and pinned, giving stable levitation and hysteresis.</li>
      <li><b>Critical field:</b> Type I has a single boundary Hc(T); Type II has Hc1 (Meissner → mixed/vortex state) and Hc2 (mixed → normal). The lab never uses one model for both types.</li>
      <li><b>Isotope effect:</b> conventionally <b>Tc ∝ M^(−α)</b> (M = isotopic mass, α = isotope exponent). This is a useful conventional relation, not universally exact for every superconductor.</li>
      <li><b>Low-Tc vs high-Tc:</b> qualitative classes only (illustrative Tc values). Low-Tc needs liquid-helium temperatures; high-Tc can operate above liquid-nitrogen temperature. No invented material performance data.</li>
    </ul>
    <div class="theory-entry-row">
      <span class="theory-entry-label">Try in Lab ↑</span>
      <button type="button" class="btn-lab-launch" data-preset="transition">R–T transition</button>
      <button type="button" class="btn-lab-launch" data-preset="persistent">Persistent current</button>
      <button type="button" class="btn-lab-launch" data-preset="meissner">Meissner &amp; levitation</button>
      <button type="button" class="btn-lab-launch" data-preset="critical-type2">Type II Hc1/Hc2</button>
      <button type="button" class="btn-lab-launch" data-preset="comparison">Low-Tc vs high-Tc</button>
    </div>`,

    c5t6: `<ul>
      <li><b>BCS picture (conventional superconductors):</b> an electron distorts the lattice; the phonon field mediates an <b>effective attraction</b> between two electrons near the Fermi surface (opposite momenta, singlet spin). This is <b>not</b> direct magnetic attraction between electrons.</li>
      <li><b>Cooper pairs &amp; condensate:</b> below Tc the pairs form a coherent condensate that carries current without resistance. The pair fraction grows as T falls below Tc.</li>
      <li><b>Energy gap:</b> BCS predicts a gap Δ(T) around the Fermi level with <b>Δ(0) = 1.76 kB Tc</b> (weak coupling) and Δ(T) ≈ Δ(0)·tanh[1.74√(Tc/T − 1)]. The gap closes at Tc. The gap is why low-energy excitations are suppressed.</li>
      <li><b>Scope:</b> this is a simplified visualization of <b>conventional BCS theory</b>. Conventional BCS does not fully explain every high-Tc superconductor; high-Tc pairing mechanisms remain an active research topic.</li>
    </ul>
    <div class="theory-entry-row">
      <span class="theory-entry-label">Try in Lab ↑</span>
      <button type="button" class="btn-lab-launch" data-preset="below">Well below Tc (pairs)</button>
      <button type="button" class="btn-lab-launch" data-preset="near">Near Tc (gap closing)</button>
      <button type="button" class="btn-lab-launch" data-preset="above">Above Tc (normal)</button>
    </div>`,

    c5t7: `<ul>
      <li><b>DC Josephson effect:</b> with V = 0 across the junction, a supercurrent <b>I = Ic sinφ</b> flows, set by the phase difference φ. No voltage, no dissipation (ideal).</li>
      <li><b>AC Josephson effect:</b> with a constant voltage V, the phase evolves as dφ/dt = 2eV/ħ and the current oscillates at <b>f = 2eV/h</b> (≈ 483.6 GHz per mV). The frequency is a direct measure of V.</li>
      <li><b>Distinction:</b> DC = V = 0, steady I(φ); AC = V ≠ 0, I(t) oscillates. Both come from the same junction.</li>
    </ul>
    <div class="theory-entry-row">
      <span class="theory-entry-label">Try in Lab ↑</span>
      <button type="button" class="btn-lab-launch" data-preset="dc">DC mode (I = Ic sinφ)</button>
      <button type="button" class="btn-lab-launch" data-preset="ac">AC mode (f = 2eV/h)</button>
    </div>`,

    c5t8: `<ul>
      <li><b>Construction:</b> two Josephson junctions in parallel inside a superconducting loop. Bias current splits between the two arms; the phase drops differ by the flux through the loop.</li>
      <li><b>Interference:</b> the two supercurrent paths interfere. For a symmetric SQUID the effective critical current is <b>Ic(Φ) = 2Ic0|cos(πΦ/Φ0)|</b>, periodic in the flux quantum <b>Φ0 = h/2e ≈ 2.07×10⁻¹⁵ Wb</b>.</li>
      <li><b>Operation:</b> bias the SQUID just below Ic(Φ); a tiny flux change moves Ic and switches the device between superconducting (V = 0) and resistive (V ≠ 0). That switching is the readout.</li>
      <li><b>Applications:</b> because Ic depends on Φ, a SQUID is an extremely sensitive magnetometer — used for weak biomagnetic signals, geophysics, and fundamental physics measurements. The sensitivity comes directly from the Ic(Φ) modulation simulated here.</li>
    </ul>
    <div class="theory-entry-row">
      <span class="theory-entry-label">Try in Lab ↑</span>
      <button type="button" class="btn-lab-launch" data-preset="construction">Construction mode</button>
      <button type="button" class="btn-lab-launch" data-preset="working">Working mode</button>
      <button type="button" class="btn-lab-launch" data-preset="max">Maximum Ic (Φ = 0)</button>
      <button type="button" class="btn-lab-launch" data-preset="min">Minimum Ic (Φ = Φ0/2)</button>
    </div>`,

    c5t9: `<ul>
      <li><b>Superconducting magnets:</b> a coil in the superconducting state carries persistent current with (ideally) no resistive loss, sustaining a strong field B ∝ NI (simplified, labelled). Used in MRI and research magnets. Real magnets need quench protection and cryogenics — the lab shows the operating principle, not a full magnet design.</li>
      <li><b>Maglev:</b> magnetic levitation + guidance can support a train with no mechanical contact. The lab shows two simplified modes: <b>Meissner repulsion</b> (flux expulsion) and <b>flux pinning</b> (Type II vortices pinned, magnet held in stable position).</li>
      <li><b>Important:</b> real maglev systems use different arrangements (electromagnetic suspension, electrodynamic suspension, superconducting). Not every maglev train uses the exact mechanism shown here.</li>
    </ul>
    <div class="theory-entry-row">
      <span class="theory-entry-label">Try in Lab ↑</span>
      <button type="button" class="btn-lab-launch" data-preset="magnet">Superconducting magnet</button>
      <button type="button" class="btn-lab-launch" data-preset="maglev">Maglev train</button>
      <button type="button" class="btn-lab-launch" data-preset="pinning">Flux-pinning mode</button>
    </div>`,
  };

  /* ============================================================
     REUSABLE CHAPTER 5 CONTROL BUILDERS
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
     LAZY MODULE LOADER & CHAPTER 5 MANAGER
     ============================================================ */
  window.CH5_SIMS = window.CH5_SIMS || {};
  const scriptPromises = {};

  function loadSimModule(topic) {
    if (window.CH5_SIMS[topic.id]) {
      return Promise.resolve(window.CH5_SIMS[topic.id]);
    }
    if (scriptPromises[topic.id]) return scriptPromises[topic.id];
    scriptPromises[topic.id] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'src/ch5/' + topic.file;
      s.async = true;
      s.onload = () => {
        if (window.CH5_SIMS[topic.id]) resolve(window.CH5_SIMS[topic.id]);
        else reject(new Error('Chapter 5 simulation did not register: ' + topic.id));
      };
      s.onerror = () => reject(new Error('Failed to load src/ch5/' + topic.file));
      document.head.appendChild(s);
    });
    return scriptPromises[topic.id];
  }

  const ch5State = {
    built: false,
    visible: false,
    activeTopic: 'c5t1',
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
      if (ch5State.mountedSimId === topicId && ch5State.mountedInstance && ch5State.mountedInstance.applyPreset) {
        ch5State.mountedInstance.applyPreset(preset);
      } else {
        ch5State.pendingPreset = { id: topicId, preset };
      }
    }
    switchTopic(topicId);
    const panel = ch5State.panels[topicId];
    if (panel) {
      const ws = panel.querySelector('.workspace');
      if (ws && ws.scrollIntoView) {
        ws.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      }
    }
  }

  function buildChapter5DOM() {
    if (ch5State.built) return;
    ch5State.built = true;

    const mainEl = document.getElementById('main');
    const el = window.XLab.el;

    // Collapsible 15-Topic Syllabus Index linking straight to every Simulation & Sub-lab
    const ov = el('section', 'ch5-overview');
    ov.id = 'ch5Overview';
    ov.setAttribute('aria-label', 'Unit V Magnetism and Superconductivity Syllabus Index');
    const compactDefault = window.innerWidth <= 768;
    if (!compactDefault) ov.classList.add('open');

    const ovHead = document.createElement('button');
    ovHead.type = 'button';
    ovHead.className = 'ch2-overview-head';
    ovHead.setAttribute('aria-expanded', compactDefault ? 'false' : 'true');
    ovHead.innerHTML = `
      <span class="ch2-overview-title">
        <span class="ch2-badge">Unit V · 15 Syllabus Labs</span>
        <span>Magnetism &amp; Superconductivity Virtual Laboratory Index</span>
        <span class="ch2-overview-sub">Open any syllabus experiment directly</span>
      </span>
      <span class="ch2-overview-chev" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 5.25L7 8.75l3.5-3.5"/></svg>
      </span>`;

    const ovBody = el('div', 'ch2-overview-body');
    const ovGrid = el('div', 'ch5-overview-grid');
    CH5_SYLLABUS_MAP.forEach((item) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'ch2-ov-card' + (item.topicId === ch5State.activeTopic ? ' active' : '');
      card.dataset.topicId = item.topicId;
      card.dataset.preset = item.preset || '';
      card.innerHTML = `
        <span class="ch2-ov-num">UNIT ${item.num} · ${item.eq}</span>
        <span class="ch2-ov-name">${item.lab}</span>
        <span class="ch2-ov-lesson">${item.syllabus}</span>`;
      card.addEventListener('click', () => {
        jumpToTopicPreset(item.topicId, item.preset);
      });
      ch5State.overviewCards.push(card);
      ovGrid.append(card);
    });
    ovBody.append(ovGrid);
    ov.append(ovHead, ovBody);
    ov.style.display = 'none';
    mainEl.append(ov);
    ch5State.overviewEl = ov;

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

    // Build all 9 Chapter 5 Lesson Panels
    CH5_TOPICS.forEach((t) => {
      const panel = el('section', 'panel ch5-panel');
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
          <div class="accordion-body"><div class="accordion-body-inner">${CH5_THEORY[t.id]}</div></div>
        </div>`;

      mainEl.append(panel);
      ch5State.panels[t.id] = panel;

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
    });
  }

  function renderPillBar() {
    const pillBar = document.getElementById('pillBar');
    pillBar.innerHTML = '';
    pillBar.setAttribute('aria-label', 'Unit V topics');
    CH5_TOPICS.forEach((t) => {
      const btn = window.XLab.el(
        'button',
        'pill' + (t.id === ch5State.activeTopic ? ' active' : ''),
        `<span class="pill-icon" aria-hidden="true">${CH5_ICONS[t.id]}</span><span>${t.name}</span>`
      );
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', t.id === ch5State.activeTopic ? 'true' : 'false');
      btn.setAttribute('aria-controls', 'panel-' + t.id);
      btn.tabIndex = t.id === ch5State.activeTopic ? 0 : -1;
      btn.dataset.topic = t.id;
      btn.addEventListener('click', () => switchTopic(t.id));
      pillBar.append(btn);
    });
  }

  function unmountCurrentSim() {
    const prevId = ch5State.mountedSimId;
    if (ch5State.mountedInstance && ch5State.mountedInstance.unmount) {
      try {
        ch5State.mountedInstance.unmount();
      } catch (err) {
        console.error(err);
      }
    }
    if (prevId) {
      const wrap = document.getElementById('wrap-' + prevId);
      const stage = document.getElementById('stage-' + prevId);
      const controls = document.getElementById('controls-' + prevId);
      const formula = document.getElementById('formula-' + prevId);
      if (wrap) wrap.querySelectorAll('.ch2-subtabs, .sim-banner, .ch5-deriv-box').forEach((n) => n.remove());
      if (stage) stage.innerHTML = '';
      if (controls) controls.innerHTML = '';
      if (formula) formula.innerHTML = '';
    }
    ch5State.mountedInstance = null;
    ch5State.mountedSimId = null;
  }

  function switchTopic(id) {
    const topic = CH5_TOPICS.find((t) => t.id === id) || CH5_TOPICS[0];
    ch5State.activeTopic = topic.id;

    CH5_TOPICS.forEach((t) => {
      const p = ch5State.panels[t.id];
      if (p) p.classList.toggle('active', ch5State.visible && t.id === topic.id);
    });
    ch5State.overviewCards.forEach((card) => {
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

    if (!ch5State.visible) return;

    if (ch5State.mountedSimId !== topic.id) {
      unmountCurrentSim();
      const stage = document.getElementById('stage-' + topic.id);
      const controls = document.getElementById('controls-' + topic.id);
      const formula = document.getElementById('formula-' + topic.id);
      const wrap = document.getElementById('wrap-' + topic.id);
      if (stage) {
        stage.innerHTML = '<div style="height:420px;display:flex;align-items:center;justify-content:center;color:var(--text2);font-size:.86rem;">Loading magnetism laboratory...</div>';
      }
      const token = ++ch5State.loadToken;
      loadSimModule(topic)
        .then((factory) => {
          if (!ch5State.visible || ch5State.activeTopic !== topic.id || token !== ch5State.loadToken) return;
          const inst = factory({
            topic,
            panel: ch5State.panels[topic.id],
            wrap,
            stage,
            controls,
            formula,
            dot: document.getElementById('dot-' + topic.id),
          });
          ch5State.mountedSimId = topic.id;
          ch5State.mountedInstance = inst;
          if (inst && inst.mount) inst.mount();
          if (ch5State.pendingPreset && ch5State.pendingPreset.id === topic.id) {
            const pending = ch5State.pendingPreset.preset;
            ch5State.pendingPreset = null;
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
    } else if (ch5State.mountedInstance && ch5State.mountedInstance.resize) {
      requestAnimationFrame(() => ch5State.mountedInstance.resize());
    }
  }

  function handleKeydown(e) {
    if (!ch5State.visible) return false;
    const idx = CH5_TOPICS.findIndex((t) => t.id === ch5State.activeTopic);
    let next = null;
    if (e.key === 'ArrowRight') next = (idx + 1) % CH5_TOPICS.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + CH5_TOPICS.length) % CH5_TOPICS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = CH5_TOPICS.length - 1;
    if (next !== null) {
      e.preventDefault();
      switchTopic(CH5_TOPICS[next].id);
      const btn = document.querySelector('#pillBar .pill.active');
      if (btn) btn.focus();
      return true;
    }
    return false;
  }

  function mountChapter5() {
    buildChapter5DOM();
    ch5State.visible = true;
    if (ch5State.overviewEl) ch5State.overviewEl.style.display = 'block';
    const ovBody = ch5State.overviewEl && ch5State.overviewEl.querySelector('.ch2-overview-body');
    if (ovBody && ch5State.overviewEl.classList.contains('open')) {
      requestAnimationFrame(() => { ovBody.style.maxHeight = ovBody.scrollHeight + 'px'; });
    }
    renderPillBar();
    switchTopic(ch5State.activeTopic);
  }

  function unmountChapter5() {
    ch5State.visible = false;
    ch5State.loadToken++;
    unmountCurrentSim();
    if (ch5State.overviewEl) ch5State.overviewEl.style.display = 'none';
    CH5_TOPICS.forEach((t) => {
      const p = ch5State.panels[t.id];
      if (p) p.classList.remove('active');
    });
  }

  function tickChapter5(dt) {
    if (!ch5State.visible || !ch5State.mountedInstance) return;
    if (ch5State.mountedInstance.tick) ch5State.mountedInstance.tick(dt);
  }

  function resizeChapter5() {
    if (!ch5State.visible) return;
    const ovBody = ch5State.overviewEl && ch5State.overviewEl.querySelector('.ch2-overview-body');
    if (ovBody && ch5State.overviewEl.classList.contains('open')) {
      ovBody.style.maxHeight = ovBody.scrollHeight + 'px';
    }
    if (ch5State.mountedInstance && ch5State.mountedInstance.resize) {
      ch5State.mountedInstance.resize();
    }
  }

  window.Ch5Platform = {
    PHYSICS: CH5_PHYSICS,
    TOPICS: CH5_TOPICS,
    SYLLABUS_MAP: CH5_SYLLABUS_MAP,
    evToJ,
    jToEv,
    svgEl,
    prefersReducedMotion,
    buildTransport,
    buildActionRow,
    buildBanner,
    buildSubtabs,
    mount: mountChapter5,
    unmount: unmountChapter5,
    tick: tickChapter5,
    resize: resizeChapter5,
    handleKeydown,
    switchTopic,
    jumpToTopicPreset,
    getState: () => ch5State,
  };
})();
