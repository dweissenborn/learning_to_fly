"""Gold set for the content checks (LTF-16): DW rates it by hand; the checks must agree before they can block.

  python evals/gold/gold.py pick     choose 30 passages and 60 items (fixed seed), write gold-set.json and rate.html
  python evals/gold/gold.py agree    score the checks against ratings.json, write agreement.json

The gold set is never used to tune a check (see skillcheck.tuning_passages). rate.html shows no checker output and
no inference labels, so the ratings are blind. A check may block new problems only when, on the gold set, it reaches
Cohen's kappa >= 0.6 (substantial agreement) and precision >= 0.8 (few false alarms), on at least 20 rated cases.
"""
import datetime
import html
import json
import pathlib
import random
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent / "pipeline"))

import coherence  # noqa: E402
import skillcheck  # noqa: E402
from textkit import content, is_prose, load_bank, passage_text, rows  # noqa: E402

GOLD, RATINGS, AGREEMENT, PAGE = HERE / "gold-set.json", HERE / "ratings.json", HERE / "agreement.json", HERE / "rate.html"
KAPPA, PRECISION, MIN_N = 0.6, 0.8, 20
GOALS = ["main-idea", "key-detail", "problem-solving", "plan-change"]


# ---------------------------------------------------------------- agreement maths
def kappa(a, b):
    """Cohen's kappa for two raters' labels over the same cases."""
    n = len(a)
    if not n:
        return 0.0
    po = sum(x == y for x, y in zip(a, b)) / n
    cats = set(a) | set(b)
    pe = sum((a.count(c) / n) * (b.count(c) / n) for c in cats)
    return 1.0 if pe == 1 else (po - pe) / (1 - pe)


def binary_metrics(checker, rater):
    tp = sum(1 for c, r in zip(checker, rater) if c and r)
    flagged, real = sum(map(bool, checker)), sum(map(bool, rater))
    return {"n": len(rater), "kappa": round(kappa([bool(x) for x in checker], [bool(x) for x in rater]), 3),
            "precision": tp / flagged if flagged else None, "recall": tp / real if real else None, "flagged": flagged, "real": real}


def passes(m):
    return m["n"] >= MIN_N and m["kappa"] >= KAPPA and m["precision"] is not None and m["precision"] >= PRECISION


# ---------------------------------------------------------------- choosing the gold set
def pick(seed=2026):
    rng = random.Random(seed)
    banks = load_bank()
    everything = [p for b in banks for p in b["passages"]]
    prose = [p for p in everything if is_prose(p)]
    chosen = []
    for strand, n in (("f", 8), ("n", 14), ("p", 8)):
        pool = [p for p in prose if p["id"][0] == strand]
        by_level = {}
        for p in pool:
            by_level.setdefault(p["level"], []).append(p)
        picks = []
        while len(picks) < n:  # round-robin over levels so every level is in the set
            for lv in sorted(by_level):
                left = [p for p in by_level[lv] if p not in picks]
                if left and len(picks) < n:
                    picks.append(rng.choice(left))
        chosen += picks
    sets = {p["id"]: content(passage_text(p)) for p in everything}
    neighbors = {}
    for p in chosen:
        a = sets[p["id"]]
        best = max((q for q in everything if q["id"] != p["id"]), key=lambda q: len(a & sets[q["id"]]) / (len(a | sets[q["id"]]) or 1))
        neighbors[p["id"]] = best["id"]
    items = [i for b in banks for i in b["items"] if not i.get("gatecheck") and i["id"] != b["model"]["item"]]
    goal = [i for i in items if set(i.get("tags", [])) & set(GOALS)]
    pron = [i for i in items if i["skill"] == "N4"]
    judged = [i for i in items if i["format"] in ("tap", "scene") and "inference" in i]
    picked = rng.sample(goal, 20) + rng.sample([i for i in pron if i not in goal], 10)
    for lv in (0, 1, 2):
        picked += rng.sample([i for i in judged if i.get("inference") == lv and i not in picked], 10)
    gold = {"created": datetime.date.today().isoformat(), "seed": seed, "passages": [p["id"] for p in chosen],
            "items": [i["id"] for i in picked], "neighbors": neighbors}
    GOLD.write_text(json.dumps(gold, indent=1) + "\n")
    PAGE.write_text(page(gold, banks), encoding="utf-8")
    print(f"Gold set: {len(chosen)} passages, {len(picked)} items. Open {PAGE.relative_to(HERE.parent.parent)} in a browser to rate.")


def page(gold, banks):
    passages = {p["id"]: p for b in banks for p in b["passages"]}
    items = {i["id"]: i for b in banks for i in b["items"]}
    data = {"passages": [], "items": []}
    for pid in gold["passages"]:
        p, q = passages[pid], passages[gold["neighbors"][pid]]
        data["passages"].append({"id": pid, "title": p["title"], "sentences": p["sentences"], "breaks": p.get("breaks", []),
                                 "neighbor": {"id": q["id"], "title": q["title"], "text": passage_text(q)}})
    for iid in gold["items"]:
        it, p = items[iid], passages[items[iid]["passage"]]
        ans = skillcheck.answer_text(it)
        data["items"].append({"id": iid, "title": p["title"], "rows": rows(p), "intro": p["sentences"] if p.get("visual") else [],
                              "prompt": it.get("prompt", ""), "options": it.get("options") or [o.get("label", "") for o in it.get("objects", [])],
                              "answer": ans, "format": it["format"], "tags": it.get("tags", [])})
    return TEMPLATE.replace("__DATA__", html.escape(json.dumps(data), quote=False).replace("</", "<\\/"))


# ---------------------------------------------------------------- scoring the checks
def agree():
    gold, ratings = json.loads(GOLD.read_text()), json.loads(RATINGS.read_text())
    banks = load_bank()
    passages = {p["id"]: p for b in banks for p in b["passages"]}
    items = {i["id"]: i for b in banks for i in b["items"]}
    out = {"computed": datetime.datetime.now().isoformat(timespec="seconds"), "rater": ratings.get("rater", "")}

    c_chk, c_rat = [], []
    for pid, r in ratings.get("passages", {}).items():
        flagged = {f["sentence"] for f in coherence.flags(passages[pid]) if f["tier"] == "break"}
        for s in range(1, len(passages[pid]["sentences"])):
            c_chk.append(s in flagged)
            c_rat.append(s in set(r.get("breaks", [])))
    out["coherence"] = binary_metrics(c_chk, c_rat)

    d_chk, d_rat = [], []
    for pid, r in ratings.get("passages", {}).items():
        if r.get("neighbor"):
            q = passages[gold["neighbors"][pid]]
            d_chk.append(bool(skillcheck.near_duplicates([passages[pid], q])))
            d_rat.append(r["neighbor"] == "same")
    out["near-duplicate"] = binary_metrics(d_chk, d_rat)

    i_chk, i_rat, pred, rated = [], [], [], []
    t_chk, t_rat = [], []
    for iid, r in ratings.get("items", {}).items():
        it = items[iid]
        p = passages[it["passage"]]
        if "inference" in r and "inference" in it:
            i_chk.append(bool(skillcheck.inference_flags(it, p)))
            i_rat.append(r["inference"] != it["inference"])
            guess = skillcheck.predict_inference(it, p)
            if guess is not None:
                pred.append(guess)
                rated.append(r["inference"])
        flagged = {tag for tag, _ in skillcheck.tag_flags(it, p)}
        for tag in GOALS:
            has = tag in it.get("tags", [])
            wrong = (has and r.get("tags", {}).get(tag) == "wrong") or (not has and tag in r.get("missing", []))
            if has or tag in r.get("missing", []) or tag in flagged:
                t_chk.append(tag in flagged)
                t_rat.append(wrong)
    out["inference"] = {**binary_metrics(i_chk, i_rat), "level_kappa": round(kappa(pred, rated), 3)}
    out["tags"] = binary_metrics(t_chk, t_rat)
    for name in ("coherence", "near-duplicate", "inference", "tags"):
        m = out[name]
        m["passed"] = passes(m) and (name != "inference" or m["level_kappa"] >= KAPPA)
        print(f'{name}: kappa {m["kappa"]}, precision {m["precision"]}, recall {m["recall"]}, n {m["n"]} -> {"blocks" if m["passed"] else "warns only"}')
    AGREEMENT.write_text(json.dumps(out, indent=1) + "\n")


TEMPLATE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gold Set Ratings</title>
<style>
:root { --bg:#f6f1e7; --card:#fffdf8; --ink:#1f2933; --muted:#5b6672; --line:#d9d0c1; --accent:#2f7fb0; --soft:#e3eef6; }
@media (prefers-color-scheme: dark) { :root { --bg:#1b2029; --card:#252b36; --ink:#eef0f2; --muted:#b4bcc6; --line:#3d4554; --accent:#7cc0ea; --soft:#2b3a4a; } }
* { box-sizing: border-box; } body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.55 system-ui, sans-serif; }
main { max-width: 860px; margin: 0 auto; padding: 16px; } h1 { font-size: 1.6rem; margin: .4rem 0; } h2 { font-size: 1.15rem; margin: 0 0 .4rem; }
.card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:14px 16px; margin:14px 0; }
.muted { color:var(--muted); } .sent { display:flex; gap:.5rem; align-items:flex-start; padding:.25rem 0; } .sent input { margin-top:.35rem; }
.para { border-top: 1px dashed var(--line); margin-top:.4rem; padding-top:.4rem; } fieldset { border:1px solid var(--line); border-radius:10px; margin:.6rem 0; }
legend { font-weight:700; } label { cursor:pointer; } .right { background:var(--soft); border-radius:6px; padding:0 .3rem; }
.bar { position:sticky; top:0; background:var(--bg); padding:.5rem 0; display:flex; gap:.6rem; flex-wrap:wrap; align-items:center; z-index:2; }
button { font:inherit; padding:.45rem .9rem; border-radius:999px; border:1px solid var(--line); background:var(--card); color:var(--ink); cursor:pointer; }
button.primary { background:var(--accent); color:#fff; border-color:transparent; } blockquote { margin:.4rem 0; padding:.4rem .8rem; border-left:4px solid var(--line); }
</style></head><body><main>
<h1>Gold set: rate by hand</h1>
<p class="muted">These ratings decide whether the new content checks may block changes. Rate what you see; nothing here shows what the checks think. Your answers save in this browser as you go. When done, press <b>Download ratings</b> and save the file as <code>evals/gold/ratings.json</code>.</p>
<div class="bar"><span id="progress"></span><button class="primary" id="dl">Download ratings</button><label><input type="file" id="up" accept="application/json" hidden><span class="muted" style="text-decoration:underline">Load saved ratings</span></label></div>
<section id="ps"><h2>Part 1. Passages (30)</h2><p class="muted">Tick any sentence that does not connect to what came before it: it shares no people or things with the text so far and nothing links it back. Then compare with the most similar other text in the bank.</p></section>
<section id="is"><h2>Part 2. Questions (60)</h2><p class="muted">For each question, say how the right answer is found, and whether each school-goal tag fits.</p></section>
<script id="data" type="application/json">__DATA__</script>
<script>
const D = JSON.parse(document.getElementById('data').textContent);
const KEY = 'ltf-gold-ratings';
let R = { rater: 'DW', passages: {}, items: {} };
try { R = JSON.parse(localStorage.getItem(KEY)) || R; } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(R)); } catch (e) {} progress(); };
const el = (t, a = {}, ...kids) => { const n = document.createElement(t); for (const [k, v] of Object.entries(a)) k === 'text' ? n.textContent = v : n.setAttribute(k, v); n.append(...kids); return n; };
const GOALS = ['main-idea', 'key-detail', 'problem-solving', 'plan-change'];
function progress() {
  const p = D.passages.filter((x) => R.passages[x.id]?.neighbor).length, i = D.items.filter((x) => R.items[x.id]?.inference !== undefined).length;
  document.getElementById('progress').textContent = `Passages ${p} of ${D.passages.length} · Questions ${i} of ${D.items.length}`;
}
D.passages.forEach((p, n) => {
  const r = R.passages[p.id] ||= { breaks: [] };
  const card = el('article', { class: 'card', id: p.id }, el('h3', { text: `${n + 1}. ${p.title}` }));
  p.sentences.forEach((s, i) => {
    const row = el('div', { class: 'sent' + (p.breaks.includes(i) ? ' para' : '') });
    if (i > 0) {
      const cb = el('input', { type: 'checkbox', id: `${p.id}-s${i}`, 'aria-label': `Sentence ${i + 1} does not connect` });
      cb.checked = r.breaks.includes(i);
      cb.onchange = () => { r.breaks = cb.checked ? [...new Set([...r.breaks, i])] : r.breaks.filter((x) => x !== i); save(); };
      row.append(cb, el('label', { for: cb.id, text: `${i + 1}. ${s}` }));
    } else row.append(el('span', { style: 'width:1.1rem' }), el('span', { text: `1. ${s}` }));
    card.append(row);
  });
  const fs = el('fieldset', {}, el('legend', { text: `The most similar other text: "${p.neighbor.title}". Is it the same text reworded?` }), el('blockquote', { text: p.neighbor.text }));
  [['same', 'Yes, the same text reworded'], ['similar', 'Similar topic, different text'], ['unrelated', 'Unrelated']].forEach(([v, t]) => {
    const id = `${p.id}-n-${v}`, rb = el('input', { type: 'radio', name: `${p.id}-n`, id, value: v });
    rb.checked = r.neighbor === v; rb.onchange = () => { r.neighbor = v; save(); };
    fs.append(el('div', {}, rb, el('label', { for: id, text: ' ' + t })));
  });
  card.append(fs); document.getElementById('ps').append(card);
});
D.items.forEach((it, n) => {
  const r = R.items[it.id] ||= { tags: {}, missing: [] };
  const card = el('article', { class: 'card', id: it.id }, el('h3', { text: `${n + 1}. ${it.title}` }));
  [...it.intro, ...it.rows].forEach((s) => card.append(el('div', { text: s })));
  card.append(el('p', {}, el('b', { text: it.prompt })));
  if (it.options.length) card.append(el('ul', {}, ...it.options.map((o) => el('li', o === it.answer ? { class: 'right', text: o + '  (the right answer)' } : { text: o }))));
  else card.append(el('p', { class: 'muted', text: `Format: ${it.format}. ${it.answer ? 'Right answer: ' + it.answer : ''}` }));
  const fs = el('fieldset', {}, el('legend', { text: 'How is the right answer found?' }));
  [[0, 'It is stated in the text'], [1, 'Two parts of the text must be joined'], [2, 'It needs knowledge or feelings the text does not state']].forEach(([v, t]) => {
    const id = `${it.id}-inf-${v}`, rb = el('input', { type: 'radio', name: `${it.id}-inf`, id, value: v });
    rb.checked = r.inference === v; rb.onchange = () => { r.inference = v; save(); };
    fs.append(el('div', {}, rb, el('label', { for: id, text: ' ' + t })));
  });
  card.append(fs);
  const goals = it.tags.filter((t) => GOALS.includes(t));
  const tf = el('fieldset', {}, el('legend', { text: 'School-goal tags' }));
  goals.forEach((t) => [['fits', 'fits'], ['wrong', 'does not fit']].forEach(([v, txt]) => {
    const id = `${it.id}-t-${t}-${v}`, rb = el('input', { type: 'radio', name: `${it.id}-t-${t}`, id, value: v });
    rb.checked = r.tags[t] === v; rb.onchange = () => { r.tags[t] = v; save(); };
    tf.append(el('div', {}, rb, el('label', { for: id, text: ` "${t}" ${txt}` })));
  }));
  GOALS.filter((t) => !goals.includes(t)).forEach((t) => {
    const id = `${it.id}-m-${t}`, cb = el('input', { type: 'checkbox', id });
    cb.checked = r.missing.includes(t); cb.onchange = () => { r.missing = cb.checked ? [...r.missing, t] : r.missing.filter((x) => x !== t); save(); };
    tf.append(el('div', {}, cb, el('label', { for: id, text: ` Should be tagged "${t}"` })));
  });
  card.append(tf); document.getElementById('is').append(card);
});
document.getElementById('dl').onclick = () => {
  R.ratedAt = new Date().toISOString();
  const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(R, null, 1)], { type: 'application/json' })), download: 'ratings.json' });
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
    elif cmd == "agree":
        agree()
    else:
        print(__doc__)
