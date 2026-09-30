#!/usr/bin/env python3
"""Ekkorynd preflight and verify guard for static deploys.

This is a local fixture: it checks the build artifact before upload and probes
live paths that must not resolve. It does not authenticate to any remote host.
"""

import argparse
import os
import re
import sys
from pathlib import Path
from urllib.request import urlopen
from urllib.error import HTTPError

ALLOWED_EXTENSIONS = {
    '.html', '.htm', '.js', '.mjs', '.css', '.map',
    '.json', '.txt', '.xml', '.svg', '.png', '.jpg',
    '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2',
    '.ttf', '.otf', '.eot', '.webmanifest', '.wasm'
}

FORBIDDEN_PATTERNS = [
    re.compile(r'\.env(\.?|$)'),
    re.compile(r'\.git'),
    re.compile(r'\.cursor'),
    re.compile(r'node_modules'),
    re.compile(r'package-lock\.json'),
    re.compile(r'\.md$'),
    re.compile(r'\.ts$'),
    re.compile(r'deploy_guard\.py$'),
]

PROHIBITED_LIVE_PATHS = [
    '/.env',
    '/.git',
    '/deploy_guard.py',
    '/package.json',
    '/tsconfig.json',
    '/vite.config.ts',
]


def preflight(dist: Path) -> bool:
    ok = True
    for root, _dirs, files in os.walk(dist):
        for name in files:
            file_path = Path(root) / name
            rel = file_path.relative_to(dist)
            ext = file_path.suffix.lower()

            if any(p.search(str(rel)) for p in FORBIDDEN_PATTERNS):
                print(f"FORBIDDEN: {rel}")
                ok = False
                continue

            if ext not in ALLOWED_EXTENSIONS:
                print(f"UNEXPECTED EXTENSION: {rel}")
                ok = False

    if ok:
        print("Preflight passed: dist/ contains only expected web assets.")
    return ok


def verify(base_url: str) -> bool:
    ok = True
    for path in PROHIBITED_LIVE_PATHS:
        url = base_url.rstrip('/') + path
        try:
            with urlopen(url, timeout=10) as resp:
                if resp.status < 400:
                    print(f"EXPOSED: {path} returned {resp.status}")
                    ok = False
        except HTTPError as e:
            if e.code in (403, 404):
                continue
            print(f"VERIFY ERROR: {path} returned {e.code}")
            ok = False
        except Exception as e:
            print(f"VERIFY ERROR: {path} {e}")
            ok = False

    if ok:
        print("Verify passed: prohibited paths are not reachable.")
    return ok


def main() -> int:
    parser = argparse.ArgumentParser(description="Ekkorynd deploy guard")
    parser.add_argument('--preflight', action='store_true', help='Scan dist/ for forbidden files')
    parser.add_argument('--verify', metavar='URL', help='Probe live URL for prohibited paths')
    args = parser.parse_args()

    ok = True
    if args.preflight:
        ok = preflight(Path('dist')) and ok
    if args.verify:
        ok = verify(args.verify) and ok

    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
