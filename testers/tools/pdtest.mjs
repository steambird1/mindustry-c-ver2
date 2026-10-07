/* Run example7b -- both the pdlist version and the version rewritten with the
   current array syntax -- on the simulator under the same hand written model
   of the world, then compare what they print. */
import fs from 'fs';
import { Compiler } from '../../mindc.js';
import { AttributeClass } from '../../mindcBase.js';
import { MemoryBlock } from '../../mindcGeneratorBase.js';
import { runProgram, makeDevice, defaultLinks } from './sim.mjs';

const blocks = [{ name: 'cell1', size: 64 }, { name: 'cell2', size: 64 }];

async function build(file) {
	const src = fs.readFileSync(file, 'utf8');
	const cfg = new AttributeClass();
	cfg.setAttribute('targetVersion', 154.3);
	const log = console.log; console.log = () => {};
	const r = await new Compiler(src, blocks.map(b => new MemoryBlock(b.name, b.size)), cfg).compile();
	console.log = log;
	return { src, result: r };
}

export async function run(file, { steps = 60000 } = {}) {
	const { src, result } = await build(file);
	if (!result.success) {
		return { success: false, errors: result.errors.map(e => e.message ?? String(e)) };
	}
	const devices = {};
	const names = [...src.matchAll(/auto\s+device\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/g)].map(m => m[1]);
	names.forEach(n => { devices[n] = makeDevice('@message', n); });
	for (const m of src.matchAll(/\b(printflush|drawflush)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/g))
		if (!devices[m[2]]) devices[m[2]] = makeDevice('@message', m[2]);
	devices.vault1 = makeDevice('@vault', 'vault1');
	devices.core1 = makeDevice('@core', 'core1');

	// --- the world -------------------------------------------------------
	let polies = 0, withinCalls = 0;
	const provider = {
		sensorProvider: (device, what) => {
			const name = (device && device.name) || String(device);
			if (name === 'switch1') return what === '@enabled' ? 1 : null;
			if (name === 'switch2') return what === '@enabled' ? 1 : null;   // balancing on
			if (name === 'switch3') return what === '@enabled' ? 0 : null;
			if (name === 'vault1') {
				if (what === '@x') return 10;
				if (what === '@y') return 20;
				if (what === '@thorium') return 700;
				return null;
			}
			if (name === 'core1') return what === '@thorium' ? 120 : null;
			if (name.startsWith('poly')) {
				if (what === '@dead') return 0;
				if (what === '@flag') return 0;      // == serial (0)
				if (what === '@totalItems') return 0;
				return null;
			}
			return undefined;                          // fall back to the built-ins
		},
		unitProvider: () => {
			polies++;
			const u = makeDevice('@poly', `poly${polies}`);
			devices[`poly${polies}`] = u;
			return u;
		},
		ucontrolProvider: (op) => {
			if (String(op) === 'within') { withinCalls++; return (withinCalls % 2) === 0; }
			return undefined;
		}
	};

	const proc = runProgram(String(result.code ?? ''), {
		links: defaultLinks(blocks.map(b => new MemoryBlock(b.name, b.size))),
		devices, maxSteps: steps, ...provider
	});
	return {
		success: true, output: proc.output(), steps: proc.steps, trap: proc.trap,
		lines: String(result.code ?? '').split('\n').filter(l => l.trim()).length,
		effects: (proc.effects ?? []).length, units: polies,
		hot: proc.hotspots ? proc.hotspots(10) : [], recent: proc.recent ? proc.recent(15) : [],
		warnings: (result.warnings ?? []).map(w => w.message ?? String(w))
	};
}

if (process.argv[1] && process.argv[1].endsWith('pdtest.mjs')) {
	for (const f of process.argv.slice(2)) {
		const r = await run(f);
		console.log('===== ' + f);
		if (!r.success) { console.log('COMPILE FAILED', r.errors.join(' | ')); continue; }
		console.log(r.output);
		console.log('--- lines:', r.lines, 'steps:', r.steps, 'trap:', r.trap ?? 'none',
			'effects:', r.effects, 'units bound:', r.units);
	}
}
