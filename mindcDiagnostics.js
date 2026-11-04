/*
Shared diagnostic shape and location normalization.

Stages keep their existing `message` / `line` / `column` fields so current
callers and tests continue to work. New consumers also get:

  severity, stage, code, range { start, end }, related, hints, fix

`range` is what a source viewer needs for an insertion point or a multi-character
underline. `line`/`column` are the start of that range.
*/

/**
 * Find a location object on a location, an AST node, or an attribute node.
 *
 * @param {any} where
 * @returns {{line:number, column:number, index?:number, endLine?:number,
 *            endColumn?:number, endIndex?:number, length?:number}}
 */
export function diagnosticLocation(where) {
	if (where === null || where === undefined) return { line: 0, column: 0 };
	if (typeof where === 'number') return { line: where, column: 0 };
	if (typeof where.line === 'number') return where;
	const candidate = (typeof where.location === 'object' && where.location)
		? where.location
		: (typeof where.getAttribute === 'function' ? where.getAttribute('location') : null);
	return candidate ? diagnosticLocation(candidate) : { line: 0, column: 0 };
}

/**
 * Convert any accepted location form into a start/end range.
 *
 * @param {any} where
 * @returns {{start:{line:number,column:number,index?:number},
 *            end:{line:number,column:number,index?:number}}}
 */
export function diagnosticRange(where) {
	const loc = diagnosticLocation(where);
	const start = { line: loc.line ?? 0, column: loc.column ?? 0 };
	if (typeof loc.index === 'number') start.index = loc.index;
	const length = Number.isFinite(Number(loc.length)) ? Number(loc.length) : 0;
	const end = {
		line: typeof loc.endLine === 'number' ? loc.endLine : start.line,
		column: typeof loc.endColumn === 'number'
			? loc.endColumn : start.column + length
	};
	if (typeof loc.endIndex === 'number') end.index = loc.endIndex;
	else if (typeof loc.index === 'number') end.index = loc.index + length;
	return { start, end };
}

function defaultCode(stage, severity) {
	const prefix = severity === 'warning' ? 'W' : 'E';
	switch (stage) {
		case 'lexer': return `${prefix}_LEXER`;
		case 'parser': return `${prefix}_PARSE`;
		case 'semantic': return `${prefix}_SEMANTIC`;
		case 'optimizer': return `${prefix}_OPTIMIZER`;
		case 'codegen': return `${prefix}_CODEGEN`;
		default: return `${prefix}_DIAGNOSTIC`;
	}
}

/**
 * Build one structured diagnostic.
 *
 * @param {object} info
 * @param {'error'|'warning'|'note'} [info.severity]
 * @param {string} [info.stage]
 * @param {string} [info.code]
 * @param {string} info.message
 * @param {any} [info.location]
 * @param {any[]} [info.related]
 * @param {any[]} [info.hints]
 * @param {any} [info.fix]
 * @param {any} [info.details]
 * @returns {object}
 */
export function makeDiagnostic(info) {
	const severity = info.severity ?? 'error';
	const stage = info.stage ?? 'semantic';
	const range = info.range ?? diagnosticRange(info.location);
	const start = range.start ?? { line: 0, column: 0 };
	const end = range.end ?? start;
	const diagnostic = {
		severity,
		stage,
		code: info.code ?? defaultCode(stage, severity),
		message: info.message,
		range: { start, end },
		// Compatibility fields: callers only knew line/column.
		line: start.line ?? 0,
		column: start.column ?? 0,
		endLine: end.line ?? start.line ?? 0,
		endColumn: end.column ?? start.column ?? 0
	};
	if (typeof start.index === 'number') diagnostic.index = start.index;
	if (info.related?.length) {
		diagnostic.related = info.related.map(item => ({
			...item,
			range: item.range ?? diagnosticRange(item.location)
		}));
	}
	if (info.hints?.length) diagnostic.hints = info.hints;
	if (info.fix) diagnostic.fix = info.fix;
	if (info.details !== undefined) diagnostic.details = info.details;
	return diagnostic;
}
