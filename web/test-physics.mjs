import {ClothSim,COUNT} from './cloth.mjs';import fs from 'node:fs';import assert from 'node:assert/strict';
const c=new ClothSim();let stretches=[],times=[];
for(let run=0;run<6;run++){
  let n=[COUNT-1,0,310,620,30,400][run],k=n*3,x=c.p[k],y=c.p[k+1],max=1;c.grab(x,y);
  for(let f=0;f<100;f++){if(f<65)c.move(x-180*Math.sin(f/55),y-120*Math.sin(f/65));else if(f===65)c.release();let t=performance.now();c.step();times.push(performance.now()-t);max=Math.max(max,c.maxStretch());assert(c.p.every(Number.isFinite));}
  stretches.push(max);assert(max<1.25,'Successive opposing grabs must not stretch fabric into a spike: '+max);
}
let before=c.p.slice();c.translate(23,17);assert(Math.abs(c.p[0]-before[0]-23)<.001);c.scale(1.1);assert(Math.abs(c.state.width-748)<.01);c.reset();assert.equal(c.pin,-1);
const fold=new ClothSim({width:600,x:700,y:400});for(let f=0;f<36;f++)fold.step();fold.grab(982,580);
for(let f=0;f<120;f++){const pull=Math.min(190,f/84*190);fold.move(982-pull,580-pull*.66);fold.step();}
const height=()=>Math.max(...fold.p.filter((_,i)=>i%3===2));const heldHeight=height();fold.release();for(let f=0;f<180&&fold.active;f++)fold.step();const restHeight=height();
assert(restHeight>18,'A released wool fold should not automatically flatten');assert(restHeight<heldHeight-3,'A released fold must fall under gravity');assert(!fold.active,'Settled cloth must sleep');assert(fold.maxStretch()<1.1);
fold.reset();for(let f=0;f<180&&fold.active;f++)fold.step();assert(height()<5,'Flatten must clear retained creases');
times.sort((a,b)=>a-b);let report={passed:true,successiveGrabs:6,maxStretch:Math.max(...stretches),medianMs:times[times.length>>1],p95Ms:times[Math.floor(times.length*.95)],heldHeight,restHeight,retainedFoldAndSleep:true,finite:true,translateAndScale:true};fs.writeFileSync(new URL('../qa/physics-v4.json',import.meta.url),JSON.stringify(report,null,2));console.log(report);
