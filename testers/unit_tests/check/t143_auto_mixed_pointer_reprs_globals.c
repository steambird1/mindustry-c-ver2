/* EXPECT: 1 2 */
/* EMIT: op add _setp @counter 1 */
/* EMIT: op add _setp__ov1 @counter 1 */
/* The FILE-SCOPE counterpart of t112_auto_mixed_pointer_reprs.c, which uses
   locals for the same thing. One `auto` function, two call sites:
     - `&g` names a plain register, so it could travel as a NAME;
     - `&v` is `volatile`, which means "keep it in memory", so it has to travel
       as an ADDRESS.
   A single function cannot be written both ways, and `auto` is what lets each
   call site have its own version -- so two versions must be emitted, which is
   what the two assertion lines above check. Without `#pragma noinline` the function
   is inlined into both call sites and no version exists to look at, which is
   why the pragma is here. This is the same shape as t112, one scope up. */
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
