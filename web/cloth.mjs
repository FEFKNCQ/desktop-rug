import {SelfContact} from './self-contact.mjs';
import {crossings} from './mesh-check.mjs';
export const NX=30, NY=20, COUNT=(NX+1)*(NY+1);
export class ClothSim {
  setMaterial(kind){this.material=kind;this.contactThickness=kind==='paper'?5:kind==='short'?6:18;this.gravity=kind==='paper'?700:1000;this.airDamping=kind==='paper'?.97:.985;this.creaseAmount=kind==='paper'?.88:.75;this.active=true;this.quiet=0;this.settleAge=0;}
  constructor(state={}){
    this.setMaterial('plush');
    this.contacts=new SelfContact(NX,NY);
    this.state={x:700,y:400,width:680,angle:-4,...state};this.p=new Float32Array(COUNT*3);this.old=new Float32Array(COUNT*3);this.before=new Float32Array(COUNT*3);this.floors=new Float32Array(COUNT);this.edges=[];this.icons=[];this.pin=-1;this.target=[0,0,0];this.quiet=0;this.active=true;this.reset();
  }
  reset(){
    this.restCurvature=null;
    const {x,y,width,angle}=this.state,c=Math.cos(angle*Math.PI/180),s=Math.sin(angle*Math.PI/180),dx=width/NX,dy=width*2/3/NY;
    this.edges=[];this.spacing=dx;this.pin=-1;
    for(let j=0;j<=NY;j++)for(let i=0;i<=NX;i++){
      let n=j*(NX+1)+i,k=n*3,u=(i/NX-.5)*width,v=(j/NY-.5)*width*2/3;
      this.p[k]=x+u*c-v*s;this.p[k+1]=y+u*s+v*c;this.p[k+2]=this.floor(this.p[k],this.p[k+1])+1.2*Math.sin(i*.6)*Math.sin(j*.45);
      if(i<NX)this.edges.push([n,n+1,dx,1]);if(j<NY)this.edges.push([n,n+NX+1,dy,1]);
      if(i<NX&&j<NY){this.edges.push([n,n+NX+2,Math.hypot(dx,dy),.8]);this.edges.push([n+1,n+NX+1,Math.hypot(dx,dy),.8]);}
      if(i+2<=NX)this.edges.push([n,n+2,dx*2,.00015,dx*2]);if(j+2<=NY)this.edges.push([n,n+2*(NX+1),dy*2,.00015,dy*2]);
    }
    this.old.set(this.p);this.active=true;this.quiet=0;this.settleAge=0;
  }
  floor(x,y){let z=3;for(const icon of this.icons){let dx=x-icon.x,dy=y-icon.y;if(Math.abs(dx)>50||Math.abs(dy)>50)continue;z+=3.2*Math.exp(-(dx*dx+dy*dy)/900);}return Math.min(15,z);}
  pick(x,y){let pick=-1,best=35*35,top=-Infinity;const p=this.p;
    for(let j=0;j<NY;j++)for(let i=0;i<NX;i++){let n=j*(NX+1)+i;for(const tri of [[n,n+1,n+NX+1],[n+1,n+NX+2,n+NX+1]]){let a=tri[0]*3,b=tri[1]*3,c=tri[2]*3,den=(p[b+1]-p[c+1])*(p[a]-p[c])+(p[c]-p[b])*(p[a+1]-p[c+1]);if(Math.abs(den)<.0001)continue;let u=((p[b+1]-p[c+1])*(x-p[c])+(p[c]-p[b])*(y-p[c+1]))/den,v=((p[c+1]-p[a+1])*(x-p[c])+(p[a]-p[c])*(y-p[c+1]))/den;if(u<0||v<0||u+v>1)continue;let z=p[a+2]*u+p[b+2]*v+p[c+2]*(1-u-v);if(z<=top)continue;top=z;pick=tri.reduce((a,b)=>((p[a*3]-x)**2+(p[a*3+1]-y)**2)<((p[b*3]-x)**2+(p[b*3+1]-y)**2)?a:b);}}
    if(pick>=0)return pick;for(let n=0;n<COUNT;n++){let k=n*3,d=(p[k]-x)**2+(p[k+1]-y)**2;if(d<best){best=d;pick=n;}}return pick;
  }
  grab(x,y){this.pin=this.pick(x,y);if(this.pin<0)return;this.restCurvature=null;for(const e of this.edges)if(e[4])e[3]=.00015;let k=this.pin*3;this.offset=[this.p[k]-x,this.p[k+1]-y];this.grabHeight=Math.max(55,this.p[k+2]+8);this.target=[this.p[k],this.p[k+1],this.grabHeight];this.active=true;this.quiet=0;}
  move(x,y){if(this.pin<0)return;this.target=[x+this.offset[0],y+this.offset[1],this.grabHeight];this.active=true;this.quiet=0;}
  release(){if(this.pin>=0)this.rememberCreases(this.creaseAmount);this.pin=-1;this.active=true;this.quiet=0;this.settleAge=0;this.center();if(this.viewport)this.translate(Math.max(80,Math.min(this.viewport.width-80,this.state.x))-this.state.x,Math.max(80,Math.min(this.viewport.height-100,this.state.y))-this.state.y);}
  rememberCreases(amount){
    this.restCurvature=new Float32Array(COUNT);
    for(let y=1;y<NY;y++)for(let x=1;x<NX;x++){const n=y*(NX+1)+x,k=n*3;this.restCurvature[n]=(this.p[k+2]-(this.p[k-1]+this.p[k+5]+this.p[k-(NX+1)*3+2]+this.p[k+(NX+1)*3+2])*.25)*amount;}
    // Low-stiffness bending hysteresis models friction between wool fibres.
    // Rest curvature comes from the actual pulled mesh; gravity can still lower
    // the folds. Grabbing softens it again, and Reset removes it completely.
    for(const e of this.edges)if(e[4]){let a=e[0]*3,b=e[1]*3,d=Math.hypot(this.p[a]-this.p[b],this.p[a+1]-this.p[b+1],this.p[a+2]-this.p[b+2]);e[2]=e[4]+(Math.max(e[4]*.2,Math.min(e[4],d))-e[4])*amount;e[3]=.002;}
  }
  center(){let x=0,y=0;for(let n=0;n<COUNT;n++){x+=this.p[n*3];y+=this.p[n*3+1];}this.state.x=x/COUNT;this.state.y=y/COUNT;}
  translate(dx,dy){for(let k=0;k<this.p.length;k+=3){this.p[k]+=dx;this.p[k+1]+=dy;this.old[k]+=dx;this.old[k+1]+=dy;}this.state.x+=dx;this.state.y+=dy;this.active=true;this.quiet=0;this.settleAge=0;}
  scale(factor,degrees=0){this.center();let c=Math.cos(degrees*Math.PI/180),s=Math.sin(degrees*Math.PI/180);for(let k=0;k<this.p.length;k+=3){let x=(this.p[k]-this.state.x)*factor,y=(this.p[k+1]-this.state.y)*factor;this.p[k]=this.state.x+x*c-y*s;this.p[k+1]=this.state.y+x*s+y*c;this.p[k+2]=Math.max(3,this.p[k+2]*factor);}this.old.set(this.p);this.state.width*=factor;this.state.angle+=degrees;this.spacing*=factor;if(this.restCurvature)for(let n=0;n<COUNT;n++)this.restCurvature[n]*=factor;for(const e of this.edges){e[2]*=factor;if(e[4])e[4]*=factor;}this.active=true;this.quiet=0;this.settleAge=0;}
  step(){
    const p=this.p,old=this.old,dt=1/120;let motion=0;
    for(let sub=0;sub<2;sub++){
      this.before.set(p);
      for(let k=0;k<p.length;k+=3){let ground=this.floors[k/3]=this.floor(p[k],p[k+1]),contact=p[k+2]<ground+.7;let vx=(p[k]-old[k])*(contact?.35:this.airDamping),vy=(p[k+1]-old[k+1])*(contact?.35:this.airDamping),vz=(p[k+2]-old[k+2])*.98;const speed=Math.sqrt(vx*vx+vy*vy+vz*vz);if(speed>14){vx*=14/speed;vy*=14/speed;vz*=14/speed;}old[k]=p[k];old[k+1]=p[k+1];old[k+2]=p[k+2];p[k]+=vx;p[k+1]+=vy;p[k+2]+=vz-this.gravity*dt*dt;}
      let pinTarget;
      if(sub===0)this.contacts.prepare(p,this.before,this.spacing,this.contactThickness);
      if(this.pin>=0){let k=this.pin*3,dx=this.target[0]-p[k],dy=this.target[1]-p[k+1],dz=this.target[2]-p[k+2],length=Math.sqrt(dx*dx+dy*dy+dz*dz),f=Math.min(1,8/Math.max(.001,length));pinTarget=[p[k]+dx*f,p[k+1]+dy*f,p[k+2]+dz*f];}
      for(let pass=0;pass<16;pass++){
        const reverse=pass%2;
        for(let index=0;index<this.edges.length;index++){
          const e=this.edges[reverse?this.edges.length-1-index:index],a=e[0]*3,b=e[1]*3;let dx=p[b]-p[a],dy=p[b+1]-p[a+1],dz=p[b+2]-p[a+2],d=Math.sqrt(dx*dx+dy*dy+dz*dz);if(d<.00001)continue;
          let wa=e[0]===this.pin?0:1,wb=e[1]===this.pin?0:1,f=(d-e[2])/d*e[3]/(wa+wb||1);dx*=f;dy*=f;dz*=f;if(wa){p[a]+=dx;p[a+1]+=dy;p[a+2]+=dz;}if(wb){p[b]-=dx;p[b+1]-=dy;p[b+2]-=dz;}
        }
        if(this.restCurvature&&this.pin<0)this.retainCurvature();
        if(pinTarget){const k=this.pin*3;p[k]=pinTarget[0];p[k+1]=pinTarget[1];p[k+2]=pinTarget[2];if(pass===0||pass===8||pass===15)this.tether();}
        if(pass===7||pass===15)this.contacts.solve(p,this.pin);
        for(let k=0;k<p.length;k+=3){const ground=this.floors[k/3];if(p[k+2]<ground+.3&&k!==this.pin*3){let dx=p[k]-this.before[k],dy=p[k+1]-this.before[k+1],d=Math.sqrt(dx*dx+dy*dy),friction=Math.min(1,(Math.max(0,ground-p[k+2])*1.5+.18)/Math.max(d,.00001));p[k]-=dx*friction;p[k+1]-=dy*friction;}p[k+2]=Math.max(p[k+2],ground);}
      }
      this.limitStrain();
      this.contacts.solve(p,this.pin);
      for(let k=0;k<p.length;k+=3)p[k+2]=Math.max(p[k+2],this.floors[k/3]);
      for(let k=0;k<p.length;k+=3){let ground=this.floor(p[k],p[k+1]);if(p[k+2]<ground+.5&&k!==this.pin*3){let dx=p[k]-old[k],dy=p[k+1]-old[k+1];if(dx*dx+dy*dy<.0049){p[k]=old[k];p[k+1]=old[k+1];}old[k]=p[k]-(p[k]-old[k])*.25;old[k+1]=p[k+1]-(p[k+1]-old[k+1])*.25;old[k+2]=p[k+2];}motion+=Math.abs(p[k]-this.before[k])+Math.abs(p[k+1]-this.before[k+1])+Math.abs(p[k+2]-this.before[k+2]);}
    }
    this.quiet=this.pin<0&&motion/COUNT<.065?this.quiet+1:0;this.settleAge=this.pin<0?(this.settleAge||0)+1:0;this.active=this.pin>=0||(this.quiet<24&&this.settleAge<180);if(!this.active)this.old.set(this.p);return motion/COUNT;
  }
  retainCurvature(){
    // Signed local curvature retains a soft wrinkle; pair distances alone can
    // also be satisfied by a completely flat compressed patch.
    const p=this.p,stride=(NX+1)*3;
    for(let y=1;y<NY;y++)for(let x=1;x<NX;x++){
      const n=y*(NX+1)+x,k=n*3+2,a=k-3,b=k+3,c=k-stride,d=k+stride;
      const change=(this.restCurvature[n]-(p[k]-(p[a]+p[b]+p[c]+p[d])*.25))*.12;
      p[k]+=change;const shift=change*.25;p[a]-=shift;p[b]-=shift;p[c]-=shift;p[d]-=shift;
    }
  }
  tether(){
    // Long-range strain limits propagate a pull through the fabric without
    // turning a corner into an elastic spike. They only cap distance, never
    // attract the cloth back to a flat pose.
    const p=this.p,k=this.pin*3,gx=this.pin%(NX+1),gy=Math.floor(this.pin/(NX+1));
    for(let n=0;n<COUNT;n++){if(n===this.pin)continue;const a=n*3,rx=(n%(NX+1)-gx)*this.state.width/NX,ry=(Math.floor(n/(NX+1))-gy)*this.state.width*2/3/NY,max=Math.sqrt(rx*rx+ry*ry)*1.015;let dx=p[a]-p[k],dy=p[a+1]-p[k+1],dz=p[a+2]-p[k+2],length=Math.sqrt(dx*dx+dy*dy+dz*dz);if(length<=max)continue;const f=(length-max)/length;p[a]-=dx*f;p[a+1]-=dy*f;p[a+2]-=dz*f;}
  }
  limitStrain(){
    const p=this.p;
    for(let pass=0;pass<6;pass++){let changed=false;
      for(let index=0;index<this.edges.length;index++){const e=this.edges[pass%2?this.edges.length-1-index:index];if(e[3]<.5)continue;let a=e[0]*3,b=e[1]*3,dx=p[b]-p[a],dy=p[b+1]-p[a+1],dz=p[b+2]-p[a+2],d2=dx*dx+dy*dy+dz*dz,max=e[2]*1.075;if(d2<=max*max)continue;changed=true;let d=Math.sqrt(d2),wa=e[0]===this.pin?0:1,wb=e[1]===this.pin?0:1,f=(d-max)/d/(wa+wb||1);if(wa){p[a]+=dx*f;p[a+1]+=dy*f;p[a+2]+=dz*f;}if(wb){p[b]-=dx*f;p[b+1]-=dy*f;p[b+2]-=dz*f;}}
      for(let k=0;k<p.length;k+=3)p[k+2]=Math.max(p[k+2],this.floors[k/3]);if(!changed)break;
    }
  }
  maxStretch(){let max=1;for(const [a,b,length,k] of this.edges)if(k>.5)max=Math.max(max,Math.hypot(this.p[a*3]-this.p[b*3],this.p[a*3+1]-this.p[b*3+1],this.p[a*3+2]-this.p[b*3+2])/length);return max;}
  load(shape){
    if(!Array.isArray(shape)||shape.length!==this.p.length||shape.some(v=>!Number.isFinite(v)||Math.abs(v)>15000))return;
    const flat=new Float32Array(this.p);this.p.set(shape);this.repairedIntersections=crossings(this);
    if(this.repairedIntersections){
      // Invalid legacy poses already have faces on the wrong side. Preserve
      // as much of the shape as possible along a collision-free path from rest.
      const blend=t=>{for(let k=0;k<this.p.length;k++)this.p[k]=flat[k]+(shape[k]-flat[k])*t;};
      let lo=0,hi=1;
      for(let n=1;n<=10;n++){const t=n/10;blend(t);if(crossings(this)){hi=t;break;}lo=t;}
      for(let n=0;n<7;n++){const mid=(lo+hi)*.5;blend(mid);if(crossings(this))hi=mid;else lo=mid;}
      blend(lo*.45);
    }
    this.old.set(this.p);this.rememberCreases(1);this.active=true;
  }
}
