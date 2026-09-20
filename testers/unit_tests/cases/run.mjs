import fs from 'fs';
import { Compiler } from '../src/mindc.js';
import { AttributeClass } from '../src/mindcBase.js';
import { MemoryBlock } from '../src/mindcGeneratorBase.js';
const blocks = [{ name: 'cell1', size: 64 }];
export function compile(src, version = 154.3) {
	const cfg = new AttributeClass(); cfg.setAttribute('targetVersion', version);
	const log = console.log; console.log = () => {};
	return new Compiler(src, blocks.map(b => new MemoryBlock(b.name, b.size)), cfg).compile()
		.then(r => { console.log = log; return r; })
		.catch(e => { console.log = log; return { success: false, errors: [String(e?.stack ?? e)] }; });
}
if (process.argv[1] && process.argv[1].endsWith('run.mjs')) {
	const file = process.argv[2];
	const r = await compile(fs.readFileSync(file, 'utf8'), Number(process.argv[3] ?? 154.3));
	if (!r.success) { console.log('FAILED:', (r.errors ?? []).map(e => e.message ?? String(e)).join(' | ')); process.exit(0); }
	const lines = String(r.code ?? '').split('\n');
	const i = lines.findIndex(l => /^op add _main/.test(l));
	console.log(lines.slice(i).filter(l => /ulocate|coreX|coreDevice|write |read |print |set \*|@this/.test(l)).join('\n'));
}
