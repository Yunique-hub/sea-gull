/** 重启前看系统提示词文件：标记写上了，或者当前原文里已经没有那两处旧拦截。 */
export function hostPromptKeepsInject(text) {
  const body = String(text || "");
  const identityMarked = body.includes("[dsh-purge] identity stripped");
  const injectMarked = body.includes("[dsh-purge] complete prompt keeps waterfall inject")
    || body.includes("[dsh-purge] complete prompt keeps inject")
    || body.includes("[dsh-purge] fold-complete inject first");
  if (identityMarked && injectMarked) return true;
  // 空文件或不是这份模块，不能当成已经洗过。
  if (!body.includes("system-prompt/assemble")) return false;
  const identityLeft = body.includes("You are an AI agent powered by DeepSeek Harness.");
  // 0.2.0/0.2.1 都在 complete 分支写 `: [completeSection],`；只有 0.2.1 前面多一行 requiredContexts。
  const dropsInject = body.includes("transformed.sections : [completeSection]")
    || body.includes(": [completeSection]");
  return !identityLeft && !dropsInject;
}
