import fs from 'fs';
const O = await import('../../../mindcOptimizer.js');
const cls = Object.values(O).find(v => typeof v === 'function' && v.prototype?.analyzeForStatement);
const orig = cls.prototype.analyzeFunctionCall;
cls.prototype.analyzeFunctionCall = function(node, info) {
  if (node.callee?.type === 'Identifier') {
    const n = node.callee.name;
    if (!this.functionInfo.has(n) && !(this.ast.functions ?? []).some(f => f.name === n)) {
      console.error('UNKNOWN CALL NAME:', n, 'known:', [...(this.ast.functions??[])].map(f=>f.name).join(','));
    }
  }
  return orig.call(this, node, info);
};
const { Compiler } = await import('../../../mindc.js');
const { AttributeClass } = await import('../../../mindcBase.js');
const { MemoryBlock } = await import('../../../mindcGeneratorBase.js');
const cfg = new AttributeClass(); cfg.setAttribute('targetVersion',154.3);
const log=console.log; console.log=()=>{};
try { await new Compiler(fs.readFileSync(process.argv[2],'utf8'), [new MemoryBlock('cell1',64)], cfg).compile(); } catch(e) {}
console.log=log;
