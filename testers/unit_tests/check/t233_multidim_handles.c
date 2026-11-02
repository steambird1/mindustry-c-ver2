/*
A handle is a one-dimensional flat span. A multidimensional array can be
passed to `int s[]` and used with a row-major flat index; fixed multidimensional
parameters keep their shape for nested subscripts.
*/
/* EXPECT: 6 6 6 12 12 2 */
auto device message1;

int memory[2][3] = {{1, 2, 3}, {4, 5, 6}};
int embedded[2][3] =
	array("embedded_divided", {7, 8, 9, 10, 11, 12});

void flat(int s[]) {
	print(lenof(s));
	print(s[5]);
}

void shaped(int s[2][3]) {
	print(s[1][2]);
	print(lenof(s));
}

void main() {
	flat(memory);
	flat(embedded);
	shaped(embedded);
	printflush(message1);
	stop();
}
