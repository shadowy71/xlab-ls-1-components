(function () {
  'use strict';

  const C = window.Ch2Platform;
  const X = window.XLab;

  // Photon coordinate space: normalized (0..1, 0..1) mapped into the right chamber card.
  // cx/cy of the atom sit exactly at the center of this space.
  const CHAMBER = { x0: 369.5, y0: 75, w: 395, h: 320, cx: 567, cy: 235 };
  const CLIP = { x: 342, y: 26, w: 450, h: 408 }; // chamber interior clip (card inset 2px)
  const PHOTON_SPEED_PX = 150;                    // px/s along a photon's own axis
  const PHOTON_HALF_EXTENT = 46;                  // wave half-length + arrowhead, px

  window.CH2_SIMS['c2t1'] = function createPhotonAtomLab(ctxDom) {
    const { stage, controls, formula, wrap, dot } = ctxDom;
    const svgEl = C.svgEl;
    const P = C.PHYSICS;

    const state = {
      mode: 'absorption',    // 'absorption' | 'spontaneous' | 'stimulated'
      playing: true,
      stepMode: false,
      deltaE: 2.00,          // eV (E2 - E1)
      lambda: 620,           // nm (incident photon wavelength)
      // Animation phase state
      phase: 'ready',        // 'ready' | 'approach' | 'wait' | 'transition' | 'complete'
      tPhase: 0,
      electronLevel: 1,      // 1..2 continuous for smooth transition
      targetLevel: 1,
      inPhotonX: -0.1,       // normalized -0.1..1.1 across chamber
      inPhotonAlive: false,
      outPhotons: [],        // { x, y, vx, vy, dirRad, wavelength, phaseOffset, label }
      spontAngleDeg: 38,
      spontDwell: 1.35,      // randomized excited-state lifetime (s) before decay fires
      flashAlpha: 0,
      waveClock: 0,
      lastMessage: '',
    };

    // Convert a physics angle (deg, standard math convention: CCW from +x, y-up)
    // into pixel-true normalized velocity inside the chamber, so the on-screen
    // trajectory exactly matches the drawn wave orientation and the displayed θ.
    function spontVelocity(angleDeg) {
      const rad = angleDeg * P.degToRad;
      return {
        dirRad: rad,
        vx: Math.cos(rad) * PHOTON_SPEED_PX / CHAMBER.w,   // normalized-x per second
        vy: -Math.sin(rad) * PHOTON_SPEED_PX / CHAMBER.h,  // SVG y-down flip
      };
    }

    // Resample an emission direction that is visually unmistakable (away from the
    // horizontal axis and away from the header/pill strip near vertical).
    function randomSpontAngle() {
      let deg = Math.round(Math.random() * 320 + 20) % 360;
      const nearMod = (m) => Math.min(Math.abs(deg - m), 360 - Math.abs(deg - m));
      while (nearMod(0) < 18 || nearMod(180) < 18 || nearMod(90) < 18 || nearMod(270) < 18) {
        deg = (deg + 41) % 360;
      }
      return deg;
    }

    const RESONANCE_TOL_EV = 0.05;
    let built = false;
    let ui = {};
    let banner = null;

    function isMatched() {
      const ePh = C.nmToEv(state.lambda);
      return Math.abs(ePh - state.deltaE) <= RESONANCE_TOL_EV;
    }

    function resetSimulation(keepParams) {
      if (!keepParams) {
        state.deltaE = 2.00;
        state.lambda = Math.round(C.evToNm(2.00));
        if (ui.dESlider) ui.dESlider.setValue(state.deltaE);
        if (ui.lamSlider) ui.lamSlider.setValue(state.lambda);
      }
      state.phase = 'ready';
      state.tPhase = 0;
      state.flashAlpha = 0;
      state.outPhotons = [];

      if (state.mode === 'absorption') {
        state.electronLevel = 1;
        state.targetLevel = 1;
        state.inPhotonAlive = true;
        state.inPhotonX = 0.06;
      } else if (state.mode === 'spontaneous') {
        state.electronLevel = 2;
        state.targetLevel = 2;
        state.inPhotonAlive = false;
        state.spontAngleDeg = randomSpontAngle();
        // Excited-state lifetime is statistical: randomize the decay delay each cycle
        state.spontDwell = 0.9 + Math.random() * 1.2; // 0.9–2.1 s
      } else {
        state.electronLevel = 2;
        state.targetLevel = 2;
        state.inPhotonAlive = true;
        state.inPhotonX = 0.06;
      }
      updateReadouts();
      updateBanner();
    }

    function triggerCycle() {
      resetSimulation(true);
      state.phase = state.mode === 'spontaneous' ? 'wait' : 'approach';
      state.tPhase = 0;
      updateBanner();
    }

    function advanceStep() {
      state.stepMode = true;
      state.playing = false;
      if (ui.transport) ui.transport.setPlaying(false);
      if (ui.stepToggle) ui.stepToggle.checked = true;

      if (state.phase === 'ready') {
        state.phase = state.mode === 'spontaneous' ? 'wait' : 'approach';
        state.tPhase = 0;
        if (state.mode !== 'spontaneous') state.inPhotonX = 0.24;
      } else if (state.phase === 'approach' || state.phase === 'wait') {
        if (state.mode === 'spontaneous') {
          startTransition();
        } else {
          state.inPhotonX = 0.48;
          handleAtomArrival();
        }
      } else if (state.phase === 'transition') {
        finishTransition();
      } else {
        resetSimulation(true);
      }
      updateBanner();
      updateReadouts();
    }

    function startTransition() {
      state.phase = 'transition';
      state.tPhase = 0;
      state.flashAlpha = 1;
      if (state.mode === 'absorption') {
        state.inPhotonAlive = false; // absorbed photon disappears
        state.targetLevel = 2;
      } else if (state.mode === 'spontaneous') {
        state.targetLevel = 1;
        const v = spontVelocity(state.spontAngleDeg);
        const lam0 = C.evToNm(state.deltaE);
        state.outPhotons = [{
          x: 0.50,
          y: 0.50,
          vx: v.vx,
          vy: v.vy,
          dirRad: v.dirRad,      // physics angle (CCW from +x, y-up) — matches displayed θ
          wavelength: lam0,
          phaseOffset: Math.random() * Math.PI * 2,
          tag: 'Spontaneous hν',
        }];
      } else if (state.mode === 'stimulated') {
        state.targetLevel = 1;
        state.inPhotonAlive = false; // replaced by coherent twin pair
        const lam0 = state.lambda;
        const sharedPhase = state.waveClock;
        state.outPhotons = [
          {
            x: 0.52, y: 0.45, vx: PHOTON_SPEED_PX / CHAMBER.w, vy: 0, dirRad: 0,
            wavelength: lam0, phaseOffset: sharedPhase, tag: 'Incident hν',
          },
          {
            x: 0.52, y: 0.55, vx: PHOTON_SPEED_PX / CHAMBER.w, vy: 0, dirRad: 0,
            wavelength: lam0, phaseOffset: sharedPhase, tag: 'Stimulated hν (in phase)',
          },
        ];
      }
    }

    function finishTransition() {
      state.electronLevel = state.targetLevel;
      state.phase = 'complete';
      state.tPhase = 0;
      if (state.outPhotons.length) {
        state.outPhotons.forEach((p) => {
          p.x += p.vx * 0.65;
          p.y += p.vy * 0.65;
        });
      }
    }

    // Advance emitted photons and retire them once they have fully left the
    // (clipped) chamber — so nothing freezes mid-air or pops at loop reset.
    function moveOutPhotons(dt) {
      state.outPhotons.forEach((p) => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      });
      const margin = PHOTON_HALF_EXTENT + 4; // px beyond clip edge before removal
      state.outPhotons = state.outPhotons.filter((p) => {
        const px = CHAMBER.x0 + p.x * CHAMBER.w;
        const py = CHAMBER.y0 + p.y * CHAMBER.h;
        return px > CLIP.x - margin && px < CLIP.x + CLIP.w + margin
          && py > CLIP.y - margin && py < CLIP.y + CLIP.h + margin;
      });
    }

    function handleAtomArrival() {
      const matched = isMatched();
      if (state.mode === 'absorption') {
        if (matched) {
          startTransition();
        } else {
          // Off-resonance: photon passes straight through without absorption
          state.phase = 'complete';
          state.tPhase = 0;
          state.targetLevel = 1;
          state.inPhotonX = 0.54;
        }
      } else if (state.mode === 'stimulated') {
        if (matched) {
          startTransition();
        } else {
          // Off-resonance: photon passes without stimulating emission
          state.phase = 'complete';
          state.tPhase = 0;
          state.targetLevel = 2;
          state.inPhotonX = 0.54;
        }
      }
    }

    /* ============================================================
       BUILD DOM & SVG
       ============================================================ */
    function buildDOM() {
      if (built) return;
      built = true;

      stage.innerHTML = '';
      controls.innerHTML = '';
      formula.innerHTML = '';

      // Create SVG stage
      const svg = svgEl('svg', {
        class: 'viz-svg',
        viewBox: '0 0 820 460',
        preserveAspectRatio: 'xMidYMid meet',
        role: 'img',
        'aria-label': 'Photon-Atom Interaction Energy Level Diagram',
      });

      const defs = svgEl('defs');
      const glow = svgEl('filter', { id: 'c2t1-glow', x: '-40%', y: '-40%', width: '180%', height: '180%' });
      glow.append(svgEl('feGaussianBlur', { stdDeviation: '4', result: 'blur' }));
      const merge = svgEl('feMerge');
      merge.append(svgEl('feMergeNode', { in: 'blur' }), svgEl('feMergeNode', { in: 'SourceGraphic' }));
      glow.append(merge);
      defs.append(glow);
      // Photons must never leave the interaction chamber card
      const clip = svgEl('clipPath', { id: 'c2t1-chamber-clip' });
      clip.append(svgEl('rect', { x: CLIP.x, y: CLIP.y, width: CLIP.w, height: CLIP.h, rx: 7 }));
      defs.append(clip);
      svg.append(defs);

      // Background subtle grid
      const gridG = svgEl('g', { opacity: '0.18' });
      for (let gx = 40; gx <= 780; gx += 40) {
        gridG.append(svgEl('line', { x1: gx, y1: 24, x2: gx, y2: 436, stroke: 'rgba(255,255,255,0.12)', 'stroke-dasharray': '2 6' }));
      }
      svg.append(gridG);

      // Left Card: Energy Level Diagram (x: 34..310)
      svg.append(svgEl('rect', { x: 26, y: 24, width: 296, height: 412, rx: 8, fill: 'rgba(6,10,24,0.55)', stroke: 'rgba(255,255,255,0.12)' }));
      const elHeader = svgEl('text', { x: 44, y: 50, fill: '#edf1f8', 'font-size': '13', 'font-weight': '600', 'font-family': 'Inter, sans-serif' });
      elHeader.textContent = 'ENERGY-LEVEL DIAGRAM';
      svg.append(elHeader);

      // Level lines (E2 top, E1 bottom — y position updates dynamically with deltaE!)
      const e2Line = svgEl('line', { x1: 72, y1: 120, x2: 280, y2: 120, stroke: '#e0b553', 'stroke-width': '3', 'stroke-linecap': 'round' });
      const e1Line = svgEl('line', { x1: 72, y1: 360, x2: 280, y2: 360, stroke: '#22d3ee', 'stroke-width': '3', 'stroke-linecap': 'round' });
      const e2Label = svgEl('text', { x: 44, y: 124, fill: '#e0b553', 'font-size': '13', 'font-weight': '700', 'font-family': 'JetBrains Mono, monospace' });
      e2Label.textContent = 'E₂';
      const e1Label = svgEl('text', { x: 44, y: 364, fill: '#22d3ee', 'font-size': '13', 'font-weight': '700', 'font-family': 'JetBrains Mono, monospace' });
      e1Label.textContent = 'E₁';
      const e2Sub = svgEl('text', { x: 280, y: 108, 'text-anchor': 'end', fill: 'rgba(224,181,83,0.85)', 'font-size': '11', 'font-family': 'Inter, sans-serif' });
      e2Sub.textContent = 'Excited State';
      const e1Sub = svgEl('text', { x: 280, y: 380, 'text-anchor': 'end', fill: 'rgba(34,211,238,0.85)', 'font-size': '11', 'font-family': 'Inter, sans-serif' });
      e1Sub.textContent = 'Ground State';

      // Delta E bracket
      const deLine = svgEl('line', { x1: 256, y1: 124, x2: 256, y2: 356, stroke: 'rgba(237,241,248,0.35)', 'stroke-dasharray': '4 4', 'stroke-width': '1.4' });
      const deText = svgEl('text', { x: 248, y: 244, 'text-anchor': 'end', fill: '#edf1f8', 'font-size': '12', 'font-weight': '600', 'font-family': 'JetBrains Mono, monospace' });

      // Transition arrow inside Energy Diagram
      const transArrow = svgEl('line', { x1: 162, y1: 350, x2: 162, y2: 130, stroke: '#34d399', 'stroke-width': '2.5', 'stroke-dasharray': '5 4', opacity: '0' });
      const transHead = svgEl('polygon', { points: '162,124 156,136 168,136', fill: '#34d399', opacity: '0' });

      // Electron dot on energy level
      const electronHalo = svgEl('circle', { cx: 162, cy: 360, r: 16, fill: 'rgba(34,211,238,0.22)' });
      const electronCore = svgEl('circle', { cx: 162, cy: 360, r: 7, fill: '#22d3ee', stroke: '#ffffff', 'stroke-width': '1.6', filter: 'url(#c2t1-glow)' });
      const electronTag = svgEl('text', { x: 162, y: 363.5, 'text-anchor': 'middle', fill: '#080b14', 'font-size': '9.5', 'font-weight': '700', 'font-family': 'Inter, sans-serif' });
      electronTag.textContent = 'e⁻';

      svg.append(e2Line, e1Line, e2Label, e1Label, e2Sub, e1Sub, deLine, deText, transArrow, transHead, electronHalo, electronCore, electronTag);

      // Right Card: Photon–Atom Spatial Chamber (x: 340..794)
      svg.append(svgEl('rect', { x: 340, y: 24, width: 454, height: 412, rx: 8, fill: 'rgba(6,10,24,0.55)', stroke: 'rgba(255,255,255,0.12)' }));
      const chHeader = svgEl('text', { x: 358, y: 50, fill: '#edf1f8', 'font-size': '13', 'font-weight': '600', 'font-family': 'Inter, sans-serif' });
      chHeader.textContent = 'OPTICAL INTERACTION CHAMBER';
      const stepLabel = svgEl('text', { x: 776, y: 50, 'text-anchor': 'end', fill: '#22d3ee', 'font-size': '11.5', 'font-weight': '600', 'font-family': 'JetBrains Mono, monospace' });

      // Optical axis line
      svg.append(svgEl('line', { x1: 356, y1: 235, x2: 778, y2: 235, stroke: 'rgba(255,255,255,0.1)', 'stroke-dasharray': '5 5' }));

      // Atom visual at chamber center (567, 235)
      const atomOuter = svgEl('circle', { cx: 567, cy: 235, r: 44, fill: 'rgba(34,211,238,0.06)', stroke: 'rgba(34,211,238,0.35)', 'stroke-width': '1.5', 'stroke-dasharray': '4 3' });
      const atomInner = svgEl('circle', { cx: 567, cy: 235, r: 22, fill: 'rgba(224,181,83,0.12)', stroke: 'rgba(224,181,83,0.45)', 'stroke-width': '1.3' });
      const atomFlash = svgEl('circle', { cx: 567, cy: 235, r: 30, fill: 'none', stroke: '#34d399', 'stroke-width': '2.5', opacity: '0' });
      const nucleus = svgEl('circle', { cx: 567, cy: 235, r: 7, fill: '#d9669b', stroke: '#fff', 'stroke-width': '1.2' });
      const orbitElectron = svgEl('circle', { cx: 567, cy: 213, r: 4.8, fill: '#22d3ee', filter: 'url(#c2t1-glow)' });
      const atomStateTxt = svgEl('text', { x: 567, y: 300, 'text-anchor': 'middle', fill: '#8f9cb5', 'font-size': '11.5', 'font-weight': '600', 'font-family': 'JetBrains Mono, monospace' });
      svg.append(atomOuter, atomInner, atomFlash, nucleus, orbitElectron, atomStateTxt);

      // Spontaneous-emission direction annotation: horizontal reference + emission ray + θ arc
      const spontRefLine = svgEl('line', { x1: CHAMBER.cx + 10, y1: CHAMBER.cy, x2: CHAMBER.cx + 52, y2: CHAMBER.cy, stroke: 'rgba(237,241,248,0.35)', 'stroke-dasharray': '3 3', 'stroke-width': '1.2', opacity: '0' });
      const spontRay = svgEl('line', { x1: CHAMBER.cx, y1: CHAMBER.cy, x2: CHAMBER.cx, y2: CHAMBER.cy, 'stroke-width': '1.6', 'stroke-dasharray': '5 3', opacity: '0' });
      const spontArc = svgEl('path', { d: '', fill: 'none', 'stroke-width': '1.4', opacity: '0' });
      const spontThetaTxt = svgEl('text', { 'text-anchor': 'middle', 'font-size': '10.5', 'font-weight': '600', 'font-family': 'JetBrains Mono, monospace', opacity: '0' });
      svg.append(spontRefLine, spontRay, spontArc, spontThetaTxt);

      // Dynamic photon wave container — clipped so photons stay inside the chamber
      const photonLayer = svgEl('g', { 'clip-path': 'url(#c2t1-chamber-clip)' });
      svg.append(photonLayer);

      // Phase-lock alignment guide for stimulated emission
      const phaseGuide1 = svgEl('line', { x1: 0, y1: 0, x2: 0, y2: 0, stroke: 'rgba(52,211,153,0.45)', 'stroke-dasharray': '3 3', opacity: '0' });
      const phaseGuide2 = svgEl('line', { x1: 0, y1: 0, x2: 0, y2: 0, stroke: 'rgba(52,211,153,0.45)', 'stroke-dasharray': '3 3', opacity: '0' });
      svg.append(phaseGuide1, phaseGuide2);

      // Resonance match badge in chamber (paints above photons)
      const matchPillRect = svgEl('rect', { x: 358, y: 66, width: 190, height: 24, rx: 4, fill: 'rgba(52,211,153,0.12)', stroke: 'rgba(52,211,153,0.35)' });
      const matchPillText = svgEl('text', { x: 453, y: 82, 'text-anchor': 'middle', fill: '#34d399', 'font-size': '11', 'font-weight': '600', 'font-family': 'JetBrains Mono, monospace' });
      svg.append(matchPillRect, matchPillText);

      // Chamber headers paint last so passing photons slide underneath them
      svg.append(chHeader, stepLabel);

      // Chamber equation badge bottom
      const eqBadge = svgEl('text', { x: 567, y: 416, 'text-anchor': 'middle', fill: 'rgba(237,241,248,0.82)', 'font-size': '12', 'font-family': 'JetBrains Mono, monospace' });
      svg.append(eqBadge);

      stage.append(svg);

      banner = C.buildBanner(wrap);

      // Controls pane
      const modeWrap = X.el('div', 'slider-block');
      modeWrap.append(X.el('label', 'control-label', 'Experiment Mode'));
      controls.append(modeWrap);
      ui.modeSeg = X.buildSegmented(modeWrap, {
        options: [
          { value: 'absorption', label: 'A. Absorption' },
          { value: 'spontaneous', label: 'B. Spontaneous' },
          { value: 'stimulated', label: 'C. Stimulated' },
        ],
        value: state.mode,
        onChange: (m) => {
          state.mode = m;
          ui.lamSlider.input.disabled = (m === 'spontaneous');
          ui.matchBtn.disabled = (m === 'spontaneous');
          if (ui.triggerBtn) ui.triggerBtn.textContent = m === 'spontaneous' ? 'Trigger Next Decay' : 'Introduce Photon / Trigger';
          resetSimulation(true);
        },
      });

      ui.transport = C.buildTransport(controls, {
        onTogglePlay: () => {
          state.playing = !state.playing;
          if (state.playing) state.stepMode = false;
          if (ui.stepToggle) ui.stepToggle.checked = state.stepMode;
          ui.transport.setPlaying(state.playing);
          if (dot) dot.textContent = state.playing ? 'Live' : 'Paused';
        },
        onStep: () => advanceStep(),
        onReset: () => resetSimulation(false),
        playLabel: 'Pause',
        stepLabel: 'Step →',
      });
      ui.transport.setPlaying(true);

      const actionRefs = C.buildActionRow(controls, [
        { id: 'trigger', label: 'Introduce Photon / Trigger', primary: true, onClick: () => triggerCycle() },
        { id: 'match', label: 'Match hν = ΔE', onClick: () => {
          const lam0 = Math.round(X.clamp(C.evToNm(state.deltaE), 350, 1100));
          state.lambda = lam0;
          ui.lamSlider.setValue(lam0);
          updateReadouts();
          updateBanner();
        }},
      ]);
      ui.matchBtn = actionRefs.match;
      ui.triggerBtn = actionRefs.trigger;

      ui.stepToggle = X.buildToggle(controls, {
        label: 'Step-by-step mode',
        checked: state.stepMode,
        onChange: (on) => {
          state.stepMode = on;
          if (on) {
            state.playing = false;
            ui.transport.setPlaying(false);
          }
        },
      });

      ui.dESlider = X.buildSlider(controls, {
        label: 'Energy Gap ΔE = E₂ − E₁',
        id: 'c2t1-de',
        min: 1.20,
        max: 3.20,
        step: 0.02,
        value: state.deltaE,
        format: (v) => v.toFixed(2) + ' eV',
        onInput: (v) => {
          state.deltaE = v;
          updateReadouts();
          updateBanner();
        },
      });

      ui.lamSlider = X.buildSlider(controls, {
        label: 'Incident Wavelength λ',
        id: 'c2t1-lam',
        min: 380,
        max: 1050,
        step: 2,
        value: state.lambda,
        format: (v) => `${Math.round(v)} nm (${C.nmToEv(v).toFixed(2)} eV)`,
        onInput: (v) => {
          state.lambda = v;
          updateReadouts();
          updateBanner();
        },
      });

      ui.readouts = X.buildReadouts(controls, [
        { id: 'de', label: 'ΔE = E₂ − E₁', primary: true },
        { id: 'eph', label: 'Photon hν' },
        { id: 'freq', label: 'Frequency ν' },
        { id: 'status', label: 'Resonance / State', wide: true },
      ]);

      ui.svgRefs = {
        svg, e2Line, e1Line, e2Label, e1Label, e2Sub, e1Sub, deLine, deText,
        transArrow, transHead, electronHalo, electronCore, electronTag,
        atomOuter, atomInner, atomFlash, orbitElectron, atomStateTxt,
        spontRefLine, spontRay, spontArc, spontThetaTxt,
        matchPillRect, matchPillText, phaseGuide1, phaseGuide2,
        photonLayer, eqBadge, stepLabel,
      };
    }

    function updateReadouts() {
      if (!ui.readouts) return;
      const ePh = state.mode === 'spontaneous' ? state.deltaE : C.nmToEv(state.lambda);
      const lamActive = state.mode === 'spontaneous' ? C.evToNm(state.deltaE) : state.lambda;
      const nuTHz = C.nmToTHz(lamActive);
      const matched = isMatched();

      ui.readouts.set('de', state.deltaE.toFixed(2) + ' eV');
      ui.readouts.set('eph', ePh.toFixed(2) + ' eV');
      ui.readouts.set('freq', nuTHz.toFixed(1) + ' THz');

      if (state.mode === 'spontaneous') {
        ui.readouts.set('status', `Spontaneous decay · θ = ${state.spontAngleDeg}° (random, CCW from horizontal) · τ random`);
      } else if (matched) {
        ui.readouts.set('status', `Resonant match ✓ (|ΔE − hν| ≤ 0.05 eV)`);
      } else {
        const diff = (ePh - state.deltaE).toFixed(2);
        ui.readouts.set('status', `Off-resonance (${diff > 0 ? '+' : ''}${diff} eV) — no interaction`);
      }

      const eStateStr = state.electronLevel >= 1.5 ? 'E₂ (Excited)' : 'E₁ (Ground)';
      formula.innerHTML = `
        <span class="formula active">ΔE = E₂ − E₁ = <span class="fv">${state.deltaE.toFixed(2)} eV</span></span>
        <span class="formula">hν = hc/λ = <span class="fv">${ePh.toFixed(2)} eV</span> (λ = <span class="fv">${Math.round(lamActive)} nm</span>, ν = <span class="fv">${nuTHz.toFixed(1)} THz</span>)</span>
        <span class="formula">Atom: <span class="fv">${eStateStr}</span></span>`;
    }

    function updateBanner() {
      if (!banner) return;
      const matched = isMatched();
      if (state.mode === 'absorption') {
        if (state.phase === 'ready') {
          banner.set('MODE A · ABSORPTION', '', 'Atom starts in ground state <b>E₁</b>. An incident photon approaches; absorption occurs only if <b>hν = E₂ − E₁</b>.');
        } else if (state.phase === 'approach') {
          banner.set('PHOTON APPROACHING', '', `Incident photon (<b>${C.nmToEv(state.lambda).toFixed(2)} eV</b>) travels toward ground-state atom (gap <b>${state.deltaE.toFixed(2)} eV</b>).`);
        } else if (state.phase === 'transition') {
          banner.set('ABSORBED!', 'ok', '<b>Resonance matched!</b> Incident photon disappears and electron jumps from <b>E₁ → E₂</b>.');
        } else if (matched) {
          banner.set('EXCITED AT E₂', 'ok', 'Photon absorbed cleanly and removed from field; electron now occupies excited state <b>E₂</b>.');
        } else {
          banner.set('OFF-RESONANCE', 'warn', `Photon energy <b>hν ≠ ΔE</b>. The photon passes right through without exciting the atom from E₁.`);
        }
      } else if (state.mode === 'spontaneous') {
        if (state.phase === 'ready' || state.phase === 'wait') {
          banner.set('MODE B · SPONTANEOUS', '', 'Atom sits in excited state <b>E₂</b> with <b>no incident photon</b>. Spontaneous decay is statistical — it fires after an <b>unpredictable delay</b>, in a random direction.');
        } else if (state.phase === 'transition') {
          banner.set('DECAYING E₂ → E₁', 'ok', `No external stimulus. Electron drops on its own, emitting one photon of energy <b>hν = ΔE</b> at random angle <b>θ = ${state.spontAngleDeg}°</b> with random phase.`);
        } else {
          banner.set('SPONTANEOUS EMISSION', 'ok', `Emitted photon: <b>hν = ${state.deltaE.toFixed(2)} eV</b>, but <b>random direction (θ = ${state.spontAngleDeg}°, counter-clockwise from horizontal) &amp; random phase</b> — incoherent light. Each cycle re-randomizes θ.`);
        }
      } else {
        if (state.phase === 'ready') {
          banner.set('MODE C · STIMULATED', '', 'Atom starts excited at <b>E₂</b>. Introduce a resonant photon (<b>hν = E₂ − E₁</b>) to trigger coherent cloning.');
        } else if (state.phase === 'approach') {
          banner.set('PHOTON APPROACHING', '', `Incident photon approaches excited atom at E₂ (checking <b>hν ≈ ${state.deltaE.toFixed(2)} eV</b>).`);
        } else if (state.phase === 'transition') {
          banner.set('STIMULATED!', 'ok', 'Incident photon stimulates <b>E₂ → E₁</b> transition, generating a <b>second identical photon</b>!');
        } else if (matched) {
          banner.set('COHERENT PAIR', 'ok', '<b>Two identical photons</b> emerge with the <b>same frequency, phase, and direction</b> — the foundation of LASER amplification.');
        } else {
          banner.set('NO STIMULATION', 'warn', 'Incident photon energy <b>hν ≠ E₂ − E₁</b>. Atom stays in E₂ while off-resonance photon passes.');
        }
      }
    }

    function createWavePacketPath(cx, cy, angleRad, wavelengthNm, phaseOff, lengthPx, ampPx) {
      const k = 2 * Math.PI / X.clamp(wavelengthNm * 0.036, 12, 34);
      const samples = 36;
      let d = '';
      const cosA = Math.cos(angleRad), sinA = Math.sin(angleRad);
      const nx = -sinA, ny = cosA;
      for (let i = 0; i <= samples; i++) {
        const u = (i / samples - 0.5) * lengthPx;
        const env = Math.exp(-Math.pow((i / samples - 0.5) * 2.4, 2));
        const perp = Math.sin(u * k - phaseOff) * ampPx * env;
        const px = cx + u * cosA + perp * nx;
        const py = cy + u * sinA + perp * ny;
        d += (i === 0 ? 'M' : 'L') + px.toFixed(1) + ' ' + py.toFixed(1) + ' ';
      }
      return d;
    }

    function drawPhoton(parent, cx, cy, svgAngleRad, wavelengthNm, phaseOff, label, labelBelow) {
      const col = C.spectrumColor(wavelengthNm, 1);
      const pathD = createWavePacketPath(cx, cy, svgAngleRad, wavelengthNm, phaseOff, 68, 9);
      const g = svgEl('g');
      g.append(svgEl('path', { d: pathD, fill: 'none', stroke: col, 'stroke-width': '2.6', 'stroke-linecap': 'round', filter: 'url(#c2t1-glow)' }));
      const headX = cx + Math.cos(svgAngleRad) * 38;
      const headY = cy + Math.sin(svgAngleRad) * 38;
      const tailX = headX - Math.cos(svgAngleRad) * 10;
      const tailY = headY - Math.sin(svgAngleRad) * 10;
      const nx = -Math.sin(svgAngleRad) * 4.5, ny = Math.cos(svgAngleRad) * 4.5;
      g.append(svgEl('polygon', {
        points: `${headX.toFixed(1)},${headY.toFixed(1)} ${(tailX + nx).toFixed(1)},${(tailY + ny).toFixed(1)} ${(tailX - nx).toFixed(1)},${(tailY - ny).toFixed(1)}`,
        fill: col,
      }));
      if (label) {
        // Keep the label on the side away from the direction of travel so it never
        // leads the wave packet out of the clipped chamber area.
        const ly = labelBelow ? cy + 26 : cy - 16;
        const txt = svgEl('text', {
          x: cx, y: ly,
          'text-anchor': 'middle',
          fill: col,
          'font-size': '10.5',
          'font-weight': '600',
          'font-family': 'JetBrains Mono, monospace',
        });
        txt.textContent = label;
        g.append(txt);
      }
      parent.append(g);
    }

    function render() {
      if (!ui.svgRefs) return;
      const r = ui.svgRefs;

      // Energy level positions dynamically reflect ΔE (1.20 .. 3.20 eV)
      const yE1 = 365;
      const spanPx = 110 + ((state.deltaE - 1.2) / 2.0) * 140; // 110..250 px
      const yE2 = yE1 - spanPx;

      r.e2Line.setAttribute('y1', yE2);
      r.e2Line.setAttribute('y2', yE2);
      r.e2Label.setAttribute('y', yE2 + 4);
      r.e2Sub.setAttribute('y', yE2 - 12);
      r.deLine.setAttribute('y1', yE2 + 4);
      r.deLine.setAttribute('y2', yE1 - 4);
      r.deText.setAttribute('y', (yE1 + yE2) / 2 + 4);
      r.deText.textContent = `ΔE = ${state.deltaE.toFixed(2)} eV`;

      // Electron y position on energy diagram
      const tE = state.electronLevel - 1; // 0 = E1, 1 = E2
      const eY = X.lerp(yE1, yE2, tE);
      r.electronHalo.setAttribute('cy', eY);
      r.electronCore.setAttribute('cy', eY);
      r.electronTag.setAttribute('y', eY + 3.5);
      const eCol = tE > 0.5 ? '#e0b553' : '#22d3ee';
      r.electronCore.setAttribute('fill', eCol);
      r.electronHalo.setAttribute('fill', tE > 0.5 ? 'rgba(224,181,83,0.24)' : 'rgba(34,211,238,0.22)');

      // Transition arrow in energy diagram
      if (state.phase === 'transition' || state.phase === 'complete') {
        const up = state.mode === 'absorption' && (state.electronLevel > 1.05 || isMatched());
        const down = (state.mode === 'spontaneous') || (state.mode === 'stimulated' && isMatched());
        if (up) {
          r.transArrow.setAttribute('opacity', '0.9');
          r.transArrow.setAttribute('y1', yE1 - 10);
          r.transArrow.setAttribute('y2', yE2 + 12);
          r.transArrow.setAttribute('stroke', '#34d399');
          r.transHead.setAttribute('opacity', '0.9');
          r.transHead.setAttribute('fill', '#34d399');
          r.transHead.setAttribute('points', `162,${yE2 + 5} 156,${yE2 + 17} 168,${yE2 + 17}`);
        } else if (down) {
          r.transArrow.setAttribute('opacity', '0.9');
          r.transArrow.setAttribute('y1', yE2 + 10);
          r.transArrow.setAttribute('y2', yE1 - 12);
          r.transArrow.setAttribute('stroke', '#e0b553');
          r.transHead.setAttribute('opacity', '0.9');
          r.transHead.setAttribute('fill', '#e0b553');
          r.transHead.setAttribute('points', `162,${yE1 - 5} 156,${yE1 - 17} 168,${yE1 - 17}`);
        } else {
          r.transArrow.setAttribute('opacity', '0');
          r.transHead.setAttribute('opacity', '0');
        }
      } else {
        r.transArrow.setAttribute('opacity', '0');
        r.transHead.setAttribute('opacity', '0');
      }

      // Atom orbital visual in optical chamber
      const orbitR = X.lerp(22, 44, tE);
      const orbitSpeed = C.prefersReducedMotion() ? 0 : state.waveClock * 1.8;
      r.orbitElectron.setAttribute('cx', (567 + Math.cos(orbitSpeed) * orbitR).toFixed(1));
      r.orbitElectron.setAttribute('cy', (235 + Math.sin(orbitSpeed) * orbitR).toFixed(1));
      r.orbitElectron.setAttribute('fill', eCol);
      r.atomOuter.setAttribute('stroke', tE > 0.5 ? 'rgba(224,181,83,0.75)' : 'rgba(34,211,238,0.32)');
      r.atomInner.setAttribute('stroke', tE <= 0.5 ? 'rgba(34,211,238,0.75)' : 'rgba(224,181,83,0.28)');
      r.atomStateTxt.textContent = tE > 0.5 ? 'Atom State: E₂ (Excited)' : 'Atom State: E₁ (Ground)';

      if (state.flashAlpha > 0.01) {
        r.atomFlash.setAttribute('opacity', state.flashAlpha.toFixed(2));
        r.atomFlash.setAttribute('r', (28 + (1 - state.flashAlpha) * 34).toFixed(1));
      } else {
        r.atomFlash.setAttribute('opacity', '0');
      }

      // Match pill
      const matched = isMatched();
      if (state.mode === 'spontaneous') {
        r.matchPillRect.setAttribute('fill', 'rgba(224,181,83,0.12)');
        r.matchPillRect.setAttribute('stroke', 'rgba(224,181,83,0.38)');
        r.matchPillText.setAttribute('fill', '#e0b553');
        r.matchPillText.textContent = 'No Incident Photon Needed';
      } else if (matched) {
        r.matchPillRect.setAttribute('fill', 'rgba(52,211,153,0.14)');
        r.matchPillRect.setAttribute('stroke', 'rgba(52,211,153,0.45)');
        r.matchPillText.setAttribute('fill', '#34d399');
        r.matchPillText.textContent = 'Resonance: hν = ΔE ✓';
      } else {
        r.matchPillRect.setAttribute('fill', 'rgba(224,140,58,0.14)');
        r.matchPillRect.setAttribute('stroke', 'rgba(224,140,58,0.45)');
        r.matchPillText.setAttribute('fill', '#e08c3a');
        r.matchPillText.textContent = 'Off-Resonance: hν ≠ ΔE';
      }

      // Step badge
      const stepMap = {
        ready: 'STEP 1 · READY',
        approach: 'STEP 2 · PHOTON INCIDENT',
        wait: 'STEP 2 · EXCITED DWELL',
        transition: 'STEP 3 · TRANSITION',
        complete: 'STEP 4 · RESULT',
      };
      r.stepLabel.textContent = stepMap[state.phase] || '';

      // Photons in chamber (normalized 0..1 maps to the shared CHAMBER pixel space)
      r.photonLayer.innerHTML = '';
      const mapX = (nx) => CHAMBER.x0 + nx * CHAMBER.w;
      const mapY = (ny) => CHAMBER.y0 + ny * CHAMBER.h;

      if (state.inPhotonAlive) {
        const px = mapX(state.inPhotonX);
        const py = mapY(0.5);
        const ePh = C.nmToEv(state.lambda);
        drawPhoton(r.photonLayer, px, py, 0, state.lambda, state.waveClock * 4, `hν = ${ePh.toFixed(2)} eV`, false);
      }

      state.outPhotons.forEach((p) => {
        const px = mapX(p.x);
        const py = mapY(p.y);
        // dirRad uses the y-up math convention; SVG is y-down, so draw at -dirRad.
        // The velocity was built with the same flip, so path and orientation agree.
        drawPhoton(r.photonLayer, px, py, -p.dirRad, p.wavelength, state.waveClock * 4 + p.phaseOffset, p.tag, p.vy < 0);
      });

      // Spontaneous-emission direction annotation (θ ray + arc) during decay & result
      if (state.mode === 'spontaneous' && (state.phase === 'transition' || state.phase === 'complete')) {
        const rad = state.spontAngleDeg * P.degToRad;
        const col = C.spectrumColor(C.evToNm(state.deltaE), 0.95);
        const cos = Math.cos(rad), sin = Math.sin(rad);
        r.spontRefLine.setAttribute('opacity', '0.8');
        r.spontRay.setAttribute('opacity', '0.9');
        r.spontRay.setAttribute('stroke', col);
        r.spontRay.setAttribute('x2', (CHAMBER.cx + cos * 74).toFixed(1));
        r.spontRay.setAttribute('y2', (CHAMBER.cy - sin * 74).toFixed(1));
        const arcR = 32;
        const largeArc = state.spontAngleDeg > 180 ? 1 : 0;
        r.spontArc.setAttribute('opacity', '0.9');
        r.spontArc.setAttribute('stroke', col);
        r.spontArc.setAttribute('d', `M ${(CHAMBER.cx + arcR).toFixed(1)} ${CHAMBER.cy} A ${arcR} ${arcR} 0 ${largeArc} 0 ${(CHAMBER.cx + arcR * cos).toFixed(1)} ${(CHAMBER.cy - arcR * sin).toFixed(1)}`);
        const midRad = rad / 2;
        r.spontThetaTxt.setAttribute('opacity', '0.95');
        r.spontThetaTxt.setAttribute('fill', col);
        r.spontThetaTxt.setAttribute('x', (CHAMBER.cx + 46 * Math.cos(midRad)).toFixed(1));
        r.spontThetaTxt.setAttribute('y', (CHAMBER.cy - 46 * Math.sin(midRad) + 3.5).toFixed(1));
        r.spontThetaTxt.textContent = `θ = ${state.spontAngleDeg}°`;
      } else {
        r.spontRefLine.setAttribute('opacity', '0');
        r.spontRay.setAttribute('opacity', '0');
        r.spontArc.setAttribute('opacity', '0');
        r.spontThetaTxt.setAttribute('opacity', '0');
      }

      // Phase-lock alignment guides when two stimulated photons travel together
      if (state.mode === 'stimulated' && state.outPhotons.length === 2) {
        const p0 = state.outPhotons[0], p1 = state.outPhotons[1];
        const xPix = mapX(p0.x);
        r.phaseGuide1.setAttribute('x1', xPix - 16);
        r.phaseGuide1.setAttribute('x2', xPix - 16);
        r.phaseGuide1.setAttribute('y1', mapY(p0.y) - 12);
        r.phaseGuide1.setAttribute('y2', mapY(p1.y) + 12);
        r.phaseGuide1.setAttribute('opacity', '0.7');
        r.phaseGuide2.setAttribute('x1', xPix + 16);
        r.phaseGuide2.setAttribute('x2', xPix + 16);
        r.phaseGuide2.setAttribute('y1', mapY(p0.y) - 12);
        r.phaseGuide2.setAttribute('y2', mapY(p1.y) + 12);
        r.phaseGuide2.setAttribute('opacity', '0.7');
      } else {
        r.phaseGuide1.setAttribute('opacity', '0');
        r.phaseGuide2.setAttribute('opacity', '0');
      }

      const activeLam = state.mode === 'spontaneous' ? C.evToNm(state.deltaE) : state.lambda;
      r.eqBadge.textContent = `ΔE = ${state.deltaE.toFixed(2)} eV  |  hν = hc/λ = ${C.nmToEv(activeLam).toFixed(2)} eV  (λ = ${Math.round(activeLam)} nm)`;
    }

    function tick(dt) {
      if (!C.prefersReducedMotion()) {
        state.waveClock += dt;
      }
      if (state.flashAlpha > 0) {
        state.flashAlpha = Math.max(0, state.flashAlpha - dt * 1.8);
      }

      if (state.playing && !state.stepMode) {
        state.tPhase += dt;
        if (state.phase === 'ready') {
          if (state.tPhase > 0.7) {
            state.phase = state.mode === 'spontaneous' ? 'wait' : 'approach';
            state.tPhase = 0;
            updateBanner();
            updateReadouts();
          }
        } else if (state.phase === 'approach') {
          state.inPhotonX += dt * 0.36;
          if (state.inPhotonX >= 0.45) {
            handleAtomArrival();
            updateBanner();
            updateReadouts();
          }
        } else if (state.phase === 'wait') {
          // Excited-state lifetime is statistical: decay fires after a random delay
          if (state.tPhase > state.spontDwell) {
            startTransition();
            updateBanner();
            updateReadouts();
          }
        } else if (state.phase === 'transition') {
          const k = X.clamp(state.tPhase / 0.55, 0, 1);
          const startL = state.mode === 'absorption' ? 1 : 2;
          state.electronLevel = X.lerp(startL, state.targetLevel, k);
          moveOutPhotons(dt);
          if (k >= 1) {
            state.phase = 'complete';
            state.tPhase = 0;
            updateBanner();
            updateReadouts();
          }
        } else if (state.phase === 'complete') {
          if (state.inPhotonAlive) state.inPhotonX += dt * 0.36;
          moveOutPhotons(dt);
          if (state.tPhase > 2.3) {
            resetSimulation(true);
            state.phase = state.mode === 'spontaneous' ? 'wait' : 'approach';
            updateBanner();
            updateReadouts();
          }
        }
      } else if (state.phase === 'transition') {
        // Smooth transition even if paused right on step
        state.electronLevel = X.lerp(state.electronLevel, state.targetLevel, Math.min(1, dt * 8));
      }

      render();
    }

    return {
      mount() {
        buildDOM();
        resetSimulation(true);
        render();
      },
      unmount() {
        // animation loop managed centrally by Ch2Platform; nothing stray left running
      },
      tick,
      resize() {
        render();
      },
      // Shared geometry (also used by tests/ch2-photon-atom.cjs)
      geometry: { CHAMBER, CLIP, PHOTON_SPEED_PX, PHOTON_HALF_EXTENT },
      applyPreset(preset) {
        if (preset === 'absorption' || preset === 'spontaneous' || preset === 'stimulated') {
          state.mode = preset;
          if (ui.modeSeg) ui.modeSeg.set(preset);
          if (ui.lamSlider) ui.lamSlider.input.disabled = (preset === 'spontaneous');
          if (ui.matchBtn) ui.matchBtn.disabled = (preset === 'spontaneous');
          if (ui.triggerBtn) ui.triggerBtn.textContent = preset === 'spontaneous' ? 'Trigger Next Decay' : 'Introduce Photon / Trigger';
          if (preset !== 'spontaneous') {
            const lam0 = Math.round(X.clamp(C.evToNm(state.deltaE), 380, 1050));
            state.lambda = lam0;
            if (ui.lamSlider) ui.lamSlider.setValue(lam0);
          }
          state.stepMode = false;
          state.playing = true;
          if (ui.stepToggle) ui.stepToggle.checked = false;
          if (ui.transport) ui.transport.setPlaying(true);
          triggerCycle();
        }
      },
      getState: () => state,
    };
  };
})();
