import { CompilerExtensionBase } from "../mindc.js";
import { BuiltinCallNode, ASTVisitor, ASTNode } from "../mindcBase.js";
import { CodeGenerator, InternalGenerationFailure } from "../mindcGenerator.js";
import { Instruction, InstructionBuilder, SingleInstruction, FunctionRegisterer } from "../mindcGeneratorBase.js";
import { TypeInfo } from "../mindcSemantic.js";

export class CodeSizeEstimator extends ASTVisitor {

    /**
     * 
     * @param {ASTNode} ast 
     * @param {{
     *    hasMemory: boolean
     *    recursiveFunctions: Set<string>
     * }} config 
     */
    constructor(ast, config) {
        this.ast = ast;
        this.config = config;
    }

    /**
     * @returns {number}
     */
    evaluate() {
        let result = this.config.hasMemory ? 80 : 0;
        
    }
}