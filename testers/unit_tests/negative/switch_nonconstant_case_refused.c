/*
A case label is an INTEGER CONSTANT EXPRESSION. A variable is not one, even
when it is a `const int` in C (C++ is different): the dispatch cannot be built
from a run-time value.

MESSAGE: A case label must be a compile-time integer constant
*/
void main() {
	int x = 1;
	int k = 2;
	switch (x) {
		case k: break;
	}
}
