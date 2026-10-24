"""Deploy the pinned AgentTeams package without changing workspace team state."""
import json
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path
from patch_profile import cmd_add, cmd_remove, cmd_sync_plugin, load

NAME = '@nanmicoder/dsh-agent-teams'

def main():
    action, home, profile, *args = sys.argv[1:]
    home = Path(home).resolve()
    if not re.fullmatch(r'[\w.-]+', profile) or profile in ('.', '..'):
        raise ValueError('Invalid profile')
    package = home / 'profiles' / profile / 'package.json'
    load(package)
    target = home / 'plugins' / NAME
    if target.is_symlink() or getattr(target, 'is_junction', lambda: False)():
        raise ValueError('Managed package directory must not be a link')
    if action == 'stage':
        source = Path(args[0]).resolve()
        manifest = load(source / 'package.json')
        if manifest.get('name') != NAME or not manifest.get('seagull', {}).get('updateManaged'):
            raise ValueError('Missing managed AgentTeams manifest')
        for file in ('LICENSE', 'cordis.patch.yml', 'lib/index.js', 'lib/command.js', 'lib/client.js'):
            if not (source / file).is_file():
                raise ValueError('Missing AgentTeams asset: ' + file)
        target.parent.mkdir(parents=True, exist_ok=True)
        staging = Path(tempfile.mkdtemp(prefix='.agent-teams-stage-', dir=target.parent))
        previous = staging.with_name(staging.name.replace('-stage-', '-previous-', 1))
        try:
            shutil.copytree(source, staging, dirs_exist_ok=True, ignore=shutil.ignore_patterns('node_modules', '.git'))
            for file in staging.rglob('*'):
                if file.is_file() and file.read_bytes() != (source / file.relative_to(staging)).read_bytes():
                    raise ValueError('AgentTeams staging verification failed')
            if target.exists():
                os.replace(target, previous)
            try:
                os.replace(staging, target)
                cmd_add(package, 'file:../../plugins/' + NAME, NAME)
            except OSError:
                if previous.exists() and not target.exists():
                    os.replace(previous, target)
                raise
        finally:
            if staging.exists() and staging.parent == target.parent:
                shutil.rmtree(staging)
        print('AgentTeams staged; existing team data retained')
    elif action == 'sync':
        return cmd_sync_plugin(home, profile, NAME)
    elif action == 'remove':
        if not target.is_dir() or not load(target / 'package.json').get('seagull', {}).get('updateManaged'):
            return 0
        cmd_remove(package, NAME)
        # Keep managed files and all workspace team archives for recovery.
        print('AgentTeams unmounted; files and workspace state retained')
    else:
        raise ValueError('Unknown managed AgentTeams operation')
    return 0

if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, ValueError) as error:
        print('AgentTeams setup failed: ' + str(error), file=sys.stderr)
        raise SystemExit(1)
