/*
An alias (`int a[] = mem;`) has no storage of its own: it IS the array it
names. Writing through one is therefore a write to the TARGET, and a target
that is a constant table has nowhere for the write to land. Two shapes:

- an explicit `array("encoded", ...)` target: the semantic refusal names both
  the alias and the target, instead of letting the generator crash with
  `Internal parser error: an encoded array is constant and cannot be written
  to`;
- a `const` target: the ordinary `Cannot assign to const variable` check,
  reached through the alias.

The `NOT-MESSAGE` line is the point of the first shape: this must never be an
internal error again.

MESSAGE: Cannot assign to 'ae': it is an alias of 'enc', which is an encoded constant table
MESSAGE: Cannot assign to const variable
NOT-MESSAGE: Internal parser error
*/
int enc[4] = array("encoded", {1, 2, 3, 4});
int ae[] = enc;

const int cmem[4] = {1, 2, 3, 4};
int ac[] = cmem;

void main() {
	ae[0] = 9;
	ac[0] = 9;
}
