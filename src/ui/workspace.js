/* Shared, static-host-compatible loaders; no rendering loop lives here. */
(function(){
'use strict';
const scripts=new Map();
function script(url){
 if(!scripts.has(url)){
  const promise=new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=url;el.onload=()=>resolve();el.onerror=()=>{el.remove();reject(new Error('Unable to load '+url))};document.head.append(el)});
  scripts.set(url,promise);promise.catch(()=>scripts.delete(url));
 }
 return scripts.get(url);
}
async function load3D(){await script('src/vendor/three/three.min.js');await script('src/vendor/three/OrbitControls.js');await script('src/visualization/engine.js');return window.XLab3D;}
async function math(root){
 if(!root||!root.querySelector('[data-tex]'))return;
 if(!document.getElementById('xlab-katex-css')){const link=document.createElement('link');link.id='xlab-katex-css';link.rel='stylesheet';link.href='src/vendor/katex/katex.min.css';document.head.append(link)}
 await script('src/vendor/katex/katex.min.js');
 if(!root.isConnected)return;
 root.querySelectorAll('[data-tex]').forEach(el=>{if(el.dataset.rendered)return;window.katex.render(el.dataset.tex,el,{displayMode:el.dataset.display==='true',throwOnError:false,output:'htmlAndMathml'});el.dataset.rendered='true'});
}
function attach3D(stage,options){
 const group=document.createElement('div');group.className='xlab-viewport-group';
 group.innerHTML=`<div class="xlab-viewport-tools"><button type="button" data-view="open" aria-pressed="false">Open 3D view</button><button type="button" data-view="perspective" hidden>Perspective</button><button type="button" data-view="front" hidden>Front</button><button type="button" data-view="top" hidden>Top</button><button type="button" data-view="zoomin" hidden>Zoom in</button><button type="button" data-view="zoomout" hidden>Zoom out</button><button type="button" data-view="fullscreen" hidden>Fullscreen</button></div><div class="xlab-viewport-3d" hidden></div><div class="xlab-inspect" hidden><p></p><div class="xlab-parts"></div><p class="xlab-inspect-detail" aria-live="polite"></p></div><p class="xlab-viewport-status" role="status"></p>`;
 stage.before(group);const host=group.querySelector('.xlab-viewport-3d'),inspect=group.querySelector('.xlab-inspect'),toggle=group.querySelector('[data-view="open"]'),status=group.querySelector('.xlab-viewport-status');
 inspect.querySelector('p').textContent=options.instructions;inspect.querySelector('.xlab-inspect-detail').textContent='Select a component to inspect it.';
 let viewer=null,serial=0,dead=false,lastPayload;
 function close(message){serial++;if(viewer)viewer.engine.destroy();viewer=null;host.hidden=true;inspect.hidden=true;group.querySelectorAll('[data-view]:not([data-view="open"])').forEach(b=>b.hidden=true);toggle.disabled=false;toggle.textContent=options.openLabel||'Open 3D view';toggle.setAttribute('aria-pressed','false');status.textContent=message||''}
 toggle.textContent=options.openLabel||'Open 3D view';
 toggle.onclick=async()=>{if(viewer){close();return}const token=++serial;toggle.disabled=true;status.textContent='Loading 3D viewer…';try{
  await load3D();await script(options.script);if(dead||token!==serial)return;host.hidden=false;
  viewer=options.mount(host,(part,text)=>{group.querySelector('.xlab-inspect-detail').textContent=part+': '+text},()=>close('WebGL context lost. The 2D view remains available; reopen 3D to retry.'));
  inspect.hidden=false;group.querySelectorAll('[data-view]:not([data-view="open"])').forEach(b=>b.hidden=false);toggle.textContent=options.closeLabel||'Close 3D view';toggle.setAttribute('aria-pressed','true');toggle.disabled=false;status.textContent='3D view active. The original 2D analysis remains below.';viewer.engine.update(lastPayload||options.snapshot());
 }catch(err){if(!dead&&token===serial)close('3D unavailable on this device. The 2D analysis remains available.')}};
 group.querySelectorAll('[data-view]:not([data-view="open"])').forEach(button=>button.onclick=()=>{if(!viewer)return;const v=button.dataset.view;if(v==='fullscreen'){if(group.requestFullscreen)group.requestFullscreen().catch(()=>{status.textContent='Fullscreen is unavailable.'});else status.textContent='Fullscreen is unavailable.'}else if(v==='zoomin'||v==='zoomout')viewer.engine.zoom(v==='zoomin'?.8:1.25);else viewer.engine.preset(v)});
 (options.parts||[]).forEach(part=>{const button=document.createElement('button');button.type='button';button.textContent=part;button.onclick=()=>{if(viewer)viewer.select(part)};inspect.querySelector('.xlab-parts').append(button)});
 return {update(payload){lastPayload=payload;if(viewer)viewer.engine.update(payload)},play(){if(viewer)viewer.engine.play()},pause(){if(viewer)viewer.engine.pause()},reset(){if(viewer)viewer.engine.reset()},destroy(){dead=true;close();group.remove()}};
}
window.XLabWorkspace={load3D,math,script,attach3D};
})();
