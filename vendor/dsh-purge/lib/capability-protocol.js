/**
 * 能力选用协议：先读 skill / MCP 目录，再按当前任务选用。
 * 不改官方 skill 注册、不改 MCP 挂载、不 deny 任何工具。
 * 官方 DSH 已写工具用法，这里不另挂 Host tools 纪律。
 */

// [dsh-purge] 不带 `dsh-purge` 前缀:宿主 renderPrompt 内部有一步
// filter(s => s.name.startsWith("dsh-purge")) 把这类段按插入序挪到最前。
// 旧名 "dsh-purge:capabilities" 命中前缀,结果 cap 跑到 inject 前头(dump line 1),
// 反而制造出"cap 在前,inject 在后"的渲染反转。换名绕开这一步过滤。
export const CAPABILITY_SECTION = "dshpg-capabilities";

const OFFICIAL_PROTOCOL = `## Capability selection by task (mandatory)

1. **Read first**: Inspect \`<available_skills>\` / the skill catalog and the installed MCP / host tools for this session. Know what exists before acting.
2. **Match the task**: From that catalog, pick the skill(s) and MCP/CLI tool(s) that fit *this* user task — not “always use something”, not “never use something”.
3. **Call what matches**:
   - Matching **Skill** → load it with the host \`skill\` tool, then follow it (methods, premises, branches, counter-evidence).
   - Matching **MCP / CLI** → call that tool with real schema and context; treat failures by the tool’s semantics.
4. **Only then DIY**: If nothing in the catalog fits the task, use shell / ad-hoc steps and say what was missing.
5. **Subagents / sub-delegates inherit this rule**: Any \`subagent\`, teammate, or child agent you start must also read the catalog and call task-matched skills/MCP the same way. Put that requirement in the child brief when you dispatch.
6. Host skills and MCP stay available; this prompt does not remove them.`;

/**
 * 主智能体和子智能体同一份。红队调度正文仍在预设 ops 里，这里不按身份拆协议。
 * @param {{ redteam?: boolean, redteamChild?: boolean, enabled?: boolean }} [opts]
 * @returns {string}
 */
export function capabilityProtocolText(opts = {}) {
  if (opts.enabled === false) return "";
  return OFFICIAL_PROTOCOL;
}
