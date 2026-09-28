/* EXPECT: 7 */
/* The same program as t96_fnptr_pointer.c, but compiled the way the optimiser
   prefers: `#pragma optimize(pointer)` is on. That is the setting it used to
   break in -- the analysis decided on its own that the parameter could travel
   as a register NAME, compiled the callee that way, and left the indirect call
   site still sending an address, so the parameter was whatever `__param_0`
   happened to hold.

   t96 already covers this by printing 7 under every combination of pragmas,
   and that is the assertion worth most. The lines below are here because
   printing the right value does not by itself mean the value was passed the
   right way: a name and an address are both just `__param_0`, and only one of
   them is what the callee reads. */
#pragma optimize(pointer)
/* EMIT: set g:\S*test\.p_block __param_0_block */
/* EMIT: write 7 __curb g:\S*test\.p_pos */
/* EMIT: set __param_0_block g:\S*\.__pointer_block */
/* EMIT-NOT: set g:\S*test\.p __param_0 */
/* EMIT-NOT: @this g:\S*test\.p */
auto device message1;
typedef void (*cb)(int*);
void test(int *p) { (*p) = 7; }
void main() {
    int a = 0;
    cb f = test;
    f(&a);
    print(a);
    printflush(message1); stop();
}
