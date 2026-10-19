#!/usr/bin/env python3
"""把插件挂进 / 摘出一个 dsh profile 的 package.json。

用法：
  patch_profile.py <package.json> [dep_spec] [dep_name]      # 添加（默认）
  patch_profile.py --remove <package.json> <dep_name>        # 移除
  patch_profile.py --check  <package.json> <dep_name>        # 只检查
  patch_profile.py --validate <package.json>                # 只校验结构
  patch_profile.py --protect-prompt <DSH_HOME>               # 更新时保留现有提示词

添加时只改两处，其余键与顺序全保留（幂等，先备份 .bak-seagull）：
  1. dependencies[<name>] = <spec>
  2. dsh.profile.bundles 末尾追加 <name>
"""
from __future__ import annotations

import collections
import json
import os
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


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 2
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
