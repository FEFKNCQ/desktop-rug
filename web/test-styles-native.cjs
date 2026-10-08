const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),readline=require('node:readline'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
function bridge(){
  const child=spawn(path.join(root,'DesktopRug.exe'),['--bridge'],{windowsHide:true}),pending=new Map();let sequence=0;
  readline.createInterface({input:child.stdout}).on('line',line=>{const data=JSON.parse(line),task=pending.get(data.id);if(task){pending.delete(data.id);clearTimeout(task.timer);data.error?task.reject(Error(data.error)):task.resolve(data.result);}});
  return {call(method,args={}){return new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>reject(Error('Bridge timeout: '+method)),15000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,method,args})+'\n');});},close(){child.stdin.end();return new Promise(resolve=>child.once('exit',resolve));}};
}
const digest=file=>fs.existsSync(path.join(root,file))?createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'):null;
(async()=>{
  let b=bridge(),initial;const protectedFiles=['original-wallpaper.txt','wallpaper-backup/image.png','wallpaper-backup/settings.txt','original-icon-flags.txt','original-icon-layout.bin','before-last-sweep.bin','state.ini','plush-shape.json'],hashes=protectedFiles.map(digest),rugFile=path.join(root,'rug-style.txt'),hadRug=fs.existsSync(rugFile);
  const results=[];
  try{
    initial=await b.call('init');const iconsBefore=await b.call('icons');
    for(const style of initial.wallpapers){
      if(style.file)assert(fs.existsSync(path.join(root,'assets',style.file)));
      const info=await b.call('setWallpaper',{style:style.id});assert.equal(info.wallpaper,style.id);
      if(style.file)assert.equal(path.resolve(info.path).toLowerCase(),path.resolve(root,'assets',style.file).toLowerCase());
      else{assert(info.originalAvailable);assert.equal(path.resolve(info.path).toLowerCase(),path.resolve(root,'wallpaper-backup','image.png').toLowerCase());}
      results.push(style.id);
    }
    await b.call('setWallpaper',{style:initial.wallpaper});
    await assert.rejects(b.call('setWallpaper',{style:'../bad'}));assert.equal((await b.call('wallpaperInfo')).wallpaper,initial.wallpaper);
    for(const style of initial.rugStyles){assert.equal(await b.call('setRugStyle',{style:style.id}),style.id);assert.equal((await b.call('init')).rugStyle,style.id);}
    await b.close();b=bridge();assert.equal((await b.call('init')).rugStyle,'tissue');
    await assert.rejects(b.call('setRugStyle',{style:'missing'}));
    await b.call('setRugStyle',{style:initial.rugStyle});
    assert.deepEqual(await b.call('icons'),iconsBefore);
    assert.deepEqual(protectedFiles.map(digest),hashes);
    const report={passed:true,wallpapersSwitched:results,nativeWallpaperPathVerified:true,originalRestoredFromIndependentImage:true,snapshotBytesPreserved:true,rugStylesSaved:initial.rugStyles.map(s=>s.id),selectionSurvivedBridgeRestart:true,unknownStylesRejected:true,originalBackupsUnchanged:true,iconPositionsUnchanged:true,clothStateUnchanged:true,restoredWallpaper:initial.wallpaper,restoredRug:initial.rugStyle};
    fs.writeFileSync(path.join(root,'qa','wallpapers-v45.json'),JSON.stringify(report,null,2));console.log(report);
  }finally{
    if(initial){await b.call('setWallpaper',{style:initial.wallpaper});await b.call('setRugStyle',{style:initial.rugStyle});}
    await b.close();if(!hadRug&&fs.existsSync(rugFile))fs.unlinkSync(rugFile);
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
