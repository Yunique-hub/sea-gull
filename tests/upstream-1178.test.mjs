import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {scheduleClearOwnedSelectedDefault,cancelClearOwnedSelectedDefault} from '../vendor/dsh-purge/lib/preset-default.js';
import {stripPluginFromPackage} from '../vendor/dsh-purge/lib/uninstall.js';
import {applyUpdate} from '../vendor/dsh-purge/lib/update.js';
import {apply} from '../vendor/dsh-purge/lib/index.js';

function home(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'seagull-disable-'));t.after(()=>{cancelClearOwnedSelectedDefault();fs.rmSync(dir,{recursive:true,force:true});});return dir;}
function preset(dir,file='cordis.patch.yml'){const f=path.join(dir,'profiles/desktop',file);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,'- id: agent-preset-registry\n  config:\n    selectedDefault: redteam\n');return f;}
test('disabled purge repairs an owned preset default in both supported YAML files',t=>{
  const dir=home(t),files=[preset(dir),preset(dir,'cordis.yml')],previous=process.env.DSH_HOME;process.env.DSH_HOME=dir;
  try{apply({get(){return null;}},{enabled:false});for(const f of files)assert.match(fs.readFileSync(f,'utf8'),/selectedDefault: standard/);}
  finally{if(previous===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=previous;}
});
test('delayed disable cleanup remains bound to its original home when the environment changes',async t=>{
  const first=home(t),second=home(t),a=preset(first),b=preset(second),previous=process.env.DSH_HOME;
  try{process.env.DSH_HOME=first;scheduleClearOwnedSelectedDefault();process.env.DSH_HOME=second;await new Promise(r=>setTimeout(r,850));
    assert.match(fs.readFileSync(a,'utf8'),/selectedDefault: standard/);assert.match(fs.readFileSync(b,'utf8'),/selectedDefault: redteam/);}
  finally{if(previous===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=previous;}
});
test('hot reload cancellation preserves the selected preset',async t=>{
  const dir=home(t),file=preset(dir);scheduleClearOwnedSelectedDefault({dshHome:dir});cancelClearOwnedSelectedDefault();await new Promise(r=>setTimeout(r,850));assert.match(fs.readFileSync(file,'utf8'),/selectedDefault: redteam/);
});
test('upstream uninstall strips nested bundles without removing unrelated plugins',()=>{
  const pkg={dependencies:{'dsh-purge':'file:x',other:'1'},dsh:{profile:{bundles:['base','dsh-purge',{name:'other'}],plugins:[{id:'dsh-purge'},'keep']}}};
  assert.equal(stripPluginFromPackage(pkg),true);assert.deepEqual(pkg,{dependencies:{other:'1'},dsh:{profile:{bundles:['base',{name:'other'}],plugins:['keep']}}});assert.equal(stripPluginFromPackage(pkg),false);
});
test('a managed Seagull installation cannot be overwritten by the upstream updater',async()=>{
  const pkg=new URL('../vendor/dsh-purge/package.json',import.meta.url),before=fs.readFileSync(pkg);
  await assert.rejects(applyUpdate([]),/海鸥一键更新/);assert.deepEqual(fs.readFileSync(pkg),before);
});
