export async function benchmarkBroom({api,settings,iconsApi,pushScene,workerSend,report,ready}){
  const pause=ms=>new Promise(r=>setTimeout(r,ms)),frame=()=>new Promise(requestAnimationFrame);await pause(400);for(let i=0;i<60&&!ready();i++)await pause(100);
  const items=await iconsApi.call('icons'),owned=items.filter(i=>i.name.startsWith(settings.broomPrefix));if(owned.length!==20)throw Error('Broom benchmark requires exactly its 20 owned icons');
  const original=owned.map(i=>({id:i.id,x:i.x,y:i.y}));
  let result;try{
    await iconsApi.call('organize',{positions:owned.map((i,n)=>({id:i.id,x:220+n%5*38,y:230+Math.floor(n/5)*42})),test:true});
    await pushScene.begin();let previous={x:150,y:265};const intervals=[];let lastFrame;
    for(let n=0;n<180;n++){const time=await frame();if(lastFrame)intervals.push(time-lastFrame);lastFrame=time;const point={x:150+n*3.1,y:275+Math.sin(n*.07)*65};pushScene.push(previous,point);previous=point;}
    await pause(120);await pushScene.end();const stats=pushScene.stats(),native=await api.call('pushStats');intervals.sort((a,b)=>a-b);
    result={...report(),broomBenchmark:{baseline:settings.broomBaseline,frames:180,intervalMedian:intervals[Math.floor(intervals.length*.5)],intervalP95:intervals[Math.floor(intervals.length*.95)],...stats,native,replacementIcons:document.querySelectorAll('.push-icon').length},broomDone:true};
  }finally{await iconsApi.call('organize',{positions:original,test:true});workerSend({type:'icons',icons:await iconsApi.call('icons')});}
  await api.metrics(result);
}
