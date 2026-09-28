/* Compile each case and run it on the simulator with a world that makes
   `ulocate` find something. */
import fs from 'fs';
import { Compiler } from '../../../mindc.js';
import { AttributeClass } from '../../../mindcBase.js';
import { MemoryBlock } from '../../../mindcGeneratorBase.js';
import { runProgram, makeDevice, defaultLinks } from '../sim.mjs';
const blocks = [{ name: 'cell1', size: 64 }];

export async function run(file, version = 154.3) {
	const src = fs.readFileSync(file, 'utf8');
	const cfg = new AttributeClass(); cfg.setAttribute('targetVersion', version);
	const log = console.log; console.log = () => {};
	const r = await new Compiler(src, blocks.map(b => new MemoryBlock(b.name, b.size)), cfg).compile();
	console.log = log;
	if (!r.success) return { success: false, errors: (r.errors ?? []).map(e => e.message ?? String(e)) };
	const devices = {};
	for (const m of src.matchAll(/auto\s+device\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/g))
		devices[m[1]] = makeDevice('@message', m[1]);
	const core = makeDevice('@core', 'core1'); devices.core1 = core;
	const proc = runProgram(String(r.code ?? ''), {
		links: defaultLinks(blocks.map(b => new MemoryBlock(b.name, b.size))),
		devices, maxSteps: 20000,
		ulocateProvider: () => [11, 22, 1, core],
		ucontrolProvider: () => true
	});
	return { success: true, output: proc.output().trim(), trap: proc.trap,
		lines: String(r.code ?? '').split('\n').filter(l => l.trim()).length };
}
if (process.argv[1] && process.argv[1].endsWith('simrun.mjs')) {
	for (const f of process.argv.slice(2)) {
		const r = await run(f, Number(process.env.MCV ?? 154.3));
		console.log('===== ' + f + (process.env.MCV ? ' (v' + process.env.MCV + ')' : ''));
		console.log(r.success ? `${r.output} | lines: ${r.lines} | trap: ${r.trap ?? 'none'}`
			: 'FAILED: ' + r.errors.join(' | '));
	}
}
