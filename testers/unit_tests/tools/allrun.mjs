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
/*
A BASELINE of failures nobody has got round to fixing (endless loops waiting on
units, headers that are missing here, ...). Without one, a list like that is
read as noise -- and a NEW failure, which is the only thing that really matters,
hides inside it. Anything not in the baseline is marked NEW, and anything in it
that now passes is marked RESOLVED so the entry can be deleted.
*/
const baselinePath = 'unit_tests/known-failures.txt';
const known = new Map();
if (fs.existsSync(baselinePath)) {
	for (const line of fs.readFileSync(baselinePath, 'utf8').split('\n')) {
		const text = line.trim();
		if (!text || text.startsWith('#')) continue;
		const at = text.indexOf(' ');
		known.set(at < 0 ? text : text.slice(0, at),
			at < 0 ? '' : text.slice(at + 1).trim());
	}
}
const keyOf = text => String(text).split(':')[0].trim();
const failing = new Set(bad.map(keyOf));
console.log(`ran ok: ${ok}/${ok + bad.length}`);
let fresh = 0;
bad.forEach(b => {
	const isNew = !known.has(keyOf(b));
	if (isNew) fresh++;
	console.log('  ', isNew ? '[NEW] ' + b : b);
});
/*
Only meaningful when the WHOLE suite ran: in single-directory mode everything
else looks "resolved" simply because it was not tried.
*/
if (!only.length) {
	for (const k of known.keys()) {
		if (!failing.has(k)) console.log('   [RESOLVED, drop from baseline]', k);
	}
}
if (fresh) console.log(`   ${fresh} NEW failure(s) -- these are regressions`);
