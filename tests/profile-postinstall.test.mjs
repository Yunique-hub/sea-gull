import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
const script=fileURLToPath(new URL('../vendor/dsh-purge/scripts/ensure-profile-bundle.mjs',import.meta.url));

test('upstream pnpm postinstall adds the bundle once and preserves unrelated profile configuration',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'seagull-postinstall-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,'package.json');
 const original={name:'dsh-profile-fixture',private:true,dependencies:{existing:'1'},dsh:{profile:{bundles:['existing']}}};
 fs.writeFileSync(file,JSON.stringify(original));
 for(let i=0;i<2;i++){
  const child=spawnSync(process.execPath,[script],{cwd:dir,env:{...process.env,INIT_CWD:dir,npm_config_local_prefix:dir},encoding:'utf8'});
  assert.equal(child.status,0,child.stderr);
  const pkg=JSON.parse(fs.readFileSync(file,'utf8'));
  assert.deepEqual(pkg.dependencies,original.dependencies);
  assert.deepEqual(pkg.dsh.profile.bundles,['existing','dsh-purge']);
 }
});

test('upstream postinstall skips a normal project without writing files',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'seagull-not-profile-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,'package.json'),raw='{"name":"ordinary-project","private":true}\n';
 fs.writeFileSync(file,raw);
 const child=spawnSync(process.execPath,[script],{cwd:dir,env:{...process.env,INIT_CWD:dir,npm_config_local_prefix:dir},encoding:'utf8'});
 assert.equal(child.status,0,child.stderr);
 assert.equal(fs.readFileSync(file,'utf8'),raw);
});
