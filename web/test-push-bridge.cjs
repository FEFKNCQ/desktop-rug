const fs=require('node:fs'),path=require('node:path'),{spawn,execFileSync}=require('node:child_process'),readline=require('node:readline'),{randomUUID}=require('node:crypto');
const root=path.resolve(__dirname,'..'),name='DesktopRug-gpu-check-'+randomUUID(),desktop=execFileSync('powershell.exe',['-NoProfile','-Command',"[Console]::OutputEncoding=[Text.UTF8Encoding]::new();[Environment]::GetFolderPath('Desktop')"],{windowsHide:true,encoding:'utf8'}).trim(),file=path.join(desktop,name+'.txt');
let sequence=0;const pending=new Map(),child=spawn(path.join(root,'DesktopRug.exe'),['--bridge'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
readline.createInterface({input:child.stdout}).on('line',line=>{const d=JSON.parse(line),p=pending.get(d.id);if(p){pending.delete(d.id);d.error?p.reject(Error(d.error)):p.resolve(d.result);}});
function call(method,args={}){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});child.stdin.write(JSON.stringify({id,method,args})+'\n');});}
(async()=>{let moved=false;try{
  fs.writeFileSync(file,'Temporary physical broom position test.');await call('init',{scale:1.25});let icon;
  for(let n=0;n<30&&!icon;n++){await new Promise(r=>setTimeout(r,100));icon=(await call('icons')).find(i=>i.name===name+'.txt'||i.name===name);}
  if(!icon)throw Error('Temporary test icon not found');const original={...icon};await call('beginPush');
  const start=performance.now();await call('commitPush',{positions:[{id:icon.id,x:920,y:710}],test:true});moved=true;const milliseconds=performance.now()-start;
  icon=(await call('endPush',{positions:[],test:true})).find(i=>i.id===original.id);if(!icon||Math.hypot(icon.x-920,icon.y-710)>1)throw Error('Icon did not stay at arbitrary pushed position');
  const visible=(await call('layerInfo')).nativeIconsVisible;if(!visible)throw Error('Native desktop icon view was not restored');
  icon=(await call('undo')).find(i=>i.id===original.id);moved=false;if(icon.x!==original.x||icon.y!==original.y)throw Error('Undo did not restore exact original position');
  const report={passed:true,arbitraryPositionPreserved:true,noRugAttraction:true,nativeIconsVisible:true,undoExact:true,nativeCommitMs:milliseconds};fs.writeFileSync(path.join(root,'qa','push-bridge-v42.json'),JSON.stringify(report,null,2));console.log(report);
}finally{if(moved)await call('undo');await call('revealIcons');child.stdin.end();if(fs.existsSync(file))fs.unlinkSync(file);const backup=path.join(root,'qa','gpu-test-layout.bin');if(fs.existsSync(backup))fs.unlinkSync(backup);}})().catch(e=>{console.error(e);process.exitCode=1;child.stdin.end();});
