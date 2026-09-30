/* EXPECT: 100 12 6 100 12 6 */
/* EMIT: set @counter _f */
/* EMIT: set @counter _f__ov1 */
/* EMIT: set @counter _f__ov2 */
#pragma noinline
/* These versions differ ONLY in how many parameters they take, so nothing about
   an argument can tell them apart: `f(1, 2)` hands the 2-parameter and the
   3-parameter version the same `int int`, and one more `int` is not a type.
   The count is the whole of the difference, which leaves the count to choose on.

   That is not a formality. Choosing a version needs the arguments' types, and
   visiting an argument to learn its type needs a parameter list to take its
   expected type from -- so neither step could go first, and a call carrying more
   arguments than the version a name lookup happened to find read past the end of
   that list. `f` is declared with one parameter first, so `f(1, 2)` and
   `f(1, 2, 3)` were measured against a one-parameter list and threw
   `Cannot read properties of undefined` before any diagnostic existed.

   `g` is the same three versions declared in the opposite order, and has to
   reach the same answers. Without it this file would also pass if the first
   version declared simply happened to be the one whose count matched -- which
   is what let the failure look as though it were about declaration order.

   The three `set @counter` lines are the three entry points the calls reach, so
   the printed numbers cannot be right by accident.

   Overloads that differ in TYPE rather than in count are a different question,
   and `t110_overload_pragma.c` and `t117_auto_scalar_overload.c` answer it. */
auto device message1;
int f(int a)               { return a * 100; }
int f(int a, int b)        { return a * 10 + b; }
int f(int a, int b, int c) { return a + b + c; }
int g(int a, int b, int c) { return a + b + c; }
int g(int a, int b)        { return a * 10 + b; }
int g(int a)               { return a * 100; }
void main() {
    print(f(1)); print(f(1, 2)); print(f(1, 2, 3));
    print(g(1)); print(g(1, 2)); print(g(1, 2, 3));
    printflush(message1); stop();
}
