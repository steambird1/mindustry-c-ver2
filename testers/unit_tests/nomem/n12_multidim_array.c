/*
No memory block: a multidimensional array becomes a flat register array. Both
nested and brace-elided initializers work, and a handle is a flat 1D span.
*/
/* EXPECT: 4 2 7 2 4 4 4 */
auto device message1;

int nested[2][2] = {{1, 2}, {3, 4}};
int flatValues[2][2] = {5, 6, 7, 8};

void span(int s[]) {
    print(lenof(s));
    print(s[3]);
}

void main() {
    print(nested[1][1]);
    print(nested[0][1]);
    print(flatValues[1][0]);
    print(lenof(nested));
    print(sizeof(nested));
    span(nested);
    printflush(message1);
    stop();
}
