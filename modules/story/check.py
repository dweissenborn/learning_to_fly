"""Reading-level check for the story book: every page, in every version a choice can make, inside the book's band.

Usage: pipeline/.venv/Scripts/python modules/story/check.py [-v]
"""
import itertools
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / "pipeline"))
from check import check_passages  # noqa: E402

BOOK = json.loads((HERE / "src" / "book.json").read_text(encoding="utf-8"))


def versions(texts):
    """Each way a page can read: (label, sentences) for every mix of the picks it depends on."""
    flat = " ".join(t if isinstance(t, str) else " ".join(v for k, v in t.items() if k != "by") for t in texts)
    keys = sorted({t["by"] for t in texts if isinstance(t, dict)} | ({"koala"} if "{koala}" in flat else set()))
    for combo in itertools.product(*(BOOK["picks"][k] for k in keys)):
        picks = dict(zip(keys, combo))
        yield "/".join(combo), [(t if isinstance(t, str) else t[picks[t["by"]]]).replace("{koala}", picks.get("koala", "")).replace("{guide}", "Rook") for t in texts]


def main():
    passages = [{"id": f"c{c + 1}p{p + 1} {label}".strip(), "level": BOOK["level"], "sentences": sentences}
                for c, ch in enumerate(BOOK["chapters"]) for p, page in enumerate(ch["pages"]) for label, sentences in versions(page["text"])]
    problems, notes, rows = check_passages(passages)
    if "-v" in sys.argv:  # every page's numbers, and the notes on pages easier than the band
        print("\n".join(rows))
        for n in notes:
            print("  note:", n)
    for p in problems:
        print("  FAIL:", p)
    print(f"Story: {len(problems)} page problem(s)." if problems else f"Story OK: all {len(passages)} page versions of the story are inside level {BOOK['level']}.")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
