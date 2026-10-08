const fs=require('node:fs'),path=require('node:path'),{spawn,execFileSync}=require('node:child_process'),readline=require('node:readline'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const root=path.resolve(__dirname,'..'),prefix='DesktopRug-gpu-check-'+randomUUID(),desktop=execFileSync('powershell.exe',['-NoProfile','-Command',"[Console]::OutputEncoding=[Text.UTF8Encoding]::new();[Environment]::GetFolderPath('Desktop')"],{windowsHide:true,encoding:'utf8'}).trim();
const files=[],pending=new Map();let sequence=0,moved=false;const child=spawn(path.join(root,'DesktopRug.exe'),['--bridge'],{windowsHide:true});
readline.createInterface({input:child.stdout}).on('line',line=>{const r=JSON.parse(line),p=pending.get(r.id);if(p){pending.delete(r.id);clearTimeout(p.timer);r.error?p.reject(Error(r.error)):p.resolve(r.result);}});
function call(method,args={}){return new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>reject(Error('Timeout '+method)),15000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,method,args})+'\n');});}
function stats(a){a=[...a].sort((a,b)=>a-b);return {n:a.length,median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],max:a.at(-1)};}
(async()=>{try{
  for(let n=0;n<20;n++){const f=path.join(desktop,prefix+'-'+n+'.txt');fs.writeFileSync(f,'Owned broom latency test fixture');files.push(f);}
  await call('init',{scale:1.25});let all,owned;for(let n=0;n<50;n++){all=await call('icons');owned=all.filter(i=>i.name.startsWith(prefix));if(owned.length===20)break;await new Promise(r=>setTimeout(r,100));}assert.equal(owned.length,20);
  const original=new Map(all.map(i=>[i.id,[i.x,i.y]])),results=[];
  for(const count of [1,8,20])for(const live of [false,true]){
    await call('beginPush');const times=[];let positions;
    for(let step=0;step<45;step++){positions=owned.slice(0,count).map((i,n)=>({id:i.id,x:600+(n%10)*42+step*2,y:670+Math.floor(n/10)*45}));const t=performance.now();await call('commitPush',{positions,test:true,live});moved=true;if(step>3)times.push(performance.now()-t);}
    const displayed=await call('icons');for(const p of positions){const actual=displayed.find(i=>i.id===p.id);assert(Math.hypot(actual.x-p.x,actual.y-p.y)<1,'The displayed native icon must match the requested position');}
    for(const i of displayed.filter(i=>!i.name.startsWith(prefix)))assert.deepEqual([i.x,i.y],original.get(i.id),'Must never move another icon');
    const after=await call('endPush',{positions,test:true});for(const p of positions){const actual=after.find(i=>i.id===p.id);assert(Math.hypot(actual.x-p.x,actual.y-p.y)<1,'Final persistence must preserve the live position');}
    const layer=await call('layerInfo');assert(layer.nativeIconsVisible&&!layer.iconViewCovered);
    const restored=await call('undo');moved=false;for(const i of restored)assert.deepEqual([i.x,i.y],original.get(i.id),'Exact Undo after live updates');
    const result={count,live,roundTripMs:stats(times)};results.push(result);console.log(result);
  }
  const native=await call('pushStats');assert(native.liveBatches>0,'Fast path must actually run');
  // Changing desktop item count must disable an obsolete fast index mapping.
  await call('beginPush');const extra=path.join(desktop,prefix+'-extra.txt');fs.writeFileSync(extra,'Count-change guard');files.push(extra);let changed;for(let n=0;n<40;n++){changed=await call('pushStats');if(changed.viewCount!==changed.cachedCount)break;await new Promise(r=>setTimeout(r,100));}assert.notEqual(changed.viewCount,changed.cachedCount,'Wait for desktop file notification');
  await call('commitPush',{positions:[{id:owned[0].id,x:650,y:690}],test:true,live:true});moved=true;assert((await call('pushStats')).shellBatches>native.shellBatches);await call('undo');moved=false;
  const report={passed:true,cases:results,fastBatches:native.liveBatches,fallbackBatches:native.shellBatches,nativeWorkMs:stats(native.samples),nativeIconsAlwaysVisible:true,unrelatedIconsUnchanged:true,finalCoordinatesPersisted:true,undoExact:true,itemCountChangeFallsBack:true};fs.writeFileSync(path.join(root,'qa','live-native-v44.json'),JSON.stringify(report,null,2));console.log('Passed native live movement / persistence / Undo');
}finally{if(moved)await call('undo');child.stdin.end();for(const f of files)if(fs.existsSync(f))fs.unlinkSync(f);const b=path.join(root,'qa','gpu-test-layout.bin');if(fs.existsSync(b))fs.unlinkSync(b);}})().catch(e=>{console.error(e);process.exitCode=1;child.stdin.end();});
