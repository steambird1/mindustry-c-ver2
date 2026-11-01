/*
Builtin output parameters use the nominal-pointer form `&x`. At target 148
this still needs no byname: the register name is passed directly.
*/
/* VERSION: 148 */
/* NO-INVARIANT */
/* EXPECT: 11 22 1 core1 1 */
#include <stdbool.h>

auto device message1;

void main() {
	int x, y, found;
	device bld;
	ulocate("building", "core", false, &x, &y, &found, &bld);
	print(x);
	print(y);
	print(found);
	print(bld);

	volatile bool state;
	ucontrol("within", 11, 22, 3, &state);
	print(state);

	printflush(message1);
	stop();
}
