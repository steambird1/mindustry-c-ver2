import fs from 'fs';
const O = await import('../src/mindcOptimizer.js');
const cls = Object.values(O).find(v => typeof v === 'function' && v.prototype?.analyzeForStatement);
let round = -1;
const origPass = cls.prototype.optimizationPass;
cls.prototype.optimizationPass = function() { round++; console.error('=== ROUND', round); return origPass.call(this); };
const origAF = cls.prototype.analyzeFunction;
cls.prototype.analyzeFunction = function(node, info) {
  console.error('  analyzeFunction r'+round, node.name, 'body type', node.body?.type, 'stmts', node.body?.statements?.length);
  return origAF.call(this, node, info);
};
const origAW = cls.prototype.analyzeWhileStatement;
cls.prototype.analyzeWhileStatement = function(node, info) {
  console.error('  analyzeWhile r'+round, 'body', node.body?.type);
  return origAW.call(this, node, info);
};
const origAC = cls.prototype.analyzeCompoundStatement;
cls.prototype.analyzeCompoundStatement = function(node, info) {
  console.error('  analyzeCompound r'+round, 'stmts', (node.statements??[]).map(s=>s.type).join(','));
  return origAC.call(this, node, info);
};
const { Compiler } = await import('../src/mindc.js');
const { AttributeClass } = await import('../src/mindcBase.js');
const { MemoryBlock } = await import('../src/mindcGeneratorBase.js');
const cfg = new AttributeClass(); cfg.setAttribute('targetVersion',154.3);
const log=console.log; console.log=()=>{};
try { await new Compiler(fs.readFileSync('example7a.c','utf8'), [new MemoryBlock('cell1',64)], cfg).compile(); } catch(e) {}
console.log=log;
