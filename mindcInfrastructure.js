/*
MinCCompiler on JS
By Seabird Starch Gunnhildr and Deepseek, 2025 - 2026.

mindcInfrastructure.js -- the object-oriented "value" layer of the code generator.

WHY THIS FILE EXISTS
--------------------
The original mindcGenerator.js described every intermediate value as an `Instruction`
plus a bag of loosely documented boolean attributes (`isPointer`, `isPointerAccess`,
`disallowReplacement`, `isTemporary`, `isSymbolic`, `isNearPointer`, ...) and a set of
string templates (`{op}`, `{opw}`, `{op_r0}`, `{value_entry}`, `{pointer_block_entry}`).
That made every consumer re-implement the same decision tree, and the templates were
replaced through raw string substitution -- fragile and hard to maintain.

This file replaces that by classes. Every value produced while generating code is a
`VariableRet`, which *is* an `Instruction` (so it can still be concatenated into any
instruction sequence and consumed by not-yet-refactored code) *and* knows what it is:

    VariableRet
      |
      +-- ImmediateRet        常量 / @常量 / null -- 只读，不占存储
      |
      +-- BasicRet            单字值，位于某个名字（寄存器或符号）中，可读写
      |     +-- IntRet -- BoolRet
      |     +-- FloatRet
      |     +-- ContentRet
      |     +-- DeviceRet / NullRet
      |
      +-- PointerRet          指针值，占两个字 P_block / P_pos
      |     +-- RefPointerRet     指针值就在 P_block / P_pos 里
      |     +-- MemPointerRet     指针值本身位于内存中（需要读出来）
      |           +-- VolatilePointerRet
      |
      +-- MemoryRefRet        值位于内存中某个地址 P 处（读写都要经过内存）
      |     +-- StructRefRet      结构体 / 联合体
      |           +-- RegistryStructRet  成员各自占一个寄存器（registry struct）
      |
      +-- (references above are all "ReferenceRet": they have get() and set())

PREPARATION (not wired into the generator yet)
      |
      +-- PackedPointerRet    单字打包地址 block*SPAN+pos -- 只能存地址 / 解引用
      |     +-- PackedSlotRet
      |
      +-- ArrayRet            只支持下标访问的数组表示
            +-- TraditionalArrayRet   内存数组（可转指针）
            +-- PseudoListArrayRet    生成代码（pdread/pdwrite 式），句柄为整数
            +-- PackedArrayRet        位域打包进一个寄存器
            +-- ConstantArrayRet      常量表，常量下标直接折叠

USAGE
-----
    const lval = cg.getLValue(node.left);      // ReferenceRet
    const rval = cg.visitValue(node.right);    // VariableRet
    return lval.assign(rval);                  // Instruction (a VariableRet as well)

IMPORTANT (recursion safety)
----------------------------
Only *single-operand* methods live here. Any operation with two or more operands
(`a + b`, `f(a, b)`, ...) must first put every operand into its own temporary
**symbol** (`getTempSymbol`) -- never into a temporary register (`__register_N`):
registers are not saved on the stack, and one name maps to exactly one register, so
the evaluation of the second operand (which may contain a call) would clobber the
first one. `materialize()` does exactly that, and it is free when the value already
sits in a temporary symbol (it just renames, emitting no instruction).
*/

import { Instruction, InstructionBuilder, InstructionReferrer, MEMORY_RESERVE_SIZE } from "./mindcGeneratorBase.js";
import { SemanticAnalyzer, TypeInfo } from "./mindcSemantic.js";

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

/**
 * Flatten nested arrays of instructions (nesting happens when Rets are combined).
 * @param {any} parts
 * @returns {any[]}
 */
function flattenParts(parts) {
	const result = [];
	const push = item => {
		if (item === null || item === undefined || item === false) return;
		if (Array.isArray(item)) {
			item.forEach(push);
			return;
		}
		result.push(item);
	};
	push(parts);
	return result;
}

/**
 * @param {any} target string | SymbolEntry
 * @returns {string}
 */
function nameOf(target) {
	if (target === null || target === undefined) return 'null';
	if (typeof target === 'string') return target;
	if (typeof target.getAssemblySymbol === 'function') return target.getAssemblySymbol();
	return `${target}`;
}

/** item_t -> item, liquid_t -> liquid ... */
export const contentTypeOf = typeName => {
	// item_t -> item, liquid_t -> liquid ... everything else (int!) defaults to item
	return (typeName && SPECIAL_CONTENT_TYPES.includes(typeName)) ? typeName.slice(0, typeName.length - 2) : 'item';
};

export const SPECIAL_CONTENT_TYPES = ['item_t', 'liquid_t', 'unit_t', 'block_t'];

/**
 * @param {Globals} glob
 * @param {TypeInfo?} type
 * @returns {boolean}
 */
const isIntegerLike = (glob, type) => !!type && glob.semantic.isIntegerType(type.name);
const isFloatLike = (glob, type) => !!type && ['float', 'double'].includes(type.name);
const isBoolLike = (glob, type) => !!type && type.name === 'bool';
const isContentLike = (glob, type) => !!type && type.name === 'content_t';
const isSpecialLike = (glob, type) => !!type && SPECIAL_CONTENT_TYPES.includes(type.name);

/**
 * How many words a value of this type occupies.
 *
 * NOTE: `TypeInfo.isPointerImpl()` is true for every `volatile` type, but a volatile
 * **scalar** still occupies a single word -- volatile only means "keep it in memory".
 * Only real pointers/arrays (and memory-implemented structs) take two words.
 *
 * @param {TypeInfo?} type
 * @returns {number}
 */
/**
 * The numeric id of a `@name` constant, when the compiler knows it.
 *
 * @param {import('./mindcGeneratorBase.js').Globals?} glob
 * @param {string} name
 * @returns {number?} null when unknown (so a runtime `sensor @id` is needed)
 */
export function knownContentIdOf(glob, name) {
	if (typeof name !== 'string' || name[0] !== '@') return null;
	const table = glob?.semantic?.contentTable ?? null;
	if (!table) return null;
	for (const category of ['item', 'liquid', 'unit', 'block']) {
		const id = table.idOf(category, name);
		if (id !== undefined) return (id === null) ? null : id;
	}
	return null;
}

export function widthOfType(type) {
	if (!type || !type.isTypeInfo) return 1;
	if (type.kind === 'pointer' || type.kind === 'array') return 2;
	if (type.kind === 'struct' || type.kind === 'union') return type.isPointerImpl() ? 2 : 1;
	return 1;
}

/* ------------------------------------------------------------------ *
 * Exceptions
 * ------------------------------------------------------------------ */

export class InfrastructureNotImplementedExpection extends Error {
	constructor(info = '') {
		super(`Feature not implemented in infrastructure: ${info}`);
		this.info = info;
	}
}

export class InvalidCastException extends Error {
	constructor(from, to) {
		const describe = v => (v && v.type) ? v.type.name : (v ? `${v.constructor?.name ?? v}` : '?');
		super(`Invalid cast: cannot store ${describe(from)} into ${describe(to)}`);
		this.from = from;
		this.to = to;
	}
}

/* ------------------------------------------------------------------ *
 * Globals -- everything the value classes need from the outer world
 * ------------------------------------------------------------------ */

/**
 * @callback tempVarAssigner
 * @param {TypeInfo?} type
 * @param {string?} kind
 * @returns {string} The **assembly name** of a freshly allocated temporary symbol.
 */
export class Globals {
	/**
	 * @param {import('./mindcGeneratorBase.js').MemoryManager} mem
	 * @param {tempVarAssigner} tmpCaller
	 * @param {SemanticAnalyzer} semantic
	 * @param {import('./mindcGeneratorBase.js').FunctionRegisterer?} funcReg
	 * @param {any?} generator The CodeGenerator itself (for struct copy, etc.)
	 */
	constructor(mem, tmpCaller, semantic, funcReg = null, generator = null) {
		this.memory = mem;
		this.tmpCaller = tmpCaller;
		this.semantic = semantic;
		this.funcReg = funcReg;
		this.generator = generator;
		this.reservedSize = (mem && mem.reservedSize) ? mem.reservedSize : MEMORY_RESERVE_SIZE;
	}

	/**
	 * Allocate a fresh temporary symbol and return its assembly name.
	 * @param {TypeInfo?} type
	 * @param {string?} kind
	 * @returns {string}
	 */
	tmp(type = null, kind = null) {
		return this.tmpCaller(type, kind);
	}
}

/* ------------------------------------------------------------------ *
 * Memory primitives (pointer arithmetic / indirect access)
 * ------------------------------------------------------------------ */

/**
 * Move a pointer forward (or backward) by `step`.
 * @param {Globals} glob
 * @param {string} pointer base name (P_block / P_pos)
 * @param {number|string} step
 * @param {boolean} isNear
 * @param {boolean} backward
 * @returns {Instruction}
 */
export function pointerStep(glob, pointer, step, isNear = false, backward = false) {
	if (!backward) {
		return glob.memory.outputPointerForwardCall(step, pointer, glob.funcReg, false, true, isNear);
	}
	return glob.memory.outputPointerBackwardCall(step, pointer, glob.funcReg, true);
}

/**
 * Read `width` words from the address stored in pointer `pointer` into `target`.
 * @param {Globals} glob
 * @param {string} pointer
 * @param {string} target
 * @param {number} width 1 = scalar, 2 = pointer
 * @param {boolean} isNear
 * @returns {Instruction}
 */
/**
 * Move `pointer` one cell forward WITHOUT moving the pointer itself.
 *
 * Reading or writing a two-word value needs the address of the second word, but
 * that must not disturb the pointer: it may be a variable's save slot, and
 * `pointerStep` (which writes the advanced address back) would slowly walk it
 * into somebody else's storage.
 *
 * @param {import('./mindcGeneratorBase.js').Globals?} glob
 * @param {string} pointer
 * @param {boolean} isNear
 * @returns {Instruction}
 */
function peekNext(glob, pointer, isNear = false) {
	return glob.memory.outputPointerForwardCall(1, pointer, glob.funcReg, false, false, isNear);
}

export function readThrough(glob, pointer, target, width = 1, isNear = false) {
	if (width <= 1) {
		return glob.memory.outputPointerFetchOf(pointer, target);
	}
	return new Instruction([
		glob.memory.outputPointerFetchOf(pointer, `${target}_block`),
		peekNext(glob, pointer, isNear),
		InstructionBuilder.reads(`${target}_pos`, '__ptrblock', '__ptrpos')
	]);
}

/**
 * Write `width` words from `value` into the address stored in pointer `pointer`.
 * @param {Globals} glob
 * @param {string} pointer
 * @param {string} value
 * @param {number} width
 * @param {boolean} isNear
 * @returns {Instruction}
 */
export function writeThrough(glob, pointer, value, width = 1, isNear = false) {
	if (width <= 1) {
		return glob.memory.outputPointerStorageOf(pointer, value);
	}
	return new Instruction([
		glob.memory.outputPointerStorageOf(pointer, `${value}_block`),
		peekNext(glob, pointer, isNear),
		InstructionBuilder.writes(`${value}_pos`, '__ptrblock', '__ptrpos')
	]);
}

/**
 * Read the value a reference points at (honouring compile-time known locations).
 * @param {Globals} glob
 * @param {MemoryRefRet | MemPointerRet} ref
 * @param {string} target
 * @param {number} width
 * @returns {Instruction}
 */
function referenceRead(glob, ref, target, width) {
	if (ref.fixedLocation) {
		if (width >= 2) {
			return new Instruction([
				glob.memory.outputFetchOf(ref.fixedLocation, `${target}_block`),
				glob.memory.outputFetchOf(ref.fixedLocation.duplicate().forwarding(1), `${target}_pos`)
			]);
		}
		return glob.memory.outputFetchOf(ref.fixedLocation, target);
	}
	return readThrough(glob, ref.name, target, width, ref.isNear);
}

/**
 * Write the value a reference points at.
 * @param {Globals} glob
 * @param {MemoryRefRet | MemPointerRet} ref
 * @param {string} value
 * @param {number} width
 * @returns {Instruction}
 */
function referenceWrite(glob, ref, value, width) {
	if (ref.fixedLocation) {
		if (width >= 2) {
			return new Instruction([
				glob.memory.outputStorageOf(ref.fixedLocation, `${value}_block`),
				glob.memory.outputStorageOf(ref.fixedLocation.duplicate().forwarding(1), `${value}_pos`)
			]);
		}
		return glob.memory.outputStorageOf(ref.fixedLocation, value);
	}
	return writeThrough(glob, ref.name, value, width, ref.isNear);
}

/**
 * Turn a pointer into its linear (integer) address.
 * @param {Globals} glob
 * @param {string} pointer
 * @param {string} target
 * @returns {Instruction}
 */
export function pointerToValue(glob, pointer, target) {
	return new Instruction([
		InstructionBuilder.reads(target, `${pointer}_block`, 3),
		InstructionBuilder.op('sub', target, target, glob.reservedSize),
		InstructionBuilder.op('add', target, target, `${pointer}_pos`)
	]);
}

/**
 * Build the type `inner *`.
 * @param {Globals} glob
 * @param {TypeInfo?} inner
 * @returns {TypeInfo?}
 */
function pointerTypeOf(glob, inner) {
	if (!inner) return null;
	const pointer = new TypeInfo('', 'pointer', 2);
	pointer.pointerTo = inner;
	pointer.qualifiers = [...(inner.qualifiers ?? [])].filter(q => q !== 'volatile');
	return pointer;
}

/**
 * Turn an integer address back into a pointer (starting from the very beginning
 * of the managed memory).
 * @param {Globals} glob
 * @param {string} value
 * @param {string} target
 * @returns {Instruction}
 */
export function valueToPointer(glob, value, target) {
	return glob.memory.outputPointerForwardCall(value, target, glob.funcReg, true);
}

/* ------------------------------------------------------------------ *
 * Operations with more than one operand
 * ------------------------------------------------------------------ */

/**
 * Any operation with two operands must materialize BOTH operands into their own
 * temporary symbols first: the evaluation of the second one may contain a call,
 * which would clobber registers (and registers are not saved on the stack).
 *
 * `pointer + int` / `pointer - int` are handled through the pointer stepping
 * routine instead of a plain `op`.
 *
 * @param {Globals} glob
 * @param {string} op mlog operation name (add, sub, mul, ...)
 * @param {VariableRet} left
 * @param {VariableRet} right
 * @param {TypeInfo?} type Result type
 * @returns {VariableRet}
 */
export function arithmetic(glob, op, left, right, type = null) {
	const resultType = type ?? left.type ?? right.type;
	const isAddLike = op === 'add' || op === 'sub';

	// pointer (+|-) integer  ->  move the pointer
	if ((left instanceof PointerRet) && !(right instanceof PointerRet) && isAddLike) {
		const base = left.get();				// read the pointer out (once!)
		const step = right.materialize();	// own temporary symbol: safe against calls
		const target = glob.tmp(resultType, 'pointer');
		return new RefPointerRet(glob, [
			base.instructions,
			InstructionBuilder.set(`${target}_block`, `${base.name}_block`),
			InstructionBuilder.set(`${target}_pos`, `${base.name}_pos`),
			pointerStep(glob, target, step.name, base.isNear, op === 'sub')
		], target, resultType, true);
	}

	// pointer - pointer -> difference of the two addresses, as an integer
	if ((left instanceof PointerRet) && (right instanceof PointerRet) && op === 'sub') {
		const l = left.convertTo(glob.semantic.getTypeInfo('int')).materialize();
		const r = right.convertTo(glob.semantic.getTypeInfo('int')).materialize();
		const target = glob.tmp(glob.semantic.getTypeInfo('int'));
		return new IntRet(glob, [l.instructions, r.instructions,
			InstructionBuilder.op('sub', target, l.name, r.name)], target,
			glob.semantic.getTypeInfo('int'), true);
	}

	/*
	Everything else: BOTH operands are materialized into their own temporary symbol
	first, because evaluating the second one may contain a function call, and a
	temporary register (`__register_N`) is neither saved on the stack nor unique per
	value -- a nested (or recursive) call would happily clobber it.
	*/
	const l = left.materialize();
	const r = right.materialize();
	const target = glob.tmp(resultType, widthOfType(resultType) === 2 ? 'pointer' : null);
	const instruction = InstructionBuilder.op(op, target, l.name, r.name);
	return valueClassOf(glob, resultType).create(glob,
		[l.instructions, r.instructions, instruction], target, resultType, true);
}

/* ------------------------------------------------------------------ *
 * VariableRet -- base class
 * ------------------------------------------------------------------ */

export class VariableRet extends Instruction {

	/**
	 * @param {Globals} glob
	 * @param {any} instructions
	 * @param {string?} returner
	 * @param {TypeInfo?} type
	 * @param {boolean} temporary Whether the value lives in a temporary symbol
	 *                            (which means: it may be renamed for free).
	 */
	constructor(glob, instructions, returner, type, temporary = false) {
		super(flattenParts(instructions), returner);
		this.glob = glob;
		this.type = type ?? null;
		this.temporary = temporary;
		this.setAttribute('isTemporary', temporary);
		if (type && type.isTypeInfo) {
			this.setAttribute('isRegStruct', type.isRegStruct());
			this.setAttribute('isStructRet', ['struct', 'union'].includes(type.kind));
		}
	}

	/** The assembly name carrying the value (or pointing at it). */
	get name() {
		return this.instructionReturn;
	}

	/** How many words the value occupies (2 for pointers, 1 otherwise). */
	get width() {
		return widthOfType(this.type);
	}

	get isNear() {
		return this.getAttribute('isNearPointer') === true;
	}

	/**
	 * Shallow copy. Sub-instructions are shared (that is what the legacy code does
	 * as well -- `replace_variable` mutates them in place).
	 * @returns {VariableRet}
	 */
	clone() {
		const copy = Object.create(Object.getPrototypeOf(this));
		Object.assign(copy, this);
		copy.instructions = [...this.instructions];
		copy._attributes = new Map(this._attributes);
		return copy;
	}

	/**
	 * Copy this Ret while renaming its value. Only legal for temporary values
	 * (or for values that are allowed to be replaced), and never for constants.
	 * @param {string|SymbolEntry} target
	 * @returns {VariableRet}
	 */
	rename(target) {
		if (!this.canRename) {
			// Not allowed to rename (a constant, or a protected name): copy instead.
			return this.storeTo(target, this.temporary);
		}
		const name = nameOf(target);
		const copy = this.clone();
		if (this.instructionReturn && this.instructionReturn !== 'null') {
			copy.replace_variable(name, this.instructionReturn);
		}
		copy.temporary = this.temporary;
		return copy;
	}

	/**
	 * Get the value: the returned Ret is guaranteed to be usable **directly** as an
	 * operand of another instruction (its `name` holds the value -- or, for pointers,
	 * `name_block` / `name_pos` do).
	 * @returns {VariableRet}
	 */
	get() {
		return this;
	}

	/**
	 * Store `other` into the position described by `this`.
	 * @param {VariableRet} other
	 * @returns {VariableRet} A Ret describing the position after the write.
	 */
	set(other) {
		throw new InvalidCastException(other, this);
	}

	/**
	 * Alias of set(), provided because `set` is easy to confuse with AttributeClass
	 * semantics when reading call sites.
	 * @param {VariableRet} other
	 * @returns {VariableRet}
	 */
	assign(other) {
		return this.set(other);
	}

	/**
	 * Uniform constructor entry point, so that the factories in this file do not
	 * need to know how many arguments each subclass takes.
	 *
	 * It dispatches on `this`, which means **every** subclass (including ones added
	 * later) builds an instance of its own class. Classes with extra constructor
	 * arguments override it.
	 *
	 * @param {Globals} glob
	 * @param {any} instructions
	 * @param {string?} returner
	 * @param {TypeInfo?} type
	 * @param {boolean} [temporary=false]
	 * @param {SymbolEntry?} [symbol=null]
	 * @returns {VariableRet}
	 */
	static create(glob, instructions, returner, type, temporary = false, symbol = null) {
		return new this(glob, instructions, returner, type, temporary);
	}

	/**
	 * Whether this value may simply be *renamed* to another name instead of being
	 * copied: that is allowed only for values that own their storage (temporary
	 * symbols) and whose name is not protected (`disallowReplacement`).
	 * @returns {boolean}
	 */
	get canRename() {
		if (this instanceof ImmediateRet) return false;
		return this.temporary && this.getAttribute('disallowRename') !== true;
	}

	/**
	 * Make sure the value can safely be used as an operand of a multi-operand
	 * operation, i.e. that it survives the evaluation of the *other* operands
	 * (which may contain calls, possibly recursive ones).
	 *
	 * This is free of cost when the value
	 *  - owns its storage (a temporary symbol), or
	 *  - is a persistent symbol (a real variable: nested code does not reuse it), or
	 *  - is a constant.
	 * Only values sitting in a **temporary register** (`__register_N`) have to be
	 * copied: a register is neither saved on the stack nor unique per value.
	 * @returns {VariableRet}
	 */
	materialize() {
		const value = this.get();
		if (value.canRename) return value;
		if (value instanceof ImmediateRet) return value;
		if (value.getAttribute('isSymbolic') || value.symbol) return value;
		return value.storeTo(this.glob.tmp(value.type, value.width === 2 ? 'pointer' : null), true);
	}

	/**
	 * Copy the value into the given (fresh) name.
	 * @param {string|SymbolEntry} target
	 * @returns {VariableRet}
	 */
	storeTo(target, temporary = true) {
		const name = nameOf(target);
		const value = this.get();
		if (value.width >= 2) {
			return new RefPointerRet(this.glob, [
				value.instructions,
				InstructionBuilder.set(`${name}_block`, `${value.name}_block`),
				InstructionBuilder.set(`${name}_pos`, `${value.name}_pos`)
			], name, value.type, temporary);
		}
		return valueClassOf(this.glob, value.type).create(
			this.glob,
			[value.instructions, InstructionBuilder.set(name, value.name)],
			name, value.type, temporary);
	}

	/**
	 * The address of this value, as a pointer value.
	 * @returns {PointerRet}
	 */
	address() {
		throw new InfrastructureNotImplementedExpection('address of a value');
	}

	/**
	 * Dereference (pointers only).
	 * @returns {VariableRet}
	 */
	deref() {
		throw new InfrastructureNotImplementedExpection('dereference');
	}

	/**
	 * Convert the value to another type, producing conversion instructions when the
	 * Mindustry VM cannot do it implicitly.
	 * @param {TypeInfo} type
	 * @param {string?} category For conversions to content_t: item / liquid / unit / block
	 * @returns {VariableRet}
	 */
	convertTo(type, category = null) {
		const glob = this.glob;
		if (!type || !this.type || glob.semantic.isSameType(this.type, type)) return this.get();
		const src = this.type, dst = type;
		// Fast path: qualifiers (volatile / static / const) never change the
		// representation, so no instruction has to be emitted at all.
		if (widthOfType(src) === widthOfType(dst)
			&& !isFloatLike(glob, src) && !isFloatLike(glob, dst)
			&& !isContentLike(glob, src) && !isContentLike(glob, dst)
			&& !isBoolLike(glob, src) && !isBoolLike(glob, dst)) {
			return this.get();
		}
		const value = this.get();
		const target = glob.tmp(dst, widthOfType(dst) === 2 ? 'pointer' : null);

		/** @type {any} */
		let conversion = null;
		if (widthOfType(dst) === 2 && widthOfType(src) === 1) {
			conversion = valueToPointer(glob, value.name, target);
		} else if (widthOfType(dst) === 1 && widthOfType(src) === 2) {
			conversion = pointerToValue(glob, value.name, target);
		} else if (isIntegerLike(glob, dst) && isFloatLike(glob, src)) {
			conversion = InstructionBuilder.op('floor', target, value.name);
		} else if (isIntegerLike(glob, dst) && isContentLike(glob, src)) {
			/*
			The id of a `@name` is known at compile time, so write it out instead
			of asking the processor with `sensor x @name @id` -- one instruction
			less, and the value is right even when nothing is linked. Only when
			the id is unknown (declared as `null`) does the sensor stay.
			*/
			const knownId = knownContentIdOf(glob, value.name);
			conversion = knownId === null
				? InstructionBuilder.sensor(target, value.name, '@id')
				: InstructionBuilder.set(target, String(knownId));
		} else if (isContentLike(glob, dst) && (isIntegerLike(glob, src) || isSpecialLike(glob, src))) {
			conversion = InstructionBuilder.lookup(category ?? contentTypeOf(src.name), target, value.name);
		} else if (isBoolLike(glob, dst)) {
			conversion = InstructionBuilder.op('notEqual', target, value.name, 0);
		} else if (isIntegerLike(glob, dst) && isBoolLike(glob, src)) {
			conversion = null;		// bool is already 0/1
		}

		if (!conversion) {
			// Nothing to do but a plain copy (this covers item_t <-> int, etc.)
			return value.storeTo(target, true);
		}
		return valueClassOf(glob, dst).create(glob, [value.instructions, conversion], target, dst, true);
	}

	/**
	 * @param {VariableRet} other
	 * @returns {VariableRet}
	 */
	static wrap(other) {
		return new this(other.glob, other.instructions, other.instructionReturn, other.type, other.temporary);
	}
}

/* ------------------------------------------------------------------ *
 * Immediate values
 * ------------------------------------------------------------------ */

/**
 * A constant: numeric literal, `@copper`-like content constant, `null`, string...
 * It can be read (used as operand) but never written.
 */
export class ImmediateRet extends VariableRet {
	constructor(glob, value, type, builtin = false) {
		super(glob, [], `${value}`, type, false);
		this.setAttribute('disallowReplacement', true);
		if (builtin) this.setAttribute('builtinConstant', true);
	}

	get() {
		return this;
	}

	/** Constants never need materialization: they cannot be clobbered. */
	materialize() {
		return this;
	}

	set(other) {
		throw new InvalidCastException(other, this);
	}

	storeTo(target, temporary = true) {
		const name = nameOf(target);
		return valueClassOf(this.glob, this.type).create(this.glob,
			[InstructionBuilder.set(name, this.name)], name, this.type, temporary);
	}

	address() {
		throw new InfrastructureNotImplementedExpection('address of a constant');
	}
}

/* ------------------------------------------------------------------ *
 * Values living in a name (register / symbol)
 * ------------------------------------------------------------------ */

/**
 * A single-word value that lives in `name`. Reading it is free; writing it is
 * a `set` (or, when the source is temporary, a pure rename).
 */
export class BasicRet extends VariableRet {

	/**
	 * @param {VariableRet} other
	 * @returns {BasicRet}
	 */
	set(other) {
		const glob = this.glob;
		// References (values still living in memory) have to be read out first.
		if ((other instanceof MemoryRefRet) || (other instanceof MemPointerRet)) {
			return this.set(other.get());
		}
		if ((other instanceof BasicRet) || (other instanceof ImmediateRet)) {
			if (other.canRename) {
				// The source owns its storage: just redirect it to us, emitting nothing.
				return valueClassOf(glob, this.type).create(glob,
					[this.instructions, other.rename(this.instructionReturn).instructions],
					this.instructionReturn, this.type, this.temporary);
			}
			return valueClassOf(glob, this.type).create(glob,
				[this.instructions, other.instructions,
					InstructionBuilder.set(this.instructionReturn, other.instructionReturn)],
				this.instructionReturn, this.type, this.temporary);
		}
		if (other instanceof PointerRet) {
			// A pointer stored into a scalar slot: take its linear address.
			const converted = other.convertTo(glob.semantic.getTypeInfo('int'));
			if (converted === other) {
				throw new InvalidCastException(other, this);
			}
			return this.set(converted);
		}
		if (other instanceof StructRefRet) {
			return super.set(other);
		}
		return super.set(other);
	}

	address() {
		/*
		A variable that is only ever reached through name pointers never has to
		be moved into memory: `&x` is simply the NAME of x.
		*/
		if (this.isNameAddressable) {
			const glob = this.glob;
			const target = glob.tmp(pointerTypeOf(glob, this.type), 'pointer');
			return new NamePointerRet(glob,
				[this.instructions, NamePointerRet.pointAt(glob, target, this.name)],
				target, pointerTypeOf(glob, this.type), true, this.name);
		}
		throw new InfrastructureNotImplementedExpection(
			`${this.instructionReturn} has no address (use 'volatile', 'static' or '&')`);
	}

	/**
	 * Whether `&x` may be taken as the name of x.
	 * @returns {boolean}
	 */
	get isNameAddressable() {
		return this.getAttribute('namePointersOnly') === true
			|| this.symbol?.namePointersOnly === true;
	}
}

export class IntRet extends BasicRet {
	/**
	 * @param {VariableRet} other
	 * @returns {IntRet}
	 */
	set(other) {
		const glob = this.glob;
		if (other instanceof IntRet || other instanceof BoolRet) {
			return IntRet.wrap(super.set(other));
		}
		if (other instanceof FloatRet) {
			const result = super.set(other);
			return new IntRet(glob, [
				result.instructions,
				InstructionBuilder.op('floor', this.instructionReturn, this.instructionReturn)
			], this.instructionReturn, this.type, this.temporary);
		}
		if (other instanceof ContentRet) {
			const result = super.set(other);
			return new IntRet(glob, [
				result.instructions,
				InstructionBuilder.sensor(this.instructionReturn, this.instructionReturn, '@id')
			], this.instructionReturn, this.type, this.temporary);
		}
		if (other instanceof PointerRet) {
			const converted = other.convertTo(glob.semantic.getTypeInfo('int'));
			if (converted === other) throw new InvalidCastException(other, this);
			return this.set(converted);
		}
		return IntRet.wrap(super.set(other));
	}
}

export class BoolRet extends IntRet {
	/**
	 * @param {VariableRet} other
	 * @returns {BoolRet}
	 */
	set(other) {
		if (other instanceof IntRet || other instanceof FloatRet || other instanceof ContentRet) {
			const result = super.set(other);
			return new BoolRet(this.glob, [
				result.instructions,
				InstructionBuilder.op('notEqual', this.instructionReturn, this.instructionReturn, 0)
			], this.instructionReturn, this.type, this.temporary);
		}
		return BoolRet.wrap(super.set(other));
	}
}

export class FloatRet extends BasicRet {
	set(other) {
		return FloatRet.wrap(super.set(other));
	}
}

/** content_t -- game contents (@copper & friends). Never stored in memory. */
export class ContentRet extends BasicRet {
	set(other) {
		const glob = this.glob;
		if (other instanceof ContentRet || other instanceof ImmediateRet) {
			return ContentRet.wrap(super.set(other));
		}
		if (isIntegerLike(glob, other.type) || isSpecialLike(glob, other.type)) {
			const converted = other.convertTo(this.type, contentTypeOf(other.type?.name));
			return this.set(converted);
		}
		return ContentRet.wrap(super.set(other));
	}
}

/** device / unit_t-like handles. */
export class DeviceRet extends BasicRet {
	set(other) {
		return DeviceRet.wrap(super.set(other));
	}
}

export class NullRet extends BasicRet {
	set(other) {
		return NullRet.wrap(super.set(other));
	}
}

/* ------------------------------------------------------------------ *
 * Pointers
 * ------------------------------------------------------------------ */

/**
 * A pointer value: `name_block` is the memory block number, `name_pos` the offset.
 */
export class PointerRet extends VariableRet {

	get width() {
		return 2;
	}

	/**
	 * Read what the pointer points at.
	 * @param {string|SymbolEntry} target Where to store the result.
	 * @returns {VariableRet}
	 */
	fetch(target) {
		const glob = this.glob;
		const name = nameOf(target);
		const inner = (this.type && this.type.pointerTo) ? this.type.pointerTo : null;
		const width = (inner && inner.isPointerImpl()) ? 2 : 1;
		const instructions = [this.instructions, readThrough(glob, this.name, name, width, this.isNear)];
		if (width >= 2) {
			return new RefPointerRet(glob, instructions, name, inner, this.temporary);
		}
		return valueClassOf(glob, inner).create(glob, instructions, name, inner, this.temporary);
	}

	/**
	 * Dereference into a fresh temporary symbol.
	 * @returns {VariableRet}
	 */
	deref() {
		const inner = (this.type && this.type.pointerTo) ? this.type.pointerTo : null;
		return this.fetch(this.glob.tmp(inner, inner && inner.isPointerImpl() ? 'pointer' : null));
	}

	/**
	 * Write into the pointed-to slot.
	 * @param {VariableRet} other
	 * @returns {VariableRet}
	 */
	pointedSet(other) {
		const glob = this.glob;
		const inner = (this.type && this.type.pointerTo) ? this.type.pointerTo : null;
		const value = other.get().convertTo(inner ?? other.type);
		return valueClassOf(glob, inner).create(glob,
			[this.instructions, value.instructions,
				writeThrough(glob, this.name, value.name, value.width, this.isNear)],
			this.name, inner, false);
	}

	/** p + n / p - n */
	offset(step, backward = false) {
		const glob = this.glob;
		const target = glob.tmp(this.type, 'pointer');
		return new RefPointerRet(glob, [
			this.instructions,
			InstructionBuilder.set(`${target}_block`, `${this.name}_block`),
			InstructionBuilder.set(`${target}_pos`, `${this.name}_pos`),
			pointerStep(glob, target, step, this.isNear, backward)
		], target, this.type, true);
	}

	address() {
		throw new InfrastructureNotImplementedExpection('address of a pointer');
	}
}

/** The pointer itself is stored in `name_block` / `name_pos`. */
export class RefPointerRet extends PointerRet {
	/**
	 * @param {VariableRet} other
	 * @returns {RefPointerRet}
	 */
	set(other) {
		const glob = this.glob;
		const value = other.get();
		if (!(value instanceof PointerRet)) {
			// Storing a plain integer into a pointer: rebuild the pointer from the address.
			const converted = value.convertTo(this.type ?? glob.semantic.getTypeInfo('void*'));
			return this.set(converted);
		}
		if (value.canRename) {
			return new RefPointerRet(glob, [
				this.instructions, value.rename(this.instructionReturn).instructions
			], this.instructionReturn, this.type, this.temporary);
		}
		return new RefPointerRet(glob, [
			this.instructions, value.instructions,
			InstructionBuilder.set(`${this.instructionReturn}_block`, `${value.name}_block`),
			InstructionBuilder.set(`${this.instructionReturn}_pos`, `${value.name}_pos`)
		], this.instructionReturn, this.type, this.temporary);
	}
}

/** The pointer value itself lives in memory: `name` is the *address of the pointer*. */
export class MemPointerRet extends PointerRet {

	/**
	 * @param {Globals} glob
	 * @param {any} instructions
	 * @param {string} pointerName Address of the pointer (${X}.__pointer style)
	 * @param {TypeInfo?} type
	 * @param {boolean} temporary
	 * @param {import('./mindcGeneratorBase.js').MemoryBlockInfo?} fixedLocation
	 * @param {SymbolEntry?} symbol
	 */
	constructor(glob, instructions, pointerName, type, temporary = false, fixedLocation = null, symbol = null) {
		super(glob, instructions, pointerName, type, temporary);
		this.fixedLocation = fixedLocation;
		this.symbol = symbol;
		this.setAttribute('isPointer', true);
		this.setAttribute('isPointerAccess', true);
		this.setAttribute('pointerAccess', true);
		this.setAttribute('disallowReplacement', true);
		if (symbol) {
			this.setAttribute('relevantSymbol', symbol);
			this.setAttribute('relevantSymbolRead', symbol);
			this.setAttribute('isSymbolic', true);
			this.setAttribute('isNearPointer', symbol.isNearPointer);
		}
	}

	/** @returns {MemPointerRet} */
	static create(glob, instructions, returner, type, temporary = false, symbol = null, fixedLocation = null) {
		return new this(glob, instructions, returner, type, temporary, fixedLocation, symbol);
	}

	/**
	 * Read the pointer out of memory.
	 * @returns {RefPointerRet}
	 */
	get() {
		const target = this.glob.tmp(this.type, 'pointer');
		return new RefPointerRet(this.glob,
			[this.instructions, referenceRead(this.glob, this, target, 2)], target, this.type, true);
	}

	/**
	 * @param {VariableRet} other
	 * @returns {VariableRet}
	 */
	set(other) {
		const glob = this.glob;
		const value = other.get();
		if (!(value instanceof PointerRet)) {
			return this.set(value.convertTo(this.type ?? glob.semantic.getTypeInfo('void*')));
		}
		return new RefPointerRet(glob,
			[this.instructions, value.instructions, referenceWrite(glob, this, value.name, 2)],
			this.name, this.type, false);
	}

	fetch(target) {
		return this.get().fetch(target);
	}

	deref() {
		return this.get().deref();
	}

	offset(step, backward = false) {
		return this.get().offset(step, backward);
	}

	/** The address of the pointer is known: it is our own address. */
	address() {
		/*
		The type of an address is a POINTER to what we hold. `TypeInfo.pointerTo`
		is null for a struct or union, which would make the address look like a
		single word -- so build the pointer type explicitly.
		*/
		return new RefPointerRet(this.glob, this.instructions, this.name,
			pointerTypeOf(this.glob, this.type), false);
	}
}

export class VolatilePointerRet extends MemPointerRet {
}

/* ------------------------------------------------------------------ *
 * Values that live in memory (accessed through a pointer)
 * ------------------------------------------------------------------ */

/**
 * The value is stored in memory at the address described by pointer `name`
 * (`name_block` / `name_pos`). Reading emits a read; writing emits a write.
 *
 * `fixedLocation`, when set, is a compile-time known MemoryBlockInfo, which allows
 * direct `read/write block pos` without getlink.
 */
export class MemoryRefRet extends VariableRet {

	/**
	 * @param {Globals} glob
	 * @param {any} instructions
	 * @param {string} pointerName
	 * @param {TypeInfo?} type
	 * @param {boolean} temporary
	 * @param {import('./mindcGeneratorBase.js').MemoryBlockInfo?} fixedLocation
	 * @param {SymbolEntry?} symbol
	 */
	constructor(glob, instructions, pointerName, type, temporary = false, fixedLocation = null, symbol = null) {
		super(glob, instructions, pointerName, type, temporary);
		this.fixedLocation = fixedLocation;
		this.symbol = symbol;
		this.setAttribute('isPointerAccess', true);
		this.setAttribute('pointerAccess', true);
		this.setAttribute('disallowReplacement', true);
		if (symbol) {
			this.setAttribute('relevantSymbol', symbol);
			this.setAttribute('relevantSymbolRead', symbol);
			this.setAttribute('isSymbolic', true);
			this.setAttribute('isNearPointer', symbol.isNearPointer);
			this.setAttribute('isRegStruct', symbol.isRegistryStruct());
		}
	}

	/** @returns {MemoryRefRet} */
	static create(glob, instructions, returner, type, temporary = false, symbol = null, fixedLocation = null) {
		return new this(glob, instructions, returner, type, temporary, fixedLocation, symbol);
	}

	/**
	 * Read the value out of memory.
	 * @returns {VariableRet}
	 */
	get() {
		const glob = this.glob;
		const width = this.width;
		const target = glob.tmp(this.type, width >= 2 ? 'pointer' : null);
		const instructions = [this.instructions, referenceRead(glob, this, target, width)];
		return valueClassOf(glob, this.type).create(glob, instructions, target, this.type, true);
	}

	/**
	 * Write into memory.
	 * @param {VariableRet} other
	 * @returns {VariableRet}
	 */
	set(other) {
		const glob = this.glob;
		const value = other.get().convertTo(this.type ?? other.type);
		const instructions = [this.instructions, value.instructions,
			referenceWrite(glob, this, value.name, value.width)];
		// The value of an assignment expression is the value that has been stored --
		// NOT our own name, which is the *address* of that value.
		return valueClassOf(glob, this.type).create(glob, instructions, value.name, this.type, true);
	}

	/**
	 * The address of the value: exactly the pointer we hold.
	 * @returns {RefPointerRet}
	 */
	address() {
		if (this.fixedLocation) {
			// A compile-time constant address has to be materialized first.
			const target = this.glob.tmp(this.type, 'pointer');
			return new RefPointerRet(this.glob,
				[this.instructions, this.fixedLocation.getAssignmentInstruction(target)],
				target, this.type ? this.type.pointerTo : null, true);
		}
		return new RefPointerRet(this.glob, this.instructions, this.name,
			this.type ? this.type.pointerTo : null, false);
	}

	/** Fetch the address as an integer. */
	addressValue() {
		const glob = this.glob;
		const target = glob.tmp(glob.semantic.getTypeInfo('int'));
		if (this.fixedLocation) {
			const ptr = glob.tmp(this.type, 'pointer');
			return new IntRet(glob, [this.instructions,
				this.fixedLocation.getAssignmentInstruction(ptr),
				pointerToValue(glob, ptr, target)], target, glob.semantic.getTypeInfo('int'), true);
		}
		return new IntRet(glob, [this.instructions, pointerToValue(glob, this.name, target)],
			target, glob.semantic.getTypeInfo('int'), true);
	}
}

/* ------------------------------------------------------------------ *
 * Structs / unions
 * ------------------------------------------------------------------ */

/**
 * A struct or union. Depending on the type it is either a set of registers
 * (registry struct, one name per member) or a block of memory (pointer impl).
 * Both are handled by delegating copy to the generator, which already knows
 * how to memcpy / copy member-wise.
 */
export class StructRefRet extends VariableRet {

	constructor(glob, instructions, name, type, temporary = false, symbol = null) {
		super(glob, instructions, name, type, temporary);
		this.symbol = symbol;
		this.setAttribute('isStructRet', true);
		if (type && type.isTypeInfo) {
			this.setAttribute('isRegStruct', type.isRegStruct());
			this.setAttribute('isPointer', type.isPointerImpl());
			this.setAttribute('isPointerAccess', type.isPointerImpl());
		}
		if (symbol) {
			this.setAttribute('relevantSymbol', symbol);
			this.setAttribute('isSymbolic', true);
			this.setAttribute('isNearPointer', symbol.isNearPointer);
		}
	}

	/** @returns {StructRefRet} */
	static create(glob, instructions, returner, type, temporary = false, symbol = null) {
		return new this(glob, instructions, returner, type, temporary, symbol);
	}

	get() {
		return this;
	}

	/**
	 * Struct assignment: delegate to the generator's copy routine.
	 * @param {VariableRet} other
	 * @returns {StructRefRet}
	 */
	set(other) {
		const gen = this.glob.generator;
		if (!gen) throw new InfrastructureNotImplementedExpection('struct copy without generator');
		const source = other.get();
		const copy = gen.copyStruct(this.instructionReturn, source.instructionReturn,
			this.type, source.type);
		return new StructRefRet(this.glob, [this.instructions, source.instructions, copy],
			this.instructionReturn, this.type, this.temporary, this.symbol);
	}

	address() {
		// The address of a struct is a pointer TO that struct, not the struct itself
		return new RefPointerRet(this.glob, this.instructions, this.name,
			pointerTypeOf(this.glob, this.type), false);
	}
}

/* ------------------------------------------------------------------ *
 * Registry structs -- one register per member
 * ------------------------------------------------------------------ */

/**
 * A struct (or union) whose members are **not** laid out in memory but kept in
 * ordinary registers, one variable per member (`X.member`).
 *
 * This is the "registry struct" (`SymbolEntry.isRegistryStruct()` /
 * `TypeInfo.isRegStruct()`) representation:
 *  - `get()` is a no-op: the struct is already a value, and passing it around
 *    means passing every member;
 *  - `set()` copies member by member (there is nothing to memcpy);
 *  - `member(name)` gives the member as an ordinary value, so `a.b = 1` and
 *    `x = a.b` compile to a single `set`.
 *
 * Such a struct can never be turned into a pointer -- there is no address.
 */
export class RegistryStructRet extends StructRefRet {

	constructor(glob, instructions, name, type, temporary = false, symbol = null) {
		super(glob, instructions, name, type, temporary, symbol);
		this.setAttribute('isRegStruct', true);
		this.setAttribute('isPointer', false);
		this.setAttribute('isPointerAccess', false);
	}

	/**
	 * Look up a member of this registry struct.
	 * @param {string} memberName
	 * @param {TypeInfo?} memberType
	 * @returns {VariableRet}
	 */
	member(memberName, memberType = null) {
		const glob = this.glob;
		const type = memberType ?? memberTypeOf(glob, this.type, memberName);
		const name = `${this.instructionReturn}.${memberName}`;
		const member = valueClassOf(glob, type).create(glob, this.instructions, name, type, false);
		member.setAttribute('isFromRegStruct', true);
		member.setAttribute('isSymbolic', true);
		/*
		A member of a registry struct IS a register, so `&s.m` is simply its name
		-- which is exactly what a name pointer stores.
		*/
		if (glob.generator?.namePointerAllowed?.()) member.setAttribute('namePointersOnly', true);
		if (type && type.isTypeInfo) member.set_returns_type(type);
		return member;
	}

	/** The struct is a value already: reading it changes nothing. */
	get() {
		return this;
	}

	/**
	 * @param {VariableRet} other
	 * @returns {RegistryStructRet}
	 */
	set(other) {
		const gen = this.glob.generator;
		if (!gen) throw new InfrastructureNotImplementedExpection('struct copy without generator');
		const source = other.get();
		const copy = gen.copyStruct(this.instructionReturn, source.instructionReturn, this.type, source.type);
		return new RegistryStructRet(this.glob, [this.instructions, source.instructions, copy],
			this.instructionReturn, this.type, this.temporary, this.symbol);
	}

	address() {
		/*
		A registry struct is a group of registers, not a piece of memory, so it
		has no address -- and a processor cannot even build the name one would
		need (`read @this <name>` needs a single, fixed name).
		*/
		throw new InfrastructureNotImplementedExpection(
			`cannot take the address of '${this.instructionReturn}': a struct held in registers has no address (declare it 'volatile' or take the address of a member instead)`);
	}
}

/**
 * The declared type of a struct member.
 * @param {Globals} glob
 * @param {TypeInfo?} structType
 * @param {string} memberName
 * @returns {TypeInfo?}
 */
export function memberTypeOf(glob, structType, memberName) {
	if (!structType || !structType.isTypeInfo) return null;
	const members = structType.members ?? [];
	for (const member of members) {
		if (member.name === memberName) {
			const inner = member.type ?? member.typeInfo ?? null;
			if (inner && inner.isTypeInfo) return inner;
			if (typeof inner === 'string') return glob.semantic.getTypeInfo(inner);
		}
	}
	return null;
}

/* ================================================================== *
 * Alternative representations
 *
 * Under `#pragma optimize(pointer)` (and version >= 150) a pointer does
 * not have to be a `X_block` / `X_pos` pair at all: it may store the
 * **name** of the register it points at, and reach it with
 *
 *      read  target @this <name>
 *      write value  @this <name>
 *
 * (`@this` is the processor itself, and `read` / `write` on it address
 * its own registers by name.)
 *
 * Arrays may be laid out in three further ways (see `selectArray
 * Implementation`), all of which avoid occupying memory:
 *   embedded.divided -- one register per element, picked with `select`;
 *   embedded.lookup  -- one register per element, named after a content
 *                       constant and found with `lookup` + `sensor @name`;
 *   encoded          -- a compile time constant table held in a string.
 * ================================================================== */

/* ------------------------------------------------------------------ *
 * Name pointers -- one register holding the target's NAME
 * ------------------------------------------------------------------ */

/**
 * A pointer that stores the *name* of the register it points at.
 *
 * Supported: taking the address of a register variable (`&x`), copying
 * another name pointer, dereferencing (`*p`, `*p = v`).
 *
 * NOT supported: pointer arithmetic (`p + 2`, `p[2]`) -- adding to a
 * name is meaningless -- and pointing at anything that is not a single
 * register (an array element, for instance).
 */
export class NamePointerRet extends PointerRet {

	constructor(glob, instructions, name, type, temporary = false, targetName = null) {
		super(glob, instructions, name, type, temporary);
		this.targetName = targetName;	// known at compile time, if at all
		this.setAttribute('isNamePointer', true);
	}

	/** The name itself is one word. */
	get width() {
		return 1;
	}

	/** The value is the address: nothing to read. */
	get() {
		return this;
	}

	address() {
		if (!this.getAttribute('isSymbolic')) return this;
		/*
		`&p` where p is itself a name pointer: the only thing one can do with
		that address is store it in another name pointer, and what it stores is
		the NAME of p.
		*/
		const glob = this.glob;
		const pointer = pointerTypeOf(glob, this.type);
		const target = glob.tmp(pointer, 'pointer');
		return new NamePointerRet(glob,
			[NamePointerRet.pointAt(glob, target, this.name)],
			target, pointer, true, this.name);
	}

	/** The type this pointer points at. */
	get pointee() {
		return (this.type && this.type.pointerTo) ? this.type.pointerTo : null;
	}

	/** The LValue reached through this pointer. */
	slot() {
		return new NameSlotRet(this.glob, this, this.pointee);
	}

	/**
	 * Materialize `&x`: store the name of `x` as a string.
	 * @param {Globals} glob
	 * @param {string} target Register receiving the name
	 * @param {string} assemblyName Name of the register being pointed at
	 * @returns {Instruction}
	 */
	static pointAt(glob, target, assemblyName) {
		return InstructionBuilder.set(target, `"${assemblyName}"`);
	}

	/**
	 * Read the pointed-to register.
	 * @param {string|SymbolEntry} target
	 * @returns {VariableRet}
	 */
	fetch(target) {
		const glob = this.glob;
		const inner = this.pointee;
		/*
		Only a single register can be named. A pointer counts as one here: when
		name pointers are in use, what `*pp` reads out of `p` is another NAME,
		so the result is a name pointer again (that is what makes `**pp` work).
		*/
		if (inner && widthOfType(inner) !== 1 && inner.kind !== 'pointer') {
			throw new InfrastructureNotImplementedExpection(
				'a name pointer cannot point at a value that is not a single register');
		}
		const name = nameOf(target);
		const source = this.targetName ? `"${this.targetName}"` : this.name;
		const instructions = [this.instructions, InstructionBuilder.read(name, '@this', source)];
		if (inner && inner.kind === 'pointer') {
			return new NamePointerRet(glob, instructions, name, inner, this.temporary, null);
		}
		return valueClassOf(glob, inner).create(glob, instructions, name, inner, this.temporary);
	}

	/**
	 * Write the pointed-to register.
	 * @param {VariableRet} other
	 * @returns {VariableRet}
	 */
	pointedSet(other) {
		const glob = this.glob;
		const inner = this.pointee;
		if (inner && widthOfType(inner) !== 1 && inner.kind !== 'pointer') {
			throw new InfrastructureNotImplementedExpection(
				'a name pointer cannot point at a value that is not a single register');
		}
		const value = other.get().convertTo(inner ?? other.type);
		const source = this.targetName ? `"${this.targetName}"` : this.name;
		return valueClassOf(glob, inner).create(glob,
			[this.instructions, value.instructions,
				InstructionBuilder.write(value.name, '@this', source)],
			value.name, inner, false);
	}

	deref() {
		const inner = (this.type && this.type.pointerTo) ? this.type.pointerTo : null;
		return this.fetch(this.glob.tmp(inner));
	}

	/**
	 * @param {VariableRet} other
	 * @returns {NamePointerRet}
	 */
	set(other) {
		const glob = this.glob;
		const value = other.get();
		if (value instanceof NamePointerRet) {
			return new NamePointerRet(glob, [this.instructions, value.instructions,
				InstructionBuilder.set(this.name, value.name)],
				this.name, this.type, this.temporary, value.targetName);
		}
		if (value instanceof ImmediateRet) {
			// `p = &x` written out as the plain name string
			return new NamePointerRet(glob, [this.instructions,
				InstructionBuilder.set(this.name, value.name)],
				this.name, this.type, this.temporary, null);
		}
		if (widthOfType(value.type) <= 1) {
			// Any other single register: it holds a name, so copy it
			return new NamePointerRet(glob, [this.instructions, value.instructions,
				InstructionBuilder.set(this.name, value.name)],
				this.name, this.type, this.temporary, null);
		}
		throw new InvalidCastException(other, this);
	}

	/** Not supported: adding to a name is meaningless. */
	offset(step, backward = false) {
		throw new InfrastructureNotImplementedExpection(
			'pointer arithmetic on a name pointer (point it at an array instead)');
	}
}

/**
 * A pointer only ever carries a name when the optimisation has been
 * asked for, the target version supports `read @this`, and static
 * analysis decided that this particular pointer is eligible (see
 * `analyzeNamePointers` in mindcOptimizer.js).
 *
 * @param {any} symbol The pointer's SymbolEntry
 * @param {{targetVersion: number, pointerOptimize: boolean}} options
 * @returns {boolean}
 */
export function usesNamePointer(symbol, options = {}) {
	if (!symbol) return false;
	if (options.pointerOptimize !== true) return false;
	if ((options.targetVersion ?? 0) < 150) return false;
	return symbol.usesNamePointer === true;
}

/**
 * The slot a name pointer points at: reading emits `read @this <name>`,
 * writing emits `write @this <name>`.
 */
export class NameSlotRet extends VariableRet {

	/**
	 * @param {Globals} glob
	 * @param {NamePointerRet} pointer
	 * @param {TypeInfo?} type
	 */
	constructor(glob, pointer, type = null) {
		super(glob, pointer.instructions, pointer.name, type ?? pointer.pointee, pointer.temporary);
		this.pointer = pointer;
		this.setAttribute('isNameSlot', true);
	}

	get width() {
		return 1;
	}

	address() {
		return this.pointer;
	}

	get() {
		return this.pointer.fetch(this.glob.tmp(this.type));
	}

	/**
	 * @param {VariableRet} other
	 * @returns {VariableRet}
	 */
	set(other) {
		return this.pointer.pointedSet(other);
	}
}

/**
 * Which representation a pointer symbol should get.
 *
 * @param {any} symbol
 * @param {{targetVersion: number, pointerOptimize: boolean}} options
 * @returns {'name' | 'memory'}
 */
export function pointerStyleOf(symbol, options = {}) {
	return usesNamePointer(symbol, options) ? 'name' : 'memory';
}

/* ------------------------------------------------------------------ *
 * Arrays -- subscript access, several possible layouts
 * ------------------------------------------------------------------ */

/**
 * Turn an index (a `VariableRet`, a number or a name) into an operand.
 *
 * @param {Globals} glob
 * @param {VariableRet | number | string} index
 * @returns {{instructions: any[], name: string, constant: boolean, value: number?}}
 */
function operandOf(glob, index) {
	if (index instanceof VariableRet) {
		const value = index.get();
		return { instructions: [value.instructions], name: value.name, constant: false, value: null };
	}
	const text = String(index);
	const numeric = /^-?\d+$/.test(text) ? Number(text) : null;
	return { instructions: [], name: text, constant: numeric !== null, value: numeric };
}

/**
 * Base class of the array representations.
 *
 * Every representation supports `element(i)`, which returns an LValue
 * (`get()` / `set()`); only the traditional layout can be converted
 * into a pointer, since the others have no address.
 */
export class ArrayRet extends VariableRet {

	constructor(glob, instructions, name, type, temporary = false, length = 0) {
		super(glob, instructions, name, type, temporary);
		this.length = length;
		this.setAttribute('isArrayRet', true);
	}

	get elementTypeInfo() {
		return (this.type && this.type.pointerTo) ? this.type.pointerTo : null;
	}

	get elementSize() {
		return widthOfType(this.elementTypeInfo);
	}

	/**
	 * The LValue of `a[index]`.
	 * @param {VariableRet | number | string} index
	 * @returns {VariableRet}
	 */
	element(index) {
		throw new InfrastructureNotImplementedExpection(`subscript of ${this.constructor.name}`);
	}

	/** Arrays are never read as a whole. */
	get() {
		return this;
	}

	/** Whether this layout can be turned into a pointer. */
	get convertibleToPointer() {
		return false;
	}

	address() {
		throw new InfrastructureNotImplementedExpection(
			`${this.constructor.name} cannot be converted into a pointer`);
	}
}

/**
 * The ordinary layout: a contiguous block of memory reached through a
 * `X_block` / `X_pos` pointer. The only convertible one.
 */
export class TraditionalArrayRet extends ArrayRet {

	/**
	 * @param {Globals} glob
	 * @param {PointerRet} pointer Address of the first element
	 * @param {TypeInfo?} type
	 * @param {number?} length
	 */
	constructor(glob, pointer, type = null, length = 0) {
		super(glob, pointer.instructions, pointer.name, type ?? pointer.type, pointer.temporary, length);
		this.pointer = pointer;
	}

	get convertibleToPointer() {
		return true;
	}

	address() {
		return this.pointer;
	}

	/** `a[i]` is the memory slot at `base + i * size`. */
	element(index) {
		const glob = this.glob;
		const operand = operandOf(glob, index);
		const size = this.elementSize;
		const base = this.pointer.get();
		let step = operand.name, extra = [];
		if (size > 1) {
			if (operand.constant) {
				step = operand.value * size;
			} else {
				const scaled = glob.tmp(null);
				extra = [InstructionBuilder.op('mul', scaled, operand.name, size)];
				step = scaled;
			}
		}
		const address = (step === 0) ? base : base.offset(step);
		return new MemoryRefRet(glob, [operand.instructions, extra, address.instructions],
			address.name, this.elementTypeInfo, true);
	}
}

/** One element of a `DividedArrayRet`. */
class DividedSlotRet extends VariableRet {

	/**
	 * @param {Globals} glob
	 * @param {DividedArrayRet} array
	 * @param {{instructions: any[], name: string, constant: boolean, value: number?}} operand
	 */
	constructor(glob, array, operand) {
		super(glob, operand.instructions, array.name, array.elementTypeInfo, false);
		this.array = array;
		this.operand = operand;
	}

	/**
	 * A constant index names one register outright: no code at all.
	 * Otherwise every element is tried in turn with `select`.
	 */
	get() {
		const glob = this.glob;
		if (this.operand.constant) {
			const index = this.operand.value;
			if (index < 0 || index >= this.array.length) {
				throw new InfrastructureNotImplementedExpection('subscript out of range');
			}
			return valueClassOf(glob, this.type).create(glob, this.instructions,
				this.array.elementName(index), this.type, false);
		}
		const target = glob.tmp(this.type);
		const parts = [this.instructions,
			InstructionBuilder.set(target, this.array.elementName(0))];
		for (let i = 1; i < this.array.length; i++) {
			parts.push(InstructionBuilder.selectx(target, `equal ${this.operand.name} ${i}`,
				this.array.elementName(i), target));
		}
		return valueClassOf(glob, this.type).create(glob, parts, target, this.type, true);
	}

	/**
	 * Writing cannot be done with `select` (it picks a *value*, not a
	 * target), so the *name* of the element is selected and then used
	 * through `write @this <name>` -- exactly like a name pointer.
	 */
	set(other) {
		const glob = this.glob;
		const value = other.get().convertTo(this.type ?? other.type);
		if (this.operand.constant) {
			const index = this.operand.value;
			if (index < 0 || index >= this.array.length) {
				throw new InfrastructureNotImplementedExpection('subscript out of range');
			}
			return valueClassOf(glob, this.type).create(glob,
				[this.instructions, value.instructions,
					InstructionBuilder.set(this.array.elementName(index), value.name)],
				value.name, this.type, false);
		}
		const chosen = glob.tmp(null);
		const parts = [this.instructions, value.instructions,
			InstructionBuilder.set(chosen, `"${this.array.elementName(0)}"`)];
		for (let i = 1; i < this.array.length; i++) {
			parts.push(InstructionBuilder.selectx(chosen, `equal ${this.operand.name} ${i}`,
				`"${this.array.elementName(i)}"`, chosen));
		}
		parts.push(InstructionBuilder.write(value.name, '@this', chosen));
		return valueClassOf(glob, this.type).create(glob, parts, value.name, this.type, false);
	}
}

/**
 * `embedded.divided`: every element is a register of its own, and the
 * subscript picks which one.
 *
 * A constant subscript costs nothing at all; a variable one costs
 * `length - 1` `select` instructions -- which is why this is only chosen
 * for short arrays, or when no memory is left.
 */
export class DividedArrayRet extends ArrayRet {

	/**
	 * @param {Globals} glob
	 * @param {string} baseName Elements are named `baseName_0`, ...
	 * @param {TypeInfo?} type
	 * @param {number} length
	 */
	constructor(glob, baseName, type, length) {
		super(glob, [], baseName, type, false, length);
	}

	elementName(index) {
		return `${this.name}_${index}`;
	}

	element(index) {
		return new DividedSlotRet(this.glob, this, operandOf(this.glob, index));
	}
}

/**
 * `embedded.lookup`: every element is a register named after a content
 * constant (`copper`, `water`, `@alpha`'s name, ...).
 *
 * The subscript is turned into the constant with `lookup`, its name is
 * read with `sensor @name`, and the register is then reached exactly
 * like a name pointer:
 *
 *      lookup item  T  i
 *      sensor       N  T @name
 *      read   target @this N
 *
 * This costs the same three instructions whatever the array is long,
 * but it only works for at most `list.length` elements.
 *
 * @see mindcBase.js -- objectList / liquidList / unitList / buildingList
 */
export class LookupArrayRet extends ArrayRet {

	/**
	 * @param {Globals} glob
	 * @param {string} category item | liquid | unit | building
	 * @param {string[]} names The register names, one per element
	 * @param {TypeInfo?} type
	 */
	constructor(glob, category, names, type) {
		super(glob, [], `__lookup_${category}`, type, false, names.length);
		this.category = category;
		this.names = names;
	}

	/** How many elements this category can address. */
	get capacity() {
		return this.names.length;
	}

	/**
	 * @param {VariableRet | number | string} index
	 * @returns {VariableRet}
	 */
	element(index) {
		const glob = this.glob;
		const operand = operandOf(glob, index);
		if (operand.constant) {
			const at = this.names[operand.value];
			if (at === undefined) throw new InfrastructureNotImplementedExpection('subscript out of range');
			// The name is known: nothing to compute at all
			return valueClassOf(glob, this.elementTypeInfo).create(glob, [],
				at, this.elementTypeInfo, false);
		}
		return new LookupSlotRet(glob, this, operand, this.elementTypeInfo);
	}
}

/** One element of a `LookupArrayRet`, addressed at run time. */
class LookupSlotRet extends VariableRet {

	constructor(glob, array, operand, type) {
		super(glob, operand.instructions, array.name, type, false);
		this.array = array;
		this.operand = operand;
	}

	/**
	 * The register name of the element, in `target`.
	 * @param {Globals} glob
	 * @param {string} content Register receiving the looked-up constant
	 * @param {string} target Register receiving the name
	 * @returns {Instruction}
	 */
	resolve(glob, content, target) {
		return new Instruction([
			InstructionBuilder.lookup(this.array.category, content, this.operand.name),
			InstructionBuilder.sensor(target, content, '@name')
		]);
	}

	get() {
		const glob = this.glob;
		const content = glob.tmp(glob.semantic.getTypeInfo('content_t'));
		const nameHolder = glob.tmp(null);
		const target = glob.tmp(this.type);
		return valueClassOf(glob, this.type).create(glob, [
			this.instructions, this.resolve(glob, content, nameHolder),
			InstructionBuilder.read(target, '@this', nameHolder)
		], target, this.type, true);
	}

	set(other) {
		const glob = this.glob;
		const content = glob.tmp(glob.semantic.getTypeInfo('content_t'));
		const nameHolder = glob.tmp(null);
		const value = other.get().convertTo(this.type ?? other.type);
		return valueClassOf(glob, this.type).create(glob, [
			this.instructions, value.instructions, this.resolve(glob, content, nameHolder),
			InstructionBuilder.write(value.name, '@this', nameHolder)
		], value.name, this.type, false);
	}
}

/* ------------------------------------------------------------------ *
 * `encoded` -- a compile time constant table held in a string
 * ------------------------------------------------------------------ */

/**
 * The character codes that may appear in an encoded table.
 *
 * Everything from `\` (92) onwards is excluded -- and so is `"` (34) --
 * because those would need escaping inside a string literal.
 */
export const ENCODED_CODES = (() => {
	const codes = [];
	for (let code = 35; code <= 91; code++) codes.push(code);
	return codes;
})();

/**
 * `read target "<table>" i` yields the ASCII **code** of the i-th
 * character, so every digit comes back shifted by this amount.
 */
export const ENCODED_OFFSET = ENCODED_CODES[0];

/** How many distinct values one character can carry. */
export const ENCODED_RADIX = ENCODED_CODES.length;

/**
 * Turn digit values into the string that stores them.
 * @param {number[]} digits Every digit must be in `[0, ENCODED_RADIX)`.
 * @returns {string}
 */
export function encodeDigits(digits) {
	return digits.map(d => String.fromCharCode(ENCODED_CODES[d])).join('');
}

/**
 * Build the mapping `index -> value` of a constant array.
 *
 * A string is a read-only ROM: `read target "<table>" i` yields the
 * ASCII code of the i-th character, which is one instruction for the
 * whole lookup. Values that do not fit in a single character are split
 * into base-`ENCODED_RADIX` digits, one table per digit, and put back
 * together with Horner's rule (3 instructions per extra digit).
 *
 * The alternative -- a chain of `select` -- costs `n - 1` instructions,
 * so the cheaper of the two is returned.
 *
 * @param {number[]} values The constant contents, index by index
 * @returns {{tables: string[], radix: number, shift: number, digits: number,
 *            cost: number, kind: 'single' | 'digits' | 'chain'}}
 */
export function buildEncodedMapping(values) {
	const radix = ENCODED_RADIX;
	const numbers = values.map(v => Number(v));
	if (numbers.some(v => !Number.isFinite(v))) {
		throw new InfrastructureNotImplementedExpection('encoded arrays must hold numbers');
	}
	const lowest = Math.min(...numbers);
	const shifts = (lowest < 0) ? [0, -lowest] : [0];
	let best = null;
	for (const shift of shifts) {
		const shifted = numbers.map(v => v + shift);
		if (shifted.some(v => v < 0)) continue;
		const highest = Math.max(...shifted);
		let digits = 1, span = radix;
		while (highest >= span) { digits++; span *= radix; }
		const tables = [];
		for (let k = 0; k < digits; k++) {
			const power = Math.pow(radix, k);
			tables.push(encodeDigits(shifted.map(v => Math.floor(v / power) % radix)));
		}
		/*
		Every character read comes back as `digit + ENCODED_OFFSET`, so all of
		them together add `OFFSET * (1 + R + ... + R^(K-1))` to the Horner sum.
		That whole quantity is a constant, so one `sub` at the end undoes it
		(together with the shift that made the values non-negative).
		*/
		let spanSum = 0;
		for (let k = 0; k < digits; k++) spanSum += Math.pow(radix, k);
		const correction = ENCODED_OFFSET * spanSum + shift;
		const cost = (digits === 1 ? 2 : 3 * digits - 1) - (correction !== 0 ? 0 : 1);
		if (!best || cost < best.cost) {
			best = { tables, radix, shift, digits, cost, correction, kind: digits === 1 ? 'single' : 'digits' };
		}
	}
	// The fallback: a plain chain of comparisons
	const chainCost = Math.max(1, numbers.length - 1);
	if (!best || chainCost < best.cost) {
		best = { tables: [], radix, shift: 0, digits: 0, cost: chainCost, correction: 0, kind: 'chain' };
	}
	return best;
}

/**
 * A constant array held as one or more strings.
 *
 * Only reading makes sense -- the array is `const`, so `set()` refuses.
 */
export class EncodedArrayRet extends ArrayRet {

	/**
	 * @param {Globals} glob
	 * @param {number[]} values
	 * @param {TypeInfo?} type
	 * @param {{tables: string[], radix: number, shift: number, digits: number,
	 *          cost: number, kind: string}?} mapping From `buildEncodedMapping`
	 */
	constructor(glob, values, type, mapping = null) {
		super(glob, [], '__encoded', type, false, values.length);
		this.values = values;
		this.mapping = mapping ?? buildEncodedMapping(values);
	}

	/** @param {VariableRet | number | string} index */
	element(index) {
		const glob = this.glob;
		const operand = operandOf(glob, index);
		// A constant index is known at compile time: emit the value itself
		if (operand.constant) {
			const value = this.values[operand.value];
			if (value === undefined) throw new InfrastructureNotImplementedExpection('subscript out of range');
			return new ImmediateRet(glob, String(value), this.elementTypeInfo);
		}
		return new EncodedSlotRet(glob, this, operand, this.elementTypeInfo);
	}
}

/** One element of an `EncodedArrayRet`, addressed at run time. */
class EncodedSlotRet extends VariableRet {

	constructor(glob, array, operand, type) {
		super(glob, operand.instructions, array.name, type, false);
		this.array = array;
		this.operand = operand;
	}

	get() {
		const glob = this.glob;
		const mapping = this.array.mapping;
		const target = glob.tmp(this.type);
		const parts = [this.instructions];
		if (mapping.kind === 'chain') {
			parts.push(InstructionBuilder.set(target, String(this.array.values[0])));
			for (let i = 1; i < this.array.values.length; i++) {
				parts.push(InstructionBuilder.selectx(target,
					`equal ${this.operand.name} ${i}`, String(this.array.values[i]), target));
			}
			return valueClassOf(glob, this.type).create(glob, parts, target, this.type, true);
		}
		// Horner: start with the highest digit, then shift and add
		parts.push(InstructionBuilder.read(target, `"${mapping.tables[mapping.digits - 1]}"`,
			this.operand.name));
		for (let k = mapping.digits - 2; k >= 0; k--) {
			const digit = glob.tmp(null);
			parts.push(InstructionBuilder.read(digit, `"${mapping.tables[k]}"`, this.operand.name));
			parts.push(InstructionBuilder.op('mul', target, target, mapping.radix));
			parts.push(InstructionBuilder.op('add', target, target, digit));
		}
		if (mapping.correction !== 0) {
			parts.push(InstructionBuilder.op('sub', target, target, mapping.correction));
		}
		return valueClassOf(glob, this.type).create(glob, parts, target, this.type, true);
	}

	set(other) {
		throw new InfrastructureNotImplementedExpection(
			'an encoded array is constant and cannot be written to');
	}
}

/* ------------------------------------------------------------------ *
 * Choosing a representation
 * ------------------------------------------------------------------ */

/**
 * Rough instruction cost of one subscript access for each layout.
 *
 * The numbers are per-access estimates used only to *compare* layouts;
 * the traditional layout additionally needs `length * size` memory
 * cells, and everything but the traditional layout needs v150.
 */
export function accessCostOf(kind, length, digits = 1) {
	switch (kind) {
		case 'traditional': return 4;				// getlink + read/write + address
		case 'embedded.divided': return Math.max(1, length);	// a `select` per element
		case 'embedded.lookup': return 3;			// lookup + sensor + read/write
		case 'encoded': return digits <= 1 ? 2 : 3 * digits - 1;
		default: return 4;
	}
}

/**
 * Pick the layout of an array.
 *
 * The rules, in order:
 *  1. an explicitly requested layout (`array("...")`) always wins;
 *  2. otherwise memory is used while there is enough of it -- that is
 *     the layout with the cheapest access;
 *  3. when memory runs out, the layouts that need none are considered,
 *     and the one with the fewest instructions is taken. If even that
 *     does not fit the remaining instruction budget, the traditional
 *     layout is used anyway: running out of instructions is worse than
 *     running out of memory.
 *
 * @param {object} info
 * @param {number} info.length Number of elements
 * @param {number} [info.size] Words per element
 * @param {boolean} [info.isConst]
 * @param {number[]} [info.values] Contents, for constant arrays
 * @param {number} [info.availableMemory] Free memory cells
 * @param {number} [info.instructionBudget] Instructions still available
 * @param {number} [info.targetVersion]
 * @param {string?} [info.requested] Layout asked for by `array(...)`
 * @param {string[]?} [info.lookupNames] Names for the `lookup` layout
 * @returns {{type: string, implement: string?, reason: string}}
 */
export function selectArrayImplementation(info) {
	const length = info.length ?? 0;
	const size = info.size ?? 1;
	const isConst = info.isConst === true;
	const version = info.targetVersion ?? 0;
	const memory = info.availableMemory ?? Infinity;
	const budget = info.instructionBudget ?? 1000;
	const requested = normalizeImplementation(info.requested);
	const lookupNames = info.lookupNames ?? null;

	if (requested) return requested;

	const cells = length * size;
	if (cells <= memory) {
		return { type: 'traditional', implement: null, reason: 'memory available' };
	}
	// No (or not enough) memory: consider the layouts that need none
	const candidates = [];
	if (version >= 150 && lookupNames && lookupNames.length >= length) {
		candidates.push({ type: 'embedded', implement: 'lookup',
			cost: accessCostOf('embedded.lookup', length) });
	}
	if (isConst) {
		const mapping = buildEncodedMapping(info.values ?? new Array(length).fill(0));
		candidates.push({ type: 'encoded', implement: null,
			cost: accessCostOf('encoded', length, mapping.digits) });
	}
	candidates.push({ type: 'embedded', implement: 'divided',
		cost: accessCostOf('embedded.divided', length) });
	// Fewest instructions first
	candidates.sort((x, y) => x.cost - y.cost);
	const affordable = candidates.find(c => c.cost <= budget);
	if (affordable) return { ...affordable, reason: 'out of memory' };
	// Nothing fits the budget either: instructions matter more than memory
	return { ...candidates[0], reason: 'budget exhausted, instructions take priority' };
}

/**
 * Turn the string given to `array(...)` into a style.
 *
 * @param {string?} text
 * @returns {{type: string, implement: string?, reason: string}?}
 */
export function normalizeImplementation(text) {
	if (!text) return null;
	const name = String(text).trim();
	switch (name) {
		case 'traditional': return { type: 'traditional', implement: null, reason: 'requested' };
		case 'embedded': return { type: 'embedded', implement: null, reason: 'requested' };
		case 'embedded_divided': return { type: 'embedded', implement: 'divided', reason: 'requested' };
		case 'embedded_lookup': return { type: 'embedded', implement: 'lookup', reason: 'requested' };
		case 'encoded': return { type: 'encoded', implement: null, reason: 'requested' };
		default: return null;
	}
}

/**
 * Build the array representation described by a style.
 *
 * @param {Globals} glob
 * @param {{type: string, implement: string?}} style
 * @param {object} options
 * @param {PointerRet?} [options.pointer] For the traditional layout
 * @param {TypeInfo?} [options.type] The array type
 * @param {number} [options.length]
 * @param {string} [options.baseName] Element register prefix
 * @param {string} [options.category] item | liquid | unit | building
 * @param {string[]} [options.names] Register names for `lookup`
 * @param {number[]} [options.values] Contents for `encoded`
 * @returns {ArrayRet}
 */
export function arrayRetOf(glob, style, options = {}) {
	const type = options.type ?? null;
	const length = options.length ?? 0;
	if (!style || style.type === 'traditional') {
		if (!options.pointer) {
			throw new InfrastructureNotImplementedExpection('traditional array without a pointer');
		}
		return new TraditionalArrayRet(glob, options.pointer, type, length);
	}
	if (style.type === 'encoded') {
		return new EncodedArrayRet(glob, options.values ?? new Array(length).fill(0), type);
	}
	// style.type === 'embedded'
	if (style.implement === 'lookup') {
		const names = options.names ?? [];
		const category = options.category ?? 'item';
		return new LookupArrayRet(glob, category, names, type);
	}
	// 'divided', or 'embedded' left unspecified
	return new DividedArrayRet(glob, options.baseName ?? '__divided', type, length);
}

/* ------------------------------------------------------------------ *
 * Factories & bridge with the legacy attribute-based Instruction
 * ------------------------------------------------------------------ */

/**
 * Which value class should be used for a given type.
 * @param {Globals} glob
 * @param {TypeInfo?} type
 */
export function valueClassOf(glob, type) {
	if (!type || !type.isTypeInfo) return BasicRet;
	if (type.kind === 'pointer' || type.kind === 'array') {
		return RefPointerRet;
	}
	if (type.kind === 'struct' || type.kind === 'union') {
		// Registry structs live in registers (one variable per member); the others
		// are laid out in memory and referred to through a pointer.
		return type.isRegStruct() ? RegistryStructRet : StructRefRet;
	}
	if (glob.semantic.isLogicalType(type.name)) {
		if (type.name === 'bool') return BoolRet;
		if (['float', 'double'].includes(type.name)) return FloatRet;
		return IntRet;
	}
	switch (type.name) {
		case 'content_t': return ContentRet;
		case 'device': return DeviceRet;
		case 'null_t': return NullRet;
		case 'char': return BasicRet;
		default: return BasicRet;
	}
}

/**
 * Build the reference (LValue) of a symbol: something you can get() and set().
 * This centralizes what used to be `generateSymbolRead` / `generateSymbolWrite`.
 * @param {Globals} glob
 * @param {SymbolEntry} symbol
 * @returns {VariableRet}
 */
export function symbolRef(glob, symbol) {
	const assembly = symbol.getAssemblySymbol();
	const type = symbol.myType();

	if (symbol.isAutoDevice) {
		return new DeviceRet(glob, [], assembly, type, false);
	}

	// Structs and unions
	if (type && type.isTypeInfo && ['struct', 'union'].includes(type.kind)) {
		if (type.isPointerImpl()) {
			return new StructRefRet(glob, [], symbol.accessThroughPointer ? `${assembly}.__pointer` : assembly,
				type, false, symbol);
		}
		// Registry struct: the members are `X.member` registers
		const reg = new RegistryStructRet(glob, [], assembly, type, false, symbol);
		reg.setAttribute('isSymbolic', true);
		reg.setAttribute('relevantSymbol', symbol);
		reg.setAttribute('relevantSymbolRead', symbol);
		reg.setAttribute('disallowReplacement', true);
		reg.setAttribute('isTemporary', symbol.isVirtualSymbol);
		return reg;
	}

	// Pointers that store the NAME of what they point at
	if (symbol.usesNamePointer === true) {
		const ret = new NamePointerRet(glob, [], assembly, type, symbol.isVirtualSymbol, null);
		ret.setAttribute('isSymbolic', true);
		ret.setAttribute('relevantSymbol', symbol);
		ret.setAttribute('relevantSymbolRead', symbol);
		ret.setAttribute('disallowReplacement', true);
		ret.setAttribute('isTemporary', symbol.isVirtualSymbol);
		return ret;
	}

	// Pointer-like values (pointer / array): the value *is* a pointer
	if (symbol.implementAsPointer) {
		/*
		An array is delivered BY REFERENCE: its value IS the address held in
		`X_block` / `X_pos`. Reading it out of `X.__pointer` instead treats the
		array's own data as a pointer, which is what broke `&a[1]`.
		*/
		if (symbol.accessThroughPointer && !(type && type.kind === 'array')) {
			const fixed = symbol.memoryRef();
			return new MemPointerRet(glob, [], `${assembly}.__pointer`, type, false, fixed, symbol);
		}
		const ret = new RefPointerRet(glob, [], assembly, type, symbol.isVirtualSymbol, symbol);
		ret.setAttribute('isSymbolic', true);
		ret.setAttribute('relevantSymbol', symbol);
		ret.setAttribute('relevantSymbolRead', symbol);
		ret.setAttribute('isNearPointer', symbol.isNearPointer);
		ret.setAttribute('disallowReplacement', true);
		ret.setAttribute('isTemporary', symbol.isVirtualSymbol);
		return ret;
	}

	// Ordinary values stored in memory
	if (symbol.accessThroughPointer) {
		const fixed = symbol.memoryLocation;
		return new MemoryRefRet(glob, [], `${assembly}.__pointer`, type, false, fixed, symbol);
	}

	// Ordinary values in registers
	const ret = valueClassOf(glob, type).create
		? valueClassOf(glob, type).create(glob, [], assembly, type, symbol.isVirtualSymbol, symbol)
		: new (valueClassOf(glob, type))(glob, [], assembly, type, symbol.isVirtualSymbol);
	ret.setAttribute('isSymbolic', true);
	ret.setAttribute('relevantSymbol', symbol);
	ret.setAttribute('relevantSymbolRead', symbol);
	ret.setAttribute('disallowReplacement', true);
	ret.setAttribute('isTemporary', symbol.isVirtualSymbol);
	ret.setAttribute('isNearPointer', symbol.isNearPointer);
	if (symbol.namePointersOnly === true) ret.setAttribute('namePointersOnly', true);
	return ret;
}

/**
 * Wrap a legacy `Instruction` (attribute based) into the object oriented world.
 * Used while the refactoring is in progress, and for every non-refactored visitor.
 * @param {Globals} glob
 * @param {Instruction} inst
 * @param {TypeInfo?} type
 * @returns {VariableRet}
 */
/**
 * Is this mlog operand an immediate constant rather than a name?
 * @param {string?} text
 * @returns {boolean}
 */
export function isImmediateName(text) {
	if (text === null || text === undefined || text === '') return true;
	if (/^-?[0-9]+(\.[0-9]+)?$/.test(text)) return true;	// numeric literal
	if (text[0] === '@') return true;						// @copper & friends
	if (text[0] === '"') return true;						// string literal
	return ['null', 'true', 'false'].includes(text);
}

/**
 * Build the Ret described by a legacy instruction. Shared by `ExportRet` and by the
 * "protected name" path.
 * @param {Globals} glob
 * @param {Instruction} inst
 * @param {TypeInfo?} type
 * @param {number} width
 * @param {boolean} throughPointer
 * @param {boolean} temporary
 * @param {SymbolEntry?} relevant
 * @returns {VariableRet}
 */
function buildRet(glob, inst, type, width, throughPointer, temporary, relevant) {
	const fixed = relevant ? relevant.memoryLocation : null;
	if (throughPointer) {
		if (width >= 2) {
			return new MemPointerRet(glob, inst.instructions, inst.instructionReturn, type,
				temporary, fixed, relevant ?? null);
		}
		return new MemoryRefRet(glob, inst.instructions, inst.instructionReturn, type,
			temporary, fixed, relevant ?? null);
	}
	if (width >= 2) {
		return new RefPointerRet(glob, inst.instructions, inst.instructionReturn, type, temporary);
	}
	if (type && type.isTypeInfo && ['struct', 'union'].includes(type.kind)) {
		return new StructRefRet(glob, inst.instructions, inst.instructionReturn, type,
			temporary, relevant ?? null);
	}
	return valueClassOf(glob, type).create(glob, inst.instructions, inst.instructionReturn, type, temporary);
}

export function ExportRet(glob, inst, type = null) {
	if (!inst) return new ImmediateRet(glob, 'null', type);
	if (inst instanceof VariableRet) return inst;

	const attrs = name => inst.getAttribute(name);
	const relevant = attrs('relevantSymbol') ?? attrs('relevantSymbolRead');
	/*
	`volatile` means "this variable MUST live in memory", so a volatile value is
	always talked about THROUGH a pointer -- but a volatile *scalar* still occupies
	a single word. Legacy attributes:
	  isPointerAccess && width 1 : value in memory, one word   -> MemoryRefRet
	  isPointerAccess && width 2 : pointer value itself in mem -> MemPointerRet
	  isPointer       && width 2 : a pointer value             -> RefPointerRet
	*/
	const width = widthOfType(type);
	/*
	Whether the value is *really* reached through a pointer is decided by the SYMBOL,
	not by the type: a type qualifier (`volatile`) is inherited by intermediate
	results (e.g. `vg * 2` is still `volatile int`), but a temporary symbol holding
	that result is a plain register.
	*/
	const throughPointer = relevant
		? (relevant.accessThroughPointer === true)
		: (attrs('isPointerAccess') === true);
	// `isTemporary` gets lost through Instruction.concat_returns (it is not part of its
	// transfer list), so fall back to the symbol itself.
	const temporary = attrs('isTemporary') === true
		|| (relevant ? relevant.isVirtualSymbol === true : false);

	/*
	`disallowReplacement` in the legacy system only means "my name must not be
	substituted by a template". A constant therefore really is an immediate value,
	but a *variable* carrying that flag is still a perfectly ordinary reference --
	it just may not be renamed.
	*/
	if (attrs('disallowReplacement')) {
		if (isImmediateName(inst.instructionReturn)) {
			return new ImmediateRet(glob, inst.instructionReturn, type ?? inst.type, attrs('builtinConstant') === true);
		}
		const protectedValue = buildRet(glob, inst, type, width, throughPointer, temporary, relevant);
		protectedValue.setAttribute('disallowRename', true);
		protectedValue.setAttribute('isSymbolic', true);
		return protectedValue;
	}
	return buildRet(glob, inst, type, width, throughPointer, temporary, relevant);
}


