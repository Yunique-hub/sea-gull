/**
 * 市场索引瘦身（plugins-lite.json）
 *
 * 背景：`plugins.json` 随生态增长已到 ~12.5 MB 原始 / ~2.8 MB gzip，插件端每个
 * 进程首次打开面板都要完整拉一遍（实测 6–8s）。但插件端只读取其中一部分字段。
 *
 * 裁剪判据（不是拍脑袋）：对 plugin/core/src、plugin/ui/src、schema/src 逐字段做
 * `.字段名` 属性访问扫描（剔除注释），**零访问**的字段才列入 {@link LITE_DROP_FIELDS}。
 * 结果：原始 12.49 → 4.17 MB，gzip 2.79 → 1.20 MB（约 -57%）。
 *
 * 安全网：`plugin/core/test/lite.test.ts` 用等价性测试锁死——把同一批插件分别喂给
 * 全量与瘦身后的数据，`recommend()` 与 `search()` 的结果必须逐项一致。将来若有代码
 * 开始读取某个被裁掉的字段，该测试会立刻变红。
 */
import type { DshPlugin, MarketData } from "@dsh-market/schema";
/**
 * 可从索引中裁掉的顶层字段（插件端零 `.字段` 访问）。
 * 每项都注明用途，便于将来复核——若某项真被需要，从本表移除即可（数据管道下次产出恢复）。
 */
export declare const LITE_DROP_FIELDS: readonly string[];
/** 可从嵌套对象中裁掉的子字段 */
export declare const LITE_DROP_SUBFIELDS: Readonly<Record<string, readonly string[]>>;
/** 单条插件瘦身：删除 {@link LITE_DROP_FIELDS} 与 {@link LITE_DROP_SUBFIELDS} 列出的键 */
export declare function toLitePlugin(plugin: DshPlugin): DshPlugin;
/** 整份市场数据瘦身（collector 产出 plugins-lite.json 用） */
export declare function toLiteMarketData(market: MarketData): MarketData;
