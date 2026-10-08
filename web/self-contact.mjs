// Surface contacts, including mesh edges. Point/point repulsion alone leaves
// the open area between particles free for another fold to pass through.
export class SelfContact {
  constructor(nx,ny){
    this.nx=nx;this.ny=ny;this.triangles=[];this.edges=[];
    const seen=new Set();
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
      const a=y*(nx+1)+x;
      for(const tri of [[a,a+nx+1,a+1],[a+1,a+nx+1,a+nx+2]]){
        this.triangles.push(tri);
        for(let n=0;n<3;n++){let u=tri[n],v=tri[(n+1)%3];if(u>v)[u,v]=[v,u];const key=u*10000+v;if(!seen.has(key)){seen.add(key);this.edges.push([u,v]);}}
      }
    }
    this.vertexPairs=[];this.edgePairs=[];
    this.vertexCount=0;this.edgeCount=0;
    this.triangleBounds=new Float64Array(this.triangles.length*6);
    this.edgeData=new Float64Array(this.edges.length*13);
    this.vertexTriangles=Array.from({length:(nx+1)*(ny+1)},()=>[]);
    this.vertexEdges=Array.from({length:(nx+1)*(ny+1)},()=>[]);
    this.triangles.forEach((tri,id)=>tri.forEach(v=>this.vertexTriangles[v].push(id)));
    this.edges.forEach((edge,id)=>edge.forEach(v=>this.vertexEdges[v].push(id)));
    this.vertexStamp=new Uint32Array((nx+1)*(ny+1)*this.triangles.length);
    this.edgeStamp=new Uint32Array(this.edges.length*this.edges.length);
    this.vertexAllowed=new Uint8Array(this.vertexStamp.length);this.edgeAllowed=new Uint8Array(this.edgeStamp.length);this.epoch=0;
    this.edgeExpansions=new Array((nx+1)*(ny+1)*(nx+1)*(ny+1));
  }
  near(a,b){return Math.abs(a%(this.nx+1)-b%(this.nx+1))<=1&&Math.abs(Math.floor(a/(this.nx+1))-Math.floor(b/(this.nx+1)))<=1;}
  prepare(p,previous,spacing,thickness){
    this.previous=previous;this.thickness=thickness;this.vertexCount=0;this.edgeCount=0;
    // Geometry is unchanged during candidate generation: compute these once,
    // instead of rebuilding the same edge vectors and bounds for every pair.
    const tb=this.triangleBounds,ed=this.edgeData;
    for(let id=0;id<this.triangles.length;id++){
      const tri=this.triangles[id],a=tri[0]*3,b=tri[1]*3,c=tri[2]*3,k=id*6;
      for(let axis=0;axis<3;axis++){tb[k+axis*2]=Math.min(p[a+axis],p[b+axis],p[c+axis]);tb[k+axis*2+1]=Math.max(p[a+axis],p[b+axis],p[c+axis]);}
    }
    for(let id=0;id<this.edges.length;id++){
      const edge=this.edges[id],a=edge[0]*3,b=edge[1]*3,k=id*13;
      let length2=0;for(let axis=0;axis<3;axis++){const delta=p[b+axis]-p[a+axis];ed[k+axis]=p[a+axis];ed[k+3+axis]=delta;length2+=delta*delta;ed[k+7+axis*2]=Math.min(p[a+axis],p[b+axis]);ed[k+8+axis*2]=Math.max(p[a+axis],p[b+axis]);}ed[k+6]=length2;
    }
    // A particle grid finds nearby patches; only their attached faces/edges
    // become narrow-phase candidates. No large triangle AABB grid is allocated.
    const radius=spacing*1.6+thickness,cell=radius,r2=radius*radius,grid=new Map(),stride=this.nx+1;
    this.epoch=(this.epoch+1)>>>0;if(!this.epoch){this.vertexStamp.fill(0);this.edgeStamp.fill(0);this.epoch=1;}const epoch=this.epoch;
    const key=(x,y,z)=>((x+1024)&2047)|(((y+1024)&2047)<<11)|(((z+512)&1023)<<22);
    const vertexPair=(n,id)=>{const code=n*this.triangles.length+id;if(this.vertexStamp[code]===epoch)return;this.vertexStamp[code]=epoch;const tri=this.triangles[id];let allowed=this.vertexAllowed[code];if(!allowed)this.vertexAllowed[code]=allowed=tri.some(v=>this.near(n,v))?1:2;if(allowed===1)return;const k=n*3,b=id*6,margin=thickness+7;
      if(p[k]<tb[b]-margin||p[k]>tb[b+1]+margin||p[k+1]<tb[b+2]-margin||p[k+1]>tb[b+3]+margin||p[k+2]<tb[b+4]-margin||p[k+2]>tb[b+5]+margin)return;
      let pair=this.vertexPairs[this.vertexCount];if(!pair)this.vertexPairs[this.vertexCount]=pair=[0,0,0];pair[0]=n;pair[1]=id;pair[2]=this.planeSide(previous,n,tri);this.vertexCount++;};
    for(let n=0;n<p.length/3;n++){
      const k=n*3,x=Math.floor(p[k]/cell),y=Math.floor(p[k+1]/cell),z=Math.floor(p[k+2]/cell),gx=n%stride,gy=Math.floor(n/stride);
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
        const bucket=grid.get(key(x+dx,y+dy,z+dz));if(!bucket)continue;
        for(const m of bucket){
          const rx=gx-m%stride,ry=gy-Math.floor(m/stride);if(Math.abs(rx)<=1&&Math.abs(ry)<=1)continue;
          const l=m*3,ax=p[k]-p[l],ay=p[k+1]-p[l+1],az=p[k+2]-p[l+2],d2=ax*ax+ay*ay+az*az;
          if(d2>r2||d2>(rx*rx+ry*ry)*spacing*spacing*.7)continue;
          for(const id of this.vertexTriangles[m])vertexPair(n,id);
          for(const id of this.vertexTriangles[n])vertexPair(m,id);
          const expansionKey=n*this.vertexEdges.length+m;
          let expansion=this.edgeExpansions[expansionKey];
          if(!expansion){
            const codes=[];
            for(const i of this.vertexEdges[n])for(const j of this.vertexEdges[m]){
              const lo=i<j?i:j,hi=i<j?j:i,code=lo*this.edges.length+hi;
              const a=this.edges[lo],b=this.edges[hi];let allowed=this.edgeAllowed[code];if(!allowed)this.edgeAllowed[code]=allowed=(this.near(a[0],b[0])||this.near(a[0],b[1])||this.near(a[1],b[0])||this.near(a[1],b[1]))?1:2;if(allowed===2)codes.push(code);
            }
            this.edgeExpansions[expansionKey]=expansion=new Int32Array(codes);
          }
          for(let ei=0;ei<expansion.length;ei++){
            const code=expansion[ei];if(this.edgeStamp[code]===epoch)continue;this.edgeStamp[code]=epoch;
            const lo=Math.floor(code/this.edges.length),hi=code-lo*this.edges.length;
            if(this.edgeProbe(lo,hi,thickness+7)){let pair=this.edgePairs[this.edgeCount];if(!pair)this.edgePairs[this.edgeCount]=pair=[0,0];pair[0]=lo;pair[1]=hi;this.edgeCount++;}
          }
        }
      }
      const h=key(x,y,z);let bucket=grid.get(h);if(!bucket)grid.set(h,bucket=[]);bucket.push(n);
    }
  }

  edgeProbe(i,j,h){
    const ed=this.edgeData,a=i*13,b=j*13;
    if(ed[a+8]+h<ed[b+7]||ed[b+8]+h<ed[a+7]||ed[a+10]+h<ed[b+9]||ed[b+10]+h<ed[a+9]||ed[a+12]+h<ed[b+11]||ed[b+12]+h<ed[a+11])return false;
    const ux=ed[a+3],uy=ed[a+4],uz=ed[a+5],vx=ed[b+3],vy=ed[b+4],vz=ed[b+5],wx=ed[a]-ed[b],wy=ed[a+1]-ed[b+1],wz=ed[a+2]-ed[b+2];
    const uu=ed[a+6],vv=ed[b+6],uv=ux*vx+uy*vy+uz*vz,uw=ux*wx+uy*wy+uz*wz,vw=vx*wx+vy*wy+vz*wz,den=uu*vv-uv*uv;
    if(uu<.0001||vv<.0001)return false;
    let s=den>.0001?Math.max(0,Math.min(1,(uv*vw-vv*uw)/den)):0,t=(uv*s+vw)/vv;
    if(t<0){t=0;s=Math.max(0,Math.min(1,-uw/uu));}else if(t>1){t=1;s=Math.max(0,Math.min(1,(uv-uw)/uu));}
    const x=wx+s*ux-t*vx,y=wy+s*uy-t*vy,z=wz+s*uz-t*vz;
    return x*x+y*y+z*z<h*h;
  }

  planeSide(p,n,tri){
    const a=tri[0]*3,b=tri[1]*3,c=tri[2]*3,k=n*3,ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vx=p[c]-p[a],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2];
    return Math.sign((uy*vz-uz*vy)*(p[k]-p[a])+(uz*vx-ux*vz)*(p[k+1]-p[a+1])+(ux*vy-uy*vx)*(p[k+2]-p[a+2]))||1;
  }
  solve(p,pin){
    const thickness=this.thickness;
    for(let index=0;index<this.vertexCount;index++){
      const pair=this.vertexPairs[index],n=pair[0],id=pair[1],side=pair[2];
      const tri=this.triangles[id],k=n*3,a=tri[0]*3,b=tri[1]*3,c=tri[2]*3;
      const ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vx=p[c]-p[a],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2];
      let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,nl=Math.sqrt(nx*nx+ny*ny+nz*nz);if(nl<.0001)continue;nx/=nl;ny/=nl;nz/=nl;
      const wx=p[k]-p[a],wy=p[k+1]-p[a+1],wz=p[k+2]-p[a+2],distance=(wx*nx+wy*ny+wz*nz)*side;
      if(distance>=thickness||distance< -25)continue;
      const uu=ux*ux+uy*uy+uz*uz,uv=ux*vx+uy*vy+uz*vz,vv=vx*vx+vy*vy+vz*vz,wu=wx*ux+wy*uy+wz*uz,wv=wx*vx+wy*vy+wz*vz,den=uu*vv-uv*uv;
      if(den<.0001)continue;const v=(wu*vv-wv*uv)/den,w=(wv*uu-wu*uv)/den,u=1-v-w;
      if(u<0||v<0||w<0)continue;
      const wn=n===pin?.15:1,wa=tri[0]===pin?.15:1,wb=tri[1]===pin?.15:1,wc=tri[2]===pin?.15:1;
      const delta=Math.min(5,thickness-distance)/(wn+wa*u*u+wb*v*v+wc*w*w)*.9;
      nx*=side*delta;ny*=side*delta;nz*=side*delta;
      p[k]+=nx*wn;p[k+1]+=ny*wn;p[k+2]+=nz*wn;
      p[a]-=nx*u*wa;p[a+1]-=ny*u*wa;p[a+2]-=nz*u*wa;
      p[b]-=nx*v*wb;p[b+1]-=ny*v*wb;p[b+2]-=nz*v*wb;
      p[c]-=nx*w*wc;p[c+1]-=ny*w*wc;p[c+2]-=nz*w*wc;
    }
    for(let index=0;index<this.edgeCount;index++){const pair=this.edgePairs[index];this.edgeContact(p,pin,this.edges[pair[0]],this.edges[pair[1]],thickness);}
  }
  edgeContact(p,pin,edge,other,h,probe=false){
    const a=edge[0]*3,b=edge[1]*3,c=other[0]*3,d=other[1]*3;
    if(Math.max(p[a],p[b])+h<Math.min(p[c],p[d])||Math.max(p[c],p[d])+h<Math.min(p[a],p[b])||Math.max(p[a+1],p[b+1])+h<Math.min(p[c+1],p[d+1])||Math.max(p[c+1],p[d+1])+h<Math.min(p[a+1],p[b+1])||Math.max(p[a+2],p[b+2])+h<Math.min(p[c+2],p[d+2])||Math.max(p[c+2],p[d+2])+h<Math.min(p[a+2],p[b+2]))return false;
    const ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vx=p[d]-p[c],vy=p[d+1]-p[c+1],vz=p[d+2]-p[c+2],wx=p[a]-p[c],wy=p[a+1]-p[c+1],wz=p[a+2]-p[c+2];
    const uu=ux*ux+uy*uy+uz*uz,vv=vx*vx+vy*vy+vz*vz,uv=ux*vx+uy*vy+uz*vz,uw=ux*wx+uy*wy+uz*wz,vw=vx*wx+vy*wy+vz*wz,den=uu*vv-uv*uv;
    if(uu<.0001||vv<.0001)return;
    let s=den>.0001?Math.max(0,Math.min(1,(uv*vw-vv*uw)/den)):0,t=(uv*s+vw)/vv;
    if(t<0){t=0;s=Math.max(0,Math.min(1,-uw/uu));}else if(t>1){t=1;s=Math.max(0,Math.min(1,(uv-uw)/uu));}
    let nx=wx+s*ux-t*vx,ny=wy+s*uy-t*vy,nz=wz+s*uz-t*vz;const length2=nx*nx+ny*ny+nz*nz;
    if(length2>=h*h)return;
    if(probe)return true;
    let len=Math.sqrt(length2);
    const q=this.previous,px=(q[a]*(1-s)+q[b]*s)-(q[c]*(1-t)+q[d]*t),py=(q[a+1]*(1-s)+q[b+1]*s)-(q[c+1]*(1-t)+q[d+1]*t),pz=(q[a+2]*(1-s)+q[b+2]*s)-(q[c+2]*(1-t)+q[d+2]*t);
    if(len>.0001){nx/=len;ny/=len;nz/=len;if(nx*px+ny*py+nz*pz<0&&s>.01&&s<.99&&t>.01&&t<.99){nx=-nx;ny=-ny;nz=-nz;len=-len;}}
    else{nx=uy*vz-uz*vy;ny=uz*vx-ux*vz;nz=ux*vy-uy*vx;const l=Math.sqrt(nx*nx+ny*ny+nz*nz);if(l<.0001)return;const sign=nx*px+ny*py+nz*pz<0?-1:1;nx=nx/l*sign;ny=ny/l*sign;nz=nz/l*sign;}
    const wa=edge[0]===pin?.15:1,wb=edge[1]===pin?.15:1,wc=other[0]===pin?.15:1,wd=other[1]===pin?.15:1,u=1-s,v=1-t;
    const delta=Math.min(5,h-len)/(wa*u*u+wb*s*s+wc*v*v+wd*t*t)*.9;
    nx*=delta;ny*=delta;nz*=delta;
    p[a]+=nx*u*wa;p[a+1]+=ny*u*wa;p[a+2]+=nz*u*wa;p[b]+=nx*s*wb;p[b+1]+=ny*s*wb;p[b+2]+=nz*s*wb;
    p[c]-=nx*v*wc;p[c+1]-=ny*v*wc;p[c+2]-=nz*v*wc;p[d]-=nx*t*wd;p[d+1]-=ny*t*wd;p[d+2]-=nz*t*wd;
  }
}
