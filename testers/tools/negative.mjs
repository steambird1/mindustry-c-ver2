/**
 * Programs that must NOT compile.
 *
 * Usage (from `testers/unit_tests`):  node ../tools/negative.mjs
 *
 * A case passes when the compiler refuses it, AND says something the reader
 * can act on: "cannot compile" is not the same as "explained why it cannot
 * compile".
 *
 * A case may ask for its own compile settings, following the convention the
 * other runners use (`//` or `/* *\/` both work):
 *
 *     // NOMEM            compile with NO memory block linked
 *     // VERSION: 140     compile for an older target version
 *     // KNOWN-GAP: why   the compiler accepts this one today; reported, not
 *                        silently counted as a pass
 */

import fs from 'fs';
import path from 'path';
import { simulate } from './runsim.mjs';
import { annotationsOf, annotationText, annotationWords, hasBareAnnotation } from './annotations.mjs';

const dir = 'negative';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.c')).sort();
let pass = 0, fail = 0;
const gaps = [];
for (const f of files) {
	const file = path.join(dir, f);
	const src = fs.readFileSync(file, 'utf8');
	// A setting is asked for in either comment style, so a case does not have
	// to choose between matching its neighbours and reading as one block.
	const asks = name => annotationsOf(src, name).length > 0 || hasBareAnnotation(src, name);
	// Only cases that ask for it are compiled without memory.
	const memory = asks('NOMEM') ? [] : undefined;
	const versionText = annotationWords(src, 'VERSION')[0] ?? null;
	const extra = versionText !== null ? { targetVersion: Number(versionText) } : {};
	const r = await simulate(file, memory, extra);
	if (r.success) {
		const gap = annotationText(src, 'KNOWN-GAP');
		if (gap) {
			// A case that documents what the compiler still accepts. Counting it
			// as a pass would hide it; counting it as a failure would blame the
			// pointer work for it, so it is reported on its own.
			gaps.push(`${f}: accepted today -- ${gap}`);
			continue;
		}
		console.log(`FAIL ${f}: compiled, but it must be refused`);
		fail++;
		continue;
	}
	if (r.errors.length === 0) {
		console.log(`FAIL ${f}: refused, but with no message`);
		fail++;
		continue;
	}
	console.log(`ok   ${f}  [${r.errors.map(e => e.split('\n')[0].slice(0, 90)).join(' ; ')}]`);
	pass++;
}
if (gaps.length) {
	console.log(`\nknown gaps (the compiler accepts these today):`);
	gaps.forEach(g => console.log('  ', g));
}
console.log(`\n${pass} passed, ${fail} failed, ${gaps.length} known gaps`);
