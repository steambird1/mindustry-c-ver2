import fs from 'fs';
const O = await import('../../../mindcOptimizer.js');
const cls = Object.values(O).find(v => typeof v === 'function' && v.prototype?.analyzeForStatement);
let round = -1;
const origPass = cls.prototype.optimizationPass;
cls.prototype.optimizationPass = function() { round++; console.error('=== ROUND', round); return origPass.call(this); };
const origAFC = cls.prototype.analyzeFunctionCall;
cls.prototype.analyzeFunctionCall = function(node, info) {
  if (node.callee?.type === 'Identifier')
    console.error('  AFC r'+round, node.callee.name, 'currentFunction=', this.currentFunction, 'inFI=', this.functionInfo.has(node.callee.name));
  return origAFC.call(this, node, info);
};
const origRUF = cls.prototype.removeUnusedFunctions;
cls.prototype.removeUnusedFunctions = function() {
  console.error('  RUF r'+round, 'graph=', [...this.functionCallGraph].map(([k,v])=>k+'->'+[...v].join('+')).join(' | '));
  return origRUF.call(this);
};
const { Compiler } = await import('../../../mindc.js');
const { AttributeClass } = await import('../../../mindcBase.js');
const { MemoryBlock } = await import('../../../mindcGeneratorBase.js');
const cfg = new AttributeClass(); cfg.setAttribute('targetVersion',154.3);
const log=console.log; console.log=()=>{};
try { await new Compiler(fs.readFileSync('example7a.c','utf8'), [new MemoryBlock('cell1',64)], cfg).compile(); } catch(e) {}
console.log=log;
