import {ClothSim} from './cloth.mjs';
let cloth,paused=false,last=performance.now();
onmessage=({data:m})=>{
  if(m.type==='init'){cloth=new ClothSim(m.state);cloth.setMaterial(m.material||'plush');cloth.viewport=m.viewport;for(let i=0;i<36;i++)cloth.step();cloth.reset();if(m.shape)cloth.load(m.shape);return;}
  if(!cloth)return;
  if(m.type==='material')cloth.setMaterial(m.material);
  if(m.type==='grab')cloth.grab(m.x,m.y);if(m.type==='move')cloth.move(m.x,m.y);if(m.type==='release')cloth.release();
  if(m.type==='translate')cloth.translate(m.x,m.y);if(m.type==='scale')cloth.scale(m.factor,m.degrees||0);if(m.type==='flat')cloth.reset();
  if(m.type==='icons'){const key=m.icons.map(i=>`${i.x},${i.y}`).join(';');if(key!==cloth.iconKey){cloth.iconKey=key;cloth.icons=m.icons;cloth.active=true;cloth.quiet=0;cloth.settleAge=0;}}if(m.type==='pause')paused=m.value;
  if(m.motionSequence)postMessage({type:'motionAck',sequence:m.motionSequence});
};
setInterval(()=>{if(!cloth||paused||!cloth.active)return;let start=performance.now();cloth.step();const positions=new Float32Array(cloth.p);postMessage({repairedIntersections:cloth.repairedIntersections||0,positions,state:cloth.state,active:cloth.active,held:cloth.pin>=0,ms:performance.now()-start},[positions.buffer]);last=start;},16);
