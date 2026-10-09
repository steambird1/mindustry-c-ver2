/**
 * Reading the annotations that a test file carries in its comments.
 *
 * The runners share this because the same mistake was made once per runner,
 * and every version of it turns a test into a no-op that still reports `ok`:
 *
 *  1. An annotation value is a REGEX, and a regex routinely contains `*`.
 *     Reading the value with `([^*]*)` stops at the first `*`, so the whole
 *     annotation is lost. `check.mjs` did exactly that, and 8 `EMIT`
 *     assertions in 6 files were silently never evaluated -- 6 of them would
 *     have failed.
 *  2. Finding annotations with `/* ... *\/` over the raw source attributes
 *     text to the wrong comment, and a comment that merely MENTIONS a marker
 *     in prose is then read as if the marker were written there.
 *  3. Asking "does this file already use `#pragma optimize(...)`?" by
 *     searching the raw source finds the pragma in the comment that explains
 *     it, and then skips the invariance run that would have covered the file.
 *
 * So the source is walked once, properly, and every annotation is read out of
 * the comments that walk reports. Nothing here looks at a pattern in a
 * comment: what a comment says is never evidence about the code.
 */

/** `/` and `*` do not need escaping outside a character class, but be safe. */
function escapeRegExp(text) {
	return String(text).replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
}

/**
 * Walk the source, reporting every comment and the code with comments removed.
 *
 * A string or character literal is copied through untouched, so a `/*` inside
 * one is text and not the start of a comment. Comments are blanked rather than
 * deleted, so the result still has the original line numbering.
 *
 * @param {string} src
 * @returns {{comments: string[], code: string}}
 */
function scan(src) {
	const comments = [];
	let code = '';
	let i = 0;
	const n = src.length;
	while (i < n) {
		const c = src[i];
		if (c === '"' || c === "'") {
			const quote = c;
			let j = i + 1;
			while (j < n) {
				if (src[j] === '\\') { j += 2; continue; }
				if (src[j] === quote) { j++; break; }
				// An unterminated literal must not swallow the rest of the file.
				if (src[j] === '\n') break;
				j++;
			}
			code += src.slice(i, j);
			i = j;
			continue;
		}
		if (c === '/' && src[i + 1] === '*') {
			const end = src.indexOf('*/', i + 2);
			const stop = end < 0 ? n : end;
			comments.push(src.slice(i + 2, stop));
			// Keep the newlines so line numbers still line up.
			code += src.slice(i, stop).replace(/[^\n]/g, ' ');
			i = stop;
			continue;
		}
		if (c === '/' && src[i + 1] === '/') {
			const end = src.indexOf('\n', i);
			const stop = end < 0 ? n : end;
			comments.push(src.slice(i + 2, stop));
			code += ' '.repeat(stop - i);
			i = stop;
			continue;
		}
		code += c;
		i++;
	}
	return { comments, code };
}

/** The text of every comment (block and line), in source order. */
export function commentsOf(src) {
	return scan(src).comments;
}

/**
 * The source with every comment blanked out.
 *
 * Use this whenever the question is about the CODE -- whether a pragma is
 * really in force, for instance. A comment that talks about a pragma is not
 * the same thing as a file that uses one.
 */
export function codeOnly(src) {
	return scan(src).code;
}

/**
 * `MARKER: value`, one per line, in source order.
 *
 * The value runs to the end of its line and may contain anything, `*`
 * included, so it can be handed to `RegExp` as written.
 *
 * @param {string} src
 * @param {string} marker e.g. `EMIT`
 * @returns {string[]}
 */
export function annotationsOf(src, marker) {
	const results = [];
	/*
	The marker must not be the tail of a longer one. `\b` is not enough:
	`NOT-MESSAGE:` has a word boundary between `-` and `M`, so a bare
	`\bMESSAGE:` reads the `NOT-MESSAGE:` line as a positive assertion and the
	runner then demands that a refusal it is supposed to be silent about
	matches. Requiring the preceding character to be neither a word character
	nor `-` is what tells the two apart.
	*/
	const re = new RegExp(`(?<![\\w-])${escapeRegExp(marker)}:([^\\n]*)`, 'g');
	for (const comment of commentsOf(src)) {
		for (const m of comment.matchAll(re)) {
			const value = m[1].trim();
			if (value !== '') results.push(value);
		}
	}
	return results;
}

/**
 * `MARKER: value` where the value is PROSE and may run to the end of the
 * comment, collapsed onto one line. For notes, not for regexes.
 *
 * @param {string} src
 * @param {string} marker e.g. `KNOWN-GAP`
 * @returns {string?} the first one, or null
 */
export function annotationText(src, marker) {
	const re = new RegExp(`\\b${escapeRegExp(marker)}:`, 'g');
	for (const comment of commentsOf(src)) {
		const m = re.exec(comment);
		if (m) return comment.slice(m.index + m[0].length).replace(/\s+/g, ' ').trim();
	}
	return null;
}

/**
 * Whether `MARKER` is written with no value at all -- a bare `NO-INVARIANT`.
 *
 * A marker named in prose does not count: only the line the marker ends on
 * matters, and a value after a colon means it was not bare.
 *
 * @param {string} src
 * @param {string} marker
 * @returns {boolean}
 */
export function hasBareAnnotation(src, marker) {
	const re = new RegExp(`\\b${escapeRegExp(marker)}\\b([^\\n]*)`, 'g');
	for (const comment of commentsOf(src)) {
		for (const m of comment.matchAll(re)) {
			if (m[1].trim() === '') return true;
		}
	}
	return false;
}

/**
 * The first `MARKER: value` in the file, split on whitespace.
 *
 * @param {string} src
 * @param {string} marker
 * @returns {string[]}
 */
export function annotationWords(src, marker) {
	const first = annotationsOf(src, marker)[0];
	return first === undefined ? [] : first.split(/\s+/).filter(x => x !== '');
}
