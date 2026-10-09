/* EXPECT: 120 9 24 3 int: 120 char: a */
/* A single-quoted character literal is an `int` holding its ASCII value
   (docs/OPEN_WORK.md 7.1): `'x'` is the NUMBER 120, so it takes the `int`
   overload, while the double-quoted "a" stays a char and takes the char
   overload (t117). Initializers and arithmetic follow the int type, and
   escapes decode to their codes: `'\t'` is 9, `'\0'` is 0. */
auto device message1;
int G = '\t';
void out(int x)  { print("int:", x); }
void out(char x) { print("char:", x); }
void main() {
    int c = 'x';
    print(c);
    print(G);
    print('x' - 'a' + 1);
    print((int)'\0' + 3);
    out('x');
    out("a");
    printflush(message1); stop();
}