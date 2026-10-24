import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { TOOL_CATALOG, loadPlatformConfig, savePlatformConfig, resolveTool, scanFolderForTools } from './platform-config.js';

const releases = JSON.parse(fs.readFileSync(new URL('./tool-releases.json', import.meta.url), 'utf8'));
const execute = promisify(execFile);
const jobs = new Map();
const jobPath = root => path.join(root, 'toolkit-install.json');

export function toolkitDirectory(value) {
  if (typeof value !== 'string' || !value.trim() || !path.isAbsolute(value.trim())) throw Error('请选择工具安装目录，必须使用绝对路径');
  const dir = path.resolve(value.trim());
  if (dir === path.parse(dir).root) throw Error('请选择具体文件夹，不能直接使用磁盘根目录');
  if (fs.existsSync(dir) && !fs.statSync(dir).isDirectory()) throw Error('工具安装目录不能指向文件');
  return dir;
}

function pythonPath() {
  for (const candidate of [
    path.join(path.dirname(process.execPath), 'resources/runtime/primary-runtime/dependencies/python/python.exe'),
    path.resolve(path.dirname(process.execPath), '../../python/python.exe'),
  ]) if (fs.existsSync(candidate)) return candidate;
  return process.platform === 'win32' ? 'python' : 'python3';
}

async function download(asset, target, fetcher, update) {
  const url = new URL(asset.url);
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || !url.pathname.includes('/releases/download/')) throw Error('下载地址不是已登记的官方发布文件');
  if (!/^[a-f0-9]{64}$/i.test(asset.sha256)) throw Error('发布文件缺少 SHA-256');
  const response = await fetcher(url.href, { signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw Error('下载失败：HTTP ' + response.status);
  const hash = createHash('sha256');
  const handle = await fsp.open(target, 'wx');
  let bytes = 0;
  try {
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > Math.min(512 * 1024 ** 2, asset.size || 512 * 1024 ** 2)) throw Error('下载文件超出预期大小');
      hash.update(chunk);
      await handle.writeFile(chunk);
      update(bytes, asset.size || null);
    }
  } finally { await handle.close(); }
  if (hash.digest('hex') !== asset.sha256) throw Error('SHA-256 校验失败，未安装下载文件');
}

export async function installToolkit(directory, root, options = {}) {
  const dir = toolkitDirectory(directory);
  await fsp.mkdir(dir, { recursive: true });
  const state = options.state || { id: randomUUID(), dir, state: 'running', tools: [], startedAt: new Date().toISOString() };
  const catalogue = options.releases || releases;
  const platform = options.platform || process.platform;
  const arch = options.arch || process.arch;
  const run = options.execute || execute;
  const cfg = loadPlatformConfig(root);
  if (cfg.error) throw Error('现有工具配置损坏，已停止安装');
  const previous = scanFolderForTools(dir, { maxDepth: 6, maxFiles: 20000 });
  const tools = { ...cfg.tools, ...previous.assigned };
  const binDirs = [...new Set([dir, ...(cfg.binDirs || [])])];
  const save = () => savePlatformConfig({ toolkitDir: dir, tools, binDirs, envAdaptConfigured: true, envAdaptSkip: false }, root);
  if (fs.existsSync(path.join(root, 'config.json'))) await fsp.copyFile(path.join(root, 'config.json'), path.join(root, 'config.json.bak-' + state.id), fs.constants.COPYFILE_EXCL);
  save();
  for (const tool of TOOL_CATALOG) {
    const row = { id: tool.id, label: tool.label, state: 'checking' };
    state.tools.push(row);
    let staging;
    try {
      const current = resolveTool(tool.id, { root, config: { ...cfg, toolkitDir: dir, tools, binDirs } });
      if (current.path) { tools[tool.id] = current.path; Object.assign(row, { state: 'existing', path: current.path, message: '保留已有工具' }); save(); continue; }
      if (tool.id === 'impacket') {
        row.state = 'installing'; row.message = '正在创建独立 Python 环境并安装 Impacket';
        const envDir = path.join(dir, 'impacket-0.13.1');
        const marker = path.join(envDir, '.seagull-managed');
        if (fs.existsSync(envDir) && !fs.existsSync(marker)) throw Error('Impacket 目录已存在，保留原目录，请选择其他安装目录');
        await fsp.mkdir(envDir, { recursive: true });
        await fsp.writeFile(marker, 'impacket==0.13.1\n');
        await run(pythonPath(), ['-m', 'venv', envDir], { windowsHide: true, timeout: 120000 });
        const python = path.join(envDir, platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
        await run(python, ['-m', 'pip', 'install', '--disable-pip-version-check', '--index-url', 'https://pypi.org/simple', 'impacket==0.13.1'], { windowsHide: true, timeout: 300000, maxBuffer: 4 * 1024 ** 2 });
        const entry = path.join(envDir, platform === 'win32' ? 'Scripts/secretsdump.py' : 'bin/secretsdump.py');
        if (!fs.existsSync(entry)) throw Error('Impacket 安装未产生预期入口');
        tools[tool.id] = entry;
        Object.assign(row, { state: 'installed', path: entry, message: '已安装到独立 Python 环境' }); save(); continue;
      }
      const release = catalogue[tool.id];
      const asset = release?.assets?.[platform + '-' + arch];
      if (!asset) {
        Object.assign(row, { state: 'manual', message: tool.id === 'nmap' ? 'Nmap 官方 Windows 安装包含驱动，请用官方安装器安装后重新扫描目录：https://nmap.org/download.html' : tool.id === 'masscan' ? 'Masscan 官方未提供此平台的现成发布文件，请放入已安装或自行编译的程序后重新扫描' : '此系统和架构没有已登记的官方发布文件' });
        continue;
      }
      const group = tool.id === 'frpc' || tool.id === 'frps' ? 'frp' : tool.id;
      const destination = path.join(dir, group + '-' + release.version.replace(/^v/, ''));
      if (fs.existsSync(destination)) {
        const found = scanFolderForTools(destination);
        if (!found.assigned[tool.id]) throw Error('目标目录已存在但未找到工具，保留目录供检查');
        Object.assign(tools, found.assigned);
        Object.assign(row, { state: 'existing', path: tools[tool.id], message: '使用已安装版本' }); save(); continue;
      }
      staging = await fsp.mkdtemp(path.join(dir, '.seagull-install-'));
      const downloaded = path.join(staging, 'download');
      row.state = 'downloading'; row.message = '下载官方 ' + release.version + '，并校验 SHA-256';
      await download(asset, downloaded, options.fetch || fetch, (bytes, total) => Object.assign(row, { bytes, total }));
      const content = path.join(staging, 'content');
      await fsp.mkdir(content);
      if (/\.(zip|tar\.gz|tgz)$/i.test(new URL(asset.url).pathname)) {
        row.state = 'extracting';
        await run(pythonPath(), [fileURLToPath(new URL('./extract-tools.py', import.meta.url)), downloaded, content], { windowsHide: true, timeout: 60000 });
      } else await fsp.copyFile(downloaded, path.join(content, tool.id + (platform === 'win32' ? '.exe' : '')));
      const found = scanFolderForTools(content, { maxDepth: 6 });
      if (!found.assigned[tool.id]) throw Error('发布文件中未找到预期工具入口');
      if (platform !== 'win32') for (const file of Object.values(found.assigned)) await fsp.chmod(file, 0o755);
      await fsp.rename(content, destination);
      for (const [id, file] of Object.entries(found.assigned)) tools[id] = path.join(destination, path.relative(content, file));
      await fsp.writeFile(path.join(destination, 'seagull-install.json'), JSON.stringify({ tool: group, version: release.version, source: asset.url, sha256: asset.sha256 }, null, 2));
      Object.assign(row, { state: 'installed', path: tools[tool.id], message: '已安装、校验并配置' });
      save();
    } catch (error) { Object.assign(row, { state: 'failed', message: String(error.message || error) }); }
    finally {
      if (staging && path.dirname(staging) === dir && path.basename(staging).startsWith('.seagull-install-')) await fsp.rm(staging, { recursive: true, force: true });
    }
  }
  state.state = state.tools.every(t => t.state === 'installed' || t.state === 'existing') ? 'complete' : 'partial';
  state.finishedAt = new Date().toISOString();
  await fsp.mkdir(root, { recursive: true });
  await fsp.writeFile(jobPath(root), JSON.stringify(state, null, 2));
  return state;
}

export function toolkitInstallStatus(root) {
  if (jobs.has(root)) return jobs.get(root);
  try { const saved = JSON.parse(fs.readFileSync(jobPath(root), 'utf8')); return saved.state === 'running' ? { ...saved, state: 'interrupted' } : saved; }
  catch { return null; }
}

export function startToolkitInstall(directory, root) {
  const dir = toolkitDirectory(directory);
  const prior = jobs.get(root);
  if (prior?.state === 'running') return { ok: false, error: '已有工具安装任务正在运行', job: prior };
  const state = { id: randomUUID(), dir, state: 'running', tools: [], startedAt: new Date().toISOString() };
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(jobPath(root), JSON.stringify(state, null, 2));
  jobs.set(root, state);
  installToolkit(dir, root, { state }).catch(error => {
    Object.assign(state, { state: 'failed', error: String(error.message || error), finishedAt: new Date().toISOString() });
    try { fs.writeFileSync(jobPath(root), JSON.stringify(state, null, 2)); } catch { /* Keep the error available through the live status endpoint. */ }
  });
  return { ok: true, job: state };
}
