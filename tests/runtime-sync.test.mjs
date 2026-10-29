import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {resolvePython} from './python-exec.mjs';
const script=fileURLToPath(new URL('../src/tools/patch_profile.py',import.meta.url)),python=resolvePython();
function fixture(t){
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'seagull-sync-'));t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
  const source=path.join(home,'plugins/dsh-purge'),target=path.join(home,'profiles/desktop/node_modules/dsh-purge');
  for(const dir of [source,target]){fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'package.json'),'{"name":"dsh-purge","version":"1.1.78"}');}
  fs.writeFileSync(path.join(source,'client.js'),'managed current');fs.writeFileSync(path.join(target,'client.js'),'stale original');
  return {home,source,target,run:()=>spawnSync(python.command,[...python.args,script,'--sync-plugin',home,'desktop'],{encoding:'utf8'})};
}
test('same-version runtime sync repairs stale files, retains a backup, and is idempotent',t=>{
  const f=fixture(t),r=f.run();assert.equal(r.status,0,r.stderr);assert.equal(fs.readFileSync(path.join(f.target,'client.js'),'utf8'),'managed current');
  const backups=fs.readdirSync(path.dirname(f.target)).filter(n=>n.startsWith('.dsh-purge-previous-'));assert.equal(backups.length,1);assert.equal(fs.readFileSync(path.join(path.dirname(f.target),backups[0],'client.js'),'utf8'),'stale original');
  assert.equal(f.run().status,0);assert.equal(fs.readdirSync(path.dirname(f.target)).filter(n=>n.startsWith('.dsh-purge-previous-')).length,1);
});
test('failed runtime swap restores the previous package and cleans staging',t=>{
  const f=fixture(t),code=`import importlib.util, pathlib, sys\nfrom unittest.mock import patch\ns=importlib.util.spec_from_file_location('p',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nreplace=m.os.replace\ndef fail(source,target):\n    if pathlib.Path(source).name.startswith('.dsh-purge-stage-'): raise OSError('fixture swap failed')\n    return replace(source,target)\nwith patch.object(m.os,'replace',side_effect=fail):\n    try: m.cmd_sync_plugin(pathlib.Path(sys.argv[2]),'desktop')\n    except OSError: sys.exit(17)\n`;
  const r=spawnSync(python.command,[...python.args,'-c',code,script,f.home],{encoding:'utf8'});assert.equal(r.status,17,r.stderr);assert.equal(fs.readFileSync(path.join(f.target,'client.js'),'utf8'),'stale original');assert.deepEqual(fs.readdirSync(path.dirname(f.target)),['dsh-purge']);
});
test('runtime sync rejects traversal before any mutation',t=>{
  const f=fixture(t),r=spawnSync(python.command,[...python.args,script,'--sync-plugin',f.home,'..'],{encoding:'utf8'});assert.notEqual(r.status,0);assert.equal(fs.readFileSync(path.join(f.target,'client.js'),'utf8'),'stale original');
});
