(function(root){
'use strict';
const h=6.62607015e-34,c=299792458,e=1.602176634e-19,me=9.1093837015e-31;
const M={
 sphere(r){return {area:4*Math.PI*r*r,volume:4*Math.PI*r*r*r/3,ratio:3/r}},
 well(L,m,n){return n*n*h*h/(8*m*me*(L*1e-9)**2)/e},
 photon(E){return h*c/(E*e)*1e9},
 // Illustrative gap: bulk offset plus an inverse-square confinement term, not a material fit.
 gap(L){return 1.8+3/(L*L)},
 thickness(rate,time){return rate*time},
 pvdCoverage(thickness,temp){return 1-Math.exp(-thickness/20*(.7+.3*(temp-20)/380))},
 // Qualitative Gaussian plasmon band, red-shifted and broadened by aggregation.
 plasmon(w,size,agg){const peak=520+0.3*(size-20)+80*agg;const width=35+size*.2+60*agg;return Math.exp(-.5*((w-peak)/width)**2)},
 network(size,spacing,connect){return 1000*Math.exp(spacing/5)*(1+20/size)/Math.max(.05,connect)},
 sensor(c,coverage,sensitivity){return sensitivity*coverage*c/(1+c)},
 mill(initial,t,speed,ratio,ball){return initial*(.08+.92*Math.exp(-t*speed/5000*ratio/10*ball/10))},
 millPopulation(initial,t,speed,ratio,ball){
  // Representative tracked particles; deterministic spread permits reversible time scrubbing.
  const decay=t*speed/5000*ratio/10*ball/10;
  return Array.from({length:80},(_,i)=>{
   const start=initial*(.65+.7*((i*37)%79)/78);
   return start*(.08+.92*Math.exp(-decay*(.65+.7*((i*29)%79)/78)));
  });
 },
 histogram(population,max,bins=10){const result=Array(bins).fill(0);population.forEach(v=>{if(Number.isFinite(v)&&v>=0)result[Math.min(bins-1,Math.floor(v/max*bins))]++});return result},
 goldPopulation(g){return Array.from({length:g.count},(_,i)=>g.size*(.7+.6*((i*37)%97)/96))},
 gold(t,prec,red,temp,mix,stab){const progress=Math.min(1,t/100*(.4+red/10)*(temp/70)*(.5+mix/10));return {progress,size:4+progress*(4+prec*.7)/(0.6+red/20),aggregation:Math.min(1,progress*(prec/20)/(1+stab/3)),count:Math.round(90*Math.min(1,red/10)*Math.max(0,Math.min(1,(progress-.25)/.2)))}}
};
root.NanoModels=M;if(typeof module!=='undefined')module.exports=M;
})(typeof window!=='undefined'?window:globalThis);
