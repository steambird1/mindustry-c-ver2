/* EXPECT: 1 2 */
/* The FILE-SCOPE counterpart of t112_auto_mixed_pointer_reprs.c, which uses
   locals for the same thing. One `auto` function, two call sites:
     - `&g` names a plain register, so it could travel as a NAME;
     - `&v` is `volatile`, which means "keep it in memory", so it has to travel
       as an ADDRESS.
   A single function cannot be written both ways, and `auto` is what lets each
   call site have its own version -- so two versions must be emitted. Without
   `#pragma noinline` the function is inlined into both call sites and no
   version exists to look at, which is why the pragma is here. This is the same
   shape as t112, one scope up.

   Two versions existing is not the same as each being written the way its own
   call site needs, so the argument-reaching code is pinned too: the name
   version reads `@this`, the address version links a block and adds an
   offset. */
/* EMIT: op add _setp @counter 1 */
/* EMIT: op add _setp__ov1 @counter 1 */
/* The NAME version, handed the name of the global itself. */
/* EMIT: set g:\S*setp\.p "g:\.g" */
/* EMIT: write g:\S*setp\.val @this g:\S*setp\.p */
/* EMIT-NOT: getlink __curb g:\S*setp\.p_block */
/* The ADDRESS version, handed the block and the offset inside it. */
/* EMIT: set g:\S*setp__ov1\.p_block bank1_id */
/* EMIT: set g:\S*setp__ov1\.p_pos 4 */
/* EMIT: getlink __curb g:\S*setp__ov1\.p_block */
/* EMIT: write g:\S*setp__ov1\.val __curb g:\S*setp__ov1\.p_pos */
/* EMIT-NOT: @this g:\S*setp__ov1\.p */
#pragma noinline
#pragma optimize(pointer)
#pragma overload(auto)
auto device message1;
int g = 0;
volatile int v = 0;
void setp(auto int *p, int val) { (*p) = val; }
void main() {
    setp(&g, 1);
    setp(&v, 2);
    print(g); print(v);
    printflush(message1); stop();
}
