(function () {
  'use strict';

  const C = window.Ch2Platform;
  const X = window.XLab;

  window.CH2_SIMS['c2t3'] = function createHeteroLaserLab(ctxDom) {
    const { stage, controls, formula, wrap, dot } = ctxDom;

    // Representative GaAs / AlGaAs double-heterojunction parameters
    // Note: GaAs Eg = 1.43 eV (consistent with Chapter 1 MATERIALS.GaAs)
    const EG_GAAS = 1.43;      // eV
    const EG_GAALAS = 1.92;    // eV (representative Al_xGa_{1-x}As cladding)
    const N_GAAS = 3.59;       // refractive index of GaAs active core
    const N_GAALAS = 3.35;     // lower refractive index of GaAlAs cladding
    const LAMBDA_GAAS = Math.round(C.evToNm(EG_GAAS)); // ~867 nm (Near-IR)

    const state = {
      subview: 'hetero',       // 'hetero' | 'compare'
      playing: true,
      V: 1.65,                 // Forward bias voltage (0..2.0 V)
      showBands: true,
      showOpticalRays: true,
      electrons: [],           // { x, y, vx, vy, trapped }
      holes: [],               // { x, y, vx, vy, trapped }
      photons: [],             // { x, y, vx, vy, stimulated }
      recombFlashes: [],       // { x, y, t }
      outBeams: [],            // { x, y }
      time: 0,
    };

    let built = false;
    let canvasObj = null;
    let ui = {};
    let banner = null;
    let subtabBar = null;

    function getRegime() {
      const V = state.V;
      // Conceptual forward threshold model:
      // < 1.05 V: depletion barrier blocks majority carrier injection
      // 1.05..1.43 V: carrier injection & spontaneous recombination (LED regime)
      // >= 1.43 V (Eg/e): population inversion inside GaAs well -> LASER emission
      const isInjecting = V >= 1.05;
      const isLasing = V >= 1.43;
      const driveCurrentMa = V < 0.9 ? 0.01 * V : (V < 1.43 ? (V - 0.9) * 18 : 9.5 + (V - 1.43) * 95);
      return { isInjecting, isLasing, driveCurrentMa };
    }

    function resetSimulation(keepSliders) {
      if (!keepSliders) {
        state.V = 1.65;
        state.showBands = true;
        state.showOpticalRays = true;
        if (ui.vSlider) ui.vSlider.setValue(state.V);
        if (ui.optToggle) ui.optToggle.checked = true;
      }
      state.electrons = [];
      state.holes = [];
      state.photons = [];
      state.recombFlashes = [];
      state.outBeams = [];
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
      canvas.id = 'cv-c2t3';
      canvas.setAttribute('aria-label', 'Semiconductor Heterojunction Laser Cross-Section and Energy Band Diagram');
      stage.append(canvas);
      canvasObj = X.setupCanvas(canvas);

      subtabBar = C.buildSubtabs(
        wrap,
        [
          { id: 'hetero', label: 'A. Double Heterojunction Lab' },
          { id: 'compare', label: 'B. Homojunction vs. Heterojunction' },
        ],
        state.subview,
        (id) => {
          state.subview = id;
          updateBanner();
          updateReadouts();
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

      ui.vSlider = X.buildSlider(controls, {
        label: 'Forward Bias Voltage (V)',
        id: 'c2t3-v',
        min: 0.0,
        max: 2.0,
        step: 0.02,
        value: state.V,
        format: (v) => v.toFixed(2) + ' V',
        onInput: (v) => {
          state.V = v;
          updateReadouts();
          updateBanner();
        },
      });

      C.buildActionRow(controls, [
        { id: 'v0', label: '0 V (Off)', onClick: () => { state.V = 0; ui.vSlider.setValue(0); updateReadouts(); updateBanner(); } },
        { id: 'vled', label: '1.25 V (LED)', onClick: () => { state.V = 1.25; ui.vSlider.setValue(1.25); updateReadouts(); updateBanner(); } },
        { id: 'vlas', label: '1.70 V (LASER)', primary: true, onClick: () => { state.V = 1.70; ui.vSlider.setValue(1.70); updateReadouts(); updateBanner(); } },
      ]);

      ui.optToggle = X.buildToggle(controls, {
        label: 'Highlight optical confinement rays',
        checked: state.showOpticalRays,
        onChange: (on) => { state.showOpticalRays = on; },
      });

      ui.readouts = X.buildReadouts(controls, [
        { id: 'bias', label: 'Forward Bias V' },
        { id: 'curr', label: 'Injection Current (conc.)' },
        { id: 'regime', label: 'Operating Regime', primary: true, wide: true },
        { id: 'gap', label: 'GaAs Active Eᵍ / λ' },
        { id: 'dn', label: 'Index Step Δn' },
      ]);

      controls.append(X.el('div', 'ctrl-note',
        `<b>Material Parameters:</b> Active GaAs (E<sub>g</sub> = 1.43 eV, n = 3.59) emits near-IR at <b>~${LAMBDA_GAAS} nm</b> (shown in false color for visibility). Cladding GaAlAs values (E<sub>g</sub> ≈ 1.92 eV, n ≈ 3.35) are representative.`
      ));
    }

    function updateReadouts() {
      if (!ui.readouts) return;
      const reg = getRegime();
      ui.readouts.set('bias', state.V.toFixed(2) + ' V');
      ui.readouts.set('curr', reg.driveCurrentMa.toFixed(1) + ' mA');
      ui.readouts.set('regime', reg.isLasing
        ? 'LASING ACTIVE ✓ (Population Inversion)'
        : (reg.isInjecting ? 'Spontaneous Emission (LED Regime)' : 'Potential Barrier — No Injection'));
      ui.readouts.set('gap', `${EG_GAAS.toFixed(2)} eV · ${LAMBDA_GAAS} nm`);
      ui.readouts.set('dn', `${(N_GAAS - N_GAALAS).toFixed(2)} (${N_GAAS} vs ${N_GAALAS})`);

      formula.innerHTML = `
        <span class="formula ${reg.isLasing ? 'active' : ''}">hν = E<sub>g</sub>(GaAs) = <span class="fv">${EG_GAAS} eV</span> → λ ≈ <span class="fv">${LAMBDA_GAAS} nm (Near-IR)</span></span>
        <span class="formula">Carrier Well: <span class="fv">E<sub>g</sub>(GaAlAs) &gt; E<sub>g</sub>(GaAs)</span></span>
        <span class="formula">Waveguide: <span class="fv">n<sub>GaAs</sub> (${N_GAAS}) &gt; n<sub>GaAlAs</sub> (${N_GAALAS})</span></span>`;
    }

    function updateBanner() {
      if (!banner) return;
      if (state.subview === 'compare') {
        banner.set('COMPARISON', '', '<b>Homojunction</b> lets carriers and photons leak into bulk p/n regions. <b>Double Heterojunction</b> traps both in a thin GaAs active well.');
        return;
      }
      const reg = getRegime();
      if (!reg.isInjecting) {
        banner.set('ZERO / LOW BIAS', 'warn', `Forward bias <b>${state.V.toFixed(2)} V</b> is below barrier threshold. Raise voltage toward <b>1.43 V</b> to flatten junction barrier and inject carriers.`);
      } else if (!reg.isLasing) {
        banner.set('LED REGIME', '', 'Electrons &amp; holes inject into GaAs and confine between GaAlAs barriers, producing <b>spontaneous photons</b>. Increase bias ≥ <b>1.43 V</b> for lasing.');
      } else {
        banner.set('LASER EMISSION', 'ok', '<b>Population inversion in GaAs!</b> Cleaved parallel facets reflect confined photons for stimulated emission → coherent IR output beam.');
      }
    }

    function updatePhysics(dt) {
      if (!state.playing) return;
      state.time += dt;
      const reg = getRegime();

      // Inject holes from top P-GaAlAs downward and electrons from bottom N-GaAlAs upward
      if (reg.isInjecting) {
        const rate = reg.isLasing ? 24 : 9;
        if (state.electrons.length < 36 && Math.random() < rate * dt) {
          state.electrons.push({
            x: 0.12 + Math.random() * 0.76,
            y: 0.94,
            vx: (Math.random() - 0.5) * 0.08,
            vy: -0.65 - Math.random() * 0.2,
            trapped: false,
          });
        }
        if (state.holes.length < 36 && Math.random() < rate * dt) {
          state.holes.push({
            x: 0.12 + Math.random() * 0.76,
            y: 0.06,
            vx: (Math.random() - 0.5) * 0.08,
            vy: 0.65 + Math.random() * 0.2,
            trapped: false,
          });
        }
      }

      // Active region vertical band is normalized y in [0.40, 0.60]
      state.electrons.forEach((e) => {
        e.x = X.clamp(e.x + e.vx * dt, 0.06, 0.94);
        e.y += e.vy * dt;
        if (!e.trapped && e.y <= 0.58) {
          e.trapped = true;
          e.vy = (Math.random() - 0.5) * 0.14;
          e.vx = (Math.random() - 0.5) * 0.28;
        }
        if (e.trapped) {
          // Confined inside GaAs active well [0.42, 0.58] by heterojunction barrier!
          if (e.y < 0.42) { e.y = 0.42; e.vy = Math.abs(e.vy); }
          if (e.y > 0.58) { e.y = 0.58; e.vy = -Math.abs(e.vy); }
        }
      });

      state.holes.forEach((h) => {
        h.x = X.clamp(h.x + h.vx * dt, 0.06, 0.94);
        h.y += h.vy * dt;
        if (!h.trapped && h.y >= 0.42) {
          h.trapped = true;
          h.vy = (Math.random() - 0.5) * 0.14;
          h.vx = (Math.random() - 0.5) * 0.28;
        }
        if (h.trapped) {
          if (h.y < 0.42) { h.y = 0.42; h.vy = Math.abs(h.vy); }
          if (h.y > 0.58) { h.y = 0.58; h.vy = -Math.abs(h.vy); }
        }
      });

      // Recombination inside GaAs active region
      const nextE = [];
      for (let i = 0; i < state.electrons.length; i++) {
        const e = state.electrons[i];
        let combined = false;
        if (e.trapped) {
          for (let j = 0; j < state.holes.length; j++) {
            const h = state.holes[j];
            if (!h.trapped) continue;
            const dx = e.x - h.x;
            const dy = e.y - h.y;
            if (dx * dx + dy * dy < 0.0055) {
              combined = true;
              state.holes.splice(j, 1);
              state.recombFlashes.push({ x: (e.x + h.x) / 2, y: (e.y + h.y) / 2, t: 0 });
              if (state.photons.length < 44) {
                const stim = reg.isLasing && Math.random() < 0.8;
                const ang = stim ? (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.24 : Math.random() * Math.PI * 2;
                const spd = stim ? 0.95 : 0.65;
                state.photons.push({
                  x: (e.x + h.x) / 2,
                  y: (e.y + h.y) / 2,
                  vx: Math.cos(ang) * spd,
                  vy: Math.sin(ang) * spd,
                  stimulated: stim,
                });
              }
              break;
            }
          }
        }
        if (!combined && e.y > 0.02 && e.y < 0.98) nextE.push(e);
      }
      state.electrons = nextE;
      state.holes = state.holes.filter((h) => h.y > 0.02 && h.y < 0.98);

      state.recombFlashes.forEach((f) => { f.t += dt; });
      state.recombFlashes = state.recombFlashes.filter((f) => f.t < 0.35);

      // Photons guided inside GaAs optical waveguide & bouncing off cleaved end facets
      const nextP = [];
      for (let i = 0; i < state.photons.length; i++) {
        const p = state.photons[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (p.stimulated) {
          // Total Internal Reflection at GaAs / GaAlAs boundary (n1 > n2)
          if (p.y < 0.41) { p.y = 0.41; p.vy = Math.abs(p.vy); }
          if (p.y > 0.59) { p.y = 0.59; p.vy = -Math.abs(p.vy); }
          // Polished cleaved end faces act as resonator mirrors
          if (p.x <= 0.02 && p.vx < 0) {
            p.x = 0.02;
            p.vx = Math.abs(p.vx);
          } else if (p.x >= 0.98 && p.vx > 0) {
            if (Math.random() < 0.68) {
              p.x = 0.98;
              p.vx = -Math.abs(p.vx);
            } else {
              state.outBeams.push({ x: 0, y: p.y });
              continue;
            }
          }
          nextP.push(p);
        } else {
          if (p.x > 0 && p.x < 1 && p.y > 0.05 && p.y < 0.95) {
            nextP.push(p);
          }
        }
      }
      state.photons = nextP;

      state.outBeams.forEach((b) => { b.x += dt * 1.45; });
      state.outBeams = state.outBeams.filter((b) => b.x < 1.05);
    }

    function renderHeteroView(ctx, w, h) {
      const narrow = w < 640;
      const reg = getRegime();

      // Layout: Side-by-side on wide, stacked on narrow
      const sx = narrow ? 16 : 22;
      const sy = 44;
      const sw = narrow ? w - 82 : w * 0.46;
      const sh = narrow ? h * 0.44 : h - 84;

      const bx = narrow ? 26 : sx + sw + 58;
      const bw = narrow ? w - 44 : w - bx - 22;
      const by = narrow ? sy + sh + 46 : 44;
      const bh = narrow ? h - by - 20 : h - 84;

      // Title
      ctx.textAlign = 'left';
      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillText('DOUBLE HETEROJUNCTION CROSS-SECTION', sx, 24);
      if (!narrow) {
        ctx.fillText('ENERGY BAND DIAGRAM (E_C, E_V, E_F)', bx, 24);
      }

      // Layer proportions inside device box (sx, sy, sw, sh)
      const pContactH = sh * 0.07;
      const pCladH = sh * 0.33;
      const actH = sh * 0.20;
      const nCladH = sh * 0.33;
      const nContactH = sh * 0.07;

      const yPcon = sy;
      const yPclad = yPcon + pContactH;
      const yAct = yPclad + pCladH;
      const yNclad = yAct + actH;
      const yNcon = yNclad + nCladH;

      // Top & Bottom Metal Ohmic Contacts
      ctx.fillStyle = 'rgba(148,163,184,0.35)';
      ctx.fillRect(sx, yPcon, sw, pContactH);
      ctx.fillRect(sx, yNcon, sw, nContactH);

      // P-GaAlAs Cladding
      ctx.fillStyle = 'rgba(99,102,241,0.18)';
      ctx.fillRect(sx, yPclad, sw, pCladH);
      // GaAs Active Layer
      ctx.fillStyle = reg.isLasing ? 'rgba(255,68,95,0.22)' : 'rgba(34,211,238,0.16)';
      ctx.fillRect(sx, yAct, sw, actH);
      // N-GaAlAs Cladding
      ctx.fillStyle = 'rgba(245,158,11,0.16)';
      ctx.fillRect(sx, yNclad, sw, nCladH);

      // Outer border + Polished Parallel Cleaved End Faces (Left & Right Mirrors)
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, yPclad, sw, pCladH + actH + nCladH);

      // Polished parallel resonator facets highlighted in cyan
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx, yPclad); ctx.lineTo(sx, yNcon);
      ctx.moveTo(sx + sw, yPclad); ctx.lineTo(sx + sw, yNcon);
      ctx.stroke();

      // Heterojunction boundaries
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(sx, yAct); ctx.lineTo(sx + sw, yAct);
      ctx.moveTo(sx, yNclad); ctx.lineTo(sx + sw, yNclad);
      ctx.stroke();
      ctx.setLineDash([]);

      // Optical confinement waveguide illustration inside GaAs when toggled
      if (state.showOpticalRays && reg.isInjecting) {
        ctx.strokeStyle = reg.isLasing ? 'rgba(255,100,130,0.62)' : 'rgba(34,211,238,0.32)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        const zigN = 6;
        for (let i = 0; i <= zigN; i++) {
          const zx = sx + (i / zigN) * sw;
          const zy = i % 2 === 0 ? yAct + 3 : yNclad - 3;
          if (i === 0) ctx.moveTo(zx, zy); else ctx.lineTo(zx, zy);
        }
        ctx.stroke();
      }

      // Layer labels
      ctx.textAlign = 'left';
      ctx.font = 'bold 9.5px Inter, sans-serif';
      ctx.fillStyle = '#a5b4fc';
      ctx.fillText(`P-GaAlAs (Eᵍ≈1.92 eV, n=${N_GAALAS})`, sx + 8, yPclad + pCladH * 0.45);
      ctx.fillStyle = '#34d399';
      ctx.fillText(`GaAs Active (Eᵍ=1.43 eV, n=${N_GAAS})`, sx + 8, yAct + actH * 0.56);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(`N-GaAlAs (Eᵍ≈1.92 eV, n=${N_GAALAS})`, sx + 8, yNclad + nCladH * 0.55);

      // Forward-bias battery wiring (Left side loop)
      if (!narrow) {
        const wx = sx - 12;
        ctx.strokeStyle = 'rgba(237,241,248,0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx, yPcon + pContactH / 2);
        ctx.lineTo(wx, yPcon + pContactH / 2);
        ctx.lineTo(wx, yNcon + nContactH / 2);
        ctx.lineTo(sx, yNcon + nContactH / 2);
        ctx.stroke();
        // + and - markers
        ctx.fillStyle = '#ff6b81';
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.textAlign = 'right';
        ctx.fillText('+', sx - 3, yPcon + 10);
        ctx.fillStyle = '#22d3ee';
        ctx.fillText('−', sx - 3, yNcon + 10);
      }

      // Carriers & Photons inside device
      const mapDY = (ny) => yPclad + ny * (pCladH + actH + nCladH);
      const mapDX = (nx) => sx + nx * sw;

      state.holes.forEach((hObj) => {
        ctx.strokeStyle = '#ff6b81';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(mapDX(hObj.x), mapDY(hObj.y), 3.4, 0, Math.PI * 2);
        ctx.stroke();
      });

      state.electrons.forEach((eObj) => {
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(mapDX(eObj.x), mapDY(eObj.y), 3.0, 0, Math.PI * 2);
        ctx.fill();
      });

      state.recombFlashes.forEach((f) => {
        const a = 1 - f.t / 0.35;
        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(mapDX(f.x), mapDY(f.y), 4 + f.t * 24, 0, Math.PI * 2);
        ctx.stroke();
      });

      state.photons.forEach((p) => {
        const px = mapDX(p.x), py = mapDY(p.y);
        ctx.fillStyle = p.stimulated ? '#ff4d6d' : '#e0b553';
        ctx.beginPath();
        ctx.arc(px, py, p.stimulated ? 3.2 : 2.2, 0, Math.PI * 2);
        ctx.fill();
      });

      // Output Laser Beam emerging from right cleaved facet
      const beamY = yAct + actH / 2;
      const outStart = sx + sw + 2;
      const outSpan = narrow ? 52 : 42;
      if (reg.isLasing) {
        const bg = ctx.createLinearGradient(0, beamY - 16, 0, beamY + 16);
        bg.addColorStop(0, 'rgba(255,60,95,0)');
        bg.addColorStop(0.5, 'rgba(255,60,95,0.55)');
        bg.addColorStop(1, 'rgba(255,60,95,0)');
        ctx.fillStyle = bg;
        ctx.fillRect(outStart, beamY - 16, outSpan, 32);

        ctx.strokeStyle = '#ff5c7a';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(outStart, beamY);
        ctx.lineTo(outStart + outSpan, beamY);
        ctx.stroke();
      }
      ctx.fillStyle = reg.isLasing ? '#ff8fa3' : '#5e6a84';
      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(reg.isLasing ? 'IR Beam' : 'Facet', outStart + outSpan / 2, beamY - 12);

      // Facet label under cross-section
      ctx.fillStyle = '#22d3ee';
      ctx.font = '9.5px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Polished parallel end faces (Resonator)', sx + sw / 2, sy + sh + 16);

      // ================= RIGHT PANEL: ENERGY BAND DIAGRAM =================
      ctx.fillStyle = 'rgba(6,10,24,0.72)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, bw, bh);

      // Three horizontal zones: P-GaAlAs | GaAs Well | N-GaAlAs
      const z1 = bx + bw * 0.37;
      const z2 = bx + bw * 0.63;
      ctx.fillStyle = 'rgba(34,211,238,0.06)';
      ctx.fillRect(z1, by + 18, z2 - z1, bh - 36);

      ctx.textAlign = 'center';
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.fillStyle = '#a5b4fc';
      ctx.fillText('P-GaAlAs', (bx + z1) / 2, by + 14);
      ctx.fillStyle = '#34d399';
      ctx.fillText('GaAs Well', (z1 + z2) / 2, by + 14);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('N-GaAlAs', (z2 + bx + bw) / 2, by + 14);

      // Barrier tilt reduces as Forward Bias V increases!
      // At V = 0, P-side bands sit ~1.43 eV higher than N-side bands.
      const tiltPx = Math.max(0, 1.55 - state.V) * (bh * 0.22);
      const midY = by + bh * 0.52;
      const wellHalfGap = bh * 0.14;   // GaAs narrower Eg
      const cladHalfGap = bh * 0.22;   // GaAlAs wider Eg

      const pMid = midY - tiltPx * 0.5;
      const nMid = midY + tiltPx * 0.5;
      const wMid = midY;

      // Conduction Band Edge E_C
      ctx.strokeStyle = '#ff8c42';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(bx + 8, pMid - cladHalfGap);
      ctx.lineTo(z1, pMid - cladHalfGap);
      ctx.lineTo(z1, wMid - wellHalfGap);
      ctx.lineTo(z2, wMid - wellHalfGap);
      ctx.lineTo(z2, nMid - cladHalfGap * 0.85);
      ctx.lineTo(bx + bw - 8, nMid - cladHalfGap * 0.85);
      ctx.stroke();

      // Valence Band Edge E_V
      ctx.strokeStyle = '#4da6ff';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(bx + 8, pMid + cladHalfGap * 0.85);
      ctx.lineTo(z1, pMid + cladHalfGap * 0.85);
      ctx.lineTo(z1, wMid + wellHalfGap);
      ctx.lineTo(z2, wMid + wellHalfGap);
      ctx.lineTo(z2, nMid + cladHalfGap);
      ctx.lineTo(bx + bw - 8, nMid + cladHalfGap);
      ctx.stroke();

      // Quasi-Fermi Levels E_Fp (left) & E_Fn (right)
      const eFpY = pMid + cladHalfGap * 0.72;
      const eFnY = nMid - cladHalfGap * 0.72;
      ctx.strokeStyle = '#34d399';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(bx + 8, eFpY); ctx.lineTo(z1 + 8, eFpY);
      ctx.moveTo(z2 - 8, eFnY); ctx.lineTo(bx + bw - 8, eFnY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = 'bold 9.5px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ff8c42';
      ctx.fillText('E_C', bx + 12, pMid - cladHalfGap - 6);
      ctx.fillStyle = '#4da6ff';
      ctx.fillText('E_V', bx + 12, pMid + cladHalfGap * 0.85 + 13);
      ctx.fillStyle = '#34d399';
      ctx.fillText('E_Fp', bx + 12, eFpY - 5);
      ctx.textAlign = 'right';
      ctx.fillText('E_Fn', bx + bw - 12, eFnY + 12);

      // Show confined electrons & holes inside quantum well + transition hν
      if (reg.isInjecting) {
        for (let i = 0; i < 5; i++) {
          const cx = z1 + 10 + (i / 4) * (z2 - z1 - 20);
          ctx.fillStyle = '#22d3ee';
          ctx.beginPath(); ctx.arc(cx, wMid - wellHalfGap + 10, 3, 0, 6.28); ctx.fill();
          ctx.strokeStyle = '#ff6b81'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(cx, wMid + wellHalfGap - 10, 3.2, 0, 6.28); ctx.stroke();
        }
        // Recombination arrow inside well
        const midX = (z1 + z2) / 2;
        ctx.strokeStyle = reg.isLasing ? '#ff4d6d' : '#e0b553';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(midX, wMid - wellHalfGap + 16);
        ctx.lineTo(midX, wMid + wellHalfGap - 16);
        ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.moveTo(midX, wMid + wellHalfGap - 13);
        ctx.lineTo(midX - 4, wMid + wellHalfGap - 21);
        ctx.lineTo(midX + 4, wMid + wellHalfGap - 21);
        ctx.closePath();
        ctx.fill();
        ctx.font = 'bold 9.5px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('hν = 1.43 eV', midX, wMid + 3);
      }

      // ΔE_C & ΔE_V confinement labels
      ctx.fillStyle = '#e0b553';
      ctx.font = '9px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        `Carrier confinement well (ΔE_g ≈ 0.49 eV)  |  V = ${state.V.toFixed(2)} V`,
        bx + bw / 2,
        by + bh - 10
      );
    }

    function renderComparisonView(ctx, w, h) {
      const narrow = w < 620;
      const pad = narrow ? 14 : 24;
      const gap = 16;
      const cw = (w - pad * 2 - gap) / 2;
      const topY = 48;
      const ch = h - topY - 18;

      ctx.textAlign = 'left';
      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 13px Inter, sans-serif';
      ctx.fillText('HOMOJUNCTION vs. DOUBLE HETEROJUNCTION LASER', pad, 26);

      // Left: Homojunction (p-GaAs / n-GaAs)
      const lx = pad;
      const rx = pad + cw + gap;

      const drawCard = (x, title, sub, col) => {
        ctx.fillStyle = 'rgba(8,12,28,0.84)';
        ctx.fillRect(x, topY, cw, ch);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.4;
        ctx.strokeRect(x, topY, cw, ch);
        ctx.fillStyle = col;
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(title, x + 14, topY + 24);
        ctx.fillStyle = '#8f9cb5';
        ctx.font = '10px Inter, sans-serif';
        ctx.fillText(sub, x + 14, topY + 42);
      };

      drawCard(lx, 'HOMOJUNCTION LASER', 'Same semiconductor (p-GaAs / n-GaAs)', 'rgba(224,140,58,0.55)');
      drawCard(rx, 'DOUBLE HETEROJUNCTION', 'GaAlAs / GaAs / GaAlAs sandwich', 'rgba(52,211,153,0.65)');

      // Draw junction schematic inside each
      const boxY = topY + 62;
      const boxH = ch * 0.46;

      // Homojunction: uniform Eg and n -> wide spread!
      ctx.fillStyle = 'rgba(224,140,58,0.12)';
      ctx.fillRect(lx + 18, boxY, cw - 36, boxH);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.strokeRect(lx + 18, boxY, cw - 36, boxH);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(lx + 18, boxY + boxH / 2); ctx.lineTo(lx + cw - 18, boxY + boxH / 2); ctx.stroke();
      ctx.setLineDash([]);
      // Diffuse carriers & diverging photons
      const tAnim = C.prefersReducedMotion() ? 0 : state.time;
      for (let i = 0; i < 12; i++) {
        const px = lx + 30 + ((i * 37) % Math.max(20, cw - 60));
        const spread = Math.sin(tAnim * 2 + i) * (boxH * 0.38);
        ctx.fillStyle = i % 2 === 0 ? '#22d3ee' : '#ff6b81';
        ctx.beginPath(); ctx.arc(px, boxY + boxH / 2 + spread, 3, 0, 6.28); ctx.fill();
      }
      // Leaking photon rays
      ctx.strokeStyle = 'rgba(224,181,83,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(lx + cw * 0.3, boxY + boxH * 0.5); ctx.lineTo(lx + cw * 0.7, boxY + 12);
      ctx.moveTo(lx + cw * 0.4, boxY + boxH * 0.5); ctx.lineTo(lx + cw * 0.8, boxY + boxH - 10);
      ctx.stroke();

      // Heterojunction: confined active core
      const actTop = boxY + boxH * 0.36;
      const actH = boxH * 0.28;
      ctx.fillStyle = 'rgba(99,102,241,0.15)';
      ctx.fillRect(rx + 18, boxY, cw - 36, boxH * 0.36);
      ctx.fillStyle = 'rgba(255,68,95,0.25)';
      ctx.fillRect(rx + 18, actTop, cw - 36, actH);
      ctx.fillStyle = 'rgba(245,158,11,0.15)';
      ctx.fillRect(rx + 18, actTop + actH, cw - 36, boxH * 0.36);
      ctx.strokeStyle = 'rgba(52,211,153,0.55)';
      ctx.strokeRect(rx + 18, actTop, cw - 36, actH);

      for (let i = 0; i < 12; i++) {
        const px = rx + 28 + ((i * 29) % Math.max(20, cw - 56));
        const py = actTop + 6 + ((i * 13) % Math.max(8, actH - 12));
        ctx.fillStyle = i % 2 === 0 ? '#22d3ee' : '#ff6b81';
        ctx.beginPath(); ctx.arc(px, py, 3, 0, 6.28); ctx.fill();
      }
      // Guided optical wave inside core
      ctx.strokeStyle = '#ff5c7a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const zx = rx + 18 + (i / 6) * (cw - 36);
        const zy = i % 2 === 0 ? actTop + 4 : actTop + actH - 4;
        if (i === 0) ctx.moveTo(zx, zy); else ctx.lineTo(zx, zy);
      }
      ctx.stroke();

      // Comparison bullet summaries
      const bulletsL = [
        '• No bandgap step → wide carrier diffusion',
        '• Uniform index n → poor optical guiding',
        '• Very high threshold current density',
        '• Pulsed / cryogenic operation typical',
      ];
      const bulletsR = [
        '• ΔE_g barriers confine e⁻ & h⁺ in thin well',
        '• Δn step (3.59 vs 3.35) guides photons',
        '• Dramatically lower threshold current',
        '• Continuous-wave (CW) at room temp',
      ];
      const textY0 = boxY + boxH + 26;
      ctx.textAlign = 'left';
      ctx.font = (narrow ? '9.5px' : '10.5px') + ' Inter, sans-serif';
      bulletsL.forEach((b, idx) => {
        ctx.fillStyle = '#e08c3a';
        ctx.fillText(b, lx + 14, textY0 + idx * 20);
      });
      bulletsR.forEach((b, idx) => {
        ctx.fillStyle = '#34d399';
        ctx.fillText(b, rx + 14, textY0 + idx * 20);
      });
    }

    function render() {
      if (!canvasObj) return;
      const { ctx, w, h } = canvasObj;
      ctx.clearRect(0, 0, w, h);
      if (state.subview === 'compare') renderComparisonView(ctx, w, h);
      else renderHeteroView(ctx, w, h);
    }

    return {
      mount() {
        buildDOM();
        canvasObj = X.setupCanvas(document.getElementById('cv-c2t3'));
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
        const cv = document.getElementById('cv-c2t3');
        if (cv) canvasObj = X.setupCanvas(cv);
        render();
      },
      applyPreset(preset) {
        if (preset === 'compare-homo') {
          state.subview = 'compare';
          if (subtabBar) subtabBar.set('compare');
        } else {
          state.subview = 'hetero';
          if (subtabBar) subtabBar.set('hetero');
          if (preset === 'zero-bias') state.V = 0;
          else if (preset === 'led-regime') state.V = 1.25;
          else state.V = 1.70;
          if (ui.vSlider) ui.vSlider.setValue(state.V);
        }
        updateReadouts();
        updateBanner();
      },
      getState: () => state,
    };
  };
})();
