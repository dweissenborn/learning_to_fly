// Validates content/bank/*.json against bank.schema.json plus the cross-references a schema cannot express.
// Usage: node packages/schema/validate.mjs [SKILL ...]   (exit 1 on any error)
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const bankDir = join(root, 'content', 'bank');
const schema = JSON.parse(readFileSync(join(root, 'packages/schema/bank.schema.json'), 'utf8'));
const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);

const only = process.argv.slice(2).map((s) => s.toUpperCase());
const files = readdirSync(bankDir).filter((f) => f.endsWith('.json') && (!only.length || only.includes(f.replace('.json', ''))));
const errors = [];
const seenPassage = new Map();
const seenItem = new Map();
const words = (s) => s.toLowerCase().replace(/[^a-z0-9'\s-]/g, ' ').split(/\s+/).filter(Boolean);

// Number of addressable rows in a passage: visual rows when a visual exists, else sentences.
function rowCount(p) {
  const v = p.visual;
  if (!v) return p.sentences.length;
  if (v.type === 'signs') return v.signs.length;
  if (v.type === 'prompt') return v.rows.length + v.buttons.length;
  return v.rows.length;
}
function passageText(p) {
  const v = p.visual;
  const parts = [...p.sentences];
  if (v) {
    if (v.type === 'signs') parts.push(...v.signs.map((s) => s.text));
    else if (v.type === 'table') parts.push(v.columns.join(' '), ...v.rows.map((r) => r.join(' ')));
    else if (v.type === 'label' || v.type === 'form') parts.push(v.title, ...v.rows.map((r) => `${r.k} ${r.v ?? ''}`));
    else parts.push(v.title ?? '', ...v.rows, ...(v.buttons ?? []));
  }
  return parts.join(' ');
}

for (const file of files) {
  const where = (m) => errors.push(`${file}: ${m}`);
  let bank;
  try { bank = JSON.parse(readFileSync(join(bankDir, file), 'utf8')); } catch (e) { where(`invalid JSON: ${e.message}`); continue; }
  if (!validate(bank)) {
    for (const e of validate.errors) where(`schema ${e.instancePath || '/'} ${e.message}${e.params?.allowedValues ? ' ' + JSON.stringify(e.params.allowedValues) : ''}`);
    continue;
  }
  const skill = bank.skill;
  if (file !== `${skill}.json`) where(`file name must be ${skill}.json`);
  const passages = new Map(bank.passages.map((p) => [p.id, p]));
  for (const p of bank.passages) {
    if (seenPassage.has(p.id)) where(`duplicate passage id ${p.id} (also in ${seenPassage.get(p.id)})`);
    seenPassage.set(p.id, file);
    if (!p.sentences.length && !p.visual) where(`${p.id}: needs sentences or a visual`);
    if (p.breaks?.some((b, k) => b >= p.sentences.length || (k > 0 && b <= p.breaks[k - 1]))) where(`${p.id}: breaks must be increasing sentence indexes`);
  }
  for (const it of bank.items) {
    const at = (m) => where(`${it.id}: ${m}`);
    if (seenItem.has(it.id)) at(`duplicate item id (also in ${seenItem.get(it.id)})`);
    seenItem.set(it.id, file);
    if (it.skill !== skill) at(`skill ${it.skill} does not match file ${skill}`);
    const p = passages.get(it.passage);
    if (!p) { at(`unknown passage ${it.passage}`); continue; }
    if (it.level !== p.level) at(`level ${it.level} differs from its passage's level ${p.level}`);
    const rows = rowCount(p);
    const text = words(passageText(p));
    for (const e of it.evidence ?? []) if (e >= rows) at(`evidence ${e} out of range (${rows} rows)`);
    if (it.focus && !text.includes(it.focus.toLowerCase())) at(`focus "${it.focus}" not found in passage`);
    const need = (k) => { if (it[k] === undefined) at(`format ${it.format} needs "${k}"`); return it[k] !== undefined; };
    const idx = (n, len, what) => { if (!Number.isInteger(n) || n < 0 || n >= len) at(`${what} index ${n} out of range (${len})`); };
    switch (it.format) {
      case 'tap':
        if (need('options') && need('answer')) {
          if (Array.isArray(it.answer)) at('tap answer must be one index'); else idx(it.answer, it.options.length, 'answer');
          if (it.pictures && it.pictures.length !== it.options.length) at('pictures must match options');
        }
        break;
      case 'scene':
        if (need('scene') && need('objects') && need('answer')) for (const a of [].concat(it.answer)) idx(a, it.objects.length, 'answer');
        break;
      case 'order':
        need('steps');
        break;
      case 'storymap':
      case 'build':
        if (need('slots')) for (const s of it.slots) {
          if (it.tier !== 'express' && !s.answer?.length) at(`slot ${s.kind} needs an answer`);
          for (const a of s.answer ?? []) idx(a, s.options.length, `slot ${s.kind} answer`);
        }
        if (it.format === 'build' && need('frame')) {
          const n = new Set(it.frame.match(/\{\d\}/g) ?? []).size;
          if (n !== it.slots?.length) at(`frame has ${n} placeholders for ${it.slots?.length} slots`);
        }
        break;
      case 'highlight':
        if (need('unit')) {
          if (it.unit === 'word') {
            if (need('accept')) for (const w of it.accept) if (!text.includes(w.toLowerCase())) at(`accepted word "${w}" not in passage`);
          } else if (need('answer')) {
            const len = it.unit === 'sentence' ? p.sentences.length : rows;
            for (const a of [].concat(it.answer)) idx(a, len, 'answer');
          }
        }
        break;
      case 'sort':
        if (need('bins') && need('cards')) for (const c of it.cards) idx(c.bin, it.bins.length, `card "${c.text}" bin`);
        break;
    }
    if (it.tier === 'express' && skill[0] !== 'P') at('express tier is for philosophical skills only');
  }
  const model = bank.items.find((i) => i.id === bank.model.item);
  if (!model) where(`model item ${bank.model.item} not found`);
  else for (const s of bank.model.steps) for (const e of s.show ?? []) if (e >= rowCount(passages.get(model.passage))) where(`model step show ${e} out of range`);
  if (!bank.model.steps.some((s) => s.reveal)) where('model needs a step with reveal: true');

  // Coverage rules: enough items per level, one placement item, transfer items, and the inference check.
  const practice = bank.items.filter((i) => i.id !== bank.model.item && !i.gatecheck);
  const min = skill[0] === 'P' ? 6 : 15;
  if (practice.length < min) where(`only ${practice.length} practice items (need ${min})`);
  if (skill[0] !== 'P') {
    const placement = practice.filter((i) => i.placement);
    if (placement.length !== 1) where(`needs exactly one placement item (has ${placement.length})`);
    else if (placement[0].format !== 'tap') where('placement item must be tap');
    if (practice.filter((i) => i.transfer).length < 3) where('needs at least 3 transfer items');
    for (const lv of [1, 2, 3]) if (!practice.some((i) => i.level === lv)) where(`no level ${lv} items`);
    // Harder texts, offered only when he climbs to them (docs/content-guide.md, "Reading levels").
    if (practice.filter((i) => i.level === 4).length < 4) where('needs at least 4 level 4 items');
    if (practice.filter((i) => i.level === 5).length < 3) where('needs at least 3 level 5 items');
  }
  const tagged = (t) => practice.filter((i) => i.tags?.includes(t)).length;
  if (skill === 'N6' && tagged('main-idea') + tagged('key-detail') < 15) where('N6 needs at least 15 items tagged main-idea or key-detail');
  if (skill === 'N3' && tagged('problem-solving') < 6) where('N3 needs at least 6 items tagged problem-solving');
  const gate = bank.items.filter((i) => i.gatecheck);
  if (['N3', 'N5', 'N6'].includes(skill)) {
    if (gate.length < 3) where(`needs 3 gatecheck items (has ${gate.length})`);
    const practicePassages = new Set(practice.map((i) => i.passage));
    for (const g of gate) {
      if (practicePassages.has(g.passage)) where(`${g.id}: gatecheck passage ${g.passage} is also used by practice items`);
      if (g.format !== 'tap' || !(g.inference >= 1)) where(`${g.id}: gatecheck items are tap with inference >= 1`);
    }
  } else if (gate.length) where('gatecheck items belong only to N3, N5 and N6');
  console.log(`${skill}: ${bank.passages.length} passages, ${practice.length} practice items, ${gate.length} gatecheck`);
}

if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n` + errors.map((e) => '  - ' + e).join('\n'));
  process.exit(1);
}
console.log(`\nOK: ${files.length} file(s) valid.`);
