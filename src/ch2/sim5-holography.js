(function () {
  'use strict';

  const C = window.Ch2Platform;
  const X = window.XLab;

  window.CH2_SIMS['c2t5'] = function createHolographyLab(ctxDom) {
    const { stage, controls, formula, wrap, dot } = ctxDom;
    const P = C.PHYSICS;

    const state = {
      stage: 'recording',    // 'recording' | 'reconstruction'
      playing: true,
      angleDeg: 28,          // Beam angle theta between reference & object waves (10..55 deg)
      phaseDeg: 0,           // Relative phase Δφ (0..360 deg)
      lambda: 633,           // nm (633 He-Ne, 532 Green, 450 Blue)
      recordedExposure: 1.0, // visual buildup 0..1 when recording
      time: 0,
    };

    let built = false;
    let canvasObj = null;
    let ui = {};
    let banner = null;
    let subtabBar = null;

    function calcFringeMetrics() {
      // Fringe spacing for plane reference (normal to plate) + angled object wave:
      // d = λ / sin(θ)
      const rad = state.angleDeg * P.degToRad;
      const dUm = (state.lambda * 1e-3) / Math.max(Math.sin(rad), 0.05); // in μm
      const linesPerMm = 1000 / dUm;
      return { dUm, linesPerMm, rad };
    }

    function resetSimulation(keepSliders) {
      if (!keepSliders) {
        state.angleDeg = 28;
        state.phaseDeg = 0;
        state.lambda = 633;
        if (ui.angSlider) ui.angSlider.setValue(28);
        if (ui.phSlider) ui.phSlider.setValue(0);
        if (ui.lamSelect) ui.lamSelect.value = '633';
      }
      state.recordedExposure = state.stage === 'recording' ? 0.15 : 1.0;
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
      canvas.id = 'cv-c2t5';
      canvas.setAttribute('aria-label', 'Two-Stage Holography and Interference Fringe Laboratory');
      stage.append(canvas);
      canvasObj = X.setupCanvas(canvas);

      subtabBar = C.buildSubtabs(
        wrap,
        [
          { id: 'recording', label: 'Stage A: Recording Hologram' },
          { id: 'reconstruction', label: 'Stage B: Image Reconstruction' },
        ],
        state.stage,
        (s) => {
          state.stage = s;
          if (s === 'recording') state.recordedExposure = 0.2;
          else state.recordedExposure = 1.0;
          updateReadouts();
          updateBanner();
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

      C.buildActionRow(controls, [
        {
          id: 'switchStage',
          label: 'Toggle Recording ↔ Reconstruction',
          primary: true,
          onClick: () => {
            state.stage = state.stage === 'recording' ? 'reconstruction' : 'recording';
            if (subtabBar) subtabBar.set(state.stage);
            if (state.stage === 'recording') state.recordedExposure = 0.2;
            updateReadouts();
            updateBanner();
          },
        },
      ]);

      ui.angSlider = X.buildSlider(controls, {
        label: 'Beam Angle θ (Object vs. Reference)',
        id: 'c2t5-ang',
        min: 10,
        max: 55,
        step: 1,
        value: state.angleDeg,
        format: (v) => Math.round(v) + '°',
        onInput: (v) => {
          state.angleDeg = v;
          updateReadouts();
        },
      });

      ui.phSlider = X.buildSlider(controls, {
        label: 'Relative Phase Shift Δφ',
        id: 'c2t5-phase',
        min: 0,
        max: 360,
        step: 5,
        value: state.phaseDeg,
        format: (v) => `${Math.round(v)}° (${(v * Math.PI / 180).toFixed(2)} rad)`,
        onInput: (v) => {
          state.phaseDeg = v;
          updateReadouts();
        },
      });

      ui.lamSelect = X.buildSelect(controls, {
        label: 'LASER Wavelength λ',
        value: String(state.lambda),
        options: [
          { value: '633', label: '633 nm — He-Ne Red' },
          { value: '532', label: '532 nm — Nd:YAG Green' },
          { value: '450', label: '450 nm — Diode Blue' },
        ],
        onChange: (val) => {
          state.lambda = Number(val);
          updateReadouts();
          updateBanner();
        },
      });

      ui.readouts = X.buildReadouts(controls, [
        { id: 'stage', label: 'Experiment Stage', wide: true },
        { id: 'spacing', label: 'Fringe Spacing d', primary: true },
        { id: 'freq', label: 'Spatial Freq (1/d)' },
        { id: 'phase', label: 'Relative Phase Δφ', wide: true },
      ]);

      controls.append(X.el('div', 'ctrl-note',
        '<b>Wave Interference Model:</b> Plate fringe spacing follows <b>d = λ / sin(θ)</b> for normal reference incidence and object angle θ. Adjust θ or Δφ to see live changes on the photographic plate.'
      ));
    }

    function updateReadouts() {
      if (!ui.readouts) return;
      const m = calcFringeMetrics();
      ui.readouts.set('stage', state.stage === 'recording' ? 'Stage A: Recording Fringes' : 'Stage B: Grating Reconstruction');
      ui.readouts.set('spacing', m.dUm.toFixed(2) + ' μm');
      ui.readouts.set('freq', Math.round(m.linesPerMm) + ' lines/mm');
      ui.readouts.set('phase', `${Math.round(state.phaseDeg)}° (${(state.phaseDeg * P.degToRad).toFixed(2)} rad)`);

      formula.innerHTML = `
        <span class="formula active">I(y) = I<sub>R</sub> + I<sub>O</sub> + 2√(I<sub>R</sub>I<sub>O</sub>)cos(k·y·sinθ + Δφ)</span>
        <span class="formula">Fringe Pitch: d = λ / sinθ = <span class="fv">${m.dUm.toFixed(2)} μm</span></span>`;
    }

    function updateBanner() {
      if (!banner) return;
      if (state.stage === 'recording') {
        banner.set('STAGE A · RECORDING', 'ok', 'Beam splitter sends coherent light along <b>Reference</b> &amp; <b>Object</b> paths. Their interference forms stationary fringes (amplitude + phase) on the photographic plate.');
      } else {
        banner.set('STAGE B · RECONSTRUCTION', 'ok', '<b>Object removed!</b> Illuminating the developed hologram with the reconstruction wave causes the recorded fringes to act as a <b>diffraction grating</b>, reconstructing the 3D virtual image.');
      }
    }

    function drawWaveTicks(ctx, x1, y1, x2, y2, col, speedSign, phaseShift) {
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      if (len < 10) return;
      const ux = dx / len, uy = dy / len;
      const nx = -uy, ny = ux;
      const step = 16;
      const offset = ((state.time * 48 * speedSign) + phaseShift * 3) % step;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.3;
      for (let s = offset; s < len - 4; s += step) {
        if (s < 4) continue;
        const cx = x1 + ux * s, cy = y1 + uy * s;
        ctx.beginPath();
        ctx.moveTo(cx - nx * 6, cy - ny * 6);
        ctx.lineTo(cx + nx * 6, cy + ny * 6);
        ctx.stroke();
      }
    }

    function drawPyramidObject(ctx, cx, cy, size, ghost) {
      ctx.save();
      if (ghost) ctx.setLineDash([4, 3]);
      ctx.fillStyle = ghost ? 'rgba(34,211,238,0.16)' : 'rgba(224,181,83,0.22)';
      ctx.strokeStyle = ghost ? '#22d3ee' : '#e0b553';
      ctx.lineWidth = 2;

      // 3D wireframe pyramid
      const top = [cx, cy - size];
      const left = [cx - size * 0.85, cy + size * 0.65];
      const right = [cx + size * 0.85, cy + size * 0.65];
      const front = [cx + size * 0.15, cy + size * 0.9];

      ctx.beginPath();
      ctx.moveTo(top[0], top[1]); ctx.lineTo(left[0], left[1]); ctx.lineTo(front[0], front[1]); ctx.closePath();
      ctx.fill(); ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(top[0], top[1]); ctx.lineTo(front[0], front[1]); ctx.lineTo(right[0], right[1]); ctx.closePath();
      ctx.fill(); ctx.stroke();

      ctx.restore();
    }

    function drawMirror(ctx, cx, cy, angleRad, label) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angleRad);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-18, -3, 36, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(-18, -3, 36, 2);
      ctx.restore();
      if (label) {
        ctx.fillStyle = '#8f9cb5';
        ctx.font = 'bold 9.5px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, cx, cy - 16);
      }
    }

    function render() {
      if (!canvasObj) return;
      const { ctx, w, h } = canvasObj;
      ctx.clearRect(0, 0, w, h);

      const narrow = w < 640;
      const pad = narrow ? 12 : 20;
      const beamCol = C.spectrumColor(state.lambda, 0.92);
      const beamSoft = C.spectrumColor(state.lambda, 0.24);
      const beamMid = C.spectrumColor(state.lambda, 0.60);

      // Layout: Left/Top = Optical Bench (~62% width on desktop, top 56% on mobile)
      // Right/Bottom = Live Interference Pattern & Intensity Profile (~38% width on desktop)
      const benchX = pad;
      const benchY = 38;
      const benchW = narrow ? w - pad * 2 : (w - pad * 2 - 16) * 0.64;
      const benchH = narrow ? h * 0.54 : h - 54;

      const frX = narrow ? pad : benchX + benchW + 16;
      const frY = narrow ? benchY + benchH + 14 : 38;
      const frW = narrow ? w - pad * 2 : w - frX - pad;
      const frH = narrow ? h - frY - 12 : h - 54;

      // Optical Bench Backdrop
      ctx.textAlign = 'left';
      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillText(
        state.stage === 'recording' ? 'STAGE A: HOLOGRAM RECORDING SETUP' : 'STAGE B: HOLOGRAM RECONSTRUCTION SETUP',
        benchX,
        22
      );
      ctx.fillStyle = 'rgba(6,10,24,0.72)';
      ctx.fillRect(benchX, benchY, benchW, benchH);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.strokeRect(benchX, benchY, benchW, benchH);

      // Component Coordinates inside bench
      const laserPos = { x: benchX + 20, y: benchY + benchH * 0.26, w: 62, h: 26 };
      const bsPos = { x: benchX + benchW * 0.28, y: laserPos.y + laserPos.h / 2 };
      const m1Pos = { x: benchX + benchW * 0.72, y: bsPos.y };
      const plateX = benchX + benchW * 0.72;
      const plateY1 = benchY + benchH * 0.44;
      const plateY2 = benchY + benchH * 0.86;
      const plateMidY = (plateY1 + plateY2) / 2;

      // Object position shifts visibly with angle theta!
      const rad = state.angleDeg * P.degToRad;
      const objDist = Math.min(benchW * 0.34, 155);
      const objPos = {
        x: X.clamp(plateX - Math.cos(rad) * objDist, benchX + benchW * 0.24, plateX - 75),
        y: X.clamp(plateMidY + Math.sin(rad) * objDist * 0.55, benchY + benchH * 0.52, benchY + benchH - 36),
      };
      const m2Pos = { x: bsPos.x, y: objPos.y };

      // 1. LASER Source Box
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(laserPos.x, laserPos.y, laserPos.w, laserPos.h);
      ctx.strokeStyle = beamCol;
      ctx.lineWidth = 1.6;
      ctx.strokeRect(laserPos.x, laserPos.y, laserPos.w, laserPos.h);
      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 9.5px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LASER', laserPos.x + laserPos.w / 2, laserPos.y + 16);

      if (state.stage === 'recording') {
        // Beam from LASER -> BS -> Mirror M1 -> Photographic Plate (Reference Beam)
        ctx.strokeStyle = beamCol;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(laserPos.x + laserPos.w, bsPos.y);
        ctx.lineTo(m1Pos.x, m1Pos.y);
        ctx.lineTo(plateX, plateMidY);
        ctx.stroke();

        // Expand Reference wave onto whole plate
        ctx.fillStyle = beamSoft;
        ctx.beginPath();
        ctx.moveTo(m1Pos.x, m1Pos.y);
        ctx.lineTo(plateX, plateY1);
        ctx.lineTo(plateX, plateY2);
        ctx.closePath();
        ctx.fill();

        if (!C.prefersReducedMotion()) {
          drawWaveTicks(ctx, laserPos.x + laserPos.w, bsPos.y, m1Pos.x, m1Pos.y, '#ffffff88', 1, 0);
          drawWaveTicks(ctx, m1Pos.x, m1Pos.y, plateX, plateMidY, '#ffffff88', 1, 0);
        }

        // Beam from BS -> Mirror M2 -> Object -> Photographic Plate (Object Beam)
        ctx.strokeStyle = beamCol;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(bsPos.x, bsPos.y);
        ctx.lineTo(m2Pos.x, m2Pos.y);
        ctx.lineTo(objPos.x, objPos.y);
        ctx.stroke();

        // Reflected Object wavefront cone reaching plate
        ctx.fillStyle = beamSoft;
        ctx.beginPath();
        ctx.moveTo(objPos.x + 12, objPos.y);
        ctx.lineTo(plateX, plateY1);
        ctx.lineTo(plateX, plateY2);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = beamMid;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(objPos.x + 10, objPos.y);
        ctx.lineTo(plateX, plateMidY);
        ctx.stroke();

        if (!C.prefersReducedMotion()) {
          drawWaveTicks(ctx, bsPos.x, bsPos.y, m2Pos.x, m2Pos.y, '#ffffff77', 1, 0);
          drawWaveTicks(ctx, m2Pos.x, m2Pos.y, objPos.x, objPos.y, '#ffffff77', 1, 0);
          drawWaveTicks(ctx, objPos.x, objPos.y, plateX, plateMidY, '#ffffffaa', 1, state.phaseDeg * 0.04);
        }

        // Mirrors & BS & Object
        drawMirror(ctx, bsPos.x, bsPos.y, -Math.PI / 4, 'BS');
        drawMirror(ctx, m1Pos.x, m1Pos.y, Math.PI / 4, 'M₁');
        drawMirror(ctx, m2Pos.x, m2Pos.y, Math.PI / 4, 'M₂');
        drawPyramidObject(ctx, objPos.x, objPos.y, narrow ? 16 : 20, false);

        ctx.fillStyle = '#e0b553';
        ctx.font = 'bold 9.5px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Object', objPos.x, objPos.y + 30);

        ctx.fillStyle = '#38bdf8';
        ctx.fillText('Reference Beam', (bsPos.x + m1Pos.x) / 2, bsPos.y - 10);
        ctx.fillText('Object Beam', (objPos.x + plateX) / 2 - 12, (objPos.y + plateMidY) / 2 + 24);
      } else {
        // STAGE B: RECONSTRUCTION — Object is removed, Reference wave illuminates Hologram Grating!
        ctx.strokeStyle = beamCol;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(laserPos.x + laserPos.w, bsPos.y);
        ctx.lineTo(m1Pos.x, m1Pos.y);
        ctx.lineTo(plateX, plateMidY);
        ctx.stroke();

        ctx.fillStyle = beamSoft;
        ctx.beginPath();
        ctx.moveTo(m1Pos.x, m1Pos.y);
        ctx.lineTo(plateX, plateY1);
        ctx.lineTo(plateX, plateY2);
        ctx.closePath();
        ctx.fill();

        if (!C.prefersReducedMotion()) {
          drawWaveTicks(ctx, laserPos.x + laserPos.w, bsPos.y, m1Pos.x, m1Pos.y, '#ffffff88', 1, 0);
          drawWaveTicks(ctx, m1Pos.x, m1Pos.y, plateX, plateMidY, '#ffffff88', 1, 0);
        }
        drawMirror(ctx, m1Pos.x, m1Pos.y, Math.PI / 4, 'M₁');

        // Reconstructed Virtual Image at original object site (dashed cyan glowing pyramid)
        drawPyramidObject(ctx, objPos.x, objPos.y, narrow ? 16 : 20, true);
        ctx.fillStyle = '#22d3ee';
        ctx.font = 'bold 9.5px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Virtual 3D Image', objPos.x, objPos.y + 30);

        // Diverging rays traced backward from Hologram to Virtual Image -> to Observer Eye on right!
        const eyeX = benchX + benchW - 22;
        const eyeY = plateMidY + 34;

        // Virtual back-projection dashed rays
        ctx.strokeStyle = 'rgba(34,211,238,0.65)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(objPos.x, objPos.y); ctx.lineTo(plateX, plateY1 + 10);
        ctx.moveTo(objPos.x, objPos.y); ctx.lineTo(plateX, plateY2 - 10);
        ctx.stroke();
        ctx.setLineDash([]);

        // Diffracted +1 order beams traveling from Hologram to Observer Eye
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(plateX, plateY1 + 10); ctx.lineTo(eyeX, eyeY - 6);
        ctx.moveTo(plateX, plateY2 - 10); ctx.lineTo(eyeX, eyeY + 6);
        ctx.stroke();

        // 0-order direct transmitted beam (downward continuation)
        ctx.strokeStyle = beamMid;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(plateX, plateMidY);
        ctx.lineTo(plateX + 26, plateY2 + 12);
        ctx.stroke();

        // Observer Eye icon
        ctx.fillStyle = '#edf1f8';
        ctx.beginPath();
        ctx.ellipse(eyeX, eyeY, 10, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0ea5c6';
        ctx.beginPath();
        ctx.arc(eyeX - 2, eyeY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#8f9cb5';
        ctx.font = '9px Inter, sans-serif';
        ctx.fillText('Observer', eyeX - 6, eyeY + 20);

        ctx.fillStyle = '#22d3ee';
        ctx.fillText('Reconstruction Wave', (bsPos.x + m1Pos.x) / 2, bsPos.y - 10);
      }

      // Draw Photographic Plate / Hologram Grating (with visible fringe stripes!)
      ctx.fillStyle = 'rgba(15,23,42,0.95)';
      ctx.fillRect(plateX - 5, plateY1, 10, plateY2 - plateY1);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(plateX - 5, plateY1, 10, plateY2 - plateY1);

      const m = calcFringeMetrics();
      const stripeCount = Math.round(X.clamp(12 / m.dUm, 5, 22));
      const plateLen = plateY2 - plateY1;
      for (let i = 0; i < stripeCount; i++) {
        const sy = plateY1 + (i / stripeCount) * plateLen;
        ctx.fillStyle = `rgba(52,211,153,${0.7 * state.recordedExposure})`;
        ctx.fillRect(plateX - 4, sy, 8, Math.max(1.5, plateLen / stripeCount * 0.42));
      }
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 9.5px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.stage === 'recording' ? 'Photographic Plate' : 'Hologram Grating', plateX, plateY2 + 16);

      // Angle θ indicator near plate
      ctx.fillStyle = '#e0b553';
      ctx.font = 'bold 9.5px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`θ = ${Math.round(state.angleDeg)}°`, benchX + 12, benchY + benchH - 12);

      // ================= RIGHT PANEL: INTERACTIVE FRINGE & WAVE VISUALIZER =================
      ctx.textAlign = 'left';
      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillText('INTERFERENCE FRINGE PATTERN', frX, narrow ? frY - 4 : 22);

      ctx.fillStyle = 'rgba(6,10,24,0.72)';
      ctx.fillRect(frX, frY, frW, frH);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.strokeRect(frX, frY, frW, frH);

      const innerPad = 14;
      const stripX = frX + innerPad;
      const stripY = frY + 32;
      const stripW = frW - innerPad * 2;
      const stripH = frH * 0.34;

      ctx.fillStyle = '#8f9cb5';
      ctx.font = '9.5px Inter, sans-serif';
      ctx.fillText('Magnified Plate Fringes (Bright = Constructive)', stripX, stripY - 8);

      // Render true sinusoidal 2D interference fringes across stripW
      const kEff = (2 * Math.PI * Math.sin(rad)) / (state.lambda * 0.012); // visual spatial wavevector
      const phiRad = state.phaseDeg * P.degToRad;
      const colRgb = state.lambda < 490 ? '96,165,250' : (state.lambda < 580 ? '52,211,153' : '255,92,122');

      const stepPx = 2;
      for (let x = 0; x < stripW; x += stepPx) {
        const yCoord = x - stripW / 2;
        const I = 0.5 * (1 + Math.cos(kEff * yCoord + phiRad));
        ctx.fillStyle = `rgba(${colRgb},${(0.06 + 0.92 * I * state.recordedExposure).toFixed(3)})`;
        ctx.fillRect(stripX + x, stripY, stepPx, stripH);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.strokeRect(stripX, stripY, stripW, stripH);

      // Intensity Profile I(y) below fringe strip
      const plotY0 = stripY + stripH + 28;
      const plotH = frY + frH - plotY0 - 28;
      if (plotH > 45) {
        ctx.fillStyle = '#8f9cb5';
        ctx.font = '9.5px Inter, sans-serif';
        ctx.fillText('Intensity Profile I(y) = I₀[1 + cos(ky sinθ + Δφ)]', stripX, plotY0 - 8);

        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(stripX, plotY0, stripW, plotH);
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.strokeRect(stripX, plotY0, stripW, plotH);

        // Plot Reference + Object wave superposition curve
        ctx.beginPath();
        for (let i = 0; i <= 140; i++) {
          const frac = i / 140;
          const xPx = stripX + frac * stripW;
          const yCoord = (frac - 0.5) * stripW;
          const I = 0.5 * (1 + Math.cos(kEff * yCoord + phiRad));
          const yPx = plotY0 + plotH - 6 - I * (plotH - 14);
          if (i === 0) ctx.moveTo(xPx, yPx);
          else ctx.lineTo(xPx, yPx);
        }
        ctx.strokeStyle = beamCol;
        ctx.lineWidth = 2.2;
        ctx.stroke();

        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 9.5px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`d = ${m.dUm.toFixed(2)} μm  ·  ${Math.round(m.linesPerMm)} lines/mm`, frX + frW / 2, frY + frH - 10);
      }
    }

    return {
      mount() {
        buildDOM();
        canvasObj = X.setupCanvas(document.getElementById('cv-c2t5'));
        updateReadouts();
        updateBanner();
        render();
      },
      unmount() {},
      tick(dt) {
        if (state.playing) {
          state.time += dt;
          if (state.stage === 'recording' && state.recordedExposure < 1.0) {
            state.recordedExposure = Math.min(1.0, state.recordedExposure + dt * 0.45);
          }
        }
        render();
      },
      resize() {
        const cv = document.getElementById('cv-c2t5');
        if (cv) canvasObj = X.setupCanvas(cv);
        render();
      },
      applyPreset(preset) {
        if (preset === 'reconstruction') {
          state.stage = 'reconstruction';
          state.recordedExposure = 1.0;
        } else if (preset === 'high-angle') {
          state.stage = 'recording';
          state.angleDeg = 48;
          state.recordedExposure = 1.0;
          if (ui.angSlider) ui.angSlider.setValue(48);
        } else {
          state.stage = 'recording';
          state.angleDeg = 28;
          state.recordedExposure = 0.25;
          if (ui.angSlider) ui.angSlider.setValue(28);
        }
        if (subtabBar) subtabBar.set(state.stage);
        updateReadouts();
        updateBanner();
      },
      getState: () => state,
    };
  };
})();
