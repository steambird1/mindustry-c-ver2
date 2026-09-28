/* EXPECT: 7 */
/* `void test(auto int *s)`: one version per representation of the argument.
   Here it is called once, with `&a` -- and `a` is a plain register that
   nothing forces into memory, so the version emitted takes a NAME and the
   write lands on `a` itself.

   `#pragma optimize(pointer)` is what turns that on: name pointers are opt-in,
   and without it `&a` travels as an address. The pragma therefore belongs to
   this test -- the two assertions below are what distinguish the two forms,
   since `write 7 <anything> <anything>` would match either. */
/* EMIT: set g:\S*test:s:0 "g:\S*a" */
/* EMIT: write 7 @this g:\S+ */
/* EMIT-NOT: write 7 __curb */
#pragma optimize(pointer)
auto device message1;
void test(auto int *s) { (*s) = 7; }
void main() {
    int a = 0;
    test(&a);
    print(a);
    printflush(message1); stop();
}
