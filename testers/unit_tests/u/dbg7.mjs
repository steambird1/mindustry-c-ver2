import fs from 'fs';
const O = await import('../src/mindcOptimizer.js');
const cls = Object.values(O).find(v => typeof v === 'function' && v.prototype?.analyzeForStatement);
let round = -1;
const origPass = cls.prototype.optimizationPass;
cls.prototype.optimizationPass = function() { round++; console.error('=== ROUND', round); return origPass.call(this); };
const origAS = cls.prototype.analyzeScope;
cls.prototype.analyzeScope = function(scope) {
  console.error('  analyzeScope r'+round, scope?.getPath?.(), 'node=', scope?.astNode?.type, scope?.astNode?.name ?? '');
  return origAS.call(this, scope);
};
const { Compiler } = await import('../src/mindc.js');
const { AttributeClass } = await import('../src/mindcBase.js');
const { MemoryBlock } = await import('../src/mindcGeneratorBase.js');
const cfg = new AttributeClass(); cfg.setAttribute('targetVersion',154.3);
const log=console.log; console.log=()=>{};
try { await new Compiler(fs.readFileSync('example7a.c','utf8'), [new MemoryBlock('cell1',64)], cfg).compile(); } catch(e) {}
console.log=log;
