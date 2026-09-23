/* EXPECT: 1 2 */
#pragma noinline
/* EMIT: op add _setp @counter 1 */
/* EMIT: op add _setp__ov1 @counter 1 */
/* EMIT: set g:\S*setp\S*\.p "g:\S*" */
/* One `auto` function, two call sites that need DIFFERENT representations:
     - `&g` is a local register, so it can travel as a NAME (and g stays a
       register);
     - `&v` is `volatile`, which means "keep it in memory", so it has to travel
       as an ADDRESS.
   A single function cannot do both -- that used to be a silent miscompilation.
   With `auto` each call site gets its own version, and the generated code
   therefore has two of them. */
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
