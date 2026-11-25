(function (root) {
  'use strict';
  // Exact SI constants; all other numerical scales below are teaching assumptions.
  const h = 6.62607015e-34, c = 299792458, e = 1.602176634e-19, me = 9.1093837015e-31;
  function nonnegative(value, name) {
    if (!Number.isFinite(value) || value < 0) throw new RangeError(name + ' must be finite and nonnegative.');
    return value;
  }
  function positive(value, name) {
    if (!Number.isFinite(value) || value <= 0) throw new RangeError(name + ' must be finite and positive.');
    return value;
  }
  const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
  const M = {
    // Exact sphere geometry; radius in nm, area in nm² and volume in nm³.
    sphere(r) {
      positive(r, 'Radius');
      return { area:4 * Math.PI * r * r, volume:4 * Math.PI * r * r * r / 3, ratio:3 / r };
    },
    // Continuum surface-shell volume fraction, not an atomistic calculation.
    surfaceFraction(r, a = 0.3) {
      positive(r, 'Radius'); nonnegative(a, 'Shell thickness');
      return r <= a ? 1 : 1 - Math.pow(1 - a / r, 3);
    },
    subdivision(r, reference = 50) {
      const small = M.sphere(r), large = M.sphere(reference), count = large.volume / small.volume;
      return { count, volume:large.volume, largeArea:large.area, totalArea:count * small.area, areaGain:reference / r };
    },
    // Ideal one-dimensional infinite well, energy in eV (L in nm; m = m*/me).
    well(L, m, n) {
      positive(L, 'Well width'); positive(m, 'Effective mass');
      if (!Number.isInteger(n) || n < 1) throw new RangeError('Quantum number must be a positive integer.');
      return n * n * h * h / (8 * m * me * Math.pow(L * 1e-9, 2)) / e;
    },
    // Dimensionless shape √L ψn(xL) = √2 sin(nπx), with x in [0,1].
    wavefunction(x, n) {
      if (!Number.isFinite(x) || !Number.isInteger(n) || n < 1) throw new RangeError('Invalid wavefunction input.');
      return x < 0 || x > 1 ? 0 : Math.sqrt(2) * Math.sin(n * Math.PI * x);
    },
    photon(E) { return h * c / (positive(E, 'Photon energy') * e) * 1e9; },
    photonEnergy(wavelength) { return h * c / (positive(wavelength, 'Wavelength') * 1e-9) / e; },
    // A bulk offset plus inverse-square term, NOT a material fit or a 3D dot solver.
    gap(L) { positive(L, 'Dot size'); return 1.8 + 3 / (L * L); },
    bohrRegime(L, aB = 5) {
      const ratio = positive(L, 'Size') / positive(aB, 'Bohr radius');
      return { ratio, regime:ratio < 0.7 ? 'Strong confinement' : ratio <= 1.5 ? 'Intermediate confinement' : 'Weak confinement' };
    },
    emissionLabel(w) {
      positive(w, 'Wavelength');
      return w < 380 ? 'UV — not visible' : w <= 780 ? 'Visible' : 'Infrared — not visible';
    },
    thickness(rate, time) { return nonnegative(rate, 'Rate') * nonnegative(time, 'Time'); },
    // Qualitative coverage example only; not a universal temperature trend.
    pvdCoverage(thickness, temp) {
      nonnegative(thickness, 'Thickness');
      if (!Number.isFinite(temp)) throw new RangeError('Temperature must be finite.');
      return 1 - Math.exp(-thickness / 20 * (.7 + .3 * clamp((temp - 20) / 380, 0, 1)));
    },
    // Qualitative LSPR extinction profile, shifted/broadened by aggregation.
    plasmon(w, size, agg) {
      positive(w, 'Wavelength'); positive(size, 'Particle size'); nonnegative(agg, 'Aggregation');
      const peak = 520 + .3 * (size - 20) + 80 * agg, width = 35 + size * .2 + 60 * agg;
      return Math.exp(-.5 * ((w - peak) / width) ** 2);
    },
    // Beer-like attenuation and a labelled heuristic absorption/scattering partition.
    opticalBalance(band, conc, size) {
      nonnegative(band, 'Band response'); nonnegative(conc, 'Concentration'); positive(size, 'Size');
      const extinction = 1 - Math.exp(-conc * band);
      const scatShare = .15 + .35 * (clamp(size, 2, 100) - 2) / 98;
      return { absorbed:extinction * (1 - scatShare), scattered:extinction * scatShare, transmitted:1 - extinction };
    },
    // Three broad RGB samples, NOT colorimetry; linked to the same optical model.
    colloidRGB(size, aggregation, concentration) {
      return [650, 550, 450].map(w => Math.round(235 * M.opticalBalance(M.plasmon(w, size, aggregation), concentration, size).transmitted));
    },
    // Toy contact/spacing law, not a resistor-network solver or a universal size law.
    network(size, spacing, connect) {
      positive(size, 'Size'); nonnegative(spacing, 'Spacing'); positive(connect, 'Connectivity');
      return 1000 * Math.exp(spacing / 5) * (1 + 20 / size) / Math.max(.05, connect);
    },
    mechanical(strain, grain) {
      if (!Number.isFinite(strain)) throw new RangeError('Strain must be finite.');
      positive(grain, 'Grain size');
      const strength = .4 + .5 / Math.sqrt(Math.max(grain, 10) / 10);
      return { strength, stress:Math.sign(strain) * Math.min(Math.abs(strain) * 12, strength) };
    },
    sensor(concentration, coverage, sensitivity) {
      nonnegative(concentration, 'Concentration'); nonnegative(coverage, 'Surface factor'); nonnegative(sensitivity, 'Sensitivity');
      return sensitivity * coverage * concentration / (1 + concentration);
    },
    sensorSlope(coverage, sensitivity) { return nonnegative(coverage, 'Surface factor') * nonnegative(sensitivity, 'Sensitivity'); },
    // First-order approach to equilibrium; tau is independent of the sampling interval.
    relax(current, target, dt, tau = 5) {
      nonnegative(current, 'Response'); nonnegative(target, 'Target'); nonnegative(dt, 'Time step'); positive(tau, 'Time constant');
      return target + (current - target) * Math.exp(-dt / tau);
    },
    mill(initial, t, speed, ratio, ball) {
      positive(initial, 'Initial size'); nonnegative(t, 'Time'); nonnegative(speed, 'Speed'); positive(ratio, 'Ratio'); positive(ball, 'Ball size');
      return initial * (.08 + .92 * Math.exp(-t * speed / 5000 * ratio / 10 * ball / 10));
    },
    millPopulation(initial, t, speed, ratio, ball) {
      M.mill(initial, t, speed, ratio, ball); // shared domain validation
      const decay = t * speed / 5000 * ratio / 10 * ball / 10;
      return Array.from({ length:80 }, (_, i) => {
        const start = initial * (.65 + .7 * ((i * 37) % 79) / 78);
        return start * (.08 + .92 * Math.exp(-decay * (.65 + .7 * ((i * 29) % 79) / 78)));
      });
    },
    millStage(reduction) {
      return reduction < .05 ? 'Loading · coarse powder' : reduction < .4 ? 'Fracture · impacts breaking particles' : reduction < .75 ? 'Refinement · increasingly fine powder' : 'Fine powder · approach model limit';
    },
    histogram(population, max, bins = 10) {
      positive(max, 'Histogram maximum');
      if (!Number.isInteger(bins) || bins < 1 || bins > 1000) throw new RangeError('Invalid bin count.');
      const result = Array(bins).fill(0);
      population.forEach(v => { if (Number.isFinite(v) && v >= 0) result[Math.min(bins - 1, Math.floor(v / max * bins))]++; });
      return result;
    },
    goldPopulation(g) {
      return Array.from({ length:g.count }, (_, i) => g.size * (.7 + .6 * ((i * 37) % 97) / 96));
    },
    gold(t, prec, red, temp, mix, stab) {
      nonnegative(t, 'Time'); positive(prec, 'Precursor'); positive(red, 'Reducing agent'); positive(temp, 'Temperature'); nonnegative(mix, 'Mixing'); nonnegative(stab, 'Stabilizer');
      // This arbitrary progress coordinate is NOT a chemical rate law.
      const progress = Math.min(1, t / 100 * (.4 + red / 10) * (temp / 70) * (.5 + mix / 10));
      const growth = Math.max(0, (progress - .25) / .75);
      return {
        progress, size:4 + growth * (4 + prec * .7) / (.6 + red / 20),
        aggregation:Math.min(1, growth * (prec / 20) / (1 + stab / 3)),
        count:Math.round(90 * Math.min(1, red / 10) * clamp((progress - .25) / .2, 0, 1))
      };
    },
    goldTimeForProgress(progress, red, temp, mix) {
      return clamp(nonnegative(progress, 'Progress'), 0, 1) * 100 / ((.4 + positive(red, 'Reducing agent') / 10) * (positive(temp, 'Temperature') / 70) * (.5 + nonnegative(mix, 'Mixing') / 10));
    },
    goldStage(progress) {
      return progress < .08 ? 0 : progress < .16 ? 1 : progress < .25 ? 2 : progress < .4 ? 3 : progress < .7 ? 4 : progress < .9 ? 5 : 6;
    },
    magneticRegime(size) { positive(size, 'Size'); return size < 10 ? 'Superparamagnetic (illustrative)' : 'Single-domain blocked (illustrative)'; },
    // branch: +1 increasing H, −1 decreasing H, 0 reversible reference.
    magnetization(field, size, branch = 0) {
      if (!Number.isFinite(field) || !Number.isFinite(branch)) throw new RangeError('Invalid magnetic field or branch.');
      positive(size, 'Size');
      const offset = size >= 10 ? .25 * clamp(branch, -1, 1) : 0;
      return Math.tanh((field - offset) * 3) * Math.min(1, size / 20);
    },
    remanence(size) { return size < 10 ? 0 : M.magnetization(0, size, -1); }
  };
  root.NanoModels = M;
  if (typeof module !== 'undefined') module.exports = M;
})(typeof window !== 'undefined' ? window : globalThis);
