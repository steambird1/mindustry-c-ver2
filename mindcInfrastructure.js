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
      |
      +-- (references above are all "ReferenceRet": they have get() and set())

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

import { Instruction, InstructionBuilder, MEMORY_RESERVE_SIZE } from "./mindcGeneratorBase.js";
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
export const contentTypeOf = typeName => (typeName ? typeName.slice(0, typeName.length - 2) : 'item');

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
export function readThrough(glob, pointer, target, width = 1, isNear = false) {
	if (width <= 1) {
		return glob.memory.outputPointerFetchOf(pointer, target);
	}
	return new Instruction([
		glob.memory.outputPointerFetchOf(pointer, `${target}_block`),
		pointerStep(glob, pointer, 1, isNear),
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
		pointerStep(glob, pointer, 1, isNear),
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
			conversion = InstructionBuilder.sensor(target, value.name, '@id');
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
		throw new InfrastructureNotImplementedExpection(
			`${this.instructionReturn} has no address (use 'volatile', 'static' or '&')`);
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
		return new RefPointerRet(this.glob, this.instructions, this.name,
			this.type ? this.type.pointerTo : null, false);
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
		return valueClassOf(glob, this.type).create(glob, instructions, this.name, this.type, this.temporary);
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
		return new RefPointerRet(this.glob, this.instructions, this.name, this.type, false);
	}
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
	if (type.kind === 'struct' || type.kind === 'union') return StructRefRet;
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
		return new StructRefRet(glob, [], assembly, type, false, symbol);
	}

	// Pointer-like values (pointer / array): the value *is* a pointer
	if (symbol.implementAsPointer) {
		if (symbol.accessThroughPointer) {
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

// `create` is a uniform constructor entry point so that factories above do not need
// to know how many arguments each subclass takes.
for (const cls of [VariableRet, BasicRet, IntRet, BoolRet, FloatRet,
	ContentRet, DeviceRet, NullRet, PointerRet, RefPointerRet, MemPointerRet,
	VolatilePointerRet, MemoryRefRet, StructRefRet]) {
	cls.create = function (glob, instructions, returner, type, temporary = false, symbol = null) {
		if (cls === MemoryRefRet) return new cls(glob, instructions, returner, type, temporary, null, symbol);
		if (cls === StructRefRet) return new cls(glob, instructions, returner, type, temporary, symbol);
		return new cls(glob, instructions, returner, type, temporary);
	};
}
