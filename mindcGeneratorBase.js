/*
 * The code-generation back end: the instruction classes (re-exported from
 * `mindcInstruction.js`, which is where they are defined and why) followed by
 * function registration, memory blocks and the memory manager.
 *
 * The split is not cosmetic. This module and `mindcSemantic.js` import each
 * other, so either one can be only part-way through its own body when the
 * other runs; anything declared at module scope that depends on a binding
 * from the other is then reading the temporal dead zone. `VariableRet` in
 * `mindcInfrastructure.js` reads `Instruction` that way, so `Instruction`
 * lives in a module that is in no cycle. See `mindcInstruction.js`.
 *
 * `SymbolEntry` below is the one dependency on `mindcSemantic.js`, and it is
 * a run time one: `FunctionRegisterer` makes the compiler's own stack
 * symbols, and nothing here reads it while the module body runs.
 */

import { SymbolEntry } from "./mindcSemantic.js";
import {
	Instruction, InstructionBuilder, InstructionReferrer, InstructionReferrerException,
	SingleInstruction, EmptyInstruction
} from "./mindcInstruction.js";

/* Kept importable from here, so the two halves stay one thing to import. */
export {
	Instruction, InstructionBuilder, InstructionReferrer, InstructionReferrerException,
	SingleInstruction, EmptyInstruction
};

// Combine logical components
// (TODO)

// Register function and generate corresponding function declaration
// Notice that function positions are recorded by variables
// (for more flexible jumpers)
/**
 * @typedef {{body: Instruction, scope: Scope, preservedStack: SymbolEntry,
 * 			stackSymbols: SymbolEntry[], stackTotal: number, specialBuiltin: boolean, recursive: boolean | undefined, calls: number}} functionInfo
 */
/**
 * How much stack a symbol needs in a recursive function.
 *
 * An ordinary symbol needs room for its value. A POINTER-VALUED one
 * (`implementAsPointer` without `accessThroughPointer`: an array, or a pointer)
 * needs two words *more*: its value is the pair `X_block` / `X_pos`, and that
 * pair lives in registers, so a nested call would overwrite it. The extra two
 * words are the slot `X.__pointer` where the pair is stashed and restored.
 *
 * @param {SymbolEntry} symbol
 * @returns {number}
 */
export function stackFrameSizeOf(symbol) {
	return (symbol.size != null) ? symbol.size : 0;
}
/**
 * Whether the symbol's value has to be written to (and read back from) a save
 * slot when a recursive call happens.
 *
 * A symbol whose value *is* an address into the frame (`implementAsPointer`
 * without `accessThroughPointer`: an array, say) needs nothing: after the frame
 * pointer has been rolled back, walking the frame again yields exactly the same
 * address. Everything else lives in a register that the nested call overwrites,
 * so it has to be saved.
 *
 * @param {SymbolEntry} symbol
 * @returns {boolean}
 */
export function needsSaveSlot(symbol) {
	/*
	Only an ARRAY / STRUCT / UNION is laid out inside the frame: its `X_block` /
	`X_pos` *are* its address, so walking the frame again reproduces them
	exactly. A POINTER symbol is different -- its two words hold a VALUE (the
	thing it points at), which is not recoverable and must be saved.
	*/
	const kind = symbol.myType?.()?.kind ?? null;
	/*
	An array's value IS its address, so walking the frame reproduces it -- even
	when the array is marked "accessed through a pointer" (taking `&a[1]` does
	that), `X.__pointer` is only a slot for that address, not the data itself.
	*/
	if (kind === 'array') return false;
	if (['struct', 'union'].includes(kind) && !symbol.accessThroughPointer) return false;
	return true;
}

/**
 * Read or write the cell that `outputPointerForwardCall(..., doSet = false)`
 * left behind.
 *
 * That call leaves its result in `__ptrblock` / `__ptrpos` -- note there is NO
 * underscore before "block". `outputPointerFetchOf('__ptr', ...)` would look
 * for `__ptr_block` / `__ptr_pos`, which nothing ever writes, so the advanced
 * address has to be used through these helpers instead.
 *
 * @param {string} data
 * @returns {Instruction}
 */
export function readAtAdvancedPointer(data) {
	return InstructionBuilder.reads(data, '__ptrblock', '__ptrpos');
}

/**
 * @param {string} data
 * @returns {Instruction}
 */
export function writeAtAdvancedPointer(data) {
	return InstructionBuilder.writes(data, '__ptrblock', '__ptrpos');
}

/**
 * What to do when the stack cannot grow any further.
 *
 * @param {string|boolean|undefined} stackCheck
 * @returns {Instruction[]}
 */
function overflowHandlerOf(stackCheck) {
	if (typeof stackCheck === 'string' && stackCheck.length > 0) {
		return callHandlerOf(stackCheck);
	}
	if (stackCheck === false) {
		/*
		`#pragma stackcheck()`: the walker does not WATCH for overflow -- no
		message is written to `__error` and no handler is called, running out
		is the program's own contract violation. But it still stops cleanly at
		the end of the chain instead of crossing into `next block = -1` and
		reading through the null link (that trap is what "no check" used to
		produce).
		*/
		return [
			InstructionBuilder.end()
		];
	}
	return [
		// Nothing is printed: whether a message board is connected is unknown
		InstructionBuilder.set('__error', '"stack overflow"'),
		InstructionBuilder.end()
	];
}

/**
 * Call `handler` and then leave the walker, whatever it returned.
 *
 * The frame being allocated is half-consumed when the chain ends (the next
 * block was read and is unusable), so there is nowhere safe to continue it.
 * The handler therefore returns straight into the `end` that follows: the
 * handler reports, and the walker stops. (`@counter` reads as the NEXT
 * instruction here, so `op add __stackpos @counter 1` from instruction N
 * points the handler's return address at N+2 -- the `end`.)
 *
 * @param {string} handler
 * @returns {Instruction[]}
 */
function callHandlerOf(handler) {
	return [
		InstructionBuilder.op('add', '__stackpos', '@counter', 1),
		InstructionBuilder.set('@counter', '_' + handler),
		InstructionBuilder.end()
	];
}

export class FunctionRegisterer {
	/**
	 * 
	 * @param {MemoryManager} memoryObject 
	 */
	constructor(memoryObject, stackCheck = undefined, stackUnderflow = undefined) {
		this.stackCheck = stackCheck;
		this.stackUnderflow = stackUnderflow;
		/**
		 * @type {Map<string, functionInfo>}
		 */
		this.functionCollection = new Map();
		this.callerId = 0;
		this.memoryObject = memoryObject;

		if (this.memoryObject.memoryBlocks.length > 0) {
			/*
			All three are registered as removable: a program whose functions keep
			nothing on the stack never calls them, and they are then dropped
			instead of being emitted as dead code.
			*/
			memoryObject.outputPointerForwardFunction(this, '__stackframe_forward', '__stackframe_', true, stackCheck);
			memoryObject.outputPointerBackwardFunction(this, '__stackframe_backward', '__stackframe_', true, stackUnderflow);
			memoryObject.outputNearFitFunction(this, '__nearFit', '__ptr', true, stackCheck);
		}
	}
	
	// stackSymbols are symbol entries
	/**
	 * 
	 * @param {string} name 
	 * @param {Instruction} body 
	 * @param {Scope} scope The scope should be function scope
	 * @param {List<SymbolEntry>} stackSymbols 
	 * @param {string[]} [givenStackSymbols=[]] 
	 * @param {boolean} [recursive=false] 
	 * @param {boolean} [specialBuiltin=false] 
	 * @param {boolean} [removable=false] 
	 * @remark These two symbols won't be analyzed, so they're safe
	 */
	addFunction(name, body, scope = null, givenStackSymbols = [], specialBuiltin = false, recursive = false, removable = false) {
		if (recursive) {
			specialBuiltin = false;
		}
		let stackTotal = 0;
		let stackSymbols = [ ...givenStackSymbols ];
		if (recursive) {
			stackSymbols.push(new SymbolEntry('__stackpos', '__builtin_int', scope, 'variable', null, 1));
		}
		stackSymbols.forEach(element => {
			stackTotal += stackFrameSizeOf(element);
		});
		let preservedStack = null;
		// Meaningless:
		if (scope) {
			preservedStack = new SymbolEntry('__preserved_stackpos', '__builtin_int', scope, 'variable', null, 1);
			scope.addSymbol(preservedStack);
			// Otherwise, you have to manually guarantee that you won't modify stackpos inside!
		}
		this.functionCollection.set(name, {
			body: body,
			scope: scope,
			preservedStack: preservedStack,
			stackSymbols: stackSymbols,
			stackTotal: stackTotal,
			specialBuiltin: specialBuiltin,
			recursive: recursive,
			calls: removable ? 0 : 1
		});
	}

	/**
	 * @param {MemoryManager} memoryObject The manager shall be after heap memory allocation
	 * @remark This adds stack initializer, etc.
	 */
	getSystemInitializer(memoryObject) {
		const memoryState = memoryObject.currentState();
		const header = memoryState.getAssignmentInstruction('__stackframe');
		return header;
	}

	/**
	 * Get stack storage of the function.
	 * WHEN CALLING THIS, IT IS ASSUMED THAT all relevant symbols in the function are "accessThroughPointer".
	 * @param {string} functionName 
	 * @todo
	 */
	getFunctionStackStorage(functionName) {
		const func = this.functionCollection.get(functionName);
		/**
		 * 
		 * @param {SymbolEntry} symbol 
		 * @returns {Instruction[]}
		 */
		const mapper = symbol => {
				if (symbol.name === '__stackpos') return [];
				if (!needsSaveSlot(symbol)) return [];	// Re-derived from the frame
				if (symbol.implementAsPointer) {
					return [
						this.memoryObject.outputPointerStorageOf(`${symbol.getAssemblySymbol()}.__pointer`, `${symbol.getAssemblySymbol()}_block`),
						this.memoryObject.outputPointerForwardCall(1, `${symbol.getAssemblySymbol()}.__pointer`, this, false, false),
						writeAtAdvancedPointer(`${symbol.getAssemblySymbol()}_pos`)
					];
				} else {
					return [this.memoryObject.outputPointerStorageOf(`${symbol.getAssemblySymbol()}.__pointer`, symbol.getAssemblySymbol())];
				}
				
			};
		return new Instruction(func.stackSymbols.flatMap(mapper));
	}
	
	getFunctionStackRollback(functionName) {
		const totalStackframeSize = this.functionCollection.get(functionName).stackTotal;
		return this.getFunctionCall('__stackframe_backward', new Map([['__step', totalStackframeSize]]), null);
	}

	/**
	 * Allocating heap memory for function symbols.
	 * @param {string} functionName 
	 * @param {boolean | null} [setStackpos=true] 
	 * @param {boolean} [noRecursive=false] 
	 * @returns {Instruction}
	 */
	getFunctionStackAssignment(functionName, setStackpos = true, noRecursive = false) {
		const dynamicSetStackpos = (setStackpos === null);
		/**
		 * @type {functionInfo}
		 */
		const func = this.functionCollection.get(functionName);
		const refFunction = func;
		let heapPreparation = new Instruction();
		let totalStackframeSize = 0;
		let stackPositionPointer = null;
		/*
		if (refFunction.specialBuiltin) {
			heapPreparation.concat(InstructionBuilder.set('__internal_stackpos', '__stackpos'));
		}
			*/
		refFunction.stackSymbols.forEach(symbol => {
			// So pointer-forward and -backward can't have stack symbols!
			totalStackframeSize += stackFrameSizeOf(symbol);
			const memFwdCall = this.getFunctionCall('__stackframe_forward', new Map([['__step', symbol.size]]), null);
			/*
			A `near` symbol must lie completely inside ONE block, so the frame is
			first walked forward to a position that can hold all of it. The walk
			lands on a stack overflow when no block is large enough.
			*/
			if (symbol.isNearPointer === true) {
				const nearFit = this.getFunctionCall('__nearFit', new Map([
					['__ptrblock', '__stackframe_block'],
					['__ptrpos', '__stackframe_pos'],
					['__step', symbol.size]
				]), null);
				nearFit.concat(new Instruction([
					InstructionBuilder.set('__stackframe_block', '__ptrblock'),
					InstructionBuilder.set('__stackframe_pos', '__ptrpos')
				]));
				heapPreparation.concat(nearFit);
			}
			//memoryObject.outputPointerForwardCall(symbol.size, '__stackframe', this);
			// This has even taken array into account
			if (!needsSaveSlot(symbol)) {
				/*
				An array / struct / union: its two words ARE its address, so they
				are simply recomputed here. Everything else gets a save slot
				(`X.__pointer`) whose address is recorded the same way.
				*/
				heapPreparation.concat(new Instruction([
					InstructionBuilder.set(`${symbol.getAssemblySymbol()}_block`, '__stackframe_block'),
					InstructionBuilder.set(`${symbol.getAssemblySymbol()}_pos`, '__stackframe_pos')
				]));
			} else {
				heapPreparation.concat(new Instruction([
					InstructionBuilder.set(`${symbol.getAssemblySymbol()}.__pointer_block`, '__stackframe_block'),
					InstructionBuilder.set(`${symbol.getAssemblySymbol()}.__pointer_pos`, '__stackframe_pos')
				]));
			}
			
			heapPreparation.concat(memFwdCall);
			if (symbol.name === '__stackpos') {
				stackPositionPointer = symbol.getAssemblySymbol();
			}
		});

		const outSetStackpos = () => {
			let temp = new Instruction();
			if (func.preservedStack) {
				temp.concat(this.memoryObject.outputPointerStorageOf(`${stackPositionPointer}.__pointer`, func.preservedStack.getAssemblySymbol()));
			} else {
				temp.concat(this.memoryObject.outputPointerStorageOf(`${stackPositionPointer}.__pointer`, '__internal_stackpos'));
			}
			return temp;
		};
		const outResetStackpos = () => {
			let temp = new Instruction();
			if (func.preservedStack) {
				temp.concat(this.memoryObject.outputPointerFetchOf(`${stackPositionPointer}.__pointer`, func.preservedStack.getAssemblySymbol()));
			} else {
				temp.concat(this.memoryObject.outputPointerFetchOf(`${stackPositionPointer}.__pointer`, '__internal_stackpos'));
			}
			// Requires something more for resetting
			refFunction.stackSymbols.forEach(symb => {
				if (symb.name === '__stackpos') return;	// Already considered
				if (!needsSaveSlot(symb)) return;		// Re-derived from the frame
				const name = symb.getAssemblySymbol();
				if (symb.implementAsPointer) {
					/*
					Two words, matching what `getFunctionStackStorage` wrote:
					`X_block` at `X.__pointer`, `X_pos` one cell further on. This
					is true for a pointer stored in memory as well, whose value is
					also the pair `X_block` / `X_pos`.
					*/
					temp.concat(this.memoryObject.outputPointerFetchOf(`${name}.__pointer`, `${name}_block`));
					temp.concat(this.memoryObject.outputPointerForwardCall(1, `${name}.__pointer`, this, false, false));
					temp.concat(readAtAdvancedPointer(`${name}_pos`));
				} else {
					temp.concat(this.memoryObject.outputPointerFetchOf(`${name}.__pointer`, name));
				}
			});
			return temp;
		};

		if (dynamicSetStackpos) {
			const jumper = InstructionBuilder.jump('{set_stackpos_end}', 'equal', '__set_stackpos', 'false');
			const terminate = InstructionBuilder.jump('{set_stackpos_term}', 'always');
			heapPreparation.concat(jumper);
			heapPreparation.concat(outSetStackpos());
			heapPreparation.concat(terminate);
			heapPreparation.concat(new InstructionReferrer(jumper, 'set_stackpos_end'));
			heapPreparation.concat(outResetStackpos());
			heapPreparation.concat(new InstructionReferrer(terminate, 'set_stackpos_term'));
		} else if (setStackpos) {
			if (!noRecursive) heapPreparation.concat(outSetStackpos());
		} else {
			heapPreparation.concat(outResetStackpos());
		}
				

		// End
		/*
		if (func.preservedStack) {
			const outSetStackpos = () => InstructionBuilder.set(func.preservedStack.getAssemblySymbol(), '__internal_stackpos');
			heapPreparation.concat(outSetStackpos());
			
			
			if (dynamicSetStackpos) {
				const jumper = InstructionBuilder.jump('{set_stackpos_end}', 'equal', '__set_stackpos', 'false');
				heapPreparation.concat(jumper);
				heapPreparation.concat(outSetStackpos());
				heapPreparation.concat(new InstructionReferrer(jumper, 'set_stackpos_end'));
			} else if (setStackpos) {
				
			}
			
			
		}
			*/
		return heapPreparation;
	}

	/**
	 * 
	 * @param {string} functionName
	 * @returns {Instruction}
	 * @remarks This rollback is also used for default function returning!
	 */
	getRollbackCall(functionName) {
		const func = this.functionCollection.get(functionName);
		if (!func.recursive) {
			throw new InternalGenerationFailure(`Function ${functionName} does not support recursive call`);
		}
		// This is a CALL insteaad of a output
		return new Instruction([
			InstructionBuilder.set('__set_stackpos', 'false'),
			InstructionBuilder.op('add', '__builtin_return_pos', '@counter', 1),
			InstructionBuilder.set('@counter', `_${functionName}__builtin_mem`)
		]);
	}

	/**
	 * 
	 * @param {string} functionName
	 * @returns {Instruction}
	 */
	getPreservationCall(functionName) {
		const func = this.functionCollection.get(functionName);
		if (!func.recursive) {
			throw new InternalGenerationFailure(`Function ${functionName} does not support recursive call`);
		}
		// This is a CALL insteaad of a output
		return new Instruction([
			InstructionBuilder.op('add', '__builtin_return_pos', '@counter', 1),
			InstructionBuilder.set('@counter', `_${functionName}__builtin_prsv`)
		]);
	}

	// Convention: functions are labeled through "_${name}"
	/**
	 * 
	 * @param {MemoryManager} memoryObject 
	 * @returns 
	 */
	/**
	 * Mark the stack helpers as used whenever some function keeps anything on
	 * the stack, so that "drop it when unused" does not drop a helper that is
	 * called later in the same pass.
	 *
	 * @returns {void}
	 */
	markStackHelpersUsed() {
		const helpers = new Set(['__stackframe_forward', '__stackframe_backward',
			'__nearFit', '__pointerForward', '__pointerBackward']);
		let anyStack = false, anyNear = false;
		this.functionCollection.forEach((func, name) => {
			if (helpers.has(name)) return;
			func.stackTotal = 0;
			func.stackSymbols.forEach(symb => {
				func.stackTotal += stackFrameSizeOf(symb);
				if (symb.isNearPointer === true) anyNear = true;
			});
			// The roll-back is only emitted for a function that owns stack space
			if (func.stackTotal > 0) anyStack = true;
		});
		const bump = name => {
			const helper = this.functionCollection.get(name);
			if (helper) helper.calls = Math.max(helper.calls, 1);
		};
		if (anyStack) {
			bump('__stackframe_forward');
			bump('__stackframe_backward');
		}
		if (anyNear) {
			bump('__nearFit');
		}
		/*
		A handler named by `#pragma stackcheck(fn)` / `#pragma stackunderflow(fn)`
		is only ever reached through the walker, so nothing marks it as called and
		it would be dropped -- leaving `set @counter _fn` pointing nowhere.
		*/
		[this.stackCheck, this.stackUnderflow].forEach(handler => {
			if (typeof handler === 'string' && handler.length > 0) bump(handler);
		});
	}

	getAllFunctionDecl(memoryObject) {
		
		let result = new Instruction();
		/*
		A removable helper is dropped when `calls` is still 0 by the time the loop
		reaches it -- and the helpers below are called while a LATER function is
		being emitted, so they would be dropped even though they are used. Decide
		first, from the stack layout, whether anybody needs them.
		*/
		this.markStackHelpersUsed();
		/*
		`main` must come out LAST.

		The chunk of every function ends with a `jump` that skips its body, and
		that jump is resolved while the whole program is being scanned -- so it
		points at whatever follows that chunk. Anything emitted after `main`
		therefore lands between `main` and the little wrapper that calls it, and
		the wrapper is never reached.

		Functions are normally declared before `main`, so this never showed up;
		but an extension may register a helper while `main` is being generated,
		which puts it after `main` in the collection.
		*/
		const orderedNames = [...this.functionCollection.keys()];
		orderedNames.sort((a, b) => (a === 'main' ? 1 : 0) - (b === 'main' ? 1 : 0));
		orderedNames.forEach(name => {
			const func = this.functionCollection.get(name);
			// Re-evaluate the size!
			func.stackTotal = 0;
			func.stackSymbols.forEach(symb => {
				func.stackTotal += stackFrameSizeOf(symb);
			});

			if (func.specialBuiltin && func.calls <= 0) return;

			const returner = new Instruction([InstructionBuilder.set('@counter', 
				func.preservedStack ? func.preservedStack.getAssemblySymbol() : '__stackpos')]);
			const jumper = InstructionBuilder.jump('{end_of_body}', 'always', null, null);
			let connector = new Instruction();
			connector.concat(jumper);
			// Stack preparation (moved from function call)
			let stackPositionPointer = null;
			const refFunction = func;
			// Integrated in getFunctionStackAssignment()

			if (func.preservedStack) {
				connector.concat(InstructionBuilder.set(func.preservedStack.getAssemblySymbol(), '__stackpos'));
			}

			// Consider configuring heap memories as required
			// For each symbol, create a hidden pointer for it
			const heapPreparation = func.recursive ?
				(
					(
					/**
					 * @returns {Instruction}
					 */
					() => {
						let result = new Instruction();
						const tmpSetter = InstructionBuilder.set('__builtin_return_pos', '{retpos}');
						result.concat(tmpSetter);
						result.concat(InstructionBuilder.op('add', `_${name}__builtin_mem`, '@counter', 1));
						result.concat(InstructionBuilder.set('__set_stackpos', 'true'));	// builtin_mem - 1
						// Because I'm going to execute it:
						// builtin_mem
						const stkJumper = InstructionBuilder.jump('{stkjump}', 'equal', '__set_stackpos', 'true');
						result.concat(stkJumper);
						result.concat(this.getFunctionStackRollback(name));				// When resetting
						result.concat(new InstructionReferrer(stkJumper, 'stkjump'));
						result.concat(this.getFunctionStackAssignment(name, null));		// When setting
						result.concat(InstructionBuilder.set('@counter', '__builtin_return_pos'));
						result.concat(new InstructionReferrer(tmpSetter, 'retpos'));
						// Another function: builtin stack preservation
						const skipPrsv = InstructionBuilder.jump('{noprsv}', 'always');
						result.concat(InstructionBuilder.op('add', `_${name}__builtin_prsv`, '@counter', 1));
						result.concat(skipPrsv);
						result.concat(this.getFunctionStackStorage(name));
						result.concat(InstructionBuilder.set('@counter', '__builtin_return_pos'));
						result.concat(new InstructionReferrer(skipPrsv, 'noprsv'));
						return result;
					})()
				) : this.getFunctionStackAssignment(name, true, true);
			
			connector.concat(heapPreparation);
			connector.concat(func.body);
			//connector.concat(InstructionBuilder.set('__jump_stackpos', '__stackpos'));
			
			if (refFunction.specialBuiltin) {
				// Do nothing now
				//connector.concat(InstructionBuilder.set('__stackpos', '__internal_stackpos'));
			} else if (stackPositionPointer || refFunction.specialBuiltin) {
				//const fromMainJumper = InstructionBuilder.jump('{from_main}', 'equal', '__from_main', 'true');
				//connector.concat(fromMainJumper);
				connector.concat(memoryObject.outputPointerFetchOf(`${stackPositionPointer}.__pointer`, '__stackpos'));
				//connector.concat(new InstructionReferrer(fromMainJumper, 'from_main'));
			}
			if (func.stackTotal > 0 && (!refFunction.specialBuiltin)) {
				//connector.concat(memoryObject.outputPointerBackwardCall(totalStackframeSize, '__stackframe', this));
				connector.concat(
					this.getFunctionStackRollback(name)
				);
			}

			if (name === 'main') {
				connector.concat(InstructionBuilder.end());
			} else {
				connector.concat(returner);	// As a component of cunction body
			}
			
			connector.concat(new InstructionReferrer(jumper, 'end_of_body'));
			// ...
			let header = new Instruction([
				//InstructionBuilder.set(`_${name}`, '@counter'),
				//InstructionBuilder.op('add', `_${name}`, `_${name}`, 2)	// counter refer to the next line
				InstructionBuilder.op('add', `_${name}`, '@counter', 1)
			]);
			result.concat(header);
			result.concat(connector);
		});
		return result;
	}

	/**
	 * 
	 * @param {string} varName 
	 * @param {Map<string, any>} params 
	 * @param {boolean} fromMain 
	 * @param {string?} [callSource=null] 
	 * @returns 
	 */
	getRawFunctionCall(varName, params, fromMain = false, callSource = null) {
		let result = new Instruction();
		// Caller configuring the stack
		// (storing returning point, if not from main)
		
		
		//assignment = memoryObject.assign("__stackpos_" + (this.callerId++));
		//result.concat(memoryObject.outputStorageOf(assignment, "__stackpos"));
		//result.concat(heapPreparation);
		
		
		params.forEach((value, name) => {
			result.concat(InstructionBuilder.set(name, value));
		});
		//result.concat(InstructionBuilder.set("__from_main", fromMain ? 'true' : 'false'));
		let internals = null, recovery = '__internal_stackpos';
		if (callSource && this.functionCollection.has(callSource)) {
			const func = this.functionCollection.get(callSource);
			if (func.preservedStack) {
				recovery = func.preservedStack.getAssemblySymbol();
				internals = InstructionBuilder.set(recovery, '__stackpos');
			}
		}
		if (!internals) {
			internals = InstructionBuilder.set("__internal_stackpos", "__stackpos");
		}
		result.concat(internals);
		result.concat(InstructionBuilder.op("add", "__stackpos", "@counter", 1));	// Instruction 1
		result.concat(InstructionBuilder.set("@counter", varName)); // Instruction 2 (caller)
		result.concat(InstructionBuilder.set("__stackpos", recovery));	// Better than nothing!
		// (Stack cleanup)
		// Instruction 3 and sth else: continue the control flow
		// !!!! Function return will be responsible for setting @counter back !!!!
		// (set current return point)
        
		return result;
	}
	
	/**
	 * Get a function call instruction block.
	 * @param {string} name
	 * @param {Map<string, any>} params Notice: Only for internal calls.
	 * @param {MemoryManager | null} [memoryObject=null] Reserved only for compatibility.
	 * @param {boolean} [fromMain=false]
	 * @param {string?} [callSource=null] 
	 * @remark The return value will be stored in __returnA and __returnB (for pointer). These are set by the function itself
	*/
	getFunctionCall(name, params, memoryObject = null, fromMain = false, callSource = null) {
		const refFunction = this.functionCollection.get(name);
		if (!refFunction) {
			return new Instruction();
		}
		refFunction.calls++;
		return this.getRawFunctionCall(`_${name}`, params, fromMain, callSource);
	}
}

// This class also generates a few pieces
// It is recommended to use scope path to describe variable 
// This will raise exception for failed memory allocation
export class MemoryAllocationException extends Error {
	constructor(varName = null, maxRemaining = null) {
		/*
		It used to be a bare object: reaching the top level it produced
		"Internal parser error: undefined" with no clue at all. Being a real
		Error gives it a readable message and a stack.
		*/
		super(`Not enough memory${varName ? ` to hold ${varName}` : ''}` +
			`${maxRemaining === 0 ? ' (no memory is available at all)' : ''}` +
			`${(maxRemaining !== null && maxRemaining > 0) ? ` (largest free block: ${maxRemaining})` : ''}`);
		this.name = 'MemoryAllocationException';
		this.varName = varName;
		this.maxRemaining = maxRemaining;
	}
}

export class MemoryBlock {
	constructor(name, size) {
		this.name = name;
		this.size = size;
		this.occupation = new Array(size);
	}
}

export const MEMORY_RESERVE_SIZE = 4;

export class MemoryBlockInfo {
	constructor(block, position, full, parent = null) {
		this.block = block;
		this.position = position;
		this.full = full;
		this.parent = parent;
		this.reservedSize = MEMORY_RESERVE_SIZE;
	}

	duplicate() {
		return new MemoryBlockInfo(this.block, this.position, this.full, this.parent);
	}

	// This function now only ESTIMATES (given the internal reservations!)
	/**
	 * 
	 * @returns The current ESTIMATED remaining size.
	 * @deprecated
	 * @private We recommend only the private use.
	 */
	currentRemain() {
		if (this.parent) {
			/*
			With no memory configured at all there is no such block, and asking
			for its size used to crash. There is nothing left in it either.
			*/
			const block = this.parent.memoryBlocks[this.block];
			if (!block) return 0;
			return block.size - this.position;
		}
		else return Infinity;
	}

	isAvailable() {
		if (this.parent) {
			const block = this.parent.memoryBlocks[this.block];
			if (!block) return false;
			return (this.currentRemain() > 0) && (!block.occupation[this.position]);
		}
		else return true;
	}

	skipToNextPage() {
		if (this.parent) {
			// `>=` also covers "there is no block at all", which must end the walk
			if (this.block >= this.parent.memoryBlocks.length - 1) {
				this.full = true;
			} else {
				this.block++;
				this.position = this.reservedSize;
			}
		} else {
			throw new MemoryAllocationException();
		}
		return this;
	}

	forwarding(size) {
		let currentSize = size;
		while (!this.full && currentSize > 0) {
			do {
				this.position++;
				if (this.currentRemain() <= 0) {
					this.skipToNextPage();	
				}
			} while (!this.full && !this.isAvailable());
			currentSize--;
		}
		if (currentSize > 0) {
			throw new MemoryAllocationException();
		}
		return this;
	}

	getAssignmentInstruction(varName) {
		if (!this.parent) {
			throw new MemoryAllocationException();
		}
		return new Instruction([
			InstructionBuilder.set(`${varName}_block`, `${this.parent.memoryBlocks[this.block].name}_id`),
			InstructionBuilder.set(`${varName}_pos`, this.position)
		]);
	}
}

/**
 * @abstract This class will maintain the connection between building and number
 * assigning variables for auto devices, e.g. cell1_id
 */
export class BuildingLinker {
	/**
	 * 
	 * @param {string[]} blockOccupation
	 * @param {FunctionRegisterer} functionManagement
	 * @param {Compiler?} [compiler=null] 
	 */
	constructor(blockOccupation, functionManagement, compiler = null) {
		this.blockOccupation = blockOccupation;
		this.functionManagement = functionManagement;
		// this.config = compiler ? compiler.extraConfig : new AttributeClass();
	}

	// Very unfortunately, this function can't use any function!
	outputLinkInitializer() {

		// "Inline function" that is called only once
		const inlineJumper = new Instruction([
			InstructionBuilder.getlink("__building", "__linkscan"),
			InstructionBuilder.sensor("__buildingtype", "__building", "@type"),
			InstructionBuilder.jump("{0}", "strictEqual", "__buildingtype", "@memory-cell", [7]),
			InstructionBuilder.jump("{0}", "strictEqual", "__buildingtype", "@memory-bank", [7]),
			InstructionBuilder.jump("{0}", "strictEqual", "__buildingtype", "@world-cell", [7]),
			InstructionBuilder.op("add", "__linkscan", "__linkscan", 1),
			InstructionBuilder.jump("{0}", "always", null, null, [0]),
			InstructionBuilder.set("@counter", "__linker_ret")
		]);
		const inlineJumperName = "__inline_jumper";

		//this.functionManagement.addFunction(inlineJumperName, inlineJumper, null, [], true);	

		let result = new Instruction([
			InstructionBuilder.set("__linkscan", 0)
		]);
		const postFuncJumper = InstructionBuilder.jump("{eofunc}", "always");
		const preFuncJumper = InstructionBuilder.jump("{pofunc}", "always");
		result.concat(postFuncJumper);
		result.concat(new Instruction([
			new InstructionReferrer(preFuncJumper, "pofunc"),
			inlineJumper,
			new InstructionReferrer(postFuncJumper, "eofunc")
		]));
		result.concat(new Instruction(this.blockOccupation.flatMap(block => 
			[
				//this.functionManagement.getRawFunctionCall(`_${inlineJumperName}`, [], true),
				InstructionBuilder.op("add", "__linker_ret", "@counter", 1),
				preFuncJumper,
				InstructionBuilder.set(`${block}_id`, "__linkscan"),
				InstructionBuilder.op('add', '__linkscan', '__linkscan', 1)
			]
		)));
		return result;
	}
}

export class MemoryManager {
	// Memory block structure: { name: ..., size: ... }
	/*
	Reserved information:
	0 - Previous block
	1 - Next block
	2 - Block size
	3 - Base address (seems like that all AI tools have left that out. That's not good! -- Seabird)
	*/
	/**
	 * 
	 * @param {{name: string, size: number}[]} memoryBlocks 
	 */
	constructor(memoryBlocks) {
		this.memoryBlocks = memoryBlocks;
		//this.memoryLinker = new BuildingLinker(memoryBlocks.map(block => block.name));
		this.reservedSize = MEMORY_RESERVE_SIZE;
		/*
		No memory block linked at all: there is nowhere to allocate, so the stack
		starts out full and every allocation fails loudly (instead of pretending
		to succeed on a block that does not exist).
		*/
		const hasMemory = this.memoryBlocks.length > 0;
		this.memoryPositionStack = [new MemoryBlockInfo(0, this.reservedSize, !hasMemory, this)];
		this.variableReference = new Map();
		this.memoryBlocks.forEach(single => {
			for (let i = 0; i < 4; i++) {
				single.occupation[i] = '__internal_reserve';
			}
		});
	}
	
	// Services
	
	pushStack() {
		this.memoryPositionStack.push({ ...this.currentState() });
	}
	
	popStack() {
		this.memoryPositionStack.pop();
	}
	
	currentState() {
		return this.memoryPositionStack[this.memoryPositionStack.length - 1];
	}

	setState(state) {
		this.memoryPositionStack[this.memoryPositionStack.length - 1] = state;
	}
	
	currentRemain() {
		return this.memoryBlocks[this.currentState().block].size - this.currentState().position;
	}
	
	assign(name, size) {
		if (this.memoryBlocks.length === 0) {
			throw new MemoryAllocationException(name, size);
		}
		if (this.currentState().full) {
			throw new MemoryAllocationException(name, 0);
		}
		const pos = this.currentState().duplicate();
		this.forwarding(size);
		return pos;
	}
	
	forwarding(size) {
		this.currentState().forwarding(size);
	}
	
	skipToNextPage() {
		this.currentState().skipToNextPage();
	}
	
	// Instruction generation
	// These all output lists
	
	// Internal function: for a constant address (these read/writes can be directly done)
	outputStorageOf(position, variable) {
		return InstructionBuilder.write(variable, this.memoryBlocks[position.block].name, position.position);
	}
	
	outputFetchOf(position, variable) {
		return InstructionBuilder.read(variable, this.memoryBlocks[position.block].name, position.position);
	}

	outputPointerStorageOf(pointer, data) {
		return InstructionBuilder.writes(data, `${pointer}_block`, `${pointer}_pos`);
	}

	outputPointerFetchOf(pointer, data) {
		return InstructionBuilder.reads(data, `${pointer}_block`, `${pointer}_pos`);
	}
	
	outputLinkInitializer() {
		let result = new Instruction();
		let baseAddress = 0;
		result.concat(InstructionBuilder.set('null_block', 'null'));
		result.concat(InstructionBuilder.set('null_pos', 'null'));
		for (let i = 0; i < this.memoryBlocks.length; i++) {
			result.concat(new Instruction({
				content: 'write ' + (i === 0 ? '-1' : `${this.memoryBlocks[i-1].name}_id`) + ' ' + this.memoryBlocks[i].name + ' 0',
				referrer: []
			}));
			result.concat(new Instruction({
				content: 'write ' + (i === this.memoryBlocks.length - 1 ? '-1' : `${this.memoryBlocks[i+1].name}_id`) + ' ' + this.memoryBlocks[i].name + ' 1',
				referrer: []
			}));
			result.concat(new Instruction({
				content: 'write ' + this.memoryBlocks[i].size + ' ' + this.memoryBlocks[i].name + ' 2',
				referrer: []
			}));
			result.concat(new Instruction({
				content: 'write ' + baseAddress + ' ' + this.memoryBlocks[i].name + ' 3',
				referrer: []
			}));
			baseAddress += this.memoryBlocks[i].size - this.reservedSize;
		}
		return result;
	}
	
	// This is a function for pointer, satisfying cdecl standard.
	// Tested to be OK
	// These two functions directly modify the pointers, so we don't use a 'ret'.
		/**
	 * Advance a pointer by `__step` cells, crossing into the next memory block
	 * when the current one cannot hold them.
	 *
	 * Blocks form a chain (slot 0 = previous, slot 1 = next, slot 2 = capacity)
	 * and are laid out back to back in the address space, so crossing simply
	 * consumes what is left of the current block and continues at `reservedSize`
	 * of the next one -- no extra `+1`, and nothing is wasted.
	 *
	 * @param {FunctionRegisterer} funcReg
	 * @param {string} name
	 * @param {string} target
	 * @param {boolean} removable Drop the helper when nothing calls it
	 * @param {string|boolean|undefined} stackCheck
	 *        undefined -- write a fixed message to __error and stop
	 *        false    -- `#pragma stackcheck()`: no capacity check
	 *        string   -- call that function, then leave the walker
	 * @returns {void}
	 */
	/**
	 * Advance a pointer by `__step` cells, crossing into the next memory block
	 * when the current one cannot hold them.
	 *
	 * Blocks form a chain (slot 0 = previous, slot 1 = next, slot 2 = capacity)
	 * and are laid out back to back in the address space, so crossing simply
	 * consumes what is left of the current block and continues at `reservedSize`
	 * of the next one. No extra `+1` is added: the cells left at the tail of a
	 * block are exactly the ones the retreat walks back over.
	 *
	 * @param {FunctionRegisterer} funcReg
	 * @param {string} name
	 * @param {string} target
	 * @param {boolean} removable Drop the helper when nothing calls it
	 * @param {string|boolean|undefined} stackCheck
	 *        undefined -- write a fixed message to __error and stop
	 *        false    -- `#pragma stackcheck()`: do not watch; stop cleanly
	 *        string   -- call that function, then stop
	 * @returns {void}
	 */
	outputPointerForwardFunction(funcReg, name = '__pointerForward', target = '__ptr', removable = true, stackCheck = undefined) {
		const overflow = overflowHandlerOf(stackCheck);
		const OVF = 11 + 1 + 3;
		const RET = OVF + overflow.length;
		const guard = [
			InstructionBuilder.jump('{0}', 'lessThanEq', `${target}block`, 0, [OVF])
		];
		funcReg.addFunction(name, new Instruction([
			InstructionBuilder.jump('{0}', 'greaterThanEq', '__mxstep', 0, [2]),			// 0
			InstructionBuilder.end(),														// 1
			InstructionBuilder.getlink('__curptrblock', `${target}block`),					// 2
			InstructionBuilder.jump('{0}', 'lessThanEq', '__step', 0, [RET]),				// 3
			InstructionBuilder.read('__block', '__curptrblock', 2),							// 4 capacity
			InstructionBuilder.op('sub', '__mxstep', '__block', `${target}pos`),				// 5 remaining
			InstructionBuilder.jump('{0}', 'greaterThanEq', '__step', '__mxstep', [10]),	// 6
			InstructionBuilder.op('add', `${target}pos`, `${target}pos`, '__step'),			// 7 fits
			InstructionBuilder.set('__step', 0),											// 8
			InstructionBuilder.jump('{0}', 'always', null, null, [RET]),					// 9
			InstructionBuilder.read(`${target}block`, '__curptrblock', 1),					// 10 next block
			...guard,
			InstructionBuilder.op('sub', '__step', '__step', '__mxstep'),					// consume the tail
			InstructionBuilder.set(`${target}pos`, this.reservedSize),
			InstructionBuilder.jump('{0}', 'always', null, null, [0]),
			...overflow
		]), null, [], true, false, removable);
	}

	/**
	 * Retreat a pointer by `__step` cells, walking the chain backwards.
	 *
	 * A block that has been left behind is always full from the address point of
	 * view, so landing in the previous block only needs its CAPACITY (slot 2);
	 * from there the loop walks the remaining cells down inside it. That is why
	 * nothing but the chain has to be saved: the position is rebuilt from the
	 * pointer itself.
	 *
	 * @param {FunctionRegisterer} funcReg
	 * @param {string} name
	 * @param {string} target
	 * @param {boolean} removable
	 * @param {string|boolean|undefined} stackUnderflow
	 *        undefined or false -- no check (this is the default)
	 *        string            -- call that function, then leave the walker
	 * @returns {void}
	 */
	outputPointerForwardCall(step, variable, funcReg, doReset = false, doSet = true, isNear = false) {
		if (doReset) isNear = false;
		let process = new Instruction();
		if (doReset) {
			process.concat(InstructionBuilder.set(variable + '_pos', this.reservedSize));
			process.concat(InstructionBuilder.set(variable + '_block', `${this.memoryBlocks[0].name}_id`));
		} else if (Number(step) === 0) {
			/*
			Stepping by nothing is nothing. This has to come before the `isNear`
			branch below, which used to emit `op add X X 0` -- one pointless
			instruction at EVERY constant subscript.
			*/
			if (!doSet) {
				return new Instruction([
					InstructionBuilder.set('__ptrblock', variable + '_block'),
					InstructionBuilder.set('__ptrpos', variable + '_pos')
				]);
			} else {
				return new Instruction();
			}
		}
		let caller;
		if (isNear) {
			caller = new Instruction([
				doSet ? InstructionBuilder.op('add', variable + '_pos', variable + '_pos', step)
				: InstructionBuilder.op('add', '__ptrpos', variable + '_pos', step)
			]);
			if (!doSet) caller.concat(InstructionBuilder.set('__ptrblock', variable + '_block'));
		} else {
			caller = funcReg.getFunctionCall('__pointerForward', new Map([["__ptrpos", variable + '_pos'], ["__ptrblock", variable + '_block'], ["__step", step]]), this);
			if (doSet) {
				caller.concat(InstructionBuilder.set(variable + '_pos', "__ptrpos"));
				caller.concat(InstructionBuilder.set(variable + '_block', "__ptrblock"));
			}
		}
		process.concat(caller);
		return process;
	}

	outputSymbolForwardCall(step, symbol, funcReg, doReset = false, doSet = true, doCopy = true) {
		const translation = symbol.accessThroughPointer ? `${symbol.getAssemblySymbol()}.__pointer` : `${symbol.getAssemblySymbol()}`;
		if (doReset || !symbol.isNearPointer) {
			return this.outputPointerForwardCall(step, translation, funcReg, doReset, doSet);
		}
		if (doSet) {
			return new Instruction([
				InstructionBuilder.op('add', `${translation}_pos`, `${translation}_pos`, step)
			]).concat_returns(doCopy ? new Instruction([
				InstructionBuilder.set('__ptrblock', `${translation}_block`),
				InstructionBuilder.set('__ptrpos', `${translation}_pos`),
			]) : new EmptyInstruction());
		} else {
			return new Instruction([
				InstructionBuilder.set('__ptrblock', `${translation}_block`),
				InstructionBuilder.op('add', '__ptrpos', `${translation}_pos`, step)
			], '__ptr');
		}
	}

	outputPointerBackwardFunction(funcReg, name = '__pointerBackward', target = '__ptr', removable = true, stackUnderflow = undefined) {
		const handler = (typeof stackUnderflow === 'string' && stackUnderflow.length > 0)
			? stackUnderflow : null;
		const underflow = handler ? callHandlerOf(handler) : [];
		const guardLength = handler ? 1 : 0;
		const cross = [
			InstructionBuilder.op('sub', '__step', '__step', '__mxstep'),					// step -= used
			InstructionBuilder.read(`${target}block`, '__curptrblock', 0)					// previous block
		];
		const land = [
			InstructionBuilder.getlink('__curptrblock', `${target}block`),
			InstructionBuilder.read(`${target}pos`, '__curptrblock', 2),					// capacity
			InstructionBuilder.jump('{0}', 'always', null, null, [0])
		];
		const UF = 9 + cross.length + guardLength + land.length;
		const RET = UF + underflow.length;
		const guard = handler ? [
			InstructionBuilder.jump('{0}', 'lessThanEq', `${target}block`, 0, [UF])
		] : [];
		funcReg.addFunction(name, new Instruction([
			InstructionBuilder.jump('{0}', 'greaterThanEq', '__mxstep', 0, [2]),			// 0
			InstructionBuilder.end(),														// 1
			InstructionBuilder.getlink('__curptrblock', `${target}block`),					// 2
			InstructionBuilder.jump('{0}', 'lessThanEq', '__step', 0, [RET]),				// 3
			InstructionBuilder.op('sub', '__mxstep', `${target}pos`, this.reservedSize),		// 4 used
			InstructionBuilder.jump('{0}', 'greaterThan', '__step', '__mxstep', [9]),		// 5
			InstructionBuilder.op('sub', `${target}pos`, `${target}pos`, '__step'),			// 6 fits
			InstructionBuilder.set('__step', 0),											// 7
			InstructionBuilder.jump('{0}', 'always', null, null, [RET]),					// 8
			...cross, ...guard, ...land, ...underflow
		]), null, [], true, false, removable);
	}


	/**
	 * Move a pointer forward until the whole `__step` cells fit inside ONE block.
	 * Used for `near` symbols on the stack: they must not be split across blocks.
	 * Running out of blocks is a stack overflow.
	 *
	 * @param {FunctionRegisterer} funcReg
	 * @param {string} name
	 * @param {string} target
	 * @param {boolean} removable
	 * @param {string|boolean|undefined} stackCheck
	 * @returns {void}
	 */
	/**
	 * Move a pointer forward until the whole `__step` cells fit inside ONE block.
	 *
	 * Used for `near` symbols living on the stack: they must never be split
	 * across two blocks. Running out of blocks is a stack overflow.
	 *
	 * @param {FunctionRegisterer} funcReg
	 * @param {string} name
	 * @param {string} target
	 * @param {boolean} removable
	 * @param {string|boolean|undefined} stackCheck
	 *        undefined -- write a fixed message to __error and stop
	 *        false    -- `#pragma stackcheck()`: do not watch; stop cleanly
	 *        string   -- call that function, then stop
	 * @returns {void}
	 */
	outputNearFitFunction(funcReg, name = '__nearFit', target = '__ptr', removable = true, stackCheck = undefined) {
		const overflow = overflowHandlerOf(stackCheck);
		const OVF = 5 + 1 + 2;
		const RET = OVF + overflow.length;
		const guard = [
			InstructionBuilder.jump('{0}', 'lessThanEq', `${target}block`, 0, [OVF])
		];
		funcReg.addFunction(name, new Instruction([
			InstructionBuilder.getlink('__curptrblock', `${target}block`),					// 0
			InstructionBuilder.read('__block', '__curptrblock', 2),							// 1 capacity
			InstructionBuilder.op('sub', '__mxstep', '__block', `${target}pos`),				// 2 remaining
			InstructionBuilder.jump('{0}', 'lessThanEq', '__step', '__mxstep', [RET]),		// 3 fits
			InstructionBuilder.read(`${target}block`, '__curptrblock', 1),					// 4 next block
			...guard,
			InstructionBuilder.set(`${target}pos`, this.reservedSize),
			InstructionBuilder.jump('{0}', 'always', null, null, [0]),
			...overflow
		]), null, [], true, false, removable);
	}


	
	/**
	 * 
	 * @param {string} variable 
	 * @param {FunctionRegisterer} funcReg 
	 */
	outputPointerBackwardCall(step, variable, funcReg, doSet = true) {
		const caller = funcReg.getFunctionCall('__pointerBackward', new Map([["__ptrpos", variable + '_pos'], ["__ptrblock", variable + '_block'], ["__step", step]]), this);
		if (doSet) {
			caller.concat(InstructionBuilder.set(variable + '_pos', "__ptrpos"));
			caller.concat(InstructionBuilder.set(variable + '_block', "__ptrblock"));
		}
		return caller;
	}

	outputPointerValueFunction(funcReg) {
		funcReg.addFunction('__pointerValue', new Instruction([
			InstructionBuilder.reads('__builtin_return', '__ptrblock', 3),
			InstructionBuilder.op('add', '__builtin_return', '__builtin_return', '__ptrpos')
		]), null, [], true, false, true);
	}

	/**
	 * 
	 * @param {string} variable 
	 * @param {FunctionRegisterer} funcReg 
	 */
	outputPointerValueCall(variable, funcReg) {
		const caller = funcReg.getFunctionCall('__pointerValue', new Map([["__ptrpos", variable + '_pos'], ["__ptrblock", variable + '_block']]), this);
		caller.instructionReturn = '__builtin_return';
		return caller;
	}

	/**
	 * 
	 * @param {FunctionRegisterer} funcReg 
	 */
	outputMemcpyFunction(funcReg) {
		funcReg.addFunction('__memcpy', new Instruction([
			InstructionBuilder.getlink('__srcblock', '__srcblock'),							// 0
			InstructionBuilder.getlink('__tgtblock', '__tgtblock'),							// 1

			InstructionBuilder.jump('{0}', 'lessThanEq', '__remain', 0, [21]),				// 2
			InstructionBuilder.read('__tmp', '__srcblock', '__srcpos'),						// 3
			InstructionBuilder.write('__tmp', '__tgtblock', '__tgtpos'),					// 4
			InstructionBuilder.read('__srcmax', '__srcblock', 2),							// 5
			InstructionBuilder.op('sub', '__srcmax', '__srcmax', 1),						// 6
			InstructionBuilder.op('add', '__srcpos', '__srcpos', 1),						// 7
			InstructionBuilder.op('add', '__tgtpos', '__tgtpos', 1),						// 8
			InstructionBuilder.jump('{0}', 'lessThan', '__srcpos', '__srcmax', [13]),		// 9
			InstructionBuilder.read('__curb', '__srcblock', 1),								// 10
			InstructionBuilder.getlink('__srcblock', '__curb'),								// 11
			InstructionBuilder.set('__srcpos', this.reservedSize),							// 12
			InstructionBuilder.read('__tgtmax', '__tgtblock', 2),							// 13
			InstructionBuilder.op('sub', '__tgtmax', '__tgtmax', 1),						// 14
			InstructionBuilder.jump('{0}', 'lessThan', '__tgtpos', '__tgtmax', [19]),		// 15
			InstructionBuilder.read('__curb', '__tgtblock', 1),								// 16
			InstructionBuilder.getlink('__tgtblock', '__curb'),								// 17
			InstructionBuilder.set('__tgtpos', this.reservedSize),							// 18
			InstructionBuilder.op('sub', '__remain', '__remain', 1),						// 19
			InstructionBuilder.jump('{0}', 'always', null, null, [2])						// 20
		]), null, [], true, false, true);
	}

	/**
	 * 
	 * @param {string} target 
	 * @param {string} source 
	 * @param {any} size 
	 * @param {FunctionRegisterer} funcReg 
	 * @returns {Instruction}
	 */
	outputMemcpyCall(target, source, size, funcReg) {
		const caller = funcReg.getFunctionCall('__memcpy', 
			new Map([["__srcblock", source + '_block'], 
				["__srcpos", source + '_pos'], ["__tgtblock", target + '_block'], 
				["__tgtpos", target + '_pos'], ["__remain", size]]), this);
		return caller;
	}
}
