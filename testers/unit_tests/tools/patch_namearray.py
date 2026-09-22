p = '/data/workspace/src/mindcInfrastructure.js'
s = open(p, encoding='utf-8').read()

anchor = "export class RemoteArrayRet extends VariableRet {"
assert s.count(anchor) == 1

cls = '''/**
 * One element of a `NameArrayRet`, reached through the name its register
 * holds.
 */
class NameArraySlotRet extends VariableRet {

	/**
	 * @param {Globals} glob
	 * @param {NameArrayRet} array
	 * @param {{instructions: any[], name: string, constant: boolean, value: number?}} operand
	 */
	constructor(glob, array, operand) {
		super(glob, operand.instructions, array.name, array.elementTypeInfo, false);
		this.array = array;
		this.operand = operand;
	}

	/**
	 * A constant subscript names the register that holds the element's NAME
	 * outright, so the access is a single `read <device> <that register>`.
	 */
	get() {
		const glob = this.glob;
		const target = glob.tmp(this.type);
		const tn = nameOf(target);
		if (this.operand.constant) {
			const i = this.operand.value;
			if (i < 0 || i >= this.array.length) {
				throw new InfrastructureNotImplementedExpection('subscript out of range');
			}
			return valueClassOf(glob, this.type).create(glob,
				[this.instructions,
					InstructionBuilder.read(tn, this.array.device, this.array.elementName(i))],
				tn, this.type, true);
		}
		const chosen = glob.tmp(null, 'nmarr');
		const cn = nameOf(chosen);
		const parts = [this.instructions,
			InstructionBuilder.set(cn, this.array.elementName(0))];
		for (let i = 1; i < this.array.length; i++) {
			parts.push(InstructionBuilder.selectx(cn, `equal ${this.operand.name} ${i}`,
				this.array.elementName(i), cn));
		}
		parts.push(InstructionBuilder.read(tn, this.array.device, cn));
		return valueClassOf(glob, this.type).create(glob, parts, tn, this.type, true);
	}

	/**
	 * Writing goes THROUGH the name: `write <value> <device> <name register>`.
	 * That is what makes the write land in the caller's array instead of in a
	 * copy -- a non-memory array is passed by reference, like every array in C.
	 */
	set(other) {
		const glob = this.glob;
		const value = other.get().convertTo(this.type ?? other.type);
		if (this.operand.constant) {
			const i = this.operand.value;
			if (i < 0 || i >= this.array.length) {
				throw new InfrastructureNotImplementedExpection('subscript out of range');
			}
			return valueClassOf(glob, this.type).create(glob,
				[this.instructions, value.instructions,
					InstructionBuilder.write(value.name, this.array.device, this.array.elementName(i))],
				value.name, this.type, false);
		}
		const chosen = glob.tmp(null, 'nmarr');
		const cn = nameOf(chosen);
		const parts = [this.instructions, value.instructions,
			InstructionBuilder.set(cn, this.array.elementName(0))];
		for (let i = 1; i < this.array.length; i++) {
			parts.push(InstructionBuilder.selectx(cn, `equal ${this.operand.name} ${i}`,
				this.array.elementName(i), cn));
		}
		parts.push(InstructionBuilder.write(value.name, this.array.device, cn));
		return valueClassOf(glob, this.type).create(glob, parts, value.name, this.type, false);
	}
}

/**
 * An array reached through the NAMES of its elements.
 *
 * This is how an array is handed to a FUNCTION. A non-memory array has no
 * address, so a pointer cannot be handed over -- but its elements do have
 * names, and a name is an ordinary value that fits in a register. So the
 * parameter becomes one register per element, each holding the NAME of the
 * caller's element:
 *
 *     set g:.f:test.s_0 "g:.r_0"      <- at the call site
 *     write 1 @this g:.f:test.s_0     <- inside the function
 *
 * Going through the name is what makes this pass BY REFERENCE: the write
 * really does change the caller's array. Copying the values in instead would
 * make `s[1] = 1` write into the parameter's own registers and lose it.
 *
 * `deviceReg` is null for a local array (accessed with `read/write @this`) and
 * the processor register for a `remote` array, whose elements live in another
 * processor.
 */
export class NameArrayRet extends ArrayRet {

	/**
	 * @param {Globals} glob
	 * @param {string} baseName Element `i`'s name lives in `baseName_i`
	 * @param {TypeInfo?} type
	 * @param {number} length
	 * @param {string?} [deviceReg] Register holding the other processor
	 * @param {any} [instructions=[]]
	 */
	constructor(glob, baseName, type, length, deviceReg = null, instructions = []) {
		super(glob, instructions, baseName, type, false, length);
		this.deviceReg = deviceReg;
		this.setAttribute('isNameArray', true);
		this.setAttribute('disallowReplacement', true);
	}

	/** Where element `i`'s NAME is stored. */
	elementName(index) {
		return `${this.name}_${index}`;
	}

	/** `@this`, or the register holding the other processor. */
	get device() {
		return this.deviceReg ?? '@this';
	}

	element(index) {
		return new NameArraySlotRet(this.glob, this, operandOf(this.glob, index));
	}
}

'''
s = s.replace(anchor, cls + anchor, 1)
open(p, 'w', encoding='utf-8').write(s)
print('NameArrayRet added')
