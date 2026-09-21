import fs from 'fs';
import path from 'path';
const INCLUDE = path.resolve('include');
globalThis.fetch = async (url) => {
  const raw = String(url).replace(/^https?:\/\/[^/]+/, '');
  const file = raw.replace(/^\/+include\//, '').replace(/^\/+/, '');
  const full = path.join(INCLUDE, file);
  if (!fs.existsSync(full)) return { ok: false, status: 404, text: async () => '' };
  return { ok: true, status: 200, text: async () => fs.readFileSync(full, 'utf8') };
};
const { Compiler } = await import('../src/mindc.js');
const { AttributeClass } = await import('../src/mindcBase.js');
const { MemoryBlock } = await import('../src/mindcGeneratorBase.js');
import { runProgram, defaultLinks } from '../sim.mjs';

const cfg = new AttributeClass(); cfg.setAttribute('targetVersion', 154.3);
const log = console.log; console.log = () => {};
const blocks = [{ name: 'bank1', size: 64 }];
let r;
try { r = await new Compiler(fs.readFileSync(process.argv[2], 'utf8'), blocks.map(b => new MemoryBlock(b.name, b.size)), cfg).compile(); }
catch (e) { console.log = log; console.log('THROWN:', e.message); process.exit(0); }
console.log = log;
if (!r.success) { console.log('COMPILE FAILED:', (r.errors ?? []).map(e => e.message).join(' | ')); process.exit(0); }
const proc = runProgram(String(r.code), { links: defaultLinks(blocks), maxSteps: 20000 });
console.log('--- output ---');
console.log(proc.output());
console.log('--- trap ---', proc.trap ?? 'none');
