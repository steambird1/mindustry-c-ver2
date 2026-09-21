/* EXPECT: 2503 */
/* A `for` loop is rewritten as `while` and then computed in full. */
auto device message1;
int foo(int x, int y) { return x+y; }
void main() {
   int res = foo(3,4);
   int range = foo(11,45), test = 0, i;
   for (i = 0; i < range; i++) { test += res + i + 10; }
   test += foo(5,6);
   print(test);
   printflush(message1); stop();
}
