int cur = 0;

void test2() {
    ++cur;
}

void test() {
    if ((long)sensor(@this, @copper) > 0) test2();
}

void main() {
    while (cur < 20) {
        test();
    }
    print("ok!");
}