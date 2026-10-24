import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const script=fileURLToPath(new URL('../src/tools/patch_profile.py',import.meta.url));
const python=process.platform==='win32'?'python':'python3';
function fixture(t,installed=true){
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'seagull-market-'));
  t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
  const pkg=path.join(home,'profiles/desktop/package.json'),settings=path.join(home,'plugins/dsh-market/settings.json');
  fs.mkdirSync(path.dirname(pkg),{recursive:true});fs.mkdirSync(path.dirname(settings),{recursive:true});
  fs.writeFileSync(pkg,JSON.stringify({dependencies:installed?{'@dsh-market/plugin':'link:some-custom-market',other:'link:keep'}:{other:'link:keep'},dsh:{profile:{bundles:installed?['base','@dsh-market/plugin']:['base']}}}));
  return {home,pkg,settings,run:()=>spawnSync(python,[script,'--repair-market',pkg,'0.4.16'],{encoding:'utf8'})};
}
test('market repair normalizes BOM settings, selects the existing profile, and updates only an installed market',t=>{
  const f=fixture(t),original='\ufeff'+JSON.stringify({profile:'desktop',modeOverride:'custom',extra:{keep:true}});
  fs.writeFileSync(f.settings,original);const r=f.run();assert.equal(r.status,0,r.stderr);
  const pkg=JSON.parse(fs.readFileSync(f.pkg,'utf8')),settings=JSON.parse(fs.readFileSync(f.settings,'utf8'));
  assert.equal(pkg.dependencies['@dsh-market/plugin'],'0.4.16');assert.equal(pkg.dependencies.other,'link:keep');
  assert.deepEqual(pkg.dsh.profile.bundles,['base','@dsh-market/plugin']);
  assert.deepEqual(settings,{profile:'desktop',modeOverride:'custom',extra:{keep:true}});
  assert.equal(fs.readFileSync(f.settings+'.bak-seagull','utf8'),original);
  const after=fs.readFileSync(f.settings,'utf8');assert.equal(f.run().status,0);assert.equal(fs.readFileSync(f.settings,'utf8'),after);
});
test('market repair does not install an absent market or create its settings',t=>{
  const f=fixture(t,false),before=fs.readFileSync(f.pkg,'utf8');assert.equal(f.run().status,0);
  assert.equal(fs.readFileSync(f.pkg,'utf8'),before);assert.equal(fs.existsSync(f.settings),false);
});
test('market repair preserves a valid explicit web selection and a newer installed package',t=>{
  const f=fixture(t);fs.mkdirSync(path.join(f.home,'profiles/web'),{recursive:true});fs.writeFileSync(path.join(f.home,'profiles/web/package.json'),'{}');
  fs.writeFileSync(f.settings,JSON.stringify({profile:'web',extra:17}));
  const installed=path.join(f.home,'profiles/desktop/node_modules/@dsh-market/plugin');fs.mkdirSync(installed,{recursive:true});fs.writeFileSync(path.join(installed,'package.json'),'{"version":"0.4.17"}');
  const before=fs.readFileSync(f.pkg,'utf8');assert.equal(f.run().status,0);
  assert.equal(fs.readFileSync(f.pkg,'utf8'),before);assert.equal(JSON.parse(fs.readFileSync(f.settings)).profile,'web');
});
test('market repair rejects malformed settings before changing either file',t=>{
  for(const invalid of ['{invalid','[]','{"profile":[]}']){
    const f=fixture(t);fs.writeFileSync(f.settings,invalid);const before=fs.readFileSync(f.pkg,'utf8');
    assert.notEqual(f.run().status,0);assert.equal(fs.readFileSync(f.pkg,'utf8'),before);assert.equal(fs.readFileSync(f.settings,'utf8'),invalid);
  }
});
test('market repair replaces only a missing profile selection without creating a fake web profile',t=>{
  const f=fixture(t);fs.writeFileSync(f.settings,'{"profile":"web","modeOverride":"auto"}');assert.equal(f.run().status,0);
  assert.equal(JSON.parse(fs.readFileSync(f.settings)).profile,'desktop');assert.equal(fs.existsSync(path.join(f.home,'profiles/web')),false);
});
test('market repair archives an old local link without changing its external source',t=>{
  const f=fixture(t),source=path.join(f.home,'external-market'),installed=path.join(f.home,'profiles/desktop/node_modules/@dsh-market/plugin');
  fs.mkdirSync(source);fs.writeFileSync(path.join(source,'package.json'),'{"version":"0.4.14"}');fs.mkdirSync(path.dirname(installed),{recursive:true});fs.symlinkSync(source,installed,process.platform==='win32'?'junction':'dir');
  assert.equal(f.run().status,0);assert.equal(fs.existsSync(installed),false);assert.equal(JSON.parse(fs.readFileSync(path.join(source,'package.json'))).version,'0.4.14');
  assert.equal(fs.readdirSync(path.dirname(installed)).filter(n=>n.startsWith('.market-previous-')).length,1);
});
test('market repair removes the stale nested core shadowing the new hoisted dependency',t=>{
  const f=fixture(t),installed=path.join(f.home,'profiles/desktop/node_modules/@dsh-market/plugin'),core=path.join(installed,'node_modules/@dsh-market/core');
  fs.mkdirSync(core,{recursive:true});fs.writeFileSync(path.join(installed,'package.json'),'{"version":"0.4.16"}');fs.writeFileSync(path.join(core,'package.json'),'{"version":"0.4.11"}');
  assert.equal(f.run().status,0);assert.equal(fs.existsSync(installed),false);assert.equal(JSON.parse(fs.readFileSync(f.pkg)).dependencies['@dsh-market/plugin'],'0.4.16');
});
