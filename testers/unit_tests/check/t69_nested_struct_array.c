/* EXPECT: 1 6 5 9 0 3 6 9 */
/* A struct nested in a struct, an array of those, and a struct that embeds an array (which forces the whole struct into memory). */
auto device message1;
struct inner { int a; int b; };
struct outer { struct inner i; int c; };
struct outer arr[2];
struct witharr { int n; int data[4]; };
struct witharr w;
int i;
void main() {
    arr[0].i.a = 1; arr[0].i.b = 2; arr[0].c = 3;
    arr[1].i.a = 4; arr[1].i.b = 5; arr[1].c = 6;
    print(arr[0].i.a); print(arr[1].c); print(arr[1].i.b);
    w.n = 9;
    for (i = 0; i < 4; i++) { w.data[i] = i * 3; }
    print(w.n);
    for (i = 0; i < 4; i++) { print(w.data[i]); }
    printflush(message1); stop();
}
