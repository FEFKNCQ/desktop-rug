import * as THREE from './node_modules/three/build/three.module.js';
import {NX,NY,COUNT} from './cloth.mjs';
// Instanced curved strands, sampled from the existing cloth mesh on the GPU.
// No hair particle simulation, per-strand CPU transforms or transparent sorting.
export function createStrands(gridX=NX,gridY=NY){
  const countPoints=(gridX+1)*(gridY+1),data=new Float32Array(countPoints*4),normals=new Float32Array(countPoints*4);
  const pt=new THREE.DataTexture(data,gridX+1,gridY+1,THREE.RGBAFormat,THREE.FloatType),nt=new THREE.DataTexture(normals,gridX+1,gridY+1,THREE.RGBAFormat,THREE.FloatType);
  pt.minFilter=pt.magFilter=nt.minFilter=nt.magFilter=THREE.NearestFilter;
  const geometry=new THREE.InstancedBufferGeometry(),v=[],ix=[];for(let j=0;j<4;j++){v.push(-.5,j/3,0,.5,j/3,0);if(j<3){let n=j*2;ix.push(n,n+1,n+2,n+1,n+3,n+2);}}
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geometry.setIndex(ix);
  const count=28000,roots=new Float32Array(count*2),seeds=new Float32Array(count*3);let seed=4319;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;};
  for(let i=0;i<count;i++){roots[i*2]=random();roots[i*2+1]=random();seeds[i*3]=random();seeds[i*3+1]=random();seeds[i*3+2]=i<20000?1:-1;}
  geometry.setAttribute('rootUv',new THREE.InstancedBufferAttribute(roots,2));geometry.setAttribute('strandSeed',new THREE.InstancedBufferAttribute(seeds,3));geometry.instanceCount=count;
  const material=new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms:{clothPoints:{value:pt},clothNormals:{value:nt},gridSize:{value:new THREE.Vector2(gridX+1,gridY+1)}},
    vertexShader:`uniform sampler2D clothPoints,clothNormals;uniform vec2 gridSize;attribute vec2 rootUv;attribute vec3 strandSeed;varying float hairT,hairAcross,lightness,variation;
    vec3 readPoint(vec2 cell){return texture2D(clothPoints,(cell+.5)/gridSize).xyz;}
    void main(){vec2 grid=rootUv*(gridSize-1.0),cell=floor(grid),f=fract(grid);cell=min(cell,gridSize-2.0);vec3 a=readPoint(cell),b=readPoint(cell+vec2(1,0)),c=readPoint(cell+vec2(0,1)),d=readPoint(cell+vec2(1,1));vec3 root=mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
    vec3 U=normalize(mix(b-a,d-c,f.y)),V=normalize(mix(c-a,d-b,f.x));vec3 na=texture2D(clothNormals,(cell+.5)/gridSize).xyz,nb=texture2D(clothNormals,(cell+vec2(1.5,.5))/gridSize).xyz,nc=texture2D(clothNormals,(cell+vec2(.5,1.5))/gridSize).xyz,nd=texture2D(clothNormals,(cell+1.5)/gridSize).xyz;vec3 N=normalize(mix(mix(na,nb,f.x),mix(nc,nd,f.x),f.y))*strandSeed.z;
    float angle=1.4+sin(rootUv.x*19.0+rootUv.y*13.0)*.8+(strandSeed.x-.5)*1.1;vec3 T=normalize(U*cos(angle)+V*sin(angle));vec3 side=normalize(cross(N,T));float t=position.y,len=9.0+strandSeed.x*11.0,width=.7+strandSeed.y*.9;
    vec3 point=root+T*(t*len)+N*(3.0+sin(t*2.1)*(7.0+strandSeed.y*6.0))+side*(position.x*width+sin(t*3.0)*strandSeed.x*2.2);gl_Position=projectionMatrix*modelViewMatrix*vec4(point,1.0);
    hairT=t;hairAcross=position.x;variation=strandSeed.x;lightness=.62+.38*max(0.0,dot(N,normalize(vec3(-.4,.6,1.0))));}`,
    fragmentShader:`varying float hairT,hairAcross,lightness,variation;void main(){float width=mix(.51,.07,pow(hairT,1.6));if(abs(hairAcross)>width)discard;vec3 root=vec3(.46,.405,.32),tip=vec3(.94,.90,.81);vec3 col=mix(root,tip,.35+.65*sqrt(hairT))*lightness*(.9+variation*.15);col*=.92+.13*cos(hairAcross*5.0);gl_FragColor=vec4(col,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`});
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;
  return {mesh,update(positions,ns){for(let i=0;i<countPoints;i++){data[i*4]=positions[i*3];data[i*4+1]=positions[i*3+1];data[i*4+2]=positions[i*3+2];normals[i*4]=ns[i*3];normals[i*4+1]=ns[i*3+1];normals[i*4+2]=ns[i*3+2];}pt.needsUpdate=nt.needsUpdate=true;}};
}
