(function () {
  'use strict';
  const M = window.NanoModels, NS = 'http://www.w3.org/2000/svg';
  const notes = [
    'For a sphere, A = 4πr², V = 4πr³/3 and A/V = 3/r. Splitting an ideal fixed volume into equal spheres increases total surface area in inverse proportion to their radius. The surface-atom estimate assumes a 0.3 nm surface layer and is illustrative; real particles may be irregular or agglomerated and not all surface is necessarily accessible.',
    'The 1D infinite well gives Eₙ = n²h²/(8m*L²) with ψₙ(x) = √(2/L)·sin(nπx/L). It is not a three-dimensional quantum-dot prediction. Confinement matters when dimensions approach carrier length scales such as the exciton Bohr radius (illustrative 5 nm here). The separate illustrative gap model is not a fit to a real material.',
    'Optics: a qualitative Gaussian localized surface plasmon resonance models an extinction band, with an illustrative size and aggregation shift; the absorbed/scattered/transmitted split is a teaching model. Electrical: a toy spacing/contact law represents interfaces and tunnelling; there is no universal conductivity trend. Mechanical: a simplified grain-boundary strengthening model does not apply indefinitely at extremely small grains. Magnetic behaviour also depends on composition, temperature and anisotropy. These example particles are single-domain: their moments may be thermally unblocked (superparamagnetic) or blocked on the observation timescale. Larger grains can support multiple domains, which are not modelled here.',
    'Ball milling is top-down: repeated impacts fracture and deform larger powder particles. The exponential trend and distributions are illustrative, not a universal law or measured data; cold welding and contamination can also occur.',
    'PVD is bottom-up deposition: vapour travels through a low-pressure chamber and condenses on a substrate. Thermal evaporation heats a source; sputtering ejects target atoms through energetic ion impacts. Vacuum reduces gas-phase collisions. Thickness = selected rate × time assumes a constant substrate deposition rate; other controls illustrate transport, not a calibrated process.',
    'An illustrative colloidal route reduces dissolved gold ions to Au atoms, followed by nucleation, growth and stabilization. Citrate can act as a reducing and stabilizing agent in one route, but other chemistries exist. The toy model does not predict actual particle sizes, yields or reaction rates.',
    'Adsorption changes a surface-sensitive property. Here fractional response = sensitivity × surface factor × C/(1+C), a dimensionless saturation model. A first-order time response with τ = 5 s and recovery are illustrative; the measurement interval controls sampling, not the physical time constant. Real sensors use different mechanisms and require calibration; no detection limit is implied.',
    'A quantum dot can absorb light to generate carriers or emit light after electron–hole recombination. The gap curve is an idealized teaching model, not an engineered LED or detector. Applications connect material properties to possible engineering benefits; suitability, safety and performance depend on the actual system.'
  ];
  function create(id, panel) {
    const stage = panel.querySelector('.nano-stage'), controls = panel.querySelector('.nano-controls'), out = panel.querySelector('.nano-readouts');
    panel.querySelector('.nano-notes').innerHTML = `<p>${notes[id]}</p>`;
    let drawingTarget = stage;
    let state = {}, defaults = {}, playing = false, clock = 0, sensorResponse = 0, sensorHistory = [{ t:0, value:0 }], frameAccumulator = 0, dead = false, electronPhase = 0, sampleElapsed = 0, view3d = null;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = motion.matches;
    function motionChanged(event) { reduced = event.matches; draw(); }
    motion.addEventListener('change', motionChanged);
    const defs = [
      [['r', 'Radius', 'range', 1, 50, 1, 50, 'nm']],
      [['L', 'Confinement size L', 'range', 1, 10, .1, 3, 'nm'], ['mass', 'Effective mass m*/mₑ', 'range', .05, 1, .05, .2, ''], ['n', 'Excited state n', 'range', 2, 5, 1, 2, ''], ['excite', 'Excitation', 'select', ['Excited', 'Ground state'], 'Excited']],
      [['mode', 'Experiment', 'select', ['Optical', 'Electrical', 'Mechanical', 'Magnetic'], 'Optical'], ['size', 'Particle / grain size', 'range', 2, 100, 1, 20, 'nm'], ['wave', 'Incident wavelength', 'range', 400, 750, 5, 530, 'nm'], ['conc', 'Concentration / connectivity', 'range', .1, 2, .1, 1, 'relative'], ['agg', 'Aggregation / spacing', 'range', 0, 1, .05, .2, 'relative'], ['drive', 'Voltage / strain / field', 'range', -1, 1, .05, .5, 'relative'], ['branch', 'Field sweep', 'select', ['Decreasing from +H', 'Increasing from −H'], 'Decreasing from +H']],
      [['speed', 'Milling speed', 'range', 100, 800, 10, 400, 'rpm'], ['duration', 'Milling time', 'range', 0, 60, 1, 0, 'min'], ['ratio', 'Ball-to-powder ratio', 'range', 2, 20, 1, 10, ':1'], ['ball', 'Ball diameter', 'range', 3, 20, 1, 10, 'mm'], ['initial', 'Initial nominal size', 'range', 100, 1000, 10, 500, 'nm'], ['playback', 'Playback speed', 'select', ['0.5×', '1×', '2×', '4×'], '1×']],
      [['mode', 'Method', 'select', ['Thermal evaporation', 'Sputtering'], 'Thermal evaporation'], ['time', 'Deposition time', 'range', 0, 120, 1, 0, 's'], ['rate', 'Substrate deposition rate', 'range', .1, 3, .1, 1, 'nm/s'], ['power', 'Source energy input (relative)', 'range', 10, 100, 1, 70, '%'], ['temp', 'Substrate temperature', 'range', 20, 400, 10, 100, '°C'], ['pressure', 'Chamber pressure', 'range', 1, 100, 1, 10, 'relative'], ['distance', 'Source–substrate distance', 'range', 5, 30, 1, 15, 'cm']],
      [['prec', 'Precursor concentration', 'range', 1, 20, 1, 10, 'relative'], ['red', 'Reducing agent', 'range', 1, 20, 1, 10, 'relative'], ['temp', 'Temperature', 'range', 30, 100, 1, 70, '°C'], ['mix', 'Mixing intensity', 'range', 1, 10, 1, 5, 'relative'], ['stab', 'Stabilizer', 'range', 0, 10, 1, 5, 'relative'], ['time', 'Reaction time', 'range', 0, 1000, 1, 0, 'relative']],
      [['mode', 'Sensor mode', 'select', ['Resistive', 'Optical'], 'Resistive'], ['conc', 'Analyte concentration', 'range', 0, 10, .1, 2, 'relative'], ['coverage', 'Available surface factor', 'range', .1, 1, .05, .8, ''], ['sensitivity', 'Sensitivity coefficient', 'range', .1, 1, .05, .5, ''], ['interval', 'Measurement interval', 'range', 1, 20, 1, 5, 's']],
      [['mode', 'Explore', 'select', ['Light-emitting', 'Photodetection', 'Medicine', 'Energy', 'Automobile', 'Space', 'Defence'], 'Light-emitting'], ['L', 'Quantum-dot size', 'range', 1, 10, .1, 3, 'nm'], ['wave', 'Incident wavelength', 'range', 200, 900, 5, 500, 'nm'], ['example', 'Application example', 'select', ['1', '2', '3', '4'], '1']]
    ];
    const entries = defs[id];
    entries.forEach(d => { defaults[d[0]] = d[2] === 'select' ? d[4] : d[6]; });
    state = { ...defaults };
    function buildControls() {
      controls.innerHTML = '';
      entries.forEach(d => {
        const [key, label, type] = d;
        const wrap = document.createElement('div'); wrap.className = 'nano-control';
        const lab = document.createElement('label'); lab.htmlFor = 'nano-' + key; lab.textContent = label;
        const val = document.createElement('output'); val.setAttribute('for', 'nano-' + key); val.setAttribute('aria-live', 'off'); lab.append(val);
        let input;
        if (type === 'select') {
          input = document.createElement('select');
          d[3].forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; input.append(o); });
          input.value = state[key];
        } else {
          input = document.createElement('input'); input.type = 'range'; input.min = d[3]; input.max = d[4]; input.step = d[5]; input.value = state[key];
          val.textContent = state[key] + ' ' + d[7];
        }
        input.id = 'nano-' + key;
        input.addEventListener('input', () => {
          if (type === 'range') {
            const value = Number(input.value);
            state[key] = Number.isFinite(value) ? Math.max(d[3], Math.min(d[4], value)) : defaults[key];
          } else { state[key] = d[3].includes(input.value) ? input.value : defaults[key]; }
          if (id === 6 && key === 'interval') sampleElapsed = 0;
          if (key === 'mode' && (id === 7 || id === 2)) { playing = false; clock = 0; syncControls(); }
          updateVisibility(); syncControls(); draw();
        });
        wrap.dataset.key = key; wrap.append(lab, input);
        if (type === 'range') {
          const number = document.createElement('input'); number.type = 'number'; number.className = 'nano-number'; number.min = d[3]; number.max = d[4]; number.step = d[5]; number.value = state[key];
          number.setAttribute('aria-label', label + ' numeric value' + (d[7] ? ' in ' + d[7] : ''));
          input.addEventListener('input', () => { number.value = input.value; number.removeAttribute('aria-invalid'); });
          number.addEventListener('change', () => { const value = Number(number.value); if (!number.value.trim() || !Number.isFinite(value)) { number.setAttribute('aria-invalid', 'true'); number.value = input.value; return; } input.value = Math.max(d[3], Math.min(d[4], value)); input.dispatchEvent(new Event('input', {bubbles:true})); number.value = input.value; });
          wrap.append(number);
        }
        controls.append(wrap);
      });
      const actions = document.createElement('div'); actions.className = 'nano-actions';
      if ([0, 2, 3, 4, 5, 6, 7].includes(id)) {
        const play = document.createElement('button'); play.type = 'button'; play.dataset.action = 'play';
        play.onclick = () => {
          if (!playing) {
            if (id === 7 && clock >= 4) clock = 0;
            if (id === 0 && state.r <= 1) state.r = 50;
            if (id === 3 && state.duration >= 60) { state.duration = 0; clock = 0; }
            if (id === 4 && state.time >= 120 || id === 5 && M.gold(state.time, state.prec, state.red, state.temp, state.mix, state.stab).progress >= 1) { state.time = 0; clock = 0; }
          }
          playing = !playing; if (view3d) { if (playing) view3d.play(); else view3d.pause(); } syncControls(); draw();
        };
        actions.append(play);
      }
      if (id === 3) {
        const step = document.createElement('button'); step.type = 'button'; step.textContent = 'Step 1 min';
        step.onclick = () => { playing = false; if (view3d) view3d.pause(); state.duration = Math.min(60, state.duration + 1); clock += .5; syncControls(); draw(); };
        actions.append(step);
      }
      if (id === 5) {
        const next = document.createElement('button'); next.type = 'button'; next.textContent = 'Next stage';
        next.onclick = () => {
          const progress = M.gold(state.time, state.prec, state.red, state.temp, state.mix, state.stab).progress;
          const nextStage = Math.min(6, M.goldStage(progress) + 1);
          state.time = M.goldTimeForProgress([0, .12, .20, .32, .55, .80, 1][nextStage], state.red, state.temp, state.mix);
          playing = false; syncControls(); draw();
        };
        actions.append(next);
      }
      const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = 'Reset';
      reset.onclick = () => { state = { ...defaults }; playing = false; clock = 0; sensorResponse = 0; sensorHistory = [{ t:0, value:0 }]; electronPhase = 0; sampleElapsed = 0; frameAccumulator = 0; if (view3d) { view3d.pause(); view3d.reset(); } buildControls(); draw(); controls.querySelector('button:last-child').focus(); };
      actions.append(reset); controls.append(actions); updateVisibility(); syncControls();
    }
    function updateVisibility() {
      const mode = state.mode;
      controls.querySelectorAll('.nano-control').forEach(w => {
        const key = w.dataset.key;
        if (id === 2) {
          const visible = { Optical: ['mode', 'size', 'wave', 'conc', 'agg'], Electrical: ['mode', 'size', 'conc', 'agg', 'drive'], Mechanical: ['mode', 'size', 'drive'], Magnetic: ['mode', 'size', 'drive', 'branch'] };
          w.hidden = !visible[mode].includes(key);
          const labels = { Optical: { size: 'Gold particle diameter', conc: 'Concentration', agg: 'Aggregation' }, Electrical: { size: 'Particle diameter', conc: 'Connectivity', agg: 'Particle spacing', drive: 'Applied voltage' }, Mechanical: { size: 'Grain size', drive: 'Signed strain' }, Magnetic: { size: 'Particle diameter', drive: 'Applied field' } };
          w.querySelector('label').firstChild.textContent = labels[mode][key] || entries.find(d => d[0] === key)[1];
          if (key === 'branch') w.hidden = mode !== 'Magnetic' || state.size < 10;
        }
        if (id === 7) {
          const device = mode === 'Light-emitting' || mode === 'Photodetection';
          w.hidden = key === 'example' ? device : key === 'L' ? !device : key === 'wave' ? mode !== 'Photodetection' : false;
          if (key === 'example' && !device) {
            const names = { Medicine: ['Targeted carrier', 'Imaging agent', 'Diagnostic sensor', 'Antimicrobial coating'], Energy: ['Solar cell', 'Battery electrode', 'Energy storage', 'Catalyst'], Automobile: ['Composite body panel', 'Protective coating', 'Catalytic converter', 'Vehicle sensor'], Space: ['Spacecraft structure', 'Protective coating', 'Thermal panel', 'Spacecraft sensor'], Defence: ['Protective equipment', 'Protective coating', 'Detection sensor', 'Lightweight composite'] };
            w.querySelectorAll('option').forEach((option, i) => option.textContent = names[mode][i]);
          }
        }
      });
      const play = controls.querySelector('[data-action=play]');
      if (play && id === 7) play.hidden = !(mode === 'Light-emitting' || mode === 'Photodetection');
      if (play && id === 2) play.hidden = mode !== 'Electrical';
    }
    function setupMath() {
      const notesEl = panel.querySelector('.nano-notes');
      const equations = {
        0: [String.raw`A=4\pi r^2,\quad V=\frac{4}{3}\pi r^3,\quad \frac{A}{V}=\frac{3}{r}`, 'A = 4πr²; V = 4πr³/3; A/V = 3/r'],
        1: [String.raw`E_n=\frac{n^2 h^2}{8m^*L^2},\qquad E=\frac{hc}{\lambda}`, 'En = n²h²/(8m*L²); E = hc/λ'],
        3: [String.raw`d_i(t)=d_{i,0}\left(0.08+0.92e^{-k_i t}\right)`, 'Representative particle size = initial size × illustrative decay factor'],
        4: [String.raw`d=Rt`, 'Film thickness = rate × time'],
        7: [String.raw`E=\frac{hc}{\lambda}`, 'E = hc/λ']
      };
      if (!equations[id]) return;
      const el = document.createElement('div'); el.className = 'xlab-equation'; el.dataset.tex = equations[id][0]; el.dataset.display = 'true'; el.textContent = equations[id][1]; notesEl.append(el);
      const details = panel.querySelector('.nano-theory'); details.addEventListener('toggle', () => { if (details.open && window.XLabWorkspace) window.XLabWorkspace.math(notesEl).catch(() => {}); });
    }
    function setup3D() {
      if (id !== 3 || !window.XLabWorkspace) return;
      view3d = window.XLabWorkspace.attach3D(stage, {
        openLabel:'Open 3D cutaway', closeLabel:'Close 3D cutaway', script:'src/ch6/ball-mill-3d.js',
        instructions:'Drag to orbit · scroll to zoom · right-drag to pan. Select a component or use the buttons. Geometry and motion are schematic, not to scale.',
        parts:['Chamber','Milling balls','Powder','Drive'], snapshot:() => ({state,clock}), mount:(host,describe,onLost) => window.XLabBallMill3D.mount(host,describe,onLost)
      });
    }
    function preparationExplorer() {
      if (id !== 3) return;
      const section = document.createElement('section'); section.className = 'nano-preparation';
      section.innerHTML = `<h3>Preparation methods explorer</h3><p>Compare breaking bulk material down with assembling structures from smaller building blocks. Select a process, then move the progress slider to inspect the transformation.</p><label for="nano-prep-mode">Process</label><select id="nano-prep-mode"><option>Compare both</option><option>Top-down</option><option>Bottom-up</option></select><label for="nano-prep-progress">Process progress <output>50%</output></label><input id="nano-prep-progress" type="range" min="0" max="100" value="50"><div class="nano-prep-grid"><div><h4>Top-down · mechanical reduction</h4><svg viewBox="0 0 280 120" aria-label="Top-down reduction"></svg><p>Repeated impacts fracture a bulk sample into smaller particles.</p><button type="button" data-lab="3">Open ball milling</button></div><div><h4>Bottom-up · assembly</h4><svg viewBox="0 0 280 120" aria-label="Bottom-up assembly"></svg><p>Atoms or precursors nucleate and grow into nanoparticles or a deposited film.</p><button type="button" data-lab="5">Open colloidal gold</button> <button type="button" data-lab="4">Open PVD</button></div></div>`;
      panel.querySelector('.workspace').after(section);
      const input = section.querySelector('input'), selector = section.querySelector('select'), svgs = section.querySelectorAll('svg');
      let topProgress = .5, bottomProgress = .5;
      function update() {
        section.querySelector('output').textContent = input.value + '%'; svgs.forEach(x => x.innerHTML = '');
        let p = topProgress;
        const a = svgs[0], b = svgs[1];
        rect(a, 12, 25, 70, 70, '#678a98'); txt(a, 15, 110, 'Bulk'); line(a, 90, 60, 125, 60, '#9cabb6', 3);
        const n = 1 + Math.floor(p * 15);
        for (let i = 0; i < n; i++) { let r = 26 / Math.cbrt(n); circle(a, 155 + (i % 4) * 29, 25 + Math.floor(i / 4) * 24, r, '#e4ac64'); }
        txt(a, 142, 110, 'Fragments');
        p = bottomProgress;
        for (let i = 0; i < 18; i++) circle(b, 15 + (i % 6) * 13, 30 + Math.floor(i / 6) * 19, 3, '#e4ac64');
        txt(b, 15, 110, 'Atoms'); line(b, 98, 60, 135, 60, '#9cabb6', 3); circle(b, 200, 60, 5 + 30 * p, '#6acbd0'); txt(b, 155, 110, p < .3 ? 'Nucleation' : 'Growth');
      }
      input.addEventListener('input', () => { const p = Number(input.value) / 100; if (selector.value !== 'Bottom-up') topProgress = p; if (selector.value !== 'Top-down') bottomProgress = p; update(); });
      selector.addEventListener('change', () => { input.value = Math.round((selector.value === 'Bottom-up' ? bottomProgress : topProgress) * 100); update(); });
      section.querySelectorAll('[data-lab]').forEach(b => b.addEventListener('click', () => {
        const target = Number(b.dataset.lab);
        if (target === 3) { panel.querySelector('#nano-controls-heading').focus({ preventScroll:true }); panel.querySelector('.workspace').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); }
        else { window.Ch6Platform.switchTopic(target); panel.querySelector('h2').focus({ preventScroll:true }); panel.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); }
      }));
      update();
    }
    function crossLinks() {
      if (id !== 4 && id !== 5) return;
      const section = document.createElement('section'); section.className = 'nano-preparation nano-crosslinks';
      const other = id === 4 ? 5 : 4, otherName = id === 4 ? 'colloidal gold' : 'PVD';
      section.innerHTML = `<h3>Preparation context</h3><p>This is a <strong>bottom-up</strong> route: structures are assembled from atoms, ions or precursors. Compare it with the <strong>top-down</strong> ball-milling route, which breaks bulk material down mechanically.</p><div class="nano-crosslink-row"><button type="button" data-lab="3">Open preparation explorer &amp; ball milling</button><button type="button" data-lab="${other}">Open ${otherName} laboratory</button></div>`;
      panel.querySelector('.workspace').after(section);
      section.querySelectorAll('[data-lab]').forEach(b => b.addEventListener('click', () => {
        window.Ch6Platform.switchTopic(Number(b.dataset.lab));
        panel.querySelector('h2').focus({ preventScroll:true });
        panel.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      }));
    }
    function plot(viewBox, label) {
      const wrap = document.createElement('div'); wrap.className = 'nano-viz';
      wrap.tabIndex = 0; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', label + '. Scroll horizontally if needed.');
      const s = document.createElementNS(NS, 'svg');
      s.setAttribute('viewBox', viewBox); s.setAttribute('role', 'img'); s.setAttribute('aria-label', label);
      wrap.append(s); drawingTarget.append(wrap); return s;
    }
    function svg() {
      drawingTarget = document.createDocumentFragment();
      const hint = document.createElement('p'); hint.className = 'nano-pan-hint';
      hint.textContent = 'Pan diagrams on narrow screens. Live numerical readings follow the controls.';
      drawingTarget.append(hint);
      const names = ['Logarithmic scale and fixed-volume sphere subdivision', 'Ideal well energy levels and illustrative quantum-dot gap', 'Nanomaterial ' + state.mode + ' experiment', 'Ball-mill cutaway and tracked size distributions', state.mode + ' vacuum deposition chamber', 'Colloidal gold synthesis stages and model distributions', state.mode + ' nanosensor adsorption and calibration', 'Nanomaterial ' + state.mode + ' experiment'];
      return plot('0 0 640 360', names[id]);
    }
    function node(s, tag, attrs, text) {
      const x = document.createElementNS(NS, tag);
      Object.entries(attrs).forEach(([k, v]) => x.setAttribute(k, v));
      if (text !== undefined) x.textContent = text;
      s.append(x); return x;
    }
    function txt(s, x, y, t) { return node(s, 'text', { x, y }, t); }
    function arrow(s, x1, y1, x2, y2, col = '#5dcfda', width = 2) {
      line(s, x1, y1, x2, y2, col, width);
      const a = Math.atan2(y2 - y1, x2 - x1), len = 6;
      node(s, 'polygon', { points:`${x2},${y2} ${x2 - len * Math.cos(a - .5)},${y2 - len * Math.sin(a - .5)} ${x2 - len * Math.cos(a + .5)},${y2 - len * Math.sin(a + .5)}`, fill:col });
    }
    function textLines(s, x, y, text, maxChars) {
      let row = '', lineIndex = 0;
      text.split(' ').forEach(word => {
        if ((row + ' ' + word).trim().length > maxChars && row) { txt(s, x, y + lineIndex++ * 17, row); row = word; }
        else row = (row + ' ' + word).trim();
      });
      if (row) txt(s, x, y + lineIndex * 17, row);
    }
    function line(s, x1, y1, x2, y2, color = '#5dcfda', width = 2) { node(s, 'line', { x1, y1, x2, y2, stroke: color, 'stroke-width': width }); }
    function circle(s, x, y, r, fill = '#43b7c5', opacity = 1) { node(s, 'circle', { cx: x, cy: y, r, fill, opacity }); }
    function rect(s, x, y, w, h, fill, stroke = 'none') { node(s, 'rect', { x, y, width: w, height: h, rx: 4, fill, stroke }); }
    function graph(s, x, y, w, h, fn, label, color = '#55d4df') {
      line(s, x, y + h, x + w, y + h, '#8796a7', 1); line(s, x, y, x, y + h, '#8796a7', 1);
      let points = [];
      for (let i = 0; i <= 80; i++) { let v = Math.max(0, Math.min(1, fn(i / 80))); points.push((x + w * i / 80) + ',' + (y + h * (1 - v))); }
      node(s, 'polyline', { points: points.join(' '), fill: 'none', stroke: color, 'stroke-width': 2 });
      txt(s, x + 4, y - 6, label);
    }
    function axisTicks(s, x, y, w, h, xLabels, yLabels) {
      xLabels.forEach((t, i) => txt(s, x + w * i / (xLabels.length - 1), y + h + 17, t).setAttribute('text-anchor', 'middle'));
      yLabels.forEach((t, i) => txt(s, x - 10, y + h - h * i / (yLabels.length - 1) + 4, t).setAttribute('text-anchor', 'end'));
    }
    function histogram(s, x, y, w, h, pop, max, label, shade, scale) {
      const bins = M.histogram(pop, max, 10), peak = scale || Math.max(1, ...bins);
      line(s, x, y + h, x + w, y + h, '#8796a7', 1); line(s, x, y, x, y + h, '#8796a7', 1);
      bins.forEach((v, i) => rect(s, x + i * w / 10 + 1, y + h - h * v / peak, w / 10 - 2, h * v / peak, shade));
      txt(s, x, y - 8, label); txt(s, x - 22, y + 4, peak); txt(s, x - 18, y + h, '0'); txt(s, x, y + h + 14, '0'); txt(s, x + w - 43, y + h + 14, Math.round(max) + ' nm');
    }
    function values(items) { out.innerHTML = items.map(x => `<span>${x}</span>`).join(''); }
    function caption(t) { const p = document.createElement('p'); p.className = 'nano-caption'; p.textContent = t; drawingTarget.append(p); }
    function color(w) {
      if (w < 380 || w > 780) return '#9b95a5';
      if (w < 440) return '#9065dd';
      if (w < 490) return '#4b9ee8';
      if (w < 510) return '#41cfc0';
      if (w < 580) return '#8fce65';
      if (w < 620) return '#e7b14e';
      return '#ed646b';
    }
    function controlValue(d) {
      let value = state[d[0]], unit = d[7];
      if (id === 2) {
        if (d[0] === 'drive') {
          if (state.mode === 'Electrical') unit = 'V';
          if (state.mode === 'Mechanical') { value *= 10; unit = '%'; }
        }
        if (d[0] === 'agg' && state.mode === 'Electrical') { value *= 10; unit = 'nm'; }
      }
      return Number(value.toFixed(2)) + (unit ? ' ' + unit : '');
    }
    function syncControls() {
      entries.forEach(d => {
        const el = controls.querySelector('#nano-' + d[0]);
        if (el && d[2] === 'range') {
          el.value = state[d[0]];
          const text = controlValue(d);
          el.previousElementSibling.querySelector('output').textContent = text;
          el.setAttribute('aria-valuetext', text);
          const number = el.parentElement.querySelector('.nano-number'); if (number && document.activeElement !== number) number.value = Number(state[d[0]].toFixed(2));
        }
      });
      const b = controls.querySelector('[data-action=play]');
      if (b) { b.textContent = (playing ? 'Pause' : 'Play') + (id === 2 ? ' electron drift' : ''); b.setAttribute('aria-pressed', String(playing)); }
    }
    // ---------- SIM 1: Nano-Scale Explorer ----------
    function drawScale(s) {
      const r = state.r, a = M.sphere(r), sub = M.subdivision(r), surf = M.surfaceFraction(r);
      txt(s, 18, 25, 'LOGARITHMIC SIZE SCALE · representative diameters (nm)');
      line(s, 30, 65, 610, 65, '#8297a9');
      [['Atom', .2], ['Nanoparticle', 20], ['Virus', 100], ['Bacterium', 1000], ['Red blood cell', 8000], ['Hair', 80000]].forEach(([name, v], i) => {
        const x = 30 + (Math.log10(v) + 1) / 6 * 540;
        circle(s, x, 65, 4, '#e1ae69');
        txt(s, x - 15, i % 2 ? 98 : 40, name); txt(s, x - 12, i % 2 ? 113 : 54, String(v));
      });
      const px = 30 + (Math.log10(2 * r) + 1) / 6 * 540;
      arrow(s, px, 129, px, 73, '#54d5dd');
      txt(s, 18, 155, 'A · One sphere, radius 50 nm');
      circle(s, 130, 230, 48);
      txt(s, 285, 155, 'B · Same total material volume');
      // Same radius-to-pixel ratio on both sides; only a sample of B is drawn.
      const radius = 48 * r / 50, step = 2 * radius + 6;
      const cols = Math.max(1, Math.floor(315 / step)), rows = Math.max(1, Math.floor(115 / step));
      const shown = Math.min(100, cols * rows, Math.max(1, Math.round(sub.count)));
      for (let i = 0; i < shown; i++) circle(s, 288 + radius + i % cols * step, 173 + radius + Math.floor(i / cols) * step, radius, '#54c8d1');
      txt(s, 285, 300, `Showing ${shown} representative sphere${shown === 1 ? '' : 's'}`);
      txt(s, 18, 320, `Equivalent count: ${sub.count.toFixed(1)} · area gain ${sub.areaGain.toFixed(1)}×`);
      txt(s, 18, 340, `Surface-shell estimate ≈ ${(100 * surf).toFixed(0)}% (0.3 nm layer)`);
      rect(s, 445, 320, 165, 12, '#2a4552'); rect(s, 445, 320, 165 * surf, 12, '#e8af60');
      values([
        `r = ${r.toFixed(1)} nm`, `d = ${(2 * r).toFixed(1)} nm`, `Area = ${a.area.toFixed(1)} nm²`,
        `Volume = ${a.volume.toFixed(1)} nm³`, `A/V = ${a.ratio.toFixed(3)} nm⁻¹`,
        `Fixed volume A = B = ${sub.volume.toFixed(0)} nm³`, `Area A = ${sub.largeArea.toFixed(0)} nm²`,
        `Equivalent count B = ${sub.count.toFixed(1)}`, `Total area B = ${sub.totalArea.toFixed(0)} nm²`, `Area gain = ${sub.areaGain.toFixed(1)}×`
      ]);
      caption('The top axis is logarithmic, not a row of same-scale objects. The sphere radii below share a linear drawing scale; B shows only a sample. Equivalent counts may be fractional in this ideal fixed-volume comparison. Play subdivides the material; Reset returns to one sphere. The surface-shell fraction estimates why surface atoms matter, not an exact atom count.');
      const plots = plot('0 0 640 310', 'Single-sphere area, volume, A/V and total exposed area of fixed material, each normalized to its own maximum');
      const specs = [
        [50, 35, x => ((1 + 49 * x) / 50) ** 2, 'Single-particle area / maximum', (r / 50) ** 2],
        [370, 35, x => ((1 + 49 * x) / 50) ** 3, 'Single-particle volume / maximum', (r / 50) ** 3],
        [50, 190, x => 1 / (1 + 49 * x), 'A/V / maximum', 1 / r],
        [370, 190, x => 1 / (1 + 49 * x), 'Fixed-volume total area / maximum', 1 / r]
      ];
      specs.forEach(([x, y, fn, label, v]) => {
        graph(plots, x, y, 230, 85, fn, label);
        axisTicks(plots, x, y, 230, 85, ['1', '25.5', '50 nm'], ['0', '1']);
        circle(plots, x + 230 * (r - 1) / 49, y + 85 * (1 - v), 4, '#efaf64');
      });
      caption('Graph x-axes: radius 1–50 nm. Each y-axis is normalized to its own maximum over this range. The lower-right curve is for the fixed material volume, not the area of one particle.');
    }
    // ---------- SIM 2: Quantum Confinement ----------
    function drawQuantum(s) {
      const { L, mass:m, n } = state;
      const e1 = M.well(L, m, 1), en = M.well(L, m, n), e2 = M.well(L, m, 2);
      const gap = M.gap(L), w = M.photon(gap), bohr = M.bohrRegime(L);
      txt(s, 25, 26, '1D INFINITE WELL · log energy axis');
      const left = 185 - (30 + L * 8), right = 185 + (30 + L * 8);
      line(s, left, 60, left, 240, '#8d9cac', 4); line(s, right, 60, right, 240, '#8d9cac', 4);
      const ey = k => 230 - (Math.log10(M.well(L, m, k)) + 3) / 5.5 * 150;
      for (let k = 1; k <= 5; k++) {
        const y = ey(k);
        line(s, left + 5, y, right - 5, y, k === n ? '#e8af60' : '#55cbd3');
        txt(s, k % 2 ? right + 6 : left - 40, y + 4, 'n = ' + k);
      }
      if (state.excite === 'Excited') arrow(s, 185, ey(n), 185, ey(1), '#e8af60', 3);
      txt(s, 40, 52, 'Eₙ = n²h² / (8m*L²)');
      txt(s, 75, 255, `L = ${L.toFixed(1)} nm · shapes √L ψ(x)`);
      line(s, left, 302, right, 302, '#526777', 1);
      [1, n].forEach((k, i) => {
        const points = Array.from({ length:81 }, (_, j) => `${left + (right - left) * j / 80},${302 - M.wavefunction(j / 80, k) * 24}`);
        node(s, 'polyline', { points:points.join(' '), fill:'none', stroke:i ? '#e8af60' : '#55cbd3', 'stroke-width':i ? 2 : 1 });
      });
      txt(s, 75, 345, `ψ₁ (cyan), ψ${n} (amber) · not probability density`);
      txt(s, 365, 26, 'SEPARATE ILLUSTRATIVE DOT MODEL');
      const valence = 170, conduction = valence - 40 - gap * 10;
      line(s, 390, valence, 590, valence, '#55cbd3', 3); line(s, 390, conduction, 590, conduction, '#e8af60', 3);
      txt(s, 390, conduction - 10, 'Conduction edge'); txt(s, 390, 188, 'Valence edge');
      arrow(s, 550, valence - 4, 550, conduction + 4, '#e8af60');
      txt(s, 390, 145, `Egap = ${gap.toFixed(3)} eV`);
      txt(s, 375, 57, 'Egap = 1.8 + 3/L² eV (L in nm)');
      graph(s, 375, 240, 220, 75, x => state.excite === 'Excited' ? Math.exp(-.5 * ((200 + x * 700 - w) / 20) ** 2) : 0, 'Emission · E = hc/λ', color(w));
      axisTicks(s, 375, 240, 220, 75, ['200', '550', '900 nm'], ['0', '1']);
      txt(s, 375, 355, `${w.toFixed(0)} nm · ${M.emissionLabel(w)}`);
      values([
        `E₁ = ${e1.toFixed(3)} eV`, `E${n} = ${en.toFixed(3)} eV`, `ΔE(n→1) = ${(en - e1).toFixed(3)} eV`,
        `Spacing E₂−E₁ = ${(e2 - e1).toFixed(3)} eV`, `Dot gap = ${gap.toFixed(3)} eV`,
        `λ = ${w.toFixed(0)} nm (${M.emissionLabel(w)})`, `L/aB = ${bohr.ratio.toFixed(2)} · ${bohr.regime}`
      ]);
      caption('The arrow is an allowed well transition; the dot band edges and emission use a separate gap model, not that well transition. The 200–900 nm plot includes UV (grey) and visible emission; no emission is drawn in the ground state. The illustrative exciton Bohr radius is 5 nm.');
      const curve = plot('0 0 640 145', 'Inverse-square change of the first energy-level spacing with well width, normalized at one nanometre');
      const maxSpacing = M.well(1, m, 2) - M.well(1, m, 1);
      graph(curve, 50, 28, 540, 85, x => 1 / (1 + 9 * x) ** 2, 'E₂−E₁ / spacing at 1 nm · same effective mass');
      axisTicks(curve, 50, 28, 540, 85, ['1', '5.5', '10 nm'], ['0', '1']);
      circle(curve, 50 + 540 * (L - 1) / 9, 113 - 85 * (e2 - e1) / maxSpacing, 4, '#efaf64');
    }
    // ---------- SIM 3: Properties ----------
    function drawProperties(s) {
      const { mode, size, wave, conc, agg, drive } = state;
      txt(s, 25, 28, mode.toUpperCase() + ' · illustrative, not measured');
      if (mode === 'Optical') {
        const band = M.plasmon(wave, size, agg), balance = M.opticalBalance(band, conc, size);
        arrow(s, 25, 110, 150, 110, color(wave), 5); txt(s, 30, 90, 'Incident light');
        for (let i = 0; i < 16; i++) {
          const x = 170 + i % 4 * 34, y = 67 + Math.floor(i / 4) * 24;
          circle(s, x * (1 - agg * .6) + 222 * agg * .6, y * (1 - agg * .6) + 105 * agg * .6, 3 + size / 16, '#dca160', .8);
        }
        line(s, 300, 110, 595, 110, color(wave), 5);
        // Beam opacity follows the same transmittance as the numerical reading.
        s.lastElementChild.setAttribute('opacity', Math.max(.03, balance.transmitted));
        txt(s, 405, 92, 'Transmitted light');
        arrow(s, 250, 90, 340, 48, '#8bd4dc', 2); txt(s, 350, 52, 'Scattered light');
        const bx = 55, bw = 530;
        rect(s, bx, 180, bw * balance.absorbed, 14, '#e8af60');
        rect(s, bx + bw * balance.absorbed, 180, bw * balance.scattered, 14, '#8bd4dc');
        rect(s, bx + bw * (balance.absorbed + balance.scattered), 180, bw * balance.transmitted, 14, '#7d9eac');
        txt(s, bx, 169, 'Incident energy partition (heuristic)');
        txt(s, bx, 211, `Absorbed ${(100 * balance.absorbed).toFixed(0)}%`);
        txt(s, 230, 211, `Scattered ${(100 * balance.scattered).toFixed(0)}%`);
        txt(s, 410, 211, `Transmitted ${(100 * balance.transmitted).toFixed(0)}%`);
        graph(s, 55, 255, 335, 70, x => M.opticalBalance(M.plasmon(400 + x * 350, size, agg), conc, size).absorbed, 'Absorbed fraction · qualitative spectrum', '#df9c63');
        axisTicks(s, 55, 255, 335, 70, ['400', '575', '750 nm'], ['0', '1']);
        circle(s, 55 + 335 * (wave - 400) / 350, 325 - 70 * balance.absorbed, 4, color(wave));
        txt(s, 430, 248, 'White-light sample');
        rect(s, 435, 263, 150, 45, `rgb(${M.colloidRGB(size, agg, conc).join(',')})`, '#b9cbd9');
        txt(s, 435, 330, 'Approximate RGB only');
        values([
          `LSPR band at ${wave} nm = ${band.toFixed(2)} relative`, `Transmission = ${(100 * balance.transmitted).toFixed(0)}%`,
          `Absorbed = ${(100 * balance.absorbed).toFixed(0)}%`, `Scattered = ${(100 * balance.scattered).toFixed(0)}%`
        ]);
        caption('A Gaussian LSPR extinction band shifts and broadens with size and aggregation. Transmission = exp(−concentration × band response); the remaining energy is partitioned into absorption and scattering by a heuristic. The white-light swatch samples transmission at 650, 550 and 450 nm, not measured colour. The surrounding medium is held fixed; real resonances also depend on its refractive index.');
      } else if (mode === 'Electrical') {
        const resistance = M.network(size, agg * 10, conc), current = drive / resistance * 1000;
        const direction = drive < 0 ? 1 : -1;
        line(s, 40, 80, 40, 265, '#a9bbc8', 4); line(s, 340, 80, 340, 265, '#a9bbc8', 4);
        txt(s, 35, 64, `${drive.toFixed(2)} V`); txt(s, 305, 64, '0 V');
        for (let j = 0; j < 5; j++) for (let i = 0; i < 7; i++) {
          const x = 60 + i * 43, y = 90 + j * 40;
          const connected = i < 6 && (i + j) % 3 < conc * 1.5;
          if (i === 0) line(s, 40, y, x, y, '#7d9eac', 2);
          if (i === 6) line(s, x, y, 340, y, '#7d9eac', 2);
          if (connected) line(s, x, y, x + 43, y, '#7d9eac', 2);
          if (j < 4 && (i + j) % 4 < conc) line(s, x, y, x, y + 40, '#7d9eac', 1);
          circle(s, x, y, 5 + size / 30);
          if (connected && drive !== 0) {
            const fraction = reduced ? .5 : (electronPhase * Math.abs(drive) + i * .37 + j * .53) % 1;
            circle(s, direction > 0 ? x + 43 * fraction : x + 43 * (1 - fraction), y, 3, '#ffd377');
          }
        }
        txt(s, 40, 305, drive === 0 ? 'No applied voltage · no net drift' : 'Electrons drift opposite conventional current');
        txt(s, 40, 326, 'Contacts and interfaces are schematic');
        graph(s, 405, 100, 185, 170, x => .5 + (2 * x - 1) / resistance * 1000 / 6, 'Signed I–V · toy law');
        line(s, 405, 185, 590, 185, '#526777', 1); line(s, 497.5, 100, 497.5, 270, '#526777', 1);
        axisTicks(s, 405, 100, 185, 170, ['−1', '0', '+1 V'], ['−3', '0', '+3 mA']);
        circle(s, 405 + 185 * (drive + 1) / 2, 270 - 170 * (.5 + current / 6), 4, '#efaf64');
        values([`Toy resistance = ${resistance.toFixed(0)} Ω`, `Voltage = ${drive.toFixed(2)} V`, `Current = ${current.toFixed(3)} mA`]);
        caption('R = 1000 exp(spacing/5)(1+20/size)/connectivity; I = V/R. Particle spacing is in nm in this toy law, connectivity is relative, and the contact drawing is not a solved resistor network. Play electron drift to animate; Pause or reduced motion keeps carriers still. Surfaces, interfaces and composition can change real conductivity in different directions.');
      } else if (mode === 'Mechanical') {
        const strain = drive * .1, model = M.mechanical(strain, size);
        const height = 175 * (1 + strain), width = 135 * (1 - .3 * strain), sx = 170 - width / 2, sy = 174 - height / 2;
        rect(s, sx, sy, width, height, '#305e6d');
        const grains = Math.min(10, Math.max(2, Math.round(Math.sqrt(200 / size) * 2)));
        for (let i = 1; i < grains; i++) {
          line(s, sx, sy + height * i / grains, sx + width, sy + height * i / grains, '#76c2c6', 1);
          line(s, sx + width * i / grains, sy, sx + width * i / grains, sy + height, '#76c2c6', 1);
        }
        if (drive >= 0) { arrow(s, 170, 78, 170, 43, '#e8af60'); arrow(s, 170, 270, 170, 290, '#e8af60'); }
        else { arrow(s, 170, 43, 170, 78, '#e8af60'); arrow(s, 170, 290, 170, 270, '#e8af60'); }
        txt(s, 40, 55, drive < 0 ? 'Compression' : 'Tension');
        txt(s, 40, 310, `${size} nm grains`); txt(s, 185, 310, '200 nm reference');
        [40, 185].forEach((x, j) => {
          rect(s, x, 318, 110, 23, '#305e6d');
          const count = j ? 2 : Math.min(10, grains);
          for (let i = 1; i < count; i++) line(s, x + 110 * i / count, 318, x + 110 * i / count, 341, '#76c2c6', 1);
        });
        graph(s, 365, 90, 225, 190, x => Math.abs(M.mechanical(x * .1, size).stress) / 1.2, 'Stress–strain magnitudes');
        axisTicks(s, 365, 90, 225, 190, ['0', '5', '10%'], ['0', '.6', '1.2']);
        circle(s, 365 + 225 * Math.abs(strain) / .1, 280 - 190 * Math.abs(model.stress) / 1.2, 4, '#efaf64');
        values([`Signed strain = ${(strain * 100).toFixed(1)}%`, `Stress = ${model.stress.toFixed(2)} relative`, `Strength = ${model.strength.toFixed(2)} relative`]);
        caption('The toy elastic–plastic curve plots magnitudes for both tension and compression. Grain boundaries can hinder dislocations. Strengthening is capped below 10 nm; softening mechanisms at extremely small grains are not modelled. Grain drawings are schematic. Hardness is resistance to localized deformation, not a calculated stress here.');
      } else {
        const blocked = size >= 10, branch = state.branch === 'Increasing from −H' ? 1 : -1;
        const mag = M.magnetization(drive, size, blocked ? branch : 0);
        for (let i = 0; i < 45; i++) {
          const x = 55 + i % 9 * 30, y = 90 + Math.floor(i / 9) * 33;
          const angle = ((1 - Math.abs(mag)) * ((i * 71) % 180 - 90) + (mag < 0 ? 180 : 0)) * Math.PI / 180;
          node(s, 'circle', { cx:x, cy:y, r:12, fill:'none', stroke:'#305261' });
          arrow(s, x - 5 * Math.cos(angle), y + 5 * Math.sin(angle), x + 8 * Math.cos(angle), y - 8 * Math.sin(angle), '#5dd3d9', 2);
        }
        if (drive !== 0) arrow(s, drive > 0 ? 60 : 295, 55, drive > 0 ? 295 : 60, 55, '#e8af60', 2);
        txt(s, 40, 267, M.magneticRegime(size));
        txt(s, 40, 289, 'Moments within single-domain particles');
        txt(s, 40, 312, 'Multi-domain grains are outside this model');
        const gx = 365, gy = 105, gw = 225, gh = 170;
        const curve = direction => x => (M.magnetization(x * 2 - 1, size, direction) + 1) / 2;
        graph(s, gx, gy, gw, gh, curve(blocked ? -1 : 0), blocked ? 'M–H · two sweep branches' : 'M–H · reversible response');
        if (blocked) {
          const points = Array.from({ length:81 }, (_, i) => `${gx + gw * i / 80},${gy + gh * (1 - curve(1)(i / 80))}`);
          node(s, 'polyline', { points:points.join(' '), fill:'none', stroke:'#e8af60', 'stroke-width':2 });
        }
        line(s, gx, gy + gh / 2, gx + gw, gy + gh / 2, '#526777', 1); line(s, gx + gw / 2, gy, gx + gw / 2, gy + gh, '#526777', 1);
        axisTicks(s, gx, gy, gw, gh, ['−1', '0', '+1 H'], ['−1', '0', '+1 M']);
        circle(s, gx + gw * (drive + 1) / 2, gy + gh * (1 - (mag + 1) / 2), 4, '#ffd377');
        txt(s, gx, 318, blocked ? 'Cyan: decreasing H · amber: increasing H' : 'No remanence in this regime');
        values([`Field = ${drive.toFixed(2)} relative`, `Magnetization = ${mag.toFixed(2)} relative`, `Size = ${size} nm`, `Regime = ${M.magneticRegime(size)}`, `Remanence magnitude = ${M.remanence(size).toFixed(2)} relative`]);
        caption('Both the marker and readout follow the selected curve branch. Blocked particles retain remanence after saturation; this superparamagnetic example is reversible. The 10 nm threshold and normalized tanh curves are illustrative, not material measurements. Composition, temperature, anisotropy and observation time all matter.');
      }
    }
    // ---------- SIM 4: Ball Milling ----------
    function drawMill(s) {
      const { speed, duration, ratio, ball, initial } = state;
      const before = M.millPopulation(initial, 0, speed, ratio, ball);
      const population = M.millPopulation(initial, duration, speed, ratio, ball);
      const mean = population.reduce((a, b) => a + b, 0) / population.length;
      const beforeMean = before.reduce((a, b) => a + b, 0) / before.length;
      const reduction = 1 - mean / beforeMean;
      txt(s, 30, 26, 'ROTATING MILL · cutaway');
      txt(s, 30, 44, M.millStage(reduction));
      circle(s, 180, 185, 136, '#213c4b'); circle(s, 180, 185, 125, '#142c38');
      const rotation = reduced ? 0 : clock * speed / 300;
      for (let i = 0; i < 6; i++) {
        const a = rotation + i * Math.PI / 3;
        line(s, 180 + 115 * Math.cos(a), 185 + 115 * Math.sin(a), 180 + 130 * Math.cos(a), 185 + 130 * Math.sin(a), '#9bb6c0', 4);
      }
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4 + rotation, rad = 72 + 15 * Math.sin(rotation * 1.7 + i);
        const x = 180 + rad * Math.cos(angle), y = 185 + rad * Math.sin(angle);
        circle(s, x, y, 8 + ball / 2, '#a0b6c0');
        if (!reduced && duration > 0 && Math.sin(rotation * 3 + i) > .92) {
          line(s, x - 10, y - 12, x - 18, y - 20, '#ffd377', 2);
          line(s, x + 8, y - 12, x + 15, y - 21, '#ffd377', 2);
        }
      }
      population.forEach((size, i) => {
        const a = i * 2.4 + rotation * .3, rad = (i * 37) % 105;
        circle(s, 180 + rad * Math.cos(a), 185 + rad * Math.sin(a), Math.max(1.2, Math.min(5, 4 * size / initial)), '#e3a75f');
      });
      const histScale = Math.max(1, ...M.histogram(before, initial * 1.4), ...M.histogram(population, initial * 1.4));
      histogram(s, 375, 65, 220, 90, before, initial * 1.4, 'Initial · 80 tracked particles', '#8193a4', histScale);
      histogram(s, 375, 235, 220, 90, population, initial * 1.4, 'Current · same axes', '#62d7dc', histScale);
      values([
        `Elapsed = ${duration.toFixed(1)} min`, `Initial mean = ${beforeMean.toFixed(1)} nm`,
        `Tracked mean = ${mean.toFixed(1)} nm`, `Reduction = ${(100 * reduction).toFixed(0)}%`,
        `Stage = ${M.millStage(reduction)}`
      ]);
      txt(s, 35, 348, 'Steel balls & powder · sizes exaggerated');
      caption('The same 80 representative particles populate both histograms and the chamber. At 1× playback, two model minutes pass per real second. Impact flashes depict conceptual fracture; size reduction is an illustrative trend, not a collision solver or measured milling data. Changing parameters recomputes the trajectory.');
      const plots = plot('0 0 640 145', 'Mean tracked particle size versus milling time, zero to sixty minutes');
      graph(plots, 45, 30, 550, 90, x => M.millPopulation(initial, x * 60, speed, ratio, ball).reduce((a, b) => a + b, 0) / 80 / beforeMean, 'Mean size / initial mean vs time · 0–60 min');
      axisTicks(plots, 45, 30, 550, 90, ['0', '30', '60 min'], ['0', '1']);
      const fraction = duration / 60;
      circle(plots, 45 + 550 * fraction, 120 - 90 * mean / beforeMean, 4, '#efaf64');
    }
    // ---------- SIM 5: PVD ----------
    function drawPVD(s) {
      const { time, rate, mode, power, temp, pressure, distance } = state;
      const thick = M.thickness(rate, time), flux = power / 100 * Math.exp(-pressure * distance / 2000);
      const moving = playing && !reduced, sourceY = 200 + (distance - 5) * 2.6;
      const vacuum = pressure < 20 ? 'Lower pressure · fewer gas collisions' : pressure < 60 ? 'Intermediate pressure' : 'Higher pressure · more gas collisions';
      rect(s, 55, 25, 390, 305, '#142e3b', '#7195a4');
      rect(s, 110, 58, 280, 16, '#8fa4b0'); rect(s, 110, 74, 280, Math.min(24, thick / 10), '#d5a45b');
      txt(s, 165, 50, 'SUBSTRATE · growing film');
      rect(s, 170, sourceY, 160, 25, mode === 'Sputtering' ? '#9b6a53' : '#be7650');
      txt(s, 165, 315, mode === 'Sputtering' ? 'TARGET' : 'HEATED SOURCE');
      txt(s, 65, 42, playing ? 'Depositing' : time <= 0 ? 'Ready' : 'Paused');
      txt(s, 65, 348, vacuum);
      line(s, 415, 85, 415, sourceY, '#7e9aa8', 1); txt(s, 365, 190, `${distance} cm`);
      for (let i = 0; i < Math.round(pressure / 6); i++) circle(s, 75 + (i * 67) % 345, 110 + (i * 43) % 110, 2, '#91a4b6', .25);
      if (mode === 'Sputtering') {
        txt(s, 65, 137, 'Ar⁺ ion source');
        for (let i = 0; i < 5; i++) {
          const phase = moving ? (clock * .65 + i / 5) % 1 : i / 5;
          circle(s, 95 + phase * 100, 150 + phase * (sourceY - 150), 4, '#b5a7f7', .3 + .7 * power / 100);
        }
        arrow(s, 95, 150, 190, sourceY - 4, '#b5a7f7', 2);
        for (let i = 0; i < 4; i++) arrow(s, 190 + i * 35, sourceY - 2, 180 + i * 35, sourceY - 20, '#ffd782', 2);
      } else {
        for (let i = 0; i < 5; i++) {
          const phase = moving ? (clock * .8 + i / 5) % 1 : i / 5;
          arrow(s, 190 + i * 25, sourceY + 37, 190 + i * 25, sourceY + 27 - phase * 8, '#f28756', 2);
        }
        txt(s, 65, 170, 'Heat → vapour');
      }
      if (time > 0 || playing) for (let i = 0; i < 30; i++) {
        const phase = moving ? (i * .173 + clock * .35) % 1 : i * .173 % 1;
        circle(s, 205 + (i * 53) % 90 + (phase - .5) * 70, sourceY - phase * (sourceY - 95), 2 + flux * 2, '#e8b367', .2 + .8 * flux);
      }
      graph(s, 490, 100, 115, 170, x => x * rate / 3, 'Thickness (nm)');
      axisTicks(s, 490, 100, 115, 170, ['0', '60', '120 s'], ['0', '180', '360']);
      circle(s, 490 + 115 * time / 120, 270 - 170 * thick / 360, 4, '#e5ae65');
      values([
        `Thickness = ${thick.toFixed(1)} nm`, `Elapsed = ${time.toFixed(1)} s`, `Progress = ${(time / 120 * 100).toFixed(0)}%`,
        `Particle flux indicator = ${flux.toFixed(2)} relative`, `Coverage (illustrative) = ${(100 * M.pvdCoverage(thick, temp)).toFixed(0)}%`,
        `Substrate = ${temp} °C`, `Rate × time = ${rate.toFixed(1)} × ${time.toFixed(1)} nm`
      ]);
      caption('Thickness = prescribed constant substrate rate × time; playback advances four simulated seconds per real second. Source energy, pressure and distance change only the qualitative transport indicator, not the independently prescribed substrate rate. All settings assume an active source. Film height is exaggerated. The coverage example is not a universal temperature trend; none of these controls is a calibrated process recipe.');
    }
    // ---------- SIM 6: Gold Synthesis ----------
    function drawGold(s) {
      const { time, prec, red, temp, mix, stab } = state;
      const g = M.gold(time, prec, red, temp, mix, stab), pop = M.goldPopulation(g), p = g.progress;
      const labels = ['1 · Precursor solution', '2 · Reducing-agent addition', '3 · Reduction: Au ions → atoms', '4 · Nucleation', '5 · Particle growth', '6 · Stabilization', '7 · Colloidal suspension'];
      const stageIndex = M.goldStage(p);
      txt(s, 25, 30, labels[stageIndex]);
      // Stage stepper.
      for (let i = 0; i < 7; i++) {
        circle(s, 380 + i * 38, 30, 11, i === stageIndex ? '#e8af60' : '#2a4552');
        if (i === stageIndex) txt(s, 376 + i * 38, 34, String(i + 1)).style.fill = '#101923';
        else txt(s, 376 + i * 38, 34, String(i + 1));
      }
      rect(s, 90, 70, 235, 240, '#264b58', '#8da7ad');
      const opticalStrength = pop.length ? Math.min(2, pop.length / 90 * p * prec / 8) : 0;
      const rgb = M.colloidRGB(g.size, g.aggregation, opticalStrength);
      const liquid = stageIndex < 3 ? '#b4a269' : `rgb(${rgb.join(',')})`;
      rect(s, 100, 120, 215, 180, liquid);
      if (stageIndex === 1) { txt(s, 145, 87, 'Reducing agent ↓'); for (let i = 0; i < 4; i++) circle(s, 205, 92 + i * 8, 3, '#8bd4dc'); }
      if (stageIndex === 2) {
        for (let i = 0; i < 20; i++) { const x = 110 + (i * 71) % 195, y = 130 + (i * 43) % 160; circle(s, x, y, 2, i % 2 ? '#f5c65c' : '#8bdbdf'); }
        txt(s, 117, 285, 'Au ions → Au atoms').style.fill = '#172633';
      }
      // Mixing swirl (intensity ∝ mix; animated while playing unless reduced motion).
      if (stageIndex >= 1 && mix > 1) {
        const rot = (playing && !reduced) ? clock * mix * 0.4 : 0;
        for (let i = 0; i < 3; i++) {
          const a0 = rot + i * 2.1;
          node(s, 'path', { d: `M ${207 + 60 * Math.cos(a0)} ${210 + 60 * Math.sin(a0)} A 60 60 0 0 1 ${207 + 60 * Math.cos(a0 + 1.2)} ${210 + 60 * Math.sin(a0 + 1.2)}`, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.5, opacity: 0.35 });
        }
      }
      pop.forEach((size, i) => {
        const x0 = 110 + (i * 71) % 195, y0 = 130 + (i * 43) % 160;
        const group = i % 6, gx = 125 + group % 3 * 70, gy = 155 + Math.floor(group / 3) * 95;
        const x = x0 * (1 - g.aggregation) + gx * g.aggregation, y = y0 * (1 - g.aggregation) + gy * g.aggregation;
        circle(s, x, y, Math.min(7, Math.max(1.5, size / 3)), '#f2bc58');
        if (stab > 0 && stageIndex >= 5) node(s, 'circle', { cx: x, cy: y, r: Math.min(10, 3 + size / 3), fill: 'none', stroke: '#81dfdb', 'stroke-width': 1 });
      });
      graph(s, 375, 90, 220, 85, x => M.opticalBalance(M.plasmon(400 + x * 350, g.size, g.aggregation), opticalStrength, g.size).absorbed, 'Illustrative absorption · 400–750 nm', '#e9a561');
      axisTicks(s, 375, 90, 220, 85, ['400', '575', '750 nm'], ['0', '1']);
      histogram(s, 375, 230, 220, 85, pop, 50, 'Model population · 0–50 nm', '#65cdd5');
      values([
        `Progress = ${(p * 100).toFixed(0)}%`, pop.length ? `Model mean ≈ ${g.size.toFixed(1)} nm` : 'No nuclei yet',
        `Represented particles = ${pop.length}`, `Aggregation index = ${g.aggregation.toFixed(2)}`,
        `Stage = ${stageIndex + 1} of 7`
      ]);
      const stepper = document.createElement('ol'); stepper.className = 'nano-stages'; stepper.setAttribute('aria-label', 'Synthesis stages');
      labels.forEach((label, i) => { const li = document.createElement('li'); li.textContent = label; if (i === stageIndex) li.setAttribute('aria-current', 'step'); stepper.append(li); });
      drawingTarget.append(stepper);
      const explanations = [
        'Precursor: dissolved Au ions are present, but no metallic nanoparticles or plasmon band have formed.',
        'Addition: a conceptual reducing agent is introduced and mixing disperses it through the solution.',
        'Reduction: electron transfer converts dissolved gold ions into metallic Au atoms, before nuclei form.',
        'Nucleation: small groups of Au atoms form seed particles; the represented population begins to rise.',
        'Growth: Au atoms contribute to the existing nuclei. This toy model does not conserve an actual experimental yield.',
        'Stabilization: the cyan shell represents surface-bound stabilizer that helps keep particles dispersed. Reduction, growth and stabilization can overlap in real reactions.',
        'Suspension: dispersed particles and any aggregates determine the illustrative optical appearance.'
      ];
      caption(explanations[stageIndex] + ' Use Next stage to inspect the sequence, or Play to run continuously. Spectrum and approximate RGB colour share the same optical band; this is not a size, yield or reaction-rate prediction.');
    }
    // ---------- SIM 7: Nanosensor ----------
    function drawSensor(s) {
      const { mode, conc, coverage, sensitivity, interval } = state;
      const target = M.sensor(conc, coverage, sensitivity), response = sensorResponse;
      const last = sensorHistory[sensorHistory.length - 1];
      txt(s, 25, 28, mode.toUpperCase() + ' NANOSENSOR · adsorption model');
      rect(s, 85, 245, 275, 30, '#72909a');
      const fraction = sensitivity > 0 ? Math.min(1, response / sensitivity) : 0;
      for (let i = 0; i < 18; i++) {
        const x = 100 + i * 14;
        circle(s, x, 235, 7, '#58c6cc');
        if (i / 18 < fraction) circle(s, x, 215, 4, '#e8ab65');
      }
      for (let i = 0; i < Math.round(conc * 2); i++) {
        const phase = reduced ? (i * .17) % 1 : (i * .17 + clock * .13) % 1;
        circle(s, 90 + (i * 61) % 260, 75 + phase * 135, 3, '#e8ab65');
      }
      txt(s, 90, 300, 'Analyte adsorbs onto accessible surface sites');
      txt(s, 90, 322, `Model coverage = ${(fraction * 100).toFixed(1)}%`);
      if (mode === 'Optical') {
        arrow(s, 30, 70, 180, 225, '#e6b25d', 4);
        arrow(s, 180, 225, 330, 70, '#d67f70', Math.max(1, 4 * (1 - response)));
        txt(s, 25, 57, 'Incident'); txt(s, 265, 57, 'Reflected');
      } else {
        line(s, 35, 260, 85, 260, '#e6b25d', 3); line(s, 360, 260, 390, 260, '#e6b25d', 3);
        txt(s, 20, 280, 'V'); txt(s, 365, 280, 'I');
      }
      graph(s, 420, 80, 185, 90, x => M.sensor(x * 10, coverage, sensitivity), 'Calibration · relative response');
      axisTicks(s, 420, 80, 185, 90, ['0', '5', '10 C'], ['0', '1']);
      circle(s, 420 + 185 * conc / 10, 170 - 90 * target, 4, '#e8ab65');
      const firstTime = sensorHistory[0].t, endTime = Math.max(firstTime + 1, clock);
      graph(s, 420, 235, 185, 80, x => {
        const time = firstTime + x * (endTime - firstTime);
        let sample = sensorHistory[0];
        for (const point of sensorHistory) { if (point.t > time) break; sample = point; }
        return sample.value;
      }, 'Sampled response / recovery');
      axisTicks(s, 420, 235, 185, 80, [firstTime.toFixed(0), ((firstTime + endTime) / 2).toFixed(0), endTime.toFixed(0) + ' s'], ['0', '1']);
      const status = Math.abs(target - response) < .001 ? (conc === 0 ? 'At baseline' : 'At equilibrium') : target < response ? 'Recovering' : 'Responding';
      values([
        `Equilibrium response = ${(100 * target).toFixed(1)}%`, `Current response = ${(100 * response).toFixed(1)}%`,
        mode === 'Resistive' ? `R₀ = 1000 Ω · sampled R = ${(1000 * (1 + last.value)).toFixed(0)} Ω` : `Sampled reflectance at 550 nm = ${(1 - last.value).toFixed(3)}`,
        `Low-C sensitivity = ${M.sensorSlope(coverage, sensitivity).toFixed(2)} /unit`, `τ = 5 s · t₉₀ ≈ 11.5 s (illustrative)`,
        `Sample interval = ${interval} s`, `Last sample = ${last.t.toFixed(1)} s`, `Status = ${status}`
      ]);
      caption('Fractional equilibrium response = sensitivity × available surface factor × C/(1+C), with first-order relaxation (τ = 5 s). The measurement interval changes acquisition timing, not the physical response time. Play to measure; set concentration to zero to observe desorption and recovery. The resistive example uses R = R₀(1 + response); these mechanisms and positive response sign are not universal.');
      if (mode === 'Optical') {
        const spectrum = plot('0 0 640 145', 'Illustrative reflectance spectrum changes with surface adsorption');
        graph(spectrum, 50, 30, 540, 85, x => 1 - response * Math.exp(-.5 * ((400 + x * 350 - 550) / 55) ** 2), 'Model reflectance · Gaussian dip at 550 nm', '#e8ab65');
        axisTicks(spectrum, 50, 30, 540, 85, ['400', '575', '750 nm'], ['0', '1']);
      }
    }
    // ---------- SIM 8: Optoelectronics & Applications ----------
    function drawOpto(s) {
      const { mode, L, wave } = state;
      const gap = M.gap(L), w = M.photon(gap);
      if (mode === 'Light-emitting' || mode === 'Photodetection') {
        const detector = mode === 'Photodetection', absorbed = M.photonEnergy(wave) >= gap;
        const phase = clock < 1 ? 'Ready' : clock < 2 ? 'Excitation' : clock < 3 ? 'Electron–hole pair' : detector ? 'Readout' : 'Recombination';
        const carriers = clock >= 2 && (!detector || absorbed), output = clock >= 3;
        txt(s, 25, 28, mode.toUpperCase() + ' · ' + phase);
        circle(s, 210, 180, 90, '#284e5b');
        line(s, 155, 130, 265, 130, '#e5b66a', 3); line(s, 155, 220, 265, 220, '#64d0d8', 3);
        txt(s, 285, 133, 'Conduction level'); txt(s, 285, 229, 'Valence level');
        txt(s, 145, 293, `Quantum dot · ${L.toFixed(1)} nm`);
        if (carriers && (!output || detector)) {
          circle(s, 200, 130, 8, '#e5b66a'); circle(s, 220, 220, 8, '#e07386');
          txt(s, 180, 115, 'e⁻'); txt(s, 230, 242, 'h⁺');
        }
        if (!detector) {
          txt(s, 25, 67, 'Above-gap pump (assumed)');
          if (clock >= 1 && clock < 2) { arrow(s, 60, 85, 160, 163, '#a6b7ef', 4); arrow(s, 210, 215, 210, 141, '#e5b66a', 3); }
          if (output) {
            arrow(s, 210, 140, 210, 210, '#e5b66a', 3);
            const photonX = reduced ? 420 : 325 + Math.min(1, clock - 3) * 130;
            circle(s, photonX, 177, 5, color(w)); arrow(s, photonX - 25, 177, photonX - 7, 177, color(w), 2);
            txt(s, 340, 162, 'Emitted photon');
          }
        } else {
          txt(s, 25, 67, 'Incident photon');
          if (clock >= 1) arrow(s, 45, 90, 150, 160, color(wave), 4);
          txt(s, 335, 161, absorbed ? 'Photon energy ≥ gap' : 'Photon energy < gap');
          rect(s, 420, 177, 130, 30, '#456771'); txt(s, 429, 197, output && absorbed ? 'Detector: signal on' : 'Detector: signal off');
          if (output && absorbed) arrow(s, 305, 192, 414, 192, '#e5b66a', 3);
        }
        graph(s, 395, 270, 205, 60, x => detector ? (M.photonEnergy(200 + x * 700) >= gap ? 1 : 0) : output ? Math.exp(-.5 * ((200 + x * 700 - w) / 20) ** 2) : 0, detector ? 'Ideal absorption threshold' : 'Emission · relative intensity', color(w));
        axisTicks(s, 395, 270, 205, 60, ['200', '550', '900 nm'], ['0', '1']);
        if (detector) circle(s, 395 + 205 * (wave - 200) / 700, absorbed ? 270 : 330, 4, color(wave));
        values([
          `Gap = ${gap.toFixed(3)} eV`, `${detector ? 'Cut-off' : 'Emission'} λ = ${w.toFixed(0)} nm (${M.emissionLabel(w)})`,
          detector ? `Incident energy = ${M.photonEnergy(wave).toFixed(3)} eV` : 'Excitation: assumed above-gap pump',
          detector ? `Model output = ${output && absorbed ? 'on' : 'off'}` : `Photon = ${output ? 'emitted' : 'not emitted'}`
        ]);
        caption('E = hc/λ. Play follows excitation, carrier generation and output; replay restarts the sequence. This light-emitting example is optical excitation and recombination, not a complete LED design. The detector has an ideal absorption threshold and conceptual on/off output, not a responsivity prediction. Suitable materials, contacts and stability are needed in a real device.');
        return;
      }
      txt(s, 25, 28, mode.toUpperCase() + ' · inspect a component and its material property');
      const alternatives = {
        Medicine: [['Targeted drug carrier', 'Surface functionalization', 'Surface chemistry may assist targeting; safety and targeting require validation.'], ['Imaging agent', 'Optical response', 'Optical response can support imaging in suitable systems.'], ['Diagnostic sensor', 'Surface sensitivity', 'Surface interactions can help detect analytes.'], ['Antimicrobial coating', 'Surface chemistry', 'A coating may inhibit microbes depending on material and conditions.']],
        Energy: [['Solar cell', 'Optical absorption', 'Nanostructure can influence light absorption and charge collection.'], ['Battery electrode', 'High active surface area', 'Surface area can improve reaction access, with stability trade-offs.'], ['Energy storage', 'Nanoscale structure', 'Nanoscale architectures can change ion transport.'], ['Catalyst', 'Active surface area', 'Accessible surface sites can influence catalytic reactions.']],
        Automobile: [['Composite body panel', 'Lightweight reinforcement', 'Nanocomposites may improve stiffness-to-weight when well dispersed.'], ['Protective coating', 'Surface protection', 'Engineered coatings may improve wear or corrosion resistance.'], ['Catalytic converter', 'Catalytic surface', 'Nanostructures can provide accessible catalytic sites.'], ['Vehicle sensor', 'Surface sensitivity', 'Nanomaterials can provide a surface-sensitive sensing layer.']],
        Space: [['Spacecraft structure', 'Lightweight reinforcement', 'Composites may reduce component mass.'], ['Protective coating', 'Surface protection', 'Coatings can be designed for demanding environments.'], ['Thermal panel', 'Thermal properties', 'Engineered nanostructures may help manage heat.'], ['Spacecraft sensor', 'Surface sensitivity', 'Nanoscale surfaces can support sensing.']],
        Defence: [['Protective equipment', 'Composite reinforcement', 'Nanocomposites may support lightweight protection.'], ['Protective coating', 'Surface protection', 'Coatings can help protect exposed components.'], ['Detection sensor', 'Surface sensitivity', 'Surface interactions can support detection.'], ['Lightweight composite', 'Reinforcement', 'Nanocomposites can be designed for a strength-to-weight goal.']]
      };
      const materials = {
        Medicine: ['Functionalized lipid nanoparticles', 'Fluorescent quantum dots', 'Nanostructured sensing layer', 'Silver nanoparticle coating'],
        Energy: ['Semiconductor quantum dots', 'Nanostructured electrode', 'Nanoporous electrode', 'Supported nanoparticles'],
        Automobile: ['Polymer nanocomposite', 'Nanostructured coating', 'Supported catalyst nanoparticles', 'Nanostructured sensing layer'],
        Space: ['Polymer nanocomposite', 'Nanostructured protective coating', 'Engineered nanostructured coating', 'Nanostructured sensing layer'],
        Defence: ['Nanocomposite reinforcement', 'Nanostructured coating', 'Nanostructured sensing layer', 'Polymer nanocomposite']
      };
      // Compare design mechanisms and limitations, never invented performance bars.
      const compare = {
        Medicine:[
          ['Free drug disperses without a designed carrier surface.', 'A functionalized carrier changes interactions and release pathways.', 'Targeting, clearance, toxicity and efficacy need biological validation.'],
          ['Conventional dyes supply a molecular optical contrast agent.', 'Quantum dots offer a size-dependent optical response in a suitable imaging system.', 'Composition, clearance and toxicity can limit clinical use.'],
          ['A bulk sensing interface offers a conventional contact area.', 'A nanostructured interface exposes surface-sensitive sites.', 'Selectivity, fouling and calibration still determine usefulness.'],
          ['A conventional barrier coating provides surface protection.', 'An engineered silver-containing surface can interact with microbes.', 'Dose, durability, resistance and environmental release require assessment.']
        ],
        Energy:[
          ['Bulk absorber layers define conventional optical and transport paths.', 'Nanostructure provides another way to tune absorption and carrier collection.', 'Surface traps, stability and charge extraction can offset benefits.'],
          ['Larger electrode particles have longer internal diffusion paths.', 'Nanostructured particles can shorten paths and expose reaction sites.', 'Side reactions and mechanical stability can worsen at high surface area.'],
          ['A dense electrode has limited electrolyte-accessible internal area.', 'A nanoporous architecture offers internal interfaces and shorter paths.', 'Pore accessibility, conductivity and electrolyte compatibility matter.'],
          ['A bulk catalyst exposes only its external surface.', 'Supported nanoparticles distribute accessible active sites.', 'Sintering, poisoning and support interactions affect lifetime.']
        ],
        Automobile:[
          ['A conventional composite uses its established matrix and reinforcement.', 'Dispersed nanofillers can modify matrix load transfer.', 'Dispersion, interfaces, manufacturing cost and recycling matter.'],
          ['A conventional coating provides an existing protective barrier.', 'Nanoscale structure can modify wear and barrier mechanisms.', 'Adhesion, defects and durability require service testing.'],
          ['A larger catalyst body has less exposed area per material volume.', 'Supported catalyst nanoparticles can expose more active sites.', 'Activity depends on chemistry; heat can coarsen nanoparticles.'],
          ['A bulk sensing film uses its established transduction mechanism.', 'A nanostructured film offers surface-sensitive interactions.', 'Selectivity, contamination and calibration remain necessary.']
        ],
        Space:[
          ['A conventional structural component meets a mass–stiffness trade-off.', 'A nanocomposite offers another reinforcement architecture.', 'Vacuum, outgassing, radiation and mechanical qualification are essential.'],
          ['A conventional surface coating is tailored to its environment.', 'Nanoscale structure can modify an engineered coating interface.', 'Radiation, adhesion and thermal cycling require qualification.'],
          ['Conventional thermal control uses established surface and bulk properties.', 'An engineered nanostructure may tune surface or transport properties.', 'Nanoscale features can reduce rather than increase heat transport.'],
          ['A conventional sensor uses a calibrated sensing interface.', 'A nanostructured interface offers surface-sensitive interactions.', 'Radiation, drift and long-term reliability must be assessed.']
        ],
        Defence:[
          ['A conventional protective composite balances mass and deformation.', 'Nanofillers offer another route to modifying the composite architecture.', 'Protection is system-specific and must be established by testing.'],
          ['A conventional coating protects an exposed component surface.', 'Nanoscale structure can modify an engineered barrier.', 'Adhesion, wear and environmental durability govern suitability.'],
          ['A conventional detector uses a calibrated recognition interface.', 'Nanostructured surfaces can support analyte interactions.', 'Selectivity, false alarms and field calibration remain critical.'],
          ['A conventional composite uses an established reinforcement scale.', 'Dispersed nanofillers may modify load transfer and component mass.', 'Interfaces, dispersion and validated structural performance matter.']
        ]
      };
      const index = Number(state.example) - 1, a = alternatives[mode][index];
      const material = materials[mode][index];
      const cmp = compare[mode][index];
      if (mode === 'Medicine') {
        circle(s, 180, 175, 80, '#315564'); circle(s, 180, 175, 45, '#729ca4');
        for (let i = 0; i < 10; i++) { const ang = i * Math.PI / 5; circle(s, 180 + 70 * Math.cos(ang), 175 + 70 * Math.sin(ang), 5, '#e5b66a'); }
        txt(s, 95, 280, 'Carrier / diagnostic component');
      } else if (mode === 'Energy') {
        rect(s, 75, 100, 210, 150, '#315564', '#72c9cf');
        for (let i = 0; i < 7; i++) line(s, 90 + i * 28, 110, 90 + i * 28, 240, '#77cbd1', 2);
        txt(s, 105, 280, 'Energy component');
      } else if (mode === 'Automobile') {
        rect(s, 70, 145, 220, 75, '#315564', '#72c9cf'); rect(s, 115, 115, 100, 35, '#315564', '#72c9cf');
        circle(s, 115, 225, 20, '#728e9b'); circle(s, 245, 225, 20, '#728e9b');
        txt(s, 95, 280, 'Vehicle component');
      } else if (mode === 'Space') {
        rect(s, 145, 120, 75, 100, '#315564', '#72c9cf'); rect(s, 50, 145, 90, 55, '#517b92'); rect(s, 225, 145, 90, 55, '#517b92');
        line(s, 182, 120, 182, 75, '#9bb5bd', 3); circle(s, 182, 70, 7, '#e5b66a');
        txt(s, 105, 280, 'Spacecraft component');
      } else {
        node(s, 'path', { d: 'M 180 85 L 265 120 L 250 200 Q 230 245 180 265 Q 130 245 110 200 L 95 120 Z', fill: '#315564', stroke: '#72c9cf' });
        txt(s, 120, 290, 'Protective component');
      }
      for (let i = 0; i < 10; i++) circle(s, 155 + (i * 23) % 55, 150 + (i * 31) % 60, 3, '#e7b468');
      node(s, 'circle', { cx: 125 + index * 35, cy: 180, r: 13, fill: 'none', stroke: '#f0b56a', 'stroke-width': 3 });
      txt(s, 55, 330, 'Selected component: ' + a[0]);
      txt(s, 350, 75, 'PROPERTY'); txt(s, 350, 98, a[1]);
      txt(s, 350, 143, 'MATERIAL EXAMPLE');
      textLines(s, 350, 165, material, 35);
      txt(s, 350, 220, 'POTENTIAL BENEFIT');
      textLines(s, 350, 242, a[2], 36);
      values([a[0], material, a[1], 'Conceptual engineering comparison']);
      const comparison = document.createElement('section'); comparison.className = 'nano-comparison';
      comparison.innerHTML = `<h4>${a[0]} · compare design approaches</h4><div class="nano-comparison-grid"><div><strong>Conventional approach</strong><p>${cmp[0]}</p></div><div><strong>Nanostructured approach</strong><p>${cmp[1]}</p></div></div><p><strong>Trade-offs &amp; validation:</strong> ${cmp[2]}</p>`;
      drawingTarget.append(comparison);
      caption('The highlighted location is schematic. Select another application example to inspect its material, mechanism and trade-offs. No numerical performance advantage or commercial readiness is implied.');
    }

    function draw() {
      if (dead) return;
      // Keep a panned/focused diagram usable while its numerical state advances.
      const previous = [...stage.querySelectorAll('.nano-viz')];
      const scroll = previous.map(wrap => wrap.scrollLeft);
      const focused = previous.indexOf(document.activeElement);
      const s = svg();
      if (id === 0) drawScale(s);
      else if (id === 1) drawQuantum(s);
      else if (id === 2) drawProperties(s);
      else if (id === 3) drawMill(s);
      else if (id === 4) drawPVD(s);
      else if (id === 5) drawGold(s);
      else if (id === 6) drawSensor(s);
      else if (id === 7) drawOpto(s);
      // Retain scroll-region elements themselves, not just their offsets. This also
      // preserves native touch/keyboard panning while replacing the SVG contents.
      const children = [...drawingTarget.childNodes];
      children.forEach((next, i) => {
        const old = stage.childNodes[i];
        if (old?.nodeType === 1 && old.classList.contains('nano-viz') && next.classList.contains('nano-viz')) {
          old.setAttribute('aria-label', next.getAttribute('aria-label'));
          old.replaceChildren(...next.childNodes);
        } else if (old) old.replaceWith(next);
        else stage.append(next);
      });
      while (stage.childNodes.length > children.length) stage.lastChild.remove();
      if (view3d) view3d.update({state,clock});
      stage.querySelectorAll('.nano-viz').forEach((wrap, i) => {
        if (i === focused && document.activeElement !== wrap) wrap.focus({ preventScroll:true });
        wrap.scrollLeft = scroll[i] || 0;
      });
    }
    buildControls(); setupMath(); setup3D(); preparationExplorer(); crossLinks(); draw();
    return {
      tick(dt) {
        if (dead || !Number.isFinite(dt) || dt <= 0 || !playing) return;
        if (id === 2 && (state.mode !== 'Electrical' || reduced)) return;
        // Cap dormant-tab catch-up; reduce rendering cadence as well as particle motion.
        frameAccumulator += Math.min(1, dt);
        if (frameAccumulator < (reduced ? .25 : 1 / 15)) return;
        dt = frameAccumulator; frameAccumulator = 0; clock += dt;
        if (id === 2) { electronPhase = (electronPhase + dt) % 1000; draw(); }
        else if (id === 0) {
          state.r = Math.max(1, state.r - dt * 5);
          if (state.r === 1) playing = false;
          syncControls(); draw();
        } else if (id === 3 || id === 4 || id === 5) {
          const key = id === 3 ? 'duration' : 'time', max = id === 3 ? 60 : id === 4 ? 120 : 1000;
          let step = dt * (id === 3 ? 2 : 4);
          if (id === 3) step *= parseFloat(state.playback) || 1;
          state[key] = Math.min(max, state[key] + step);
          if (state[key] >= max || id === 5 && M.gold(state.time, state.prec, state.red, state.temp, state.mix, state.stab).progress >= 1) playing = false;
          syncControls(); draw();
        } else if (id === 7) {
          if (clock >= 4) { clock = 4; playing = false; syncControls(); }
          draw();
        } else if (id === 6) {
          const previous = sensorResponse, target = M.sensor(state.conc, state.coverage, state.sensitivity);
          sensorResponse = M.relax(previous, target, dt, 5);
          let nextSample = state.interval - sampleElapsed;
          while (nextSample <= dt + 1e-9) {
            sensorHistory.push({ t:clock - dt + nextSample, value:M.relax(previous, target, Math.max(0, nextSample), 5) });
            if (sensorHistory.length > 120) sensorHistory.shift();
            nextSample += state.interval;
          }
          sampleElapsed = Math.max(0, state.interval - (nextSample - dt));
          draw();
        }
      },
      destroy() { dead = true; playing = false; if (view3d) view3d.destroy(); view3d = null; motion.removeEventListener('change', motionChanged); }
    };
  }
  window.Ch6Labs = { create };
})();
