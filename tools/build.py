#!/usr/bin/env python3
"""Build Adjectivia: src/ -> index.html (a single self-contained file).

Usage:  python tools/build.py
What it does
  1. parses src/words.txt, validates it and turns it into the WORDS_DATA array;
  2. inlines only the OpenMoji icons that are actually referenced (minified);
  3. concatenates src/js/*.js, src/style.css and src/template.html into index.html.
Exit code 1 if the vocabulary has errors.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
CATS = {"joy", "sad", "angry", "fear", "feel", "body", "trait", "look", "size", "quality", "sense", "world", "colour", "weather"}


def parse_words():
    rows, errors, warns = [], [], []
    seen = set()
    for n, line in enumerate((SRC / "words.txt").read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip() or line.startswith("#"):
            continue
        p = [x.strip() for x in line.split("|")]
        if len(p) != 9:
            errors.append("line %d: expected 9 fields, found %d (%s)" % (n, len(p), p[0]))
            continue
        w, ca, cat, lvl, icon, syn, opp, d, ex = p
        if w in seen:
            errors.append("line %d: duplicate word %s" % (n, w))
        seen.add(w)
        if cat not in CATS:
            errors.append("line %d: unknown category %s" % (n, cat))
        if lvl not in ("1", "2", "3"):
            errors.append("line %d: bad level %s" % (n, lvl))
        if not re.search(r"(?<![A-Za-z-])" + re.escape(w) + r"(?![A-Za-z-])", ex, re.I):
            errors.append("line %d: example does not contain '%s'" % (n, w))
        if re.search(r"(?<![A-Za-z-])" + re.escape(w) + r"(?![A-Za-z-])", d, re.I):
            errors.append("line %d: definition contains '%s'" % (n, w))
        face = icon.endswith("*")
        icon = icon.rstrip("*").upper()
        rows.append({"w": w, "ca": ca, "c": cat, "l": int(lvl), "i": icon, "f": face,
                     "s": [x.strip() for x in syn.split(",") if x.strip()], "o": [x.strip() for x in opp.split(",") if x.strip()], "d": d, "e": ex})
    names = {r["w"] for r in rows}
    unknown = 0
    for r in rows:
        for key in ("s", "o"):
            keep = [x for x in r[key] if x in names]
            unknown += len(r[key]) - len(keep)
            r[key] = keep
    defs = {}
    for r in rows:
        if r["d"] in defs:
            errors.append("duplicate definition: %s / %s" % (defs[r["d"]], r["w"]))
        defs[r["d"]] = r["w"]
    if unknown:
        warns.append("%d synonym/opposite references to words outside the list were dropped" % unknown)
    return rows, errors, warns


def parse_gaps(rows):
    errors, gaps = [], []
    names = {r["w"]: r for r in rows}
    syn = {r["w"]: set(r["s"]) for r in rows}
    for r in rows:                                  # make synonym links symmetric
        for x in r["s"]:
            syn[x].add(r["w"])
    seen = set()
    for n, line in enumerate((SRC / "gaps.txt").read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip() or line.startswith("#"):
            continue
        p = [x.strip() for x in line.split("|")]
        if len(p) != 4:
            errors.append("gaps line %d: expected 4 fields" % n); continue
        w, sent, hard, easy = p
        hard = [x for x in hard.split(",") if x]; easy = [x for x in easy.split(",") if x]
        if w not in names: errors.append("gaps line %d: unknown word %s" % (n, w)); continue
        if w in seen: errors.append("gaps line %d: duplicate %s" % (n, w))
        seen.add(w)
        if sent.count("___") != 1: errors.append("gaps %s: need exactly one ___" % w)
        if re.search(r"(?<![A-Za-z])[Aa]n? ___", sent): errors.append("gaps %s: a/an right before the gap gives the answer away" % w)
        if re.search(r"(?<![A-Za-z-])" + re.escape(w) + r"(?![A-Za-z-])", sent, re.I): errors.append("gaps %s: the sentence contains the answer" % w)
        close = set(syn[w])
        for x in list(close):
            close |= syn.get(x, set())
        for x in hard + easy:
            if x not in names: errors.append("gaps %s: unknown wrong answer %s" % (w, x))
            elif x == w or x in close: errors.append("gaps %s: wrong answer %s is a synonym" % (w, x))
        if len(hard) < 2 or len(easy) < 3: errors.append("gaps %s: need 2 hard + 3 easy wrong answers" % w)
        gaps.append({"w": w, "s": sent, "h": hard, "e": easy})
    return gaps, errors


def minify_svg(s):
    s = re.sub(r"<\?xml[^>]*\?>", "", s)
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    # no icon uses gradients, masks or clip paths, so ids carry no meaning and would only be duplicated in the page
    s = re.sub(r'\s(id|xmlns|xmlns:xlink|version|xml:space|enable-background)="[^"]*"', "", s)
    s = re.sub(r"<g\s*/>", "", s)
    s = re.sub(r">\s+<", "><", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def main():
    rows, errors, warns = parse_words()
    gaps, gerr = parse_gaps(rows)
    errors += gerr
    js_files = sorted((SRC / "js").glob("*.js"))
    js = "\n".join(f.read_text(encoding="utf-8") for f in js_files)

    # icons: every quoted hex code in the code + the words file that has an SVG in the cache
    codes = set(re.findall(r"""['"]([0-9A-F]{4,6})['"]""", js))
    codes |= {r["i"] for r in rows if r["i"]}
    have = {p.stem for p in (SRC / "icons").glob("*.svg")}
    used = sorted(c for c in codes if c in have)
    for r in rows:
        if r["i"] and r["i"] not in have:
            errors.append("icon %s of '%s' is not downloaded (run tools/fetch_icons.py)" % (r["i"], r["w"]))
    for m in re.finditer(r"""ico\(\s*['"]([0-9A-F]{4,6})['"]""", js):
        if m.group(1) not in have:
            errors.append("code uses icon %s which is not downloaded" % m.group(1))
    icons = {c: minify_svg((SRC / "icons" / (c + ".svg")).read_text(encoding="utf-8")) for c in used}

    for w in warns:
        print("note:", w)
    if errors:
        print("\n%d ERROR(S):" % len(errors))
        for e in errors:
            print("  -", e)
        return 1

    words_js = "const WORDS_DATA = " + json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + ";"
    gaps_js = "const GAPS_DATA = " + json.dumps(gaps, ensure_ascii=False, separators=(",", ":")) + ";"
    icons_js = "const ICONS = " + json.dumps(icons, separators=(",", ":")) + ";"
    html = (SRC / "template.html").read_text(encoding="utf-8")
    css = (SRC / "style.css").read_text(encoding="utf-8")
    # use a function for the replacement so backslashes in the code are never treated as escapes
    html = html.replace("/*@@CSS@@*/", css).replace("/*@@WORDS@@*/", words_js + "\n" + gaps_js).replace("/*@@ICONS@@*/", icons_js)
    html = html.replace("/*@@JS@@*/", js.replace("</script", "<\\/script"))
    out = ROOT / "index.html"
    out.write_text(html, encoding="utf-8", newline="\n")
    print("Built %s: %d words, %d gap sentences, %d icons, %d KB" % (out.name, len(rows), len(gaps), len(icons), out.stat().st_size // 1024))
    return 0


if __name__ == "__main__":
    sys.exit(main())
