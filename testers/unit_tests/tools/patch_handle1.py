p = '/data/workspace/src/mindcInfrastructure.js'
s = open(p, encoding='utf-8').read()

anchor = "export function selectArrayImplementation(info) {"
assert s.count(anchor) == 1

cls = '''/* ------------------------------------------------------------------ *
 * Array handles -- how an array travels as a VALUE
 * ------------------------------------------------------------------ */

/**
 * The register that holds the entry point of a helper.
 *
 * `FunctionRegisterer` emits `op add _<name> @counter 1` at the head of every
 * function, so the address of `<name>` lives in `_<name>`.
 *
 * @param {string} key
 * @returns {string}
 */
function helperAddressOf(key) {
	return `_${key}`;
}

/**
 * How one element of an array is reached, in the shape a helper needs.
 *
 * @param {ArrayRet} array
 * @returns {{length: number, device: string, names: string[], dynamic: boolean}?}
 *          null when this array has no such description (so no handle exists)
 */
function handleShapeOf(array) {
	if (!array) return null;
	const device = array.deviceReg ?? '@this';
	// A remote array: its elements are registers of the other processor
	if (array instanceof RemoteArrayRet) {
		const names = [];
		for (let i = 0; i < array.length; i++) names.push(`${array.targetAssembly}_${i}`);
		return { length: array.length, device, names, dynamic: false };
	}
	if (array instanceof LookupArrayRet) {
		return { length: array.length, device, names: array.names ?? [], dynamic: false };
	}
	if (array instanceof NameArrayRet) {
		/*
		`s_i` does not hold the element -- it holds the NAME of the element, so
		every access is one more level of indirection.
		*/
		const names = [];
		for (let i = 0; i < array.length; i++) names.push(array.elementName(i));
		return { length: array.length, device, names, dynamic: true };
	}
	if (typeof array.elementName === 'function') {
		const names = [];
		for (let i = 0; i < array.length; i++) names.push(array.elementName(i));
		return { length: array.length, device: '@this', names, dynamic: false };
	}
	return null;
}

/**
 * Build (once) the get / set helpers of an array and return their entry
 * points.
 *
 * Why this exists: an array that is not laid out in memory has NO ADDRESS, so
 * a pointer cannot be made of it -- and that is exactly what is needed when
 * the array is handed to a function, or to a function pointer (which is passed
 * through fixed `__param_N` slots and therefore cannot know anything about the
 * call site). A handle is two words that DO travel as a value:
 *
 *     set s_get ___arrget_NAME
 *     set s_set ___arrset_NAME
 *
 * After that, `s[i]` inside the function is
 *
 *     set __arridx i
 *     op add __stackpos @counter 1
 *     set @counter s_get          ; result in __arrret
 *     set __stackpos __internal_stackpos
 *
 * The helper is built for the CALLER's array, so the write really lands in the
 * caller's array -- the array stays passed by reference, as in C.
 *
 * @param {Globals} glob
 * @param {ArrayRet} array
 * @returns {{instructions: any[], get: string?, set: string?}?}
 *          null when this array cannot be described by a handle at all
 */
export function ensureArrayHandle(glob, array) {
	const shape = handleShapeOf(array);
	if (!shape || shape.length <= 0) return null;
	const reg = glob?.funcReg;
	if (!reg) return null;
	const keyOf = kind => `__arr${kind}_${String(array.name).replace(/[^A-Za-z0-9_]/g, '_')}`;
	const build = kind => {
		const key = keyOf(kind);
		if (reg.functionCollection.has(key)) {
			/*
			Taking the address does not count as a call, and a helper nobody
			"calls" would be dropped as dead code -- so count it by hand.
			*/
			reg.functionCollection.get(key).calls++;
			return key;
		}
		const body = new Instruction();
		if (kind === 'get') {
			if (shape.dynamic) {
				body.concat(InstructionBuilder.read('__arrret', shape.device, shape.names[0]));
				for (let i = 1; i < shape.length; i++) {
					const got = nameOf(glob.tmp(null, 'arrd'));
					body.concat(InstructionBuilder.read(got, shape.device, shape.names[i]));
					body.concat(InstructionBuilder.selectx('__arrret',
						`equal __arridx ${i}`, got, '__arrret'));
				}
			} else {
				body.concat(InstructionBuilder.set('__arrret', shape.names[0]));
				for (let i = 1; i < shape.length; i++) {
					body.concat(InstructionBuilder.selectx('__arrret',
						`equal __arridx ${i}`, shape.names[i], '__arrret'));
				}
			}
		} else {
			/*
			`select` picks a VALUE, not a target, so the NAME is selected first
			and then written through -- the same trick a name pointer uses.
			*/
			const literal = i => (shape.dynamic ? shape.names[i] : `"${shape.names[i]}"`);
			body.concat(InstructionBuilder.set('__arrsel', literal(0)));
			for (let i = 1; i < shape.length; i++) {
				body.concat(InstructionBuilder.selectx('__arrsel',
					`equal __arridx ${i}`, literal(i), '__arrsel'));
			}
			body.concat(InstructionBuilder.write('__arrval', shape.device, '__arrsel'));
		}
		reg.addFunction(key, body, null, [], true, false, true);
		reg.functionCollection.get(key).calls++;
		return key;
	};
	return {
		instructions: array.instructions ?? [],
		get: helperAddressOf(build('get')),
		set: helperAddressOf(build('set'))
	};
}

/**
 * An array reached through a HANDLE: two registers holding the entry points of
 * its get / set helpers.
 *
 * @see ensureArrayHandle
 */
export class ArrayHandleRet extends ArrayRet {

	/**
	 * @param {Globals} glob
	 * @param {string} baseName Element access uses `<baseName>_get` / `_set`
	 * @param {TypeInfo?} type
	 * @param {number} length
	 * @param {any} [instructions=[]]
	 */
	constructor(glob, baseName, type, length, instructions = []) {
		super(glob, instructions, baseName, type, false, length);
		this.setAttribute('isArrayHandle', true);
		this.setAttribute('disallowReplacement', true);
	}

	get width() {
		return 2;
	}

	/** The address of the get helper. */
	get getReg() {
		return `${this.name}_get`;
	}

	/** The address of the set helper. */
	get setReg() {
		return `${this.name}_set`;
	}

	/**
	 * @param {VariableRet|number|string} index
	 * @returns {VariableRet}
	 */
	element(index) {
		return new ArrayHandleSlotRet(this.glob, this, operandOf(this.glob, index));
	}
}

/** One element of an `ArrayHandleRet`: a call to the handle's helper. */
class ArrayHandleSlotRet extends VariableRet {

	/**
	 * @param {Globals} glob
	 * @param {ArrayHandleRet} array
	 * @param {{instructions: any[], name: string, constant: boolean, value: number?}} operand
	 */
	constructor(glob, array, operand) {
		super(glob, operand.instructions, array.name, array.elementTypeInfo, false);
		this.array = array;
		this.operand = operand;
	}

	get() {
		const glob = this.glob;
		const target = glob.tmp(this.type);
		const tn = nameOf(target);
		const call = glob.funcReg.getFunctionCall(
			String(this.array.getReg()).replace(/^_+/, ''),
			new Map([['__arridx', this.operand.name]]), null);
		return valueClassOf(glob, this.type).create(glob,
			[this.instructions, call, InstructionBuilder.set(tn, '__arrret')],
			tn, this.type, true);
	}

	set(other) {
		const glob = this.glob;
		const value = other.get().convertTo(this.type ?? other.type);
		const call = glob.funcReg.getFunctionCall(
			String(this.array.setReg()).replace(/^_+/, ''),
			new Map([['__arridx', this.operand.name], ['__arrval', value.name]]), null);
		return valueClassOf(glob, this.type).create(glob,
			[this.instructions, value.instructions, call], value.name, this.type, false);
	}
}

'''
s = s.replace(anchor, cls + anchor, 1)
open(p, 'w', encoding='utf-8').write(s)
print('handle infrastructure added')
