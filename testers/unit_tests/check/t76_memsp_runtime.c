/* EXPECT: 555 */
/* The building is not known until run time (it comes from `getlink`), so the
   link index has to be searched by the helper. */
// DEVICES: bank1=memory
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
}
