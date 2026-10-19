# dsh-purge 修改文档

## 修改日期：2026-10-13

---

## 0. patch 89: SYSTEM_FIELD_EXTRACT（ALL_PATCHES，任何人 apply 自动生效）

**问题**：0.2.0 把系统提示词作为 `role: "system"` 消息放在 messages 数组里，不像 0.1.1 放在单独的 `system` 字段。模型把系统提示词当对话历史质疑→第二轮拒绝/中途醒来拒绝。

**改动**：在 `core.js` 的 `CODE_PATCHES` 数组末尾加 patch 89，patch agent-loop 的 `buildRequest`，把 `role: "system"` 消息从 `deriveMessages()` 提出来合并成 `system` 字段。

**生效条件**：`file: ["agent-loop"]`，`optional: true`，`skipIfMarked: true`。0.2.0 匹配（`session.deriveMessages()`），0.1.1 不匹配（`this.session.deriveMessages()`）→ 只对 0.2.0 生效。

**UI 展示**：`system_field_extracted` 字段加到 status/apply/override 端点，用户在面板看到 `system_field_extracted: true` 知道修复已生效。

**还原**：patch 89 是 `ALL_PATCHES` 的一部分，`git checkout -- lib/core.js` 即可移除。apply 时如果 agent-loop 被重装（npm install），重新 apply 会重新打 patch。

---

## 1. override 状态机修复（core.js）

### 1.1 isKeepableUserOverride 判断顺序（core.js:7844-7848）

**问题**：`explicitSave:true` 在 `seedHash`/`overrideTextIsOurs` 检查之前 return，导致插件自己写的旧默认被误判成用户自改，新默认永远推不进去。

**改动**：把 seedHash 和 overrideTextIsOurs 检查提到 explicitSave/customized 之前。

**原代码**：
```js
if (state.explicitSave === true) return true;
if (state.customized === true) return true;
if (typeof state?.seedHash === "string" && state.seedHash === stamp) return false;
if (state.customized !== true && state.explicitSave !== true && overrideTextIsOurs(state, text)) {
  return false;
}
return true;
```

**改后**：
```js
if (typeof state?.seedHash === "string" && state.seedHash === stamp) return false;
if (overrideTextIsOurs(state, text)) return false;
if (state.explicitSave === true) return true;
if (state.customized === true) return true;
return true;
```

### 1.2 markOverrideCustomized 不记 hash（core.js:7797-7805）

**问题**：`saveOverrideContent` 和 `installOverride` 都调 `markOverrideCustomized`，都记 hash，无法区分用户保存的还是插件写的。

**改动**：`explicitSave:true` 时不记 hash（设为空串），让 `overrideTextIsOurs` 只匹配插件写的。

**原代码**：
```js
export async function markOverrideCustomized(dshHome, customized, text, extra = {}) {
  await writeOverrideState(dshHome, {
    customized: Boolean(customized),
    explicitSave: extra.explicitSave === true,
    hash: hashOverride(text ?? defaultOverrideText()),
    seedHash: defaultOverrideHash(),
    updatedAt: new Date().toISOString(),
  });
}
```

**改后**：
```js
export async function markOverrideCustomized(dshHome, customized, text, extra = {}) {
  const isExplicit = extra.explicitSave === true;
  await writeOverrideState(dshHome, {
    customized: Boolean(customized),
    explicitSave: isExplicit,
    hash: isExplicit ? "" : hashOverride(text ?? defaultOverrideText()),
    seedHash: defaultOverrideHash(),
    updatedAt: new Date().toISOString(),
  });
}
```

### 1.3 commitOverrideOnApply 保留磁盘用户内容（core.js:7993-8018）

**问题**：`incoming=null`（用户点 Apply 但 UI 没传编辑框内容）→ `isKeepableUserOverride(null)` → false → seed 默认 → 覆盖用户修改。

**改动**：`incoming=null` 时读磁盘当前内容，有用户内容就保留 + 标 `explicitSave:true`。

**原代码**：
```js
export async function commitOverrideOnApply(dshHome, incoming) {
  const home = path.normalize(String(dshHome || findDshHome() || ""));
  if (!home) return { action: "skip", reason: "no_home" };
  if (isKeepableUserOverride(home, incoming)) {
    const saved = await saveOverrideContent(home, incoming);
    return { ...saved, action: "saved_user" };
  }
  const seed = seedPromptInjectAtBoot(home);
  try {
    rememberCommittedOverride(home, readPromptInjectFileSync(home) || defaultOverrideText());
  } catch { }
  return seed;
}
```

**改后**：
```js
export async function commitOverrideOnApply(dshHome, incoming) {
  const home = path.normalize(String(dshHome || findDshHome() || ""));
  if (!home) return { action: "skip", reason: "no_home" };
  let effective = typeof incoming === "string" ? incoming : null;
  if (effective === null) {
    try { effective = readPromptInjectFileSync(home); } catch { effective = ""; }
  }
  if (typeof effective === "string" && normalizeOverride(effective) && isKeepableUserOverride(home, effective)) {
    const saved = await saveOverrideContent(home, effective);
    return {4saved, action: "saved_user" };
  }
  const diskRaw = readPromptInjectFileSync(home);
  const diskNorm = normalizeOverride(diskRaw);
  const bundledNorm = normalizeOverride(defaultOverrideText());
  if (diskNorm && diskNorm !== bundledNorm) {
    await markOverrideCustomized(home, true, diskRaw, { explicitSave: true });
    rememberCommittedOverride(home, diskRaw);
    return { action: "kept_user_custom", path: findOverrideFile(home), content: diskRaw };
  }
  const seed = seedPromptInjectAtBoot(home);
  try {
    rememberCommittedOverride(home, readPromptInjectFileSync(home) || defaultOverrideText());
  } catch { }
  return seed;
}
```

### 1.4 Apply 后 seed 保护用户内容（index.js:2002-2014）

**问题**：Apply 后无条件 `seedPromptInjectAtBoot` → 可能覆盖用户内容。

**改动**：先读磁盘，有用户内容且 keepable → 跳过 seed。

**原代码**：
```js
let promptInjectInstall = "skipped";
if (hostWritten && flash.ok === true) {
  try {
    const seed = core.seedPromptInjectAtBoot(state.dsh_home);
    promptInjectInstall = seed?.action || "noop";
  } catch (e) {
    promptInjectInstall = `error:${String(e && e.message ? e.message : e)}`;
  }
}
```

**改后**：
```js
let promptInjectInstall = "skipped";
if (hostWritten && flash.ok === true) {
  try {
    const home = state.dsh_home;
    const diskRaw = core.readPromptInjectFileSync(home);
    const diskNorm = core.normalizeOverride(diskRaw);
    const bundledNorm = core.normalizeOverride(core.defaultOverrideText());
    if (diskNorm && diskNorm !== bundledNorm && core.isKeepableUserOverride(home, diskRaw)) {
      promptInjectInstall = "kept_user_custom";
    } else {
      const seed = core.seedPromptInjectAtBoot(home);
      promptInjectInstall = seed?.action || "noop";
    }
  } catch (e) {
    promptInjectInstall = `error:${String(e && e.message ? e.message : e)}`;
  }
}
```

---

## 2. 0.2.0 system prompt 修复（dsh-agent-loop/lib/index.js）

### 2.1 buildRequest 提取 system 到单独字段

**问题**：0.2.0 把系统提示词作为 `role: "system"` 消息放在 messages 数组里，不像 0.1.1 放在单独的 `system` 字段。模型把系统提示词当对话历史质疑→第二轮拒绝。

**改动**：在 `buildRequest` 里把 `role: "system"` 消息从 `deriveMessages()` 提出来，合并成 `system` 字符串放进 `system` 字段。

**文件**：
- `D:\DeepSeek Harness\.dsh\profiles\node_modules\@deepseek-ai\dsh-agent-loop\lib\index.js`
- `D:\DeepSeek Harness\npm-global\node_modules\@deepseek-ai\dsh\node_modules\@deepseek-ai\dsh-agent-loop\lib\index.js`
（两份是同一文件，hash 一致）

**原代码**（约1270行）：
```js
const boundaryMessages = session.deriveMessages();
for (const message of boundaryMessages) {
  if (this.frozenMessages.has(message)) continue;
  deepFreeze(message);
  this.frozenMessages.add(message);
}
Object.freeze(boundaryMessages);
return markAgentLoopRequest(Object.freeze({
  ...header.config,
  messages: boundaryMessages,
  toolHistory: session.toolHistory(),
  ...header.tools !== void 0 ? { tools: header.tools } : {},
  sessionId: this.session.id,
  signal
}));
```

**改后**：
```js
const boundaryMessages = session.deriveMessages();
const systemParts = [];
const nonSystemMessages = [];
for (const message of boundaryMessages) {
  if (message && message.role === "system") {
    const content = message.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block && block.type === "text" && typeof block.text === "string" && block.text.length > 0) {
          systemParts.push(block.text);
        }
      }
    } else if (typeof content === "string" && content.length > 0) {
      systemParts.push(content);
    }
  } else {
    nonSystemMessages.push(message);
  }
}
const systemField = systemParts.length > 0 ? systemParts.join("\n\n") : void 0;
for (const message of nonSystemMessages) {
  if (this.frozenMessages.has(message)) continue;
  deepFreeze(message);
  this.frozenMessages.add(message);
}
Object.freeze(nonSystemMessages);
return markAgentLoopRequest(Object.freeze({
  ...header.config,
  ...systemField !== void 0 ? { system: systemField } : {},
  messages: nonSystemMessages,
  toolHistory: session.toolHistory(),
  ...header.tools !== void 0 ? { tools: header.tools } : {},
  sessionId: this.session.id,
  signal
}));
```

---

## 3. 提示词文件

### 3.1 新版提示词
- `lib/default-prompt-inject.en.md` — 英文版
- `lib/default-prompt-inject.zh.md` — 中文版

### 3.2 原版备份
- `lib/default-prompt-inject.md.bak` — 原版（232行）
- `lib/default-prompt-inject.md` — 当前生效版（未替换，仍是原版）

---

## 还原方法

### 还原 core.js（override 状态机）

```powershell
# 用 git 还原
cd E:\渗透\dsh-purge
git checkout -- lib/core.js
git checkout -- lib/index.js
```

### 还原 dsh-agent-loop（system prompt 修复）

```powershell
# 从 dsh-purge 的 bak 还原（如果 dsh-purge 创建了 bak）
Copy-Item "D:\DeepSeek Harness\.dsh\profiles\node_modules\@deepseek-ai\dsh-agent-loop\lib\index.js.dshpurge.bak" "D:\DeepSeek Harness\.dsh\profiles\node_modules\@deepseek-ai\dsh-agent-loop\lib\index.js" -Force

# 或者从 npm 缓存重装
cd D:\DeepSeek Harness
npm install @deepseek-ai/dsh-agent-loop@0.2.0-rc.2 --force
```

### 还原提示词

```powershell
# 还原成原版
Copy-Item "E:\渗透\dsh-purge\lib\default-prompt-inject.md.bak" "E:\渗透\dsh-purge\lib\default-prompt-inject.md" -Force

# 同步运行时副本
Copy-Item "E:\渗透\dsh-purge\lib\default-prompt-inject.md" "D:\DeepSeek Harness\.dsh\prompt-inject.md" -Force

# 清 override state
$state = @{ customized = $false; explicitSave = $false; hash = ""; seedHash = ""; updatedAt = (Get-Date -Format "o") }
$state | ConvertTo-Json -Depth 2 | Set-Content -LiteralPath "D:\DeepSeek Harness\.dsh\dsh-purge\override-state.json" -Encoding UTF8 -NoNewline
```

### 还原 override-state.json

```powershell
$state = @{ customized = $false; explicitSave = $false; hash = ""; seedHash = ""; updatedAt = (Get-Date -Format "o") }
$state | ConvertTo-Json -Depth 2 | Set-Content -LiteralPath "D:\DeepSeek Harness\.dsh\dsh-purge\override-state.json" -Encoding UTF8 -NoNewline
```

### 全部还原（一键）

```powershell
# 1. core.js + index.js
cd E:\渗透\dsh-purge
git checkout -- lib/core.js lib/index.js

# 2. dsh-agent-loop
Copy-Item "D:\DeepSeek Harness\.dsh\profiles\node_modules\@deepseek-ai\dsh-agent-loop\lib\index.js.dshpurge.bak" "D:\DeepSeek Harness\.dsh\profiles\node_modules\@deepseek-ai\dsh-agent-loop\lib\index.js" -Force

# 3. 提示词
Copy-Item "E:\渗透\dsh-purge\lib\default-prompt-inject.md.bak" "E:\渗透\dsh-purge@lib\default-prompt-inject.md" -Force
Copy-Item "E:\渗透\dsh-purge\lib\default-prompt-inject.md" "D:\DeepSeek Harness\.dsh\prompt-inject.md" -Force

# 4. override state
$state = @{ customized = $false; explicitSave = $false; hash = ""; seedHash = ""; updatedAt = (Get-Date -Format "o") }
$state | ConvertTo-Json -Depth 2 | Set-Content -LiteralPath "D:\DeepSeek Harness\.dsh\dsh-purge\override-state.json" -Encoding UTF8 -NoNewline

Write-Output "全部还原完成，重启桌面端生效"
```
