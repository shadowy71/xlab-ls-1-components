(function () {
  'use strict';

  const C = window.Ch2Platform;
  const X = window.XLab;

  window.CH2_SIMS['c2t2'] = function createLaserBuilderLab(ctxDom) {
    const { stage, controls, formula, wrap, dot } = ctxDom;

    const state = {
      subview: 'cavity',     // 'cavity' | 'compare'
      playing: true,
      pumpOn: true,
      pumpIntensity: 72,     // 0..100 %
      numAtoms: 64,          // 20..120
      metastableMs: 4.5,     // 0.3..8.0 ms (conceptual timescale mapped to seconds)
      reflectivity: 85,      // 40..99 %
      speed: 1,              // 0.5 | 1 | 2
      screenDist: 8,         // 1..20 m (for Ordinary vs LASER comparison)
      // Runtime simulation state
      atoms: [],             // { x, y, level: 1|2|3, age: 0, flash: 0 }
      photons: [],           // { x, y, vx, vy, axial: bool, phase: number, alpha: number }
      outPhotons: [],        // { x, y, vx, phase }
      pumpPulses: [],        // { x, y, dir, alpha }
      totalGenerated: 0,
      outputFluxSmoothed: 0,
      time: 0,
    };

    let built = false;
    let canvasObj = null;
    let ui = {};
    let banner = null;
    let subtabBar = null;

    function syncAtomCount() {
      const target = Math.round(state.numAtoms);
      while (state.atoms.length < target) {
        state.atoms.push({
          x: 0.06 + Math.random() * 0.88,
          y: 0.10 + Math.random() * 0.80,
          level: 1,
          age: Math.random() * 0.5,
          flash: 0,
        });
      }
      if (state.atoms.length > target) {
        state.atoms.length = target;
      }
    }

    function resetSimulation(keepSliders) {
      if (!keepSliders) {
        state.pumpOn = true;
        state.pumpIntensity = 72;
        state.numAtoms = 64;
        state.metastableMs = 4.5;
        state.reflectivity = 85;
        state.speed = 1;
        state.screenDist = 8;
        if (ui.pumpToggle) ui.pumpToggle.checked = true;
        if (ui.pumpSlider) ui.pumpSlider.setValue(state.pumpIntensity);
        if (ui.atomsSlider) ui.atomsSlider.setValue(state.numAtoms);
        if (ui.lifeSlider) ui.lifeSlider.setValue(state.metastableMs);
        if (ui.refSlider) ui.refSlider.setValue(state.reflectivity);
        if (ui.spdSeg) ui.spdSeg.set(1);
        if (ui.distSlider) ui.distSlider.setValue(state.screenDist);
      }
      state.atoms = [];
      syncAtomCount();
      state.photons = [];
      state.outPhotons = [];
      state.pumpPulses = [];
      state.totalGenerated = 0;
      state.outputFluxSmoothed = 0;
      updateReadouts();
      updateBanner();
    }

    function injectSeedPhoton(count) {
      const n = count || 1;
      for (let i = 0; i < n; i++) {
        state.photons.push({
          x: 0.14 + Math.random() * 0.12,
          y: 0.28 + Math.random() * 0.44,
          vx: 0.92,
          vy: 0,
          axial: true,
          phase: 0,
          alpha: 1,
        });
        state.totalGenerated++;
      }
      updateReadouts();
      updateBanner();
    }

    function getCounts() {
      let n1 = 0, n2 = 0, n3 = 0;
      for (let i = 0; i < state.atoms.length; i++) {
        const lv = state.atoms[i].level;
        if (lv === 1) n1++;
        else if (lv === 2) n2++;
        else n3++;
      }
      const axialCount = state.photons.filter((p) => p.axial).length;
      const inverted = n2 > n1;
      const lossFrac = (100 - state.reflectivity) / 100;
      // Net gain threshold condition (conceptual)
      const gainMargin = (n2 - n1) / Math.max(state.atoms.length, 1);
      const lasingActive = inverted && axialCount >= 2 && gainMargin > lossFrac * 0.22;
      return { n1, n2, n3, axialCount, inverted, lasingActive, gainMargin };
    }

    function buildDOM() {
      if (built) return;
      built = true;

      stage.innerHTML = '';
      controls.innerHTML = '';
      formula.innerHTML = '';

      const canvas = X.el('canvas', 'viz');
      canvas.id = 'cv-c2t2';
      canvas.setAttribute('aria-label', 'Build Your Own LASER Optical Cavity Simulator');
      stage.append(canvas);
      canvasObj = X.setupCanvas(canvas);

      subtabBar = C.buildSubtabs(
        wrap,
        [
          { id: 'cavity', label: 'A. LASER Cavity Lab' },
          { id: 'compare', label: 'B. Ordinary Light vs. LASER' },
        ],
        state.subview,
        (id) => {
          state.subview = id;
          syncSubViewControls();
          updateBanner();
          updateReadouts();
        }
      );

      banner = C.buildBanner(wrap);

      // Controls Inspector
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

      const act = C.buildActionRow(controls, [
        { id: 'seed', label: 'Inject Seed Photon', primary: true, onClick: () => injectSeedPhoton(2) },
      ]);
      ui.seedBtn = act.seed;

      ui.pumpToggle = X.buildToggle(controls, {
        label: 'Optical Pumping (ON/OFF)',
        checked: state.pumpOn,
        onChange: (on) => {
          state.pumpOn = on;
          ui.pumpSlider.input.disabled = !on;
          updateBanner();
        },
      });

      ui.pumpSlider = X.buildSlider(controls, {
        label: 'Pumping Intensity',
        id: 'c2t2-pump',
        min: 0,
        max: 100,
        step: 1,
        value: state.pumpIntensity,
        format: (v) => Math.round(v) + ' %',
        onInput: (v) => { state.pumpIntensity = v; },
      });

      ui.atomsSlider = X.buildSlider(controls, {
        label: 'Number of Atoms (N)',
        id: 'c2t2-atoms',
        min: 20,
        max: 120,
        step: 2,
        value: state.numAtoms,
        format: (v) => Math.round(v) + ' atoms',
        onInput: (v) => { state.numAtoms = v; syncAtomCount(); },
      });

      ui.lifeSlider = X.buildSlider(controls, {
        label: 'Metastable Lifetime τ₂ (conceptual)',
        id: 'c2t2-life',
        min: 0.3,
        max: 8.0,
        step: 0.1,
        value: state.metastableMs,
        format: (v) => v.toFixed(1) + ' ms',
        onInput: (v) => { state.metastableMs = v; },
      });

      ui.refSlider = X.buildSlider(controls, {
        label: 'Output Mirror Reflectivity R₂',
        id: 'c2t2-ref',
        min: 40,
        max: 99,
        step: 1,
        value: state.reflectivity,
        format: (v) => Math.round(v) + ' %',
        onInput: (v) => { state.reflectivity = v; },
      });

      ui.distSlider = X.buildSlider(controls, {
        label: 'Target Screen Distance (Comparison)',
        id: 'c2t2-dist',
        min: 1,
        max: 20,
        step: 0.5,
        value: state.screenDist,
        format: (v) => v.toFixed(1) + ' m',
        onInput: (v) => { state.screenDist = v; },
      });

      const spdWrap = X.el('div', 'slider-block');
      spdWrap.append(X.el('label', 'control-label', 'Simulation Speed'));
      controls.append(spdWrap);
      ui.spdSeg = X.buildSegmented(spdWrap, {
        options: [
          { value: 0.5, label: '0.5×' },
          { value: 1, label: '1×' },
          { value: 2, label: '2×' },
        ],
        value: state.speed,
        onChange: (v) => { state.speed = v; },
      });

      ui.readouts = X.buildReadouts(controls, [
        { id: 'n1', label: 'Lower State N₁' },
        { id: 'n2', label: 'Metastable N₂' },
        { id: 'inv', label: 'Population Inversion', wide: true },
        { id: 'photons', label: 'Photons Generated' },
        { id: 'laser', label: 'Laser Action', primary: true },
      ]);

      const note = X.el('div', 'ctrl-note', '<b>Conceptual Model:</b> Uses scaled rate equations and discrete particle simulation to visualize metastable trapping (τ₂ ≫ τ₃) and optical resonator amplification.');
      controls.append(note);

      syncSubViewControls();
    }

    function syncSubViewControls() {
      const isCmp = state.subview === 'compare';
      if (ui.seedBtn) ui.seedBtn.disabled = isCmp;
      if (ui.distSlider) ui.distSlider.input.closest('.slider-block').style.display = isCmp ? 'flex' : 'none';
    }

    function updateReadouts() {
      if (!ui.readouts) return;
      const c = getCounts();
      ui.readouts.set('n1', String(c.n1));
      ui.readouts.set('n2', String(c.n2));
      ui.readouts.set('inv', c.inverted
        ? `Achieved ✓ (N₂ − N₁ = +${c.n2 - c.n1})`
        : `Not Inverted (N₁ − N₂ = +${c.n1 - c.n2})`);
      ui.readouts.set('photons', `${state.totalGenerated} (${c.axialCount} axial)`);
      ui.readouts.set('laser', c.lasingActive ? 'LASING ACTIVE ✓' : (c.inverted ? 'Inverted — Building' : 'Below Threshold'));

      if (state.subview === 'compare') {
        formula.innerHTML = `
          <span class="formula active">LASER: Δλ → 0 (Monochromatic) · Δφ = const (Coherent)</span>
          <span class="formula">Beam Spread: θ<sub>laser</sub> ≪ θ<sub>ordinary</sub> · Intensity ∝ Power / Area</span>`;
      } else {
        formula.innerHTML = `
          <span class="formula ${c.inverted ? 'active' : ''}">Population Inversion: <span class="fv">N₂ (${c.n2}) ${c.inverted ? '>' : '≤'} N₁ (${c.n1})</span></span>
          <span class="formula">Output Coupling: <span class="fv">T = 1 − R₂ = ${100 - Math.round(state.reflectivity)}%</span></span>
          <span class="formula ${c.lasingActive ? 'active' : ''}">Status: <span class="fv">${c.lasingActive ? 'Stimulated Gain ≥ Loss' : 'Need N₂ > N₁ & Resonator Gain'}</span></span>`;
      }
    }

    function updateBanner() {
      if (!banner) return;
      if (state.subview === 'compare') {
        banner.set('PROPERTIES', '', 'Comparing <b>Ordinary Light</b> (polychromatic, incoherent, diverging) vs. <b>LASER Light</b> (monochromatic, coherent, collimated, intense).');
        return;
      }
      const c = getCounts();
      if (!state.pumpOn || state.pumpIntensity < 5) {
        banner.set('IDLE', 'warn', 'Pump is OFF/low: atoms relax to ground state <b>E₁</b>. Turn on pumping to populate metastable state <b>E₂</b>.');
      } else if (!c.inverted) {
        banner.set('PUMPING', '', 'Pumping excites <b>E₁ → E₃ → E₂</b>, but <b>N₂ ≤ N₁</b>. Increase pump intensity or metastable lifetime τ₂ to invert population.');
      } else if (c.axialCount < 2) {
        banner.set('INVERTED ✓', 'ok', '<b>Population inversion (N₂ &gt; N₁)</b> achieved! Click <b>Inject Seed Photon</b> or wait for axial spontaneous emission to start lasing.');
      } else if (c.lasingActive) {
        banner.set('LASING ACTIVE', 'ok', '<b>Stimulated emission cascade!</b> Coherent photons amplify between M₁ and M₂, emerging as a collimated beam through R₂.');
      } else {
        banner.set('GAIN vs LOSS', 'warn', 'High mirror transmission (low R₂) leaks photons faster than gain builds. Raise <b>R₂</b> or <b>Pumping</b>.');
      }
    }

    /* ============================================================
       PHYSICS STEP
       ============================================================ */
    function updatePhysics(rawDt) {
      const dt = rawDt * state.speed;
      state.time += dt;
      if (!state.playing) return;

      syncAtomCount();
      const pumpRate = state.pumpOn ? (state.pumpIntensity / 100) * 1.45 : 0;
      const tau2Sec = state.metastableMs * 0.9; // scaled simulation timescale
      const tau3Sec = 0.08;

      // Visual pump flashes
      if (state.pumpOn && state.pumpIntensity > 5 && Math.random() < (state.pumpIntensity / 100) * dt * 16) {
        state.pumpPulses.push({ x: 0.06 + Math.random() * 0.88, y: 0.02, alpha: 1 });
      }
      state.pumpPulses.forEach((p) => { p.y += dt * 1.5; p.alpha -= dt * 1.3; });
      state.pumpPulses = state.pumpPulses.filter((p) => p.alpha > 0 && p.y < 1.0);

      // Atomic transitions (3-level system: E1 -> E3 -> E2 -> E1)
      for (let i = 0; i < state.atoms.length; i++) {
        const a = state.atoms[i];
        a.age += dt;
        a.flash = Math.max(0, a.flash - dt * 3);
        if (a.level === 1) {
          if (pumpRate > 0 && Math.random() < pumpRate * dt) {
            a.level = 3;
            a.age = 0;
            a.flash = 1;
          }
        } else if (a.level === 3) {
          // Fast non-radiative decay E3 -> E2 (accumulates in metastable state)
          if (a.age > tau3Sec || Math.random() < dt / tau3Sec) {
            a.level = 2;
            a.age = 0;
          }
        } else if (a.level === 2) {
          // Spontaneous decay from metastable state E2 -> E1
          if (Math.random() < dt / tau2Sec) {
            a.level = 1;
            a.age = 0;
            // Small chance spontaneous photon happens to align axially with resonator
            const axial = Math.random() < 0.16;
            const ang = axial ? (Math.random() < 0.5 ? 0 : Math.PI) : (Math.random() * Math.PI * 2);
            const spd = axial ? 0.92 : 0.72;
            state.photons.push({
              x: a.x,
              y: a.y,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd,
              axial,
              phase: Math.random() * Math.PI * 2,
              alpha: 1,
            });
            state.totalGenerated++;
          }
        }
      }

      // Photon motion, stimulated emission, absorption & mirror reflections
      const nextPhotons = [];
      const maxCavityPhotons = 110;
      const R2 = state.reflectivity / 100;

      for (let i = 0; i < state.photons.length; i++) {
        const p = state.photons[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Off-axis spontaneous photons escape cavity top/bottom
        if (!p.axial && (p.y < 0.02 || p.y > 0.98 || p.x < 0.01 || p.x > 0.99)) {
          continue;
        }

        // Interaction with nearby atoms along path
        if (p.axial && state.atoms.length > 0) {
          for (let j = 0; j < state.atoms.length; j++) {
            const a = state.atoms[j];
            const dx = a.x - p.x;
            const dy = a.y - p.y;
            if (dx * dx + dy * dy < 0.0022) {
              if (a.level === 2 && state.photons.length + nextPhotons.length < maxCavityPhotons) {
                // Stimulated emission! Coherent clone photon with same vx, vy, phase
                if (Math.random() < 0.55) {
                  a.level = 1;
                  a.age = 0;
                  a.flash = 1;
                  nextPhotons.push({
                    x: p.x,
                    y: X.clamp(p.y + (Math.random() - 0.5) * 0.04, 0.08, 0.92),
                    vx: p.vx,
                    vy: 0,
                    axial: true,
                    phase: p.phase,
                    alpha: 1,
                  });
                  state.totalGenerated++;
                  break;
                }
              } else if (a.level === 1 && Math.random() < 0.16) {
                // Ground state absorbs photon when population not inverted
                a.level = 3;
                a.age = 0;
                a.flash = 0.8;
                p.alpha = 0;
                break;
              }
            }
          }
        }
        if (p.alpha <= 0) continue;

        // Left Mirror M1 (R1 = 100% reflection)
        if (p.x <= 0.02 && p.vx < 0) {
          p.x = 0.02;
          p.vx = Math.abs(p.vx);
        }
        // Right Mirror M2 (Partially reflecting output coupler R2)
        if (p.x >= 0.98 && p.vx > 0) {
          if (Math.random() < R2) {
            p.x = 0.98;
            p.vx = -Math.abs(p.vx);
          } else {
            // Transmitted out of resonator as LASER beam photon!
            state.outPhotons.push({ x: 0, y: p.y, vx: 1.35, phase: p.phase });
            continue;
          }
        }

        nextPhotons.push(p);
      }
      state.photons = nextPhotons;

      // Update emerging laser beam photons
      state.outPhotons.forEach((op) => { op.x += op.vx * dt; });
      state.outPhotons = state.outPhotons.filter((op) => op.x <= 1.05);

      const c = getCounts();
      const targetOut = c.lasingActive ? X.clamp((c.axialCount / 36) * (1 - R2) * 3.2, 0.15, 1) : 0;
      state.outputFluxSmoothed = X.lerp(state.outputFluxSmoothed, targetOut, Math.min(1, dt * 4));
    }

    /* ============================================================
       RENDERING
       ============================================================ */
    function renderCavityView(ctx, w, h) {
      const narrow = w < 620;
      const c = getCounts();

      // Top optical resonator region
      const cavX = narrow ? 18 : 28;
      const cavY = narrow ? 46 : 48;
      const cavW = narrow ? w * 0.64 : w * 0.68;
      const cavH = narrow ? h * 0.48 : h * 0.54;
      const outEndX = w - (narrow ? 14 : 24);

      // Header status
      ctx.textAlign = 'left';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillStyle = '#edf1f8';
      ctx.fillText('ACTIVE MEDIUM & OPTICAL RESONATOR', cavX, 24);
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillStyle = c.lasingActive ? '#34d399' : (c.inverted ? '#e0b553' : '#8f9cb5');
      ctx.textAlign = 'right';
      ctx.fillText(c.lasingActive ? 'LASER BEAM ACTIVE' : (c.inverted ? 'POPULATION INVERTED' : 'AWAITING INVERSION'), outEndX, 24);

      // Pump Lamp Housing on Top
      if (state.pumpOn && state.pumpIntensity > 0) {
        const pAlpha = 0.08 + 0.35 * (state.pumpIntensity / 100);
        const pg = ctx.createLinearGradient(0, cavY - 14, 0, cavY + 30);
        pg.addColorStop(0, `rgba(168,85,247,${pAlpha})`);
        pg.addColorStop(1, 'rgba(168,85,247,0)');
        ctx.fillStyle = pg;
        ctx.fillRect(cavX + 12, cavY - 14, cavW - 24, 44);
      }
      ctx.fillStyle = 'rgba(168,85,247,0.85)';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        state.pumpOn ? `Optical Pump (${Math.round(state.pumpIntensity)}%) ↓↓↓` : 'Optical Pump (OFF)',
        cavX + cavW / 2,
        cavY - 8
      );

      // Active medium chamber
      ctx.fillStyle = 'rgba(12,18,38,0.82)';
      ctx.fillRect(cavX, cavY, cavW, cavH);
      ctx.strokeStyle = c.inverted ? 'rgba(52,211,153,0.45)' : 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(cavX, cavY, cavW, cavH);

      // Pump flash rays inside medium
      state.pumpPulses.forEach((pp) => {
        const px = cavX + pp.x * cavW;
        const py = cavY + pp.y * cavH;
        ctx.strokeStyle = `rgba(192,132,252,${pp.alpha * 0.65})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(px, py - 12);
        ctx.lineTo(px, py);
        ctx.stroke();
      });

      // Mirror M1 (Left, 100% reflecting)
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(cavX - 7, cavY - 4, 8, cavH + 8);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(cavX - 1, cavY - 4, 2, cavH + 8);
      ctx.font = 'bold 9.5px JetBrains Mono, monospace';
      ctx.fillStyle = '#22d3ee';
      ctx.textAlign = 'left';
      ctx.fillText('M₁ (100%)', cavX - 8, cavY + cavH + 16);

      // Mirror M2 (Right, partially reflecting R2)
      const m2X = cavX + cavW;
      ctx.fillStyle = `rgba(56,189,248,${0.35 + 0.55 * (state.reflectivity / 100)})`;
      ctx.fillRect(m2X - 1, cavY - 4, 8, cavH + 8);
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(m2X - 1, cavY - 4, 8, cavH + 8);
      ctx.fillStyle = '#22d3ee';
      ctx.textAlign = 'center';
      ctx.fillText(`M₂ (${Math.round(state.reflectivity)}%)`, m2X + 2, cavY + cavH + 16);

      // Atoms inside active medium
      state.atoms.forEach((a) => {
        const ax = cavX + a.x * cavW;
        const ay = cavY + a.y * cavH;
        if (a.level === 2) {
          // Metastable excited state — prominent emerald/gold glow
          const g = ctx.createRadialGradient(ax, ay, 0, ax, ay, 10);
          g.addColorStop(0, 'rgba(52,211,153,0.9)');
          g.addColorStop(1, 'rgba(52,211,153,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(ax, ay, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#34d399';
          ctx.beginPath();
          ctx.arc(ax, ay, 3.6, 0, Math.PI * 2);
          ctx.fill();
        } else if (a.level === 3) {
          ctx.fillStyle = '#c084fc';
          ctx.beginPath();
          ctx.arc(ax, ay, 4.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Ground state E1
          ctx.fillStyle = 'rgba(100,130,185,0.65)';
          ctx.beginPath();
          ctx.arc(ax, ay, 3.0, 0, Math.PI * 2);
          ctx.fill();
        }
        if (a.flash > 0.05) {
          ctx.strokeStyle = `rgba(255,255,255,${a.flash * 0.7})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(ax, ay, 5 + (1 - a.flash) * 8, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      // Photons inside cavity
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      state.photons.forEach((p) => {
        const px = cavX + p.x * cavW;
        const py = cavY + p.y * cavH;
        if (p.axial) {
          const dir = p.vx >= 0 ? 1 : -1;
          ctx.strokeStyle = 'rgba(255,68,95,0.92)';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          for (let k = -10; k <= 10; k += 2) {
            const wx = px + k * dir;
            const wy = py + Math.sin(k * 0.55 - state.time * 18) * 3.2;
            if (k === -10) ctx.moveTo(wx, wy);
            else ctx.lineTo(wx, wy);
          }
          ctx.stroke();
          ctx.fillStyle = '#ff6b81';
          ctx.beginPath();
          ctx.arc(px + 10 * dir, py, 2.3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = 'rgba(224,181,83,0.75)';
          ctx.beginPath();
          ctx.arc(px, py, 2.3, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.restore();

      // Emerging Output Laser Beam + Detector Screen
      const beamY = cavY + cavH * 0.5;
      const detX = outEndX - 10;
      const beamLen = Math.max(20, detX - (m2X + 7));

      // Output detector plate
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(detX, cavY + 12, 10, cavH - 24);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.strokeRect(detX, cavY + 12, 10, cavH - 24);

      if (state.outputFluxSmoothed > 0.04) {
        const glowH = 10 + state.outputFluxSmoothed * 24;
        const bg = ctx.createLinearGradient(0, beamY - glowH, 0, beamY + glowH);
        bg.addColorStop(0, 'rgba(255,48,88,0)');
        bg.addColorStop(0.5, `rgba(255,58,95,${0.45 * state.outputFluxSmoothed})`);
        bg.addColorStop(1, 'rgba(255,48,88,0)');
        ctx.fillStyle = bg;
        ctx.fillRect(m2X + 7, beamY - glowH, beamLen, glowH * 2);

        // Sharp coherent beam core
        ctx.strokeStyle = `rgba(255,95,125,${0.55 + 0.45 * state.outputFluxSmoothed})`;
        ctx.lineWidth = 3 + state.outputFluxSmoothed * 3;
        ctx.beginPath();
        ctx.moveTo(m2X + 7, beamY);
        ctx.lineTo(detX, beamY);
        ctx.stroke();

        // Detector hit spot
        const sg = ctx.createRadialGradient(detX, beamY, 0, detX, beamY, 18);
        sg.addColorStop(0, `rgba(255,140,160,${state.outputFluxSmoothed})`);
        sg.addColorStop(1, 'rgba(255,50,90,0)');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(detX, beamY, 18, 0, Math.PI * 2);
        ctx.fill();
      }

      // Emerging individual photons along output beam
      state.outPhotons.forEach((op) => {
        const ox = m2X + 7 + op.x * beamLen;
        const oy = cavY + op.y * cavH;
        ctx.fillStyle = '#ff6b81';
        ctx.beginPath();
        ctx.arc(ox, oy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = c.lasingActive ? '#ff8fa3' : '#5e6a84';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(c.lasingActive ? 'LASER Output' : 'No Beam Yet', m2X + 7 + beamLen / 2, beamY - 22);

      // Legend line below cavity
      const legY = cavY + cavH + 30;
      ctx.textAlign = 'left';
      ctx.font = '9.5px Inter, sans-serif';
      ctx.fillStyle = '#6482b9';
      ctx.beginPath(); ctx.arc(cavX + 4, legY - 3, 3, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#8f9cb5';
      ctx.fillText('E₁ (ground)', cavX + 12, legY);

      ctx.fillStyle = '#c084fc';
      ctx.beginPath(); ctx.arc(cavX + 92, legY - 3, 3.2, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#8f9cb5';
      ctx.fillText('E₃ (pump)', cavX + 100, legY);

      ctx.fillStyle = '#34d399';
      ctx.beginPath(); ctx.arc(cavX + 170, legY - 3, 3.5, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#8f9cb5';
      ctx.fillText('E₂ (metastable)', cavX + 178, legY);

      // Bottom Dual Diagnostics: Left = 3-Level Energy Diagram | Right = Population Bars (N1 vs N2)
      const botY = legY + 14;
      const botH = h - botY - 12;
      if (botH < 95) return;

      const leftW = (w - cavX * 2 - 14) * 0.48;
      const rightX = cavX + leftW + 14;
      const rightW = w - rightX - (narrow ? 14 : 24);

      // 3-Level Box
      ctx.fillStyle = 'rgba(6,10,24,0.72)';
      ctx.fillRect(cavX, botY, leftW, botH);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.strokeRect(cavX, botY, leftW, botH);
      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('3-LEVEL LASER SCHEME', cavX + 10, botY + 16);

      const lx1 = cavX + 28, lx2 = cavX + leftW - 22;
      const y3 = botY + 32, y2 = botY + botH * 0.54, y1 = botY + botH - 16;

      // E3
      ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(lx1, y3); ctx.lineTo(lx2, y3); ctx.stroke(); ctx.setLineDash([]);
      // E2 (metastable - thicker)
      ctx.strokeStyle = '#34d399'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(lx1, y2); ctx.lineTo(lx2, y2); ctx.stroke();
      // E1
      ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(lx1, y1); ctx.lineTo(lx2, y1); ctx.stroke();

      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.fillStyle = '#c084fc'; ctx.fillText('E₃', cavX + 8, y3 + 3);
      ctx.fillStyle = '#34d399'; ctx.fillText('E₂', cavX + 8, y2 + 3);
      ctx.fillStyle = '#60a5fa'; ctx.fillText('E₁', cavX + 8, y1 + 3);

      // Arrows: Pump E1 -> E3, Non-rad E3 -> E2, Lasing E2 -> E1
      const ax1 = lx1 + (lx2 - lx1) * 0.22;
      const ax2 = lx1 + (lx2 - lx1) * 0.54;
      const ax3 = lx1 + (lx2 - lx1) * 0.80;

      // Pump arrow
      ctx.strokeStyle = state.pumpOn ? '#c084fc' : 'rgba(192,132,252,0.28)';
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(ax1, y1 - 2); ctx.lineTo(ax1, y3 + 4); ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath(); ctx.moveTo(ax1, y3 + 2); ctx.lineTo(ax1 - 4, y3 + 9); ctx.lineTo(ax1 + 4, y3 + 9); ctx.closePath(); ctx.fill();

      // Fast decay E3 -> E2
      ctx.strokeStyle = '#e0b553'; ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.moveTo(ax1 + 8, y3 + 2); ctx.lineTo(ax2 - 6, y2 - 4); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#e0b553';
      ctx.font = '8.5px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('fast', (ax1 + ax2) / 2 + 8, (y3 + y2) / 2 - 2);

      // Laser transition E2 -> E1
      ctx.strokeStyle = c.lasingActive ? '#ff6b81' : 'rgba(255,107,129,0.45)';
      ctx.lineWidth = c.lasingActive ? 2.5 : 1.5;
      ctx.beginPath(); ctx.moveTo(ax3, y2 + 3); ctx.lineTo(ax3, y1 - 4); ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath(); ctx.moveTo(ax3, y1 - 2); ctx.lineTo(ax3 - 4, y1 - 9); ctx.lineTo(ax3 + 4, y1 - 9); ctx.closePath(); ctx.fill();
      if (!narrow) {
        ctx.fillStyle = '#34d399';
        ctx.fillText('metastable (τ₂)', ax2, y2 - 6);
        ctx.fillStyle = '#ff8fa3';
        ctx.fillText('laser hν', ax3, (y2 + y1) / 2 + 3);
      }

      // Population Inversion Bars Box
      ctx.fillStyle = 'rgba(6,10,24,0.72)';
      ctx.fillRect(rightX, botY, rightW, botH);
      ctx.strokeStyle = c.inverted ? 'rgba(52,211,153,0.55)' : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = c.inverted ? 1.6 : 1;
      ctx.strokeRect(rightX, botY, rightW, botH);

      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('POPULATION COUNTS', rightX + 10, botY + 16);

      ctx.textAlign = 'right';
      ctx.font = 'bold 9.5px JetBrains Mono, monospace';
      ctx.fillStyle = c.inverted ? '#34d399' : '#e08c3a';
      ctx.fillText(c.inverted ? 'INVERSION: N₂ > N₁ ✓' : 'NO INVERSION (N₁ ≥ N₂)', rightX + rightW - 10, botY + 16);

      const barAreaX = rightX + 14;
      const barAreaW = rightW - 28;
      const maxN = Math.max(state.atoms.length, 1);

      const drawPopBar = (label, val, yPos, color) => {
        const bw = (val / maxN) * (barAreaW - 88);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#8f9cb5';
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText(label, barAreaX, yPos + 11);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(barAreaX + 46, yPos, barAreaW - 88, 14);
        ctx.fillStyle = color;
        ctx.fillRect(barAreaX + 46, yPos, bw, 14);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#edf1f8';
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.fillText(String(val), rightX + rightW - 12, yPos + 11);
      };

      const bY1 = botY + 32;
      const bY2 = botY + 56;
      drawPopBar('N₂ (E₂)', c.n2, bY1, c.inverted ? '#34d399' : '#e0b553');
      drawPopBar('N₁ (E₁)', c.n1, bY2, '#60a5fa');

      // Threshold midpoint tick (50% line)
      const halfX = barAreaX + 46 + (barAreaW - 88) * 0.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(halfX, bY1 - 3); ctx.lineTo(halfX, bY2 + 17); ctx.stroke();
      ctx.setLineDash([]);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#8f9cb5';
      ctx.font = '9.5px Inter, sans-serif';
      ctx.fillText(
        `ΔN = N₂ − N₁ = ${c.n2 - c.n1 >= 0 ? '+' : ''}${c.n2 - c.n1}  |  Active cavity photons: ${c.axialCount}`,
        barAreaX,
        botY + botH - 10
      );
    }

    function renderComparisonView(ctx, w, h) {
      const narrow = w < 620;
      const pad = narrow ? 14 : 22;
      const colGap = 14;
      const colW = (w - pad * 2 - colGap) / 2;
      const topY = 44;
      const panelH = h - topY - 16;

      ctx.textAlign = 'left';
      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 13px Inter, sans-serif';
      ctx.fillText('ORDINARY LIGHT vs. LASER LIGHT — FOUR FUNDAMENTAL PROPERTIES', pad, 26);

      const drawHeaderCard = (x, title, badge, borderCol, titleCol) => {
        ctx.fillStyle = 'rgba(8,12,28,0.84)';
        ctx.fillRect(x, topY, colW, panelH);
        ctx.strokeStyle = borderCol;
        ctx.lineWidth = 1.4;
        ctx.strokeRect(x, topY, colW, panelH);

        ctx.fillStyle = titleCol;
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(title, x + 14, topY + 22);
        if (!narrow) {
          ctx.fillStyle = '#8f9cb5';
          ctx.font = '10px JetBrains Mono, monospace';
          ctx.textAlign = 'right';
          ctx.fillText(badge, x + colW - 14, topY + 22);
        }
      };

      const lx = pad;
      const rx = pad + colW + colGap;
      drawHeaderCard(lx, 'ORDINARY LIGHT (Thermal / Bulb)', 'Incoherent', 'rgba(224,181,83,0.38)', '#e0b553');
      drawHeaderCard(rx, 'LASER LIGHT (Stimulated Emission)', 'Coherent', 'rgba(34,211,238,0.45)', '#22d3ee');

      const secH = (panelH - 36) / 3;
      const y1 = topY + 34;
      const y2 = y1 + secH;
      const y3 = y2 + secH;

      // 1. MONOCHROMATICITY (Spectrum + Wave colors)
      ctx.textAlign = 'left';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillStyle = '#edf1f8';
      ctx.fillText('1. Monochromaticity (Spectral Width Δλ)', lx + 14, y1 + 16);
      ctx.fillText('1. Monochromaticity (Single λ₀)', rx + 14, y1 + 16);

      // Rainbow spectrum for ordinary
      const spX1 = lx + 14, spW = colW - 28, spY1 = y1 + 26, spH1 = 18;
      const grad = ctx.createLinearGradient(spX1, 0, spX1 + spW, 0);
      grad.addColorStop(0, '#7c3aed');
      grad.addColorStop(0.25, '#3b82f6');
      grad.addColorStop(0.45, '#10b981');
      grad.addColorStop(0.65, '#f59e0b');
      grad.addColorStop(1, '#ef4444');
      ctx.fillStyle = grad;
      ctx.fillRect(spX1, spY1, spW, spH1);
      ctx.fillStyle = '#8f9cb5';
      ctx.font = '9.5px Inter, sans-serif';
      ctx.fillText('Broad spectrum: many λ mixed', spX1, spY1 + 32);

      // Single spectral line for LASER
      const spX2 = rx + 14;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(spX2, spY1, spW, spH1);
      ctx.fillStyle = '#ff4d6d';
      ctx.fillRect(spX2 + spW * 0.72, spY1 - 2, 4, spH1 + 4);
      ctx.fillStyle = '#8f9cb5';
      ctx.fillText('Sharp single wavelength (Δλ ≈ 0)', spX2, spY1 + 32);

      // 2. COHERENCE (Phase Alignment)
      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillText('2. Coherence (Random Phases)', lx + 14, y2 + 12);
      ctx.fillText('2. Coherence (Phase-Locked Waves)', rx + 14, y2 + 12);

      const waveCols = ['#38bdf8', '#f59e0b', '#ec4899'];
      const phaseShifts = [0, 2.1, 4.4];
      const freqMults = [0.11, 0.16, 0.08];
      const tAnim = C.prefersReducedMotion() ? 0 : state.time * 6;
      for (let k = 0; k < 3; k++) {
        const wy = y2 + 28 + k * 20;
        // Ordinary: different wavelengths & phases
        ctx.strokeStyle = waveCols[k];
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let i = 0; i <= 54; i++) {
          const px = lx + 14 + (i / 54) * (colW - 28);
          const py = wy + Math.sin(i * freqMults[k] * 4 + phaseShifts[k] - tAnim * (0.8 + k * 0.3)) * 5.5;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // LASER: identical wavelength & exact phase lock
        ctx.strokeStyle = '#ff4d6d';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i = 0; i <= 54; i++) {
          const px = rx + 14 + (i / 54) * (colW - 28);
          const py = wy + Math.sin(i * 0.45 - tAnim) * 5.5;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      // Phase lock vertical guide on LASER waves
      ctx.strokeStyle = 'rgba(52,211,153,0.5)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(rx + colW * 0.5, y2 + 22);
      ctx.lineTo(rx + colW * 0.5, y2 + 78);
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. DIRECTIONALITY & HIGH INTENSITY (Divergence at distance d)
      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillText(`3 & 4. Directionality + Intensity (d = ${state.screenDist.toFixed(1)} m)`, lx + 14, y3 + 12);
      ctx.fillText(`3 & 4. Collimated + High Intensity (d = ${state.screenDist.toFixed(1)} m)`, rx + 14, y3 + 12);

      const dNorm = (state.screenDist - 1) / 19; // 0..1
      const beamSpanX = colW - 44;
      const scrX1 = lx + 18 + beamSpanX * (0.35 + 0.65 * dNorm);
      const scrX2 = rx + 18 + beamSpanX * (0.35 + 0.65 * dNorm);
      const midY = y3 + secH * 0.58;

      // Ordinary beam cone (diverges strongly)
      const ordSpread = 12 + dNorm * (secH * 0.36);
      const og = ctx.createLinearGradient(lx + 18, midY, scrX1, midY);
      og.addColorStop(0, 'rgba(224,181,83,0.55)');
      og.addColorStop(1, `rgba(224,181,83,${0.25 - 0.16 * dNorm})`);
      ctx.fillStyle = og;
      ctx.beginPath();
      ctx.moveTo(lx + 18, midY - 4);
      ctx.lineTo(scrX1, midY - ordSpread);
      ctx.lineTo(scrX1, midY + ordSpread);
      ctx.lineTo(lx + 18, midY + 4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(scrX1, y3 + 22); ctx.lineTo(scrX1, y3 + secH - 8); ctx.stroke();

      // LASER beam (tightly collimated)
      const lasSpread = 3 + dNorm * 2.5;
      ctx.fillStyle = 'rgba(255,77,109,0.75)';
      ctx.beginPath();
      ctx.moveTo(rx + 18, midY - 3);
      ctx.lineTo(scrX2, midY - lasSpread);
      ctx.lineTo(scrX2, midY + lasSpread);
      ctx.lineTo(rx + 18, midY + 3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(scrX2, y3 + 22); ctx.lineTo(scrX2, y3 + secH - 8); ctx.stroke();

      const relIntensity = Math.pow(ordSpread / lasSpread, 2);
      ctx.fillStyle = '#e0b553'; ctx.font = '9.5px JetBrains Mono, monospace';
      ctx.fillText(`Spot spreads widely · I ∝ 1/d²`, lx + 14, y3 + secH - 6);
      ctx.fillStyle = '#34d399';
      ctx.fillText(`Focused spot · ~${Math.round(relIntensity)}× higher irradiance`, rx + 14, y3 + secH - 6);
    }

    function render() {
      if (!canvasObj) return;
      const { ctx, w, h } = canvasObj;
      ctx.clearRect(0, 0, w, h);
      if (state.subview === 'compare') renderComparisonView(ctx, w, h);
      else renderCavityView(ctx, w, h);
    }

    let uiTimer = 0;
    function tick(dt) {
      if (state.subview === 'cavity') {
        updatePhysics(dt);
      } else if (state.playing) {
        state.time += dt * state.speed;
      }
      uiTimer += dt;
      if (uiTimer >= 0.14) {
        uiTimer = 0;
        updateReadouts();
        updateBanner();
      }
      render();
    }

    return {
      mount() {
        buildDOM();
        if (state.atoms.length === 0) syncAtomCount();
        canvasObj = X.setupCanvas(document.getElementById('cv-c2t2'));
        updateReadouts();
        updateBanner();
        render();
      },
      unmount() {},
      tick,
      resize() {
        const cv = document.getElementById('cv-c2t2');
        if (cv) canvasObj = X.setupCanvas(cv);
        render();
      },
      applyPreset(preset) {
        if (preset === 'compare-lights') {
          state.subview = 'compare';
          if (subtabBar) subtabBar.set('compare');
          syncSubViewControls();
        } else if (preset === 'short-lifetime') {
          state.subview = 'cavity';
          if (subtabBar) subtabBar.set('cavity');
          syncSubViewControls();
          state.pumpOn = true;
          state.pumpIntensity = 70;
          state.metastableMs = 0.4;
          if (ui.pumpToggle) ui.pumpToggle.checked = true;
          if (ui.pumpSlider) ui.pumpSlider.setValue(70);
          if (ui.lifeSlider) ui.lifeSlider.setValue(0.4);
        } else {
          state.subview = 'cavity';
          if (subtabBar) subtabBar.set('cavity');
          syncSubViewControls();
          state.pumpOn = true;
          state.pumpIntensity = 88;
          state.metastableMs = 6.0;
          state.reflectivity = 88;
          if (ui.pumpToggle) ui.pumpToggle.checked = true;
          if (ui.pumpSlider) ui.pumpSlider.setValue(88);
          if (ui.lifeSlider) ui.lifeSlider.setValue(6.0);
          if (ui.refSlider) ui.refSlider.setValue(88);
          // Pre-populate metastable state slightly so user sees cascade quickly
          state.atoms.forEach((a, idx) => { a.level = idx % 4 === 0 ? 1 : 2; });
          injectSeedPhoton(4);
        }
        updateReadouts();
        updateBanner();
      },
      getState: () => state,
    };
  };
})();
