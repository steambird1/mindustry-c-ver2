import fs from 'fs';
const O = await import('../src/mindcOptimizer.js');
const cls = Object.values(O).find(v => typeof v === 'function' && v.prototype?.analyzeForStatement);
for (const m of ['fullyOptimizeDeterministicLoop','partiallyOptimizeLoop','optimizeDeterministicWhileLoop','markLoopAsPotentiallyWithSideEffects']) {
  const orig = cls.prototype[m];
  cls.prototype[m] = function(...a) {
    const r = orig.call(this, ...a);
    if (m !== 'markLoopAsPotentiallyWithSideEffects')
      console.error('CALL', m, '->', r, a[0]?.type);
    return r;
  };
}
const { Compiler } = await import('../src/mindc.js');
const { AttributeClass } = await import('../src/mindcBase.js');
const { MemoryBlock } = await import('../src/mindcGeneratorBase.js');
const cfg = new AttributeClass(); cfg.setAttribute('targetVersion', 154.3);
const log = console.log; console.log = () => {};
const r = await new Compiler(fs.readFileSync(process.argv[2],'utf8'), [new MemoryBlock('cell1',64)], cfg).compile();
console.log = log;
