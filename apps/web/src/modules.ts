// LTF-39 (ADR-0003): modules as add-ons. A content module brings skills and uses the core's session loop, rules, journey and
// grown-ups' area; a function module brings its own activity. Reading and Today are modules like any other; math joins
// with its skills (LTF-41). Each module's memory: its events (with `module`), notes, and a settings document `settings:<id>`.
export interface ModuleDef {
  id: string;
  kind: 'content' | 'function';
  /** What the picker card says. */
  title: string;
  icon: string;
  /** Where its memory lives: on this device only, or in the family cloud copy too. */
  memory: 'none' | 'device' | 'cloud';
  /** The screen it opens. */
  screen: 'session' | 'today';
}
export const MODULES: readonly ModuleDef[] = [
  { id: 'reading', kind: 'content', title: 'Start reading', icon: '📖', memory: 'cloud', screen: 'session' },
  { id: 'today', kind: 'function', title: 'Tell about today', icon: '📅', memory: 'cloud', screen: 'today' },
];
