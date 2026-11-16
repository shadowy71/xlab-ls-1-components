(function () {
  'use strict';

  const C = window.Ch3Platform;
  const X = window.XLab;
  const P = C.PHYSICS;

  window.CH3_SIMS['c3t3'] = function createUncertaintyLab(ctxDom) {
    const { stage, controls, formula, wrap, dot } = ctxDom;
    const svgEl = C.svgEl;

    const state = {
      dxNm: 0.30,            // 0.08 .. 1.20 nm (position uncertainty Δx = σ_x)
      chirpBeta: 0.0,        // 0.0 (minimum uncertainty) .. 2.0 (excess phase chirp)
      p0Shift: 0.0,          // -3 .. +3 (x 10^-25 kg*m/s center momentum)
      showWaveReal: true,    // show Re[psi(x)] inside position graph
      showCompareRef: true,  // show narrow (0.10 nm) vs broad (0.75 nm) comparison ghosts
      playing: true,
      time: 0,
    };

    let built = false;
    let ui = {};
    let banner = null;

    function calcUncertainty() {
      const dxM = state.dxNm * 1e-9;
      const minProduct = P.hbar / 2;
      const factor = Math.sqrt(1 + state.chirpBeta * state.chirpBeta);
      const dpSI = (minProduct / dxM) * factor;
      const productSI = dxM * dpSI;
      const ratioToMin = productSI / minProduct;
      const dpKeVc = (dpSI * P.c / P.e) * 1e-3; // keV/c
      return { dxNm: state.dxNm, dxM, dpSI, dpKeVc, productSI, minProduct, ratioToMin };
    }

    function resetSimulation() {
      state.dxNm = 0.30;
      state.chirpBeta = 0.0;
      state.p0Shift = 0.0;
      state.showWaveReal = true;
      state.showCompareRef = true;
      if (ui.dxSlider) ui.dxSlider.setValue(state.dxNm);
      if (ui.chirpSlider) ui.chirpSlider.setValue(state.chirpBeta);
      if (ui.p0Slider) ui.p0Slider.setValue(state.p0Shift);
      if (ui.waveToggle) ui.waveToggle.checked = true;
      if (ui.cmpToggle) ui.cmpToggle.checked = true;
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
        'aria-label': 'Heisenberg Uncertainty Principle Position and Momentum Distributions',
      });

      // Top Panel: Position Space |psi(x)|^2 (y: 22..248)
      svg.append(svgEl('rect', { x: 24, y: 18, width: 772, height: 228, rx: 8, fill: 'rgba(6,10,24,0.68)', stroke: 'rgba(255,255,255,0.13)' }));
      const posTitle = svgEl('text', { x: 40, y: 40, fill: '#edf1f8', 'font-size': '12.5', 'font-weight': '600', 'font-family': 'Inter, sans-serif' });
      posTitle.textContent = '1. POSITION-SPACE PROBABILITY DENSITY |ψ(x)|²';
      const posBadge = svgEl('text', { x: 780, y: 40, 'text-anchor': 'end', fill: '#22d3ee', 'font-size': '11', 'font-weight': '600', 'font-family': 'JetBrains Mono, monospace' });
      svg.append(posTitle, posBadge);

      // Bottom Panel: Momentum Space |phi(p)|^2 (y: 266..494)
      svg.append(svgEl('rect', { x: 24, y: 264, width: 772, height: 236, rx: 8, fill: 'rgba(6,10,24,0.68)', stroke: 'rgba(255,255,255,0.13)' }));
      const momTitle = svgEl('text', { x: 40, y: 286, fill: '#edf1f8', 'font-size': '12.5', 'font-weight': '600', 'font-family': 'Inter, sans-serif' });
      momTitle.textContent = '2. MOMENTUM-SPACE PROBABILITY DENSITY |ψ̃(p)|²';
      const momBadge = svgEl('text', { x: 780, y: 286, 'text-anchor': 'end', fill: '#f472b6', 'font-size': '11', 'font-weight': '600', 'font-family': 'JetBrains Mono, monospace' });
      svg.append(momTitle, momBadge);

      const dynLayer = svgEl('g');
      svg.append(dynLayer);
      stage.append(svg);

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

      // Presets row
      C.buildActionRow(controls, [
        { id: 'narrow', label: 'Narrow Δx (0.10 nm)', onClick: () => applyPreset('narrow') },
        { id: 'broad', label: 'Broad Δx (0.85 nm)', onClick: () => applyPreset('broad') },
      ]);

      ui.dxSlider = X.buildSlider(controls, {
        label: 'Position Uncertainty Δx (Packet Width)',
        id: 'c3t3-dx',
        min: 0.08,
        max: 1.20,
        step: 0.01,
        value: state.dxNm,
        format: (v) => v.toFixed(2) + ' nm',
        onInput: (v) => {
          state.dxNm = v;
          updateReadouts();
          updateBanner();
          render();
        },
      });

      ui.chirpSlider = X.buildSlider(controls, {
        label: 'Excess Phase Chirp β (0 = Min Gaussian)',
        id: 'c3t3-chirp',
        min: 0.0,
        max: 2.0,
        step: 0.05,
        value: state.chirpBeta,
        format: (v) => v === 0 ? '0.00 (Minimum ħ/2)' : v.toFixed(2),
        onInput: (v) => {
          state.chirpBeta = v;
          updateReadouts();
          updateBanner();
          render();
        },
      });

      ui.p0Slider = X.buildSlider(controls, {
        label: 'Mean Momentum Shift p₀',
        id: 'c3t3-p0',
        min: -3.0,
        max: 3.0,
        step: 0.2,
        value: state.p0Shift,
        format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}×10⁻²⁵ kg·m/s`,
        onInput: (v) => {
          state.p0Shift = v;
          updateReadouts();
          render();
        },
      });

      ui.waveToggle = X.buildToggle(controls, {
        label: 'Show Re[ψ(x)] amplitude wave inside packet',
        checked: state.showWaveReal,
        onChange: (on) => { state.showWaveReal = on; render(); },
      });

      ui.cmpToggle = X.buildToggle(controls, {
        label: 'Compare narrow (0.10 nm) vs broad (0.85 nm) ghosts',
        checked: state.showCompareRef,
        onChange: (on) => { state.showCompareRef = on; render(); },
      });

      ui.readouts = X.buildReadouts(controls, [
        { id: 'dx', label: 'Position Uncertainty Δx' },
        { id: 'dp', label: 'Momentum Uncertainty Δp' },
        { id: 'prod', label: 'Product Δx · Δp', primary: true },
        { id: 'h2', label: 'Lower Bound ħ/2' },
        { id: 'ratio', label: 'Uncertainty Inequality Check', wide: true },
      ]);

      controls.append(X.el('div', 'ctrl-note',
        '<b>Intrinsic Quantum Property:</b> Δx·Δp ≥ ħ/2 is not caused by imperfect measuring devices. It arises directly from Fourier wave superposition: localizing a wave packet in position requires combining a broader spectrum of momentum components.'
      ));

      ui.svgRefs = { dynLayer, posBadge, momBadge };
    }

    function updateReadouts() {
      if (!ui.readouts) return;
      const u = calcUncertainty();
      ui.readouts.set('dx', `${u.dxNm.toFixed(2)} nm (${X.fmtSci(u.dxM, 2)} m)`);
      ui.readouts.set('dp', `${X.fmtSci(u.dpSI, 3)} kg·m/s (${u.dpKeVc.toFixed(3)} keV/c)`);
      ui.readouts.set('prod', `${X.fmtSci(u.productSI, 3)} J·s`);
      ui.readouts.set('h2', `${X.fmtSci(u.minProduct, 3)} J·s`);
      ui.readouts.set('ratio', state.chirpBeta < 0.01
        ? `Minimum-uncertainty Gaussian: Δx·Δp = 1.000 × (ħ/2) ✓`
        : `Broadened state: Δx·Δp = ${u.ratioToMin.toFixed(3)} × (ħ/2) > ħ/2 ✓`);

      formula.innerHTML = `
        <span class="formula active">Δx · Δp = <span class="fv">${X.fmtSci(u.productSI, 3)} J·s</span> = <span class="fv">${u.ratioToMin.toFixed(3)} · (ħ/2)</span></span>
        <span class="formula">ħ/2 = <span class="fv">${X.fmtSci(u.minProduct, 3)} J·s</span></span>
        <span class="formula">Δp = <span class="fv">${state.chirpBeta === 0 ? 'ħ / (2Δx)' : '√(1+β²)·ħ/(2Δx)'}</span></span>`;
    }

    function updateBanner() {
      if (!banner) return;
      const u = calcUncertainty();
      if (state.chirpBeta < 0.01) {
        banner.set(
          'GAUSSIAN MINIMUM ħ/2',
          'ok',
          `At <b>Δx = ${u.dxNm.toFixed(2)} nm</b>, conjugate Fourier width gives <b>Δp = ${X.fmtSci(u.dpSI, 2)} kg·m/s</b> so <b>Δx·Δp = ħ/2</b> exactly.`
        );
      } else {
        banner.set(
          'Δx · Δp > ħ/2',
          '',
          `Phase chirp β = ${state.chirpBeta.toFixed(2)} adds extra momentum spread without narrowing position, giving <b>Δx·Δp = ${u.ratioToMin.toFixed(2)} × (ħ/2)</b>.`
        );
      }
    }

    function buildGaussPath(xArr, yArr, baseLineY) {
      let d = '';
      for (let i = 0; i < xArr.length; i++) {
        d += (i === 0 ? `M ${xArr[i].toFixed(1)} ${yArr[i].toFixed(1)}` : ` L ${xArr[i].toFixed(1)} ${yArr[i].toFixed(1)}`);
      }
      const area = d + ` L ${xArr[xArr.length - 1].toFixed(1)} ${baseLineY.toFixed(1)} L ${xArr[0].toFixed(1)} ${baseLineY.toFixed(1)} Z`;
      return { line: d, area };
    }

    function render() {
      if (!ui.svgRefs) return;
      const { dynLayer, posBadge, momBadge } = ui.svgRefs;
      dynLayer.innerHTML = '';

      const u = calcUncertainty();
      posBadge.textContent = `Δx = ${u.dxNm.toFixed(2)} nm`;
      momBadge.textContent = `Δp = ${X.fmtSci(u.dpSI, 2)} kg·m/s`;

      // Plot bounds
      const x0 = 64, x1 = 772, plotW = x1 - x0;

      /* ---- 1. POSITION SPACE PLOT ---- */
      const pBase = 216, pTop = 58, pH = pBase - pTop;
      const xRangeNm = 2.6; // -2.6 to +2.6 nm
      const PX = (xNm) => x0 + ((xNm + xRangeNm) / (2 * xRangeNm)) * plotW;

      // Axes
      dynLayer.append(svgEl('line', { x1: x0, y1: pBase, x2: x1, y2: pBase, stroke: 'rgba(255,255,255,0.22)', 'stroke-width': '1.2' }));
      dynLayer.append(svgEl('line', { x1: PX(0), y1: pTop, x2: PX(0), y2: pBase, stroke: 'rgba(255,255,255,0.12)', 'stroke-dasharray': '3 3' }));

      // Reference narrow (0.10 nm) and broad (0.85 nm) comparison ghosts
      const maxPosAmp = 1 / Math.sqrt(2 * Math.PI * 0.08 * 0.08);
      const drawPosCurve = (sigma, stroke, fill, dashed) => {
        const xs = [], ys = [];
        const peak = 1 / (Math.sqrt(2 * Math.PI) * sigma);
        const normPeak = Math.min(1.0, (peak / maxPosAmp) * 2.2 + 0.16);
        for (let i = 0; i <= 180; i++) {
          const xNm = -xRangeNm + (i / 180) * (2 * xRangeNm);
          const g = Math.exp(-(xNm * xNm) / (2 * sigma * sigma));
          xs.push(PX(xNm));
          ys.push(pBase - g * normPeak * pH);
        }
        const paths = buildGaussPath(xs, ys, pBase);
        if (fill) dynLayer.append(svgEl('path', { d: paths.area, fill }));
        dynLayer.append(svgEl('path', {
          d: paths.line,
          fill: 'none',
          stroke,
          'stroke-width': dashed ? '1.4' : '2.6',
          'stroke-dasharray': dashed ? '5 4' : 'none',
        }));
        return normPeak;
      };

      if (state.showCompareRef) {
        drawPosCurve(0.10, 'rgba(224,181,83,0.55)', null, true);
        drawPosCurve(0.85, 'rgba(165,180,252,0.55)', null, true);
      }

      // Shaded +/- Delta x band
      const xLeft = PX(-u.dxNm), xRight = PX(u.dxNm);
      dynLayer.append(svgEl('rect', { x: xLeft, y: pTop + 8, width: Math.max(2, xRight - xLeft), height: pH - 8, fill: 'rgba(34,211,238,0.10)' }));
      const activePosScale = drawPosCurve(u.dxNm, '#22d3ee', 'rgba(34,211,238,0.20)', false);

      // Re[psi(x,t)] amplitude wave overlay
      if (state.showWaveReal) {
        const tAnim = C.prefersReducedMotion() ? 0 : state.time;
        let dWave = '';
        const kWave = 3.5 + state.p0Shift * 1.4;
        const wCenter = pBase - pH * 0.44;
        for (let i = 0; i <= 200; i++) {
          const xNm = -xRangeNm + (i / 200) * (2 * xRangeNm);
          const env = Math.exp(-(xNm * xNm) / (4 * u.dxNm * u.dxNm));
          const chirpPhase = 0.5 * state.chirpBeta * (xNm * xNm) / (u.dxNm * u.dxNm);
          const psiR = env * Math.cos(kWave * xNm + chirpPhase - tAnim * 3.2);
          const py = wCenter - psiR * (pH * 0.36 * Math.sqrt(activePosScale));
          dWave += (i === 0 ? `M ${PX(xNm).toFixed(1)} ${py.toFixed(1)}` : ` L ${PX(xNm).toFixed(1)} ${py.toFixed(1)}`);
        }
        dynLayer.append(svgEl('path', { d: dWave, fill: 'none', stroke: 'rgba(52,211,153,0.75)', 'stroke-width': '1.5' }));
      }

      // +/- Delta x caliper bracket
      const bY = pTop + 14;
      dynLayer.append(svgEl('line', { x1: xLeft, y1: bY, x2: xRight, y2: bY, stroke: '#22d3ee', 'stroke-width': '1.5' }));
      dynLayer.append(svgEl('line', { x1: xLeft, y1: bY - 4, x2: xLeft, y2: bY + 4, stroke: '#22d3ee', 'stroke-width': '1.5' }));
      dynLayer.append(svgEl('line', { x1: xRight, y1: bY - 4, x2: xRight, y2: bY + 4, stroke: '#22d3ee', 'stroke-width': '1.5' }));
      const dxLbl = svgEl('text', { x: PX(0), y: bY - 5, 'text-anchor': 'middle', fill: '#22d3ee', 'font-size': '10.5', 'font-weight': '600', 'font-family': 'JetBrains Mono, monospace' });
      dxLbl.textContent = `2Δx = ${(2 * u.dxNm).toFixed(2)} nm`;
      dynLayer.append(dxLbl);

      [-2, -1, 0, 1, 2].forEach((xv) => {
        const tx = svgEl('text', { x: PX(xv), y: pBase + 15, 'text-anchor': 'middle', fill: '#8f9cb5', 'font-size': '10', 'font-family': 'JetBrains Mono, monospace' });
        tx.textContent = xv + ' nm';
        dynLayer.append(tx);
      });

      /* ---- 2. MOMENTUM SPACE PLOT ---- */
      const mBase = 456, mTop = 302, mH = mBase - mTop;
      // Momentum axis in units of 10^-25 kg*m/s: range [-11, +11]
      const pRange = 11.0;
      const PMX = (pScaled) => x0 + ((pScaled + pRange) / (2 * pRange)) * plotW;
      const dpScaled = u.dpSI * 1e25;
      const p0Scaled = state.p0Shift;

      dynLayer.append(svgEl('line', { x1: x0, y1: mBase, x2: x1, y2: mBase, stroke: 'rgba(255,255,255,0.22)', 'stroke-width': '1.2' }));
      dynLayer.append(svgEl('line', { x1: PMX(p0Scaled), y1: mTop, x2: PMX(p0Scaled), y2: mBase, stroke: 'rgba(255,255,255,0.12)', 'stroke-dasharray': '3 3' }));

      const drawMomCurve = (sigmaPScaled, centerScaled, stroke, fill, dashed) => {
        const xs = [], ys = [];
        // Scale height cleanly inversely with width so narrowing dp visibly grows taller!
        const normPeak = X.clamp(0.18 + 0.65 / Math.max(0.45, sigmaPScaled), 0.14, 0.94);
        for (let i = 0; i <= 200; i++) {
          const pv = -pRange + (i / 200) * (2 * pRange);
          const g = Math.exp(-Math.pow(pv - centerScaled, 2) / (2 * sigmaPScaled * sigmaPScaled));
          xs.push(PMX(pv));
          ys.push(mBase - g * normPeak * mH);
        }
        const paths = buildGaussPath(xs, ys, mBase);
        if (fill) dynLayer.append(svgEl('path', { d: paths.area, fill }));
        dynLayer.append(svgEl('path', {
          d: paths.line,
          fill: 'none',
          stroke,
          'stroke-width': dashed ? '1.4' : '2.6',
          'stroke-dasharray': dashed ? '5 4' : 'none',
        }));
      };

      if (state.showCompareRef) {
        const dpNarrow = ((P.hbar / 2) / (0.10 * 1e-9)) * 1e25; // wide in p!
        const dpBroad = ((P.hbar / 2) / (0.85 * 1e-9)) * 1e25;  // narrow in p!
        drawMomCurve(dpNarrow, p0Scaled, 'rgba(224,181,83,0.55)', null, true);
        drawMomCurve(dpBroad, p0Scaled, 'rgba(165,180,252,0.55)', null, true);
      }

      const mLeft = Math.max(x0, PMX(p0Scaled - dpScaled));
      const mRight = Math.min(x1, PMX(p0Scaled + dpScaled));
      dynLayer.append(svgEl('rect', { x: mLeft, y: mTop + 8, width: Math.max(2, mRight - mLeft), height: mH - 8, fill: 'rgba(244,114,182,0.10)' }));
      drawMomCurve(dpScaled, p0Scaled, '#f472b6', 'rgba(244,114,182,0.22)', false);

      const mbY = mTop + 14;
      dynLayer.append(svgEl('line', { x1: mLeft, y1: mbY, x2: mRight, y2: mbY, stroke: '#f472b6', 'stroke-width': '1.5' }));
      dynLayer.append(svgEl('line', { x1: mLeft, y1: mbY - 4, x2: mLeft, y2: mbY + 4, stroke: '#f472b6', 'stroke-width': '1.5' }));
      dynLayer.append(svgEl('line', { x1: mRight, y1: mbY - 4, x2: mRight, y2: mbY + 4, stroke: '#f472b6', 'stroke-width': '1.5' }));
      const dpLbl = svgEl('text', { x: PMX(p0Scaled), y: mbY - 5, 'text-anchor': 'middle', fill: '#f472b6', 'font-size': '10.5', 'font-weight': '600', 'font-family': 'JetBrains Mono, monospace' });
      dpLbl.textContent = `2Δp = ${(2 * dpScaled).toFixed(2)}×10⁻²⁵ kg·m/s`;
      dynLayer.append(dpLbl);

      if (state.showCompareRef) {
        const leg = svgEl('text', { x: 40, y: 492, fill: '#94a3b8', 'font-size': '9.5', 'font-family': 'Inter, sans-serif' });
        leg.textContent = 'Dashed reference curves: Narrow Δx (0.10 nm, gold) vs Broad Δx (0.85 nm, lavender)';
        dynLayer.append(leg);
      }

      [-10, -5, 0, 5, 10].forEach((pv) => {
        const tx = svgEl('text', { x: PMX(pv), y: mBase + 15, 'text-anchor': 'middle', fill: '#8f9cb5', 'font-size': '10', 'font-family': 'JetBrains Mono, monospace' });
        tx.textContent = pv === 0 ? '0' : `${pv}e-25`;
        dynLayer.append(tx);
      });
    }

    function applyPreset(preset) {
      if (preset === 'narrow') {
        state.dxNm = 0.10;
        state.chirpBeta = 0.0;
      } else if (preset === 'broad') {
        state.dxNm = 0.85;
        state.chirpBeta = 0.0;
      } else if (preset === 'chirped') {
        state.dxNm = 0.30;
        state.chirpBeta = 1.4;
      } else {
        state.dxNm = 0.30;
        state.chirpBeta = 0.0;
      }
      if (ui.dxSlider) ui.dxSlider.setValue(state.dxNm);
      if (ui.chirpSlider) ui.chirpSlider.setValue(state.chirpBeta);
      updateReadouts();
      updateBanner();
      render();
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
        if (state.playing && state.showWaveReal) {
          state.time += dt;
          render();
        }
      },
      resize() {
        render();
      },
      applyPreset,
      calcUncertainty,
      getState: () => state,
    };
  };
})();
