auto device message1;
auto device cellA;
auto device cellB;
int pick(int k) { return k; }
void put(device d, int pos, int v) {
    int *w = (int*)memsp(d, pos);
    (*w) = v;
}
void main() {
    device d = pick(1) == 1 ? cellA : cellB;
    put(d, 7, 999);
    print(1);
    printflush(message1);
    stop();
}
