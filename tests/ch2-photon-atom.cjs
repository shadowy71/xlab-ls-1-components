// Dependency-free checks for the Ch2 "Interaction of Light with Matter" lab.
// Run: node tests/ch2-photon-atom.cjs
//
// Drives sim1-photon-atom.js with minimal DOM stubs and verifies, in particular,
// the spontaneous-emission fixes:
//   1. the emitted photon's on-screen trajectory matches its drawn orientation
//      and the displayed θ (this used to be broken by anisotropic chamber scaling),
//   2. constant pixel-space photon speed for every emission angle,
//   3. photons are retired once they leave the (clipped) chamber,
//   4. randomized excited-state dwell (statistical lifetime) & randomized direction,
//   5. emitted photon energy hν = ΔE (λ = hc/ΔE),
//   6. stimulated emission stays coherent (regression), absorption still works.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

/* ---------------- minimal DOM stubs ---------------- */
class FakeNode {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.attrs = {};
    this.style = {};
    this.dataset = {};
    this.textContent = '';
    this._html = '';
    this._handlers = {};
    this.classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  append(...ns) { for (const n of ns) this.children.push(n); }
  appendChild(n) { this.children.push(n); return n; }
  remove() {}
  addEventListener(t, f) { (this._handlers[t] = this._handlers[t] || []).push(f); }
  click() { (this._handlers.click || []).forEach((f) => f({})); }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  set innerHTML(v) { this._html = v; if (v === '') this.children = []; }
  get innerHTML() { return this._html; }
}
const document = {
  createElement: () => new FakeNode('div'),
  createElementNS: (_ns, tag) => new FakeNode(tag),
};

/* ---------------- platform stubs (real physics math) ---------------- */
const HC_EV_NM = (6.62607015e-34 * 2.99792458e8 / 1.602176634e-19) * 1e9;
const nmToEv = (nm) => HC_EV_NM / Math.max(nm, 1);
const evToNm = (ev) => HC_EV_NM / Math.max(ev, 0.01);
const nmToTHz = (nm) => (2.99792458e8 / (Math.max(nm, 1) * 1e-9)) * 1e-12;

const readoutValues = {};
const bannerCalls = [];
const Cstub = {
  PHYSICS: { degToRad: Math.PI / 180, radToDeg: 180 / Math.PI },
  nmToEv, evToNm, nmToTHz,
  spectrumColor: () => 'rgba(255,150,40,1)',
  prefersReducedMotion: () => false,
  svgEl: (tag, attrs) => { const n = new FakeNode(tag); if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]); return n; },
  buildBanner(wrap) {
    wrap.querySelectorAll('.sim-banner').forEach((n) => n.remove());
    const banner = new FakeNode('div');
    wrap.append(banner);
    return { el: banner, set(tagLabel, variant, html) { bannerCalls.push({ tagLabel, variant, html }); } };
  },
  buildTransport() { return { setPlaying() {}, playBtn: new FakeNode('button') }; },
  buildActionRow(parent, buttons) {
    const row = new FakeNode('div');
    const refs = {};
    for (const b of buttons) {
      const btn = new FakeNode('button');
      btn.textContent = b.label;
      btn.addEventListener('click', b.onClick);
      refs[b.id || b.label] = btn;
      row.append(btn);
    }
    parent.append(row);
    return refs;
  },
};
const Xstub = {
  el: (tag, cls) => { const n = new FakeNode(tag); if (cls) n.className = cls; return n; },
  clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  buildSegmented() { return { set() {} }; },
  buildToggle() { return { checked: false, addEventListener() {} }; },
  buildSlider(_parent, cfg) {
    const input = new FakeNode('input');
    input.value = cfg.value;
    return { input, setValue(v) { input.value = v; } };
  },
  buildReadouts() {
    return { set(id, text) { readoutValues[id] = text; } };
  },
};

const window = { CH2_SIMS: {}, Ch2Platform: Cstub, XLab: Xstub };
vm.runInNewContext(fs.readFileSync('src/ch2/sim1-photon-atom.js', 'utf8'), { window, document, Math, console });

const ctx = { stage: new FakeNode('div'), controls: new FakeNode('div'), formula: new FakeNode('div'), wrap: new FakeNode('div'), dot: new FakeNode('span') };
const inst = window.CH2_SIMS.c2t1(ctx);
inst.mount();
const st = inst.getState();
const { CHAMBER, CLIP, PHOTON_SPEED_PX } = inst.geometry;
const near = (a, b, tol = 1e-6, msg) => assert.ok(Math.abs(a - b) <= tol, msg || `${a} != ${b}`);
const pixelPos = (p) => ({ px: CHAMBER.x0 + p.x * CHAMBER.w, py: CHAMBER.y0 + p.y * CHAMBER.h });

/* ---- 1+2+5: spontaneous emission — trajectory == orientation == displayed θ ---- */
st.mode = 'spontaneous';
for (const deg of [20, 45, 89, 135, 181, 225, 271, 318, 340]) {
  st.spontAngleDeg = deg;
  st.spontDwell = 0.5;
  st.phase = 'wait';
  st.tPhase = 0;
  st.outPhotons = [];
  inst.tick(0.55); // crosses dwell → startTransition
  assert.equal(st.phase, 'transition', `decay should fire for θ=${deg}°`);
  assert.equal(st.outPhotons.length, 1, `exactly one emitted photon for θ=${deg}°`);
  const p = st.outPhotons[0];
  const pxvx = p.vx * CHAMBER.w;
  const pxvy = p.vy * CHAMBER.h;
  // trajectory direction (screen) must equal the physics angle θ (CCW from +x, y-up)
  const trajDeg = Math.atan2(-pxvy, pxvx) * 180 / Math.PI;
  near(((trajDeg % 360) + 360) % 360, ((deg % 360) + 360) % 360, 1e-3, `trajectory ${trajDeg.toFixed(1)}° must match displayed θ=${deg}°`);
  // constant pixel speed, independent of direction (was angle-dependent before)
  near(Math.hypot(pxvx, pxvy), PHOTON_SPEED_PX, 1e-3, `pixel speed must be ${PHOTON_SPEED_PX} px/s for θ=${deg}°`);
  // emitted photon carries exactly the gap energy: hν = ΔE  ⇔  λ = hc/ΔE
  near(nmToEv(p.wavelength), st.deltaE, 1e-9, `emitted hν must equal ΔE for θ=${deg}°`);
  // readout quotes the same angle it animates
  assert.ok(readoutValues.status.includes(`θ = ${deg}°`), `status readout quotes θ=${deg}°`);
  // θ annotation points the same way as the motion
  inst.tick(0); // render
  const ray = ctx.stage.children[0].children.find((n) => n.attrs.opacity === '0.9' && n.tag === 'line' && n.attrs['stroke-dasharray'] === '5 3');
  assert.ok(ray, 'spontaneous direction ray rendered');
  const dx = parseFloat(ray.attrs.x2) - CHAMBER.cx;
  const dy = parseFloat(ray.attrs.y2) - CHAMBER.cy;
  const rayDeg = ((Math.atan2(-dy, dx) * 180 / Math.PI) % 360 + 360) % 360;
  near(rayDeg, ((deg % 360) + 360) % 360, 0.5, `annotation ray matches θ=${deg}°`);
}

/* ---- 3: photons retire once fully outside the clipped chamber ---- */
st.mode = 'spontaneous';
inst.tick(0); // settle
let sawPhoton = false;
let sawCleared = false;
let sawElectronE1 = false;
let cycles = 0;
let lastPhase = st.phase;
for (let i = 0; i < 60 * 30; i++) { // 30 simulated seconds
  inst.tick(1 / 60);
  if (st.phase === 'wait' && lastPhase !== 'wait') cycles++;
  lastPhase = st.phase;
  if (st.phase === 'complete' && st.electronLevel === 1) sawElectronE1 = true;
  if (st.outPhotons.length > 0) {
    sawPhoton = true;
    for (const p of st.outPhotons) {
      const { px, py } = pixelPos(p);
      const m = inst.geometry.PHOTON_HALF_EXTENT + 4;
      assert.ok(px > CLIP.x - m && px < CLIP.x + CLIP.w + m, `photon x=${px.toFixed(1)} stays within chamber margin`);
      assert.ok(py > CLIP.y - m && py < CLIP.y + CLIP.h + m, `photon y=${py.toFixed(1)} stays within chamber margin`);
    }
  } else if (sawPhoton && st.phase === 'complete') {
    sawCleared = true; // photon exited & was retired before the loop reset
  }
}
assert.ok(sawPhoton, 'spontaneous photons emitted during continuous run');
assert.ok(sawCleared, 'emitted photon retires after leaving the chamber (no stale photons)');
assert.ok(sawElectronE1, 'electron rests at E₁ after each spontaneous decay');
assert.ok(cycles >= 4, `simulation keeps cycling (${cycles} decay cycles in 30 s)`);

/* ---- 4: statistical lifetime & direction are re-randomized every cycle ---- */
const angles = new Set();
const dwells = [];
for (let i = 0; i < 60; i++) {
  inst.applyPreset('spontaneous');
  assert.equal(st.mode, 'spontaneous');
  const dist = (m) => Math.min(Math.abs(st.spontAngleDeg - m), 360 - Math.abs(st.spontAngleDeg - m));
  assert.ok(dist(0) >= 18 && dist(90) >= 18 && dist(180) >= 18 && dist(270) >= 18,
    `θ=${st.spontAngleDeg}° avoids axis-aligned directions`);
  assert.ok(st.spontDwell >= 0.9 && st.spontDwell <= 2.1, `dwell ${st.spontDwell.toFixed(2)}s in randomized range`);
  angles.add(st.spontAngleDeg);
  dwells.push(st.spontDwell);
}
assert.ok(angles.size > 20, `emission direction varies across cycles (${angles.size} unique of 60)`);
const mean = dwells.reduce((a, b) => a + b, 0) / dwells.length;
const sd = Math.sqrt(dwells.reduce((a, b) => a + (b - mean) ** 2, 0) / dwells.length);
assert.ok(sd > 0.2, `dwell spread across cycles (σ=${sd.toFixed(2)}s)`);
assert.ok(!Number.isNaN(mean), 'dwell mean finite');

/* ---- 6a: stimulated emission stays coherent (regression) ---- */
inst.applyPreset('stimulated');
st.lambda = Math.round(evToNm(st.deltaE)); // resonant
st.phase = 'approach';
st.inPhotonX = 0.40;
st.tPhase = 0;
inst.tick(0.2); // photon reaches atom → stimulated emission
assert.equal(st.phase, 'transition');
assert.equal(st.outPhotons.length, 2, 'incident + stimulated photon pair');
const [p0, p1] = st.outPhotons;
assert.equal(p0.wavelength, st.lambda, 'incident photon keeps its wavelength');
assert.equal(p1.wavelength, st.lambda, 'stimulated twin shares the wavelength');
near(nmToEv(p0.wavelength), st.deltaE, 0.05, 'resonant pair energy ≈ ΔE');
assert.equal(p0.phaseOffset, p1.phaseOffset, 'pair is phase-locked');
assert.equal(p0.dirRad, 0, 'pair travels horizontally');
assert.equal(p1.dirRad, 0, 'pair travels horizontally');
assert.equal(p1.vy, 0, 'no vertical drift for stimulated twins');
near(p0.vx * CHAMBER.w, PHOTON_SPEED_PX, 1e-6, 'stimulated pair at standard pixel speed');
for (const p of st.outPhotons) {
  inst.tick(1 / 60);
  const { px } = pixelPos(p);
  assert.ok(px <= CLIP.x + CLIP.w + inst.geometry.PHOTON_HALF_EXTENT + 4, 'stimulated photons stay in chamber space');
}

/* ---- 6b: absorption regression ---- */
inst.applyPreset('absorption');
st.lambda = Math.round(evToNm(st.deltaE));
st.phase = 'approach';
st.inPhotonX = 0.40;
st.tPhase = 0;
inst.tick(0.2);
assert.equal(st.phase, 'transition', 'resonant photon is absorbed');
inst.tick(0.6);
assert.equal(st.phase, 'complete');
near(st.electronLevel, 2, 1e-9, 'electron promoted to E₂');
assert.equal(st.inPhotonAlive, false, 'photon consumed by absorption');
assert.equal(st.outPhotons.length, 0, 'no emission in absorption');

/* ---- 7: step-by-step flow still walks the full spontaneous cycle ---- */
let stepHandler = null;
Cstub.buildTransport = (_parent, { onStep }) => { stepHandler = onStep; return { setPlaying() {}, playBtn: new FakeNode('button') }; };
const ctx2 = { stage: new FakeNode('div'), controls: new FakeNode('div'), formula: new FakeNode('div'), wrap: new FakeNode('div'), dot: new FakeNode('span') };
const inst2 = window.CH2_SIMS.c2t1(ctx2);
inst2.mount();
inst2.applyPreset('spontaneous');
const s2 = inst2.getState();
assert.equal(s2.phase, 'wait', 'preset arms the excited atom');
stepHandler(); // wait → transition
assert.equal(s2.phase, 'transition', 'step fires the spontaneous decay');
assert.equal(s2.outPhotons.length, 1, 'step mode emits exactly one photon');
const sp = s2.outPhotons[0];
const spvx = sp.vx * CHAMBER.w, spvy = sp.vy * CHAMBER.h;
const spDeg = ((Math.atan2(-spvy, spvx) * 180 / Math.PI) % 360 + 360) % 360;
near(spDeg, s2.spontAngleDeg, 0.05, 'step-mode photon also travels along θ');
stepHandler(); // transition → complete
assert.equal(s2.phase, 'complete');
near(s2.electronLevel, 1, 1e-9, 'electron rests at E₁ after the step transition');
stepHandler(); // complete → ready (re-armed)
assert.equal(s2.phase, 'ready');
stepHandler(); // ready → wait
assert.equal(s2.phase, 'wait');
near(s2.electronLevel, 2, 1e-9, 'atom re-excited for the next cycle');

console.log('Ch2 photon–atom interaction checks passed.');
