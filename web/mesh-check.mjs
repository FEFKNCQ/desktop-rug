export function crossings(sim){
  const p=sim.p,tris=sim.contacts.triangles,edges=sim.contacts.edges;let hits=0;
  for(const [u,v] of edges){const a=u*3,b=v*3,dx=p[b]-p[a],dy=p[b+1]-p[a+1],dz=p[b+2]-p[a+2];
    for(const tri of tris){if(tri.some(n=>sim.contacts.near(n,u)||sim.contacts.near(n,v)))continue;
      const i=tri[0]*3,j=tri[1]*3,k=tri[2]*3;
      if(Math.max(p[a],p[b])<Math.min(p[i],p[j],p[k])||Math.min(p[a],p[b])>Math.max(p[i],p[j],p[k])||Math.max(p[a+1],p[b+1])<Math.min(p[i+1],p[j+1],p[k+1])||Math.min(p[a+1],p[b+1])>Math.max(p[i+1],p[j+1],p[k+1])||Math.max(p[a+2],p[b+2])<Math.min(p[i+2],p[j+2],p[k+2])||Math.min(p[a+2],p[b+2])>Math.max(p[i+2],p[j+2],p[k+2]))continue;
      const e1=[p[j]-p[i],p[j+1]-p[i+1],p[j+2]-p[i+2]],e2=[p[k]-p[i],p[k+1]-p[i+1],p[k+2]-p[i+2]],h=[dy*e2[2]-dz*e2[1],dz*e2[0]-dx*e2[2],dx*e2[1]-dy*e2[0]],det=e1[0]*h[0]+e1[1]*h[1]+e1[2]*h[2];if(Math.abs(det)<1e-6)continue;
      const inv=1/det,s=[p[a]-p[i],p[a+1]-p[i+1],p[a+2]-p[i+2]],r=(s[0]*h[0]+s[1]*h[1]+s[2]*h[2])*inv;if(r<1e-4||r>1-1e-4)continue;
      const q=[s[1]*e1[2]-s[2]*e1[1],s[2]*e1[0]-s[0]*e1[2],s[0]*e1[1]-s[1]*e1[0]],t=(dx*q[0]+dy*q[1]+dz*q[2])*inv,along=(e2[0]*q[0]+e2[1]*q[1]+e2[2]*q[2])*inv;
      if(t>1e-4&&r+t<1-1e-4&&along>1e-4&&along<1-1e-4)hits++;
    }
  }
  return hits;
}
