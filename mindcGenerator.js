import { ASTNodeType, AttributeClass, ASTNode, CompilationPhase,
	ProgramNode, FunctionDeclarationNode, FunctionCallNode, BuiltinCallNode,
	VariableDeclarationNode, VariableDeclaratorNode, InitializerListNode,
	BinaryExpressionNode, UnaryExpressionNode, AssignmentExpressionNode, 
	CastExpression, LogicalExpressionNode, ConditionalExpressionNode, 
	IfStatementNode, WhileStatementNode, ForStatementNode, ReturnStatementNode,
	CompoundStatementNode, IdentifierNode, NumericLiteralNode, StringLiteralNode,
	CharacterLiteralNode, NullLiteralNode, TypeSpecifierNode, TypedefDeclarationNode,
	StructDefinitionNode, UnionDefinitionNode, StructMemberNode,
	TypeQualifierNode, AsmStatementNode, PointerTypeNode, DeclaratorNode,
	DeletedStatement, ASTBuilder, ASTVisitor, __convert
 } from "./mindcBase.js";

import { SymbolEntry, Scope, TypeInfo, MemberInfo, SemanticAnalyzer } from "./mindcSemantic.js";

import { ArrayStateReferrer, Optimizer } from "./mindcOptimizer.js";

import { Instruction, InstructionBuilder, InstructionReferrer, MemoryBlock, MemoryBlockInfo,
    MemoryManager, FunctionRegisterer, BuildingLinker, SingleInstruction, EmptyInstruction
 } from "./mindcGeneratorBase.js";
import { findRecursiveFunctions } from "./mindcBase.js";

import { Globals, VariableRet, ImmediateRet, BasicRet, IntRet, BoolRet, FloatRet, ContentRet,
	PointerRet, RefPointerRet, MemPointerRet, VolatilePointerRet, MemoryRefRet, StructRefRet,
	symbolRef, ExportRet, valueClassOf, readThrough, writeThrough, pointerStep,
	RegistryStructRet, NamePointerRet,
	arrayRetOf, selectArrayImplementation, accessCostOf,
	pointerToValue, valueToPointer, contentTypeOf, SPECIAL_CONTENT_TYPES,
	arithmetic, widthOfType, knownContentIdOf, memberTypeOf, InvalidCastException, InfrastructureNotImplementedExpection
 } from "./mindcInfrastructure.js";

export class InternalGenerationFailure {
	constructor(message, node = null) {
		this.message = message;
		this.node = node;
	}

	toString() {
		return this.message;
	}
}

// TODO: Internal instruction optimizer to solve the 'invaded assigment'
// or through visit-params

// 代码生成器
export class CodeGenerator extends ASTVisitor {
	/**
	 * 
	 * @param {Compiler} compiler 
	 */
    constructor(compiler) {
        super(compiler);
		/**
		 * @type {SemanticAnalyzer}
		 */
		this.semantic = compiler.semanticAnalyzer;
		this.functionCallGraph = compiler.optimizer.functionCallGraph;
		this.arrayState = compiler.optimizer.arrayState;
		this.registryId = 0;
		this.registrySymbolId = 0;
		this.registryPointerSymbolId = 0;
		this.temporarySpaceId = 0;
        this.outputCode = new Instruction();
		this.memory = new MemoryManager(compiler.memoryInfo);
		const optimizeOption = compiler?.extraConfig?.getAttribute('optimizeOption') ?? {};
		this.functionManagement = new FunctionRegisterer(this.memory,
			optimizeOption.stackCheck, optimizeOption.stackUnderflow);
		/**
		 * The object-oriented value layer (see mindcInfrastructure.js).
		 * @type {Globals}
		 */
		this.glob = new Globals(this.memory,
			/**
			 * Temporary symbols (NOT registers!): they are the only storage that
			 * survives nested evaluation and recursive calls.
			 * @param {TypeInfo?} type
			 * @param {string?} kind
			 * @returns {string}
			 */
			(type, kind) => this.getTempSymbol(type, kind).getAssemblySymbol(),
			this.semantic, this.functionManagement, this);
		this.currentFunction = "";
		this.currentReturns = [];
		this.currentBreaks = [];
		this.currentContinues = [];
		this.breakStack = [];
		this.continueStack = [];
		/**
		 * @type {Scope}
		 */
		this.currentScope = null;
		this.errors = [];
		this.warnings = [];
		
		this.targetVersion = this.compiler ? this.compiler.config.getAttribute('targetVersion') : 0;
		this.guaranteeTemporarySymbolReg = true;
	}
    
	/**
	 * 
	 * @param {ASTNode} ast Root program node of the program
	 */
    generate(ast) {
        // 将AST转换为目标代码
        let result = new Instruction(), success = true;
		try {
			let noMemory = this.compiler.config.getAttribute('noMemory');
			if (this.memory.memoryBlocks.length == 0) {
				noMemory = true;
			}
			this.recursiveInfo = findRecursiveFunctions(this.functionCallGraph);
			this.currentScope = this.semantic.globalScope;
			this.markArrayStatus(this.currentScope, this.arrayState);
			/**
			 * @type {SymbolEntry[]}
			 */
			/*
			The layout of an array is decided once and cached, and `encoded`
			needs the contents to build its table -- so they have to be known
			BEFORE anything asks for `arrayStyleFor`. Optimizer-tracked arrays
			already carry theirs.
			*/
			this.collectGlobalArrayValues(ast);
			let globalRegs = [];
			if (ast.scope) {
				globalRegs = this.processHeapMemory(ast.scope);
				// Configure these global ones by writing into results
			}
			else this.addWarning('Program has no global scope');
			/*
			this.semantic.typeTable.forEach(elem => {
				elem.initializeReferenceTable();
			});
			*/
			this.RValueAssigner = this.memory.currentState().duplicate();
			this.RValueMax = 0;
			const buildings = new BuildingLinker(this.memory.memoryBlocks.map(block => block.name), 
				this.functionManagement, this.compiler);
			if (!noMemory) {
				result.concat(buildings.outputLinkInitializer());
				result.concat(this.memory.outputLinkInitializer());	
			}
			if (!noMemory && !this.compiler.config.getAttribute('noPointerFunction')) {
				// Only the stack frame walker gets the capacity check; ordinary pointer
			// stepping keeps the old behaviour.
			result.concat(this.memory.outputPointerForwardFunction(
				this.functionManagement, '__pointerForward', '__ptr', true, false));
				result.concat(this.memory.outputPointerBackwardFunction(this.functionManagement));
				result.concat(this.memory.outputMemcpyFunction(this.functionManagement));
			}
			const programBody = this.visit(ast);
			const mainSymbol = programBody.getAttribute('mainSymbol');
			result.concat(programBody);
			if (!noMemory) {
				this.memory.forwarding(this.RValueMax);
				result.concat(this.functionManagement.getSystemInitializer(this.memory));
			}
			
			globalRegs.forEach(symbol => {
				symbol.memberHandler.stackSymbols.forEach(tmps => {
					const tmpAssembly = tmps.getAssemblySymbol();
					const ref = symbol.memberHandler.regStructMem.get(tmpAssembly);
					result.concat(tmps.memoryLocation.getAssignmentInstruction(ref));
				});
			});

			if (mainSymbol) {
				result.concat(this.functionManagement.getFunctionCall('main', new Map(), this.memory, true));
			} else {
				this.addWarning('No main function in program');
			}
		} catch (error) {
			success = false;
			this.addError(`Internal parser error: ${error.message}\n${error.stack}`);
		}
		return {
			success: success,
			result: result,
			errors: this.errors,
			warnings: this.warnings,
			memory: this.memory
		}
    }

	/**
	 * 
	 * @param {Scope} scope 
	 * @param {ArrayStateReferrer} arr 
	 */
	markArrayStatus(scope, arr) {
		scope.recursivelyGetAllSymbols().forEach(symb => {
			const symbAssembly = symb.getAssemblySymbol();
			symb.arrayStyle = arr.query(symbAssembly);
		});
	}

	/**
	 * Decide where every symbol of a scope lives and give it memory when it
	 * needs some.
	 *
	 * Three independent questions are answered for every symbol:
	 *
	 *  1. *Does the object live in memory?* (`accessThroughPointer`)
	 *     - `volatile` : the variable MUST be in memory, whatever its type.
	 *       Note that `volatile int *p` is not volatile itself -- only the
	 *       thing it points at is. `int *volatile p` is.
	 *     - `&x` is taken somewhere (`isAddressed`);
	 *     - the function is recursive and the variable is not `static`: a
	 *       register does not survive the nested call;
	 *     - `mustAlloc` was asked for by the caller.
	 *
	 *  2. *Is the value itself a pointer?* (`implementAsPointer`, two words)
	 *     pointer / array / a struct that is implemented through memory.
	 *     Independent from (1): `int *volatile p` is both.
	 *
	 *  3. *How much memory, and where?* -- see `allocateSymbolMemory`.
	 *
	 * @param {Scope} scope
	 * @param {boolean} [staticAllocOnly=false]
	 * @param {boolean} [mustAlloc=false]
	 * @param {string} [insideFunctionName=""]
	 * @returns {SymbolEntry[]}
	 */
	processHeapMemory(scope, staticAllocOnly = false, mustAlloc = false, insideFunctionName = "") {
		const functionName = (scope.astNode && scope.astNode.type === 'FunctionDeclaration')
			? scope.astNode.name : insideFunctionName;
		// Anything inside a recursive function has to be reachable after the
		// nested call returns, which a register is not.
		if (functionName && this.recursiveInfo.has(functionName)) {
			mustAlloc = true;
		}
		/**
		 * @type {SymbolEntry[]}
		 */
		let regStructHandling = [];

		const context = { staticAllocOnly, mustAlloc, functionName };

		const handler = symbol => {
			this.decideSymbolStorage(symbol, context);
			this.allocateSymbolMemory(symbol, context);
			if (symbol.isStructOrUnion() && symbol.isRegistryStruct?.()) {
				regStructHandling.push(symbol);
			}
		};

		scope.getAllSymbols().forEach(symb => void(handler(symb)));
		scope.children.forEach(child => {
			this.processHeapMemory(child, true, mustAlloc, functionName);
		});

		return regStructHandling;
	}

	/**
	 * Whether pointers that store the NAME of their target are in use. They need
	 * `read`/`write @this <name>`, which only exists from v150 on, and they are
	 * off unless `#pragma optimize(pointer)` asks for them.
	 * @returns {boolean}
	 */
	namePointerAllowed() {
		const config = this.compiler?.extraConfig?.getAttribute('optimizeOption') ?? {};
		if (config.doPointerOptimize !== true) return false;
		return (this.semantic.targetVersion ?? this.compiler?.config?.getAttribute('targetVersion') ?? 0) >= 150;
	}

	/**
	 * Whether the symbol's function is recursive. Everything local to one has to
	 * live in memory.
	 * @param {SymbolEntry} symbol
	 * @returns {boolean}
	 */
	isInRecursiveFunction(symbol) {
		if (symbol.isStatic) return false;
		const region = symbol.getFunctionRegion?.() ?? null;
		return !!region && this.recursiveInfo.has(region);
	}

	/**
	 * Work out the storage class of one symbol: whether it lives in memory, and
	 * whether its value is a pointer.
	 *
	 * @param {SymbolEntry} symbol
	 * @param {{staticAllocOnly: boolean, mustAlloc: boolean, functionName: string}} ctx
	 * @returns {void}
	 */
	decideSymbolStorage(symbol, ctx) {
		const type = symbol.myType();
		const kind = (type && type.kind) ? type.kind : 'basic';
		const isStructLike = ['struct', 'union'].includes(kind);
		const isPointerLike = ['pointer', 'array'].includes(kind);

		/* ---------- 1. Does it have to live in memory? ---------- */
		const recursive = this.isInRecursiveFunction(symbol);
		/*
		`&x` normally forces x into memory -- but when the address is only ever
		taken by NAME pointers it is the *name* that is needed, and x can stay
		where it is. (Not in a recursive function: the register is gone by the
		time the nested call returns.)
		*/
		const addressedByName = symbol.namePointersOnly === true && this.namePointerAllowed();
		/*
		A struct whose very DEFINITION demands memory -- it embeds an array, or
		another such struct -- can never be a group of registers, so it is forced
		into memory regardless of how it is used. (`&s` sets the same flag on a
		copy of the type, see `SemanticAnalyzer.memoryVariantOf`.)
		*/
		const structDemandsMemory = isStructLike
			&& !!(type && typeof type.isStrictPointerImpl === 'function' && type.isStrictPointerImpl());
		const forced = ctx.mustAlloc || recursive || symbol.isVolatile || structDemandsMemory
			|| (symbol.isAddressed && !addressedByName);

		/*
		`volatile` means "keep this variable in memory". It applies to the
		variable itself, so `int *volatile p` is a pointer that is kept in
		memory -- while `volatile int *p` is an ordinary register pointer whose
		target happens to be volatile. `TypeInfo.isVolatile()` already makes
		that distinction.
		*/
		const selfVolatile = symbol.isVolatile === true || (type && type.isVolatile && type.isVolatile());

		/*
		A variable that is only ever reached through a name pointer can stay in a
		register: the name alone is enough to find it. Not inside a recursive
		function though -- the register would be gone when the call returns.
		*/
		const staysInRegister = !forced && addressedByName;

		if (staysInRegister) {
			symbol.accessThroughPointer = false;
			symbol.needMemoryAllocation = false;
		} else if ((forced || selfVolatile) && symbol.kind !== 'function') {
			if (isStructLike) {
				// A struct in memory is reached through a pointer (recursive processor)
				symbol.implementAsPointer = true;
			}
			if (isPointerLike && !isStructLike) {
				// The value is still a pointer; it just happens to be stored in memory
				symbol.implementAsPointer = true;
				if (kind === 'pointer') symbol.accessThroughPointer = true;
			}
			symbol.needMemoryAllocation = true;
			if (!isPointerLike && !isStructLike && selfVolatile) {
				// A plain value kept in memory (a `volatile int`, say)
				symbol.accessThroughPointer = true;
			}
		}

		/* ---------- 2. Per-kind bookkeeping ---------- */
		if (symbol.kind !== 'function') {
			if (symbol.kind === 'parameter' && !recursive
				&& !ctx.mustAlloc && !symbol.isVolatile) {
				// A parameter of a non-recursive function is a register
				symbol.size = type ? type.size : 1;
				if (isPointerLike) symbol.implementAsPointer = true;
				return;
			}
			symbol.size = type ? type.size : 1;
			switch (kind) {
				case 'struct':
				case 'union': {
					/*
					A registry struct keeps every member in a register, but a member
					that needs memory of its own (an array, for instance) has to be
					given some -- and since a recursive call may need any number of
					them, the whole struct is memory implemented instead (see
					`TypeInfo.isStrictPointerImpl`). Here we only handle what is
					left: a registry struct with no such member needs nothing.
					*/
					const { stackSymbols, regStructMem } = this.handleStructExtra([symbol], symbol.scope, false);
					stackSymbols.forEach(symb => {
						this.decideSymbolStorage(symb, ctx);
						this.allocateSymbolMemory(symb, ctx);
					});
					const immediate = !ctx.staticAllocOnly || symbol.isStatic || symbol.isVirtualSymbol;
					if (immediate) symbol.memberHandler = { stackSymbols, regStructMem };
					break;
				}
				case 'device':
				case 'null':
				case 'null_t':
					if (symbol.isAutoDevice) {
						symbol.implementAsPointer = false;
					} else if (symbol.accessThroughPointer || symbol.implementAsPointer || symbol.needMemoryAllocation) {
						const diagnosis = `symbol ${symbol.name} with device-like type ('device' or 'content_t') is stored in memory. This will result in data loss.`;
						if (this.compiler.config.getAttribute('noDevicePointerError')) {
							this.addWarning(diagnosis);
						} else {
							this.addError(diagnosis);
						}
					}
					break;
				case 'basic':
					break;
				case 'pointer':
					symbol.size = 2;
					symbol.implementAsPointer = true;	// There's no need to give them memory space
					break;
				case 'array':
					symbol.size = type ? type.size : symbol.size;
					symbol.implementAsPointer = true;
					symbol.needMemoryAllocation = true;
					break;
				case 'function':
					break;
				default:
					// struct/union, etc.
					symbol.implementAsPointer = true;
					symbol.needMemoryAllocation = true;
					//symbol.accessThroughPointer = false;	// They aren't actually pointers
					// BE ADVISED: This implementation means that struct and union ARE CONSIDERED
					// 'access through pointer' but not a real pointer.
					break;
			}
		}
	}

	/**
	 * Give a symbol the heap space it asked for in `decideSymbolStorage`.
	 *
	 * An array is special: if there is no room left it can be held in registers
	 * instead (see `arrayStyleFor`), unless it must be in memory anyway
	 * (recursion, `volatile`).
	 *
	 * @param {SymbolEntry} symbol
	 * @param {{staticAllocOnly: boolean, mustAlloc: boolean, functionName: string}} ctx
	 * @returns {void}
	 */
	allocateSymbolMemory(symbol, ctx) {
		if (!(symbol.accessThroughPointer || symbol.needMemoryAllocation)) return;
		if (symbol.kind === 'function') return;

		const immediate = !ctx.staticAllocOnly || symbol.isStatic || symbol.isVirtualSymbol;
		if (!immediate) {
			// The allocation is deferred to the top of the function call
			symbol.needMemoryAllocation = true;
			return;
		}

		const allocator = (size, requireNear, name) => {
			let allocated = false;
			let location = null;
			if (requireNear) {
				let attempt = this.memory.currentState().duplicate(), skippedPage = 0;
				while (!attempt.full && attempt.currentRemain() < size) {
					attempt.skipToNextPage();
					skippedPage++;
				}
				if (attempt.full) {
					this.addWarning(`Cannot assign a complete block for ${name}`);
					requireNear = false;
				} else {
					location = attempt.duplicate();
					this.memory.pushStack();
					this.memory.setState(attempt.forwarding(size));
					if (skippedPage > 0) {
						this.addWarning(`Skipping ${skippedPage} page(s) for near pointer assignment. This may cause memory insufficiency`);
					}
					allocated = true;
				}
			}
			if (!allocated) {
				try {
					location = this.memory.assign(name, size);
					allocated = true;
				} catch (e) {
					// Out of memory: the caller decides whether that is fatal
					allocated = false;
					location = null;
				}
			}
			if (!allocated || !location) {
				return { position: null, near: false, success: false };
			}
			const dupSymb = location.duplicate();
			if (dupSymb.forwarding(size).block === location.block) {
				requireNear = true;
			}
			return { position: location, near: requireNear, success: allocated };
		};

		symbol.needMemoryAllocation = true;
		const result = allocator(symbol.size, symbol.isNearPointer, symbol.getAssemblySymbol());
		if (!result.success || !result.position) {
			const canUseRegisters = this.canDegradeToRegisters(symbol);
			symbol.memoryAllocationFailed = true;
			if (!canUseRegisters) {
				this.addError(`Cannot assign memory for symbol ${symbol.describe()}`);
				return;
			}
			this.addWarning(`Not enough memory for ${symbol.describe()}; it will be held in registers instead`);
			symbol.needMemoryAllocation = false;
			symbol.implementAsPointer = false;
			symbol.accessThroughPointer = false;
			symbol.memoryLocation = null;
			// Pick the register layout now, while "no memory" is still true
			this.arrayStyleFor(symbol);
			return;
		}
		if (!['pointer'].includes(symbol.myType()?.kind)) {
			symbol.isNearPointer = result.near;
		}
		symbol.memoryLocation = result.position;
		if (symbol.requireExtraMemory()) {
			// Additional space: `X.__pointer` holds the address of the data
			const additional = allocator(2, true, `${symbol.getAssemblySymbol()}.__pointer`);
			if (!additional.success) {
				this.addError(`Cannot assign essential additional memory for symbol ${symbol.describe()}`);
				symbol.memoryAllocationFailed = true;
				return;
			}
			symbol.isExtraNear = additional.near;
			symbol.extraMemoryLocation = additional.position;
		}
	}

	/**
	 * Whether an array may be kept in registers when there is no memory left.
	 *
	 * Not for a `volatile` array (it has to be in memory by definition), and not
	 * inside a recursive function (a register would be overwritten by the nested
	 * call, and the layout needs a slot per activation anyway).
	 *
	 * @param {SymbolEntry} symbol
	 * @returns {boolean}
	 */
	canDegradeToRegisters(symbol) {
		return this.forcedTraditionalReason(symbol) === null;
	}

	requireRValueMemory(size) {
		this.RValueMax = Math.max(this.RValueMax, size);
		return this.RValueAssigner.duplicate();
	}


	enterLoop() {
		this.breakStack.push(this.currentBreaks);
		this.continueStack.push(this.currentContinues);
		this.currentBreaks = [];
		this.currentContinues = [];
	}

	exitLoop() {
		this.currentBreaks = this.breakStack.pop();
		this.currentContinues = this.continueStack.pop();
	}

	/**
	 * 
	 * @param {SymbolEntry} symbol 
	 * @param {boolean} [duplicate=false]
	 * @return {Instruction} Instructions to execute BEFORE reading.
	 * @remarks Reading symbol through its original name.
	 * @remarks BE SURE NOT TO USE THIS TO READ STRUCT/UNION (or you will get the first member)
	 */
	generateSymbolRead(symbol, duplicate = false, givenName = null) {
		const raw = () => {
			if (givenName) {
				return new Instruction([
					InstructionBuilder.set(givenName, symbol.getAssemblySymbol())
				], givenName);
			} else {
				return new Instruction([], null, new Map([['disallowReplacement', true]])).set_returns(symbol);
			}	
		};

		let result = new Instruction();
		if (symbol.implementAsPointer) {
			const temporary = givenName ?? this.getTempVariable();
			if (symbol.accessThroughPointer) {
				if (symbol.memoryRef()) {	// The original memory location is for the array itself.
					result = this.memory.outputFetchOf(symbol.memoryRef(), `${temporary}_block`);
					result.concat(this.memory.outputFetchOf(symbol.memoryRef().duplicate().forwarding(1), `${temporary}_pos`));
					// result = this.memory.outputFetchOf(symbol.memoryLocation, `${temporary}_block`);
					// result.concat(this.memory.outputFetchOf(symbol.memoryLocation.duplicate().forwarding(1), `${temporary}_pos`));
				} else {
					/*
					Read the two words of the pointer out of its slot. Stepping to
					the second word moves the slot address itself, so keep it first
					and put it back afterwards -- otherwise every read of the
					pointer shifts the slot one cell further and it soon lands on
					somebody else's storage.
					*/
					const slot = `${symbol.getAssemblySymbol()}.__pointer`;
					const keepB = `${temporary}_keepb`, keepP = `${temporary}_keepp`;
					result = new Instruction([
						InstructionBuilder.set(keepB, `${slot}_block`),
						InstructionBuilder.set(keepP, `${slot}_pos`),
						InstructionBuilder.reads(`${temporary}_block`, `${slot}_block`, `${slot}_pos`),
						this.memory.outputSymbolForwardCall(1, symbol, this.functionManagement,
							false, false),
						InstructionBuilder.reads(`${temporary}_pos`, '__ptrblock', '__ptrpos'),
						InstructionBuilder.set(`${slot}_block`, keepB),
						InstructionBuilder.set(`${slot}_pos`, keepP)
					]);
				}
				result.instructionReturn = temporary;
			} else {
				// Perhaps you don't really need to duplicate...
				if (!duplicate || (!symbol.isVolatile && symbol.isConst)) {
					return raw();
				}
				result = new Instruction([
					InstructionBuilder.set(`${temporary}_block`, `${symbol.getAssemblySymbol()}_block`),
					InstructionBuilder.set(`${temporary}_pos`, `${symbol.getAssemblySymbol()}_pos`)
				], temporary);
			}
			result.setAttribute('isPointer', true);
		} else if (symbol.accessThroughPointer) {
			let temporary = givenName ?? this.getTempVariable();
			if (symbol.memoryLocation) {
				result = this.memory.outputFetchOf(symbol.memoryLocation, temporary);
			} else {
				// Heap variables
				result = InstructionBuilder.reads(temporary, 
					`${symbol.getAssemblySymbol()}.__pointer_block`, `${symbol.getAssemblySymbol()}.__pointer_pos`
				);
			}
			result.instructionReturn = temporary;
			result.setAttribute('isPointer', false);	// No longer a pointer in fact, nor is it accessed through pointer!
		} else if (!duplicate || (!symbol.isVolatile && symbol.isConst)) {
			// Never considering whether it's indirect
			return raw();
		} else {
			let temporary = givenName ?? this.getTempVariable();
			result = InstructionBuilder.set(temporary, symbol.getAssemblySymbol());
			result.instructionReturn = temporary;
			result.setAttribute('isPointer', false);
		}
		return result;
	}

	/**
	 * Wrap a raw operand into a `VariableRet`.
	 *
	 * Accepted forms: an already built `VariableRet`, or an assembly name /
	 * numeric literal (which becomes an immediate value).
	 *
	 * @param {VariableRet | string | number} source
	 * @param {TypeInfo?} type The type of the *target*, which decides whether the
	 *                         name refers to a single register or to a `_block` /
	 *                         `_pos` pair.
	 * @returns {VariableRet}
	 */
	asRet(source, type = null) {
		const glob = this.glob;
		if (source instanceof VariableRet) return source;
		const literal = new ImmediateRet(glob, String(source), type);
		if (widthOfType(type) >= 2) {
			// The name refers to a pair of `X_block` / `X_pos` registers
			return new RefPointerRet(glob, [], literal.name, type, false);
		}
		return literal;
	}

	/**
	 * Write a value into a symbol.
	 *
	 * This is the object oriented replacement of the old `generateSymbolWrite`:
	 * *how* the value reaches the symbol (a plain `set`, a `write` through a
	 * pointer, or a two-word `_block` / `_pos` pair) is decided by the value class
	 * of the symbol -- see `mindcInfrastructure.js` -- instead of by a chain of
	 * `if (symbol.implementAsPointer) ... else if (symbol.accessThroughPointer) ...`.
	 *
	 * @param {SymbolEntry} symbol
	 * @param {VariableRet | string | number} source
	 * @returns {VariableRet}
	 * @warning This has **no** operation on structures. Be careful!
	 */
	writeSymbol(symbol, source) {
		const target = symbolRef(this.glob, symbol);
		if (target instanceof NamePointerRet && !(source instanceof VariableRet)) {
			/*
			The value of a name pointer is the NAME of something, i.e. a single
			word -- even though `int **` looks like a two word type. Passing the
			bare register name through keeps it that way.
			*/
			return target.set(new ImmediateRet(this.glob, String(source), symbol.myType()));
		}
		return target.set(this.asRet(source, symbol.myType()));
	}

	/**
	 * This stresses on writing.
	 * Write instruction data (with return labelled as {op}) to the symbol.
	 * @param {Instruction} instruction (The instruction will be modified!)
	 * @param {SymbolEntry} symbol 
	 * @returns Instruction
	 * @deprecated Please specify writing (i.e. operatesWrite).
	 */
	operates(instruction, symbol) {
		let result;
		if ((!symbol.accessThroughPointer) && (!symbol.implementAsPointer)) {
			result = instruction.raw_replace_all('op', symbol.getAssemblySymbol());
		} else {
			const tmpVar = this.getTempVariable();
			result = instruction.raw_replace_all('op', tmpVar);
			result.concat(this.writeSymbol(symbol, tmpVar));
		}
		result.set_returns(symbol);
		return result;
	}

	/**
	 * This stresses on reading.
	 * @param {Instruction} instruction The instruction you want to opeate (with number labelled as {opw}).
	 * @param {Instruction} returner The instruction returned.
	 * @returns {Instruction}
	 * @remarks The 'returner' must have a previous concat.
	 * @deprecated Please specify reading (i.e. operatesRead).
	 */
	operatesWith(instruction, returner) {
		
		if (!returner.getAttribute('isPointerAccess')) {
			return instruction.raw_replace_all('opw', returner.instructionReturn);
		} else {
			const tmpVar = this.getTempVariable();
			return new Instruction([
				InstructionBuilder.reads(tmpVar, `${returner.instructionReturn}.__pointer_block`, `${returner.instructionReturn}.__pointer_pos`),
			]).concat_returns(instruction.raw_replace_all('opw', tmpVar));
		}
	}

	/**
	 * 
	 * @param {Instruction} instruction (The instruction will be modified!)
	 * @param {SymbolEntry} symbol 
	 * @returns {Instruction}
	 */
	operatesWrite(instruction, symbol) {
		return this.operates(instruction.raw_replace_all('op_write', '{op}'), symbol);
	}

	/**
	 * 
	 * @param {Instruction} instruction (The instruction will be modified!)
	 * @param {Instruction} returner 
	 * @returns {Instruction}
	 */
	operatesRead(instruction, returner) {
		return this.operatesWith(instruction.raw_replace_all('op_read', '{opw}'), returner);
	}
	/**
	 * Do **NOT** use this with `visitAndRead()` or it will return unexpected results.
	 * This function perform re-reading of return results to ensure correctness for operations
	 * using multiple values. If your operation uses only single value, then this is not necessary
	 * (just use `visitAndRead` then, although usage of this function will not significantly affect
	 * efficiency).
	 * @param {Instruction[]} instructions
	 * @param {Instruction} operation
	 * @returns {Instruction} 
	 * @example operateReads(node.arguments.map(arg => this.visit(arg)), new Instruction())
	 */
	operatesReads(instructions, operation) {
		let result = new Instruction([...instructions]);
		for (let i = 0; i < instructions.length; i++) {
			const inst = instructions[i];
			if (inst.getAttribute('isPointerAccess')) {
				const tmpVar = this.getTempVariable();
				result.concat(
					InstructionBuilder.reads(tmpVar, `${inst.instructionReturn}.__pointer_block`, `${inst.instructionReturn}.__pointer_pos`)
				);
				operation.raw_replace_all(`op_r${i}`, tmpVar);
			} else {
				operation.raw_replace_all(`op_r${i}`, inst.instructionReturn);
			}
		}
		result.concat_returns(operation);
		return result;
	}

	/**
	 * 
	 * @param {Instruction} inst 
	 * @param {boolean} [isPointerType=false] Whether the instruction returns a pointer type.
	 * @returns {Instruction}
	 * @deprecated It now does nothing and directly returns `inst`.
	 */
	convertInstructionForReading(inst, isPointerType = false) {
		/*
		if (inst.getAttribute('isPointerAccess')) {
			// Afterwards, it won't be PointerAccess.
			const temp = this.getTempVariable();
			return new Instruction([inst])
					.concat_returns(
						isPointerType ? (
							new Instruction([
								// Scheisse, I need to refer to not only the current but only the next.
								InstructionBuilder.reads(`${temp}_block`, `${inst.instructionReturn}.__pointer_block`, `${inst.instructionReturn}.__pointer_pos`),
								// ...
								this.memory.outputPointerForwardCall(1, `${inst.instructionReturn}.__pointer`, this.functionManagement, false, false),
								InstructionBuilder.reads(`${temp}_pos`, `__ptrblock`, `__ptrpos`)
							], temp, new Map([['isPointer', true]]))
						) : (
							new Instruction([
								InstructionBuilder.reads(temp, `${inst.instructionReturn}.__pointer_block`, `${inst.instructionReturn}.__pointer_pos`)
							], temp)
						)
					);
		} else {
			return inst;
		}
			*/
		return inst;
	}

	/**
	 * 
	 * @param {ASTNode} node
	 * @returns {Instruction} 
	 * @warning Please consider operate_read when you need to use both vaild values at the same time.
	 * @remarks Ensure that the expected value is NOT a pointer before calling this.
	 * @remarks This should be used for most of the scenes (hardly is it necessary to write as well)
	 */
	visitAndRead(node, param = null) {
		return this.convertInstructionForReading(this.visit(node, param), node.dataType && node.dataType.isPointerImpl());
		// Note: then it reads a ORIGINAL VALUE
		// And besides: This won't dereference a pointer if it should appear to be one to the user (i.e. implementAsPointer)
		// but will dereference those accessed through pointer!
	}

	/**
	 * 
	 * @param {ASTNode} node 
	 * @returns {Instruction}
	 * @remarks Controls the external behavior of the program.
	 */
	visitForContent(node) {
		return this.implicitToContent(node, null, true);
	}

	/**
	 * 
	 * @param {SymbolEntry[]} symbols 
	 * @param {Scope} scope
	 * @param {boolean} [setVirtual=true] 
	 */
	handleStructExtra(symbols, scope, setVirtual = true) {
		/**
		 * @type {SymbolEntry[]}
		 */
		let stackSymbols = [];
		/**
		 * @type {Map<string, string>}
		 */
		let regStructMem = new Map();
		let tempSymbolId = 0;

		const recWork =
			/**
			 * 
			 * @param {TypeInfo} symType 
			 * @param {string} startName 
			 */ 
			(symType, startName) => {
				if (symType && symType.isTypeInfo && symType.isRegStruct()) {
					symType.members.forEach(
						/**
						 * 
						 * @param {MemberInfo} member 
						 */
						member => {
							if (member.type.isRequireMem()) {
								const tmpSymbol = new SymbolEntry(`__rsstack_${tempSymbolId++}`, member.type, scope, 'variable', null, member.type.size);
								tmpSymbol.isVirtualSymbol = setVirtual;

								regStructMem.set(tmpSymbol.getAssemblySymbol(), `${startName}.${member.name}`);
								stackSymbols.push(tmpSymbol);
							} else if (member.type.isRegStruct()) {
								recWork(member.type, `${startName}.${member.name}`);
							}
						}
					)
				}
		};

		symbols.forEach(/**
				 * 
				 * @param {SymbolEntry} symbol 
				 */
				symbol => {
				// Symbol values
					const symType = symbol.myType();
					if (symType.isTypeInfo) recWork(symType, symbol.getAssemblySymbol());
			});
		const singular = new Instruction([]);
		regStructMem.forEach((value, key) => {
			singular.concat(new Instruction([
				InstructionBuilder.set(`${value}_block`, `${key}_block`),
				InstructionBuilder.set(`${value}_pos`, `${key}_pos`)
			]))
		});
		return { stackSymbols, singular, regStructMem };
	}

	/**
	 * 
	 * @param {ProgramNode} node 
	 * @returns {Instruction}
	 */
	visitProgram(node) {
		let result = new Instruction();
		let mainSymbol = null;
		node.functions.forEach(func => {
			//result.concat();
			// Check the scope that this function owns
			const funcSymbol = this.currentScope.lookup(func.name);
			if (func.name === 'main') {
				mainSymbol = funcSymbol;
			}
			let stackSymbols = [];
			const currentSymbols = funcSymbol.owningScope.recursivelyGetAllSymbols();
			currentSymbols.forEach(
				/**
				 * 
				 * @param {SymbolEntry} symbol 
				 */
				symbol => {
				// Symbol values
					const symType = symbol.myType();
					if ((symbol.accessThroughPointer || symbol.needMemoryAllocation) && !(symbol.isStatic)) {
						stackSymbols.push(symbol);
					}
			});
			const { stackSymbols: extraSymbols, singular, regStructMem } = this.handleStructExtra(currentSymbols);
			stackSymbols = [...stackSymbols, ...extraSymbols];
			this.functionManagement.addFunction(func.name, new Instruction(), funcSymbol.owningScope, stackSymbols, func.name === 'main', this.recursiveInfo.has(func.name));
			/**
			 * @type {Instruction}
			 */
			const funcBody = this.visit(func);	// Note: visit comes first
			const actualBody = new Instruction([]);
			actualBody.concat(singular);
			actualBody.concat(funcBody);
			this.functionManagement.functionCollection.get(func.name).body = actualBody;
		});
		/**
		 * @type {SymbolEntry[]}
		 */
		const allSymbols = this.semantic.globalScope.recursivelyGetAllSymbols();
		let staticProcessor = new Instruction();
		allSymbols.forEach(symbol => {
			if (symbol.isStatic && !symbol.isGlobal) {
				const endTag = `${symbol.getAssemblySymbol()}:_static_tag`;
				staticProcessor.concat(InstructionBuilder.set(endTag, 'false'));
			}
		});
		result.concat(staticProcessor);
		/*
		The same declaration node can be listed twice; `visit` hands back the
		cached instruction, and concatenating that object again would emit the
		whole declaration a second time.
		*/
		const seenDeclarations = new Set();
		node.globalDeclarations.forEach(decl => {
			if (seenDeclarations.has(decl)) return;
			seenDeclarations.add(decl);
			result.concat(this.visit(decl));
		});
		result.concat(this.functionManagement.getAllFunctionDecl(this.memory));
		result.setAttribute('mainSymbol', mainSymbol);
		// Main function is now called in generate() after some preprocessing
		return result;
	}

	/**
	 * 
	 * @param {AsmStatementNode} node 
	 */
	visitAsmStatement(node) {
		if (node.code.length && node.code[0] === ':') {
			const instructionSplit = node.code.split(' ');
			switch (instructionSplit[0]) {
				case ":varStorage":
				case ":varStorageCp":
					if (instructionSplit.length < 3) {
						this.addError(`Invalid asm statement: ${node.code}`, node.location);
					}
					const symbol = this.currentScope.lookup(instructionSplit[2]);
					if (!symbol) {
						this.addError(`Unknown symbol: ${instructionSplit[2]}`, node.location);
					}
					return this.generateSymbolRead(symbol, instructionSplit[0] === ":varStorageCp", instructionSplit[1]);
					break;
				case ":varRead":
					return new Instruction([], instructionSplit.length >= 2 ? instructionSplit[1] : "null",
						new Map([['disallowReplacement', true]])
					);
					break;
				case ":label":
					return new Instruction([new SingleInstruction({
						content: `${instructionSplit[1]}:`,
						referrer: []
					})], null, new Map([['noLineCount', true]]));
				case ":copyObject":
				case ":copyObjectCp":
					const param = node.code.substring(node.code.indexOf(' ') + 1).split(',');
					if (param.length < 2) {
						throw new InternalGenerationFailure(`Incorrect format of :copyObject`);
					}
					const dest = param[0].split(':').map(s => s.trim()), src = param[1].split(':').map(s => s.trim());
					return this.copyObject(dest[0], src[0], 
						this.semantic.getTypeInfo(dest[1]), src.length > 1 ? this.semantic.getTypeInfo(src[1]) : null,
					instructionSplit[0] === ':copyObjectCp');
			}
		}
		let finalCode = node.code;
		if (!this.extraConfig.getAttribute('noEnhancedAsm')) {
			let fetchers = new Instruction();
			finalCode = finalCode.replace(
				/\$\{.*?\}/g,
				(match, offset, string) => {
					const expr = match.substring(match.indexOf('{') + 1, match.lastIndexOf('}'));
					// This will simply put expression inside
					// !!! TODO !!!
					const symbol = this.currentScope.lookup(expr);
					if (!symbol) {
						throw new InternalGenerationFailure(`Symbol does not exist`);
					}
					const result = this.generateSymbolRead(symbol, false);
					fetchers.concat(result);
					return result.instructionReturn;
				}
			);
			return fetchers.concat(new SingleInstruction({
				content: finalCode,
				referrer: []
			}));
		}
		return new SingleInstruction({
				content: finalCode,
				referrer: []
			});
		
	}

	/**
	 * 
	 * @param {string} target 
	 * @param {string} source 
	 * @param {TypeInfo} actualType Type of **target**
	 * @param {TypeInfo | null} [sourceType=null] Type of **source** or as actualType if null
	 * @param {boolean} [shallow=true] 
	 * @returns {Instruction}
	 */
	copyObject(target, source, actualType, sourceType = null, shallow = true) {
		/**
		 * 
		 * @param {string} typeName 
		 * @returns {string}
		 */
		const referrer = typeName => typeName.slice(0, typeName.length - 2);
		const special = ['item_t', 'liquid_t', 'unit_t', 'block_t'];

		let result = new Instruction();
		const finalSourceType = sourceType ? sourceType : actualType;
		if (actualType.kind === 'pointer' || actualType.kind === 'array' || actualType.kind === 'struct'
				|| actualType.kind === 'union'
		) {
			if (actualType.kind === 'struct' || actualType.kind === 'union') {
				return this.copyStruct(target, source, actualType, finalSourceType);
			} else if (actualType.isPointerImpl()) {
				if (shallow || actualType.kind === 'pointer') {
					result.concat(new Instruction([
						InstructionBuilder.set(`${target}_block`, `${source}_block`),
						InstructionBuilder.set(`${target}_pos`, `${source}_pos`)
					]));
				} else {
					result.concat(this.memory.outputMemcpyCall(target, source, actualType.size, this.functionManagement));
				}
			} else {
				throw new InternalGenerationFailure(`Cannot generate copy from ${source} to ${target}`);
			}
		} else if (this.semantic.isTypeCompatibleForAny(actualType, ['int', 'long', 'signed', 'unsigned', 'bool'], true) && this.semantic.isTypeCompatibleForAny(finalSourceType, ['float', 'double'], true)) {
			const implicitConv = this.implicitFloorRaw(new Instruction([], source, new Map([['disallowReplacement', true]])));
			result.concat(implicitConv);
			result.concat(InstructionBuilder.set(target, implicitConv.instructionReturn));
		} else if (finalSourceType.name === 'content_t' && special.includes(actualType.name)) {
			const implicitConv = this.implicitContentToNumericRaw(new Instruction([], source, new Map([['disallowReplacement', true]])));
			result.concat(implicitConv);
			result.concat(InstructionBuilder.set(target, implicitConv.instructionReturn));
		} else if (special.includes(finalSourceType.name) && !this.semantic.isSameType(finalSourceType, actualType)) {
			const implicitConv = this.implicitToContentRaw(
				new Instruction([], source, new Map([['disallowReplacement', true]])), referrer(finalSourceType.name));
			result.concat(implicitConv);
			result.concat(InstructionBuilder.set(target, implicitConv.instructionReturn));
		} else {
			result.concat(InstructionBuilder.set(target, source));
		}
		return result;
	}

	/**
	 * 
	 * @param {string} target 
	 * @param {string} source 
	 * @param {TypeInfo} type 
	 * @param {TypeInfo | null} [sourceType=null] 
	 * @returns {Instruction}
	 */
	copyStruct(target, source, type, sourceType = null) {
		const finalSourceType = sourceType ? sourceType : type;
		if (type.isPointerImpl()) {
			if (finalSourceType.isPointerImpl()) {
				return this.memory.outputMemcpyCall(target, source, type.size, this.functionManagement);
			} else {
				let latest = 0;
				return new Instruction(
					[
						InstructionBuilder.set('__ptrblock', `${target}_block`),
						InstructionBuilder.set('__ptrpos', `${target}_pos`),
						...(type.members.map(
							/**
							 * 
							 * @param {MemberInfo} member
							 */
							member => {
								const result = new Instruction(
									type.isNear() ? [
										InstructionBuilder.op('add', '__ptrpos', '__ptrpos', member.offset - latest)
									] : [
										InstructionBuilder.set('__step', member.offset - latest),
										this.functionManagement.getFunctionCall('__pointerForward', new Map(), this.memory, false)
									]
								).concat(InstructionBuilder.writes(`${source}.${member.name}`, '__ptrblock', '__ptrpos'));
								latest = member.offset;
								return result;
							}
						))
					]
				);
			}
		} else if (finalSourceType.isPointerImpl()) {
			// !type.isPointerImpl(), so must read everything for the target
			let latest = 0;
			return new Instruction(
				[
					InstructionBuilder.set('__ptrblock', `${source}_block`),
					InstructionBuilder.set('__ptrpos', `${source}_pos`),
					...(type.members.map(
						/**
						 * 
						 * @param {MemberInfo} member
						 */
						member => {
							const result = new Instruction(
								finalSourceType.isNear() ? [
									InstructionBuilder.op('add', '__ptrpos', '__ptrpos', member.offset - latest)
								] : [
									InstructionBuilder.set('__step', member.offset - latest),
									this.functionManagement.getFunctionCall('__pointerForward', new Map(), this.memory, false)
								]
							).concat(InstructionBuilder.reads(`${target}.${member.name}`, '__ptrblock', '__ptrpos'));
							latest = member.offset;
							return result;
						}
					))
				]
			);
		} else {
			return new Instruction(
				type.members.map(
					/**
					 * 
					 * @param {MemberInfo} member 
					 */
					member => this.copyObject(`${target}.${member.name}`, `${source}.${member.name}`, member.type, null, false)
				)
			);
		}
		
	}
    
	/**
	 * 
	 * @param {FunctionDeclarationNode} node
	 * @returns {Instruction} 
	 * @remark This function doesn't do registration itself. It simply calls for body information.
	 */
	visitFunctionDeclaration(node) {
		const recursive = this.recursiveInfo.has(node.name);
		let pushedScope = null;
		if (node.scope) {
			pushedScope = this.currentScope;
			this.currentScope = node.scope;
			this.currentFunctionScope = node.scope;
		}
		this.currentFunction = node.name;
		this.currentReturns = [];
		let result = new Instruction(), paramId = 0;
		const functionSymbol = this.currentScope.lookup(node.name);
		if (!(functionSymbol && !functionSymbol.isAddressed)) {
			result.concat(new Instruction(node.scope.getAllSymbols().flatMap(sym => {
				if (sym.kind !== 'parameter') return [];
				const paramName = `__param_${paramId++}`;
				if ((sym.type.type.kind === 'struct' || sym.type.type.kind === 'union')) {
					// Must be copied (NOTE: They are NOT .__pointer NOw!)
					return [this.copyStruct(sym.getAssemblySymbol(), paramName, sym.type.type)];
				}
				return [this.writeSymbol(sym, paramName)];
			})));	// Copy the parameters
			// If there's no function address calling, this is not necessary
		}
		let body = this.visit(node.body);
		//body.replace('func_ret', body.size() + 1);
		this.currentReturns.forEach(rets => {
			body.concat(new InstructionReferrer(rets, 'func_ret', 0));
		});
		this.releaseTempVariable();
		/*
		if (recursive) {
			// Before execution...
			this.currentScope.recursivelyGetAllSymbols().forEach(symbol => {
				result.concat(this.generateSymbolRead(symbol, true, `${symbol.getAssemblySymbol()}.__restore`));
			});
		}
			*/
		result.concat(body);
		/*
		if (recursive) {
			this.currentScope.recursivelyGetAllSymbols().forEach(symbol => {
				result.concat(this.writeSymbol(symbol, `${symbol.getAssemblySymbol()}.__restore`));
			});
		}
			*/
		if (pushedScope) {
			this.currentScope = pushedScope;
			this.currentFunctionScope = null;
		}
		this.currentFunction = "";
		this.currentReturns = [];
		return result;
	}

	/**
	 * 
	 * @param {ReturnStatementNode} node 
	 * @return {Instruction}
	 * @remark '__return' is the result of function return !!
	 */
	visitReturnStatement(node) {
		const result = node.argument ? this.visitAndRead(node.argument) : new Instruction();
		let stmt = new Instruction();
		if (node.argument) {
			// Copying should be done in callers, not callees
			if (node.dataType && node.dataType.isPointerImpl()) {
				stmt.concat(result);
				stmt.setAttribute('isPointer', true);
				stmt.concat([
					InstructionBuilder.set(`__return_block`, `${result.instructionReturn}_block`),
					InstructionBuilder.set(`__return_pos`, `${result.instructionReturn}_pos`)
				])
			} else if (result.getAttribute('isPointer')) {
				stmt.concat(result);
				stmt.concat(this.memory.outputPointerFetchOf(result.instructionReturn, "__return"));
			} else if (result.getAttribute('isTemporary')) {
				stmt.concat(result.replace_variable('__return', result.instructionReturn));
			} else {
				stmt.concat(result);
				stmt.concat(this.copyObject('__return', result.instructionReturn, node.dataType, node.argument.dataType, true));
				//stmt.concat(InstructionBuilder.set('__return', result.instructionReturn));
			}
		}
		this.releaseTempVariable();
		let jumper = InstructionBuilder.jump(`{func_ret}`, 'always');
		this.currentReturns.push(jumper);
		stmt.concat(jumper);
		return stmt;
	}

	visitCompoundStatement(node) {
		let instruction = new Instruction();
		let pushedScope = null;
		if (node.scope) {
			pushedScope = this.currentScope;	// After optimizer, the scope relationship will be damanged!
			this.currentScope = node.scope;
		}
		node.statements.forEach(stmt => {
			instruction.concat(this.visit(stmt));
			this.releaseTempVariable();
		});
		if (pushedScope) {
			this.currentScope = pushedScope;
		}
		return instruction;
	}
	/**
	 * 
	 * @param {ASTNode} node 
	 */
	visitExpressionStatement(node, param) {
		let instruction = new Instruction();
		node.children.forEach(stmt => {
			//this.releaseTempVariable();
			// As we apply variable replacement, we can't release temporary variable here
			const result = this.visitAndRead(stmt, param);
			instruction.concat_returns(result);
		});
		return instruction;
	}

	/**
	 * 
	 * @param {ConditionalExpressionNode} node 
	 * @warning Some different behavior for >=152 version: whatever happens, both the consequent and the alternate will be evaulated!!
	 */
	visitConditionalExpression(node, param) {
		let result = new Instruction();
		let returner = this.getTempSymbol(node.dataType);//this.getTempVariable();
		const returnerTarget = (param && param.assignmentTarget) ? param.assignmentTarget : returner.getAssemblySymbol();

		// TODO if it is a single operation, then directly use 'select':
		// currently we use sth else
		if (this.targetVersion >= 152) {
			const tester = this.visitToCondition(node.test, false);
			return this.operatesReads(
				[this.visit(node.consequent), this.visit(node.alternate)],
				this.operatesWrite(
					new Instruction([
						tester,
						InstructionBuilder.selectx('{op_write}', tester.instructionReturn, '{op_r0}', '{op_r1}')
					]), returner
				)
			);
			
		}

		const test = this.visitAndRead(node.test);
		result.concat(test);
		const jumper = this.operatesWith(
			InstructionBuilder.jump('{alt}', 'equal', '{opw}', 'false'),
			test
		);
		result.concat(jumper);
		const consequent = this.visitAndRead(node.consequent);
		const alternate = this.visitAndRead(node.alternate);
		const isPointer = node.dataType && node.dataType.isPointerImpl();
		result.concat(consequent);
		if (isPointer) {
			returner.implementAsPointer = true;
			result.setAttribute('isPointer', true);
		} else if (consequent.getAttribute('isPointer')) {
			returner.accessThroughPointer = true;
		}
		result.concat(this.writeSymbol(returner, consequent.instructionReturn));
		const finalize = InstructionBuilder.jump('{end}', 'always');
		result.concat(finalize);
		result.concat(new InstructionReferrer(jumper, 'alt', 0));
		result.concat(alternate);
		if (alternate.getAttribute('isPointer')) {
			returner.accessThroughPointer = true;
			result.setAttribute('isPointer', true);
		} else {
			// What did I intend to write here?
		}
		result.concat(this.writeSymbol(returner, alternate.instructionReturn));
		result.concat(new InstructionReferrer(finalize, 'end', 0));
		result.set_returns(returner);
		return result;
	}

	/**
	 * 
	 * @param {IfStatementNode} node 
	 * @remark The problem is that the comparers are all in the jumpers.
	 * To handle this, we still make them values.
	 * @todo I think we can simplify 'test' generation (judge whether it's a binary expression)
	 * -- and if it is, directly use it!
	 * @bug
	 */
	visitIfStatement(node) {
		let result = new Instruction();
		//let test = this.implicitToBoolean(node.test);
		//result.concat(test);
		const tester = this.visitToCondition(node.test, true);
		this.releaseTempVariable();
		let consequentProcessor = new Instruction();
		let consequent = this.visit(node.consequent), alternateProcessor = new Instruction();
		const noConsequent = new Instruction([
				tester,
				InstructionBuilder.jumpx('{alt_begin}', tester.instructionReturn)
			]);
		if (node.alternate) {
			let alternate = this.visit(node.alternate);
			//alternateProcessor.concat(InstructionBuilder.jump('{0}', 'always', null, null, [alternate.size() + 1]))// Skip alternate block if executing consequent
			const jumper = InstructionBuilder.jump('{end_of_alt}', 'always');
			alternateProcessor.concat(jumper);
			alternateProcessor.concat(new InstructionReferrer(noConsequent, 'alt_begin'));
			alternateProcessor.concat(alternate);
			alternateProcessor.concat(new InstructionReferrer(jumper, 'end_of_alt'));
		} else {
			alternateProcessor.concat(new InstructionReferrer(noConsequent, 'alt_begin'));
		}
		consequentProcessor.concat(noConsequent);
		consequentProcessor.concat(consequent);
		result.concat(consequentProcessor);
		result.concat(alternateProcessor);
		return result;
	}

	/**
	 * 
	 * @param {WhileStatementNode} node 
	 */
	visitWhileStatement(node) {
		//const test = this.implicitToBoolean(node.test);
		const tester = this.visitToCondition(node.test, true);
		let connector = new Instruction();
		let bodyProcessor = new Instruction();
		this.enterLoop();
		const body = node.body ? this.visit(node.body) : new Instruction();
		const conditBreak = InstructionBuilder.jumpx('{loop_break}', tester.instructionReturn);	// Already connected
		bodyProcessor.concat(conditBreak);
		this.currentBreaks.push(conditBreak);
		this.releaseTempVariable();
		bodyProcessor.concat(body);
		const testJumper = InstructionBuilder.jump('{goto_test}', 'always', null, null);
		connector.concat(new InstructionReferrer(testJumper, 'goto_test'));
		connector.concat(tester);
		connector.concat(bodyProcessor);
		connector.concat(testJumper);
		// Replace 'continue' and 'break':
		//connector.replace('loop_continue', 0);
		//connector.replace('loop_break', connector.size() + 1);
		let finalize = new Instruction();
		this.currentContinues.forEach(conts => {
			finalize.concat(new InstructionReferrer(conts, 'loop_continue'));
		})
		finalize.concat(connector);
		this.currentBreaks.forEach(breaks => {
			finalize.concat(new InstructionReferrer(breaks, 'loop_break'));
		});
		this.exitLoop();
		return finalize;
	}

	/**
	 * 
	 * @param {ForStatementNode} node 
	 */
	visitForStatement(node) {
		let loopSystem = new Instruction();
		this.enterLoop();
		const body = node.body ? this.visit(node.body) : new Instruction();
		const update = node.update ? this.visit(node.update) : new Instruction();
		let initSystem = new Instruction();
		this.releaseTempVariable();
		if (node.init) {
			initSystem = this.visit(node.init);
			this.releaseTempVariable();
		}
		let bodyLoop = new Instruction(), continueIns = new Instruction();
		bodyLoop.concat(body);
		bodyLoop.concat(continueIns);
		bodyLoop.concat(update);
		const testJumper = InstructionBuilder.jump('{goto_test}', 'always', null, null);
		bodyLoop.concat(testJumper);
		loopSystem.concat(new InstructionReferrer(testJumper, 'goto_test'));
		if (node.test) {
			const test = this.visitToCondition(node.test, true);
			loopSystem.concat(test);
			const conditBreak = InstructionBuilder.jumpx('{loop_break}', test.instructionReturn);
			this.currentBreaks.push(conditBreak);
			loopSystem.concat(conditBreak);
		}	// Otherwise this directly proceeds
		this.releaseTempVariable();
		loopSystem.concat(bodyLoop);
		let finalize = new Instruction();
		if (node.init) {
			finalize.concat(initSystem);
		}
		this.currentContinues.forEach(conts => {
			continueIns.concat(new InstructionReferrer(conts, 'loop_continue'));
		})
		finalize.concat(loopSystem);
		this.currentBreaks.forEach(breaks => {
			finalize.concat(new InstructionReferrer(breaks, 'loop_break'));
		});
		this.exitLoop();
		return finalize;
	}

	/**
	 * 
	 * @param {ASTNode} node 
	 */
	visitBreakStatement(node) {
		const jumper = InstructionBuilder.jump('{loop_break}', 'always');
		this.currentBreaks.push(jumper);
		return jumper;
	}

	/**
	 * 
	 * @param {ASTNode} node 
	 */
	visitContinueStatement(node) {
		const jumper = InstructionBuilder.jump('{loop_continue}', 'always');
		this.currentContinues.push(jumper);
		return jumper;
	}

	/**
	 * 
	 * @param {VariableDeclarationNode} node 
	 */
	visitVariableDeclaration(node) {
		let instruction = new Instruction();
		node.declarators.forEach(stmt => {
			instruction.concat(this.visit(stmt));
			this.releaseTempVariable();
		});
		return instruction;
	}

	/**
	 * The literal an instruction consists of, when it is nothing but
	 * `set <temp> <literal>` and the temp is not used again.
	 *
	 * @param {any} inst
	 * @returns {string?} null when it is not that shape
	 */
	immediateValueOf(inst) {
		const list = inst?.instructions;
		if (!Array.isArray(list) || list.length !== 1) return null;
		const only = list[0];
		if (!only || only.isInstructionGroup || !only.content) return null;
		const match = /^set\s+\S+\s+(-?\d+(?:\.\d+)?|true|false|null|@[A-Za-z0-9_-]+)\s*$/
			.exec(String(only.content));
		return match ? match[1] : null;
	}

	/**
	 * Fill in the elements of an array that lives in registers.
	 *
	 * @param {SymbolEntry} symbol
	 * @param {{type: string, implement: string?}} style
	 * @param {ASTNode} initializer An InitializerList
	 * @returns {Instruction}
	 */
	initializeEmbeddedArray(symbol, style, initializer) {
		const items = initializer.values ?? initializer.children ?? null;
		if (!Array.isArray(items) || items.length === 0) return new Instruction();
		const length = this.arrayLengthOf(symbol);
		const names = style.type === 'embedded' && style.implement === 'lookup'
			? this.lookupNamesOf(length).names : null;
		const result = new Instruction();
		for (let i = 0; i < items.length && i < length; i++) {
			const register = names ? names[i] : `${symbol.getAssemblySymbol()}_${i}`;
			if (!register) break;
			/*
			A content constant (@lead) initialising a numeric array must become
			its id: the register would otherwise hold the content itself and
			print as `@lead` instead of `1`.
			*/
			const item = items[i];
			const isContent = item && item.type === 'Identifier'
				&& typeof item.name === 'string' && item.name[0] === '@';
			if (isContent) {
				const id = this.semantic?.numberOfInitializerItem?.(item) ?? null;
				if (id !== null) {
					result.concat(InstructionBuilder.set(register, String(id)));
					continue;
				}
			}
			const value = this.visitAndRead(item);
			result.concat(value);
			result.concat(InstructionBuilder.set(register,
				value.instructionReturn !== null && value.instructionReturn !== undefined
					? value.instructionReturn : '0'));
			this.releaseTempVariable?.();
		}
		return result;
	}

	/**
	 * Record the literal contents of every global array.
	 *
	 * @param {ASTNode} ast The ProgramNode
	 * @returns {void}
	 */
	collectGlobalArrayValues(ast) {
		const previous = this.currentScope;
		this.currentScope = this.semantic.globalScope ?? previous;
		for (const declaration of ast.globalDeclarations ?? []) {
			for (const declarator of declaration.declarators ?? []) {
				const symbol = this.currentScope?.lookup?.(declarator.name);
				if (!symbol || symbol.arrayInitialValues) continue;
				if (!this.arraySymbolOfIdentifier(symbol)) continue;
				const literals = this.numericElementsOf(declarator.initializer);
				if (literals) symbol.arrayInitialValues = literals;
			}
		}
		this.currentScope = previous;
	}

	/**
	 * The contents of an initializer list, when every one of them is a number.
	 *
	 * @param {ASTNode?} initializer
	 * @returns {number[]?} null when it is missing or not purely numeric
	 */
	numericElementsOf(initializer) {
		if (!initializer) return null;
		const items = initializer.values ?? initializer.children ?? null;
		if (!Array.isArray(items) || items.length === 0) return null;
		const numbers = [];
		for (const item of items) {
			// Numbers and content constants (`@lead`) both have a compile time id
			const value = this.semantic?.numberOfInitializerItem?.(item) ?? null;
			if (value === null || !Number.isFinite(value)) return null;
			numbers.push(value);
		}
		return numbers;
	}

	/**
	 * 
	 * @param {VariableDeclaratorNode} node 
	 * @remark This has to do with many operations...
	 */
	visitVariableDeclarator(node) {
		// Simple symbols can have direct lookup in scope
		const special = ['item_t', 'liquid_t', 'unit_t', 'block_t'];
		const referrer = typeName => typeName.slice(0, typeName.length - 2);

		const symbol = this.currentScope.lookup(node.name);
		if (!symbol) {
			throw new InternalGenerationFailure(`Could not get symbol ${node.name}`, node);
		}
		if (symbol.isAutoDevice) {
			return new Instruction();
		}
		let finalize = new Instruction();
		/*
		The address assignment is emitted once per symbol: some paths reach this
		declarator twice, and writing `X_block` / `X_pos` again only repeats the
		very same two instructions.
		*/
		const alreadyAddressed = this._addressedSymbols ?? (this._addressedSymbols = new Set());
		const freshAddress = !alreadyAddressed.has(symbol);
		if (freshAddress) alreadyAddressed.add(symbol);
		if (symbol.memoryLocation && freshAddress) {
			if (symbol.extraMemoryLocation) {
				finalize.concat(this.memory.outputStorageOf(symbol.extraMemoryLocation, `${this.memory.memoryBlocks[symbol.memoryLocation.block].name}_id`));
				finalize.concat(this.memory.outputStorageOf(symbol.extraMemoryLocation.duplicate().forwarding(1), symbol.memoryLocation.position));
			} else {
				if (symbol.accessThroughPointer) {
					finalize.concat(symbol.memoryLocation.getAssignmentInstruction(`${symbol.getAssemblySymbol()}.__pointer`));
				} else {
					finalize.concat(symbol.memoryLocation.getAssignmentInstruction(symbol.getAssemblySymbol()));
				}
			}
		}
		if (symbol.extraMemoryLocation && freshAddress) {
			// This is a little bit weird, I think
			// Usually for those access-through-pointer but no memory location ones
			finalize.concat(symbol.extraMemoryLocation.getAssignmentInstruction(`${symbol.getAssemblySymbol()}.__pointer`));
		}
		/*
		An array that is NOT laid out in memory (its elements are registers, or a
		single encoded string) carries its initial values in that representation
		already. Building a memory image and copying it in would be pointless --
		and would write to memory the array does not have.
		*/
		/*
		An `encoded` array IS nothing but a table of its own contents, so those
		constants must be known. Record them from the initializer list: the
		optimizer only does that for arrays it tracked itself, so a plain
		`const int a[4] = {...}` used to arrive with every element taken as 0.
		*/
		if (this.arraySymbolOfIdentifier(symbol) && !symbol.arrayInitialValues) {
			const literals = this.numericElementsOf(node.initializer);
			if (literals) symbol.arrayInitialValues = literals;
		}
		const arrayStyle = this.arraySymbolOfIdentifier(symbol)
			? this.arrayStyleFor(symbol) : null;
		/*
		An array held in registers still needs its elements FILLED IN: the
		layout only decides where they live, not what they contain. Only an
		`encoded` array is genuinely nothing but its own contents (they are the
		string itself), and only it may skip initialisation.
		*/
		if (node.initializer && arrayStyle && arrayStyle.type !== 'traditional') {
			node.initializer.setAttribute('embeddedInRepresentation', true);
			if (arrayStyle.type !== 'encoded') {
				finalize.concat(this.initializeEmbeddedArray(symbol, arrayStyle, node.initializer));
			}
			return finalize;
		}
		if (!symbol.memoryLocation || node.initializer) {
			let endJumper = null;
			const endTag = `${symbol.getAssemblySymbol()}:_static_tag`;
			if (symbol.isStatic) {
				endJumper = InstructionBuilder.jump('{skip_init}', 'notEqual', endTag, 'false');
				finalize.concat(endJumper);
			}
			// This is reserved
			let evaluation = node.initializer ? this.visitAndRead(node.initializer) : new Instruction();
			
			if (node.initializer) {
				// Necessary implicit converts that is not supported by the Mindustry VM
				if (node.initializer.dataType) {
					if (this.semantic.isSameType(symbol.myType(), this.semantic.getTypeInfo('content_t')) && special.includes(node.initializer.dataType.name)) {
						evaluation = this.implicitToContentRaw(evaluation, referrer(node.initializer.dataType.name));
					} else if (special.includes(symbol.myType().name) && !this.semantic.isSameType(symbol.type.type, node.initializer.dataType)) {
						evaluation = this.implicitContentToNumericRaw(evaluation);
					} else if (this.semantic.isTypeCompatible(symbol.myType(), 'int', true) && this.semantic.isTypeCompatible(node.initializer.dataType, 'float', true)) {
						evaluation = this.implicitFloorRaw(evaluation);
					}
				}
				
				// Oh no, this was wrong. YOU CAN'T ASSUME THAT THE RIGHT SIDE IS SIMILAR THING AS WELL!
				// 'isStructRet' is used only for initializer list
				/*
				`replace_variable` below works by renaming the variable inside the
				instructions that produced the value. That only works when there
				ARE instructions: `int *p = &x;` yields the address of x with no
				code at all, and renaming nothing leaves p uninitialised. In that
				case the value has to be copied explicitly.
				*/
				const noCodeToRename = !(evaluation.instructions && evaluation.instructions.length > 0);
				if (symbol.accessThroughPointer || noCodeToRename
					|| evaluation.getAttribute('disallowReplacement')) {
					finalize.concat(evaluation);
					if (node.initializer.dataType && (
						node.initializer.dataType.kind === 'struct' || node.initializer.dataType.kind === 'union' || evaluation.getAttribute('isStructRet')
					)) {
						finalize.concat(this.copyStruct(symbol.getAssemblySymbol(), evaluation.instructionReturn ?? 'null', symbol.myType(), node.initializer.dataType));
					} else {
						finalize.concat(this.writeSymbol(symbol, evaluation.instructionReturn ?? 'null'));
					}
				} else {
					finalize.concat(evaluation.replace_variable(symbol.getAssemblySymbol(), evaluation.instructionReturn));
				}
			}
			
			if (symbol.isStatic) {
				finalize.concat(InstructionBuilder.set(endTag, 'true'));
				finalize.concat(new InstructionReferrer(endJumper, 'skip_init', 0));
			}
			this.releaseTempVariable();
		}
		return finalize;
	}

	/**
	 * 
	 * @param {DeclaratorNode} node 
	 * @returns 
	 */
	visitDeclarator(node) {
		return this.visitVariableDeclarator(node);
	}

	/**
	 * 
	 * @param {string} pointer 
	 * @returns {Instruction}
	 */
	castPointerToValue(pointer) {
		const tempVar = this.getTempVariable();
		this.operates(new Instruction([
			InstructionBuilder.reads(tempVar, `${pointer}_block`, 4),
			InstructionBuilder.op('add', tempVar, `${pointer}_pos`)
		]), tempVar);
	}
	

	/**
	 * 
	 * @param {InitializerListNode} node 
	 * @remark This function fetchs parent information...
	 * - If its parent is a declarator (or variable declarator), it directly sets values
	 * - Otherwise, it creates a new memory space and copies it
	 */
	visitInitializerList(node) {
		const declaratorTypes = ['VariableDeclarator', 'Declarator'];
		const realiableTypes = [...declaratorTypes, 'AssignmentExpression', 'CastExpression'];
		let assignedSpace = node.symbol ? node.symbol.memoryLocation : null, result = new Instruction();
		
		/**
		 * @type {TypeInfo}
		 */
		let knownType = null;
		if (node.parent) {
			if (declaratorTypes.includes(node.parent.type)) {
				const manualSpace = this.currentScope.lookup(node.parent.name).memoryLocation;
				assignedSpace = manualSpace ?? assignedSpace;
				if (manualSpace) {
					// Actually, the preprocessing has been done in the variable declarator visitor.
					result.setAttribute('noCopy', true);
				}
			}
			if (realiableTypes.includes(node.parent.type)) {
				knownType = node.parent.dataType;
			}
		}
		knownType = knownType ?? node.dataType;
		let tmpVar = this.getTempSymbol(knownType ?? node.dataType);
		result.setAttribute('isTemporary', true);
		if (knownType && knownType.isRegStruct()) {
			// Structure demands special processor
			let result = new Instruction();
			for (let i = 0; i < knownType.members.length && i < node.children.length; i++) {
				if (node.children[i].type === 'InitializerList') {
					node.children[i].dataType = knownType.members[i].type;
				}
				const ret = this.visitAndRead(node.children[i]);
				const current = knownType.members[i];
				const currentTarget = `${tmpVar.getAssemblySymbol()}.${current.name}`;
				if (ret.getAttribute('disallowReplacement')) {
					result.concat(ret);
					result.concat(this.copyObject(currentTarget, 
						ret.instructionReturn, current.type, node.children[i].dataType));
				} else {
					result.concat(ret.replace_variable(currentTarget, ret.instructionReturn));
				}
			}
			result.set_returns(tmpVar);
			result.setAttribute('isStructRet', true);
			result.setAttribute('isTemporary', true);
			return result;
		} else {
			//let currentPointer = 0;
			/**
			 * 
			 * @param {ASTNode} obj 
			 * @param {TypeInfo} typeLayer
			 */
			const spaceIsOwned = assignedSpace != null;
			assignedSpace = assignedSpace ?? this.memory.assign(this.getTempSpace(), Math.max(node.dataType.size, node.getAttribute('requiredSize') ?? 0));
			/*
			When the space is the variable's own memory location the declarator
			has already written its address out; doing it again here only repeats
			the same two instructions.
			*/
			if (!spaceIsOwned) {
				result.concat(assignedSpace.getAssignmentInstruction(tmpVar.getAssemblySymbol()));
			}
			result.instructionReturn = tmpVar.getAssemblySymbol();
			result.setAttribute('isPointer', true);
			const initializerProcessor = (obj, typeLayer) => {
				
				const warnedTypes = ['device', 'null_t'];
				typeLayer = typeLayer ?? obj.dataType;
				
				const step = (typeLayer && (typeLayer.size != null)) ? typeLayer.size 
					: (obj.dataType.size ?? 0);
				let processed = 0;

				if (obj.type === 'InitializerList') {
					obj.children.forEach(child => {
						processed += initializerProcessor(child, typeLayer ? typeLayer.pointerTo : null);
					});
					// Might be sth greater:
					if (processed < step) assignedSpace.forwarding(step - processed);
				} else {
					if (obj.dataType && warnedTypes.includes(obj.dataType.name)) {
						this.addWarning(`Initializing object of type ${obj.dataType.toString()} in initializer list is an undefined behavior`, node.location);
					}
					let valueFetch;
					if (obj.dataType && obj.dataType.name === 'content_t') {
						valueFetch = this.implicitContentToNumericRaw(this.visitAndRead(obj));
					} else {
						valueFetch = this.visitAndRead(obj);
					}
					/*
					A value that is only `set <temp> <literal>` can go straight
					into memory: the temp is not read anywhere else, so keeping
					it costs one instruction per element for nothing.
					*/
					const immediate = this.immediateValueOf(valueFetch);
					if (immediate !== null) {
						result.concat(this.memory.outputStorageOf(assignedSpace, immediate));
					} else {
					result.concat(valueFetch);
					// Process assignment-like
					if (valueFetch.getAttribute('isPointer') || obj.dataType.isPointerImpl()) {
						// They are implemented as pointer...
						result.concat(new Instruction([
							this.memory.outputStorageOf(assignedSpace, `${valueFetch.instructionReturn}_block`),
							this.memory.outputStorageOf(assignedSpace.duplicate().forwarding(1), `${valueFetch.instructionReturn}_pos`)
						]));
					} else {
						result.concat(this.memory.outputStorageOf(assignedSpace, valueFetch.instructionReturn));
					}
					}
					processed = step;
					assignedSpace.forwarding(step);
				}
				return processed;
			};
			initializerProcessor(node, knownType);
		}

		
		
		return result;
	}

	implicitContentToNumericRaw(inst) {
		/*
		`item_t x = @copper;` -- the id of `@copper` is a compile time constant,
		so write it out rather than asking the processor with a `sensor`. Only
		a name whose id is declared as `null` needs the runtime lookup.
		*/
		const known = knownContentIdOf(this.glob, inst.instructionReturn);
		/*
		`@lead` on its own produces no code at all, so the id can simply BE the
		value: no temp symbol, and `write 1 cell1 8` instead of two statements.
		Anything that needs a register copies it explicitly (the attribute says
		the literal may not be renamed in place).
		*/
		if (known !== null && !(inst.instructions && inst.instructions.length > 0)) {
			return new Instruction([], String(known),
				new Map([['disallowReplacement', true]]));
		}
		const temporary = this.getTempSymbol(this.semantic.getTypeInfo('int'));
		if (known !== null) {
			const holder = temporary.getAssemblySymbol();
			const result = new Instruction([inst,
				InstructionBuilder.set(holder, String(known))]);
			result.instructionReturn = holder;
			return result;
		}
		let result = new Instruction([inst]);
		result.concat_returns(this.operates(
			this.operatesWith(InstructionBuilder.sensor('{op}', '{opw}', '@id'), inst), temporary));
		return result;
	}

	/**
	 * 
	 * @param {Instruction} inst 
	 */
	implicitFloorRaw(inst) {
		const result = inst;
		const temporary = this.getTempSymbol(this.semantic.getTypeInfo('int'));
		result.concat_returns(this.operates(this.operatesWith(
			InstructionBuilder.op('floor', '{op}', '{opw}'),
			result
		), temporary));
		return result;
	}

	/**
	 * 
	 * @param {ASTNode} node 
	 * @returns {Instruction} Return something with implicit conversion to int
	 */
	implicitToNumeric(node) {
		let result, temporary;
		if (node.dataType) {
			switch (node.dataType.name) {
				case 'bool':
					result = this.visitAndRead(node);
					temporary = this.getTempSymbol(this.semantic.getTypeInfo('int'));//this.getTempVariable();
					result.concat(this.writeSymbol(temporary, 0));
					let jumper = this.operatesWith(
						InstructionBuilder.jump('{notequal_end}', 'equal', 'false', '{opw}'),
						result
					);
					result.concat(jumper);
					result.concat(this.writeSymbol(temporary, 1));
					result.concat(new InstructionReferrer(jumper, 'notequal_end', 0));
					result.set_returns(temporary);
					return result;
					break;
				case 'float': case 'double':
					return this.implicitFloorRaw(this.visitAndRead(node));
					break;
				case 'content_t':
					return this.implicitContentToNumericRaw(this.visitAndRead(node));
					break;
			}
		}
		return this.visitAndRead(node);
	}

	/**
	 * 
	 * @param {Instruction} inst 
	 * @param {string} contentType 
	 * @returns SYMBOLIC CONTENT
	 */
	implicitToContentRaw(inst, contentType) {
		let result = inst;
		if (inst.instructionReturn.startsWith('@')) {
			return inst;		// Already the constant
		}
		const temporary = this.getTempSymbol(this.semantic.getTypeInfo('content_t'));//this.getTempVariable();
		result.concat_returns(this.operates(
			this.operatesWith(InstructionBuilder.lookup(contentType, '{op}', '{opw}'), result), temporary
		));
		return result;
	}

	/**
	 * 
	 * @param {ASTNode} node 
	 * @param {string | null} [contentTypeGiven=null]
	 * @param {boolean} [strict=false] 
	 * @return {Instruction}
	 */
	implicitToContent(node, contentTypeGiven = null, strict = false) {
		let result, temporary;
		let contentType = contentTypeGiven;
		const special = ['item_t', 'liquid_t', 'unit_t', 'block_t'];
		const referrer = typeName => typeName.slice(0, typeName.length - 2);
		if (node.type === 'Identifier' && node.name[0] === '@') {
			return new Instruction([], node.name, new Map([['disallowReplacement', true]]));
		}
		if (node.dataType) {
			if (!contentType && special.includes(node.dataType.name)) {
				contentType = referrer(node.dataType.name);
			}
			switch (node.dataType.name) {
				// These types are actually stored in integral form
				case 'int':
					if (strict) break;
					// Otherwise passthrough!
				case 'item_t': case 'liquid_t': case 'unit_t': case 'block_t':
					return this.implicitToContentRaw(this.visitAndRead(node), contentType);
					break;
			}
		}
		return this.visitAndRead(node);
	}

	implicitToBoolean(node) {
		if (!node.dataType || node.dataType.name !== 'bool') {
			let result = this.visitAndRead(node);
			let temporary = this.getTempSymbol(this.semantic.getTypeInfo('bool'));
			if (this.targetVersion >= 152) {
				result.concat(this.operatesWrite(
					InstructionBuilder.select('{op_write}', 'equal', result.instructionReturn, '0', 'false', 'true'),
					temporary
				));
			} else {
				result.concat(this.writeSymbol(temporary, 'false'));
				let jumper = this.operatesWith(
					InstructionBuilder.jump('{equal_end}', 'equal', '0', '{opw}'),
					result
				);
				result.concat(jumper);
				result.concat(this.writeSymbol(temporary, 'true'));
				result.concat(new InstructionReferrer(jumper, 'equal_end', 0));
			}
			result.set_returns(temporary);
			return result;
		} else {
			return this.visitAndRead(node);
		}
	}

	/**
	 * 
	 * @param {ASTNode} node 
	 * @param {boolean} requireOpposite Whether the result is 'opposed'
	 * @returns {Instruction}
	 * @remarks This returns a **segment** (like `equal a b`).
	 */
	visitToCondition(node, requireOpposite) {
		const comparerTranslation = new Map([['==', 'equal'], ['!=', 'notEqual'], ['<', 'lessThan'], ['>', 'greaterThan'], ['<=', 'lessThanEq'], ['>=', 'greaterThanEq']]);
		const oppositeTranslation = new Map([['==', 'notEqual'], ['!=', 'equal'], ['<', 'greaterThanEq'], ['>', 'lessThanEq'], ['<=', 'greaterThan'], ['>=', 'lessThan']]);
		if (node.type === 'BinaryExpression' && comparerTranslation.has(node.operator)) {
			const evaluatingKinds = ['pointer', 'array'];
			const leftIsPointer = node.left.dataType && evaluatingKinds.includes(node.left.dataType.kind);
			const rightIsPointer = node.right.dataType && evaluatingKinds.includes(node.right.dataType.kind);
			if (!(leftIsPointer || rightIsPointer)) {
				return this.operatesReads(
					[this.visit(node.left), this.visit(node.right)],
					new Instruction([], `${requireOpposite ? oppositeTranslation.get(node.operator) : comparerTranslation.get(node.operator)} {op_r0} {op_r1}`,
					new Map([['disallowReplacement', true]]))
				);
			}
		}
		let result = this.implicitToBoolean(node);
		result.instructionReturn = `${requireOpposite ? 'equal' : 'notEqual'} ${result.instructionReturn} false`;
		return result;
	}

	/**
	 * 
	 * @param {BinaryExpressionNode} node 
	 * @remark MUST CONSIDER: Clear up temporary staff in general expression processor
	 * @bug Notice: pointer access for recursive functions might result in errors
	 */
	visitBinaryExpression(node) {
		const glob = this.glob;
		if (node.getAttribute('disposeReturn')) {
			return new Instruction([
				this.visit(node.left),
				this.visit(node.right)
			]);
		}

		const operatorTranslation = new Map([['+', 'add'], ['-', 'sub'], ['*', 'mul'], ['/', 'div'], ['%', 'mod'], ['|', 'or'], ['||', 'or'], ['&', 'and'], ['&&', 'land'], ['^', 'xor'], ['<<', 'shl'], ['>>', 'shr'], ['==', 'equal'], ['!=', 'notEqual'], ['<', 'lessThan'], ['>', 'greaterThan'], ['<=', 'lessThanEq'], ['>=', 'greaterThanEq']]);
		if (!operatorTranslation.has(node.operator)) {
			this.addWarning('Going to assignment through binary expression:', node);
			return this.visitAssignmentExpression(node);
		}
		const op = operatorTranslation.get(node.operator);

		// Evaluate both sides (they may well contain calls, so every operand ends up
		// in its own temporary symbol -- see `arithmetic()`).
		let left = ExportRet(glob, this.visit(node.left), node.left.dataType);
		let right = ExportRet(glob, this.visit(node.right), node.right.dataType);

		/*
		item_t / liquid_t / unit_t / block_t and content_t can be mixed, but the VM
		cannot compare them directly: the "typed" side has to be looked up into a
		content first.
		*/
		const contentCategory = t => (t && SPECIAL_CONTENT_TYPES.includes(t.name))
			? contentTypeOf(t.name) : null;
		const lcat = node.left.dataType ? (node.left.dataType.name === 'content_t' ? 2
			: (SPECIAL_CONTENT_TYPES.includes(node.left.dataType.name) ? 1 : 0)) : 0;
		const rcat = node.right.dataType ? (node.right.dataType.name === 'content_t' ? 2
			: (SPECIAL_CONTENT_TYPES.includes(node.right.dataType.name) ? 1 : 0)) : 0;
		if (lcat !== rcat && lcat !== 0 && rcat !== 0) {
			const contentType = this.semantic.getTypeInfo('content_t');
			if (lcat === 1) {
				left = left.convertTo(contentType, contentCategory(node.left.dataType));
			} else {
				right = right.convertTo(contentType, contentCategory(node.right.dataType));
			}
		}

		let result = arithmetic(glob, op, left, right, node.dataType);

		// The VM's `div` is a floating point division: integers need an explicit floor.
		if (node.operator === '/' && node.dataType
			&& this.semantic.isTypeCompatibleForAny(node.dataType, ['int', 'long', 'signed', 'unsigned', 'bool'], true)) {
			result = this.applyFloor(result, node.dataType);
		}
		return result;
	}

	/**
	 * 
	 * @param {CastExpression} node 
	 * @todo
	 */
	/**
	 * 
	 * @param {CastExpression} node 
	 * @returns {VariableRet}
	 * @remark Only conversions the Mindustry VM cannot do on its own are emitted;
	 *         everything else is a no-op that just changes the static type.
	 */
	visitCastExpression(node) {
		const glob = this.glob;
		if (node.getAttribute('disposeReturn')) {
			return this.visit(node.expression);
		}
		const target = node.dataType;
		const source = node.expression;
		const sourceType = source ? source.dataType : null;

		/*
		`(volatile T)x` converts nothing: it only demands that the result lives in
		memory. For an identifier that means "use the variable itself" (its in-memory
		reference), so that later reads and writes really go through the memory cell.
		*/
		if (target && (target.qualifiers ?? []).indexOf('volatile') !== -1) {
			if (source && source.type === 'Identifier') {
				if (source.name.length > 0 && source.name[0] === '@') {
					return new ImmediateRet(glob, source.name, target, true);
				}
				const symbol = this.currentScope.lookup(source.name);
				if (!symbol) {
					throw new InternalGenerationFailure(`Unknown identifier ${source.name}`, source);
				}
				return symbolRef(glob, symbol);
			}
			// Not an identifier: whatever the expression produced has to stay in memory,
			// so do not convert it either.
			return ExportRet(glob, this.visit(source), sourceType);
		}

		let value = ExportRet(glob, this.visit(source), sourceType);
		if (!target || !sourceType || this.semantic.isSameType(target, sourceType)) {
			return value.get();
		}

		const intType = this.semantic.getTypeInfo('int');
		const contentType = this.semantic.getTypeInfo('content_t');
		// pointer <-> int : the linear address has to be computed explicitly
		if (sourceType.kind === 'pointer' && target.name === 'int') {
			return value.convertTo(target);
		}
		if (this.semantic.isSameType(sourceType, intType) && target.kind === 'pointer') {
			return value.convertTo(target);
		}
		// float -> integer : truncate
		if (['float', 'double'].includes(sourceType.name)) {
			return value.convertTo(target);
		}
		// -> bool
		if (this.semantic.isSameType(target, this.semantic.getTypeInfo('bool'))) {
			return value.convertTo(target);
		}
		// content types <-> numeric ids
		if (this.semantic.isTypeCompatibleForAny(sourceType, [...SPECIAL_CONTENT_TYPES, 'content_t'], true)
			&& this.semantic.isTypeCompatibleForAny(target, [...SPECIAL_CONTENT_TYPES, 'int'], true)) {
			return value.convertTo(target);
		}
		if (this.semantic.isTypeCompatibleForAny(sourceType, [...SPECIAL_CONTENT_TYPES, 'int'], true)
			&& this.semantic.isSameType(contentType, target)) {
			return value.convertTo(target, contentTypeOf(sourceType.name));
		}
		return value.get();
	}

	/**
	 * 
	 * @param {AssignmentExpressionNode} node 
	 * @todo Make simple numeric operations simplified (direct operation through op, etc.)
	 * @todo Consider some "invaded operations." (e.g. Especially for arrays and structs:
	 * don't let the right side assign to a temporary symbol first.)
	 */
	/**
	 * 
	 * @param {AssignmentExpressionNode} node 
	 * @returns {VariableRet}
	 * @remark The LValue is evaluated exactly ONCE. That matters for code size and,
	 *         more importantly, for expressions with side effects such as `a[i()] += 1`.
	 * @remark Arrays and pointers are assigned by reference; structs and unions
	 *         are copied (member-wise for registry structs, by memcpy otherwise).
	 */
	visitAssignmentExpression(node) {
		const glob = this.glob;
		const leftType = node.left.dataType ?? null;
		const rightType = node.right.dataType ?? null;

		/* ---------------- compound assignment: read / compute / write ---------------- */
		if (node.operator !== '=') {
			const operatorTranslation = new Map([['+=', 'add'], ['-=', 'sub'], ['*=', 'mul'], ['/=', 'div'], ['%=', 'mod'],
				['&=', 'and'], ['|=', 'or'], ['^=', 'xor'], ['<<=', 'shl'], ['>>=', 'shr']]);
			const op = operatorTranslation.get(node.operator);
			if (!op) {
				this.addWarning(`Unsupported compound assignment: ${node.operator}`, node);
				return this.processAssignment(node.left, this.visitBinaryExpression(
					ASTBuilder.binaryExpression(node.operator.slice(0, -1), node.left, node.right)), node.dataType);
			}
			const { setup, ref } = this.splitLValue(this.getLValue(node.left));
			// Both operands are materialized: the right one may contain calls.
			const left = ref.get();
			const right = ExportRet(glob, this.visit(node.right), rightType);
			let result = arithmetic(glob, op, left, right, node.dataType ?? leftType);
			if (node.operator === '/=' && leftType
				&& this.semantic.isTypeCompatibleForAny(leftType, ['int', 'long', 'signed', 'unsigned', 'bool'], true)) {
				result = this.applyFloor(result, leftType);
			}
			return this.mergeSetup(setup, ref.set(result));
		}

		/* ---------------- plain assignment ---------------- */
		const lval = this.getLValue(node.left);

		// Structs and unions are copied (never "by reference")
		if (rightType && ['struct', 'union'].includes(rightType.kind)) {
			return lval.set(ExportRet(glob, this.visit(node.right), rightType));
		}

		// Initializer lists build the data first, then copy it into the target
		if (node.right.type === 'InitializerList') {
			return this.assignInitializerList(node, lval);
		}

		let value = ExportRet(glob, this.visit(node.right), rightType);
		if (leftType && rightType && !this.semantic.isSameType(leftType, rightType)) {
			const intType = this.semantic.getTypeInfo('int');
			if (SPECIAL_CONTENT_TYPES.includes(rightType.name) && leftType.name === 'content_t') {
				value = value.convertTo(this.semantic.getTypeInfo('content_t'), contentTypeOf(rightType.name));
			} else if (SPECIAL_CONTENT_TYPES.includes(leftType.name)) {
				// item_t & friends are plain numeric ids underneath
				value = value.convertTo(intType);
			} else if (['float', 'double'].includes(rightType.name)
				&& !this.semantic.isTypeCompatibleForAny(leftType, ['float', 'double'], true)) {
				value = value.convertTo(intType);
			}
		}
		return lval.set(value);
	}

	/**
	 * Split an LValue into the instructions that compute its address and a bare
	 * reference (carrying no instructions) that can be read and written afterwards.
	 * 
	 * @param {VariableRet} lval 
	 * @returns {{setup: Instruction, ref: VariableRet}}
	 */
	splitLValue(lval) {
		if (!lval.instructions || lval.instructions.length === 0) {
			return { setup: new Instruction(), ref: lval };
		}
		const setup = new Instruction([...lval.instructions]);
		const ref = lval.clone();
		ref.instructions = [];
		return { setup, ref };
	}

	/**
	 * Prepend `setup` to the instructions of `stored`, keeping everything else.
	 * 
	 * @param {Instruction} setup 
	 * @param {VariableRet} stored 
	 * @returns {VariableRet}
	 */
	mergeSetup(setup, stored) {
		if (!setup || !setup.instructions || setup.instructions.length === 0) return stored;
		const merged = stored.clone();
		merged.instructions = [...setup.instructions, ...stored.instructions];
		return merged;
	}

	/**
	 * Integer division in the VM is a floating point one: apply `floor` to `value`.
	 * 
	 * @param {VariableRet} value 
	 * @param {TypeInfo?} type 
	 * @returns {VariableRet}
	 */
	applyFloor(value, type = null) {
		const glob = this.glob;
		const name = value.name;
		const resultType = type ?? value.type;
		return valueClassOf(glob, resultType).create(glob,
			[value.instructions, InstructionBuilder.op('floor', name, name)], name, resultType, true);
	}

	/**
	 * `T x = {...}` : the initializer list produces the data, which is then moved
	 * into the target (by reference for pointers, by memcpy otherwise).
	 * 
	 * @param {AssignmentExpressionNode} node 
	 * @param {VariableRet} lval 
	 * @returns {Instruction}
	 */
	assignInitializerList(node, lval) {
		const target = lval.instructionReturn;
		node.setAttribute('generatedLVal', lval);
		const listData = this.visitAndRead(node.right, { assignmentTarget: target });
		const result = new Instruction([lval.instructions, listData]);
		if (node.left.dataType && node.left.dataType.kind === 'pointer') {
			const rret = listData.instructionReturn;
			result.concat(new Instruction([
				InstructionBuilder.set(`${target}_block`, `${rret}_block`),
				InstructionBuilder.set(`${target}_pos`, `${rret}_pos`)
			]));
		} else {
			result.concat(this.memory.outputMemcpyCall(target, listData.instructionReturn,
				node.right.dataType.size ?? 0, this.functionManagement));
		}
		result.setAttribute('isPointer', true);
		result.instructionReturn = target;
		return result;
	}

	/**
	 * 
	 * @param {UnaryExpressionNode} node 
	 * @returns {Instruction}
	 * @todo Similar to the simplifier of assignment expressions
	 */
	visitUnaryExpression(node) {
		let result, collector, temp;
		let asPointer = false;

		const normalUnary = new Map([['-', 'sub'], ['~', 'not']]);

		switch (node.operator) {
			case '+':
				return this.visitAndRead(node.argument);
				break;
			case '-': case '~':
				if (node.argument.type === 'NumericLiteral') {
					return new Instruction([], -node.argument.value, new Map([['disallowReplacement', true]]));
				}
				result = this.visitAndRead(node.argument);
				temp = this.getTempSymbol(node.dataType);
				result.concat(this.operates(
					InstructionBuilder.op(normalUnary.get(node.operator), '{op}', 0, result.instructionReturn),
					temp
				));
				result.instructionReturn = temp.getAssemblySymbol();
				return result;
				break;
			case '++': case '--':
				// Note: this does not have copy because it has actions on its own
				result = this.visitAndRead(node.argument);	// We have LVal getter there, so this is read-only.
				let duplicate = this.getTempSymbol(node.dataType);
				asPointer = node.argument.dataType && node.argument.dataType.isPointerImpl();
				const shouldDuplicate = (!node.prefix) && (!node.getAttribute('disposeReturn'));
				if (shouldDuplicate) {
					result.concat(this.writeSymbol(duplicate, result.instructionReturn));
				}
				if (asPointer) {
					result.concat(node.operator === '++'
						? this.memory.outputPointerForwardCall(1, result.instructionReturn, this.functionManagement, false, true, result.getAttribute('isNearPointer'))
						: this.memory.outputPointerBackwardCall(1, result.instructionReturn, this.functionManagement, false, true));
					if (node.argument.type !== 'Identifier') {
						result.concat(this.processLValGetter(node.argument)
							.replace('pointer_block_entry', `${result.instructionReturn}_block`)
							.replace('pointer_ptr_entry', `${result.instructionReturn}_pos`));
					}	// Otherwise, already modified.
				} else {
					result.concat(InstructionBuilder.op(node.operator === '++' ? 'add' : 'sub', result.instructionReturn, result.instructionReturn, '1'));
					if (node.argument.type !== 'Identifier') {
						result.concat(this.processLValGetter(node.argument).replace('value_entry', result.instructionReturn));
					}
				}
				if (shouldDuplicate) {
					result.set_returns(duplicate);
				}
				return result;
				break;
			case '&':
				// Get address of given symbol (thus should be a LValue - and having 'pointer')
				// Thus demand some small changes of L-value getting.
				return this.processLValGetter(node.argument, true);	// -- Notice: this is not 'traditional' because we really want something to MODIFY IT
				break;
			case '*': {
				// Get value from given address (variable address).
				// Assume that this is only about RValue (LValue is independently handled.)
				const pointer = ExportRet(this.glob, this.visitAndRead(node.argument), node.argument.dataType);
				if (pointer instanceof NamePointerRet) {
					// The pointer holds a NAME: `read @this <name>`
					return pointer.fetch(this.getTempSymbol(node.dataType));
				}
				collector = this.getTempSymbol(node.dataType);
				if (widthOfType(node.dataType) >= 2) {
					/*
					Pointing at something that is itself two words (an `int **`,
					say): keep the old path, which hands back a pointer view of
					that location.
					*/
					result = this.visitAndRead(node.argument);
					result.concat_returns(this.operates(
						InstructionBuilder.reads('{op}', `${result.instructionReturn}_block`, `${result.instructionReturn}_pos`),
						collector
					));
					result.instructionReturn = collector.getAssemblySymbol();
					return result;
				}
				/*
				The value pointed at is a SINGLE word. It must be returned as a
				value of the dereferenced type -- NOT as the pointer object we
				read it through, otherwise `*p + 1` would be compiled as pointer
				arithmetic instead of an addition.
				*/
				const pointerValue = pointer.get();
				const target = collector.getAssemblySymbol();
				const instructions = [pointerValue.instructions,
					InstructionBuilder.reads(target, `${pointerValue.name}_block`, `${pointerValue.name}_pos`)];
				return valueClassOf(this.glob, node.dataType).create(this.glob, instructions,
					target, node.dataType, true);
			}
				break;
				
			case '!':
				result = this.visitAndRead(node.argument);
				temp = this.getTempSymbol(node.dataType);
				result.concat_returns(this.operates(
					InstructionBuilder.op('equal', '{op}', result.instructionReturn, 'false'),
					temp
				));
				return result;
		}
	}

	/**
	 * 
	 * @param {ASTNode} node 
	 * @returns {Instruction}
	 * @todo Optimize for a common situation: Left side refers to a determined variable
	 * (which requires changes in LVal-getter as well)
	 * @todo I guess this won't result in any error. But who knows...
	 * @remarks This is an atomic operation for generation (at least so far). This feature is guaranteed by the LValGetter.
	 */
	/**
	 * Resolve a member (or element) access into a **reference** of that member.
	 *
	 * The result is either
	 *  - a `MemoryRefRet` : the member lives in memory, the reference holds the
	 *    pointer `P` (P_block / P_pos) pointing at it;
	 *  - a value class (`BasicRet`, `StructRefRet`, ...) : for registry structs,
	 *    whose members are plain named variables.
	 *
	 * @param {ASTNode} node
	 * @returns {VariableRet}
	 */
	/**
	 * Resolve `a.b` / `a[b]` into an LValue: a reference that can be read (`get`)
	 * and written (`set`).
	 *
	 * Three cases:
	 *  - the object is a **registry struct**: `a.b` is simply the variable `a.b`,
	 *    so nothing at all has to be computed;
	 *  - `a[i]`: the element address is the object address plus `i * size`;
	 *  - `a.b` (struct member): the offset has already been computed by the
	 *    semantic analyzer (`memberOffset` / `totalMemberOffset`).
	 *
	 * @param {MemberExpressionNode} node
	 * @returns {VariableRet}
	 */
	/* ------------------------------------------------------------------ *
	 * Array representations
	 *
	 * An array normally lives in memory and is reached through its
	 * `X_block` / `X_pos` pointer. When memory (or instructions) run short it
	 * may instead be held as a set of registers, as a name lookup, or -- for a
	 * constant array -- as a string. See mindcInfrastructure.js.
	 * ------------------------------------------------------------------ */

	/**
	 * Whether pointers may store the NAME of what they point at.
	 * @returns {boolean}
	 */
	namePointerAllowed() {
		const config = this.compiler?.extraConfig?.getAttribute('optimizeOption') ?? {};
		if (config.doPointerOptimize !== true) return false;
		return (this.semantic.targetVersion ?? this.compiler?.config?.getAttribute('targetVersion') ?? 0) >= 150;
	}

	/**
	 * How many elements an array symbol has.
	 * @param {SymbolEntry} symbol
	 * @returns {number}
	 */
	arrayLengthOf(symbol) {
		const type = symbol.myType();
		let sizes = (type && type.arraySize) ? type.arraySize : null;
		// `arraySize` may be a list of numbers, a single number, or the AST
		// literal node that the parser stored there.
		const asNumber = item => {
			if (item === null || item === undefined) return null;
			if (typeof item === 'number') return item;
			if (typeof item.value === 'number') return item.value;
			return null;
		};
		if (!Array.isArray(sizes)) sizes = [sizes];
		const numbers = sizes.map(asNumber).filter(n => n !== null && n > 0);
		if (numbers.length > 0) return numbers.reduce((a, b) => a * b, 1);
		if (type && type.size) return type.size;
		return symbol.size ?? 0;
	}

	/**
	 * Memory cells still free.
	 * @returns {number}
	 */
	remainingMemory() {
		if (!this.memory) return Infinity;
		try {
			// Total capacity: how much there *is*, not how much is left right now.
			return this.memory.memoryBlocks.reduce((sum, block) => sum + block.size, 0);
		} catch (e) {
			return Infinity;
		}
	}

	/**
	 * How many instructions may still be emitted.
	 * @returns {number}
	 */
	instructionBudget() {
		const limit = this.compiler?.extraConfig?.getAttribute('maxInstructions') ?? 1000;
		return Math.max(0, Number(limit) || 1000);
	}

	/**
	 * The names used by the `lookup` representation, taken from the content
	 * lists in mindcBase.js (they are what `lookup` + `sensor @name` can name).
	 * @param {number} length
	 * @returns {{category: string, names: string[]}}
	 */
	lookupNamesOf(length) {
		/*
		`lookup <category> out i` then `sensor out2 <content> @name`: the names
		come from the content table, in id order, so index i really is content i.
		Names declared with `#pragma id` are part of the table; ids declared as
		`null` have no name at all and cannot be looked up.
		*/
		const table = this.contentTable;
		const strip = list => list.map(s => s.replace(/^@/, ''));
		const usable = category => {
			const names = table.namesOf(category);
			if (names.length < length) return null;
			const slice = names.slice(0, length);
			if (slice.some(name => table.idOf(category, name) === null)) return null;
			return slice;
		};
		for (const category of ['item', 'liquid', 'unit', 'block']) {
			const names = usable(category);
			if (names) return { category: category === 'block' ? 'building' : category, names: strip(names) };
		}
		return { category: 'item', names: [] };
	}

	/**
	 * The `#pragma id` / `#pragma var` definitions of this program.
	 * @returns {import('./mindcContent.js').ContentIdTable}
	 */
	/**
	 * Whether `#pragma id(...)` was used, which forbids the `lookup` based
	 * array representation.
	 * @returns {boolean}
	 */
	get lookupUnavailable() {
		const config = this.compiler?.extraConfig?.getAttribute('optimizeOption') ?? {};
		return config.lookupUnavailable === true || this.contentTable.hasOverrides === true;
	}

	get contentTable() {
		if (!this._contentTable) {
			this._contentTable = this.compiler?.extraConfig?.getAttribute('contentTable')
				?? new ContentIdTable();
			// The generator's `Globals` is built before this point in some paths
			if (this.glob && this.glob.semantic) this.glob.semantic.contentTable = this._contentTable;
		}
		return this._contentTable;
	}

	/**
	 * Which representation an array symbol uses. Decided once and remembered.
	 *
	 * An implementation asked for with `array("...")` always wins; otherwise
	 * memory is used while there is enough of it, and when it runs out the
	 * representation with the fewest instructions is taken.
	 *
	 * @param {SymbolEntry} symbol
	 * @returns {{type: string, implement: string?, reason: string}}
	 */
	/**
	 * Why an array has to stay in memory, or `null` if it may be held in
	 * registers.
	 *
	 * @param {SymbolEntry} symbol
	 * @returns {string?}
	 */
	forcedTraditionalReason(symbol) {
		if (symbol.isVolatile) return 'a volatile array must be kept in memory';
		if (symbol.myType()?.isVolatile?.()) return 'a volatile array must be kept in memory';
		if (this.isInRecursiveFunction(symbol)) {
			return 'an array in a recursive function must be kept on the stack';
		}
		return null;
	}

	arrayStyleFor(symbol) {
		if (symbol.chosenArrayStyle) return symbol.chosenArrayStyle;
		const forced = this.forcedTraditionalReason(symbol);
		if (forced) {
			symbol.chosenArrayStyle = { type: 'traditional', implement: null, reason: forced };
			return symbol.chosenArrayStyle;
		}
		const type = symbol.myType();
		const length = this.arrayLengthOf(symbol);
		const size = (type && type.size) ? type.size : 1;
		/*
		Hand-declared ids mean the processor's own `lookup` tables may disagree
		with them, so an array is not allowed to use names as its storage.
		*/
		const lookup = this.lookupUnavailable
			? { category: 'item', names: [] }
			: this.lookupNamesOf(length);
		/*
		Declaring ids by hand makes the processor's own `lookup` tables
		untrustworthy, so an array may never use them -- not even one that asks
		for `array("embedded_lookup", ...)` outright. Such a request falls back
		to the plain register layout.
		*/
		let requested = symbol.requestedArrayImplementation ?? null;
		if (this.lookupUnavailable && requested === 'embedded_lookup') {
			requested = 'embedded';
			this.addWarning?.('lookup arrays are disabled by #pragma id; using the register layout instead');
		}
		const style = selectArrayImplementation({
			length, size,
			isConst: symbol.isConst === true,
			values: symbol.arrayInitialValues ?? null,
			availableMemory: symbol.memoryAllocationFailed ? 0 : this.remainingMemory(),
			instructionBudget: this.instructionBudget(),
			targetVersion: this.semantic.targetVersion ?? this.compiler?.config?.getAttribute('targetVersion') ?? 0,
			requested,
			lookupNames: lookup.names
		});
		symbol.chosenArrayStyle = style;
		symbol.lookupCategory = lookup.category;
		return style;
	}

	/**
	 * Build the `ArrayRet` describing an array symbol.
	 * @param {SymbolEntry} symbol
	 * @param {PointerRet} pointer Address of the first element (traditional layout)
	 * @returns {import('./mindcInfrastructure.js').ArrayRet}
	 */
	arrayRetFor(symbol, pointer) {
		const glob = this.glob;
		const style = this.arrayStyleFor(symbol);
		const type = symbol.myType();
		const length = this.arrayLengthOf(symbol);
		return arrayRetOf(glob, style, {
			pointer, type, length,
			baseName: symbol.getAssemblySymbol(),
			category: symbol.lookupCategory ?? 'item',
			names: this.lookupNamesOf(length).names,
			values: symbol.arrayInitialValues ?? new Array(length).fill(0)
		});
	}

	/**
	 * Whether the symbol is an array that is not laid out in memory.
	 *
	 * @param {SymbolEntry} symbol
	 * @returns {boolean}
	 */
	arraySymbolOfIdentifier(symbol) {
		const type = symbol?.myType?.() ?? null;
		return !!type && type.kind === 'array';
	}

	/**
	 * The array symbol a subscript is applied to, if any.
	 * @param {ASTNode} node
	 * @returns {SymbolEntry?}
	 */
	arraySymbolOf(node) {
		if (node.type !== 'Identifier') return null;
		const symbol = this.currentScope.lookup(node.name);
		if (!symbol) return null;
		const type = symbol.myType();
		if (!type || type.kind !== 'array') return null;
		if (this.arrayStyleFor(symbol).type === 'traditional') return null;
		return symbol;
	}

	resolveMemberExpression(node) {
		const glob = this.glob;
		if (node.getAttribute('stringAccess')) {
			// Special string access: read one word out of the string
			const finalSymbol = this.getTempSymbol(this.semantic.getTypeInfo('char'));
			const reading = this.operatesReads(node.children.map(child => this.visit(child)),
				this.operatesWrite(
					InstructionBuilder.read('{op_write}', '{op_r0}', '{op_r1}'), finalSymbol));
			return new BasicRet(glob, reading.instructions, reading.instructionReturn, node.dataType, true);
		}

		let objectRoot = node.children[0];	// Altered if a total offset is known
		const object = this.getLValue(objectRoot);

		// Registry struct: every member is a variable of its own, named `X.member`
		if (object instanceof RegistryStructRet) {
			return object.member(node.children[1].name, node.dataType);
		}

		/* From here on the object lives in memory and we need its address. */
		const isNearPointerHere = object.isNear === true;
		let knownTotalOffset = null;
		let index = null;
		let setup = new Instruction();

		if (node.getAttribute('computed')) {
			/*
			An array that is not laid out in memory: the elements are registers
			(or, for a constant array, a string), and the subscript picks one of
			them instead of stepping a pointer.
			*/
			const arraySymbol = this.arraySymbolOf(objectRoot);
			if (arraySymbol) {
				/*
				Hand over the WHOLE subscript value, not just its name: the name
				alone loses the instructions that computed it, so `b[i + 4]`
				would read from an uninitialised register.
				*/
				const subscript = this.visitAndRead(node.children[1]);
				const subscriptValue = ExportRet(glob, subscript,
					node.children[1].dataType ?? null);
				const element = this.arrayRetFor(arraySymbol, null).element(subscriptValue);
				element.setAttribute('isNearPointer', isNearPointerHere);
				element.setAttribute('isFromRegStruct', false);
				return element;
			}
			// Array subscript: evaluate the index first
			index = this.visitAndRead(node.children[1]);
			setup.concat(index);
		} else if (node.hasAttribute('totalSource') && node.hasAttribute('totalMemberOffset')) {
			// The semantic analyzer already folded `a.b.c` into `a` + a total offset
			objectRoot = node.getAttribute('totalSource');
			knownTotalOffset = node.getAttribute('totalMemberOffset');
		}
		const objectValue = (objectRoot === node.children[0]) ? object.get()
			: this.getLValue(objectRoot).get();
		setup.concat(objectValue);	// Deferred evaluation

		/**
		 * The address of the object itself: `get()` already made sure that a pointer
		 * stored in memory has been read out.
		 * @type {PointerRet}
		 */
		const objectAddress = (objectValue instanceof PointerRet) ? objectValue
			: new RefPointerRet(glob, [], objectValue.name, objectValue.type, objectValue.temporary);

		/**
		 * How far to move: either a constant (struct member) or `index * size`.
		 * @type {number | string}
		 */
		let step;
		if (node.getAttribute('computed')) {
			const ratio = node.dataType.size > 0 ? node.dataType.size : 1;
			if (knownTotalOffset !== null && knownTotalOffset !== undefined) {
				step = knownTotalOffset;
			} else if (ratio > 1) {
				if (node.children[1].type === 'NumericLiteral') {
					step = ratio * node.children[1].value;
				} else {
					const scaled = this.getTempVariable();
					setup.concat(InstructionBuilder.op('mul', scaled, index.instructionReturn, ratio));
					step = scaled;
				}
			} else {
				step = index.instructionReturn;
			}
		} else {
			step = knownTotalOffset ?? node.getAttribute('memberOffset');
		}

		// Moving the pointer is the only thing left to do
		const address = objectAddress.offset(step);

				// Whatever the member is, we now hold its address
		const instructions = [setup, address.instructions];
		/*
		A member that is an array / struct / union is delivered BY REFERENCE: its
		value IS the address, nothing is stored there. Returning a MemoryRefRet made
		`a.data[2]` read two words out of the array's own data and mistake them for
		the pointer it was supposed to step from.
		*/
		if (this.deliversByReference(node.dataType && node.dataType.kind)) {
			const byRef = new RefPointerRet(glob, instructions, address.name, node.dataType, true);
			byRef.setAttribute('isNearPointer', isNearPointerHere);
			byRef.setAttribute('isFromRegStruct', false);
			return byRef;
		}
		const reference = new MemoryRefRet(glob, instructions,
			address.name, node.dataType, true);
		reference.setAttribute('isNearPointer', isNearPointerHere);	// inherit the feature
		reference.setAttribute('isFromRegStruct', false);
		return reference;
	}

	/**
	 * Whether a member of the given kind is delivered "by reference" (i.e. no copy
	 * is made when it is read) instead of being read out of memory.
	 * 
	 * @param {string?} kind 
	 * @returns {boolean}
	 */
	deliversByReference(kind) {
		return ['array', 'struct', 'union'].includes(kind);
	}

	getLValue(left) {
		const glob = this.glob;
		switch (left.type) {
			case 'Identifier': {
				const identity = this.currentScope.lookup(left.name);
				if (!identity) {
					throw new InternalGenerationFailure(`Unknown variable ${left.name}`, left);
				}
				return symbolRef(glob, identity);
			}
			case 'MemberExpression': {
				if (left.getAttribute('stringAccess')) {
					throw new InternalGenerationFailure(`Strings in Mindustry-C are immutable`, left);
				}
				return this.resolveMemberExpression(left);
			}
			case 'UnaryExpression': {
				if (left.getAttribute('isDereference')) {
					// *p : the address IS the value of p
					const pointer = ExportRet(glob, this.visitAndRead(left.argument), left.argument.dataType);
					if (pointer instanceof NamePointerRet) {
						// The pointer holds a NAME, so `*p` is `read/write @this <name>`
						return pointer.slot();
					}
					if (!(pointer instanceof PointerRet)) {
						this.addWarning(`Dereferencing a non-pointer value`, left.location);
						return new MemoryRefRet(glob, pointer.instructions, pointer.name, left.dataType, false);
					}
					return new MemoryRefRet(glob, pointer.instructions, pointer.name, left.dataType, pointer.temporary);
				}
				// ++x / --x / +x ... -- the lvalue of the operand is the lvalue of the whole
				return this.getLValue(left.argument);
			}
			default: {
				const value = this.visitAndRead(left);
				if (this.compiler.config.getAttribute('regardValuesAsAddresses')) {
					this.addWarning(`Maybe not a LValue -- regarding the value as an address`, left.location);
					return ExportRet(glob, value, left.dataType);
				}
				return new ImmediateRet(glob, 'null', left.dataType);
			}
		}
	}

	/**
	 * Legacy entry point, kept for the not-yet-refactored call sites.
	 *
	 * @param {ASTNode} left
	 * @param {boolean} [returnOnlyPointer=false]
	 * @param {boolean} [traditional=false]
	 * @returns {Instruction}
	 * @deprecated Prefer `getLValue()`; this one rebuilds the old
	 * `{value_entry}` / `{pointer_block_entry}` / `{pointer_ptr_entry}` templates.
	 */
	processLValGetter(left, returnOnlyPointer = false, traditional = false) {
		const lval = this.getLValue(left);
		if (returnOnlyPointer) {
			try {
				return traditional ? lval : lval.address();
			} catch (e) {
				if (e instanceof InfrastructureNotImplementedExpection) {
					this.addError(String(e.message).replace(/^Feature not implemented in infrastructure:\s*/, ''), left);
					return new Instruction([], 'null', new Map([['disallowReplacement', true]]));
				}
				throw e;
			}
		}
		const name = lval.instructionReturn;
		const glob = this.glob;
		let result = new Instruction(lval.instructions ? [...lval.instructions] : []);
		if (lval instanceof PointerRet) {
			if (lval instanceof MemPointerRet) {
				// The pointer itself is in memory: write through its address
				result.concat(writeThrough(glob, name, '{pointer_block_entry}', 2, lval.isNear));
			} else {
				result.concat(InstructionBuilder.set(`${name}_block`, '{pointer_block_entry}'));
				result.concat(InstructionBuilder.set(`${name}_pos`, '{pointer_ptr_entry}'));
			}
			result.setAttribute('isPointer', true);
		} else if (lval instanceof MemoryRefRet) {
			result.concat(writeThrough(glob, name, '{value_entry}', lval.width, lval.isNear));
		} else {
			if (lval.width >= 2) {
				result.concat(InstructionBuilder.set(`${name}_block`, '{pointer_block_entry}'));
				result.concat(InstructionBuilder.set(`${name}_pos`, '{pointer_ptr_entry}'));
				result.setAttribute('isPointer', true);
			} else {
				result.concat(InstructionBuilder.set(name, '{value_entry}'));
			}
		}
		result.setAttribute('isAssignment', true);
		if (lval.getAttribute('isPointer')) result.setAttribute('isPointer', true);
		return result;
	}

	/**
	 * 
	 * @param {ASTNode} left The identifier shall be reserved.
	 * @param {Instruction | VariableRet} right The parameters must be pre-processed and READ.
	 * @return {Instruction}
	 * @remark We consider NORMAL ASSIGNMENT, STRUCTURAL and POINTER.
	 * @remark This process is ATOMIC.
	 */
	processAssignment(left, right, type = null) {
		const glob = this.glob;
		/**
		 * @type {VariableRet}
		 */
		const source = right instanceof VariableRet ? right
			: ExportRet(glob, right, type ?? left.dataType ?? right.dataType ?? null);
		const lval = this.getLValue(left);
		return lval.set(source);
	}

	/**
	 * 
	 * @param {FunctionCallNode} node 
	 * @throws {InternalGenerationFailure}
	 * @returns {Instruction}
	 * @todo To make it suitable for function pointer (in order of parameter...)
	 */
	/**
	 * Work out *what* is being called: a function symbol, or a value of function
	 * pointer type. Also decides whether the recursive calling protocol is needed.
	 *
	 * @param {FunctionCallNode} node
	 * @returns {{symbol: SymbolEntry?, type: TypeInfo, isFunctionPointer: boolean, recursive: boolean}}
	 */
	resolveCallee(node) {
		let symbol = node.callee ? node.callee.symbol : null;
		let type = null;
		let isFunctionPointer = true;
		let recursive = this.recursiveInfo.has(this.currentFunction);
		if (!symbol) {
			// Not a name: the callee must have a function (pointer) type
			if (node.callee.dataType && node.callee.dataType.functionTo) {
				type = node.callee.dataType.functionTo.type;
			}
			// Otherwise, be ready for failure
		} else if (symbol.kind !== 'function') {
			// A variable of function pointer type
			symbol = symbol.type.type.functionTo;
			type = symbol.myType();
			if (symbol.isAuto) {
				recursive = true;
			}
		} else {
			type = symbol.type;
			isFunctionPointer = false;
		}
		if (!type) {
			throw new InternalGenerationFailure(`Unknown function ${node.callee ? (node.callee.name ?? '<unknown-function>') : '<error-function>'}`);
		}
		return { symbol, type, isFunctionPointer, recursive };
	}

	/**
	 * Where the i-th argument has to be delivered, and under which type.
	 *
	 * @param {number} index
	 * @param {SymbolEntry?} symbol
	 * @param {TypeInfo} functionType
	 * @param {boolean} isFunctionPointer
	 * @returns {{name: string, type: TypeInfo}}
	 */
	parameterSlot(index, symbol, functionType, isFunctionPointer) {
		if (isFunctionPointer) {
			// Indirect calls pass everything through the fixed `__param_N` slots
			return {
				name: `__param_${index}`,
				type: this.compiler.semanticAnalyzer.getTypeInfo(functionType.parameters[index].type)
			};
		}
		const parameter = symbol.owningScope.lookupCurrent(functionType.parameters[index].name);
		return {
			name: parameter.getAssemblySymbol(),
			type: parameter.type.type
		};
	}

	/**
	 * Deliver one argument into its parameter slot.
	 *
	 * @param {string} slotName
	 * @param {TypeInfo} slotType
	 * @param {VariableRet} argument The already evaluated argument
	 * @returns {VariableRet}
	 */
	deliverArgument(slotName, slotType, argument) {
		const glob = this.glob;
		// `get()` + `materialize()`: the argument ends up in a temporary symbol of
		// its own, so that evaluating the *next* argument (which may call a function,
		// possibly this very one) cannot clobber it.
		const value = argument.get().materialize();
		if (value instanceof ImmediateRet) {
			// A constant cannot be renamed: write it out instead.
			if (value.width >= 2) {
				return new RefPointerRet(glob, [
					InstructionBuilder.set(`${slotName}_block`, 'null'),
					InstructionBuilder.set(`${slotName}_pos`, 'null')
				], slotName, slotType, false);
			}
			return valueClassOf(glob, slotType).create(glob,
				[InstructionBuilder.set(slotName, value.name)], slotName, slotType, false);
		}
		// Reusing the storage the argument already owns is free and avoids a copy
		const delivery = value.rename(slotName);
		if (slotType && value.type && !this.semantic.isSameType(slotType, value.type)) {
			// Types differ enough to require an explicit conversion
			delivery.concat(this.copyObject(slotName, slotName, slotType, value.type));
		}
		return delivery;
	}

	/**
	 * 
	 * @param {FunctionCallNode} node 
	 * @throws {InternalGenerationFailure}
	 * @returns {VariableRet}
	 * @remark A call is an operation with **many** operands; every argument is
	 *         therefore materialized into a temporary symbol before the next one is
	 *         evaluated (see `deliverArgument`).
	 */
	visitFunctionCall(node) {
		const glob = this.glob;
		const callee = this.resolveCallee(node);
		let result = new Instruction();
		// Warning: function pointer does NOT care about this
		if (callee.recursive) {
			result.concat(this.functionManagement.getPreservationCall(this.currentFunction));
		}

		const contentType = this.semantic.getTypeInfo('content_t');
		for (let i = 0; i < callee.type.parameters.length && i < node.arguments.length; i++) {
			const slot = this.parameterSlot(i, callee.symbol, callee.type, callee.isFunctionPointer);
			const argument = node.arguments[i];
			let value = ExportRet(glob, this.visit(argument), argument.dataType);
			if (this.semantic.isSameType(slot.type, contentType)) {
				value = value.convertTo(contentType,
					contentTypeOf(argument.dataType ? argument.dataType.name : null));
			}
			result.concat(this.deliverArgument(slot.name, slot.type, value));
		}

		// Pre-call ended. Calling
		if (callee.isFunctionPointer) {
			const calleeValue = this.visitAndRead(node.callee);
			result.concat(calleeValue);
			result.concat(this.functionManagement.getRawFunctionCall(calleeValue.instructionReturn,
				new Map(), this.currentFunction === 'main', callee.recursive ? null : this.currentFunction));
		} else {
			result.concat(this.functionManagement.getFunctionCall(
				node.callee.name, new Map(), this.memory, this.currentFunction === 'main',
				callee.recursive ? null : this.currentFunction));
		}

		// If recursive:
		// (The position will be otherwise incorrect!!!)
		if (callee.recursive) {
			// Restore all information (by rolling back and then forward)
			result.concat(this.functionManagement.getRollbackCall(this.currentFunction));
		}

		/* ---------------- the returned value ---------------- */
		if (callee.type.returnType === 'void' || node.getAttribute('disposeReturn')) {
			return result;
		}
		const returnType = this.semantic.getTypeInfo(callee.type.returnType);
		if (!returnType) {
			this.addError("Return type unclear");
			return result;
		}
		/*
		`__return` is a single global register: it is overwritten by the next call
		(and by a recursive call to the very same function), so the value has to be
		moved into a temporary symbol of its own immediately.
		*/
		const returned = this.asRet('__return', returnType);
		if (returnType.kind === 'struct' || returnType.kind === 'union') {
			// Structs are copied: memcpy for the memory layout, member-wise otherwise
			const container = this.getTempSymbol(returnType);
			if (returnType.isPointerImpl()) {
				const temporaryMemory = this.requireRValueMemory(returnType.size);
				result.setAttribute('isRValueMem', true);
				result.concat(temporaryMemory.getAssignmentInstruction(container.getAssemblySymbol()));
				result.concat(this.memory.outputMemcpyCall(container.getAssemblySymbol(),
					'__return', returnType.size, this.functionManagement));
			} else {
				result.concat(this.copyStruct(container.getAssemblySymbol(), '__return', returnType));
			}
			return valueClassOf(glob, returnType).create(glob, result.instructions,
				container.getAssemblySymbol(), returnType, true, null);
		}
		const container = this.getTempSymbol(returnType);
		const stored = returned.storeTo(container, true);
		result.concat(stored);
		return valueClassOf(glob, returnType).create(glob, result.instructions,
			stored.name, returnType, true, null);
	}

	/**
	 * 
	 * @param {IdentifierNode} node 
	 * @remark This function has a major change in Jan 31 version (no duplicate by default now).
	 * @remark Therefore, any duplicate function must have its own copy-processing!
	 */
	/**
	 * 
	 * @param {IdentifierNode} node 
	 * @returns {VariableRet}
	 * @remark Constants are returned as immediate values; variables are returned as
	 *         **already read** values (so a volatile variable ends up in a temporary
	 *         symbol rather than in a temporary register).
	 */
	visitIdentifier(node) {
		const glob = this.glob;
		const isBuiltinConstant = node.name.length && node.name[0] == '@';
		if (isBuiltinConstant) {
			// Builtin constants (@copper, @this, ...) are immediate values
			const constant = new ImmediateRet(glob, node.name.replace(/\_/g, '-'), node.dataType, true);
			if (this.compiler.extraConfig.getAttribute('defaultNumeric') && node.dataType
				&& SPECIAL_CONTENT_TYPES.includes(node.dataType.name)) {
				// Convert the content into its numeric id
				return constant.convertTo(this.semantic.getTypeInfo('int'));
			}
			return constant;
		}
		const symbol = this.currentScope.lookup(node.name);
		if (!symbol) {
			throw new InternalGenerationFailure(`Unknown identifier ${node.name}`, node);
		}
		// `get()`: go through the reference and produce the value itself
		return symbolRef(glob, symbol).get();
	}

	/**
	 * 
	 * @param {NumericLiteralNode} node 
	 */
	visitNumericLiteral(node) {
		return new Instruction([], `${node.value}`, new Map([['disallowReplacement', true]]));
	}

	/**
	 * 
	 * @param {StringLiteralNode} node 
	 */
	visitStringLiteral(node) {
		return new Instruction([], node.raw, new Map([['disallowReplacement', true]]));
	}

	visitCharacterLiteral(node) {
		return new Instruction([], `${node.raw.replace('"','\\"')}`, new Map([['disallowReplacement', true]]));
	}

	visitNullLiteral(node) {
		return new Instruction([], 'null', new Map([['disallowReplacement', true]]));
	}

	/**
	 * 
	 * @param {ASTNode} node Node for member expression
	 */
	/**
	 * 
	 * @param {ASTNode} node Node for member expression
	 * @remarks Arrays, structs and unions are delivered **by reference**: the returned
	 *          Ret is the reference itself, not a copy. Scalars (and pointers stored
	 *          in the member) are read out.
	 */
	visitMemberExpression(node) {
		const member = this.resolveMemberExpression(node);
		const kind = node.dataType ? node.dataType.kind : null;
		// Aggregates, registry struct members and string accesses are delivered by
		// reference; a scalar (or a pointer) is read out of its memory slot.
		if (node.getAttribute('stringAccess') || member.getAttribute('isFromRegStruct')
			|| (member instanceof StructRefRet) || this.deliversByReference(kind)) {
			return member;
		}
		return member.get();
	}

	/**
	 * 
	 * @param {BuiltinCallNode} node 
	 * @remarks In fact, only in this part does the program include interactions
	 */
	visitBuiltinCall(node) {

		/**
		 * 
		 * @param {string} prefix 
		 * @param {ASTNode[]} params 
		 * @param {TypeInfo | null} [hasReturnAs=null]
		 * @param {number} parameterSize 
		 * @param {boolean} [returnAtEnd=null]
		 * @returns 
		 */
		const packer = (prefix, params, hasReturnAs = null, parameterSize = -1, returnAtEnd = false) => {
			let varNames = [], vid = 0;
			let result = new Instruction(params.map(
				/**
				 * 
				 * @param {ASTNode} ast 
				 * @returns {Instruction}
				 * @remark The implicit convertor is actually hardly used!
				 */
				ast => {
					/*
					const converts = ['item_t', 'liquid_t', 'unit_t', 'block_t'];
					const referrer = typeName => typeName.slice(0, typeName.length - 2);
					let fetcher;
					// If providing device types, try it
					if (ast.dataType && converts.includes(ast.dataType.name)) {
						fetcher = this.convertInstructionForReading(this.implicitToContent(ast, referrer(ast.dataType.name)));
					} else {
						fetcher = this.visitForContent(ast);
					}
						*/
					const fetcher = this.visitForContent(ast);
					//varNames.push(fetcher.instructionReturn);
					varNames.push(`{op_r${vid++}}`);
					return fetcher;
				}
			));
			if (hasReturnAs) {
				//returner = this.getTempSymbol(hasReturnAs);//this.getTempVariable();
				//varNames.push(returner);
				if (returnAtEnd) varNames.push('{op}');
				else varNames.unshift("{op}");	// do returners!
			}
			for (let i = varNames.length; i < parameterSize; i++) {
				varNames.push('x');	// null filler
			}
			result = this.operatesReads(
				result.instructions,
				new SingleInstruction({
					content: prefix + ' ' + varNames.join(' '),
					referrer: []
				})
			);
			if (hasReturnAs && !node.getAttribute('disposeReturn')) {
				const returnSymbol = this.getTempSymbol(hasReturnAs);
				result = this.operates(result, returnSymbol);
				result.set_returns(returnSymbol);
			}
			return result;
		};

		const opProcesser = (name, params, parameterSize = 2) => {
			let varNames = [], vid = 0;
			let result = new Instruction(params.map(ast => {
				const fetcher = this.visit(ast);
				//varNames.push(fetcher.instructionReturn);
				varNames.push(`{op_r${vid++}}`);
				return fetcher;
			}));
			let returner = this.getTempSymbol();//this.getTempVariable();
			for (let i = varNames.length; i < parameterSize; i++) {
				varNames.push('x');	// null filler
			}
			result = (this.operates(
				this.operatesReads(
					result.instructions,
					new SingleInstruction({
						content: `op ${name} {op} ${varNames.join(' ')}`,
						referrer: []
					})
				), returner
			));
			result.set_returns(returner);
			return result;
		};

		const handlers = {
			end: ast => {
				return InstructionBuilder.end();
			},
			stop: ast => {
				return InstructionBuilder.stop();
			},
			print: ast => {
				let result = new Instruction();
				ast.arguments.forEach(arg => {
					const printing = this.visitForContent(arg);
					result.concat(printing);
					result.concat(InstructionBuilder.print(printing.instructionReturn));
				});
				return result;
			},
			printchar: ast => {
				let result = new Instruction();
				ast.arguments.forEach(arg => {
					const printing = this.visitForContent(arg);
					result.concat(printing);
					result.concat(InstructionBuilder.printchar(printing.instructionReturn));
				});
				return result;
			},
			format: ast => {
				let result = new Instruction();
				ast.arguments.forEach(arg => {
					const printing = this.visitForContent(arg);
					result.concat(printing);
					result.concat(InstructionBuilder.format(printing.instructionReturn));
				});
				return result;
			},
			printflush: ast => {
				return packer(`printflush`, ast.arguments);
			},
			drawflush: ast => {
				return packer(`drawflush`, ast.arguments);
			},
			getlink: ast => {
				return packer(`getlink`, ast.arguments, this.semantic.getTypeInfo('device'));
			},
			wait: ast => {
				return packer(`wait`, ast.arguments);
			},
			ubind: ast => {
				return packer(`ubind`, ast.arguments);
			},
			ucontrol: ast => {
				if (ast.arguments[0].type === 'StringLiteral') {
					return packer(`ucontrol ${ast.arguments[0].value}`, ast.arguments.slice(1), null, 5);
				} else {
					throw `Parameter 1 for ucontrol() must be string literal`
				}
			},
			ulocate: ast => {
				let result = new Instruction(), tmpRet = this.getTempVariable();
				let postConcat = new Instruction();
				if (ast.arguments[0].type === 'StringLiteral') {
					let preConcat = "", subArg1, tailPosition = 1;
					switch (ast.arguments[0].value) {
						case 'ore':
							subArg1 = this.visitForContent(ast.arguments[1]);
							tailPosition = 2;
							result.concat(subArg1);
							preConcat = `ore core true ${subArg1.instructionReturn}`;
							break;
						case 'building':
							if (ast.arguments[1].type !== 'StringLiteral') {
								throw `Parameter 2 for ulocate() must be string literal for building`;
								break;
							}
							tailPosition = 3;
							subArg1 = this.visitForContent(ast.arguments[2]);
							result.concat(subArg1);
							preConcat = `building ${ast.arguments[1].value} ${subArg1.instructionReturn} @copper`;
							break;
						case 'spawn':
							preConcat = `spawn core true @copper`;
							break;
						case 'damaged':
							preConcat = `damaged core true @copper`;
							break;
					}
					for (let i = tailPosition; i < tailPosition + 4; i++) {
						const argContent = this.visitForContent(ast.arguments[i]);
						if (argContent.getAttribute('fromCast') && ast.arguments[i].dataType.qualifiers
							&& ast.arguments[i].dataType.qualifiers.includes('volatile')) {
								preConcat += ` ${argContent.instructionReturn}`;
						} else {
							const tmpVar = this.getTempSymbol(); //this.getTempVariable();
							preConcat += ` ${tmpVar.getAssemblySymbol()}`;
							postConcat.concat(this.memory.outputPointerStorageOf(argContent.instructionReturn, tmpVar.getAssemblySymbol()));
							// postConcat.concat(InstructionBuilder.writes(tmpVar, `${argContent.instructionReturn}_block`, `${argContent.instructionReturn}_pos`));
						}
					}
					result.concat(new SingleInstruction({
						content: `ulocate ${preConcat}`,
						referrer: []
					}));
				} else {
					throw `Parameter 1 for ulocate() must be string literal`;
				}
				result.concat(postConcat);
				return result;
			},
			uradar: ast => {
				// The first 4 parameters must all be string literal
				for (let i = 0; i < 4; i++) {
					if (ast.arguments[i].type !== 'StringLiteral') {
						throw `Parameter ${i} for radar() must be a string literal`;
					}
				}
				const processSequence = ast.arguments.slice(0, 4).map(arg => arg.value).join(" ");
				return packer(`uradar ${processSequence}`, ast.arguments.slice(4), this.semantic.getTypeInfo('device'), -1, true);
			},
			draw: ast => {

				const draw_lengths = new Map([
					['clear', 4], ['color', 5], ['stroke', 2], ['line', 5], ['rect', 5],
					['lineRect', 5], ['poly', 6], ['linePoly', 6], ['triangle', 7], ['image', 6],
					['print', 4], ['translate', 3], ['scale', 3], ['rotate', 2], ['reset', 1]
				]);

				if (ast.arguments[0].type === 'StringLiteral') {
					const instruction = ast.arguments[0].value;
					if (draw_lengths.has(instruction) && draw_lengths.get(instruction) === ast.arguments.length) {
						return packer(`draw ${instruction}`, ast.arguments.slice(1), null, 6);
					} else {
						throw `Unsupported parameter 1 for draw()`;
					}
				} else {
					throw `Parameter 1 for draw() must be a string literal`;
				}

			},
			control: ast => {

				const draw_lengths = new Map([
					['enabled', 3], ['shoot', 5], ['shootp', 4], ['configure', 3],
					['color', 5]
				]);

				if (ast.arguments[0].type === 'StringLiteral') {
					const instruction = ast.arguments[0].value;
					if (draw_lengths.has(instruction) && draw_lengths.get(instruction) === ast.arguments.length) {
						return packer(`control ${instruction}`, ast.arguments.slice(1), null, 4);
					} else {
						throw `Unsupported parameter 1 for control()`;
					}
				} else {
					throw `Parameter 1 for control() must be a string literal`;
				}

			},
			radar: ast => {
				// The first 4 parameters must all be string literal
				for (let i = 0; i < 4; i++) {
					if (ast.arguments[i].type !== 'StringLiteral') {
						throw `Parameter ${i} for radar() must be a string literal`;
					}
				}
				const processSequence = ast.arguments.slice(0, 4).map(arg => arg.value).join(" ");
				return packer(`radar ${processSequence}`, ast.arguments.slice(4), this.semantic.getTypeInfo('device'), -1, true);
			},
			sensor: ast => {
				return packer(`sensor`, ast.arguments, this.semantic.getTypeInfo('null_t'));
			},
			lookup: ast => {
				if (ast.arguments[0].type === 'StringLiteral') {
					const instruction = ast.arguments[0].value;
					return packer(`lookup ${instruction}`, ast.arguments.slice(1), this.semantic.getTypeInfo('content_t'));
				} else {
					throw `Parameter 1 for lookup() must be a string literal`;
				}
				//return packer(`lookup`, ast.arguments, true);
			},
			sin: ast => {
				return opProcesser(`sin`, ast.arguments);
			},
			cos: ast => {
				return opProcesser(`cos`, ast.arguments);
			},
			tan: ast => {
				return opProcesser(`tan`, ast.arguments);
			},
			asin: ast => {
				return opProcesser(`asin`, ast.arguments);
			},
			acos: ast => {
				return opProcesser(`acos`, ast.arguments);
			},
			atan: ast => {
				return opProcesser(`atan`, ast.arguments);
			},
			adiff: ast => {
				return opProcesser(`angleDiff`, ast.arguments);
			},
			min: ast => {
				return opProcesser(`min`, ast.arguments);
			},
			max: ast => {
				return opProcesser(`max`, ast.arguments);
			},
			abs: ast => {
				return opProcesser(`abs`, ast.arguments);
			},
			ceil: ast => {
				return opProcesser(`ceil`, ast.arguments);
			},
			floor: ast => {
				return opProcesser(`floor`, ast.arguments);
			},
			sqrt: ast => {
				return opProcesser(`sqrt`, ast.arguments);
			},
			pow: ast => {
				return opProcesser('pow', ast.arguments);
			},
			rand: ast => {
				return opProcesser(`rand`, ast.arguments);
			},
			read: ast => {
				return packer('read', ast.arguments, this.semantic.getTypeInfo('null_t'), 2);
			},
			write: ast => {
				return packer('write', ast.arguments, null, 3);
			},
			asm: ast => {
				if (ast.arguments.length <= 0 || ast.arguments[0].type !== 'StringLiteral') {
					throw `Incorrect asm() call`;
				}
				return this.visitAsmStatement(ASTBuilder.asmStatement(ast.arguments[0].value));
			},
			memcpy: ast => {
				let result = new Instruction();
				const targetSpace = this.visitAndRead(ast.arguments[0]);
				const sourceSpace = this.visitAndRead(ast.arguments[1]);
				const sizeValue = this.visitAndRead(ast.arguments[2]);
				result.concat(targetSpace);
				result.concat(sourceSpace);
				result.concat(sizeValue);
				result.concat(this.memory.outputMemcpyCall(targetSpace.instructionReturn, 
					sourceSpace.instructionReturn, sizeValue.instructionReturn, this.functionManagement));
				return result;
			},
			memsp: ast => {
				let result = new Instruction();
				const returner = this.getTempVariable();
				const returningSymbol = this.getTempSymbol(this.semantic.getTypeInfo('void*'));
				const blockRef = this.visitAndRead(ast.arguments[0]);
				const posRef = this.visitAndRead(ast.arguments[1]);
				result.concat(blockRef);
				result.concat(posRef);
				result.concat(InstructionBuilder.set(`${returner}_block`, blockRef.instructionReturn));
				result.concat(InstructionBuilder.set(`${returner}_pos`, posRef.instructionReturn));
				result.concat(this.writeSymbol(returningSymbol, returner));
				result.instructionReturn = returningSymbol.getAssemblySymbol();
				result.setAttribute('isPointer', true);
				return result;
			}
		};

		if (handlers[node.functionName]) {
			try {
				return handlers[node.functionName](node);
			} catch (err) {
				this.addError(err.toString(), node.getAttribute('location'));
				return new Instruction();
			}
		}

		const extra = this.extraConfig.getAttribute('extraHandler') ?? new Map();
		if (extra.has(node.functionName)) {
			try {
				return extra.get(node.functionName)(this, node);
			} catch (err) {
				this.addError(err.toString(), node.getAttribute('location'));
				return new Instruction();
			}
		}

		this.addWarning(`Calling unimplemented builtin function ${node.functionName} function`, node.location);
		return new Instruction({
			content: '{not_implemented}',
			referrer: []
		});
	}

    // 变量管理
	// This is about 'temporary registry' I guess
	
	/**
	 * @deprecated
	 * @returns {string}
	 */
    getTempVariable() {
        // 获取临时变量名
		return '__register_' + (this.registryId++);
    }

	/**
	 * @param {string | null} [kind=null] 
	 * @param {TypeInfo | null} [type=null] 
	 * @remark Visit comes first, so the symbols will be added normally!
	 * @remark Notice: there's no "naturally-in-memory" symbol now as they are costly.
	 * @returns {SymbolEntry}
	 */
	getTempSymbol(type = null, kind = null) {
		let symbolType = type;
		if (!symbolType) {
			symbolType = this.semantic.getTypeInfo("null_t");
		}
		if (!kind) {
			kind = symbolType.kind;
		}
		const isPointer = kind === 'pointer';
		let symbol = new SymbolEntry(`__tempsym_${isPointer ? `ptr_${this.registryPointerSymbolId++}` : this.registrySymbolId++}`, symbolType, this.currentScope, kind, null, symbolType.size);

		symbol.isVirtualSymbol = true;
		// The only thing necessary is to restore them after function's exiting
		if (this.currentScope) {
			this.currentScope.addSymbol(symbol);
		}

		if (this.recursiveInfo.has(this.currentFunction)) {
			//symbol.accessThroughPointer = true;
			//symbol.needMemoryAllocation = true;
			symbol.isRecursiveSymbol = true;
			let sTarget = this.functionManagement.functionCollection.get(this.currentFunction).stackSymbols;
			/*if (!sTarget.map(symb => symb.describe()).includes(symbol.describe())) {
				sTarget.push(symbol);
			}*/
			/*
			Compare by the FULL name: `__tempsym_0` in two different block scopes
			are two different variables, and in a recursive function both have to
			be saved. Matching on the bare name made the second one invisible, so
			its value was clobbered by the nested call.
			*/
			const fullName = symbol.getAssemblySymbol();
			const sameSlot = symb => (symb.getAssemblySymbol?.() ?? symb.name) === fullName;
			const sNames = sTarget.filter(sameSlot);
			// Given that memory allocation is essential in this environment, there's no need to compare
			if (sNames.length == 0 
				|| Math.max(...sNames.map(symb => symb.size)) < symbol.size) {
				if (sNames.length > 0)
					sTarget = sTarget.filter(symb => !sameSlot(symb));
				sTarget.push(symbol);	// So the type information doesn't really matter!
			}
		}

		if (this.guaranteeTemporarySymbolReg && (symbol.accessThroughPointer || symbol.needMemoryAllocation)) {
			throw new InternalGenerationFailure(`Error in temporary symbol allocation configuration!`);
		}
		
		return symbol;
	}

	releaseTempSymbol() {
		this.registrySymbolId = 0;
		this.registryPointerSymbolId = 0;
	}

	getTempSpace() {
        // 获取临时变量名
		return '__memory_' + (this.temporarySpaceId++);
    }

	releaseTempVariable() {
		this.registryId = 0;
		this.releaseTempSymbol();
	}
    
}
