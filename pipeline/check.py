"""Reading-level check for content/bank.

Fails a passage that is longer or harder than its level band. Text that is easier than
the band is only reported, since easy text never blocks a struggling reader.

Usage: pipeline/.venv/Scripts/python pipeline/check.py [SKILL ...]
"""
import json
import pathlib
import sys

import textstat

BANK = pathlib.Path(__file__).resolve().parent.parent / "content" / "bank"
# level: (min words, max words, max average sentence length, min grade, max grade)
BANDS = {1: (25, 70, 10, 0.5, 2.5), 2: (50, 120, 13, 1.5, 3.5), 3: (80, 180, 16, 2.5, 5.0)}
MIN_WORDS = 25  # shorter passages are signs, labels and tables


def check(path):
    problems, notes, rows = [], [], []
    for p in json.loads(path.read_text(encoding="utf-8"))["passages"]:
        text = " ".join(p["sentences"])
        n = textstat.lexicon_count(text)
        if n < MIN_WORDS:
            continue
        lo_w, hi_w, hi_s, lo_g, hi_g = BANDS[p["level"]]
        grade = textstat.flesch_kincaid_grade(text)
        avg = n / max(1, len(p["sentences"]))
        rows.append(f'  {p["id"]:<10} L{p["level"]} words={n:<4} avg={avg:4.1f} grade={grade:4.1f}')
        if n > hi_w:
            problems.append(f'{p["id"]}: {n} words, level {p["level"]} allows {hi_w}')
        if n < lo_w:
            notes.append(f'{p["id"]}: {n} words is short for level {p["level"]}')
        if avg > hi_s:
            problems.append(f'{p["id"]}: average sentence {avg:.1f} words, level {p["level"]} allows {hi_s}')
        if grade > hi_g:
            problems.append(f'{p["id"]}: grade {grade:.1f}, level {p["level"]} allows {hi_g}')
        if grade < lo_g:
            notes.append(f'{p["id"]}: grade {grade:.1f} is easy for level {p["level"]}')
    return problems, notes, rows


def main(skills):
    files = sorted(f for f in BANK.glob("*.json") if not skills or f.stem in skills)
    failed = 0
    for f in files:
        problems, notes, rows = check(f)
        print(f"{f.stem}: {len(rows)} prose passages measured")
        print("\n".join(rows))
        for n in notes:
            print("  note:", n)
        for p in problems:
            print("  FAIL:", p)
        failed += len(problems)
    print(f"\n{failed} passage problem(s)." if failed else "\nOK: every prose passage is inside its band.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main([s.upper() for s in sys.argv[1:]]))
