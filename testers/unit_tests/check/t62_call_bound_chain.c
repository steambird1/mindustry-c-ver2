/* EXPECT: 8130 */
/* The loop bound comes from a chain of calls; nothing is inlined at the controlling position, and the bound is computed by constant folding. */
auto device message1;
int bar(int x, int y) { return x*y; }
int foo(int x, int y) { return bar(x,y)+x; }
int test(int x, int y) {
   int a = foo(x+1,y+1);
   int b = foo(x+3,y+4);
   return a+b;
}
void main() {
   int res = foo(3,4), tester = 0, i;
   for (i = 0; i < test(4,5); i++) { tester += res + i + 10; }
   tester += foo(5,8);
   print(tester);
   printflush(message1); stop();
}
