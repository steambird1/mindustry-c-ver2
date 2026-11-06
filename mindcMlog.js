/*
 * A small pass over the generated mlog, run BEFORE `Instruction.output()`.
 *
 * At this point jump targets are still `InstructionReferrer` objects, so
 * removing an instruction is safe: `raw_scan` will register every referrer
 * again at the new position. After `output()` the numbers are frozen, and the
 * pass would have to repair every jump and switch table by hand.
 *
 * The pass only looks at straight-line runs between barriers. A barrier is a
 * side effect, a jump, a value that is still a `{placeholder}`, or anything
 * the pass does not understand; being conservative is the point.
 */

import { Instruction } from "./mindcInstruction.js";

const PURE = new Set([
	'set', 'op', 'select', 'read', 'lookup', 'sensor', 'getlink', 'packcolor'
]);

const BARRIER = new Set([
	'jump', 'end', 'stop', 'write', 'print', 'printflush', 'printchar',
	'format', 'draw', 'drawflush', 'control', 'ucontrol', 'wait', 'asm',
	'cutscene', 'setrule', 'spawn', 'status', 'weather', 'effect'
]);

/**
 * Split an instruction line into tokens, keeping a quoted string in one
 * token even when it contains spaces.
 *
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
	const tokens = [];
	let current = '';
	let quote = false;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (ch === '"' && text[i - 1] !== '\\') {
			quote = !quote;
			current += ch;
			continue;
		}
		if (!quote && (ch === ' ' || ch === '\t')) {
			if (current) { tokens.push(current); current = ''; }
			continue;
		}
		current += ch;
	}
	if (current) tokens.push(current);
	return tokens;
}

/**
 * The operand index that receives the result of a pure instruction.
 *
 * @param {string[]} tokens
 * @returns {number}
 */
function targetIndex(tokens) {
	switch (tokens[0]) {
		case 'set': return 1;
		case 'op': return 2;
		case 'lookup': return 2;
		case 'select': return 1;
		case 'read': return 1;
		case 'sensor': return 1;
		case 'getlink': return 1;
		case 'packcolor': return 1;
		default: return -1;
	}
}

/**
 * Whether this leaf must stop optimisation on both sides.
 *
 * @param {any} node
 * @param {Set<any>} protectedNodes
 * @returns {boolean}
 */
function isBarrier(node, protectedNodes) {
	if (!node || !node.content) return true;
	if (protectedNodes.has(node)) return true;
	if (node.content.includes('{') || node.content.includes('}')) return true;
	const tokens = tokenize(node.content);
	if (!tokens.length || !PURE.has(tokens[0])) return true;
	// Computed jumps and function entries are line-number sensitive.
	if (node.content.includes('@counter')) return true;
	const target = tokens[targetIndex(tokens)];
	if (!target || target === '@counter') return true;
	return BARRIER.has(tokens[0]);
}

/**
 * Flatten every group except the rare `noLineCount` ones (asm labels), which
 * stay opaque. The grouping has no other meaning by the time output runs,
 * EXCEPT for numeric `referrer` offsets: those are relative to the start of
 * the group they live in. Flattening records each target's old absolute line
 * so the offsets can be rewritten after instructions are removed.
 *
 * @param {Instruction} root
 * @returns {{leaves: any[], lineLeaves: any[], numeric: {leaf: any, index: number, targetOld: number}[]}}
 */
function flatten(root) {
	const leaves = [];
	const lineLeaves = [];
	const numeric = [];
	let nextLine = 0;
	const visit = (node, base) => {
		if (!node) return;
		if (node.isInstructionReferrer) { leaves.push(node); return; }
		if (!node.isInstructionGroup) {
			const referrers = node.referrer ?? [];
			for (let i = 0; i < referrers.length; i++) {
				if (typeof referrers[i] === 'number') {
					numeric.push({ leaf: node, index: i, targetOld: base + referrers[i] });
				}
			}
			node.__mlogPos = lineLeaves.length;
			lineLeaves.push(node);
			leaves.push(node);
			nextLine++;
			return;
		}
		if (node.getAttribute?.('noLineCount')) { leaves.push(node); return; }
		const groupBase = nextLine;
		for (const child of node.instructions ?? []) visit(child, groupBase);
	};
	visit(root, 0);
	return { leaves, lineLeaves, numeric };
}

/**
 * Every instruction that a referrer writes into, or that a numeric group
 * offset points at. Removing one would leave a jump pointing at a line that no
 * longer exists.
 *
 * @param {any[]} leaves
 * @param {{leaf: any, index: number, targetOld: number}[]} numeric
 * @param {any[]} lineLeaves
 * @returns {Set<any>}
 */
function collectProtected(leaves, numeric, lineLeaves) {
	const protectedNodes = new Set();
	for (const node of leaves) {
		if (node?.isInstructionReferrer && node.towards) protectedNodes.add(node.towards);
	}
	for (const reference of numeric) {
		const target = lineLeaves[reference.targetOld];
		if (target) protectedNodes.add(target);
	}
	return protectedNodes;
}

/**
 * Read the operands of one instruction, excluding its destination and its own
 * self-reads. A value that is only read to compute itself does not keep the
 * definition alive.
 *
 * @param {any} leaf
 * @returns {string[]}
 */
function readOperands(leaf) {
	if (!leaf?.content) return [];
	const tokens = tokenize(leaf.content);
	const index = targetIndex(tokens);
	const target = index >= 0 ? tokens[index] : null;
	const result = [];
	for (let i = 0; i < tokens.length; i++) {
		if (i === index) continue;
		if (target && tokens[i] === target) continue;
		result.push(tokens[i]);
	}
	return result;
}

/**
 * Count how often every name is read by the whole program.
 *
 * @param {any[]} leaves
 * @returns {Map<string, number>}
 */
function countReads(leaves) {
	const counts = new Map();
	for (const leaf of leaves) {
		for (const operand of readOperands(leaf)) {
			counts.set(operand, (counts.get(operand) ?? 0) + 1);
		}
	}
	return counts;
}

/**
 * Whether `target` is read again after `startPos`, before a new definition
 * gives it another value. The consumer at `allowedPos` does not count.
 *
 * @param {any[]} leaves
 * @param {number} startPos
 * @param {string} target
 * @returns {boolean}
 */
function hasAnotherUseAfter(leaves, startPos, target) {
	for (let i = startPos; i < leaves.length; i++) {
		const leaf = leaves[i];
		if (!leaf?.content) continue;
		if (readOperands(leaf).includes(target)) return true;
		const tokens = tokenize(leaf.content);
		const index = targetIndex(tokens);
		if (index >= 0 && tokens[index] === target) return false;
	}
	return false;
}

/**
 * @param {string?} token
 * @returns {boolean}
 */
function isIntegerText(token) {
	return typeof token === 'string' && /^-?\d+$/.test(token);
}

/**
 * Whether `token` is already known to hold an integer value.
 *
 * @param {string?} token
 * @param {Set<string>} integral
 * @returns {boolean}
 */
function isIntegralValue(token, integral) {
	return isIntegerText(token) || (typeof token === 'string' && integral.has(token));
}

/**
 * Remove a `floor`/`ceil`/`round` whose input is already integral.
 *
 * This is the product-level half of A3. The generator removes the floors it
 * can prove redundant; this catches the ones introduced by a helper or an
 * inlined expression after the generator's type facts were lost.
 *
 * @param {any[]} block
 * @param {Set<any>} protectedNodes
 * @returns {void}
 */
function foldRedundantFloors(block, protectedNodes) {
	const integral = new Set();
	for (const leaf of block) {
		if (!leaf?.content) continue;
		const tokens = tokenize(leaf.content);
		const index = targetIndex(tokens);
		if (index < 0) continue;
		const target = tokens[index];
		if (!target || target === '@counter') continue;

		if (tokens[0] === 'op' && ['floor', 'ceil', 'round'].includes(tokens[1])
			&& target === tokens[3] && isIntegralValue(tokens[3], integral)
			&& !protectedNodes.has(leaf)) {
			leaf.content = '';
			continue;
		}

		let fact = false;
		switch (tokens[0]) {
			case 'set':
				fact = isIntegralValue(tokens[2], integral);
				break;
			case 'select':
				fact = tokens.length >= 7
					&& isIntegralValue(tokens[5], integral)
					&& isIntegralValue(tokens[6], integral);
				break;
			case 'op': {
				const operation = tokens[1];
				const operands = [tokens[3], tokens[4]].filter(value => value && value !== 'x');
				if (['floor', 'ceil', 'round', 'and', 'or', 'xor', 'shl', 'shr',
					'ushr', 'idiv', 'equal', 'notEqual', 'lessThan', 'lessThanEq',
					'greaterThan', 'greaterThanEq', 'strictEqual'].includes(operation)) {
					fact = true;
				} else if (['add', 'sub', 'mul', 'mod', 'abs', 'min', 'max'].includes(operation)) {
					fact = operands.every(value => isIntegralValue(value, integral));
				}
				break;
			}
			case 'lookup':
			case 'getlink':
				fact = true;
				break;
			case 'read':
			case 'sensor':
				fact = false;
				break;
		}
		if (fact) integral.add(target);
		else integral.delete(target);
	}
}

/**
 * Optimise one straight-line run.
 *
 * @param {any[]} block
 * @param {Set<any>} protectedNodes
 * @param {any[]} leaves
 * @returns {void}
 */
function optimizeBlock(block, protectedNodes, leaves) {
	foldRedundantFloors(block, protectedNodes);
	const versions = new Map();
	const cse = new Map();
	const versionOf = name => versions.get(name) ?? 0;
	const touch = name => versions.set(name, versionOf(name) + 1);

	for (const leaf of block) {
		if (!leaf?.content || protectedNodes.has(leaf)) continue;
		const tokens = tokenize(leaf.content);
		const index = targetIndex(tokens);
		if (index < 0) continue;
		const target = tokens[index];
		if (!target || target === '@counter') continue;
		/*
		`read` and `sensor` are not CSE candidates: another processor may write
		that memory, or the sensor's subject may change, between two
		instructions that this pass cannot see.
		*/
		if (tokens[0] === 'read' || tokens[0] === 'sensor') {
			touch(target);
			continue;
		}
		const operands = tokens.filter((_, i) => i !== index);
		// A read-modify-write depends on its own previous value; CSE needs a
		// value that is fully determined by the operands.
		if (operands.includes(target)) { touch(target); cse.clear(); continue; }

		const key = operands.join('\u0000');
		const entry = cse.get(key);
		const valid = !!entry
			&& versionOf(entry.dest) === entry.destVersion
			&& entry.versions.every(([name, version]) => versionOf(name) === version);
		if (valid) {
			leaf.content = `set ${target} ${entry.dest}`;
			touch(target);
			continue;
		}

		cse.set(key, {
			dest: target,
			destVersion: versionOf(target),
			versions: [...new Set(operands)].map(name => [name, versionOf(name)])
		});
		touch(target);
	}

	/*
	B4: `read <char>` gives `digit + 35`, and the generator undoes that with
	`op sub t t 35`. When the very next instruction folds the constant into an
	`add`/`sub`, correcting there is one instruction shorter.
	*/
	for (let i = 0; i < block.length - 1; i++) {
		const leaf = block[i];
		if (!leaf?.content || protectedNodes.has(leaf)) continue;
		const tokens = tokenize(leaf.content);
		if (tokens.length !== 5 || tokens[0] !== 'op' || tokens[1] !== 'sub') continue;
		const [, , target, source, correction] = tokens;
		if (target !== source || !/^-?\d+$/.test(correction)) continue;
		const next = block[i + 1];
		if (!next?.content || protectedNodes.has(next)) continue;
		const nextTokens = tokenize(next.content);
		if (nextTokens.length !== 5 || nextTokens[0] !== 'op'
			|| !['add', 'sub', 'lessThan', 'lessThanEq', 'greaterThan',
				'greaterThanEq', 'equal', 'notEqual', 'strictEqual'].includes(nextTokens[1])
			|| nextTokens[3] !== target || !/^-?\d+$/.test(nextTokens[4])) continue;
		/*
		Is this the only read of the intermediate before it is overwritten?
		Temporary names are reused between statements, so a whole-program count
		would see earlier uses of a previous value and refuse a valid fold.
		*/
		const nextPos = next.__mlogPos ?? -1;
		if (nextPos < 0 || hasAnotherUseAfter(leaves, nextPos + 1, target)) continue;
		/*
		`corrected = raw - K`. Folding into `corrected + C` gives
		`raw + (C - K)`; folding into `corrected - C` or any comparison gives
		`raw ... (C + K)`.
		*/
		const constant = nextTokens[1] === 'add'
			? Number(nextTokens[4]) - Number(correction)
			: Number(nextTokens[4]) + Number(correction);
		nextTokens[4] = String(constant);
		next.content = nextTokens.join(' ');
		leaf.content = '';
	}
}

/**
 * Fold `op sub t t <offset>` into the comparison of an immediately following
 * jump or `select`.
 *
 * `t` is `raw - offset`, so `t < C` is `raw < C + offset` (and the same shift
 * applies to every comparison and to equality). This is the branch half of the
 * encoded-correction fold; the arithmetic half runs inside a block.
 *
 * @param {any[]} leaves
 * @param {Set<any>} protectedNodes
 * @returns {void}
 */
function foldCorrectionsIntoBranches(leaves, protectedNodes) {
	for (let i = 0; i < leaves.length - 1; i++) {
		const leaf = leaves[i];
		if (!leaf?.content || protectedNodes.has(leaf)) continue;
		const tokens = tokenize(leaf.content);
		if (tokens.length !== 5 || tokens[0] !== 'op' || tokens[1] !== 'sub') continue;
		const [, , target, source, correction] = tokens;
		if (target !== source || !/^-?\d+$/.test(correction)) continue;
		const next = leaves[i + 1];
		if (!next?.content || protectedNodes.has(next)) continue;
		const nextTokens = tokenize(next.content);
		let constantIndex = -1;
		if (nextTokens[0] === 'jump' && nextTokens.length >= 5
			&& nextTokens[3] === target && /^-?\d+$/.test(nextTokens[4])) {
			constantIndex = 4;
		} else if (nextTokens[0] === 'select' && nextTokens.length >= 5
			&& nextTokens[3] === target && /^-?\d+$/.test(nextTokens[4])) {
			constantIndex = 4;
		}
		if (constantIndex < 0) continue;
		const nextPos = next.__mlogPos ?? -1;
		if (nextPos < 0 || hasAnotherUseAfter(leaves, nextPos + 1, target)) continue;
		nextTokens[constantIndex] = String(Number(nextTokens[constantIndex]) + Number(correction));
		next.content = nextTokens.join(' ');
		leaf.content = '';
	}
}

/**
 * Remove pure writes to generated temporaries that the whole program never
 * reads. `@` names are never touched; user variables and memory cells are left
 * alone even when they look dead.
 *
 * @param {any[]} leaves
 * @param {Set<any>} protectedNodes
 * @param {Map<string, number>} reads
 * @returns {void}
 */
function eliminateDeadTemps(leaves, protectedNodes, reads) {
	for (const leaf of leaves) {
		if (!leaf?.content || protectedNodes.has(leaf)) continue;
		if (isBarrier(leaf, protectedNodes)) continue;
		const tokens = tokenize(leaf.content);
		const index = targetIndex(tokens);
		if (index < 0) continue;
		const target = tokens[index];
		if (!target || target.startsWith('@')) continue;
		if (target.startsWith('__mc_')) continue;
		if (!target.startsWith('__') && !target.includes('__tempsym')) continue;
		if ((reads.get(target) ?? 0) > 0) continue;
		leaf.content = '';
	}
}

/**
 * Run the product-level peepholes.
 *
 * @param {Instruction} root
 * @returns {Instruction}
 */
export function optimizeMlog(root) {
	if (!root || !root.isInstructionGroup) return root;
	const { leaves, lineLeaves, numeric } = flatten(root);
	const protectedNodes = collectProtected(leaves, numeric, lineLeaves);

	/*
	A sequence is optimised only while it stays inside one barrier-free run.
	The referrers themselves are barriers as well: a jump target sits between
	two sequences, never inside one.
	*/
	let start = 0;
	const flush = end => {
		if (end > start) {
			optimizeBlock(leaves.slice(start, end), protectedNodes, leaves);
		}
	};
	for (let i = 0; i < leaves.length; i++) {
		const leaf = leaves[i];
		if (!leaf || leaf.isInstructionReferrer || isBarrier(leaf, protectedNodes)) {
			flush(i);
			start = i + 1;
		}
	}
	flush(leaves.length);

	// Branches are barriers for the block pass, so their correction fold runs
	// over the flat sequence.
	foldCorrectionsIntoBranches(leaves, protectedNodes);

	// `optimizeBlock` may blank an instruction; a second global pass sees the
	// reads that disappeared with it.
	eliminateDeadTemps(leaves, protectedNodes, countReads(leaves));

	/*
	Now that the final line count is known, turn every numeric group-relative
	referrer into an absolute line number. The flattened root has no groups, so
	`raw_output` adds nothing to them.
	*/
	const newLine = new Map();
	let line = 0;
	for (let old = 0; old < lineLeaves.length; old++) {
		const leaf = lineLeaves[old];
		if (leaf?.content && leaf.content.length > 0) {
			newLine.set(old, line++);
		}
	}
	for (const reference of numeric) {
		const mapped = newLine.get(reference.targetOld);
		if (mapped === undefined) continue;
		reference.leaf.referrer[reference.index] = mapped;
	}

	const kept = leaves.filter(leaf =>
		leaf?.isInstructionReferrer === true
		|| leaf?.isInstructionGroup === true
		|| (typeof leaf?.content === 'string' && leaf.content.length > 0));
	return new Instruction(kept, null, new Map(root._attributes ?? []));
}
