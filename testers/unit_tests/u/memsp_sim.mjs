import fs from 'fs';
import { Compiler } from '../src/mindc.js';
import { AttributeClass } from '../src/mindcBase.js';
import { MemoryBlock } from '../src/mindcGeneratorBase.js';
import { runProgram, makeDevice } from '../sim.mjs';

const cfg = new AttributeClass(); cfg.setAttribute('targetVersion', 154.3);
const log = console.log; console.log = () => {};
const source = fs.readFileSync(process.argv[2], 'utf8');
const blocks = [{ name: 'bank1', size: 64 }];
const r = await new Compiler(source, blocks.map(b => new MemoryBlock(b.name, b.size)), cfg).compile();
console.log = log;
if (!r.success) { console.log('COMPILE FAILED', (r.errors ?? []).map(e => e.message).join('|')); process.exit(0); }
const links = [
  makeDevice('@message', 'message1'),
  makeDevice('@memory-cell', 'bank1', 64),
  makeDevice('@memory-cell', 'cell2_id', 64),
  makeDevice('@container', 'vault1')
];
const proc = runProgram(String(r.code), {
  links,
  sensorProvider: (dev, what) => (String(what).startsWith('@') && what === '@copper') ? 1234 : undefined
});
console.log('output:', proc.output());
console.log('trap:', proc.trap ?? 'none');
