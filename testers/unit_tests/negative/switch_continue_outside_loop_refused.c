/*
A switch is BREAKABLE but not CONTINUABLE: `break` leaves it, but `continue`
needs a loop around it. This one has none.

MESSAGE: 'continue' can only be used inside a loop
*/
void main() {
	int x = 1;
	switch (x) {
		case 1: continue;
	}
}
