import fs from 'fs';
import { simulate } from './runsim.mjs';
import { annotationText, annotationWords } from './annotations.mjs';

/*
Every directory that has no runner of its own. The bar here is deliberately
lower than `check.mjs`'s: the program must COMPILE, RUN TO COMPLETION, and not
TRAP. It is coverage for the cases that nobody was compiling at all -- a
compiler change that broke one of them used to be invisible to all five
runners.

Annotations this runner reads:

  /* KNOWN-GAP: prose *​/   the case does not meet that bar today, for the
                            reason written down in the file itself. Reported
                            on its own line instead of failing, the way
                            negative.mjs reports a case the compiler still
                            accepts -- and if the case starts passing, the
                            annotation is called out as stale rather than
                            quietly left behind.
  /* EXPECT: a b c *​/      the printed output, one line per value, compared
                            the same way `check.mjs` compares it. Only two
                            files carry it, but an annotation no runner reads
                            is an assertion nobody makes.

It does NOT read `NOMEM` / `VERSION` / `EMIT` -- those belong to the runners
that know how to act on them -- and `runsim.mjs` handles `DEVICES`, `LINKS`
and `PEER` for every runner.
*/
const dirs = [
	'suite', 'mem', 'arr', 'arr2', 'ptr2', 'stack',
	'tests', 'uc', 'cases', 'exttests', 'hdr', 't', 'big', 'u'
];

let ok = 0;
const bad = [], gaps = [], stale = [];
for (const d of dirs) {
  for (const f of fs.readdirSync(d).filter(x => x.endsWith('.c')).sort()) {
    const rel = `${d}/${f}`;
    const src = fs.readFileSync(rel, 'utf8');
    const gap = annotationText(src, 'KNOWN-GAP');
    const r = await simulate(rel);
    const why = !r.success ? `COMPILE: ${r.errors.join('|')}`
      : (r.trap ? `TRAP: ${r.trap}` : null);
    if (why) {
      (gap ? gaps : bad).push(gap ? `${rel}: ${why} -- ${gap}` : `${rel}: ${why}`);
      continue;
    }
    if (gap) { stale.push(`${rel}: runs clean now, so the KNOWN-GAP annotation is stale`); ok++; continue; }
    const expected = annotationWords(src, 'EXPECT');
    if (expected.length) {
      const got = r.output.trim().split('\n').filter(x => x !== '');
      const same = got.length === expected.length && got.every((g, i) => g === expected[i]);
      if (!same) { bad.push(`${rel}: EXPECT wanted [${expected.join(' ')}] got [${got.join(' ')}]`); continue; }
    }
    ok++;
  }
}
console.log(`ran ok: ${ok}/${ok + bad.length + gaps.length}`);
bad.forEach(b => console.log('  ', b));
if (gaps.length) {
  console.log(`known gaps (${gaps.length}, reported rather than failed):`);
  gaps.forEach(g => console.log('  ', g));
}
stale.forEach(s => console.log('  ', s));
