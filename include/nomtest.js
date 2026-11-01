/*
Test extension for nominal-pointer support.

`nomstore(&x, value)` declares parameter 0 as a nominal pointer: the handler
asks the compiler for a register name (or a temporary plus write-back when the
target lives in memory) and emits `set <operand> <value>`.
*/
import { CompilerExtensionBase } from "../mindc.js";
import { Instruction, SingleInstruction } from "../mindcGeneratorBase.js";

export const extension = new CompilerExtensionBase(
    new Map(),
    new Map([
        ['nomstore', {
            name: 'nomstore',
            returnType: 'void',
            parameters: ['int', 'int'],
            nominalPointers: [0]
        }]
    ]),
    new Map([
        ['nomstore', (cg, ast) => {
            const out = cg.nominalPointerOperand(ast.arguments[0]);
            const value = cg.visitAndRead(ast.arguments[1]);
            const result = new Instruction();
            result.concat(out.before);
            result.concat(value);
            result.concat(new SingleInstruction({
                content: `set ${out.operand} ${value.instructionReturn}`,
                referrer: []
            }));
            result.concat(out.after);
            return result;
        }]
    ])
);
