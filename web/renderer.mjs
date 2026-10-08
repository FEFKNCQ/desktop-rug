import * as THREE from './node_modules/three/build/three.module.js';
import {NX,NY,COUNT} from './cloth.mjs';
import {createStrands} from './fur.mjs';
import {PushIcons} from './push-icons.mjs';
import {demoIconApi} from './demo-icons.mjs';
import {organizePlan} from './organize.mjs';
import {benchmarkBroom} from './broom-benchmark.mjs';
import {surfaceMaterials} from './materials.mjs';
import {benchmarkDrag} from './drag-benchmark.mjs';
import {ClothInput} from './cloth-input.mjs';
import {VX,VY,VCOUNT,smoothSurface} from './surface.mjs';
const api=window.desktopRug,settings=await api.settings();if(settings.preview)Object.assign(settings,{x:innerWidth*.53,y:innerHeight*.44,width:Math.min(680,innerWidth*.62),angle:-4,shape:null});else if(!settings.shape){settings.width=Math.max(600,settings.width);settings.x=Math.max(settings.width*.55,Math.min(innerWidth-settings.width*.55,settings.x));settings.y=Math.max(settings.width*.37,Math.min(innerHeight-settings.width*.37-75,settings.y));}let state={x:settings.x,y:settings.y,width:settings.width,angle:settings.angle};
const canvas=document.querySelector('canvas'),hint=document.querySelector('#hint'),broom=document.querySelector('#broom'),nav=document.querySelector('nav');
if(settings.preview)document.body.classList.add('preview');
const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1));renderer.setSize(innerWidth,innerHeight);renderer.setClearColor(0,0);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(0,innerWidth,0,-innerHeight,.1,3000);camera.position.set(0,0,1500);camera.lookAt(0,0,0);
scene.add(new THREE.HemisphereLight(0xfff7e9,0x8c7961,1.6));const light=new THREE.DirectionalLight(0xfff1db,2.4);light.position.set(innerWidth*.2,-innerHeight*.18,750);light.target.position.set(innerWidth*.5,-innerHeight*.5,0);light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-1000,right:1000,top:750,bottom:-750,near:10,far:1800});light.shadow.bias=-.0002;light.shadow.normalBias=1.8;scene.add(light,light.target);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(6000,4000),new THREE.ShadowMaterial({color:0x433829,opacity:.27,depthWrite:false}));floor.position.set(innerWidth/2,-innerHeight/2,-1);floor.receiveShadow=true;scene.add(floor);
const geometry=new THREE.BufferGeometry(),positions=new Float32Array(VCOUNT*3),uv=new Float32Array(VCOUNT*2),indices=[],hitIndices=[];
for(let j=0;j<=VY;j++)for(let i=0;i<=VX;i++){let n=j*(VX+1)+i;uv[n*2]=i/VX;uv[n*2+1]=j/VY;if(j<VY&&i<VX)indices.push(n,n+VX+1,n+1,n+1,n+VX+1,n+VX+2);}
for(let j=0;j<NY;j++)for(let i=0;i<NX;i++){let n=j*(NX+1)+i;hitIndices.push(n,n+NX+1,n+1,n+1,n+NX+1,n+NX+2);}
geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setIndex(indices);
const body=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xe4dac8,roughness:1,metalness:0,side:THREE.DoubleSide}));body.castShadow=true;body.receiveShadow=true;body.frustumCulled=false;scene.add(body);
const fur=[];
function makeFur(layer,side){
  const material=new THREE.MeshStandardMaterial({color:0xf2eadd,roughness:1,metalness:0,side:side>0?THREE.FrontSide:THREE.BackSide,alphaTest:.5});
  material.userData.furUniforms={furLayer:{value:layer},furSide:{value:side},furHeight:{value:10},furDensity:{value:1}};
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,material.userData.furUniforms);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float furLayer;uniform float furSide;uniform float furHeight;varying vec2 furUv;').replace('#include <begin_vertex>','vec3 transformed = position + normal * furLayer * furSide * furHeight;furUv=uv;transformed.xy+=vec2(sin(uv.y*37.0),cos(uv.x*29.0))*furLayer*furLayer*furHeight*.15;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float furLayer;uniform float furDensity;varying vec2 furUv;float hairHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}')
    .replace('#include <alphatest_fragment>',`vec2 hair=furUv*vec2(510.0,340.0)*furDensity;vec2 cell=floor(hair);float h=hairHash(cell);vec2 strand=fract(hair)-.5;strand-=vec2(hairHash(cell+9.0)-.5,hairHash(cell+31.0)-.5)*furLayer*.55;float radius=mix(.49,.09,furLayer)*(.8+h*.4);if(dot(strand,strand)>radius*radius||h<furLayer*.08)discard;diffuseColor.rgb*=mix(.76,1.04,sqrt(furLayer))*(.93+h*.11);`);
  };material.customProgramCacheKey=()=>`fur-${side}`;
  const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;mesh.frustumCulled=false;scene.add(mesh);fur.push(mesh);
}
for(let i=1;i<=3;i++)makeFur(i/3,1);for(let i=1;i<=2;i++)makeFur(i/2,-1);
const strands=createStrands(VX,VY);scene.add(strands.mesh);
const surfaces=surfaceMaterials(renderer,body,fur,strands),rugStyles=settings.rugStyles;
let currentRug=rugStyles.find(s=>s.id===settings.rugStyle)||rugStyles[0],rugBusy=false;
const worker=new Worker(settings.dragBaseline?'../revisions/v4.5/web/worker.mjs':'./worker.mjs',{type:'module'});let latest=null,dirty=false,active=true,dragging=false,whole=false,broomMode=false,readySweep=false,last={x:0,y:0},icons=[],picked=new Set(),pending=[],sweepCount=0,batchTimer,saveTimer,saveWanted=false;
let mask=new Uint8Array(Math.ceil(innerWidth/12)*Math.ceil(innerHeight/12)),maskW=Math.ceil(innerWidth/12),bounds={minX:0,maxX:0,minY:0,maxY:0};
const frameTimes=[],drawIntervals=[],poseIntervals=[],simulationTimes=[],renderCpu=[],inputTimes=[],shots=new Set();let canDraw=false,lastDraw=0,lastFrame=performance.now(),lastPose=0,poseCount=0,benchStart=0,benchGrab=false,benchDone=false,benchReleased=false;
let requestedFrame=0;function requestFrame(){if(!requestedFrame)requestedFrame=requestAnimationFrame(animate);}
const clothInput=new ClothInput(data=>worker.postMessage(data));
const workerSend=data=>settings.dragBaseline?worker.postMessage(data):clothInput.send(data);
let firstPoseReady,recoveryNotified=false;const firstPose=new Promise(resolve=>{firstPoseReady=resolve;});
let shape;try{shape=settings.shape?JSON.parse(settings.shape):null;}catch{}workerSend({type:'init',state,shape,material:currentRug.material,viewport:{width:innerWidth,height:innerHeight}});
worker.onmessage=({data:m})=>{if(m.type==='motionAck'){clothInput.acknowledge(m.sequence);return;}latest=m.positions;state=m.state;if(m.repairedIntersections&&!recoveryNotified&&!settings.preview){recoveryNotified=true;api.call('backupShape').then(()=>{saveWanted=true;if(!active)scheduleSave();status('旧版穿插形状已备份并恢复，可以重新折叠');}).catch(e=>status(e.message));}active=m.active;simulationTimes.push(m.ms);if(simulationTimes.length>1200)simulationTimes.shift();const now=performance.now();if(lastPose)poseIntervals.push(now-lastPose);if(poseIntervals.length>1200)poseIntervals.shift();lastPose=now;poseCount++;dirty=true;firstPoseReady();requestFrame();if(!active&&saveWanted)scheduleSave();};
worker.onerror=e=>{hint.textContent='布料计算出错，请重新启动绒毯';console.error(e.message);};
function updateGeometry(){
  if(!latest)return;bounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};
  for(let k=0;k<latest.length;k+=3){bounds.minX=Math.min(bounds.minX,latest[k]);bounds.maxX=Math.max(bounds.maxX,latest[k]);bounds.minY=Math.min(bounds.minY,latest[k+1]);bounds.maxY=Math.max(bounds.maxY,latest[k+1]);}smoothSurface(latest,positions);
  geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();if(strands.mesh.visible)strands.update(positions,geometry.attributes.normal.array);if(!dragging||settings.dragBaseline)rebuildMask();
}
function rebuildMask(){
  mask.fill(0);const maxY=Math.ceil(innerHeight/12)-1;
  for(let t=0;t<hitIndices.length;t+=3){let a=hitIndices[t]*3,b=hitIndices[t+1]*3,c=hitIndices[t+2]*3,ax=latest[a],ay=latest[a+1],bx=latest[b],by=latest[b+1],cx=latest[c],cy=latest[c+1];let den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(den)<.0001)continue;
    let x0=Math.max(0,Math.floor(Math.min(ax,bx,cx)/12)),x1=Math.min(maskW-1,Math.ceil(Math.max(ax,bx,cx)/12)),y0=Math.max(0,Math.floor(Math.min(ay,by,cy)/12)),y1=Math.min(maxY,Math.ceil(Math.max(ay,by,cy)/12));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){let px=x*12+6,py=y*12+6,u=((by-cy)*(px-cx)+(cx-bx)*(py-cy))/den,v=((cy-ay)*(px-cx)+(ax-cx)*(py-cy))/den;if(u>=-.2&&v>=-.2&&u+v<=1.2)mask[y*maskW+x]=1;}
  }
}
function hit(x,y){if(x<bounds.minX-10||x>bounds.maxX+10||y<bounds.minY-10||y>bounds.maxY+10)return false;return !!mask[Math.floor(y/12)*maskW+Math.floor(x/12)];}
function status(text){hint.textContent=text;}
function broomPosition(x,y){broom.style.transform=`translate3d(${x-47}px,${y-93}px,0) rotate(-18deg)`;}
broomPosition(innerWidth-66,innerHeight-103);
function scheduleSave(){clearTimeout(saveTimer);if(settings.preview||settings.benchmark||settings.layerTest||!latest)return;saveTimer=setTimeout(()=>{saveWanted=false;api.call('save',{...state,shape:Array.from(latest)}).catch(e=>status(e.message));},350);}
function flat(){workerSend({type:'flat'});saveWanted=true;scheduleSave();}
function scale(factor){if(broomMode)return;factor=Math.max(300,Math.min(1100,state.width*factor))/state.width;workerSend({type:'scale',factor});saveWanted=true;scheduleSave();}
let broomBusy=false,layoutBusy=false,labelTimer;
const pushApi=settings.broomBenchmark?{call:async(method,args={})=>{const result=await api.call(method,['commitPush','endPush','organize'].includes(method)?{...args,test:true,live:method==='commitPush'&&!settings.broomBaseline}:args);return method==='beginPush'?result.map(i=>({...i,sweepable:i.name.startsWith(settings.broomPrefix)})):result;}}:settings.preview?demoIconApi(document.querySelector('#flights')):api,pushScene=new PushIcons(pushApi,status);
const stylesPanel=document.querySelector('#styles-panel');
let wallpaperBusy=false;
const wallpapers=settings.wallpapers;
const wallpaperImage=style=>style?.file?`url("../assets/${encodeURIComponent(style.file)}")`:'none';
function closeStyles(){stylesPanel.hidden=true;document.querySelector('#styles').setAttribute('aria-expanded','false');}
async function toggleStyles(){if(layoutBusy||broomBusy)return;if(broomMode)await toggleBroom();stylesPanel.hidden=!stylesPanel.hidden;document.querySelector('#styles').setAttribute('aria-expanded',String(!stylesPanel.hidden));api.hit(true);if(!stylesPanel.hidden&&!settings.preview&&!wallpaperBusy){try{settings.wallpaper=(await api.call('wallpaperInfo')).wallpaper;syncWallpaper();}catch(e){status(e.message);}}}
function syncWallpaper(){for(const button of document.querySelectorAll('[data-wallpaper]')){button.setAttribute('aria-pressed',String(button.dataset.wallpaper===(settings.wallpaper||'wood').trim()));button.disabled=wallpaperBusy;}}
async function selectWallpaper(id){
  if(layoutBusy||broomBusy||wallpaperBusy)return;
  const style=wallpapers.find(s=>s.id===id);if(!style)return;
  wallpaperBusy=true;syncWallpaper();status(`正在切换${style.name}…`);
  try{
    if(settings.preview){document.body.style.backgroundImage=wallpaperImage(style);settings.wallpaper=id;}
    else settings.wallpaper=(await api.call('setWallpaper',{style:id})).wallpaper;
    status(id==='original'?'已恢复原壁纸':`已切换${style.name}`);
  }catch(e){status(e.message);}finally{wallpaperBusy=false;syncWallpaper();}
}
for(const style of wallpapers){
  const button=document.createElement('button'),swatch=document.createElement('i'),label=document.createElement('span');
  button.dataset.wallpaper=style.id;swatch.className='swatch'+(style.id==='original'?' original':'');
  if(style.file)swatch.style.backgroundImage=wallpaperImage(style);
  label.textContent=style.name;button.append(swatch,label);button.onclick=()=>selectWallpaper(style.id);document.querySelector('#wallpaper-options').append(button);
}
if(settings.preview)document.body.style.backgroundImage=wallpaperImage(wallpapers.find(s=>s.id===settings.wallpaper));
syncWallpaper();
document.querySelector('#choose-wallpaper').onclick=async()=>{
  if(settings.preview){status('请在实际桌面模式中选择原壁纸图片');return;}
  if(wallpaperBusy)return;wallpaperBusy=true;syncWallpaper();
  try{const result=await api.call('chooseOriginalWallpaper');settings.wallpaper=result.wallpaper;if(!result.cancelled)status('原壁纸已保留独立副本，切换地板后也可以恢复');}catch(e){status(e.message);}finally{wallpaperBusy=false;syncWallpaper();}
};
document.querySelector('#styles').onclick=toggleStyles;document.querySelector('#close-styles').onclick=closeStyles;
function syncRug(){for(const button of document.querySelectorAll('[data-rug]')){button.setAttribute('aria-pressed',String(button.dataset.rug===currentRug.id));button.disabled=rugBusy;}}
async function selectRug(id){
  if(rugBusy||layoutBusy||broomBusy||dragging)return;
  const style=rugStyles.find(s=>s.id===id);if(!style)return;
  rugBusy=true;syncRug();status(`正在准备${style.name}…`);
  try{
    const texture=await surfaces.load(style);
    if(!settings.preview)await api.call('setRugStyle',{style:id});
    surfaces.apply(style,texture);currentRug=style;settings.rugStyle=id;
    workerSend({type:'material',material:style.material});
    await renderer.compileAsync(scene,camera);dirty=true;requestFrame();
    status(`已切换${style.name} · 可拖动、折叠和缩放`);
  }catch(e){status('材质载入失败：'+e.message);}finally{rugBusy=false;syncRug();}
}
for(const style of rugStyles){
  const button=document.createElement('button'),swatch=document.createElement('i'),label=document.createElement('span');
  button.dataset.rug=style.id;swatch.className='swatch'+(style.file?'':' plush');
  if(style.file)swatch.style.backgroundImage=wallpaperImage(style);
  label.textContent=style.name;button.append(swatch,label);button.onclick=()=>selectRug(style.id);document.querySelector('#rug-options').append(button);
}
syncRug();
function clearLabels(){clearTimeout(labelTimer);document.querySelector('#group-labels').replaceChildren();}
function showGroups(groups){clearLabels();for(const g of groups){const label=document.createElement('span');label.className='group-label';label.textContent=`${g.title} · ${g.count}`;label.style.left=`${Math.min(innerWidth-150,Math.max(12,g.x-24))}px`;label.style.top=`${Math.max(8,g.y)}px`;document.querySelector('#group-labels').append(label);}labelTimer=setTimeout(clearLabels,12000);}
async function organize(){
  if(layoutBusy||broomBusy)return;if(broomMode)await toggleBroom();layoutBusy=true;closeStyles();clearLabels();document.querySelector('#organize').disabled=true;
  if(dragging){dragging=false;workerSend({type:'release'});}
  try{status('正在按类型整理…');const items=await pushApi.call('organizeInfo');const plan=organizePlan(items,innerWidth,innerHeight,bounds);
    if(!plan.positions.length){status('桌面暂时没有可整理的图标');return;}
    icons=await pushApi.call('organize',{positions:plan.positions});workerSend({type:'icons',icons});showGroups(plan.groups);
    status('已整理：'+plan.groups.map(g=>`${g.title} ${g.count}`).join(' · ')+(plan.underRug?` · 空间不足，${plan.underRug} 个在毯子覆盖处`:' · 可撤销布局'));
  }catch(e){status(e.message);}finally{layoutBusy=false;document.querySelector('#organize').disabled=false;}
}
function setBroomAppearance(){document.body.classList.toggle('sweeping',broomMode);document.querySelector('#sweep').classList.toggle('active',broomMode);api.hit(broomMode);}
async function toggleBroom(){
  if(broomBusy||layoutBusy)return;broomBusy=true;closeStyles();clearLabels();
  if(dragging){dragging=false;workerSend({type:'release'});}broomMode=!broomMode;readySweep=false;setBroomAppearance();
  try{
    if(broomMode){sweepCount=0;status('正在拿起扫帚…');
      icons=await pushScene.begin();readySweep=true;status('按住左键推着图标走 · 可以扫成一堆 · 右键放下');
    }else{status('正在放下扫帚…');icons=await pushScene.end();workerSend({type:'icons',icons});broomPosition(innerWidth-66,innerHeight-103);status('图标留在刚才的位置 · 抓住毯子拖动 · 滚轮缩放');}
  }catch(e){broomMode=false;readySweep=false;setBroomAppearance();await pushApi.call('revealIcons').catch(()=>{});status(e.message);}finally{broomBusy=false;}
}
function sweep(from,to){if(!readySweep)return;pushScene.push(from,to);const count=pushScene.movedCount;if(count!==sweepCount){sweepCount=count;status(`已推动 ${count} 个 · 继续推可以堆在一起 · 右键放下`);}}
async function undo(){if(broomBusy||layoutBusy)return;if(broomMode)await toggleBroom();layoutBusy=true;closeStyles();clearLabels();try{icons=await pushApi.call('undo');workerSend({type:'icons',icons});status('已恢复上次整理 / 清扫前的图标位置');}catch(e){status(e.message);}finally{layoutBusy=false;}}
document.querySelector('#minus').onclick=()=>scale(.92);document.querySelector('#plus').onclick=()=>scale(1.08);document.querySelector('#flat').onclick=flat;document.querySelector('#sweep').onclick=toggleBroom;document.querySelector('#undo').onclick=undo;
document.querySelector('#organize').onclick=organize;
document.addEventListener('mousemove',e=>{if(dragging)return;api.hit(broomMode||!!e.target.closest('nav, #styles-panel')||hit(e.clientX,e.clientY)||(e.clientX>innerWidth-140&&e.clientY>innerHeight-215));});
canvas.addEventListener('pointerdown',e=>{if(settings.benchmark||settings.broomBenchmark||layoutBusy||e.button!==0)return;let p={x:e.clientX,y:e.clientY};if(!broomMode&&p.x>innerWidth-140&&p.y>innerHeight-215&&!hit(p.x,p.y)){toggleBroom();return;}if(!broomMode&&!hit(p.x,p.y))return;dragging=true;whole=e.shiftKey;last=p;canvas.setPointerCapture(e.pointerId);api.hit(true);if(broomMode)sweep(p,p);else if(!whole)workerSend({type:'grab',...p});});
canvas.addEventListener('pointermove',e=>{let t=performance.now(),p={x:e.clientX,y:e.clientY};if(dragging){if(broomMode)sweep(last,p);else if(whole)workerSend({type:'translate',x:p.x-last.x,y:p.y-last.y});else workerSend({type:'move',...p});last=p;}inputTimes.push(performance.now()-t);if(inputTimes.length>2000)inputTimes.shift();});
function release(e){if(!dragging)return;dragging=false;rebuildMask();if(!broomMode){workerSend({type:'release'});saveWanted=true;scheduleSave();}if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
canvas.addEventListener('dblclick',()=>{if(!broomMode)flat();});document.addEventListener('contextmenu',e=>{e.preventDefault();if(broomMode)toggleBroom();});
canvas.addEventListener('wheel',e=>{e.preventDefault();if(e.shiftKey){workerSend({type:'scale',factor:1,degrees:e.deltaY>0?-4:4});saveWanted=true;scheduleSave();}else scale(e.deltaY>0?.94:1.06);},{passive:false});
api.onFailure(status);api.onCommand(command=>{if(command.startsWith('wallpaper:'))selectWallpaper(command.slice(10));if(command==='organize')organize();if(command==='styles')toggleStyles();if(command==='flat')flat();if(command==='broom')toggleBroom();if(command==='undo')undo();if(command==='pause'){if(broomMode&&!broomBusy)toggleBroom();workerSend({type:'pause',value:true});}if(command==='resume')workerSend({type:'pause',value:false});if(command==='attached'&&settings.benchmark)benchStart=performance.now()+800;});
function summary(values){let v=[...values].sort((a,b)=>a-b);return {n:v.length,median:v[Math.floor(v.length*.5)]||0,p95:v[Math.floor(v.length*.95)]||0,max:v[v.length-1]||0};}
function report(){const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),canvas:[canvas.width,canvas.height],callbacks:summary(frameTimes),drawIntervals:summary(drawIntervals),poseIntervals:summary(poseIntervals),simulation:summary(simulationTimes),clothInput:clothInput.stats(),renderCpu:summary(renderCpu),mouse:summary(inputTimes),poseCount,active,bounds,maxHeight:latest?Math.max(...Array.from(latest).filter((_,i)=>i%3===2)):0,furLayers:fur.filter(m=>m.visible).length,rugStyle:currentRug.id,strandsVisible:strands.mesh.visible,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,broom:pushScene.stats()};}
function animate(time){
  requestedFrame=0;
  const dt=time-lastFrame;lastFrame=time;
  if(settings.benchmark&&benchStart&&time>benchStart&&!benchDone){if(!benchGrab&&latest){benchGrab=true;frameTimes.length=drawIntervals.length=poseIntervals.length=simulationTimes.length=renderCpu.length=0;poseCount=0;lastDraw=lastPose=0;workerSend({type:'flat'});workerSend({type:'grab',x:state.x+state.width*.47,y:state.y+state.width*.3});}
    let elapsed=(time-benchStart)/1000,pull=elapsed<1.4?elapsed/1.4*190:190+25*Math.sin(elapsed*2);if(elapsed<6)workerSend({type:'move',x:settings.x+settings.width*.47-pull,y:settings.y+settings.width*.3-pull*.66});else if(!benchReleased){benchReleased=true;workerSend({type:'release'});}frameTimes.push(dt);if(elapsed>10){benchDone=true;api.metrics(report());}}
  else if(dragging||active){frameTimes.push(dt);if(frameTimes.length>1200)frameTimes.shift();}
  if(settings.benchmark&&benchStart&&time-benchStart>8800&&!shots.has('rest'))dirty=true;
  if(dirty&&canDraw){if(lastDraw&&time-lastDraw<200)drawIntervals.push(time-lastDraw);if(drawIntervals.length>1200)drawIntervals.shift();lastDraw=time;let start=performance.now();updateGeometry();renderer.render(scene,camera);renderCpu.push(performance.now()-start);if(renderCpu.length>1200)renderCpu.shift();dirty=false;
    if(settings.benchmark&&benchStart){let elapsed=(time-benchStart)/1000,name=elapsed>8?'rest':elapsed>1.6&&elapsed<2.5?'grab':elapsed<0?'flat':null;if(name&&!shots.has(name)){shots.add(name);api.snapshot({name,image:canvas.toDataURL('image/png')});}}
  }
  if(settings.benchmark&&!benchDone)requestFrame();
}
requestFrame();
if(!settings.preview)api.call('icons').then(items=>{icons=items;workerSend({type:'icons',icons});}).catch(e=>status(e.message));
setInterval(()=>{if(!settings.benchmark&&!settings.layerTest&&!settings.broomBenchmark&&!settings.styleTest&&!settings.dragBenchmark)api.metrics(report()).catch(()=>{});},5000);
if(settings.benchmark){status('正在测量桌面性能，约 10 秒后结束');nav.style.pointerEvents='none';}
try{surfaces.apply(currentRug,await surfaces.load(currentRug));}catch(e){status('材质载入失败，暂用暖白绒毯');console.error(e.message);currentRug=rugStyles[0];surfaces.apply(currentRug,null);workerSend({type:'material',material:currentRug.material});syncRug();}
await Promise.all([renderer.compileAsync(scene,camera),firstPose]);
updateGeometry();renderer.render(scene,camera);dirty=false;
await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
canDraw=true;requestFrame();
api.ready();
if(settings.broomBenchmark){nav.style.pointerEvents='none';status('正在测试原生扫帚性能，结束后恢复测试图标');benchmarkBroom({api,settings,iconsApi:pushApi,pushScene,workerSend,report,ready:()=>!active}).catch(e=>{status(e.message);console.error(e.stack);});}
if(settings.layerTest){
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));await pause(350);for(let n=0;n<40&&active;n++)await pause(100);
  const layout=items=>JSON.stringify(items.map(i=>[i.id,i.x,i.y]).sort((a,b)=>a[0].localeCompare(b[0])));
  const before=layout(await api.call('icons')),checks=[];
  for(let round=0;round<5;round++){const savedShape=JSON.stringify(Array.from(latest));await toggleBroom();await pause(120);const layer=await api.call('layerInfo');const check={...layer,readySweep,replacementIcons:document.querySelectorAll('.push-icon').length,totalIcons:icons.length,allMovable:icons.every(i=>i.sweepable),clothPreserved:savedShape===JSON.stringify(Array.from(latest)),unchangedIcons:before===layout(await api.call('icons'))};await toggleBroom();await pause(120);check.nativeRestored=(await api.call('layerInfo')).nativeIconsVisible;checks.push(check);}
  if(settings.pushExitTest)await toggleBroom();
  renderer.render(scene,camera);const pixel=new Uint8Array(4);renderer.getContext().readPixels(0,canvas.height-1,1,1,renderer.getContext().RGBA,renderer.getContext().UNSIGNED_BYTE,pixel);
  await api.metrics({...report(),layerTest:{checks,transparentCornerAlpha:pixel[3],passed:pixel[3]===0&&checks.every(c=>!c.isChild&&c.hasDesktopOwner&&c.visible&&c.aboveDesktop&&c.desktopViewVisible&&c.readySweep&&c.unchangedIcons&&c.clothPreserved&&c.nativeRestored&&c.replacementIcons===0&&c.nativeIconsVisible&&!c.iconViewCovered&&c.allMovable)}});
}

if(settings.styleTest){
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),checks=[];
  async function settle(){for(let n=0;n<70&&active;n++)await pause(50);await pause(100);}
  async function capture(name){dirty=true;requestFrame();await pause(150);await api.snapshot({name});}
  await settle();
  for(const style of wallpapers.filter(s=>s.file)){await selectWallpaper(style.id);await capture(style.id);}
  await selectWallpaper('wood');
  for(const style of rugStyles){
    await selectRug(style.id);await settle();await capture(style.id);
    checks.push({id:style.id,selected:currentRug.id,furLayers:fur.filter(m=>m.visible).length,strandsVisible:strands.mesh.visible,textureLoaded:!style.file||!!body.material.map,shaderErrors:renderer.info.programs.filter(p=>p.diagnostics?.runnable===false).length,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles});
  }
  for(const [id,name] of [['autumn-cats','short-fold'],['tissue','paper-fold']]){
    await selectRug(id);flat();await settle();workerSend({type:'grab',x:state.x+state.width*.47,y:state.y+state.width*.3});await pause(120);
    for(let n=0;n<24;n++){workerSend({type:'move',x:state.x+state.width*.47-n*6,y:state.y+state.width*.3-n*4});await pause(20);}
    workerSend({type:'release'});await settle();await capture(name);
  }
  stylesPanel.hidden=false;await capture('panel');
  const passed=checks.every(c=>c.id===c.selected&&c.textureLoaded&&!c.shaderErrors&&(c.id==='plush'?c.strandsVisible&&!(!c.furLayers):!c.strandsVisible)&&(c.id!=='tissue'||c.furLayers===0));
  await api.metrics({...report(),styleTest:{passed,checks,wallpaperOptions:document.querySelectorAll('[data-wallpaper]').length,rugOptions:document.querySelectorAll('[data-rug]').length}});
}

if(settings.dragBenchmark){document.body.style.pointerEvents='none';status('正在回放连续拖动压力测试，完成后自动关闭');await selectRug('plush');await api.metrics(await benchmarkDrag({send:workerSend,pose:()=>latest,held:value=>{dragging=value;},resetMetrics:()=>{frameTimes.length=drawIntervals.length=poseIntervals.length=simulationTimes.length=renderCpu.length=0;poseCount=0;lastDraw=lastPose=0;lastFrame=performance.now();},report}));}
