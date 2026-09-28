import fs from 'fs';
import { Compiler } from '../../../mindc.js';
import { AttributeClass } from '../../../mindcBase.js';
import { MemoryBlock } from '../../../mindcGeneratorBase.js';
export async function compileFile(path, blocks = [{name:'cell1',size:64}]) {
  const cfg = new AttributeClass(); cfg.setAttribute('targetVersion', 154.3);
  const log = console.log; console.log = () => {};
  let r;
  try { r = await new Compiler(fs.readFileSync(path,'utf8'), blocks.map(b=>new MemoryBlock(b.name,b.size)), cfg).compile(); }
  catch(e) { console.log = log; return {success:false, err:String(e?.message??e)}; }
  console.log = log;
  return r;
}
if (process.argv[1].endsWith('run.mjs')) {
  const r = await compileFile(process.argv[2]);
  if (!r.success) { console.log('COMPILE FAILED', JSON.stringify(r.errors?.map(e=>e.message??String(e)) ?? r.err)); process.exit(0); }
  const lines = String(r.code??'').split('\n');
  const i = lines.findIndex(l=>/^op add _main/.test(l));
  const body = i>=0 ? lines.slice(i) : lines;
  console.log('--- instructions:', lines.length, '---');
  console.log(body.slice(0, Number(process.env.N ?? 40)).join('\n'));
}
