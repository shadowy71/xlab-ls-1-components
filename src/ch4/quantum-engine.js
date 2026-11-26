(function(root){
'use strict';
// q0 is the leftmost (most-significant) bit. States are arrays of {r,i}.
const c=(r=0,i=0)=>({r,i}), add=(a,b)=>c(a.r+b.r,a.i+b.i), sub=(a,b)=>c(a.r-b.r,a.i-b.i), mul=(a,b)=>c(a.r*b.r-a.i*b.i,a.r*b.i+a.i*b.r), conj=a=>c(a.r,-a.i), abs2=a=>a.r*a.r+a.i*a.i, scale=(a,x)=>c(a.r*x,a.i*x);
function div(a,b){const d=abs2(b);if(d<1e-24)throw Error('Division by zero');return scale(mul(a,conj(b)),1/d)}
const norm2=v=>v.reduce((s,a)=>s+abs2(a),0);
function normalize(v){const n=Math.sqrt(norm2(v));if(!Number.isFinite(n)||n<1e-12)throw Error('A zero or invalid vector cannot be normalized');return v.map(x=>scale(x,1/n))}
function inner(a,b){if(a.length!==b.length)throw Error('Vector dimensions differ');return a.reduce((s,x,i)=>add(s,mul(conj(x),b[i])),c())}
function outer(a,b){return a.map(x=>b.map(y=>mul(x,conj(y))))}
function tensor(a,b){return a.flatMap(x=>b.map(y=>mul(x,y)))}
function adjoint(A){return A[0].map((_,i)=>A.map(row=>conj(row[i])))}
function matrixMul(A,B){if(!A.length||!B.length||A[0].length!==B.length||A.some(r=>r.length!==B.length)||B.some(r=>r.length!==B[0].length))throw Error('Matrix dimensions do not match');return A.map(row=>B[0].map((_,j)=>row.reduce((s,x,k)=>add(s,mul(x,B[k][j])),c())))}
function unitary(U,tol=1e-9){if(!U.length||U.some(r=>r.length!==U.length))return false;const p=matrixMul(adjoint(U),U);return p.every((r,i)=>r.every((z,j)=>Math.hypot(z.r-(i===j?1:0),z.i)<tol))}
const inv=1/Math.sqrt(2), gates={I:[[c(1),c()],[c(),c(1)]],X:[[c(),c(1)],[c(1),c()]],Y:[[c(),c(0,-1)],[c(0,1),c()]],Z:[[c(1),c()],[c(),c(-1)]],H:[[c(inv),c(inv)],[c(inv),c(-inv)]],S:[[c(1),c()],[c(),c(0,1)]],T:[[c(1),c()],[c(),c(inv,inv)]]};
function rotation(axis,angle){const a=Math.cos(angle/2),b=Math.sin(angle/2);if(axis==='Rx')return [[c(a),c(0,-b)],[c(0,-b),c(a)]];if(axis==='Ry')return [[c(a),c(-b)],[c(b),c(a)]];if(axis==='Rz')return [[c(a,-b),c()],[c(),c(a,b)]];if(axis==='P')return [[c(1),c()],[c(),c(Math.cos(angle),Math.sin(angle))]];throw Error('Unknown rotation')}
function qubits(v){const n=Math.log2(v.length);if(!Number.isInteger(n)||n<1||n>8)throw Error('State dimension must be 2ⁿ, 1 ≤ n ≤ 8');return n}
function validate(v){qubits(v);if(v.some(x=>!x||!Number.isFinite(x.r)||!Number.isFinite(x.i))||Math.abs(norm2(v)-1)>1e-8)throw Error('State must be finite and normalized');return true}
function bit(n,q){if(!Number.isInteger(q)||q<0||q>=n)throw Error('Invalid qubit index');return 1<<(n-1-q)}
function apply(v,U,q){validate(v);if(U.length!==2||!unitary(U))throw Error('Gate must be a 2×2 unitary matrix');const n=qubits(v),mask=bit(n,q),out=v.map(()=>c());for(let i=0;i<v.length;i++)if(!(i&mask)){let j=i|mask;out[i]=add(mul(U[0][0],v[i]),mul(U[0][1],v[j]));out[j]=add(mul(U[1][0],v[i]),mul(U[1][1],v[j]))}return out}
function controlled(v,control,target,kind='CNOT'){validate(v);const n=qubits(v),cm=bit(n,control),tm=bit(n,target);if(cm===tm)throw Error('Control and target must differ');if(!['CNOT','CZ'].includes(kind))throw Error('Unknown controlled gate');const out=v.map(()=>c());v.forEach((a,i)=>{const j=kind==='CNOT'&&(i&cm)?i^tm:i;out[j]=kind==='CZ'&&(i&cm)&&(i&tm)?scale(a,-1):c(a.r,a.i)});return out}
function swap(v,a,b){validate(v);const n=qubits(v),am=bit(n,a),bm=bit(n,b);if(am===bm)return v.map(x=>c(x.r,x.i));const out=v.map(()=>c());v.forEach((x,i)=>{const j=!!(i&am)!==!!(i&bm)?i^am^bm:i;out[j]=c(x.r,x.i)});return out}
function basis(n,index=0){if(!Number.isInteger(n)||n<1||n>8||!Number.isInteger(index)||index<0||index>=2**n)throw Error('Invalid basis state');return Array.from({length:2**n},(_,i)=>c(i===index?1:0))}
function probs(v){validate(v);return v.map(abs2)}
function shots(v,count,rng=Math.random){const p=probs(v);if(!Number.isInteger(count)||count<1||count>100000)throw Error('Invalid shot count');const counts=p.map(()=>0);for(let k=0;k<count;k++){let x=rng(),i=0;while(i<p.length-1&&(x-=p[i])>=0)i++;counts[i]++}return counts}
// Measure an ordered subset. An explicit outcome allows reproducible inspection of branches.
function measure(v,qs,outcome,rng=Math.random){validate(v);const n=qubits(v);if(!qs.length||new Set(qs).size!==qs.length)throw Error('Invalid measurement qubits');const masks=qs.map(q=>bit(n,q)),p=Array(2**qs.length).fill(0);const label=i=>masks.reduce((s,m)=>s*2+((i&m)?1:0),0);v.forEach((a,i)=>{p[label(i)]+=abs2(a)});if(outcome===undefined){let x=rng();outcome=0;while(outcome<p.length-1&&(x-=p[outcome])>=0)outcome++}if(!Number.isInteger(outcome)||outcome<0||outcome>=p.length||p[outcome]<1e-14)throw Error('Outcome has zero probability');return {outcome,probability:p[outcome],state:v.map((a,i)=>label(i)===outcome?scale(a,1/Math.sqrt(p[outcome])):c())}}
function pure(theta,phi,global=0){const g=c(Math.cos(global),Math.sin(global));return [mul(g,c(Math.cos(theta/2))),mul(g,c(Math.sin(theta/2)*Math.cos(phi),Math.sin(theta/2)*Math.sin(phi)))]}
function bloch(v){validate(v);if(v.length!==2)throw Error('Bloch sphere requires one qubit');const ab=mul(conj(v[0]),v[1]);return {x:2*ab.r,y:2*ab.i,z:abs2(v[0])-abs2(v[1])}}
function teleport(input,outcome){validate(input);if(input.length!==2)throw Error('Input must be one qubit');let v=tensor(tensor(input,basis(1)),basis(1));const initial=v;v=apply(v,gates.H,1);v=controlled(v,1,2);const pair=v;v=controlled(v,0,1);v=apply(v,gates.H,0);const before=v;const m=measure(v,[0,1],outcome);v=m.state;const collapsed=v;if(m.outcome&1)v=apply(v,gates.X,2);if(m.outcome&2)v=apply(v,gates.Z,2);const base=m.outcome*2,bob=[v[base],v[base+1]];return {initial,pair,before,collapsed,final:v,outcome:m.outcome,probability:m.probability,bob,fidelity:abs2(inner(input,bob))}}
const api={c,add,sub,mul,div,conj,abs2,scale,norm2,normalize,inner,outer,tensor,adjoint,matrixMul,unitary,gates,rotation,validate,apply,controlled,swap,basis,probs,shots,measure,pure,bloch,teleport};
root.QuantumEngine=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
