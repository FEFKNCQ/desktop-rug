import {ClothSim} from './cloth.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const results=[];
for(const material of ['plush','short','paper']){
  const sim=new ClothSim({x:600,y:360,width:650,angle:0});sim.setMaterial(material);
  sim.grab(920,565);
  for(let n=0;n<100;n++){sim.move(920-n*2.3,565-n*1.35);sim.step();}
  sim.release();for(let n=0;n<220&&sim.active;n++)sim.step();
  assert(sim.p.every(Number.isFinite));assert(sim.maxStretch()<1.12);assert(!sim.active);
  assert(Math.min(...sim.p.filter((_,i)=>i%3===2))>=2.99);
  const pose=Array.from(sim.p);sim.setMaterial(material==='plush'?'short':'plush');assert.deepEqual(Array.from(sim.p),pose);
  sim.scale(.9);for(let n=0;n<200&&sim.active;n++)sim.step();assert(sim.p.every(Number.isFinite));assert(sim.maxStretch()<1.12);
  results.push({material,finite:true,settles:true,noGroundPenetration:true,switchPreservesPose:true,scaleStable:true,maxStretch:sim.maxStretch()});
}
fs.writeFileSync(new URL('../qa/materials-v45.json',import.meta.url),JSON.stringify({passed:true,results},null,2));console.log(results);
