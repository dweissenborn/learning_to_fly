"""LTF-62: a second reading-level opinion beside the Flesch-Kincaid gate in check.py.

A passage is flagged for a person's review when the two disagree by more than one level. It only ever warns: the
formula in check.py stays the gate (content_check.exit_code never blocks on this check).

ponytail: the Spache formula (sentence length and words outside a list of familiar words, so vocabulary rather than
syllables) stands in until an open-weight model is chosen. It is built for grades 1 to 3, so only levels 1 to 3 are
checked. On 2026-10-28 it agreed within one level on all 332 prose passages at those levels.
"""
import textstat

from check import BANDS, MIN_WORDS

CENTERS = {level: (band[3] + band[4]) / 2 for level, band in BANDS.items()}  # the middle of each level's grade band
CHECKED = (1, 2, 3)


def level_of(grade):
    """The level whose grade band is centred nearest this grade."""
    return min(CENTERS, key=lambda level: abs(CENTERS[level] - grade))


def flags(passage):
    text = " ".join(passage["sentences"])
    if passage["level"] not in CHECKED or textstat.lexicon_count(text) < MIN_WORDS:
        return []
    grade = textstat.spache_readability(text)
    other = level_of(grade)
    if abs(other - passage["level"]) <= 1:
        return []
    return [{"check": "second-level", "id": passage["id"], "key": passage["id"],
             "message": f'level {passage["level"]}, but its vocabulary reads near level {other} (Spache grade {grade:.1f}); worth a read'}]
