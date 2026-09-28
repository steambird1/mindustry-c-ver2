import fs from 'fs';
import path from 'path';
import { simulate } from './runsim.mjs';
import { annotationsOf, annotationWords, hasBareAnnotation, codeOnly } from './annotations.mjs';

const dir = 'check';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.c') && !f.includes('__INV')).sort();

/*
Annotations a test file may carry in comments:

  /* EXPECT: 1 2 *​/                the printed output, one line per value
  /* EMIT: <regex> *​/               the generated code MUST contain a line
                                     matching this (repeatable)
  /* EMIT-NOT: <regex> *​/           the generated code MUST NOT contain such
                                     a line (repeatable)
  /* NO-INVARIANT *​/                skip the pragma-invariance run below
  /* NO-INVARIANT: optimize(array) *​/   skip only these pragmas

An annotation is read out of the comments by `annotations.mjs`, and its value
runs to the END OF ITS LINE -- so it may contain `*`, which a regex usually
does. Nothing is read out of a pattern inside a comment: what a comment says is
never evidence about the code.

Why shape assertions exist: several bugs produced code that COMPILED and RAN TO
COMPLETION while being wrong -- a `byname` pointer quietly degrading into an
ordinary memory pointer, `&rs` reading a register that was never assigned. The
printed output happened not to catch any of them. Looking at the generated code
is what does.

Why pragma invariance exists: the same program must mean the same thing however
it is compiled. Optimisation switches are not supposed to change what it prints,
so every test is compiled again with each optional pragma turned on and the
output is compared. That is nearly free coverage -- and it is exactly how the
`byname` bug (which only showed up without `#pragma optimize(pointer)`) would
have been caught.
*/

/** Pragmas that must not change what a program prints. */
const INVARIANCE_PRAGMAS = [
	'#pragma optimize(pointer)',
	'#pragma optimize(array)',
	'#pragma optimize(struct_pointer)',
	'#pragma noinline',
	'#pragma overload(auto)'
];

function linesOf(code) {
	return String(code ?? '').split('\n').map(l => l.trim()).filter(l => l.length > 0);
}

let pass = 0, fail = 0;
let shapeChecked = 0, invarianceChecked = 0;

for (const f of files) {
	const full = path.join(dir, f);
	const src = fs.readFileSync(full, 'utf8');
	const expectedList = annotationWords(src, 'EXPECT');
	const r = await simulate(full);
	const problems = [];
	if (!r.success) { console.log(`FAIL ${f}: compile error: ${r.errors.join(' | ')}`); fail++; continue; }
	if (r.trap) { console.log(`FAIL ${f}: runtime trap: ${r.trap}`); fail++; continue; }
	const got = r.output.trim().split('\n').filter(x => x !== '');
	if (expectedList.length) {
		const ok = got.length === expectedList.length && got.every((g, i) => g === expectedList[i]);
		if (!ok) problems.push(`     expected [${expectedList.join(' ')}] got [${got.join(' ')}]`);
	}

	// ---- shape assertions ----
	const codeLines = linesOf(r.code);
	for (const pat of annotationsOf(src, 'EMIT')) {
		shapeChecked++;
		let re;
		try { re = new RegExp(pat); } catch { problems.push(`     bad EMIT regex: ${pat}`); continue; }
		if (!codeLines.some(l => re.test(l))) problems.push(`     EMIT not found: /${pat}/`);
	}
	for (const pat of annotationsOf(src, 'EMIT-NOT')) {
		shapeChecked++;
		let re;
		try { re = new RegExp(pat); } catch { problems.push(`     bad EMIT-NOT regex: ${pat}`); continue; }
		const hit = codeLines.find(l => re.test(l));
		if (hit) problems.push(`     EMIT-NOT matched: /${pat}/ -> ${hit}`);
	}

	// ---- pragma invariance ----
	const skipSet = new Set(annotationsOf(src, 'NO-INVARIANT'));
	// A bare `NO-INVARIANT` means "all"; `NO-INVARIANT: x` is in the set above.
	const skipAll = hasBareAnnotation(src, 'NO-INVARIANT');
	// The file is asked about its CODE: a comment that explains a pragma must
	// not be mistaken for the file using it, or the run below is skipped for
	// exactly the files that talk about the pragma most.
	const code = codeOnly(src);
	if (!skipAll) {
		for (const pragma of INVARIANCE_PRAGMAS) {
			if (skipSet.has(pragma)) continue;
			// Do not contradict what the file already says
			const kind = pragma.slice('#pragma '.length).split('(')[0];
			if (new RegExp(`#pragma\\s+${kind}\\b`).test(code)) continue;
			invarianceChecked++;
			/*
			Written to a real file next to the original, because `simulate`
			resolves `// PEER:` / `// SELF:` relative to the file it is given --
			handing it the source text instead silently drops the peer, and the
			test then fails for a reason that has nothing to do with the pragma.
			The name is excluded from the file list (see `files`).
			*/
			const alt = path.join(dir, `${path.basename(f, '.c')}__INV.c`);
			fs.writeFileSync(alt, `${pragma}\n${src}`);
			let v;
			try { v = await simulate(alt, undefined, {}); }
			finally { fs.unlinkSync(alt); }
			if (!v.success) {
				problems.push(`     with ${pragma}: compile error: ${v.errors.join(' | ')}`);
				continue;
			}
			if (v.trap) { problems.push(`     with ${pragma}: runtime trap: ${v.trap}`); continue; }
			const vgot = v.output.trim().split('\n').filter(x => x !== '');
			if (vgot.join(' ') !== got.join(' ')) {
				problems.push(`     with ${pragma}: output changed [${got.join(' ')}] -> [${vgot.join(' ')}]`);
			}
		}
	}

	if (problems.length) {
		console.log(`FAIL ${f}`);
		problems.forEach(p => console.log(p));
		fail++;
	} else {
		console.log(`ok   ${f}  [${got.join(' ')}]`);
		pass++;
	}
}
console.log(`\n${pass} passed, ${fail} failed  (${shapeChecked} shape assertions, ${invarianceChecked} pragma-invariance runs)`);
