import type { DshPack, MarketData } from "@dsh-market/schema";
import type { ResolvedConfig } from "./config.js";
export interface MarketDataResult {
    data: MarketData;
    /** 数据来源：remote / local / cache */
    source: "remote" | "local" | "cache";
    /** 是否使用了过期缓存（fetch 失败降级 / 后台刷新中） */
    stale?: boolean;
    /** 数据 age ms */
    ageMs?: number;
}
/** 拉取市场数据（远程优先，失败逐级降级：本地文件 → 磁盘缓存） */
export declare function fetchMarketData(cfg: ResolvedConfig): Promise<MarketDataResult>;
/**
 * 缓存优先取数（stale-while-revalidate）——面板打开走这条路径。
 *
 * 修的是「磁盘缓存写了却从不读」：`fetchMarketData` 是远程优先，缓存只在远程
 * 失败时兜底，于是每个 DSH 进程首次打开面板都要重下整份索引（实测 6–8s）。
 * 本函数改为：
 *
 *   未过期缓存 → 直接返回，**不发起网络**（数据每日更新一次，1h TTL 足够新鲜）
 *   过期缓存   → 立即返回旧数据，同时**后台刷新**（下次打开即最新，用户永不等待）
 *   无缓存     → 前台拉取（仅首次安装/清缓存后发生）
 *
 * @param cfg - 解析后的配置
 * @param opts.revalidate - 后台刷新完成后回调（用于更新调用方的内存快照）
 * @returns 取数结果，`source` 为 cache/remote/local，`stale` 表示后台正在刷新
 */
export declare function loadMarketData(cfg: ResolvedConfig, opts?: {
    revalidate?: (r: MarketDataResult) => void;
}): Promise<MarketDataResult>;
/** 读取磁盘缓存（未过期且有效时返回） */
export declare function readCachedData(cfg: ResolvedConfig): MarketDataResult | null;
/**
 * 拉取整合包数据（packs.json，与 plugins.json 同目录；失败静默返回空数组）。
 * #249 · 与插件索引同待遇：多源候选（镜像兜底）+ 磁盘缓存（fresh 直接用 / 全部失败时用过期缓存），
 * 否则 packs 请求超时会拖住客户端的列表渲染（实测拖 6.3s）。
 */
export declare function fetchPacksData(cfg: ResolvedConfig): Promise<DshPack[]>;
