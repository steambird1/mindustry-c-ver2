int sid = 0;

void foo() {
    sid++;
}

void main() {
    while (true) {
        foo(); print(sid);
    }
}
