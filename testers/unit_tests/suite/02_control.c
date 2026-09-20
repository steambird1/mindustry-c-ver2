/* if / else, while, for, break, continue */
auto device message1;

void main() {
    int i;
    int total = 0;
    for (i = 0; i < 10; i++) {
        if (i == 5) {
            continue;
        }
        if (i > 8) {
            break;
        }
        total += i;
    }
    int guard = 0;
    while (guard < 3) {
        total -= 1;
        guard++;
    }
    print(total);
    printflush(message1);
    stop();
}
