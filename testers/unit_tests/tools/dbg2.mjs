/* Compile one file directly and report everything the compiler returned. */
import fs from 'fs';
import path from 'path';
import { Compiler } from '../src/mindc.js';
import { AttributeClass } from '../src/mindcBase.js';
import { MemoryBlock } from '../src/mindcGeneratorBase.js';
const file = path.resolve(process.argv[2] ?? 'check/t01_arith.c');
const cfg = new AttributeClass(); cfg.setAttribute('targetVersion', 154.3);
const log = console.log; console.log = () => {};
let r;
try {
	r = await new Compiler(fs.readFileSync(file, 'utf8'),
		[new MemoryBlock('bank1', 64), new MemoryBlock('bank2', 64)], cfg).compile();
} catch (e) { console.log = log; console.log('THROWN:', e.message, '\n', e.stack?.split('\n').slice(0,6).join('\n')); process.exit(1); }
console.log = log;
console.log('success:', r.success);
console.log('errors  :', JSON.stringify((r.errors ?? []).map(e => e.message ?? String(e))));
console.log('warnings:', JSON.stringify((r.warnings ?? []).map(e => e.message ?? String(e))));
if (r.fatalError) console.log('FATAL:', String(r.fatalError).split('\n').slice(0,8).join('\n'));
if (r.success && process.argv.includes('--code')) console.log('--- code ---\n' + String(r.code ?? ''));
