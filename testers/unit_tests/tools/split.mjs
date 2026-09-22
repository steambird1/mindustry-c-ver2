/* Split the bundled result.txt back into unit_tests/<dir>/<file>. */
import fs from 'fs';
import path from 'path';

const text = fs.readFileSync('/data/inputs/result.txt', 'utf8').replace(/\r\n/g, '\n');
const lines = text.split('\n');
const outRoot = '/data/workspace';
let current = null;
let buf = [];
const written = [];

function flush() {
	if (!current) return;
	const p = path.join(outRoot, current);
	fs.mkdirSync(path.dirname(p), { recursive: true });
	fs.writeFileSync(p, buf.join('\n').replace(/\s*$/, '\n'));
	written.push(current);
	current = null;
	buf = [];
}

for (const line of lines) {
	const begin = line.match(/^\/\*\s*BEGIN:\s*([^*\n]+?)\s*\*\/\s*$/);
	const end = line.match(/^\/\*\s*END:\s*([^*\n]+?)\s*\*\/\s*$/);
	if (begin) {
		flush();
		current = begin[1].replace(/\\/g, '/');
		continue;
	}
	if (end) {
		if (!current) throw new Error(`END without BEGIN: ${end[1]}`);
		flush();
		continue;
	}
	if (current) buf.push(line);
}
flush();
console.log(`wrote ${written.length} files`);
const dirs = new Set(written.map(w => w.split('/').slice(0, -1).join('/')));
console.log([...dirs].sort().join('\n'));
