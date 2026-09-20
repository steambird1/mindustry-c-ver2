import fs from 'fs';
import { simulate } from './runsim.mjs';
const dirs = ['suite', 'mem', 'arr', 'arr2', 'ptr2'];
let ok = 0, bad = [];
for (const d of dirs) {
  for (const f of fs.readdirSync(d).filter(x => x.endsWith('.c')).sort()) {
    const r = await simulate(`${d}/${f}`);
    if (!r.success) { bad.push(`${d}/${f}: COMPILE: ${r.errors.join('|')}`); continue; }
    if (r.trap) { bad.push(`${d}/${f}: TRAP: ${r.trap}`); continue; }
    ok++;
  }
}
console.log(`ran ok: ${ok}/${ok + bad.length}`);
bad.forEach(b => console.log('  ', b));
