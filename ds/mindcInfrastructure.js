import { Instruction, InstructionBuilder, MemoryManager } from "../mindcGeneratorBase.js";
import { TypeInfo } from "../mindcSemantic.js";

/*
This file consists of only 1-operator methods; methods with more operators will require
temporary storage because the evaluation of another operator might result in conflicts when calling functions!
*/

export class InfrastructureNotImplementedExpection {

}

export class InvalidCastException {
    constructor(from, to) {
        this.from = from;
        this.to = to;
    }
}

export class Globals {
    /**
     * @callback tempVarAssigner
     * @returns {string}
    */
    /**
     * 
     * @param {MemoryManager} mem 
     * @param {tempVarAssigner} tmpCaller
     */
    constructor(mem, tmpCaller) {
        this.memory = mem;
        this.tmpCaller = tmpCaller;
    }
}

export class VariableRet extends Instruction {

    /**
     * @param {Globals} glob 
     * @param {Instruction[]} instructions 
     * @param {string?} returner 
     * @param {TypeInfo} type 
     */
    constructor(glob, instructions, returner, type) {
        super(instructions, returner);
        this.glob = glob;
        this.type = type;

        this.temporary = false;
    }

    /**
     * 
     * @returns {VariableRet}
     */
    get() {
        return this;
    }

    /**
     * 
     * @param {VariableRet} other 
     * @returns {VariableRet}
     */
    set(other) {
        throw InvalidCastException(other, this);
    }
}

export class BasicRet extends VariableRet {

    /**
     * 
     * @param {VariableRet} other 
     * @returns {BasicRet}
     */
    set(other) {
        if (other instanceof BasicRet) {
            if (other.temporary) {
                return new BasicRet(this.glob,
                    [this.instructions, other.replace_variable(this.instructionReturn, other.instructionReturn)],
                    this.instructionReturn, this.type
                );
            } else {
                return new BasicRet(this.glob,
                    [this.instructions, other.instructions,
                    InstructionBuilder.set(this.instructionReturn, other.instructionReturn)], this.instructionReturn, this.type);
            }
        } else if (other instanceof PointerRet) {
            const tmp = this.glob.tmpCaller();
            return this.set(other.fetch(tmp));
        } else {
            return super.set(other);
        }
    }
}

export class IntRet extends BasicRet {

    /**
     * 
     * @param {VariableRet} other
     * @returns {IntRet} 
     */
    set(other) {
        if (other instanceof IntRet) {
            return super.set(other);
        } else if (other instanceof FloatRet) {
            const result = super.set(other);
            return new IntRet(this.glob, [
                result.instructions, InstructionBuilder.op('float', this.instructionReturn, this.instructionReturn)
            ], this.type);
        } else if ((other instanceof MemPointerRet) && !(other instanceof VolatilePointerRet)) {
            const tmp = this.glob.tmpCaller();
            return new IntRet(this.glob,
                [other.instructions, 
                    InstructionBuilder.reads(tmp, `${other.instructionReturn}_block`, 3),
                    InstructionBuilder.op('sub', tmp, 4),
                    InstructionBuilder.op('add', tmp, `${other.instructionReturn}_pos`),
                    InstructionBuilder.set(this.instructionReturn, tmp)], this.type);
        } else if (other instanceof ContentRet) {
            const result = super.set(other);
            return new IntRet(this.glob, [
                result.instructions, InstructionBuilder.sensor(this.instructionReturn, result.instructionReturn, '@id')
            ], this.type);
        } else {

        }
    }
}

export class FloatRet extends BasicRet {

}

export class ContentRet extends BasicRet {

}

export class PointerRet extends VariableRet {
    /**
     * The returning of this depends on the type returned.
     * 
     * @param {string} target
     * @returns {BasicRet}
     */
    fetch(target) {
        throw InfrastructureNotImplementedExpection();
    }
}

export class MemPointerRet extends PointerRet {

}

export class VolatilePointerRet extends MemPointerRet {

}