import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const folder of ['web','scripts','qa']){
  for(const name of fs.readdirSync(path.join(root,folder))){
    if(!/\.(mjs|cjs)$/.test(name))continue;
    const result=spawnSync(process.execPath,['--check',path.join(root,folder,name)],{stdio:'inherit',windowsHide:true});
    if(result.status!==0)process.exit(result.status||1);
  }
}
for(const name of ['rugs','wallpapers']){
  const styles=JSON.parse(fs.readFileSync(path.join(root,'assets',name+'.json'),'utf8'));
  assert.equal(new Set(styles.map(s=>s.id)).size,styles.length,'Style IDs must be unique');
  for(const style of styles){
    assert(style.id&&style.name);
    if(style.file){assert.equal(path.basename(style.file),style.file);assert(fs.existsSync(path.join(root,'assets',style.file)),`Missing style asset: ${style.file}`);}
    if(name==='rugs')assert(['plush','short','paper'].includes(style.material));
  }
}
const pkg=JSON.parse(fs.readFileSync(path.join(root,'web/package.json'),'utf8'));
const lock=JSON.parse(fs.readFileSync(path.join(root,'web/package-lock.json'),'utf8'));
assert.equal(pkg.version,lock.version);
assert.deepEqual(pkg.dependencies,lock.packages[''].dependencies);
assert(fs.existsSync(path.join(root,'web/enabled.flag')),'GPU launcher flag is required');
console.log('Syntax, style assets and dependency lock: passed');
