(function () {
  'use strict';

  const C = window.Ch5Platform;
  const X = window.XLab;

  window.CH5_SIMS['c5t5'] = function createSuperconductivityLab(ctxDom) {
    const { stage, controls, formula, wrap, dot } = ctxDom;

    const state = {
      subtab: 'transition', // transition|persistent|meissner|critical|isotope
      T: 15,          // temperature (K)
      Tc: 10,          // critical temperature (K, illustrative, adjustable)
      Rn: 10,          // normal resistance (ohm, illustrative)
      H: 0.05,          // applied field (T)
      Hc0: 1.0,        // critical field at 0K (T, illustrative)
      type: 'II',      // 'I' | 'II'
      M: 100,          // isotope mass (arb. units)
      alpha: 0.5,      // isotope exponent
      Tcomp: 50,       // comparison temperature (K)
      showField: true,
      playing: true,
      time: 0,
      ringTime: 0,     // persistent-current clock
      I0: 10,          // initial ring current (A, illustrative)
    };

    let built = false;
    let canvasObj = null;
    let ui = {};
    let banner = null;
    let subtabBar = null;

    /* ---------- Physics ---------- */
    function resistance(T, Tc, Rn) {
      // Ideal: Rn above Tc, 0 below; smooth width for visualization
      return T <= Tc ? 0 : Rn;
    }
    function isSC(T, Tc) { return T <= Tc; }
    function Hc(T, Tc, Hc0) {
      if (T >= Tc) return 0;
      return Hc0 * (1 - Math.pow(T / Tc, 2));
    }
    function criticalState(T, Tc, H, Hc0, type) {
      const hc = Hc(T, Tc, Hc0);
      if (hc <= 0) return 'normal';
      if (type === 'I') return H < hc ? 'meissner' : 'normal';
      // Type II: Hc1 = 0.2*Hc, Hc2 = Hc (illustrative ratio)
      const hc1 = 0.2 * hc, hc2 = hc;
      if (H < hc1) return 'meissner';
      if (H < hc2) return 'mixed';
      return 'normal';
    }
    function isotopeTc(M, alpha, Tc0, M0) {
      return Tc0 * Math.pow(M0 / Math.max(M, 1), alpha);
    }
    function ringCurrents(t, I0, tau) {
      return { normal: I0 * Math.exp(-t / tau), sc: I0 };
    }

    function resetSimulation() {
      state.subtab = 'transition';
      state.T = 15; state.Tc = 10; state.H = 0.05; state.Hc0 = 1.0;
      state.type = 'II'; state.M = 100; state.alpha = 0.5; state.Tcomp = 50;
      state.ringTime = 0; state.time = 0;
      if (subtabBar) subtabBar.set('transition');
      if (ui.tSlider) ui.tSlider.setValue(15);
      if (ui.tcSlider) ui.tcSlider.setValue(10);
      if (ui.hSlider) ui.hSlider.setValue(0.05);
      if (ui.hc0Slider) ui.hc0Slider.setValue(1.0);
      if (ui.typeSeg) ui.typeSeg.set('II');
      if (ui.mSlider) ui.mSlider.setValue(100);
      if (ui.alphaSlider) ui.alphaSlider.setValue(0.5);
      if (ui.tcompSlider) ui.tcompSlider.setValue(50);
      syncControlVisibility();
      updateReadouts(); updateBanner(); render();
    }

    function syncControlVisibility() {
      const st = state.subtab;
      const setVis = (el, vis) => { if (el) el.style.display = vis ? 'flex' : 'none'; };
      // T slider used in transition/meissner/critical; comparison uses Tcomp
      setVis(ui.tWrap, st === 'transition' || st === 'meissner' || st === 'critical');
      setVis(ui.tcWrap, st === 'transition' || st === 'meissner' || st === 'critical');
      setVis(ui.hWrap, st === 'meissner' || st === 'critical');
      setVis(ui.hc0Wrap, st === 'critical');
      setVis(ui.typeWrap, st === 'critical');
      setVis(ui.mWrap, st === 'isotope');
      setVis(ui.alphaWrap, st === 'isotope');
      setVis(ui.tcompWrap, st === 'isotope');
      setVis(ui.fieldWrap, st === 'meissner' || st === 'critical');
      setVis(ui.ringWrap, st === 'persistent');
    }

    function buildDOM() {
      if (built) return;
      built = true;
      stage.innerHTML = ''; controls.innerHTML = ''; formula.innerHTML = '';

      const cv = X.el('canvas', 'viz');
      cv.id = 'cv-c5t5';
      cv.setAttribute('aria-label', 'Superconductivity and Meissner Effect Laboratory');
      stage.append(cv);
      canvasObj = X.setupCanvas(cv);

      subtabBar = C.buildSubtabs(wrap, [
        { id: 'transition', label: 'A. R–T Transition' },
        { id: 'persistent', label: 'B. Persistent Current' },
        { id: 'meissner', label: 'C. Meissner & Levitation' },
        { id: 'critical', label: 'D. Critical Field' },
        { id: 'isotope', label: 'E. Isotope & Comparison' },
      ], state.subtab, (id) => {
        state.subtab = id;
        if (id === 'persistent') state.ringTime = 0;
        syncControlVisibility();
        updateReadouts(); updateBanner(); render();
      });

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

      ui.tSlider = X.buildSlider(controls, {
        label: 'Temperature T', id: 'c5t5-T', min: 0, max: 30, step: 0.5, value: state.T,
        format: (v) => v.toFixed(1) + ' K',
        onInput: (v) => { state.T = v; updateReadouts(); updateBanner(); render(); },
      });
      ui.tWrap = ui.tSlider.input.closest('.slider-block');

      ui.tcSlider = X.buildSlider(controls, {
        label: 'Critical Temperature Tc (illustrative)', id: 'c5t5-Tc', min: 2, max: 30, step: 0.5, value: state.Tc,
        format: (v) => v.toFixed(1) + ' K',
        onInput: (v) => { state.Tc = v; updateReadouts(); updateBanner(); render(); },
      });
      ui.tcWrap = ui.tcSlider.input.closest('.slider-block');

      ui.hSlider = X.buildSlider(controls, {
        label: 'Applied field μ₀H', id: 'c5t5-H', min: 0, max: 2, step: 0.05, value: state.H,
        format: (v) => v.toFixed(2) + ' T',
        onInput: (v) => { state.H = v; updateReadouts(); updateBanner(); render(); },
      });
      ui.hWrap = ui.hSlider.input.closest('.slider-block');

      ui.hc0Slider = X.buildSlider(controls, {
        label: 'μ₀Hc(0) (illustrative)', id: 'c5t5-Hc0', min: 0.2, max: 2, step: 0.05, value: state.Hc0,
        format: (v) => v.toFixed(2) + ' T',
        onInput: (v) => { state.Hc0 = v; updateReadouts(); updateBanner(); render(); },
      });
      ui.hc0Wrap = ui.hc0Slider.input.closest('.slider-block');

      ui.typeSeg = X.buildSegmented(controls, {
        options: [
          { value: 'I', label: 'Type I' },
          { value: 'II', label: 'Type II' },
        ],
        value: state.type,
        onChange: (v) => { state.type = v; updateReadouts(); updateBanner(); render(); },
      });
      ui.typeWrap = ui.typeSeg ? controls.querySelectorAll('.segmented')[0] : null;
      // wrap segmented in a div for visibility toggling
      if (ui.typeSeg) {
        const segEl = ui.typeSeg.set ? null : null;
      }

      ui.mSlider = X.buildSlider(controls, {
        label: 'Isotopic Mass M (arb.)', id: 'c5t5-M', min: 20, max: 300, step: 1, value: state.M,
        format: (v) => v.toFixed(0),
        onInput: (v) => { state.M = v; updateReadouts(); updateBanner(); render(); },
      });
      ui.mWrap = ui.mSlider.input.closest('.slider-block');

      ui.alphaSlider = X.buildSlider(controls, {
        label: 'Isotope Exponent α', id: 'c5t5-alpha', min: 0, max: 1, step: 0.05, value: state.alpha,
        format: (v) => v.toFixed(2),
        onInput: (v) => { state.alpha = v; updateReadouts(); updateBanner(); render(); },
      });
      ui.alphaWrap = ui.alphaSlider.input.closest('.slider-block');

      ui.tcompSlider = X.buildSlider(controls, {
        label: 'Comparison Temperature', id: 'c5t5-Tcomp', min: 0, max: 120, step: 1, value: state.Tcomp,
        format: (v) => v.toFixed(0) + ' K',
        onInput: (v) => { state.Tcomp = v; updateReadouts(); updateBanner(); render(); },
      });
      ui.tcompWrap = ui.tcompSlider.input.closest('.slider-block');

      ui.fieldToggle = X.buildToggle(controls, {
        label: 'Show magnetic field lines',
        checked: state.showField,
        onChange: (on) => { state.showField = on; render(); },
      });
      ui.fieldWrap = ui.fieldToggle.closest('.toggle-row');

      ui.ringBtn = C.buildActionRow(controls, [
        { id: 'restart', label: 'Restart rings', primary: true, onClick: () => { state.ringTime = 0; render(); } },
      ]);
      ui.ringWrap = ui.ringBtn.restart ? ui.ringBtn.restart.closest('.transport-row') : null;

      ui.readouts = X.buildReadouts(controls, [
        { id: 'T', label: 'Temperature T', primary: true },
        { id: 'Tc', label: 'Critical Tc' },
        { id: 'R', label: 'Resistance R' },
        { id: 'state', label: 'State', wide: true },
        { id: 'H', label: 'Applied μ₀H' },
        { id: 'Hc', label: 'μ₀Hc / μ₀Hc2' },
      ]);

      controls.append(X.el('div', 'ctrl-note',
        '<b>Ideal model:</b> R = 0 below Tc, persistent current, Meissner expulsion. Practical devices have joints, flux motion and measurement limits — the lab labels the ideal case. Tc/Hc values are illustrative teaching parameters.'
      ));

      syncControlVisibility();
    }

    function updateReadouts() {
      if (!ui.readouts) return;
      const R = resistance(state.T, state.Tc, state.Rn);
      const sc = isSC(state.T, state.Tc);
      ui.readouts.set('T', state.T.toFixed(1) + ' K');
      ui.readouts.set('Tc', state.Tc.toFixed(1) + ' K');
      ui.readouts.set('R', R < 0.01 ? '0 Ω (ideal)' : R.toFixed(2) + ' Ω');
      let st = '';
      if (state.subtab === 'critical') {
        const cs = criticalState(state.T, state.Tc, state.H, state.Hc0, state.type);
        st = cs === 'meissner' ? 'Meissner (SC, flux expelled)' : cs === 'mixed' ? 'Mixed / vortex state (Type II)' : 'Normal (SC destroyed)';
      } else if (state.subtab === 'meissner') {
        const cs = criticalState(state.T, state.Tc, state.H, state.Hc0, state.type);
        st = cs === 'meissner' ? 'Meissner state (bulk flux expelled)' : cs === 'mixed' ? 'Mixed state (vortices)' : 'Normal (field penetrates)';
      } else if (state.subtab === 'persistent') {
        const rc = ringCurrents(state.ringTime, state.I0, 4);
        st = 'Normal ring I = ' + rc.normal.toFixed(2) + ' A · SC ring I = ' + rc.sc.toFixed(1) + ' A (persistent)';
      } else if (state.subtab === 'isotope') {
        const TcI = isotopeTc(state.M, state.alpha, 10, 100);
        st = 'Tc(M) = ' + TcI.toFixed(2) + ' K · Low-Tc (10 K) ' + (state.Tcomp < 10 ? 'SC' : 'normal') + ' · High-Tc (90 K) ' + (state.Tcomp < 90 ? 'SC' : 'normal');
      } else {
        st = sc ? 'Superconducting (R = 0 ideal)' : 'Normal conducting (finite R)';
      }
      ui.readouts.set('state', st);
      ui.readouts.set('H', state.H.toFixed(2) + ' T');
      ui.readouts.set('Hc', Hc(state.T, state.Tc, state.Hc0).toFixed(2) + ' T');
      formula.innerHTML =
        `<span class="formula active">R = <span class="fv">${R < 0.01 ? '0' : R.toFixed(2)} Ω</span> (${sc ? 'T ≤ Tc' : 'T > Tc'})</span>` +
        `<span class="formula">Hc(T) = Hc(0)[1 − (T/Tc)²]</span>` +
        `<span class="formula">Tc ∝ M<sup>−α</sup></span>`;
    }

    function updateBanner() {
      if (!banner) return;
      const sc = isSC(state.T, state.Tc);
      if (state.subtab === 'transition') {
        banner.set(sc ? 'SUPERCONDUCTING · T ≤ Tc' : 'NORMAL · T > Tc', sc ? 'ok' : 'warn',
          sc ? `Cooled below <b>Tc = ${state.Tc.toFixed(1)} K</b>: resistance falls to <b>zero (ideal)</b>. Current flows without dissipation.`
             : `Above <b>Tc = ${state.Tc.toFixed(1)} K</b>: normal metal with finite resistance <b>R ≈ ${state.Rn} Ω</b>. Cool through Tc to see the transition.`);
      } else if (state.subtab === 'persistent') {
        banner.set('PERSISTENT CURRENT · IDEAL', 'ok', 'Normal ring current <b>decays</b> (I = I₀e<sup>−Rt/L</sup>); superconducting ring current <b>persists</b> with no applied voltage. Ideal model — real loops have joints and flux creep.');
      } else if (state.subtab === 'meissner') {
        const fieldState = criticalState(state.T, state.Tc, state.H, state.Hc0, state.type);
        if (fieldState === 'mixed') { banner.set('TYPE II · MIXED STATE', '', 'Field exceeds Hc1: flux enters as vortices, so complete Meissner expulsion is not present. Lower the field to enter the Meissner state.'); return; }
        const meissner = fieldState === 'meissner';
        banner.set(meissner ? 'MEISSNER STATE · FLUX EXPELLED' : 'NORMAL · FLUX PENETRATES', meissner ? 'ok' : 'warn',
          meissner ? 'Cooled below Tc in a field: flux is <b>expelled</b> from the bulk (Meissner). A magnet above the sample <b>levitates</b>. This is expulsion, distinct from flux pinning.'
             : 'The field penetrates: temperature or field exceeds the relevant superconducting boundary. Cool or lower the field to reach the Meissner state.');
      } else if (state.subtab === 'critical') {
        const cs = criticalState(state.T, state.Tc, state.H, state.Hc0, state.type);
        if (state.type === 'I') {
          banner.set(cs === 'meissner' ? 'TYPE I · MEISSNER' : 'TYPE I · NORMAL', cs === 'meissner' ? 'ok' : 'warn',
            cs === 'meissner' ? `H &lt; Hc(T): single-boundary <b>Meissner</b> state.` : `H &gt; Hc(T): superconductivity destroyed — <b>normal</b> state. Type I has one critical field.`);
        } else {
          banner.set(cs === 'meissner' ? 'TYPE II · MEISSNER' : cs === 'mixed' ? 'TYPE II · MIXED STATE' : 'TYPE II · NORMAL', cs === 'normal' ? 'warn' : 'ok',
            cs === 'meissner' ? `H &lt; Hc1: <b>Meissner</b> (flux expelled).` : cs === 'mixed' ? `Hc1 &lt; H &lt; Hc2: <b>mixed/vortex</b> state — flux enters as quantized vortices.` : `H &gt; Hc2: <b>normal</b> state.`);
        }
      } else {
        const TcI = isotopeTc(state.M, state.alpha, 10, 100);
        banner.set('ISOTOPE EFFECT · Tc ∝ M^(−α)', '', `M = ${state.M}, α = ${state.alpha.toFixed(2)} → <b>Tc = ${TcI.toFixed(2)} K</b> (conventional model, Tc₀ = 10 K at M₀ = 100). Not universally exact.`);
      }
    }

    /* ---------- Render helpers ---------- */
    function drawAxes(ctx, ax, ay, aw, ah, xLabel, yLabel) {
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax, ay + ah); ctx.lineTo(ax + aw, ay + ah); ctx.stroke();
      ctx.fillStyle = '#8f9cb5'; ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'left'; ctx.fillText(yLabel, ax, ay - 4);
      ctx.textAlign = 'center'; ctx.fillText(xLabel, ax + aw / 2, ay + ah + 13);
      ctx.textAlign = 'left';
    }

    function renderTransition(ctx, w, h, pad) {
      const R = resistance(state.T, state.Tc, state.Rn);
      const sc = isSC(state.T, state.Tc);
      ctx.fillStyle = '#edf1f8'; ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillText('Resistance vs temperature — cool through Tc', pad, 18);
      // Sample bar
      const sy = 30, sh = 54;
      ctx.fillStyle = sc ? 'rgba(52,211,153,0.18)' : 'rgba(224,140,58,0.15)';
      ctx.strokeStyle = sc ? '#34d399' : '#e08c3a'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.roundRect(pad + 8, sy, w - 2 * pad - 16, sh, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#edf1f8'; ctx.font = 'bold 11px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(sc ? 'SUPERCONDUCTING — R = 0 (ideal)' : 'NORMAL — finite R', w / 2, sy + sh / 2 + 4);
      ctx.textAlign = 'left';
      // Current dots: smooth flow if SC, jitter if normal
      const t = state.time;
      for (let i = 0; i < 18; i++) {
        const x = pad + 20 + (w - 2 * pad - 40) * ((i / 18 + t * 0.08) % 1);
        const y = sy + sh / 2 + (sc ? 0 : Math.sin(t * 6 + i) * 8);
        ctx.fillStyle = sc ? '#34d399' : '#e08c3a';
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      }
      // R-T graph
      const gy = sy + sh + 14, gh = h - gy - 10;
      const ax = pad + 44, ay = gy + 14, aw = w - ax - pad - 8, ah = gh - 28;
      drawAxes(ctx, ax, ay, aw, ah, 'T (K) →', 'R (Ω)');
      const Xg = (Tv) => ax + aw * (Tv / 30);
      const Yg = (Rv) => ay + ah - ah * (Rv / (state.Rn * 1.1));
      ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const Tv = (i / 120) * 30;
        const Rv = resistance(Tv, state.Tc, state.Rn);
        const px = Xg(Tv), py = Yg(Rv);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      // Tc marker
      ctx.strokeStyle = '#e0b553'; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(Xg(state.Tc), ay); ctx.lineTo(Xg(state.Tc), ay + ah); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#e0b553'; ctx.font = '10px JetBrains Mono, monospace'; ctx.textAlign = 'center';
      ctx.fillText('Tc = ' + state.Tc.toFixed(1) + ' K', Xg(state.Tc), ay + ah + 13);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(Xg(state.T), Yg(R), 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#edf1f8'; ctx.textAlign = 'left';
      ctx.fillText('T = ' + state.T.toFixed(1) + ' K, R = ' + (R < 0.01 ? '0' : R.toFixed(2)) + ' Ω', Xg(state.T) + 8, Yg(R) - 7);
    }

    function renderPersistent(ctx, w, h, pad) {
      ctx.fillStyle = '#edf1f8'; ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillText('Persistent current — normal ring vs superconducting ring', pad, 18);
      const rc = ringCurrents(state.ringTime, state.I0, 4);
      const topH = h * 0.52;
      const drawRing = (cx, cy, r, I, label, col, sc) => {
        ctx.strokeStyle = col; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        // current arrows around ring (density ∝ I)
        const n = Math.max(2, Math.round(10 * (I / state.I0)));
        const t = state.time;
        for (let i = 0; i < n; i++) {
          const ang = t * (sc ? 2 : 2 * (I / state.I0)) + (i / n) * Math.PI * 2;
          const x = cx + r * Math.cos(ang), y = cy + r * Math.sin(ang);
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#edf1f8'; ctx.font = 'bold 11px Inter, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(label, cx, cy + 4);
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText('I = ' + I.toFixed(2) + ' A', cx, cy + r + 16);
        ctx.textAlign = 'left';
      };
      const cx1 = w * 0.28, cx2 = w * 0.72, cy = 40 + topH / 2, r = Math.min(70, topH / 2 - 20);
      drawRing(cx1, cy, r, rc.normal, 'Normal ring (R > 0)', '#e08c3a', false);
      drawRing(cx2, cy, r, rc.sc, 'SC ring (R = 0 ideal)', '#34d399', true);
      ctx.fillStyle = '#8f9cb5'; ctx.font = '10px Inter, sans-serif';
      ctx.fillText('Normal: I(t) = I₀·exp(−Rt/L) decays · SC: I persists (no applied voltage, ideal)', pad, cy + r + 34);
      // I-t graph
      const gy = topH + 16, gh = h - gy - 10;
      const ax = pad + 44, ay = gy + 14, aw = w - ax - pad - 8, ah = gh - 28;
      drawAxes(ctx, ax, ay, aw, ah, 't (s) →', 'I (A)');
      const Xg = (tv) => ax + aw * (tv / 15);
      const Yg = (Iv) => ay + ah - ah * (Iv / (state.I0 * 1.1));
      ctx.strokeStyle = '#e08c3a'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 100; i++) { const tv = (i / 100) * 15; const Iv = state.I0 * Math.exp(-tv / 4); const px = Xg(tv), py = Yg(Iv); if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      ctx.stroke();
      ctx.strokeStyle = '#34d399';
      ctx.beginPath(); ctx.moveTo(Xg(0), Yg(state.I0)); ctx.lineTo(Xg(15), Yg(state.I0)); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(Xg(Math.min(state.ringTime, 15)), Yg(rc.normal), 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(Xg(Math.min(state.ringTime, 15)), Yg(rc.sc), 4, 0, Math.PI * 2); ctx.fill();
    }

    function renderMeissner(ctx, w, h, pad) {
      const fieldState = criticalState(state.T, state.Tc, state.H, state.Hc0, state.type);
      const sc = fieldState === 'meissner';
      ctx.fillStyle = '#edf1f8'; ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillText('Meissner effect — field expulsion & magnetic levitation', pad, 18);
      const cy = h * 0.42;
      // Sample (superconductor disc)
      const sx = w / 2 - 110, sw = 220, sy = cy + 30, sh = 36;
      ctx.fillStyle = sc ? 'rgba(52,211,153,0.20)' : 'rgba(255,255,255,0.08)';
      ctx.strokeStyle = sc ? '#34d399' : 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.roundRect(sx, sy, sw, sh, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#edf1f8'; ctx.font = 'bold 10.5px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(sc ? 'MEISSNER STATE' : fieldState === 'mixed' ? 'TYPE II: MIXED / VORTEX STATE' : 'NORMAL SAMPLE', w / 2, sy + sh / 2 + 4);
      ctx.textAlign = 'left';
      // Magnet above (levitates if SC)
      const magY = sc ? cy - 70 : cy - 20;
      const magW = 110, magH = 26;
      ctx.fillStyle = '#d9669b';
      ctx.beginPath(); ctx.roundRect(w / 2 - magW / 2, magY, magW, magH, 5); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 10px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('MAGNET (N)', w / 2, magY + magH / 2 + 4);
      ctx.textAlign = 'left';
      // Field lines: penetrate if normal, bend around if SC
      if (state.showField) {
        ctx.strokeStyle = 'rgba(34,211,238,0.55)'; ctx.lineWidth = 1.4;
        for (let i = -2; i <= 2; i++) {
          const x0 = w / 2 + i * 38;
          ctx.beginPath();
          ctx.moveTo(x0, 36);
          if (sc) {
            // bend around sample
            const side = i < 0 ? -1 : 1;
            const outside = w / 2 + side * (sw / 2 + 12 + Math.abs(i) * 12);
            ctx.quadraticCurveTo(outside, cy - 10, outside, sy - 4);
            ctx.lineTo(outside, sy + sh + 26);
          } else {
            ctx.lineTo(x0, sy + sh + 26);
          }
          ctx.stroke();
        }
        ctx.fillStyle = '#22d3ee'; ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText('B field lines', pad + 8, 40);
      }
      ctx.fillStyle = '#8f9cb5'; ctx.font = '10px Inter, sans-serif';
      ctx.fillText(sc ? 'Meissner: B ≈ 0 inside bulk — magnet levitates (repulsion).' : fieldState === 'mixed' ? 'Mixed state: flux penetrates as vortices; pinning is distinct from expulsion.' : 'Normal: field penetrates — no Meissner levitation.', pad, sy + sh + 44);
      // T indicator
      ctx.fillStyle = '#edf1f8'; ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText('T = ' + state.T.toFixed(1) + ' K · Tc = ' + state.Tc.toFixed(1) + ' K · H = ' + state.H.toFixed(2) + ' T', pad, h - 14);
    }

    function renderCritical(ctx, w, h, pad) {
      ctx.fillStyle = '#edf1f8'; ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillText('Critical-field phase diagram — Type ' + state.type + ' (H vs T)', pad, 18);
      const ax = pad + 48, ay = 36, aw = w - ax - pad - 10, ah = h - ay - 40;
      drawAxes(ctx, ax, ay, aw, ah, 'T (K) →', 'μ₀H (T)');
      const Xg = (Tv) => ax + aw * (Tv / 30);
      const Yg = (Hv) => ay + ah - ah * (Hv / 2);
      // Regions: draw Hc(T) curve; for Type II also Hc1
      const drawHc = (scale, col) => {
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= 100; i++) {
          const Tv = (i / 100) * 30;
          const Hv = Hc(Tv, state.Tc, state.Hc0) * scale;
          const px = Xg(Tv), py = Yg(Hv);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      };
      if (state.type === 'I') {
        drawHc(1, '#34d399');
        ctx.fillStyle = '#34d399'; ctx.font = '10px Inter, sans-serif';
        ctx.fillText('Hc(T) — single boundary', ax + 8, ay + 14);
        ctx.fillText('Meissner (below)', ax + 8, ay + ah - 8);
        ctx.fillText('Normal (above)', ax + aw - 90, ay + 14);
      } else {
        drawHc(0.2, '#e0b553');
        drawHc(1, '#34d399');
        ctx.fillStyle = '#e0b553'; ctx.font = '10px Inter, sans-serif';
        ctx.fillText('Hc1(T)', ax + 8, ay + 14);
        ctx.fillStyle = '#34d399';
        ctx.fillText('Hc2(T)', ax + 8, ay + 28);
        ctx.fillStyle = '#8f9cb5';
        ctx.fillText('Meissner | Mixed/vortex | Normal', ax + 8, ay + ah - 8);
      }
      // Operating point
      const cs = criticalState(state.T, state.Tc, state.H, state.Hc0, state.type);
      ctx.fillStyle = cs === 'normal' ? '#e08c3a' : '#ffffff';
      ctx.beginPath(); ctx.arc(Xg(state.T), Yg(state.H), 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(Xg(state.T), Yg(state.H), 9, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#edf1f8'; ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText('T=' + state.T.toFixed(1) + 'K, H=' + state.H.toFixed(2) + 'T → ' + cs, Xg(state.T) + 12, Yg(state.H) - 8);
    }

    function renderIsotope(ctx, w, h, pad) {
      ctx.fillStyle = '#edf1f8'; ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillText('Isotope effect Tc ∝ M^(−α) & low-Tc / high-Tc comparison (illustrative)', pad, 18);
      const TcI = isotopeTc(state.M, state.alpha, 10, 100);
      // Tc vs M graph (top)
      const ax = pad + 48, ay = 36, aw = w - ax - pad - 10, ah = h * 0.42;
      drawAxes(ctx, ax, ay, aw, ah, 'Isotopic mass M →', 'Tc (K)');
      const Xg = (Mv) => ax + aw * ((Mv - 20) / 280);
      const Yg = (Tv) => ay + ah - ah * (Tv / 16);
      ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 100; i++) {
        const Mv = 20 + (i / 100) * 280;
        const Tv = isotopeTc(Mv, state.alpha, 10, 100);
        const px = Xg(Mv), py = Yg(Tv);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(Xg(state.M), Yg(TcI), 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#edf1f8'; ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText('M=' + state.M + ', Tc=' + TcI.toFixed(2) + ' K', Xg(state.M) + 8, Yg(TcI) - 7);
      // Comparison panel (bottom)
      const by = ay + ah + 26;
      const lowSC = state.Tcomp < 10, highSC = state.Tcomp < 90;
      const drawCard = (x, title, tc, sc, col) => {
        const cw = (w - 2 * pad - 24) / 2;
        ctx.fillStyle = sc ? 'rgba(52,211,153,0.10)' : 'rgba(255,255,255,0.04)';
        ctx.strokeStyle = col; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.roundRect(x, by, cw, 64, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#edf1f8'; ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText(title + ' (illustrative Tc ≈ ' + tc + ' K)', x + 10, by + 18);
        ctx.font = '10px Inter, sans-serif';
        ctx.fillText(sc ? '✓ Superconducting at ' + state.Tcomp + ' K' : '✗ Normal at ' + state.Tcomp + ' K', x + 10, by + 36);
        ctx.fillStyle = '#8f9cb5';
        ctx.fillText(title === 'Low-Tc class' ? 'Needs liquid-He temperatures' : 'Can operate above liquid-N₂ temperature', x + 10, by + 52);
      };
      drawCard(pad + 8, 'Low-Tc class', 10, lowSC, '#22d3ee');
      drawCard(pad + 8 + (w - 2 * pad - 24) / 2 + 8, 'High-Tc class', 90, highSC, '#34d399');
      ctx.fillStyle = '#8f9cb5'; ctx.font = '10px Inter, sans-serif';
      ctx.fillText('Qualitative classes only — no invented material performance data. Move Comparison Temperature to test.', pad, by + 80);
    }

    function render() {
      if (!canvasObj) return;
      const { ctx, w, h } = canvasObj;
      ctx.clearRect(0, 0, w, h);
      const pad = w < 620 ? 12 : 20;
      if (state.subtab === 'transition') renderTransition(ctx, w, h, pad);
      else if (state.subtab === 'persistent') renderPersistent(ctx, w, h, pad);
      else if (state.subtab === 'meissner') renderMeissner(ctx, w, h, pad);
      else if (state.subtab === 'critical') renderCritical(ctx, w, h, pad);
      else renderIsotope(ctx, w, h, pad);
    }

    function applyPreset(preset) {
      if (preset === 'transition') { state.subtab = 'transition'; state.T = 15; state.Tc = 10; }
      else if (preset === 'persistent') { state.subtab = 'persistent'; state.ringTime = 0; }
      else if (preset === 'meissner') { state.subtab = 'meissner'; state.T = 5; state.Tc = 10; state.H = 0.05; }
      else if (preset === 'critical-type1') { state.subtab = 'critical'; state.type = 'I'; state.T = 5; state.H = 0.3; }
      else if (preset === 'critical-type2') { state.subtab = 'critical'; state.type = 'II'; state.T = 5; state.H = 0.5; }
      else if (preset === 'isotope') { state.subtab = 'isotope'; state.M = 100; state.alpha = 0.5; }
      else if (preset === 'comparison') { state.subtab = 'isotope'; state.Tcomp = 50; }
      else return;
      if (subtabBar) subtabBar.set(state.subtab);
      if (ui.tSlider) ui.tSlider.setValue(state.T);
      if (ui.tcSlider) ui.tcSlider.setValue(state.Tc);
      if (ui.hSlider) ui.hSlider.setValue(state.H);
      if (ui.typeSeg) ui.typeSeg.set(state.type);
      if (ui.mSlider) ui.mSlider.setValue(state.M);
      if (ui.alphaSlider) ui.alphaSlider.setValue(state.alpha);
      if (ui.tcompSlider) ui.tcompSlider.setValue(state.Tcomp);
      syncControlVisibility();
      updateReadouts(); updateBanner(); render();
    }

    return {
      mount() {
        buildDOM();
        canvasObj = X.setupCanvas(document.getElementById('cv-c5t5'));
        updateReadouts(); updateBanner(); render();
      },
      unmount() {},
      tick(dt) {
        if (state.playing) {
          if (!C.prefersReducedMotion()) state.time += dt;
          if (state.subtab === 'persistent') state.ringTime += dt;
          updateReadouts();
        }
        render();
      },
      resize() {
        const cv = document.getElementById('cv-c5t5');
        if (cv) canvasObj = X.setupCanvas(cv);
        render();
      },
      applyPreset,
      resistance, isSC, Hc, criticalState, isotopeTc, ringCurrents,
      getState: () => state,
    };
  };
})();
