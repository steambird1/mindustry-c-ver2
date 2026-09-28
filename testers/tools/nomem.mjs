/**
 * The same contract as `check.mjs`, but with NO memory block linked.
 *
 * Usage (from `testers/unit_tests`):  node ../tools/nomem.mjs
 *
 * A program here has nowhere to put a `block` / `pos` pair, so every pointer
 * in it has to be a name pointer. The suite is what keeps the two apart:
 *  - a program that asks for a name (`int *byname`, `byname(&x)`,
 *    `#pragma optimize(pointer)`, a `byname` parameter) has to compile AND run;
 *  - a program that uses a pointer any other way has to be REFUSED with a
 *    diagnostic (see the `negative` suite and `../tools/negative.mjs`).
 */

import fs from 'fs';
import path from 'path';
import { simulate } from './runsim.mjs';
import { annotationWords } from './annotations.mjs';

const dir = 'nomem';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.c')).sort();
let pass = 0, fail = 0;
for (const f of files) {
	const src = fs.readFileSync(path.join(dir, f), 'utf8');
	const expectedList = annotationWords(src, 'EXPECT');
	// The whole point of the suite: nothing is linked.
	const r = await simulate(path.join(dir, f), []);
	if (!r.success) { console.log(`FAIL ${f}: compile error: ${r.errors.join(' | ')}`); fail++; continue; }
	if (r.trap) { console.log(`FAIL ${f}: runtime trap: ${r.trap}`); fail++; continue; }
	const got = r.output.trim().split('\n').filter(x => x !== '');
	const ok = got.length === expectedList.length && got.every((g, i) => g === expectedList[i]);
	if (ok) { console.log(`ok   ${f}  [${got.join(' ')}]`); pass++; }
	else { console.log(`FAIL ${f}\n     expected [${expectedList.join(' ')}]\n     got      [${got.join(' ')}]`); fail++; }
}
console.log(`\n${pass} passed, ${fail} failed`);
