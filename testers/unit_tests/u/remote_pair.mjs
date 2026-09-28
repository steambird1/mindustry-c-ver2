/* Run two programs: one exports a variable, the other reaches it with `remote`. */
import fs from 'fs';
import { Compiler } from '../../../mindc.js';
import { AttributeClass } from '../../../mindcBase.js';
import { runProgram, makeDevice } from '../sim.mjs';
import { MemoryBlock } from '../../../mindcGeneratorBase.js';

const cfg = new AttributeClass(); cfg.setAttribute('targetVersion', 154.3);
const log = console.log; console.log = () => {};
const mem = process.env.REM_MEM ? [new MemoryBlock('bank1', 64)] : [];
const compile = async file => {
	const r = await new Compiler(fs.readFileSync(file, 'utf8'), mem, cfg).compile();
	return r;
};
const a = await compile(process.argv[2]);
const b = await compile(process.argv[3]);
console.log = log;
if (!a.success || !b.success) {
	console.log('COMPILE FAILED', [...(a.errors ?? []), ...(b.errors ?? [])].map(e => e.message).join(' | '));
	process.exit(0);
}
// Processor A: its registers live in the building, so B can reach them
const procA = makeDevice('@micro-processor', 'processor1');
const procB = makeDevice('@micro-processor', 'processor2');
const message1 = makeDevice('@message', 'message1');
/*
A remote POINTER carries a link index, and link numbering is per processor --
so both sides must be wired in the SAME order for it to mean the same thing.
With REM_MEM a shared memory bank is linked to both, first in line.
*/
const bank1 = makeDevice('@memory-bank', 'bank1', 64);
const linksA = mem.length ? [bank1, message1, procB] : [message1, procB];
const linksB = mem.length ? [bank1, message1, procA] : [message1, procA];
runProgram(String(a.code), {
	links: linksA, devices: { message1, bank1 }, self: procA, maxSteps: 100000
});
const runB = runProgram(String(b.code), {
	links: linksB,
	devices: { message1, bank1, processor1: procA },
	self: procB, maxSteps: 100000
});
console.log('B output :', runB.output().trim());
console.log('A g:.c   =', procA.vars.get('g:.c'));
console.log('trap     :', runB.trap ?? 'none');
if (mem.length) console.log('bank1    :', bank1.cells.slice(0, 12).join(' '));
console.log('A vars   :', [...procA.vars.entries()].filter(([k]) => !k.startsWith('g:.f:')).map(([k, v]) => `${k}=${v}`).join(' '));
