# Engineering Physics Interactive Simulator (Chapters 1 & 2)

A dependency-free HTML/CSS/JS application that teaches **Chapter 1: Semiconductor Physics** and **Chapter 2: LASER & Optical Fibre** through fourteen interactive physics simulations.

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

## Physics fidelity & explicit modeling notes

* **Chapter 1:**
  * `nᵢ(T)` uses `nᵢ(300 K)·(T/300)^{3/2}·exp[−(E_g/2k)(1/T − 1/300)]` with tabulated values for Si, Ge, GaAs, CdTe.
  * Diode model: `I = I₀[exp(eV/ηkT) − 1]`, `V₀ = (kT/e)ln(N_A N_D/nᵢ²)`, `W = √[2ε(V₀−V)(1/N_A + 1/N_D)/e]`.
  * Solar cell: `I = I_L − I₀[exp(eV/kT) − 1]`, absorption gated on `hν ≥ E_g`, MPP found numerically.
  * Hall: `V_H = IB/(ned)`, `R_H = ±1/(ne)`.
* **Chapter 2:**
  * Quantum & optical equations use exact SI/CODATA constants (`h = 6.62607015×10⁻³⁴ J·s`, `c = 2.99792458×10⁸ m/s`, `e = 1.602176634×10⁻¹⁹ C`).
  * Snell's law, critical angle `θ_c = sin⁻¹(n₂/n₁)`, numerical aperture `NA = n₀ sin(θ_max) = √(n₁² − n₂²)` (with physical `θ_max` clamping when `NA/n₀ ≥ 1`), and decibel attenuation `10 log₁₀(P_in/P_out)` are computed directly from exact formulas.
  * Conceptual cavity dynamics (3-level laser rate visualizer, semiconductor threshold indicator, `CO₂` vibrational kinetics, `1/λ⁴` qualitative wavelength-attenuation envelope across the `~850 / ~1300 / ~1550 nm` windows, and conceptual pulse spreading) explicitly distinguish qualitative/conceptual dynamics from calibrated experimental measurements without inventing unsupported numbers (such as the `E₅ → E₃` alternate transition wavelength or measured dB/km window tables).

## Implementation notes

* Chapter 1 lives in `index.html` and runs cleanly with zero modifications to its physics. Chapter 2 modules live in `src/ch2/` (`ch2.css`, `ch2-core.js`, `sim1`–`sim7`) and lazy-load on demand via standard `<script>` tags (compatible with both HTTP servers and `file://`).
* Only the active chapter and active simulation update/render in the single `requestAnimationFrame` loop; switching chapters or topics cleanly unmounts the inactive simulation.
* Visualisations combine DPR-scaled HTML5 Canvas 2D and responsive SVG diagrams with dedicated narrow-viewport layouts.
* Accessibility: native labelled controls, WAI-ARIA `tablist`/`tab` keyboard navigation (`ArrowLeft`/`ArrowRight`/`Home`/`End`), visible focus indicators, and `prefers-reduced-motion` support.
