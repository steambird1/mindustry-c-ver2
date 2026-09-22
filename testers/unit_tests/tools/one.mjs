/*
Compile and run one test file, showing everything that matters:
    node tools/one.mjs t/remLkB.c [--code] [--warn] [--mem 64]
*/
import fs from 'fs';
import path from 'path';
import { simulate } from '../runsim.mjs';
import { Compiler } from '../src/mindc.js';
import { AttributeClass } from '../src/mindcBase.js';
import { MemoryBlock } from '../src/mindcGeneratorBase.js';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--')) ?? 'check/t01_arith.c';
const wantCode = args.includes('--code');
const wantWarn = args.includes('--warn');
const memArg = args.find(a => a.startsWith('--mem='));
const size = memArg ? Number(memArg.slice(6)) : 64;
const blocks = [{ name: 'bank1', size }, { name: 'bank2', size }];

const r = await simulate(path.resolve(file), blocks);
if (!r.success) {
	console.log('COMPILE FAILED:', r.errors.join(' | '));
	process.exit(1);
}
console.log('--- output ---');
process.stdout.write(r.output);
console.log('--- info ---');
console.log('instructions:', r.lines, 'steps:', r.steps, 'trap:', r.trap ?? 'none');
if (wantWarn && r.warnings.length) console.log('warnings:\n  ' + r.warnings.join('\n  '));
if (wantCode) {
	const cfg = new AttributeClass();
	cfg.setAttribute('targetVersion', 154.3);
	const log = console.log; console.log = () => {};
	const c = await new Compiler(fs.readFileSync(path.resolve(file), 'utf8'),
		blocks.map(b => new MemoryBlock(b.name, b.size)), cfg).compile();
	console.log = log;
	console.log('--- code ---');
	console.log(String(c.code));
}
