export class BroomPhysics {
  constructor(icons,width,height){this.width=width;this.height=height;this.items=icons.map(i=>({...i,startX:i.x,startY:i.y,vx:0,vy:0,moved:false}));this.active=false;this.revision=0;}
  push(from,to){
    const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);if(length<.05)return;
    const ux=dx/length,uy=dy/length,reach=38;let changed=false;
    for(const p of this.items){if(!p.sweepable)continue;const rx=p.x-from.x,ry=p.y-from.y,along=rx*ux+ry*uy,side=rx*-uy+ry*ux;if(along<0||along>length+reach||Math.abs(side)>=reach)continue;const rim=Math.sqrt(reach*reach-side*side),shift=Math.min(length+rim-along,length+Math.min(3,length*.12));if(shift<=0)continue;p.x+=ux*shift;p.y+=uy*shift;p.vx=ux*Math.min(1.5,length*.08);p.vy=uy*Math.min(1.5,length*.08);p.contact=true;p.moved=true;changed=true;}
    if(changed){this.active=true;this.revision++;this.confine();}
  }
  confine(){for(const p of this.items)if(p.moved){p.x=Math.max(24,Math.min(this.width-24,p.x));p.y=Math.max(24,Math.min(this.height-60,p.y));}}
  step(dt=1/60){
    const frame=Math.min(2,dt*60),damping=Math.pow(.66,frame);let motion=0;
    for(const p of this.items){p.beforeX=p.x;p.beforeY=p.y;if(p.moved){if(!p.contact){p.x+=p.vx*frame;p.y+=p.vy*frame;}p.contact=false;p.vx*=damping;p.vy*=damping;if(Math.abs(p.vx)<.025)p.vx=0;if(Math.abs(p.vy)<.025)p.vy=0;motion=Math.max(motion,Math.abs(p.vx)+Math.abs(p.vy));}}
    const gap=27;
    for(let pass=0;pass<4;pass++)for(let a=0;a<this.items.length;a++)for(let b=a+1;b<this.items.length;b++){
      const p=this.items[a],q=this.items[b];if(!p.moved&&!q.moved)continue;let dx=q.x-p.x,dy=q.y-p.y;if(Math.abs(dx)>gap||Math.abs(dy)>gap)continue;let d=Math.hypot(dx,dy);if(d>=gap)continue;const wp=p.sweepable?1:0,wq=q.sweepable?1:0;if(!wp&&!wq)continue;if(d<.001){const angle=(a*2.399+b*.91);dx=Math.cos(angle);dy=Math.sin(angle);d=1;}
      const amount=(gap-d)*.85/(wp+wq),sx=dx/d*amount,sy=dy/d*amount;if(wp){p.x-=sx;p.y-=sy;p.moved=true;}if(wq){q.x+=sx;q.y+=sy;q.moved=true;}
    }
    this.confine();let moved=0;for(const p of this.items)moved=Math.max(moved,Math.abs(p.x-p.beforeX)+Math.abs(p.y-p.beforeY));this.active=motion>.05||moved>.08;if(moved>.001)this.revision++;return this.active;
  }
  changes(){return this.items.filter(p=>p.moved).map(p=>({id:p.id,x:p.x,y:p.y}));}
}
