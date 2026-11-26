/* The host owns the sole animation loop. Adapters update model-linked geometry;
   this engine renders on demand and never starts requestAnimationFrame. */
(function(){
'use strict';
function mount(host, options={}){
 const T=window.THREE;
 let dead=false,lost=false,playing=false,adapter=null;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(38,1,.05,100);
 camera.position.set(4,3,6);
 const renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
 renderer.outputEncoding=T.sRGBEncoding;
 renderer.domElement.setAttribute('aria-label',options.label||'Interactive 3D experiment');
 renderer.domElement.setAttribute('tabindex','0');
 host.append(renderer.domElement);
 const controls=new T.OrbitControls(camera,renderer.domElement);
 controls.enableDamping=false;controls.enablePan=true;controls.minDistance=2.8;controls.maxDistance=14;
 controls.target.set(0,0,0);controls.update();
 scene.add(new T.HemisphereLight(0xddeeff,0x495769,1.15));
 const key=new T.DirectionalLight(0xffffff,1.1);key.position.set(4,6,7);scene.add(key);
 const fill=new T.DirectionalLight(0x91b7c5,.45);fill.position.set(-4,1,-3);scene.add(fill);
 function render(){if(!dead&&!lost&&!document.hidden&&host.isConnected)renderer.render(scene,camera)}
 controls.addEventListener('change',render);
 function resize(){if(dead)return;const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();render()}
 const observer=new ResizeObserver(resize);observer.observe(host);
 function onLost(event){event.preventDefault();lost=true;if(options.onContextLost)options.onContextLost()}
 function onRestored(){if(dead)return;lost=false;resize()}
 renderer.domElement.addEventListener('webglcontextlost',onLost);renderer.domElement.addEventListener('webglcontextrestored',onRestored);
 function onVisibility(){if(!document.hidden)render()}document.addEventListener('visibilitychange',onVisibility);
 function preset(name){if(dead)return;if(name==='front')camera.position.set(0,0,7);else if(name==='top')camera.position.set(0,7,.01);else camera.position.set(4,3,6);controls.target.set(0,0,0);controls.update();render()}
 function dispose(){
  if(dead)return;dead=true;observer.disconnect();document.removeEventListener('visibilitychange',onVisibility);
  renderer.domElement.removeEventListener('webglcontextlost',onLost);renderer.domElement.removeEventListener('webglcontextrestored',onRestored);
  controls.removeEventListener('change',render);controls.dispose();if(adapter&&adapter.destroy)adapter.destroy();
  const geometries=new Set(),materials=new Set(),textures=new Set();
  scene.traverse(obj=>{if(obj.geometry)geometries.add(obj.geometry);const mats=Array.isArray(obj.material)?obj.material:[obj.material];mats.filter(Boolean).forEach(m=>{materials.add(m);Object.values(m).forEach(v=>{if(v&&v.isTexture)textures.add(v)})})});
  textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
 }
 const api={scene,camera,renderer,controls,render,resize,preset,
  setAdapter(value){adapter=value},zoom(factor){if(dead)return;const offset=camera.position.clone().sub(controls.target).multiplyScalar(factor);const length=offset.length();offset.setLength(Math.max(controls.minDistance,Math.min(controls.maxDistance,length)));camera.position.copy(controls.target).add(offset);controls.update();render()},update(state){if(dead)return;if(adapter&&adapter.update)adapter.update(state);render()},
  play(){playing=true},pause(){playing=false},reset(){if(adapter&&adapter.reset)adapter.reset();preset('perspective')},destroy:dispose,
  get playing(){return playing}};
 resize();return api;
}
window.XLab3D={mount};
})();
