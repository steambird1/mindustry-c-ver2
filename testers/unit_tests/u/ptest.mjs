import fs from 'fs';
import { Compiler } from '../src/mindc.js';
import { AttributeClass } from '../src/mindcBase.js';
const cfg = new AttributeClass(); cfg.setAttribute('targetVersion', 154.3);
const origCompile = Compiler.prototype.compile;
Compiler.prototype.compile = async function () {
  const p = this.parser;
  return origCompile.call(this);
};
const log = console.log; console.log = () => {};
const c = new Compiler(fs.readFileSync(process.argv[2], 'utf8'), [], cfg);
// hook: dump AST after parse
const origParse = Object.getPrototypeOf(c.parser ?? {});
let r;
try { r = await c.compile(); } catch (e) { console.log = log; console.log('THREWN', e.message); process.exit(0); }
console.log = log;
const seen = new Set();
const walk = n => { if (!n || typeof n !== 'object' || seen.has(n)) return; seen.add(n);
  if (n.type === 'FunctionCall' && n.callee?.name === 'sizeof') console.log('SIZEOF args=', (n.arguments ?? []).map(a => a.type + ':' + (a.value ?? a.name ?? '')).join(','));
  for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v); } };
