'use strict';
const assert=require('node:assert/strict'),Q=require('../src/ch4/quantum-engine.js');const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`),eq=(a,b)=>{near(a.r,b.r);near(a.i,b.i)},vec=(a,b)=>a.forEach((x,i)=>eq(x,b[i]));
const {c}=Q;eq(Q.add(c(1,2),c(3,-4)),c(4,-2));eq(Q.mul(c(1,2),c(3,4)),c(-5,10));eq(Q.div(c(1,2),c(1,-1)),c(-.5,1.5));assert.throws(()=>Q.div(c(1),c()));
const A=[[c(1),c(0,1)],[c(2),c(3)]],AH=Q.adjoint(A);eq(AH[1][0],c(0,-1));eq(Q.matrixMul(A,AH)[0][0],c(2));eq(Q.inner([c(1),c(0,1)],[c(1),c(0,1)]),c(2));eq(Q.outer([c(1),c(0,1)],[c(1),c(0,1)])[0][1],c(0,-1));near(Q.norm2(Q.normalize([c(2),c(2)])),1);assert.throws(()=>Q.normalize([c(),c()]));
for(const U of [...Object.values(Q.gates),Q.rotation('Rx',.37),Q.rotation('Ry',.6),Q.rotation('Rz',2),Q.rotation('P',.9)])assert.ok(Q.unitary(U));
vec(Q.apply(Q.basis(1),Q.gates.X,0),Q.basis(1,1));vec(Q.apply(Q.basis(1,1),Q.gates.X,0),Q.basis(1));const plus=[c(Math.SQRT1_2),c(Math.SQRT1_2)],minus=[c(Math.SQRT1_2),c(-Math.SQRT1_2)];vec(Q.apply(Q.basis(1),Q.gates.H,0),plus);vec(Q.apply(Q.basis(1,1),Q.gates.H,0),minus);vec(Q.apply(Q.apply(Q.basis(1),Q.gates.H,0),Q.gates.H,0),Q.basis(1));
for(let i=0;i<4;i++)vec(Q.controlled(Q.basis(2,i),0,1),Q.basis(2,i<2?i:i^1));let bell=Q.controlled(Q.apply(Q.basis(2),Q.gates.H,0),0,1);near(Q.probs(bell)[0],.5);near(Q.probs(bell)[3],.5);near(Q.abs2(Q.sub(Q.mul(bell[0],bell[3]),Q.mul(bell[1],bell[2]))),.25);
for(let i=0;i<4;i++){let state=bell;if(i&1)state=Q.apply(state,Q.gates.X,1);if(i&2)state=Q.apply(state,Q.gates.Z,0);near(Q.norm2(state),1)}
for(const p of [0,.3,Math.PI,5]){let s=Q.apply(Q.apply(Q.apply(Q.basis(1),Q.gates.H,0),Q.rotation('P',p),0),Q.gates.H,0);near(Q.probs(s)[0],Math.cos(p/2)**2);near(Q.probs(s)[1],Math.sin(p/2)**2)}
let clone=Q.controlled(Q.tensor(plus,Q.basis(1)),0,1);assert.ok(Q.abs2(Q.inner(clone,Q.tensor(plus,plus)))<1-1e-3);vec(Q.controlled(Q.basis(2,2),0,1),Q.basis(2,3));
for(const theta of [0,.38,1.25,Math.PI])for(const phi of [0,.7,3])for(let k=0;k<4;k++){let t=Q.teleport(Q.pure(theta,phi),k);near(t.probability,.25);near(t.fidelity,1);near(Q.norm2(t.collapsed),1)}
const m=Q.measure(bell,[0],0);near(m.probability,.5);vec(m.state,Q.basis(2));assert.throws(()=>Q.measure(Q.basis(1),[0],1));console.log('Unit IV quantum engine checks passed.');
// Exact Bell amplitudes, including phases; reverse controls and SWAP.
const expected=[
 [c(Math.SQRT1_2),c(),c(),c(Math.SQRT1_2)],
 [c(Math.SQRT1_2),c(),c(),c(-Math.SQRT1_2)],
 [c(),c(Math.SQRT1_2),c(Math.SQRT1_2),c()],
 [c(),c(Math.SQRT1_2),c(-Math.SQRT1_2),c()]
];
for(let k=0;k<4;k++){let v=bell;if(k>=2)v=Q.apply(v,Q.gates.X,1);if(k%2)v=Q.apply(v,Q.gates.Z,0);vec(v,expected[k]);}
for(let i=0;i<4;i++)vec(Q.controlled(Q.basis(2,i),1,0),Q.basis(2,(i&1)?i^2:i));
vec(Q.swap(Q.basis(2,1),0,1),Q.basis(2,2));
near(Q.norm2(Q.tensor(plus,minus)),1);assert.throws(()=>Q.apply([c(1),c(1)],Q.gates.H,0));
console.log('Unit IV Bell phases and reverse-control checks passed.');
// Bloch convention x=2Re(α*β), y=2Im(α*β), z=|α|²−|β|².
function blochNear(v,x,y,z){const p=Q.bloch(v);near(p.x,x);near(p.y,y);near(p.z,z)}
blochNear(Q.basis(1),0,0,1);blochNear(Q.basis(1,1),0,0,-1);blochNear(plus,1,0,0);blochNear(Q.pure(Math.PI/2,Math.PI/2),0,1,0);
blochNear(Q.apply(Q.basis(1),Q.rotation('Rx',Math.PI/2),0),0,-1,0);
blochNear(Q.apply(Q.basis(1),Q.rotation('Ry',Math.PI/2),0),1,0,0);
blochNear(Q.apply(plus,Q.rotation('Rz',Math.PI/2),0),0,1,0);
for(const phase of [0,.4,2,5]){let v=Q.pure(.71,1.3,phase);let p=Q.bloch(v),base=Q.bloch(Q.pure(.71,1.3));near(p.x,base.x);near(p.y,base.y);near(p.z,base.z)}
console.log('Bloch state and rotation convention checks passed.');
