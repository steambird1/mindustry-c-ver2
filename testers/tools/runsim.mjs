/**
 * Compile a Mindustry-C program and RUN the result on the simulator.
 *
 * Usage:  node runsim.mjs file.c [memory-spec.json]
 * Prints the program output (what it printed to message boards).
 */

import fs from 'fs';
import { Compiler } from './src/mindc.js';
import { AttributeClass } from './src/mindcBase.js';
import { MemoryBlock, } from './src/mindcGeneratorBase.js';
import { runProgram, makeDevice, defaultLinks } from './sim.mjs';

export async function compileAndRun(source, memoryBlocks = [{ name: 'bank1', size: 64 }, { name: 'bank2', size: 64 }], extraAttributes = {}) {
	const config = new AttributeClass();
	config.setAttribute('targetVersion', 154.3);
	for (const [k, v] of Object.entries(extraAttributes)) config.setAttribute(k, v);
	const compiler = new Compiler(source, memoryBlocks.map(b => new MemoryBlock(b.name, b.size)), config);
	const log = console.log; console.log = () => {};
	const result = await compiler.compile();
	console.log = log;
	return { result, memoryBlocks };
}

export async function simulate(pathOrSource, memoryBlocks, extraAttributes = {}) {
	const source = pathOrSource.includes('\n') || !/\.c$/.test(pathOrSource)
		? pathOrSource : fs.readFileSync(pathOrSource, 'utf8');
	const { result, memoryBlocks: blocks } = await compileAndRun(source, memoryBlocks, extraAttributes);
	if (!result.success) {
		return { success: false, errors: (result.errors ?? []).map(e => e.message ?? String(e)), output: '', warnings: [] };
	}
	// Bind `auto device NAME` declarations to real devices
	const devices = {};
	const deviceNames = [...source.matchAll(/auto\s+device\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/g)].map(m => m[1]);
	if (deviceNames.length === 0) deviceNames.push('message1');
	deviceNames.forEach(name => { devices[name] = makeDevice('@message', name); });
	// Extra devices used by the program (displays etc.)
	for (const m of source.matchAll(/\b(printflush|drawflush)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/g)) {
		if (!devices[m[2]]) devices[m[2]] = makeDevice('@message', m[2]);
	}

	const links = defaultLinks(blocks);
	/*
	A small default world: `ulocate` finds a core at (11, 22) and
	`ucontrol "within"` succeeds, so output parameters can be checked. A test
	that needs something else passes its own provider to runProgram().
	*/
	const core = makeDevice('@core', 'core1');
	devices.core1 = core;
	const proc = runProgram(String(result.code ?? ''), {
		links, devices, maxSteps: 5_000_000,
		ulocateProvider: () => [11, 22, 1, core],
		ucontrolProvider: () => true
	});
	return {
		success: true,
		errors: [],
		warnings: (result.warnings ?? []).map(w => w.message ?? String(w)),
		output: proc.output(),
		trap: proc.trap,
		steps: proc.steps,
		lines: (String(result.code ?? '').split('\n')).filter(l => l.trim()).length,
		code: String(result.code ?? '')
	};
}

if (process.argv[1] && process.argv[1].endsWith('runsim.mjs')) {
	const file = process.argv[2];
	const blocks = process.argv[3] ? JSON.parse(process.argv[3]) : undefined;
	const r = await simulate(file, blocks);
	if (!r.success) {
		console.log('COMPILE FAILED:', r.errors.join(' | '));
		process.exit(1);
	}
	console.log('--- output ---');
	process.stdout.write(r.output);
	console.log('--- info ---');
	console.log('instructions:', r.lines, 'steps:', r.steps, 'trap:', r.trap ?? 'none');
	if (r.warnings.length) console.log('warnings:', r.warnings.join(' ; '));
}
