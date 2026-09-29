/*
 * The instruction classes: what the generator emits, and how the pieces of
 * an emitted program refer to one another.
 *
 * They are a module of their own, and the only thing they import is
 * `mindcBase.js`, which is a leaf. That is the whole reason for the file.
 * `VariableRet` -- the base of every return class in the compiler -- is
 * declared as `class VariableRet extends Instruction`, and `extends` reads
 * the binding AT ONCE, while this module's body runs. So any module that can
 * be mid-evaluation when `mindcInfrastructure.js` is reached takes `Instruction`
 * with it. As long as this file cannot be part of a cycle, no import order
 * can put `Instruction` in the temporal dead zone under it -- which is not
 * true of `mindcGeneratorBase.js`, since that one and `mindcSemantic.js`
 * import each other.
 *
 * The historical home is `mindcGeneratorBase.js`, which re-exports all of
 * this, so an importer that wants `MemoryBlock` and `Instruction` together
 * still can.
 *
 * The JSDoc below names `SymbolEntry` and `TypeInfo`, which live in
 * `mindcSemantic.js` and are not imported here. That is deliberate, and the
 * `import('./mindcSemantic.js').X` form in those tags is how it stays honest:
 * a type position is erased before the module runs, so it adds no edge to the
 * graph above and cannot put anything in the temporal dead zone. A plain
 * `import { TypeInfo }` would be a real dependency, and would undo the file.
 */

import { AttributeClass } from "./mindcBase.js";


export class InstructionReferrerException {
	constructor(obj, caller = null, info = "") {
		this.obj = obj;
		this.caller = caller;
		this.info = "";
	}
}

// Notice: forwarding reference is prohibited.
export class InstructionReferrer {
	/**
	 * @callback referrerTransmission
	 * @param {number} position
	 * @param {InstructionReferrer | null} sich
	 * @returns {number}
	 */
	/**
	 * 
	 * @param {Instruction} towards 
	 * @param {string} name 
	 * @param {number} offset Unused!!!
	 * @param {referrerTransmission | null} [transmission=null] 
	 */
	constructor(towards, name, offset = 0, transmission = null) {
		this.isInstructionReferrer = true;
		this.isInstructionGroup = false;
		this.name = name;
		this.towards = towards;
		this.offset = offset;
		/**
		 * @type {referrerTransmission}
		 */
		this.transmission = transmission ?? ((pos, sich) => pos);
	}

	duplicate() {
		return new InstructionReferrer(this.towards, this.name, this.offset, this.transmission);
	}

	register(position) {
		const val = this.transmission(position + this.offset, this);
		if (this.towards) {
			this.towards.raw_replace(this.name, val);
		}
	}
}

// Instruction manager comes first
/*
Instruction input must be done by instruction builder!
*/
/**
 * Flatten a list of instructions.
 *
 * Several call sites build an instruction as `[other.instructions, more]`,
 * which nests a plain ARRAY inside the list. Such an element carries neither
 * `content` nor `referrer` and blows up while the code is being printed.
 * Empty slots are dropped for the same reason.
 *
 * @param {Iterable<any>} list
 * @returns {any[]}
 */
function flattenInstructions(list) {
	const result = [];
	for (const item of list) {
		if (item == null) continue;
		if (Array.isArray(item)) {
			result.push(...flattenInstructions(item));
		} else {
			result.push(item);
		}
	}
	return result;
}

export class Instruction extends AttributeClass {
	constructor(instructSequence = [], instructionReturn = null, attributes = new Map()) {
		super();
		this.isDebug = false;
		this.isInstructionGroup = true;
		let sequence;
		if (instructSequence.length !== undefined) {
			sequence = instructSequence;
		} else {
			sequence = [instructSequence];
		}
		/*
		Keep the very same array when there is nothing to fix, so that call sites
		relying on sharing it keep working exactly as before.
		*/
		const needsFix = sequence.some(item => item == null || Array.isArray(item));
		this.instructions = needsFix ? flattenInstructions(sequence) : sequence;
		this.instructionReturn = instructionReturn;	// What this instruction returns
		
		if (this.instructionReturn && (typeof this.instructionReturn === 'object')) {
			throw `Instruction return is not supposed to be an object`;
		}
		this.instructionReturn = `${this.instructionReturn}`;	// stringify
		
		this._attributes = attributes;
	}
	
	duplicate() {
		return new Instruction(instructSequence.map(inst => inst.duplicate()), this.instructionReturn, new Map([...this.attributes]));
	}

	/**
	 Connect 2 instruction types.
	 @param {Instruction} other
	 @return {Instruction} - this. This function modifies current instruction class.
	 @remark This copies the object.
	*/
	concat(other) {
		/*
		An instruction object is mutable and shared by reference: pushing the very
		same object twice (a declaration reached through two lists, say) would
		emit it twice. Identical neighbours are always a mistake.
		*/
		if (other && other.isInstructionGroup
			&& this.instructions[this.instructions.length - 1] === other) {
			return this;
		}
		if (Array.isArray(other)) {
			// A bare list is not an instruction: splice it in item by item
			flattenInstructions(other).forEach(item => this.instructions.push(item));
			return this;
		}
		/*
		const currentLength = this.instructions.length;
		other.instructions.forEach(stmt => {
			this.instructions.push({
				content: stmt.content,
				referrer: stmt.referrer.map(refId => (refId + currentLength))
			});
		});
		return this;
		*/
		if (!other) return;
		//other.isDebug = other.isDebug || this.isDebug;
		this.instructions.push(other);
		return this;
	}

	/**
	 * 
	 * @param {Instruction} other 
	 * @returns {Instruction}
	 */
	concat_returns(other) {
		if (!other) return;
		this.instructions.push(other);
		this.instructionReturn = other.instructionReturn;
		for (const retAttrib of ['isSymbolic', 'isPointer', 'isRValueMem', 'isPointerAccess', 'disallowReplacement',
			'relevantSymbol', 'isNearPointer', 'isRegStruct', 'builtinConstant'
		]) {
			this.setAttribute(retAttrib, other.getAttribute(retAttrib));
		}
		return this;
	}

	/**
	 * @param {import('./mindcSemantic.js').SymbolEntry} symbol 
	 * @returns {Instruction}
	 */
	set_returns(symbol) {
		this.instructionReturn = symbol.getAssemblySymbol();
		this.setAttribute('isPointer', symbol.accessThroughPointer || symbol.implementAsPointer);
		this.setAttribute('isPointerAccess', symbol.accessThroughPointer);
		this.setAttribute('isSymbolic', true);
		this.setAttribute('relevantSymbol', symbol);
		this.setAttribute('isNearPointer', symbol.isNearPointer);
		// this.setAttribute('isRegStruct', symbol.myType().isTypeInfo && symbol.myType().isRegStruct());
		// this.setAttribute('isStructRet', ['struct', 'union'].includes(symbol.myType().kind));
		this.setAttribute('isTemporary', symbol.isVirtualSymbol);

		const typeInfo = symbol.myType();
		return typeInfo.isTypeInfo ? this.set_returns_type(typeInfo) : this;
	}

	/**
	 * 
	 * @param {import('./mindcSemantic.js').TypeInfo?} typeInfo 
	 * @returns {Instruction}
	 */
	set_returns_type(typeInfo) {
		if (!typeInfo) return this;
		/*
		Two DIFFERENT notions are mixed up by `TypeInfo.isPointerImpl()`:
		  - "this value IS a pointer"  -> it takes two words (P_block / P_pos).
		    true only for pointer / array / memory-implemented struct-union.
		  - "this value lives in memory and is talked about THROUGH a pointer"
		    -> `volatile` scalars belong here as well, since `volatile` means
		       "this variable MUST be kept in memory". The value itself is still
		       a single word; only the access goes through `X.__pointer`.
		`isPointer` must mean the former (width!), `isPointerAccess` the latter.
		*/
		const isRealPointer = (typeInfo.kind === 'pointer' || typeInfo.kind === 'array')
			|| ((typeInfo.kind === 'struct' || typeInfo.kind === 'union') && typeInfo.isPointerImpl());
		const throughPointer = isRealPointer || typeInfo.isVolatile();
		this.setAttribute('isRegStruct', typeInfo.isRegStruct());
		this.setAttribute('isStructRet', ['struct', 'union'].includes(typeInfo.kind));
		this.setAttribute('isNearPointer', (this.getAttribute('isNearPointer') === true) || (typeInfo.isNear() && isRealPointer));
		this.setAttribute('isPointer', (this.getAttribute('isPointer') === true) || isRealPointer);
		this.setAttribute('isPointerAccess', (this.getAttribute('isPointerAccess') === true) || (throughPointer && !typeInfo.isStrictPointerImpl()));
		return this;
	}
	
	/**
	 * 
	 * @param {number} [additionalLength=0] 
	 * @param {number} [additionalIteration=0] 
	 * @returns {void}
	 */
	raw_output(additionalLength = 0, additionalIteration = 0) {
		this.inGeneration = true;
		this.currentLength = additionalLength;
		this.assignedLength = additionalLength;
		let currentIteration = 0, correction = 0;
		/*
		if (this.instructions.length == 1 && this.instructions[0].isInstructionGroup) {
			return this.instructions[0].output(additionalLength);
		}
			*/
		const result = this.instructions.flatMap(stmt => {
			if (stmt.isInstructionGroup) {
				stmt.isDebug = this.isDebug;
				const combination = stmt.raw_output(this.currentLength, correction);
				if (!stmt.getAttribute('noLineCount'))
					this.currentLength += combination.length;
				//currentIteration++;
				//correction += combination.length - 1;
				return combination;
			} else if (stmt.isInstructionReferrer) {
				// No action
				return [];
			} else {
				let code = stmt.content;
				for (let i = 0; i < stmt.referrer.length; i++) {
					let reg = new RegExp('\\{' + i + '\\}', 'g');
					if (typeof stmt.referrer[i] === 'number') {
						code = code.replace(reg, stmt.referrer[i] + additionalLength - additionalIteration);
					} else {
						code = code.replace(reg, stmt.referrer[i]);
					}
					
				}
				this.currentLength++;
				//currentIteration++;
				if (this.isDebug) {
					return [`${this.currentLength} | ${code} | ref:${stmt.referrer.toString()},addlen:${additionalLength}`];
				}
				return [code];
			}
		});
		this.inGeneration = false;
		return result;
	}

	raw_scan(additionalLength = 0) {
		this.inGeneration = true;
		this.currentLength = additionalLength;
		this.instructions.forEach(stmt => {
			if (stmt.isInstructionGroup) {
				if (!stmt.getAttribute('noLineCount'))
					this.currentLength = stmt.raw_scan(this.currentLength);
			} else if (stmt.isInstructionReferrer) {
				stmt.register(this.currentLength);
			} else {
				this.currentLength++;
			}
		});
		this.inGeneration = false;
		return this.currentLength;
	}

	output() {
		this.raw_scan();
		return this.raw_output();
	}

	raw_replace(variable, value) {
		this.instructions.forEach(stmt => {
			if (stmt.isInstructionGroup) {
				stmt.raw_replace(variable, value);
			} else if (stmt.content) {
				stmt.content = stmt.content.replace(new RegExp(`\\{${variable}\\}`, 'g'), value);
			}
		});
		return this;
	}

	raw_replace_all(variable, value) {
		if (this.instructionReturn && typeof this.instructionReturn === 'string') {
			this.instructionReturn = this.instructionReturn.replace(new RegExp(`\\{${variable}\\}`, 'g'), value);
		}
		this.instructions.forEach(stmt => {
			if (stmt.isInstructionGroup || stmt.hasBeenSingle) {
				stmt.raw_replace_all(variable, value);
			} else {
				stmt.content = stmt.content.replace(new RegExp(`\\{${variable}\\}`, 'g'), value);
			}
		});
		return this;
	}

	/**
	 * 
	 * @param {string} variable 
	 * @param {any} value 
	 * @deprecated Use raw_replace instead.
	 * @returns {Instruction}
	 */
	replace(variable, value) {
		this.instructions.forEach(stmt => {
			if (stmt.isInstructionGroup) {
				stmt.replace(variable, value);
			} else if (stmt.content && stmt.referrer) {
				stmt.content = stmt.content.replace(new RegExp(`\\{${variable}\\}`, 'g'), `{${stmt.referrer.length}}`);
				stmt.referrer.push(value);
			}
		});
		return this;
	}

	/**
	 * 
	 * @param {string} target 
	 * @param {string} source 
	 * @returns {Instruction}
	 */
	replace_variable(target, source) {
		this.instructions.forEach(stmt => {
			if (stmt.isInstructionGroup) {
				stmt.replace_variable(target, source);
			} else if (stmt.content) {
				stmt.content = stmt.content.replace(new RegExp(source, 'g'), target);
			}
		});
		if (this.instructionReturn) this.instructionReturn =  this.instructionReturn.replace(new RegExp(source, 'g'), target);
		return this;
	}

	size() {
		let currentSize = 0;
		this.instructions.forEach(instruction => {
			if (instruction.isInstructionGroup) {
				currentSize += instruction.size();
			} else if (instruction.content) {
				currentSize++;
			}
		});
		return currentSize;
	}
}

export class SingleInstruction extends Instruction {
	constructor(data, instructionReturn = null) {
		super(data, instructionReturn);
		this.content = data.content;
		this.referrer = data.referrer;
		this.isInstructionGroup = false;
		this.hasBeenSingle = true;
	}

	raw_replace(variable, value) {
		if (!this.isInstructionGroup) {
			this.content = this.content.replace(new RegExp(`\\{${variable}\\}`, 'g'), value);
			return this;
		} else {
			return super.raw_replace(variable, value);
		}
	}

	raw_replace_all(variable, value) {
		if (!this.isInstructionGroup) {
			this.content = this.content.replace(new RegExp(`\\{${variable}\\}`, 'g'), value);
			if (this.instructionReturn && typeof this.instructionReturn === 'string') this.instructionReturn = this.instructionReturn.replace(new RegExp(`\\{${variable}\\}`, 'g'), value);
			return this;
		} else {
			return super.raw_replace_all(variable, value);
		}
	}

	duplicate() {
		if (this.isInstructionGroup) {
			return super.duplicate();
		} else {
			return new SingleInstruction({
				content: this.content,
				referrer: this.referrer
			}, this.instructionReturn);
		}
	}

	/**
	 * 
	 * @param {string} variable 
	 * @param {any} value 
	 * @deprecated
	 */
	replace(variable, value) {
		if (!this.isInstructionGroup) {
			this.content = this.content.replace(new RegExp(`\\{${variable}\\}`, 'g'), `{${this.referrer.length}}`);
			this.referrer.push(value);
			return this;
		} else {
			return super.replace(variable, value);
		}
	}

	raw_replace(variable, value) {
		if (!this.isInstructionGroup) {
			this.content = this.content.replace(new RegExp(`\\{${variable}\\}`, 'g'), value);
			return this;
		} else {
			return super.raw_replace(variable, value);
		}
	}

	replace_variable(target, source) {
		if (!this.isInstructionGroup) {
			this.content = this.content.replace(new RegExp(source, 'g'), target);
			if (this.instructionReturn) this.instructionReturn = this.instructionReturn.replace(new RegExp(source, 'g'), target);
			return this;
		} else {
			return super.replace_variable(target, source);
		}
	}

	size() {
		if (!this.isInstructionGroup) {
			return 1;
		} else {
			return super.size();
		}
	}

	concat(other) {
		if (!this.isInstructionGroup) {
			this.instructions = [new Instruction({
				content: this.content,
				referrer: this.referrer
			})];
			super.concat(other);
			this.isInstructionGroup = true;
		} else {
			super.concat(other);
		}
		return this;
	}

}

// Nothing special in fact
export class EmptyInstruction extends Instruction {
	constructor() {
		super();
	}
}

export class InstructionBuilder {
	static set(target, value, referrer = []) {
		if (target === value) {
			return new EmptyInstruction();
		}
		return new SingleInstruction({
			content: `set ${target} ${value}`,
			referrer: referrer
		});
	}
	static op(type, target, value1, value2 = null, referrer = []) {
		return new SingleInstruction({
			content: `op ${type} ${target} ${value1} ${value2}`,
			referrer: referrer
		});
	}
	static selectx(target, condit, consequent, alternate, referrer = []) {
		return new SingleInstruction({
			content: `select ${target} ${condit} ${consequent} ${alternate}`,
			referrer: referrer
		});
	}
	static select(target, type, value1, value2, consequent, alternate, referrer = []) {
		return InstructionBuilder.selectx(target, `${type} ${value1} ${value2}`, consequent, alternate, referrer);
	}
	static jumpx(target, condition, referrer = []) {
		return new SingleInstruction({
			content: `jump ${target} ${condition}`,
			referrer: referrer
		});
	}
	static jump(target, condition, value1 = null, value2 = null, referrer = []) {
		return InstructionBuilder.jumpx(target, `${condition} ${value1 ?? 'x'} ${value2 ?? '0'}`, referrer);
	}
	static read(target, block, position) {
		return new SingleInstruction({
			content: `read ${target} ${block} ${position}`,
			referrer: []
		});
	}
	static reads(target, block, position) {
		return new Instruction([
			InstructionBuilder.getlink("__curb", block),
			InstructionBuilder.read(target, "__curb", position)
		]);
	}
	static write(source, block, position) {
		return new SingleInstruction({
			content: `write ${source} ${block} ${position}`,
			referrer: []
		});
	}
	static writes(target, block, position) {
		return new Instruction([
			InstructionBuilder.getlink("__curb", block),
			InstructionBuilder.write(target, "__curb", position)
		]);
	}
	static lookup(category, target, id) {
		return new SingleInstruction({
			content: `lookup ${category} ${target} ${id}`,
			referrer: []
		});
	}
	static end() {
		return new SingleInstruction({
			content: `end`,
			referrer: []
		});
	}
	static stop() {
		return new SingleInstruction({
			content: `stop`,
			referrer: []
		});
	}
	static print(data) {
		return new SingleInstruction({
			content: `print ${data}`,
			referrer: []
		});
	}
	static printchar(data) {
		return new SingleInstruction({
			content: `printchar ${data}`,
			referrer: []
		});
	}
	static format(data) {
		return new SingleInstruction({
			content: `format ${data}`,
			referrer: []
		});
	}
	static printflush(target) {
		return new SingleInstruction({
			content: `printflush ${target}`,
			referrer: []
		});
	}
	/**
	 * `draw triangle`, used only to DECLARE variables: in mlog a name becomes a
	 * variable by being used, and this one takes six operands at a time.
	 *
	 * @param {string[]} names Up to six variable names
	 * @returns {SingleInstruction}
	 */
	static drawTriangle(names) {
		const six = [];
		for (let i = 0; i < 6; i++) six.push(names[i] ?? '0');
		return new SingleInstruction({
			content: `draw triangle ${six.join(' ')}`,
			referrer: []
		});
	}
	static drawflush(target) {
		return new SingleInstruction({
			content: `drawflush ${target}`,
			referrer: []
		});
	}
	static sensor(target, device, category) {
		return new SingleInstruction({
			content: `sensor ${target} ${device} ${category}`,
			referrer: []
		});
	}
	static getlink(target, id) {
		return new SingleInstruction({
			content: `getlink ${target} ${id}`,
			referrer: []
		});
	}
}
