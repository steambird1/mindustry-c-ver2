import fs from 'fs';
import { Compiler } from '../src/mindc.js';
import { AttributeClass } from '../src/mindcBase.js';
import { MemoryBlock } from '../src/mindcGeneratorBase.js';
const cfg = new AttributeClass(); cfg.setAttribute('targetVersion', 154.3);
const log = console.log; console.log = () => {};
const blocks = [{ name: 'bank1', size: 64 }];
const r = await new Compiler(fs.readFileSync('big/example6.c', 'utf8'),
  blocks.map(b => new MemoryBlock(b.name, b.size)), cfg).compile();
console.log = log;
console.log('success', r.success, (r.errors??[]).map(e=>e.message).join('|'));
String(r.code ?? '').split('\n').filter(l => l.trim()).forEach((l, i) => console.log(i, l));
