/*
`0 && @tick` is false without ever reading the processor's tick, and
`1 || @tick` is true without reading it either. Both conditions are decided
at compile time, so the surviving code must not contain `@tick` at all.

A runtime comparison would leave the second `if` as a jump; the first `if`
would leave a sensor/`op` on `@tick`. `EMIT-NOT: @tick` pins that the lazy
side was really dropped.
*/
/* EXPECT: 2 */
/* EMIT-NOT: @tick */
auto device message1;

void main() {
	int r = 0;
	if (0 && @tick) r = 1;
	if (1 || @tick) r = r + 2;
	print(r);
	printflush(message1);
	stop();
}
