/* EXPECT: 1125899906842624 */
/* The machine's bitwise instructions work on full-range numbers, but
   JavaScript's `&` `|` `<<` truncate to 32 bits first -- under which `1 << 50`
   came out as 262144 and a packed handle was silently wrong. This is 2^50, so
   it only comes out right when the shift keeps its full width. */
auto device message1;
void main() {
    int a = 1;
    int i = 0;
    while (i < 50) { a = a + a; i = i + 1; }
    print(a);
    printflush(message1); stop();
}
