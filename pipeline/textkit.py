"""Small text helpers shared by the content checks. Plain Python, no extra packages."""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
BANK = ROOT / "content" / "bank"
MIN_WORDS = 25  # like check.py: shorter passages are signs, labels and tables

STOP = set("""
a an the and or but so if then than that this these those there here when while as at by for from in into of on onto off out over to up
down with without about after before again also just very too not no yes is am are was were be been being do does did done have has had
can could will would shall should may might must i me my we us our you your he him his she her it its they them their what which who whom
whose why how all any both each few more most other some such only own same s t don now new one two three first last next get got go went
say said says tell told one's let lets make made put took take came come comes went goes gone see saw seen look looked very really
""".split())

BACK = set("he she it they him her them his its their theirs this that these those there".split())
LINKS = set("then next later after afterward afterwards finally soon so but because when while meanwhile also still now first".split())


def tokens(text):
    return re.findall(r"[a-z]+(?:'[a-z]+)?", text.lower())


def stem(w):
    w = re.sub(r"'s$", "", w)
    for suf, rep, keep in (("ies", "y", 4), ("sses", "ss", 4), ("es", "", 4), ("s", "", 3), ("ing", "", 5), ("ed", "", 4), ("ly", "", 5)):
        if w.endswith(suf) and len(w) > keep and not (suf == "s" and w.endswith("ss")):
            return w[: -len(suf)] + rep
    return w


def content(text):
    """Content-word stems: the people and things a sentence is about."""
    return {stem(w) for w in tokens(text) if len(w) >= 3 and w not in STOP}


def refers_back(sentence):
    """A pronoun or a linking word ties a sentence to what came before."""
    ws = tokens(sentence)
    return bool(set(ws) & BACK) or (bool(ws) and ws[0] in LINKS)


def rows(p):
    """The rows evidence indexes point at: visual rows when a visual exists, else sentences (as validate.mjs)."""
    v = p.get("visual")
    if not v:
        return list(p["sentences"])
    t = v["type"]
    if t == "signs":
        return [s.get("text", "") for s in v["signs"]]
    if t == "table":
        return [" ".join(map(str, r)) for r in v["rows"]]
    if t in ("label", "form"):
        return [f'{r.get("k", "")} {r.get("v", "") or ""}' for r in v["rows"]]
    if t == "prompt":
        return list(v["rows"]) + list(v.get("buttons", []))
    return [r if isinstance(r, str) else json.dumps(r) for r in v.get("rows", [])]


def passage_text(p):
    v = p.get("visual") or {}
    return " ".join([*p["sentences"], v.get("title", "") or "", *rows(p)] if v else p["sentences"])


def is_prose(p):
    return len(tokens(" ".join(p["sentences"]))) >= MIN_WORDS


def load_bank(skills=()):
    files = sorted(f for f in BANK.glob("*.json") if not skills or f.stem in skills)
    return [json.loads(f.read_text(encoding="utf-8")) for f in files]
