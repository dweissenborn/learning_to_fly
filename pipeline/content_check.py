"""content:check (LTF-16): the reading-level check, coherence, and the skill checks together.

The reading-level check blocks as it always has. The new checks report every flag, but a flag only fails
the build when it is new (not in pipeline/baseline.json) AND that check has passed its gold-set agreement
(evals/gold/agreement.json). Until DW's ratings show a check agrees with a person, it only warns.

Usage: python pipeline/content_check.py               check everything
       python pipeline/content_check.py --baseline    accept today's flags as known (after review)
"""
import json
import pathlib
import sys

import check
import coherence
import skillcheck
from textkit import load_bank

HERE = pathlib.Path(__file__).resolve().parent
BASELINE = HERE / "baseline.json"
AGREEMENT = HERE.parent / "evals" / "gold" / "agreement.json"


def coherence_flags(banks):
    return [{"check": "coherence", "id": p["id"], "key": f'{p["id"]}:{f["sentence"]}', "message": f'sentence {f["sentence"]} ({f["tier"]}): {f["text"]}', "tier": f["tier"]}
            for b in banks for p in b["passages"] for f in coherence.flags(p)]


def all_flags(banks):
    # A weak link is only a note; a break (shares nothing with anything earlier) is a flag.
    return [f for f in coherence_flags(banks) if f["tier"] == "break"] + skillcheck.all_flags(banks)


def new_flags(flags, baseline=BASELINE):
    known = json.loads(pathlib.Path(baseline).read_text()) if pathlib.Path(baseline).exists() else {}
    return [f for f in flags if f["key"] not in set(known.get(f["check"], []))]


def exit_code(new, agreement):
    return 1 if any(agreement.get(f["check"], {}).get("passed") for f in new) else 0


def main(args):
    reading = check.main([])
    banks = load_bank()
    flags = all_flags(banks)
    if args == ["--baseline"]:
        keys = {}
        for f in flags:
            keys.setdefault(f["check"], []).append(f["key"])
        BASELINE.write_text(json.dumps({k: sorted(v) for k, v in sorted(keys.items())}, indent=1) + "\n")
        print(f"Baseline written: {len(flags)} known flag(s).")
        return reading
    agreement = json.loads(AGREEMENT.read_text()) if AGREEMENT.exists() else {}
    new = new_flags(flags)
    print("\nContent checks (LTF-16):")
    for name in ("coherence", "inference", "tags", "near-duplicate"):
        mine = [f for f in flags if f["check"] == name]
        fresh = [f for f in new if f["check"] == name]
        mode = "blocks new problems" if agreement.get(name, {}).get("passed") else "warns only, until it agrees with the gold set"
        print(f"  {name}: {len(mine)} flag(s), {len(fresh)} new; {mode}")
        for f in fresh:
            print(f'    NEW {f["id"]}: {f["message"]}')
    code = exit_code(new, agreement)
    return reading or code


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
