/**
 * Every `mindc*.js` module must be importable as the FIRST module loaded.
 *
 * Usage (from `testers/unit_tests`):  node ../tools/loadorder.mjs
 *
 * WHY THIS SUITE EXISTS
 * ---------------------
 * The compiler's modules import each other in a circle, and a circle is only
 * a problem when a module reads a BINDING from a module that is still part-way
 * through its own body. Then the name exists but is not initialised yet, and
 * the load dies with `ReferenceError: Cannot access 'X' before
 * initialization`. `mindcInfrastructure.js` had exactly that:
 *
 *     import { Instruction, ... } from "./mindcGeneratorBase.js";
 *     export class VariableRet extends Instruction {}   // read at once
 *
 * and it did not fail here, because the tests always enter through `mindc.js`,
 * which reaches `mindcGeneratorBase.js` first and lets it finish. `main.html`
 * imports `mindcGeneratorBase.js` (for `MemoryBlock`) BEFORE `mindc.js`, so the
 * browser hit the one order the suite never tried:
 *
 *     ReferenceError: Cannot access 'Instruction' before initialization
 *         at mindcInfrastructure.js:484
 *
 * ONE PROCESS PER ENTRY, AND WHY IT HAS TO BE
 * -------------------------------------------
 * A cache-busting query string on the entry is not enough. It gives the entry
 * module a fresh record, but its imports have no query, so they are shared with
 * every other entry in the same process -- and the first one to run evaluates
 * the whole graph, after which the rest all succeed whatever the order. That
 * version of this suite reported the unfixed tree as PASSING. Each entry
 * therefore gets its own `node` process, where nothing is warm.
 *
 * The two `mindc*Worker.js` files are expected to fail: they are Web Workers
 * and assign `self.onmessage` at module scope, and `self` does not exist in
 * Node. They are listed as exempt so a real failure is not lost in the noise.
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const self = fileURLToPath(import.meta.url);
const root = path.resolve(import.meta.dirname ?? '.', '..', '..');

// A Web Worker script, not a library: it needs a `self` that Node has not got.
const EXEMPT = new Set(['mindcCompileWorker.js', 'mindcHighlightWorker.js']);

// Child mode: load exactly one module, in a process where nothing else has run.
if (process.argv[2] === '--one') {
	try {
		await import(process.argv[3]);
		process.exit(0);
	} catch (e) {
		const where = (e.stack || '').split('\n')[1]?.trim() ?? '(no stack)';
		process.stderr.write(`${e.constructor.name}: ${e.message}\n     ${where}\n`);
		process.exit(1);
	}
}

const files = fs.readdirSync(root)
	.filter(f => /^mindc.*\.js$/.test(f))
	.sort();

let pass = 0, fail = 0, skipped = 0;
for (const f of files) {
	if (EXEMPT.has(f)) {
		console.log(`skip ${f.padEnd(26)} browser-only, needs \`self\``);
		skipped++;
		continue;
	}
	const r = spawnSync(process.execPath, [self, '--one', pathToFileURL(path.join(root, f)).href], { encoding: 'utf8' });
	if (r.status === 0) { console.log(`ok   ${f.padEnd(26)} loads first`); pass++; }
	else {
		console.log(`FAIL ${f.padEnd(26)} cannot be the first module loaded`);
		process.stdout.write(r.stderr.replace(/^/gm, '     '));
		fail++;
	}
}
console.log(`\n${pass} passed, ${fail} failed, ${skipped} exempt`);
console.log('A failure here is an import cycle, not a compiler bug: the module reads a');
console.log('binding at module scope that a partially-evaluated module has not made yet.');
process.exit(fail === 0 ? 0 : 1);
