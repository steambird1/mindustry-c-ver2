/*
Storage-duration combinations with extern:
- extern alone re-runs its initializer every processor pass;
- extern without an initializer is left alone;
- extern static has a run-local guard (initializes once per pass);
- persistent extern keeps its guard and value across runs.
*/
// RUNS: 2
/* EXPECT: 1 0 1 1 1 1 1 2 */
auto device message1;

extern int counter = 1;
extern int untouched;
extern static int perRun = 1;
persistent extern int kept = 1;

void main() {
	print(counter);
	counter = counter + 1;

	print(untouched);
	untouched = untouched + 1;

	print(perRun);
	perRun = perRun + 1;

	print(kept);
	kept = kept + 1;

	printflush(message1);
	end();
}
