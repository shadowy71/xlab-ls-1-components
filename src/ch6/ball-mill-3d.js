/* Rendering adapter for the existing illustrative NanoModels.millPopulation model.
   All sizes here are visual scales, not mill or powder dimensions to scale. */
(function(){
'use strict';
function mount(host,describe,onContextLost){
 const T=window.THREE, engine=window.XLab3D.mount(host,{label:'3D schematic milling chamber. Drag to orbit and scroll to zoom.',onContextLost});
 const scene=engine.scene, chamber=new T.Group();scene.add(chamber);
 const steel=new T.MeshStandardMaterial({color:0x8698a1,metalness:.62,roughness:.34});
 const dark=new T.MeshStandardMaterial({color:0x344650,metalness:.5,roughness:.42});
 const shellMat=new T.MeshStandardMaterial({color:0x82aab8,metalness:.15,roughness:.28,transparent:true,opacity:.19,side:T.DoubleSide,depthWrite:false});
 const powderMat=new T.MeshStandardMaterial({color:0xd5a05f,roughness:.65});
 const shell=new T.Mesh(new T.CylinderGeometry(1.45,1.45,2.05,48,1,true),shellMat);shell.rotation.x=Math.PI/2;shell.userData.part='Chamber';chamber.add(shell);
 const ringGeometry=new T.RingGeometry(1.34,1.48,48),ringMat=new T.MeshStandardMaterial({color:0x859da7,metalness:.7,roughness:.4,side:T.DoubleSide});
 for(const z of [-1.04,1.04]){const r=new T.Mesh(ringGeometry,ringMat);r.position.z=z;r.userData.part='Chamber';chamber.add(r)}
 const back=new T.Mesh(new T.CircleGeometry(1.43,48),dark);back.position.z=-1.06;back.userData.part='Chamber';chamber.add(back);
 for(let i=0;i<4;i++){let angle=i*Math.PI/2;let rib=new T.Mesh(new T.BoxGeometry(.12,.18,1.95),steel);rib.position.set(1.34*Math.cos(angle),1.34*Math.sin(angle),0);rib.rotation.z=angle;rib.userData.part='Chamber';chamber.add(rib)}
 const base=new T.Mesh(new T.BoxGeometry(3.7,.25,2.8),dark);base.position.y=-1.8;base.userData.part='Drive';scene.add(base);
 const mount=new T.Mesh(new T.CylinderGeometry(.32,.32,1.3,24),steel);mount.rotation.x=Math.PI/2;mount.position.z=-1.55;mount.userData.part='Drive';scene.add(mount);
 const ballGeo=new T.SphereGeometry(1,20,14),balls=[];
 for(let i=0;i<8;i++){const b=new T.Mesh(ballGeo,steel);b.userData.part='Milling balls';chamber.add(b);balls.push(b)}
 const particles=new T.InstancedMesh(new T.SphereGeometry(1,8,6),powderMat,80);particles.userData.part='Powder';chamber.add(particles);
 const matrix=new T.Object3D();const raycaster=new T.Raycaster(),pointer=new T.Vector2();let start=null;
 const descriptions={Chamber:'Rotating chamber: repeated motion carries the milling media. The transparent shell is a cutaway for inspection.',Drive:'Drive and support: speed changes the conceptual chamber motion and the existing illustrative size-reduction model.', 'Milling balls':'Milling balls: diameter changes the drawn media and the model’s illustrative reduction rate. Impacts are not resolved by a collision solver.',Powder:'Powder: 80 representative particles use the same size population as the histogram below. Visual dimensions are not to scale.'};
 function select(part){if(descriptions[part])describe(part,descriptions[part])}
 function down(e){start={x:e.clientX,y:e.clientY}}
 function up(e){if(!start||Math.hypot(e.clientX-start.x,e.clientY-start.y)>5){start=null;return}start=null;const rect=engine.renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,engine.camera);const hit=raycaster.intersectObjects(scene.children,true).find(h=>h.object.userData.part);if(hit)select(hit.object.userData.part)}
 engine.renderer.domElement.addEventListener('pointerdown',down);engine.renderer.domElement.addEventListener('pointerup',up);
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 engine.setAdapter({update({state,clock}){
  const {duration,speed,ratio,ball,initial}=state;
  const angle=reduced?0:clock*speed/300;chamber.rotation.z=angle;
  balls.forEach((b,i)=>{const a=i*Math.PI/4+(reduced?0:angle*.7),r=.72+.12*Math.sin(a*2+i);b.position.set(r*Math.cos(a),r*Math.sin(a),-.68+(i%4)*.45);b.scale.setScalar(.105+ball*.008)});
  const population=window.NanoModels.millPopulation(initial,duration,speed,ratio,ball);
  population.forEach((v,i)=>{let a=i*2.4+(reduced?0:angle*.25),r=.15+(i*37%90)/100;matrix.position.set(r*Math.cos(a),r*Math.sin(a),-.83+(i*29%100)/60);matrix.scale.setScalar(Math.max(.015,.05*v/initial));matrix.rotation.set(0,0,0);matrix.updateMatrix();particles.setMatrixAt(i,matrix.matrix)});particles.instanceMatrix.needsUpdate=true;
 },destroy(){engine.renderer.domElement.removeEventListener('pointerdown',down);engine.renderer.domElement.removeEventListener('pointerup',up)}});
 engine.resize();return {engine,select};
}
window.XLabBallMill3D={mount};
})();
