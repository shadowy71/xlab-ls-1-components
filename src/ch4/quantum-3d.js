/* Model-linked 3D adapters. The shared engine renders on demand; no animation loop. */
(function(){
'use strict';
function mountBloch(host,onPick,onHover,onLost){
 const T=window.THREE,E=window.XLab3D.mount(host,{label:'Interactive three-dimensional Bloch sphere. Drag to orbit, scroll to zoom, click the sphere to set a state.',onContextLost:onLost}),scene=E.scene;
 const lineMat=new T.LineBasicMaterial({color:0x849aa8,transparent:true,opacity:.42}),axisMat=new T.LineBasicMaterial({color:0xacc4d0,transparent:true,opacity:.7});
 function line(points,material=lineMat){let o=new T.Line(new T.BufferGeometry().setFromPoints(points),material);scene.add(o);return o}
 function circle(fn,material=lineMat){let points=[];for(let i=0;i<=128;i++)points.push(fn(i*Math.PI*2/128));return line(points,material)}
 const transparent=new T.Mesh(new T.SphereGeometry(1.55,48,32),new T.MeshBasicMaterial({color:0x9ac6d3,transparent:true,opacity:.045,side:T.DoubleSide,depthWrite:false}));scene.add(transparent);
 for(const latitude of [-Math.PI/3,-Math.PI/6,0,Math.PI/6,Math.PI/3])circle(a=>new T.Vector3(1.55*Math.cos(latitude)*Math.cos(a),1.55*Math.sin(latitude),1.55*Math.cos(latitude)*Math.sin(a)),latitude===0?axisMat:lineMat);
 for(let i=0;i<6;i++){let a=i*Math.PI/6;circle(t=>new T.Vector3(1.55*Math.cos(t)*Math.cos(a),1.55*Math.sin(t),1.55*Math.cos(t)*Math.sin(a)))}
 const labels=[];
 function label(text,pos){let canvas=document.createElement('canvas');canvas.width=256;canvas.height=80;let ctx=canvas.getContext('2d');ctx.fillStyle='rgba(24,40,52,.72)';ctx.fillRect(48,13,160,52);ctx.font='bold 35px sans-serif';ctx.textAlign='center';ctx.fillStyle='#d7e9f1';ctx.fillText(text,128,51);let sprite=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(canvas),transparent:true,depthTest:false}));sprite.position.copy(pos);sprite.scale.set(.60,.19,1);sprite.userData.label=text;scene.add(sprite);labels.push(sprite)}
 const axes=[['X',new T.Vector3(1.75,0,0)],['Y',new T.Vector3(0,0,-1.75)],['Z',new T.Vector3(0,1.75,0)]];
 axes.forEach(([name,p])=>{line([p.clone().multiplyScalar(-1),p],axisMat);label(name,p.clone().multiplyScalar(1.13))});
 [['|0⟩',0,1.75,0],['|1⟩',0,-1.75,0],['|+⟩',1.8,0,0],['|−⟩',-1.8,0,0],['|+i⟩',0,0,-1.8],['|−i⟩',0,0,1.8]].forEach(([s,x,y,z])=>label(s,new T.Vector3(x,y,z)));
 const arrow=new T.ArrowHelper(new T.Vector3(0,1,0),new T.Vector3(),1.55,0xe8ae74,.23,.12);scene.add(arrow);
 label('θ',new T.Vector3(.33,.48,0));label('φ',new T.Vector3(.65,.05,-.3));
 const thetaLine=line([],new T.LineBasicMaterial({color:0xd9aa72})),phiLine=line([],new T.LineBasicMaterial({color:0x70cedd}));
 function setLine(obj,points){obj.geometry.dispose();obj.geometry=new T.BufferGeometry().setFromPoints(points)}
 function update(state){const p=window.QuantumEngine.bloch(state),dir=new T.Vector3(p.x,p.z,-p.y).normalize();arrow.setDirection(dir);const theta=Math.acos(Math.max(-1,Math.min(1,p.z))),phi=Math.atan2(p.y,p.x),tp=[],pp=[];for(let i=0;i<=48;i++){let t=theta*i/48,f=phi*i/48;tp.push(new T.Vector3(.42*Math.sin(t)*Math.cos(phi),.42*Math.cos(t),-.42*Math.sin(t)*Math.sin(phi)));pp.push(new T.Vector3(.62*Math.cos(f),0,-.62*Math.sin(f)))}setLine(thetaLine,tp);setLine(phiLine,pp);host.dataset.bloch=JSON.stringify(p)}
 const ray=new T.Raycaster(),point=new T.Vector2();let down=null;
 function pos(e){let r=E.renderer.domElement.getBoundingClientRect();point.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(point,E.camera)}
 function move(e){pos(e);let hit=ray.intersectObjects(labels);onHover(hit.length?hit[0].object.userData.label:'Drag to orbit · Click the sphere to prepare a state');}
 function start(e){down={x:e.clientX,y:e.clientY}}
 function end(e){if(!down||Math.hypot(down.x-e.clientX,down.y-e.clientY)>4){down=null;return}down=null;pos(e);let hit=ray.intersectObject(transparent)[0];if(hit){let v=hit.point.clone().normalize();onPick(Math.acos(Math.max(-1,Math.min(1,v.y))),(Math.atan2(-v.z,v.x)+Math.PI*2)%(Math.PI*2))}}
 let canvas=E.renderer.domElement;canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerdown',start);canvas.addEventListener('pointerup',end);
 const responsive=new ResizeObserver(()=>{E.camera.fov=host.clientWidth<430?46:38;E.camera.updateProjectionMatrix();E.render()});responsive.observe(host);
 E.setAdapter({update,destroy(){responsive.disconnect();canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerdown',start);canvas.removeEventListener('pointerup',end)}});E.camera.position.set(3.1,2.1,4.4);E.controls.update();E.preset=function(name){if(name==='front')E.camera.position.set(0,0,5.8);else if(name==='top')E.camera.position.set(0,5.8,.01);else E.camera.position.set(3.1,2.1,4.4);E.controls.target.set(0,0,0);E.controls.update();E.render()};E.resize();return E;
}
function mountHardware(host,describe,onLost){
 const T=window.THREE,E=window.XLab3D.mount(host,{label:'Conceptual superconducting circuit. Drag to orbit and select a component.',onContextLost:onLost}),scene=E.scene;
 const substrate=new T.Mesh(new T.BoxGeometry(4.4,.16,3.2),new T.MeshStandardMaterial({color:0x384b59,roughness:.65}));substrate.userData.part='Substrate';scene.add(substrate);
 const metal=new T.MeshStandardMaterial({color:0x94c1cf,metalness:.55,roughness:.3}),junction=new T.MeshStandardMaterial({color:0xe1a46a,metalness:.4,roughness:.35});
 function box(x,z,w,d,mat,part){let m=new T.Mesh(new T.BoxGeometry(w,.12,d),mat);m.position.set(x,.15,z);m.userData.part=part;scene.add(m)}
 box(-1,0,1.15,1.7,metal,'Capacitor');box(1,0,1.15,1.7,metal,'Capacitor');box(0,0,.55,.14,junction,'Josephson junction');box(-1.65,-1.15,1.1,.12,metal,'Control line');box(1.65,1.15,1.1,.12,metal,'Readout resonator');box(1.95,.6,.12,1.1,metal,'Readout resonator');
 const descriptions={'Substrate':'Insulating chip substrate supports the patterned circuit.','Capacitor':'Shunt capacitance contributes electric-field energy and sets the circuit’s charging energy.','Josephson junction':'A nonlinear inductive element; its anharmonic energy levels allow the two lowest levels to be addressed as a qubit.','Control line':'Microwave control delivers pulses that manipulate the circuit state.','Readout resonator':'A coupled resonator allows state-dependent microwave readout. This is a conceptual arrangement, not a fabrication layout.'};
 function select(part){if(descriptions[part])describe(part,descriptions[part])}
 const ray=new T.Raycaster(),point=new T.Vector2();let start;function down(e){start=[e.clientX,e.clientY]}function up(e){if(!start||Math.hypot(e.clientX-start[0],e.clientY-start[1])>4)return;const r=E.renderer.domElement.getBoundingClientRect();point.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(point,E.camera);let h=ray.intersectObjects(scene.children).find(x=>x.object.userData.part);if(h)select(h.object.userData.part)}
 let canvas=E.renderer.domElement;canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointerup',up);E.setAdapter({destroy(){canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointerup',up)}});E.resize();return {engine:E,select};
}
window.Quantum3D={mountBloch,mountHardware};
})();
