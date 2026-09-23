/* EXPECT: 2 2 1 */
/* A remote scalar behaves like an ordinary variable in an expression: it is
   read once per use, and the result of `rc = rc + i` in a loop accumulates. */
auto device message1;
extern int c = 1;
remote int rc = remote(@this, c);
void main() {
    print(rc + 1);
    print(rc * 2);
    print(rc == 1);
    printflush(message1); stop();
}
