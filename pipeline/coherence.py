"""Coherence check (LTF-16): flags sentences that share no people or things with what came before.

A sentence is linked when it shares a content word with the title or one of the two sentences before it,
or uses a pronoun or a linking word ("they", "then", "because"), or is a step in a set of instructions.
An unlinked sentence is a "break" when it shares nothing with anything earlier in the passage, and "weak"
when it only connects further back. Words match on a shared stem of four letters or more (camp, camper).
Short and visual passages are skipped, as in check.py.

Usage: python pipeline/coherence.py [SKILL ...]      python pipeline/coherence.py --tune
"""
import random
import sys

from textkit import content, is_prose, load_bank, refers_back, tokens

WINDOW = 2
STEP_VERBS = set("""add put pour stir mix fold cut press push pull turn open close wait check go take place set hang fill
lay tie plug unplug charge hold keep move use write draw read count measure look find bring wash dry clean cover
let shake tap click choose pick join meet start stop ask tell call leave remove repeat line""".split())


def overlap(a, b):
    if a & b:
        return True
    return any(len(x) >= 4 and len(y) >= 4 and (x.startswith(y) or y.startswith(x)) for x in a for y in b)


def is_step(sentence):
    ws = tokens(sentence)
    return bool(ws) and ws[0] in STEP_VERBS


def flags(p, title=True, prefix=True, steps=False):  # steps=False: on held-out tuning it cost more catches than it saved alarms
    if not is_prose(p):
        return []
    sents = p["sentences"]
    stems = [content(s) for s in sents]
    head = content(p.get("title", "")) if title else set()
    match = overlap if prefix else (lambda a, b: bool(a & b))
    seen, out = set(stems[0]) | head, []
    for i in range(1, len(sents)):
        near = set().union(head, *stems[max(0, i - WINDOW):i])
        linked = match(stems[i], near) or refers_back(sents[i]) or (steps and is_step(sents[i]))
        if not linked:
            out.append({"sentence": i, "tier": "weak" if match(stems[i], seen) else "break", "text": sents[i]})
        seen |= stems[i]
    return out


def tune(passages, rng=random.Random(11), **opts):
    """False alarms on unchanged passages, and catches of a sentence spliced in from another skill."""
    prose = [p for p in passages if is_prose(p)]
    alarms = sum(1 for p in prose if any(f["tier"] == "break" for f in flags(p, **opts)))
    caught = trials = 0
    for p in rng.sample(prose, min(300, len(prose))):
        donor = rng.choice([q for q in prose if q["id"][:2] != p["id"][:2]])
        at = rng.randrange(1, len(p["sentences"]) + 1)
        spliced = {**p, "sentences": p["sentences"][:at] + [rng.choice(donor["sentences"])] + p["sentences"][at:], "breaks": []}
        trials += 1
        caught += any(f["sentence"] == at and f["tier"] == "break" for f in flags(spliced, **opts))
    return alarms / len(prose), caught / trials


def main(args):
    if args == ["--TUNE"]:
        import json
        import pathlib
        gold_file = pathlib.Path(__file__).resolve().parent.parent / "evals" / "gold" / "gold-set.json"
        gold_ids = set(json.loads(gold_file.read_text())["passages"]) if gold_file.exists() else set()
        passages = [p for b in load_bank() for p in b["passages"] if p["id"] not in gold_ids]  # the gold set never tunes
        for name, opts in (("plain", dict(title=False, prefix=False, steps=False)), ("+title", dict(title=True, prefix=False, steps=False)),
                           ("+title +prefix", dict(title=True, prefix=True, steps=False)), ("+title +prefix +steps", dict(title=True, prefix=True, steps=True))):
            fa, det = tune(passages, **opts)
            print(f"{name:24} false alarms on unchanged passages {fa:.0%}, spliced sentences caught {det:.0%}")
        return 0
    total = 0
    for bank in load_bank(args):
        for p in bank["passages"]:
            for f in flags(p):
                total += f["tier"] == "break"
                print(f'{p["id"]} sentence {f["sentence"]} ({f["tier"]}): {f["text"]}')
    print(f"\n{total} possible break(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main([s.upper() for s in sys.argv[1:]]))
