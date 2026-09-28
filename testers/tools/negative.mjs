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
 *
 * A case may also say WHICH refusal it wants, as a regex per line:
 *
 *     MESSAGE: cannot have an 'auto' parameter
 *
 * This is the negative side of "the right value for the right reason". A
 * program that must not compile is very often refused for several unrelated
 * reasons at once, and a case that only asks "did it fail" passes on whichever
 * comes first -- so it keeps passing after the check it documents is deleted,
 * which is exactly how a deleted check goes unnoticed. Every MESSAGE line has
 * to match some error the compiler actually gave.
 */

import fs from 'fs';
import path from 'path';
import { simulate } from './runsim.mjs';
import { annotationsOf, annotationText, annotationWords, hasBareAnnotation } from './annotations.mjs';

const dir = 'negative';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.c')).sort();
let pass = 0, fail = 0;
const gaps = [];
const askedReason = new Set();
for (const f of files) {
	const file = path.join(dir, f);
	const src = fs.readFileSync(file, 'utf8');
	if (annotationsOf(src, 'MESSAGE').length) askedReason.add(f);
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
	// Which refusal, not merely that there was one.
	const wanted = annotationsOf(src, 'MESSAGE');
	let wrongReason = null;
	for (const pattern of wanted) {
		const re = new RegExp(pattern);
		if (!r.errors.some(e => re.test(e))) {
			wrongReason = `refused, but not for this reason: no message matches /${pattern}/`;
			break;
		}
	}
	if (wrongReason) {
		console.log(`FAIL ${f}: ${wrongReason}`);
		console.log(`     said instead: ${r.errors.map(e => e.split('\n')[0].slice(0, 110)).join(' ; ')}`);
		fail++;
		continue;
	}
	const tag = wanted.length ? `  [${wanted.length} reason(s) checked]` : '';
	console.log(`ok   ${f}  [${r.errors.map(e => e.split('\n')[0].slice(0, 90)).join(' ; ')}]${tag}`);
	pass++;
}
if (gaps.length) {
	console.log(`\nknown gaps (the compiler accepts these today):`);
	gaps.forEach(g => console.log('  ', g));
}
const unreasoned = files.filter(f => !askedReason.has(f));
if (unreasoned.length) {
	console.log(`\n${unreasoned.length} case(s) say nothing about WHICH refusal they want, so they`
		+ ` would pass on any error at all:`);
	console.log('  ', unreasoned.join(' '));
}
console.log(`\n${pass} passed, ${fail} failed, ${gaps.length} known gaps`);
