/*
A byname pointer is one register, so arrays of them use the register layout.
The elements can be read, dereferenced, assigned, indexed dynamically and
passed as an open handle.
*/
/* EXPECT: 7 8 8 10 8 9 2 9 */
auto device message1;

int x = 7;
int y = 8;
int z = 9;

int *byname automatic[2] = {byname(&x), byname(&y)};
int *byname explicit[2] =
	array("embedded_divided", {byname(&y), byname(&z)});

void readSecond(int *byname s[]) {
	print(lenof(s));
	print(*s[1]);
}

void main() {
	print(*automatic[0]);
	print(*automatic[1]);

	int i = 1;
	print(*automatic[i]);

	*automatic[0] = 10;
	print(x);

	automatic[0] = automatic[1];
	print(*automatic[0]);

	print(*explicit[1]);
	readSecond(explicit);

	printflush(message1);
	stop();
}
