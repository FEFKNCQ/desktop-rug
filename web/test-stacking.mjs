import {ClothSim,NX,NY} from './cloth.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {crossings} from './mesh-check.mjs';
const reports=[];
for(const material of ['short','paper','plush']){
  const sim=new ClothSim({x:650,y:390,width:640,angle:0});sim.setMaterial(material);const times=[],checks=[];
  for(const [gx,gy,dx,dy] of [[NX,NY,-330,-210],[0,0,290,190],[NX,0,-260,220],[0,NY,260,-180]]){
    const k=(gy*(NX+1)+gx)*3,x=sim.p[k],y=sim.p[k+1];sim.grab(x,y);
    for(let n=0;n<85;n++){sim.move(x+dx*Math.min(1,n/70),y+dy*Math.min(1,n/70));const start=performance.now();sim.step();times.push(performance.now()-start);}
    sim.release();for(let n=0;n<100&&sim.active;n++)sim.step();checks.push(crossings(sim));
  }
  times.sort((a,b)=>a-b);const report={material,crossingsAfterFolds:checks,medianMs:times[Math.floor(times.length/2)],p95Ms:times[Math.floor(times.length*.95)],maxStretch:sim.maxStretch(),finite:sim.p.every(Number.isFinite)};reports.push(report);console.log(report);
  fs.writeFileSync(new URL('../qa/stacking-v45.json',import.meta.url),JSON.stringify({passed:reports.every(r=>r.crossingsAfterFolds.every(n=>n===0)&&r.finite),reports},null,2));
}
assert(reports.every(r=>r.crossingsAfterFolds.every(n=>n===0)&&r.finite),'Self intersections remain');
