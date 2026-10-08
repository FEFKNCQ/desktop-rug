import {BroomPhysics} from './broom-physics.mjs';
// Explorer keeps drawing its own icons. Coalesce coordinates while one native
// batch is in flight instead of queuing mouse events or substituting sprites.
export class PushIcons {
  constructor(api,notify){this.api=api;this.notify=notify;this.running=false;this.frame=0;this.lastTime=0;this.committing=null;this.savedRevision=0;this.roundTrips=[];this.frameTimes=[];this.sent=new Map();}
  async begin(){const icons=await this.api.call('beginPush');this.physics=new BroomPhysics(icons,innerWidth,innerHeight);this.running=true;this.savedRevision=this.physics.revision;this.lastTime=0;this.roundTrips=[];this.frameTimes=[];this.sent=new Map(icons.map(i=>[i.id,{x:i.x,y:i.y}]));return icons;}
  push(from,to){if(!this.running)return;this.physics.push(from,to);this.wake();}
  wake(){if(this.frame||!this.running)return;this.frame=requestAnimationFrame(time=>{this.frame=0;const dt=this.lastTime?Math.min(.033,(time-this.lastTime)/1000):1/60;if(this.lastTime)this.sample(this.frameTimes,time-this.lastTime);this.lastTime=time;this.physics.step(dt);this.flush();if(this.physics.active)this.wake();else this.lastTime=0;});}
  flush(){
    if(this.committing||!this.running||this.savedRevision===this.physics.revision)return;
    const revision=this.physics.revision,positions=this.physics.changes().filter(p=>{const last=this.sent.get(p.id);return !last||Math.abs(p.x-last.x)>.15||Math.abs(p.y-last.y)>.15;});
    if(!positions.length){this.savedRevision=revision;return;}
    const start=performance.now();this.committing=this.api.call('commitPush',{positions,live:true}).then(()=>{this.savedRevision=revision;for(const p of positions)this.sent.set(p.id,p);this.sample(this.roundTrips,performance.now()-start);}).catch(error=>{this.running=false;this.notify(error.message);}).finally(()=>{this.committing=null;if(this.running&&this.savedRevision!==this.physics.revision)this.wake();});
  }
  async end(){if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;this.running=false;if(this.committing)await this.committing;return this.api.call('endPush',{positions:this.physics?this.physics.changes():[]});}
  sample(list,value){list.push(value);if(list.length>600)list.shift();}
  stats(){const summarize=values=>{const a=[...values].sort((a,b)=>a-b);return {n:a.length,median:a[Math.floor(a.length*.5)]||0,p95:a[Math.floor(a.length*.95)]||0,max:a.at(-1)||0};};return {roundTripMs:summarize(this.roundTrips),frameIntervalMs:summarize(this.frameTimes),moved:this.movedCount};}
  get movedCount(){return this.physics?this.physics.items.reduce((n,p)=>n+(p.moved?1:0),0):0;}
}
