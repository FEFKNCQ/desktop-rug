import {ClothSim,NX,NY} from '../web/cloth.mjs';
const sim=new ClothSim({x:650,y:390,width:640,angle:0});sim.setMaterial('short');
let prep=0,solve=0,steps=0;const prepare=sim.contacts.prepare.bind(sim.contacts),resolve=sim.contacts.solve.bind(sim.contacts);
sim.contacts.prepare=(...args)=>{const t=performance.now();const r=prepare(...args);prep+=performance.now()-t;return r;};
sim.contacts.solve=(...args)=>{const t=performance.now();const r=resolve(...args);solve+=performance.now()-t;return r;};
let start=performance.now();
for(const [gx,gy,dx,dy] of [[NX,NY,-330,-210],[0,0,290,190]]){
 const k=(gy*(NX+1)+gx)*3,x=sim.p[k],y=sim.p[k+1];sim.grab(x,y);
 for(let n=0;n<85;n++){sim.move(x+dx*Math.min(1,n/70),y+dy*Math.min(1,n/70));sim.step();steps++;}
 sim.release();for(let n=0;n<80&&sim.active;n++){sim.step();steps++;}
 console.log({steps,total:(performance.now()-start)/steps,prepare:prep/steps,solve:solve/steps,vf:sim.contacts.vertexCount,ee:sim.contacts.edgeCount});
}
