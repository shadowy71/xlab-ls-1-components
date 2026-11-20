# Engineering Physics Interactive Simulator (Chapters 1, 2, 3 & Unit V)

A dependency-free HTML/CSS/JS application that teaches **Chapter 1: Semiconductor Physics**, **Chapter 2: LASER & Optical Fibre**, and **Chapter 3: Quantum Mechanics** through twenty interactive physics simulations.

**Open `index.html` in any modern browser or serve statically** — no build step, no external dependencies, no network calls.

## Chapter 1: Semiconductor Physics (`index.html`)

| # | Topic | What you can explore |
|---|-------|----------------------|
| 1 | Energy Bands | Discrete atomic levels split into bands as atoms approach `a₀`; metal / semiconductor / insulator comparison |
| 2 | Fermi–Dirac `f(E)` | Temperature-driven smearing of the step function, `f(E_F)=0.5`, `±2kT` thermal width, `1−f(E)` overlay |
| 3 | Fermi Level | `E_F` position vs. doping (`N_D` / `N_A`) and temperature, mass-action law `n·p = nᵢ²` verification |
| 4 | Hall Effect | 3D Hall bar, Lorentz deflection of `e⁻` / `h⁺`, `V_H = IB/(ned)`, polarity sign flip between carrier types |
| 5 | P-N Junction | Band bending, built-in potential `V₀`, depletion width vs. bias, quasi-Fermi splitting, diode I–V |
| 6 | Solar Cell | Photon absorption vs. `hν ≥ E_g`, e–h separation, I–V / power curves, fill factor and efficiency |
| 7 | Conductivity | Random thermal walk + drift, `σ = e(nμₑ + pμₕ)`, `J_e` / `J_h` split, mobility presets |

## Chapter 2: LASER & Optical Fibre (`src/ch2/`)

| # | Lesson & Lab | Module | What you can explore |
|---|--------------|--------|----------------------|
| 2.1 | Interaction of Light with Matter | `sim1-photon-atom.js` | Absorption, Spontaneous Emission, and Stimulated Emission across `E₁` & `E₂`; live `ΔE = E₂ − E₁ = hν = hc/λ`, resonance check, step-by-step & play/pause modes |
| 2.2 | Population Inversion & Working Principle | `sim2-laser-builder.js` | Active medium, pumping, metastable lifetime `τ₂`, `N₂ > N₁` inversion, `M₁`/`M₂` resonator cascade, plus `Ordinary Light vs. LASER` comparison |
| 2.3 | Semiconductor Heterojunction LASER | `sim3-heterojunction-laser.js` | `P-GaAlAs / GaAs / N-GaAlAs` double heterojunction cross-section, band diagram (`E_C`, `E_V`, `E_Fp`, `E_Fn`), carrier & optical confinement, homojunction vs. heterojunction comparison |
| 2.4 | Carbon Dioxide (`CO₂`) LASER | `sim4-co2-laser.js` | `CO₂–N₂–He` electrical discharge tube, 7-stage process progression, Molecular Vibration Explorer (`Symmetric`, `Bending`, `Asymmetric`), `E₁`–`E₅` energy levels (`E₅ → E₄` at `10.6 μm` & alternate `E₅ → E₃`) |
| 2.5 | Introduction to Holography | `sim5-holography.js` | Stage A (Recording: LASER, beam splitter, object/reference beams, plate interference fringes) & Stage B (Reconstruction via diffraction grating), plus live fringe spacing & phase profile visualizer |
| 2.6 | Propagation of Light in Optical Fibres | `sim6-fibre-ray.js` | Core/cladding/buffer cross-section, Total Internal Reflection (`θ_c = sin⁻¹(n₂/n₁)`), Acceptance Cone (`2θ_max`), Numerical Aperture (`NA = n₀ sin(θ_max) = √(n₁² − n₂²)`), Single-Mode / Multimode Step-Index / Graded-Index comparison |
| 2.7 | Attenuation, Dispersion & Communication | `sim7-fibre-comm.js` | `10 log₁₀(P_in/P_out)` attenuation, `1/λ⁴` qualitative Rayleigh plot & optical transmission windows, dispersion & two-pulse overlap (ISI), and full end-to-end binary communication pipeline (`101101001`) |

## Chapter 3: Quantum Mechanics (`src/ch3/`)

| # | Lesson & Lab | Module | What you can explore |
|---|--------------|--------|----------------------|
| 3.1 | Wave–Particle Duality & de Broglie Lab | `sim1-debroglie.js` | Particle mode (Electron, Proton, Neutron, Custom; synced velocity & kinetic energy `K`; `λ = h/p = h/√(2mK)`, kinetic vs. total frequency note, live `λ` vs `K` plot) and Radiation mode (`E = hν = hc/λ`, equal-energy electron vs. photon comparison) |
| 3.2 | Wave Packet & Phase/Group Velocity | `sim2-wave-packet.js` | Discrete Fourier superposition of `N` plane waves (`3–25`), localized wave packet + analytical envelope, `v_p = ω/k` vs. `v_g = dω/dk` markers, Free Non-Relativistic Matter Wave mode (`ω = ħk²/(2m)` → `v_p = v/2`, `v_g = v`) and Custom Dispersion mode, play/pause/single-step/reset |
| 3.3 | Heisenberg Uncertainty Laboratory | `sim3-uncertainty.js` | Synchronized Gaussian position-space `|ψ(x)|²` and momentum-space `|φ(p)|²` distributions, live `Δx`, `Δp`, `Δx·Δp = ħ/2` (and optional phase-chirped `Δx·Δp ≥ ħ/2`), narrow vs. broad comparison, intrinsic quantum spread vs. measurement instrument noise |
| 3.4 | Wave Function & Schrödinger Equation | `sim4-wavefunction-schrodinger.js` | **A. Normalization & `\|ψ\|²`:** integral `∫\|ψ\|²dx`, normalization factor `N`, one-click normalize, interval probability `P(x₁ ≤ x ≤ x₂)`. **B. Well-Behaved `ψ(x)`:** single-valued, finite, continuous, normalizable, plus finite vs. infinite wall slope behavior. **C. 1D TISE Explorer:** `−(ħ²/2m)d²ψ/dx² + V(x)ψ = Eψ` RK4 curvature solver bridging directly to Box & Tunnelling |
| 3.5 | Particle in a Box Laboratory | `sim5-particle-box.js` | **A. Rigid 1D Box:** `ψ_n(x) = √(2/L) sin(nπx/L)`, `E_n = n²h²/(8mL²)`, adjustable `L`, `m`, `n`, second-level comparison `n₂`, stationary `\|Ψ_n\|²` vs. phase `e^{−iE_n t/ħ}`, energy-level ladder, and 4-step boundary-condition derivation. **B. Qualitative Finite Potential Well:** symmetric 1D bound-state barrier penetration & evanescent decay |
| 3.6 | Quantum Tunnelling Laboratory | `sim6-tunnelling.js` | 1D rectangular barrier (`E < V₀` tunnelling & `E > V₀` over-barrier interference), overflow-safe exact analytical `T(E)` & `R = 1 − T`, exact steady-state complex scattering wavefunction `ψ(x,t)` matched at `x = 0, a`, and live `T(E)` curve |

## Unit V: Magnetism and Superconductivity (`src/ch5/`)

Nine lazy-loaded labs cover magnetic material classes and ordering temperatures; hysteresis; GMR; adiabatic demagnetization; superconductivity, Meissner effect and critical fields; conventional BCS pairing; Josephson effects; DC-SQUID interference; and superconducting magnets and maglev. Use the Unit V tab, then the topic pills or syllabus index to launch each experiment. Controls and parameters are illustrative, not measured material data. The magnetocaloric effect is included as a short explanatory statement.

## Physics fidelity & explicit modeling notes

* **Chapter 1:**
  * `nᵢ(T)` uses `nᵢ(300 K)·(T/300)^{3/2}·exp[−(E_g/2k)(1/T − 1/300)]` with tabulated values for Si, Ge, GaAs, CdTe.
  * Diode model: `I = I₀[exp(eV/ηkT) − 1]`, `V₀ = (kT/e)ln(N_A N_D/nᵢ²)`, `W = √[2ε(V₀−V)(1/N_A + 1/N_D)/e]`.
  * Solar cell: `I = I_L − I₀[exp(eV/kT) − 1]`, absorption gated on `hν ≥ E_g`, MPP found numerically.
  * Hall: `V_H = IB/(ned)`, `R_H = ±1/(ne)`.
* **Chapter 2:**
  * Quantum & optical equations use exact SI/CODATA constants (`h = 6.62607015×10⁻³⁴ J·s`, `c = 2.99792458×10⁸ m/s`, `e = 1.602176634×10⁻¹⁹ C`).
  * Snell's law, critical angle `θ_c = sin⁻¹(n₂/n₁)`, numerical aperture `NA = n₀ sin(θ_max) = √(n₁² − n₂²)`, and `10 log₁₀(P_in/P_out)` attenuation are computed from exact formulas, while qualitative cavity dynamics and `1/λ⁴` envelope curves are clearly labeled.
  * **Photon–Atom lab (2.1) emitted-photon kinematics are pixel-true:** the emitted photon's on-screen trajectory equals its drawn wave orientation and the displayed θ (counter-clockwise from horizontal, y-up convention mapped through the SVG's y-down flip). Emitted photons are clipped to the interaction chamber, retire once fully outside it, and spontaneous decay fires after a randomized (statistical) delay with a re-randomized direction each cycle. Verified by `tests/ch2-photon-atom.cjs` (dependency-free, `node tests/ch2-photon-atom.cjs`).
* **Chapter 3:**
  * Uses exact CODATA constants (`h`, `ħ = h/(2π)`, `c`, `e`, `m_e = 9.1093837015×10⁻³¹ kg`, `m_p = 1.67262192369×10⁻²⁷ kg`, `m_n = 1.67492749804×10⁻²⁷ kg`).
  * **Non-relativistic regime:** de Broglie (`λ = h/√(2mK)`), wave packet (`ω = ħk²/(2m)` → `v_p = v/2`, `v_g = v`), TISE (`−(ħ²/2m)ψ'' + Vψ = Eψ`), infinite box (`E_n = n²h²/(8mL²)`), and rectangular barrier transmission `T` all assume non-relativistic quantum mechanics (`K ≪ mc²`); relativistic momentum `p = √(K² + 2Kmc²)/c` is not substituted silently, and the non-relativistic regime is documented inside each lab.
  * **Eigenstates vs. time dependence:** Rigid-box `|Ψ_n(x)|²` is strictly time-independent; toggling time-dependent phase animates `Re[ψ_n(x)e^{−iE_n t/ħ}]` rather than making probability density slosh across the box.
  * **Qualitative vs. exact analytical models:** Finite well barrier penetration (`c3t5` Part B) explicitly highlights qualitative penetration & symmetric even-parity bound-state solver behavior; Tunnelling (`c3t6`) displays the exact steady-state complex plane-wave scattering solution whose transmitted/reflected intensities equal `T` and `R = 1 − T` (using overflow-safe `exp(−κa)` factorization for large `κa` and exact `E → V₀` limit).

## Implementation notes

* Chapter 1 lives in `index.html` and runs cleanly with zero modifications to its physics. Chapter 2 (`src/ch2/`) and Chapter 3 (`src/ch3/`) lazy-load their simulation modules via `<script>` tags (compatible with both HTTP servers and `file://`).
* Only the active chapter and active simulation update/render in the single `requestAnimationFrame` loop; switching chapters or topics cleanly unmounts the inactive simulation and clears module state.
* Visualisations combine DPR-scaled HTML5 Canvas 2D (continuous animated waveforms, de Broglie wavefronts, wave packets, scattering barriers) and responsive SVG diagrams (uncertainty distributions, normalization & Schrödinger curvature, energy-level ladders, particle-in-a-box views).
* Accessibility: native labelled controls, WAI-ARIA `tablist`/`tab` keyboard navigation (`ArrowLeft`/`ArrowRight`/`Home`/`End`), visible focus indicators, and `prefers-reduced-motion` support.
