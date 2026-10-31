/*
An `extern` declaration with an explicit initializer still performs that
assignment on THIS side. It is a local definition as well as a name visible
to other processors, so the initializer runs again at the start of every
processor pass.

An `extern` declaration without an initializer is left to its owner: it is
not reset by the per-run global reset.

`// RUNS: 2`:
- `initialized` is assigned 10 in both runs;
- `untouched` keeps its value across the restart (0, then 1).
*/
// RUNS: 2
/* EXPECT: 10 0 10 1 */
auto device message1;

extern int initialized = 10;
extern int untouched;

void main() {
	print(initialized);
	initialized = initialized + 1;

	print(untouched);
	untouched = untouched + 1;

	printflush(message1);
	end();
}
