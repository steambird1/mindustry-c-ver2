/*
A constant subscript past the end of an array whose length is known at
compile time is refused at semantic time (OPEN_WORK §7.4). The length is
already a source-level fact here -- `int r[3]`, `int m[2][3]` -- so `r[3]`
and `m[5]` cannot mean what they say.

Only the KNOWN quantity is checked. A dynamic subscript (`s[i]`) is left to
run time, where `i` is the only thing that knows; and the check spends no
generated code, so a program that compiled before still compiles and still
generates the same instructions.

MESSAGE: Array subscript 3 is out of bounds: 'r' has only 3 element\(s\)
MESSAGE: Array subscript 5 is out of bounds: 'm' has only 2 element\(s\)
*/
int r[3] = {1, 2, 3};
int m[2][3];

void main() {
	print(r[3]);
	print(m[5]);
}
