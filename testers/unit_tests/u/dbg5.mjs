import fs from 'fs';
const O = await import('../../../mindcOptimizer.js');
const cls = Object.values(O).find(v => typeof v === 'function' && v.prototype?.analyzeForStatement);
const origAFC = cls.prototype.analyzeFunctionCall;
cls.prototype.analyzeFunctionCall = function(node, info) {
  if (node.callee?.type === 'Identifier' && node.callee.name === 'bindUnits') {
    console.error('AFC bindUnits: ast.functions=', (this.ast.functions ?? []).map(f=>f.name).join(','),
      'ast.children=', (this.ast.children ?? []).map(c=>c.type+':'+(c.name??'')).join(','),
      'functionInfo=', [...this.functionInfo.keys()].join(','));
  }
  return origAFC.call(this, node, info);
};
const origRUF = cls.prototype.removeUnusedFunctions;
cls.prototype.removeUnusedFunctions = function() {
  console.error('BEFORE removeUnusedFunctions ast.functions=', (this.ast.functions??[]).map(f=>f.name).join(','));
  const r = origRUF.call(this);
  console.error('AFTER  removeUnusedFunctions ast.functions=', (this.ast.functions??[]).map(f=>f.name).join(','));
  return r;
};
const { Compiler } = await import('../../../mindc.js');
const { AttributeClass } = await import('../../../mindcBase.js');
const { MemoryBlock } = await import('../../../mindcGeneratorBase.js');
const cfg = new AttributeClass(); cfg.setAttribute('targetVersion',154.3);
const log=console.log; console.log=()=>{};
try { await new Compiler(fs.readFileSync('example7a.c','utf8'), [new MemoryBlock('cell1',64)], cfg).compile(); } catch(e) {}
console.log=log;
