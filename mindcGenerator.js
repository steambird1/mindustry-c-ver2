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

import { ensureMemspHelper, remoteDeviceRegOf, remoteNameRegOf, RemotePointerRet, RemoteArrayRet, RemoteStoredPointerRet, LookupArrayRet, NameStructPointerRet, NameStructDerefRet,
	RemoteStructPointerRet,
	NameArrayRet, ArrayHandleRet, ensureArrayHandle, arrayLengthOfType, componentCountOf, isFlatComponentType, CATEGORY_ALIASES, Globals, VariableRet, ImmediateRet, BasicRet, IntRet, BitfieldRet, BoolRet, FloatRet, ContentRet, packHandle, HANDLE_MASK, HANDLE_FIELD_BITS,
	TraditionalArrayRet,
	PointerRet, RefPointerRet, MemPointerRet, VolatilePointerRet, MemoryRefRet, StructRefRet,
	symbolRef, ExportRet, valueClassOf, readThrough, writeThrough, pointerStep,
	RegistryStructRet, NamePointerRet, MemoryNamePointerRet,
	arrayRetOf, selectArrayImplementation, accessCostOf,
	pointerToValue, valueToPointer, contentTypeOf, SPECIAL_CONTENT_TYPES,
	arithmetic, widthOfType, knownContentIdOf, memberTypeOf, InvalidCastException, InfrastructureNotImplementedExpection,
	ENCODED_OFFSET, ENCODED_RADIX
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

/**
 * The `{line, column}` of a diagnostic, whatever the caller handed over.
 *
 * @param {any} where A location, a node that has one, a number, or null
 * @returns {{line: number, column: number}}
 */
function locationOfDiagnostic(where) {
	if (where === null || where === undefined) return { line: 0, column: 0 };
	if (typeof where === 'number') return { line: where, column: 0 };
	// A location was handed over directly
	if (typeof where.line === 'number') {
		return { line: where.line, column: (typeof where.column === 'number') ? where.column : 0 };
	}
	// Otherwise it is a node: take its own location, or the attribute one
	const candidate = (typeof where.location === 'object' && where.location)
		? where.location
		: (typeof where.getAttribute === 'function' ? where.getAttribute('location') : null);
	if (!candidate) return { line: 0, column: 0 };
	return locationOfDiagnostic(candidate);
}

export class CodeGenerator extends ASTVisitor {
	/**
	 * Record a failure.
	 *
	 * The base class takes the second argument and stores it as `line` as it
	 * is, but callers here pass a source LOCATION (and sometimes a node), so
	 * the coordinates ended up nested inside `line` instead of sitting next to
	 * `message` the way the semantic analyzer reports them. Normalize it, so
	 * that every stage produces the same shape.
	 *
	 * @param {string} message
	 * @param {any} [location] A location, a node carrying one, or nothing
	 */
	addError(message, location = null) {
		const at = locationOfDiagnostic(location);
		this.errors.push({ message, line: at.line, column: at.column });
	}

	/**
	 * Record a warning; see `addError`.
	 *
	 * @param {string} message
	 * @param {any} [location]
	 */
	addWarning(message, location = null) {
		const at = locationOfDiagnostic(location);
		this.warnings.push({ message, line: at.line, column: at.column });
	}

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
		this.switchSerial = 0;
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
		// Kept so that whole-program queries (how often an array is indexed)
		// can look at the tree while bodies are being emitted.
		this.ast = ast;
		this._subscriptCounts = new Map();
        // 将AST转换为目标代码
        let result = new Instruction(), success = true;
		try {
			let noMemory = this.compiler.config.getAttribute('noMemory');
			if (this.memory.memoryBlocks.length == 0) {
				noMemory = true;
			}
			this.heapMemoryRequired = false;
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
			/*
			`memsp` needs the link INDEX of a building. For one that is named
			directly (`auto device cell2;`) that number never changes, so find
			it here, together with the memory blocks, instead of on every call.
			*/
			this._memspDevices = this.collectMemspDevices(ast);
			// DBG
						this._memspDevices.forEach(name => {
				const symbol = this.semantic.globalScope?.lookup?.(name) ?? null;
				if (!symbol || !symbol.isAutoDevice) return;
				result.concat(this.outputDeviceLinkScan(symbol));
			});
			if (!noMemory && !this.compiler.config.getAttribute('noPointerFunction')) {
				// Only the stack frame walker gets the capacity check; ordinary pointer
			// stepping keeps the old behaviour.
			result.concat(this.memory.outputPointerForwardFunction(
				this.functionManagement, '__pointerForward', '__ptr', true, false));
				result.concat(this.memory.outputPointerBackwardFunction(this.functionManagement));
				result.concat(this.memory.outputMemcpyFunction(this.functionManagement));
			}
			/*
			Nothing is linked, yet something has to live in memory (a `volatile`
			variable, say): the generated code would read and write a block that
			does not exist, so refuse instead.
			*/
			if (noMemory && this.heapMemoryRequired) {
				this.addError('This program needs at least one memory block: some variables have to be'
					+ ' stored in memory (volatile, arrays in recursive functions, a variable whose'
					+ ' address is taken by an ordinary pointer, ...). Link a memory cell, or keep'
					+ ' such a variable out of memory: with no block linked a pointer has to hold the'
					+ ' NAME of its target, which you can ask for with #pragma optimize(pointer),'
					+ ' int *byname p, or byname(&x) (the name representation needs target v150+).');
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

			/*
			Declarations for the other processor, once, before main runs.
			*/
			result.concat(this.emitRemoteDeclarations());
			if (mainSymbol) {
				result.concat(this.functionManagement.getFunctionCall('main', new Map(), this.memory, true));
			} else {
				this.addWarning('No main function in program');
			}
		} catch (error) {
			success = false;
			this.addError(`Internal parser error: ${error.message}\n${error.stack ?? new Error().stack}`);
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
	 * Whether a pointer to this struct may carry member NAMES rather than an
	 * address. Enabled by `#pragma optimize(struct_pointer[, n])`; `n` limits
	 * how many registers the packet may take.
	 *
	 * @param {TypeInfo?} type The struct type
	 * @returns {boolean}
	 */
	structNamePointerAllowed(type = null) {
		if (!type || !type.isTypeInfo) return false;
		/*
		Only a struct or a union has MEMBERS to carry by name. Without this a
		pointer to a plain `int` qualified too: `(type.members ?? []).every(...)`
		is vacuously true for an empty list, so `int *ss = byname(&c)` was given
		a struct name packet instead of a name pointer -- and writing through it
		then did nothing at all.
		*/
		if (type.kind !== 'struct' && type.kind !== 'union') return false;
		const version = (this.semantic.targetVersion ?? this.compiler?.config?.getAttribute('targetVersion') ?? 0);
		if (version < 150) return false;
		const config = this.compiler?.extraConfig?.getAttribute('optimizeOption') ?? {};
		if (config.doStructPointerOptimize !== true) return false;
		/*
		Only a FLAT struct can be carried this way: a member that is itself a
		struct has no single register name to store.
		*/
		if (!(type.members ?? []).every(m => isFlatComponentType(m.type ?? m.memberType))) return false;
		const count = componentCountOf(type);
		/*
		No number given: 4 registers when a memory block exists (so a big
		struct still has somewhere to go), unbounded when none does.
		*/
		const given = config.structPointerThreshold;
		const limit = (typeof given === 'number') ? given
			: ((this.memory?.memoryBlocks?.length ?? 0) > 0 ? 4 : Infinity);
		return count <= limit;
	}

	/*
	Whether pointers that store the NAME of their target are in use.

	They need `read`/`write @this <name>`, which only exists from v150 on, and
	they are never used implicitly: the user has to ask for them, either with
	`#pragma optimize(pointer)` (which makes every eligible pointer a name
	pointer) or explicitly, per pointer, with `int *byname p`, `p = byname(&x)`
	or a `byname` parameter.

	`symbol` is the pointer when the question is about one particular pointer.
	`forcedNamePointer` is set on the two ends of an explicit request -- on the
	pointer that is declared `*byname`, and on the target of `byname(&x)` -- so
	passing either of them answers "yes, the user asked".
	*/
	namePointerAllowed(symbol = null) {
		const version = (this.semantic.targetVersion ?? this.compiler?.config?.getAttribute('targetVersion') ?? 0);
		if (symbol && symbol.forcedNamePointer === true) return version >= 150;
		const config = this.compiler?.extraConfig?.getAttribute('optimizeOption') ?? {};
		if (config.doPointerOptimize !== true) return false;
		return version >= 150;
	}

	/**
	 * Whether the symbol's function is recursive. Everything local to one has to
	 * live in memory.
	 * @param {SymbolEntry} symbol
	 * @returns {boolean}
	 */
	isInRecursiveFunction(symbol) {
		if (symbol.isStatic || symbol.isPersistent) return false;
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
		/*
		`namePointersOnly` is written by the name pointer analysis, which is the
		one place that decides the representation: it has already refused a
		program that asks for a name it cannot have, and it needs v150, so it is
		read here rather than re-derived. `forcedNamePointer` covers a target
		named by an explicit `byname(&x)` whose pointer is not a variable of this
		scope.
		*/
		let addressedByName = symbol.namePointersOnly === true
			|| (symbol.forcedNamePointer === true && this.namePointerAllowed(symbol));
		/*
		A `register` struct reached through a name packet: the pointer holds
		member names, so the struct itself never needs an address. If the
		packet is not allowed here (too wide for the threshold, or no
		`struct_pointer`), fall back to the ordinary memory representation
		rather than leaving a struct in registers that has no address.
		*/
		if (symbol.addressedByName === true) {
			if (isStructLike && !this.structNamePointerAllowed(type)) {
				symbol.addressedByName = false;
			} else {
				addressedByName = true;
			}
		}
		/*
		`&x` used as a builtin OUTPUT parameter: the machine instruction takes
		the name of the register, so x needs no memory -- at any version, with or
		without the name pointer pragma. (See SemanticOptimizer.analyzeNamePointers.)
		*/
		/*
		How the address of this variable is taken decides whether it really has
		to live in memory (see SemanticAnalyzer.collectAddressUses):
		  - only by `ulocate` / `ucontrol`, which take register NAMES: no memory
		    needed, at any version;
		  - also by a pointer: memory is needed unless every such pointer keeps
		    names (or is never used), which the analysis records on the pointer
		    itself -- asking again here is what let the two disagree.
		*/
		const addressUses = this.semantic?.addressUseTable?.get(symbol.getAssemblySymbol?.() ?? symbol.name) ?? null;
		const pointerTakers = [...(addressUses?.pointers ?? [])]
			.map(name => this.currentScope?.lookup?.(name) ?? this.semantic?.globalScope?.lookup?.(name) ?? null);
		const onlyBuiltinOutputs = !!addressUses && addressUses.other === 0
			&& addressUses.pointers.size === 0 && addressUses.builtin > 0;
		/*
		Every pointer that takes `&x` has to really HOLD A NAME. A pointer the
		analysis refused (because it is stepped, indexed, or otherwise needs a
		real address) leaves `usesNamePointer` unset -- and taking its silence
		for consent made x stay in a register while the pointer read it as a
		pair of block/offset registers that were never assigned.
		*/
		const takenByNamePointers = !!addressUses && addressUses.other === 0
			&& addressUses.pointers.size > 0
			&& pointerTakers.length > 0
			&& pointerTakers.every(p => p !== null && p.usesNamePointer === true);
		const addressedAsOutput = symbol.addressedAsBuiltinOutput === true
			|| onlyBuiltinOutputs || takenByNamePointers;
		/*
		A struct whose very DEFINITION demands memory -- it embeds an array, or
		another such struct -- can never be a group of registers, so it is forced
		into memory regardless of how it is used. (`&s` sets the same flag on a
		copy of the type, see `SemanticAnalyzer.memoryVariantOf`.)
		*/
		const structDemandsMemory = isStructLike
			&& !!(type && typeof type.isStrictPointerImpl === 'function' && type.isStrictPointerImpl());
		const forced = ctx.mustAlloc || recursive || symbol.isVolatile || structDemandsMemory
			|| (symbol.isAddressed && !addressedByName && !addressedAsOutput);

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
		const staysInRegister = !forced && (addressedByName || addressedAsOutput);

		if (staysInRegister) {
			symbol.accessThroughPointer = false;
			symbol.needMemoryAllocation = false;
			/*
			Tell the value classes that `&x` is the NAME of x: a name pointer
			storing it, or a builtin output parameter, never asked for a real
			address. Without this, `int *p = &x;` would demand one.
			*/
			if (!symbol.namePointersOnly && (onlyBuiltinOutputs || takenByNamePointers)) {
				symbol.namePointersOnly = true;
			}
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
					const immediate = !ctx.staticAllocOnly || symbol.isStatic || symbol.isPersistent || symbol.isVirtualSymbol;
					if (immediate) symbol.memberHandler = { stackSymbols, regStructMem };
					break;
				}
				case 'device':
				case 'null':
				case 'null_t':
					if (symbol.isAutoDevice) {
						symbol.implementAsPointer = false;
					} else if (staysInRegister) {
						/*
						`&d` handed to a builtin: the device keeps its register
						and is named by it, so it is not stored in memory after
						all -- which it could not be anyway.
						*/
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
					/*
					An unbound handle (`int a[];` with no initializer) is ONE
					register: the cell that will hold a packed handle once `a = b;`
					binds it. `type.size` is NaN while the length is open, and the
					cell has no address -- so keep it as the single register it
					takes, with no memory allocation. Only a forced memory context
					(recursive function, `volatile`, or an address that cannot be
					taken by name) could not represent that, so it is refused
					instead of emitting code that reads a register nobody fills.
					*/
					if (symbol.isUnboundHandle === true) {
						if (forced || selfVolatile) {
							this.addError(
								`An unbound handle lives in one register: it cannot survive a ` +
								`recursive call or a volatile block. Bind '${symbol.name}' before ` +
								`the recursion instead`, symbol.location);
							break;
						}
						symbol.size = 1;
						symbol.implementAsPointer = true;
						symbol.needMemoryAllocation = false;
						break;
					}
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

		const immediate = !ctx.staticAllocOnly || symbol.isStatic || symbol.isPersistent || symbol.isVirtualSymbol;
		if (!immediate) {
			/*
			The allocation is deferred to the top of the function call. Note it
			anyway: with no memory block linked at all the later attempt cannot
			succeed either, and the program has to be rejected.
			*/
			if (!this.canDegradeToRegisters(symbol)) this.heapMemoryRequired = true;
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
				this.heapMemoryRequired = true;
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
	 * Whether this symbol may be held in registers when there is no memory left.
	 *
	 * Only an array has such a form: its elements become registers of their own
	 * (see `arrayStyleFor`). For anything else "no memory" means the program
	 * cannot be represented at all, and the caller has to say so. Answering
	 * `true` for every ordinary value here is what hid the problem -- a `&x`
	 * that had nowhere to live was quietly treated as a name, and the emitted
	 * `getlink <p>_block` read a register nothing had ever written.
	 *
	 * Not for a `volatile` array (it has to be in memory by definition), and not
	 * inside a recursive function (a register would be overwritten by the nested
	 * call, and the layout needs a slot per activation anyway).
	 *
	 * @param {SymbolEntry} symbol
	 * @returns {boolean}
	 */
	canDegradeToRegisters(symbol) {
		/*
		A variable whose address is never formed does not need memory, whatever
		its type. The name pointer analysis works that out: it is the only place
		that knows who takes the address of what, and it marks such a variable
		`namePointersOnly`. `remote int *p = &rs;` is the case that matters --
		the pointer is a (processor, name) pair, so `rs` is never addressed here
		and refusing to build a program that needs no memory was wrong.
		*/
		if (symbol?.namePointersOnly === true) return true;
		const kind = (symbol.myType?.() ?? null)?.kind ?? null;
		if (kind !== 'array') return false;
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

	/*
	A switch is BREAKABLE but not CONTINUABLE: save only the break stack, so
	`continue` inside a switch still reaches the enclosing loop.
	*/
	enterSwitch() {
		this.breakStack.push(this.currentBreaks);
		this.currentBreaks = [];
	}

	exitSwitch() {
		this.currentBreaks = this.breakStack.pop();
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
	/**
	 * The register a builtin should write its result into, when the argument
	 * is `&x` and x is allowed to stay a register.
	 *
	 * `ulocate` / `ucontrol` take their output parameters as plain register
	 * names, so a name pointer can name the register directly. Anything else
	 * (a variable that really lives in memory) is left to the caller.
	 *
	 * @param {ASTNode?} node
	 * @returns {string?} the register name, or null when this is not one
	 */
	builtinOutputName(node) {
		if (!node || node.type !== 'UnaryExpression' || node.operator !== '&') return null;
		const argument = node.argument;
		if (!argument || argument.type !== 'Identifier') return null;
		const scope = this.currentScope ?? this.semantic?.globalScope ?? null;
		const symbol = scope?.lookup?.(argument.name) ?? null;
		if (!symbol) return null;
		/*
		Only a variable that really kept its register can be named. One that
		ended up in memory (volatile, recursive, ...) has to be written through
		its address instead, which the caller does.
		*/
		const namedByPointer = symbol.namePointersOnly === true && this.namePointerAllowed();
		if (symbol.addressedAsBuiltinOutput !== true && !namedByPointer) return null;
		if (symbol.accessThroughPointer || symbol.needMemoryAllocation) return null;
		return symbol.getAssemblySymbol();
	}

	/**
	 * The old name of `writeSymbol`, still called from the builtin handlers in
	 * mindc.js (pdcreate / pdread).
	 *
	 * @param {SymbolEntry} symbol
	 * @param {any} source
	 * @returns {Instruction}
	 */
	generateSymbolWrite(symbol, source) {
		return this.writeSymbol(symbol, source);
	}

	writeSymbol(symbol, source) {
		const target = symbolRef(this.glob, symbol);
		/*
		A name-based struct pointer: what has to be stored is the SET OF NAMES,
		which only the pointer value itself can produce. Hand it over as a
		value, not as a bare register name.
		*/
		if (target instanceof NameStructPointerRet && !(source instanceof VariableRet)) {
			return target.set(new ImmediateRet(this.glob, String(source), symbol.myType()));
		}
		/*
		A (processor, name) pair cannot be stored in an ordinary pointer: that
		one is (block, offset), and the block half would be read as a building
		number that was never assigned.
		*/
		if (source instanceof RemotePointerRet && !(target instanceof RemotePointerRet)) {
			this.addError(`A pointer to a 'remote' variable cannot be stored in an `
				+ `ordinary pointer: declare it 'remote int *'`,
				symbol.location ?? null);
			return new Instruction([]);
		}
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
		/**
		 * All functions must exist in the function registerer BEFORE any body is
		 * visited: a definition may follow `main` (especially when a prototype
		 * made the call legal), and a call needs a target entry.
		 */
		const functionPlans = [];
		node.functions.forEach(func => {
			//result.concat();
			// A prototype has a symbol but no body to emit.
			if (!func.body) return;
			// Check the scope that this function owns
			const funcSymbol = this.currentScope.lookup(func.name);
			/*
			Inlined into every caller and then dropped: nothing is left to
			emit. (The body already travelled into those callers.)
			*/
			if (!funcSymbol) return;
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
					if ((symbol.accessThroughPointer || symbol.needMemoryAllocation) && !(symbol.isStatic || symbol.isPersistent)) {
						stackSymbols.push(symbol);
					}
			});
			const { stackSymbols: extraSymbols, singular, regStructMem } = this.handleStructExtra(currentSymbols);
			stackSymbols = [...stackSymbols, ...extraSymbols];
			this.functionManagement.addFunction(func.name, new Instruction(), funcSymbol.owningScope, stackSymbols, func.name === 'main', this.recursiveInfo.has(func.name));
			functionPlans.push({ func, singular });
		});
		functionPlans.forEach(({ func, singular }) => {
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
			/*
			`static` is run-local in this dialect: its initialization guard is
			reset at the start of every run. `persistent` keeps its guard, so it
			initializes only once for the processor lifetime.
			*/
			if (symbol.isStatic) {
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
								if (member.isBitfield === true) return new Instruction();
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
							if (member.isBitfield === true) return new Instruction();
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
					member => {
						if (member.isBitfield === true) return new Instruction();
						/*
						A member that carries a NAME is one word, not a
						block/offset pair. Copying it as a pointer wrote
						`target.m_block` / `target.m_pos` -- two registers that
						were never assigned -- and the copy then read through
						them, which is why a struct handed over by value lost
						the representation its members were chosen for.
						*/
						if (member.namePointer === true) {
							return InstructionBuilder.set(`${target}.${member.name}`,
								`${source}.${member.name}`);
						}
						return this.copyObject(`${target}.${member.name}`,
							`${source}.${member.name}`, member.type, null, false);
					}
				)
			);
		}
		
	}
	
	/**
	 * Store a registry-struct initializer value straight into a GLOBAL struct's
	 * data cells.
	 * 
	 * A global declarator's copy runs at boot, BEFORE the function machinery
	 * has run, so the member walk of `copyStruct` -- which calls
	 * `__pointerForward` -- reads a register that is still 0 and jumps back to
	 * the start of the program (step limit). The cells are compile-time known:
	 * `X.__pointer` (`extraMemoryLocation`) is the data base every member read
	 * goes through, so each member is written directly -- exactly like the
	 * array initializer list stores its elements.
	 * 
	 * Only flat scalar members of a registry-VALUED list (`isStructRet`)
	 * reach here; a bigger struct is assembled in memory by its own list and
	 * is never copied by the declarator at all.
	 * 
	 * @param {SymbolEntry} symbol
	 * @param {string} source Name whose `.<member>` registers hold the value
	 * @param {number} [memberLimit] How many members the list assigned
	 * @returns {Instruction}
	 */
	staticStructStores(symbol, source, memberLimit = Infinity) {
		const result = new Instruction();
		const type = symbol.myType();
		const base = symbol.extraMemoryLocation;
		const flat = (type.members ?? []).every(member => {
			const kind = member.type?.kind ?? null;
			return !(kind === 'struct' || kind === 'union'
				|| kind === 'array' || kind === 'pointer');
		});
		if (!flat) {
			/*
			A shape this path does not model: hand it to the old walk. A global
			declarator only builds a REGISTRY value (`isStructRet`) for the flat
			shapes, so anything else is unreachable in practice.
			*/
			return this.copyStruct(symbol.getAssemblySymbol(), source, type, null);
		}
		for (let i = 0; i < type.members.length && i < memberLimit; i++) {
			const member = type.members[i];
			result.concat(this.memory.outputStorageOf(
				base.duplicate().forwarding(member.offset), `${source}.${member.name}`));
		}
		return result;
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
				/*
				An array parameter that takes a HANDLE: what arrives is ONE
				packed register. Copying `_block` / `_pos` (which `writeSymbol`
				would do) leaves them undefined, and the first access then jumps
				through a register that is still 0 -- an endless loop.
				*/
				if (sym.myType?.()?.kind === 'array'
					&& sym.arrayParamRep === 'handle') {
					const base = sym.getAssemblySymbol();
					return [InstructionBuilder.set(base, paramName)];
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
		if (this.targetVersion >= 152
			&& this.isCheapAndPure(node.consequent)
			&& this.isCheapAndPure(node.alternate)) {
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
	/**
	 * `switch (disc) { case ...: ... }`
	 *
	 * The flat body is a list of statements with `CaseClause` markers. The
	 * dispatch compares the discriminant once and jumps to the matching
	 * marker; the statements are emitted in source order, so fallthrough is
	 * the natural order. `break` targets the end (a switch-local break stack),
	 * while `continue` is left to the enclosing loop.
	 *
	 * @param {SwitchStatementNode} node
	 */
	visitSwitchStatement(node) {
		const disc = this.visitAndRead(node.discriminant);
		const discReg = disc.instructionReturn;
		const serial = ++this.switchSerial;
		const result = new Instruction();
		result.concat(disc);

		/*
		The body is one block scope (C's rule). The case statements are emitted
		here rather than through `visitCompoundStatement`, so the scope has to
		be entered explicitly -- otherwise a declaration at the switch's flat
		level is invisible to a case that uses it.
		*/
		const previousScope = this.currentScope;
		if (node.body?.scope) this.currentScope = node.body.scope;

		this.enterSwitch();

		const statements = node.body?.statements ?? [];
		const labels = new Map();
		const caseByValue = new Map();
		let fallbackNode = null;
		let testCaseCount = 0;
		let index = 0;
		for (const stmt of statements) {
			if (stmt.type !== 'CaseClause') continue;
			const label = `case_${serial}_${index++}`;
			labels.set(stmt, label);
			if (stmt.test) {
				testCaseCount++;
				caseByValue.set(Number(stmt.getAttribute('caseValue')), stmt);
			} else {
				fallbackNode = stmt;
			}
		}
		const fallback = fallbackNode ? labels.get(fallbackNode) : 'switch_end';

		/*
		Every jump into a case ends up as an InstructionReferrer placed at the
		case's label. The table path also puts referrers there: each one writes
		the final line number, digit by digit, into the string table used by a
		`read`. Keeping both paths in `pending` makes the body loop unaware of
		which dispatch was chosen.
		*/
		const pending = new Map();
		const addPending = (label, item) => {
			let list = pending.get(label);
			if (!list) {
				list = [];
				pending.set(label, list);
			}
			list.push(item);
		};
		const flushPending = label => {
			for (const item of pending.get(label) ?? []) {
				result.concat(new InstructionReferrer(item.towards, item.name, 0, item.transmission));
			}
		};

		const table = this.planSwitchTable(testCaseCount, [...caseByValue.keys()], caseByValue.size);
		const dispatch = new Instruction();
		if (table) {
			/*
			An encoded jump table. The case targets are line numbers, so they
			cannot be written down until the final layout is known. Each digit
			plane is a string of placeholders; the referrer placed at a case
			encodes that (now known) line as one base-57 character. `read` pulls
			a character back out in one instruction and Horner rebuilds the
			address. No memory block and no per-case instruction are needed.
			*/
			const idxReg = `__switch_idx_${serial}`;
			const tgtReg = `__switch_tgt_${serial}`;
			const digitReg = `__switch_digit_${serial}`;
			const readByK = new Map();
			for (let k = table.digits - 1; k >= 0; k--) {
				const cells = [];
				for (let i = 0; i < table.range; i++) {
					cells.push(`{__switch_cell_${serial}_${k}_${i}}`);
				}
				const dest = (k === table.digits - 1) ? tgtReg : digitReg;
				readByK.set(k, InstructionBuilder.read(dest, `"${cells.join('')}"`, idxReg));
			}

			dispatch.concat(InstructionBuilder.op('sub', idxReg, discReg, String(table.min)));
			const lowEdge = InstructionBuilder.jump(`{${fallback}}`, 'lessThan', idxReg, '0');
			const highEdge = InstructionBuilder.jump(`{${fallback}}`, 'greaterThan', idxReg, String(table.range - 1));
			dispatch.concat(lowEdge);
			dispatch.concat(highEdge);
			addPending(fallback, { towards: lowEdge, name: fallback, transmission: null });
			addPending(fallback, { towards: highEdge, name: fallback, transmission: null });

			for (let k = table.digits - 1; k >= 0; k--) {
				dispatch.concat(readByK.get(k));
				if (k !== table.digits - 1) {
					dispatch.concat(InstructionBuilder.op('mul', tgtReg, tgtReg, String(ENCODED_RADIX)));
					dispatch.concat(InstructionBuilder.op('add', tgtReg, tgtReg, digitReg));
				}
			}
			dispatch.concat(InstructionBuilder.op('sub', tgtReg, tgtReg, String(table.correction)));
			dispatch.concat(InstructionBuilder.set('@counter', tgtReg));

			for (let i = 0; i < table.range; i++) {
				const caseNode = caseByValue.get(table.min + i);
				const target = caseNode ? labels.get(caseNode) : fallback;
				for (let k = 0; k < table.digits; k++) {
					addPending(target, {
						towards: readByK.get(k),
						name: `__switch_cell_${serial}_${k}_${i}`,
						transmission: this.switchTableTransmission(k, table.digits)
					});
				}
			}
		} else {
			for (const stmt of statements) {
				if (stmt.type !== 'CaseClause' || !stmt.test) continue;
				const label = labels.get(stmt);
				const jumper = InstructionBuilder.jump(`{${label}}`, 'equal', discReg, String(stmt.getAttribute('caseValue')));
				dispatch.concat(jumper);
				addPending(label, { towards: jumper, name: label, transmission: null });
			}
			const fallbackJumper = InstructionBuilder.jump(`{${fallback}}`, 'always');
			dispatch.concat(fallbackJumper);
			addPending(fallback, { towards: fallbackJumper, name: fallback, transmission: null });
		}
		result.concat(dispatch);

		for (const stmt of statements) {
			if (stmt.type === 'CaseClause') {
				flushPending(labels.get(stmt));
				continue;
			}
			result.concat(this.visit(stmt));
		}
		if (fallback === 'switch_end') flushPending('switch_end');

		this.currentBreaks.forEach(breaks => result.concat(new InstructionReferrer(breaks, 'loop_break')));
		this.exitSwitch();
		this.currentScope = previousScope;
		return result;
	}

	/**
	 * Whether a `switch` should use the encoded jump table, and with how many
	 * base-57 digits.
	 *
	 * The table stores target line numbers, so a single character is enough
	 * only for tiny programs: two digits cover 0..3248, well above the default
	 * 1000-instruction budget. Sparse ranges and old target versions keep the
	 * comparison chain.
	 *
	 * @param {number} caseCount number of non-default case labels
	 * @param {number[]} values unique case values
	 * @param {number} uniqueCount `values.length`, passed to detect duplicates
	 * @returns {?{min: number, max: number, range: number, digits: number, correction: number}}
	 */
	planSwitchTable(caseCount, values, uniqueCount = values.length) {
		if ((this.targetVersion ?? 0) < 150) return null;
		const config = this.compiler?.extraConfig?.getAttribute('optimizeOption') ?? {};
		if (config.switchTableMode === 'off') return null;
		const forced = config.switchTableMode === 'on';
		if (!forced && caseCount < 8) return null;
		if (caseCount <= 0 || uniqueCount !== caseCount) return null;
		if (!values.length || values.some(v => !Number.isInteger(v) || !Number.isSafeInteger(v))) return null;

		let min = Infinity, max = -Infinity;
		for (const v of values) {
			if (v < min) min = v;
			if (v > max) max = v;
		}
		const range = max - min + 1;
		if (!Number.isSafeInteger(range) || range <= 0) return null;
		const configuredMax = Number(config.switchTableMax);
		const rangeLimit = (forced && Number.isFinite(configuredMax) && configuredMax > 0)
			? configuredMax : 256;
		if (range > rangeLimit) return null;
		if (!forced && range > 2 * caseCount + 8) return null;

		const budget = Math.max(2, (this.instructionBudget() || 0) + 1);
		const digits = Math.max(2, Math.ceil(Math.log(budget) / Math.log(ENCODED_RADIX)));
		if (!Number.isFinite(digits) || digits > 3) return null;
		let spanSum = 0;
		for (let k = 0; k < digits; k++) spanSum += Math.pow(ENCODED_RADIX, k);
		return { min, max, range, digits, correction: ENCODED_OFFSET * spanSum };
	}

	/**
	 * The referrer transmission that turns a final line number into one
	 * base-57 character for digit plane `k`.
	 *
	 * A single character is returned on purpose: `Instruction.raw_replace`
	 * uses a string replacement, where a two-character value could contain
	 * `$&`, `$$` or `$'`; a lone `$` is literal. The encoded character set
	 * (35..91) contains `$`, so this is not theoretical.
	 *
	 * @param {number} k digit plane, 0 is least significant
	 * @param {number} digits total planes
	 * @returns {(position: number) => string}
	 */
	switchTableTransmission(k, digits) {
		const limit = Math.pow(ENCODED_RADIX, digits);
		const power = Math.pow(ENCODED_RADIX, k);
		return position => {
			if (!Number.isSafeInteger(position) || position < 0 || position >= limit) {
				throw new InternalGenerationFailure(
					`switch jump table address ${position} does not fit in ${digits} base-${ENCODED_RADIX} digits`);
			}
			const digit = Math.floor(position / power) % ENCODED_RADIX;
			return String.fromCharCode(ENCODED_OFFSET + digit);
		};
	}

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
	 * `do body while (test);` -- the body runs first, then the test decides
	 * whether to go round again.
	 *
	 * The loop-back jump targets the BODY start (a `while` targets the test),
	 * and `continue` targets the TEST: in C a `continue` in a do-while
	 * evaluates the condition before the next iteration.
	 *
	 * @param {DoWhileStatementNode} node
	 */
	visitDoWhileStatement(node) {
		this.enterLoop();
		const body = node.body ? this.visit(node.body) : new Instruction();
		const tester = this.visitToCondition(node.test, true);
		const conditBreak = InstructionBuilder.jumpx('{loop_break}', tester.instructionReturn);
		this.currentBreaks.push(conditBreak);
		const backJumper = InstructionBuilder.jump('{goto_body}', 'always', null, null);
		const result = new Instruction();
		/*
		The zero-size referrer at the body start is the target of the loop-back
		jump. The `continue` referrers sit between the body and the test, so
		they re-evaluate the condition -- exactly where C puts them.
		*/
		result.concat(new InstructionReferrer(backJumper, 'goto_body'));
		result.concat(body);
		this.currentContinues.forEach(conts => {
			result.concat(new InstructionReferrer(conts, 'loop_continue'));
		});
		result.concat(tester);
		result.concat(conditBreak);
		result.concat(backJumper);
		this.currentBreaks.forEach(breaks => {
			result.concat(new InstructionReferrer(breaks, 'loop_break'));
		});
		this.exitLoop();
		return result;
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
	/**
	 * Names that the OTHER processor may ask for, but that nothing in this
	 * program ever writes -- so no instruction of ours would ever declare them.
	 *
	 * In mlog a name only becomes a variable once some instruction uses it, and
	 * `read` / `write` on a processor refuse names that were never declared.
	 * These are therefore declared explicitly:
	 *
	 *   - `extern` variables (they are this program's exports);
	 *   - the elements of an array that was given no initial values, when the
	 *     array lives in registers (a memory array is written by its own
	 *     initialisation, or is genuinely uninitialised anyway).
	 *
	 * `remote` variables are skipped: they are imports, not exports.
	 *
	 * @returns {string[]}
	 */
	collectRemoteExportedNames() {
		const names = [];
		const seen = new Set();
		const push = name => {
			if (!name || seen.has(name)) return;
			seen.add(name);
			names.push(name);
		};
		const scope = this.semantic?.globalScope ?? null;
		if (!scope) return names;
		for (const symbol of scope.recursivelyGetAllSymbols()) {
			if (symbol.kind !== 'variable') continue;
			if (symbol.isRemote) continue;			// an import
			const type = symbol.myType?.() ?? null;
			const isArray = !!type && type.kind === 'array';
			/*
			An `extern` array is exported ELEMENT BY ELEMENT -- the other
			processor names its elements one by one, so those are the registers
			that have to exist, not the array's own name (a register array has
			no register of its own at all).
			*/
			if (symbol.isExtern && !isArray) {
				/*
				An exported POINTER is TWO registers over there (`qq_block` and
				`qq_pos`) -- that pair is exactly what `int *remote` reads back,
				so those two names are the ones that have to be declared. The
				pointer's own name alone would leave the other processor reading
				registers that do not exist.
				*/
				if (type && type.kind === 'pointer') {
					push(`${symbol.getAssemblySymbol()}_block`);
					push(`${symbol.getAssemblySymbol()}_pos`);
				} else {
					push(symbol.getAssemblySymbol());
				}
				continue;
			}
			if (!isArray) continue;
			/*
			A `remote` array is only a binding: what has to be declared are the
			registers on the OTHER side, and those are declared by the program
			that owns them (or, for `remote(@this, x)`, by the `extern` entry of
			`x` itself).
			*/
			if (symbol.isRemote) continue;
			if (!symbol.isExtern && symbol.arrayInitialValues && symbol.arrayInitialValues.length) continue;
			const style = this.arrayStyleFor?.(symbol) ?? null;
			if (!symbol.isExtern && (!style || style.type === 'traditional')) continue;
			const length = this.arrayLengthOf?.(symbol) ?? arrayLengthOfType(type);
			const assembly = symbol.getAssemblySymbol();
			if (style && style.implement === 'lookup') {
				/*
				The elements are not named after the array at all -- they are named
				after CONTENT constants (`copper`, `lead`, ...), which is exactly
				what the other processor reads. Those are the names that have to be
				declared, and the array's own name says nothing about them.
				*/
				for (const name of this.lookupNamesOf(length, {}, symbol).names) push(name);
				continue;
			}
			for (let i = 0; i < length; i++) push(`${assembly}_${i}`);
		}
		return names;
	}

	/**
	 * Declare the exported names with `draw triangle` (six at a time) and throw
	 * the drawing away with `drawflush null`.
	 *
	 * @returns {Instruction}
	 */
	emitRemoteDeclarations() {
		const result = new Instruction();
		const names = this.collectRemoteExportedNames();
		if (names.length === 0) return result;
		const skip = InstructionBuilder.jump('{decl_end}', 'equal', '__remdeclared', '1');
		result.concat(skip);
		for (let i = 0; i < names.length; i += 6) {
			result.concat(InstructionBuilder.drawTriangle(names.slice(i, i + 6)));
		}
		result.concat(InstructionBuilder.set('__remdeclared', '1'));
		result.concat(new InstructionReferrer(skip, 'decl_end'));
		result.concat(InstructionBuilder.drawflush('null'));
		return result;
	}

	/**
	 * Emit `X__rdev = <processor>` and `X__rnm = "<name>"`, the two registers
	 * that every access to a `remote` variable goes through.
	 *
	 * @param {SymbolEntry} symbol
	 * @returns {Instruction}
	 */
	emitRemoteBinding(symbol, node = null) {
		const result = new Instruction();
		const key = symbol.getAssemblySymbol();
		const already = this._remoteBindings ?? (this._remoteBindings = new Set());
		if (already.has(key)) return result;
		already.add(key);
		const deviceReg = remoteDeviceRegOf(key);
		const nameReg = remoteNameRegOf(key);
		const remoteName = symbol.remoteName
			?? (symbol.remoteTarget ? symbol.remoteTarget.getAssemblySymbol() : null);
		/*
		`remote int *p = &rs;` and `remote int rs2 = remote(p, c);` may have no
		device of their own: then the binding is copied from the other side
		later, and all that is needed here is that the registers exist.
		*/
		if (symbol.remoteDevice) {
			const device = this.visitAndRead(symbol.remoteDevice);
			result.concat(device);
			result.concat(InstructionBuilder.set(deviceReg, device.instructionReturn));
			if (remoteName) {
				result.concat(InstructionBuilder.set(nameReg, `"${remoteName}"`));
			}
			/*
			A pointer to a struct carries the NAME OF EVERY MEMBER, not one name
			for the whole struct: `p->x` reads `<device> p.x`, and `p.x` has to
			hold "<target>.x". There is no run time string concatenation, so the
			full member names have to be built here, at compile time.
			*/
			const pointee = symbol.myType?.()?.pointerTo ?? null;
			if (pointee && ['struct', 'union'].includes(pointee.kind)
				&& this.structNamePointerAllowed(pointee) && remoteName) {
				for (const m of (pointee.members ?? [])) {
					const mname = m.name ?? m.memberName;
					result.concat(InstructionBuilder.set(`${key}.${mname}`, `"${remoteName}.${mname}"`));
				}
			}
			return result;
		}
		/*
		No processor of its own: the binding is copied from something else.
		  `remote int *p2 = &rs;`    -- another remote binding
		  `remote int *pself = ss;`  -- a name pointer, which means THIS processor
		*/
		if (node && node.initializer) {
			const value = this.visitAndRead(node.initializer);
			if (value instanceof RemotePointerRet) {
				result.concat(value.instructions);
				result.concat(InstructionBuilder.set(deviceReg, value.deviceReg));
				result.concat(InstructionBuilder.set(nameReg, value.nameReg));
			} else if (value instanceof NamePointerRet) {
				result.concat(value.instructions);
				result.concat(InstructionBuilder.set(deviceReg, '@this'));
				result.concat(InstructionBuilder.set(nameReg, value.targetName
					? `"${value.targetName}"` : value.name));
			}
		}
		return result;
	}

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
	/**
	 * Does a type contain a pointer anywhere?
	 *
	 * Static/persistent storage is not zeroed for pointers: Mindustry has no
	 * meaningful "null address", so writing 0 to a pointer (or to one half of
	 * a two-word pointer) is not an initialization. A member or array that
	 * contains one is skipped by the zeroing helpers.
	 */
	containsPointerType(type, seen = new Set()) {
		if (!type || typeof type !== 'object' || seen.has(type)) return false;
		seen.add(type);
		if (type.kind === 'pointer') return true;
		if (type.kind === 'array') return this.containsPointerType(type.pointerTo, seen);
		if (type.kind === 'struct' || type.kind === 'union') {
			return (type.members ?? []).some(member => this.containsPointerType(member.type, seen));
		}
		return false;
	}

	zeroMemoryCells(base, offset, cells) {
		const result = new Instruction();
		const count = Math.max(0, Number(cells) || 0);
		for (let i = 0; i < count; i++) {
			result.concat(this.memory.outputStorageOf(
				base.duplicate().forwarding(offset + i), '0'));
		}
		return result;
	}

	zeroMemoryAggregate(base, type, offset = 0) {
		const result = new Instruction();
		if (!type) return result;
		for (const member of type.members ?? []) {
			const memberType = member.type;
			if (!memberType) continue;
			const memberOffset = offset + (member.offset ?? 0);
			if (memberType.kind === 'struct' || memberType.kind === 'union') {
				result.concat(this.zeroMemoryAggregate(base, memberType, memberOffset));
				continue;
			}
			if (this.containsPointerType(memberType)) continue;
			if (memberType.kind === 'array') {
				result.concat(this.zeroMemoryCells(base, memberOffset,
					memberType.size ?? 0));
			} else {
				result.concat(this.zeroMemoryCells(base, memberOffset,
					memberType.size || 1));
			}
		}
		return result;
	}

	/**
	 * Zero every element of a static/persistent array.
	 *
	 * The array can be in memory or in registers; `arrayViewOf` chooses the
	 * same representation a subscript would use. Encoded/remote/lookup
	 * layouts are skipped: an encoded array is immutable, and a remote or
	 * lookup table has no local cells to zero.
	 *
	 * @param {SymbolEntry} symbol
	 * @returns {Instruction}
	 */
	zeroLifetimeArray(symbol) {
		// An unbound handle is one register waiting for `a = b;`; it has no
		// elements to zero.
		if (symbol.isUnboundHandle) return new Instruction();
		const style = this.arrayStyleFor(symbol);
		if (!style || style.type === 'encoded'
			|| style.implement === 'lookup' || symbol.isRemote) {
			return new Instruction();
		}
		const type = symbol.myType();
		const elementType = type?.pointerTo ?? null;
		// A pointer has no meaningful all-zero value; do not initialize it.
		if (this.containsPointerType(elementType)) return new Instruction();
		const length = this.arrayLengthOf(symbol);
		if (!Number.isFinite(length) || length <= 0) return new Instruction();
		if (style.type === 'traditional') {
			const base = symbol.memoryRef?.();
			if (!base) return new Instruction();
			const cells = Math.max(1, Number(type?.size) || length);
			return this.zeroMemoryCells(base, 0, cells);
		}
		const view = this.arrayViewOf(symbol);
		if (!view) return new Instruction();
		const result = new Instruction();
		for (let i = 0; i < length; i++) {
			const element = view.element(i);
			result.concat(element.set(new ImmediateRet(this.glob, '0', element.type ?? null)));
		}
		return result;
	}

	zeroLifetimeAggregate(symbol) {
		const type = symbol.myType();
		if (!type) return new Instruction();
		const base = symbol.memoryRef?.();
		if (base && (symbol.needMemoryAllocation || symbol.accessThroughPointer
			|| type.isPointerImpl?.())) {
			return this.zeroMemoryAggregate(base, type, 0);
		}
		const result = new Instruction();
		const zeroMembers = (prefix, structType) => {
			for (const member of structType.members ?? []) {
				const name = `${prefix}.${member.name}`;
				const memberType = member.type;
				if (!memberType) continue;
				if (member.isBitfield === true) continue;
				const kind = memberType.kind;
				if (kind === 'struct' || kind === 'union') {
					zeroMembers(name, memberType);
					continue;
				}
				// A pointer has no meaningful all-zero value; arrays that
				// contain one are left alone as a whole (walking into an
				// arbitrary pointer shape would be worse than leaving it).
				if (this.containsPointerType(memberType)) continue;
				if (kind !== 'array') {
					result.concat(InstructionBuilder.set(name, '0'));
				}
			}
		};
		zeroMembers(symbol.getAssemblySymbol(), type);
		return result;
	}

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
		/*
		A `remote` variable is only a binding: which processor, and which
		variable in it. Nothing is stored locally, so no memory is needed -- the
		two registers below are all there is.
		*/
		if (symbol.isRemote) {
			return this.emitRemoteBinding(symbol, node);
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
				/*
				A GLOBAL access-through-pointer container (array / struct / union)
				keeps its LIVE address in `X_block` / `X_pos`: the pair `&arr[1]`
				steps, that `arr[i] = v` writes through, and that the
				initializer-list copy writes through. Local containers get the
				pair from the function-stack machinery at function entry; a global
				has no such step, and the lines above only wrote the `X.__pointer`
				SLOT -- the live pair stayed an uninitialised register, so
				`&arr[2]` read the first linked block at a garbage offset (trap)
				and a global-with-initializer struct walked that same garbage
				forever (step limit). Writing the pair from the container's own
				memory location is exactly what the not-access-through-pointer
				branch below does, and matches what the initializer path repeats.
				*/
				const isGlobal = symbol.scope === this.semantic?.globalScope;
				const containerKind = symbol.myType()?.kind ?? null;
				if (isGlobal && (containerKind === 'array' || containerKind === 'struct' || containerKind === 'union')) {
					finalize.concat(symbol.memoryLocation.getAssignmentInstruction(symbol.getAssemblySymbol()));
				}
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
		`static` is run-local and `persistent` lives for the processor
		lifetime, but both need their initializer to run only once per
		lifetime. The tag is reset at run start for `static` only; see the
		generated prologue.
		*/
		const hasLifetimeTag = symbol.isStatic || symbol.isPersistent;
		const endTag = `${symbol.getAssemblySymbol()}:_static_tag`;
		/*
		Ordinary globals are per-run in this dialect. Their initializer (if
		any) already runs every pass; an uninitialized one needs an explicit
		zero because registers/memory may retain a previous run's value.
		`extern`/`remote` are owned elsewhere, and `persistent` is the opt-in
		exception.
		*/
		const runGlobalReset = !hasLifetimeTag && symbol.isGlobal
			&& !symbol.isExtern && !symbol.isRemote && !node.initializer;
		let endJumper = null;
		if (hasLifetimeTag) {
			endJumper = InstructionBuilder.jump('{skip_init}', 'notEqual', endTag, 'false');
			finalize.concat(endJumper);
		}
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
			if (hasLifetimeTag) {
				finalize.concat(InstructionBuilder.set(endTag, 'true'));
				finalize.concat(new InstructionReferrer(endJumper, 'skip_init', 0));
			}
			return finalize;
		}
		if (!symbol.memoryLocation || node.initializer || hasLifetimeTag || runGlobalReset) {
			// This is reserved
			let evaluation = node.initializer ? this.visitAndRead(node.initializer) : new Instruction();
			
			if (node.initializer) {
				// Necessary implicit converts that is not supported by the Mindustry VM
				if (node.initializer.dataType) {
					if (this.semantic.isSameType(symbol.myType(), this.semantic.getTypeInfo('content_t')) && special.includes(node.initializer.dataType.name)) {
						evaluation = this.implicitToContentRaw(evaluation, referrer(node.initializer.dataType.name));
					} else if (special.includes(symbol.myType().name) && !this.semantic.isSameType(symbol.type.type, node.initializer.dataType)) {
						evaluation = this.implicitContentToNumericRaw(evaluation);
					} else if (this.semantic.isTypeCompatible(symbol.myType(), 'int', true) && this.semantic.isTypeCompatible(node.initializer.dataType, 'float', true)
						&& !this.isProvablyIntegralExpression(node.initializer)) {
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
				/*
				`&st` yields no instructions at all: the names are constants.
				Renaming inside nothing leaves the pointer uninitialised, so the
				value has to be written explicitly -- `p.x = "st.x"` and so on.
				*/
				const isNamePacket = evaluation instanceof NameStructPointerRet
					|| evaluation.getAttribute?.('isNameStructPointer') === true;
				/*
				`&rs`: the binding is (processor, name). Handing over the bare
				register name would keep only one half of it, so the value has
				to be passed as a whole.
				*/
				const isRemotePointer = evaluation instanceof RemotePointerRet;
				if (symbol.accessThroughPointer || noCodeToRename || isNamePacket
					|| evaluation.getAttribute('disallowReplacement')) {
					finalize.concat(evaluation);
					/*
					`&st` is handed over as a set of names, not as a struct
					value to copy member by member -- that would need memory.
					*/
					if (!isNamePacket && node.initializer.dataType && (
						node.initializer.dataType.kind === 'struct' || node.initializer.dataType.kind === 'union' || evaluation.getAttribute('isStructRet')
					)) {
						const structValued = node.initializer.dataType.kind === 'struct'
							|| node.initializer.dataType.kind === 'union';
						/*
						A GLOBAL access-through-pointer struct / union is assembled
						at boot, BEFORE the function machinery has run -- and the
						member walk of `copyStruct` calls `__pointerForward`, whose
						register is only initialised by that machinery. The call
						reads 0 and jumps back to the start of the program (step
						limit). The struct's data cells are known at compile time
						(`X.__pointer` -- `extraMemoryLocation` -- is the base every
						member read goes through), so each member of a registry-
						valued list (`isStructRet`) is written straight to its cell,
						the same way the array initializer list writes its elements.
						*/
						const isGlobalStruct = structValued
							&& symbol.scope === this.semantic?.globalScope
							&& !!symbol.extraMemoryLocation
							&& evaluation.getAttribute('isStructRet');
						if (isGlobalStruct) {
							/*
							Only the members the list actually initialised hold a
							value: a UNION's members all sit at offset 0, and
							`union u = {7}` assigns just the first one -- storing
							the rest would overwrite it with an unassigned
							register.
							*/
							const memberLimit = Math.min((symbol.myType()?.members ?? []).length,
								Array.isArray(node.initializer.children)
									? node.initializer.children.length : Infinity);
							finalize.concat(this.staticStructStores(symbol, evaluation.instructionReturn ?? 'null', memberLimit));
						} else {
							/*
							An access-through-pointer struct / union is read through
							its `.__pointer` registers, and its data lives where
							those point; the live pair `X_block` / `X_pos` is never
							written for one (locals only get `.__pointer` from the
							frame machinery). The walk must start from the pointer,
							not from a pair that is uninitialised at this point.
							*/
							const structTarget = structValued && symbol.accessThroughPointer
								? `${symbol.getAssemblySymbol()}.__pointer` : symbol.getAssemblySymbol();
							finalize.concat(this.copyStruct(structTarget, evaluation.instructionReturn ?? 'null', symbol.myType(), node.initializer.dataType));
						}
					} else {
						/*
						Hand the pointer VALUE itself over when it carries names:
						the bare register name would lose which struct the names
						were built from.
						*/
						finalize.concat(this.writeSymbol(symbol,
							(isNamePacket || isRemotePointer) ? evaluation
								: (evaluation.instructionReturn ?? 'null')));
					}
				} else {
					finalize.concat(evaluation.replace_variable(symbol.getAssemblySymbol(), evaluation.instructionReturn));
				}
			} else if (!node.initializer && (hasLifetimeTag || runGlobalReset)) {
				/*
				C leaves static storage zero-initialized. Do it explicitly:
				memory cells and registers may otherwise contain values from a
				previous run or a previous use of the block.
				*/
				const kind = symbol.myType()?.kind;
				if (kind === 'basic' || kind === 'device' || kind === 'null') {
					finalize.concat(this.writeSymbol(symbol, 0));
				} else if (kind === 'array') {
					finalize.concat(this.zeroLifetimeArray(symbol));
				} else if (kind === 'struct' || kind === 'union') {
					finalize.concat(this.zeroLifetimeAggregate(symbol));
				}
			}
			
			if (hasLifetimeTag) {
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
		/*
		Set when the parent declarator will hand the initializer VALUE off by
		register copy instead of renaming its instructions into the symbol (see
		the `spaceIsOwned` comment below): an `accessThroughPointer` declarator
		reads the value out of the evaluation temp, so that temp must really
		hold the address even when the space is the variable's own.
		*/
		let valueHandedOff = false;
		
		/**
		 * @type {TypeInfo}
		 */
		let knownType = null;
		if (node.parent) {
			if (declaratorTypes.includes(node.parent.type)) {
				const manualSymbol = this.currentScope.lookup(node.parent.name);
				const manualSpace = manualSymbol ? manualSymbol.memoryLocation : null;
				valueHandedOff = manualSpace != null && manualSymbol.accessThroughPointer === true;
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
			/*
			Bitfield storage cells are internal members. User initializers map to
			the visible members (including bitfields), not to `__bitsN`.
			*/
			const visibleMembers = knownType.members.filter(m => m.isBitfieldStorage !== true);
			if (knownType.bitfieldStorages?.length) {
				const base = tmpVar.getAssemblySymbol();
				knownType.bitfieldStorages.forEach(storage => {
					result.concat(InstructionBuilder.set(`${base}.${storage.name}`, '0'));
				});
			}
			for (let i = 0; i < visibleMembers.length && i < node.children.length; i++) {
				const current = visibleMembers[i];
				if (node.children[i].type === 'InitializerList') {
					node.children[i].dataType = current.type;
				}
				const ret = this.visitAndRead(node.children[i]);
				const base = tmpVar.getAssemblySymbol();
				if (current.isBitfield === true) {
					const storage = new BasicRet(this.glob, [],
						`${base}.${current.storageName}`, this.semantic.getTypeInfo('int'), true);
					const bitfield = new BitfieldRet(this.glob, storage, current.type,
						current.bitOffset, current.bitWidth, current.isSigned);
					result.concat(bitfield.set(ExportRet(this.glob, ret,
						node.children[i].dataType ?? current.type)));
					continue;
				}
				const currentTarget = `${base}.${current.name}`;
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
			if (knownType?.bitfieldStorages?.length) {
				this.addError(
					'Initializer lists for memory-backed structs with bitfields are not supported yet; '
					+ 'assign the fields individually',
					node.location);
				return result;
			}
			//let currentPointer = 0;
			/**
			 * 
			 * @param {ASTNode} obj 
			 * @param {TypeInfo} typeLayer
			 */
			const spaceIsOwned = assignedSpace != null;
			if (!spaceIsOwned) {
				try {
					assignedSpace = this.memory.assign(this.getTempSpace(),
						Math.max(node.dataType.size, node.getAttribute('requiredSize') ?? 0));
				} catch (e) {
					/*
					A value built out of a list needs somewhere to be assembled.
					With no memory at all there is nowhere, and this is a normal
					user error rather than an internal failure.
					*/
					this.addError(`Cannot hold an initializer list in memory: this program` +
						` needs a memory block for its array / pointer initializers`);
					return result;
				}
			}
			/*
			When the space is the variable's own memory location the declarator
			has already written its address out; doing it again here only repeats
			the same two instructions -- UNLESS the value is handed off by
			register copy (`valueHandedOff` above), where the temp both needs
			the address and is the only place one is ever given to it.
			*/
			if (!spaceIsOwned || valueHandedOff) {
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
	 * Whether an expression returning a float-valued type is nevertheless
	 * guaranteed to be integral, so converting it to `int` needs no `op floor`.
	 *
	 * Only builtins whose result is integral for ALL inputs, or whose integer
	 * arguments make the result integral, are listed. `sqrt`, `pow`, `rand`,
	 * `sin` and friends are deliberately absent.
	 *
	 * @param {ASTNode} node
	 * @returns {boolean}
	 */
	isProvablyIntegralExpression(node) {
		const name = node?.functionName ?? node?.callee?.name ?? null;
		if (!name) return false;
		if (['floor', 'ceil', 'round'].includes(name)) return true;
		if (!['abs', 'min', 'max'].includes(name)) return false;
		const args = node.arguments ?? [];
		if (args.length === 0) return false;
		return args.every(arg => {
			const type = arg?.dataType;
			if (!type) return false;
			return this.semantic.isIntegerType(type.name) || type.name === 'bool';
		});
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
					/*
					`abs(int)` / `min(int,int)` / `floor(x)` already produce an
					integer value; inserting another `op floor` is pure waste.
					*/
					if (this.isProvablyIntegralExpression(node)) {
						return this.visitAndRead(node);
					}
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
	 * Find the link index of one `auto device` and keep it in a register, so
	 * that `memsp(cell2, pos)` needs no search at run time.
	 *
	 * @param {SymbolEntry} symbol
	 * @returns {Instruction}
	 */
	outputDeviceLinkScan(symbol) {
		const result = new Instruction();
		const loop = InstructionBuilder.jump('{devloop}', 'lessThan', '__devscan', '@links');
		const found = InstructionBuilder.jump('{devfound}', 'notEqual', '__devhit', 'false');
		const name = symbol.getAssemblySymbol();
		result.concat(InstructionBuilder.set('__devscan', 0));
		result.concat(new InstructionReferrer(loop, 'devloop'));
		result.concat(InstructionBuilder.getlink('__devcur', '__devscan'));
		result.concat(InstructionBuilder.op('strictEqual', '__devhit', '__devcur', name));
		result.concat(found);
		result.concat(InstructionBuilder.op('add', '__devscan', '__devscan', 1));
		result.concat(loop);
		result.concat(new InstructionReferrer(found, 'devfound'));
		result.concat(InstructionBuilder.set(`${name}__linkid`, '__devscan'));
		return result;
	}

	/**
	 * Which `auto device` names are handed to `memsp` as a plain name.
	 *
	 * Their link index can be found ONCE while the memory blocks are being
	 * bound at the start of the program, instead of on every single call.
	 *
	 * @param {ASTNode} node
	 * @returns {Set<string>}
	 */
	collectMemspDevices(node) {
		const found = new Set();
		const seen = new Set();
		const walk = n => {
			if (!n || typeof n !== 'object' || seen.has(n)) return;
			seen.add(n);
			if (['FunctionCall', 'BuiltinCall'].includes(n.type) && n.functionName === 'memsp'
				&& n.arguments && n.arguments[0]
				&& n.arguments[0].type === 'Identifier') {
				found.add(n.arguments[0].name);
			}
			for (const key of Object.keys(n)) {
				if (key === 'parent') continue;	// back edge
				const child = n[key];
				if (Array.isArray(child)) child.forEach(walk);
				else if (child && typeof child === 'object' && child.type) walk(child);
			}
		};
		walk(node);
		return found;
	}

	/**
	 * The register holding the link index of an `auto device`, or null when the
	 * building is not known at compile time (a parameter, a `getlink` result...).
	 *
	 * @param {ASTNode} node
	 * @returns {string | null}
	 */
	staticDeviceLinkId(node) {
		if (!node || node.type !== 'Identifier') return null;
		if (!(this._memspDevices instanceof Set)) return null;
		if (!this._memspDevices.has(node.name)) return null;
		const symbol = this.currentScope?.lookup?.(node.name) ?? null;
		if (!symbol || !symbol.isAutoDevice) return null;
		return `${symbol.getAssemblySymbol()}__linkid`;
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
	 * The text a string valued expression stands for, when it is known here.
	 *
	 * @param {ASTNode?} node
	 * @returns {string?} null when it is not a compile time string
	 */
	staticStringOf(node) {
		if (!node) return null;
		if (node.type === 'StringLiteral') return String(node.value ?? '');
		return null;
	}

	/**
	 * Joining two strings that are not both compile time constants.
	 *
	 * This is the entry point for a run time concatenation: the machine
	 * language has no instruction for it today, so for now it is reported as
	 * an error. Keeping it separate means the rest of the generator never has
	 * to know how (or whether) strings can be joined.
	 *
	 * @param {ASTNode} node The `+` expression
	 * @returns {Instruction}
	 */
	emitRuntimeStringConcat(node) {
		/*
		The position is given to addError on its own, the way the rest of the
		compiler does it, so that the front end can place the marker instead of
		having to read the coordinates out of the text.
		*/
		this.addError(
			`Cannot concatenate these strings: only string literals can be joined, ` +
			`because the target language has no run time concatenation`,
			node?.location ?? null);
		return new Instruction();
	}

	/**
	 * Whether an operand can be evaluated unconditionally.
	 *
	 * Only used to decide between `op land` / `op or` and a real branch: when
	 * both sides are this, evaluating both is harmless and shorter.
	 *
	 * @param {ASTNode?} node
	 * @returns {boolean}
	 */
	isCheapAndPure(node) {
		const seen = new Set();
		/*
		Whitelist, not blacklist: an INLINED function body is often a
		compound/statement-expression whose assignments live in `statements`,
		which the old walk did not visit. Anything not known pure is treated as
		impure, so a call that was inlined still short-circuits correctly.
		*/
		const pureTypes = new Set([
			'NumericLiteral', 'StringLiteral', 'CharacterLiteral', 'NullLiteral',
			'Identifier', 'BinaryExpression', 'LogicalExpression', 'UnaryExpression',
			'ConditionalExpression', 'CastExpression'
		]);
		const walk = n => {
			if (!n || typeof n !== 'object' || seen.has(n)) return true;
			seen.add(n);
			if (!pureTypes.has(n.type)) return false;
			// A call may do anything, including something that must be skipped
			if (n.type === 'FunctionCall' || n.type === 'BuiltinCall') return false;
			if (n.type === 'AssignmentExpression') return false;
			if (n.type === 'UnaryExpression'
				&& ['++', '--', '&', '*'].includes(n.operator)) return false;
			if (n.type === 'Identifier') {
				if (typeof n.name === 'string' && n.name[0] === '@') return false;
				if (n.symbol && (n.symbol.isVolatile || n.symbol.isRemote
					|| n.symbol.accessThroughPointer)) return false;
			}
			if (n.symbol && (n.symbol.isVolatile || n.symbol.isRemote)) return false;
			const keys = ['children', 'left', 'right', 'argument', 'expression', 'operand',
				'test', 'consequent', 'alternate', 'arguments', 'callee', 'object', 'property'];
			for (const key of keys) {
				const child = n[key];
				if (Array.isArray(child)) {
					if (!child.every(walk)) return false;
				} else if (child && typeof child === 'object') {
					if (!walk(child)) return false;
				}
			}
			return true;
		};
		return walk(node);
	}

	/**
	 * `a && b` / `a || b` with the right hand side evaluated only if needed.
	 *
	 * The result goes into a temporary SYMBOL, not a register: the two sides
	 * may themselves contain calls, and a register would not survive them.
	 *
	 * @param {BinaryExpressionNode} node
	 * @returns {Instruction}
	 */
	emitShortCircuitLogical(node) {
		const type = node.dataType ?? this.semantic.getTypeInfo('bool');
		const temp = this.getTempSymbol(type);
		const target = temp.getAssemblySymbol();
		/*
		`visitAndRead` is required here: `visit` hands back a value-class object
		for a member/subscript, and writing that into the temporary emitted
		`set ... [object Object]`.
		*/
		const assigns = value => this.writeSymbol(temp,
			ExportRet(this.glob, this.visitAndRead(value), value.dataType));
		/*
		`&&`: when the left side is false the answer is false, so skip.
		`||`: when the left side is true the answer is true, so skip.
		Either way the value left in `target` is normalised to 0/1 below.
		*/
		const jumper = InstructionBuilder.jump('{logical_end}',
			node.operator === '&&' ? 'equal' : 'notEqual', target, 'false');
		const result = new Instruction([
			assigns(node.left),
			jumper,
			assigns(node.right),
			// C's `&&`/`||` yield 0 or 1, not the operand's own value
			InstructionBuilder.op('notEqual', target, target, 'false'),
			new InstructionReferrer(jumper, 'logical_end')
		]);
		result.instructionReturn = target;
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

		/*
		`char` is a STRING here, so `+` joins texts. There is no instruction
		that joins two strings while running, so only two literals can be
		joined -- at compile time. Anything else goes to
		`emitRuntimeStringConcat`, which is where a future run time version
		belongs.
		*/
		const isStringType = t => !!t && t.name === 'string_t';
		if (node.operator === '+' && (isStringType(node.left?.dataType) || isStringType(node.right?.dataType))) {
			const leftText = this.staticStringOf(node.left);
			const rightText = this.staticStringOf(node.right);
			if (leftText !== null && rightText !== null) {
				return new Instruction([], `"${leftText}${rightText}"`,
					new Map([['disallowReplacement', true]]));
			}
			return this.emitRuntimeStringConcat(node);
		}

		/*
		`&&` and `||` must NOT evaluate the right hand side when the left one
		already decides the answer. Both sides are evaluated anyway when both
		are plain and free of side effects -- then短路与否 is the same thing,
		and one instruction is cheaper than the branch.
		*/
		if ((node.operator === '&&' || node.operator === '||')
			&& !(this.isCheapAndPure(node.left) && this.isCheapAndPure(node.right))) {
			console.log('DBG short-circuit', node.operator, node.left?.type, node.right?.type, this.isCheapAndPure(node.left), this.isCheapAndPure(node.right));
			return this.emitShortCircuitLogical(node);
		}
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
	 * @remark Pointers are assigned by reference; ARRAYS are copied element by
	 *         element (the same loop `veccpy` emits); structs and unions
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
		/*
		`a = b;` where `a` is an UNBOUND handle (`int a[];` declared with no
		initializer) BINDS a to b: b's packed handle is written into a's cell.
		That must not fall through to the ordinary lvalue machinery, which
		would read a's block/offset pair -- an unbound handle has neither.
		*/
		const leftSymbol = (node.left.type === 'Identifier')
			? (this.currentScope.lookup(node.left.name) ?? null) : null;
		if (node.operator === '=' && leftSymbol?.isUnboundHandle === true) {
			return this.emitArrayHandleBind(leftSymbol, node.right);
		}
		const lval = this.getLValue(node.left);

		// Structs and unions are copied (never "by reference")
		if (rightType && ['struct', 'union'].includes(rightType.kind)) {
			return lval.set(ExportRet(glob, this.visit(node.right), rightType));
		}

		// Initializer lists build the data first, then copy it into the target
		if (node.right.type === 'InitializerList') {
			return this.assignInitializerList(node, lval);
		}

		/*
		`a = b;` when both sides are arrays is an element copy -- the same loop
		`veccpy(a, b)` emits -- not the assignment-by-reference the generic
		lvalue write below would do, which copied nothing at all. The two sides
		go through the same `element(i)` machinery a subscript uses, so the
		copy is correct whatever layouts the two arrays settled on; the bound
		is the smaller of the two lengths, exactly as in `emitElementCopy`.
		*/
		if (leftType?.kind === 'array' && rightType?.kind === 'array') {
			const destination = this.arrayViewForArgument(node.left);
			const source = this.arrayViewForArgument(node.right);
			if (destination && source) {
				return this.emitElementCopy(destination, source);
			}
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
	 * `a = b;` where `a` is an unbound handle (`int a[];` declared with no
	 * initializer): BIND a to b.
	 *
	 * The binding writes b's PACKED HANDLE into a's ONE cell -- the get / set
	 * helper entry points plus the length, exactly what `packHandle` builds for
	 * a call site. That is what makes the feature cost one register plus
	 * packHandle and nothing else: after the binding, a and b reach the same
	 * array through the same helpers.
	 *
	 * The right side is materialised the way a function argument is: an array
	 * outside memory has an ArrayRet view, and a memory array's value IS its
	 * address, from which a traditional view is built. The result is packed
	 * straight into the cell, like a callee's slot.
	 *
	 * @param {SymbolEntry} leftSymbol
	 * @param {ASTNode} rightNode
	 * @returns {Instruction}
	 */
	emitArrayHandleBind(leftSymbol, rightNode) {
		const glob = this.glob;
		/* The ONE cell this handle is: what `a = b;` writes into, and what
		`&a` names. */
		const cell = leftSymbol.getAssemblySymbol();
		const argSym = (rightNode.type === 'Identifier')
			? (this.currentScope?.lookup?.(rightNode.name)
				?? this.semantic?.globalScope?.lookup?.(rightNode.name) ?? null)
			: null;
		/*
		`arrayViewOf` cannot describe a MEMORY array (it builds the view from a
		pointer it is never given), so one is built from the value just
		materialised -- for a memory array that value IS its address. The same
		split as `deliverArgument`.
		*/
		let array = null;
		if (argSym && argSym.myType?.()?.kind === 'array'
			&& this.arrayStyleFor(argSym)?.type !== 'traditional') {
			array = this.arrayViewOf(argSym);
		}
		/*
		A HANDLE-backed source -- a handle parameter, or another unbound handle --
		has nothing to pack: its cell already holds a packed handle, length and
		all, so the binding is one store from one cell to the other.
		*/
		if (array instanceof ArrayHandleRet) {
			return new Instruction([InstructionBuilder.set(cell, array.name)],
				cell, new Map([['disallowReplacement', true]]));
		}
		if (!array) {
			const value = ExportRet(glob, this.visit(rightNode), rightNode.dataType);
			if (value instanceof PointerRet) {
				array = new TraditionalArrayRet(glob, value,
					argSym?.myType?.() ?? rightNode.dataType,
					this.arrayLengthOf(argSym) || 0);
			}
		}
		if (!array) {
			this.addError(
				`Cannot bind '${leftSymbol.name}': '${rightNode.name ?? 'the right side'}' is ` +
				`not an array reachable here`, rightNode.location);
			return new Instruction([], 'null', new Map([['disallowReplacement', true]]));
		}
		const handle = ensureArrayHandle(glob, array);
		if (!handle) {
			this.addError(`Cannot bind '${leftSymbol.name}': its target has no handle form`,
				rightNode.location);
			return new Instruction([], 'null', new Map([['disallowReplacement', true]]));
		}
		/*
		The packed handle is built straight INTO the cell -- one register, no
		extra store. (Binding through `&a` costs exactly the same: packHandle is
		paid either way, only the store's destination differs.)
		*/
		const length = array.length || 0;
		const instrs = [handle.instructions, ...packHandle(glob, cell, { ...handle, length })];
		return new Instruction(instrs, cell, new Map());
	}

	/**
	 * `vecalias(&a, b)`: the same binding as `a = b;`, reached through a NAME
	 * pointer instead of a symbol.
	 *
	 * The front end has already refused everything that is not a handle cell
	 * (see `checkVecAlias`), so what is left here is the ordinary array: turned
	 * into a view, packed, and stored into the register the pointer names. The
	 * `&` costs nothing over the plain form -- `packHandle` is paid either way,
	 * and only the destination of the store differs.
	 *
	 * @param {ASTNode} node A `vecalias` BuiltinCall
	 * @returns {Instruction}
	 */
	emitVecAlias(node) {
		const glob = this.glob;
		const args = node.arguments ?? [];
		const pointer = ExportRet(glob, this.visit(args[0]), args[0]?.dataType);
		/*
		`&a` on a width-1 array is a NAME pointer, which is exactly the case
		`NamePointerRet` was built for: it holds the NAME of the cell rather than
		a block/offset pair. `targetName` is that name -- known at compile time,
		which is the whole point of a name pointer -- while `name` is the register
		that HOLDS the name, and writing the handle there would bind nothing.
		The instructions that stored the name are dropped with it: the handle is
		written to the cell itself, and nothing ever reads that copy.
		*/
		const cell = (pointer instanceof NamePointerRet)
			? (pointer.targetName ?? null) : null;
		if (!cell) {
			this.addError(
				`vecalias: the first argument is not the name of a handle cell, so there is `
				+ `nowhere to put the handle`, node.location);
			return new Instruction();
		}
		const view = this.arrayViewForArgument(args[1]);
		if (!view) {
			this.addError(`vecalias: the second argument is not an array`, args[1]?.location ?? node.location);
			return new Instruction();
		}
		if (view instanceof ArrayHandleRet) {
			/*
			A handle as the source: the cell already holds a packed handle, length
			and all, so the alias is one store and there is nothing to pack.
			*/
			return new Instruction([InstructionBuilder.set(cell, view.name)], cell,
				new Map([['disallowReplacement', true]]));
		}
		const handle = ensureArrayHandle(glob, view);
		if (!handle) {
			this.addError(`vecalias: this array has no handle form`, args[1]?.location ?? node.location);
			return new Instruction();
		}
		return new Instruction([handle.instructions,
			...packHandle(glob, cell, { ...handle, length: view.length || 0 })], cell, new Map());
	}

	/**
	 * The `ArrayRet` an array-typed ARGUMENT denotes, with the same split the
	 * argument delivery uses: a layout that is not in memory describes itself,
	 * while a memory array's value IS its address, from which the traditional
	 * view is built.
	 *
	 * @param {ASTNode?} node
	 * @returns {import('./mindcInfrastructure.js').ArrayRet?}
	 */
	arrayViewForArgument(node) {
		if (!node) return null;
		const symbol = (node.type === 'Identifier')
			? (this.currentScope?.lookup?.(node.name)
				?? this.semantic?.globalScope?.lookup?.(node.name) ?? null)
			: null;
		if (symbol && symbol.myType?.()?.kind === 'array'
			&& this.arrayStyleFor(symbol)?.type !== 'traditional') {
			return this.arrayViewOf(symbol);
		}
		const value = ExportRet(this.glob, this.visit(node), node.dataType);
		if (value instanceof PointerRet) {
			return new TraditionalArrayRet(this.glob, value,
				symbol?.myType?.() ?? node.dataType, this.arrayLengthOf(symbol) || 0);
		}
		return null;
	}

	/**
	 * `veccpy(a, b)`: copy the elements of `b` into `a`.
	 *
	 * Both sides go through `element(i)`, which is the same machinery `a[i]`
	 * uses, so the loop is short and works the same whatever the two layouts
	 * are -- a loop written per layout would be two loops to keep in step, and
	 * one of them would rot.
	 *
	 * The bound is the SMALLER of the two lengths. When both are written down
	 * the front end has already refused `M > N` (`checkVecCpy`), so it is a
	 * literal; when the count lives in a packed handle it is a run time
	 * question, and the destination's worth is the only bound that cannot run
	 * past the end.
	 *
	 * @param {ASTNode} node A `veccpy` BuiltinCall
	 * @returns {Instruction}
	 */
	emitVecCopy(node) {
		const glob = this.glob;
		const args = node.arguments ?? [];
		const destination = this.arrayViewForArgument(args[0]);
		const source = this.arrayViewForArgument(args[1]);
		if (!destination || !source) {
			this.addError(`veccpy: both arguments must be arrays`, node.location);
			return new Instruction();
		}
		return this.emitElementCopy(destination, source);
	}

	/**
	 * The element loop that `veccpy(a, b)` and `a = b;` share.
	 *
	 * Both sides go through `element(i)`, the same machinery `a[i]` uses, so
	 * the loop is short and works the same whatever the two layouts are -- a
	 * loop written per layout would be two loops to keep in step, and one of
	 * them would rot.
	 *
	 * The bound is the SMALLER of the two lengths. When both are written down
	 * it is a literal; when the count lives in a packed handle it is a run
	 * time question, and the destination's worth is the only bound that cannot
	 * run past the end.
	 *
	 * @param {import('./mindcInfrastructure.js').ArrayRet} destination
	 * @param {import('./mindcInfrastructure.js').ArrayRet} source
	 * @returns {Instruction}
	 */
	emitElementCopy(destination, source) {
		const index = this.getTempSymbol();
		const indexName = index.getAssemblySymbol();
		const lengthOf = view => {
			const value = Number(view.length);
			return Number.isFinite(value) && value > 0 ? value : 0;
		};
		const destinationLength = lengthOf(destination);
		const result = new Instruction();
		/*
		A HANDLE's length is whatever the binding put in it, so it is a run time
		question and the bound has to be a register. Every other layout carries a
		count that was written down in the program -- and the front end has
		refused `M > N` for those (`checkVecCpy`), so the smaller of the two is
		simply the source's. Taking the smaller either way is also what keeps a
		front end that MISSED that check from running the copy off the end of the
		destination.
		*/
		let bound = String(Math.min(destinationLength, lengthOf(source)));
		if (source instanceof ArrayHandleRet) {
			const limit = this.getTempSymbol();
			const limitName = limit.getAssemblySymbol();
			/*
			`lenof` of a handle: the count sits one field up, so it is shifted
			down and masked -- the same two instructions `lenof(handle)` emits.
			*/
			result.concat(InstructionBuilder.op('shr', limitName, source.name,
				String(HANDLE_FIELD_BITS * 2)));
			result.concat(InstructionBuilder.op('and', limitName, limitName, String(HANDLE_MASK)));
			result.concat(InstructionBuilder.op('min', limitName, limitName,
				String(destinationLength)));
			bound = limitName;
		}
		result.concat(InstructionBuilder.set(indexName, '0'));
		/*
		Forward test, then the body, then back to the test -- the same shape
		`visitForStatement` builds, with the same referrer names, so the
		instruction writer does not need a second kind of loop to understand.
		*/
		const testJumper = InstructionBuilder.jump('{goto_test}', 'always', null, null);
		const bodyLoop = new Instruction();
		bodyLoop.concat(destination.element(indexName).set(source.element(indexName).get()));
		bodyLoop.concat(InstructionBuilder.op('add', indexName, indexName, '1'));
		bodyLoop.concat(testJumper);
		const loopSystem = new Instruction();
		loopSystem.concat(new InstructionReferrer(testJumper, 'goto_test'));
		/*
		The test goes into a register of its own rather than into an `{op}`
		placeholder: the jump that follows reads the result, and a placeholder
		would be a different register on each side of it.
		*/
		const verdict = this.getTempSymbol();
		const verdictName = verdict.getAssemblySymbol();
		loopSystem.concat(InstructionBuilder.op('lessThan', verdictName, indexName, bound));
		/*
		A jump condition is a COMPARISON, not a bare register: `jump t x` is not
		a thing. The comparison is against `false` so that the branch fires on
		the negated verdict -- i.e. when the loop is done -- exactly the shape
		`visitToCondition` hands to `visitForStatement`.
		*/
		const conditBreak = InstructionBuilder.jumpx('{loop_break}', `equal ${verdictName} false`);
		loopSystem.concat(conditBreak);
		loopSystem.concat(bodyLoop);
		result.concat(loopSystem);
		result.concat(new InstructionReferrer(conditBreak, 'loop_break'));
		return result;
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
			case '++': case '--': {
				// Note: this does not have copy because it has actions on its own
				result = this.visitAndRead(node.argument);	// We have LVal getter there, so this is read-only.
					/*
					What `visitAndRead` gives back is the variable ITSELF only for a plain
					register. A `remote` variable (or one living in memory) is read into a
					temporary, so adding 1 to that temporary updates nothing at all: `++rc`
					quietly did nothing, and `rc++` stored the old value into a temporary
					that had no binding of its own.
					*/
					const target = this.getLValue(node.argument);
					const readIsTheVariable =
						String(result.instructionReturn) === String(target.instructionReturn);
				/*
				The OLD value of `x++` is saved in a temporary of its own. Its
				type must not carry `remote`: the temporary would then be a
				binding (device + name) whose halves nobody assigns, and reading
				it back hit an undefined device.
				*/
				let plainType = node.dataType;
				if (plainType && (plainType.qualifiers ?? []).includes('remote')
					&& typeof plainType.duplicate === 'function') {
					plainType = plainType.duplicate();
					plainType.qualifiers = (plainType.qualifiers ?? []).filter(q => q !== 'remote');
				}
				let duplicate = this.getTempSymbol(plainType);
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
						if (target instanceof BitfieldRet) {
							result.concat(target.set(ExportRet(this.glob, result, node.dataType)));
						} else if (node.argument.type !== 'Identifier' || !readIsTheVariable) {
						result.concat(this.processLValGetter(node.argument).replace('value_entry', result.instructionReturn));
					}
				}
				if (shouldDuplicate) {
					result.set_returns(duplicate);
				}
				return result;
				break;
					}
			case '&':
				const argAddr = node.argument;
				/*
				An array's "address" belongs to its LAYOUT, not its symbol: a
				memory array is a block/offset pair (addressable as it stands), while
				a handle or remote array is ONE register holding the binding -- so
				&a for those is the NAME of that register (1 word). The layout
				machinery alone knows which is which, so width-1 arrays are routed
				through it. Everything else keeps the old lvalue path.
				*/
				if (argAddr && argAddr.dataType && argAddr.dataType.isTypeInfo
					&& argAddr.dataType.kind === 'array'
					&& widthOfType(argAddr.dataType) === 1) {
					const arraySym = (argAddr.type === 'Identifier')
						? (this.currentScope.lookup(argAddr.name) ?? null)
						: (argAddr.type === 'MemberExpression')
							? (this.currentScope.lookup(argAddr.children?.[0]?.name ?? '') ?? null)
							: null;
					if (arraySym) {
						const view = this.arrayViewOf(arraySym) ?? this.arrayRetFor(arraySym, null);
						if (view) return view.address();
					}
				}
				return this.processLValGetter(node.argument, true);
				break;
			case '*': {
				// Get value from given address (variable address).
				// Assume that this is only about RValue (LValue is independently handled.)
				const pointer = ExportRet(this.glob, this.visitAndRead(node.argument), node.argument.dataType);
				if (pointer instanceof NamePointerRet) {
					// The pointer holds a NAME: `read @this <name>`
					return pointer.fetch(this.getTempSymbol(node.dataType));
				}
				if (pointer instanceof RemotePointerRet) {
					// The pointer holds (processor, name): `read <dev> <name>`
					return pointer.deref();
				}
				if (pointer instanceof RemoteStoredPointerRet) {
					return pointer.deref();
				}
				if (pointer instanceof NameStructPointerRet) {
					// The whole struct, member by member (see NameStructDerefRet)
					return pointer.deref();
				}
				if (pointer instanceof RemoteStructPointerRet) {
					return pointer.deref();
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
	lookupNamesOf(length, options = {}, symbol = null) {
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
		const forced = options.forced ?? symbol?.requestedArrayImplementation ?? null;
		if (forced && forced.startsWith('embedded_lookup_')) {
			const suffix = forced.slice('embedded_lookup_'.length);
			const wanted = CATEGORY_ALIASES[suffix];
			if (wanted) {
				const names = usable(wanted === 'building' ? 'block' : wanted);
				if (names) return { category: wanted, names: strip(names) };
			}
		}
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
		/*
		An inlined parameter has no style of its own: it borrows the caller's.
		*/
		if (symbol?.arrayAliasOf) return this.arrayStyleFor(symbol.arrayAliasOf);
		if (symbol?.chosenArrayStyle) {
			/*
			Semantic analysis chose this layout from the facts it can see, and
			one fact it cannot see is recursion (`recursiveInfo` is built by the
			optimizer). Recursion outranks everything a declaration could
			request -- but NOT the shape a parameter or a `remote` array arrives
			in, which is decided before recursion in this function too, so the
			order here stays the order the choice would have been made in.
			*/
			const cached = symbol.chosenArrayStyle;
			const forced = this.forcedTraditionalReason(symbol);
			if (forced && cached.reason !== 'array parameter' && cached.reason !== 'remote array') {
				symbol.chosenArrayStyle = { type: 'traditional', implement: null, reason: forced };
				return symbol.chosenArrayStyle;
			}
			return cached;
		}
		/*
		A parameter that is handed a non-memory array has to keep that shape:
		the call site gives it names, not an address. Saying so here is also what
		stops the array from being given memory of its own, and what lets
		`arraySymbolOf` pick the by-name path instead of stepping a pointer.
		*/
		if (symbol?.arrayParamRep === 'handle') {
			symbol.chosenArrayStyle = { type: 'embedded', implement: 'divided', reason: 'array parameter' };
			return symbol.chosenArrayStyle;
		}
		/*
		An ordinary in-memory array parameter is passed as a pointer, exactly as
		it always was -- and it must NOT be auto-selected into a register layout
		just because its own length is unknown (`int p[]`).
		*/
		if (symbol?.arrayParamRep === 'traditional') {
			symbol.chosenArrayStyle = { type: 'traditional', implement: null, reason: 'array parameter' };
			return symbol.chosenArrayStyle;
		}
		/*
		A `remote` array stores nothing here: its elements are registers of the
		other processor. So it must never be given memory of its own (which is
		what the automatic choice below would do), and its own requested layout
		-- if any -- is what says how those elements are named.
		*/
		if (symbol.isRemote === true) {
			symbol.chosenArrayStyle = { type: 'embedded', implement: 'divided',
				reason: 'remote array' };
			return symbol.chosenArrayStyle;
		}
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
		/*
		An inlined parameter is the caller's array, not an array of its own.
		This has to be checked before anything that would give the parameter a
		representation of its own (a handle, or a fresh register layout).
		*/
		if (symbol?.arrayAliasOf) return this.arrayViewOf(symbol.arrayAliasOf);
		/*
		A parameter holding NAMES instead of an address. Every access goes
		through `read` / `write <device> <the name>`, which is the only way to
		reach an array that has no address -- and the only way that writes back
		into the caller's array.
		*/
		if (symbol?.arrayParamRep === 'handle') {
			/*
			The parameter holds a HANDLE: two registers with the entry points of
			the get / set helpers of the array it was handed. No device register
			is needed -- the helper was built for the caller's array and already
			knows which processor to talk to.
			*/
			const length = this.arrayLengthOf(symbol) || 0;
			return new ArrayHandleRet(glob, symbol.getAssemblySymbol(), symbol.myType(), length);
		}
		const style = this.arrayStyleFor(symbol);
		const type = symbol.myType();
		const length = this.arrayLengthOf(symbol);
		/*
		A remote array is not stored here: its elements are registers of the
		other processor, so the array view has to name that processor. Only the
		last `read` / `write` changes -- the lookup table itself (item, liquid,
		unit, building) is a property of the game, so both sides share it.
		*/
		const deviceReg = symbol.isRemote
			? remoteDeviceRegOf(symbol.getAssemblySymbol()) : null;
		const ret = arrayRetOf(glob, style, {
			pointer, type, length, deviceReg,
			baseName: symbol.getAssemblySymbol(),
			category: symbol.lookupCategory ?? 'item',
			names: this.lookupNamesOf(length, {}, symbol).names,
			values: symbol.arrayInitialValues ?? new Array(length).fill(0)
		});
		/*
		For `embedded.divided` every access emits one `select` per element, so
		`m` accesses cost `m * n` instructions: the array gets copied into every
		call site. Above a handful of accesses it is shorter to emit the chain
		once as a helper and call it. A CONSTANT subscript needs no chain at
		all, so those do not count.
		*/
		if (style?.type === 'embedded' && style?.implement === 'divided' && length >= 4) {
			const sites = this.countDynamicSubscripts(symbol.name);
			const perSite = length;			// inline: a `set` plus `n - 1` selects
			const helperCost = 5;			// set index, call, restore the stack
			if (sites >= 2 && sites * perSite > sites * helperCost + (length - 1)) {
				ret.useAccessHelper = true;
			}
		}
		return ret;
	}

	/**
	 * How many places take a NON constant subscript of this array.
	 *
	 * @param {string} name
	 * @returns {number}
	 */
	countDynamicSubscripts(name) {
		if (!this._subscriptCounts) this._subscriptCounts = new Map();
		if (this._subscriptCounts.has(name)) return this._subscriptCounts.get(name);
		let count = 0;
		const seen = new Set();
		const walk = node => {
			if (!node || typeof node !== 'object' || seen.has(node)) return;
			seen.add(node);
			if (Array.isArray(node)) { node.forEach(walk); return; }
			if (node.type === 'MemberExpression' && node.getAttribute?.('computed')
				&& node.children?.[0]?.type === 'Identifier'
				&& node.children[0].name === name) {
				count++;
			}
			for (const key of ['children', 'statements', 'body', 'consequent', 'alternate',
				'test', 'update', 'init', 'expression', 'argument', 'left', 'right',
				'initializer', 'declarators', 'arguments', 'callee', 'functions',
				'globalDeclarations']) {
				const c = node[key];
				if (Array.isArray(c)) c.forEach(walk);
				else if (c && typeof c === 'object') walk(c);
			}
		};
		walk(this.ast);
		this._subscriptCounts.set(name, count);
		return count;
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

		/*
		A remote array: every element is a register of the other processor, so
		the subscript only decides WHICH NAME is read over there.
		*/
		if (object instanceof RemoteArrayRet) {
			const indexNode = node.children[1];
			if (indexNode.type === 'NumericLiteral' && Number.isInteger(Number(indexNode.value))) {
				return object.subscript(Number(indexNode.value));
			}
			return object.subscript(this.visitAndRead(indexNode));
		}
		/*
		A remote array named after a lookup table: `lookup` + `sensor @name`
		produce the element name (identical on both sides), so the subscript
		picks the name and only the final `read` / `write` is remote.
		*/
		if (object instanceof LookupArrayRet && object.deviceReg) {
			const indexNode = node.children[1];
			if (indexNode.type === 'NumericLiteral' && Number.isInteger(Number(indexNode.value))) {
				return object.element(Number(indexNode.value));
			}
			return object.element(this.visitAndRead(indexNode));
		}

		// Registry struct: every member is a variable of its own, named `X.member`
		if (object instanceof RegistryStructRet) {
			/*
			`int *byname ptr` as a member: the register `X.ptr` holds a NAME, so
			the member is a name pointer -- `*s.ptr` is one `read @this`, not a
			step through a block/offset pair that does not exist.
			*/
			if (node.getAttribute('memberByname') === true) {
				return new NamePointerRet(glob, object.instructions ?? [],
					`${object.instructionReturn}.${node.children[1].name}`,
					node.dataType, false);
			}
			const memberInfo = node.memberInfo ?? null;
			if (memberInfo?.isBitfield === true) {
				const storage = object.member(memberInfo.storageName,
					this.semantic.getTypeInfo('int'));
				return new BitfieldRet(glob, storage, node.dataType,
					memberInfo.bitOffset, memberInfo.bitWidth, memberInfo.isSigned);
			}
			return object.member(node.children[1].name, node.dataType);
		}
		/*
		A name-based struct pointer: `p.m` already holds the NAME of the member,
		so `p->m` is one `read @this p.m` and needs no address at all.
		*/
		if (object instanceof NameStructPointerRet) {
			const member = object.member(node.children[1].name, node.dataType);
			/*
			A member that itself carries a NAME: `p->m` reads the name out of
			the struct, and what it reads IS the name -- one word, not a
			block/offset pair. Left as a pointer it was dereferenced through
			`_block` / `_pos`, which for a name are meaningless.
			*/
			if (node.getAttribute?.('memberByname') === true
				|| node.memberInfo?.namePointer === true) {
				const read = member.get();
				return new NamePointerRet(glob, read.instructions, read.instructionReturn,
					node.dataType, true);
			}
			return member;
		}
		/*
		`p->m` on a remote struct pointer: one `read`/`write` of the member name
		this packet carries, against the other processor.
		*/
		if (object instanceof RemoteStructPointerRet) {
			return object.member(node.children[1].name, node.dataType);
		}
		/*
		`(*p).m`: the whole dereference of a name based struct pointer. Its
		members are reached through the names the packet carries.
		*/
		if (object.getAttribute?.('isNameStructDeref') === true) {
			return object.member(node.children[1].name, node.dataType);
		}

		/*
		A struct that a function returned BY VALUE is not in memory either --
		its members are registers named `X.member`, exactly like a registry
		struct. Stepping a pointer (what the code below does) would read
		through a null address, because `getLValue` has no storage to point at
		for a call.
		*/
		const objectType = objectRoot.dataType ?? null;
		const isStructLike = !!objectType
			&& (objectType.kind === 'struct' || objectType.kind === 'union');
		/*
		Only for a CALL: `getLValue` has no storage to hand out for one and
		falls back to `null` (an ImmediateRet). Any other expression keeps the
		behaviour it had, including structs that really are in memory.
		*/
		const hasNoStorage = objectRoot.type === 'FunctionCall';
		if (isStructLike && hasNoStorage) {
			const value = ExportRet(glob, this.visitAndRead(objectRoot), objectType);
			if (!(value instanceof PointerRet)) {
				const holder = new RegistryStructRet(glob, value.instructions,
					value.instructionReturn, objectType, value.temporary);
				return holder.member(node.children[1].name, node.dataType);
			}
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
		} else if (node.hasAttribute('totalSource') && node.hasAttribute('totalMemberOffset')
			&& node.getAttribute('operator') !== '->') {
			// The semantic analyzer already folded `a.b.c` into `a` + a total offset
			/*
			Only for `.`: `h.p->x` is NOT a walk from `h`. `h.p` is a pointer that
			has to be DEREFERENCED first, and folding past the arrow made the base
			`h` itself -- so the member was read at `h_block` / `h_pos`, which do
			not exist for a struct held in registers.
			*/
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
		/*
		A remote struct pointer reaches members by NAME, which needs
		`#pragma optimize(struct_pointer)`. Without it the pointer carries an
		address instead -- and stepping an address on another processor is not
		something the machine can do, so this used to surface as an internal
		error with no hint about the pragma.
		*/
		if (objectAddress instanceof RemotePointerRet && !this.structNamePointerAllowed(
			objectAddress.pointee ?? objectAddress.type?.pointerTo ?? null)) {
			this.addError(`A 'remote' pointer to a struct reaches its members by name, `
				+ `which needs '#pragma optimize(struct_pointer)' (and a flat struct); `
				+ `without it there is no way to step a member on the other processor`,
				node.location ?? null);
			return new MemoryRefRet(glob, [], 'null', node.dataType ?? null, true);
		}
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
		const bitfieldInfo = node.memberInfo ?? null;
		if (bitfieldInfo?.isBitfield === true) {
			return new BitfieldRet(glob, reference, node.dataType,
				bitfieldInfo.bitOffset, bitfieldInfo.bitWidth, bitfieldInfo.isSigned);
		}
		/*
		The same member, but in a struct that lives in memory: the name is READ
		out of the struct first, and only then is it a name pointer.
		*/
		if (node.getAttribute('memberByname') === true) {
			return new MemoryNamePointerRet(glob, reference, node.dataType, true);
		}
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
					if (pointer instanceof RemotePointerRet) {
						// (processor, name): `*p` is `read/write <dev> <name>`
						return pointer.slot();
					}
					if (pointer instanceof RemoteStoredPointerRet) {
						// A pointer stored in the other processor
						return pointer.slot();
					}
					if (pointer instanceof NameStructPointerRet) {
						/*
						`*p` on a name based struct pointer: the members are the
						registers NAMED by p.x, p.y, ... -- not p.x itself.
						*/
						return pointer.deref();
					}
					if (pointer instanceof RemoteStructPointerRet) {
						return pointer.deref();
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
		/*
		A `remote` variable: writing it is `write <device> <name>`. Falling
		through to the register case below would `set` into the DEVICE
		register (`lval.instructionReturn` is the device half), overwriting the
		binding with the value.
		*/
		if (lval.getAttribute?.('isRemoteSlot') === true) {
			result.concat(InstructionBuilder.write('{value_entry}',
				lval.deviceReg ?? `${name}`, lval.nameReg ?? `${name}`));
			result.setAttribute('isAssignment', true);
			return result;
		}
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
		/*
		A function that is ALSO assigned to a function pointer copies its
		parameters out of `__param_N` in the prologue -- so a DIRECT call has to
		deliver into those slots too. Writing straight into the parameter's own
		register instead (which is what a plain call does) was then overwritten
		by that copy, from a slot nobody had filled: the value arrived as 0.
		*/
		if (symbol?.isAddressed === true) {
			return {
				name: `__param_${index}`,
				type: parameter.type.type,
				parameter
			};
		}
		return {
			name: parameter.getAssemblySymbol(),
			type: parameter.type.type,
			parameter
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
	/**
	 * The array view of a symbol, whatever layout it uses.
	 *
	 * A remote array is not covered by `arrayRetFor`: its elements are registers
	 * of ANOTHER processor, so the view has to name that processor instead of
	 * being chosen from the layouts available here.
	 *
	 * @param {import('./mindcSemantic.js').SymbolEntry} symbol
	 * @returns {import('./mindcInfrastructure.js').ArrayRet?}
	 */
	arrayViewOf(symbol) {
		const glob = this.glob;
		/*
		An inlined parameter: the array IS the caller's array. Delegating is
		what keeps the inlined body writing into it -- and what lets a
		non-memory array be inlined at all, since an alias has no layout of
		its own to fall back on.
		*/
		if (symbol?.arrayAliasOf) return this.arrayViewOf(symbol.arrayAliasOf);
		const type = symbol?.myType?.() ?? null;
		if (!type || type.kind !== 'array') return null;
		if (symbol.isRemote === true) {
			const target = symbol.remoteName ?? symbol.remoteTarget?.getAssemblySymbol?.() ?? null;
			if (!target) return null;
			/*
			`remote int rs[]` leaves the length open, so it has to come from the
			array on the other side -- guessing 1 would make every subscript but
			the first land on element 0.
			*/
			let length = arrayLengthOfType(type);
			if (!length || length <= 1) {
				const guessed = symbol.remoteTarget ? this.arrayLengthOf(symbol.remoteTarget) : 0;
				if (guessed > 0) length = guessed;
			}
			return new RemoteArrayRet(glob, remoteDeviceRegOf(symbol.getAssemblySymbol()),
				target, type, length);
		}
		return this.arrayRetFor(symbol, null);
	}

	/**
	 * The name of element `index` of an array value, or the register holding it.
	 *
	 * @param {import('./mindcInfrastructure.js').ArrayRet} array
	 * @param {number} index
	 * @returns {{name: string, dynamic: boolean}?} null when the layout has no
	 *          such element name (an `encoded` array, say)
	 */
	arrayElementNameOf(array, index) {
		if (!array) return null;
		// The elements are registers of another processor, named `<array>_<i>`
		if (array instanceof RemoteArrayRet) {
			return { name: `${array.targetAssembly}_${index}`, dynamic: false };
		}
		// Named after content constants (`copper`, `lead`, ...) -- same everywhere
		if (array instanceof LookupArrayRet) {
			return { name: array.names?.[index] ?? null, dynamic: false };
		}
		// Already a by-name array: the name is itself in a register
		if (array instanceof NameArrayRet) {
			return { name: array.elementName(index), dynamic: true };
		}
		if (typeof array.elementName === 'function') {
			return { name: array.elementName(index), dynamic: false };
		}
		return null;
	}

	deliverArgument(slotName, slotType, argument, paramSymbol = null, argNode = null) {
		const glob = this.glob;
		// `get()` + `materialize()`: the argument ends up in a temporary symbol of
		// its own, so that evaluating the *next* argument (which may call a function,
		// possibly this very one) cannot clobber it.
		const value = argument.get().materialize();
		/*
		An array handed to a parameter that takes NAMES: store the NAME of every
		element (see NameArrayRet). This is what makes an access inside the
		function reach the CALLER's array rather than a copy -- and it is the only
		thing that CAN be handed over, because a non-memory array has no address.
		*/
		const representation = paramSymbol?.arrayParamRep ?? null;
		const argSymbol = (argNode && argNode.type === 'Identifier')
			? (this.currentScope?.lookup?.(argNode.name)
				?? this.semantic?.globalScope?.lookup?.(argNode.name) ?? null)
			: null;
		const argIsArray = !!argSymbol && argSymbol.myType?.()?.kind === 'array';
		/*
		How an array travels is decided by the SLOT it goes into, not by the call
		site -- an indirect call has no call-site information at all, since the
		callee is a register holding a line number:
		  - a parameter marked `handle` / `remote` / `names`, or one whose type is
		    declared `remote`, takes a HANDLE (two helper entry points). That is
		    the only form an array without an address can travel as, and it is
		    also accepted from a memory array;
		  - anything else takes a POINTER.
		*/
		/*
		`remote int s[4]`: on an array the qualifier sits on the ELEMENT level
		(`remote int` is the element type), so both levels have to be looked at.
		*/
		const slotWantsHandle = !!slotType
			&& ((slotType.qualifiers ?? []).includes('remote')
				|| (slotType.pointerTo?.qualifiers ?? []).includes('remote'));
		/*
		`int s[]` carries no length of its own, so a pointer handed into that slot
		cannot say how many elements lie behind the offset -- and `lenof` on it
		would answer 0. The handle is the one form that keeps the length, so a
		slot with an open dimension wants one whatever else it looks like.

		This is the same thing `finalizeArrayParameters` decides from the
		declaration, and it has to be repeated here: through a function pointer
		`paramSymbol` is null and the slot's own type is all there is to go on.
		*/
		const slotHasOpenDimension = slotType?.kind === 'array'
			&& !Number.isFinite(Number(arrayLengthOfType(slotType)));
		const wantsHandle = argIsArray && !!slotType && slotType.kind === 'array'
			&& (representation === 'handle' || representation === 'remote'
				|| representation === 'names' || slotWantsHandle || slotHasOpenDimension);

		if (wantsHandle) {
			/*
			`arrayViewOf` cannot describe a MEMORY array (it has no pointer to
			build the view from), so one is built from the value that was just
			materialised -- for an array that value IS its address.
			*/
			let array = null;
			/*
			`arrayViewOf` cannot describe a memory array at all (it builds the
			view from a pointer it is never given), so ask first.
			*/
			if (this.arrayStyleFor(argSymbol)?.type !== 'traditional') {
				array = this.arrayViewOf(argSymbol);
			}
			if (!array && value instanceof PointerRet) {
				const length = arrayLengthOfType(slotType) || this.arrayLengthOf(argSymbol) || 0;
				array = new TraditionalArrayRet(glob, value, slotType ?? argSymbol.myType?.(), length);
			}

			/*
			A handle as the argument of a handle: a handle PARAMETER, or an unbound
			handle that has already been bound. The view in hand is the packed
			handle -- the helper entry points, the length and the element size --
			so it travels as itself, and there is nothing left to pack. Packing it
			again is not merely wasteful: the helpers are line numbers of THIS
			program, and there is no array behind the value to ask about.
			*/
			if (array instanceof ArrayHandleRet) {
				return new ArrayHandleRet(glob, slotName, slotType, array.length,
					[value.instructions, array.instructions,
						InstructionBuilder.set(slotName, array.name)]);
			}

			const handle = array ? ensureArrayHandle(glob, array) : null;
			if (!handle) {
				throw new InternalGenerationFailure(
					`Array '${argNode.name}' cannot be handed to a function: `
					+ `it has no representation that travels as a value`, argNode.location);
			}
			const length = arrayLengthOfType(slotType) || array.length || 0;
			const instructions = [value.instructions, handle.instructions,
				packHandle(glob, slotName, { ...handle, length })];
			return new ArrayHandleRet(glob, slotName, slotType, length, instructions);
		}
		/*
		An indirect call whose slot expects a POINTER: a memory array has one, so
		it falls through to the ordinary delivery below. One that does not cannot
		be turned into an address, and the fixed `__param_N` slots cannot carry a
		per-element description either -- say so instead of emitting code that
		silently reads a block/offset pair nobody assigned.
		*/
		if (!paramSymbol && argIsArray && !!slotType && slotType.kind === 'array') {
			const style = this.arrayStyleFor(argSymbol);
			if (style?.type !== 'traditional') {
				throw new InternalGenerationFailure(
					`Array '${argNode.name}' has no address, so it cannot be handed to a `
					+ `function pointer whose parameter is an ordinary array: declare that `
					+ `parameter 'remote' (it then travels as a handle), or give the array a `
					+ `memory layout`, argNode.location);
			}
		}
		/*
		A struct handed over BY VALUE: it is copied member by member, because the
		members do not all travel the same way -- one carrying a name is a single
		word, while the rest may be a block/offset pair. A plain `set` copied one
		word and left everything else behind, which is what lost the
		representation when the callee was not inlined.
		*/
		if (!!slotType && ['struct', 'union'].includes(slotType.kind)
			&& !(slotType.qualifiers ?? []).includes('remote')) {
			const srcType = argSymbol?.myType?.() ?? null;
			const srcName = argSymbol?.getAssemblySymbol?.()
				?? value.instructionReturn ?? null;
			if (srcName && srcType && ['struct', 'union'].includes(srcType.kind)) {
				const copied = this.copyStruct(slotName, srcName, slotType, srcType);
				return valueClassOf(glob, slotType).create(glob,
					[value.instructions, copied], slotName, slotType, false);
			}
		}
		/*
		A name based struct pointer: what travels is the SET OF NAMES, one per
		member. `rename` would only retarget `X_block` / `X_pos`, which do not
		exist here, so every member name is copied on its own.
		*/
		if (value instanceof RemoteStructPointerRet) {
			const members = (slotType?.pointerTo?.members ?? []).map(m => m.name ?? m.memberName);
			const instructions = [value.instructions,
				InstructionBuilder.set(`${slotName}__rdev`, value.deviceReg)];
			for (const m of members) instructions.push(InstructionBuilder.set(`${slotName}.${m}`, `${value.name}.${m}`));
			return new RemoteStructPointerRet(glob, `${slotName}__rdev`, slotName, slotType, instructions);
		}
		/*
		A pointer to a struct that has a NAME member: even when the pointer
		itself is an address, reading `p->m` yields a name, and the callee has
		to know that. Without `byname` on the parameter the member was read as
		a block/offset pair that does not exist, which used to be emitted
		silently.
		*/
		{
			const inner = slotType?.pointerTo ?? null;
			if (inner && ['struct', 'union'].includes(inner.kind)
				&& (inner.members ?? []).some(m => m.namePointer === true)
				&& paramSymbol && paramSymbol.forcedNamePointer !== true
				&& paramSymbol.usesNamePointer !== true) {
				this.addError(`a pointer to '${inner.name}' hands over a member that carries `
					+ `a NAME, so the parameter has to be declared 'byname' `
					+ `(as in 'void f(${inner.name} *byname p)')`,
					argNode?.location ?? null);
				return new Instruction([]);
			}
		}
		if (value instanceof NameStructPointerRet
			|| value.getAttribute?.('isNameStructPointer') === true) {
			const members = (slotType?.pointerTo?.members ?? [])
				.map(m => m.name ?? m.memberName);
			const instructions = [value.instructions];
			/*
			`&s` written straight into a call: there is no pointer variable for
			the names to have been stored in, so the packet the value names is
			still EMPTY -- copying `s__ptr.x` out of it copied nothing, and the
			callee then wrote through an unassigned name. Materialise the names
			from the struct itself when the packet carries no instructions.
			*/
			/*
			The callee has to AGREE that the pointer carries names: it reads
			`p->x` differently then. That is what `byname` on the parameter
			says. Without it the pointer is an address, and writing through the
			block/offset pair that was never assigned used to be emitted
			silently.
			*/
			if (paramSymbol && paramSymbol.forcedNamePointer !== true
				&& paramSymbol.usesNamePointer !== true) {
				this.addError(`'&${String(argNode?.argument?.name ?? 'struct')}' hands a struct `
					+ `pointer that carries member NAMES, so the parameter has to be `
					+ `declared 'byname' (as in 'void f(struct pt *byname p)')`,
					argNode?.location ?? null);
				return new Instruction([]);
			}
			const from = value.sourceBase ?? null;
			if (from) {
				for (const m of members) {
					instructions.push(InstructionBuilder.set(`${slotName}.${m}`, `"${from}.${m}"`));
				}
			} else {
				for (const m of members) {
					instructions.push(InstructionBuilder.set(`${slotName}.${m}`, `${value.name}.${m}`));
				}
			}
			return new NameStructPointerRet(glob, instructions, slotName, slotType, false);
		}
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
		/*
		`lenof(s)` where `s` is an array that arrived as a HANDLE: the length
		rides in the packed register. Folding it at compile time answered 0,
		because a parameter's type carries no length.
		*/
		const handleLen = node.getAttribute?.('lenofOfHandle') ?? null;
		if (handleLen) {
			const tmp = glob.tmp(this.semantic.getTypeInfo('int'), 'handle');
			const tn = tmp?.getAssemblySymbol?.() ?? String(tmp);
			const instrs = [
				InstructionBuilder.op('shr', tn, handleLen, String(HANDLE_FIELD_BITS * 2)),
				InstructionBuilder.op('and', tn, tn, String(HANDLE_MASK))
			];
			return new IntRet(glob, instrs, tn, this.semantic.getTypeInfo('int'), true);
		}
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
			result.concat(this.deliverArgument(slot.name, slot.type, value,
				slot.parameter ?? null, argument));
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
		if (symbol.isEnumConstant === true && typeof symbol.constantValue === 'number') {
			return new ImmediateRet(glob, String(symbol.constantValue), node.dataType ?? symbol.myType());
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
		/*
		A single-quoted literal is an `int` holding its ASCII code (7.1), so what
		the program gets is the NUMBER. The `raw` text is kept on the node (and
		by the optimizer's clone) for diagnostics, not emitted.
		*/
		const code = (node.value ?? '').codePointAt(0) ?? 0;
		return new Instruction([], `${code}`, new Map([['disallowReplacement', true]]));
	}

	visitNullLiteral(node) {
		return new Instruction([], 'null', new Map([['disallowReplacement', true]]));
	}

	/**
	 * Normalise a list of instructions that is about to be handed to a value
	 * class: drop empty slots and flatten a nested array, so that printing the
	 * program never meets an element without `referrer`.
	 *
	 * @param {any} list
	 * @returns {any[]}
	 */
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
		/*
		`lenof(s)` on an array that arrived as a HANDLE: `lenof` is a builtin
		call, so it lands here rather than in `visitFunctionCall`. See the note
		there for why it cannot be folded.
		*/
		const handleLen = node.getAttribute?.('lenofOfHandle') ?? null;
		if (handleLen) {
			const glob = this.glob;
			const tmp = glob.tmp(null, 'handle');
			const tn = tmp?.getAssemblySymbol?.() ?? String(tmp);
			return new IntRet(glob, [
				InstructionBuilder.op('shr', tn, handleLen, String(HANDLE_FIELD_BITS * 2)),
				InstructionBuilder.op('and', tn, tn, String(HANDLE_MASK))
			], tn, this.semantic.getTypeInfo('int') ?? null, true);
		}

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
					// `&x` naming a register: the builtin writes into it directly
					const outputName = this.builtinOutputName(ast);
					if (outputName) {
						varNames.push(outputName);
						vid++;	// keep the numbering of the other operands
						return new Instruction();
					}
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
		/*
		A3: `floor`/`ceil` always return an integer, and `abs`/`min`/`max`
		do when every argument is already an integer. Returning an IntRet
		here stops the assignment/conversion path from adding a redundant
		`op floor`.
		*/
		const integralOpProcesser = (name, params, integral) => {
			const result = opProcesser(name, params);
			if (!integral) return result;
			return new IntRet(this.glob, result.instructions, result.instructionReturn,
				this.semantic.getTypeInfo('int'), true);
		};
		const allIntegerArgs = params => (params ?? []).length > 0
			&& params.every(param => {
				const type = param?.dataType;
				return !!type && (this.semantic.isIntegerType(type.name) || type.name === 'bool');
			});

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
			printf: ast => {
				/*
				`printf` is a compiler builtin because ordinary user functions
				cannot be variadic. The format must be a literal: it is parsed
				here, turned into one `print` with `{n}` placeholders, and each
				argument is emitted as a `format`.
				*/
				const result = new Instruction();
				const fmtNode = ast.arguments?.[0];
				const values = ast.arguments?.slice(1) ?? [];
				if (!fmtNode || fmtNode.type !== 'StringLiteral') {
					this.addError('printf format must be a string literal', ast.location);
					return result;
				}
				const format = String(fmtNode.value ?? '');
				let text = '';
				let valueIndex = 0;
				const formats = [];
				for (let i = 0; i < format.length;) {
					const ch = format[i++];
					if (ch !== '%') { text += ch; continue; }
					if (format[i] === '%') { text += '%'; i++; continue; }
					// Skip optional flags/width/precision; they are accepted but
					// not applied yet (mlog format has no field width).
					while (i < format.length && /[-+ 0#]/.test(format[i])) i++;
					while (i < format.length && /[0-9]/.test(format[i])) i++;
					if (format[i] === '.') {
						i++;
						while (i < format.length && /[0-9]/.test(format[i])) i++;
					}
					const conversion = format[i++] ?? '';
					if (!['d', 'i', 'u', 'f', 's'].includes(conversion)) {
						this.addError(`Unsupported printf conversion '%${conversion}'`, ast.location);
						return result;
					}
					if (valueIndex >= values.length) {
						this.addError('printf has fewer arguments than its format needs', ast.location);
						return result;
					}
					const arg = values[valueIndex++];
					const printed = ['d', 'i', 'u'].includes(conversion)
						? this.implicitToNumeric(arg)
						: this.visitAndRead(arg);
					formats.push({ instruction: printed, name: printed.instructionReturn });
					text += `{${formats.length - 1}}`;
				}
				if (valueIndex < values.length) {
					this.addError('printf has more arguments than its format uses', ast.location);
					return result;
				}
				if (text.length > 0) {
					result.concat(InstructionBuilder.print(JSON.stringify(text)));
				}
				formats.forEach(entry => {
					result.concat(entry.instruction);
					result.concat(InstructionBuilder.format(entry.name));
				});
				return result;
			},
			assert: ast => {
				const condition = ast.arguments?.[0];
				if (!condition || ast.arguments.length !== 1) {
					this.addError('assert() takes exactly one expression', ast.location);
					return new Instruction();
				}
				const tester = this.visitAndRead(condition);
				const jumper = InstructionBuilder.jump('{assert_ok}', 'notEqual',
					tester.instructionReturn, 'false');
				const line = ast.location?.line ?? 0;
				const message = `assertion failed at line ${line}`;
				const result = new Instruction([
					tester,
					jumper,
					InstructionBuilder.print(JSON.stringify(message)),
					InstructionBuilder.stop(),
					new InstructionReferrer(jumper, 'assert_ok')
				]);
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
						// `&x` naming a register: ulocate writes into it directly
						const outputName = this.builtinOutputName(ast.arguments[i]);
						if (outputName) {
							preConcat += ` ${outputName}`;
							continue;
						}
						const argContent = this.visitForContent(ast.arguments[i]);
						/*
						The instructions that COMPUTE the address used to be dropped
						here, so the pointer halves were never written.
						*/
						result.concat(argContent);
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
				return integralOpProcesser(`min`, ast.arguments, allIntegerArgs(ast.arguments));
			},
			max: ast => {
				return integralOpProcesser(`max`, ast.arguments, allIntegerArgs(ast.arguments));
			},
			abs: ast => {
				return integralOpProcesser(`abs`, ast.arguments, allIntegerArgs(ast.arguments));
			},
			ceil: ast => {
				return integralOpProcesser(`ceil`, ast.arguments, true);
			},
			floor: ast => {
				return integralOpProcesser(`floor`, ast.arguments, true);
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
				/*
				`read r <building> i` fetches one cell of an arbitrary memory
				building -- including one that is NOT linked to this processor,
				which is the whole point of having it.
				*/
				return packer('read', ast.arguments, this.semantic.getTypeInfo('null_t'), 2);
			},
			byname: ast => {
				/*
				`byname(&c)` -- the same thing as `&c` under
				`#pragma optimize(pointer)`, but asked for here.
				*/
				const inner = ast.arguments?.[0];
				if (!inner || inner.type !== 'UnaryExpression' || inner.operator !== '&') {
					throw new InternalGenerationFailure('byname() needs the address of a variable', ast);
				}
				return this.processLValGetter(inner.argument, true);
			},
			stricteq: ast => {
				/*
				`op strictEqual` is the only comparison that also compares the
				TYPE, so it is what `null` has to be told apart from `0` with.
				It accepts operands of any type.
				*/
				return packer('op strictEqual', ast.arguments, this.semantic.getTypeInfo('bool'), 2);
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
				/*
				A pointer is `X_block` / `X_pos` and `_block` must be a NUMBER,
				because pointers end up in memory (and memory only holds
				numbers). The building itself is an object, so it has to be
				turned into its link index first.
				*/
				const direct = this.staticDeviceLinkId(ast.arguments[0]);
				if (direct) {
					result.concat(InstructionBuilder.set(`${returner}_block`, direct));
				} else {
					const blockRef = this.visitAndRead(ast.arguments[0]);
					result.concat(blockRef);
					const helper = ensureMemspHelper(this.glob);
					result.concat(this.functionManagement.getFunctionCall(helper,
						new Map([['__memsp_dev', blockRef.instructionReturn]]), this.memory));
					result.concat(InstructionBuilder.set(`${returner}_block`, '__memsp_ret'));
				}
				// After the call, so that the helper cannot clobber it
				const posRef = this.visitAndRead(ast.arguments[1]);
				result.concat(posRef);
				result.concat(InstructionBuilder.set(`${returner}_pos`, posRef.instructionReturn));
				result.concat(this.writeSymbol(returningSymbol, returner));
				result.instructionReturn = returningSymbol.getAssemblySymbol();
				result.setAttribute('isPointer', true);
				return result;
			},
			/*
			`vecalias(&a, b)`: the binding of Phase 5, written as an intrinsic.
			The `&` has already been turned into a one-word NAME pointer to the
			cell by `visitUnaryExpression`, so what is left is the array's handle
			packed into that one register -- the same body `a = b;` gets, and the
			same cost: one store once `packHandle` has done its three or four
			instructions.

			It is an intrinsic rather than a function for a reason that shows up
			here: as a function it would have to be handed `b` as an ARRAY
			argument, and the delivery machinery would try to alias the caller's
			array to a parameter -- which is exactly the thing a handle cannot be.
			*/
			vecalias: ast => {
				return this.emitVecAlias(ast);
			},
			/*
			`veccpy(a, b)`: an element loop. Both layouts are turned into views,
			which is what makes the copy work the same whatever they are -- a
			loop that knew about memory blocks and registers separately would be
			two copies of the same loop, and one of them would rot.

			The bound is the SMALLER of the two lengths. When a length is only in
			a packed handle it cannot be known here, and a source longer than the
			destination would otherwise run past its end -- so the loop stops at
			whichever runs out first. When both are static the front end has
			already refused `M > N`, so this is a belt to that pair of braces.
			*/
			veccpy: ast => {
				return this.emitVecCopy(ast);
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
