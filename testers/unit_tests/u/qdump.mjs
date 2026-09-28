import fs from 'fs';
import { Compiler } from '../../../mindc.js';
import { AttributeClass } from '../../../mindcBase.js';
const cfg = new AttributeClass(); cfg.setAttribute('targetVersion', 154.3);
const log = console.log; console.log = () => {};
const c = new Compiler(fs.readFileSync(process.argv[2], 'utf8'), [], cfg);
let r;
try { r = await c.compile(); } catch (e) { console.log = log; console.log('THREWN', e.message); process.exit(0); }
console.log = log;
// find the semantic analyzer through whatever field holds it
const sem = c.semanticAnalyzer ?? c.semantic ?? c.parser?.semantic ?? null;
console.log('success', r.success);
const dump = (sym, label) => {
  if (!sym) return;
  const t = sym.extractType?.() ?? sym.type;
  console.log(label, '=> toString:', t?.toString?.());
  let level = t, depth = 0;
  while (level && depth < 3) {
    console.log('   level', depth, 'name=', level.name, 'kind=', level.kind,
      'quals=', JSON.stringify(level.qualifiers));
    level = level.pointerTo; depth++;
  }
};
// walk all scopes for the names we care about
const names = ['p', 'q', 'r', 'allow_units'];
const seen = new Set();
const visit = sc => {
  if (!sc || seen.has(sc)) return; seen.add(sc);
  sc.symbols?.forEach((s, n) => { if (names.includes(n)) dump(s, n); });
  sc.children?.forEach(visit);
};
const root = sem?.globalScope;
if (root) visit(root);
else console.log('no globalScope; compiler keys:', Object.keys(c).join(','));
