auto device message1;
struct witharr {
    int n;
    int data[4];
};
void main() {
    struct witharr a;
    a.n = 1;
    a.data[2] = 9;
    print(a.n);
    print(a.data[2]);
    printflush(message1);
    stop();
}
