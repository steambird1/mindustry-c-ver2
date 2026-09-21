auto device message1;
auto device cellA;
auto device cellB;
void put(device d, int pos, int v) {
    int *w = (int*)memsp(d, pos);
    (*w) = v;
}
void main() {
    put(cellA, 3, 111);
    put(cellB, 5, 222);
    put(cellA, 3, 333);
    print(1);
    printflush(message1);
    stop();
}
