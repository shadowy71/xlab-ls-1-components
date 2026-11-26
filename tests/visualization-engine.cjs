'use strict';
// Dependency-free contract test of the shared host-driven lifecycle and disposal.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
let rendererCount=0,disposed=0,contextLoss=0,renders=0,observers=0;
class Events {constructor(){this.listeners={}} addEventListener(n,f){(this.listeners[n]||=[]).push(f)} removeEventListener(n,f){this.listeners[n]=(this.listeners[n]||[]).filter(v=>v!==f)} emit(n,event={}){for(const f of [...(this.listeners[n]||[])])f(event)}}
class Vector{constructor(){this.x=0;this.y=0;this.z=0}set(x,y,z){Object.assign(this,{x,y,z});return this}clone(){return Object.assign(new Vector(),this)}sub(){return this}multiplyScalar(){return this}length(){return 5}setLength(){return this}copy(){return this}add(){return this}}
class Scene{constructor(){this.children=[]}add(x){this.children.push(x)}traverse(fn){this.children.forEach(fn)}}
class Camera{constructor(){this.position=new Vector()}updateProjectionMatrix(){}}
class Renderer{constructor(){rendererCount++;this.domElement=new Events();this.domElement.setAttribute=()=>{};this.domElement.remove=()=>{};}setPixelRatio(){}setSize(){}render(){renders++}dispose(){disposed++}forceContextLoss(){contextLoss++}}
class Controls extends Events{constructor(){super();this.target=new Vector()}update(){}dispose(){this.disposed=true}}
class Light{constructor(){this.position=new Vector()}}
class Observer{constructor(){observers++}observe(){}disconnect(){observers--}}
const document=new Events();document.hidden=false;const host={clientWidth:500,clientHeight:300,isConnected:true,append(){}};
const context={window:{THREE:{Scene,PerspectiveCamera:Camera,WebGLRenderer:Renderer,OrbitControls:Controls,HemisphereLight:Light,DirectionalLight:Light,sRGBEncoding:1},devicePixelRatio:3},document,ResizeObserver:Observer,requestAnimationFrame(){throw Error('engine must not start a loop')}};
vm.runInNewContext(fs.readFileSync('src/visualization/engine.js','utf8'),context);
for(let i=0;i<3;i++){
 let lost=0,updated=0,adapterDisposed=0,geometryDisposed=0,materialDisposed=0;
 const engine=context.window.XLab3D.mount(host,{onContextLost(){lost++}});
 const geometry={dispose(){geometryDisposed++}},material={dispose(){materialDisposed++}};
 engine.scene.add({geometry,material});engine.scene.add({geometry,material});
 engine.setAdapter({update(){updated++},destroy(){adapterDisposed++}});
 engine.update({});assert.equal(updated,1);engine.play();assert.equal(engine.playing,true);engine.pause();assert.equal(engine.playing,false);
 const prev=renders;document.hidden=true;engine.update({});assert.equal(renders,prev);document.hidden=false;document.emit('visibilitychange');assert.ok(renders>prev);
 let prevented=false;engine.renderer.domElement.emit('webglcontextlost',{preventDefault(){prevented=true}});assert.equal(lost,1);assert.ok(prevented);
 engine.destroy();engine.destroy();assert.equal(adapterDisposed,1);assert.equal(geometryDisposed,1);assert.equal(materialDisposed,1);assert.equal(observers,0);
}
assert.equal(rendererCount,3);assert.equal(disposed,3);assert.equal(contextLoss,3);
console.log('Visualization lifecycle and disposal checks passed.');
