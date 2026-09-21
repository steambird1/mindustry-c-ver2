import fs from 'fs';
import path from 'path';
import { Compiler } from './src/mindc.js';
import { AttributeClass } from './src/mindcBase.js';
import { MemoryBlock } from './src/mindcGeneratorBase.js';

const dir = process.argv[2] ?? 'baseline';
const files = fs.readdirSync('tests').filter(f => f.endsWith('.c')).sort();
if (!fs.existsSync(dir)) fs.mkdirSync(dir);
const out = [];
for (const f of files) {
    const source = fs.readFileSync(path.join('tests', f), 'utf8');
    const config = new AttributeClass();
    config.setAttribute('targetVersion', 154.3);
    const compiler = new Compiler(source, [new MemoryBlock('bank1', 64), new MemoryBlock('bank2', 64)], config);
    const origLog = console.log; console.log = () => {};
    let result;
    try { result = await compiler.compile(); } catch (e) { result = { success: false, code: '', errors: [{message: String(e)}] }; }
    console.log = origLog;
    const text = `### ${f} :: success=${result.success}\n` +
        (result.fatalError ? `FATAL: ${result.fatalError}\n` : '') +
        (result.errors ?? []).map(e => `ERR: ${e.message ?? e}`).join('\n') +
        '\n' + result.code + '\n';
    fs.writeFileSync(path.join(dir, f.replace('.c', '.txt')), text);
    out.push(`${f}: ${result.success ? 'OK' : 'FAIL'} errors=${(result.errors ?? []).length} lines=${result.code.split('\n').length}`);
}
console.log(out.join('\n'));
