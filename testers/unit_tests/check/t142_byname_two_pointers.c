/* EXPECT: 4 4 */
/* Two byname pointers may name the SAME variable: both ends are decided
   together, so the two representations can never disagree -- writing through
   one has to be visible through the other. */
auto device message1;
void main() {
    int w = 3;
    int *byname p = &w;
    int *byname q = byname(&w);
    (*p) = 4;
    print(*q);
    print(w);
    printflush(message1);
}
