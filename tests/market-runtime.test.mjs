import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
const script=fileURLToPath(new URL('../src/tools/patch_profile.py',import.meta.url)),python=process.platform==='win32'?'python':'python3';
const original=fs.readFileSync(new URL('./fixtures/market-verify-original.js.txt',import.meta.url),'utf8');
function fixture(t){
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'seagull-market-verify-'));t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
  const profile=path.join(home,'profiles/desktop'),core=path.join(profile,'node_modules/@dsh-market/core'),plugin=path.join(profile,'node_modules/dsh-purge'),pkg=path.join(profile,'package.json'),target=path.join(core,'dist/verify.js');
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.mkdirSync(plugin,{recursive:true});fs.writeFileSync(path.join(core,'package.json'),'{"version":"0.4.13"}');fs.writeFileSync(pkg,'{"dependencies":{"@dsh-market/plugin":"0.4.16"}}');fs.writeFileSync(target,original);fs.writeFileSync(path.join(plugin,'package.json'),JSON.stringify({dsh:{bundle:{patch:'./cordis.patch.yml'}}}));
  fs.writeFileSync(path.join(core,'dist/installed.js'),'export function include(profile) { if (!profile.isDirectory()) return false; return true; }');
  const check=()=>new Function('join','readFileSync','readInstalledPackage',fs.readFileSync(target,'utf8')+'\nreturn isPatchApplied;')(path.join,fs.readFileSync,(cfg,p,n)=>JSON.parse(fs.readFileSync(path.join(cfg.profilesDir,p,'node_modules',n,'package.json'))))({profilesDir:path.join(home,'profiles')},'desktop','dsh-purge');
  return {home,profile,core,plugin,pkg,target,check,run:()=>spawnSync(python,[script,'--market-runtime',pkg],{encoding:'utf8'})};
}
test('market verification recognizes the host-composed bundle instead of requesting another restart',t=>{
  const f=fixture(t);fs.writeFileSync(path.join(f.plugin,'cordis.patch.yml'),'- insert:\n    - id: dsh-purge\n      name: dsh-purge\n');assert.equal(f.check(),false);
  const r=f.run();assert.equal(r.status,0,r.stderr);assert.equal(f.check(),true);const result=fs.readFileSync(f.target,'utf8');assert.equal(f.run().status,0);assert.equal(fs.readFileSync(f.target,'utf8'),result);assert.equal(fs.readFileSync(f.target+'.bak-seagull','utf8'),original);
});
test('market verification does not treat an unrelated bundle or missing patch as applied',t=>{
  const f=fixture(t);assert.equal(f.run().status,0);assert.equal(f.check(),false);fs.writeFileSync(path.join(f.plugin,'cordis.patch.yml'),'- insert:\n    - id: another-plugin\n');assert.equal(f.check(),false);
});
test('market verification refuses to rewrite an unknown core version',t=>{
  const f=fixture(t);fs.writeFileSync(path.join(f.core,'package.json'),'{"version":"99.0.0"}');assert.notEqual(f.run().status,0);assert.equal(fs.readFileSync(f.target,'utf8'),original);
});
test('market scan excludes inactive profiles without deleting them',t=>{
  const f=fixture(t);assert.equal(f.run().status,0);const text=fs.readFileSync(path.join(f.core,'dist/installed.js'),'utf8');
  const include=new Function('readSettings','cfg',text.replace('import { readSettings } from "./config.js";','').replace('export function','function')+';return include;')(()=>({profile:'desktop'}),{});
  assert.equal(include({name:'desktop',isDirectory:()=>true}),true);assert.equal(include({name:'verify-seagull',isDirectory:()=>true}),false);assert.equal(include({name:'desktop',isDirectory:()=>false}),false);
});
test('market runtime repair resolves the core from an isolated pnpm layout',t=>{
  const f=fixture(t),virtual=path.join(f.profile,'node_modules/.pnpm/market-fixture/node_modules'),plugin=path.join(virtual,'@dsh-market/plugin'),core=path.join(virtual,'@dsh-market/core'),entry=path.join(f.profile,'node_modules/@dsh-market/plugin');
  fs.mkdirSync(plugin,{recursive:true});fs.renameSync(f.core,core);fs.symlinkSync(plugin,entry,process.platform==='win32'?'junction':'dir');
  const r=f.run();assert.equal(r.status,0,r.stderr);assert.match(fs.readFileSync(path.join(core,'dist/verify.js'),'utf8'),/seagull: the host composes bundle patches/);
});
