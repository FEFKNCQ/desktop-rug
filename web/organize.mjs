export const categories=[{id:'apps',title:'软件入口'},{id:'files',title:'文件 / PDF'},{id:'pictures',title:'图片'}];
const distance=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
export function organizePlan(icons,width,height,rug){
  const groups=categories.map(g=>({...g,items:icons.filter(i=>(i.category||'files')===g.id).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN',{numeric:true})||a.id.localeCompare(b.id))}));
  const count=groups.reduce((n,g)=>n+g.items.length,0);if(count!==icons.length)throw Error('有未识别的分类，未更改桌面');
  if(!count)return {positions:[],groups:[],underRug:0};
  const covered=(x,y)=>rug&&x>rug.minX-30&&x<rug.maxX+30&&y>rug.minY-30&&y<rug.maxY+52;
  let slots,spacing,underRug=0;
  for(const [sx,sy] of [[92,94],[84,88],[76,82],[68,76],[60,68],[52,60],[44,52]]){
    const available=[];for(let y=62;y<=height-128;y+=sy)for(let x=52;x<=width-52;x+=sx)if(!covered(x,y))available.push({x,y});
    if(available.length>=count){slots=available;spacing=[sx,sy];break;}
  }
  if(!slots){
    // With too little exposed floor, retain every icon on-screen and report
    // any cloth overlap. Never move the user's rug as a side effect.
    const sx=Math.max(28,Math.min(64,Math.sqrt((width-104)*(height-190)/count)*.85)),sy=sx;
    slots=[];for(let y=62;y<=height-128;y+=sy)for(let x=52;x<=width-52;x+=sx)slots.push({x,y});spacing=[sx,sy];
    if(slots.length<count)throw Error('桌面图标过多，当前屏幕放不下；请先减少图标');
  }
  const anchors=[{x:52,y:62},{x:52,y:height-128},{x:width-52,y:62},{x:width-52,y:height-128}];
  let best;const ordered=[...groups].sort((a,b)=>b.items.length-a.items.length);
  // Try distinct corners, allocating the largest category first. This runs
  // once per click; no ongoing layout work affects dragging or sweeping.
  for(let a=0;a<anchors.length;a++)for(let b=0;b<anchors.length;b++)for(let c=0;c<anchors.length;c++){
    if(a===b||a===c||b===c)continue;let free=[...slots],score=0,chosen=[];
    for(let g=0;g<ordered.length;g++){
      const group=ordered[g],anchor=anchors[[a,b,c][g]];
      free.sort((p,q)=>distance(p,anchor)-distance(q,anchor)||p.y-q.y||p.x-q.x);
      const picked=free.splice(0,group.items.length),center={x:picked.reduce((n,p)=>n+p.x,0)/(picked.length||1),y:picked.reduce((n,p)=>n+p.y,0)/(picked.length||1)};
      score+=picked.reduce((n,p)=>n+distance(p,center),0);chosen.push({...group,slots:picked,center});
    }
    for(let i=0;i<chosen.length;i++)for(let j=i+1;j<chosen.length;j++)if(chosen[i].items.length&&chosen[j].items.length)score+=1e8/(100+distance(chosen[i].center,chosen[j].center));
    if(!best||score<best.score)best={score,chosen};
  }
  const positions=[],labels=[];
  for(const g of best.chosen){g.slots.sort((a,b)=>a.y-b.y||a.x-b.x);for(let i=0;i<g.items.length;i++){const p={id:g.items[i].id,...g.slots[i]};positions.push(p);if(covered(p.x,p.y))underRug++;}if(g.items.length)labels.push({id:g.id,title:g.title,count:g.items.length,x:g.slots[0].x,y:g.slots[0].y-44});}
  return {positions,groups:labels,spacing,underRug};
}
