import fs from 'fs';
import { Compiler } from '../extroot/mindc.js';
import { AttributeClass } from '../extroot/mindcBase.js';

const load = async p => {
  const mod = await import(p);
  return mod.extension;
};
const exts = [await load('../extroot/include/archon.js'), await load('../extroot/include/sharelist.js')];
const cfg = new AttributeClass();
cfg.setAttribute('targetVersion', 154.3);
const log = console.log; console.log = () => {};
const src = fs.readFileSync(process.argv[2], 'utf8');
let r;
try { r = await new Compiler(src, [], cfg, exts).compile(); }
catch (e) { console.log = log; console.log('THROWN:', e.message); console.log((e.stack??'').split('\n').slice(0,4).join('\n')); process.exit(0); }
console.log = log;
console.log('success', r.success);
console.log('errors:', (r.errors ?? []).map(e => `${e.message} @${e.line}:${e.column ?? ''}`).join(' | '));
console.log('warnings:', (r.warnings ?? []).map(e => e.message).join(' | '));
if (r.success) console.log(String(r.code ?? '').split('\n').filter(l=>l.trim()).join('\n'));
