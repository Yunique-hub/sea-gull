"""Extract a downloaded tool archive into a new staging directory."""
import shutil
import stat
import sys
import tarfile
import zipfile
from pathlib import Path, PurePosixPath

archive, destination = map(Path, sys.argv[1:3])
root = destination.resolve()
root.mkdir(parents=True, exist_ok=True)

def target(name):
    normalized = name.replace('\\', '/')
    parts = PurePosixPath(normalized).parts
    if normalized.startswith('/') or '..' in parts or any(':' in p for p in parts):
        raise ValueError('Archive path escapes staging directory')
    result = (root / normalized).resolve()
    if result != root and root not in result.parents:
        raise ValueError('Archive path escapes staging directory')
    return result

total = 0
if zipfile.is_zipfile(archive):
    with zipfile.ZipFile(archive) as source:
        for entry in source.infolist():
            mode = entry.external_attr >> 16
            if stat.S_ISLNK(mode):
                raise ValueError('Archive links are not supported')
            total += entry.file_size
            if total > 2 * 1024 ** 3:
                raise ValueError('Archive is too large')
            output = target(entry.filename)
            if entry.is_dir():
                output.mkdir(parents=True, exist_ok=True)
            else:
                output.parent.mkdir(parents=True, exist_ok=True)
                with source.open(entry) as src, output.open('xb') as dst:
                    shutil.copyfileobj(src, dst)
elif tarfile.is_tarfile(archive):
    with tarfile.open(archive) as source:
        for entry in source:
            if not (entry.isdir() or entry.isfile()):
                raise ValueError('Archive links and devices are not supported')
            total += entry.size
            if total > 2 * 1024 ** 3:
                raise ValueError('Archive is too large')
            output = target(entry.name)
            if entry.isdir():
                output.mkdir(parents=True, exist_ok=True)
            else:
                output.parent.mkdir(parents=True, exist_ok=True)
                with source.extractfile(entry) as src, output.open('xb') as dst:
                    shutil.copyfileobj(src, dst)
else:
    raise ValueError('Unsupported archive format')
