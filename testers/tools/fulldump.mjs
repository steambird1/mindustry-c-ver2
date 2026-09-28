import fs from 'fs';
import { Compiler } from '../../mindc.js';
import { AttributeClass } from '../../mindcBase.js';
import { MemoryBlock } from '../../mindcGeneratorBase.js';

export async function compileTo(file, blocks) {
    const src = fs.readFileSync(file, 'utf8');
    const cfg = new AttributeClass();
    cfg.setAttribute('targetVersion', 154.3);
    const c = new Compiler(src, blocks.map(b => new MemoryBlock(b.name, b.size)), cfg);
    const log = console.log; console.log = () => {};
    const r = await c.compile();
    console.log = log;
    return String(r.code ?? '');
}

if ((process.argv[1] ?? '').endsWith('fulldump.mjs') && process.argv[2]) {
    console.log(await compileTo(process.argv[2], JSON.parse(process.argv[3] ?? '[{"name":"bank1","size":32}]')));
}
