#!/usr/bin/env python3
"""Download the OpenMoji colour SVGs used by Adjectivia into src/icons/.

Usage:  python tools/fetch_icons.py
Icons are cached; already-downloaded files are skipped. Codes come from
src/words.txt (icon column) plus the EXTRA list below (avatars, UI, categories).
OpenMoji — https://openmoji.org — licence CC BY-SA 4.0.
"""
import concurrent.futures
import pathlib
import re
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
ICONS = ROOT / "src" / "icons"
VERSION = "15.0.0"
URL = "https://cdn.jsdelivr.net/npm/openmoji@%s/color/svg/{code}.svg" % VERSION

# avatars, mascot, UI, category icons
EXTRA = """
1F98A 1F43C 1F42F 1F438 1F984 1F427 1F436 1F431 1F435 1F430 1F419 1F428
1F989 1F3C6 1F947 1F948 1F949 1F451 1F525 2B50 1F389 1F4DE 1F465 23F1 23F3 1F500
1F340 1F3B2 1F50A 1F507 1F4A1 2753 1F9E0 1F4DA 1F9E9 1F3AF 1F4B0 1FA99 1F680 1F3A4
1F3AE 1F3AA 1F380 1F4AC 2699 1F464 1F44F 1F3AD 1F50E 1F388 1F3C1 1F4CA 1F4D6 1F3B5
1F9B8 1F443 23F0 1F308 1F326 1F60E 1F604 1F622 1F620 1F628 1F62E 1F912 1F483 1F418
2705 274C 1F44D 1F44E 1F4AA 1F31F 1F4E3 2194 1F501 25B6 23ED 23EE 1F504 1F3C3 1F4DD
1F5E3 1F910 1F648 1F64B 1F9D1 2615 1F4A5 1F3B6 1F6D1 1F3C5 1F396 1F4A3 1F9CA
"""


def codes():
    out = set(re.findall(r"[0-9A-F]{4,6}", EXTRA))
    for js in (ROOT / "src" / "js").glob("*.js"):       # every quoted hex code used by the code
        out |= set(re.findall(r"""['"]([0-9A-F]{4,6})['"]""", js.read_text(encoding="utf-8")))
    for line in (ROOT / "src" / "words.txt").read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        parts = line.split("|")
        if len(parts) >= 5 and parts[4].strip():
            out.add(parts[4].strip().rstrip("*").upper())
    return sorted(out)


def fetch(code):
    dest = ICONS / (code + ".svg")
    if dest.exists() and dest.stat().st_size > 0:
        return code, "cached"
    try:
        with urllib.request.urlopen(URL.format(code=code), timeout=30) as r:
            dest.write_bytes(r.read())
        return code, "ok"
    except Exception as e:  # noqa
        return code, "MISSING (%s)" % e


def main():
    ICONS.mkdir(parents=True, exist_ok=True)
    cs = codes()
    missing = []
    with concurrent.futures.ThreadPoolExecutor(8) as ex:
        for code, st in ex.map(fetch, cs):
            if st.startswith("MISSING"):
                missing.append((code, st))
    print("%d icons requested, %d missing" % (len(cs), len(missing)))
    for m in missing:
        print("  ", *m)
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
