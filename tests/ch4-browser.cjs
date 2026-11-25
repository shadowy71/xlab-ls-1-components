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
  console.log('Unit IV browser checks skipped: set CHROME_BIN to a Chromium executable (Node 22+).');
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
  profile = fs.mkdtempSync(path.join(os.tmpdir(), 'quantum-browser-'));
  browser = spawn(executable, ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-zygote', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio:['ignore', 'ignore', 'pipe'] });
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
  await cdp('Page.navigate', { url });
  await wait('!!window.Ch4Platform && !!window.XLab');
  await evaluate('XLab.switchChapter(4)');
  await wait('!!document.querySelector(".q4-visual")');
  const open = async i => { await evaluate(`Ch4Platform.switchTopic(${i})`); await wait('!!document.querySelector(".q4-visual")'); };
  const click = label => evaluate(`[...document.querySelectorAll(".q4-actions button")].find(b => b.textContent === ${JSON.stringify(label)}).click()`);
  for (const width of [390,768,1440]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height:900, deviceScaleFactor:1, mobile:width<500 });
    for (let i=0;i<10;i++) { await open(i); assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth+2'),true, `overflow at ${width}, lab ${i}`); assert.ok(await evaluate('document.querySelector(".q4-visual").children.length > 0')); }
  }
  await open(3); await click('+ H'); await click('Run circuit');
  assert.match(await evaluate('document.querySelector(".q4-visual").textContent'), /50\.0%/);
  await click('Undo gate'); assert.match(await evaluate('document.querySelector(".q4-visual").textContent'), /100\.0%/);
  await open(4); await click('Load Bell circuit'); await click('Run circuit');
  assert.match(await evaluate('document.querySelector(".q4-visual").textContent'), /Entangled pure state/);
  await open(8);
  for (const branch of ['00','01','10','11']) {
    await evaluate(`(()=>{const e=document.querySelector('[data-field="branch"] select');e.value=${JSON.stringify(branch)};e.dispatchEvent(new Event('change',{bubbles:true}))})()`);
    for(let i=0;i<5;i++) await click('Next stage');
    assert.match(await evaluate('document.querySelector(".q4-visual").textContent'), /Fidelity.*1\.000000/);
  }
  // Exercise the actual WebGL adapter, not just its 2D fallback.
  await wait('!!window.XLab3D');
  await evaluate(`window.q4Lifecycle={mounted:0,destroyed:0,positions:[]};const original=window.XLab3D.mount;window.XLab3D.mount=function(...args){const e=original(...args),destroy=e.destroy;e.destroy=()=>{window.q4Lifecycle.destroyed++;destroy()};window.q4Lifecycle.mounted++;window.q4Lifecycle.engine=e;return e}`);
  await open(2); await wait('!!document.querySelector(".q4-scene canvas") || document.querySelector(".q4-scene-zone").hidden');
  const webgl = await evaluate('!!document.querySelector(".q4-scene canvas")');
  if (webgl) {
    const coords = () => evaluate('JSON.parse(document.querySelector(".q4-scene").dataset.bloch)');
    const near = (a,b) => assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);
    await click('|+i⟩'); let p=await coords(); near(p.x,0); near(p.y,1); near(p.z,0);
    // Three.js coordinates map physical (x,y,z) to scene (x,z,-y).
    const arrow = await evaluate(`(()=>{const a=q4Lifecycle.engine.scene.children.find(o=>o.type==='ArrowHelper');return new THREE.Vector3(0,1,0).applyQuaternion(a.quaternion).toArray()})()`);
    near(arrow[0],0);near(arrow[1],0);near(arrow[2],-1);
    const r=await evaluate(`(()=>{let r=document.querySelector('.q4-scene canvas').getBoundingClientRect();return {x:r.x+r.width*.5,y:r.y+r.height*.5}})()`);
    const cameraBefore=await evaluate('q4Lifecycle.engine.camera.position.toArray()');
    await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:r.x,y:r.y,button:'left',buttons:1,clickCount:1});
    await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:r.x+65,y:r.y+25,button:'left',buttons:1});
    await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:r.x+65,y:r.y+25,button:'left',buttons:0,clickCount:1});
    assert.notDeepEqual(await evaluate('q4Lifecycle.engine.camera.position.toArray()'),cameraBefore,'mouse orbit changes camera');
    await click('Apply X gate'); p=await coords(); near(p.y,-1);
    await click('|0⟩'); await click('Measure qubit'); near((await coords()).z,1);
    const before = await evaluate('q4Lifecycle.engine.camera.position.toArray()');
    await evaluate(`document.querySelector('[data-camera=top]').click()`);
    const top = await evaluate('q4Lifecycle.engine.camera.position.toArray()');
    assert.ok(top[1]>5 && Math.abs(top[0])<.01); assert.notDeepEqual(top,before);
    await evaluate(`document.querySelector('[data-camera=in]').click();document.querySelector('[data-camera=perspective]').click();document.querySelector('#themeBtn').click()`);
    await open(3); await wait('!!document.querySelector(".q4-scene canvas")');
    await click('+ H'); await click('Step'); near((await coords()).x,1);
    await click('+ Z'); await click('Run circuit'); near((await coords()).x,-1);
    await evaluate(`document.querySelector('[data-gate="1"][data-edit="left"]').click()`);
    assert.match(await evaluate('document.querySelector(".q4-gate-list").textContent'), /1\. Z/);
    await evaluate(`document.querySelector('[data-gate="0"][data-edit="remove"]').click()`);
    assert.match(await evaluate('document.querySelector(".q4-gate-list").textContent'), /1\. H/);
    await open(9); await wait('!!document.querySelector(".q4-scene canvas")');
    await click('Josephson junction'); assert.match(await evaluate('document.querySelector(".q4-scene-hint").textContent'), /nonlinear/);
    for(const hardware of ['Trapped ion','Photonic','Neutral atom','Spin']) {
      await evaluate(`(()=>{let e=document.querySelector('[data-field=hardware] select');e.value=${JSON.stringify(hardware)};e.dispatchEvent(new Event('change',{bubbles:true}))})()`);
      assert.equal(await evaluate('document.querySelectorAll(".q4-scene canvas").length'),0);
      assert.match(await evaluate('document.querySelector(".q4-hardware-diagram svg").getAttribute("aria-label")'),new RegExp(hardware));
      assert.ok(await evaluate('document.querySelectorAll(".q4-actions button:not([hidden])").length > 0'));
    }
  } else console.log('WebGL unavailable in this Chromium; checked the 2D fallback.');
  await evaluate('XLab.switchChapter(6)'); await wait('!!document.querySelector("#ch6-panel .nano-stage svg")');
  assert.equal(await evaluate('document.querySelectorAll("#ch4-root canvas").length'),0, 'inactive viewer disposed');
  if(webgl)assert.equal(await evaluate('q4Lifecycle.mounted'),await evaluate('q4Lifecycle.destroyed'),'each WebGL scene disposed on switch');
  // Force WebGL creation failure and verify functional 2D fallback and controls.
  await cdp('Page.addScriptToEvaluateOnNewDocument', {source:`(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl'||type==='webgl2'||type==='experimental-webgl')return null;return original.call(this,type,...args)}})()`});
  await cdp('Page.navigate', { url }); await wait('!!window.Ch4Platform && !!window.XLab');
  await evaluate('XLab.switchChapter(4)'); await wait('!!document.querySelector(".q4-visual")'); await open(2);
  await wait('document.querySelector(".q4-scene-zone").hidden && !!document.querySelector(".q4-bloch")');
  await click('|1⟩'); assert.match(await evaluate('document.querySelector(".q4-measure").textContent'),/P\(1\).*100\.0%/);

  assert.deepEqual(errors, []); console.log('Unit IV Chromium checks passed: 10 labs, responsive layout, 3D state linkage, circuit editing, hardware, fallback and Unit VI navigation.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (socket) socket.close();
  if (browser && browser.exitCode === null) { const exited = new Promise(resolve => browser.once('exit', resolve)); browser.kill('SIGTERM'); const timer = setTimeout(() => { if(browser.exitCode===null)browser.kill('SIGKILL'); },2000); await exited; clearTimeout(timer); }
  server.close(); if (profile) fs.rmSync(profile, { recursive:true, force:true });
});
