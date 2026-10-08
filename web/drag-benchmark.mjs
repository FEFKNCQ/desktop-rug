export async function benchmarkDrag({send,pose,held,resetMetrics,report}){
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  send({type:'flat'});await pause(700);resetMetrics();
  let samples=0;
  for(let round=0;round<3;round++){
    const p=pose(),node=round%2?(p.length/3-1):0,x=p[node*3],y=p[node*3+1];
    held(true);send({type:'grab',x,y});
    const start=performance.now();
    await new Promise(resolve=>{const timer=setInterval(()=>{
      const t=(performance.now()-start)/1000;
      if(t>=2.8){clearInterval(timer);resolve();return;}
      send({type:'move',x:x+(round%2?-1:1)*(160-160*Math.cos(t*7)),y:y+140*Math.sin(t*9)});samples++;
    },4);});
    held(false);send({type:'release'});await pause(500);
  }
  const result=report();return {...result,dragBenchmark:{done:true,rounds:3,requestedPointerSamples:samples,inputRateTargetHz:250}};
}
