p = '/data/workspace/sim.mjs'
s = open(p, encoding='utf-8').read()

# ---------- 1. stepOne(): run one instruction at a time ----------
old_run = '''	run() {
		this.pc = 0;
		this.steps = 0;
		while (!this.halted) {
			if (this.pc < 0 || this.pc >= this.instructions.length) break;
			if (++this.steps > this.maxSteps) {
				this.trap = 'step limit exceeded (probably an infinite loop)';
				break;
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
				break;
			}
		}
		return this;
	}
'''
new_run = '''	/**
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
'''
assert s.count(old_run) == 1, s.count(old_run)
s = s.replace(old_run, new_run)

# ---------- 2. runProcessors(): several programs, one world ----------
anchor = '''/**
 * Compile-and-run helper: takes the emitted program text and runs it.
 */'''
assert s.count(anchor) == 1

addition = '''/**
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
	const initBudget = options.initSteps ?? 20000;
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

''' + anchor

s = s.replace(anchor, addition)
open(p, 'w', encoding='utf-8').write(s)
print('sim.mjs patched')
