(function () {
  'use strict';

  const C = window.Ch2Platform;
  const X = window.XLab;

  window.CH2_SIMS['c2t6'] = function createFibreRayLab(ctxDom) {
    const { stage, controls, formula, wrap, dot } = ctxDom;
    const svgEl = C.svgEl;
    const P = C.PHYSICS;

    const state = {
      mode: 'tir',            // 'tir' | 'acceptance' | 'na' | 'types'
      playing: true,
      n0: 1.000,              // External medium index (1.000 Air, 1.333 Water, slider 1.00..1.45)
      n1: 1.480,              // Core refractive index
      n2: 1.450,              // Cladding refractive index
      boundaryAngle: 80.5,    // Mode A: angle of incidence at core-cladding boundary (deg, 55..88)
      launchAngle: 12.0,      // Mode B/C: external launch angle at fibre face (deg, 0..65)
      fibreType: 'multimode', // Mode D: 'single' | 'multimode' | 'step' | 'graded'
      pulseT: 0,              // animation parameter 0..1
      time: 0,
    };

    let built = false;
    let ui = {};
    let banner = null;
    let subtabBar = null;

    function calcOptics() {
      const validGuide = state.n1 > state.n2 + 0.0005;
      const ratio = validGuide ? state.n2 / state.n1 : 1;
      const thetaC = validGuide ? Math.asin(X.clamp(ratio, 0, 1)) * P.radToDeg : 90;
      const naFibre = validGuide ? Math.sqrt(Math.max(0, state.n1 * state.n1 - state.n2 * state.n2)) : 0;
      const sinThetaMax = validGuide ? Math.min(1, naFibre / Math.max(state.n0, 1)) : 0;
      const thetaMax = Math.asin(sinThetaMax) * P.radToDeg;
      const naFromCone = state.n0 * Math.sin(thetaMax * P.degToRad);

      // Determine active boundary incidence & refraction angles
      let incBoundaryDeg = state.boundaryAngle;
      let launchDeg = state.launchAngle;
      let coreAxisDeg = 90 - incBoundaryDeg;

      if (state.mode === 'acceptance' || state.mode === 'na') {
        const sinThetaR = X.clamp((state.n0 / state.n1) * Math.sin(launchDeg * P.degToRad), 0, 0.9999);
        coreAxisDeg = Math.asin(sinThetaR) * P.radToDeg;
        incBoundaryDeg = 90 - coreAxisDeg;
      } else if (state.mode === 'tir') {
        // Compute corresponding external launch angle if valid
        const sinCoreAxis = Math.sin((90 - incBoundaryDeg) * P.degToRad);
        const sinExt = X.clamp((state.n1 / state.n0) * sinCoreAxis, 0, 1);
        launchDeg = Math.asin(sinExt) * P.radToDeg;
      }

      let regime = 'guided'; // 'guided' | 'critical' | 'refract' | 'invalid'
      if (!validGuide) {
        regime = 'invalid';
      } else if (Math.abs(incBoundaryDeg - thetaC) <= 0.35) {
        regime = 'critical';
      } else if (incBoundaryDeg > thetaC) {
        regime = 'guided';
      } else {
        regime = 'refract';
      }

      let cladAngleDeg = 90;
      if (validGuide && incBoundaryDeg < thetaC) {
        const sinClad = X.clamp((state.n1 / state.n2) * Math.sin(incBoundaryDeg * P.degToRad), 0, 1);
        cladAngleDeg = Math.asin(sinClad) * P.radToDeg;
      }

      return {
        validGuide,
        thetaC,
        naFibre,
        naFromCone,
        thetaMax,
        fullCone: thetaMax * 2,
        incBoundaryDeg,
        coreAxisDeg,
        launchDeg,
        cladAngleDeg,
        regime,
      };
    }

    function resetSimulation(keepMode) {
      state.n0 = 1.000;
      state.n1 = 1.480;
      state.n2 = 1.450;
      state.boundaryAngle = 80.5;
      state.launchAngle = 12.0;
      if (!keepMode) state.fibreType = 'multimode';
      state.pulseT = 0;

      if (ui.n0Slider) ui.n0Slider.setValue(state.n0);
      if (ui.n1Slider) ui.n1Slider.setValue(state.n1);
      if (ui.n2Slider) ui.n2Slider.setValue(state.n2);
      if (ui.angBoundSlider) ui.angBoundSlider.setValue(state.boundaryAngle);
      if (ui.angLaunchSlider) ui.angLaunchSlider.setValue(state.launchAngle);
      if (ui.typeSeg) ui.typeSeg.set(state.fibreType);

      updateReadouts();
      updateBanner();
      render();
    }

    function syncControlVisibility() {
      const isTir = state.mode === 'tir';
      const isAccNa = state.mode === 'acceptance' || state.mode === 'na';
      const isTypes = state.mode === 'types';

      if (ui.angBoundWrap) ui.angBoundWrap.style.display = isTir ? 'flex' : 'none';
      if (ui.angLaunchWrap) ui.angLaunchWrap.style.display = isAccNa ? 'flex' : 'none';
      if (ui.n0Wrap) ui.n0Wrap.style.display = isAccNa ? 'flex' : 'none';
      if (ui.typeWrap) ui.typeWrap.style.display = isTypes ? 'flex' : 'none';
      if (ui.n1Wrap) ui.n1Wrap.style.display = isTypes ? 'none' : 'flex';
      if (ui.n2Wrap) ui.n2Wrap.style.display = isTypes ? 'none' : 'flex';
    }

    function buildDOM() {
      if (built) return;
      built = true;

      stage.innerHTML = '';
      controls.innerHTML = '';
      formula.innerHTML = '';

      const svg = svgEl('svg', {
        class: 'viz-svg',
        viewBox: '0 0 840 460',
        preserveAspectRatio: 'xMidYMid meet',
        role: 'img',
        'aria-label': 'Optical Fibre Cross-Section and Ray Propagation Simulator',
      });

      const defs = svgEl('defs');
      const glow = svgEl('filter', { id: 'c2t6-glow', x: '-40%', y: '-40%', width: '180%', height: '180%' });
      glow.append(svgEl('feGaussianBlur', { stdDeviation: '3', result: 'blur' }));
      const merge = svgEl('feMerge');
      merge.append(svgEl('feMergeNode', { in: 'blur' }), svgEl('feMergeNode', { in: 'SourceGraphic' }));
      glow.append(merge);
      defs.append(glow);
      svg.append(defs);

      // Main layers inside SVG (populated dynamically by render)
      const bgLayer = svgEl('g');
      const fibreLayer = svgEl('g');
      const profileLayer = svgEl('g');
      const rayLayer = svgEl('g');
      const pulseLayer = svgEl('g');
      const labelLayer = svgEl('g');
      svg.append(bgLayer, fibreLayer, profileLayer, rayLayer, pulseLayer, labelLayer);
      stage.append(svg);

      subtabBar = C.buildSubtabs(
        wrap,
        [
          { id: 'tir', label: 'A. Total Internal Reflection' },
          { id: 'acceptance', label: 'B. Acceptance Angle' },
          { id: 'na', label: 'C. Numerical Aperture' },
          { id: 'types', label: 'D. Types of Fibre' },
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

      ui.transport = C.buildTransport(controls, {
        onTogglePlay: () => {
          state.playing = !state.playing;
          ui.transport.setPlaying(state.playing);
          if (dot) dot.textContent = state.playing ? 'Live' : 'Paused';
        },
        onReset: () => resetSimulation(false),
        playLabel: 'Pause',
      });
      ui.transport.setPlaying(true);

      // Mode D Fibre Type Selector
      const typeWrap = X.el('div', 'slider-block');
      typeWrap.append(X.el('label', 'control-label', 'Optical Fibre Type'));
      controls.append(typeWrap);
      ui.typeWrap = typeWrap;
      ui.typeSeg = X.buildSegmented(typeWrap, {
        options: [
          { value: 'single', label: 'Single-Mode' },
          { value: 'multimode', label: 'Multimode' },
          { value: 'step', label: 'Step-Index' },
          { value: 'graded', label: 'Graded-Index' },
        ],
        value: state.fibreType,
        onChange: (v) => {
          state.fibreType = v;
          state.pulseT = 0;
          updateReadouts();
          updateBanner();
          render();
        },
      });

      ui.n1Slider = X.buildSlider(controls, {
        label: 'Core Refractive Index n₁',
        id: 'c2t6-n1',
        min: 1.440,
        max: 1.620,
        step: 0.005,
        value: state.n1,
        format: (v) => v.toFixed(3),
        onInput: (v) => {
          state.n1 = v;
          updateReadouts();
          updateBanner();
          render();
        },
      });
      ui.n1Wrap = ui.n1Slider.input.closest('.slider-block');

      ui.n2Slider = X.buildSlider(controls, {
        label: 'Cladding Refractive Index n₂',
        id: 'c2t6-n2',
        min: 1.350,
        max: 1.560,
        step: 0.005,
        value: state.n2,
        format: (v) => v.toFixed(3),
        onInput: (v) => {
          state.n2 = v;
          updateReadouts();
          updateBanner();
          render();
        },
      });
      ui.n2Wrap = ui.n2Slider.input.closest('.slider-block');

      ui.n0Slider = X.buildSlider(controls, {
        label: 'External Medium n₀ (Air = 1.00, Water = 1.33)',
        id: 'c2t6-n0',
        min: 1.00,
        max: 1.45,
        step: 0.01,
        value: state.n0,
        format: (v) => v.toFixed(2) + (Math.abs(v - 1.0) < 0.01 ? ' (Air)' : Math.abs(v - 1.33) < 0.02 ? ' (Water)' : ''),
        onInput: (v) => {
          state.n0 = v;
          updateReadouts();
          updateBanner();
          render();
        },
      });
      ui.n0Wrap = ui.n0Slider.input.closest('.slider-block');

      ui.angBoundSlider = X.buildSlider(controls, {
        label: 'Boundary Incidence Angle θ (to Normal)',
        id: 'c2t6-angb',
        min: 55.0,
        max: 88.0,
        step: 0.2,
        value: state.boundaryAngle,
        format: (v) => v.toFixed(1) + '°',
        onInput: (v) => {
          state.boundaryAngle = v;
          updateReadouts();
          updateBanner();
          render();
        },
      });
      ui.angBoundWrap = ui.angBoundSlider.input.closest('.slider-block');

      ui.angLaunchSlider = X.buildSlider(controls, {
        label: 'External Launch Angle θᵢ (to Axis)',
        id: 'c2t6-angl',
        min: 0.0,
        max: 55.0,
        step: 0.5,
        value: state.launchAngle,
        format: (v) => v.toFixed(1) + '°',
        onInput: (v) => {
          state.launchAngle = v;
          updateReadouts();
          updateBanner();
          render();
        },
      });
      ui.angLaunchWrap = ui.angLaunchSlider.input.closest('.slider-block');

      ui.readouts = X.buildReadouts(controls, [
        { id: 'thetac', label: 'Critical Angle θc' },
        { id: 'thetamax', label: 'Acceptance θmax / 2θmax' },
        { id: 'na', label: 'Numerical Aperture NA', primary: true },
        { id: 'status', label: 'Ray Guidance Status', wide: true },
      ]);

      ui.svg = { svg, bgLayer, fibreLayer, profileLayer, rayLayer, pulseLayer, labelLayer };
      syncControlVisibility();
    }

    function updateReadouts() {
      if (!ui.readouts) return;
      const opt = calcOptics();

      if (state.mode === 'types') {
        const typeInfo = {
          single: { tc: 'Guided Axis', tm: 'Small core (8–10 μm)', na: 'Low modal skew', st: 'Single-Mode: Only 1 path → Zero intermodal dispersion ✓' },
          multimode: { tc: opt.thetaC.toFixed(2) + '°', tm: `${opt.thetaMax.toFixed(1)}°`, na: opt.naFibre.toFixed(3), st: 'Multimode Step-Index: Steep rays lag behind axial ray (Δt skew)' },
          step: { tc: opt.thetaC.toFixed(2) + '°', tm: `${opt.thetaMax.toFixed(1)}°`, na: opt.naFibre.toFixed(3), st: 'Step-Index: Abrupt index step n₁ → n₂ causes sharp zigzag reflections' },
          graded: { tc: 'Continuous n(r)', tm: `${opt.thetaMax.toFixed(1)}°`, na: 'Parabolic n(r)', st: 'Graded-Index: Parabolic bending speeds outer rays → Equalized arrival!' },
        }[state.fibreType];

        ui.readouts.set('thetac', typeInfo.tc);
        ui.readouts.set('thetamax', typeInfo.tm);
        ui.readouts.set('na', typeInfo.na);
        ui.readouts.set('status', typeInfo.st);

        formula.innerHTML = `
          <span class="formula active">${state.fibreType === 'graded' ? 'n(r) = n₁√[1 − 2Δ(r/a)²] (Parabolic GRIN)' : 'Step-Index Profile: n(r) = n₁ (core) | n₂ (cladding)'}</span>
          <span class="formula">Pulse Arrival: <span class="fv">${state.fibreType === 'single' ? 'Single pulse (minimal spread)' : state.fibreType === 'graded' ? 'Rays converge together' : 'Axial arrives before high-angle ray'}</span></span>`;
        return;
      }

      if (!opt.validGuide) {
        ui.readouts.set('thetac', 'Undefined (n₁ ≤ n₂)');
        ui.readouts.set('thetamax', '0.0°');
        ui.readouts.set('na', '0.000');
        ui.readouts.set('status', 'Invalid Core/Cladding: TIR requires n₁ > n₂ ✗');
      } else {
        ui.readouts.set('thetac', opt.thetaC.toFixed(2) + '°');
        ui.readouts.set('thetamax', `${opt.thetaMax.toFixed(2)}° (Cone ${(opt.fullCone).toFixed(1)}°)`);
        ui.readouts.set('na', `${opt.naFibre.toFixed(3)} (n₀sinθmax = ${opt.naFromCone.toFixed(3)})`);

        if (state.mode === 'tir') {
          if (opt.regime === 'guided') ui.readouts.set('status', `Total Internal Reflection ✓ (θ = ${opt.incBoundaryDeg.toFixed(1)}° > θc)`);
          else if (opt.regime === 'critical') ui.readouts.set('status', `Critical Angle Condition (θ ≈ θc = ${opt.thetaC.toFixed(1)}°)`);
          else ui.readouts.set('status', `Refracted into Cladding ✗ (θ = ${opt.incBoundaryDeg.toFixed(1)}° < θc)`);
        } else {
          const accepted = opt.launchDeg <= opt.thetaMax + 0.05;
          ui.readouts.set('status', accepted
            ? `ACCEPTED ✓ (θᵢ = ${opt.launchDeg.toFixed(1)}° ≤ θmax = ${opt.thetaMax.toFixed(1)}°)`
            : `REJECTED ✗ (θᵢ = ${opt.launchDeg.toFixed(1)}° > θmax = ${opt.thetaMax.toFixed(1)}°)`);
        }
      }

      formula.innerHTML = `
        <span class="formula ${opt.validGuide ? 'active' : ''}">θ<sub>c</sub> = sin⁻¹(n₂/n₁) = <span class="fv">${opt.validGuide ? opt.thetaC.toFixed(2) + '°' : '—'}</span></span>
        <span class="formula">NA = n₀ sin(θ<sub>max</sub>) = <span class="fv">${opt.naFromCone.toFixed(3)}</span> · √(n₁²−n₂²) = <span class="fv">${opt.naFibre.toFixed(3)}</span></span>
        <span class="formula">Acceptance Cone: 2θ<sub>max</sub> = <span class="fv">${opt.fullCone.toFixed(1)}°</span></span>`;
    }

    function updateBanner() {
      if (!banner) return;
      const opt = calcOptics();
      if (state.mode === 'types') {
        const msg = {
          single: '<b>Single-Mode Fibre:</b> Narrow core restricts light to one axial path, preventing intermodal time spread over long distances.',
          multimode: '<b>Multimode Step-Index:</b> Multiple guided rays zigzag at different angles; steeper rays travel farther and arrive <b>later</b>.',
          step: '<b>Step-Index Fibre:</b> Sharp boundary between core (n₁) and cladding (n₂) causes straight segments with discrete TIR bounces.',
          graded: '<b>Graded-Index (GRIN):</b> Parabolic n(r) bends rays smoothly in curves. Outer rays travel faster in lower-index regions so arrival times <b>equalize</b>.',
        }[state.fibreType];
        banner.set('MODE D · FIBRE TYPES', 'ok', msg);
        return;
      }
      if (!opt.validGuide) {
        banner.set('NO TIR', 'warn', 'Core refractive index must exceed cladding index (<b>n₁ &gt; n₂</b>) for Total Internal Reflection to occur.');
      } else if (state.mode === 'tir') {
        if (opt.regime === 'guided') {
          banner.set('TIR GUIDED', 'ok', `Boundary angle <b>θ = ${opt.incBoundaryDeg.toFixed(1)}° &gt; θc (${opt.thetaC.toFixed(1)}°)</b>: 100% of ray energy reflects inside the core!`);
        } else if (opt.regime === 'critical') {
          banner.set('CRITICAL ANGLE', '', `At <b>θ = θc = ${opt.thetaC.toFixed(1)}°</b>, the refracted ray grazes strictly along the core–cladding boundary (90°).`);
        } else {
          banner.set('REFRACTION LOSS', 'warn', `Since <b>θ = ${opt.incBoundaryDeg.toFixed(1)}° &lt; θc (${opt.thetaC.toFixed(1)}°)</b>, light refracts out into the cladding (Snell angle ${opt.cladAngleDeg.toFixed(1)}°).`);
        }
      } else {
        const acc = opt.launchDeg <= opt.thetaMax + 0.05;
        banner.set(
          acc ? 'RAY ACCEPTED' : 'RAY REJECTED',
          acc ? 'ok' : 'warn',
          acc
            ? `Launch angle <b>θᵢ = ${opt.launchDeg.toFixed(1)}°</b> lies inside the acceptance cone (<b>θmax = ${opt.thetaMax.toFixed(1)}°</b>) → guided via TIR!`
            : `Launch angle <b>θᵢ = ${opt.launchDeg.toFixed(1)}°</b> exceeds acceptance angle <b>θmax = ${opt.thetaMax.toFixed(1)}°</b> → fails TIR and escapes into cladding.`
        );
      }
    }

    function pointOnPolyline(pts, t) {
      if (pts.length < 2) return pts[0] || { x: 0, y: 0 };
      const segs = [];
      let total = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const d = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
        segs.push(d);
        total += d;
      }
      let target = X.clamp(t, 0, 1) * total;
      for (let i = 0; i < segs.length; i++) {
        if (target <= segs[i] || i === segs.length - 1) {
          const frac = segs[i] > 0 ? target / segs[i] : 0;
          return {
            x: X.lerp(pts[i].x, pts[i + 1].x, frac),
            y: X.lerp(pts[i].y, pts[i + 1].y, frac),
          };
        }
        target -= segs[i];
      }
      return pts[pts.length - 1];
    }

    function render() {
      if (!ui.svg) return;
      const { bgLayer, fibreLayer, profileLayer, rayLayer, pulseLayer, labelLayer } = ui.svg;
      bgLayer.innerHTML = '';
      fibreLayer.innerHTML = '';
      profileLayer.innerHTML = '';
      rayLayer.innerHTML = '';
      pulseLayer.innerHTML = '';
      labelLayer.innerHTML = '';

      const opt = calcOptics();

      // Fibre Cross-Section Geometry (SVG 840x460)
      const faceX = 240;
      const endX = 805;
      const cy = 232;

      const isSingle = state.mode === 'types' && state.fibreType === 'single';
      const coreHalf = isSingle ? 20 : 66;
      const cladHalf = 114;
      const bufHalf = 142;

      // Top title
      const hdr = svgEl('text', { x: 24, y: 30, fill: '#edf1f8', 'font-size': '13', 'font-weight': '700', 'font-family': 'Inter, sans-serif' });
      hdr.textContent = state.mode === 'types'
        ? `OPTICAL FIBRE PROPAGATION — ${state.fibreType.toUpperCase()} PROFILE`
        : 'OPTICAL FIBRE CROSS-SECTION & RAY LABORATORY';
      bgLayer.append(hdr);

      // External medium box (left of faceX)
      fibreLayer.append(svgEl('rect', {
        x: 20, y: cy - bufHalf, width: faceX - 20, height: bufHalf * 2,
        fill: state.n0 > 1.05 ? 'rgba(56,189,248,0.08)' : 'rgba(255,255,255,0.02)',
        stroke: 'rgba(255,255,255,0.07)', rx: 6,
      }));
      const n0Txt = svgEl('text', { x: 32, y: cy - bufHalf + 20, fill: '#8f9cb5', 'font-size': '11', 'font-family': 'JetBrains Mono, monospace' });
      n0Txt.textContent = `External n₀ = ${state.n0.toFixed(2)}`;
      labelLayer.append(n0Txt);

      // Outer Buffer Jacket (top & bottom)
      fibreLayer.append(svgEl('rect', { x: faceX, y: cy - bufHalf, width: endX - faceX, height: bufHalf - cladHalf, fill: 'rgba(100,116,139,0.34)', stroke: 'rgba(148,163,184,0.38)' }));
      fibreLayer.append(svgEl('rect', { x: faceX, y: cy + cladHalf, width: endX - faceX, height: bufHalf - cladHalf, fill: 'rgba(100,116,139,0.34)', stroke: 'rgba(148,163,184,0.38)' }));

      // Cladding (top & bottom)
      fibreLayer.append(svgEl('rect', { x: faceX, y: cy - cladHalf, width: endX - faceX, height: cladHalf - coreHalf, fill: 'rgba(99,102,241,0.16)', stroke: 'rgba(129,140,248,0.4)' }));
      fibreLayer.append(svgEl('rect', { x: faceX, y: cy + coreHalf, width: endX - faceX, height: cladHalf - coreHalf, fill: 'rgba(99,102,241,0.16)', stroke: 'rgba(129,140,248,0.4)' }));

      // Core (graded or step shading)
      if (state.mode === 'types' && state.fibreType === 'graded') {
        const defs = ui.svg.svg.querySelector('defs');
        let grad = document.getElementById('c2t6-grin-grad');
        if (!grad) {
          grad = svgEl('linearGradient', { id: 'c2t6-grin-grad', x1: '0%', y1: '0%', x2: '0%', y2: '100%' });
          grad.append(
            svgEl('stop', { offset: '0%', 'stop-color': 'rgba(34,211,238,0.08)' }),
            svgEl('stop', { offset: '50%', 'stop-color': 'rgba(34,211,238,0.32)' }),
            svgEl('stop', { offset: '100%', 'stop-color': 'rgba(34,211,238,0.08)' })
          );
          defs.append(grad);
        }
        fibreLayer.append(svgEl('rect', { x: faceX, y: cy - coreHalf, width: endX - faceX, height: coreHalf * 2, fill: 'url(#c2t6-grin-grad)', stroke: 'rgba(34,211,238,0.5)' }));
      } else {
        fibreLayer.append(svgEl('rect', { x: faceX, y: cy - coreHalf, width: endX - faceX, height: coreHalf * 2, fill: 'rgba(34,211,238,0.18)', stroke: '#22d3ee', 'stroke-width': '1.4' }));
      }

      // Optical Axis
      fibreLayer.append(svgEl('line', { x1: 30, y1: cy, x2: endX, y2: cy, stroke: 'rgba(255,255,255,0.22)', 'stroke-dasharray': '6 5' }));

      // Layer Labels on right side of cross-section
      const addLayerTag = (txt, y, col) => {
        const t = svgEl('text', { x: endX - 10, y, 'text-anchor': 'end', fill: col, 'font-size': '10.5', 'font-weight': '600', 'font-family': 'Inter, sans-serif' });
        t.textContent = txt;
        labelLayer.append(t);
      };
      addLayerTag('Buffer Jacket', cy - bufHalf + 18, '#cbd5e1');
      addLayerTag(`Cladding (n₂ = ${state.n2.toFixed(3)})`, cy - cladHalf + 22, '#a5b4fc');
      addLayerTag(`Core (n₁ = ${state.n1.toFixed(3)})`, cy - coreHalf + (isSingle ? 14 : 20), '#22d3ee');

      // Refractive Index Profile n(r) on far left (x: 28..96)
      const profX = 34, profW = 62;
      profileLayer.append(svgEl('rect', { x: profX, y: cy - cladHalf, width: profW, height: cladHalf * 2, fill: 'rgba(6,10,24,0.65)', stroke: 'rgba(255,255,255,0.14)', rx: 4 }));
      const pTit = svgEl('text', { x: profX + profW / 2, y: cy - cladHalf - 6, 'text-anchor': 'middle', fill: '#8f9cb5', 'font-size': '9.5', 'font-weight': '600', 'font-family': 'Inter, sans-serif' });
      pTit.textContent = 'n(r) Profile';
      profileLayer.append(pTit);

      const xN2 = profX + 12, xN1 = profX + profW - 10;
      if (state.mode === 'types' && state.fibreType === 'graded') {
        let d = `M ${xN2} ${cy - cladHalf + 4} L ${xN2} ${cy - coreHalf} `;
        for (let i = 0; i <= 24; i++) {
          const r = -1 + (2 * i) / 24;
          const py = cy + r * coreHalf;
          const px = xN2 + (1 - r * r) * (xN1 - xN2);
          d += `L ${px.toFixed(1)} ${py.toFixed(1)} `;
        }
        d += `L ${xN2} ${cy + cladHalf - 4}`;
        profileLayer.append(svgEl('path', { d, fill: 'none', stroke: '#34d399', 'stroke-width': '2.2' }));
      } else {
        const d = `M ${xN2} ${cy - cladHalf + 4} L ${xN2} ${cy - coreHalf} L ${xN1} ${cy - coreHalf} L ${xN1} ${cy + coreHalf} L ${xN2} ${cy + coreHalf} L ${xN2} ${cy + cladHalf - 4}`;
        profileLayer.append(svgEl('path', { d, fill: 'none', stroke: '#22d3ee', 'stroke-width': '2.2' }));
      }

      // ================= MODE-SPECIFIC RAY & CONE RENDERING =================
      if (state.mode === 'types') {
        // Draw Mode D: Multiple rays or GRIN waves + Arrival Time Race!
        const raceX = endX - 6;
        if (state.fibreType === 'single') {
          const pts = [{ x: 130, y: cy }, { x: endX, y: cy }];
          rayLayer.append(svgEl('line', { x1: 130, y1: cy, x2: endX, y2: cy, stroke: '#34d399', 'stroke-width': '3', filter: 'url(#c2t6-glow)' }));
          const p = pointOnPolyline(pts, state.pulseT);
          pulseLayer.append(svgEl('circle', { cx: p.x, cy: p.y, r: 5.5, fill: '#34d399', stroke: '#fff', 'stroke-width': '1.2' }));
        } else if (state.fibreType === 'graded') {
          // Axial ray + 2 sinusoidal GRIN paths arriving together!
          const rays = [
            { amp: 0, col: '#22d3ee', label: 'Axial' },
            { amp: coreHalf * 0.52, col: '#34d399', label: 'Mid' },
            { amp: coreHalf * 0.86, col: '#e0b553', label: 'Outer (faster)' },
          ];
          rays.forEach((r) => {
            let d = `M 140 ${cy} L ${faceX} ${cy} `;
            const steps = 80;
            for (let i = 0; i <= steps; i++) {
              const frac = i / steps;
              const rx = X.lerp(faceX, endX, frac);
              const ry = cy - Math.sin(frac * Math.PI * 3.5) * r.amp;
              d += `L ${rx.toFixed(1)} ${ry.toFixed(1)} `;
            }
            rayLayer.append(svgEl('path', { d, fill: 'none', stroke: r.col, 'stroke-width': '2.2', opacity: '0.9' }));

            // Nearly equalized arrival times!
            const tScaled = X.clamp(state.pulseT * (r.amp > 0 ? 0.99 : 1.0), 0, 1);
            const px = X.lerp(faceX, raceX, tScaled);
            const py = cy - Math.sin(tScaled * Math.PI * 3.5) * r.amp;
            pulseLayer.append(svgEl('circle', { cx: px, cy: py, r: 4.8, fill: r.col, stroke: '#fff', 'stroke-width': '1' }));
          });
        } else {
          // Multimode or Step-Index: 3 straight zigzag rays with genuine optical path length difference!
          const configs = [
            { slope: 0, col: '#22d3ee', speedFactor: 1.0 },
            { slope: 0.24, col: '#e0b553', speedFactor: 1 / Math.sqrt(1 + 0.24 * 0.24) },
            { slope: 0.48, col: '#ff6b81', speedFactor: 1 / Math.sqrt(1 + 0.48 * 0.48) },
          ];
          configs.forEach((cfg) => {
            const pts = [{ x: 140, y: cy - (cfg.slope > 0 ? 18 : 0) }, { x: faceX, y: cy }];
            if (cfg.slope === 0) {
              pts.push({ x: endX, y: cy });
            } else {
              let x = faceX, y = cy, dir = -1;
              while (x < endX) {
                const targetY = dir < 0 ? cy - coreHalf : cy + coreHalf;
                const dx = Math.abs(targetY - y) / cfg.slope;
                if (x + dx >= endX) {
                  const rem = endX - x;
                  pts.push({ x: endX, y: y + dir * rem * cfg.slope });
                  break;
                }
                x += dx;
                y = targetY;
                pts.push({ x, y });
                dir *= -1;
              }
            }
            const dStr = pts.map((pt, i) => (i === 0 ? 'M' : 'L') + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1)).join(' ');
            rayLayer.append(svgEl('path', { d: dStr, fill: 'none', stroke: cfg.col, 'stroke-width': '2.2', opacity: '0.9' }));

            // Pulse lags proportional to 1 / cos(theta) = path length factor!
            const p = pointOnPolyline(pts, X.clamp(state.pulseT * cfg.speedFactor, 0, 1));
            pulseLayer.append(svgEl('circle', { cx: p.x, cy: p.y, r: 4.8, fill: cfg.col, stroke: '#fff', 'stroke-width': '1' }));
          });
        }

        const raceNote = svgEl('text', { x: 525, y: 424, 'text-anchor': 'middle', fill: '#edf1f8', 'font-size': '11.5', 'font-family': 'Inter, sans-serif' });
        raceNote.textContent = state.fibreType === 'graded'
          ? 'Watch pulse dots: parabolic refractive index keeps outer and axial pulses synchronized!'
          : state.fibreType === 'single'
            ? 'Single-mode: one fundamental ray → zero intermodal arrival delay.'
            : 'Watch pulse dots: steeper zigzag rays travel longer geometric paths and lag behind the axial ray.';
        labelLayer.append(raceNote);
        return;
      }

      // ================= MODES A, B, C: EXACT SNELL + TIR RAY TRACE =================
      // Draw Acceptance Cone in front of fibre entry (especially prominent in Modes B & C!)
      if (opt.validGuide && opt.thetaMax > 0.5) {
        const coneLen = 115;
        const coneAng = Math.min(opt.thetaMax, 68) * P.degToRad;
        const cTopY = cy - Math.tan(coneAng) * coneLen;
        const cBotY = cy + Math.tan(coneAng) * coneLen;
        const coneX = faceX - coneLen;
        rayLayer.append(svgEl('polygon', {
          points: `${faceX},${cy} ${coneX},${cTopY.toFixed(1)} ${coneX},${cBotY.toFixed(1)}`,
          fill: state.mode === 'tir' ? 'rgba(52,211,153,0.07)' : 'rgba(34,211,238,0.16)',
          stroke: 'rgba(34,211,238,0.45)',
          'stroke-dasharray': '4 3',
        }));
        const coneLbl = svgEl('text', { x: faceX - 88, y: cTopY - 6, 'text-anchor': 'middle', fill: '#22d3ee', 'font-size': '10', 'font-weight': '600', 'font-family': 'JetBrains Mono, monospace' });
        coneLbl.textContent = `2θmax = ${opt.fullCone.toFixed(1)}°`;
        labelLayer.append(coneLbl);
      }

      // Compute Incident Ray from external medium hitting entry face at (faceX, cy)
      const launchRad = opt.launchDeg * P.degToRad;
      const inLen = 118;
      const inStartX = faceX - Math.cos(launchRad) * inLen;
      const inStartY = cy + Math.sin(launchRad) * inLen;
      const entryPt = { x: faceX, y: cy };

      // Core ray travels upward-right at angle coreAxisDeg to axis
      const axisRad = Math.max(0.015, opt.coreAxisDeg * P.degToRad);
      const hit1X = faceX + coreHalf / Math.tan(axisRad);

      // Draw External Incident Ray
      rayLayer.append(svgEl('line', {
        x1: inStartX.toFixed(1), y1: inStartY.toFixed(1),
        x2: faceX, y2: cy,
        stroke: '#fde047', 'stroke-width': '2.8', filter: 'url(#c2t6-glow)',
      }));

      const rayPts = [{ x: inStartX, y: inStartY }, entryPt];

      if (opt.regime === 'guided') {
        // Full zigzag TIR path inside core!
        let x = faceX, y = cy, dir = -1;
        let firstBounce = null;
        while (x < endX) {
          const targetY = dir < 0 ? cy - coreHalf : cy + coreHalf;
          const dx = Math.abs(targetY - y) / Math.tan(axisRad);
          if (x + dx >= endX) {
            const rem = endX - x;
            rayPts.push({ x: endX, y: y + dir * rem * Math.tan(axisRad) });
            break;
          }
          x += dx;
          y = targetY;
          if (!firstBounce && x < endX - 20) firstBounce = { x, y };
          rayPts.push({ x, y });
          dir *= -1;
        }
        const pathD = rayPts.map((pt, idx) => (idx === 0 ? 'M' : 'L') + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1)).join(' ');
        rayLayer.append(svgEl('path', { d: pathD, fill: 'none', stroke: '#34d399', 'stroke-width': '2.8', filter: 'url(#c2t6-glow)' }));

        // Draw Normal & θ vs θc at first bounce
        if (firstBounce) {
          rayLayer.append(svgEl('line', {
            x1: firstBounce.x, y1: firstBounce.y - 40, x2: firstBounce.x, y2: firstBounce.y + 40,
            stroke: 'rgba(255,255,255,0.45)', 'stroke-dasharray': '3 3',
          }));
          // Critical angle reference dashed ray
          const cRad = opt.thetaC * P.degToRad;
          rayLayer.append(svgEl('line', {
            x1: firstBounce.x, y1: firstBounce.y,
            x2: firstBounce.x - Math.sin(cRad) * 44, y2: firstBounce.y + Math.cos(cRad) * 44,
            stroke: '#e0b553', 'stroke-dasharray': '3 2', 'stroke-width': '1.3',
          }));
          const angTxt = svgEl('text', { x: firstBounce.x + 8, y: firstBounce.y - 18, fill: '#34d399', 'font-size': '10', 'font-weight': '600', 'font-family': 'JetBrains Mono, monospace' });
          angTxt.textContent = `θ = ${opt.incBoundaryDeg.toFixed(1)}° > θc (${opt.thetaC.toFixed(1)}°)`;
          labelLayer.append(angTxt);
        }
      } else if (opt.regime === 'critical') {
        const hitX = X.clamp(hit1X, faceX + 20, endX - 60);
        rayPts.push({ x: hitX, y: cy - coreHalf });
        rayPts.push({ x: endX, y: cy - coreHalf });
        const pathD = rayPts.map((pt, idx) => (idx === 0 ? 'M' : 'L') + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1)).join(' ');
        rayLayer.append(svgEl('path', { d: pathD, fill: 'none', stroke: '#e0b553', 'stroke-width': '2.8', filter: 'url(#c2t6-glow)' }));
        rayLayer.append(svgEl('line', { x1: hitX, y1: cy - coreHalf - 36, x2: hitX, y2: cy - coreHalf + 36, stroke: 'rgba(255,255,255,0.5)', 'stroke-dasharray': '3 3' }));
        const cTxt = svgEl('text', { x: hitX + 10, y: cy - coreHalf - 14, fill: '#e0b553', 'font-size': '10.5', 'font-weight': '700', 'font-family': 'JetBrains Mono, monospace' });
        cTxt.textContent = `Critical Grazing θc = ${opt.thetaC.toFixed(1)}° (90° refraction)`;
        labelLayer.append(cTxt);
      } else {
        // Refraction out into cladding + weak Fresnel reflection inside core
        const hitX = X.clamp(hit1X, faceX + 16, endX - 60);
        const hitPt = { x: hitX, y: cy - coreHalf };
        // Core segment to boundary
        rayLayer.append(svgEl('line', { x1: faceX, y1: cy, x2: hitX, y2: hitPt.y, stroke: '#e08c3a', 'stroke-width': '2.6' }));
        // Normal
        rayLayer.append(svgEl('line', { x1: hitX, y1: hitPt.y - 36, x2: hitX, y2: hitPt.y + 36, stroke: 'rgba(255,255,255,0.45)', 'stroke-dasharray': '3 3' }));

        // Refracted ray escaping into cladding & buffer
        const cladRad = opt.cladAngleDeg * P.degToRad;
        const escLen = 95;
        const escX = hitX + Math.sin(cladRad) * escLen;
        const escY = hitPt.y - Math.cos(cladRad) * escLen;
        rayPts.push(hitPt, { x: escX, y: escY });
        rayLayer.append(svgEl('line', { x1: hitX, y1: hitPt.y, x2: escX.toFixed(1), y2: escY.toFixed(1), stroke: '#ff5c7a', 'stroke-width': '2.6' }));

        // Faint Fresnel reflection inside core
        const refX = Math.min(endX, hitX + coreHalf / Math.tan(axisRad));
        rayLayer.append(svgEl('line', { x1: hitX, y1: hitPt.y, x2: refX, y2: cy, stroke: 'rgba(224,140,58,0.32)', 'stroke-width': '1.5', 'stroke-dasharray': '4 3' }));

        const escTxt = svgEl('text', { x: escX + 8, y: Math.max(58, escY + 4), fill: '#ff6b81', 'font-size': '10.5', 'font-weight': '600', 'font-family': 'Inter, sans-serif' });
        escTxt.textContent = opt.validGuide ? 'Refracted out (Lost!)' : 'No TIR (n₁ ≤ n₂)';
        labelLayer.append(escTxt);
      }

      // Animated light packet travelling along computed ray path
      const pulsePt = pointOnPolyline(rayPts, state.pulseT);
      const pulseCol = opt.regime === 'guided' ? '#34d399' : (opt.regime === 'critical' ? '#e0b553' : '#ff5c7a');
      pulseLayer.append(svgEl('circle', { cx: pulsePt.x, cy: pulsePt.y, r: 5.5, fill: pulseCol, stroke: '#fff', 'stroke-width': '1.4', filter: 'url(#c2t6-glow)' }));

      // Launch angle readout label
      const lTxt = svgEl('text', { x: faceX - 18, y: cy + 36, 'text-anchor': 'end', fill: '#fde047', 'font-size': '10.5', 'font-weight': '600', 'font-family': 'JetBrains Mono, monospace' });
      lTxt.textContent = `θᵢ = ${opt.launchDeg.toFixed(1)}°`;
      labelLayer.append(lTxt);

      // Summary readout bar bottom of SVG
      const sumTxt = svgEl('text', { x: 525, y: 426, 'text-anchor': 'middle', fill: '#edf1f8', 'font-size': '11.5', 'font-family': 'JetBrains Mono, monospace' });
      sumTxt.textContent = opt.validGuide
        ? `θc = ${opt.thetaC.toFixed(2)}°  |  θmax = ${opt.thetaMax.toFixed(2)}°  |  NA = ${opt.naFibre.toFixed(3)}`
        : 'Set n₁ > n₂ to enable Total Internal Reflection and guided modes.';
      labelLayer.append(sumTxt);
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
        if (state.playing) {
          state.time += dt;
          state.pulseT = (state.pulseT + dt * (C.prefersReducedMotion() ? 0 : 0.42)) % 1;
        }
        render();
      },
      resize() {
        render();
      },
      applyPreset(preset) {
        if (preset === 'acceptance') state.mode = 'acceptance';
        else if (preset === 'na') state.mode = 'na';
        else if (preset === 'grin') {
          state.mode = 'types';
          state.fibreType = 'graded';
          if (ui.typeSeg) ui.typeSeg.set('graded');
        } else {
          state.mode = 'tir';
        }
        if (subtabBar) subtabBar.set(state.mode);
        syncControlVisibility();
        updateReadouts();
        updateBanner();
        render();
      },
      getState: () => state,
    };
  };
})();
