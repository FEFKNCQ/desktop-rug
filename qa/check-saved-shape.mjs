import {ClothSim} from '../web/cloth.mjs';
import {crossings} from '../web/mesh-check.mjs';
import fs from 'node:fs';
const [x,y,width,angle]=fs.readFileSync(new URL('../state.ini',import.meta.url),'utf8').trim().split(/\s+/).map(Number);
const state=new ClothSim({x,y,width,angle}),shape=JSON.parse(fs.readFileSync(new URL('../plush-shape.json',import.meta.url),'utf8'));state.setMaterial('short');state.load(shape);
const before=crossings(state);for(let i=0;i<180&&state.active;i++)state.step();const after=crossings(state);const report={originalIntersections:state.repairedIntersections,afterRecovery:before,afterRelaxation:after,positionAndSize:{x,y,width,angle},passed:before===0&&after===0};console.log(report);fs.writeFileSync(new URL('saved-shape-v45.json',import.meta.url),JSON.stringify(report,null,2));
if(!report.passed)throw Error('Saved pose recovery failed');
