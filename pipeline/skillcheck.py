"""Skill checks (LTF-16): each item's inference level and tags, and near-duplicate passages.

- Inference: for tap and scene items, how much of the right answer's wording is in the text. All of it in one
  evidence row reads as "stated" (0), spread over rows or elsewhere in the text as "joined" (1), mostly absent as
  "needs knowledge or feelings" (2). Only a gap of two (0 against 2) is flagged; one step apart is a judgement call.
- Tags: the school-goal tags must fit the question (content-guide.md), and plan-change needs a change in the text.
- Near-duplicates: passages whose content words overlap so much that one may be the other reworded.

Thresholds were set on the bank with the gold set left out (tuning_passages, `--tune`); the gold set only measures them.

Usage: python pipeline/skillcheck.py [SKILL ...]      python pipeline/skillcheck.py --tune
"""
import itertools
import random
import re
import sys

from textkit import content, load_bank, passage_text, rows

NEAR_DUP = 0.5  # Jaccard of content words; reworded copies sit well above, different texts on one topic well below
MIN_CONTENT = 12  # too few content words to compare fairly

MAIN = re.compile(r"mostly about|main idea|main point|central idea|best title|title (fits|would)|what the whole|whole (story|text|article|passage)|big idea|most important idea|what lesson|the lesson (of|in|is|does)|(say|says|suggest|suggests|teach|teaches|show|shows) about", re.I)
KEY = re.compile(r"most important|which detail|detail|supports?|important|key|matters most|extra|retell", re.I)
FIX = re.compile(r"fix|solv|solution|what else|instead|plan|should|could|how (can|did|do|does|will)|try|idea|option|choose|chose|decide|best|help|work|safe|problem|good thing|limit|test", re.I)
CHANGE = re.compile(r"\b(cancel\w*|mov(e|es|ed|ing)|postpon\w*|reschedul\w*|instead|chang\w*|new|different|replac\w*|detour|no longer|not run\w*|won't|can't|cannot|only|except|special|early|extra|rain\w*|wind\w*|snow\w*|ice|fog\w*|storm\w*|heat|closed|shut|delay\w*|late|broke\w*|broken|flat|lost|forgot|wrong|stuck|switch\w*|full|sold out|sick|missed)\b", re.I)


def answer_text(item):
    if item["format"] == "tap" and item.get("options"):
        return item["options"][item["answer"]]
    if item["format"] == "scene" and item.get("objects"):
        # Only the sign is read; a label like "Middle door" names a place on screen, not words in the text.
        picks = item["answer"] if isinstance(item["answer"], list) else [item["answer"]]
        return " ".join((item["objects"][k].get("sign") or {}).get("text", "") for k in picks)
    return None


def predict_inference(item, p):
    ans = answer_text(item)
    a = content(ans) if ans else set()
    if not a:
        return None
    rs = rows(p)
    ev = [content(rs[i]) for i in item.get("evidence", []) if i < len(rs)]
    in_one = max((len(a & e) / len(a) for e in ev), default=0)
    if any(e and e <= a for e in ev):  # every word of a short row (a sign: PULL, STOP) is in the answer
        return 0
    in_ev = len(a & set().union(*ev)) / len(a) if ev else 0
    in_text = len(a & content(passage_text(p))) / len(a)
    if in_one >= 0.75:
        return 0
    if in_ev >= 0.75 or in_text >= 0.75:
        return 1
    return 2


def inference_flags(item, p):
    pred, lab = predict_inference(item, p), item.get("inference")
    if pred is None or lab is None or abs(pred - lab) < 2:
        return []
    say = {0: "stated in the text", 1: "joined from two parts", 2: "needs knowledge or feelings"}
    return [f"marked {lab} ({say[lab]}), but the answer reads as {say[pred]}"]


def item_words(item):
    parts = [item.get("prompt", ""), item.get("frame", ""), *item.get("bins", []), *[c.get("text", "") if isinstance(c, dict) else str(c) for c in item.get("cards", [])]]
    return " ".join(x for x in parts if x)


def tag_flags(item, p):
    tags, words, out = set(item.get("tags", [])), item_words(item), []
    if "main-idea" in tags and not MAIN.search(words):
        out.append(("main-idea", "tagged main-idea, but the question is not about what the text is mostly about"))
    asks_main = MAIN.search(item.get("prompt", "")) and "detail" not in item.get("prompt", "").lower()
    if "main-idea" not in tags and asks_main and not tags & {"key-detail", "lesson", "idiom", "moral"}:
        out.append(("main-idea", "asks what the text is mostly about, but has no main-idea tag"))
    if "key-detail" in tags and not KEY.search(words):
        out.append(("key-detail", "tagged key-detail, but the question does not ask which detail matters"))
    if "problem-solving" in tags:
        if item.get("level", 3) < 3:
            out.append(("problem-solving", "problem-solving is for levels 3 to 5"))
        elif not FIX.search(words):
            out.append(("problem-solving", "tagged problem-solving, but the question is not about fixing a problem"))
    # In reading-to-do skills the change often sits in the question's situation ("It is 4:35 PM..."), so read both.
    scene_text = passage_text(p) + (" " + item.get("prompt", "") if item["skill"].startswith("F") else "")
    if "plan-change" in tags and not CHANGE.search(scene_text):
        out.append(("plan-change", "tagged plan-change, but no plan changes in the text"))
    return out


def near_duplicates(passages, threshold=NEAR_DUP):
    sets = [(p["id"], content(passage_text(p))) for p in passages]
    sets = [(i, s) for i, s in sets if len(s) >= MIN_CONTENT]
    out = []
    for (a, sa), (b, sb) in itertools.combinations(sets, 2):
        j = len(sa & sb) / len(sa | sb)
        if j >= threshold:
            out.append((a, b, round(j, 2)))
    return out


def tuning_passages(passages, gold_ids):
    """The gold set never tunes a check: tuning uses every other passage."""
    return [p for p in passages if p["id"] not in gold_ids]


def tune(passages, rng=random.Random(7)):
    """Near-duplicate threshold: reworded copies (sentences shuffled, a third of the words dropped) against different texts."""
    prose = [p for p in passages if len(content(passage_text(p))) >= MIN_CONTENT]
    copies, others = [], []
    for p in rng.sample(prose, min(200, len(prose))):
        words = passage_text(p).split()
        kept = [w for w in words if rng.random() > 0.33]
        a, b = content(passage_text(p)), content(" ".join(kept))
        copies.append(len(a & b) / len(a | b))
        q = rng.choice(prose)
        if q is not p:
            c = content(passage_text(q))
            others.append(len(a & c) / len(a | c))
    copies.sort(), others.sort()
    print(f"reworded copies: lowest {copies[0]:.2f}, 5th percentile {copies[len(copies) // 20]:.2f}")
    print(f"different texts: 95th percentile {others[len(others) * 19 // 20]:.2f}, highest {others[-1]:.2f}")


def all_flags(banks):
    out = []
    for bank in banks:
        passages = {p["id"]: p for p in bank["passages"]}
        for it in bank["items"]:
            p = passages[it["passage"]]
            for msg in inference_flags(it, p):
                out.append({"check": "inference", "id": it["id"], "key": it["id"], "message": msg})
            for tag, msg in tag_flags(it, p):
                out.append({"check": "tags", "id": it["id"], "key": f'{it["id"]}:{tag}', "message": msg})
    every = [p for bank in banks for p in bank["passages"]]
    for a, b, j in near_duplicates(every):
        out.append({"check": "near-duplicate", "id": a, "key": f"{a}|{b}", "message": f"{a} and {b} share {j:.0%} of their content words"})
    return out


def main(args):
    if args == ["--TUNE"]:
        import json
        import pathlib
        gold_file = pathlib.Path(__file__).resolve().parent.parent / "evals" / "gold" / "gold-set.json"
        gold_ids = set(json.loads(gold_file.read_text())["passages"]) if gold_file.exists() else set()
        tune(tuning_passages([p for b in load_bank() for p in b["passages"]], gold_ids))
        return 0
    flags = all_flags(load_bank(args))
    for f in flags:
        print(f'{f["check"]}: {f["id"]}: {f["message"]}')
    print(f"\n{len(flags)} flag(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main([s.upper() for s in sys.argv[1:]]))
