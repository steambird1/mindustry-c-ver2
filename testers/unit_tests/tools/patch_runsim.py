p = '/data/workspace/runsim.mjs'
s = open(p, encoding='utf-8').read()

s = s.replace(
	"import { runProgram, makeDevice, defaultLinks } from './sim.mjs';",
	"import { runProgram, runProcessors, makeDevice, defaultLinks } from './sim.mjs';", 1)
assert 'runProcessors' in s

# ---- 1. compile the peer programs declared with `// PEER:` ----
anchor = '''	const links = defaultLinks(blocks);'''
assert s.count(anchor) == 1
peers = '''	/*
	`int *remote` and friends need a SECOND program: the peer that owns the
	variables being reached. A test declares one with
	    // PEER: processor1                 (uses <this file>.peer.c)
	    // PEER: processor1=other.c, p2=third.c
	Peers are compiled with the same memory blocks and run FIRST, so that the
	main program finds registers that already exist -- `int *remote` reads
	`q_block` / `q_pos` straight out of the peer.
	*/
	const peerSources = [];
	if (typeof pathOrSource === 'string' && /\\.c$/.test(pathOrSource)) {
		const dir = path.dirname(pathOrSource);
		const base = path.basename(pathOrSource, '.c');
		for (const m of source.matchAll(/\\/\\/\\s*PEER:\\s*([^\\n]*)/g)) {
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
''' + anchor
s = s.replace(anchor, peers, 1)

# ---- 2. run peers + main together when there are peers ----
old = '''	const core = makeDevice('@core', 'core1');
	devices.core1 = core;
	const proc = runProgram(String(result.code ?? ''), {
		links, devices, maxSteps: 5_000_000,
		sensorProvider: sensors.size
			? (dev, what) => {
				const key = `${dev?.name ?? dev} ${what}`;
				return sensors.has(key) ? sensors.get(key) : undefined;
			}
			: null,
		ulocateProvider: () => [11, 22, 1, core],
		ucontrolProvider: () => true
	});'''
assert s.count(old) == 1
new = '''	const core = makeDevice('@core', 'core1');
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
		const sources = peerSources.map(p => ({ name: p.name, deviceName: p.deviceName, code: p.code }));
		sources.push({ name: '__main__', code: String(result.code ?? '') });
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
			lines: (String(result.code ?? '').split('\\n')).filter(l => l.trim()).length,
			code: String(result.code ?? '')
		};
	}
	const proc = runProgram(String(result.code ?? ''), {
		links, devices, maxSteps: 5_000_000,
		...worldOptions
	});'''
s = s.replace(old, new, 1)

open(p, 'w', encoding='utf-8').write(s)
print('runsim.mjs patched')
