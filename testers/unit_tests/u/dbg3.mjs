import fs from 'fs';
import { Compiler } from '../src/mindc.js';
import { AttributeClass } from '../src/mindcBase.js';
import { MemoryBlock } from '../src/mindcGeneratorBase.js';
const cfg = new AttributeClass(); cfg.setAttribute('targetVersion', 154.3);
const src = fs.readFileSync(process.argv[2],'utf8');
try {
  const r = await new Compiler(src, [new MemoryBlock('cell1',64)], cfg).compile();
  console.log('keys', Object.keys(r)); console.log('success', r.success); console.log('errors', JSON.stringify(r.errors)); console.log('warnings', JSON.stringify(r.warnings)); console.log('FNAME-LATER',);
console.log('fatal', String(r.fatalError?.message ?? r.fatalError)); console.log('stack', String(r.fatalError?.stack ?? '').split('\n').slice(0,8).join('\n'));
} catch (e) {
  console.log('THROWN:', e?.message ?? String(e));
  console.log((e?.stack ?? '').split('\n').slice(0,6).join('\n'));
}
