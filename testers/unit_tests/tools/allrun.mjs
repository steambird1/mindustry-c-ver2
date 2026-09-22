/* Compile (and where possible run) every test directory. */
import fs from 'fs';
import path from 'path';
import { simulate } from '../runsim.mjs';

const dirs = fs.readdirSync('unit_tests', { withFileTypes: true })
	.filter(d => d.isDirectory()).map(d => d.name).sort();
const only = process.argv.slice(2);
let ok = 0; const bad = [];
for (const d of dirs) {
	if (only.length && !only.includes(d)) continue;
	for (const f of fs.readdirSync(path.join('unit_tests', d)).filter(x => x.endsWith('.c')).sort()) {
		const p = `${d}/${f}`;
		let r;
		try { r = await simulate(path.join('unit_tests', d, f)); }
		catch (e) { bad.push(`${p}: THROW ${e.message}`); continue; }
		if (d === 'negative') {
			if (r.success) { bad.push(`${p}: expected compile failure, got success`); continue; }
			ok++; continue;
		}
		if (!r.success) { bad.push(`${p}: COMPILE: ${r.errors.join('|')}`); continue; }
		if (r.trap) { bad.push(`${p}: TRAP: ${r.trap}`); continue; }
		ok++;
	}
}
console.log(`ran ok: ${ok}/${ok + bad.length}`);
bad.forEach(b => console.log('  ', b));
