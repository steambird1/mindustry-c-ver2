/* EXPECT: 3 */
/* while (true) with a break: simulated until the break is reached. */
auto device message1;
void main() {
    int i = 0, c = 0;
    while (true) {
        if (i >= 3) { break; }
        i = i + 1;
    }
    print(i);
    printflush(message1); stop();
}
