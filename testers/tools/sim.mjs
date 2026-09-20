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
import { objectList, liquidList, unitList, buildingList } from './src/mindcBase.js';

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
	return {
		kind: 'device',
		type,
		name,
		id: nextDeviceId++,
		cells: new Array(Math.max(cells, 0)).fill(0)
	};
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
		this.regs = new Map();
		this.links = options.links ?? [];
		this.namedDevices = options.devices ?? {};
		this.maxSteps = options.maxSteps ?? 2_000_000;
		this.buffer = '';
		this.lines = [];
		this.draws = [];
		this.steps = 0;
		this.halted = false;
		this.trap = null;
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
				case '@this': return { kind: 'processor' };
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
				case '@unit': return null;
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
				this.writeRegister(target, this.applyOp(sub, x, y));
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
				if (device && device.kind === 'processor') {
					/*
					`read r @this <name>` : a DYNAMICALLY named register. The
					operand names another register whose VALUE is the name to
					read -- so the name has to be resolved twice.
					*/
					const key = String(this.readOperand(index));
					this.writeRegister(target, this.regs.has(key) ? this.regs.get(key) : 0);
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
				const what = args[2] ? args[2].raw : '';
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
			case 'draw':
			case 'drawflush': {
				this.draws.push(ins.text);
				next(); return;
			}
			case 'stop':
			case 'end': {
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
				// Nothing is modelled as being in range: the result is "no unit"
				this.writeRegister(this.nameOfToken(args[0]), null);
				next(); return;
			}
			case 'ulocate': {
				const target = this.nameOfToken(args[0]);
				this.writeRegister(target, null);
				if (args[4]) this.writeRegister(this.nameOfToken(args[4]), null);
				(this.effects ??= []).push(ins.text);
				next(); return;
			}
			case 'ucontrol':
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
			case 'and': return (n(x) !== 0 && n(y) !== 0) ? 1 : 0;
			case 'or': return (n(x) !== 0 || n(y) !== 0) ? 1 : 0;
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

	run() {
		this.pc = 0;
		this.steps = 0;
		while (!this.halted) {
			if (this.pc < 0 || this.pc >= this.instructions.length) break;
			if (++this.steps > this.maxSteps) {
				this.trap = 'step limit exceeded (probably an infinite loop)';
				break;
			}
			try {
				this.step();
			} catch (e) {
				this.trap = `${e.message} (at instruction ${this.pc}: ${this.instructions[this.pc]?.text ?? '?'})`;
				break;
			}
		}
		return this;
	}

	/** Everything printed, in order. */
	output() {
		return this.lines.map(l => l.text).join('');
	}
}

/**
 * Compile-and-run helper: takes the emitted program text and runs it.
 */
export function runProgram(code, options = {}) {
	const instructions = parseProgram(code);
	const proc = new Processor(instructions, options);
	return proc.run();
}
