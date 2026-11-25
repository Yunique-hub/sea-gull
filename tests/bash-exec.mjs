import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function gitInstallRoots() {
  if (process.platform !== 'win32') return [];
  const roots = [];
  for (const key of [
    'HKLM\\SOFTWARE\\GitForWindows',
    'HKLM\\SOFTWARE\\WOW6432Node\\GitForWindows',
    'HKCU\\SOFTWARE\\GitForWindows',
  ]) {
    const result = spawnSync('reg.exe', ['query', key, '/v', 'InstallPath'], { encoding: 'utf8' });
    if (result.status !== 0) continue;
    const match = result.stdout.match(/InstallPath\s+REG_\w+\s+(.+)$/mi);
    if (match) roots.push(match[1].trim());
  }
  return roots;
}

function isRealBash(candidate) {
  if (!candidate || (path.isAbsolute(candidate) && !fs.existsSync(candidate))) return false;
  const result = spawnSync(candidate, ['--noprofile', '--norc', '-c', 'printf %s "$BASH_VERSION"'], {
    encoding: 'utf8',
    timeout: 5000,
    windowsHide: true,
  });
  return result.status === 0 && /^\d+\.\d+/.test(result.stdout.trim());
}

export function resolveBash() {
  if (process.platform !== 'win32') return 'bash';
  const candidates = [
    process.env.SEAGULL_BASH,
    path.join(process.env.ProgramFiles || '', 'Git', 'bin', 'bash.exe'),
    path.join(process.env.ProgramW6432 || '', 'Git', 'bin', 'bash.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'bin', 'bash.exe'),
    ...gitInstallRoots().map(root => path.join(root, 'bin', 'bash.exe')),
  ];
  return candidates.find(isRealBash) || null;
}
