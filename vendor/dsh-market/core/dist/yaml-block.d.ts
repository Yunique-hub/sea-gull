/**
 * pnpm-workspace.yaml 最小编辑器（P0-2/P0-3 共用）
 *
 * 需求只覆盖三种简单结构，因此不引入 YAML 依赖，用行级编辑而非全量解析：
 *   1. 数组块：`key:` + `  - item`（如 onlyBuiltDependencies）
 *   2. map 真值块：`key:` + `  item: true`（如 allowBuilds）
 *   3. 标量：`key: value`（如 minimumReleaseAge）
 *
 * 原则：保留未涉及内容原样；只在目标块内做增量合并，绝不整体重写文件。
 * 纯函数，可独立测试。
 */
/** 数组块：往 `key:` 块中合并条目（去重保留；无块则追加到文件末尾） */
export declare function mergeListBlock(yaml: string, key: string, items: string[]): string;
/** map 真值块：往 `key:` 块中合并 `item: true` 条目（如 allowBuilds） */
export declare function mergeTrueMapBlock(yaml: string, key: string, items: string[]): string;
/** 标量：设置 `key: value`（已存在则替换该行，否则追加到末尾） */
export declare function setScalar(yaml: string, key: string, value: string | number): string;
/** 标量：读取 `key: value` 的值（无或非标量返回 null） */
export declare function getScalar(yaml: string, key: string): string | null;
/** 数组块：读取 `key:` 下的条目（含内联形态 `key: [a, b]`） */
export declare function getListBlock(yaml: string, key: string): string[];
/** map 真值块：读取 `key:` 下的键名（形如 `  name: true`） */
export declare function getTrueMapBlock(yaml: string, key: string): string[];
