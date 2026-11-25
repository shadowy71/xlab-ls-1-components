'use strict';
// Optional real-browser regression suite, using only Node's built-in CDP/WebSocket APIs.
// CHROME_BIN=/path/to/chromium node tests/ch6-browser.cjs (Node 22+).
// Chromium is test tooling, not an application dependency; no downloaded artifacts enter Git.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const executable = [process.env.CHROME_BIN, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find(p => p && fs.existsSync(p));
if (!executable) {
  console.log('Unit VI browser checks skipped: set CHROME_BIN to a Chromium executable (Node 22+).');
  process.exit(0);
}

const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml' };
const server = http.createServer((req, res) => {
  const relative = new URL(req.url, 'http://test').pathname;
  const file = path.resolve(root, '.' + (relative === '/' ? '/index.html' : relative));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type':mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' });
  fs.createReadStream(file).pipe(res);
});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser, socket, profile;
async function main() {
  await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nano-browser-'));
  browser = spawn(executable, ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio:['ignore', 'ignore', 'pipe'] });
  const endpoint = await new Promise((resolve, reject) => {
    let log = '';
    const timer = setTimeout(() => reject(new Error('Chromium startup timed out: ' + log)), 15000);
    browser.once('error', error => { clearTimeout(timer); reject(error); });
    browser.once('exit', code => { clearTimeout(timer); reject(new Error(`Chromium exited (${code}): ${log}`)); });
    browser.stderr.on('data', chunk => {
      log += chunk;
      const match = log.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map(), errors = [];
  socket.onmessage = event => {
    const data = JSON.parse(event.data);
    if (data.id) {
      const request = pending.get(data.id);
      if (!request) return;
      pending.delete(data.id); clearTimeout(request.timer);
      if (data.error) request.reject(new Error(data.error.message)); else request.resolve(data.result);
    } else if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text + ': ' + (data.params.exceptionDetails.exception?.description || ''));
  };
  function send(method, params = {}, sessionId) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timed out: ' + method)); }, 15000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  const { targetId } = await send('Target.createTarget', { url:'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten:true });
  const cdp = (method, params) => send(method, params, sessionId);
  async function evaluate(expression) {
    // Isolate snippet-local const/let declarations without hiding explicit window state.
    const result = await cdp('Runtime.evaluate', { expression:`(() => eval(${JSON.stringify(expression)}))()`, returnByValue:true, awaitPromise:true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  async function wait(expression) {
    for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await delay(50); }
    throw new Error('Browser condition timed out: ' + expression);
  }
  await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('Network.enable');
  await cdp('Network.setCacheDisabled', { cacheDisabled:true });
  await cdp('Emulation.setDeviceMetricsOverride', { width:1440, height:1000, deviceScaleFactor:1, mobile:false });
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source:`
    // Drive the existing animation loop explicitly for deterministic process assertions.
    const nativeRAF = window.requestAnimationFrame.bind(window);
    window.nanoNativeRAF = nativeRAF;
    window.requestAnimationFrame = callback => callback.name === 'animate' ? 0 : nativeRAF(callback);
    const media = window.matchMedia.bind(window);
    window.nanoListenerCount = 0;
    window.matchMedia = query => {
      const result = media(query), add = result.addEventListener.bind(result), remove = result.removeEventListener.bind(result);
      result.addEventListener = (type, fn, ...args) => { if (fn.name === 'motionChanged') window.nanoListenerCount++; add(type, fn, ...args); };
      result.removeEventListener = (type, fn, ...args) => { if (fn.name === 'motionChanged') window.nanoListenerCount--; remove(type, fn, ...args); };
      return result;
    };
  ` });
  await cdp('Page.navigate', { url });
  await wait('!!window.Ch6Platform && !!window.XLab');
  assert.equal(await evaluate('!!window.NanoModels'), false, 'models should be lazy-loaded');
  await evaluate(`document.querySelector('[data-chapter="6"]').click()`);
  await wait('!!document.querySelector("#ch6-panel .nano-stage svg")');
  await evaluate(`window.nanoTest = {
    root:document.getElementById('ch6-panel'),
    input(key, value) { const e = this.root.querySelector('#nano-' + key); e.value = String(value); e.dispatchEvent(new Event('input', { bubbles:true })); },
    text() { return this.root.querySelector('.nano-readouts').textContent; },
    play() { this.root.querySelector('[data-action=play]').click(); },
    reset() { [...this.root.querySelectorAll('.nano-actions button')].find(b => b.textContent === 'Reset').click(); },
    tick(count, dt = .1) { for (let i = 0; i < count; i++) window.Ch6Platform.tick(dt); },
    audit() {
      const issues = [];
      this.root.querySelectorAll('.nano-stage svg').forEach(svg => {
        const vb = svg.viewBox.baseVal;
        svg.querySelectorAll('*').forEach(node => { [...node.attributes].forEach(a => { if (/NaN|Infinity|undefined/.test(a.value)) issues.push('Invalid SVG ' + a.name); }); });
        const labels = [...svg.querySelectorAll('text')].map(e => ({ text:e.textContent, box:e.getBBox() })).filter(e => e.box.width);
        labels.forEach(({ text, box:b }) => { if (b.x < -.5 || b.y < -.5 || b.x + b.width > vb.width + .5 || b.y + b.height > vb.height + .5) issues.push('Clipped label: ' + text); });
        for (let a = 0; a < labels.length; a++) for (let b = a + 1; b < labels.length; b++) {
          const x = labels[a].box, y = labels[b].box;
          if (Math.min(x.x + x.width, y.x + y.width) - Math.max(x.x, y.x) > 3 && Math.min(x.y + x.height, y.y + y.height) - Math.max(x.y, y.y) > 3) issues.push('Overlapping labels: ' + labels[a].text + ' / ' + labels[b].text);
        }
      });
      if (/NaN|Infinity|undefined/.test(this.text())) issues.push('Invalid readings');
      return issues;
    }
  }`);
  const open = async id => { await evaluate(`Ch6Platform.switchTopic(${id})`); await wait('document.querySelector("#ch6-panel .nano-stage").getAttribute("aria-busy") === "false"'); };
  const input = (key, value) => evaluate(`nanoTest.input(${JSON.stringify(key)}, ${JSON.stringify(value)})`);
  const text = () => evaluate('nanoTest.text()');
  const reset = () => evaluate('nanoTest.reset()');
  const tick = (count, dt = .1) => evaluate(`nanoTest.tick(${count}, ${dt})`);
  const play = () => evaluate('nanoTest.play()');
  async function audit(label) { assert.deepEqual(await evaluate('nanoTest.audit()'), [], label); }
  async function key(key, code) {
    await cdp('Input.dispatchKeyEvent', { type:'keyDown', key, code:key, windowsVirtualKeyCode:code });
    await cdp('Input.dispatchKeyEvent', { type:'keyUp', key, code:key, windowsVirtualKeyCode:code });
  }

  for (let i = 0; i < 8; i++) {
    await open(i); await audit('Lab ' + i);
    assert.equal(await evaluate('nanoListenerCount'), 1, 'exactly one active lab media listener');
    const rangeKeys = await evaluate('[...nanoTest.root.querySelectorAll("input[type=range]")].filter(e => e.id !== "nano-prep-progress").map(e => [e.id.slice(5), Number(e.min), Number(e.max)])');
    for (const [name, min, max] of rangeKeys) for (const value of [min, (min + max) / 2, max]) { await input(name, value); await audit(`Lab ${i}, ${name}=${value}`); }
    await reset();
    assert.equal(await evaluate('document.activeElement.textContent'), 'Reset', 'reset retains focus');
    if ([0, 2, 3, 4, 5, 6, 7].includes(i)) {
      if (i === 2) await input('mode', 'Electrical');
      await play(); await tick(10); await play();
      const paused = await text(); await tick(10); assert.equal(await text(), paused, 'pause must stop progress');
      await reset();
    }
  }
  await open(0); await input('r', 10);
  assert.match(await text(), /A\/V = 0\.300/); assert.match(await text(), /Area gain = 5\.0×/);
  await input('r', 50); await evaluate('document.getElementById("nano-r").focus()'); await key('ArrowLeft', 37);
  assert.match(await text(), /r = 49\.0 nm/, 'native slider keyboard operation');

  await open(1); await input('excite', 'Ground state'); await audit('Ground state');
  for (const mode of ['Optical', 'Electrical', 'Mechanical', 'Magnetic']) {
    await open(2); await input('mode', mode); await audit(mode);
    for (const drive of [-1, 0, 1]) { await input('drive', drive); await audit(mode + ' drive ' + drive); }
  }
  await input('drive', 0); assert.match(await text(), /Magnetization = 0\.64/);
  await input('branch', 'Increasing from −H'); assert.match(await text(), /Magnetization = -0\.64/);
  await input('size', 5); assert.match(await text(), /Magnetization = 0\.00/);
  for (const speed of ['0.5×', '1×', '2×', '4×']) {
    await open(3); await input('playback', speed); await play(); await tick(10);
    assert.match(await text(), new RegExp('Elapsed = ' + (2 * parseFloat(speed)).toFixed(1).replace('.', '\\.') + ' min'));
  }
  await open(4); await input('time', 20); await input('rate', 1.5); assert.match(await text(), /Thickness = 30\.0 nm/);
  await input('mode', 'Sputtering'); await audit('Sputtering');
  await open(5);
  for (let stage = 2; stage <= 7; stage++) {
    await evaluate('[...nanoTest.root.querySelectorAll("button")].find(b => b.textContent === "Next stage").click()');
    assert.match(await text(), new RegExp('Stage = ' + stage + ' of 7')); await audit('Synthesis stage ' + stage);
  }
  await play(); assert.match(await text(), /Progress = 0%/, 'completed synthesis can replay');

  for (const interval of [1, 5]) {
    await open(6); await input('interval', interval); await play(); await tick(10, .5);
    assert.match(await text(), /Current response = 16\.9%/); assert.match(await text(), /Last sample = 5\.0 s/);
    await input('conc', 0); await tick(40, .5); assert.match(await text(), /Current response = 0\.3%/);
  }
  await input('mode', 'Optical'); await audit('Optical sensor');
  await open(7); await play(); await tick(4, 1); assert.match(await text(), /Photon = emitted/);
  await play(); assert.match(await text(), /Photon = not emitted/, 'emission sequence can replay');
  await input('mode', 'Photodetection'); await input('L', 1); await input('wave', 500); await play(); await tick(4, 1);
  assert.match(await text(), /Model output = off/); await input('wave', 200); assert.match(await text(), /Model output = on/);
  for (const domain of ['Medicine', 'Energy', 'Automobile', 'Space', 'Defence']) {
    await input('mode', domain);
    for (let example = 1; example <= 4; example++) { await input('example', String(example)); await audit(domain + ' example ' + example); }
    assert.equal(await evaluate('nanoTest.root.querySelector("[data-action=play]").hidden'), true);
    assert.ok(await evaluate('!!nanoTest.root.querySelector(".nano-comparison")'));
  }

  // Roving topic tabs, both horizontal and vertical arrow keys, then control focus.
  await open(0); await evaluate('document.getElementById("ch6-topic-0").focus()');
  for (const [name, code, destination] of [['ArrowRight', 39, 1], ['ArrowDown', 40, 2], ['End', 35, 7], ['Home', 36, 0], ['ArrowLeft', 37, 7], ['ArrowUp', 38, 6]]) {
    await key(name, code);
    assert.equal(await evaluate('document.activeElement.id'), 'ch6-topic-' + destination);
    assert.equal(await evaluate('document.querySelectorAll("#pillBar [tabindex=\\"0\\"]").length'), 1);
  }
  await open(4); await evaluate('nanoTest.root.querySelector(".nano-crosslinks [data-lab=\\"3\\"]").click()');
  await wait('!!document.querySelector(".nano-prep-grid")');
  assert.equal(await evaluate('document.activeElement.tagName'), 'H2');
  for (const mode of ['Compare both', 'Top-down', 'Bottom-up']) {
    await evaluate(`const selector = document.getElementById('nano-prep-mode'); selector.value = ${JSON.stringify(mode)}; selector.dispatchEvent(new Event('change')); const slider = document.getElementById('nano-prep-progress'); slider.value = '100'; slider.dispatchEvent(new Event('input'));`);
  }
  await evaluate('nanoTest.root.querySelector(".nano-prep-grid [data-lab=\\"5\\"]").click()'); await wait('!!document.getElementById("nano-prec")');
  assert.match(await text(), /Stage = 1 of 7/);
  await evaluate('nanoTest.root.querySelector(".nano-crosslinks [data-lab=\\"4\\"]").click()'); await wait('!!document.getElementById("nano-rate")');

  for (const width of [320, 390, 768, 1024, 1440]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height:1000, deviceScaleFactor:1, mobile:false });
    await delay(30);
    for (let i = 0; i < 8; i++) {
      await open(i);
      const layout = await evaluate(`({ overflow:document.documentElement.scrollWidth > innerWidth + 1, controls:[...nanoTest.root.querySelectorAll('.nano-control:not([hidden]) input, .nano-control:not([hidden]) select')].every(e => { const r = e.getBoundingClientRect(); return r.width > 100 && r.left >= 0 && r.right <= innerWidth + 1; }) })`);
      assert.equal(layout.overflow, false, `page overflow, ${width}px lab ${i}`);
      assert.equal(layout.controls, true, `clipped controls, ${width}px lab ${i}`);
    }
  }
  await cdp('Emulation.setDeviceMetricsOverride', { width:390, height:844, deviceScaleFactor:1, mobile:false });
  await open(4); await play();
  await evaluate('const wrap = nanoTest.root.querySelector(".nano-viz"); nanoTest.panRegion = wrap; wrap.scrollLeft = 200; wrap.focus()');
  await tick(5);
  assert.equal(await evaluate('nanoTest.root.querySelector(".nano-viz") === nanoTest.panRegion'), true, 'animation retains the native scroll region');
  assert.equal(await evaluate('nanoTest.root.querySelector(".nano-viz").scrollLeft'), 200, 'animation preserves a panned diagram');
  assert.equal(await evaluate('document.activeElement.className'), 'nano-viz', 'animation preserves diagram focus');
  await evaluate('document.body.classList.add("light")'); await audit('Light theme');

  // Runtime reduced-motion changes remove ornamental motion but retain explicit process progress.
  await cdp('Emulation.setEmulatedMedia', { features:[{ name:'prefers-reduced-motion', value:'reduce' }] }); await delay(80);
  await open(3); await play();
  const ballPositions = await evaluate('[...nanoTest.root.querySelector("svg").querySelectorAll("circle")].map(e => [e.getAttribute("cx"), e.getAttribute("cy")])');
  await tick(10);
  assert.deepEqual(await evaluate('[...nanoTest.root.querySelector("svg").querySelectorAll("circle")].map(e => [e.getAttribute("cx"), e.getAttribute("cy")])'), ballPositions);
  assert.doesNotMatch(await text(), /Elapsed = 0\.0 min/);
  await open(2); await input('mode', 'Electrical'); await play();
  const still = await evaluate('nanoTest.root.querySelector("svg").outerHTML'); await tick(10);
  assert.equal(await evaluate('nanoTest.root.querySelector("svg").outerHTML'), still);
  await cdp('Emulation.setEmulatedMedia', { features:[{ name:'prefers-reduced-motion', value:'no-preference' }] }); await delay(80); await tick(10);
  assert.notEqual(await evaluate('nanoTest.root.querySelector("svg").outerHTML'), still);

  // Invalid navigation and stale async mounts must not create renderers or leak listeners.
  const title = await evaluate('nanoTest.root.querySelector("h2").textContent');
  await evaluate('Ch6Platform.switchTopic(-1); Ch6Platform.switchTopic(99); Ch6Platform.switchTopic(NaN)');
  assert.equal(await evaluate('nanoTest.root.querySelector("h2").textContent'), title);
  await evaluate('XLab.switchChapter(1)'); assert.equal(await evaluate('nanoListenerCount'), 0);
  await evaluate('XLab.switchChapter(6); Ch6Platform.switchTopic(4); Ch6Platform.switchTopic(5); XLab.switchChapter(1)'); await delay(50);
  assert.equal(await evaluate('nanoListenerCount'), 0);
  await evaluate('XLab.switchChapter(6)'); await wait('!!document.getElementById("nano-prec")');
  assert.equal(await evaluate('nanoListenerCount'), 1);
  for (const chapter of [2, 3, 5, 1, 6]) {
    await evaluate(`XLab.switchChapter(${chapter})`); await delay(100);
  }
  assert.equal(await evaluate('document.querySelectorAll("#ch6-panel").length'), 1);
  assert.equal(await evaluate('nanoListenerCount'), 1);

  // A failed lazy request can be retried in the same chapter, without refreshing the course.
  await cdp('Network.setBlockedURLs', { urls:['*src/ch6/models.js'] });
  await cdp('Page.navigate', { url }); await wait('!!window.Ch6Platform && !!window.XLab');
  await evaluate('XLab.switchChapter(6)'); await wait('!!document.querySelector("#ch6-panel .nano-retry")');
  await cdp('Network.setBlockedURLs', { urls:[] });
  await evaluate('document.querySelector("#ch6-panel .nano-retry").click()');
  await wait('!!document.querySelector("#ch6-panel .nano-stage svg")');
  assert.equal(await evaluate('nanoListenerCount'), 1);
  // Finally exercise the actual index.html -> Ch6Platform.tick bridge, not a test-only loop.
  await evaluate('window.requestAnimationFrame = nanoNativeRAF; nanoNativeRAF(animate); document.querySelector("#ch6-panel [data-action=play]").click()');
  await delay(400);
  assert.doesNotMatch(await evaluate('document.querySelector("#ch6-panel .nano-readouts").textContent'), /^r = 50\.0 nm/);
  assert.deepEqual(errors, [], 'uncaught browser errors');
  console.log('Unit VI Chromium checks passed: 8 labs, all modes/controls, calculations, stages, play/pause/replay, keyboard, 5 viewport widths, light theme, reduced motion, cleanup, lazy-load retry and native animation loop.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (socket) socket.close();
  if (browser && browser.exitCode === null) {
    const exited = new Promise(resolve => browser.once('exit', resolve));
    browser.kill('SIGTERM');
    const timer = setTimeout(() => { if (browser.exitCode === null) browser.kill('SIGKILL'); }, 2000);
    await exited; clearTimeout(timer);
  }
  server.close();
  if (profile) fs.rmSync(profile, { recursive:true, force:true });
});
