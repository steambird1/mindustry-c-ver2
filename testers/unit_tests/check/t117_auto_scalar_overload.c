/* EXPECT: int: 42 string: a */
/* `auto` on a SCALAR parameter has nothing to specialise -- a plain int has one
   representation -- so `void output(auto int x)` is simply `void output(int x)`,
   and it has to accept any argument, not only a bare name: a literal, a cast,
   an expression.

   Overload resolution is unaffected: `"a"` is a native `string_t`, so it goes
   to the `string_t` version; the cast goes to the int one. */
#pragma noinline
auto device message1;
auto device processor1;
extern int q = 42;
extern int p;
void output(auto int x) { print("int:", x); }
void output(string_t x) { print("string:", x); }
void main() {
    remote int s = remote(processor1, p);
    output((int)q);
    output("a");
    printflush(message1); stop();
}
