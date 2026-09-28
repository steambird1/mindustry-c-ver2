/* Compile a program with the local `include/` directory served as `/include/`. */
import fs from 'fs';
import path from 'path';
const INCLUDE = path.resolve('include');
globalThis.fetch = async (url) => {
  const raw = String(url).replace(/^https?:\/\/[^/]+/, '');
  const file = raw.replace(/^\/+include\//, '').replace(/^\/+/, '');
  const full = path.join(INCLUDE, file);
  if (!fs.existsSync(full)) return { ok: false, status: 404, text: async () => '' };
  return { ok: true, status: 200, text: async () => fs.readFileSync(full, 'utf8') };
};
const { Compiler } = await import('../../mindc.js');
const { AttributeClass } = await import('../../mindcBase.js');
const { MemoryBlock } = await import('../../mindcGeneratorBase.js');

export async function build(srcFile, blocks = [{ name: 'bank1', size: 64 }]) {
  const cfg = new AttributeClass(); cfg.setAttribute('targetVersion', 154.3);
  const log = console.log; console.log = () => {};
  const source = fs.readFileSync(srcFile, 'utf8');
  let r;
  try { r = await new Compiler(source, blocks.map(b => new MemoryBlock(b.name, b.size)), cfg).compile(); }
  catch (e) { console.log = log; return { success: false, thrown: e.message, errors: [], warnings: [], code: '' }; }
  console.log = log;
  return { success: r.success, errors: (r.errors ?? []).map(e => `${e.message} @${e.line}:${e.column ?? ''}`), warnings: (r.warnings ?? []).map(e => e.message), code: String(r.code ?? '') };
}
if (process.argv[2]) {
  const r = await build(process.argv[2]);
  console.log('success:', r.success);
  if (r.thrown) console.log('THROWN:', r.thrown);
  console.log('errors:', r.errors.join('\n  '));
  console.log('warnings:', r.warnings.slice(0, 12).join('\n  '));
  if (r.success) console.log('instructions:', r.code.split('\n').filter(l => l.trim()).length);
}
