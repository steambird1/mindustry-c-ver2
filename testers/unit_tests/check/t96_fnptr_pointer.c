/* EXPECT: 7 */
/* A function pointer is a value (a line number), and a parameter that has an
   address keeps travelling as one -- so it survives an indirect call. */
/* `int *` in the pointer's type says ADDRESS, and nothing can change that at
   run time, so the callee is compiled that way whatever `#pragma
   optimize(pointer)` says. Printing 7 is not enough on its own: the value
   would also come out right if the callee read a register name and the call
   site happened to put one there. The assertions below pin the two halves of
   the agreement instead: the callee takes an address, and the call site sends
   one. */
/* EMIT: set g:\S*test\.p_block __param_0_block */
/* EMIT: write 7 __curb g:\S*test\.p_pos */
/* EMIT: set __param_0_block g:\S*\.__pointer_block */
/* EMIT: set __param_0_pos g:\S*\.__pointer_pos */
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
