import fs from 'fs';
import path from 'path';
import { Compiler } from '../src/mindc.js';
import { AttributeClass } from '../src/mindcBase.js';
import { MemoryBlock } from '../src/mindcGeneratorBase.js';
const file = path.resolve(process.argv[2]);
const cfg = new AttributeClass(); cfg.setAttribute('targetVersion', 154.3);
const log = console.log; console.log = () => {};
let r;
try { r = await new Compiler(fs.readFileSync(file,'utf8'), [new MemoryBlock('bank1',64),new MemoryBlock('bank2',64)], cfg).compile(); }
catch (e) { console.log = log; console.log('THROWN:', e.message); process.exit(1); }
console.log = log;
console.log('success:', r.success, 'errors:', JSON.stringify((r.errors??[]).map(e=>e.message??String(e))));
const opt = new Compiler(fs.readFileSync(file,'utf8'), [new MemoryBlock('bank1',64),new MemoryBlock('bank2',64)], cfg);
// re-run to inspect optimizer state
const sem = new (Object.getPrototypeOf(opt.semanticAnalyzer).constructor)(opt);
