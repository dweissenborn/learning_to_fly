// LTF-41: the math module's own settings, in its `settings:math` document (LTF-39), synced like the main settings.
export interface MathSettings {
  /** A grown-up turned math on: it shows on the picker and as a path on his island. */
  enabled?: boolean;
  /** A start point a grown-up entered (for example from a school assessment): the check-in only confirms these. */
  known?: string[];
  /** Skills a grown-up opened before what they rest on is done. */
  opened?: string[];
  /** LTF-42 pilot: equivalent fractions, multiplying and dividing can be read as a short story. Off until turned on. */
  stories?: boolean;
}
