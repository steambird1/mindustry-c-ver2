import fs from 'fs';
import { Compiler } from '../src/mindc.js';
import { AttributeClass } from '../src/mindcBase.js';
import { MemoryBlock } from '../src/mindcGeneratorBase.js';
import { runProgram, makeDevice } from '../sim.mjs';
const cfg = new AttributeClass(); cfg.setAttribute('targetVersion', 154.3);
const log = console.log; console.log = () => {};
const r = await new Compiler(fs.readFileSync(process.argv[2], 'utf8'),
  [new MemoryBlock('bank1', 64)], cfg).compile();
console.log = log;
if (!r.success) { console.log('FAILED', (r.errors ?? []).map(e => e.message).join('|')); process.exit(0); }
const links = [makeDevice('@message', 'message1'), makeDevice('@memory-cell', 'bank1', 64)];
const proc = runProgram(String(r.code), { links });
console.log('output:', proc.output(), '| trap:', proc.trap ?? 'none');
