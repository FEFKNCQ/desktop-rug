import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('../',import.meta.url));
const git=args=>execFileSync('git',args,{cwd,windowsHide:true,maxBuffer:32*1024*1024});
let paths;
try{paths=git(['ls-files','--cached','-z']).toString('utf8').split('\0').filter(Boolean);}
catch{console.error('Run in a Git checkout after staging the intended files.');process.exit(1);}
if(!paths.length){console.error('Nothing staged/tracked; cannot audit an empty index.');process.exit(1);}
const forbidden=/(^|\/)(node_modules|profile|wallpaper-backup|revisions)(\/|$)|(^|\/)(\.env(?:\..*)?|\.npmrc|state\.ini|plush-shape\.json|cloth-shape\.bin|floor-enabled\.txt|rug-style\.txt|status\.txt|runtime\.log|before-last-sweep\.bin|push-active\.txt|original-[^/]+)$|\.(?:log|cpuprofile|mp4|mov|webm|dmp|pem|key|pfx|p12)$/i;
const checks=[
  ['GitHub token', /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/],
  ['API credential', /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{25,}/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['credential in URL', /https?:\/\/[^\s/:]+:[^\s/@]+@/],
  ['personal Windows path', /[A-Za-z]:[\\/]+(?:Users|Documents and Settings|Codex|桌面|网页下载)[\\/]+/i],
  ['personal Unix path', /\/(?:home|Users)\/[A-Za-z0-9_.-]+\//],
  ['assigned secret', /(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*["'][A-Za-z0-9_+\/=.-]{16,}["']/i]
];
const problems=[];let pngs=0;
for(const name of paths){
  if(forbidden.test(name))problems.push(`${name}: forbidden local-data path`);
  if(name.startsWith('qa/')&&!name.startsWith('qa/reference/')&&!/\.(mjs|py)$/.test(name)&&name!=='qa/README.md')problems.push(`${name}: unreviewed QA output`);
  const data=git(['show',':'+name]);
  if(/\.(?:mjs|cjs|cs|ps1|py|md|txt|json|html|css|svg|yml|yaml|manifest)$/.test(name)||['LICENSE','.gitignore','.gitattributes'].includes(name)){
    const lines=data.toString('utf8').split(/\r?\n/);
    for(let i=0;i<lines.length;i++)for(const [label,pattern] of checks)if(pattern.test(lines[i]))problems.push(`${name}:${i+1}: ${label}`);
  }
  if(name.endsWith('.png')){
    pngs++;
    if(data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'){problems.push(`${name}: invalid PNG`);continue;}
    for(let offset=8;offset+12<=data.length;){
      const size=data.readUInt32BE(offset),type=data.toString('ascii',offset+4,offset+8);
      if(['tEXt','zTXt','iTXt','eXIf'].includes(type))problems.push(`${name}: PNG metadata (${type}) needs manual review`);
      offset+=size+12;
    }
  }
}
if(problems.length){console.error(problems.join('\n'));process.exit(1);}
console.log(`Privacy check passed: ${paths.length} index files, ${pngs} PNGs; no blocked paths or matched credential/personal-path patterns. New images and logs still require human review.`);
