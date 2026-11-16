(function () {
  'use strict';

  const C = window.Ch2Platform;
  const X = window.XLab;

  window.CH2_SIMS['c2t7'] = function createFibreCommLab(ctxDom) {
    const { stage, controls, formula, wrap, dot } = ctxDom;

    const state = {
      tab: 'attenuation',     // 'attenuation' | 'dispersion' | 'pipeline'
      playing: true,
      // Tab A: Attenuation
      lengthKm: 20,           // 0.5..100 km
      pinMw: 10.0,            // 0.5..50.0 mW
      alphaDbKm: 0.50,        // 0.2..5.0 dB/km
      macroBendDb: 1.5,       // 0..10 dB conceptual bend loss
      microBend: false,       // +1.5 dB conceptual micro-bend loss
      lambdaNm: 1310,         // 780..1650 nm
      // Tab B: Dispersion
      dispMech: 'intermodal', // 'intermodal' | 'material' | 'waveguide' | 'combined'
      fibreMode: 'multimode', // 'multimode' | 'single'
      sourceType: 'led',      // 'led' | 'laser'
      bitRateMbps: 45,        // 10..120 Mbps conceptual bit rate
      // Tab C: Communication Pipeline
      bitSeq: '101101001',
      modulation: 'digital',  // 'digital' | 'analog'
      time: 0,
    };

    let built = false;
    let canvasObj = null;
    let ui = {};
    let banner = null;
    let subtabBar = null;

    function calcAttenuation() {
      const L = Math.max(0.1, Number(state.lengthKm) || 0.1);
      const Pin = Math.max(0.05, Number(state.pinMw) || 0.05);
      const alpha = Math.max(0, Number(state.alphaDbKm) || 0);
      const bendTotal = Math.max(0, state.macroBendDb) + (state.microBend ? 1.5 : 0);
      const totalDb = alpha * L + bendTotal;
      const Pout = Pin * Math.pow(10, -totalDb / 10);
      // Exact inverse verification: 10 * log10(Pin / Pout)
      const attenDbCheck = 10 * Math.log10(Pin / Math.max(Pout, 1e-18));
      const effCoeff = attenDbCheck / L;
      const relRayleigh = Math.pow(850 / state.lambdaNm, 4);
      return { L, Pin, Pout, totalDb: attenDbCheck, effCoeff, bendTotal, relRayleigh };
    }

    function calcDispersion() {
      // Conceptual normalized pulse spreading (ns) calibrated to show physical scaling:
      // Intermodal ~ L * 1.1 ns/km in multimode, 0 in single-mode
      // Material ~ L * (LED ? 0.35 : 0.025) ns/km
      // Waveguide ~ L * 0.06 ns/km
      const L = state.lengthKm;
      const isMulti = state.fibreMode === 'multimode';
      const isLed = state.sourceType === 'led';

      const sInter = isMulti ? 0.95 * L : 0;
      const sMat = (isLed ? 0.38 : 0.03) * L;
      const sWave = 0.08 * L;

      let spreadNs = 0;
      if (state.dispMech === 'intermodal') spreadNs = sInter;
      else if (state.dispMech === 'material') spreadNs = sMat;
      else if (state.dispMech === 'waveguide') spreadNs = sWave;
      else spreadNs = Math.sqrt(sInter * sInter + sMat * sMat + sWave * sWave);

      // Base input pulse sigma_0 = 2.2 ns, bit slot T_bit = 1000 / bitRateMbps (ns)
      const sigmaIn = 2.2;
      const sigmaOut = Math.sqrt(sigmaIn * sigmaIn + spreadNs * spreadNs);
      const bitPeriodNs = 1000 / state.bitRateMbps;
      const overlapRatio = (sigmaOut * 2.2) / bitPeriodNs;
      const isiOverlap = overlapRatio > 0.95;

      return { sigmaIn, sigmaOut, spreadNs, bitPeriodNs, overlapRatio, isiOverlap, sInter, sMat, sWave };
    }

    function sanitizeBits(raw) {
      const cleaned = String(raw || '').replace(/[^01]/g, '').slice(0, 14);
      return cleaned.length > 0 ? cleaned : '1';
    }

    function resetSimulation(keepTab) {
      if (!keepTab) state.tab = 'attenuation';
      state.lengthKm = 20;
      state.pinMw = 10.0;
      state.alphaDbKm = 0.50;
      state.macroBendDb = 1.5;
      state.microBend = false;
      state.lambdaNm = 1310;
      state.dispMech = 'intermodal';
      state.fibreMode = 'multimode';
      state.sourceType = 'led';
      state.bitRateMbps = 45;
      state.bitSeq = '101101001';
      state.modulation = 'digital';

      if (subtabBar) subtabBar.set(state.tab);
      if (ui.lenSlider) ui.lenSlider.setValue(state.lengthKm);
      if (ui.pinSlider) ui.pinSlider.setValue(state.pinMw);
      if (ui.alphaSlider) ui.alphaSlider.setValue(state.alphaDbKm);
      if (ui.macroSlider) ui.macroSlider.setValue(state.macroBendDb);
      if (ui.microToggle) ui.microToggle.checked = false;
      if (ui.lamSlider) ui.lamSlider.setValue(state.lambdaNm);
      if (ui.mechSeg) ui.mechSeg.set(state.dispMech);
      if (ui.fibreSeg) ui.fibreSeg.set(state.fibreMode);
      if (ui.srcSeg) ui.srcSeg.set(state.sourceType);
      if (ui.rateSlider) ui.rateSlider.setValue(state.bitRateMbps);
      if (ui.modSeg) ui.modSeg.set(state.modulation);
      if (ui.bitInput) ui.bitInput.value = state.bitSeq;

      syncTabControls();
      updateReadouts();
      updateBanner();
    }

    function syncTabControls() {
      const t = state.tab;
      const show = (node, visible) => {
        if (!node) return;
        const block = node.closest ? (node.closest('.slider-block') || node.closest('.toggle-row') || node) : node;
        block.style.display = visible ? '' : 'none';
      };

      show(ui.pinSlider && ui.pinSlider.input, t === 'attenuation');
      show(ui.alphaSlider && ui.alphaSlider.input, t === 'attenuation' || t === 'pipeline');
      show(ui.macroSlider && ui.macroSlider.input, t === 'attenuation' || t === 'pipeline');
      show(ui.microToggle, t === 'attenuation');
      show(ui.lamSlider && ui.lamSlider.input, t === 'attenuation');

      show(ui.mechWrap, t === 'dispersion');
      show(ui.fibreWrap, t === 'dispersion' || t === 'pipeline');
      show(ui.srcWrap, t === 'dispersion' || t === 'pipeline');
      show(ui.rateSlider && ui.rateSlider.input, t === 'dispersion');

      show(ui.modWrap, t === 'pipeline');
      show(ui.bitWrap, t === 'pipeline');
    }

    function buildDOM() {
      if (built) return;
      built = true;

      stage.innerHTML = '';
      controls.innerHTML = '';
      formula.innerHTML = '';

      const canvas = X.el('canvas', 'viz');
      canvas.id = 'cv-c2t7';
      canvas.setAttribute('aria-label', 'Optical Fibre Attenuation, Dispersion and Communication Laboratory');
      stage.append(canvas);
      canvasObj = X.setupCanvas(canvas);

      subtabBar = C.buildSubtabs(
        wrap,
        [
          { id: 'attenuation', label: 'A. Attenuation & Losses' },
          { id: 'dispersion', label: 'B. Dispersion & Pulse Broadening' },
          { id: 'pipeline', label: 'C. Communication System' },
        ],
        state.tab,
        (id) => {
          state.tab = id;
          syncTabControls();
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
        onReset: () => resetSimulation(true),
        playLabel: 'Pause',
      });
      ui.transport.setPlaying(true);

      // Shared Fibre Length
      ui.lenSlider = X.buildSlider(controls, {
        label: 'Fibre Length (L)',
        id: 'c2t7-len',
        min: 0.5,
        max: 100,
        step: 0.5,
        value: state.lengthKm,
        format: (v) => v.toFixed(1) + ' km',
        onInput: (v) => { state.lengthKm = v; updateReadouts(); updateBanner(); },
      });

      // Tab A controls
      ui.pinSlider = X.buildSlider(controls, {
        label: 'Input Optical Power (P_in)',
        id: 'c2t7-pin',
        min: 0.5,
        max: 50.0,
        step: 0.5,
        value: state.pinMw,
        format: (v) => v.toFixed(1) + ' mW',
        onInput: (v) => { state.pinMw = v; updateReadouts(); updateBanner(); },
      });

      ui.alphaSlider = X.buildSlider(controls, {
        label: 'Fibre Attenuation Coeff α',
        id: 'c2t7-alpha',
        min: 0.20,
        max: 4.00,
        step: 0.05,
        value: state.alphaDbKm,
        format: (v) => v.toFixed(2) + ' dB/km',
        onInput: (v) => { state.alphaDbKm = v; updateReadouts(); updateBanner(); },
      });

      ui.macroSlider = X.buildSlider(controls, {
        label: 'Macro-Bending Loss',
        id: 'c2t7-macro',
        min: 0,
        max: 10,
        step: 0.2,
        value: state.macroBendDb,
        format: (v) => v.toFixed(1) + ' dB',
        onInput: (v) => { state.macroBendDb = v; updateReadouts(); updateBanner(); },
      });

      ui.microToggle = X.buildToggle(controls, {
        label: 'Micro-bending perturbation (+1.5 dB)',
        checked: state.microBend,
        onChange: (on) => { state.microBend = on; updateReadouts(); updateBanner(); },
      });

      ui.lamSlider = X.buildSlider(controls, {
        label: 'Operating Wavelength λ',
        id: 'c2t7-lam',
        min: 780,
        max: 1650,
        step: 5,
        value: state.lambdaNm,
        format: (v) => Math.round(v) + ' nm',
        onInput: (v) => { state.lambdaNm = v; updateReadouts(); updateBanner(); },
      });

      // Tab B controls
      ui.mechWrap = X.el('div', 'slider-block');
      ui.mechWrap.append(X.el('label', 'control-label', 'Dispersion Mechanism'));
      controls.append(ui.mechWrap);
      ui.mechSeg = X.buildSegmented(ui.mechWrap, {
        options: [
          { value: 'intermodal', label: 'Intermodal' },
          { value: 'material', label: 'Material' },
          { value: 'waveguide', label: 'Waveguide' },
          { value: 'combined', label: 'All' },
        ],
        value: state.dispMech,
        onChange: (m) => { state.dispMech = m; updateReadouts(); updateBanner(); },
      });

      ui.fibreWrap = X.el('div', 'slider-block');
      ui.fibreWrap.append(X.el('label', 'control-label', 'Fibre Propagation Mode'));
      controls.append(ui.fibreWrap);
      ui.fibreSeg = X.buildSegmented(ui.fibreWrap, {
        options: [
          { value: 'multimode', label: 'Multimode' },
          { value: 'single', label: 'Single-Mode' },
        ],
        value: state.fibreMode,
        onChange: (m) => { state.fibreMode = m; updateReadouts(); updateBanner(); },
      });

      ui.srcWrap = X.el('div', 'slider-block');
      ui.srcWrap.append(X.el('label', 'control-label', 'Optical Carrier Source'));
      controls.append(ui.srcWrap);
      ui.srcSeg = X.buildSegmented(ui.srcWrap, {
        options: [
          { value: 'led', label: 'LED (Wide Δλ)' },
          { value: 'laser', label: 'LASER Diode (Narrow Δλ)' },
        ],
        value: state.sourceType,
        onChange: (s) => { state.sourceType = s; updateReadouts(); updateBanner(); },
      });

      ui.rateSlider = X.buildSlider(controls, {
        label: 'Pulse Bit Rate (Spacing)',
        id: 'c2t7-rate',
        min: 10,
        max: 120,
        step: 5,
        value: state.bitRateMbps,
        format: (v) => Math.round(v) + ' Mbps',
        onInput: (v) => { state.bitRateMbps = v; updateReadouts(); updateBanner(); },
      });

      // Tab C controls
      ui.modWrap = X.el('div', 'slider-block');
      ui.modWrap.append(X.el('label', 'control-label', 'Signal Modulation'));
      controls.append(ui.modWrap);
      ui.modSeg = X.buildSegmented(ui.modWrap, {
        options: [
          { value: 'digital', label: 'Digital (OOK)' },
          { value: 'analog', label: 'Analog Intensity' },
        ],
        value: state.modulation,
        onChange: (m) => { state.modulation = m; updateReadouts(); updateBanner(); },
      });

      ui.bitWrap = X.el('div', 'slider-block');
      const bitLab = X.el('label', 'control-label', 'Binary Input Sequence');
      bitLab.htmlFor = 'c2t7-bits';
      const bitIn = document.createElement('input');
      bitIn.type = 'text';
      bitIn.id = 'c2t7-bits';
      bitIn.className = 'ch2-text-input';
      bitIn.maxLength = 14;
      bitIn.value = state.bitSeq;
      bitIn.addEventListener('input', () => {
        const clean = sanitizeBits(bitIn.value);
        state.bitSeq = clean;
        if (bitIn.value !== clean) bitIn.value = clean;
        updateReadouts();
        updateBanner();
      });
      const bitHint = X.el('div', 'ch2-input-hint', 'Enter 0s and 1s (default: 101101001)');
      ui.bitWrap.append(bitLab, bitIn, bitHint);
      controls.append(ui.bitWrap);
      ui.bitInput = bitIn;

      ui.readouts = X.buildReadouts(controls, [
        { id: 'r1', label: 'Total Attenuation', primary: true },
        { id: 'r2', label: 'Attenuation Coeff' },
        { id: 'r3', label: 'Output Power P_out' },
        { id: 'r4', label: 'Rayleigh Factor' },
        { id: 'r5', label: 'Power Summary', wide: true },
      ]);
      ui.readoutLabelEls = controls.querySelectorAll('.readout .r-label');

      controls.append(X.el('div', 'ctrl-note',
        '<b>Model Note:</b> Attenuation dB = 10 log₁₀(P_in/P_out) and coeff = dB / L(km) are exact. The wavelength plot qualitatively shows 1/λ⁴ Rayleigh scaling and the ~850, ~1300, ~1550 nm transmission windows without invented measured dB/km tables; pulse spreading uses conceptual scaling.'
      ));

      syncTabControls();
    }

    function setReadoutLabels(l1, l2, l3, l4, l5) {
      if (!ui.readoutLabelEls || ui.readoutLabelEls.length < 5) return;
      ui.readoutLabelEls[0].textContent = l1;
      ui.readoutLabelEls[1].textContent = l2;
      ui.readoutLabelEls[2].textContent = l3;
      ui.readoutLabelEls[3].textContent = l4;
      ui.readoutLabelEls[4].textContent = l5;
    }

    function updateReadouts() {
      if (!ui.readouts) return;
      const att = calcAttenuation();
      const disp = calcDispersion();

      if (state.tab === 'attenuation') {
        setReadoutLabels('Total Attenuation', 'Attenuation Coeff', 'Output Power P_out', 'Rayleigh 1/λ⁴ Rel.', 'Link Power Budget');
        ui.readouts.set('r1', att.totalDb.toFixed(2) + ' dB');
        ui.readouts.set('r2', att.effCoeff.toFixed(3) + ' dB/km');
        ui.readouts.set('r3', att.Pout >= 0.01 ? att.Pout.toFixed(3) + ' mW' : X.fmtSci(att.Pout) + ' mW');
        ui.readouts.set('r4', `${att.relRayleigh.toFixed(2)}× (vs. 850 nm)`);
        ui.readouts.set('r5', `P_in=${att.Pin.toFixed(1)} mW → P_out=${att.Pout.toFixed(3)} mW (${((att.Pout / att.Pin) * 100).toFixed(2)}%)`);

        formula.innerHTML = `
          <span class="formula active">Attenuation = 10 log₁₀(P<sub>in</sub>/P<sub>out</sub>) = <span class="fv">${att.totalDb.toFixed(2)} dB</span></span>
          <span class="formula">Coeff = Attn / L = <span class="fv">${att.effCoeff.toFixed(3)} dB/km</span></span>
          <span class="formula">Rayleigh ∝ 1/λ⁴ (windows: ~850, ~1300, ~1550 nm)</span>`;
      } else if (state.tab === 'dispersion') {
        setReadoutLabels('Output Width σ_out', 'Input Width σ₀', 'Bit Slot Spacing', 'Fibre Mode', 'Pulse Overlap Status');
        ui.readouts.set('r1', disp.sigmaOut.toFixed(2) + ' ns');
        ui.readouts.set('r2', disp.sigmaIn.toFixed(2) + ' ns');
        ui.readouts.set('r3', disp.bitPeriodNs.toFixed(1) + ' ns');
        ui.readouts.set('r4', state.fibreMode === 'single' ? 'Single-Mode' : 'Multimode');
        ui.readouts.set('r5', disp.isiOverlap ? 'WARNING: Adjacent pulses overlap (ISI) ✗' : 'Pulses remain separable at receiver ✓');

        formula.innerHTML = `
          <span class="formula active">Pulse Width σ<sub>out</sub> = √(σ₀² + Δt²) ≈ <span class="fv">${disp.sigmaOut.toFixed(2)} ns</span></span>
          <span class="formula">Active Mechanism: <span class="fv">${state.dispMech.toUpperCase()}</span> (${state.fibreMode})</span>`;
      } else {
        setReadoutLabels('Optical Carrier', 'Power Remaining', 'Tx Sequence', 'Fibre Mode', 'Receiver Integrity');
        const lossRatio = att.Pout / att.Pin;
        const ampOk = lossRatio > 0.05 && (!disp.isiOverlap || state.fibreMode === 'single');
        ui.readouts.set('r1', state.sourceType === 'laser' ? 'LASER Diode' : 'LED');
        ui.readouts.set('r2', `${(lossRatio * 100).toFixed(1)}% power left`);
        ui.readouts.set('r3', state.modulation === 'digital' ? state.bitSeq : 'Analog wave');
        ui.readouts.set('r4', state.fibreMode === 'single' ? 'Single-Mode' : 'Multimode');
        ui.readouts.set('r5', ampOk ? 'Signal cleanly decoded at receiver ✓' : 'Severe attenuation / dispersion distortion ✗');

        formula.innerHTML = `
          <span class="formula active">Link Loss: <span class="fv">${att.totalDb.toFixed(2)} dB</span> · Broadening: <span class="fv">${disp.sigmaOut.toFixed(1)} ns</span></span>
          <span class="formula">Tx (E→O): <span class="fv">${state.sourceType.toUpperCase()}</span> → Rx (O→E): Photodetector</span>`;
      }
    }

    function updateBanner() {
      if (!banner) return;
      const att = calcAttenuation();
      const disp = calcDispersion();
      if (state.tab === 'attenuation') {
        const nearWin = Math.abs(state.lambdaNm - 850) < 30 || Math.abs(state.lambdaNm - 1310) < 40 || Math.abs(state.lambdaNm - 1550) < 40;
        banner.set(
          nearWin ? 'WINDOW' : 'ATTENUATION',
          nearWin ? 'ok' : '',
          `Power falls from <b>${att.Pin.toFixed(1)} mW</b> to <b>${att.Pout.toFixed(3)} mW</b> over <b>${att.L.toFixed(1)} km</b> (10 log₁₀(Pin/Pout) = <b>${att.totalDb.toFixed(2)} dB</b>). Shorter λ increases 1/λ⁴ Rayleigh scattering.`
        );
      } else if (state.tab === 'dispersion') {
        banner.set(
          disp.isiOverlap ? 'PULSE OVERLAP' : 'DISPERSION',
          disp.isiOverlap ? 'warn' : 'ok',
          disp.isiOverlap
            ? `<b>Intersymbol Interference!</b> Broadened pulses (σ ≈ ${disp.sigmaOut.toFixed(1)} ns) overlap across ${disp.bitPeriodNs.toFixed(1)} ns bit spacing. Switch to <b>Single-Mode</b> or <b>LASER</b> to sharpen pulses.`
            : `Pulses broaden from <b>${disp.sigmaIn.toFixed(1)} ns</b> to <b>${disp.sigmaOut.toFixed(1)} ns</b> due to ${state.dispMech} dispersion, remaining distinct.`
        );
      } else {
        banner.set(
          'LINK PIPELINE',
          att.Pout / att.Pin < 0.05 || disp.isiOverlap ? 'warn' : 'ok',
          `Transmitting <b>${state.modulation === 'digital' ? state.bitSeq : 'Analog Signal'}</b> via <b>${state.sourceType.toUpperCase()}</b> over ${state.lengthKm.toFixed(0)} km ${state.fibreMode} fibre. Observe amplitude drop (attenuation) + pulse smearing (dispersion).`
        );
      }
    }

    /* ============================================================
       TAB RENDERERS
       ============================================================ */
    function renderAttenuation(ctx, w, h) {
      const narrow = w < 620;
      const pad = narrow ? 14 : 20;
      const att = calcAttenuation();

      // Top half: Fibre Attenuation + Bending Visualizer
      const topY = 38;
      const topH = h * 0.42;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillText('OPTICAL POWER DECAY & LOSS MECHANISMS ALONG FIBRE', pad, 22);

      const fx = pad + 10, fw = w - pad * 2 - 20;
      const fy = topY + topH * 0.42;
      const bendAmp = (state.macroBendDb / 10) * 24;

      // Draw fibre with optional macro-bend curve in the middle!
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const u = i / 80;
        const x = fx + u * fw;
        const bend = Math.sin(Math.max(0, (u - 0.35) / 0.3) * Math.PI) * (u > 0.35 && u < 0.65 ? bendAmp : 0);
        const micro = state.microBend ? Math.sin(u * 60) * 2.5 : 0;
        const y = fy + bend + micro;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(148,163,184,0.35)';
      ctx.lineWidth = 22;
      ctx.stroke();

      // Decaying light core inside fibre
      const steps = 48;
      for (let i = 0; i < steps; i++) {
        const u1 = i / steps, u2 = (i + 1) / steps;
        const frac = Math.pow(10, -(att.totalDb * u1) / 10);
        const b1 = u1 > 0.35 && u1 < 0.65 ? Math.sin(((u1 - 0.35) / 0.3) * Math.PI) * bendAmp : 0;
        const b2 = u2 > 0.35 && u2 < 0.65 ? Math.sin(((u2 - 0.35) / 0.3) * Math.PI) * bendAmp : 0;
        ctx.strokeStyle = `rgba(34,211,238,${(0.08 + 0.88 * frac).toFixed(2)})`;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(fx + u1 * fw, fy + b1);
        ctx.lineTo(fx + u2 * fw, fy + b2);
        ctx.stroke();
      }

      // Rayleigh scattering arrows (density scales with 1/lambda^4)
      const scatterDensity = Math.min(18, Math.round(att.relRayleigh * 6));
      const tAnim = C.prefersReducedMotion() ? 0 : state.time;
      for (let i = 0; i < scatterDensity; i++) {
        const u = ((i / scatterDensity + tAnim * 0.08) % 0.85) + 0.08;
        const sx = fx + u * fw;
        const bend = u > 0.35 && u < 0.65 ? Math.sin(((u - 0.35) / 0.3) * Math.PI) * bendAmp : 0;
        const dir = i % 2 === 0 ? -1 : 1;
        ctx.strokeStyle = 'rgba(96,165,250,0.65)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(sx, fy + bend);
        ctx.lineTo(sx + 8, fy + bend + dir * 20);
        ctx.stroke();
      }

      // Macro-bend leaked rays at bend apex
      if (state.macroBendDb > 1.2) {
        const bx = fx + 0.5 * fw, by = fy + bendAmp;
        ctx.strokeStyle = '#ff6b81';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(bx, by); ctx.lineTo(bx + 26, by + 26);
        ctx.moveTo(bx + 10, by); ctx.lineTo(bx + 36, by + 20);
        ctx.stroke();
        ctx.fillStyle = '#ff6b81';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Macro-bend ray leakage', bx + 16, by + 38);
      }

      // Pin & Pout markers
      ctx.fillStyle = '#22d3ee'; ctx.font = 'bold 10px JetBrains Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText(`P_in = ${att.Pin.toFixed(1)} mW`, fx, fy - 24);
      ctx.fillStyle = '#34d399'; ctx.textAlign = 'right';
      ctx.fillText(`P_out = ${att.Pout.toFixed(3)} mW (L = ${att.L.toFixed(1)} km)`, fx + fw, fy - 24);

      // Bottom half: Qualitative Wavelength vs Attenuation & Transmission Windows Plot
      const gx0 = pad + 42, gx1 = w - pad - 18;
      const gy0 = topY + topH + 18, gy1 = h - 34;
      if (gy1 - gy0 < 90) return;

      ctx.fillStyle = 'rgba(6,10,24,0.72)';
      ctx.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.strokeRect(gx0, gy0, gx1 - gx0, gy1 - gy0);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 10.5px Inter, sans-serif';
      ctx.fillText('QUALITATIVE ATTENUATION vs. WAVELENGTH (1/λ⁴ Rayleigh & Optical Windows)', gx0 + 8, gy0 - 6);

      const lamMin = 750, lamMax = 1700;
      const LX = (nm) => gx0 + ((nm - lamMin) / (lamMax - lamMin)) * (gx1 - gx0);

      // Shaded Optical Windows (no invented measured dB/km values!)
      const windows = [
        { nm: 850, w: 50, lbl: '1st Window (~850 nm)' },
        { nm: 1310, w: 60, lbl: '2nd (~1300 nm)' },
        { nm: 1550, w: 65, lbl: '3rd (~1550 nm)' },
      ];
      windows.forEach((win) => {
        const xL = LX(win.nm - win.w / 2), xR = LX(win.nm + win.w / 2);
        ctx.fillStyle = 'rgba(52,211,153,0.12)';
        ctx.fillRect(xL, gy0 + 4, xR - xL, gy1 - gy0 - 8);
        ctx.fillStyle = '#34d399';
        ctx.font = narrow ? '8px Inter, sans-serif' : '9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(narrow ? `~${win.nm}` : win.lbl, (xL + xR) / 2, gy0 + 16);
      });

      // Qualitative curve: Rayleigh (1/λ⁴) + OH⁻ absorption feature near ~1380 nm + IR rise > 1600 nm
      const qualLoss = (nm) => {
        const rayleigh = Math.pow(800 / nm, 4) * 0.72;
        const ohPeak = 0.34 * Math.exp(-Math.pow((nm - 1385) / 30, 2));
        const irTail = nm > 1580 ? 0.35 * Math.pow((nm - 1580) / 140, 2) : 0;
        return X.clamp(rayleigh + ohPeak + irTail, 0.03, 1.0);
      };

      // Dashed pure 1/lambda^4 Rayleigh reference curve
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const nm = lamMin + (i / 120) * (lamMax - lamMin);
        const yVal = X.clamp(Math.pow(800 / nm, 4) * 0.72, 0.02, 1.0);
        const px = LX(nm), py = gy1 - 10 - yVal * (gy1 - gy0 - 28);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = 'rgba(96,165,250,0.55)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.setLineDash([]);

      // Combined qualitative curve
      ctx.beginPath();
      for (let i = 0; i <= 160; i++) {
        const nm = lamMin + (i / 160) * (lamMax - lamMin);
        const px = LX(nm), py = gy1 - 10 - qualLoss(nm) * (gy1 - gy0 - 28);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // Current operating wavelength marker
      const curX = LX(state.lambdaNm);
      const curY = gy1 - 10 - qualLoss(state.lambdaNm) * (gy1 - gy0 - 28);
      ctx.strokeStyle = '#e0b553';
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(curX, gy0 + 4); ctx.lineTo(curX, gy1 - 4); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#e0b553';
      ctx.beginPath(); ctx.arc(curX, curY, 5, 0, 6.28); ctx.fill();

      // Axis ticks
      ctx.fillStyle = '#8f9cb5';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      [800, 1000, 1200, 1400, 1600].forEach((nm) => ctx.fillText(nm + ' nm', LX(nm), gy1 + 14));

      ctx.save();
      ctx.translate(gx0 - 16, (gy0 + gy1) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#8f9cb5';
      ctx.font = '9.5px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Relative Loss (qualitative)', 0, 0);
      ctx.restore();
    }

    function renderDispersion(ctx, w, h) {
      const narrow = w < 620;
      const pad = narrow ? 14 : 20;
      const disp = calcDispersion();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillText('PULSE BROADENING & INTERSYMBOL INTERFERENCE (TWO-PULSE TEST)', pad, 22);

      // Top animated fibre ray/chromatic spread visualization
      const fy = 42, fh = h * 0.32;
      const fx = pad, fw = w - pad * 2;
      ctx.fillStyle = 'rgba(6,10,24,0.72)';
      ctx.fillRect(fx, fy, fw, fh);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.strokeRect(fx, fy, fw, fh);

      // Core walls
      const coreMid = fy + fh * 0.52;
      const coreH = state.fibreMode === 'single' ? 18 : fh * 0.56;
      ctx.fillStyle = 'rgba(34,211,238,0.10)';
      ctx.fillRect(fx + 10, coreMid - coreH / 2, fw - 20, coreH);
      ctx.strokeStyle = 'rgba(34,211,238,0.45)';
      ctx.strokeRect(fx + 10, coreMid - coreH / 2, fw - 20, coreH);

      // Animated travelling pulse packet widening as it moves left -> right!
      const prog = C.prefersReducedMotion() ? 0.72 : ((state.time * 0.28) % 1);
      const px = fx + 24 + prog * (fw - 48);
      const spreadFrac = disp.spreadNs / 35;
      const packetW = 14 + prog * spreadFrac * 95;

      // Show fast vs slow components separating inside fibre
      const compCount = state.fibreMode === 'multimode' || state.dispMech === 'material' ? 3 : 1;
      const compCols = ['#22d3ee', '#34d399', '#ff6b81'];
      for (let k = 0; k < compCount; k++) {
        const lag = k * prog * spreadFrac * 36;
        const cx = Math.max(fx + 20, px - lag);
        const cy = coreMid + (compCount > 1 ? (k - 1) * (coreH * 0.26) : 0);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, packetW * 0.6);
        g.addColorStop(0, compCols[k]);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(cx, cy, packetW * 0.65, 8, 0, 0, 6.28);
        ctx.fill();
      }
      ctx.fillStyle = '#8f9cb5';
      ctx.font = '9.5px Inter, sans-serif';
      ctx.fillText(
        state.fibreMode === 'single'
          ? 'Single-Mode Core: only axial mode propagates (chromatic spread dominates if LED)'
          : 'Multimode Core: fast axial ray + delayed oblique rays spread out the pulse',
        fx + 12, fy + 16
      );

      // Bottom: Input vs Output Two-Pulse Comparison Plot (stacked on narrow viewports)
      const py0 = fy + fh + 22, py1 = h - 18;
      const drawPulseBox = (bx, by, bw, bh, title, sigma, isOut, ampScale) => {
        ctx.fillStyle = 'rgba(6,10,24,0.72)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = isOut && disp.isiOverlap ? 'rgba(224,140,58,0.65)' : 'rgba(255,255,255,0.14)';
        ctx.strokeRect(bx, by, bw, bh);

        ctx.fillStyle = '#edf1f8';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(title, bx + 10, by + 16);

        const tSpan = Math.max(50, disp.bitPeriodNs * 3.0);
        const t1 = tSpan * 0.36;
        const t2 = t1 + disp.bitPeriodNs;
        const baseLine = by + bh - 22;
        const plotTop = by + 28;
        const maxH = Math.max(18, baseLine - plotTop);

        const gauss = (t, mu, s) => Math.exp(-0.5 * Math.pow((t - mu) / s, 2));

        if (isOut) {
          [t1, t2].forEach((mu, idx) => {
            ctx.beginPath();
            for (let i = 0; i <= 120; i++) {
              const t = (i / 120) * tSpan;
              const yv = ampScale * gauss(t, mu, sigma);
              const xx = bx + 10 + (i / 120) * (bw - 20);
              const yy = baseLine - yv * maxH;
              if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
            }
            ctx.strokeStyle = idx === 0 ? 'rgba(34,211,238,0.45)' : 'rgba(224,181,83,0.45)';
            ctx.setLineDash([3, 3]);
            ctx.lineWidth = 1.4;
            ctx.stroke();
            ctx.setLineDash([]);
          });
        }

        ctx.beginPath();
        for (let i = 0; i <= 160; i++) {
          const t = (i / 160) * tSpan;
          const yv = Math.min(1.05, ampScale * (gauss(t, t1, sigma) + gauss(t, t2, sigma)));
          const xx = bx + 10 + (i / 160) * (bw - 20);
          const yy = baseLine - yv * maxH;
          if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
        }
        ctx.strokeStyle = isOut ? (disp.isiOverlap ? '#e08c3a' : '#d9669b') : '#22d3ee';
        ctx.lineWidth = 2.6;
        ctx.stroke();

        ctx.fillStyle = '#8f9cb5';
        ctx.font = (narrow ? '8.5px' : '9px') + ' JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`σ = ${sigma.toFixed(2)} ns · Bit spacing = ${disp.bitPeriodNs.toFixed(1)} ns`, bx + bw / 2, by + bh - 7);
      };

      const outAmp = Math.max(0.28, Math.sqrt(disp.sigmaIn / disp.sigmaOut));
      if (narrow) {
        const bh = (py1 - py0 - 12) / 2;
        drawPulseBox(fx, py0, fw, bh, 'INPUT PULSES (Sharp 1 0 1)', disp.sigmaIn, false, 0.92);
        drawPulseBox(
          fx, py0 + bh + 12, fw, bh,
          disp.isiOverlap ? 'OUTPUT PULSES (Overlapping!)' : 'OUTPUT PULSES (Broadened)',
          disp.sigmaOut, true, outAmp
        );
      } else {
        const pw = (fw - 22) / 2;
        const p1X = fx, p2X = fx + pw + 22;
        drawPulseBox(p1X, py0, pw, py1 - py0, 'INPUT PULSES (Sharp 1 0 1)', disp.sigmaIn, false, 0.92);
        drawPulseBox(
          p2X, py0, pw, py1 - py0,
          disp.isiOverlap ? 'OUTPUT PULSES (Overlapping!)' : 'OUTPUT PULSES (Broadened)',
          disp.sigmaOut, true, outAmp
        );
      }
    }

    function renderPipeline(ctx, w, h) {
      const narrow = w < 640;
      const pad = narrow ? 12 : 20;
      const att = calcAttenuation();
      const disp = calcDispersion();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#edf1f8';
      ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillText('COMPLETE OPTICAL FIBRE COMMUNICATION SYSTEM', pad, 22);

      // 7-Stage Pipeline Block Diagram (wraps into 2 rows on narrow viewports)
      const blocks = [
        { title: 'Message', sub: state.bitSeq.slice(0, 6) + (state.bitSeq.length > 6 ? '…' : ''), col: '#22d3ee' },
        { title: 'Modulator', sub: state.modulation === 'digital' ? 'OOK' : 'Analog', col: '#38bdf8' },
        { title: state.sourceType === 'laser' ? 'LASER' : 'LED', sub: 'E → O', col: '#34d399' },
        { title: 'Coupler', sub: 'Launch', col: '#8f9cb5' },
        { title: 'Optical Fibre', sub: `${state.lengthKm.toFixed(0)} km`, col: '#a5b4fc' },
        { title: 'Photodetector', sub: 'O → E', col: '#e0b553' },
        { title: 'Output', sub: 'Signal', col: '#d9669b' },
      ];

      const pipeY = 36;
      const sigProg = C.prefersReducedMotion() ? 0.5 : (state.time * 0.28) % 1;
      let wY0 = pipeY + 108;

      if (narrow) {
        const rowH = 44;
        const rowGap = 12;
        const gap = 8;
        const coords = [];
        // Row 1: 4 blocks, Row 2: 3 blocks
        const r1W = (w - pad * 2 - gap * 3) / 4;
        const r2W = (w - pad * 2 - gap * 2) / 3;
        blocks.forEach((b, idx) => {
          const row = idx < 4 ? 0 : 1;
          const colIdx = idx < 4 ? idx : idx - 4;
          const bw = row === 0 ? r1W : r2W;
          const bx = pad + colIdx * (bw + gap);
          const by = pipeY + row * (rowH + rowGap);
          coords.push({ x: bx + bw / 2, y: by + rowH / 2 });

          ctx.fillStyle = 'rgba(6,10,24,0.78)';
          ctx.fillRect(bx, by, bw, rowH);
          ctx.strokeStyle = b.col;
          ctx.lineWidth = 1.3;
          ctx.strokeRect(bx, by, bw, rowH);

          ctx.fillStyle = b.col;
          ctx.font = 'bold 8.5px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(b.title, bx + bw / 2, by + 18);
          ctx.fillStyle = '#8f9cb5';
          ctx.font = '8px JetBrains Mono, monospace';
          ctx.fillText(b.sub, bx + bw / 2, by + 33);

          if (idx < 3 || (idx >= 4 && idx < 6)) {
            ctx.strokeStyle = 'rgba(255,255,255,0.45)';
            ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(bx + bw, by + rowH / 2); ctx.lineTo(bx + bw + gap, by + rowH / 2); ctx.stroke();
          }
        });
        // Connector from Row 1 end -> Row 2 start
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(coords[3].x, pipeY + rowH);
        ctx.lineTo(coords[3].x, pipeY + rowH + rowGap / 2);
        ctx.lineTo(coords[4].x, pipeY + rowH + rowGap / 2);
        ctx.lineTo(coords[4].x, pipeY + rowH + rowGap);
        ctx.stroke();
        ctx.setLineDash([]);

        const sIdx = Math.min(5, Math.floor(sigProg * 6));
        const frac = sigProg * 6 - sIdx;
        const dx = X.lerp(coords[sIdx].x, coords[sIdx + 1].x, frac);
        const dy = X.lerp(coords[sIdx].y, coords[sIdx + 1].y, frac);
        ctx.fillStyle = (sIdx >= 2 && sIdx <= 4) ? '#ff5c7a' : '#22d3ee';
        ctx.beginPath(); ctx.arc(dx, dy, 4, 0, 6.28); ctx.fill();
        wY0 = pipeY + rowH * 2 + rowGap + 18;
      } else {
        const pipeH = 84;
        const gap = 8;
        const bw = (w - pad * 2 - gap * (blocks.length - 1)) / blocks.length;

        blocks.forEach((b, idx) => {
          const bx = pad + idx * (bw + gap);
          ctx.fillStyle = 'rgba(6,10,24,0.78)';
          ctx.fillRect(bx, pipeY, bw, pipeH);
          ctx.strokeStyle = b.col;
          ctx.lineWidth = 1.4;
          ctx.strokeRect(bx, pipeY, bw, pipeH);

          ctx.fillStyle = b.col;
          ctx.font = 'bold 9.5px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(b.title, bx + bw / 2, pipeY + pipeH * 0.44);
          ctx.fillStyle = '#8f9cb5';
          ctx.font = '8.5px JetBrains Mono, monospace';
          ctx.fillText(b.sub, bx + bw / 2, pipeY + pipeH * 0.72);

          if (idx < blocks.length - 1) {
            const ax1 = bx + bw, ax2 = ax1 + gap;
            ctx.strokeStyle = 'rgba(255,255,255,0.45)';
            ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(ax1, pipeY + pipeH / 2); ctx.lineTo(ax2, pipeY + pipeH / 2); ctx.stroke();
          }
        });

        const dotX = pad + sigProg * (w - pad * 2);
        const isOpticalZone = sigProg > 0.30 && sigProg < 0.72;
        ctx.fillStyle = isOpticalZone ? '#ff5c7a' : '#22d3ee';
        ctx.beginPath(); ctx.arc(dotX, pipeY + pipeH / 2, 4.5, 0, 6.28); ctx.fill();
        wY0 = pipeY + pipeH + 26;
      }

      // Bottom Waveforms: Input Electrical Signal vs Received Photodetector Signal
      const wH = (h - wY0 - 24) / 2 - 10;
      if (wH < 50) return;
      const gx = pad, gw = w - pad * 2;
      const bits = state.bitSeq.split('').map((c) => Number(c));
      const nBits = bits.length;

      // Helper to sample continuous input & smeared/attenuated output
      const powerGain = X.clamp(att.Pout / att.Pin, 0.04, 1.0);
      const spreadBits = X.clamp(disp.sigmaOut / 12, 0.08, 1.4);

      const drawTrace = (ty, label, isRx, col) => {
        ctx.fillStyle = 'rgba(6,10,24,0.72)';
        ctx.fillRect(gx, ty, gw, wH);
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.strokeRect(gx, ty, gw, wH);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#edf1f8';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.fillText(label, gx + 10, ty + 15);

        const base = ty + wH - 16;
        const amp = wH - 36;

        // Bit slot vertical gridlines
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        for (let b = 0; b <= nBits; b++) {
          const lx = gx + 12 + (b / nBits) * (gw - 24);
          ctx.beginPath(); ctx.moveTo(lx, ty + 20); ctx.lineTo(lx, base); ctx.stroke();
        }

        // Decision threshold on RX
        if (isRx && state.modulation === 'digital') {
          const threshY = base - amp * 0.28;
          ctx.strokeStyle = 'rgba(52,211,153,0.4)';
          ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(gx + 12, threshY); ctx.lineTo(gx + gw - 12, threshY); ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        const samples = 220;
        for (let i = 0; i <= samples; i++) {
          const u = (i / samples) * nBits;
          let yNorm = 0;
          if (state.modulation === 'digital') {
            if (!isRx) {
              const bi = Math.min(nBits - 1, Math.floor(u));
              yNorm = bits[bi];
            } else {
              // Sum broadened bit pulses + attenuation scaling
              for (let bi = 0; bi < nBits; bi++) {
                if (bits[bi] === 1) {
                  const center = bi + 0.5;
                  yNorm += Math.exp(-0.5 * Math.pow((u - center) / (0.28 + spreadBits * 0.45), 2));
                }
              }
              yNorm = Math.min(1.0, yNorm) * (0.25 + 0.75 * Math.sqrt(powerGain));
            }
          } else {
            // Analog intensity modulation
            const carrier = 0.5 + 0.44 * Math.sin(u * Math.PI * 1.6);
            yNorm = isRx ? carrier * (0.25 + 0.75 * Math.sqrt(powerGain)) * (1 / (1 + spreadBits * 0.35)) + (spreadBits * 0.12) : carrier;
          }
          const px = gx + 12 + (i / samples) * (gw - 24);
          const py = base - yNorm * amp;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.4;
        ctx.stroke();

        // Bit labels along top/bottom
        if (state.modulation === 'digital') {
          ctx.font = 'bold 9.5px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          for (let bi = 0; bi < nBits; bi++) {
            const bx = gx + 12 + ((bi + 0.5) / nBits) * (gw - 24);
            let val = bits[bi];
            let err = false;
            if (isRx) {
              let samp = 0;
              for (let j = 0; j < nBits; j++) {
                if (bits[j] === 1) samp += Math.exp(-0.5 * Math.pow((bi + 0.5 - (j + 0.5)) / (0.28 + spreadBits * 0.45), 2));
              }
              const rxLevel = Math.min(1.0, samp) * (0.25 + 0.75 * Math.sqrt(powerGain));
              val = rxLevel >= 0.28 ? 1 : 0;
              err = val !== bits[bi];
            }
            ctx.fillStyle = err ? '#ff5c7a' : col;
            ctx.fillText(String(val), bx, base + 12);
          }
        }
      };

      drawTrace(wY0, 'TRANSMITTED INPUT SIGNAL (Electrical → Optical)', false, '#22d3ee');
      drawTrace(wY0 + wH + 14, 'RECEIVED OUTPUT SIGNAL (Attenuated & Dispersed → Electrical)', true, '#e0b553');
    }

    function render() {
      if (!canvasObj) return;
      const { ctx, w, h } = canvasObj;
      ctx.clearRect(0, 0, w, h);
      if (state.tab === 'attenuation') renderAttenuation(ctx, w, h);
      else if (state.tab === 'dispersion') renderDispersion(ctx, w, h);
      else renderPipeline(ctx, w, h);
    }

    return {
      mount() {
        buildDOM();
        canvasObj = X.setupCanvas(document.getElementById('cv-c2t7'));
        updateReadouts();
        updateBanner();
        render();
      },
      unmount() {},
      tick(dt) {
        if (state.playing) state.time += dt;
        render();
      },
      resize() {
        const cv = document.getElementById('cv-c2t7');
        if (cv) canvasObj = X.setupCanvas(cv);
        render();
      },
      applyPreset(preset) {
        if (preset === 'dispersion') state.tab = 'dispersion';
        else if (preset === 'pipeline') state.tab = 'pipeline';
        else state.tab = 'attenuation';
        if (subtabBar) subtabBar.set(state.tab);
        syncTabControls();
        updateReadouts();
        updateBanner();
      },
      getState: () => state,
    };
  };
})();
