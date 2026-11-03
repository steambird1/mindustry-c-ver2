/* MESSAGE: needs single-cell or one-register packed struct elements */
/*
A struct with two storage leaves cannot be addressed by one lookup name.
*/
auto device message1;

struct S {
    int x;
    int a:3;
    int b:4;
};

extern struct S a[2] = array("embedded_lookup");

void main() {
    print(a[0].x);
    printflush(message1);
    stop();
}
