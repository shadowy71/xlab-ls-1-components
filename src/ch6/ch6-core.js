(function(){
'use strict';
const topics=[
 ['Scale','Nano-Scale Explorer','Introduction & surface-to-volume ratio'],
 ['Quantum','Quantum Confinement Laboratory','Quantum confinement and size-dependent emission'],
 ['Properties','Nanomaterial Properties Laboratory','Optical, electrical, mechanical and magnetic properties'],
 ['Ball mill','High-Energy Ball Milling','Top-down physical preparation'],
 ['PVD','Physical Vapour Deposition','Bottom-up physical deposition'],
 ['Gold colloid','Gold Nanoparticle Synthesis','Chemical preparation: colloidal route'],
 ['Sensors','Nanosensor Laboratory','Surface-sensitive detection'],
 ['Applications','Nano-Optoelectronics & Applications','Devices and applications']
];
let visible=false, active=0, panel, instance, loading, serial=0;
function load(){if(!loading) loading=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='src/ch6/models.js';s.onload=()=>{const lab=document.createElement('script');lab.src='src/ch6/labs.js';lab.onload=resolve;lab.onerror=reject;document.head.append(lab)};s.onerror=reject;document.head.append(s)});return loading;}
function renderPills(){const bar=document.getElementById('pillBar');bar.innerHTML='';bar.setAttribute('aria-label','Unit VI topics');topics.forEach((t,i)=>{const b=document.createElement('button');b.className='pill'+(i===active?' active':'');b.textContent=t[0];b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-selected',String(i===active));b.setAttribute('aria-controls','ch6-panel');b.tabIndex=i===active?0:-1;b.onclick=()=>open(i);bar.append(b);});}
function open(i){active=i;renderPills();if(instance)instance.destroy();instance=null;const token=++serial;const t=topics[i];panel.innerHTML=`<div class="panel-head"><div class="panel-head-row"><div><h2>6.${i+1} ${t[1]}</h2><p>${t[2]}</p></div></div></div><div class="workspace"><div class="sim-grid"><div class="canvas-wrap"><div class="canvas-title"><span>${t[1]}</span><span class="live-dot">Interactive</span></div><div class="nano-stage">Loading laboratory…</div></div><div class="controls-pane"><div class="controls-head"><h3>Experiment controls</h3></div><div class="controls nano-controls"></div></div></div><div class="formula-bar nano-readouts"></div></div><details class="nano-theory"><summary>Theory &amp; model notes</summary><div class="nano-notes"></div></details>`;load().then(()=>{if(visible&&token===serial)instance=window.Ch6Labs.create(i,panel);}).catch(()=>{if(token===serial)panel.querySelector('.nano-stage').textContent='Unable to load the laboratory. Check that src/ch6/labs.js is available.'});}
function mount(){visible=true;if(!panel){panel=document.createElement('section');panel.id='ch6-panel';panel.className='panel ch6-panel';panel.setAttribute('role','tabpanel');document.getElementById('main').append(panel)}panel.classList.add('active');open(active)}
function unmount(){visible=false;serial++;if(instance)instance.destroy();instance=null;if(panel)panel.classList.remove('active')}
function handleKeydown(e){if(!e.target.matches('#pillBar [role=tab]'))return;let n=active;if(e.key==='ArrowRight')n=(active+1)%topics.length;else if(e.key==='ArrowLeft')n=(active+topics.length-1)%topics.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=topics.length-1;else return;e.preventDefault();open(n);document.querySelectorAll('#pillBar [role=tab]')[n].focus()}
window.Ch6Platform={mount,unmount,handleKeydown,switchTopic:open,tick(dt){if(instance)instance.tick(dt)},resize(){}};
})();
