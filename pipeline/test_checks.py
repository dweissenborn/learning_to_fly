"""Tests for the content checks (LTF-16). Run: python pipeline/test_checks.py  (no test framework needed)."""
import json
import pathlib
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "evals" / "gold"))

import coherence
import skillcheck
import content_check
import gold

CREDIT = {"title": "t", "author": "x", "source": "x", "licence": "original", "retrieved": "2026-10-13", "adapted": False}


def passage(pid, sentences, **extra):
    return {"id": pid, "title": pid, "kind": "story", "sentences": sentences, "topics": ["school"], "level": 3, "socialLoad": 0, "credit": CREDIT, **extra}


HARBOR = passage("h1", [
    "After school on Monday, Sam took Pixel for a walk to the harbor.",
    "They watched the boats come in from the bay.",
    "Pixel barked at a big white ferry near the dock.",
    "The ferry blew its horn, and Sam laughed at his noisy dog.",
    "Then they walked home along the beach for dinner.",
])


def test_coherence():
    assert coherence.flags(HARBOR) == [], coherence.flags(HARBOR)
    spliced = passage("h2", HARBOR["sentences"][:2] + ["Volcanoes erupt molten rock from deep underground chambers."] + HARBOR["sentences"][2:])
    f = coherence.flags(spliced)
    assert [x["sentence"] for x in f if x["tier"] == "break"] == [2], f
    assert coherence.flags(passage("s", ["Stop.", "Look both ways."])) == []  # too short to judge, like check.py


def test_near_duplicates():
    reworded = passage("h3", [
        "On Monday after school, Sam walked Pixel down to the harbor.",
        "Pixel barked at the big white ferry by the dock.",
        "They watched boats come in from the bay.",
        "The ferry's horn blew and Sam laughed at his dog.",
        "Then they walked home on the beach for dinner.",
    ])
    other = passage("h4", [
        "On Saturday, Sam and Priya tested her rover in the school gym.",
        "The rover turned left when it should have turned right.",
        "Priya opened the panel and found a loose wire.",
        "She fixed the wire, and the rover drove straight across the floor.",
        "Sam cheered and asked for a turn with the remote.",
    ])
    pairs = skillcheck.near_duplicates([HARBOR, reworded, other])
    assert [(a, b) for a, b, _ in pairs] == [("h1", "h3")], pairs


def item(**kw):
    base = {"id": "i1", "skill": "N1", "passage": "h1", "format": "tap", "level": 3, "prompt": "Where did Sam take Pixel?",
            "options": ["To the harbor", "To the park", "To school"], "answer": 0, "evidence": [0], "explain": ".", "inference": 0}
    return {**base, **kw}


def test_inference():
    assert skillcheck.inference_flags(item(), HARBOR) == []
    assert skillcheck.inference_flags(item(inference=2), HARBOR), "a copied answer marked 'needs knowledge' should be flagged"
    unstated = item(prompt="How did Sam feel about the trip?", options=["Glad and relaxed", "Bored", "Angry"], answer=0, evidence=[3], inference=0)
    assert skillcheck.inference_flags(unstated, HARBOR), "an answer not in the text marked 'stated' should be flagged"
    assert skillcheck.inference_flags({**unstated, "inference": 2}, HARBOR) == []
    assert skillcheck.inference_flags(item(format="order", options=None), HARBOR) == []  # only tap and scene are judged


def test_tags():
    assert skillcheck.tag_flags(item(tags=["main-idea"]), HARBOR), "main-idea on a 'where' question should be flagged"
    assert skillcheck.tag_flags(item(prompt="What is this story mostly about?"), HARBOR), "a main-idea question without the tag should be flagged"
    assert skillcheck.tag_flags(item(prompt="What is this story mostly about?", tags=["main-idea"]), HARBOR) == []
    assert skillcheck.tag_flags(item(prompt="How did they fix the problem?", tags=["problem-solving"], level=1), HARBOR), "problem-solving is for levels 3 to 5"
    assert skillcheck.tag_flags(item(prompt="What did they do instead?", tags=["plan-change"]), HARBOR), "plan-change needs a change in the text"


def test_blocking_and_baseline():
    flags = [{"check": "coherence", "id": "h2", "key": "h2:2", "message": "m"}]
    with tempfile.TemporaryDirectory() as d:
        base = pathlib.Path(d) / "baseline.json"
        base.write_text(json.dumps({"coherence": ["h1:3"]}))
        new = content_check.new_flags(flags, base)
        assert [f["key"] for f in new] == ["h2:2"]
        assert content_check.exit_code(new, agreement={}) == 0, "advisory until the gold set agrees"
        assert content_check.exit_code(new, agreement={"coherence": {"passed": True}}) == 1
        assert content_check.exit_code([], agreement={"coherence": {"passed": True}}) == 0


def test_agreement_math():
    assert abs(gold.kappa([1, 1, 0, 0], [1, 1, 0, 0]) - 1.0) < 1e-9
    assert abs(gold.kappa([1, 0, 1, 0], [1, 1, 0, 0])) < 1e-9  # chance level
    m = gold.binary_metrics(checker=[1, 1, 0, 0, 1], rater=[1, 0, 0, 0, 1])
    assert m["precision"] == 2 / 3 and m["recall"] == 1.0, m
    assert gold.passes({"kappa": 0.7, "precision": 0.85, "n": 30}) and not gold.passes({"kappa": 0.5, "precision": 0.9, "n": 30})


def test_gold_never_tunes():
    gold_ids = {"h1"}
    assert [p["id"] for p in skillcheck.tuning_passages([HARBOR, passage("h9", HARBOR["sentences"])], gold_ids)] == ["h9"]


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print(f"{len(tests)} tests passed")
