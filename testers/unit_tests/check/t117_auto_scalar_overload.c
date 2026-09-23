/* EXPECT: int: 42 char: a */
/* `auto` on a SCALAR parameter has nothing to specialise -- a plain int has one
   representation -- so `void output(auto int x)` is simply `void output(int x)`,
   and it has to accept any argument, not only a bare name: a literal, a cast,
   an expression.

   Overload resolution is unaffected: `"a"` is a char, so it goes to the `char`
   version; the cast goes to the int one. */
#pragma noinline
auto device message1;
auto device processor1;
extern int q = 42;
extern int p;
void output(auto int x) { print("int:", x); }
void output(char x) { print("char:", x); }
void main() {
    remote int s = remote(processor1, p);
    output((int)q);
    output("a");
    printflush(message1); stop();
}
