import fs from 'fs';
import { Compiler } from '../../mindc.js';
import { AttributeClass } from '../../mindcBase.js';
import { MemoryBlock } from '../../mindcGeneratorBase.js';
import { runProgram, makeDevice } from '../sim.mjs';
const cfg = new AttributeClass(); cfg.setAttribute('targetVersion', 154.3);
const log = console.log; console.log = () => {};
const blocks = [{ name: 'bank1', size: 64 }];
const r = await new Compiler(fs.readFileSync(process.argv[2], 'utf8'),
  blocks.map(b => new MemoryBlock(b.name, b.size)), cfg).compile();
console.log = log;
if (!r.success) { console.log('FAILED', (r.errors ?? []).map(e => e.message).join('|')); process.exit(0); }
const links = [makeDevice('@message', 'message1')];
for (const b of blocks) links.push(makeDevice('@memory-cell', b.name, b.size));
const A = makeDevice('@memory-cell', 'cellA', 64); links.push(A);
const B = makeDevice('@memory-cell', 'cellB', 64); links.push(B);
const proc = runProgram(String(r.code), { links });
console.log('trap:', proc.trap ?? 'none');
console.log('cellA[7] =', A.cells[7], ' cellB[7] =', B.cells[7]);
