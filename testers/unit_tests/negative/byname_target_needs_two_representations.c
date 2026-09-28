/* Must fail: one variable, two representations. `q` was told to hold the NAME
   of `w` and `r` needs the ADDRESS of the same `w`; a register has no address,
   so the two cannot both be done and the program has to say which one wins. */
auto device message1;
void main() {
    int w = 1;
    int *byname q;
    int *r;
    q = &w;
    r = &w;
    (*q) = 2;
    (*r) = 3;
    printflush(message1);
}
