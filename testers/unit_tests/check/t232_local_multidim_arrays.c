/*
Local multidimensional arrays: nested and flat (brace-elided) initializers,
register and encoded layouts, and row-major nested subscripts.
*/
/* EXPECT: 6 2 12 6 5 2 6 */
auto device message1;

int embeddedNested[2][3] =
	array("embedded_divided", {{1, 2, 3}, {4, 5, 6}});
int embeddedFlat[2][3] =
	array("embedded_divided", {7, 8, 9, 10, 11, 12});
const int encoded[2][3] =
	array("encoded", {{1, 2, 3}, {4, 5, 6}});
int memory[2][3] = {{1, 2, 3}, {4, 5, 6}};

void main() {
	print(embeddedNested[1][2]);
	print(embeddedNested[0][1]);
	print(embeddedFlat[1][2]);
	print(encoded[1][2]);
	print(memory[1][1]);
	print(lenof(embeddedNested));
	print(sizeof(embeddedNested));
	printflush(message1);
	stop();
}
