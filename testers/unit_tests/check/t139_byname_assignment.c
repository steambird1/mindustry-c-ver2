/* EXPECT: 6 */
/* The same request written as a call: `q = byname(&w)` asks for the name of w
   just as `int *byname q` does, so the target keeps a register and the write
   goes through `write ... @this <name>`. */
auto device message1;
void main() {
    int w = 3;
    int *q;
    q = byname(&w);
    (*q) = 6;
    print(w);
    printflush(message1);
}
