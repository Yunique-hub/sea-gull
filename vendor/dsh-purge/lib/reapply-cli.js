import { reapplyInstalled } from "./reapply.js";

const args = process.argv.slice(2);
const freshExtract = args.includes("--fresh-extract");
const result = await reapplyInstalled({
  scheduleSwap: !args.includes("--no-swap"),
  upgrade: freshExtract,
  forceExtract: freshExtract,
  // fresh-extract 只由先关闭桌面端的一键安装器使用；此时前端 bundle 不会触发 HMR，
  // 必须一并写入，否则 rewind / skill-menu 三条会永久显示 pending。
  preserveClientBundles: !freshExtract,
});
process.stdout.write(`${JSON.stringify(result)}\n`);
process.exit(result.ok ? 0 : 1);
