// Dependency-free checks of the lab physics helpers. Run: node tests/ch5-physics.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const h = 6.62607015e-34, e = 1.602176634e-19, kB = 1.380649e-23;
const window = { CH5_SIMS: {}, XLab: {}, Ch5Platform: { PHYSICS: {h, e, kB, mu0: 1.25663706212e-6, phi0: h/(2*e), josephsonFreqPerVolt: 2*e/h} } };
for (const f of fs.readdirSync('src/ch5').filter(f => /^sim.*\.js$/.test(f))) vm.runInNewContext(fs.readFileSync('src/ch5/'+f,'utf8'), {window, Math});
const lab = n => window.CH5_SIMS['c5t'+n]({});
const near = (a,b,tol=1e-9) => assert.ok(Math.abs(a-b)<tol, `${a} != ${b}`);
const m=lab(1); near(m.orderParameter(600,600),0); assert.ok(m.staggeredOrder(100,500)>0);
const hy=lab(2), soft={Ms:800000,Hc:40,Hs:120}, hard={Ms:900000,Hc:450,Hs:260};
assert.ok(hy.BofH(0,soft,false)>0); assert.ok(hy.BofH(0,soft,true)<0); assert.ok(hy.loopArea(hard,1200)>hy.loopArea(soft,1200));
const g=lab(3); near(g.resistance(0,10,20),10); near(g.resistance(180,10,20),20); near(g.resistance(90,10,20),15);
const d=lab(4); near(d.adiabaticT(0.5,1,2,1),1); near(d.adiabaticT(0.5,1,2,0),2);
const sc=lab(5); near(sc.resistance(10,10,10),0); near(sc.resistance(11,10,10),10); assert.equal(sc.criticalState(0,10,.1,1,'II'),'meissner'); assert.equal(sc.criticalState(0,10,.5,1,'II'),'mixed'); assert.equal(sc.criticalState(0,10,1.1,1,'I'),'normal'); near(sc.isotopeTc(400,.5,10,100),5);
const b=lab(6); near(b.gapMeV(10,10),0); assert.ok(b.gapMeV(1,10)>0);
const j=lab(7); near(j.dcCurrent(90,10),10); near(j.josephsonFreq(1)/1e9, 0.483597848, 1e-6);
const q=lab(8); near(q.IcOfFlux(.5,10),0); near(q.IcOfFlux(1,10),20); near(q.fluxQuantum(),2.067833848e-15,1e-23);
console.log('Unit V physics checks passed.');
