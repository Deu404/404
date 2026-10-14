"""Check the shipped file inventory without reading untrusted model objects."""
import json
from pathlib import Path

from rf_common import ROOT, sha


def main():
    inventory = json.loads((ROOT / 'checksums.json').read_text())
    for info in inventory['files']:
        path = ROOT / info['path']
        if not path.is_file() or sha(path) != info['sha256']:
            raise RuntimeError(f'Missing or changed file: {info["path"]}')
    print(f'PASS: {len(inventory["files"])} packaged files match SHA-256 inventory')


if __name__ == '__main__':
    main()
