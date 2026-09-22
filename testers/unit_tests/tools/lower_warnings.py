"""Turn optimizer 'what I did' warnings into console.log notes."""
import re

path = '/data/workspace/src/mindcOptimizer.js'
src = open(path, encoding='utf-8').read()
lines = src.split('\n')

# Messages that describe an ACTION the optimizer took (inline / remove / rewrite),
# not a property of the program.
patterns = [
	'Replaced never-executed loop',
	'Optimized deterministic loop',
	'Partially unrolled loop',
	"Removed unused variable",
	"Removed unused function",
	"Left a 'for' loop alone",
	'Inlined function',
	'Removed empty global variable declaration',
	'Removed global variable declaration',
	'Removed unused function declaration',
	'Removed dead code',
	'Removed else branch',
	'If statement with always-false condition',
	'Removing else branch',
	'Removing then branch',
	'Removing never-executed',
	'Unrolling single-iteration',
	'Removed empty statements',
]

changed = []
for i, line in enumerate(lines):
	if 'this.addWarning(' not in line:
		continue
	if not any(p in line for p in patterns):
		continue
	lines[i] = line.replace('this.addWarning(', 'this.logOptimization(')
	changed.append(i + 1)

src = '\n'.join(lines)

# The three `warningAll` gates: `warningAll` is never set anywhere, so the note
# would never appear at all now that it is a log rather than a warning.
gate_var = re.compile(
	r'[ \t]*if \(this\.extraConfig\.getAttribute\(\'warningAll\'\)\) ?\{\n'
	r'(\s*)this\.logOptimization\((.*?)\);\n\s*\}\n')
src, n1 = gate_var.subn(lambda m: f'{m.group(1)}this.logOptimization({m.group(2)});\n', src)

gate_bare = re.compile(
	r'[ \t]*if \(this\.extraConfig\.getAttribute\(\'warningAll\'\)\)\n'
	r'(\s*)this\.logOptimization\((.*?)\);\n')
src, n2 = gate_bare.subn(lambda m: f'{m.group(1)}this.logOptimization({m.group(2)});\n', src)

open(path, 'w', encoding='utf-8').write(src)
print('lines changed:', len(changed), changed)
print('gates removed:', n1, n2)
print('remaining warningAll:', src.count('warningAll'))
