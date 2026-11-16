(function () {
  'use strict';

  const C = window.Ch2Platform;
  const X = window.XLab;

  window.CH2_SIMS['c2t4'] = function createCo2LaserLab(ctxDom) {
    const { stage, controls, formula, wrap, dot } = ctxDom;

    const STAGES = [
      { id: 1, title: '1. Electrical Discharge', desc: 'High voltage across electrodes accelerates free electrons (e⁻) through the CO₂–N₂–He gas mixture.' },
      { id: 2, title: '2. N₂ Excitation', desc: 'Accelerated electrons collide with N₂ molecules, exciting them to a long-lived vibrational state (N₂*).' },
      { id: 3, title: '3. Resonant Transfer', desc: 'Excited N₂* transfers vibrational energy to ground-state CO₂ via resonant inelastic collisions.' },
      { id: 4, title: '4. E₅ Accumulation', desc: 'CO₂ molecules accumulate in the upper asymmetric stretching state E₅.' },
      { id: 5, title: '5. Population Inversion', desc: 'Population N(E₅) exceeds lower levels N(E₄), assisted by He clearing E₄/E₃ → E₂ → E₁ and removing heat.' },
      { id: 6, title: '6. Stimulated Emission', desc: 'Resonator photons trigger E₅ → E₄ (10.6 μm) and alternate E₅ → E₃ transitions, building coherent radiation.' },
      { id: 7, title: '7. 10.6 μm Output Beam', desc: 'Intense far-infrared 10.6 μm laser beam emerges through the partially transmitting mirror.' },
    ];

    const state = {
      playing: true,
      discharge: 80,          // 0..100 %
      gasExcitation: 82,      // 0..100 % (N2 transfer + He cooling effectiveness)
      speed: 1,               // 0.5 | 1 | 2
      vibMode: 'asymmetric',  // 'symmetric' | 'bending' | 'asymmetric'
      stageIdx: 0,            // 0..6 (auto-progresses with conditions, or steppable!)
      stageTimer: 0,
      time: 0,
      molecules: [],          // gas particles inside discharge tube
      electrons: [],          // fast discharge electrons
      beamPhotons: [],        // cavity IR photons
      outPhotons: [],
    };

    let built = false;
    let canvasObj = null;
    let ui = {};
    let banner = null;

    function seedParticles() {
      state.molecules = [];
      // Typical conceptual CO2 : N2 : He mixture representation (4 CO2, 6 N2, 16 He)
      for (let i = 0; i < 4; i++) {
        state.molecules.push({
          type: 'CO2',
          x: 0.14 + Math.random() * 0.72,
          y: 0.18 + Math.random() * 0.64,
          vx: (Math.random() - 0.5) * 0.16,
          vy: (Math.random() - 0.5) * 0.14,
          excited: false,
        });
      }
      for (let i = 0; i < 6; i++) {
        state.molecules.push({
          type: 'N2',
          x: 0.12 + Math.random() * 0.76,
          y: 0.16 + Math.random() * 0.68,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.18,
          excited: false,
        });
      }
      for (let i = 0; i < 16; i++) {
        state.molecules.push({
          type: 'He',
          x: 0.08 + Math.random() * 0.84,
          y: 0.12 + Math.random() * 0.76,
          vx: (Math.random() - 0.5) * 0.42,
          vy: (Math.random() - 0.5) * 0.36,
          excited: false,
        });
      }
      state.electrons = [];
      for (let i = 0; i < 12; i++) {
        state.electrons.push({
          x: Math.random(),
          y: 0.20 + Math.random() * 0.60,
          vx: 0.65 + Math.random() * 0.5,
        });
      }
    }

    function maxAchievableStage() {
      if (state.discharge < 10) return 0; // stage 1 only (barely off)
      if (state.discharge < 28) return 1; // electrons excite some N2
      if (state.gasExcitation < 25) return 2; // poor transfer/cooling limits accumulation
      if (state.discharge * 0.6 + state.gasExcitation * 0.4 < 45) return 3;
      if (state.discharge * 0.55 + state.gasExcitation * 0.45 < 56) return 4;
      return 6; // full 7th stage (0-indexed 6)
    }

    function resetSimulation(keepSliders) {
      if (!keepSliders) {
        state.discharge = 80;
        state.gasExcitation = 82;
        state.speed = 1;
        state.vibMode = 'asymmetric';
        if (ui.disSlider) ui.disSlider.setValue(80);
        if (ui.gasSlider) ui.gasSlider.setValue(82);
        if (ui.spdSeg) ui.spdSeg.set(1);
        if (ui.vibSeg) ui.vibSeg.set('asymmetric');
      }
      state.stageIdx = 0;
      state.stageTimer = 0;
      state.beamPhotons = [];
      state.outPhotons = [];
      seedParticles();
      updateReadouts();
      updateBanner();
    }

    function buildDOM() {
      if (built) return;
      built = true;

      stage.innerHTML = '';
      controls.innerHTML = '';
      formula.innerHTML = '';

      const canvas = X.el('canvas', 'viz');
      canvas.id = 'cv-c2t4';
      canvas.setAttribute('aria-label', 'CO2 Laser Working Simulator and Molecular Vibrations');
      stage.append(canvas);
      canvasObj = X.setupCanvas(canvas);

      banner = C.buildBanner(wrap);

      ui.transport = C.buildTransport(controls, {
        onTogglePlay: () => {
          state.playing = !state.playing;
          ui.transport.setPlaying(state.playing);
          if (dot) dot.textContent = state.playing ? 'Live' : 'Paused';
        },
        onStep: () => {
          state.stageIdx = (state.stageIdx + 1) % STAGES.length;
          state.stageTimer = 0;
          updateReadouts();
          updateBanner();
        },
        onReset: () => resetSimulation(false),
        playLabel: 'Pause',
        stepLabel: 'Next Stage →',
      });
      ui.transport.setPlaying(true);

      ui.disSlider = X.buildSlider(controls, {
        label: 'Discharge Intensity',
        id: 'c2t4-dis',
        min: 0,
        max: 100,
        step: 1,
        value: state.discharge,
        format: (v) => Math.round(v) + ' %',
        onInput: (v) => {
          state.discharge = v;
          updateReadouts();
          updateBanner();
        },
      });

      ui.gasSlider = X.buildSlider(controls, {
        label: 'Gas Excitation (N₂–He Transfer & Cooling)',
        id: 'c2t4-gas',
        min: 0,
        max: 100,
        step: 1,
        value: state.gasExcitation,
        format: (v) => Math.round(v) + ' %',
        onInput: (v) => {
          state.gasExcitation = v;
          updateReadouts();
          updateBanner();
        },
      });

      const vibWrap = X.el('div', 'slider-block');
      vibWrap.append(X.el('label', 'control-label', 'Molecular Vibration Explorer'));
      controls.append(vibWrap);
      ui.vibSeg = X.buildSegmented(vibWrap, {
        options: [
          { value: 'symmetric', label: 'Symmetric' },
          { value: 'bending', label: 'Bending' },
          { value: 'asymmetric', label: 'Asymmetric' },
        ],
        value: state.vibMode,
        onChange: (m) => {
          state.vibMode = m;
          updateReadouts();
        },
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
        { id: 'stage', label: 'Active Process Stage', wide: true },
        { id: 'output', label: 'Primary Laser Output', primary: true },
        { id: 'alt', label: 'Alternate Transition' },
        { id: 'inv', label: 'Inversion & He Cooling', wide: true },
      ]);

      controls.append(X.el('div', 'ctrl-note',
        '<b>Energy Transfer:</b> Discharge e⁻ excite N₂*, which resonantly excites CO₂ to E₅. Lasing occurs primarily at <b>E₅ → E₄ (10.6 μm IR)</b>, alongside alternate <b>E₅ → E₃</b>. He depopulates lower levels and cools the gas.'
      ));
    }

    function updateReadouts() {
      if (!ui.readouts) return;
      const st = STAGES[state.stageIdx];
      const maxSt = maxAchievableStage();
      const lasing = state.stageIdx >= 5 && maxSt >= 5;
      ui.readouts.set('stage', st.title);
      ui.readouts.set('output', lasing ? '10.6 μm (E₅ → E₄) Active' : '10.6 μm (Below Threshold)');
      ui.readouts.set('alt', 'E₅ → E₃ (IR alternate)');
      ui.readouts.set('inv', maxSt >= 5
        ? 'N(E₅) > N(E₄) · He cooling active ✓'
        : 'Weak excitation / low N₂–He assist');

      formula.innerHTML = `
        <span class="formula">e⁻ + N₂ → N₂* + e⁻</span>
        <span class="formula">N₂* + CO₂(E₁) → N₂ + CO₂*(E₅)</span>
        <span class="formula ${lasing ? 'active' : ''}">E₅ → E₄: <span class="fv">10.6 μm</span></span>
        <span class="formula">Alternate: <span class="fv">E₅ → E₃</span></span>`;
    }

    function updateBanner() {
      if (!banner) return;
      const st = STAGES[state.stageIdx];
      const maxSt = maxAchievableStage();
      const isOk = state.stageIdx >= 4 && maxSt >= 5;
      const isWarn = state.discharge < 28 || state.gasExcitation < 25;
      banner.set(
        `STAGE ${state.stageIdx + 1}/7`,
        isWarn ? 'warn' : (isOk ? 'ok' : ''),
        `<b>${st.title.replace(/^\d+\.\s*/, '')}:</b> ${st.desc}`
      );
    }

    function updatePhysics(rawDt) {
      const dt = rawDt * state.speed;
      state.time += dt;
      if (!state.playing) return;

      // Auto-advance stages up to achievable threshold
      const maxSt = maxAchievableStage();
      if (state.discharge < 8) {
        state.stageIdx = 0;
      } else {
        state.stageTimer += dt;
        if (state.stageTimer > 1.35) {
          state.stageTimer = 0;
          if (state.stageIdx < maxSt) {
            state.stageIdx++;
          } else if (state.stageIdx > maxSt) {
            state.stageIdx = maxSt;
          }
          updateReadouts();
          updateBanner();
        }
      }

      const elecSpeed = 0.35 + (state.discharge / 100) * 1.15;
      state.electrons.forEach((e) => {
        e.x += e.vx * elecSpeed * dt;
        if (e.x > 1.02) {
          e.x = -0.02;
          e.y = 0.16 + Math.random() * 0.68;
        }
      });

      const exFactor = (state.discharge / 100) * (state.gasExcitation / 100);
      state.molecules.forEach((m) => {
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        if (m.x < 0.08 || m.x > 0.92) m.vx *= -1;
        if (m.y < 0.12 || m.y > 0.88) m.vy *= -1;
        m.x = X.clamp(m.x, 0.08, 0.92);
        m.y = X.clamp(m.y, 0.12, 0.88);
        if (m.type === 'N2') m.excited = state.stageIdx >= 1 && exFactor > 0.18;
        if (m.type === 'CO2') m.excited = state.stageIdx >= 3 && exFactor > 0.25;
      });

      const lasing = state.stageIdx >= 5 && maxSt >= 5;
      if (lasing && state.beamPhotons.length < 18 && Math.random() < dt * 10) {
        state.beamPhotons.push({
          x: 0.12 + Math.random() * 0.76,
          y: 0.42 + Math.random() * 0.16,
          vx: Math.random() < 0.5 ? 1.1 : -1.1,
        });
      }
      const nextBP = [];
      state.beamPhotons.forEach((p) => {
        p.x += p.vx * dt;
        if (p.x <= 0.03) { p.x = 0.03; p.vx = Math.abs(p.vx); }
        if (p.x >= 0.97) {
          if (Math.random() < 0.72) {
            p.x = 0.97; p.vx = -Math.abs(p.vx);
            nextBP.push(p);
          } else {
            state.outPhotons.push({ x: 0, y: p.y });
          }
          return;
        }
        if (lasing) nextBP.push(p);
      });
      state.beamPhotons = nextBP;

      state.outPhotons.forEach((op) => { op.x += dt * 1.4; });
      state.outPhotons = state.outPhotons.filter((op) => op.x <= 1.04);
    }

    function drawCO2Molecule(ctx, cx, cy, scale, excited) {
      const rO = 4.2 * scale, rC = 5.2 * scale, d = 10 * scale;
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx - d, cy); ctx.lineTo(cx + d, cy);
      ctx.stroke();

      ctx.fillStyle = excited ? '#ff6b81' : '#ef4444';
      ctx.beginPath(); ctx.arc(cx - d, cy, rO, 0, 6.28); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + d, cy, rO, 0, 6.28); ctx.fill();

      ctx.fillStyle = excited ? '#fbbf24' : '#94a3b8';
      ctx.beginPath(); ctx.arc(cx, cy, rC, 0, 6.28); ctx.fill();
    }

    function render() {
      if (!canvasObj) return;
      const { ctx, w, h } = canvasObj;
      ctx.clearRect(0, 0, w, h);

      const narrow = w < 640;
      const pad = narrow ? 14 : 20;
      const maxSt = maxAchievableStage();
      const lasing = state.stageIdx >= 5 && maxSt >= 5;

      // Layout Regions:
      // Left column (~56% width): Top = Discharge Tube + Resonator, Bottom = Molecular Vibration Explorer + 7-Stage Bar
      // Right column (~44% width): 4-Level Energy Diagram (N2 + CO2 E1..E5)
      const leftW = narrow ? w - pad * 2 : (w - pad * 2 - 16) * 0.56;
      const rightX = narrow ? pad : pad + leftW + 16;
      const rightW = narrow ? w - pad * 2 : w - rightX - pad;

      const tubeY = 40;
      const tubeH = narrow ? 142 : h * 0.44;
      const cavW = leftW - 64;
      const cavX = pad + 12;

      // Section Titles
      ctx.textAlign = 'left';
      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillText('DISCHARGE TUBE (CO₂ : N₂ : He) & OPTICAL RESONATOR', pad, 23);
      if (!narrow) {
        ctx.fillText('VIBRATIONAL ENERGY-LEVEL DIAGRAM', rightX, 23);
      }

      // Plasma glow inside tube
      const plasmaAlpha = (state.discharge / 100) * 0.24;
      ctx.fillStyle = `rgba(129,140,248,${plasmaAlpha + 0.05})`;
      ctx.fillRect(cavX, tubeY, cavW, tubeH);
      ctx.strokeStyle = 'rgba(255,255,255,0.20)';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(cavX, tubeY, cavW, tubeH);

      // Electrodes (Cathode - on left-top, Anode + on right-top)
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(cavX + 26, tubeY - 5, 16, 10);
      ctx.fillStyle = '#ff6b81';
      ctx.fillRect(cavX + cavW - 42, tubeY - 5, 16, 10);
      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#38bdf8'; ctx.fillText('− HV', cavX + 34, tubeY - 9);
      ctx.fillStyle = '#ff6b81'; ctx.fillText('+ HV', cavX + cavW - 34, tubeY - 9);

      // Left Mirror M1 (100% reflecting) & Right Mirror M2 (Partially transmitting)
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(cavX - 6, tubeY - 3, 6, tubeH + 6);
      ctx.fillStyle = 'rgba(34,211,238,0.55)';
      ctx.fillRect(cavX + cavW, tubeY - 3, 6, tubeH + 6);

      // Gas molecules
      state.molecules.forEach((m) => {
        const mx = cavX + m.x * cavW;
        const my = tubeY + m.y * tubeH;
        if (m.type === 'CO2') {
          drawCO2Molecule(ctx, mx, my, 0.85, m.excited);
        } else if (m.type === 'N2') {
          ctx.strokeStyle = m.excited ? '#c084fc' : 'rgba(148,163,184,0.65)';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(mx - 4, my); ctx.lineTo(mx + 4, my); ctx.stroke();
          ctx.fillStyle = m.excited ? '#c084fc' : '#60a5fa';
          ctx.beginPath(); ctx.arc(mx - 4, my, 3.2, 0, 6.28); ctx.arc(mx + 4, my, 3.2, 0, 6.28); ctx.fill();
        } else {
          // He atom (small fast green sphere)
          ctx.fillStyle = state.gasExcitation > 25 ? '#34d399' : 'rgba(52,211,153,0.45)';
          ctx.beginPath(); ctx.arc(mx, my, 2.5, 0, 6.28); ctx.fill();
        }
      });

      // Discharge electrons
      if (state.discharge > 8) {
        state.electrons.forEach((e) => {
          const ex = cavX + e.x * cavW;
          const ey = tubeY + e.y * tubeH;
          ctx.fillStyle = '#fde047';
          ctx.beginPath(); ctx.arc(ex, ey, 2.0, 0, 6.28); ctx.fill();
        });
      }

      // Cavity IR laser beam & emerging 10.6 um output
      const beamY = tubeY + tubeH * 0.5;
      if (lasing) {
        ctx.strokeStyle = 'rgba(255,68,95,0.45)';
        ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(cavX, beamY); ctx.lineTo(cavX + cavW, beamY); ctx.stroke();

        ctx.strokeStyle = '#ff5c7a';
        ctx.lineWidth = 2.6;
        ctx.beginPath(); ctx.moveTo(cavX + cavW + 6, beamY); ctx.lineTo(cavX + cavW + 52, beamY); ctx.stroke();
      }
      state.beamPhotons.forEach((p) => {
        ctx.fillStyle = '#ff6b81';
        ctx.beginPath(); ctx.arc(cavX + p.x * cavW, tubeY + p.y * tubeH, 2.4, 0, 6.28); ctx.fill();
      });
      state.outPhotons.forEach((op) => {
        ctx.fillStyle = '#ff8fa3';
        ctx.beginPath(); ctx.arc(cavX + cavW + 6 + op.x * 46, tubeY + op.y * tubeH, 2.4, 0, 6.28); ctx.fill();
      });

      ctx.textAlign = 'center';
      ctx.font = 'bold 9.5px JetBrains Mono, monospace';
      ctx.fillStyle = lasing ? '#ff8fa3' : '#5e6a84';
      ctx.fillText(lasing ? '10.6 μm' : 'Output', cavX + cavW + 30, beamY - 12);

      // Legend under discharge tube
      const legY = tubeY + tubeH + 16;
      ctx.textAlign = 'left';
      ctx.font = '9px Inter, sans-serif';
      ctx.fillStyle = '#ef4444'; ctx.fillText('● CO₂ (O=C=O)', cavX, legY);
      ctx.fillStyle = '#c084fc'; ctx.fillText('● N₂ / N₂*', cavX + 86, legY);
      ctx.fillStyle = '#34d399'; ctx.fillText('● He (cooling)', cavX + 150, legY);
      ctx.fillStyle = '#fde047'; ctx.fillText('● e⁻', cavX + 234, legY);

      // ================= BOTTOM-LEFT: VIBRATION EXPLORER + STAGE TRACKER =================
      const vibY = legY + 12;
      const vibH = narrow ? 120 : h - vibY - 14;
      if (!narrow || vibH > 60) {
        ctx.fillStyle = 'rgba(6,10,24,0.72)';
        ctx.fillRect(pad, vibY, leftW, vibH);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.strokeRect(pad, vibY, leftW, vibH);

        ctx.fillStyle = '#edf1f8';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.textAlign = 'left';
        const modeTitleMap = {
          symmetric: 'SYMMETRIC STRETCHING (ν₁ · E₄)',
          bending: 'BENDING MODE (ν₂ · E₂)',
          asymmetric: 'ASYMMETRIC STRETCHING (ν₃ · E₅)',
        };
        ctx.fillText('CO₂ VIBRATION EXPLORER — ' + modeTitleMap[state.vibMode], pad + 10, vibY + 17);

        // Animate O=C=O atoms
        const osc = C.prefersReducedMotion() ? 0 : Math.sin(state.time * 7);
        const mCx = pad + leftW * 0.5;
        const mCy = vibY + vibH * 0.46;
        let cX = mCx, cY = mCy;
        let o1X = mCx - 58, o1Y = mCy;
        let o2X = mCx + 58, o2Y = mCy;

        if (state.vibMode === 'symmetric') {
          o1X -= osc * 16;
          o2X += osc * 16;
        } else if (state.vibMode === 'bending') {
          cY -= osc * 14;
          o1Y += osc * 11;
          o2Y += osc * 11;
        } else {
          cX += osc * 14;
          o1X -= osc * 10;
          o2X -= osc * 10;
        }

        // Bonds (spring-like lines)
        ctx.strokeStyle = 'rgba(237,241,248,0.55)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(o1X, o1Y); ctx.lineTo(cX, cY); ctx.lineTo(o2X, o2Y); ctx.stroke();

        // O atoms
        const drawAtom = (ax, ay, rad, col, sym) => {
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(ax, ay, rad, 0, 6.28); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = '#080b14'; ctx.font = 'bold 9.5px Inter, sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(sym, ax, ay + 3.5);
        };
        drawAtom(o1X, o1Y, 12, '#f87171', 'O');
        drawAtom(o2X, o2Y, 12, '#f87171', 'O');
        drawAtom(cX, cY, 14, '#38bdf8', 'C');

        // Vibration direction arrows/caption
        ctx.fillStyle = '#8f9cb5';
        ctx.font = '9.5px Inter, sans-serif';
        ctx.textAlign = 'center';
        const cap = state.vibMode === 'symmetric'
          ? 'Both oxygen atoms oscillate inward & outward symmetrically around stationary C'
          : state.vibMode === 'bending'
            ? 'Carbon and oxygen atoms oscillate perpendicular to the molecular axis'
            : 'Carbon moves opposite to both oxygen atoms along the axis (upper laser state E₅)';
        ctx.fillText(cap, mCx, vibY + vibH - 36);

        // 7-Stage Progress Pills at bottom of Vibration Explorer
        const pillW = (leftW - 20 - 6 * 4) / 7;
        for (let i = 0; i < 7; i++) {
          const px = pad + 10 + i * (pillW + 4);
          const py = vibY + vibH - 22;
          const active = i === state.stageIdx;
          const done = i < state.stageIdx;
          ctx.fillStyle = active ? 'rgba(34,211,238,0.22)' : (done ? 'rgba(52,211,153,0.14)' : 'rgba(255,255,255,0.04)');
          ctx.fillRect(px, py, pillW, 14);
          ctx.strokeStyle = active ? '#22d3ee' : (done ? 'rgba(52,211,153,0.45)' : 'rgba(255,255,255,0.12)');
          ctx.lineWidth = 1;
          ctx.strokeRect(px, py, pillW, 14);
          ctx.fillStyle = active ? '#22d3ee' : (done ? '#34d399' : '#8f9cb5');
          ctx.font = 'bold 8.5px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.fillText('S' + (i + 1), px + pillW / 2, py + 10);
        }
      }

      // ================= RIGHT PANEL: 4-LEVEL MOLECULAR ENERGY DIAGRAM =================
      const diagY = narrow ? vibY + vibH + 14 : 40;
      const diagH = narrow ? h - diagY - 10 : h - 54;
      if (diagH < 120) return;

      ctx.fillStyle = 'rgba(6,10,24,0.72)';
      ctx.fillRect(rightX, diagY, rightW, diagH);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 1;
      ctx.strokeRect(rightX, diagY, rightW, diagH);

      // Columns inside energy diagram: Left = N2, Right = CO2
      const n2X1 = rightX + 18, n2X2 = rightX + rightW * 0.34;
      const coX1 = rightX + rightW * 0.45, coX2 = rightX + rightW - 18;

      const yE1 = diagY + diagH - 24;
      const yE5 = diagY + 42;
      const span = yE1 - yE5;
      const yE2 = yE1 - span * 0.25;
      const yE3 = yE1 - span * 0.48;
      const yE4 = yE1 - span * 0.58;
      const yN2ex = yE5 + 4; // resonant with E5

      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#c084fc'; ctx.fillText('N₂', (n2X1 + n2X2) / 2, diagY + 20);
      ctx.fillStyle = '#38bdf8'; ctx.fillText('CO₂ LEVELS', (coX1 + coX2) / 2, diagY + 20);

      // N2 ground & metastable excited state
      ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(n2X1, yE1); ctx.lineTo(n2X2, yE1); ctx.stroke();
      ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 2.8;
      ctx.beginPath(); ctx.moveTo(n2X1, yN2ex); ctx.lineTo(n2X2, yN2ex); ctx.stroke();
      ctx.fillStyle = '#c084fc'; ctx.font = '9px JetBrains Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText('v=1*', n2X1, yN2ex - 6);
      ctx.fillStyle = '#60a5fa';
      ctx.fillText('v=0', n2X1, yE1 + 12);

      // Excitation arrow inside N2 (e- impact)
      const nMid = (n2X1 + n2X2) / 2;
      ctx.strokeStyle = state.stageIdx >= 1 ? '#fde047' : 'rgba(253,224,71,0.3)';
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(nMid, yE1 - 4); ctx.lineTo(nMid, yN2ex + 6); ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath(); ctx.moveTo(nMid, yN2ex + 3); ctx.lineTo(nMid - 4, yN2ex + 10); ctx.lineTo(nMid + 4, yN2ex + 10); ctx.closePath(); ctx.fill();
      if (!narrow) {
        ctx.font = '8.5px Inter, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('e⁻ impact', nMid, (yE1 + yN2ex) / 2);
      }

      // CO2 levels E1..E5
      const levels = [
        { y: yE5, label: 'E₅ (001)', col: '#34d399', lw: 3 },
        { y: yE4, label: 'E₄ (100)', col: '#ff8c42', lw: 2.2 },
        { y: yE3, label: 'E₃ (020)', col: '#e0b553', lw: 2.0 },
        { y: yE2, label: 'E₂ (010)', col: '#38bdf8', lw: 2.0 },
        { y: yE1, label: 'E₁ (000)', col: '#60a5fa', lw: 2.4 },
      ];
      levels.forEach((lv) => {
        ctx.strokeStyle = lv.col;
        ctx.lineWidth = lv.lw;
        ctx.beginPath(); ctx.moveTo(coX1, lv.y); ctx.lineTo(coX2, lv.y); ctx.stroke();
        ctx.fillStyle = lv.col;
        ctx.font = 'bold 9px JetBrains Mono, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(lv.label, coX2, lv.y - 4);
      });

      // Resonant Collisional Energy Transfer arrow: N2*(v=1) -> CO2(E5)
      ctx.strokeStyle = state.stageIdx >= 2 ? '#c084fc' : 'rgba(192,132,252,0.3)';
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(n2X2 + 3, yN2ex); ctx.lineTo(coX1 - 4, yE5); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath(); ctx.moveTo(coX1 - 2, yE5); ctx.lineTo(coX1 - 9, yE5 - 4); ctx.lineTo(coX1 - 9, yE5 + 4); ctx.closePath(); ctx.fill();

      // Primary Laser Transition E5 -> E4 (10.6 um)
      const tx1 = coX1 + (coX2 - coX1) * 0.24;
      ctx.strokeStyle = lasing ? '#ff4d6d' : 'rgba(255,77,109,0.5)';
      ctx.lineWidth = lasing ? 3 : 2;
      ctx.beginPath(); ctx.moveTo(tx1, yE5 + 3); ctx.lineTo(tx1, yE4 - 5); ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath(); ctx.moveTo(tx1, yE4 - 2); ctx.lineTo(tx1 - 4.5, yE4 - 10); ctx.lineTo(tx1 + 4.5, yE4 - 10); ctx.closePath(); ctx.fill();
      ctx.font = 'bold 9.5px JetBrains Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillStyle = '#ff6b81';
      ctx.fillText('10.6 μm', tx1 + 6, (yE5 + yE4) / 2 + 3);

      // Alternate Laser Transition E5 -> E3 (explicitly NO unsupported wavelength!)
      const tx2 = coX1 + (coX2 - coX1) * 0.56;
      ctx.strokeStyle = 'rgba(224,181,83,0.85)';
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(tx2, yE5 + 3); ctx.lineTo(tx2, yE3 - 5); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#e0b553';
      ctx.beginPath(); ctx.moveTo(tx2, yE3 - 2); ctx.lineTo(tx2 - 4, yE3 - 9); ctx.lineTo(tx2 + 4, yE3 - 9); ctx.closePath(); ctx.fill();
      ctx.font = '8.5px Inter, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('E₅→E₃', tx2 + 5, (yE5 + yE3) / 2 + 12);

      // Fast He-assisted relaxation: E4,E3 -> E2 -> E1
      const rxLine = coX1 + (coX2 - coX1) * 0.36;
      ctx.strokeStyle = state.gasExcitation > 25 ? '#34d399' : 'rgba(52,211,153,0.3)';
      ctx.setLineDash([2, 3]);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(rxLine, yE4 + 3); ctx.lineTo(rxLine, yE2 - 4);
      ctx.moveTo(rxLine, yE2 + 3); ctx.lineTo(rxLine, yE1 - 4);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#34d399';
      ctx.font = '8.5px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('He thermal decay', rxLine + 6, (yE2 + yE1) / 2 + 3);
    }

    return {
      mount() {
        buildDOM();
        if (state.molecules.length === 0) seedParticles();
        canvasObj = X.setupCanvas(document.getElementById('cv-c2t4'));
        updateReadouts();
        updateBanner();
        render();
      },
      unmount() {},
      tick(dt) {
        updatePhysics(dt);
        render();
      },
      resize() {
        const cv = document.getElementById('cv-c2t4');
        if (cv) canvasObj = X.setupCanvas(cv);
        render();
      },
      applyPreset(preset) {
        if (preset === 'mode-sym') state.vibMode = 'symmetric';
        else if (preset === 'mode-bend') state.vibMode = 'bending';
        else if (preset === 'mode-asym') state.vibMode = 'asymmetric';
        else {
          state.discharge = 88;
          state.gasExcitation = 90;
          state.stageIdx = 6;
          if (ui.disSlider) ui.disSlider.setValue(88);
          if (ui.gasSlider) ui.gasSlider.setValue(90);
        }
        if (ui.vibSeg) ui.vibSeg.set(state.vibMode);
        updateReadouts();
        updateBanner();
      },
      getState: () => state,
    };
  };
})();
