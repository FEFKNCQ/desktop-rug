import fs from 'node:fs';
const variant=process.argv[2]||'current',base=variant==='baseline'?'../revisions/v4.5/web/':'../web/';
const {ClothSim,NX,NY}=await import(base+'cloth.mjs');
const {crossings}=await import(base+'mesh-check.mjs');
const fixture=new URL('../revisions/v4.5/',import.meta.url),saved=fs.existsSync(new URL('state.ini',fixture))&&fs.existsSync(new URL('plush-shape.json',fixture));
const [x,y,width,angle]=saved?fs.readFileSync(new URL('state.ini',fixture),'utf8').trim().split(/\s+/).map(Number):[650,390,640,0],shape=saved?JSON.parse(fs.readFileSync(new URL('plush-shape.json',fixture),'utf8')):null;
const summarize=v=>{v.sort((a,b)=>a-b);return{n:v.length,median:v[v.length>>1],p95:v[Math.floor(v.length*.95)],max:v.at(-1)};};
const results=[];
for(const material of ['plush','short']){
 const sim=new ClothSim({x,y,width,angle});sim.setMaterial(material);if(shape)sim.load(shape);for(let n=0;n<60&&sim.active;n++)sim.step();
 let prep=0,solve=0;const prepare=sim.contacts.prepare.bind(sim.contacts),resolve=sim.contacts.solve.bind(sim.contacts);
 sim.contacts.prepare=(...args)=>{const t=performance.now();prepare(...args);prep+=performance.now()-t;};
 sim.contacts.solve=(...args)=>{const t=performance.now();resolve(...args);solve+=performance.now()-t;};
 const times=[],checks=[];let maxStretch=1;
 for(const node of [NX+NY*(NX+1),0,NX]){
  const gx=sim.p[node*3],gy=sim.p[node*3+1];sim.grab(gx,gy);
  for(let n=0;n<160;n++){
   sim.move(gx-210+210*Math.cos(n*.21),gy+Math.sin(n*.28)*170);
   const start=performance.now();sim.step();times.push(performance.now()-start);maxStretch=Math.max(maxStretch,sim.maxStretch());
  }
  sim.release();for(let n=0;n<60&&sim.active;n++)sim.step();checks.push(crossings(sim));
 }
 const report={material,timings:summarize(times),preparePerFrameMs:prep/(times.length+180),contactSolvePerFrameMs:solve/(times.length+180),crossings:checks,maxStretch,finite:sim.p.every(Number.isFinite)};
 results.push(report);console.log(report);
}
fs.writeFileSync(new URL(`drag-stress-${variant}.json`,import.meta.url),JSON.stringify({variant,results},null,2));
