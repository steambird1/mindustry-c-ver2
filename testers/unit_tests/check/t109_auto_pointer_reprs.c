/* EXPECT: 7 */
/* EMIT: write 7 \S+ g:\S+ */
/* `void test(auto int *s)`: one version per representation of the argument.
   Here it is called once, with `&a` -- the address of a plain register -- so
   the version emitted takes a NAME, and the write lands on `a`. */
auto device message1;
void test(auto int *s) { (*s) = 7; }
void main() {
    int a = 0;
    test(&a);
    print(a);
    printflush(message1); stop();
}
