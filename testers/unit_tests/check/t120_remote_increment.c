/* EXPECT: 10 11 12 12 11 */
/* `++` / `--` on a `remote` variable.

   Reading a remote variable is a `read` into a temporary, not the variable
   itself -- so `++rc` used to add 1 to that temporary and quietly do nothing,
   while `rc++` stored the old value into a temporary that had no binding at
   all. Both have to write back through the binding. */
auto device message1;
extern int c = 10;
remote int rc = remote(@this, c);
void main() {
    print(rc++);
    print(c);
    print(++rc);
    print(c);
    rc--;
    print(c);
    printflush(message1); stop();
}
