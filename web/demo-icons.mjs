// Preview-only files. No native calls and no desktop mutations.
export function demoIconApi(container){
  const picture=color=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><path fill="#fff" stroke="#aaa" d="M10 3h20l10 10v32H10z"/><path fill="${color}" d="M15 22h20v14H15z"/><path fill="#ddd" d="M30 3v10h10"/></svg>`);
  let icons=Array.from({length:12},(_,i)=>({id:'demo-'+i,name:[`软件 ${i+1}`,`文档 ${i+1}.pdf`,`图片 ${i+1}.jpg`][i%3],category:['apps','files','pictures'][i%3],x:80+i%3*64,y:150+Math.floor(i/3)*70,sweepable:true,image:picture(['#72a9dc','#9abb72','#dba46a'][i%3])})),backup=icons.map(i=>({...i}));
  const nodes=new Map();for(const i of icons){const node=document.createElement('div');node.className='push-icon';const img=document.createElement('img');img.src=i.image;const label=document.createElement('span');label.textContent=i.name;node.append(img,label);container.append(node);nodes.set(i.id,node);}
  function draw(){for(const i of icons)nodes.get(i.id).style.transform=`translate3d(${i.x-20}px,${i.y-20}px,0)`;}draw();
  return {call:async(method,args={})=>{if(method==='beginPush'||method==='organize')backup=icons.map(i=>({...i}));if(method==='commitPush'||method==='endPush'||method==='organize'){for(const p of args.positions||[]){const i=icons.find(i=>i.id===p.id);if(i){i.x=p.x;i.y=p.y;}}}if(method==='undo')icons=backup.map(i=>({...i}));draw();return icons.map(i=>({...i}));}};
}
