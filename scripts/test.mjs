import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
fs.mkdirSync(path.join(root,'qa'),{recursive:true});
const tests=['test-cloth-input.mjs','test-pushing.mjs','test-broom-live.mjs','test-organize.mjs','test-interactions.mjs','test-physics.mjs','test-materials.mjs','test-stacking.mjs'];
for(const name of tests){
  console.log(`\nRunning ${name}`);
  const result=spawnSync(process.execPath,[path.join(root,'web',name)],{cwd:root,stdio:'inherit',windowsHide:true});
  if(result.status!==0)process.exit(result.status||1);
}
console.log(`\nAll ${tests.length} non-desktop test suites passed.`);
