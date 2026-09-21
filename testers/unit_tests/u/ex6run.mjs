import fs from 'fs';
import { Compiler } from '../src/mindc.js';
import { AttributeClass } from '../src/mindcBase.js';
import { MemoryBlock } from '../src/mindcGeneratorBase.js';
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
const cell2 = makeDevice('@memory-cell', 'cell2_id', 64);
links.push(cell2);
const vault = makeDevice('@container', 'vault1');
links.push(vault);
const proc = runProgram(String(r.code), {
  links,
  sensorProvider: (dev, what) => (dev === vault && what === '@copper') ? 4321 : undefined
});
console.log('output:', proc.output());
console.log('cell2[60] =', cell2.cells[60]);
console.log('trap:', proc.trap ?? 'none');
