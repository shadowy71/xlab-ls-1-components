/* Spatial presentation of the existing exact 1D scattering model.
   The surface is an extrusion of |psi(x)|², not a 3D wavefunction. */
(function(){
'use strict';
function mount(host,describe,onContextLost){
 const T=window.THREE,engine=window.XLab3D.mount(host,{label:'Extruded one-dimensional scattering density and potential barrier',onContextLost}),scene=engine.scene;
 const barrier=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({color:0xb88359,transparent:true,opacity:.48,depthWrite:false,roughness:.65}));barrier.userData.part='Barrier';scene.add(barrier);
 const nx=96,nz=8,vertices=new Float32Array((nx+1)*(nz+1)*3),indices=[];
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){let a=j*(nx+1)+i,b=a+nx+1;indices.push(a,b,a+1,b,b+1,a+1)}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(vertices,3));geometry.setIndex(indices);
 const density=new T.Mesh(geometry,new T.MeshStandardMaterial({color:0x4baab9,side:T.DoubleSide,metalness:.1,roughness:.5}));density.userData.part='Probability density';scene.add(density);
 const grid=new T.GridHelper(5,10,0x718895,0x465663);grid.position.y=-1;scene.add(grid);
 const descriptions={'Barrier':'Potential barrier: height and width follow the existing 1D model. Energy and probability are shown on separate visual scales.','Probability density':'The translucent surface is the existing 1D |ψ(x)|² curve extruded uniformly sideways for inspection. It is not a three-dimensional probability distribution or a particle trajectory.'};
 function select(part){if(descriptions[part])describe(part,descriptions[part])}
 engine.setAdapter({update(payload){if(!payload)return;const {state,samples}=payload;
  barrier.scale.set(state.widthNm,Math.max(.04,state.v0Ev/5),.65);barrier.position.set(state.widthNm/2-.6,-1+state.v0Ev/10,0);
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const k=(j*(nx+1)+i)*3;vertices[k]=-1.6+4.4*i/nx-.6;vertices[k+1]=-1+samples[i]*.35;vertices[k+2]=-.9+1.8*j/nz}
  geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();
 }});
 engine.resize();return {engine,select};
}
window.XLabTunnelling3D={mount};
})();
