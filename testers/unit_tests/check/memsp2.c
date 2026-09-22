/* EXPECT: 555 */
auto device message1;
auto device bank1;

int *pick(int n) {
    device d = getlink(n);
    return (int*)memsp(d, 3);
}

void main() {
    int *p = pick(1);
    (*p) = 555;
    print(*p);
    printflush(message1);
    stop();
}
