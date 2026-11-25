(function () {
  'use strict';
  // Use the existing course sidebar, workspace and global animation loop.
  const topics = [
    ['Scale', 'Nano-Scale Explorer', 'Introduction & surface-to-volume ratio', 'A nanometre is 10⁻⁹ m. Resize a sphere, compare familiar dimensions, then subdivide a fixed volume to investigate how much surface becomes available.'],
    ['Quantum', 'Quantum Confinement Laboratory', 'Quantum confinement and size-dependent emission', 'Confinement changes allowed electronic states when dimensions approach carrier length scales. Compare an ideal 1D well with a separate, illustrative quantum-dot emission model.'],
    ['Properties', 'Nanomaterial Properties Laboratory', 'Optical, electrical, mechanical and magnetic properties', 'Choose a property experiment to connect particle size, surfaces and interfaces to a material response. These simplified examples are not universal trends for all nanomaterials.'],
    ['Ball mill', 'High-Energy Ball Milling', 'Top-down physical preparation', 'Repeated mechanical impacts fracture and deform larger powder particles. Operate the mill and compare its tracked size distributions; explore top-down versus bottom-up preparation below.'],
    ['PVD', 'Physical Vapour Deposition', 'Bottom-up physical deposition', 'In a vacuum chamber, a source supplies atoms that condense on a substrate. Compare thermal evaporation and sputtering, then measure thickness at a prescribed substrate deposition rate.'],
    ['Gold colloid', 'Gold Nanoparticle Synthesis', 'Chemical preparation: colloidal route', 'Follow precursor preparation, reduction, nucleation, growth and stabilization. This conceptual route links a model population to a qualitative spectrum and colloidal appearance, not a laboratory recipe.'],
    ['Sensors', 'Nanosensor Laboratory', 'Surface-sensitive detection', 'Adsorption on a nanostructured surface can change resistance or optical response. Introduce analyte, sample the output and remove the analyte to observe recovery.'],
    ['Applications', 'Nano-Optoelectronics & Applications', 'Devices and applications', 'Follow excitation and electron–hole recombination, or detect an incident photon. Then inspect material–property–purpose connections across five application domains.']
  ];
  let visible = false, active = 0, panel, instance, loading, serial = 0;

  function loadScript(src, ready) {
    if (ready()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => ready() ? resolve() : reject(new Error('Laboratory module did not initialize.'));
      script.onerror = () => { script.remove(); reject(new Error('Laboratory module could not be loaded.')); };
      document.head.append(script);
    });
  }
  function load() {
    if (!loading) {
      loading = loadScript('src/ch6/models.js', () => !!window.NanoModels)
        .then(() => loadScript('src/ch6/labs.js', () => !!window.Ch6Labs))
        .catch(error => { loading = null; throw error; });
    }
    return loading;
  }
  function renderPills() {
    const bar = document.getElementById('pillBar');
    bar.innerHTML = '';
    bar.setAttribute('aria-label', 'Unit VI topics');
    topics.forEach((topic, i) => {
      const button = document.createElement('button');
      button.id = 'ch6-topic-' + i;
      button.className = 'pill' + (i === active ? ' active' : '');
      button.textContent = topic[0];
      button.type = 'button';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(i === active));
      button.setAttribute('aria-controls', 'ch6-panel');
      button.tabIndex = i === active ? 0 : -1;
      button.onclick = () => {
        open(i);
        // Rebuilding the shared topic list must not send keyboard focus to <body>.
        const destination = window.matchMedia('(max-width:700px)').matches ? panel.querySelector('h2') : document.getElementById('ch6-topic-' + i);
        destination.focus({ preventScroll: true });
      };
      bar.append(button);
    });
  }
  function open(i) {
    if (!visible || !Number.isInteger(i) || i < 0 || i >= topics.length) return;
    active = i;
    renderPills();
    if (instance) instance.destroy();
    instance = null;
    const token = ++serial, topic = topics[i];
    panel.setAttribute('aria-labelledby', 'ch6-topic-' + i);
    panel.innerHTML = `<div class="panel-head"><div class="panel-head-row"><div><h2 tabindex="-1">6.${i + 1} ${topic[1]}</h2><p>${topic[2]}</p></div></div></div>
      <div class="nano-lesson-intro"><p>${topic[3]}</p><a href="#nano-controls-heading">Experiment controls ↓</a> <a href="#nano-model-notes">Theory &amp; model notes ↓</a></div>
      <div class="workspace"><div class="sim-grid"><div class="canvas-wrap"><div class="canvas-title"><span>${topic[1]}</span><span class="live-dot">Interactive</span></div><div class="nano-stage" aria-busy="true">Loading laboratory…</div></div><div class="controls-pane"><div class="controls-head"><h3 id="nano-controls-heading" tabindex="-1">Experiment controls</h3></div><div class="controls nano-controls"></div></div></div><div class="formula-bar nano-readouts" role="group" aria-label="Live numerical readings"></div></div>
      <details class="nano-theory" id="nano-model-notes"><summary>Theory &amp; model notes</summary><div class="nano-notes"></div></details>`;
    panel.querySelector('a[href="#nano-model-notes"]').onclick = () => { panel.querySelector('.nano-theory').open = true; };
    load().then(() => {
      if (visible && token === serial) {
        instance = window.Ch6Labs.create(i, panel);
        panel.querySelector('.nano-stage').setAttribute('aria-busy', 'false');
      }
    }).catch(() => {
      if (!visible || token !== serial) return;
      const stage = panel.querySelector('.nano-stage');
      stage.setAttribute('aria-busy', 'false');
      stage.textContent = 'Unable to load the laboratory. ';
      const retry = document.createElement('button');
      retry.type = 'button'; retry.className = 'nano-retry'; retry.textContent = 'Retry';
      retry.onclick = () => open(active);
      stage.append(retry);
    });
  }
  function mount() {
    visible = true;
    if (!panel) {
      panel = document.createElement('section'); panel.id = 'ch6-panel';
      panel.className = 'panel ch6-panel'; panel.setAttribute('role', 'tabpanel');
      document.getElementById('main').append(panel);
    }
    panel.classList.add('active');
    open(active);
  }
  function unmount() {
    visible = false; serial++;
    if (instance) instance.destroy();
    instance = null;
    if (panel) panel.classList.remove('active');
  }
  function handleKeydown(event) {
    if (!event.target.matches('#pillBar [role=tab]')) return;
    let next = active;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (active + 1) % topics.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (active + topics.length - 1) % topics.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = topics.length - 1;
    else return;
    event.preventDefault();
    open(next);
    document.getElementById('ch6-topic-' + next).focus();
  }
  window.Ch6Platform = {
    mount, unmount, handleKeydown, switchTopic: open,
    tick(dt) { if (visible && instance) instance.tick(dt); },
    resize() {} // SVG viewBoxes resize without allocating canvas buffers.
  };
})();
