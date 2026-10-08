import {NX,NY} from './cloth.mjs';
export const VX=NX*2,VY=NY*2,VCOUNT=(VX+1)*(VY+1);
// Subdivide on the exact collision triangles. Cubic interpolation may leave
// a triangle even when clamped to its cell bounds. Smooth vertex normals still
// soften lighting without moving a folded layer outside its collision surface.
const stencils=[];
for(let y=0;y<=VY;y++)for(let x=0;x<=VX;x++){
  const gx=x/2,gy=y/2,ix=Math.min(NX-1,Math.floor(gx)),iy=Math.min(NY-1,Math.floor(gy));
  const u=gx-ix,v=gy-iy,a=(iy*(NX+1)+ix)*3,b=a+3,c=a+(NX+1)*3,d=a+(NX+2)*3;
  stencils.push(u+v<=1?[[a,1-u-v],[b,u],[c,v]]:[[b,1-v],[c,1-u],[d,u+v-1]]);
}
export function smoothSurface(source,out){for(let n=0;n<stencils.length;n++)for(let axis=0;axis<3;axis++){let v=0;for(const [k,w] of stencils[n])v+=source[k+axis]*w;out[n*3+axis]=axis===1?-v:v;}}
