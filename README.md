# Unit-1 Semiconductor Physics — Interactive Simulator

A single-file, dependency-free HTML/CSS/JS application that teaches **Chapter 1:
Semiconductor Physics** through seven live, physics-accurate canvas simulations.

**Open `index.html` in any modern browser** — no build step, no server, no network calls.

## Topics

| # | Topic | What you can explore |
|---|-------|----------------------|
| 1 | Energy Bands | Discrete atomic levels split into bands as atoms approach `a₀`; metal / semiconductor / insulator comparison |
| 2 | Fermi–Dirac `f(E)` | Temperature-driven smearing of the step function, `f(E_F)=0.5`, `±2kT` thermal width, `1−f(E)` overlay |
| 3 | Fermi Level | `E_F` position vs. doping (N_D / N_A) and temperature, mass-action law `n·p = nᵢ²` verification |
| 4 | Hall Effect | 3D Hall bar, Lorentz deflection of e⁻ / h⁺, `V_H = IB/(ned)`, polarity sign flip between carrier types |
| 5 | P-N Junction | Band bending, built-in potential `V₀`, depletion width vs. bias, quasi-Fermi splitting, diode I–V |
| 6 | Solar Cell | Photon absorption vs. `hν ≥ Eᵍ`, e–h separation, I–V / power curves, fill factor and efficiency |
| 7 | Conductivity | Random thermal walk + drift, `σ = e(nμₑ + pμₕ)`, `J_e` / `J_h` split, mobility presets |

## Physics fidelity

* `nᵢ(T)` uses `nᵢ(300 K)·(T/300)^{3/2}·exp[−(Eᵍ/2k)(1/T − 1/300)]` with tabulated values for Si, Ge, GaAs, CdTe.
* Topic 3 scales `N_C`, `N_V` so the tabulated `nᵢ` and the effective-mass ratio are both honoured — `n·p = nᵢ²` holds to machine precision.
* Diode model: `I = I₀[exp(eV/ηkT) − 1]`, `V₀ = (kT/e)ln(N_A N_D/nᵢ²)`, `W = √[2ε(V₀−V)(1/N_A + 1/N_D)/e]`.
* Solar cell: `I = I_L − I₀[exp(eV/kT) − 1]`, absorption gated on `hν ≥ Eᵍ`, MPP found numerically.
* Hall: `V_H = IB/(ned)`, `R_H = ±1/(ne)` (sign from carrier type).

Verified reference points: Si diode at `N_A = N_D = 10¹⁶ cm⁻³`, 300 K → `V₀ = 0.693 V`;
Si solar cell at 1 sun, 300 K → `I_sc = 35 mA`, `V_oc = 0.63 V`, `η ≈ 18 %`.

## Implementation notes

* All visualisations use the HTML5 Canvas 2D API with `devicePixelRatio` scaling and `ResizeObserver`.
* A single `requestAnimationFrame` loop updates/renders only the visible topic.
* Narrow viewports (< 620 px canvas width) get dedicated compact layouts, not just scaled-down ones.
* Accessibility: native range inputs with labels, ARIA tabs with ←/→ navigation, `prefers-reduced-motion` support.
