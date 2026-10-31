/**
 * Compile a Mindustry-C program and RUN the result on the simulator.
 *
 * Usage:  node runsim.mjs file.c [memory-spec.json]
 * Prints the program output (what it printed to message boards).
 */

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { Compiler, defaultExtensions } from '../../mindc.js';
import { AttributeClass } from '../../mindcBase.js';
import { MemoryBlock, } from '../../mindcGeneratorBase.js';
import { runProgram, runProcessors, makeDevice, defaultLinks } from './sim.mjs';

/*
`#include "merui.h"` is fetched with `fetch('/include/merui.h')` -- that path
is the web server's, and there is no server here. Answering it from the
project's own `include/` directory is what makes the header tests runnable
from Node at all.
*/
const INCLUDE_ROOT = path.resolve(import.meta.dirname ?? '.', '..', '..', 'include');
const nodeFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
	const text = String(url ?? '');
	if (text.startsWith('/include/')) {
		const file = path.join(INCLUDE_ROOT, text.slice('/include/'.length));
		if (fs.existsSync(file)) {
			return new Response(fs.readFileSync(file, 'utf8'), { status: 200 });
		}
		return new Response('', { status: 404 });
	}
	return nodeFetch ? nodeFetch(url, options) : Promise.reject(new Error(`fetch is not available (${text})`));
};

/*
`#include "something.js"` pulls in a COMPILER EXTENSION (a set of extra types,
functions and code generators). In the browser the lexer does
`import('/include/something.js')`; there is no server here, so the extension is
loaded from the repository-root `include/` instead and handed to the Compiler
directly -- and the `#include` line is commented out, so the lexer does not try
to import it and fail.
*/
const EXT_ROOT = path.resolve(import.meta.dirname ?? '.', '..', '..', 'include');
const extensionCache = new Map();
async function loadNamedExtension(name) {
	if (extensionCache.has(name)) return extensionCache.get(name);
	const file = path.join(EXT_ROOT, name);
	if (!fs.existsSync(file)) return null;
	const module = await import(pathToFileURL(file).href);
	extensionCache.set(name, module?.extension ?? null);
	return module?.extension ?? null;
}

/**
 * @param {string} source
 * @returns {Promise<{source: string, extensions: any[]}>}
 */
async function collectExtensions(source) {
	const extensions = [];
	let text = String(source ?? '');
	for (const m of text.matchAll(/^[ \t]*#[ \t]*include[ \t]+"([^"]+\.js)"[ \t]*$/gm)) {
		const ext = await loadNamedExtension(m[1]);
		if (!ext) continue;
		extensions.push(ext);
		// Keep the line (line numbers matter) but stop it being an include
		text = text.replace(m[0], `// (extension ${m[1]} loaded by the test runner)`);
	}
	return { source: text, extensions };
}

export async function compileAndRun(source, memoryBlocks = [{ name: 'bank1', size: 64 }, { name: 'bank2', size: 64 }], extraAttributes = {}) {
	const config = new AttributeClass();
	config.setAttribute('targetVersion', 154.3);
	for (const [k, v] of Object.entries(extraAttributes)) config.setAttribute(k, v);
	const { source: prepared, extensions } = await collectExtensions(source);
	const compiler = new Compiler(prepared, memoryBlocks.map(b => new MemoryBlock(b.name, b.size)), config,
		extensions.length ? [...defaultExtensions, ...extensions] : undefined);
	const log = console.log; console.log = () => {};
	const result = await compiler.compile();
	console.log = log;
	return { result, memoryBlocks };
}

export async function simulate(pathOrSource, memoryBlocks, extraAttributes = {}) {
	const source = pathOrSource.includes('\n') || !/\.c$/.test(pathOrSource)
		? pathOrSource : fs.readFileSync(pathOrSource, 'utf8');
	const runs = Math.max(1, Math.min(100,
		Number((source.match(/\/\/\s*RUNS:\s*(\d+)/i) || [])[1]) || 1));
	const { result, memoryBlocks: blocks } = await compileAndRun(source, memoryBlocks, extraAttributes);
	if (!result.success) {
		return { success: false, errors: (result.errors ?? []).map(e => e.message ?? String(e)), output: '', warnings: [] };
	}
	// Bind `auto device NAME` declarations to real devices
	const devices = {};
	const deviceNames = [...source.matchAll(/auto\s+device\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/g)].map(m => m[1]);
	if (deviceNames.length === 0) deviceNames.push('message1');
	/*
	A test may say what its buildings are:
	    // DEVICES: cell2_id=memory, vault1=container
	    // SENSOR: vault1 @copper 1234
	so that `memsp` / `read` / `write` have a real memory to work on and
	`sensor` answers with a known value.
	*/
	const askedKinds = new Map();
	for (const m of source.matchAll(/\/\/\s*DEVICES:\s*([^\n]*)/g)) {
		for (const part of m[1].split(',')) {
			const [nm, kind] = part.split('=').map(x => x.trim());
			if (nm) askedKinds.set(nm, kind ?? 'memory');
		}
	}
	const sensors = new Map();
	for (const m of source.matchAll(/\/\/\s*SENSOR:\s*([A-Za-z_][\w]*)\s+(@\w+)\s+(-?\d+(?:\.\d+)?)/g)) {
		sensors.set(`${m[1]} ${m[2]}`, Number(m[3]));
	}
	/*
	`int *remote` and friends need a SECOND program: the peer that owns the
	variables being reached. A test declares one with
	    // PEER: processor1                 (uses <this file>.peer.c)
	    // PEER: processor1=other.c, p2=third.c
	Peers are compiled with the same memory blocks and run FIRST, so that the
	main program finds registers that already exist -- `int *remote` reads
	`q_block` / `q_pos` straight out of the peer.
	*/
	const peerSources = [];
	if (typeof pathOrSource === 'string' && /\.c$/.test(pathOrSource)) {
		const dir = path.dirname(pathOrSource);
		const base = path.basename(pathOrSource, '.c');
		for (const m of source.matchAll(/\/\/\s*PEER:\s*([^\n]*)/g)) {
			for (const part of m[1].split(',')) {
				const spec = part.trim();
				if (!spec) continue;
				const [nm, file] = spec.split('=').map(x => x.trim());
				if (!nm) continue;
				const target = path.join(dir, file || `${base}.peer.c`);
				if (!fs.existsSync(target)) {
					return { success: false, errors: [`peer program '${target}' not found`], output: '', warnings: [] };
				}
				const { result: pr } = await compileAndRun(fs.readFileSync(target, 'utf8'), blocks, extraAttributes);
				if (!pr.success) {
					return {
						success: false,
						errors: (pr.errors ?? []).map(e => `peer ${nm}: ${e.message ?? String(e)}`),
						output: '', warnings: []
					};
				}
				peerSources.push({ name: nm, deviceName: nm, code: String(pr.code ?? '') });
			}
		}
	}
	const links = defaultLinks(blocks);
	/*
	What a name really is decides whether the program can even run: `read` /
	`write` / `memsp` need a building with memory cells, `remote` needs
	ANOTHER PROCESSOR (one that owns variables of its own), and `printflush`
	needs a message board. Guessing wrong turns a correct program into a
	"memory index out of range" trap, so the kind is derived from how the name
	is used in the source:

	    `// DEVICES: name=kind`   > being one of the linked memory blocks
	    > being flushed to        > looking like a processor
	    > used by read/write/memsp > a message board (the default)
	*/
	const flushed = new Set([...source.matchAll(/\b(?:printflush|drawflush)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/g)].map(m => m[1]));
	const inMemory = new Set([...source.matchAll(/\b(?:read|write|memsp)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*[,)]/g)].map(m => m[1]));
	const looksLikeProcessor = name => /^(?:proc|processor|micro)/i.test(name) || /processor/i.test(name);
	const makeFor = (name, kind) => {
		if (kind === 'memory') return makeDevice('@memory-cell', name, 64);
		if (kind === 'container') return makeDevice('@container', name);
		if (kind === 'processor') return makeDevice('@processor', name);
		return makeDevice('@message', name);
	};
	deviceNames.forEach(name => {
		const linked = links.find(l => l.name === name && l.cells.length > 0);
		const kind = askedKinds.get(name)
			?? (linked ? 'memory' : null)
			?? (flushed.has(name) ? 'message' : null)
			?? (looksLikeProcessor(name) ? 'processor' : null)
			?? 'memory';
		// A linked memory block must stay THE SAME object as the link.
		devices[name] = (kind === 'memory' && linked) ? linked : makeFor(name, kind);
	});
	// Extra devices used by the program (displays etc.)
	for (const m of source.matchAll(/\b(printflush|drawflush)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/g)) {
		if (!devices[m[2]]) devices[m[2]] = makeDevice('@message', m[2]);
	}
	/*
	A building is only reachable because it is LINKED: that is how `getlink`
	hands it out and how `memsp` finds it. So every named building joins the
	link list (after the memory blocks the compiler was given, so their indices
	stay where programs expect them), unless the test already linked it.
	*/
	for (const [name, dev] of Object.entries(devices)) {
		if (dev.kind === 'processor' || dev.vars instanceof Map) continue;	// a peer processor is not wired here
		if (links.some(l => l === dev || l.name === name)) continue;
		links.push(dev);
	}

	/*
	Some tests need a building that is really LINKED (that is what `memsp`
	searches through), not merely named.
	    // LINKS: cell2_id=memory
	*/
	for (const m of source.matchAll(/\/\/\s*LINKS:\s*([^\n]*)/g)) {
		for (const part of m[1].split(',')) {
			const [nm, kind] = part.split('=').map(x => x.trim());
			if (!nm) continue;
			const dev = kind === 'container' ? makeDevice('@container', nm)
				: makeDevice('@memory-cell', nm, 64);
			links.push(dev);
			devices[nm] = dev;
		}
	}
	/*
	A small default world: `ulocate` finds a core at (11, 22) and
	`ucontrol "within"` succeeds, so output parameters can be checked. A test
	that needs something else passes its own provider to runProgram().
	*/
	const core = makeDevice('@core', 'core1');
	devices.core1 = core;
	const worldOptions = {
		sensorProvider: sensors.size
			? (dev, what) => {
				const key = `${dev?.name ?? dev} ${what}`;
				return sensors.has(key) ? sensors.get(key) : undefined;
			}
			: null,
		ulocateProvider: () => [11, 22, 1, core],
		ucontrolProvider: () => true
	};
	if (peerSources.length) {
		/*
		`// INTERLEAVE:` says the peers must run CONCURRENTLY with the main
		program instead of finishing first -- needed by anything that has to
		CONTEND with them (mutual exclusion, handshaking).
		*/
		if (/\/\/\s*INTERLEAVE\b/.test(source)) worldOptions.interleave = true;
		const sources = peerSources.map(p => ({ name: p.name, deviceName: p.deviceName, code: p.code }));
		/*
		`// SELF: name` is the name the PEERS know this program's processor by,
		so that they can reach back into it -- two processors that contend have
		to talk in both directions.
		*/
		const selfMatch = source.match(/\/\/\s*SELF:\s*([A-Za-z_][A-Za-z0-9_]*)/);
		sources.push({ name: '__main__', deviceName: selfMatch ? selfMatch[1] : undefined,
			code: String(result.code ?? '') });
		const world = runProcessors(sources, {
			memoryBlocks: blocks, devices, maxSteps: 5_000_000, ...worldOptions
		});
		return {
			success: true,
			errors: [],
			warnings: (result.warnings ?? []).map(w => w.message ?? String(w)),
			output: world.output,
			outputs: world.outputs,
			trap: world.trap,
			steps: world.steps,
			lines: (String(result.code ?? '').split('\n')).filter(l => l.trim()).length,
			code: String(result.code ?? '')
		};
	}
	const proc = runProgram(String(result.code ?? ''), {
		links, devices, maxSteps: 5_000_000, runs,
		...worldOptions
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
