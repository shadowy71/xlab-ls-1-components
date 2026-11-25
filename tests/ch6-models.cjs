'use strict';
const assert=require('node:assert/strict');
const M=require('../src/ch6/models.js');
const close=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<t,`${a} ≠ ${b}`);
let s=M.sphere(10);close(s.area,400*Math.PI);close(s.volume,4000*Math.PI/3);close(s.ratio,.3);
close(M.well(2,.2,2)/M.well(2,.2,1),4);close(M.well(2,.2,1)/M.well(4,.2,1),4);
close(M.photon(2),619.9209921660013,1e-6);close(M.thickness(1.5,20),30);
assert.ok(M.mill(500,30,400,10,10)<500);assert.ok(M.mill(500,0,400,10,10)===500);
assert.ok(M.sensor(10,1,.5)>M.sensor(1,1,.5));assert.equal(M.sensor(0,1,.5),0);
assert.ok(M.gold(100,10,10,70,5,5).progress>M.gold(0,10,10,70,5,5).progress);
assert.ok(M.gap(2)>M.gap(4));
console.log('Unit VI model checks passed.');
// Histograms use the same representative particles as the chamber.
const initial=M.millPopulation(500,0,400,10,10),milled=M.millPopulation(500,30,400,10,10);
assert.equal(initial.length,80);assert.equal(M.histogram(initial,700).reduce((a,b)=>a+b,0),80);
assert.equal(M.histogram(milled,700).reduce((a,b)=>a+b,0),80);
assert.ok(milled.every((v,i)=>v<=initial[i]));
const avg=arr=>arr.reduce((a,b)=>a+b,0)/arr.length;
assert.ok(avg(M.millPopulation(500,30,800,10,10))<avg(milled));
assert.ok(avg(M.millPopulation(500,30,400,20,10))<avg(milled));
assert.ok(avg(M.millPopulation(500,30,400,10,20))<avg(milled));
assert.ok(avg(M.millPopulation(1000,30,400,10,10))>avg(milled));
const goldStart=M.gold(0,10,10,70,5,5),goldEnd=M.gold(100,10,10,70,5,5);
assert.equal(M.goldPopulation(goldStart).length,0);
assert.equal(M.goldPopulation(goldEnd).length,goldEnd.count);
assert.equal(M.histogram(M.goldPopulation(goldEnd),50).reduce((a,b)=>a+b,0),goldEnd.count);
assert.ok(M.gold(100,10,10,70,5,10).aggregation<M.gold(100,10,10,70,5,0).aggregation);
console.log('Unit VI population and process checks passed.');
assert.equal(M.pvdCoverage(0,100),0);
assert.ok(M.pvdCoverage(20,400)>M.pvdCoverage(20,20));
// Surface-atom fraction grows as radius shrinks; wavefunction nodes/antinodes are exact.
assert.ok(M.surfaceFraction(1)>M.surfaceFraction(10));
assert.ok(M.surfaceFraction(10)>M.surfaceFraction(50));
assert.equal(M.surfaceFraction(0.2),1);
close(M.wavefunction(0.5,1),Math.SQRT2,1e-12);
close(M.wavefunction(0.25,2),Math.SQRT2,1e-12);
close(M.wavefunction(0,3),0,1e-12);
assert.equal(M.bohrRegime(2).regime,'Strong confinement');
assert.equal(M.bohrRegime(10).regime,'Weak confinement');
assert.equal(M.emissionLabel(258),'UV — not visible');
assert.equal(M.emissionLabel(550),'Visible');
assert.equal(M.emissionLabel(1000),'Infrared — not visible');
// Optical energy balance sums to unity; scattering share grows with size.
const bal=M.opticalBalance(0.99,1,20);
close(bal.absorbed+bal.scattered+bal.transmitted,1,1e-12);
assert.ok(M.opticalBalance(0.99,1,100).scattered>M.opticalBalance(0.99,1,2).scattered);
assert.equal(M.sensorSlope(0.8,0.5),0.4);
assert.equal(M.millStage(0),'Loading · coarse powder');
assert.equal(M.millStage(0.9),'Fine powder · approach model limit');
assert.equal(M.goldStage(0),0);
assert.equal(M.goldStage(1),6);
assert.equal(M.magneticRegime(5),'Superparamagnetic (illustrative)');
assert.equal(M.magneticRegime(20),'Single-domain blocked (illustrative)');
assert.equal(M.remanence(5),0);
assert.ok(M.remanence(20)>0);
assert.ok(Math.abs(M.magnetization(0,20))<1e-12);
console.log('Unit VI extended model checks passed.');

// Conservation for the fixed-volume subdivision, including fractional equivalent counts.
for (const r of [1, 7.5, 10, 30, 50]) {
  const sphere = M.sphere(r), split = M.subdivision(r);
  close(split.count * sphere.volume, split.volume, 1e-7);
  close(split.totalArea / split.largeArea, 50 / r);
  close(split.areaGain, 50 / r);
}
close(M.subdivision(50).count, 1);
close(M.well(3, .1, 2) / M.well(3, .2, 2), 2);
for (const energy of [.5, 2, 5]) close(M.photonEnergy(M.photon(energy)), energy);
// The dimensionless wavefunction shapes have unit probability integral.
for (const n of [1, 2, 5]) {
  let integral = 0;
  for (let i = 0; i < 1000; i++) integral += M.wavefunction((i + .5) / 1000, n) ** 2 / 1000;
  close(integral, 1, 1e-12);
}
assert.equal(M.wavefunction(-.1, 1), 0);
assert.equal(M.wavefunction(1.1, 1), 0);
for (const size of [2, 20, 100]) for (const concentration of [0, .1, 2]) for (const aggregation of [0, 1]) {
  const band = M.plasmon(550, size, aggregation), energy = M.opticalBalance(band, concentration, size);
  close(energy.absorbed + energy.scattered + energy.transmitted, 1);
  assert.ok(Object.values(energy).every(v => v >= 0 && v <= 1));
  assert.ok(M.colloidRGB(size, aggregation, concentration).every(v => Number.isInteger(v) && v >= 0 && v <= 235));
}
assert.deepEqual(M.colloidRGB(20, 0, 0), [235, 235, 235]);
assert.ok(M.network(20, 10, 1) > M.network(20, 0, 1));
assert.ok(M.network(20, 1, 2) < M.network(20, 1, 1));
close(M.mechanical(.03, 20).stress, -M.mechanical(-.03, 20).stress);
close(M.mechanical(.1, 2).strength, M.mechanical(.1, 10).strength);
assert.ok(M.mechanical(.1, 10).strength > M.mechanical(.1, 100).strength);
const target = M.sensor(2, .8, .5), after5 = M.relax(0, target, 5);
close(after5, target * (1 - Math.exp(-1)));
close(M.relax(after5, target, 5), M.relax(0, target, 10));
assert.ok(M.relax(after5, 0, 5) < after5);
for (const progress of [0, .12, .20, .32, .55, .80, 1]) {
  const time = M.goldTimeForProgress(progress, 10, 70, 5);
  close(M.gold(time, 10, 10, 70, 5, 5).progress, progress);
}
assert.equal(M.goldPopulation(M.gold(M.goldTimeForProgress(.20, 10, 70, 5), 10, 10, 70, 5, 5)).length, 0);
for (const size of [2, 5, 10, 20, 100]) {
  close(M.magnetization(0, size, -1), M.remanence(size));
  close(M.magnetization(0, size, 1), -M.remanence(size));
  assert.ok(M.magnetization(.8, size, -1) > M.magnetization(-.8, size, -1));
  assert.ok(Math.abs(M.magnetization(1, size, -1)) <= 1);
}
// Reject invalid scientific domains instead of rendering NaN or infinite measurements.
for (const invalid of [0, -1, NaN, Infinity]) {
  assert.throws(() => M.sphere(invalid), RangeError);
  assert.throws(() => M.well(invalid, .2, 1), RangeError);
  assert.throws(() => M.well(3, invalid, 1), RangeError);
  assert.throws(() => M.photon(invalid), RangeError);
}
assert.throws(() => M.well(3, .2, 1.5), RangeError);
assert.throws(() => M.thickness(1, -1), RangeError);
assert.throws(() => M.sensor(-1, 1, 1), RangeError);
assert.throws(() => M.relax(0, 1, 1, 0), RangeError);
assert.throws(() => M.histogram([1], 0), RangeError);
console.log('Unit VI conservation, dynamics and validation checks passed.');
