(function () {
  'use strict';

  /* ============================================================
     CHAPTER 2: PHYSICS CONSTANTS & OPTICAL HELPERS
     ============================================================ */
  const CH2_PHYSICS = {
    h: 6.62607015e-34,       // J·s
    c: 2.99792458e8,         // m/s
    e: 1.602176634e-19,      // C
    k_B: 1.380649e-23,       // J/K
    k_B_eV: 8.61733326e-5,   // eV/K
    hc_eV_nm: (6.62607015e-34 * 2.99792458e8 / 1.602176634e-19) * 1e9, // ~1239.842 eV·nm
    degToRad: Math.PI / 180,
    radToDeg: 180 / Math.PI,
  };

  function nmToEv(nm) {
    return CH2_PHYSICS.hc_eV_nm / Math.max(nm, 1);
  }
  function evToNm(ev) {
    return CH2_PHYSICS.hc_eV_nm / Math.max(ev, 0.01);
  }
  function nmToTHz(nm) {
    return (CH2_PHYSICS.c / (Math.max(nm, 1) * 1e-9)) * 1e-12;
  }

  // Smooth visible + UV/IR indicator color helper
  function spectrumColor(nm, alpha) {
    const a = alpha === undefined ? 1 : alpha;
    let r = 0, g = 0, b = 0;
    if (nm < 380) {
      r = 0.65; g = 0.35; b = 1.0; // UV false-color violet
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
      // Near/Far IR false-color crimson indicator
      r = 0.92; g = 0.22; b = 0.28;
    }
    const edge = (nm >= 380 && nm < 420)
      ? 0.45 + 0.55 * (nm - 380) / 40
      : (nm > 700 && nm <= 740)
        ? 0.45 + 0.55 * (740 - nm) / 40
        : 1.0;
    return `rgba(${Math.round(255 * r * edge)},${Math.round(255 * g * edge)},${Math.round(255 * b * edge)},${a})`;
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
     CHAPTER 2 LESSON & SIMULATION REGISTRY
     ============================================================ */
  const CH2_ICONS = {
    c2t1: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M2 11h10M2 3h10"/><path d="M7 10.5V3.5M5.2 5.3L7 3.5l1.8 1.8"/></svg>',
    c2t2: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3v8M9.5 3v8"/><path d="M2 7h10.5"/><path d="M9.5 7l2-1.4M9.5 7l2 1.4"/></svg>',
    c2t3: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2.5" width="10" height="9" rx="1"/><path d="M2 5.5h10M2 8.5h10"/><path d="M12 7h1.5"/></svg>',
    c2t4: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="1.8"/><circle cx="2.6" cy="7" r="1.2"/><circle cx="11.4" cy="7" r="1.2"/><path d="M3.8 7h1.4M8.8 7h1.4"/></svg>',
    c2t5: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M2 11L7 2.5L12 11z"/><path d="M4.5 11L7 6.5 9.5 11"/></svg>',
    c2t6: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 3.5h11M1.5 10.5h11"/><path d="M1.5 8.5L5 3.5l4 7 3.5-5"/></svg>',
    c2t7: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 9.5h2v-5h2.2v5h2.2v-3h2.2v3h2.4"/></svg>',
  };

  const CH2_TOPICS = [
    {
      id: 'c2t1',
      file: 'sim1-photon-atom.js',
      name: 'Light–Matter',
      lesson: '2.1 Interaction of Light with Matter',
      simName: 'Photon–Atom Interaction Lab',
      title: '2.1 Interaction of Light with Matter — Photon–Atom Laboratory',
      desc: 'Experiment with Absorption, Spontaneous Emission, and Stimulated Emission across atomic energy levels E₁ and E₂.',
      canvasTitle: 'Photon–Atom Interaction Laboratory',
      keyIdea: 'ΔE = E₂ − E₁ = hν = hc/λ',
    },
    {
      id: 'c2t2',
      file: 'sim2-laser-builder.js',
      name: 'LASER Builder',
      lesson: '2.2 Population Inversion & LASER Principle',
      simName: 'Build Your Own LASER',
      title: '2.2 Population Inversion & Working Principle — Build Your Own LASER',
      desc: 'Pump atoms into a metastable state, achieve population inversion (N₂ > N₁), amplify photons in an optical resonator, and compare LASER light with ordinary light.',
      canvasTitle: 'LASER Construction & Resonator Laboratory',
      keyIdea: 'N₂ > N₁ & Optical Gain',
    },
    {
      id: 'c2t3',
      file: 'sim3-heterojunction-laser.js',
      name: 'Heterojunction',
      lesson: '2.3 Semiconductor Heterojunction LASER',
      simName: 'Heterojunction Laser Lab',
      title: '2.3 Semiconductor Heterojunction LASER — GaAs / GaAlAs Double Heterostructure',
      desc: 'Adjust forward bias to inject electrons and holes into the GaAs active layer, observe carrier and optical confinement, and compare homojunction vs. heterojunction lasers.',
      canvasTitle: 'Double Heterojunction Cross-Section & Energy Bands',
      keyIdea: 'Carrier & Optical Confinement',
    },
    {
      id: 'c2t4',
      file: 'sim4-co2-laser.js',
      name: 'CO₂ LASER',
      lesson: '2.4 Carbon Dioxide (CO₂) LASER',
      simName: 'CO₂ LASER Working Simulator',
      title: '2.4 Carbon Dioxide (CO₂) LASER — Four-Level Molecular Simulator',
      desc: 'Trace electrical discharge excitation of N₂, resonant collisional energy transfer to CO₂, He thermal relaxation, molecular vibrations, and 10.6 μm laser emission.',
      canvasTitle: 'CO₂–N₂–He Discharge Tube & Molecular Levels',
      keyIdea: 'E₅ → E₄ (10.6 μm IR)',
    },
    {
      id: 'c2t5',
      file: 'sim5-holography.js',
      name: 'Holography',
      lesson: '2.5 Introduction to Holography',
      simName: 'Holography Laboratory',
      title: '2.5 Introduction to Holography — Recording & Reconstruction Lab',
      desc: 'Split a coherent laser beam into object and reference beams to record interference fringes, then illuminate the hologram to reconstruct a 3D virtual image.',
      canvasTitle: 'Two-Stage Holography & Fringe Interference Lab',
      keyIdea: 'Amplitude + Phase Recording',
    },
    {
      id: 'c2t6',
      file: 'sim6-fibre-ray.js',
      name: 'Fibre Ray Lab',
      lesson: '2.6 Propagation of Light in Optical Fibres',
      simName: 'Optical Fibre Ray Laboratory',
      title: '2.6 Propagation of Light in Optical Fibres — TIR, Acceptance Angle & Fibre Types',
      desc: 'Vary core/cladding refractive indices and launch angles to test Total Internal Reflection, Acceptance Cone, Numerical Aperture, and Step-Index vs. Graded-Index propagation.',
      canvasTitle: 'Optical Fibre Cross-Section & Ray Tracing Lab',
      keyIdea: 'θc = sin⁻¹(n₂/n₁), NA = √(n₁²−n₂²)',
    },
    {
      id: 'c2t7',
      file: 'sim7-fibre-comm.js',
      name: 'Fibre Comms',
      lesson: '2.7 Attenuation, Dispersion & Fibre Communication',
      simName: 'Fibre Communication Lab',
      title: '2.7 Attenuation, Dispersion & Optical Fibre Communication Laboratory',
      desc: 'Measure optical power loss, Rayleigh 1/λ⁴ scattering, pulse broadening across dispersion mechanisms, and transmit live binary sequences through a full fibre link.',
      canvasTitle: 'Optical Fibre Losses, Dispersion & Link Pipeline',
      keyIdea: '10 log₁₀(Pin/Pout) & Pulse Spreading',
    },
  ];

  const CH2_THEORY = {
    c2t1: `<ul>
      <li><b>Absorption of Radiation:</b> An atom initially in ground state E<sub>1</sub> absorbs an incident photon only when photon energy matches the level gap: <b>hν = E<sub>2</sub> − E<sub>1</sub></b>. The photon disappears and the electron transitions to E<sub>2</sub>.</li>
      <li><b>Spontaneous Emission:</b> An atom in excited state E<sub>2</sub> decays on its own after a finite lifetime to E<sub>1</sub>, emitting a photon of energy <b>hν = E<sub>2</sub> − E<sub>1</sub></b> with a <b>random direction and random phase</b> (incoherent light).</li>
      <li><b>Stimulated Emission (Einstein):</b> An incident photon of matching energy <b>hν = E<sub>2</sub> − E<sub>1</sub></b> interacts with an already excited atom and triggers its transition E<sub>2</sub> → E<sub>1</sub>, producing a <b>second photon identical</b> in frequency, phase, direction, and polarization — the physical basis of optical amplification.</li>
      <li><b>Fundamental Energy Relation:</b> <b>ΔE = E<sub>2</sub> − E<sub>1</sub> = hν = hc/λ</b>. Off-resonance photons pass without resonant absorption or stimulated emission.</li>
    </ul>
    <div class="theory-entry-row">
      <span class="theory-entry-label">Try in Lab ↑</span>
      <button type="button" class="btn-lab-launch" data-preset="absorption">A. Resonant Absorption</button>
      <button type="button" class="btn-lab-launch" data-preset="spontaneous">B. Spontaneous Emission</button>
      <button type="button" class="btn-lab-launch" data-preset="stimulated">C. Stimulated Emission</button>
    </div>`,

    c2t2: `<ul>
      <li><b>Active Medium & Pumping:</b> An active medium supplies atomic energy levels for amplification, while an external <b>pump</b> (optical, electrical, or chemical) excites atoms from lower state E<sub>1</sub> into higher pump level E<sub>3</sub>.</li>
      <li><b>Role of the Metastable State (E<sub>2</sub>):</b> Atoms excited to E<sub>3</sub> rapidly relax non-radiatively into an intermediate <b>metastable state E<sub>2</sub></b> whose lifetime (ms) is orders of magnitude longer than ordinary excited states (ns). Without a long-lived metastable state, atoms decay back before accumulating.</li>
      <li><b>Why Population Inversion (N<sub>2</sub> &gt; N<sub>1</sub>) is Essential:</b> In thermal equilibrium, N<sub>1</sub> &gt; N<sub>2</sub> (Boltzmann distribution), so absorption dominates over stimulated emission. Pumping must invert the population so <b>N<sub>2</sub> &gt; N<sub>1</sub></b>, ensuring net optical amplification.</li>
      <li><b>Optical Resonator:</b> Two parallel mirrors — one fully reflecting (R<sub>1</sub> ≈ 100%) and one partially reflecting output coupler (R<sub>2</sub>) — trap axial photons for multiple amplification passes until coherent laser light emerges through the partial mirror.</li>
      <li><b>Properties of LASER vs. Ordinary Light:</b> Extreme <b>Monochromaticity</b> (narrow Δλ), spatial &amp; temporal <b>Coherence</b> (locked phase), tight <b>Directionality</b> (minimal divergence), and <b>High Intensity</b>.</li>
    </ul>
    <div class="theory-entry-row">
      <span class="theory-entry-label">Try in Lab ↑</span>
      <button type="button" class="btn-lab-launch" data-preset="cavity-lasing">Achieve Lasing Threshold</button>
      <button type="button" class="btn-lab-launch" data-preset="short-lifetime">Test Short Metastable Lifetime</button>
      <button type="button" class="btn-lab-launch" data-preset="compare-lights">Compare Ordinary vs. LASER Light</button>
    </div>`,

    c2t3: `<ul>
      <li><b>Double Heterojunction Structure:</b> A thin <b>GaAs</b> active layer (narrower bandgap E<sub>g</sub> ≈ 1.43 eV, higher refractive index n ≈ 3.59) is sandwiched between wider-bandgap, lower-index <b>P-type GaAlAs</b> and <b>N-type GaAlAs</b> cladding layers.</li>
      <li><b>Carrier Confinement:</b> Under forward bias, electrons from N-GaAlAs and holes from P-GaAlAs inject into the GaAs active layer. The heterojunction potential barriers (ΔE<sub>C</sub> and ΔE<sub>V</sub>) trap both carriers inside the narrow active region, concentrating recombination.</li>
      <li><b>Optical Confinement:</b> Because n<sub>GaAs</sub> &gt; n<sub>GaAlAs</sub>, the active layer acts as a dielectric slab waveguide that confines generated photons via total internal reflection along the junction plane.</li>
      <li><b>Cleaved Optical Resonator:</b> The two opposite crystal end faces are cleaved and polished parallel to form natural reflecting facets, supporting stimulated emission and producing a near-infrared laser beam (λ ≈ 867 nm for GaAs).</li>
      <li><b>Homojunction vs. Heterojunction:</b> Homojunction lasers (p-GaAs/n-GaAs) suffer wide carrier diffusion and optical loss into surrounding material, requiring huge threshold current densities; double heterojunctions cut threshold dramatically for continuous room-temperature operation.</li>
    </ul>
    <div class="theory-entry-row">
      <span class="theory-entry-label">Try in Lab ↑</span>
      <button type="button" class="btn-lab-launch" data-preset="zero-bias">Zero Bias Barrier (0 V)</button>
      <button type="button" class="btn-lab-launch" data-preset="led-regime">LED Sub-Threshold (1.25 V)</button>
      <button type="button" class="btn-lab-launch" data-preset="laser-regime">Lasing Above Threshold (1.70 V)</button>
      <button type="button" class="btn-lab-launch" data-preset="compare-homo">Compare Homojunction vs. Hetero</button>
    </div>`,

    c2t4: `<ul>
      <li><b>Gas Mixture Roles:</b> Uses a discharge mixture of <b>CO<sub>2</sub></b> (active lasing molecules), <b>N<sub>2</sub></b> (efficiently excited by electrons and transfers vibrational energy to CO<sub>2</sub>), and <b>He</b> (rapidly depopulates lower CO<sub>2</sub> laser levels and conducts heat to the tube wall).</li>
      <li><b>Three Vibrational Modes of CO<sub>2</sub>:</b> Linear symmetric O=C=O exhibits <b>Symmetric Stretching</b>, <b>Bending</b>, and <b>Asymmetric Stretching</b> vibrational modes corresponding to quantized vibrational energy levels.</li>
      <li><b>Energy Transfer &amp; Inversion:</b> Electrical discharge excites N<sub>2</sub> to its long-lived excited vibrational state; near-resonant collisions transfer this energy directly into the upper CO<sub>2</sub> asymmetric stretch state <b>E<sub>5</sub></b>.</li>
      <li><b>Laser Transitions:</b> Stimulated emission on <b>E<sub>5</sub> → E<sub>4</sub></b> produces the primary high-power far-infrared laser output at <b>λ = 10.6 μm</b>. An alternate transition <b>E<sub>5</sub> → E<sub>3</sub></b> can also occur between the upper asymmetric level and lower level E<sub>3</sub>.</li>
      <li><b>He Depopulation:</b> Fast collisional relaxation from E<sub>4</sub> and E<sub>3</sub> through bending level E<sub>2</sub> to ground state E<sub>1</sub> prevents bottlenecking and maintains inversion N(E<sub>5</sub>) &gt; N(E<sub>4</sub>).</li>
    </ul>
    <div class="theory-entry-row">
      <span class="theory-entry-label">Try in Lab ↑</span>
      <button type="button" class="btn-lab-launch" data-preset="full-lasing">Run Full Discharge Lasing</button>
      <button type="button" class="btn-lab-launch" data-preset="mode-sym">Explore Symmetric Stretch</button>
      <button type="button" class="btn-lab-launch" data-preset="mode-bend">Explore Bending Mode</button>
      <button type="button" class="btn-lab-launch" data-preset="mode-asym">Explore Asymmetric Stretch</button>
    </div>`,

    c2t5: `<ul>
      <li><b>Principle of Holography:</b> Unlike ordinary photography (which records only light intensity |E|²), holography records both <b>amplitude and relative phase</b> of light scattered from a 3D object via optical interference.</li>
      <li><b>Stage A — Recording:</b> A coherent laser beam passes through a beam splitter into an <b>Object Beam</b> (illuminates the object and reflects to the photographic plate) and a <b>Reference Beam</b> (directed via mirrors to the same plate). Their superposition creates microscopic dark and bright <b>interference fringes</b> recorded on the emulsion.</li>
      <li><b>Stage B — Reconstruction:</b> When the developed hologram is illuminated by the <b>Reconstruction Wave</b> (matching the reference beam), the recorded interference fringes act as a complex <b>diffraction grating</b>.</li>
      <li><b>Virtual &amp; Real Images:</b> Diffracted light reproduces the original object wavefront, forming a 3D <b>virtual image</b> behind the plate (viewed by an observer with depth/parallax) alongside a conjugate real image and transmitted zero-order beam.</li>
      <li><b>Fringe Sensitivity:</b> Increasing beam angle θ compresses fringe spacing d, while shifting relative phase Δφ translates the interference pattern laterally — demonstrating why vibration isolation and coherent laser light are mandatory.</li>
    </ul>
    <div class="theory-entry-row">
      <span class="theory-entry-label">Try in Lab ↑</span>
      <button type="button" class="btn-lab-launch" data-preset="recording">Stage A: Record Interference Fringes</button>
      <button type="button" class="btn-lab-launch" data-preset="reconstruction">Stage B: Reconstruct 3D Image</button>
      <button type="button" class="btn-lab-launch" data-preset="high-angle">Observe High-Angle Dense Fringes</button>
    </div>`,

    c2t6: `<ul>
      <li><b>Fibre Structure:</b> Consists of a high-index central <b>Core (n<sub>1</sub>)</b> surrounded by a slightly lower-index <b>Cladding (n<sub>2</sub> &lt; n<sub>1</sub>)</b> and a protective outer <b>Buffer jacket</b>.</li>
      <li><b>Total Internal Reflection (TIR):</b> Light inside the core striking the core–cladding boundary at incidence angle θ &gt; <b>θ<sub>c</sub> = sin<sup>−1</sup>(n<sub>2</sub>/n<sub>1</sub>)</b> undergoes 100% reflection back into the core; for θ &lt; θ<sub>c</sub> it refracts into the cladding and escapes.</li>
      <li><b>Acceptance Angle (θ<sub>max</sub>) &amp; Cone (2θ<sub>max</sub>):</b> Maximum external entry angle from medium n<sub>0</sub> for which the refracted core ray still meets TIR at the boundary. Rays inside the acceptance cone (full angle 2θ<sub>max</sub>) are guided; steeper rays are rejected.</li>
      <li><b>Numerical Aperture (NA):</b> Light-gathering capability defined by <b>NA = n<sub>0</sub> sin(θ<sub>max</sub>)</b>. Using Snell's law at entry, <b>NA = √(n<sub>1</sub>² − n<sub>2</sub>²)</b> (exact for air n<sub>0</sub> = 1, and in general sin(θ<sub>max</sub>) = √(n<sub>1</sub>² − n<sub>2</sub>²)/n<sub>0</sub> when ≤ 1).</li>
      <li><b>Fibre Types:</b> <b>Single-mode</b> supports one axial path (lowest dispersion); <b>Multimode Step-Index</b> allows many zigzag paths with different arrival times; <b>Graded-Index (GRIN)</b> uses a parabolic n(r) profile to smoothly bend rays so outer faster rays match axial arrival times.</li>
    </ul>
    <div class="theory-entry-row">
      <span class="theory-entry-label">Try in Lab ↑</span>
      <button type="button" class="btn-lab-launch" data-preset="tir">A. Test Critical Angle &amp; TIR</button>
      <button type="button" class="btn-lab-launch" data-preset="acceptance">B. Explore Acceptance Cone</button>
      <button type="button" class="btn-lab-launch" data-preset="na">C. Compute Numerical Aperture</button>
      <button type="button" class="btn-lab-launch" data-preset="grin">D. Compare Step vs. Graded Index</button>
    </div>`,

    c2t7: `<ul>
      <li><b>Attenuation &amp; Decibels:</b> Optical power decays exponentially along fibre length L (km): <b>Attenuation (dB) = 10 log<sub>10</sub>(P<sub>in</sub>/P<sub>out</sub>)</b> and attenuation coefficient <b>α = Attenuation (dB) / L (km)</b>.</li>
      <li><b>Loss Mechanisms:</b> <b>Material absorption</b> (intrinsic + OH<sup>−</sup> impurity peaks), <b>Rayleigh scattering</b> (∝ 1/λ⁴, rising steeply at shorter wavelengths), <b>Macro-bending</b> (sharp bends breaching θ<sub>c</sub>), and <b>Micro-bending</b> (microscopic core deformations).</li>
      <li><b>Optical Transmission Windows:</b> Operating systems target low-loss wavelength regions around <b>~850 nm</b> (1st window), <b>~1300 nm</b> (2nd window), and <b>~1550 nm</b> (3rd window) where Rayleigh scattering and absorption are balanced.</li>
      <li><b>Dispersion &amp; Pulse Broadening:</b> Optical pulses broaden in time due to <b>Intermodal dispersion</b> (different ray path lengths in multimode), <b>Material dispersion</b> (n varies with λ across finite Δλ), and <b>Waveguide dispersion</b>. Severe broadening causes adjacent pulses to overlap (intersymbol interference).</li>
      <li><b>Fibre-Optic Link Pipeline:</b> Message → Modulator → Carrier (LED or LASER diode, E→O) → Coupler → Optical Fibre → Photodetector (O→E) → Output Signal. Laser diodes with single-mode fibre minimize dispersion and maximize link distance.</li>
    </ul>
    <div class="theory-entry-row">
      <span class="theory-entry-label">Try in Lab ↑</span>
      <button type="button" class="btn-lab-launch" data-preset="attenuation">A. Attenuation &amp; 1/λ⁴ Windows</button>
      <button type="button" class="btn-lab-launch" data-preset="dispersion">B. Dispersion &amp; Pulse Overlap</button>
      <button type="button" class="btn-lab-launch" data-preset="pipeline">C. Transmit 101101001 Link</button>
    </div>`,
  };

  /* ============================================================
     REUSABLE CHAPTER 2 CONTROL HELPERS
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
     LAZY SIMULATION MODULE LOADER & CHAPTER 2 MANAGER
     ============================================================ */
  window.CH2_SIMS = window.CH2_SIMS || {};
  const scriptPromises = {};

  function loadSimModule(topic) {
    if (window.CH2_SIMS[topic.id]) {
      return Promise.resolve(window.CH2_SIMS[topic.id]);
    }
    if (scriptPromises[topic.id]) return scriptPromises[topic.id];
    scriptPromises[topic.id] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'src/ch2/' + topic.file;
      s.async = true;
      s.onload = () => {
        if (window.CH2_SIMS[topic.id]) resolve(window.CH2_SIMS[topic.id]);
        else reject(new Error('Simulation module did not register: ' + topic.id));
      };
      s.onerror = () => reject(new Error('Failed to load src/ch2/' + topic.file));
      document.head.appendChild(s);
    });
    return scriptPromises[topic.id];
  }

  const ch2State = {
    built: false,
    visible: false,
    activeTopic: 'c2t1',
    mountedSimId: null,
    mountedInstance: null,
    pendingPreset: null,
    overviewEl: null,
    overviewCards: {},
    panels: {},
    loadToken: 0,
  };

  function buildChapter2DOM() {
    if (ch2State.built) return;
    ch2State.built = true;

    const mainEl = document.getElementById('main');
    const el = window.XLab.el;

    // Collapsible Overview Strip for discovering all 7 Chapter 2 Virtual Labs
    const ov = el('section', 'ch2-overview');
    ov.id = 'ch2Overview';
    ov.setAttribute('aria-label', 'Chapter 2 Virtual Laboratories Overview');
    const compactDefault = window.innerWidth <= 768;
    if (!compactDefault) ov.classList.add('open');

    const ovHead = document.createElement('button');
    ovHead.type = 'button';
    ovHead.className = 'ch2-overview-head';
    ovHead.setAttribute('aria-expanded', compactDefault ? 'false' : 'true');
    ovHead.innerHTML = `
      <span class="ch2-overview-title">
        <span class="ch2-badge">Chapter 2 · 7 Virtual Labs</span>
        <span>LASER &amp; Optical Fibre Laboratory Index</span>
        <span class="ch2-overview-sub">Jump directly to any lesson experiment</span>
      </span>
      <span class="ch2-overview-chev" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 5.25L7 8.75l3.5-3.5"/></svg>
      </span>`;

    const ovBody = el('div', 'ch2-overview-body');
    const ovGrid = el('div', 'ch2-overview-grid');
    CH2_TOPICS.forEach((t, idx) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'ch2-ov-card' + (t.id === ch2State.activeTopic ? ' active' : '');
      card.innerHTML = `
        <span class="ch2-ov-num">LAB 2.${idx + 1} · ${t.keyIdea}</span>
        <span class="ch2-ov-name">${t.simName}</span>
        <span class="ch2-ov-lesson">${t.lesson}</span>`;
      card.addEventListener('click', () => {
        switchTopic(t.id);
        const target = ch2State.panels[t.id];
        if (target) target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      });
      ch2State.overviewCards[t.id] = card;
      ovGrid.append(card);
    });
    ovBody.append(ovGrid);
    ov.append(ovHead, ovBody);
    ov.style.display = 'none';
    mainEl.append(ov);
    ch2State.overviewEl = ov;

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

    // Build all 7 Chapter 2 Panels matching existing Chapter 1 structure
    CH2_TOPICS.forEach((t) => {
      const panel = el('section', 'panel ch2-panel');
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
              <span>Theory &amp; Academic Notes — ${t.lesson}</span>
            </span>
            <span class="chev" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 5.25L7 8.75l3.5-3.5"/></svg></span>
          </button>
          <div class="accordion-body"><div class="accordion-body-inner">${CH2_THEORY[t.id]}</div></div>
        </div>`;

      mainEl.append(panel);
      ch2State.panels[t.id] = panel;

      // Accordion behavior
      const acc = panel.querySelector('.accordion');
      const accHead = acc.querySelector('.accordion-head');
      const accBody = acc.querySelector('.accordion-body');
      accHead.addEventListener('click', () => {
        const open = acc.classList.toggle('open');
        accHead.setAttribute('aria-expanded', open ? 'true' : 'false');
        accBody.style.maxHeight = open ? accBody.scrollHeight + 'px' : '0px';
      });

      // Header quick entry buttons
      panel.querySelector('[data-action="focus-lab"]').addEventListener('click', () => {
        const ws = panel.querySelector('.workspace');
        if (ws) ws.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      });
      panel.querySelector('[data-action="open-theory"]').addEventListener('click', () => {
        if (!acc.classList.contains('open')) {
          acc.classList.add('open');
          accHead.setAttribute('aria-expanded', 'true');
          accBody.style.maxHeight = accBody.scrollHeight + 'px';
        }
        acc.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
      });

      // Theory interactive preset launch buttons -> apply preset & scroll to lab
      panel.querySelectorAll('.btn-lab-launch').forEach((btn) => {
        btn.addEventListener('click', () => {
          const preset = btn.dataset.preset;
          if (ch2State.mountedSimId === t.id && ch2State.mountedInstance && ch2State.mountedInstance.applyPreset) {
            ch2State.mountedInstance.applyPreset(preset);
          } else {
            ch2State.pendingPreset = { id: t.id, preset };
            if (ch2State.activeTopic !== t.id) switchTopic(t.id);
          }
          const ws = panel.querySelector('.workspace');
          if (ws) ws.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
        });
      });
    });
  }

  function renderPillBar() {
    const pillBar = document.getElementById('pillBar');
    pillBar.innerHTML = '';
    pillBar.setAttribute('aria-label', 'Chapter 2 topics');
    CH2_TOPICS.forEach((t) => {
      const btn = window.XLab.el(
        'button',
        'pill' + (t.id === ch2State.activeTopic ? ' active' : ''),
        `<span class="pill-icon" aria-hidden="true">${CH2_ICONS[t.id]}</span><span>${t.name}</span>`
      );
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', t.id === ch2State.activeTopic ? 'true' : 'false');
      btn.setAttribute('aria-controls', 'panel-' + t.id);
      btn.tabIndex = t.id === ch2State.activeTopic ? 0 : -1;
      btn.dataset.topic = t.id;
      btn.addEventListener('click', () => switchTopic(t.id));
      pillBar.append(btn);
    });
  }

  function unmountCurrentSim() {
    const prevId = ch2State.mountedSimId;
    if (ch2State.mountedInstance && ch2State.mountedInstance.unmount) {
      try {
        ch2State.mountedInstance.unmount();
      } catch (err) {
        console.error(err);
      }
    }
    if (prevId) {
      const wrap = document.getElementById('wrap-' + prevId);
      const stage = document.getElementById('stage-' + prevId);
      const controls = document.getElementById('controls-' + prevId);
      const formula = document.getElementById('formula-' + prevId);
      if (wrap) wrap.querySelectorAll('.ch2-subtabs, .sim-banner').forEach((n) => n.remove());
      if (stage) stage.innerHTML = '';
      if (controls) controls.innerHTML = '';
      if (formula) formula.innerHTML = '';
    }
    ch2State.mountedInstance = null;
    ch2State.mountedSimId = null;
  }

  function switchTopic(id) {
    const topic = CH2_TOPICS.find((t) => t.id === id) || CH2_TOPICS[0];
    ch2State.activeTopic = topic.id;

    // Toggle panels visibility within Chapter 2
    CH2_TOPICS.forEach((t) => {
      const p = ch2State.panels[t.id];
      if (p) p.classList.toggle('active', ch2State.visible && t.id === topic.id);
      if (ch2State.overviewCards[t.id]) {
        ch2State.overviewCards[t.id].classList.toggle('active', t.id === topic.id);
      }
    });

    // Update pills
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

    if (!ch2State.visible) return;

    // Cleanly unmount previous simulation before mounting new one
    if (ch2State.mountedSimId !== topic.id) {
      unmountCurrentSim();
      const stage = document.getElementById('stage-' + topic.id);
      const controls = document.getElementById('controls-' + topic.id);
      const formula = document.getElementById('formula-' + topic.id);
      const wrap = document.getElementById('wrap-' + topic.id);
      if (stage) {
        stage.innerHTML = '<div style="height:420px;display:flex;align-items:center;justify-content:center;color:var(--text2);font-size:.86rem;">Loading virtual laboratory...</div>';
      }
      const token = ++ch2State.loadToken;
      loadSimModule(topic)
        .then((factory) => {
          if (!ch2State.visible || ch2State.activeTopic !== topic.id || token !== ch2State.loadToken) return;
          const inst = factory({
            topic,
            panel: ch2State.panels[topic.id],
            wrap,
            stage,
            controls,
            formula,
            dot: document.getElementById('dot-' + topic.id),
          });
          ch2State.mountedSimId = topic.id;
          ch2State.mountedInstance = inst;
          if (inst && inst.mount) inst.mount();
          if (ch2State.pendingPreset && ch2State.pendingPreset.id === topic.id) {
            const pending = ch2State.pendingPreset.preset;
            ch2State.pendingPreset = null;
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
    } else if (ch2State.mountedInstance && ch2State.mountedInstance.resize) {
      requestAnimationFrame(() => ch2State.mountedInstance.resize());
    }
  }

  function handleKeydown(e) {
    if (!ch2State.visible) return false;
    const idx = CH2_TOPICS.findIndex((t) => t.id === ch2State.activeTopic);
    let next = null;
    if (e.key === 'ArrowRight') next = (idx + 1) % CH2_TOPICS.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + CH2_TOPICS.length) % CH2_TOPICS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = CH2_TOPICS.length - 1;
    if (next !== null) {
      e.preventDefault();
      switchTopic(CH2_TOPICS[next].id);
      const btn = document.querySelector('#pillBar .pill.active');
      if (btn) btn.focus();
      return true;
    }
    return false;
  }

  function mountChapter2() {
    buildChapter2DOM();
    ch2State.visible = true;
    if (ch2State.overviewEl) ch2State.overviewEl.style.display = 'block';
    const ovBody = ch2State.overviewEl && ch2State.overviewEl.querySelector('.ch2-overview-body');
    if (ovBody && ch2State.overviewEl.classList.contains('open')) {
      requestAnimationFrame(() => { ovBody.style.maxHeight = ovBody.scrollHeight + 'px'; });
    }
    renderPillBar();
    switchTopic(ch2State.activeTopic);
  }

  function unmountChapter2() {
    ch2State.visible = false;
    ch2State.loadToken++;
    unmountCurrentSim();
    if (ch2State.overviewEl) ch2State.overviewEl.style.display = 'none';
    CH2_TOPICS.forEach((t) => {
      const p = ch2State.panels[t.id];
      if (p) p.classList.remove('active');
    });
  }

  function tickChapter2(dt) {
    if (!ch2State.visible || !ch2State.mountedInstance) return;
    if (ch2State.mountedInstance.tick) ch2State.mountedInstance.tick(dt);
  }

  function resizeChapter2() {
    if (!ch2State.visible) return;
    const ovBody = ch2State.overviewEl && ch2State.overviewEl.querySelector('.ch2-overview-body');
    if (ovBody && ch2State.overviewEl.classList.contains('open')) {
      ovBody.style.maxHeight = ovBody.scrollHeight + 'px';
    }
    if (ch2State.mountedInstance && ch2State.mountedInstance.resize) {
      ch2State.mountedInstance.resize();
    }
  }

  window.Ch2Platform = {
    PHYSICS: CH2_PHYSICS,
    TOPICS: CH2_TOPICS,
    nmToEv,
    evToNm,
    nmToTHz,
    spectrumColor,
    svgEl,
    prefersReducedMotion,
    buildTransport,
    buildActionRow,
    buildBanner,
    buildSubtabs,
    mount: mountChapter2,
    unmount: unmountChapter2,
    tick: tickChapter2,
    resize: resizeChapter2,
    handleKeydown,
    switchTopic,
    getState: () => ch2State,
  };
})();
