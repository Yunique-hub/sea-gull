#!/usr/bin/env python3
"""把插件挂进 / 摘出一个 dsh profile 的 package.json。

用法：
  patch_profile.py <package.json> [dep_spec] [dep_name]      # 添加（默认）
  patch_profile.py --remove <package.json> <dep_name>        # 移除
  patch_profile.py --check  <package.json> <dep_name>        # 只检查
  patch_profile.py --validate <package.json>                # 只校验结构
  patch_profile.py --protect-prompt <DSH_HOME>               # 更新时保留现有提示词
  patch_profile.py --repair-market <package.json> <version> # 修复已有市场的版本与 profile
  patch_profile.py --sync-plugin <DSH_HOME> <profile>        # 同步实际加载副本

添加时只改两处，其余键与顺序全保留（幂等，先备份 .bak-seagull）：
  1. dependencies[<name>] = <spec>
  2. dsh.profile.bundles 末尾追加 <name>
"""
from __future__ import annotations

import collections
import json
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path

# Windows 控制台默认 cp1252，直接 print("✓") 会 UnicodeEncodeError。
# 统一切到 UTF-8（写文件已显式 encoding="utf-8"，这里只管 stdout/stderr）。
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

DEFAULT_SPEC = "file:../../plugins/dsh-purge"
DEFAULT_NAME = "dsh-purge"

MARKET_BUNDLE_CHECK = '''function isPatchApplied(cfg, profile, name) {
    // seagull: the host composes bundle patches before the profile patch.
    const paths = [join(cfg.profilesDir, profile, "cordis.patch.yml")];
    const patch = readInstalledPackage(cfg, profile, name)?.dsh?.bundle?.patch;
    if (typeof patch === "string" && patch.startsWith("./") && !patch.split(/[\\\\/]/).includes("..")) {
        paths.push(join(cfg.profilesDir, profile, "node_modules", name, patch));
    }
    const names = [name.toLowerCase(), name.toLowerCase().replace(/^@[^/]+\\//, "")];
    return paths.some(file => {
        try {
            return readFileSync(file, "utf8").split(/\\r?\\n/).some(line => {
                const match = line.trim().match(/^(?:[-*]\\s+)?(?:id|name):\\s*["']?([^"'\\s#]+)["']?\\s*(?:#.*)?$/);
                return Boolean(match && names.includes(match[1].toLowerCase()));
            });
        } catch { return false; }
    });
}
'''


def load(fp: Path):
    data = json.loads(fp.read_text(encoding="utf-8-sig"),
                      object_pairs_hook=collections.OrderedDict)
    if not isinstance(data, dict):
        raise ValueError("package.json 必须是对象")
    for key, parent in (("dependencies", data), ("dsh", data),
                        ("profile", data.get("dsh", {}))):
        if key in parent and not isinstance(parent[key], dict):
            raise ValueError(f"{key} 必须是对象，已停止修改")
    profile = data.get("dsh", {}).get("profile", {})
    if "bundles" in profile and not isinstance(profile["bundles"], list):
        raise ValueError("dsh.profile.bundles 必须是数组，已停止修改")
    return data


def dump(fp: Path, data) -> None:
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="\n",
                                         dir=fp.parent, prefix=fp.name + ".", suffix=".tmp",
                                         delete=False) as output:
            temporary = Path(output.name)
            output.write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
            output.flush()
            os.fsync(output.fileno())
        if fp.exists():
            shutil.copymode(fp, temporary)
        os.replace(temporary, fp)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()


def backup(fp: Path) -> Path:
    bak = fp.with_suffix(fp.suffix + ".bak-seagull")
    if not bak.exists():
        shutil.copy2(fp, bak)
    return bak


def get_bundles(data):
    dsh = data.setdefault("dsh", collections.OrderedDict())
    prof = dsh.setdefault("profile", collections.OrderedDict())
    bundles = prof.get("bundles")
    if not isinstance(bundles, list):
        bundles = []
        prof["bundles"] = bundles
    return bundles


def get_deps(data):
    deps = data.get("dependencies")
    if not isinstance(deps, dict):
        deps = collections.OrderedDict()
        data["dependencies"] = deps
    return deps


def cmd_add(fp: Path, spec: str, name: str) -> int:
    data = load(fp)
    changed = []
    deps = get_deps(data)
    if deps.get(name) != spec:
        deps[name] = spec
        changed.append(f"dependencies[{name}]={spec}")
    bundles = get_bundles(data)
    if name not in bundles:
        bundles.append(name)
        changed.append(f"bundles+={name}")
    if not changed:
        print(f"= {fp} 已是目标状态")
        return 0
    bak = backup(fp)
    dump(fp, data)
    print(f"✓ {fp}")
    for c in changed:
        print(f"   {c}")
    print(f"   备份 {bak}")
    return 0


def cmd_remove(fp: Path, name: str) -> int:
    data = load(fp)
    changed = []
    deps = get_deps(data)
    if name in deps:
        del deps[name]
        changed.append(f"dependencies-={name}")
    bundles = get_bundles(data)
    if name in bundles:
        bundles.remove(name)
        changed.append(f"bundles-={name}")
    if not changed:
        print(f"= {fp} 里没有 {name}")
        return 0
    backup(fp)
    dump(fp, data)
    print(f"✓ 已从 {fp} 移除 {name}")
    return 0


def cmd_check(fp: Path, name: str) -> int:
    data = load(fp)
    deps = data.get("dependencies") or {}
    bundles = ((data.get("dsh") or {}).get("profile") or {}).get("bundles") or []
    ok = name in deps and name in bundles
    print(json.dumps({"file": str(fp), "name": name, "dep": deps.get(name),
                      "in_bundles": name in bundles, "ok": ok}, ensure_ascii=False))
    return 0 if ok else 1


def cmd_repair_market(fp: Path, version: str) -> int:
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise ValueError("市场版本必须是完整版本号")
    data = load(fp)
    name = "@dsh-market/plugin"
    if name not in data.get("dependencies", {}) and name not in data.get("dsh", {}).get("profile", {}).get("bundles", []):
        print("= 未安装插件市场，跳过")
        return 0
    home = fp.resolve().parents[2]
    profiles = home / "profiles"
    settings_file = home / "plugins" / "dsh-market" / "settings.json"
    raw = settings_file.read_text(encoding="utf-8") if settings_file.exists() else ""
    settings = json.loads(raw.lstrip("\ufeff")) if raw else {}
    if not isinstance(settings, dict) or not isinstance(settings.get("profile", ""), str):
        raise ValueError("市场设置或 profile 类型无效，已停止修改")
    selected = settings.get("profile", "")
    if not re.fullmatch(r"[\w.-]+", selected) or not (profiles / selected / "package.json").is_file():
        settings["profile"] = fp.parent.name
    installed_file = fp.parent / "node_modules" / name / "package.json"
    installed = json.loads(installed_file.read_text(encoding="utf-8-sig")).get("version", "") if installed_file.exists() else ""
    current = tuple(map(int, installed.split("."))) if re.fullmatch(r"\d+\.\d+\.\d+", installed) else ()
    target = tuple(map(int, version.split(".")))
    nested_core = installed_file.parent / "node_modules" / "@dsh-market" / "core" / "package.json"
    nested_version = json.loads(nested_core.read_text(encoding="utf-8-sig")).get("version", "") if nested_core.exists() else ""
    stale_core = re.fullmatch(r"\d+\.\d+\.\d+", nested_version) and tuple(map(int, nested_version.split("."))) < (0, 4, 13)
    if current < target or current == target and stale_core:
        cmd_add(fp, version, name)
    if not raw or raw.startswith("\ufeff") or settings != json.loads(raw):
        settings_file.parent.mkdir(parents=True, exist_ok=True)
        if settings_file.exists():
            backup(settings_file)
        dump(settings_file, settings)
    if installed_file.exists() and (current < target or current == target and stale_core):
        previous = Path(tempfile.mkdtemp(prefix=".market-previous-", dir=installed_file.parent.parent))
        previous.rmdir()
        os.replace(installed_file.parent, previous)
        print(f"✓ 旧市场运行副本已归档 → {previous}；由 pnpm 重新安装")
    print(f"✓ 插件市场 profile = {settings['profile']}（UTF-8 无 BOM）")
    return 0


def cmd_sync_plugin(home: Path, profile: str) -> int:
    if not re.fullmatch(r"[\w.-]+", profile) or profile in (".", ".."):
        raise ValueError("profile 名称无效")
    source = home / "plugins" / DEFAULT_NAME
    target = home / "profiles" / profile / "node_modules" / DEFAULT_NAME
    manifest = load(source / "package.json")
    if manifest.get("name") != DEFAULT_NAME or not target.parent.is_dir():
        raise ValueError("插件或 node_modules 不存在")
    files = [p for p in source.rglob("*") if p.is_file()]
    if any(p.is_symlink() for p in source.rglob("*")):
        raise ValueError("插件源目录含意外链接")
    if target.resolve() == source.resolve() or all((target / p.relative_to(source)).is_file() and p.read_bytes() == (target / p.relative_to(source)).read_bytes() for p in files):
        print("= 插件运行副本已与源文件一致")
        return 0
    staging = Path(tempfile.mkdtemp(prefix=".dsh-purge-stage-", dir=target.parent))
    previous = staging.with_name(staging.name.replace("-stage-", "-previous-", 1))
    try:
        shutil.copytree(source, staging, dirs_exist_ok=True)
        if any(p.read_bytes() != (staging / p.relative_to(source)).read_bytes() for p in files):
            raise ValueError("插件暂存校验失败")
        if target.exists() or target.is_symlink():
            os.replace(target, previous)
        try:
            os.replace(staging, target)
        except OSError:
            if previous.exists() or previous.is_symlink():
                os.replace(previous, target)
            raise
    finally:
        if staging.exists():
            shutil.rmtree(staging)
    print(f"✓ {len(files)} 个插件运行文件一致；旧副本保留于 {previous}")
    return 0


def cmd_market_runtime(fp: Path) -> int:
    package = load(fp)
    if "@dsh-market/plugin" not in package.get("dependencies", {}):
        return 0
    plugin = (fp.parent / "node_modules" / "@dsh-market" / "plugin").resolve()
    candidates = (p / "node_modules" / "@dsh-market" / "core" for p in (plugin, *plugin.parents))
    core = next((p.resolve() for p in candidates if (p / "package.json").is_file()), None)
    if core is None:
        raise ValueError("市场 core 未安装，停止修改")
    if load(core / "package.json").get("version") != "0.4.13":
        raise ValueError("市场 core 版本未验证，停止自动修改，请核对兼容性")
    target = core / "dist" / "verify.js"
    text = target.read_text(encoding="utf-8")
    updates = {}
    if "// seagull: the host composes bundle patches" not in text:
        start = text.index("function isPatchApplied(cfg, profile, name) {")
        end = text.index("/** cordis 型插件四态验证 */", start)
        updates[target] = text[:start] + MARKET_BUNDLE_CHECK + text[end:]
    installed_file = core / "dist" / "installed.js"
    installed = installed_file.read_text(encoding="utf-8")
    if "// seagull: scan the selected profile only" not in installed:
        anchor = "if (!profile.isDirectory())"
        if installed.count(anchor) != 1:
            raise ValueError("市场扫描代码不匹配，停止修改")
        updates[installed_file] = 'import { readSettings } from "./config.js";\n// seagull: scan the selected profile only\n' + installed.replace(anchor, "if (!profile.isDirectory() || profile.name !== readSettings(cfg).profile)")
    for target, text in updates.items():
        backup(target)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="\n", dir=target.parent, delete=False) as output:
                temporary = Path(output.name)
                output.write(text)
            os.replace(temporary, target)
        finally:
            if temporary is not None and temporary.exists():
                temporary.unlink()
    print("✓ 市场校验支持 bundle patch；已装列表按选择的 profile 扫描")
    return 0


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 2
    if argv[0] == "--repair-market":
        if len(argv) != 3:
            return 2
        return cmd_repair_market(Path(argv[1]), argv[2])
    if argv[0] == "--sync-plugin":
        if len(argv) != 3:
            return 2
        return cmd_sync_plugin(Path(argv[1]), argv[2])
    if argv[0] == "--market-runtime":
        if len(argv) != 2:
            return 2
        return cmd_market_runtime(Path(argv[1]))
    if argv[0] == "--protect-prompt":
        if len(argv) != 2:
            return 2
        home = Path(argv[1])
        if not (home / "prompt-inject.md").is_file():
            raise ValueError("没有可保留的提示词")
        state_file = home / "dsh-purge" / "override-state.json"
        state = json.loads(state_file.read_text(encoding="utf-8-sig")) if state_file.exists() else {}
        if not isinstance(state, dict):
            raise ValueError("提示词状态必须是对象")
        state.update(customized=True, explicitSave=True, hash="", seedHash="")
        state_file.parent.mkdir(parents=True, exist_ok=True)
        if state_file.exists():
            backup(state_file)
        dump(state_file, state)
        return 0
    if argv[0] == "--validate":
        if len(argv) != 2:
            return 2
        load(Path(argv[1]))
        return 0
    if argv[0] in ("--remove", "--check"):
        mode = argv[0][2:]
        argv = argv[1:]
        if len(argv) < 2:
            print("缺少参数", file=sys.stderr)
            return 2
        fp, name = Path(argv[0]), argv[1]
        return cmd_remove(fp, name) if mode == "remove" else cmd_check(fp, name)

    fp = Path(argv[0])
    spec = argv[1] if len(argv) > 1 else DEFAULT_SPEC
    name = argv[2] if len(argv) > 2 else DEFAULT_NAME
    return cmd_add(fp, spec, name)


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except (OSError, ValueError) as error:
        print(f"profile 处理失败: {error}", file=sys.stderr)
        sys.exit(1)
