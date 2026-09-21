import fs from 'fs';
import { Compiler } from '../extroot/mindc.js';
import { AttributeClass } from '../extroot/mindcBase.js';
import { MemoryBlock } from '../extroot/mindcGeneratorBase.js';
import { runProgram, defaultLinks } from '../sim.mjs';
const load = async p => (await import(p)).extension;
const exts = [await load('../extroot/include/archon.js'), await load('../extroot/include/sharelist.js')];
const cfg = new AttributeClass(); cfg.setAttribute('targetVersion', 154.3);
const log = console.log; console.log = () => {};
const blocks = process.argv[3] ? [{ name: process.argv[3], size: Number(process.argv[4] ?? 64) }] : [];
let r;
try { r = await new Compiler(fs.readFileSync(process.argv[2], 'utf8'), blocks.map(b => new MemoryBlock(b.name, b.size)), cfg, exts).compile(); }
catch (e) { console.log = log; console.log('THROWN', e.message); process.exit(0); }
console.log = log;
if (!r.success) { console.log('COMPILE FAILED:', (r.errors ?? []).map(e => e.message).join(' | ')); process.exit(0); }
const proc = runProgram(String(r.code), { links: defaultLinks(blocks) });
console.log('--- output ---');
console.log(proc.output());
console.log('--- info ---');
console.log('steps', proc.steps ?? '?', 'trap', proc.trap ?? 'none');
if (proc.trap) console.log(proc.hotspots(6).join('\n'));
