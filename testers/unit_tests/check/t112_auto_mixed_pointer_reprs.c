/* EXPECT: 1 2 */
/* One `auto` function, two call sites that need DIFFERENT representations:
     - `&g` is a plain register, so it can travel as a NAME (and g stays a
       register);
     - `&v` is `volatile`, which means "keep it in memory", so it has to travel
       as an ADDRESS.
   A single function cannot do both -- that used to be a silent miscompilation.
   With `auto` each call site gets its own version. */
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
