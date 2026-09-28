/* EXPECT: 7 */
/* An `auto` function reached through a FUNCTION POINTER: the pointer is the
   line number of one version, so the call is really a call of that version --
   no representation has to be discovered at run time. The pointer's own type
   is what picks the version, and it has to be a concrete one: `int *` is an
   address, so this is the `memory` version.

   Printing 7 is necessary but not sufficient. What makes it 7 is the ABI at
   the call: the version unpacks the address the call site hands it, so the
   version that is reached has to be the one that was compiled to unpack it.
   The lines below pin both halves of that, including that there is no second
   version for the pointer to have picked wrongly. */
/* EMIT: op add _setp @counter 1 */
/* EMIT-NOT: op add _setp__ov1 */
/* The pointer holds a LINE NUMBER, which is the label of the version. */
/* EMIT: set g:\S*\.f _setp */
/* The version unpacks what the indirect call put in the argument registers. */
/* EMIT: set g:\S*setp\.p_block __param_0_block */
/* EMIT: set g:\S*setp\.p_pos __param_0_pos */
/* EMIT: getlink __curb g:\S*setp\.p_block */
/* EMIT: write 7 __curb g:\S*setp\.p_pos */
/* An address version, not a name one: nothing here reads `@this`. */
/* EMIT-NOT: @this g:\S*setp\.p */
#pragma overload(auto)
auto device message1;
typedef void (*cb)(int *p);
void setp(auto int *p) { (*p) = 7; }
void main() {
    cb f = setp;
    int x = 0;
    f(&x);
    print(x);
    printflush(message1); stop();
}
