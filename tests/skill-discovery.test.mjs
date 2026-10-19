import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { parseSkillDocument } from '../vendor/dsh-purge/lib/skills.js';

test('all five Seagull skills have discoverable native skill metadata', () => {
  const root = new URL('../src/skills/', import.meta.url);
  const names = fs.readdirSync(root).filter(name => name.startsWith('seagull-'));
  assert.equal(names.length, 5);
  for (const name of names) {
    const parsed = parseSkillDocument(fs.readFileSync(new URL(name + '/SKILL.md', root), 'utf8'));
    assert.equal(parsed.ok, true, name + ': ' + parsed.error);
    assert.equal(parsed.name, name);
    assert.ok(parsed.description);
    assert.ok(parsed.body.trimStart().startsWith('# Seagull '));
  }
});
