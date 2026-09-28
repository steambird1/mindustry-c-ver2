/* EXPECT: 1 2 */
/* One `auto` function, two call sites that need DIFFERENT representations:
     - `&g` is a local register, so it can travel as a NAME (and g stays a
       register);
     - `&v` is `volatile`, which means "keep it in memory", so it has to travel
       as an ADDRESS.
   A single function cannot do both -- that used to be a silent miscompilation.
   With `auto` each call site gets its own version, and the generated code
   therefore has two of them.

   Printing 1 2 is necessary but not sufficient: a version compiled for the
   wrong representation still stores 1 and 2 in the right places, because the
   store is `val` either way. What separates the two is how the argument is
   reached, so that is what the lines below pin. */
#pragma noinline
/* EMIT: op add _setp @counter 1 */
/* EMIT: op add _setp__ov1 @counter 1 */
/* The NAME version reads the argument as a name: `@this` IS the block the
   caller named. There is no link step and no offset to add. */
/* EMIT: set g:\S*setp\.p "g:\S*" */
/* EMIT: write g:\S*setp\.val @this g:\S*setp\.p */
/* EMIT-NOT: getlink __curb g:\S*setp\.p_block */
/* EMIT-NOT: g:\S*setp\.p_pos */
/* The ADDRESS version round-trips through a linked block instead. */
/* EMIT: set g:\S*setp__ov1\.p_block g:\S*__pointer_block */
/* EMIT: set g:\S*setp__ov1\.p_pos g:\S*__pointer_pos */
/* EMIT: getlink __curb g:\S*setp__ov1\.p_block */
/* EMIT: write g:\S*setp__ov1\.val __curb g:\S*setp__ov1\.p_pos */
/* EMIT-NOT: @this g:\S*setp__ov1\.p */
#pragma optimize(pointer)
#pragma overload(auto)
auto device message1;
void setp(auto int *p, int val) { (*p) = val; }
void main() {
    int g = 0;
    volatile int v = 0;
    setp(&g, 1);
    setp(&v, 2);
    print(g); print(v);
    printflush(message1); stop();
}
