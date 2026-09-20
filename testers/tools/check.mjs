import fs from 'fs';
import path from 'path';
import { simulate } from './runsim.mjs';
const dir = 'check';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.c')).sort();
let pass = 0, fail = 0;
for (const f of files) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const m = src.match(/EXPECT:\s*([^*]*)\*\//);
    const expectedList = m ? m[1].trim().split(/\s+/) : [];
    const r = await simulate(path.join(dir, f));
    if (!r.success) { console.log(`FAIL ${f}: compile error: ${r.errors.join(' | ')}`); fail++; continue; }
    if (r.trap) { console.log(`FAIL ${f}: runtime trap: ${r.trap}`); fail++; continue; }
    const got = r.output.trim().split('\n').filter(x => x !== '');
    const ok = got.length === expectedList.length && got.every((g, i) => g === expectedList[i]);
    if (ok) { console.log(`ok   ${f}  [${got.join(' ')}]`); pass++; }
    else { console.log(`FAIL ${f}\n     expected [${expectedList.join(' ')}]\n     got      [${got.join(' ')}]`); fail++; }
}
console.log(`\n${pass} passed, ${fail} failed`);
