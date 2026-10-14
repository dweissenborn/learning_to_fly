"""Scoring test set for typed answers (LTF-17): invented child-style answers, scored by two people, banded
clearly right, partly right or clearly wrong. Any scorer (a model in the bake-off) is judged against it.

  python evals/scoring/scoring.py pick            choose the 30 open questions (fixed seed), write questions.json
  python evals/scoring/scoring.py page            build rate.html from questions.json and answers.json
  python evals/scoring/scoring.py agree           compare the two people's ratings (ratings/*.json), write agreement.json
  python evals/scoring/scoring.py check FILE      judge a scorer's bands ({answer id: band}) against the two people

The answers are invented, never a real child's (the backlog's guard). rate.html never shows the band an answer was
written to be, so the ratings are blind. A scorer passes at 0.80 agreement in every band, not just overall (R18):
scorers slip on partly right answers and on answers people score differently, so both are reported on their own.
"""
import datetime
import html
import json
import pathlib
import random
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent / "pipeline"))

from textkit import load_bank, rows  # noqa: E402

QUESTIONS, ANSWERS, RATINGS, AGREEMENT, PAGE = (HERE / "questions.json", HERE / "answers.json", HERE / "ratings",
                                                HERE / "agreement.json", HERE / "rate.html")
BANDS = ["wrong", "partly", "right"]  # ordered, for weighted kappa
PASS = 0.80


# ---------------------------------------------------------------- agreement maths
def qwk(a, b):
    """Quadratic weighted kappa for two lists of bands."""
    n, k = len(a), len(BANDS)
    if not n:
        return 0.0
    x, y = [BANDS.index(v) for v in a], [BANDS.index(v) for v in b]
    w = lambda i, j: (i - j) ** 2 / (k - 1) ** 2
    obs = sum(w(i, j) for i, j in zip(x, y)) / n
    exp = sum(x.count(i) * y.count(j) * w(i, j) for i in range(k) for j in range(k)) / (n * n)
    return 1.0 if exp == 0 else 1 - obs / exp


def band_agreement(a, b):
    """Per band, how often two people agree when either of them chose it: 2 * both / (a's count + b's count)."""
    out = {}
    for band in BANDS:
        both = sum(1 for x, y in zip(a, b) if x == y == band)
        either = a.count(band) + b.count(band)
        out[band] = round(2 * both / either, 3) if either else None
    return out


def scorer_report(scores, ratings):
    """A scorer against two people. Agreed answers: per band, the share the scorer put in that band. Disputed answers:
    the share where the scorer matches one of the two people."""
    ids = sorted(set(scores) & set(ratings[0]) & set(ratings[1]))
    agreed = [i for i in ids if ratings[0][i] == ratings[1][i]]
    disputed = [i for i in ids if ratings[0][i] != ratings[1][i]]
    per_band = {}
    for band in BANDS:
        mine = [i for i in agreed if ratings[0][i] == band]
        per_band[band] = {"n": len(mine), "agreement": round(sum(scores[i] == band for i in mine) / len(mine), 3) if mine else None}
    report = {
        "n": len(ids),
        "per_band": per_band,
        "qwk": {f"vs {k}": round(qwk([scores[i] for i in ids], [ratings[k][i] for i in ids]), 3) for k in (0, 1)},
        "disputed": {"n": len(disputed), "matches_one": round(sum(scores[i] in (ratings[0][i], ratings[1][i]) for i in disputed) / len(disputed), 3) if disputed else None},
    }
    report["passes"] = all(v["agreement"] is not None and v["agreement"] >= PASS for v in per_band.values())
    return report


# ---------------------------------------------------------------- choosing the questions
def open_prompt(prompt):
    return re.sub(r"\s*Build your answer\.?$", "", prompt).strip()


def answer_text(it):
    if it.get("options") and isinstance(it.get("answer"), int):
        return it["options"][it["answer"]]
    return ""


def pick(seed=2026):
    """30 questions a typed answer suits: 10 feelings-and-why (P build), 8 why (N tap), 6 main idea, 6 what to do."""
    rng = random.Random(seed)
    banks = load_bank()
    passages = {p["id"]: p for b in banks for p in b["passages"]}
    items = [i for b in banks for i in b["items"]
             if not i.get("gatecheck") and not i.get("checkup") and i["id"] != b["model"]["item"] and i["passage"] in passages
             and not passages[i["passage"]].get("visual")]
    groups = [
        ("feeling-why", 10, lambda i: i["skill"][0] == "P" and i["format"] == "build" and i.get("tier") == "express" and "why" in i["prompt"].lower()),
        ("why", 8, lambda i: i["skill"][0] == "N" and i["format"] == "tap" and i["prompt"].startswith("Why") and answer_text(i)),
        ("main-idea", 6, lambda i: i["format"] == "tap" and "main-idea" in i.get("tags", []) and "mostly about" in i["prompt"] and answer_text(i)),
        ("what-to-do", 6, lambda i: i["skill"][0] == "F" and i["format"] == "tap" and "problem-solving" in i.get("tags", [])
         and re.search(r"What (should|can|could) \w+ do", i["prompt"]) and answer_text(i)),
    ]
    chosen, used_passages = [], set()
    for kind, n, ok in groups:
        pool = [i for i in items if ok(i) and i["passage"] not in used_passages]
        pool.sort(key=lambda i: i["id"])
        by_level = {}
        for i in pool:
            by_level.setdefault(i["level"], []).append(i)
        picks = []
        while len(picks) < n:  # round-robin over levels so every level is in the set
            before = len(picks)
            for lv in sorted(by_level):
                left = [i for i in by_level[lv] if i not in picks and i["passage"] not in used_passages]
                if left and len(picks) < n:
                    it = rng.choice(left)
                    picks.append(it)
                    used_passages.add(it["passage"])
            if len(picks) == before:
                sys.exit(f"Only {len(picks)} {kind} questions to choose from; {n} needed.")
        for it in picks:
            p = passages[it["passage"]]
            key = " ".join(x for x in (answer_text(it), it.get("explain", "")) if x)
            chosen.append({"id": it["id"], "kind": kind, "level": it["level"], "passage": p["id"], "title": p["title"],
                           "text": rows(p), "question": open_prompt(it["prompt"]), "key": key})
    QUESTIONS.write_text(json.dumps({"created": datetime.date.today().isoformat(), "seed": seed, "questions": chosen}, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(chosen)} questions written to {QUESTIONS.name}.")


# ---------------------------------------------------------------- the rating page
def page(seed=2026):
    qs = {q["id"]: q for q in json.loads(QUESTIONS.read_text(encoding="utf-8"))["questions"]}
    answers = json.loads(ANSWERS.read_text(encoding="utf-8"))["answers"]
    order = list(answers)
    random.Random(seed).shuffle(order)  # mixed, so neighbouring answers do not give each other away
    data = {"questions": qs, "answers": [{"id": a["id"], "question": a["question"], "text": a["text"]} for a in order]}  # never the intended band
    PAGE.write_text(TEMPLATE.replace("__DATA__", html.escape(json.dumps(data, ensure_ascii=False), quote=False).replace("</", "<\\/")), encoding="utf-8")
    print(f"{PAGE.name}: {len(order)} answers to rate.")


# ---------------------------------------------------------------- reports
def load_ratings():
    files = sorted(RATINGS.glob("*.json"))
    if len(files) != 2:
        sys.exit(f"Need exactly two people's ratings in {RATINGS}, found {len(files)}.")
    rs = [json.loads(f.read_text(encoding="utf-8")) for f in files]
    return [r["scores"] for r in rs], [r.get("rater") or f.stem for r, f in zip(rs, files)]


def agree():
    ratings, names = load_ratings()
    ids = sorted(set(ratings[0]) & set(ratings[1]))
    a, b = [ratings[0][i] for i in ids], [ratings[1][i] for i in ids]
    out = {"computed": datetime.datetime.now().isoformat(timespec="seconds"), "raters": names, "n": len(ids),
           "qwk": round(qwk(a, b), 3), "per_band": band_agreement(a, b),
           "disputed": [{"id": i, names[0]: ratings[0][i], names[1]: ratings[1][i]} for i in ids if ratings[0][i] != ratings[1][i]]}
    AGREEMENT.write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8")
    print(f"{len(ids)} answers rated by both. QWK {out['qwk']}. Per band: {out['per_band']}. {len(out['disputed'])} scored differently.")


def check(path):
    ratings, _ = load_ratings()
    scores = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    bad = {k: v for k, v in scores.items() if v not in BANDS}
    if bad:
        sys.exit(f"Bands must be one of {BANDS}: {list(bad)[:5]}")
    r = scorer_report(scores, ratings)
    print(json.dumps(r, indent=1))
    sys.exit(0 if r["passes"] else 1)


TEMPLATE = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Score typed answers</title>
<style>
:root { color-scheme: light dark; --bg: #f7f4ee; --card: #fffdf8; --ink: #1d2b3a; --muted: #5b6672; --line: #d9d2c4; --accent: #2f6f99; }
@media (prefers-color-scheme: dark) { :root { --bg: #1b2028; --card: #252b35; --ink: #e8e4dc; --muted: #a5adb8; --line: #3a4250; --accent: #8cc4ec; } }
body { margin: 0; background: var(--bg); color: var(--ink); font: 17px/1.5 system-ui, sans-serif; }
main { max-width: 820px; margin: 0 auto; padding: 16px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; margin: 14px 0; }
.muted { color: var(--muted); }
.bar { position: sticky; top: 0; background: var(--bg); padding: 8px 0; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; z-index: 1; }
button { font: inherit; padding: 6px 14px; border-radius: 8px; border: 1px solid var(--accent); background: var(--accent); color: var(--bg); cursor: pointer; }
details { margin: 6px 0; } summary { cursor: pointer; color: var(--accent); }
.answer { font-size: 1.15rem; padding: 8px 12px; border-left: 4px solid var(--accent); margin: 10px 0; white-space: pre-wrap; }
fieldset { border: 0; padding: 0; margin: 0; display: flex; gap: 18px; flex-wrap: wrap; }
input[type=text] { font: inherit; padding: 4px 8px; }
</style></head><body><main>
<h1>Score typed answers</h1>
<p class="muted">Two people score the same answers on their own, without comparing notes. Each answer was made up to sound like a child typing; none is a real child's.
Score what the answer says about the question, not its spelling. Do not open <code>answers.json</code> until you are done: it says which band each answer was written to be. Your scores save in this browser as you go. When done, press <b>Download scores</b>
and save the file in <code>evals/scoring/ratings/</code>.</p>
<div class="card"><b>Clearly right</b>: it has what the question asks for (for a "why" question, a reason the story supports; for a feeling, the feeling and why).<br>
<b>Partly right</b>: some of it, for example the feeling without a reason, a reason the story does not support, or too vague to tell.<br>
<b>Clearly wrong</b>: it misses or contradicts the story, is about something else, or gives no answer.</div>
<div class="bar"><label>Your name <input type="text" id="who" autocomplete="off"></label><span id="progress"></span><button id="dl">Download scores</button>
<label><input type="file" id="up" accept="application/json" hidden><span class="muted" style="text-decoration:underline;cursor:pointer">Load saved scores</span></label></div>
<div id="list"></div>
<script id="data" type="application/json">__DATA__</script>
<script>
const D = JSON.parse(document.getElementById('data').textContent);
const KEY = 'ltf-scoring-ratings';
let R = { rater: '', scores: {} };
try { R = JSON.parse(localStorage.getItem(KEY)) || R; } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(R)); } catch (e) {} progress(); };
const el = (t, a = {}, ...kids) => { const n = document.createElement(t); for (const [k, v] of Object.entries(a)) k === 'text' ? n.textContent = v : n.setAttribute(k, v); n.append(...kids); return n; };
const who = document.getElementById('who'); who.value = R.rater; who.oninput = () => { R.rater = who.value.trim(); save(); };
function progress() { document.getElementById('progress').textContent = `${Object.keys(R.scores).length} of ${D.answers.length} scored`; }
D.answers.forEach((a, n) => {
  const q = D.questions[a.question];
  const card = el('article', { class: 'card', id: a.id }, el('h3', { text: `${n + 1}. ${q.title}` }));
  const story = el('details', {}, el('summary', { text: 'The text' }));
  q.text.forEach((s) => story.append(el('div', { text: s })));
  card.append(story, el('p', {}, el('b', { text: q.question })));
  card.append(el('details', {}, el('summary', { text: 'What a full answer has' }), el('p', { text: q.key })));
  card.append(el('div', { class: 'answer', text: a.text }));
  const fs = el('fieldset', {}, el('legend', { class: 'muted', text: 'Score' }));
  [['right', 'Clearly right'], ['partly', 'Partly right'], ['wrong', 'Clearly wrong']].forEach(([v, t]) => {
    const id = `${a.id}-${v}`, rb = el('input', { type: 'radio', name: a.id, id, value: v });
    rb.checked = R.scores[a.id] === v; rb.onchange = () => { R.scores[a.id] = v; save(); };
    fs.append(el('div', {}, rb, el('label', { for: id, text: ' ' + t })));
  });
  card.append(fs); document.getElementById('list').append(card);
});
document.getElementById('dl').onclick = () => {
  if (!R.rater) { alert('Add your name first, so the two sets of scores stay apart.'); who.focus(); return; }
  R.ratedAt = new Date().toISOString();
  const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(R, null, 1)], { type: 'application/json' })), download: `ratings-${R.rater.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json` });
  document.body.append(a); a.click(); a.remove();
};
document.getElementById('up').onchange = async (e) => { const f = e.target.files[0]; if (f) { R = JSON.parse(await f.text()); save(); location.reload(); } };
progress();
</script></main></body></html>
"""

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "pick":
        pick()
    elif cmd == "page":
        page()
    elif cmd == "agree":
        agree()
    elif cmd == "check" and len(sys.argv) > 2:
        check(sys.argv[2])
    else:
        print(__doc__)
