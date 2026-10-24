"""Persist an explicitly selected toolkit directory without replacing other settings."""
import sys
from pathlib import Path
from patch_profile import backup, dump
import json

home, directory = Path(sys.argv[1]), Path(sys.argv[2])
if not directory.is_absolute() or directory == Path(directory.anchor):
    raise SystemExit('请选择具体的绝对路径文件夹作为工具安装目录')
if directory.exists() and not directory.is_dir():
    raise SystemExit('工具安装目录不能指向文件')
file = home / 'redteam/config.json'
data = json.loads(file.read_text(encoding='utf-8-sig')) if file.exists() else {}
if not isinstance(data, dict):
    raise SystemExit('现有工具配置格式无效，未修改')
if '--validate-only' in sys.argv[3:]:
    raise SystemExit(0)
if file.exists():
    backup(file)
data['toolkitDir'] = str(directory)
file.parent.mkdir(parents=True, exist_ok=True)
dump(file, data)
print('工具安装目录已保存：' + str(directory))
