const fs=require('node:fs'),path=require('node:path'),{spawn,execFileSync}=require('node:child_process'),readline=require('node:readline'),{randomUUID}=require('node:crypto');
const root=path.resolve(__dirname,'..'),name='DesktopRug-gpu-check-'+randomUUID(),desktop=execFileSync('powershell.exe',['-NoProfile','-Command',"[Console]::OutputEncoding=[Text.UTF8Encoding]::new();[Environment]::GetFolderPath('Desktop')"],{windowsHide:true,encoding:'utf8'}).trim(),file=path.join(desktop,name+'.txt');
let sequence=0;const pending=new Map();const child=spawn(path.join(root,'DesktopRug.exe'),['--bridge'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
readline.createInterface({input:child.stdout}).on('line',line=>{const d=JSON.parse(line),p=pending.get(d.id);if(p){pending.delete(d.id);d.error?p.reject(Error(d.error)):p.resolve(d.result);}});
function call(method,args={}){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});child.stdin.write(JSON.stringify({id,method,args})+'\n');});}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{let moved=false;
  try{fs.writeFileSync(file,'Temporary desktop rug integration test.');await call('init',{scale:1.25});let list,icon;for(let i=0;i<30&&!icon;i++){await wait(150);list=await call('beginSweep');icon=list.find(i=>i.name===name);}if(!icon)throw Error('Temporary icon not enumerated');
    const image=await call('iconImages',{ids:[icon.id]});if(!image[0]?.image?.startsWith('data:image/png;base64,'))throw Error('Icon was not prefetched');
    const start=performance.now();const result=await call('sweep',{ids:[icon.id],x:920,y:460,test:true});moved=true;const elapsed=performance.now()-start;const after=(await call('icons')).find(i=>i.id===icon.id);if(!after||Math.hypot(after.x-920,after.y-460)>20)throw Error('Icon did not reach the rug');
    const restored=(await call('undo')).find(i=>i.id===icon.id);moved=false;if(restored.x!==icon.x||restored.y!==icon.y)throw Error('Undo position mismatch');
    const report={passed:true,iconPrefetched:true,sweepMilliseconds:elapsed,returnedAnimationIcons:result.length,restoredExactly:true,onlyTemporaryFileTouched:true};fs.writeFileSync(path.join(root,'qa','bridge-v41.json'),JSON.stringify(report,null,2));console.log(report);
  }finally{if(moved)await call('undo');child.stdin.end();if(fs.existsSync(file))fs.unlinkSync(file);const backup=path.join(root,'qa','gpu-test-layout.bin');if(fs.existsSync(backup))fs.unlinkSync(backup);}
})().catch(e=>{console.error(e);process.exitCode=1;child.stdin.end();});
