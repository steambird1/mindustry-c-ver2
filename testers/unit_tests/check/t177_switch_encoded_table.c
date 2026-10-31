/*
A dense switch compiles to an encoded jump table: the case addresses live in
base-57 digit strings, filled in at final layout, and `read` plus Horner's
rule rebuilds the target address in O(1).

The filler is only there to push `classify` past line 57, so both base-57
planes are used and the encoded characters include `$`/`&` (which would be
mishandled by a multi-character replacement). The filler itself produces no
output. There is no `default`: `classify(9)` must go to `switch_end` and
print nothing.

`EMIT` assertions on the table read and counter write prove the table path;
the runner re-runs this under the invariance pragmas.
*/
/* EXPECT: 10 13 17 */
/* EMIT: read __switch_tgt_ */
/* EMIT: set @counter __switch_tgt_ */
auto device message1;

#pragma noinline
void filler() {
	printflush(message1);
	printflush(message1);
	printflush(message1);
	printflush(message1);
	printflush(message1);
	printflush(message1);
	printflush(message1);
	printflush(message1);
	printflush(message1);
	printflush(message1);
}

#pragma noinline
void classify(int x) {
	switch (x) {
		case 0: print(10); break;
		case 1: print(11); break;
		case 2: print(12); break;
		case 3: print(13); break;
		case 4: print(14); break;
		case 5: print(15); break;
		case 6: print(16); break;
		case 7: print(17); break;
	}
}

void main() {
	filler();
	classify(0);
	classify(3);
	classify(7);
	classify(9);
	printflush(message1);
	stop();
}
