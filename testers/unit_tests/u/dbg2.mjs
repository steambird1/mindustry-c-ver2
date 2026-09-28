import fs from 'fs';
const O = await import('../../../mindcOptimizer.js');
const cls = Object.values(O).find(v => typeof v === 'function' && v.prototype?.analyzeForStatement);
const orig = cls.prototype.fullyOptimizeDeterministicLoop;
cls.prototype.fullyOptimizeDeterministicLoop = function(loopNode, iterationCount) {
  const mv = this.collectModifiedVariablesInLoop(loopNode);
  console.error('FULL', loopNode.type, 'iterCount', iterationCount, 'modified:', [...mv].map(v=>typeof v==='object'? v.varName+'@'+(v.scope?.getPath?.()):String(v)).join(','));
  for (const v of mv) {
    if (v === 'unrecognized') continue;
    const sp = (v.scope ?? this.currentScope.lookupScopeOf(v.varName)).getPath();
    const lc = this.localConstants.get(sp);
    console.error('   var', v.varName, 'scopePath', sp, 'final=', lc?.get(v.varName), 'isGlobal', v.symbol?.isGlobal, 'isConst', v.symbol?.isConst);
  }
  return orig.call(this, loopNode, iterationCount);
};
const { Compiler } = await import('../../../mindc.js');
const { AttributeClass } = await import('../../../mindcBase.js');
const { MemoryBlock } = await import('../../../mindcGeneratorBase.js');
const cfg = new AttributeClass(); cfg.setAttribute('targetVersion', 154.3);
const log = console.log; console.log = () => {};
await new Compiler(fs.readFileSync(process.argv[2],'utf8'), [new MemoryBlock('cell1',64)], cfg).compile();
console.log = log;
