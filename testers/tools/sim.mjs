/**
 * A simulator for the Mindustry Logic machine language emitted by Mindustry-C.
 *
 * It executes the compiled program instruction by instruction and records what
 * the program prints, so that the correctness of an optimisation can be checked
 * by RUNNING the program instead of by looking at the code.
 *
 * Usage:  node sim.mjs program.mlog [links.json]
 */

import fs from 'fs';
import { objectList, liquidList, unitList, buildingList } from '../../mindcBase.js';

/* ------------------------------------------------------------------ *
 * Content tables (the @constants the processor knows about)
 * ------------------------------------------------------------------ */
const CONTENT_TABLES = {
	item: objectList,
	liquid: liquidList,
	unit: unitList,
	block: buildingList
};

const NAME_OF = new Map();
/** `@name` -> numeric content id, mirroring `logicids.dat` */
const ID_OF = new Map();
for (const list of Object.values(CONTENT_TABLES)) {
	for (const entry of list) NAME_OF.set(entry, entry.slice(1));
}
for (const [category, list] of Object.entries(CONTENT_TABLES)) {
	list.forEach((entry, index) => ID_OF.set(entry, index));
}

/**
 * The id of a `@name` content, or null when the simulator does not know it.
 *
 * @param {string} name
 * @returns {number?}
 */
export function contentIdOf(name) {
	return ID_OF.has(name) ? ID_OF.get(name) : null;
}

/* ------------------------------------------------------------------ *
 * Parsing
 * ------------------------------------------------------------------ */
function tokenize(line) {
	const tokens = [];
	let i = 0;
	while (i < line.length) {
		while (i < line.length && /\s/.test(line[i])) i++;
		if (i >= line.length) break;
		if (line[i] === '"') {
			let j = i + 1, s = '';
			while (j < line.length && line[j] !== '"') {
				if (line[j] === '\\') { j++; s += (line[j] === 'n') ? '\n' : line[j]; }
				else s += line[j];
				j++;
			}
			tokens.push({ string: s });
			i = j + 1;
		} else {
			let j = i;
			while (j < line.length && !/\s/.test(line[j])) j++;
			tokens.push({ raw: line.slice(i, j) });
			i = j;
		}
	}
	return tokens;
}

/**
 * Strip a leading comment and trailing comment from a line.
 */
function clean(line) {
	const hash = line.indexOf('#');
	if (hash >= 0) {
		// A '#' inside a string is not a comment; be conservative
		const quotes = (line.slice(0, hash).match(/"/g) ?? []).length;
		if (quotes % 2 === 0) line = line.slice(0, hash);
	}
	return line.trim();
}

export function parseProgram(text) {
	const instructions = [];
	text.split('\n').forEach(rawLine => {
		const line = clean(rawLine);
		if (!line) return;
		const tokens = tokenize(line);
		if (tokens.length === 0) return;
		const op = tokens[0].raw;
		// A bare `name:` would be a label; this compiler does not emit any, but
		// accept them so hand written programs work too.
		if (tokens.length === 1 && op.endsWith(':')) return;
		instructions.push({ op, args: tokens.slice(1), text: line, index: instructions.length });
	});
	return instructions;
}

/* ------------------------------------------------------------------ *
 * Devices
 * ------------------------------------------------------------------ */
let nextDeviceId = 1;

export function makeDevice(type, name, cells = 0) {
	const dev = {
		kind: 'device',
		type,
		name,
		id: nextDeviceId++,
		cells: new Array(Math.max(cells, 0)).fill(0)
	};
	/*
	Another processor has variables of its own: that is exactly what makes
	`read x processor1 "name"` different from reading this one.
	*/
	if (String(type).includes('processor')) dev.vars = new Map();
	return dev;
}

/**
 * Whether a value is a processor building (this one, or another one).
 * @param {any} device
 * @returns {boolean}
 */
function isProcessor(device) {
	return !!device && (device.kind === 'processor' || (device.vars instanceof Map));
}

/**
 * The default link layout: a message board first (so the link scanner has to
 * skip it), then the memory blocks the compiler was given.
 */
export function defaultLinks(memoryBlocks) {
	const links = [makeDevice('@message', 'message1')];
	for (const block of memoryBlocks) links.push(makeDevice('@memory-cell', block.name, block.size));
	return links;
}

/* ------------------------------------------------------------------ *
 * The processor
 * ------------------------------------------------------------------ */
export class Processor {
	/**
	 * @param {any[]} instructions
	 * @param {{links?: any[], devices?: Record<string, any>, maxSteps?: number}} [options]
	 */
	constructor(instructions, options = {}) {
		this.instructions = instructions;
		/*
		`options.self`: a processor building whose `vars` ARE this program's
		registers. That is what makes two programs able to see each other: the
		second one reads and writes the very same map.
		*/
		this.self = options.self ?? null;
		this.regs = this.self?.vars ?? new Map();
		this.links = options.links ?? [];
		this.namedDevices = options.devices ?? {};
		this.maxSteps = options.maxSteps ?? 2_000_000;
		this.buffer = '';
		this.lines = [];
		this.draws = [];
		this.steps = 0;
		this.pc = 0;
		this.halted = false;
		this.stopped = false;
		this.ended = false;
		this.trap = null;
		// Callbacks a test may install to model the world itself
		this.sensorProvider = options.sensorProvider ?? null;
		this.unitProvider = options.unitProvider ?? null;
		this.ucontrolProvider = options.ucontrolProvider ?? null;
		this.ulocateProvider = options.ulocateProvider ?? null;
	}

	/* ---------------- values ---------------- */

	counterValue() {
		// @counter is the index of the NEXT instruction
		return this.pc + 1;
	}

	deviceNamed(name) {
		if (this.namedDevices[name]) return this.namedDevices[name];
		for (const link of this.links) if (link.name === name) return link;
		return null;
	}

	readOperand(token, { writeTarget = false } = {}) {
		if (token.string !== undefined) return token.string;
		const raw = token.raw;
		if (raw === 'null') return null;
		// `true` and `false` are literals in this machine language
		if (raw === 'true') return 1;
		if (raw === 'false') return 0;
		if (raw.startsWith('@')) {
			switch (raw) {
				case '@counter': return this.counterValue();
				case '@this': return this.self ?? { kind: 'processor' };
				case '@links': return this.links.length;
				case '@ipt': return 10;
				case '@pi': return Math.PI;
				case '@e': return Math.E;
				case '@degToRad': return Math.PI / 180;
				case '@radToDeg': return 180 / Math.PI;
				case '@time': return this.steps * 0.1;
				case '@tick': return this.steps;
				case '@second': return this.steps / 60;
				case '@minute': return this.steps / 3600;
				case '@waveNumber': return 1;
				case '@waveTime': return 0;
				case '@mapw': return 256;
				case '@maph': return 256;
				case '@server': return 1;
				case '@client': return 1;
				case '@clientLocale': return 'en';
				case '@clientName': return 'sim';
				case '@clientTeam': return 'sharded';
				case '@clientUnit': return null;
				case '@clientMobile': return 0;
				case '@blockCount': return buildingList.length;
				case '@unitCount': return unitList.length;
				case '@itemCount': return objectList.length;
				case '@liquidCount': return liquidList.length;
				// `ubind` puts the unit here; until then there is no bound unit
				case '@unit': return this.regs.has('@unit') ? this.regs.get('@unit') : null;
				case '@thisx': return 0;
				case '@thisy': return 0;
				default: return raw;	// a content constant such as @copper
			}
		}
		if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(raw)) return Number(raw);
		const device = this.deviceNamed(raw);
		if (device) return device;
		if (this.regs.has(raw)) return this.regs.get(raw);
		return 0;	// An unset variable reads as zero
	}

	writeRegister(name, value) {
		this.regs.set(name, value);
	}

	nameOfToken(token) {
		return token.string !== undefined ? token.string : token.raw;
	}

	/* ---------------- formatting ---------------- */

	format(value) {
		if (value === null || value === undefined) return 'null';
		if (typeof value === 'object') {
			if (value.kind === 'device') return value.name;
			if (value.kind === 'processor') return '@this';
		}
		if (typeof value === 'number') {
			if (Number.isInteger(value)) return String(value);
			// Mindustry prints a few decimals
			return String(Math.round(value * 1e6) / 1e6);
		}
		return String(value);
	}

	toNumber(value) {
		if (typeof value === 'number') return value;
		if (typeof value === 'boolean') return value ? 1 : 0;
		if (typeof value === 'string') {
			const n = Number(value);
			return Number.isNaN(n) ? 0 : n;
		}
		if (value === null || value === undefined) return 0;
		if (typeof value === 'object') return 0;
		return 0;
	}

	/* ---------------- execution ---------------- */

	cell(device, index) {
		if (!device || typeof device !== 'object' || !Array.isArray(device.cells)) {
			throw new Error(`read/write on something that is not a memory device: ${this.format(device)}`);
		}
		const i = Math.trunc(this.toNumber(index));
		if (i < 0 || i >= device.cells.length) {
			throw new Error(`memory index ${i} out of range for ${device.name}`);
		}
		return i;
	}

	step() {
		const ins = this.instructions[this.pc];
		if (!ins) { this.halted = true; return; }
		const next = () => { this.pc++; };
		const args = ins.args;
		const a = i => this.readOperand(args[i]);

		switch (ins.op) {
			case 'set': {
				const target = this.nameOfToken(args[0]);
				if (target === '@counter') { this.pc = Math.trunc(this.toNumber(a(1))); return; }
				this.writeRegister(target, a(1));
				next(); return;
			}
			case 'op': {
				const sub = args[0].raw;
				const target = this.nameOfToken(args[1]);
				const x = a(2);
				const y = args.length > 3 ? a(3) : 0;
				const value = this.applyOp(sub, x, y);
				/*
				`@counter` is not an ordinary register: WRITING to it is a jump,
				whatever instruction does the writing. `op add @counter @counter n`
				is how a computed jump table is built, so treating it as a plain
				store would run straight through the table instead of picking
				one entry.
				*/
				if (target === '@counter') { this.pc = Math.trunc(this.toNumber(value)); return; }
				this.writeRegister(target, value);
				next(); return;
			}
			case 'jump': {
				const target = Math.trunc(this.toNumber(a(0)));
				const cond = args.length > 1 ? args[1].raw : 'always';
				if (this.testCondition(cond, args.length > 2 ? a(2) : 0, args.length > 3 ? a(3) : 0)) {
					this.pc = target;
				} else next();
				return;
			}
			case 'read': {
				const target = this.nameOfToken(args[0]);
				const device = a(1);
				const index = args[2];
				if (device && isProcessor(device) && device.kind === 'processor') {
					/*
					`read r @this <name>` : a DYNAMICALLY named register. The
					operand names another register whose VALUE is the name to
					read -- so the name has to be resolved twice.
					*/
					const key = String(this.readOperand(index));
					this.writeRegister(target, this.regs.has(key) ? this.regs.get(key) : 0);
				} else if (device && isProcessor(device)) {
					/*
					Reading a variable of ANOTHER processor: this is what
					`remote` compiles to.
					*/
					const key = String(this.readOperand(index));
					this.writeRegister(target, device.vars.has(key) ? device.vars.get(key) : 0);
				} else if (typeof device === 'string') {
					/*
					`read r "hello" i` -- reading one character of a string. This
					is how string indexing and the "encoded" constant array
					layout are implemented.
					*/
					const i = Math.trunc(this.toNumber(a(2)));
					const code = (i >= 0 && i < device.length) ? device.charCodeAt(i) : 0;
					this.writeRegister(target, code);
				} else {
					this.writeRegister(target, device.cells[this.cell(device, a(2))]);
				}
				next(); return;
			}
			case 'write': {
				const value = a(0);
				const device = a(1);
				const index = args[2];
				if (device && device.kind === 'processor') {
					this.writeRegister(index.string ?? this.readOperand(index), value);
				} else if (device && isProcessor(device)) {
					// Writing a variable of ANOTHER processor
					const key = String(index.string ?? this.readOperand(index));
					device.vars.set(key, value);
				} else {
					device.cells[this.cell(device, a(2))] = value;
				}
				next(); return;
			}
			case 'getlink': {
				const target = this.nameOfToken(args[0]);
				const n = Math.trunc(this.toNumber(a(1)));
				this.writeRegister(target, n >= 0 && n < this.links.length ? this.links[n] : null);
				next(); return;
			}
			case 'sensor': {
				const target = this.nameOfToken(args[0]);
				/*
				The property may be a VARIABLE, not only a literal `@name`:
				`sensor(r, dev, target)` passes `content_t` around, and the
				generated code is then `sensor r dev g:.f:work.target`. Taking
				the operand's text gave the register's NAME, which no property
				matches -- so every such read came back `null`. Read the register
				when it is one.
				*/
				const propToken = args[2] ? this.nameOfToken(args[2]) : '';
				const what = this.regs.has(propToken)
					? this.regs.get(propToken) : (args[2] ? args[2].raw : '');
				this.writeRegister(target, this.sense(a(1), what));
				next(); return;
			}
			case 'lookup': {
				const table = args[0].raw;
				const target = this.nameOfToken(args[1]);
				const index = Math.trunc(this.toNumber(a(2)));
				const list = CONTENT_TABLES[table] ?? objectList;
				this.writeRegister(target, list[index] ?? null);
				next(); return;
			}
			case 'select': {
				const target = this.nameOfToken(args[0]);
				const cond = args[1].raw;
				const x = a(2), y = a(3);
				const onTrue = a(4), onFalse = a(5);
				this.writeRegister(target, this.testCondition(cond, x, y) ? onTrue : onFalse);
				next(); return;
			}
			case 'print': {
				this.buffer += this.format(a(0)) + '\n';
				next(); return;
			}
			case 'printflush': {
				const device = a(0);
				this.lines.push({ target: device ? device.name : String(args[0].raw), text: this.buffer });
				this.buffer = '';
				next(); return;
			}
			case 'draw': {
				/*
				Besides drawing, this is used to DECLARE variables: in mlog a
				name only becomes a variable once an instruction uses it, and
				`read` / `write` on a processor refuse names never declared.
				So every plain name among the operands is touched here.
				*/
				for (const arg of args) {
					const raw = arg.string !== undefined ? null : arg.raw;
					if (!raw || raw === 'null') continue;
					if (/^[A-Za-z_]/.test(raw) && this.regs.has(raw) === false
						&& !raw.startsWith('@') && !/^-?\d/.test(raw)) {
						this.regs.set(raw, 0);
					}
				}
				this.draws.push(this.instructions[this.pc].raw);
				next(); return;
			}
			case 'drawflush': {
				this.draws.push(ins.text);
				next(); return;
			}
			case 'stop': {
				this.stopped = true;
				this.halted = true; return;
			}
			case 'end': {
				/*
				A processor restarts at instruction 0 after `end`; the runner's
				`runs` option reuses this flag to preserve registers/memory
				between passes. A single-run caller still sees a halted program.
				*/
				this.ended = true;
				this.halted = true; return;
			}
			case 'noop':
			case 'wait':
			case 'sync': {
				next(); return;
			}
			/* ---------- acting on the world: recorded, not simulated ---------- */
			case 'control': {
				(this.controls ??= []).push(ins.text);
				next(); return;
			}
			case 'radar':
			case 'ubind': {
				// Nothing is modelled as being in range unless a caller says so
				const binder = this.unitProvider;
				const found = (typeof binder === 'function')
					? (binder(this.nameOfToken(args[0])) ?? null) : null;
				this.writeRegister('@unit', found);
				this.writeRegister(this.nameOfToken(args[0]), found);
				next(); return;
			}
			case 'ulocate': {
				/*
				`ulocate <category> ... outx outy found building` -- the last
				four operands are OUTPUT parameters: the processor writes the
				result into those registers. Nothing is found by default, which
				a caller may override with `ulocateProvider`.
				*/
				const provider = this.ulocateProvider;
				const outs = args.slice(-4).map(a => this.nameOfToken(a));
				const result = (typeof provider === 'function') ? provider(outs) : null;
				outs.forEach((name, i) => {
					this.writeRegister(name, result ? (result[i] ?? null) : null);
				});
				(this.effects ??= []).push(ins.text);
				next(); return;
			}
			case 'ucontrol': {
				const provider = this.ucontrolProvider;
				if (typeof provider === 'function') {
					const out = provider(this.nameOfToken(args[0]), args.slice(1).map(a => this.nameOfToken(a)));
					if (out !== undefined) {
						this.writeRegister(this.nameOfToken(args[4]), out ? 1 : 0);
					}
				}
				(this.effects ??= []).push(ins.text);
				next(); return;
			}
			case 'uradar':
			case 'effect':
			case 'spawn':
			case 'status':
			case 'message':
			case 'cutscene':
			case 'explosion':
			case 'setrate':
			case 'setprop':
			case 'setrule':
			case 'flushmessage':
			case 'sync': {
				(this.effects ??= []).push(ins.text);
				next(); return;
			}
			case 'setflag': {
				(this.flags ??= new Map());
				this.flags.set(args[0].raw, Math.trunc(this.toNumber(a(1))) !== 0);
				next(); return;
			}
			/*
			The world-editing instructions (`setblock`, `spawnwave`, ...): nothing
			of the map is modelled, so they are recorded and forgotten. The two
			that hand a value BACK (`getblock`, `weathersense`) still have to
			write their output register -- otherwise the program reads a register
			that was never set.
			*/
			case 'getblock': {
				// getblock <type> <out> x y
				this.writeRegister(this.nameOfToken(args[1]), null);
				(this.effects ??= []).push(ins.text);
				next(); return;
			}
			case 'weathersense': {
				// weathersense <out> <weather>
				this.writeRegister(this.nameOfToken(args[0]), 0);
				(this.effects ??= []).push(ins.text);
				next(); return;
			}
			case 'setblock':
			case 'weatherset':
			case 'spawnwave':
			case 'playsound':
			case 'makemarker':
			case 'setmarker':
			case 'minimap':
			case 'fetch':
			case 'localeprint': {
				(this.effects ??= []).push(ins.text);
				next(); return;
			}
			case 'getflag': {
				(this.flags ??= new Map());
				const target = this.nameOfToken(args[0]);
				this.writeRegister(target, this.flags.get(args[1] ? args[1].raw : '') ? 1 : 0);
				next(); return;
			}
			default:
				throw new Error(`unsupported instruction: ${ins.text}`);
		}
	}

	/**
	 * Read a property off a device.
	 *
	 * A caller may install `processor.sensorProvider = (device, property) => ...`
	 * to model the world: whatever it returns (as long as it is not `undefined`)
	 * is used. Otherwise the built-in properties are consulted, and anything
	 * unknown reads as `null` -- which is what an unconnected / dead device
	 * yields in the real game.
	 *
	 * @param {any} device
	 * @param {string} what
	 * @returns {any}
	 */
	sense(device, what) {
		const provider = this.sensorProvider;
		if (typeof provider === 'function') {
			const value = provider(device, what);
			if (value !== undefined) return value;
		}
		if (typeof device === 'string' && device.startsWith('@')) {
			if (what === '@name') return NAME_OF.get(device) ?? device.slice(1);
			if (what === '@type') return device;
			// `sensor out @copper @id` -- the id is the position in the table
			if (what === '@id') return ID_OF.get(device) ?? null;
			return null;
		}
		if (device && device.kind === 'device') {
			if (what === '@type') return device.type;
			if (what === '@name') return device.name;
			return null;
		}
		return null;
	}

	applyOp(sub, x, y) {
		const n = v => this.toNumber(v);
		switch (sub) {
			case 'add': return n(x) + n(y);
			case 'sub': return n(x) - n(y);
			case 'mul': return n(x) * n(y);
			case 'div': return n(y) === 0 ? 0 : n(x) / n(y);
			case 'idiv': return n(y) === 0 ? 0 : Math.floor(n(x) / n(y));
			case 'mod': return n(y) === 0 ? 0 : n(x) % n(y);
			case 'pow': return Math.pow(n(x), n(y));
			case 'equal': return this.looseEqual(x, y) ? 1 : 0;
			case 'notEqual': return this.looseEqual(x, y) ? 0 : 1;
			case 'strictEqual': return this.strictEq(x, y) ? 1 : 0;
			case 'lessThan': return n(x) < n(y) ? 1 : 0;
			case 'lessThanEq': return n(x) <= n(y) ? 1 : 0;
			case 'greaterThan': return n(x) > n(y) ? 1 : 0;
			case 'greaterThanEq': return n(x) >= n(y) ? 1 : 0;
			// `op and` / `op or` are BITWISE in the machine language (they are
			// how a packed value is taken apart), not logical.
			case 'and': return Math.trunc(n(x)) & Math.trunc(n(y));
			case 'or': return Math.trunc(n(x)) | Math.trunc(n(y));
			case 'land': return (n(x) !== 0 && n(y) !== 0) ? 1 : 0;
			case 'xor': return Math.trunc(n(x)) ^ Math.trunc(n(y));
			case 'shl': return Math.trunc(n(x)) << Math.trunc(n(y));
			case 'shr': return Math.trunc(n(x)) >> Math.trunc(n(y));
			case 'not': return ~Math.trunc(n(x));
			case 'abs': return Math.abs(n(x));
			case 'floor': return Math.floor(n(x));
			case 'ceil': return Math.ceil(n(x));
			case 'sqrt': return Math.sqrt(n(x));
			case 'sin': return Math.sin(n(x));
			case 'cos': return Math.cos(n(x));
			case 'tan': return Math.tan(n(x));
			case 'log': return Math.log(n(x));
			case 'log10': return Math.log10(n(x));
			case 'max': return Math.max(n(x), n(y));
			case 'min': return Math.min(n(x), n(y));
			case 'rand': return 0;
			case 'atan2': return Math.atan2(n(x), n(y));
			case 'dst': return Math.hypot(n(x), n(y));
			case 'len': return Math.hypot(n(x), n(y));
			case 'angle': return Math.atan2(n(y), n(x)) * 180 / Math.PI;
			case 'noise': return 0;
			default: throw new Error(`unsupported operation: op ${sub}`);
		}
	}

	looseEqual(x, y) {
		if (typeof x === 'object' || typeof y === 'object') return this.strictEq(x, y);
		if (typeof x === 'string' || typeof y === 'string') {
			return String(x) === String(y);
		}
		return this.toNumber(x) === this.toNumber(y);
	}

	strictEq(x, y) {
		if (x && y && typeof x === 'object' && typeof y === 'object') return x.id === y.id;
		if (typeof x === 'string' && typeof y === 'string') return x === y;
		if (typeof x === 'object' || typeof y === 'object') return false;
		if (x === null || y === null) return (x === null && y === null);
		return this.toNumber(x) === this.toNumber(y);
	}

	testCondition(cond, x, y) {
		switch (cond) {
			case 'always': return true;
			case 'equal': return this.looseEqual(x, y);
			case 'notEqual': return !this.looseEqual(x, y);
			case 'strictEqual': return this.strictEq(x, y);
			case 'lessThan': return this.toNumber(x) < this.toNumber(y);
			case 'lessThanEq': return this.toNumber(x) <= this.toNumber(y);
			case 'greaterThan': return this.toNumber(x) > this.toNumber(y);
			case 'greaterThanEq': return this.toNumber(x) >= this.toNumber(y);
			case 'and': return this.toNumber(x) !== 0 && this.toNumber(y) !== 0;
			case 'or': return this.toNumber(x) !== 0 || this.toNumber(y) !== 0;
			default: throw new Error(`unsupported condition: ${cond}`);
		}
	}

	/**
	 * Everything the processor asked the world to do: `control` calls, `draw`
	 * calls, unit / effect commands. Handy for checking generated code.
	 *
	 * @returns {string[]}
	 */
	actions() {
		return [...(this.controls ?? []), ...(this.draws ?? []), ...(this.effects ?? [])];
	}

	/**
	 * Execute ONE instruction.
	 *
	 * @returns {boolean} false once this program cannot continue any further
	 *          (halted, ran off the end, over its step limit, or trapped)
	 */
	stepOne() {
		if (this.halted) return false;
		if (this.pc < 0 || this.pc >= this.instructions.length) { this.halted = true; return false; }
		if (++this.steps > this.maxSteps) {
			this.trap = 'step limit exceeded (probably an infinite loop)';
			this.halted = true;
			return false;
		}
		this.counts ??= new Map();
		this.history ??= [];
		this.history.push(this.pc);
		if (this.history.length > 40) this.history.shift();
		this.counts.set(this.pc, (this.counts.get(this.pc) ?? 0) + 1);
		try {
			this.step();
		} catch (e) {
			this.trap = `${e.message} (at instruction ${this.pc}: ${this.instructions[this.pc]?.text ?? '?'})`;
			this.halted = true;
			return false;
		}
		return true;
	}

	run() {
		this.pc = 0;
		this.steps = 0;
		while (this.stepOne()) { /* one instruction at a time */ }
		return this;
	}

	/** Everything printed, in order. */
	hotspots(n = 8) {
		const counts = this.counts ?? new Map();
		return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
			.map(([pc, c]) => `${c}x  ${pc}: ${this.instructions[pc]?.text ?? '?'}`);
	}

	recent(n = 20) {
		return (this.history ?? []).slice(-n)
			.map(pc => `${pc}: ${this.instructions[pc]?.text ?? '?'}`);
	}
	output() {
		return this.lines.map(l => l.text).join('');
	}
}

/**
 * Run several compiled programs together, as the processors of ONE world.
 *
 * This is what `remote` needs -- and what `int *remote` cannot be tested
 * without: the other processor has to really exist and really own the
 * variables being read and written. Two things make that work here:
 *
 *   - every program's registers ARE its processor building's `vars`, so
 *     `read x processor1 "n"` finds what the other program really stored;
 *   - every program numbers its links the SAME way, because a pointer is a
 *     link INDEX and that index only means anything if both sides agree. The
 *     links are one message board, then the shared memory blocks, then the
 *     processors -- always in this order, for every program.
 *
 * @param {{name: string, code: string, deviceName?: string}[]} sources
 *        The LAST entry is the program under test; the others are the peers it
 *        talks to. `deviceName` is the name the OTHER programs know it by
 *        (`auto device processor1`), and defaults to its own name.
 * @param {{memoryBlocks?: {name: string, size: number}[], devices?: Object,
 *          maxSteps?: number, initSteps?: number}} [options]
 */
export function runProcessors(sources, options = {}) {
	const blocks = (options.memoryBlocks ?? [{ name: 'bank1', size: 64 }, { name: 'bank2', size: 64 }])
		.map(b => makeDevice('@memory-cell', b.name, b.size));
	/*
	`@micro-processor` gives the device a `vars` map, which the Processor then
	uses AS its registers -- that is what makes one program able to read the
	registers of another.
	*/
	const selves = sources.map(src => makeDevice('@micro-processor', src.name));
	const nameFor = i => sources[i].deviceName ?? sources[i].name;
	const shared = options.devices ?? {};
	const procs = sources.map((src, i) => {
		const devices = { ...shared };
		for (let j = 0; j < sources.length; j++) {
			if (j === i) continue;
			devices[nameFor(j)] = selves[j];
		}
		return new Processor(parseProgram(src.code), {
			self: selves[i],
			links: [makeDevice('@message', 'message1'), ...blocks, ...selves],
			devices,
			maxSteps: options.maxSteps ?? 5_000_000,
			sensorProvider: options.sensorProvider ?? null,
			unitProvider: options.unitProvider ?? null,
			ucontrolProvider: options.ucontrolProvider ?? null,
			ulocateProvider: options.ulocateProvider ?? null
		});
	});
	/*
	The peers publish their variables first. The main program is the one whose
	output matters, and it must not read registers that do not exist yet --
	`int *remote` reads `q_block` / `q_pos` straight out of the peer.
	*/
	/*
	`interleave`: every program steps from the very beginning, round robin.
	That is the only way to exercise something that needs the processors to
	CONTEND -- a mutual exclusion algorithm, for instance. Running the peers to
	completion first would let each of them finish before the next one starts,
	so nothing would ever contend at all.
	*/
	const initBudget = (options.interleave === true) ? 0 : (options.initSteps ?? 20000);
	for (let i = 0; i < procs.length - 1; i++) {
		while (!procs[i].halted && procs[i].steps < initBudget) {
			if (!procs[i].stepOne()) break;
		}
	}
	const limit = options.maxSteps ?? 5_000_000;
	let steps = 0;
	while (procs.some(p => !p.halted) && steps < limit) {
		for (const p of procs) {
			if (p.halted) continue;
			p.stepOne();
			if (++steps >= limit) break;
		}
	}
	const main = procs[procs.length - 1];
	return {
		procs,
		main,
		output: main.output(),
		outputs: procs.map(p => p.output()),
		trap: main.trap,
		traps: procs.map(p => p.trap),
		steps: procs.reduce((a, p) => a + p.steps, 0)
	};
}

/**
 * Compile-and-run helper: takes the emitted program text and runs it.
 */
export function runProgram(code, options = {}) {
	const instructions = parseProgram(code);
	const proc = new Processor(instructions, options);
	const runs = Math.max(1, Math.min(100, Number(options.runs) || 1));
	for (let pass = 0; pass < runs; pass++) {
		proc.pc = 0;
		proc.steps = 0;
		proc.halted = false;
		proc.ended = false;
		proc.run();
		if (proc.stopped || proc.trap) break;
	}
	return proc;
}
